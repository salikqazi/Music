// ════════════════════════════════════════════════════════
//  INFO MODE  —  hover tooltips with live waveform previews
//  Toggle with the Info button in the nameplate.
//  Hover any knob, chord button, or quality key to see what
//  it does. Click ⚲ to pin a tooltip. Multiple can be pinned.
// ════════════════════════════════════════════════════════

let infoModeActive  = false;
let hoveredEl       = null;
let hoverTimeout    = null;
let activeTooltip   = null;   // current non-pinned tooltip
const pinnedTooltips = [];    // { el, frame }[]

// ── Chord interval tables ─────────────────────────────────────────────────
// Each value = semitones from root (0 = root, 4 = maj3, 7 = P5, etc.)
const QUAL_INTERVALS = {
  maj:   [0, 4, 7],
  min:   [0, 3, 7],
  aug:   [0, 4, 8],
  sus4:  [0, 5, 7],
  dim:   [0, 3, 6],
  maj7:  [0, 4, 7, 11],
  min7:  [0, 3, 7, 10],
  augM7: [0, 4, 8, 11],
  sus2:  [0, 2, 7],
  dim7:  [0, 3, 6, 9],
  add9:  [0, 4, 7, 2],   // 2 = 9th above (shown in second octave)
  min9:  [0, 3, 7, 10, 2],
  aug7:  [0, 4, 8, 10],
  '7sus4': [0, 5, 7, 10],
  hdim7: [0, 3, 6, 10],
};

const QUAL_COLORS = {
  maj:'34,197,94', min:'202,138,4', aug:'168,85,247',
  sus:'100,116,139', dim:'249,115,22',
};
const QUAL_FAMILY = {
  maj:'maj', min:'min', aug:'aug', sus4:'sus', dim:'dim',
  maj7:'maj', min7:'min', augM7:'aug', sus2:'sus', dim7:'dim',
  add9:'maj', min9:'min', aug7:'aug', '7sus4':'sus', hdim7:'dim',
};

// ── Scale patterns ────────────────────────────────────────────────────────
const SCALE_INTERVALS = {
  Ionian:     [0,2,4,5,7,9,11],
  Dorian:     [0,2,3,5,7,9,10],
  Phrygian:   [0,1,3,5,7,8,10],
  Lydian:     [0,2,4,6,7,9,11],
  Mixolydian: [0,2,4,5,7,9,10],
  Aeolian:    [0,2,3,5,7,8,10],
  Locrian:    [0,1,3,5,6,8,10],
};

// Highlight the "characteristic" note(s) that define each mode
const SCALE_CHAR_DEGREE = {
  Ionian: null, Dorian: 5, Phrygian: 1, Lydian: 3,
  Mixolydian: 6, Aeolian: null, Locrian: 4,
};

// ── Info data ─────────────────────────────────────────────────────────────
const INFO_DATA = {
  // ── Synth controls ──────────────────────────────────────────────────────
  master:   { title: 'Master Volume',  desc: 'Overall output level. Turn down before enabling Hold or stacking many voices.',                                                    anim: 'volume'    },
  octave:   { title: 'Octave',         desc: 'Shifts all chords up or down in octave steps — e.g. C4 becomes C5.',                                                              anim: 'octave'    },
  atk:      { title: 'Attack',         desc: 'Rise time from silence to peak when a note triggers. Short = punchy snap. Long = slow swell.',                                     anim: 'env_atk'   },
  dcy:      { title: 'Decay',          desc: 'Time to drop from peak down to the sustain level. Short gives a plucked feel; long keeps energy longer.',                          anim: 'env_dcy'   },
  sus:      { title: 'Sustain',        desc: 'Volume held while the key is pressed. 0 = fully decays away; 1.0 = stays at full volume.',                                         anim: 'env_sus'   },
  rel:      { title: 'Release',        desc: 'Fade time after the key is released. Long = notes ring out beautifully. Near 0 = instant cut.',                                    anim: 'env_rel'   },
  cut:      { title: 'Cutoff',         desc: 'Low-pass filter cutoff. Frequencies above this point are rolled off. Lower = darker, more muffled tone.',                          anim: 'cutoff'    },
  res:      { title: 'Resonance',      desc: 'Boosts a narrow band near the cutoff. High values add a whistling, synth-like resonant peak.',                                     anim: 'resonance' },
  warm:     { title: 'Warmth',         desc: 'Slight pitch detune between layers. The beating between them creates chorus shimmer and warmth.',                                   anim: 'warmth'    },
  rev:      { title: 'Reverb',         desc: 'Convolution hall reverb. Adds early reflections and a decay tail — like playing in a room vs. a dry booth.',                       anim: 'reverb'    },
  drive:    { title: 'Drive',          desc: 'Tape-style soft saturation. Gently clips the waveform adding harmonic richness and presence.',                                      anim: 'drive'     },
  drift:    { title: 'Drift',          desc: 'Slow random pitch wandering per layer. Gives pads and strings a naturally imperfect, human feel.',                                  anim: 'drift'     },
  sub:      { title: 'Sub',            desc: 'Adds a sine-wave sub layer one octave below — thickens and grounds the low end.',                                                  anim: 'sub'       },
  width:    { title: 'Width',          desc: 'Stereo spread — pans layers across the field. Higher = wider, more immersive sound.',                                               anim: 'width'     },
  sweep:    { title: 'Sweep',          desc: 'Slow LFO that continuously modulates the filter cutoff — adds movement and life to pads and drones.',                              anim: 'sweep'     },
  strum:    { title: 'Strum',          desc: 'Stagger between chord notes (ms). 0 = all hit at once. Higher = slow guitar-style strum roll.',                                    anim: 'strum'     },
  humanize: { title: 'Humanize',       desc: 'Master randomness — scales velocity spread, timing jitter, and tuning drift at once. 0 = machine. 10 = organic human.',            anim: 'humanize'  },
  glide:    { title: 'Glide',          desc: 'Portamento — each voice slides from the nearest note in the previous chord into the new one.',                                      anim: 'glide'     },
  legato:   { title: 'Legato',         desc: 'Skip the attack swell on chord changes so notes connect smoothly without re-swelling. Great for strings and brass.',               anim: 'legato'    },
  mono:     { title: 'Mono',           desc: 'Hard-cut all playing notes before each new chord — only one chord sounds at a time.',                                              anim: 'mono'      },
  hold:     { title: 'Hold',           desc: 'Notes sustain indefinitely until Hold is switched off. Works like a sustain pedal.',                                                anim: 'hold'      },

  // ── Chord qualities ─────────────────────────────────────────────────────
  qual_maj:   { title: 'Major',              desc: 'Open, bright, resolved. Root + major 3rd (4 semi) + perfect 5th (7 semi). The foundational "happy" chord.',                 anim: 'chord_qual', qualKey: 'maj'   },
  qual_min:   { title: 'Minor',              desc: 'Warmer, more introspective. The 3rd is flattened by one semitone — creates a softer, melancholic quality.',                 anim: 'chord_qual', qualKey: 'min'   },
  qual_aug:   { title: 'Augmented',          desc: 'The 5th is raised one semitone. Dreamy, unresolved, floating. Neither major nor minor — ambiguous tension.',                anim: 'chord_qual', qualKey: 'aug'   },
  qual_sus4:  { title: 'Suspended 4th',      desc: 'The 3rd is replaced with a perfect 4th. No major/minor quality. Yearning, suspended — wants to resolve.',                   anim: 'chord_qual', qualKey: 'sus4'  },
  qual_dim:   { title: 'Diminished',         desc: 'Both 3rd and 5th are flattened. Tense, dissonant, unstable. Strongly wants to resolve — essential for drama.',              anim: 'chord_qual', qualKey: 'dim'   },
  qual_maj7:  { title: 'Major 7th',          desc: 'Major triad + major 7th (11 semi). Sophisticated, lush, jazz-inflected warmth. Very stable but harmonically rich.',         anim: 'chord_qual', qualKey: 'maj7'  },
  qual_min7:  { title: 'Minor 7th',          desc: 'Minor triad + minor 7th (10 semi). Soulful, mellow, deeply expressive. The backbone of soul, jazz, and R&B.',               anim: 'chord_qual', qualKey: 'min7'  },
  qual_augM7: { title: 'Augmented Maj 7th',  desc: 'Augmented triad + major 7th. Extremely exotic. Haunting, unresolved, chromatic tension. Rare in popular music.',            anim: 'chord_qual', qualKey: 'augM7' },
  qual_sus2:  { title: 'Suspended 2nd',      desc: 'The 3rd is replaced with a major 2nd. More open and airy than sus4. Very modern, ambient, spacious sound.',                 anim: 'chord_qual', qualKey: 'sus2'  },
  qual_dim7:  { title: 'Fully Diminished',   desc: 'All four notes a minor 3rd apart. Maximally tense and symmetrical — equal division of the octave. Appears in minor keys.', anim: 'chord_qual', qualKey: 'dim7'  },
  qual_add9:  { title: 'Add 9',              desc: 'Major triad with a 9th added (no 7th). Open, fresh, modern. More colorful than plain major, less complex than maj9.',       anim: 'chord_qual', qualKey: 'add9'  },
  qual_min9:  { title: 'Minor 9th',          desc: 'Minor 7th chord with added 9th. Rich, jazzy, deeply expressive. Common in neo-soul, jazz, and lo-fi productions.',         anim: 'chord_qual', qualKey: 'min9'  },
  qual_aug7:  { title: 'Augmented 7th',      desc: 'Augmented triad + dominant 7th. A jazz alteration chord — extreme tension that wants to resolve in unusual ways.',          anim: 'chord_qual', qualKey: 'aug7'  },
  'qual_7sus4':{ title: 'Dom 7th Suspended', desc: 'Dominant 7th + suspended 4th. Funky, unresolved groove. Common in funk and R&B; the suspension adds rhythmic energy.',     anim: 'chord_qual', qualKey: '7sus4' },
  qual_hdim7: { title: 'Half-Diminished',    desc: 'Diminished triad + minor 7th (ø7). The natural ii° in minor keys. Brooding, sophisticated, deeply expressive.',            anim: 'chord_qual', qualKey: 'hdim7' },

  // ── Chord functions (scale degree buttons) ───────────────────────────────
  chord_major:      { title: 'Major Chord',      desc: 'Bright, stable. As I it\'s home base. As IV it\'s warmth and movement. As V it\'s anticipation before resolution.', anim: 'chord_func', funcType: 'major'      },
  chord_minor:      { title: 'Minor Chord',       desc: 'Soft, introspective. As ii it drives to V. As iii it\'s a gentle passing chord. As vi it\'s the emotional home of the relative minor.', anim: 'chord_func', funcType: 'minor'  },
  chord_diminished: { title: 'Diminished Chord',  desc: 'Tense, unstable. Usually the VII° — a leading-tone chord sitting one half-step below the root. Resolves strongly back to I.', anim: 'chord_func', funcType: 'diminished' },
  chord_augmented:  { title: 'Augmented Chord',   desc: 'Floating, ambiguous. Rarely found naturally in a scale. Often used as a chromatic passing chord between stable chords.', anim: 'chord_func', funcType: 'augmented' },
  chord_dominant:   { title: 'Dominant Chord',    desc: 'Maximum tension. The V7 — the engine of all tonal music. Creates an overwhelming pull back to I. Essential in every genre.', anim: 'chord_func', funcType: 'dominant' },
  chord_default:    { title: 'Chord',             desc: 'A chord built on this scale degree. Each degree has a unique quality and function in the harmony.', anim: 'chord_func', funcType: 'major' },

  // ── Scales ──────────────────────────────────────────────────────────────
  scale_Ionian:     { title: 'Ionian (Major)',     desc: 'The brightest, most common scale in Western music. Fully resolved — all chords gravitate toward I. Uplifting, clear, classic.', anim: 'scale_mode', mode: 'Ionian'     },
  scale_Dorian:     { title: 'Dorian Minor',       desc: 'Minor scale with a raised 6th. Cooler and jazzier than natural minor. Melancholic but with a glimmer of hope. Think Miles Davis.', anim: 'scale_mode', mode: 'Dorian'  },
  scale_Phrygian:   { title: 'Phrygian',           desc: 'Dark, exotic, Spanish-sounding. The flat 2nd creates dramatic tension. Heavy, mysterious, flamenco and metal favorite.',           anim: 'scale_mode', mode: 'Phrygian'  },
  scale_Lydian:     { title: 'Lydian',              desc: 'Major scale with a raised 4th. Dreamy, floating, otherworldly. The #4 creates a sense of wonder. John Williams film scores.',    anim: 'scale_mode', mode: 'Lydian'    },
  scale_Mixolydian: { title: 'Mixolydian',          desc: 'Major scale with a flat 7th. Bluesy rock feel — major but with an unresolved edge. Common in rock, blues, and Celtic music.',    anim: 'scale_mode', mode: 'Mixolydian'},
  scale_Aeolian:    { title: 'Aeolian (Minor)',     desc: 'The natural minor scale. Introspective, melancholic, expressive. The most common minor mode in popular music worldwide.',          anim: 'scale_mode', mode: 'Aeolian'   },
  scale_Locrian:    { title: 'Locrian',             desc: 'The most dissonant mode. The tonic chord is diminished so it never truly rests. Experimental, dark, unstable — rarely used as a home key.', anim: 'scale_mode', mode: 'Locrian' },
};

// ── HiDPI canvas setup ────────────────────────────────────────────────────
function setupHiDPI(canvas, cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, W: cssW, H: cssH };
}

// ── Drawing utilities ─────────────────────────────────────────────────────
function drawGrid(ctx, W, H) {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 0.5;
  for (let x = 0; x <= W; x += W / 6)
    { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += H / 3)
    { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function sine(ctx, x0, x1, midY, amp, cycles, color, lw = 1.5) {
  if (x1 <= x0 || Math.abs(amp) < 0.5) return;
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw;
  for (let x = x0; x <= x1; x++) {
    const y = midY + amp * Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 2 * cycles);
    if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function sineScroll(ctx, W, H, midY, amp, cycles, color, offset) {
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x++) {
    const y = midY + amp * Math.sin(((x + offset) / W) * Math.PI * 2 * cycles);
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function freqResponse(ctx, W, H, cutX, peakAmt, color) {
  const midY = H * 0.28;
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x++) {
    let y = midY;
    if (x >= cutX) {
      const r = (x - cutX) / Math.max(1, W - cutX);
      y = midY + H * 0.58 * r * r;
    }
    if (Math.abs(x - cutX) < W * 0.09)
      y -= peakAmt * H * 0.42 * Math.max(0, 1 - (Math.abs(x - cutX) / (W * 0.09)) ** 2);
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = color.replace(')',',0.07)').replace('rgb(','rgba(').replace('#22c55e','rgba(34,197,94,0.07)');
  ctx.fill();
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  for (let x = 0; x <= W; x++) {
    let y = midY;
    if (x >= cutX) {
      const r = (x - cutX) / Math.max(1, W - cutX);
      y = midY + H * 0.58 * r * r;
    }
    if (Math.abs(x - cutX) < W * 0.09)
      y -= peakAmt * H * 0.42 * Math.max(0, 1 - (Math.abs(x - cutX) / (W * 0.09)) ** 2);
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('freq →', W - 38, H - 3);
}

// ── Chord interval diagram ────────────────────────────────────────────────
// Draws a piano-roll style 12-semitone row with colored dots on chord tones
function drawChordIntervals(ctx, W, H, semitones, rgb) {
  const total     = 12;
  const cellW     = W / total;
  const yDot      = H * 0.55;
  const noteNames = ['C','','D','','E','F','','G','','A','','B'];
  const isBlack   = [0,1,0,1,0,0,1,0,1,0,1,0];

  // Background cells
  for (let i = 0; i < total; i++) {
    const x = i * cellW;
    ctx.fillStyle = isBlack[i] ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(x, H * 0.32, cellW - 0.5, H * 0.42);
    // Note name
    if (!isBlack[i]) {
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.font = '6px DM Mono,monospace';
      ctx.fillText(noteNames[i], x + cellW * 0.18, H * 0.84);
    }
  }

  // Interval lines between chord tones
  const validSemi = semitones.filter(s => s >= 0 && s <= 11);
  ctx.strokeStyle = `rgba(${rgb},0.30)`;
  ctx.lineWidth   = 1;
  ctx.setLineDash([2, 2]);
  for (let i = 0; i < validSemi.length - 1; i++) {
    const x1 = (validSemi[i]     + 0.5) * cellW;
    const x2 = (validSemi[i + 1] + 0.5) * cellW;
    ctx.beginPath();
    ctx.moveTo(x1, yDot);
    ctx.lineTo(x2, yDot);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Chord tone dots
  semitones.forEach((s, idx) => {
    if (s < 0 || s > 11) return;
    const x     = (s + 0.5) * cellW;
    const r     = idx === 0 ? 6 : 4.5;
    const alpha = idx === 0 ? 1.0 : 0.80;
    // Outer glow
    ctx.beginPath(); ctx.arc(x, yDot, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},0.18)`; ctx.fill();
    // Dot
    ctx.beginPath(); ctx.arc(x, yDot, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${alpha})`; ctx.fill();
    // Inner shine
    ctx.beginPath(); ctx.arc(x - r * 0.25, yDot - r * 0.28, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,0.35)`; ctx.fill();
    // Interval name above root
    const labels = ['R','♭2','2','♭3','3','4','♭5','5','♭6','6','♭7','7'];
    ctx.fillStyle = `rgba(${rgb},0.75)`;
    ctx.font = `bold 7px DM Mono,monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(labels[s], x, yDot - r - 4);
    ctx.textAlign = 'left';
  });
}

// ── Scale pattern diagram ─────────────────────────────────────────────────
function drawScalePattern(ctx, W, H, intervals, charDeg) {
  const total  = 12;
  const cellW  = W / total;
  const yDot   = H * 0.50;
  const isBlk  = [0,1,0,1,0,0,1,0,1,0,1,0];
  const names  = ['C','','D','','E','F','','G','','A','','B'];
  const scaleSet = new Set(intervals);

  // Background cells
  for (let i = 0; i < total; i++) {
    const x = i * cellW;
    ctx.fillStyle = isBlk[i] ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, H * 0.28, cellW - 0.5, H * 0.50);
    if (!isBlk[i]) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '6px DM Mono,monospace';
      ctx.fillText(names[i], x + cellW * 0.15, H * 0.86);
    }
  }

  // Step pattern line
  ctx.strokeStyle = 'rgba(34,197,94,0.18)';
  ctx.lineWidth   = 0.5;
  let prevX = null;
  for (const s of intervals) {
    const x = (s + 0.5) * cellW;
    if (prevX !== null) {
      ctx.beginPath(); ctx.moveTo(prevX, yDot); ctx.lineTo(x, yDot); ctx.stroke();
    }
    prevX = x;
  }

  // Dots
  for (let i = 0; i < 12; i++) {
    const x = (i + 0.5) * cellW;
    if (!scaleSet.has(i)) {
      // Non-scale dot (very faint)
      ctx.beginPath(); ctx.arc(x, yDot, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    } else {
      const degIdx    = intervals.indexOf(i);
      const isChar    = degIdx !== -1 && charDeg !== null && i === intervals[charDeg];
      const isRoot    = i === 0;
      const r         = isRoot ? 6 : (isChar ? 5.5 : 4);
      const rgb       = isRoot ? '34,197,94' : (isChar ? '251,191,36' : '34,197,94');
      const alpha     = isRoot ? 1.0 : (isChar ? 0.90 : 0.55);
      ctx.beginPath(); ctx.arc(x, yDot, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},0.12)`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, yDot, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${alpha})`; ctx.fill();
      if (isChar) {
        ctx.fillStyle = 'rgba(251,191,36,0.80)';
        ctx.font      = 'bold 7px DM Mono,monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★', x, yDot - r - 3);
        ctx.textAlign = 'left';
      }
    }
  }

  // Semitone step labels below
  const stepLabels = [];
  for (let i = 0; i < intervals.length - 1; i++) {
    const gap  = intervals[i + 1] - intervals[i];
    const midX = ((intervals[i] + intervals[i + 1]) / 2 + 0.5) * cellW;
    ctx.fillStyle = gap === 2 ? 'rgba(34,197,94,0.55)' : 'rgba(255,255,255,0.35)';
    ctx.font = '6px DM Mono,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(gap === 2 ? 'W' : 'H', midX, H * 0.24);
    ctx.textAlign = 'left';
  }
}

// ── Chord function arc ────────────────────────────────────────────────────
function drawChordFunctionArc(ctx, W, H, funcType) {
  // Show the tension/resolution arc for each chord function
  const midX = W / 2, midY = H * 0.62, radius = H * 0.34;
  const funcs = {
    major:      { tension: 0.05, stability: 1.00, color: '34,197,94',   label: 'Stable / Home'    },
    minor:      { tension: 0.20, stability: 0.75, color: '202,138,4',   label: 'Soft / Lyrical'   },
    diminished: { tension: 0.95, stability: 0.05, color: '249,115,22',  label: 'Tense / Leading'  },
    augmented:  { tension: 0.60, stability: 0.25, color: '168,85,247',  label: 'Float / Ambiguous' },
    dominant:   { tension: 0.90, stability: 0.10, color: '251,146,60',  label: 'Drive / Resolve'  },
  };
  const f = funcs[funcType] || funcs.major;

  // Tension arc (left = 0 tension, right = full tension)
  const arcStart = Math.PI + Math.PI * 0.15;
  const arcEnd   = Math.PI * 2 - Math.PI * 0.15;
  const arcRange = arcEnd - arcStart;
  const tensAng  = arcStart + arcRange * f.tension;
  const stabAng  = arcStart + arcRange * (1 - f.stability);

  // Track
  ctx.beginPath();
  ctx.arc(midX, midY, radius, arcStart, arcEnd);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 5; ctx.stroke();

  // Tension fill
  ctx.beginPath();
  ctx.arc(midX, midY, radius, arcStart, tensAng);
  ctx.strokeStyle = `rgba(${f.color},0.80)`; ctx.lineWidth = 5; ctx.stroke();

  // Needle dot
  const nx = midX + radius * Math.cos(tensAng);
  const ny = midY + radius * Math.sin(tensAng);
  ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${f.color},1.0)`; ctx.fill();
  ctx.beginPath(); ctx.arc(nx, ny, 8, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${f.color},0.25)`; ctx.fill();

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.font = '6.5px DM Mono,monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STABLE', midX - radius * 0.82, midY + 14);
  ctx.fillText('TENSE',  midX + radius * 0.82, midY + 14);
  ctx.fillStyle = `rgba(${f.color},0.85)`;
  ctx.font = 'bold 8px DM Mono,monospace';
  ctx.fillText(f.label, midX, midY - radius * 0.4);
  ctx.textAlign = 'left';
}

// ── Synth control animations ──────────────────────────────────────────────

function animVolume(ctx, W, H, t) {
  const amp = 0.28 + 0.62 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
  sineScroll(ctx, W, H, H / 2, amp * H * 0.5, 3, '#22c55e', 0);
  ctx.fillStyle = 'rgba(34,197,94,0.50)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('amplitude', 6, H - 4);
}

function animOctave(ctx, W, H, t) {
  const shift = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
  const y1 = H * (0.28 + 0.08 * shift);
  const y2 = H * (0.70 - 0.08 * shift);
  sineScroll(ctx, W, H, y1, H * 0.12, 1, 'rgba(34,197,94,0.50)', 0);
  sineScroll(ctx, W, H, y2, H * 0.12, 2, '#22c55e', 0);
  ctx.fillStyle = 'rgba(34,197,94,0.50)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('C5', 4, y1 - 6); ctx.fillText('C4', 4, y2 - 6);
  ctx.strokeStyle = 'rgba(34,197,94,0.25)'; ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 3]);
  const ax = W * 0.78;
  ctx.beginPath(); ctx.moveTo(ax, y2 - 6); ctx.lineTo(ax, y1 + 6); ctx.stroke();
  ctx.setLineDash([]);
}

function animEnvelope(ctx, W, H, segKey, t) {
  const pad = 8, bot = H - 10, top = 14;
  const atkX = pad + W * 0.14, dcyX = pad + W * 0.28;
  const susXE = pad + W * 0.64, relX = pad + W * 0.80, endX = W - pad;
  const susY   = top + (bot - top) * 0.42;
  const animSusY = segKey === 'env_sus'
    ? top + (bot - top) * (0.18 + 0.68 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2)))
    : susY;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(pad, bot); ctx.lineTo(endX, bot); ctx.stroke();

  // Shape fill
  ctx.beginPath();
  ctx.moveTo(pad, bot); ctx.lineTo(atkX, top);
  ctx.lineTo(dcyX, animSusY); ctx.lineTo(susXE, animSusY);
  ctx.lineTo(relX, bot); ctx.lineTo(endX, bot); ctx.closePath();
  ctx.fillStyle = 'rgba(34,197,94,0.06)'; ctx.fill();

  const hi = '#22c55e', lo = 'rgba(34,197,94,0.42)';
  const segs = [
    { key:'env_atk', x0:pad,   y0:bot,      x1:atkX,  y1:top },
    { key:'env_dcy', x0:atkX,  y0:top,      x1:dcyX,  y1:animSusY },
    { key:'env_sus', x0:dcyX,  y0:animSusY, x1:susXE, y1:animSusY },
    { key:'env_rel', x0:susXE, y0:animSusY, x1:relX,  y1:bot },
  ];

  let dotX, dotY;
  for (const s of segs) {
    const active = s.key === segKey;
    ctx.strokeStyle = active ? hi : lo; ctx.lineWidth = active ? 2.5 : 1.2;
    ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
    if (active) {
      const p = (t + 0.5) % 1;
      dotX = s.x0 + (s.x1 - s.x0) * p; dotY = s.y0 + (s.y1 - s.y0) * p;
    }
  }
  ctx.strokeStyle = lo; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(relX, bot); ctx.lineTo(endX, bot); ctx.stroke();

  // Labels
  ctx.font = '7px DM Mono,monospace'; ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.fillText('A', atkX-4, H-2); ctx.fillText('D', dcyX-4, H-2);
  ctx.fillText('S', (dcyX+susXE)/2-3, H-2); ctx.fillText('R', relX-4, H-2);

  // Dot
  if (dotX !== undefined) {
    ctx.beginPath(); ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34,197,94,0.22)'; ctx.fill();
    ctx.beginPath(); ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = hi; ctx.fill();
  }
}

function animCutoff(ctx, W, H, t) {
  const cutX = W * (0.22 + 0.56 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2)));
  freqResponse(ctx, W, H, cutX, 0, '#22c55e');
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(cutX, 0); ctx.lineTo(cutX, H * 0.92); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(245,158,11,0.65)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('cutoff', cutX + 3, 12);
}

function animResonance(ctx, W, H, t) {
  const peak = 0.40 + 0.56 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
  freqResponse(ctx, W, H, W * 0.52, peak, '#22c55e');
  ctx.fillStyle = 'rgba(34,197,94,0.50)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('resonant peak', W * 0.28, 10);
}

function animWarmth(ctx, W, H, t) {
  const det = 0.8 + 2.4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
  sineScroll(ctx, W, H, H/2, H*0.28, 2, 'rgba(34,197,94,0.55)', 0);
  sineScroll(ctx, W, H, H/2, H*0.28, 2 + det*0.008, 'rgba(167,139,250,0.70)', 0);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('detuned layers beating', 6, H - 4);
}

function animReverb(ctx, W, H, t) {
  const tailLen = 0.28 + 0.67 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
  const midY = H * 0.52;
  ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W*0.07, midY);
  ctx.lineTo(W*0.07, midY - H*0.36); ctx.lineTo(W*0.14, midY); ctx.stroke();
  const tEnd = W * (0.14 + tailLen * 0.82);
  ctx.beginPath(); ctx.strokeStyle = 'rgba(34,197,94,0.72)'; ctx.lineWidth = 1;
  for (let x = W*0.14; x < tEnd; x++) {
    const p = (x - W*0.14) / Math.max(1, tEnd - W*0.14);
    const amp = (1 - p) * H * 0.30 * Math.sin(p * 70) * Math.exp(-p * 4);
    if (x === Math.ceil(W*0.14)) ctx.moveTo(x, midY - amp);
    else ctx.lineTo(x, midY - amp);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('room tail →', W*0.16, H - 4);
}

function animDrive(ctx, W, H, t) {
  const clip = 0.08 + 0.88 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
  const clipAmt = Math.max(0.04, 1 - clip * 0.70);
  ctx.beginPath(); ctx.strokeStyle = 'rgba(34,197,94,0.28)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x++) {
    const y = H/2 + H*0.38*Math.sin((x/W)*Math.PI*4);
    if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.beginPath(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5;
  for (let x = 0; x < W; x++) {
    const raw = Math.sin((x/W)*Math.PI*4);
    const clipped = Math.tanh(raw / clipAmt) * clipAmt;
    const y = H/2 + H*0.38*clipped;
    if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(245,158,11,0.55)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('saturated', W-56, H-4);
}

function animDrift(ctx, W, H, t) {
  const colors = ['rgba(34,197,94,0.78)','rgba(167,139,250,0.65)','rgba(96,165,250,0.55)'];
  for (let i = 0; i < 3; i++) {
    const fm = 2 + 0.14 * Math.sin(t*Math.PI*2 + i*1.1);
    sineScroll(ctx, W, H, H/2, H*0.26, fm, colors[i], i * W * 0.08);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('layers slowly wandering', 6, H-4);
}

function animSub(ctx, W, H, t) {
  const sv = 0.45 + 0.50 * (0.5 + 0.5 * Math.sin(t*Math.PI*2));
  sineScroll(ctx, W, H, H*0.32, H*0.15, 2, '#22c55e', 0);
  sineScroll(ctx, W, H, H*0.70, H*0.14*sv, 1, 'rgba(167,139,250,0.80)', 0);
  ctx.fillStyle = 'rgba(34,197,94,0.50)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('main', 4, H*0.32-8);
  ctx.fillStyle = 'rgba(167,139,250,0.60)';
  ctx.fillText('sub -1 oct', 4, H*0.70-8);
}

function animWidth(ctx, W, H, t) {
  const sp = 0.5 + 0.5 * Math.sin(t*Math.PI*2);
  const off = sp * H * 0.22;
  sineScroll(ctx, W, H, H/2 - off, H*0.15, 2, 'rgba(34,197,94,0.80)', 0);
  sineScroll(ctx, W, H, H/2 + off, H*0.15, 2, 'rgba(96,165,250,0.75)', 0);
  ctx.fillStyle = 'rgba(34,197,94,0.55)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('L', 4, H/2 - off - 6);
  ctx.fillStyle = 'rgba(96,165,250,0.60)';
  ctx.fillText('R', 4, H/2 + off + 13);
}

function animSweep(ctx, W, H, t) {
  const cutX = W * (0.18 + 0.62 * (0.5 + 0.5 * Math.sin(t*Math.PI*2)));
  freqResponse(ctx, W, H, cutX, 0, '#22c55e');
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(cutX, 0); ctx.lineTo(cutX, H*0.92); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(167,139,250,0.42)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    const y = H * 0.06 * (0.5 + 0.5 * Math.sin((x/W + t)*Math.PI*4));
    if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(167,139,250,0.55)'; ctx.font = '7px DM Mono,monospace';
  ctx.fillText('LFO', 4, 12);
}

function animStrum(ctx, W, H, t) {
  const n=5, bW=14, gap=(W-bW*n)/(n+1), maxH=H*0.62, cycle=(t*1.4)%1;
  for (let i=0; i<n; i++) {
    const x=gap+i*(bW+gap), delay=i/n;
    const local=((cycle-delay+1)%1), bH=maxH*Math.max(0,1-local*2.2);
    const a=bH/maxH;
    ctx.fillStyle=`rgba(34,197,94,${0.15+a*0.80})`; ctx.strokeStyle=`rgba(34,197,94,${0.30+a*0.55})`; ctx.lineWidth=0.5;
    ctx.fillRect(x,H-10-bH,bW,bH); ctx.strokeRect(x,H-10-bH,bW,bH);
  }
  ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='7px DM Mono,monospace';
  ctx.fillText('notes cascade →', 6, H-2);
}

function animHumanize(ctx, W, H, t) {
  const n=8, bW=(W-20)/n-3, bases=[0.72,0.88,0.60,0.94,0.78,0.66,0.82,0.72];
  const jitter=0.5+0.5*Math.sin(t*Math.PI*2);
  for (let i=0; i<n; i++) {
    const jAmt=Math.sin(t*13.1+i*2.9)*0.28*jitter;
    const bH=H*0.62*Math.max(0.06,bases[i]+jAmt), x=10+i*(bW+3);
    ctx.fillStyle=`rgba(167,139,250,${0.42+0.42*jitter})`;
    ctx.fillRect(x,H-10-bH,bW,bH);
  }
  ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='7px DM Mono,monospace';
  ctx.fillText('velocity jitter', 6, 12);
}

function animGlide(ctx, W, H, t) {
  const yHi=H*0.24, yLo=H*0.72, gX=W*0.34, gW=W*0.32, p=(t*1.2)%1;
  ctx.strokeStyle='rgba(34,197,94,0.38)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(0,yLo); ctx.lineTo(gX,yLo); ctx.stroke();
  ctx.strokeStyle='#22c55e'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(gX,yLo);
  for (let x=0; x<gW; x++) {
    const pp=x/gW, y=yLo+(yHi-yLo)*(1-Math.pow(1-pp,3));
    ctx.lineTo(gX+x,y);
  }
  ctx.stroke();
  ctx.strokeStyle='rgba(34,197,94,0.38)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(gX+gW,yHi); ctx.lineTo(W,yHi); ctx.stroke();
  let dotX,dotY;
  if (p<0.30)      { const pp=p/0.30;          dotX=gX*pp;             dotY=yLo; }
  else if (p<0.70) { const pp=(p-0.30)/0.40;    dotX=gX+gW*pp;          dotY=yLo+(yHi-yLo)*(1-Math.pow(1-pp,3)); }
  else             { const pp=(p-0.70)/0.30;    dotX=gX+gW+(W-gX-gW)*pp; dotY=yHi; }
  ctx.beginPath(); ctx.arc(dotX,dotY,5,0,Math.PI*2); ctx.fillStyle='rgba(34,197,94,0.22)'; ctx.fill();
  ctx.beginPath(); ctx.arc(dotX,dotY,2.5,0,Math.PI*2); ctx.fillStyle='#22c55e'; ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.font='7px DM Mono,monospace';
  ctx.fillText('hi',4,yHi-4); ctx.fillText('lo',4,yLo-4);
}

function animLegato(ctx, W, H, t) {
  const midY=H/2, c1x=W*0.06, c2x=W*0.52, phase=(t*0.9)%1;
  ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.font='7px DM Mono,monospace';
  ctx.fillText('chord 1', c1x+2, 10); ctx.fillText('chord 2 (legato)', c2x+2, 10);
  const a1=Math.min(1,phase*4), e1=Math.max(0,1-(phase-0.28)*2.5);
  sine(ctx, c1x, c2x-8, midY, H*0.30*a1*e1, 2, 'rgba(34,197,94,0.65)');
  const p2=Math.max(0,phase-0.50), a2=Math.min(1,p2*30);
  sine(ctx, c2x, W-6, midY, H*0.25*a2, 2, '#22c55e');
}

function animMono(ctx, W, H, t) {
  const midY=H/2, cutX=W*(0.33+0.16*Math.sin(t*Math.PI*2));
  sine(ctx, 8, cutX, midY, H*0.28, 2, 'rgba(34,197,94,0.70)');
  ctx.strokeStyle='#f87171'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(cutX,H*0.10); ctx.lineTo(cutX,H*0.90); ctx.stroke();
  sine(ctx, cutX, W-8, midY, H*0.28, 2.4, 'rgba(96,165,250,0.80)');
  ctx.fillStyle='rgba(248,113,113,0.65)'; ctx.font='7px DM Mono,monospace';
  ctx.fillText('cut', cutX+3, H*0.12);
}

function animHold(ctx, W, H, t) {
  const midY=H/2, holdX=W*(0.15+0.72*(t%1));
  sine(ctx, 8, holdX, midY, H*0.28, 3, '#22c55e');
  if (holdX<W-10) {
    ctx.strokeStyle='rgba(34,197,94,0.35)'; ctx.lineWidth=1; ctx.setLineDash([2,4]);
    ctx.beginPath(); ctx.moveTo(holdX,midY); ctx.lineTo(W-8,midY); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle='rgba(34,197,94,0.55)'; ctx.font='9px DM Mono,monospace';
  ctx.fillText('∞', W-18, midY-6);
}

// ── Main animation dispatcher ─────────────────────────────────────────────
const CSS_W = 218, CSS_H = 76;

function drawInfoAnim(canvas, animKey, data, t) {
  const { ctx, W, H } = setupHiDPI(canvas, CSS_W, CSS_H);

  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, W, H);
  drawGrid(ctx, W, H);

  switch (animKey) {
    case 'volume':    animVolume    (ctx, W, H, t); break;
    case 'octave':    animOctave    (ctx, W, H, t); break;
    case 'env_atk':   animEnvelope  (ctx, W, H, 'env_atk', t); break;
    case 'env_dcy':   animEnvelope  (ctx, W, H, 'env_dcy', t); break;
    case 'env_sus':   animEnvelope  (ctx, W, H, 'env_sus', t); break;
    case 'env_rel':   animEnvelope  (ctx, W, H, 'env_rel', t); break;
    case 'cutoff':    animCutoff    (ctx, W, H, t); break;
    case 'resonance': animResonance (ctx, W, H, t); break;
    case 'warmth':    animWarmth    (ctx, W, H, t); break;
    case 'reverb':    animReverb    (ctx, W, H, t); break;
    case 'drive':     animDrive     (ctx, W, H, t); break;
    case 'drift':     animDrift     (ctx, W, H, t); break;
    case 'sub':       animSub       (ctx, W, H, t); break;
    case 'width':     animWidth     (ctx, W, H, t); break;
    case 'sweep':     animSweep     (ctx, W, H, t); break;
    case 'strum':     animStrum     (ctx, W, H, t); break;
    case 'humanize':  animHumanize  (ctx, W, H, t); break;
    case 'glide':     animGlide     (ctx, W, H, t); break;
    case 'legato':    animLegato    (ctx, W, H, t); break;
    case 'mono':      animMono      (ctx, W, H, t); break;
    case 'hold':      animHold      (ctx, W, H, t); break;

    case 'chord_qual': {
      const key  = data.qualKey;
      const semi = QUAL_INTERVALS[key] || [0, 4, 7];
      const fam  = QUAL_FAMILY[key] || 'maj';
      const rgb  = QUAL_COLORS[fam] || QUAL_COLORS.maj;
      // Animate dots pulsing in with strum timing
      const pulse = 0.85 + 0.15 * Math.sin(t * Math.PI * 2);
      const animSemi = semi.map((s, i) => {
        const off = i / semi.length;
        const visible = ((t * 1.5 + off) % 1.5) > off ? 1 : 0;
        return s;
      });
      drawChordIntervals(ctx, W, H, semi, rgb);
      // Pulsing glow on all dots
      const glowAlpha = 0.08 + 0.10 * Math.sin(t * Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${glowAlpha})`;
      ctx.fillRect(0, 0, W, H);
      break;
    }

    case 'chord_func': {
      drawChordFunctionArc(ctx, W, H, data.funcType || 'major');
      break;
    }

    case 'scale_mode': {
      const mode = data.mode || 'Ionian';
      const ivl  = SCALE_INTERVALS[mode] || SCALE_INTERVALS.Ionian;
      const char = SCALE_CHAR_DEGREE[mode] ?? null;
      drawScalePattern(ctx, W, H, ivl, char);
      break;
    }
  }
}

// ── Tooltip creation ──────────────────────────────────────────────────────
function buildContextBlock(anchor, data) {
  // For chord degree keys: show the chord name + roman numeral
  const chordName  = anchor.dataset.chordName;
  const chordRoman = anchor.dataset.chordRoman;
  const chordMood  = anchor.dataset.chordMood;
  if (!chordName && !chordRoman) return '';
  const parts = [chordRoman, chordName, chordMood].filter(Boolean);
  return `<div class="info-tip-context">${parts.join(' · ')}</div>`;
}

function createTooltip(key, anchorEl) {
  const data = INFO_DATA[key];
  if (!data) return null;

  const tip = document.createElement('div');
  tip.className = 'info-tip';
  tip.innerHTML = `
    <div class="info-tip-header">
      <span class="info-tip-title">${data.title}</span>
      <div class="info-tip-actions">
        <button class="info-tip-pin" title="Pin">⚲</button>
        <button class="info-tip-close" title="Close">✕</button>
      </div>
    </div>
    ${buildContextBlock(anchorEl, data)}
    <canvas class="info-tip-canvas" style="width:${CSS_W}px;height:${CSS_H}px"></canvas>
    <div class="info-tip-desc">${data.desc}</div>
  `;
  document.body.appendChild(tip);
  positionTooltip(tip, anchorEl);

  // HiDPI canvas init + animation loop
  const canvas    = tip.querySelector('.info-tip-canvas');
  const startTime = performance.now();
  let frame       = null;

  function animate() {
    if (!document.body.contains(tip)) { cancelAnimationFrame(frame); return; }
    const phase = ((performance.now() - startTime) / 1000 * 0.36) % 1;
    drawInfoAnim(canvas, data.anim, data, phase);
    frame = requestAnimationFrame(animate);
  }
  animate();

  // Pin
  tip.querySelector('.info-tip-pin').addEventListener('click', e => {
    e.stopPropagation();
    tip.classList.add('info-tip-pinned');
    tip.querySelector('.info-tip-pin').style.display = 'none';
    pinnedTooltips.push({ el: tip, frame });
    if (activeTooltip && activeTooltip.el === tip) activeTooltip = null;
  });

  // Close
  tip.querySelector('.info-tip-close').addEventListener('click', e => {
    e.stopPropagation();
    cancelAnimationFrame(frame);
    tip.remove();
    const idx = pinnedTooltips.findIndex(p => p.el === tip);
    if (idx >= 0) pinnedTooltips.splice(idx, 1);
    if (activeTooltip && activeTooltip.el === tip) activeTooltip = null;
  });

  return { el: tip, frame };
}

function positionTooltip(tip, anchor) {
  const rect = anchor.getBoundingClientRect();
  const TW = 240, TH = 190;
  let left = rect.right + 14;
  let top  = rect.top  - 24;
  if (left + TW > window.innerWidth  - 10) left = rect.left - TW - 14;
  if (left < 8) left = 8;
  if (top + TH > window.innerHeight  - 10) top = window.innerHeight - TH - 10;
  if (top < 8) top = 8;
  tip.style.left = left + 'px';
  tip.style.top  = top  + 'px';
}

function closeActiveTooltip() {
  if (!activeTooltip) return;
  cancelAnimationFrame(activeTooltip.frame);
  activeTooltip.el.remove();
  activeTooltip = null;
}

// ── Info mode toggle ──────────────────────────────────────────────────────
function toggleInfoMode() {
  infoModeActive = !infoModeActive;
  document.body.classList.toggle('info-mode-active', infoModeActive);
  const btn = document.getElementById('infoModeBtn');
  if (btn) {
    btn.classList.toggle('info-btn-active', infoModeActive);
    btn.title = infoModeActive ? 'Exit info mode' : 'What does each control do?';
  }
  if (!infoModeActive) closeActiveTooltip();
}

// ── Hover logic ───────────────────────────────────────────────────────────
document.addEventListener('mouseover', e => {
  if (!infoModeActive) return;
  if (e.target.closest('.info-tip')) return;
  const target = e.target.closest('[data-info]');
  if (!target || target === hoveredEl) return;
  hoveredEl = target;
  clearTimeout(hoverTimeout);
  hoverTimeout = setTimeout(() => {
    closeActiveTooltip();
    activeTooltip = createTooltip(target.dataset.info, target);
  }, 100);
});

document.addEventListener('mouseout', e => {
  if (!infoModeActive) return;
  const target = e.target.closest('[data-info]');
  if (!target) return;
  hoveredEl = null;
  clearTimeout(hoverTimeout);
  if (e.relatedTarget && e.relatedTarget.closest('.info-tip')) return;
  setTimeout(() => { if (!hoveredEl) closeActiveTooltip(); }, 160);
});

document.addEventListener('mouseover', e => {
  if (e.target.closest('.info-tip:not(.info-tip-pinned)')) clearTimeout(hoverTimeout);
});

document.addEventListener('mouseout', e => {
  const tip = e.target.closest('.info-tip');
  if (!tip || tip.classList.contains('info-tip-pinned')) return;
  if (e.relatedTarget && e.relatedTarget.closest('[data-info]')) return;
  setTimeout(() => { if (!hoveredEl) closeActiveTooltip(); }, 160);
});
