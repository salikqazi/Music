// ════════════════════════════════════════════════════════
//  MUSIC THEORY
// ════════════════════════════════════════════════════════

const NOTES        = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const MODES        = ['Ionian','Dorian','Phrygian','Lydian','Mixolydian','Aeolian','Locrian'];
const CIRCLE_ORDER = ['C','G','D','A','E','B','F#','C#','G#','D#','A#','F'];

const MODE_INTERVALS = {
  Ionian:      [0,2,4,5,7,9,11],
  Dorian:      [0,2,3,5,7,9,10],
  Phrygian:    [0,1,3,5,7,8,10],
  Lydian:      [0,2,4,6,7,9,11],
  Mixolydian:  [0,2,4,5,7,9,10],
  Aeolian:     [0,2,3,5,7,8,10],
  Locrian:     [0,1,3,5,6,8,10],
};

const CHORD_QUALITIES = {
  Ionian:      ['major','minor','minor','major','major','minor','diminished'],
  Dorian:      ['minor','minor','major','major','minor','diminished','major'],
  Phrygian:    ['minor','major','major','minor','diminished','major','minor'],
  Lydian:      ['major','major','minor','diminished','major','minor','minor'],
  Mixolydian:  ['major','minor','diminished','major','minor','minor','major'],
  Aeolian:     ['minor','diminished','major','minor','minor','major','major'],
  Locrian:     ['diminished','major','minor','minor','major','major','minor'],
};

// 4 dedicated extension keys (9 0 - =)
// Tab + scale keys 1-7 gives all 7 diatonic 7ths without needing dedicated slots
const EXTENSION_CONFIGS = [
  {degree:4, extra:['7th'], suffix:'7',    quality:'dominant'}, // V7  — most used
  {degree:0, extra:['7th'], suffix:'maj7', quality:'major'},    // Imaj7
  {degree:3, extra:['9th'], suffix:'add9', quality:'major'},    // IVadd9
  {degree:1, extra:['7th'], suffix:'m7',   quality:'minor'},    // IIm7
];

// Extensions that sound natural for each chord quality (amber-highlighted in voice editor)
// Keys match EXT_ORDER: ['b7','7','b9','9','#9','#11','b13','13']
const NATURAL_EXTENSIONS = {
  major:      ['7', '9', '#11', '13'],
  minor:      ['b7', 'b9', '9', 'b13'],
  dominant:   ['b7', 'b9', '9', '#9', '#11', '13', 'b13'],
  diminished: ['b7', 'b9'],
  augmented:  ['7', 'b7'],
  default:    ['b7', '9'],
};

const KEY_SHORTCUTS = ['1','2','3','4','q','w','e','r','a','s','d','f'];

function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

// Semitones down from the current root to its parent Ionian (relative-major) root
const MODE_IONIAN_OFFSET = {
  Ionian: 0, Dorian: 2, Phrygian: 4, Lydian: 5,
  Mixolydian: 7, Aeolian: 9, Locrian: 11,
};

function getRelatives(rootNote, modeName) {
  const rootIdx    = NOTES.indexOf(rootNote);
  const offset     = MODE_IONIAN_OFFSET[modeName] ?? 0;
  const majRootIdx = (rootIdx - offset + 12) % 12;
  const minRootIdx = (majRootIdx + 9) % 12;
  return { major: NOTES[majRootIdx], minor: NOTES[minRootIdx] };
}

function getRoman(deg, quality) {
  const r = ['I','II','III','IV','V','VI','VII'][deg];
  if (quality === 'minor')      return r.toLowerCase();
  if (quality === 'diminished') return r.toLowerCase() + '°';
  if (quality === 'augmented')  return r + '+';
  return r;
}

function qualityClass(q) {
  const map = {major:'major', minor:'minor', diminished:'dim',
               augmented:'aug', dominant:'dominant'};
  return 'q-' + (map[q] || 'default');
}

function getChordFreqs(rootNoteIdx, modeName, chordDeg, octave, voicing, extraTones=[]) {
  const ivl   = MODE_INTERVALS[modeName];
  const scale = deg => (rootNoteIdx + ivl[((deg % 7) + 7) % 7]) % 12;
  // Anchor the chord root to the chosen octave, then place each successive
  // tone in the nearest chromatic position strictly above the previous one.
  // This prevents wrap-around notes (e.g. the 5th of G = D=2 < G=7) from
  // landing an octave too low, which made the I chord sound higher than rest.
  const chordRootNote = scale(chordDeg);
  let prevMidi = 12 * octave + chordRootNote - 1; // one below root
  const midiNotes = [];
  const add = noteIdx => {
    let midi = 12 * Math.floor(prevMidi / 12) + noteIdx;
    if (midi <= prevMidi) midi += 12;   // bump up until strictly ascending
    midi = Math.max(0, Math.min(127, midi));
    midiNotes.push(midi);
    prevMidi = midi;
  };
  if (voicing['1'] !== false)                         add(scale(chordDeg));
  if (voicing['3'] !== false)                         add(scale(chordDeg+2));
  if (voicing['5'] !== false)                         add(scale(chordDeg+4));
  if (voicing['7'] || extraTones.includes('7th'))     add(scale(chordDeg+6));
  if (voicing['9'] || extraTones.includes('9th'))     add(scale(chordDeg+1));
  if (voicing['11'])                                  add(scale(chordDeg+3));
  if (voicing['13'])                                  add(scale(chordDeg+5));
  return [...new Set(midiNotes)].map(midiToFreq);
}

function getNoteFreq(rootNoteIdx, chromaOffset, octave) {
  const note = (rootNoteIdx + chromaOffset) % 12;
  return midiToFreq(Math.max(0, Math.min(127, 12 * octave + note)));
}

// ────────────────────────────────────────────────────────
//  CHROMATIC QUALITY INTERVALS
//  Exact semitone offsets from chord root for each quality.
//  Used when a quality override is held so aug (#5), dim (b5),
//  dim7 (bb7) etc. actually change the intervals — not just
//  the diatonic scale tones of getChordFreqs().
// ────────────────────────────────────────────────────────
const QUALITY_CHROMATIC = {
  'maj':   [0, 4, 7],
  'min':   [0, 3, 7],
  'aug':   [0, 4, 8],
  'sus2':  [0, 2, 7],
  'sus4':  [0, 5, 7],
  'dim':   [0, 3, 6],
  '7':     [0, 4, 7, 10],
  'maj7':  [0, 4, 7, 11],
  'min7':  [0, 3, 7, 10],
  'augM7': [0, 4, 8, 11],
  'aug7':  [0, 4, 8, 10],
  '7sus4': [0, 5, 7, 10],
  'dim7':  [0, 3, 6, 9],
  'hdim7': [0, 3, 6, 10],
  'add9':  [0, 4, 7, 14],
  'min9':  [0, 3, 7, 10, 14],
};

function getChordFreqsChromatic(chordRootMidi, qualityKey) {
  const ivs = QUALITY_CHROMATIC[qualityKey];
  if (!ivs) return [];
  return [...new Set(ivs.map(iv => chordRootMidi + iv))].map(midiToFreq);
}

// Short labels for semitone offsets — used in the voice editor OMIT buttons
const SEMITONE_LABEL = {
  0:'R', 1:'b2', 2:'2', 3:'b3', 4:'3', 5:'4',
  6:'b5', 7:'5', 8:'#5', 9:'6', 10:'b7', 11:'7',
  13:'b9', 14:'9', 15:'#9', 17:'11', 18:'#11', 20:'b13', 21:'13',
};

// Extension semitone offsets from chord root — used in voice editor ADD buttons
const EXTENSION_SEMITONES = {
  'b7':10, '7':11, 'b9':13, '9':14, '#9':15, '11':17, '#11':18, 'b13':20, '13':21,
};

// Degree-position labels for the base quality array (position 0='1', 1='3', etc.)
const DEGREE_POSITIONS = ['1','3','5','7','9','11','13'];

// Resolve per-key voicing: start with base quality intervals, omit by degree position, add extensions
function resolveKeyIntervals(qualityKey, omit, add, addMinorSeventh = false) {
  const base = QUALITY_CHROMATIC[qualityKey];
  if (!base) return null;
  let intervals = omit.length
    ? base.filter((_, i) => !omit.includes(DEGREE_POSITIONS[i] ?? String(i + 1)))
    : [...base];
  if (addMinorSeventh && intervals.every(iv => iv !== 10 && iv !== 11)) intervals.push(10);
  for (const ext of add) {
    const st = EXTENSION_SEMITONES[ext];
    if (st != null && !intervals.includes(st)) intervals.push(st);
  }
  intervals.sort((a, b) => a - b);
  return intervals.length ? intervals : [0];
}

function applyInversion(intervals, n) {
  if (!n || n >= intervals.length) return intervals;
  const sorted = [...intervals].sort((a, b) => a - b);
  for (let i = 0; i < n; i++) sorted[i] += 12;
  return sorted.sort((a, b) => a - b);
}

// ────────────────────────────────────────────────────────
//  MOOD LANGUAGE  — one evocative word per scale degree
// ────────────────────────────────────────────────────────

const MOOD_WORDS = {
  Ionian:     ['HOME',   'YEARN',  'DREAM',   'LIFT',  'PULL',   'ACHE',   'EDGE'   ],
  Dorian:     ['HOME',   'DARK',   'LIFT',    'MOOD',  'DRIVE',  'WARM',   'SHADOW' ],
  Phrygian:   ['TENSE',  'DARK',   'RELEASE', 'HAUNT', 'PUSH',   'ANCIENT','DRIFT'  ],
  Lydian:     ['FLOAT',  'WONDER', 'OPEN',    'MAGIC', 'SOAR',   'BRIGHT', 'DREAM'  ],
  Mixolydian: ['GROOVE', 'TENSION','EARTH',   'LIFT',  'POWER',  'COLOR',  'FLOAT'  ],
  Aeolian:    ['SHADOW', 'DREAD',  'BREATH',  'GRIEF', 'RISE',   'NOBLE',  'DRIVE'  ],
  Locrian:    ['DREAD',  'DARK',   'TENSION', 'CHAOS', 'COLLAPSE','SHADOW','VOID'   ],
};

// stable: 0-5, tension: 0-5, bright: 0-5
const CHORD_DESCRIPTIONS = {
  Ionian: [
    { long: "The tonic — where all music starts and returns. Settled, safe, complete. Use this to begin or end anything.", stable:5, tension:0, bright:3 },
    { long: "A gentle pull away from home. Wistful and questioning — there's somewhere you'd like to go.", stable:3, tension:2, bright:2 },
    { long: "Softer than home, like a memory. Bittersweet and reflective. It floats behind the melody.", stable:3, tension:1, bright:2 },
    { long: "One step before something bigger. Uplifting and open — the Subdominant anticipates. Feels expansive.", stable:3, tension:2, bright:4 },
    { long: "The Dominant — tension at its purest. The universe wants to snap back to I. Electric and unresolved.", stable:2, tension:5, bright:3 },
    { long: "The relative minor. Melancholy and depth — the sad shadow of home. Feels like longing.", stable:3, tension:2, bright:1 },
    { long: "Diminished — the most unstable place in the scale. Uneasy, sharp. Almost always wants to resolve to I.", stable:1, tension:5, bright:1 },
  ],
  Dorian: [
    { long: "The Dorian home — minor but with a raised 6th that gives it warmth and light. Soulful and grounded.", stable:5, tension:0, bright:2 },
    { long: "A darker minor — reinforces Dorian's introspective, brooding quality.", stable:2, tension:2, bright:1 },
    { long: "Major lift — the III brings brightness and relief into Dorian's dark world.", stable:3, tension:1, bright:4 },
    { long: "The IV major is Dorian's signature. Unlike natural minor, this is major — surprisingly bright.", stable:3, tension:2, bright:4 },
    { long: "Minor dominant — tension without the harsh leading tone. Soft but directed.", stable:2, tension:3, bright:2 },
    { long: "The diminished vi — adds a flicker of darkness and unease.", stable:1, tension:4, bright:1 },
    { long: "The bVII major — a powerful, driving resolution point in Dorian progressions.", stable:2, tension:2, bright:3 },
  ],
  Phrygian: [
    { long: "The Phrygian home — dark, ancient, Spanish. The flat II gives it a Flamenco or Middle Eastern character.", stable:5, tension:1, bright:1 },
    { long: "The bII major — Phrygian's signature chord. Dramatic, just a half-step above the root. Powerful.", stable:3, tension:3, bright:3 },
    { long: "The bIII major — adds a flash of brightness to the dark landscape.", stable:3, tension:1, bright:4 },
    { long: "The iv minor — dark and introspective, heavy.", stable:2, tension:2, bright:1 },
    { long: "The diminished v — tense and unstable, rarely rests here.", stable:1, tension:5, bright:1 },
    { long: "The bVI major — cinematic and ancient, a breath of resolution.", stable:3, tension:1, bright:3 },
    { long: "The bVII minor — drifting and unresolved, fades into the dark.", stable:2, tension:2, bright:2 },
  ],
  Lydian: [
    { long: "The Lydian home — bright and floating. The raised 4th creates a dreamy, magical feeling. Nothing else sounds like this.", stable:5, tension:0, bright:5 },
    { long: "The II major — Lydian's signature chord. Floats above the root. Otherworldly and open.", stable:3, tension:2, bright:5 },
    { long: "The iii minor — brings Lydian back to earth. A grounded moment amid the floating.", stable:3, tension:1, bright:2 },
    { long: "The #IV diminished — the instability created by the raised 4th. Fleeting and tense.", stable:1, tension:5, bright:2 },
    { long: "The V major — classic dominant tension. A pull back toward home, even in Lydian's dreamspace.", stable:2, tension:4, bright:3 },
    { long: "The vi minor — touches the ground, adds emotional depth.", stable:3, tension:1, bright:2 },
    { long: "The vii minor — a soft, ambiguous landing point.", stable:2, tension:1, bright:2 },
  ],
  Mixolydian: [
    { long: "The Mixolydian home — major but with a flat 7th. Rootsy, bluesy, rock. Feels like classic rock or folk.", stable:5, tension:0, bright:3 },
    { long: "The ii minor — adds texture and a touch of melancholy.", stable:2, tension:2, bright:2 },
    { long: "The iii diminished — tension in an otherwise bluesy landscape.", stable:1, tension:4, bright:1 },
    { long: "The IV major — opens up the sound. Uplifting contrast to the dark flat 7th.", stable:3, tension:2, bright:4 },
    { long: "The v minor — Mixolydian's soft dominant. No harsh leading tone, just a gentle pull.", stable:2, tension:2, bright:2 },
    { long: "The vi minor — adds a melancholy shadow to the major feel.", stable:2, tension:1, bright:2 },
    { long: "The bVII major — the defining chord of Mixolydian. Powerful momentum without resolution.", stable:3, tension:2, bright:3 },
  ],
  Aeolian: [
    { long: "Dark home. Grounded but shadowed. The natural minor tonic — serious, introspective, raw.", stable:5, tension:0, bright:1 },
    { long: "The ii° diminished — uncomfortable and uncertain. Rarely a destination, always passing through.", stable:1, tension:4, bright:1 },
    { long: "The bIII major — a breath of major in the dark. Momentary brightness, relief from the minor weight.", stable:3, tension:1, bright:4 },
    { long: "The iv minor — the saddest chord. Heavy, mournful, profound. The heart of tragic music.", stable:2, tension:2, bright:1 },
    { long: "Builds toward resolution. Dramatic when major, quieter when minor. The pivotal point.", stable:2, tension:4, bright:2 },
    { long: "The bVI major — triumph despite darkness. A major chord in a minor world — noble, cinematic.", stable:3, tension:1, bright:4 },
    { long: "The bVII major — momentum and power. Drives the music dramatically forward.", stable:2, tension:3, bright:3 },
  ],
  Locrian: [
    { long: "The Locrian 'home' — a diminished tonic. Highly unstable. Rarely used as a resolution but creates extreme tension.", stable:0, tension:5, bright:1 },
    { long: "The bII major — the most stable chord in Locrian. A brief, surprising moment of rest.", stable:3, tension:2, bright:3 },
    { long: "The bIII minor — dark and uncertain, pressing against the instability.", stable:2, tension:3, bright:1 },
    { long: "The iv minor — adds to the pervasive tension and gloom.", stable:2, tension:4, bright:1 },
    { long: "The bV major — the tritone substitution. Exotic, dissonant, otherworldly.", stable:2, tension:5, bright:2 },
    { long: "The bVI major — a moment of brightness in the void.", stable:2, tension:2, bright:3 },
    { long: "The bvii minor — resolves nowhere. The Locrian drift.", stable:1, tension:4, bright:1 },
  ],
};

// Extension chord mood words (one per EXTENSION_CONFIGS entry)
const EXT_MOOD_WORDS = ['EDGE', 'GLOW', 'OPEN', 'DRIFT'];

// ────────────────────────────────────────────────────────
//  MODE COLOR PALETTES  — hue per mode, applied to key tints
//  Quality (major/minor/dim) adjusts brightness within the hue.
// ────────────────────────────────────────────────────────
const MODE_COLORS = {
  Ionian:     { h: 142 },   // green   — happy, resolved
  Dorian:     { h: 178 },   // teal    — soulful, warm-dark
  Phrygian:   { h: 355 },   // red     — tense, Spanish
  Lydian:     { h:  46 },   // amber   — dreamy, floating
  Mixolydian: { h: 214 },   // blue    — bluesy, rock
  Aeolian:    { h: 258 },   // indigo  — melancholy, minor
  Locrian:    { h: 295 },   // violet  — dark, unstable
};
