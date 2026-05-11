// ════════════════════════════════════════════════════════
//  TEACH ME MODE  —  interactive guided music theory lessons
//  Each lesson has multiple steps. Steps can spotlight
//  specific controls and wait for the user to play them
//  before advancing. The app stays fully playable.
// ════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────────────────
let teachModeActive  = false;
let currentLesson    = 0;
let currentStep      = 0;
let stepDone         = false;
let spotlightEls     = [];
let animFrame        = null;
let animStartTime    = null;

// ── Lesson data ────────────────────────────────────────────────────────────
// highlight entries:
//   'key:N'       → chord key at index N (0-11)
//   'qual:KEY'    → quality button with data-qual-key="KEY"
//   'sel:SELECTOR'→ any CSS selector
// tryit:
//   { type:'chord',   idx: N | 'any' }
//   { type:'quality', key: 'maj' | 'any' }
//   { type:'keyChange' }
//   null  → no action required, just read

const LESSONS = [
  // ─────────────────────────────────────────────────────────
  {
    title: 'Getting Oriented',
    icon: '🗺',
    steps: [
      {
        stepTitle: 'Welcome!',
        text: 'This app lets you play <strong>chord progressions</strong> in any key and scale — no prior music knowledge needed.<br><br>These lessons teach you how music actually works while you play it in real time.',
        highlight: [],
        diagram: null,
        tryit: null,
      },
      {
        stepTitle: 'Three Zones',
        text: '<strong>Top</strong> — choose your key and scale (the musical palette).<br><br><strong>Left zone</strong> — pick which chord in the scale to play.<br><br><strong>Right zone</strong> — color that chord with major, minor, 7th, and more.',
        highlight: ['sel:.panel-top', 'sel:.play-left', 'sel:.play-right'],
        diagram: 'zones',
        tryit: null,
      },
      {
        stepTitle: 'Keyboard Shortcuts',
        text: 'Every chord button has a key shortcut.<br><br><code>1 2 3 4</code> and <code>Q W E R</code> play the 7 scale chords.<br><code>A S D F</code> play extension chords (V7, Imaj7…).<br><br>Try pressing <strong>1</strong> now.',
        highlight: ['key:0'],
        diagram: null,
        tryit: { type: 'chord', idx: 'any' },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    title: 'Your First Chord',
    icon: '🎵',
    steps: [
      {
        stepTitle: 'The I Chord — Home',
        text: 'Every scale has a <strong>tonic chord</strong> — the "home" that everything gravitates toward. In a major key this is the <strong>I chord</strong>.<br><br>It sounds bright, stable, and fully resolved — like the end of a sentence.',
        highlight: [],
        diagram: 'single_I',
        tryit: null,
      },
      {
        stepTitle: 'Play It',
        text: 'Press <strong>key "1"</strong> (or click the I chord button).<br><br>Notice how it sounds <em>settled</em>. Play it a few times and let it ring.',
        highlight: ['key:0'],
        diagram: null,
        tryit: { type: 'chord', idx: 0 },
      },
      {
        stepTitle: 'Now the V Chord',
        text: 'The <strong>V chord</strong> (key Q) creates <em>tension</em> — like a question waiting for an answer.<br><br>Play V, then go back to I. That pull back to I is called <strong>resolution</strong> — the most fundamental force in music.',
        highlight: ['key:4'],
        diagram: 'tension_res',
        tryit: { type: 'chord', idx: 4 },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    title: 'The I–IV–V',
    icon: '🎸',
    steps: [
      {
        stepTitle: 'Three Chords, Every Genre',
        text: 'The <strong>I–IV–V progression</strong> is the backbone of blues, rock, country, and pop.<br><br>Elvis, Robert Johnson, Chuck Berry — they built empires on these three chords. Thousands of songs use nothing else.',
        highlight: [],
        diagram: 'prog_145',
        tryit: null,
      },
      {
        stepTitle: 'Play I  (key 1)',
        text: '<strong>Home.</strong> The anchor. Sounds settled and resolved.',
        highlight: ['key:0'],
        diagram: null,
        tryit: { type: 'chord', idx: 0 },
      },
      {
        stepTitle: 'Play IV  (key 4)',
        text: '<strong>Warmth.</strong> The IV chord lifts away from home with a sense of openness — not tension, just movement. The IV is the "subdominant" — it comes before the big moment.',
        highlight: ['key:3'],
        diagram: null,
        tryit: { type: 'chord', idx: 3 },
      },
      {
        stepTitle: 'Play V  (key Q)',
        text: '<strong>Tension.</strong> The V chord urgently wants to go back to I — this pull is called <em>dominant tension</em>. It drives the music forward.',
        highlight: ['key:4'],
        diagram: null,
        tryit: { type: 'chord', idx: 4 },
      },
      {
        stepTitle: 'Loop It',
        text: 'Play them in order and loop: <code>1 → 4 → Q → 1</code><br><br>Hold each chord for a beat or two. This is the 12-bar blues skeleton — one of the most satisfying loops in all of music.',
        highlight: ['key:0','key:3','key:4'],
        diagram: 'prog_145',
        tryit: { type: 'chord', idx: 'any' },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    title: 'The Emotional Axis',
    icon: '💫',
    steps: [
      {
        stepTitle: 'I–V–vi–IV',
        text: '"Let It Be", "No Woman No Cry", "Africa", "Don\'t Stop Believin\'", "Someone Like You"…<br><br>All use the same four chords. This is the <strong>axis progression</strong> — the most common sequence in modern music.',
        highlight: [],
        diagram: 'prog_axis',
        tryit: null,
      },
      {
        stepTitle: 'Play I  (key 1)',
        text: '<strong>Home.</strong> Bright and settled.',
        highlight: ['key:0'],
        tryit: { type: 'chord', idx: 0 },
      },
      {
        stepTitle: 'Play V  (key Q)',
        text: '<strong>Lift.</strong> Rising tension — something is about to happen.',
        highlight: ['key:4'],
        tryit: { type: 'chord', idx: 4 },
      },
      {
        stepTitle: 'Play vi  (key W)',
        text: '<strong>Emotion.</strong> The vi is the <em>relative minor</em> — suddenly bittersweet. This single chord shift is why the progression feels moving and human.<br><br>The vi chord shares two notes with I, so it\'s related but emotionally opposite.',
        highlight: ['key:5'],
        tryit: { type: 'chord', idx: 5 },
      },
      {
        stepTitle: 'Play IV  (key 4)',
        text: '<strong>Release.</strong> Open, warm — ready to return home.',
        highlight: ['key:3'],
        tryit: { type: 'chord', idx: 3 },
      },
      {
        stepTitle: 'The Full Loop',
        text: 'Play the loop: <code>1 → Q → W → 4</code> — repeat.<br><br>Each chord has its own emotional role: Home → Lift → Emotion → Release. Music is just feelings organized in time.',
        highlight: ['key:0','key:4','key:5','key:3'],
        diagram: 'prog_axis',
        tryit: { type: 'chord', idx: 'any' },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    title: 'Chord Colors: Quality',
    icon: '🎨',
    steps: [
      {
        stepTitle: 'What Is a Quality?',
        text: 'Every chord has a <strong>quality</strong> — the specific intervals between its notes. Major sounds bright, minor sounds warm and melancholic, 7ths add sophistication.<br><br>The right-zone panel lets you override any chord\'s natural quality.',
        highlight: ['sel:.quality-panel'],
        diagram: null,
        tryit: null,
      },
      {
        stepTitle: 'Force Major (hold Y)',
        text: 'Hold <strong>Y</strong> and press <strong>2</strong>.<br><br>The ii chord is naturally minor — hold Y to force it major. Hear the brightness shift.',
        highlight: ['key:1','qual:maj'],
        diagram: null,
        tryit: { type: 'quality', key: 'maj' },
      },
      {
        stepTitle: 'Force Minor (hold U)',
        text: 'Hold <strong>U</strong> and press <strong>Q</strong>.<br><br>The V chord is naturally major — making it minor creates a dark, unexpected sound. This is the "minor IV" trick used in soul and rock.',
        highlight: ['key:4','qual:min'],
        diagram: null,
        tryit: { type: 'quality', key: 'min' },
      },
      {
        stepTitle: 'Add a 7th (hold H)',
        text: 'Hold <strong>H (maj7)</strong> and press <strong>1</strong>.<br><br>The major 7th adds a lush, singing overtone above the chord. This is the sound of jazz, neo-soul, and sophisticated pop.',
        highlight: ['key:0','qual:maj7'],
        diagram: null,
        tryit: { type: 'quality', key: 'maj7' },
      },
      {
        stepTitle: 'Dim & Suspended',
        text: 'Row 1 of the panel has the basic triads: maj, min, aug, sus4, dim.<br><br>Row 2 adds 7ths. Row 3 adds 9ths and extensions.<br><br>Try holding any quality key while playing chords — the combination is always valid.',
        highlight: ['sel:.quality-panel'],
        diagram: 'qual_rows',
        tryit: { type: 'quality', key: 'any' },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    title: 'Scales & Mood',
    icon: '🌗',
    steps: [
      {
        stepTitle: 'The Scale is Your Palette',
        text: 'The <strong>scale</strong> determines which notes belong together. Changing the scale changes the emotional colour of every chord — even if you play the same progression.',
        highlight: ['sel:#scaleLabel','sel:.circle-section'],
        diagram: 'scale_spectrum',
        tryit: null,
      },
      {
        stepTitle: 'Switch to Dorian',
        text: '<strong>Dorian</strong> is a minor scale with a raised 6th — cooler and jazzier than natural minor. Miles Davis\'s "So What" is pure Dorian.<br><br>Spin the <strong>circle of fifths</strong> wheel to change the mode, or click through modes on the display.',
        highlight: ['sel:#circleCanvas','sel:#scaleLabel'],
        diagram: null,
        tryit: { type: 'keyChange' },
      },
      {
        stepTitle: 'Same Chords, New Mood',
        text: 'Play <strong>I → IV → V</strong> again (keys 1, 4, Q).<br><br>The same degrees — completely different emotional world. This is why scales matter.',
        highlight: ['key:0','key:3','key:4'],
        diagram: null,
        tryit: { type: 'chord', idx: 'any' },
      },
      {
        stepTitle: 'The Modal Spectrum',
        text: 'Modes arranged from brightest to darkest:<br><strong>Lydian → Ionian → Mixolydian → Dorian → Aeolian → Phrygian → Locrian</strong><br><br>Ionian is the standard major scale. Aeolian is natural minor. Locrian is almost unusably dark — but wonderfully dramatic.',
        highlight: ['sel:#scaleLabel'],
        diagram: 'scale_spectrum',
        tryit: null,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    title: 'Shaping the Sound',
    icon: '🎛',
    steps: [
      {
        stepTitle: 'The Voice Panel',
        text: 'The <strong>Voice</strong> section (bottom-left) shapes how chords sound — attack, filter, effects. The same chord sounds like a piano, strings, or a dreamy pad depending on these settings.',
        highlight: ['sel:.vpc-voice'],
        diagram: null,
        tryit: null,
      },
      {
        stepTitle: 'Strum — Natural Timing',
        text: 'Turn the <strong>Strum</strong> knob up to ~15ms.<br><br>Now chord notes cascade one after the other instead of hitting simultaneously — like a guitarist strumming downward. Play a chord and hear the difference.',
        highlight: ['sel:#strumKnob'],
        diagram: null,
        tryit: { type: 'chord', idx: 'any' },
      },
      {
        stepTitle: 'Humanize — Organic Feel',
        text: 'Turn <strong>Humanize</strong> up to 7 or 8.<br><br>It simultaneously randomises velocity, timing, and micro-tuning — the difference between a sequencer and a musician. Play a few chords.',
        highlight: ['sel:#humanizeKnob'],
        diagram: null,
        tryit: { type: 'chord', idx: 'any' },
      },
      {
        stepTitle: 'Legato — Connected Phrases',
        text: 'Enable <strong>Legato</strong> (the toggle button) when playing sustained instruments like Strings or Choir.<br><br>Normally each chord re-swells from silence. Legato skips the attack — chords flow into each other like a bow never leaves the string.',
        highlight: ['sel:#legatoToggle'],
        diagram: null,
        tryit: null,
      },
      {
        stepTitle: 'Pick a Sound',
        text: 'In the <strong>Patches</strong> panel on the right, try different presets — Piano, Strings, Choir, Pad, Pluck…<br><br>Each one has tuned defaults but every knob stays editable.',
        highlight: ['sel:.vpc-patches'],
        diagram: null,
        tryit: null,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    title: 'Your First Song',
    icon: '🎼',
    steps: [
      {
        stepTitle: 'Putting It Together',
        text: 'You\'ve learned the core tools. Let\'s compose something real using everything at once.',
        highlight: [],
        diagram: null,
        tryit: null,
      },
      {
        stepTitle: '1 · Choose a Sound',
        text: 'In the <strong>Patches</strong> panel, choose <strong>Strings</strong> or <strong>Piano</strong>.<br><br>These work beautifully for emotional progressions and show off the Voice controls well.',
        highlight: ['sel:.vpc-patches'],
        diagram: null,
        tryit: null,
      },
      {
        stepTitle: '2 · The Axis Progression',
        text: 'Play: <code>I → V → vi → IV</code><br>Keys: <code>1 → Q → W → 4</code><br><br>Hold each chord for 2–3 seconds. Let the sound decay naturally before moving on.',
        highlight: ['key:0','key:4','key:5','key:3'],
        diagram: 'prog_axis',
        tryit: { type: 'chord', idx: 'any' },
      },
      {
        stepTitle: '3 · Add 7th Color',
        text: 'While playing:<br>• Hold <strong>H (maj7)</strong> on the I chord<br>• Hold <strong>J (min7)</strong> on the vi chord<br><br>The 7ths lift the emotion — this is what separates pop from jazz.',
        highlight: ['key:0','key:5','qual:maj7','qual:min7'],
        diagram: null,
        tryit: { type: 'quality', key: 'any' },
      },
      {
        stepTitle: '4 · Add Feel',
        text: 'Set <strong>Strum</strong> to ~12ms and <strong>Humanize</strong> to 6.<br><br>Play the loop again. The timing and velocity variation makes it feel alive.',
        highlight: ['sel:#strumKnob','sel:#humanizeKnob'],
        diagram: null,
        tryit: { type: 'chord', idx: 'any' },
      },
      {
        stepTitle: '🎉 You Made Music!',
        text: 'You just composed a real chord progression using music theory.<br><br>Every choice was backed by centuries of harmonic practice — and it all came naturally through playing.<br><br>Keep exploring: try different scales, qualities, and patches. The theory supports every decision.',
        highlight: [],
        diagram: 'completion',
        tryit: null,
      },
    ],
  },
];

// ── Target resolution ──────────────────────────────────────────────────────
function resolveTargets(highlights) {
  const els = [];
  for (const h of highlights) {
    if (h.startsWith('key:')) {
      const idx = parseInt(h.slice(4));
      if (typeof keyEls !== 'undefined' && keyEls[idx]) els.push(keyEls[idx]);
    } else if (h.startsWith('qual:')) {
      const key = h.slice(5);
      document.querySelectorAll(`[data-qual-key="${key}"]`).forEach(el => els.push(el));
    } else if (h.startsWith('sel:')) {
      document.querySelectorAll(h.slice(4)).forEach(el => els.push(el));
    }
  }
  return els;
}

// ── Spotlight ──────────────────────────────────────────────────────────────
function applySpotlight(highlights) {
  clearSpotlight();
  spotlightEls = resolveTargets(highlights);
  spotlightEls.forEach(el => el.classList.add('teach-spotlight'));
  document.body.classList.toggle('teach-has-spotlight', spotlightEls.length > 0);
}

function clearSpotlight() {
  spotlightEls.forEach(el => el.classList.remove('teach-spotlight'));
  spotlightEls = [];
  document.body.classList.remove('teach-has-spotlight');
}

// ── Diagram drawing ────────────────────────────────────────────────────────
const CHORD_COLORS = {
  I:  { bg:'rgba(34,197,94,0.20)',  border:'rgba(34,197,94,0.70)',  text:'#22c55e' },
  IV: { bg:'rgba(96,165,250,0.20)', border:'rgba(96,165,250,0.70)', text:'#60a5fa' },
  V:  { bg:'rgba(251,146,60,0.20)', border:'rgba(251,146,60,0.70)', text:'#fb923c' },
  vi: { bg:'rgba(167,139,250,0.20)',border:'rgba(167,139,250,0.70)',text:'#a78bfa' },
};

function drawDiagram(canvas, type, phase) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = 280, cssH = 72;
  canvas.width  = cssW * dpr; canvas.height = cssH * dpr;
  canvas.style.width  = cssW + 'px'; canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = cssW, H = cssH;

  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);

  switch (type) {
    case 'zones': drawZones(ctx, W, H); break;
    case 'single_I': drawSingleI(ctx, W, H, phase); break;
    case 'tension_res': drawTensionRes(ctx, W, H, phase); break;
    case 'prog_145': drawProg(ctx, W, H, ['I','IV','V'], phase); break;
    case 'prog_axis': drawProg(ctx, W, H, ['I','V','vi','IV'], phase); break;
    case 'qual_rows': drawQualRows(ctx, W, H); break;
    case 'scale_spectrum': drawScaleSpectrum(ctx, W, H, phase); break;
    case 'completion': drawCompletion(ctx, W, H, phase); break;
  }
}

function chordBlock(ctx, x, y, w, h, label, colors, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = colors.bg;    ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = colors.border; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  ctx.fillStyle   = colors.text;
  ctx.font        = 'bold 14px DM Mono, monospace';
  ctx.textAlign   = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  ctx.textAlign   = 'left';
  ctx.globalAlpha = 1;
}

function arrowRight(ctx, x, y, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.55;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 5, y - 3); ctx.lineTo(x + 8, y); ctx.lineTo(x + 5, y + 3); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawZones(ctx, W, H) {
  const zones = [
    { label: 'TOP · Key & Scale', x: 6,   w: W - 12, h: 18, y: 4,   bg:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.40)',  text:'rgba(34,197,94,0.85)'  },
    { label: 'LEFT · Chord Degree', x: 6,  w: W/2-10, h: 28, y: 28,  bg:'rgba(96,165,250,0.12)', border:'rgba(96,165,250,0.40)', text:'rgba(96,165,250,0.85)' },
    { label: 'RIGHT · Quality', x: W/2+4, w: W/2-10, h: 28, y: 28,  bg:'rgba(167,139,250,0.12)',border:'rgba(167,139,250,0.40)',text:'rgba(167,139,250,0.85)'},
  ];
  zones.forEach(z => {
    ctx.fillStyle = z.bg; ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.strokeStyle = z.border; ctx.lineWidth = 1; ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1);
    ctx.fillStyle = z.text; ctx.font = '8px DM Mono, monospace'; ctx.textAlign = 'center';
    ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h / 2 + 3); ctx.textAlign = 'left';
  });
}

function drawSingleI(ctx, W, H, phase) {
  const pulse = 0.88 + 0.12 * Math.sin(phase * Math.PI * 2);
  const bW = 80, bH = 44, bX = (W - bW) / 2, bY = (H - bH) / 2;
  ctx.shadowColor = `rgba(34,197,94,${0.40 * pulse})`; ctx.shadowBlur = 16 * pulse;
  chordBlock(ctx, bX, bY, bW, bH, 'I', CHORD_COLORS.I);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(34,197,94,0.50)'; ctx.font = '7px DM Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillText('tonic · home · resolved', W / 2, H - 5); ctx.textAlign = 'left';
}

function drawTensionRes(ctx, W, H, phase) {
  const p = (phase * 1.2) % 1;
  const bW = 70, bH = 40;
  const vX = W * 0.15, iX = W * 0.58, bY = (H - bH) / 2;
  chordBlock(ctx, vX, bY, bW, bH, 'V', CHORD_COLORS.V);
  chordBlock(ctx, iX, bY, bW, bH, 'I', CHORD_COLORS.I);
  // Animated arc from V to I
  const ax1 = vX + bW, ay = bY + bH / 2;
  const ax2 = iX, arcMidX = (ax1 + ax2) / 2, arcMidY = bY - 12;
  const dotT = p < 0.6 ? p / 0.6 : 1;
  const dotX = ax1 + (ax2 - ax1) * dotT, dotY = ay + (arcMidY - ay) * Math.sin(dotT * Math.PI);
  ctx.strokeStyle = 'rgba(251,146,60,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(ax1, ay); ctx.quadraticCurveTo(arcMidX, arcMidY, ax2, ay); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
  ctx.fillStyle = p < 0.6 ? '#fb923c' : '#22c55e'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '7px DM Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillText('tension → resolution', W / 2, H - 5); ctx.textAlign = 'left';
}

function drawProg(ctx, W, H, labels, phase) {
  const n = labels.length, gap = 6;
  const bW = (W - gap * (n + 1)) / n, bH = 42, bY = (H - bH) / 2;
  const activeIdx = Math.floor(phase * n * 1.5) % n;
  labels.forEach((lbl, i) => {
    const x = gap + i * (bW + gap);
    const isActive = i === activeIdx;
    const alpha = isActive ? 1 : 0.55;
    ctx.shadowColor = isActive ? CHORD_COLORS[lbl]?.text || '#fff' : 'transparent';
    ctx.shadowBlur  = isActive ? 12 : 0;
    chordBlock(ctx, x, bY, bW, bH, lbl, CHORD_COLORS[lbl] || CHORD_COLORS.I, alpha);
    ctx.shadowBlur = 0;
    if (i < n - 1) arrowRight(ctx, x + bW + 1, bY + bH / 2, 'rgba(255,255,255,0.35)');
  });
}

function drawQualRows(ctx, W, H) {
  const rows = [
    { labels: ['maj','min','aug','sus4','dim'], y: 6  },
    { labels: ['maj7','min7','augΔ7','sus2','dim7'], y: 30 },
    { labels: ['add9','min9','aug+7','7sus4','ø7'],  y: 52 },
  ];
  const bW = (W - 12) / 5 - 2;
  rows.forEach((row, ri) => {
    row.labels.forEach((lbl, ci) => {
      const x = 6 + ci * (bW + 2);
      const families = ['maj','min','aug','sus','dim'];
      const fam = families[ci];
      const rgb = fam === 'maj' ? '34,197,94' : fam === 'min' ? '202,138,4' :
                  fam === 'aug' ? '168,85,247' : fam === 'sus' ? '100,116,139' : '249,115,22';
      ctx.fillStyle = `rgba(${rgb},0.15)`; ctx.fillRect(x, row.y, bW, 18);
      ctx.strokeStyle = `rgba(${rgb},0.40)`; ctx.lineWidth = 0.8; ctx.strokeRect(x+0.4, row.y+0.4, bW-0.8, 17.2);
      ctx.fillStyle = `rgba(${rgb},0.80)`; ctx.font = '6.5px DM Mono,monospace'; ctx.textAlign = 'center';
      ctx.fillText(lbl, x + bW / 2, row.y + 12); ctx.textAlign = 'left';
    });
  });
}

function drawScaleSpectrum(ctx, W, H, phase) {
  const modes = ['Lydian','Ionian','Mixo.','Dorian','Aeolian','Phrygian','Locrian'];
  const n = modes.length;
  const bW = (W - 8) / n - 2;
  modes.forEach((m, i) => {
    const x = 4 + i * (bW + 2);
    const t = i / (n - 1); // 0 = bright, 1 = dark
    const r = Math.round(34 + (100 - 34) * t), g = Math.round(197 - 197 * t * 0.8), b = Math.round(94 + 90 * t);
    const pulse = 0.70 + 0.30 * Math.abs(Math.sin((phase * 7 + i) * 0.8));
    ctx.fillStyle = `rgba(${r},${g},${b},${0.18 * pulse})`; ctx.fillRect(x, 6, bW, 42);
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.55 * pulse})`; ctx.lineWidth = 0.8; ctx.strokeRect(x+0.4, 6.4, bW-0.8, 41.2);
    ctx.fillStyle = `rgba(${r},${g},${b},0.85)`; ctx.font = `${i===0||i===n-1?'bold ':''}6px DM Mono,monospace`;
    ctx.textAlign = 'center'; ctx.fillText(m, x + bW/2, H - 6); ctx.textAlign = 'left';
  });
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '6.5px DM Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillText('← bright', 28, 4); ctx.fillText('dark →', W - 22, 4); ctx.textAlign = 'left';
}

function drawCompletion(ctx, W, H, phase) {
  // Animated confetti dots
  const stars = 18;
  for (let i = 0; i < stars; i++) {
    const t = (phase + i / stars) % 1;
    const x = (Math.sin(i * 2.4) * 0.5 + 0.5) * W;
    const y = H * 0.9 - t * H * 0.8;
    const r = 2.5 + Math.sin(i * 1.7) * 1.5;
    const colors = ['#22c55e','#fbbf24','#60a5fa','#f472b6','#a78bfa'];
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = 1 - t * 0.8; ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 16px DM Mono,monospace'; ctx.textAlign = 'center';
  ctx.fillText('🎉 Well done!', W / 2, H / 2 + 8); ctx.textAlign = 'left';
}

// ── Panel HTML ─────────────────────────────────────────────────────────────
function buildPanel() {
  const existing = document.getElementById('teachPanel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'teachPanel';
  panel.className = 'teach-panel';
  panel.innerHTML = `
    <div class="teach-hdr">
      <div class="teach-hdr-left">
        <span class="teach-hdr-icon" id="teachIcon"></span>
        <span class="teach-hdr-label">Teach Me</span>
      </div>
      <div class="teach-hdr-right">
        <span class="teach-lesson-counter" id="teachCounter"></span>
        <button class="teach-close-btn" id="teachCloseBtn" title="Close">✕</button>
      </div>
    </div>

    <div class="teach-lesson-nav">
      <button class="teach-nav-btn" id="teachLessonPrev" title="Previous lesson">◀</button>
      <div class="teach-lesson-dots" id="teachLessonDots"></div>
      <button class="teach-nav-btn" id="teachLessonNext" title="Next lesson">▶</button>
    </div>

    <div class="teach-body" id="teachBody">
      <div class="teach-step-title" id="teachStepTitle"></div>
      <canvas class="teach-canvas" id="teachCanvas" style="display:none"></canvas>
      <div class="teach-text"  id="teachText"></div>
      <div class="teach-tryit" id="teachTryit" style="display:none">
        <span class="teach-tryit-icon">🎵</span>
        <span class="teach-tryit-text" id="teachTryitText">Try it!</span>
        <span class="teach-tryit-ok" id="teachTryitOk" style="display:none">✓</span>
      </div>
    </div>

    <div class="teach-footer">
      <div class="teach-step-pips" id="teachStepPips"></div>
      <div class="teach-step-btns">
        <button class="teach-step-btn teach-step-prev" id="teachStepPrev">◀ Back</button>
        <button class="teach-step-btn teach-step-next" id="teachStepNext">Next ▶</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('teachCloseBtn').addEventListener('click', toggleTeachMode);
  document.getElementById('teachLessonPrev').addEventListener('click', () => gotoLesson(currentLesson - 1));
  document.getElementById('teachLessonNext').addEventListener('click', () => gotoLesson(currentLesson + 1));
  document.getElementById('teachStepPrev').addEventListener('click', prevStep);
  document.getElementById('teachStepNext').addEventListener('click', nextStep);
}

// ── Render current step ────────────────────────────────────────────────────
function renderStep() {
  if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }

  const lesson = LESSONS[currentLesson];
  const step   = lesson.steps[currentStep];
  stepDone     = step.tryit === null; // no tryit = already done

  // Header
  document.getElementById('teachIcon').textContent    = lesson.icon;
  document.getElementById('teachCounter').textContent = `Lesson ${currentLesson + 1} / ${LESSONS.length}`;

  // Lesson dots
  const dotsEl = document.getElementById('teachLessonDots');
  dotsEl.innerHTML = '';
  LESSONS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'teach-lesson-dot' + (i === currentLesson ? ' active' : '') + (i < currentLesson ? ' done' : '');
    dot.addEventListener('click', () => gotoLesson(i));
    dotsEl.appendChild(dot);
  });

  // Step pips
  const pipsEl = document.getElementById('teachStepPips');
  pipsEl.innerHTML = '';
  lesson.steps.forEach((_, i) => {
    const pip = document.createElement('div');
    pip.className = 'teach-step-pip' + (i === currentStep ? ' active' : '') + (i < currentStep ? ' done' : '');
    pipsEl.appendChild(pip);
  });

  // Content
  document.getElementById('teachStepTitle').textContent = step.stepTitle;
  document.getElementById('teachText').innerHTML       = step.text;

  // Diagram
  const canvas = document.getElementById('teachCanvas');
  if (step.diagram) {
    canvas.style.display = 'block';
    animStartTime = performance.now();
    function animLoop() {
      const phase = ((performance.now() - animStartTime) / 1000 * 0.38) % 1;
      drawDiagram(canvas, step.diagram, phase);
      animFrame = requestAnimationFrame(animLoop);
    }
    animLoop();
  } else {
    canvas.style.display = 'none';
  }

  // Try-it box
  const tryitEl   = document.getElementById('teachTryit');
  const tryitTxt  = document.getElementById('teachTryitText');
  const tryitOk   = document.getElementById('teachTryitOk');
  if (step.tryit) {
    tryitEl.style.display = 'flex';
    tryitOk.style.display = 'none';
    tryitEl.classList.remove('teach-tryit-done');
    tryitTxt.textContent = tryitLabel(step.tryit);
  } else {
    tryitEl.style.display = 'none';
  }

  // Next/Prev button state
  document.getElementById('teachStepPrev').disabled = (currentLesson === 0 && currentStep === 0);
  const isLast = (currentLesson === LESSONS.length - 1 && currentStep === lesson.steps.length - 1);
  const nextBtn = document.getElementById('teachStepNext');
  nextBtn.textContent  = isLast ? 'Finish ✓' : 'Next ▶';
  nextBtn.disabled     = false;

  // Spotlight
  applySpotlight(step.highlight || []);
}

function tryitLabel(tryit) {
  if (!tryit) return '';
  if (tryit.type === 'chord') {
    if (tryit.idx === 'any') return 'Play any chord on the left';
    const names = ['I','ii','iii','IV','V','vi','VII°','I+8','ext1','ext2','ext3','ext4'];
    return `Play the ${names[tryit.idx] || tryit.idx} chord`;
  }
  if (tryit.type === 'quality') {
    if (tryit.key === 'any') return 'Hold any quality key on the right';
    return `Hold the ${tryit.key} quality key`;
  }
  if (tryit.type === 'keyChange') return 'Change the root or scale';
  return 'Try it!';
}

// ── Navigation ─────────────────────────────────────────────────────────────
function gotoLesson(idx) {
  if (idx < 0 || idx >= LESSONS.length) return;
  currentLesson = idx;
  currentStep   = 0;
  renderStep();
}

function nextStep() {
  const lesson = LESSONS[currentLesson];
  if (currentStep < lesson.steps.length - 1) {
    currentStep++;
    renderStep();
  } else if (currentLesson < LESSONS.length - 1) {
    currentLesson++;
    currentStep = 0;
    renderStep();
  } else {
    toggleTeachMode(); // finished all lessons
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  } else if (currentLesson > 0) {
    currentLesson--;
    currentStep = LESSONS[currentLesson].steps.length - 1;
    renderStep();
  }
}

// ── Try-it hook (called by app.js) ────────────────────────────────────────
window._teachHook = function(event) {
  if (!teachModeActive) return;
  const lesson = LESSONS[currentLesson];
  if (!lesson) return;
  const step = lesson.steps[currentStep];
  if (!step || !step.tryit || stepDone) return;

  const { tryit } = step;
  let matched = false;

  if (tryit.type === 'chord') {
    matched = tryit.idx === 'any' || tryit.idx === event.idx;
    matched = matched && event.type === 'chord';
  } else if (tryit.type === 'quality') {
    matched = event.type === 'quality' && (tryit.key === 'any' || tryit.key === event.key);
  } else if (tryit.type === 'keyChange') {
    matched = event.type === 'keyChange';
  }

  if (matched) {
    stepDone = true;
    const tryitEl = document.getElementById('teachTryit');
    const tryitOk = document.getElementById('teachTryitOk');
    if (tryitEl) tryitEl.classList.add('teach-tryit-done');
    if (tryitOk) tryitOk.style.display = 'inline';
    // Auto-advance after 900ms
    setTimeout(() => {
      if (teachModeActive) nextStep();
    }, 900);
  }
};

// ── Toggle ─────────────────────────────────────────────────────────────────
function toggleTeachMode() {
  teachModeActive = !teachModeActive;
  const btn = document.getElementById('teachModeBtn');

  if (teachModeActive) {
    buildPanel();
    renderStep();
    if (btn) { btn.classList.add('teach-btn-active'); btn.querySelector('.teach-btn-pip').classList.add('teach-pip-on'); }
  } else {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    clearSpotlight();
    const panel = document.getElementById('teachPanel');
    if (panel) panel.remove();
    if (btn) { btn.classList.remove('teach-btn-active'); btn.querySelector('.teach-btn-pip').classList.remove('teach-pip-on'); }
  }
}
