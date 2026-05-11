// chord-inspector.js — inline chord info in the circle panel sidebar
(function () {
'use strict';

// ── Note names & chord lookup ─────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CHORD_NAME_TABLE = {
  '0':                '',
  '0,4,7':            '',
  '0,3,7':            'm',
  '0,4,8':            'aug',
  '0,3,6':            'dim',
  '0,2,7':            'sus2',
  '0,5,7':            'sus4',
  '0,4,7,11':         'maj7',
  '0,4,7,10':         '7',
  '0,3,7,10':         'm7',
  '0,3,7,11':         'mM7',
  '0,3,6,10':         'm7b5',
  '0,3,6,9':          'dim7',
  '0,4,8,11':         'augM7',
  '0,4,8,10':         'aug7',
  '0,5,7,10':         '7sus4',
  '0,4,7,14':         'add9',
  '0,4,7,10,14':      '9',
  '0,4,7,11,14':      'maj9',
  '0,3,7,10,14':      'm9',
  '0,4,7,10,17':      '11',
  '0,4,7,10,14,21':   '13',
};
function getChordName(rootClass, intervals) {
  const cls = [...new Set(intervals.map(iv => ((iv % 12) + 12) % 12))].sort((a,b)=>a-b);
  const q = CHORD_NAME_TABLE[cls.join(',')] ?? '?';
  return NOTE_NAMES[((rootClass % 12) + 12) % 12] + q;
}

// ── 2-octave piano SVG — exact MIDI matching so inversions show correctly ─
// KW=10 → 14 white keys = 140px, fits in 144px content area
const KW = 10, KH = 44, BW = 6, BH = 27;
const WHITE_SEMI = [0, 2, 4, 5, 7, 9, 11];
// [semitone, left-edge-x] within one octave at KW=10
const BLACK_KEYS_PER_OCT = [[1,4],[3,14],[6,34],[8,44],[10,54]];

function buildPianoSVG(activeMidis, startMidi) {
  // Match exact MIDI numbers — not pitch classes — so inversions highlight correctly
  const midiSet = new Set(activeMidis);
  const svgW = 14 * KW;
  let w = '', b = '';

  for (let oct = 0; oct < 2; oct++) {
    const midiBase = startMidi + oct * 12;
    const ox = oct * 7 * KW;

    WHITE_SEMI.forEach((semi, pos) => {
      const midi = midiBase + semi;
      const on = midiSet.has(midi);
      const x = ox + pos * KW;
      w += `<rect x="${x+1}" y="1" width="${KW-2}" height="${KH}" rx="1" fill="${on?'#44ff88':'#f8f8f6'}" stroke="${on?'#2aaa55':'#ccc'}" stroke-width="0.5"/>`;
      if (semi === 0) {
        const octN = Math.floor(midi / 12) - 1;
        w += `<text x="${x+KW/2}" y="${KH-2}" font-size="5.5" fill="${on?'#0a2a0a':'#888'}" text-anchor="middle" font-family="Share Tech Mono,monospace">C${octN}</text>`;
      }
    });

    BLACK_KEYS_PER_OCT.forEach(([semi, xOff]) => {
      const midi = midiBase + semi;
      const on = midiSet.has(midi);
      b += `<rect x="${ox+xOff}" y="1" width="${BW}" height="${BH}" rx="1" fill="${on?'#44ff88':'#2a2a2a'}" stroke="${on?'#2aaa55':'#111'}" stroke-width="0.5"/>`;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${KH+2}" style="display:block">${w}${b}</svg>`;
}

// ── Compact guitar diagram (fits in 144px) ────────────────────────────────
// 6 strings, GS=17 → 5×17=85px + margins fits in 144px
const GUITAR_OPEN = [64, 59, 55, 50, 45, 40]; // e B G D A E
const GS = 17, GF = 13, GM = 14, GT = 18;


function buildGuitarSVG(voicing) {
  const display = [...voicing].reverse(); // low E → high e (left→right)
  const fretted = display.filter(f => f > 0);
  const minFret = fretted.length ? Math.min(...fretted) : 0;
  const showPos = minFret > 1;
  const fOff = showPos ? minFret - 1 : 0;
  const ns = 6, nf = 5;
  const svgW = GM + (ns-1)*GS + (showPos ? 24 : 10);
  const svgH = GT + nf*GF + 10;

  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" style="display:block">`;

  // Nut or position
  if (!showPos) {
    s += `<rect x="${GM}" y="${GT}" width="${(ns-1)*GS}" height="2.5" fill="#999" rx="1"/>`;
  } else {
    s += `<text x="${GM+(ns-1)*GS+5}" y="${GT+GF/2+3}" font-size="7" fill="#444" font-family="Share Tech Mono,monospace">${minFret}fr</text>`;
  }
  for (let f = 0; f <= nf; f++) {
    const y = GT + f*GF;
    if (f > 0 || showPos) s += `<line x1="${GM}" y1="${y}" x2="${GM+(ns-1)*GS}" y2="${y}" stroke="#bbb" stroke-width="0.5"/>`;
  }
  for (let i = 0; i < ns; i++) {
    const x = GM + i*GS;
    s += `<line x1="${x}" y1="${GT}" x2="${x}" y2="${GT+nf*GF}" stroke="#999" stroke-width="0.8"/>`;
  }

  const SNAMES = ['E','A','D','G','B','e'];
  for (let i = 0; i < ns; i++) {
    const x = GM + i*GS;
    s += `<text x="${x}" y="${GT-7}" font-size="6.5" fill="#444" text-anchor="middle" font-family="Share Tech Mono,monospace">${SNAMES[i]}</text>`;
  }
  for (let i = 0; i < ns; i++) {
    const x = GM + i*GS;
    const f = display[i];
    if (f === -1) {
      s += `<text x="${x}" y="${GT-1}" font-size="8" fill="#cc3333" text-anchor="middle" font-family="Share Tech Mono,monospace">×</text>`;
    } else if (f === 0) {
      s += `<circle cx="${x}" cy="${GT-5}" r="3" fill="none" stroke="#22aa55" stroke-width="1.2"/>`;
    } else {
      const cy = GT + (f - fOff - 0.5) * GF;
      s += `<circle cx="${x}" cy="${cy}" r="4.5" fill="#22aa55"/>`;
    }
  }
  s += '</svg>';
  return s;
}

// Return up to `count` distinct best voicings
function computeTopVoicings(rootClass, intervals, bassClass, count = 2) {
  const nc = new Set(intervals.map(iv => ((rootClass + iv) % 12 + 12) % 12));
  const bass = bassClass ?? rootClass;
  const scored = [];
  for (let pos = 0; pos <= 9; pos++) {
    const v = GUITAR_OPEN.map(open => {
      if (pos === 0 && nc.has(open % 12)) return 0;
      const lo = pos === 0 ? 1 : pos;
      for (let f = lo; f <= pos + 4; f++) if (nc.has((open + f) % 12)) return f;
      if (nc.has(open % 12)) return 0;
      return -1;
    });
    const played = v.filter(f => f >= 0).length;
    if (played < 3) continue;
    const fretted = v.filter(f => f > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    if (span > 4) continue;
    const lowestPlayed = v.slice().reverse().findIndex(f => f >= 0);
    const lowestIdx = lowestPlayed >= 0 ? 5 - lowestPlayed : -1;
    const bassOnLowest = lowestIdx >= 0 && (GUITAR_OPEN[lowestIdx] + v[lowestIdx]) % 12 === bass;
    const bassAnywhere = v.some((f, i) => f >= 0 && (GUITAR_OPEN[i] + f) % 12 === bass);
    const score = played * 10 - span * 2 + (bassAnywhere ? 3 : 0) + (bassOnLowest ? 8 : 0) - pos * 0.5;
    scored.push({ v, score, key: v.join(',') });
  }
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const result = [];
  for (const { v, key } of scored) {
    if (!seen.has(key)) { seen.add(key); result.push(v); }
    if (result.length >= count) break;
  }
  while (result.length < count) result.push(null);
  return result;
}

// ── Compute chord info ────────────────────────────────────────────────────
function computeChordInfo(keyIdx) {
  const kc = keyConfigs[keyIdx];
  const rootIdx = circle.rootNoteIdx;
  const modeName = circle.modeName;
  const ivl = MODE_INTERVALS[modeName];

  let chordDeg, octAdj;
  if (keyIdx < 7) { chordDeg = keyIdx; octAdj = 0; }
  else if (keyIdx === 7) { chordDeg = 0; octAdj = 1; }
  else { const cfg = EXTENSION_CONFIGS[keyIdx - 8]; chordDeg = cfg.degree; octAdj = 0; }

  const eff = kc.flavour !== null ? kc.flavour : activeFlavour;
  const chordRootNote = (rootIdx + ivl[((chordDeg % 7) + 7) % 7]) % 12;
  const chordRootMidi = 12 * (currentOctave + kc.octOffset + octAdj) + chordRootNote;

  let intervals;
  if (eff && QUALITY_CHROMATIC[eff]) {
    intervals = (kc.omit.length || kc.add.length)
      ? resolveKeyIntervals(eff, kc.omit, kc.add, false)
      : [...QUALITY_CHROMATIC[eff]];
  } else {
    const OL = ['1','3','5'];
    const base = [0, 2, 4].map((off, pos) => {
      const di = ((chordDeg + off) % 7 + 7) % 7;
      return (ivl[di] - ivl[((chordDeg % 7) + 7) % 7] + 12) % 12;
    }).filter((_,p) => !kc.omit.includes(OL[p]));
    const ext = kc.add.flatMap(e => {
      const st = EXTENSION_SEMITONES[e];
      return (st != null && !base.includes(st)) ? [st] : [];
    });
    intervals = [...base, ...ext].sort((a,b) => a-b);
  }
  if (!intervals.length) intervals = [0];

  const inv = kc.inversion || 0;
  const inverted = applyInversion(intervals, inv);
  const activeMidis = [...new Set(inverted.map(iv => chordRootMidi + iv))];
  const chordName = getChordName(chordRootNote, intervals);
  const ROMAN = ['I','II','III','IV','V','VI','VII'];
  const degLabel = keyIdx < 7 ? ROMAN[keyIdx] : (keyIdx === 7 ? 'Oct' : `Ext${keyIdx-7}`);

  return { chordRootNote, chordRootMidi, intervals, inverted, activeMidis, chordName, degLabel, inv };
}

// ── Inline panel logic ────────────────────────────────────────────────────
let cciEl = null;
let currentKeyIdx = null;

function getEl() {
  if (!cciEl) cciEl = document.getElementById('circleChordInfo');
  return cciEl;
}

function refresh() {
  const el = getEl();
  if (!el || currentKeyIdx === null) return;
  const info = computeChordInfo(currentKeyIdx);
  const kc = keyConfigs[currentKeyIdx];

  el.querySelector('.cci-name').textContent = info.chordName;
  el.querySelector('.cci-deg').textContent = info.degLabel;
  // startMidi = bottom of the 2-octave piano window (C below the chord root)
  const startMidi = Math.floor(info.chordRootMidi / 12) * 12;
  el.querySelector('.cci-piano').innerHTML = buildPianoSVG(info.activeMidis, startMidi);
  // bassClass = pitch class of the lowest note in the inverted voicing
  const bassClass = ((info.chordRootNote + info.inverted[0]) % 12 + 12) % 12;
  const voicings = computeTopVoicings(info.chordRootNote, info.inverted, bassClass, 2);
  const gEls = el.querySelectorAll('.cci-guitar');
  if (gEls[0]) gEls[0].innerHTML = voicings[0] ? buildGuitarSVG(voicings[0]) : '';
  if (gEls[1]) gEls[1].innerHTML = voicings[1] ? buildGuitarSVG(voicings[1]) : '';
}

function show(keyIdx) {
  const el = getEl();
  if (!el) return;
  currentKeyIdx = keyIdx;
  el.style.display = 'block';
  refresh();
}

// Show a single note (used in scale/free mode)
function showNote(midi, label) {
  const el = getEl();
  if (!el) return;
  currentKeyIdx = null;
  const pc = ((midi % 12) + 12) % 12;
  el.querySelector('.cci-name').textContent = NOTE_NAMES[pc];
  el.querySelector('.cci-deg').textContent  = label || '';
  const startMidi = Math.floor(midi / 12) * 12;
  el.querySelector('.cci-piano').innerHTML = buildPianoSVG([midi], startMidi);
  const voicings = computeTopVoicings(pc, [0], pc, 2);
  const gEls = el.querySelectorAll('.cci-guitar');
  if (gEls[0]) gEls[0].innerHTML = voicings[0] ? buildGuitarSVG(voicings[0]) : '';
  if (gEls[1]) gEls[1].innerHTML = voicings[1] ? buildGuitarSVG(voicings[1]) : '';
  el.style.display = 'block';
}

// Show tonic chord on init
function showDefault() { show(0); }

function hide() {
  const el = getEl();
  if (el) el.style.display = 'none';
  currentKeyIdx = null;
}

window.chordInspector = { show, showNote, showDefault, hide, refresh };
})();
