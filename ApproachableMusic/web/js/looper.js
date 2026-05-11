// ════════════════════════════════════════════════════════
//  LOOPER MODULE  —  js/looper.js
// ════════════════════════════════════════════════════════
//
//  State machine:  idle → armed → recording → stopped → playing
//
//  ARM: waits for first note before capturing.
//  REC: captures immediately.
//
//  Play modes:
//    INPUT — re-fires chord events through the current instrument.
//    AUDIO — plays back raw recorded audio (instrument-independent).
//
//  Edit tools:
//    TRIM  — drag handles; live-updates AudioBufferSourceNode in AUDIO mode.
//    SHIFT — slide all events earlier/later (does not move audio).
//    CUT   — drag to select; deletes events + zeros audio with 5 ms crossfades.
//
//  Surgical DAW mode:
//    DOWNBEAT — amber ▼ handle in ruler strip; drag to set where bar 1 falls.
//               All grid lines, bar numbers and snap calculations anchor to it.
//    SNAP     — OFF | BAR | BEAT | ½  — locks edits to grid divisions.
//    Ruler    — 16 px strip at top of canvas with bar numbers and beat ticks.
//    Grid     — hierarchical: bar lines opaque, beat lines subtle, alt bar bands.
//
//  Coordinate spaces used throughout:
//    T_rec(t)  = t - recordStart                  (audio buffer space, 0 = rec start)
//    T_shifted = T_rec + shiftOffset              (event timing after SHIFT)
//    T_view    = T_shifted - trimStart            (canvas: 0=left, viewDur=right)
//    canvasX   = (T_view / viewDur) * W
//
//  trimStart/trimEnd/downbeat are all in T_rec space.
//  shiftOffset applies only to events; audio buffer is always T_rec-aligned.
//
//  Snap operates in screen-x space anchored to the downbeat x-position,
//  so it always aligns to what the user SEES regardless of shiftOffset.

'use strict';

const RULER = 16;   // px — height of ruler strip at top of canvas

const LOOPER = {
  state: 'idle',       // 'idle' | 'armed' | 'recording' | 'stopped' | 'playing'
  playMode: 'input',   // 'input' | 'audio'
  snap: 'off',         // 'off' | 'bar' | 'beat' | 'half'
  audioCtx: null,
  tapNode: null,
  recordDest: null,
  mediaRecorder: null,
  recordedChunks: [],
  recordStart: 0,
  recordEnd: 0,
  pendingEvents: [],
  loop: null,
  playStartTime: 0,
  audioSourceNode: null,
  schedulerHandle: null,
  canvasEl: null,
  tool: 'trim',
  drag: null,
  playheadPos: 0,
  undoStack: [],
};

// ── Audio init hook ───────────────────────────────────────────────────────────
window._looperOnAudioInit = function (ctx, tapNode) {
  LOOPER.audioCtx = ctx;
  LOOPER.tapNode  = tapNode;
  try {
    LOOPER.recordDest = ctx.createMediaStreamDestination();
    tapNode.connect(LOOPER.recordDest);
  } catch (e) {
    console.warn('Looper: MediaStreamDestination unavailable', e);
  }
};

// ── Key event hooks ───────────────────────────────────────────────────────────
window._looperOnKeyDown = function (data) {
  if (!LOOPER.audioCtx) return;
  if (LOOPER.state === 'armed') _looperStartCapture();
  if (LOOPER.state !== 'recording') return;
  LOOPER.pendingEvents.push({
    t: LOOPER.audioCtx.currentTime,
    duration: null,
    idx: data.idx,
    frequencies: data.frequencies,
    rootNoteIdx: data.rootNoteIdx,
    modeName: data.modeName,
    octave: data.octave,
    flavour: data.flavour,
    lockedMode: data.lockedMode,
    _lastScheduledCycle: -1,
  });
  _looperTickStatus();
};

window._looperOnKeyUp = function (idx) {
  if (LOOPER.state !== 'recording' || !LOOPER.audioCtx) return;
  const t = LOOPER.audioCtx.currentTime;
  for (let i = LOOPER.pendingEvents.length - 1; i >= 0; i--) {
    const ev = LOOPER.pendingEvents[i];
    if (ev.idx === idx && ev.duration === null) {
      ev.duration = Math.max(0.02, t - ev.t);
      break;
    }
  }
};

// ── Transport ─────────────────────────────────────────────────────────────────
function looperArm() {
  if (LOOPER.state === 'armed') {
    LOOPER.state = 'idle';
    _looperUpdateUI(); looperDrawFrame(); _looperSetStatus('IDLE');
    return;
  }
  if (LOOPER.state === 'recording') return;
  looperStopPlayback();
  LOOPER.loop = null; LOOPER.pendingEvents = []; LOOPER.recordedChunks = [];
  LOOPER.state = 'armed';
  _looperUpdateUI(); looperDrawFrame(); _looperSetStatus('ARMED — PLAY A NOTE');
}

function looperRecord() {
  if (LOOPER.state === 'recording') return;
  if (!LOOPER.audioCtx) {
    _looperSetStatus('PLAY A NOTE FIRST');
    setTimeout(() => _looperSetStatus(LOOPER.loop ? _looperDurLabel() : 'IDLE'), 2000);
    return;
  }
  looperStopPlayback();
  LOOPER.loop = null; LOOPER.pendingEvents = []; LOOPER.recordedChunks = [];
  _looperStartCapture();
}

function _looperStartCapture() {
  LOOPER.state = 'recording';
  LOOPER.recordStart = LOOPER.audioCtx.currentTime;
  if (LOOPER.recordDest && typeof MediaRecorder !== 'undefined') {
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', ''].find(
        m => m === '' || MediaRecorder.isTypeSupported(m));
      LOOPER.mediaRecorder = new MediaRecorder(
        LOOPER.recordDest.stream, mime ? { mimeType: mime } : {});
      LOOPER.mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) LOOPER.recordedChunks.push(e.data);
      };
      LOOPER.mediaRecorder.start(100);
    } catch (e) { console.warn('Looper: MediaRecorder start failed', e); LOOPER.mediaRecorder = null; }
  }
  _looperUpdateUI(); looperDrawFrame(); _looperTickStatus();
}

function looperStop() {
  if (LOOPER.state === 'armed') {
    LOOPER.state = 'idle'; _looperUpdateUI(); looperDrawFrame(); _looperSetStatus('IDLE'); return;
  }
  if (LOOPER.state === 'playing')   { looperStopPlayback(); return; }
  if (LOOPER.state !== 'recording') { looperStopPlayback(); return; }

  LOOPER.recordEnd = LOOPER.audioCtx.currentTime;
  const dur = LOOPER.recordEnd - LOOPER.recordStart;
  if (dur < 0.05) {
    LOOPER.state = 'idle'; _looperUpdateUI();
    _looperSetStatus('TOO SHORT'); setTimeout(() => _looperSetStatus('IDLE'), 1500); return;
  }

  LOOPER.pendingEvents.forEach(ev => {
    if (ev.duration === null) ev.duration = Math.max(0.02, LOOPER.recordEnd - ev.t);
  });

  LOOPER.loop = {
    duration:    dur,
    trimStart:   0,
    trimEnd:     dur,
    shiftOffset: 0,
    downbeat:    0,    // T_rec — where bar 1 beat 1 is in the audio
    events:      LOOPER.pendingEvents.slice(),
    audioBuffer: null,
  };
  LOOPER.state = 'stopped';

  if (LOOPER.mediaRecorder && LOOPER.mediaRecorder.state !== 'inactive') {
    LOOPER.mediaRecorder.onstop = () => _looperDecodeAudio();
    LOOPER.mediaRecorder.stop();
  }
  _looperUpdateUI(); looperDrawFrame(); _looperSetStatus(_looperDurLabel());
}

// ── Play mode ─────────────────────────────────────────────────────────────────
function looperPlayMode(mode) {
  if (!LOOPER.loop) {
    _looperSetStatus('NOTHING TO LOOP');
    setTimeout(() => _looperSetStatus(LOOPER.loop ? _looperDurLabel() : 'IDLE'), 1500); return;
  }
  if (LOOPER.state === 'playing' && LOOPER.playMode === mode) { looperStopPlayback(); return; }
  if (LOOPER.state === 'playing') looperStopPlayback();

  if (mode === 'input' && LOOPER.loop.events.length === 0) {
    _looperSetStatus('NO EVENTS RECORDED');
    setTimeout(() => _looperSetStatus(_looperDurLabel()), 1500); return;
  }
  if (mode === 'audio' && !LOOPER.loop.audioBuffer) {
    _looperSetStatus('AUDIO DECODING…');
    setTimeout(() => _looperSetStatus(_looperDurLabel()), 1500); return;
  }

  LOOPER.playMode     = mode;
  LOOPER.state        = 'playing';
  LOOPER.playStartTime = LOOPER.audioCtx.currentTime;

  if (mode === 'input') {
    LOOPER.loop.events.forEach(ev => { ev._lastScheduledCycle = -1; });
    _looperScheduleTick();
    LOOPER.schedulerHandle = setInterval(_looperScheduleTick, 25);
  } else {
    _looperStartAudioSource();
    LOOPER.schedulerHandle = setInterval(_looperUpdatePlayhead, 25);
  }
  _looperUpdateUI();
  _looperSetStatus(mode === 'input' ? 'PLAYING · INPUT' : 'PLAYING · AUDIO');
}

function looperPlay() { looperPlayMode(LOOPER.playMode); }

function looperStopPlayback() {
  if (LOOPER.schedulerHandle) { clearInterval(LOOPER.schedulerHandle); LOOPER.schedulerHandle = null; }
  _looperStopAudioSource();
  if (LOOPER.state === 'playing') {
    LOOPER.state = LOOPER.loop ? 'stopped' : 'idle';
    LOOPER.playheadPos = 0;
    _looperUpdateUI(); _looperSetStatus(LOOPER.loop ? _looperDurLabel() : 'IDLE'); looperDrawFrame();
  }
}

function looperClear() {
  looperStopPlayback();
  if (LOOPER.mediaRecorder && LOOPER.mediaRecorder.state !== 'inactive') LOOPER.mediaRecorder.stop();
  LOOPER.loop = null; LOOPER.pendingEvents = []; LOOPER.undoStack = [];
  LOOPER.state = 'idle';
  _looperUpdateUI(); _looperUpdateUndoBtn(); looperDrawFrame(); _looperSetStatus('IDLE');
}

// ── Audio playback (AUDIO mode) ───────────────────────────────────────────────
function _looperStartAudioSource() {
  _looperStopAudioSource();
  if (!LOOPER.loop?.audioBuffer || !LOOPER.audioCtx) return;
  const src = LOOPER.audioCtx.createBufferSource();
  src.buffer = LOOPER.loop.audioBuffer;
  src.loop = true;
  src.loopStart = LOOPER.loop.trimStart;
  src.loopEnd   = LOOPER.loop.trimEnd;
  src.connect(LOOPER.audioCtx.destination);
  src.start(0, LOOPER.loop.trimStart);
  LOOPER.audioSourceNode = src;
  LOOPER.playStartTime   = LOOPER.audioCtx.currentTime;
}

function _looperStopAudioSource() {
  if (!LOOPER.audioSourceNode) return;
  try { LOOPER.audioSourceNode.stop(); } catch (_) {}
  LOOPER.audioSourceNode.disconnect();
  LOOPER.audioSourceNode = null;
}

function _looperUpdatePlayhead() {
  if (LOOPER.state !== 'playing' || !LOOPER.loop) return;
  const effectiveDur = LOOPER.loop.trimEnd - LOOPER.loop.trimStart;
  if (effectiveDur <= 0) return;
  LOOPER.playheadPos = ((LOOPER.audioCtx.currentTime - LOOPER.playStartTime) % effectiveDur) / effectiveDur;
  looperDrawFrame();
}

// ── Audio decode ──────────────────────────────────────────────────────────────
async function _looperDecodeAudio() {
  if (!LOOPER.recordedChunks.length || !LOOPER.loop || !LOOPER.audioCtx) return;
  try {
    const blob = new Blob(LOOPER.recordedChunks, { type: 'audio/webm' });
    const arrayBuf = await blob.arrayBuffer();
    if (!LOOPER.loop) return;
    const audioBuf = await LOOPER.audioCtx.decodeAudioData(arrayBuf);
    if (!LOOPER.loop) return;
    LOOPER.loop.audioBuffer = audioBuf;
    looperDrawFrame(); _looperSetStatus(_looperDurLabel());
  } catch (e) { console.warn('Looper: audio decode failed', e); }
}

// ── Scheduler (INPUT mode) ────────────────────────────────────────────────────
function _looperScheduleTick() {
  if (LOOPER.state !== 'playing' || LOOPER.playMode !== 'input' || !LOOPER.loop) return;
  const loop = LOOPER.loop;
  const effectiveDur = loop.trimEnd - loop.trimStart;
  if (effectiveDur < 0.05) return;

  const LOOKAHEAD  = 0.120;
  const now        = LOOPER.audioCtx.currentTime;
  const elapsed    = now - LOOPER.playStartTime;
  const cycleIndex = Math.floor(elapsed / effectiveDur);
  const cyclePos   = elapsed % effectiveDur;

  loop.events.forEach(ev => {
    const tRec    = ev.t - LOOPER.recordStart;
    const tShifted = tRec + loop.shiftOffset;
    const tView   = tShifted - loop.trimStart;
    const loopPos = ((tView % effectiveDur) + effectiveDur) % effectiveDur;

    const inCurrent  = loopPos >= cyclePos && loopPos < cyclePos + LOOKAHEAD;
    const wrapping   = cyclePos + LOOKAHEAD >= effectiveDur;
    const inNext     = wrapping && loopPos < (cyclePos + LOOKAHEAD - effectiveDur);
    const targetCycle = inNext ? cycleIndex + 1 : cycleIndex;

    if ((inCurrent || inNext) && ev._lastScheduledCycle < targetCycle) {
      ev._lastScheduledCycle = targetCycle;
      const schedAt = LOOPER.playStartTime + targetCycle * effectiveDur + loopPos;
      _looperFireEvent(ev, schedAt);
    }
  });

  LOOPER.playheadPos = cyclePos / effectiveDur;
  looperDrawFrame();
}

function _looperFireEvent(ev, when) {
  const delayMs = Math.max(0, (when - LOOPER.audioCtx.currentTime) * 1000 - 5);
  setTimeout(() => {
    if (LOOPER.state !== 'playing') return;
    if (typeof playFreqs === 'function') playFreqs(ev.frequencies);
  }, delayMs);
}

// ── Snap ──────────────────────────────────────────────────────────────────────
// All snap works in screen-x space so it always aligns to what the user sees,
// regardless of shiftOffset. Returns a clamped canvas x value.
function _looperSnapX(rawX, W, viewDur) {
  if (LOOPER.snap === 'off' || !LOOPER.loop) return rawX;
  const bpm     = parseFloat(document.getElementById('looperBpmInput')?.value) || 120;
  const beats   = parseInt(document.getElementById('looperTimeSig')?.value)    || 4;
  const beatDur = 60 / bpm;
  const barDur  = beatDur * beats;
  const downbeat = LOOPER.loop.downbeat || 0;

  // Canvas x of the downbeat (audio/T_rec space — not shifted)
  const downbeatX = ((downbeat - LOOPER.loop.trimStart) / viewDur) * W;
  const unit      = LOOPER.snap === 'bar' ? barDur : LOOPER.snap === 'beat' ? beatDur : beatDur / 2;
  const unitX     = (unit / viewDur) * W;  // pixels per snap unit
  if (unitX < 1) return rawX; // degenerate guard
  return downbeatX + Math.round((rawX - downbeatX) / unitX) * unitX;
}

// Convert a snapped canvas x back to T_rec (for trimStart/trimEnd).
function _looperXtoTrec(x, W, viewDur) {
  return LOOPER.loop.trimStart + (x / W) * viewDur;
}

// Convert a snapped canvas x back to T_shifted (for cut selections).
function _looperXtoTshifted(x, W, viewDur) {
  return LOOPER.loop.trimStart + (x / W) * viewDur; // same formula; trimStart is in T_rec = T_shifted when offset=0
}

// ── Quantize (now anchors to downbeat for both handles) ───────────────────────
function looperQuantize() {
  if (!LOOPER.loop) return;
  const bpm    = parseFloat(document.getElementById('looperBpmInput').value) || 120;
  const beats  = parseInt(document.getElementById('looperTimeSig').value)    || 4;
  const barDur = (60 / bpm) * beats;
  const downbeat = LOOPER.loop.downbeat || 0;

  // Snap trimStart to nearest bar boundary relative to downbeat
  const stepsStart = (LOOPER.loop.trimStart - downbeat) / barDur;
  let newStart = downbeat + Math.round(stepsStart) * barDur;
  newStart = Math.max(0, newStart);

  // Round the visible loop duration to whole bars, then set trimEnd
  const loopDur = LOOPER.loop.trimEnd - LOOPER.loop.trimStart;
  let bars = Math.max(1, Math.round(loopDur / barDur));
  let newEnd = newStart + bars * barDur;

  // Clamp to recording
  while (newEnd > LOOPER.loop.duration && bars > 1) {
    bars--;
    newEnd = newStart + bars * barDur;
  }

  _looperPushUndo();
  LOOPER.loop.trimStart = newStart;
  LOOPER.loop.trimEnd   = newEnd;

  if (LOOPER.audioSourceNode) {
    LOOPER.audioSourceNode.loopStart = newStart;
    LOOPER.audioSourceNode.loopEnd   = newEnd;
  }
  looperDrawFrame();
  const sig = beats === 6 ? '6/8' : `${beats}/4`;
  _looperSetStatus(`${bars} BAR · ${sig} · ${bpm}BPM`);
}

// ── Snap mode toggle ──────────────────────────────────────────────────────────
function looperSetSnap(mode) {
  LOOPER.snap = mode;
  document.querySelectorAll('.lbb-snap-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.snap === mode));
  looperDrawFrame();
}

// ── Canvas ────────────────────────────────────────────────────────────────────
function looperInitCanvas(el) {
  LOOPER.canvasEl = el;
  el.addEventListener('pointerdown',  looperPointerDown);
  el.addEventListener('pointermove',  looperPointerMove);
  el.addEventListener('pointerup',    looperPointerUp);
  el.addEventListener('pointerleave', looperPointerUp);
  looperDrawFrame();
}

function _looperGetBpm() {
  return { bpm: parseFloat(document.getElementById('looperBpmInput')?.value) || 120,
           beats: parseInt(document.getElementById('looperTimeSig')?.value)  || 4 };
}

function looperDrawFrame() {
  const canvas = LOOPER.canvasEl;
  if (!canvas) return;

  const W   = canvas.offsetWidth || 300;
  const H   = canvas.offsetHeight || 120;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Full background
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(0, 0, W, H);

  // Ruler background
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, RULER);

  // Ruler bottom border
  ctx.strokeStyle = 'rgba(68,255,136,0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, RULER - 0.5); ctx.lineTo(W, RULER - 0.5); ctx.stroke();

  const waveH = H - RULER;  // height of the waveform area

  if (!LOOPER.loop) {
    ctx.font      = '8px "DM Mono","Share Tech Mono",monospace';
    ctx.fillStyle = 'rgba(68,255,136,0.22)';
    ctx.textAlign = 'center';
    const msg = LOOPER.state === 'recording' ? 'RECORDING…'
              : LOOPER.state === 'armed'     ? 'ARMED — WAITING FOR FIRST NOTE'
              : 'PRESS ARM OR REC TO BEGIN';
    ctx.fillText(msg, W / 2, RULER + waveH / 2 + 3);
    return;
  }

  const loop    = LOOPER.loop;
  const viewDur = loop.trimEnd - loop.trimStart;
  if (viewDur <= 0) return;

  const { bpm, beats } = _looperGetBpm();
  const beatDur  = 60 / bpm;
  const barDur   = beatDur * beats;
  const downbeat = loop.downbeat || 0;

  // Helper: T_rec → canvas x
  const tx = t => ((t - loop.trimStart) / viewDur) * W;

  // First bar index and first bar T_rec that is visible
  const firstBarIdx = Math.floor((loop.trimStart - downbeat) / barDur);

  // ── Alternating bar bands (waveform area only) ───────────────────────────
  for (let n = firstBarIdx; ; n++) {
    const barStart = downbeat + n * barDur;
    const barEnd   = barStart + barDur;
    const x0 = Math.max(0, tx(barStart));
    const x1 = Math.min(W, tx(barEnd));
    if (x0 >= W) break;
    if (x1 <= 0) continue;
    if (n % 2 === 0) {
      ctx.fillStyle = 'rgba(68,255,136,0.028)';
      ctx.fillRect(x0, RULER, x1 - x0, waveH);
    }
  }

  // ── Beat lines ───────────────────────────────────────────────────────────
  ctx.lineWidth = 1;
  for (let n = firstBarIdx * beats - 1; ; n++) {
    const t = downbeat + n * beatDur;
    if (t > loop.trimEnd + beatDur) break;
    if (t < loop.trimStart - beatDur) continue;
    const x = tx(t);
    if (x < 0 || x > W) continue;

    // Bar or beat line?
    const isBar = Math.abs(((t - downbeat) / barDur) % 1) < 0.001 ||
                  Math.abs(((t - downbeat) / barDur) % 1 - 1) < 0.001;

    if (isBar) {
      // Bar line: prominent
      ctx.strokeStyle = 'rgba(68,255,136,0.42)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(x, RULER); ctx.lineTo(x, H); ctx.stroke();
      // Extend into ruler as lighter tick
      ctx.strokeStyle = 'rgba(68,255,136,0.30)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, RULER - 1); ctx.stroke();
    } else {
      // Beat line: subtle
      ctx.strokeStyle = 'rgba(68,255,136,0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, RULER); ctx.lineTo(x, H); ctx.stroke();
      // Beat tick in ruler
      ctx.strokeStyle = 'rgba(68,255,136,0.18)';
      ctx.beginPath(); ctx.moveTo(x, RULER - 5); ctx.lineTo(x, RULER - 1); ctx.stroke();
    }
  }

  // ── Bar numbers in ruler ─────────────────────────────────────────────────
  ctx.font      = '7px "DM Mono","Share Tech Mono",monospace';
  ctx.textAlign = 'left';
  const minBarPx = 20; // minimum pixel width to show a bar number
  for (let n = firstBarIdx; ; n++) {
    const barT = downbeat + n * barDur;
    if (barT > loop.trimEnd) break;
    const x = tx(barT);
    if (x < 0 || x > W) continue;
    const nextX = tx(barT + barDur);
    const barW  = Math.min(nextX, W) - x;
    if (barW < minBarPx) continue; // too narrow — skip number

    const barLabel = String(n + 1); // bar 1 = index 0
    ctx.fillStyle = n === 0 ? 'rgba(255,187,68,0.85)' : 'rgba(68,255,136,0.55)';
    ctx.fillText(barLabel, x + 3, RULER - 4);
  }

  // ── Waveform or event blocks ─────────────────────────────────────────────
  if (loop.audioBuffer) {
    _looperDrawWaveform(ctx, loop, W, H, waveH);
  } else {
    _looperDrawEventBlocks(ctx, loop, W, H, waveH);
  }

  // ── Cut selection overlay ────────────────────────────────────────────────
  if (LOOPER.drag?.type === 'cut') {
    const d  = LOOPER.drag;
    const x0 = ((Math.min(d.tStart, d.tEnd) - loop.trimStart) / viewDur) * W;
    const x1 = ((Math.max(d.tStart, d.tEnd) - loop.trimStart) / viewDur) * W;
    ctx.fillStyle   = 'rgba(239,68,68,0.22)';
    ctx.fillRect(x0, RULER, x1 - x0, waveH);
    ctx.strokeStyle = 'rgba(239,68,68,0.70)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(x0 + 0.5, RULER + 0.5, Math.max(1, x1 - x0 - 1), waveH - 1);
    // Snap indicators: bright vertical lines at the snapped edges
    if (LOOPER.snap !== 'off') {
      ctx.strokeStyle = 'rgba(239,68,68,0.95)';
      ctx.lineWidth   = 1.5;
      [x0, x1].forEach(ex => {
        ctx.beginPath(); ctx.moveTo(ex, RULER); ctx.lineTo(ex, H); ctx.stroke();
      });
    }
  }

  // ── Trim handles (full height including ruler) ───────────────────────────
  const HW = 6;
  ctx.fillStyle = 'rgba(68,255,136,0.75)';
  ctx.fillRect(0,     0, HW, H);
  ctx.fillRect(W - HW, 0, HW, H);
  ctx.fillStyle = 'rgba(136,255,187,0.95)';
  ctx.fillRect(HW - 1,  0, 1, H);
  ctx.fillRect(W - HW,  0, 1, H);

  // ── Downbeat handle ──────────────────────────────────────────────────────
  const dbX = tx(downbeat);
  if (dbX >= 0 && dbX <= W) {
    // Triangle: inverted ▼ in the ruler, pointing down to bar 1
    const TW = 7, TH = 9;
    ctx.fillStyle = 'rgba(255,187,68,0.90)';
    ctx.beginPath();
    ctx.moveTo(dbX - TW, 1);
    ctx.lineTo(dbX + TW, 1);
    ctx.lineTo(dbX, TH + 1);
    ctx.closePath();
    ctx.fill();
    // Thin vertical line from base of triangle through waveform
    ctx.strokeStyle = 'rgba(255,187,68,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(dbX, RULER); ctx.lineTo(dbX, H); ctx.stroke();
    ctx.setLineDash([]);
    // "DB" label
    ctx.fillStyle   = 'rgba(255,187,68,0.70)';
    ctx.font        = '6px "DM Mono","Share Tech Mono",monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('DB', dbX, RULER - 2);
  }

  // ── Playhead ─────────────────────────────────────────────────────────────
  if (LOOPER.state === 'playing') {
    const px = Math.round(LOOPER.playheadPos * W);
    ctx.strokeStyle = '#ffbb44';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.moveTo(px, RULER); ctx.lineTo(px, H); ctx.stroke();
    ctx.fillStyle   = '#ffbb44';
    ctx.beginPath();
    ctx.moveTo(px - 4, RULER); ctx.lineTo(px + 4, RULER); ctx.lineTo(px, RULER + 8);
    ctx.closePath(); ctx.fill();
  }

  // ── Corner labels ────────────────────────────────────────────────────────
  ctx.font      = '7px "DM Mono","Share Tech Mono",monospace';
  ctx.fillStyle = 'rgba(68,255,136,0.35)';
  ctx.textAlign = 'left';
  ctx.fillText('LOOP', HW + 4, RULER + 9);
  ctx.textAlign = 'right';
  ctx.fillText(viewDur.toFixed(2) + 'S', W - HW - 4, RULER + 9);

  // Play-mode badge
  if (LOOPER.state === 'playing') {
    ctx.fillStyle = LOOPER.playMode === 'audio'
      ? 'rgba(255,187,68,0.55)' : 'rgba(68,255,136,0.42)';
    ctx.textAlign = 'right';
    ctx.fillText(LOOPER.playMode === 'audio' ? '▶ AUDIO' : '▶ INPUT', W - HW - 4, H - 4);
  }
}

function _looperDrawWaveform(ctx, loop, W, H, waveH) {
  const buf    = loop.audioBuffer;
  const ch     = buf.getChannelData(0);
  const sr     = buf.sampleRate;
  const sStart = Math.max(0, Math.round(loop.trimStart * sr));
  const sEnd   = Math.min(buf.length, Math.round(loop.trimEnd * sr));
  const sRange = sEnd - sStart;
  if (sRange <= 0) return;

  const yMid   = RULER + waveH / 2;
  const yScale = waveH / 2 - 2;
  const grad   = ctx.createLinearGradient(0, RULER, 0, H);
  grad.addColorStop(0,   'rgba(68,255,136,0.55)');
  grad.addColorStop(0.5, 'rgba(68,255,136,0.82)');
  grad.addColorStop(1,   'rgba(68,255,136,0.55)');
  ctx.fillStyle = grad;

  for (let col = 0; col < W; col++) {
    const s0 = sStart + Math.round((col / W) * sRange);
    const s1 = sStart + Math.round(((col + 1) / W) * sRange);
    if (s0 >= sEnd) break;
    let mn = 0, mx = 0;
    for (let s = s0; s < Math.min(s1, sEnd); s++) {
      const v = ch[s]; if (v < mn) mn = v; if (v > mx) mx = v;
    }
    const yTop = Math.round(yMid - mx * yScale);
    const yBot = Math.round(yMid - mn * yScale);
    ctx.fillRect(col, yTop, 1, Math.max(1, yBot - yTop));
  }

  ctx.strokeStyle = 'rgba(68,255,136,0.18)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, yMid); ctx.lineTo(W, yMid); ctx.stroke();
}

function _looperDrawEventBlocks(ctx, loop, W, H, waveH) {
  const viewDur = loop.trimEnd - loop.trimStart;
  loop.events.forEach(ev => {
    const tRec  = ev.t - LOOPER.recordStart;
    const tView = tRec + loop.shiftOffset - loop.trimStart;
    const evEnd = tView + (ev.duration ?? 0.25);
    if (evEnd < 0 || tView > viewDur) return;
    const x0 = Math.max(0, (tView / viewDur) * W);
    const x1 = Math.min(W, (evEnd / viewDur) * W);
    const bW  = Math.max(2, x1 - x0);
    const hue = (ev.idx * 137.5) % 360;
    ctx.fillStyle   = `hsla(${hue},60%,55%,0.45)`;
    ctx.fillRect(x0, RULER + 4, bW, waveH - 8);
    ctx.strokeStyle = `hsla(${hue},70%,72%,0.70)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, RULER + 4.5, Math.max(1, bW - 1), waveH - 9);
  });
}

// ── Pointer interactions ──────────────────────────────────────────────────────
function looperPointerDown(e) {
  if (!LOOPER.loop) return;
  e.preventDefault();
  LOOPER.canvasEl.setPointerCapture(e.pointerId);

  const rect    = LOOPER.canvasEl.getBoundingClientRect();
  const x       = e.clientX - rect.left;
  const y       = e.clientY - rect.top;
  const W       = rect.width;
  const loop    = LOOPER.loop;
  const viewDur = loop.trimEnd - loop.trimStart;
  const ZONE    = 16;

  // ── Ruler area: downbeat handle has priority ─────────────────────────────
  if (y < RULER) {
    const downbeat = loop.downbeat || 0;
    const dbX = ((downbeat - loop.trimStart) / viewDur) * W;
    if (Math.abs(x - dbX) < 16) {
      _looperPushUndo();
      LOOPER.drag = { type: 'downbeat', startX: x, origDownbeat: downbeat, origViewDur: viewDur, W };
      return;
    }
    // Also allow trim handles from the ruler area
    if (LOOPER.tool === 'trim') {
      if (x < ZONE) {
        _looperPushUndo();
        LOOPER.drag = { type: 'trimLeft',  startX: x, origTrimStart: loop.trimStart, origViewDur: viewDur, W };
      } else if (x > W - ZONE) {
        _looperPushUndo();
        LOOPER.drag = { type: 'trimRight', startX: x, origTrimEnd: loop.trimEnd,     origViewDur: viewDur, W };
      }
    }
    return;
  }

  // ── Waveform area ────────────────────────────────────────────────────────
  if (LOOPER.tool === 'trim') {
    if (x < ZONE) {
      _looperPushUndo();
      LOOPER.drag = { type: 'trimLeft',  startX: x, origTrimStart: loop.trimStart, origViewDur: viewDur, W };
    } else if (x > W - ZONE) {
      _looperPushUndo();
      LOOPER.drag = { type: 'trimRight', startX: x, origTrimEnd: loop.trimEnd,     origViewDur: viewDur, W };
    }
  } else if (LOOPER.tool === 'shift') {
    _looperPushUndo();
    LOOPER.drag = { type: 'shift', startX: x, origShift: loop.shiftOffset, origViewDur: viewDur, W };
  } else if (LOOPER.tool === 'cut') {
    const tPos = (x / W) * viewDur + loop.trimStart;
    LOOPER.drag = { type: 'cut', tStart: tPos, tEnd: tPos, W };
  }
}

function looperPointerMove(e) {
  if (!LOOPER.drag || !LOOPER.loop) return;
  const rect = LOOPER.canvasEl.getBoundingClientRect();
  const x    = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const loop = LOOPER.loop;
  const d    = LOOPER.drag;
  const W    = rect.width;
  const viewDur = loop.trimEnd - loop.trimStart;

  if (d.type === 'downbeat') {
    const dt = ((x - d.startX) / d.W) * d.origViewDur;
    // downbeat is free — no snap (it IS the snap reference)
    loop.downbeat = Math.max(-(loop.duration * 2),
                    Math.min(loop.duration * 2, (d.origDownbeat || 0) + dt));

  } else if (d.type === 'trimLeft') {
    const rawX    = d.origTrimStart + ((x - d.startX) / d.W) * d.origViewDur;
    const snappedX = _looperSnapX(
      ((rawX - loop.trimStart) / viewDur) * W, W, viewDur
    );
    const snappedT = _looperXtoTrec(snappedX, W, viewDur);
    loop.trimStart = Math.max(0, Math.min(loop.trimEnd - 0.05, snappedT));
    if (LOOPER.audioSourceNode) LOOPER.audioSourceNode.loopStart = loop.trimStart;

  } else if (d.type === 'trimRight') {
    const rawX    = d.origTrimEnd + ((x - d.startX) / d.W) * d.origViewDur;
    const snappedX = _looperSnapX(
      ((rawX - loop.trimStart) / viewDur) * W, W, viewDur
    );
    const snappedT = _looperXtoTrec(snappedX, W, viewDur);
    loop.trimEnd   = Math.min(loop.duration, Math.max(loop.trimStart + 0.05, snappedT));
    if (LOOPER.audioSourceNode) LOOPER.audioSourceNode.loopEnd = loop.trimEnd;

  } else if (d.type === 'shift') {
    const dt = ((x - d.startX) / d.W) * d.origViewDur;
    loop.shiftOffset = (d.origShift || 0) + dt;

  } else if (d.type === 'cut') {
    // Snap the trailing edge of the selection live
    const rawX    = x;
    const snappedX = _looperSnapX(rawX, W, viewDur);
    d.tEnd = (snappedX / W) * viewDur + loop.trimStart;
    // Also snap the start edge on first move (only once)
    if (!d.startSnapped) {
      const s0X     = ((d.tStart - loop.trimStart) / viewDur) * W;
      const snS0X   = _looperSnapX(s0X, W, viewDur);
      d.tStart      = (snS0X / W) * viewDur + loop.trimStart;
      d.startSnapped = true;
    }
  }

  looperDrawFrame();
}

function looperPointerUp(e) {
  if (!LOOPER.drag) return;
  const d = LOOPER.drag;
  if (d.type === 'cut') {
    const tA = Math.min(d.tStart, d.tEnd);
    const tB = Math.max(d.tStart, d.tEnd);
    if (tB - tA > 0.02) looperApplyCut(tA, tB);
  }
  LOOPER.drag = null;
  looperDrawFrame();
}

// ── Edit operations ───────────────────────────────────────────────────────────
function looperApplyCut(cutStart, cutEnd) {
  if (!LOOPER.loop) return;
  _looperPushUndo();
  const loop = LOOPER.loop;

  loop.events = loop.events.filter(ev => {
    const tShifted = (ev.t - LOOPER.recordStart) + loop.shiftOffset;
    const evEnd    = tShifted + (ev.duration ?? 0.25);
    return !(tShifted < cutEnd && evEnd > cutStart);
  });

  if (loop.audioBuffer) {
    const sr   = loop.audioBuffer.sampleRate;
    const FADE = Math.round(0.005 * sr); // 5 ms crossfade
    const sA   = Math.max(0, Math.round((cutStart - loop.shiftOffset) * sr));
    const sB   = Math.min(loop.audioBuffer.length,
                          Math.round((cutEnd   - loop.shiftOffset) * sr));
    for (let c = 0; c < loop.audioBuffer.numberOfChannels; c++) {
      const data = loop.audioBuffer.getChannelData(c);
      for (let i = 0; i < FADE; i++) {
        const idx = sA - FADE + i;
        if (idx >= 0) data[idx] *= i / FADE;
      }
      for (let i = sA; i < sB && i < data.length; i++) data[i] = 0;
      for (let i = 0; i < FADE; i++) {
        const idx = sB + i;
        if (idx < data.length) data[idx] *= i / FADE;
      }
    }
  }
  looperDrawFrame();
}

// ── Undo ──────────────────────────────────────────────────────────────────────
function _looperPushUndo() {
  if (!LOOPER.loop) return;
  const loop = LOOPER.loop;
  LOOPER.undoStack.push({
    trimStart:   loop.trimStart,
    trimEnd:     loop.trimEnd,
    shiftOffset: loop.shiftOffset,
    downbeat:    loop.downbeat,
    events:      loop.events.map(ev => ({ ...ev })),
  });
  if (LOOPER.undoStack.length > 10) LOOPER.undoStack.shift();
  _looperUpdateUndoBtn();
}

function looperUndo() {
  if (!LOOPER.undoStack.length || !LOOPER.loop) return;
  const snap = LOOPER.undoStack.pop();
  Object.assign(LOOPER.loop, snap);
  _looperUpdateUndoBtn();
  looperDrawFrame();
}

// ── Tool selection ────────────────────────────────────────────────────────────
function looperSetTool(tool) {
  LOOPER.tool = tool;
  const cursors = { trim: 'col-resize', shift: 'ew-resize', cut: 'crosshair' };
  if (LOOPER.canvasEl) LOOPER.canvasEl.style.cursor = cursors[tool] || 'default';
  document.querySelectorAll('.looper-tool-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tool === tool));
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function _looperDurLabel() {
  if (!LOOPER.loop) return 'IDLE';
  return (LOOPER.loop.trimEnd - LOOPER.loop.trimStart).toFixed(1) + 'S';
}

function _looperUpdateUI() {
  const armBtn       = document.getElementById('looperArmBtn');
  const recBtn       = document.getElementById('looperRecBtn');
  const playInputBtn = document.getElementById('looperPlayInputBtn');
  const playAudioBtn = document.getElementById('looperPlayAudioBtn');
  const armPip       = document.getElementById('looperArmPip');
  const recPip       = document.getElementById('looperRecPip');
  const playInputPip = document.getElementById('looperPlayInputPip');
  const playAudioPip = document.getElementById('looperPlayAudioPip');
  if (!recBtn) return;

  const isArmed   = LOOPER.state === 'armed';
  const isRec     = LOOPER.state === 'recording';
  const isPlaying = LOOPER.state === 'playing';
  const isInput   = isPlaying && LOOPER.playMode === 'input';
  const isAudio   = isPlaying && LOOPER.playMode === 'audio';

  if (armBtn) { armBtn.classList.toggle('active', isArmed); armBtn.classList.toggle('armed', isArmed); }
  if (armPip) armPip.classList.toggle('led-pip-arm', isArmed);
  recBtn.classList.toggle('active', isRec);
  recBtn.classList.toggle('recording', isRec);
  if (recPip) recPip.classList.toggle('led-pip-rec', isRec);
  if (playInputBtn) playInputBtn.classList.toggle('active', isInput);
  if (playAudioBtn) playAudioBtn.classList.toggle('active', isAudio);
  if (playInputPip) playInputPip.classList.toggle('led-pip-on', isInput);
  if (playAudioPip) playAudioPip.classList.toggle('led-pip-on', isAudio);
}

function _looperSetStatus(text) {
  const el = document.getElementById('looperStatus');
  if (el) el.textContent = text;
}

function _looperTickStatus() {
  if (LOOPER.state !== 'recording') return;
  const elapsed = LOOPER.audioCtx
    ? (LOOPER.audioCtx.currentTime - LOOPER.recordStart).toFixed(1) : '0.0';
  _looperSetStatus('REC ' + elapsed + 'S');
  setTimeout(_looperTickStatus, 200);
}

function _looperUpdateUndoBtn() {
  const btn = document.getElementById('looperUndoBtn');
  if (btn) btn.disabled = LOOPER.undoStack.length === 0;
}

function looperTogglePanel() {
  const section = document.getElementById('looperSection');
  const chevron = document.getElementById('looperChevron');
  if (!section) return;
  const isOpen = section.style.display !== 'none';
  section.style.display = isOpen ? 'none' : 'flex';
  chevron.textContent   = isOpen ? '▶' : '▼';
  if (!isOpen) requestAnimationFrame(() => { requestAnimationFrame(looperDrawFrame); });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('looperCanvas');
  if (canvas) looperInitCanvas(canvas);

  document.getElementById('looperBpmInput')?.addEventListener('input',  looperDrawFrame);
  document.getElementById('looperTimeSig')?.addEventListener('change', looperDrawFrame);

  looperSetTool('trim');
  looperSetSnap('off');
  _looperUpdateUndoBtn();
  _looperSetStatus('IDLE');
});
