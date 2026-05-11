// ════════════════════════════════════════════════════════
//  GROUP MINI-VIEWERS  —  ENV / FLT / CHR / PLAY
// ════════════════════════════════════════════════════════

const MV = {
  env:  null,   // <canvas id="envMini">
  flt:  null,
  chr:  null,
  play: null,

  // Note timing (audioCtx seconds)
  noteStartTime:   null,
  noteReleaseTime: null,
  physHoldMs:      0,
  playheadAlpha:   0,

  // Strum dot animation: array of { x: 0-1 fraction, litAt: audioCtx time }
  strumDots: [],

  // CHR animation clock
  chrT: 0,
};

// ── Bootstrap ─────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  MV.env  = document.getElementById('envMini');
  MV.flt  = document.getElementById('fltMini');
  MV.chr  = document.getElementById('chrMini');
  MV.play = document.getElementById('playMini');

  window.addEventListener('ev:noteStart', e => {
    MV.noteStartTime   = e.detail.time;
    MV.noteReleaseTime = null;
    MV.playheadAlpha   = 1.0;
    // Pre-schedule strum dot light-up times
    const ap    = typeof audioParams !== 'undefined' ? audioParams : {};
    const delay = Math.max(0, ap.strum ?? 6) / 1000;  // ms → s
    MV.strumDots = [0, 1, 2, 3].map(i => ({
      frac:  i / 3,
      litAt: e.detail.time + i * delay,
    }));
  });

  window.addEventListener('ev:noteRelease', e => {
    MV.noteReleaseTime = e.detail.time;
  });

  window.addEventListener('ev:holdEnd', e => {
    MV.physHoldMs = e.detail.holdMs;
  });

  window._envViewerDraw = drawAll;
});

// ── Shared helpers ────────────────────────────────────────────────────────

function syncCanvas(canvas) {
  // When hidden (offsetWidth=0) use the width/height already set externally;
  // fall back to defaults only if those are also unset.
  const W = canvas.offsetWidth  || canvas.width  || 88;
  const H = canvas.offsetHeight || canvas.height || 44;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width  = W;
    canvas.height = H;
  }
  return [canvas.getContext('2d'), W, H];
}

function getLiveAdsr() {
  const preset = (typeof SOUND_PRESETS !== 'undefined' && typeof activePreset !== 'undefined')
    ? SOUND_PRESETS[activePreset] : null;
  const ap = typeof audioParams !== 'undefined' ? audioParams : {};
  return {
    atk:       Math.max(0.001, ap.attack    ?? preset?.attack    ?? 0.01),
    dcy:       Math.max(0.001, ap.decay     ?? preset?.decay     ?? 0.10),
    sus:       Math.max(0,     ap.sustain   ?? preset?.sustain   ?? 0.5),
    rel:       Math.max(0.001, ap.release   ?? preset?.release   ?? 0.3),
    cutoff:    ap.cutoff    ?? preset?.filter?.freq ?? 4000,
    resonance: ap.resonance ?? preset?.filter?.Q   ?? 1,
    warmth:    ap.warmth    ?? 0,
    reverb:    ap.reverb    ?? 0,
    drive:     ap.drive     ?? 2,
    drift:     ap.drift     ?? 5,
    sub:       ap.sub       ?? 0,
    width:     ap.width     ?? 1,
    sweep:     ap.sweep     ?? 2,
    strum:     ap.strum     ?? 6,
    humanize:  ap.humanize  ?? 5,
    glide:     ap.glide     ?? 0,
    noSweep:   preset?.noSweep ?? false,
  };
}

// ── ENV mini-viewer ───────────────────────────────────────────────────────
// Shows ADSR curve + animated playhead + thin hold bar at bottom.

const E_PL = 4, E_PR = 4, E_PT = 5, E_PB = 10;
const SUS_SLOT = 0.22;   // fixed visual sustain width in seconds

function drawEnv() {
  const canvas = MV.env;
  if (!canvas) return;
  const [ctx, W, H] = syncCanvas(canvas);

  ctx.fillStyle = '#060e06';
  ctx.fillRect(0, 0, W, H);

  const { atk, dcy, sus, rel } = getLiveAdsr();
  const total  = atk + dcy + SUS_SLOT + rel;
  const plotW  = W - E_PL - E_PR;
  const plotH  = H - E_PT - E_PB;

  const tX = t => E_PL + (Math.min(t, total) / total) * plotW;
  const x0  = E_PL,    xPk = tX(atk),            xDs = tX(atk + dcy);
  const xDe = tX(atk + dcy + SUS_SLOT),           xEnd = E_PL + plotW;
  const yZ  = E_PT + plotH,   yPk = E_PT,         yS  = E_PT + plotH * (1 - Math.max(0, Math.min(1, sus)));

  // Filled shape
  const g = ctx.createLinearGradient(0, yPk, 0, yZ);
  g.addColorStop(0,   'rgba(68,255,136,0.40)');
  g.addColorStop(1,   'rgba(68,255,136,0.03)');
  ctx.beginPath();
  ctx.moveTo(x0, yZ);
  ctx.lineTo(xPk, yPk);
  ctx.bezierCurveTo(xPk + (xDs-xPk)*0.4, yPk, xDs - (xDs-xPk)*0.2, yS, xDs, yS);
  ctx.lineTo(xDe, yS);
  ctx.bezierCurveTo(xDe + (xEnd-xDe)*0.3, yS, xEnd - (xEnd-xDe)*0.1, yZ, xEnd, yZ);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();

  // Outline
  ctx.save();
  ctx.shadowColor = 'rgba(68,255,136,0.45)';
  ctx.shadowBlur  = 3;
  ctx.strokeStyle = '#44ff88';
  ctx.lineWidth   = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, yZ);
  ctx.lineTo(xPk, yPk);
  ctx.bezierCurveTo(xPk + (xDs-xPk)*0.4, yPk, xDs - (xDs-xPk)*0.2, yS, xDs, yS);
  ctx.lineTo(xDe, yS);
  ctx.bezierCurveTo(xDe + (xEnd-xDe)*0.3, yS, xEnd - (xEnd-xDe)*0.1, yZ, xEnd, yZ);
  ctx.stroke();
  ctx.restore();

  // A D S R labels
  ctx.font      = '5px "Share Tech Mono",monospace';
  ctx.fillStyle = 'rgba(68,255,136,0.25)';
  ctx.textAlign = 'center';
  const lY = H - 2;
  ctx.fillText('A', (x0+xPk)/2,  lY);
  ctx.fillText('D', (xPk+xDs)/2, lY);
  ctx.fillText('S', (xDs+xDe)/2, lY);
  ctx.fillText('R', (xDe+xEnd)/2, lY);

  // Playhead
  if (MV.noteStartTime && MV.playheadAlpha > 0 && typeof audioCtx !== 'undefined' && audioCtx) {
    const now = audioCtx.currentTime;
    let posX, dotY;

    if (!MV.noteReleaseTime) {
      const clamp = Math.min(now - MV.noteStartTime, atk + dcy + SUS_SLOT * 0.45);
      posX = tX(clamp);
      const el = now - MV.noteStartTime;
      dotY = el < atk ? yZ + (yPk - yZ) * (el / atk)
           : el < atk + dcy ? yPk + (yS - yPk) * (1 - Math.exp(-5 * (el-atk)/dcy))
           : yS;
    } else {
      const rEl  = now - MV.noteReleaseTime;
      const rFr  = Math.min(rEl / rel, 1);
      posX = xDe + rFr * (xEnd - xDe);
      dotY = yS + (yZ - yS) * (1 - Math.exp(-4 * rFr));
      if (rEl >= rel) MV.playheadAlpha = Math.max(0, MV.playheadAlpha - 0.04);
    }

    ctx.save();
    ctx.globalAlpha = MV.playheadAlpha;
    ctx.strokeStyle = '#FFD737';
    ctx.lineWidth   = 1.2;
    ctx.shadowColor = 'rgba(255,215,55,0.65)';
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.moveTo(posX, E_PT - 1);
    ctx.lineTo(posX, H - E_PB + 1);
    ctx.stroke();
    ctx.fillStyle = '#FFD737';
    ctx.beginPath();
    ctx.arc(posX, dotY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Hold bar
  const barY = H - E_PB + 2;
  ctx.fillStyle = 'rgba(68,255,136,0.07)';
  ctx.fillRect(x0, barY, xEnd - x0, 2);
  if (MV.physHoldMs > 0) {
    const hPx = Math.min((MV.physHoldMs / 1000 / total) * (xEnd - x0), xEnd - x0);
    ctx.fillStyle = 'rgba(68,255,136,0.50)';
    ctx.fillRect(x0, barY, hPx, 2);
  }
}

// ── FLT mini-viewer ───────────────────────────────────────────────────────
// Shows a 2nd-order lowpass frequency response curve (cutoff + resonance bump).

function drawFlt() {
  const canvas = MV.flt;
  if (!canvas) return;
  const [ctx, W, H] = syncCanvas(canvas);

  ctx.fillStyle = '#060e06';
  ctx.fillRect(0, 0, W, H);

  const { cutoff, resonance } = getLiveAdsr();
  const PL = 4, PR = 4, PT = 5, PB = 8;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  // Log-frequency to X
  const fMin = Math.log2(80), fMax = Math.log2(20000);
  const fToX = f => PL + ((Math.log2(Math.max(f, 80)) - fMin) / (fMax - fMin)) * plotW;

  // 2nd-order resonant lowpass amplitude response
  // |H(f)|² = 1 / ((1-(f/fc)²)² + (f/(fc*Q))²)
  const Q  = Math.max(0.5, resonance);
  const fc = Math.max(100, cutoff);
  const ampAt = f => {
    const x  = f / fc;
    const x2 = x * x;
    return 1 / Math.sqrt((1 - x2) * (1 - x2) + (x2 / (Q * Q)));
  };

  // dB range: draw -36dB to +12dB; clamp display
  const dBMin = -36, dBMax = 12;
  const ampToY = amp => {
    const db = 20 * Math.log10(Math.max(amp, 0.00001));
    return PT + plotH - plotH * Math.max(0, Math.min(1, (db - dBMin) / (dBMax - dBMin)));
  };

  // Draw 0dB reference line
  const y0dB = ampToY(1);
  ctx.strokeStyle = 'rgba(99,102,241,0.15)';
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(PL, y0dB);
  ctx.lineTo(PL + plotW, y0dB);
  ctx.stroke();

  // Draw frequency response curve
  const steps = 80;
  const grad = ctx.createLinearGradient(PL, PT, PL + plotW, PT);
  grad.addColorStop(0,   'rgba(99,102,241,0.70)');
  grad.addColorStop(0.6, 'rgba(99,102,241,0.70)');
  grad.addColorStop(1,   'rgba(99,102,241,0.15)');

  ctx.save();
  ctx.shadowColor = 'rgba(99,102,241,0.50)';
  ctx.shadowBlur  = 3;
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 1.3;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const f = Math.pow(2, fMin + t * (fMax - fMin));
    const x = PL + t * plotW;
    const y = ampToY(ampAt(f));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Cutoff marker
  const xCut = fToX(fc);
  ctx.strokeStyle = 'rgba(99,102,241,0.30)';
  ctx.lineWidth   = 0.8;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(xCut, PT);
  ctx.lineTo(xCut, PT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cutoff Hz label
  ctx.font      = '5px "Share Tech Mono",monospace';
  ctx.fillStyle = 'rgba(99,102,241,0.45)';
  ctx.textAlign = 'center';
  const fcLabel = fc >= 1000 ? (fc/1000).toFixed(1) + 'k' : Math.round(fc) + '';
  ctx.fillText(fcLabel, Math.min(Math.max(xCut, PL + 10), PL + plotW - 10), H - 2);
}

// ── CHR mini-viewer ───────────────────────────────────────────────────────
// Two detuned sine waves showing drift/width; always slowly animated.

function drawChr(dt) {
  const canvas = MV.chr;
  if (!canvas) return;
  const [ctx, W, H] = syncCanvas(canvas);

  ctx.fillStyle = '#060e06';
  ctx.fillRect(0, 0, W, H);

  const { drift, width, sub, drive } = getLiveAdsr();
  const PL = 4, PR = 4, PT = 5, PB = 8;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;
  const midY  = PT + plotH / 2;

  // Advance animation clock
  MV.chrT = (MV.chrT || 0) + dt;
  const t = MV.chrT;

  // Drift controls LFO speed (0–20 → 0.2–2 Hz)
  const lfoHz   = 0.2 + (drift / 20) * 1.8;
  // Width controls stereo spread → phase offset between L/R waves
  const phaseOff = (width / 2) * Math.PI * 0.6;
  // Amplitude of the wave (drive adds a bit of saturation feel)
  const amp     = (plotH * 0.28) * (1 + Math.min(drive / 5, 1) * 0.3);
  // Sub adds a thicker baseline
  const subAmp  = sub * plotH * 0.12;

  const steps = 60;

  // Sub layer (thicker, low glow)
  if (sub > 0.05) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,100,80,0.35)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = PL + (i / steps) * plotW;
      const p = (i / steps) * Math.PI * 4 + t * lfoHz * 0.5 * Math.PI * 2;
      const y = midY + Math.sin(p) * subAmp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Wave 1 (L channel)
  const drawWave = (phase, color, blur) => {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = blur;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = PL + (i / steps) * plotW;
      const p = (i / steps) * Math.PI * 6 + t * lfoHz * Math.PI * 2 + phase;
      const y = midY + Math.sin(p) * amp;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  drawWave(0,          'rgba(230,126,34,0.65)', 3);
  drawWave(phaseOff,   'rgba(230,126,34,0.35)', 0);

  // Label
  ctx.font      = '5px "Share Tech Mono",monospace';
  ctx.fillStyle = 'rgba(230,126,34,0.30)';
  ctx.textAlign = 'left';
  ctx.fillText('drift', PL, H - 2);
}

// ── PLAY mini-viewer ──────────────────────────────────────────────────────
// 4 dots showing strum timing; dots pulse in sequence when a chord fires.

function drawPlay() {
  const canvas = MV.play;
  if (!canvas) return;
  const [ctx, W, H] = syncCanvas(canvas);

  ctx.fillStyle = '#060e06';
  ctx.fillRect(0, 0, W, H);

  const { strum, humanize, glide } = getLiveAdsr();
  const PL = 6, PR = 6, PT = 8, PB = 8;
  const plotW = W - PL - PR;
  const midY  = PT + (H - PT - PB) / 2;

  const N = 4;
  // Max strum represents full width; 0ms = all dots stacked at left
  const maxStrum = 40; // ms — visual scale ceiling
  const strumPx  = Math.min(strum / maxStrum, 1) * plotW;

  // Humanize → vertical jitter seed (stable per session, just visual)
  const jitterAmp = (humanize / 10) * (H - PT - PB) * 0.25;

  // Glide → glow tint on dots
  const glideNorm = Math.min(glide / 300, 1);

  const now = typeof audioCtx !== 'undefined' && audioCtx ? audioCtx.currentTime : null;

  for (let i = 0; i < N; i++) {
    const frac = N === 1 ? 0 : i / (N - 1);
    const x    = PL + frac * strumPx;
    // Stable jitter per dot index (not random per frame)
    const jitter = Math.sin(i * 2.399) * jitterAmp;
    const y      = midY + jitter;

    // Determine if this dot is "lit" (playing)
    let lit = false, litAge = 1;
    if (now !== null && MV.strumDots[i]) {
      const litAt = MV.strumDots[i].litAt;
      if (now >= litAt) {
        litAge = Math.min((now - litAt) * 3, 1);   // 0→1 over ~330ms
        lit    = litAge < 1 || !MV.noteReleaseTime || (now - MV.noteReleaseTime) < 0.5;
      }
    }

    const fade   = lit ? (1 - litAge * 0.6) : 0;
    const radius = 2.5;

    ctx.save();
    if (lit) {
      const glowColor = glideNorm > 0.05
        ? `rgba(139,92,246,${0.8 - fade * 0.4})`
        : `rgba(68,255,136,${0.9 - fade * 0.5})`;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 6;
      ctx.fillStyle   = glowColor;
    } else {
      ctx.fillStyle = 'rgba(68,255,136,0.18)';
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Glide line (shows portamento arc between dots when glide > 0)
  if (glideNorm > 0.05) {
    ctx.save();
    ctx.strokeStyle = `rgba(139,92,246,${glideNorm * 0.35})`;
    ctx.lineWidth   = 0.8;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(PL, midY);
    ctx.lineTo(PL + strumPx, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Label
  ctx.font      = '5px "Share Tech Mono",monospace';
  ctx.fillStyle = 'rgba(139,92,246,0.30)';
  ctx.textAlign = 'right';
  if (glideNorm > 0.05) ctx.fillText('glide', W - PR, H - 2);
}

// ── Main draw dispatcher ──────────────────────────────────────────────────

let _lastT = null;

function drawAll() {
  const now = performance.now() / 1000;
  const dt  = _lastT === null ? 0.016 : Math.min(now - _lastT, 0.1);
  _lastT = now;

  drawEnv();
  drawFlt();
  drawChr(dt);
  drawPlay();
}
