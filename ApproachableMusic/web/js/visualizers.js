// ════════════════════════════════════════════════════════
//  VISUALIZERS  — single waveformCanvas, one RAF loop
//
//  Layout inside the canvas (stacked vertically):
//  ┌──────────────────┬──────────────────┐  top 38%
//  │  CHORD  (wave)   │  PATCH  (wave)   │
//  ├──────────────────┴──────────────────┤
//  │           SPECTRUM  EQ              │  bottom 62%
//  └─────────────────────────────────────┘
// ════════════════════════════════════════════════════════

let waveformSnapshot   = null;   // Float32Array — chord, one full cycle
let instrumentSnapshot = null;   // Float32Array — instrument shape, one full cycle
let playingFrequencies = [];     // Hz values of the currently held chord (sorted low→high)

// ── Chord waveform ────────────────────────────────────────────────────────
// One complete cycle of the lowest note — so the shape is directly comparable
// to a pure sine (0 → +1 → 0 → -1 → 0).
function computeChordWaveform(frequencies) {
  if (!frequencies || frequencies.length === 0) {
    waveformSnapshot   = null;
    playingFrequencies = [];
    return;
  }
  playingFrequencies = [...frequencies].sort((a, b) => a - b);
  const n       = 512;
  const minFreq = Math.min(...frequencies);
  const period  = 1 / minFreq;
  const buf     = new Float32Array(n);
  let   maxAmp  = 0;

  for (let i = 0; i < n; i++) {
    const t = (i / n) * period;
    let s = 0;
    frequencies.forEach(f => { s += Math.sin(2 * Math.PI * f * t); });
    buf[i] = s;
    if (Math.abs(s) > maxAmp) maxAmp = Math.abs(s);
  }
  if (maxAmp > 0) for (let i = 0; i < n; i++) buf[i] /= maxAmp;
  waveformSnapshot = buf;
}

// ── Instrument waveform ───────────────────────────────────────────────────
// Sum all synthesis layers (sine / triangle / sawtooth / square) over exactly
// one full cycle of the fundamental, weighted by volume.
function computeInstrumentWaveform(presetName) {
  const preset = (typeof SOUND_PRESETS !== 'undefined') && SOUND_PRESETS[presetName];
  if (!preset || !preset.layers) {
    instrumentSnapshot = null;
    return;
  }
  const n   = 512;
  const buf = new Float32Array(n);
  let   maxAmp = 0;

  for (let i = 0; i < n; i++) {
    const t = i / n;
    let s = 0;
    preset.layers.forEach(layer => {
      const p = layer.mult * t;
      let w;
      switch (layer.type) {
        case 'sine':     w = Math.sin(2 * Math.PI * p); break;
        case 'triangle': w = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * p)); break;
        case 'sawtooth': w = 2 * (p - Math.floor(p + 0.5)); break;
        case 'square':   w = Math.sign(Math.sin(2 * Math.PI * p)); break;
        default:         w = Math.sin(2 * Math.PI * p);
      }
      s += layer.vol * w;
    });
    buf[i] = s;
    if (Math.abs(s) > maxAmp) maxAmp = Math.abs(s);
  }
  if (maxAmp > 0) for (let i = 0; i < n; i++) buf[i] /= maxAmp;
  instrumentSnapshot = buf;
}

// ── Spectrum state ────────────────────────────────────────────────────────
// 256 sample points give sub-pixel resolution at any reasonable canvas width.
const SP_POINTS   = 256;
const SP_DECAY    = 0.88;    // bar fall speed (higher = slower)
const SP_PK_DECAY = 0.995;   // peak hold fall speed
const SP_PK_FLOOR = 0.0005;  // min absolute drip so peaks always fall eventually

// dB display range — everything outside is clamped
const DB_MIN = -90;   // noise floor
const DB_MAX =  -3;   // headroom ceiling

// Visible frequency range (Hz) — standard audio spectrum
const FREQ_MIN  =    20;
const FREQ_MAX  = 20000;

let spSmooth = new Float32Array(SP_POINTS).fill(0);
let spPeaks  = new Float32Array(SP_POINTS).fill(0);
let _rafId   = null;

// ── Sub-draw helpers ──────────────────────────────────────────────────────

function _wavePanel(ctx, buf, x0, y0, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();

  // Centre line
  ctx.strokeStyle = 'rgba(68,255,136,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h / 2);
  ctx.lineTo(x0 + w, y0 + h / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (!buf) { ctx.restore(); return; }

  // Filled area under curve
  const grad = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  grad.addColorStop(0,   'rgba(68,255,136,0.18)');
  grad.addColorStop(0.5, 'rgba(68,255,136,0.04)');
  grad.addColorStop(1,   'rgba(68,255,136,0.18)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h / 2);
  for (let i = 0; i < buf.length; i++) {
    ctx.lineTo(x0 + (i / buf.length) * w, y0 + h / 2 - buf[i] * h * 0.41);
  }
  ctx.lineTo(x0 + w, y0 + h / 2);
  ctx.closePath();
  ctx.fill();

  // Crisp glowing line
  ctx.shadowColor = 'rgba(68,255,136,0.55)';
  ctx.shadowBlur  = 5;
  ctx.strokeStyle = '#44ff88';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  for (let i = 0; i < buf.length; i++) {
    const x = x0 + (i / buf.length) * w;
    const y = y0 + h / 2 - buf[i] * h * 0.41;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── Harmonic overlay constants ────────────────────────────────────────────
// One accent colour per chord tone (RGB triplets, phosphor-compatible).
// Root stays the same green as the spectrum so it blends in; upper voices
// get distinct tints so you can trace each note's harmonic series separately.
const NOTE_COLORS = [
  '68,255,136',   // root      — phosphor green
  '68,210,255',   // 3rd/2nd   — cyan
  '255,215,55',   // 5th/3rd   — amber
  '255,100,80',   // 7th/4th   — coral
  '190,120,255',  // 9th/5th   — violet
  '255,180,70',   // 11th/6th  — gold
  '80,255,200',   // 13th/7th  — teal
];
const H_PROMINENT_DB = -44;   // above → solid line + glowing dot + number label
const H_PRESENT_DB   = -66;   // above → dashed, dim — harmonic expected but quiet
const H_MAX          = 12;    // how many harmonics to inspect per note

// Return the peak dB within ±2 FFT bins of a target frequency.
// The ±2 bin window absorbs spectral leakage without smearing into neighbours.
function _fftDbAtHz(floatData, nyq, hz) {
  if (!floatData || hz <= 0 || hz > nyq) return DB_MIN;
  const centre = hz / nyq * floatData.length;
  const b0 = Math.max(0,                   Math.floor(centre) - 2);
  const b1 = Math.min(floatData.length - 1, Math.ceil(centre)  + 2);
  let peak = -Infinity;
  for (let b = b0; b <= b1; b++) if (floatData[b] > peak) peak = floatData[b];
  return isFinite(peak) ? peak : DB_MIN;
}

// Draw the harmonic series of every playing note over the spectrum plot.
// Prominent harmonics (real FFT energy present) are drawn solid with a glowing
// dot and a harmonic-order number.  Expected-but-quiet harmonics are faint
// dashes — useful for spotting which harmonics the instrument suppresses.
function _drawHarmonics(ctx, x0, y0, plotW, plotH, floatData, nyq) {
  if (!playingFrequencies.length) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, plotW, plotH);
  ctx.clip();

  playingFrequencies.forEach((baseFreq, noteIdx) => {
    const rgb = NOTE_COLORS[noteIdx % NOTE_COLORS.length];

    for (let h = 1; h <= H_MAX; h++) {
      const hFreq = baseFreq * h;
      if (hFreq > FREQ_MAX) break;

      const x = x0 + _freqToX(hFreq, plotW);
      if (x < x0 + 1 || x > x0 + plotW - 1) continue;

      const db        = _fftDbAtHz(floatData, nyq, hFreq);
      const prominent = db > H_PROMINENT_DB;
      const present   = db > H_PRESENT_DB;

      // Always draw every harmonic position — alpha communicates energy level.
      // Line alpha: brightest at H1, fades ~1/√h, amplified when energy is real.
      const alpha = prominent
        ? Math.max(0.48, 0.88 / Math.sqrt(h))
        : present
          ? Math.max(0.12, 0.28 / Math.sqrt(h))
          : Math.max(0.05, 0.12 / Math.sqrt(h));

      ctx.lineWidth   = prominent ? 1.2 : 0.75;
      ctx.strokeStyle = `rgba(${rgb},${alpha})`;
      ctx.setLineDash(prominent ? [] : [2, 3]);
      ctx.beginPath();
      // Leave 10px at top for the harmonic number label strip
      ctx.moveTo(x, y0 + 11);
      ctx.lineTo(x, y0 + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      if (prominent) {
        // Glowing dot sitting right on the spectrum line
        ctx.shadowColor = `rgba(${rgb},0.70)`;
        ctx.shadowBlur  = 5;
        ctx.fillStyle   = `rgba(${rgb},0.92)`;
        ctx.beginPath();
        ctx.arc(x, y0 + 13, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Harmonic order number at the very top of the marker column.
        // Show for all notes' fundamentals + all orders of the root note
        // so you can read the full harmonic series of the chord's root.
        if (noteIdx === 0 || h === 1) {
          ctx.font      = '6px "DM Mono","Share Tech Mono",monospace';
          ctx.fillStyle = `rgba(${rgb},0.80)`;
          ctx.textAlign = 'center';
          ctx.fillText(h === 1 && noteIdx > 0 ? '1' : String(h), x, y0 + 9);
        }
      }
    }
  });

  ctx.restore();
}

// Convert a frequency (Hz) to a pixel position.
// Pure log10 puts 150 Hz at ~29% of the width.
// Squaring the normalised log position (^2) compresses the bass so that
// 150 Hz lands at ~8.5% and 1 kHz at ~32%, giving the midrange and highs
// the room they deserve on a music spectrum display.
function _freqToX(hz, w) {
  const t = Math.log10(hz / FREQ_MIN) / Math.log10(FREQ_MAX / FREQ_MIN);
  return Math.pow(Math.max(0, t), 2) * w;
}

// Convert a dB value to a 0-1 normalised amplitude (0 = noise floor, 1 = ceiling).
function _dbToNorm(db) {
  return Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)));
}

function _spectrumPanel(ctx, x0, y0, w, h) {
  const DB_RANGE   = DB_MAX - DB_MIN;
  // Reserve bottom strip for freq labels, right strip for dB labels
  const LABEL_H    = 13;   // px for frequency label row
  const LABEL_W    = 28;   // px for dB label column
  const plotW      = w - LABEL_W;
  const plotH      = h - LABEL_H;

  const SR  = (typeof audioCtx !== 'undefined' && audioCtx) ? audioCtx.sampleRate : 44100;
  const nyq = SR / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = '#050c05';
  ctx.fillRect(x0, y0, w, h);

  // ── dB grid lines (horizontal) ────────────────────────────────────────────
  const dbGrid = [-6, -12, -18, -24, -36, -48, -60, -72];
  ctx.lineWidth = 1;
  dbGrid.forEach(db => {
    if (db < DB_MIN || db > DB_MAX) return;
    const gy = y0 + plotH - _dbToNorm(db) * plotH;
    // Brighter line at -6 and -12 (more musically relevant)
    const alpha = (db === -6 || db === -12) ? 0.10 : 0.055;
    ctx.strokeStyle = `rgba(68,255,136,${alpha})`;
    ctx.setLineDash(db % 12 === 0 ? [] : [2, 4]);
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + plotW, gy); ctx.stroke();
    ctx.setLineDash([]);
  });

  // ── Frequency grid lines (vertical) — true log positions ─────────────────
  const freqGrid = [30, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  ctx.strokeStyle = 'rgba(68,255,136,0.045)';
  ctx.setLineDash([2, 4]);
  freqGrid.forEach(f => {
    const gx = x0 + _freqToX(f, plotW);
    if (gx < x0 || gx > x0 + plotW) return;
    ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + plotH); ctx.stroke();
  });
  ctx.setLineDash([]);

  // ── Read FFT float data ───────────────────────────────────────────────────
  let floatData = null;
  if (typeof analyser !== 'undefined' && analyser) {
    floatData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(floatData);   // true dB values
  }

  // ── Sample SP_POINTS points across the log frequency axis ────────────────
  for (let i = 0; i < SP_POINTS; i++) {
    const t  = i / SP_POINTS;
    const f  = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, t);   // log-spaced Hz
    let   db = DB_MIN;

    if (floatData) {
      // Find the bin range that covers this display point
      const fNext  = FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, (i + 1) / SP_POINTS);
      const b0     = Math.max(0,                  Math.floor(f     / nyq * floatData.length));
      const b1     = Math.min(floatData.length - 1, Math.ceil(fNext  / nyq * floatData.length));
      for (let b = b0; b <= b1; b++) {
        if (floatData[b] > db) db = floatData[b];   // peak in range
      }
    }

    const norm = _dbToNorm(db);
    spSmooth[i] = Math.max(norm, spSmooth[i] * SP_DECAY);

    if (spSmooth[i] >= spPeaks[i]) {
      spPeaks[i] = spSmooth[i];
    } else {
      spPeaks[i] = Math.max(0, spPeaks[i] * SP_PK_DECAY - SP_PK_FLOOR);
    }
  }

  // ── Build smooth spectrum curve ────────────────────────────────────────────
  // Map each of the SP_POINTS samples to an (x, y) pixel coordinate, then draw
  // as a filled area with a bright glowing line along the top.
  const pts = [];
  for (let i = 0; i < SP_POINTS; i++) {
    const t  = i / SP_POINTS;
    const px = x0 + _freqToX(FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, t), plotW);
    const py = y0 + plotH - spSmooth[i] * plotH;
    pts.push({ x: px, y: py });
  }

  // Filled gradient area under the curve
  const fillGrad = ctx.createLinearGradient(x0, y0, x0, y0 + plotH);
  fillGrad.addColorStop(0,    'rgba(68,255,136,0.55)');
  fillGrad.addColorStop(0.35, 'rgba(68,255,136,0.28)');
  fillGrad.addColorStop(0.75, 'rgba(68,255,136,0.10)');
  fillGrad.addColorStop(1,    'rgba(68,255,136,0.02)');

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, y0 + plotH);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    // Smooth bezier through points
    const mx = (pts[i - 1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(mx, pts[i - 1].y, mx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length - 1].x, y0 + plotH);
  ctx.closePath();
  ctx.fill();

  // Crisp glowing line along the top of the spectrum
  ctx.shadowColor = 'rgba(68,255,136,0.6)';
  ctx.shadowBlur  = 6;
  ctx.strokeStyle = '#44ff88';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2;
    ctx.bezierCurveTo(mx, pts[i - 1].y, mx, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Peak-hold line — 1px, pale mint, follows each sample point
  ctx.strokeStyle = 'rgba(200,255,220,0.55)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  let peakStarted = false;
  for (let i = 0; i < SP_POINTS; i++) {
    if (spPeaks[i] < 0.008) { peakStarted = false; continue; }
    const t  = i / SP_POINTS;
    const px = x0 + _freqToX(FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, t), plotW);
    const py = y0 + plotH - spPeaks[i] * plotH;
    peakStarted ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    peakStarted = true;
  }
  ctx.stroke();

  // ── Harmonic series overlay ───────────────────────────────────────────────
  _drawHarmonics(ctx, x0, y0, plotW, plotH, floatData, nyq);

  // ── dB labels (right column) ──────────────────────────────────────────────
  ctx.font      = '7px "DM Mono","Share Tech Mono",monospace';
  ctx.fillStyle = 'rgba(68,255,136,0.28)';
  ctx.textAlign = 'right';
  [-6, -12, -24, -48].forEach(db => {
    if (db < DB_MIN) return;
    const ly = y0 + plotH - _dbToNorm(db) * plotH;
    if (ly < y0 + 6 || ly > y0 + plotH - 4) return;
    ctx.fillText(`${db}`, x0 + w - 2, ly + 3);
  });

  // ── Frequency labels (bottom row) ─────────────────────────────────────────
  const freqLabels = [
    { hz: 50,    txt: '50'  },
    { hz: 100,   txt: '100' },
    { hz: 200,   txt: '200' },
    { hz: 500,   txt: '500' },
    { hz: 1000,  txt: '1k'  },
    { hz: 2000,  txt: '2k'  },
    { hz: 5000,  txt: '5k'  },
    { hz: 10000, txt: '10k' },
    { hz: 20000, txt: '20k' },
  ];
  ctx.fillStyle = 'rgba(68,255,136,0.28)';
  ctx.textAlign = 'center';
  freqLabels.forEach(({ hz, txt }) => {
    const lx = x0 + _freqToX(hz, plotW);
    if (lx < x0 + 10 || lx > x0 + plotW - 6) return;
    ctx.fillText(txt, lx, y0 + h - 2);
  });

  // Axis tick marks at each frequency label
  ctx.strokeStyle = 'rgba(68,255,136,0.18)';
  ctx.lineWidth   = 1;
  freqLabels.forEach(({ hz }) => {
    const lx = x0 + _freqToX(hz, plotW);
    if (lx < x0 + 4 || lx > x0 + plotW - 4) return;
    ctx.beginPath(); ctx.moveTo(lx, y0 + plotH); ctx.lineTo(lx, y0 + plotH + 3); ctx.stroke();
  });

  ctx.restore();
}

// ── Main RAF draw loop ────────────────────────────────────────────────────
function _drawFrame() {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) { _rafId = requestAnimationFrame(_drawFrame); return; }

  const ctx = canvas.getContext('2d');
  const W   = Math.max(canvas.offsetWidth  || canvas.width,  10);
  const H   = Math.max(canvas.offsetHeight || canvas.height, 10);
  canvas.width = W; canvas.height = H;

  // Background
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(0, 0, W, H);

  // Horizontal split: left 15% = waveform column, right 85% = EQ
  const waveW = Math.round(W * 0.15);
  const eqX   = waveW + 1;
  const eqW   = W - eqX;

  // Vertical divider between waveform column and EQ
  ctx.strokeStyle = 'rgba(68,255,136,0.15)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(waveW + 0.5, 0); ctx.lineTo(waveW + 0.5, H); ctx.stroke();

  // ── Waveform column ───────────────────────────────────────────────────────
  // When Voice panel is collapsed: show 4 mini-viewers (ENV/FLT/CHR/PLY) stacked.
  // When Voice panel is open: show CHORD + PATCH waveforms as normal.
  const halfH = Math.floor(H / 2);

  // Normal left column: CHORD top half / PATCH bottom half (always)
  ctx.strokeStyle = 'rgba(68,255,136,0.10)';
  ctx.beginPath(); ctx.moveTo(2, halfH + 0.5); ctx.lineTo(waveW - 2, halfH + 0.5); ctx.stroke();
  _wavePanel(ctx, waveformSnapshot,   0, 0,     waveW, halfH);
  _wavePanel(ctx, instrumentSnapshot, 0, halfH, waveW, H - halfH);
  ctx.font      = '6px "DM Mono","Share Tech Mono",monospace';
  ctx.fillStyle = 'rgba(68,255,136,0.30)';
  ctx.textAlign = 'left';
  ctx.fillText('CHORD', 2, 8);
  ctx.fillText('PATCH', 2, halfH + 8);

  // ── Right side: spectrum EQ always; mini-viewers overlaid when Voice collapsed ──
  _spectrumPanel(ctx, eqX, 0, eqW, H);

  const voiceCollapsed = typeof vpcPanelOpen !== 'undefined' && !vpcPanelOpen;
  const miniIds    = ['envMini', 'fltMini', 'chrMini', 'playMini'];
  const miniLabels = ['ENV', 'FLT', 'CHR', 'PLY'];
  const slotW = Math.floor(eqW / miniIds.length);
  const slotH = Math.floor(H * 0.80);

  // Pre-size mini canvases to native slot dimensions so drawImage is 1:1 (no blur)
  if (voiceCollapsed) {
    miniIds.forEach(id => {
      const mc = document.getElementById(id);
      if (mc && (mc.width !== slotW || mc.height !== slotH)) {
        mc.width = slotW; mc.height = slotH;
      }
    });
  }

  if (typeof window._envViewerDraw === 'function') window._envViewerDraw();

  if (voiceCollapsed) {
    // 'screen' blend: black from mini-canvas backgrounds vanishes, only the
    // colored curves composite over the spectrum beneath.
    ctx.globalCompositeOperation = 'screen';
    miniIds.forEach((id, i) => {
      const x  = eqX + i * slotW;
      const mc = document.getElementById(id);
      if (mc && mc.width > 0) ctx.drawImage(mc, x, 0, slotW, slotH);
    });
    ctx.globalCompositeOperation = 'source-over';

    // Dividers + labels drawn normally on top
    miniIds.forEach((id, i) => {
      const x = eqX + i * slotW;
      if (i > 0) {
        ctx.strokeStyle = 'rgba(68,255,136,0.15)';
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.moveTo(x + 0.5, 2); ctx.lineTo(x + 0.5, slotH - 2); ctx.stroke();
      }
      ctx.font      = '6px "DM Mono","Share Tech Mono",monospace';
      ctx.fillStyle = 'rgba(68,255,136,0.35)';
      ctx.textAlign = 'left';
      ctx.fillText(miniLabels[i], x + 4, 9);
    });
    // Bottom border of mini strip
    ctx.strokeStyle = 'rgba(68,255,136,0.15)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(eqX, slotH + 0.5); ctx.lineTo(W, slotH + 0.5); ctx.stroke();
  }

  _rafId = requestAnimationFrame(_drawFrame);
}

// ── Public API ────────────────────────────────────────────────────────────

// Called from audio.js after computing a new chord — just store + let the RAF redraw
function drawWaveformSnapshot() { /* RAF loop handles drawing */ }

function startVisualizers() {
  if (_rafId) cancelAnimationFrame(_rafId);
  _drawFrame();
}
