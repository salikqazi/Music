// ════════════════════════════════════════════════════════
//  APP STATE
// ════════════════════════════════════════════════════════

let songsOpen = false;
function toggleSongs() {
  songsOpen = !songsOpen;
  document.getElementById('songsSection').style.display = songsOpen ? 'flex' : 'none';
  document.getElementById('songsChevron').textContent   = songsOpen ? '▼' : '▶';
}

let vpcPanelOpen = false;
function toggleVpcPanel() {
  vpcPanelOpen = !vpcPanelOpen;
  document.getElementById('vpcVoiceFlat').style.display = vpcPanelOpen ? 'flex' : 'none';
  document.getElementById('vpcPanelChevron').textContent = vpcPanelOpen ? '▼' : '▶';
}

let circlePanelOpen = false;
function toggleCirclePanel() {
  if (!window.matchMedia('(max-width: 430px)').matches) return;
  circlePanelOpen = !circlePanelOpen;
  const body = document.getElementById('circlePanelBody');
  body.classList.toggle('open', circlePanelOpen);
  document.getElementById('circlePanelChevron').textContent = circlePanelOpen ? '▼' : '▶';
  if (circlePanelOpen && typeof circle !== 'undefined') circle._onResize();
}

let patchesStripOpen = false;
function togglePatchesStrip() {
  patchesStripOpen = !patchesStripOpen;
  document.getElementById('patchesStripBody').style.display = patchesStripOpen ? 'flex' : 'none';
  document.getElementById('patchesSummaryChevron').textContent = patchesStripOpen ? '▼' : '▶';
}

let snapshotsOpen = false;
function toggleSnapshotsStrip() {
  snapshotsOpen = !snapshotsOpen;
  document.getElementById('snapStripBody').style.display = snapshotsOpen ? 'contents' : 'none';
  document.getElementById('snapStripChevron').textContent = snapshotsOpen ? '▼' : '▶';
}

let extSectionOpen = false;
function toggleExtensions() {
  if (playMode !== 'chord') return;
  extSectionOpen = !extSectionOpen;
  document.getElementById('extSection').style.display = extSectionOpen ? 'flex' : 'none';
  document.getElementById('extDividerChevron').textContent = extSectionOpen ? '▼' : '▶';
}

let playMode      = 'chord'; // 'chord' | 'scale' | 'free'
let currentOctave = 4;
let activeFlavour = null;

const defaultVoicing = {'1':true,'3':true,'5':true,'7':false,'9':false,'11':false,'13':false};

// Per-key overrides: quality flavour + octave offset relative to currentOctave
const keyConfigs = Array.from({length:12}, () => ({ flavour: null, octOffset: 0, _userDelta: 0, omit: [], add: [], inversion: 0, degree: null }));

// Quality slot lists (shared by mini-knob + flavour strip)
const KCP_FLAVOURS = [null,'maj','min','7','maj7','min7','sus2','sus4','add9','dim','aug'];
const KCP_LABELS   = ['Auto','maj','min','7','maj7','min7','sus2','sus4','add9','dim','aug'];

// ── Modifier keys ─────────────────────────────────────
// Shift = +1 oct, Z = -1 oct, Tab = diatonic 7th extension
const modifiers = { octUp: false, octDown: false, extension: false };

// ── Right-hand quality keys — 3×5 keyboard grid ───────
//  Row 1  Y  U  I  O  P  ← basic triad quality per family
//  Row 2  H  J  K  L  ;  ← 7th-chord extensions
//  Row 3  N  M  ,  .  /  ← further extensions
//
//  Column families:  MAJ  MIN  AUG  SUS  DIM
const QUAL_KB = {
  // Row 1 — basic
  'y':'maj',   'u':'min',   'i':'aug',   'o':'sus4',  'p':'dim',
  // Row 2 — 7th
  'h':'maj7',  'j':'min7',  'k':'augM7', 'l':'sus2',  ';':'dim7',
  // Row 3 — extended
  'n':'add9',  'm':'min9',  ',':'aug7',  '.':'7sus4',  '/':'hdim7',
  // Quick flavours — Z X C V
  'z':'7',     'x':'maj7',  'c':'min7',  'v':'add9',
};

// 5 quality families with their colors (rgb triplets for CSS rgba())
const QUAL_FAMILIES = [
  { id:'maj', label:'MAJ', rgb:'34,197,94'   },
  { id:'min', label:'MIN', rgb:'202,138,4'   },
  { id:'aug', label:'AUG', rgb:'168,85,247'  },
  { id:'sus', label:'SUS', rgb:'100,116,139' },
  { id:'dim', label:'DIM', rgb:'249,115,22'  },
];

// 15 quality keys in row-major order (matches CSS grid row order)
const QUAL_GRID = [
  // Row 1 — basic triad quality
  { key:'maj',   label:'maj',   kb:'Y', row:1, family:'maj' },
  { key:'min',   label:'min',   kb:'U', row:1, family:'min' },
  { key:'aug',   label:'aug',   kb:'I', row:1, family:'aug' },
  { key:'sus4',  label:'sus4',  kb:'O', row:1, family:'sus' },
  { key:'dim',   label:'dim',   kb:'P', row:1, family:'dim' },
  // Row 2 — 7th chord per family
  { key:'maj7',  label:'maj7',  kb:'H', row:2, family:'maj' },
  { key:'min7',  label:'min7',  kb:'J', row:2, family:'min' },
  { key:'augM7', label:'augΔ7', kb:'K', row:2, family:'aug' },
  { key:'sus2',  label:'sus2',  kb:'L', row:2, family:'sus' },
  { key:'dim7',  label:'dim7',  kb:';', row:2, family:'dim' },
  // Row 3 — extended per family
  { key:'add9',  label:'add9',  kb:'N', row:3, family:'maj' },
  { key:'min9',  label:'min9',  kb:'M', row:3, family:'min' },
  { key:'aug7',  label:'aug+7', kb:',', row:3, family:'aug' },
  { key:'7sus4', label:'7sus4', kb:'.', row:3, family:'sus' },
  { key:'hdim7', label:'ø7',    kb:'/', row:3, family:'dim' },
];

// Quick custom flavour keys — Z X C V (hold to apply, release to return to AUTO)
// Edit these to change what each key does.
const CUSTOM_FLAVOURS = [
  { key:'7',    kb:'Z', label:'dom7', rgb:'251,146,60' },
  { key:'maj7', kb:'X', label:'maj7', rgb:'34,197,94'  },
  { key:'min7', kb:'C', label:'min7', rgb:'202,138,4'  },
  { key:'add9', kb:'V', label:'add9', rgb:'34,197,94'  },
];

let circle;
let keyEls      = [];
let keyEls2     = [];
let keyOctKnobs = [];
let keyFlvKnobs = [];
let octaveKnob;
let revKnob, driveKnob, driftKnob, subKnob, widthKnob, sweepKnob;
let strumKnob, humanizeKnob, glideKnob;
let atkKnob, dcyKnob, susKnob, relKnob, cutKnob, resKnob, warmKnob;

// Optimal analog character settings per preset.
// applyPreset() snaps all character knobs to these values so each sound
// feels right out of the box, but every parameter remains fully editable.
const PRESET_ANALOG_DEFAULTS = {
  //                                                                                warmth = cent-detuning shimmer (0–30)
  // ── Original 10 ─────────────────────────────────────────────────────────────────────────
  Piano:           { reverb: 0,    drive: 2.0, drift: 3,  sub: 0,   width: 0.9, sweep: 2.0, warmth: 2  },
  'E.Piano':       { reverb: 0.08, drive: 1.5, drift: 4,  sub: 0,   width: 0.8, sweep: 1.8, warmth: 4  },
  Organ:           { reverb: 0,    drive: 2.5, drift: 5,  sub: 0.8, width: 0.7, sweep: 1.0, warmth: 6  },
  Pad:             { reverb: 0.22, drive: 1.5, drift: 8,  sub: 0.6, width: 1.5, sweep: 3.0, warmth: 12 },
  Strings:         { reverb: 0.14, drive: 2.0, drift: 7,  sub: 0.5, width: 1.8, sweep: 2.5, warmth: 10 },
  Choir:           { reverb: 0.22, drive: 1.5, drift: 6,  sub: 0,   width: 1.2, sweep: 2.8, warmth: 8  },
  Bell:            { reverb: 0,    drive: 1.0, drift: 1,  sub: 0,   width: 0.8, sweep: 1.0, warmth: 0  },
  Marimba:         { reverb: 0,    drive: 1.5, drift: 1,  sub: 0,   width: 0.6, sweep: 1.0, warmth: 0  },
  Pluck:           { reverb: 0,    drive: 2.0, drift: 2,  sub: 0,   width: 0.9, sweep: 2.0, warmth: 2  },
  Lead:            { reverb: 0,    drive: 3.0, drift: 5,  sub: 0.7, width: 1.4, sweep: 2.0, warmth: 8  },
  // ── KEYS ────────────────────────────────────────────────────────────────────────────────
  'Grand Piano':   { reverb: 0.05, drive: 2.0, drift: 2,  sub: 0,   width: 1.0, sweep: 2.5, warmth: 3  },
  'Upright Piano': { reverb: 0.03, drive: 1.8, drift: 2,  sub: 0,   width: 0.7, sweep: 2.0, warmth: 4  },
  'Bright Keys':   { reverb: 0,    drive: 1.5, drift: 1,  sub: 0,   width: 0.8, sweep: 2.2, warmth: 1  },
  'Wurlitzer':     { reverb: 0.10, drive: 2.0, drift: 5,  sub: 0,   width: 0.9, sweep: 2.0, warmth: 5  },
  'Harpsichord':   { reverb: 0,    drive: 1.0, drift: 1,  sub: 0,   width: 0.6, sweep: 1.0, warmth: 0  },
  'Celesta':       { reverb: 0.05, drive: 1.0, drift: 1,  sub: 0,   width: 0.7, sweep: 1.0, warmth: 0  },
  'Clavinet':      { reverb: 0,    drive: 3.5, drift: 3,  sub: 0,   width: 0.8, sweep: 2.5, warmth: 3  },
  // ── ORGAN ───────────────────────────────────────────────────────────────────────────────
  'Church Organ':  { reverb: 0.30, drive: 1.5, drift: 4,  sub: 0.8, width: 1.0, sweep: 1.0, warmth: 8  },
  'Jazz Organ':    { reverb: 0.05, drive: 3.5, drift: 9,  sub: 0.6, width: 0.8, sweep: 1.0, warmth: 10 },
  'Pipe Organ':    { reverb: 0.45, drive: 1.0, drift: 3,  sub: 1.0, width: 1.2, sweep: 1.0, warmth: 6  },
  // ── PADS ────────────────────────────────────────────────────────────────────────────────
  'Crystal Pad':   { reverb: 0.25, drive: 1.0, drift: 6,  sub: 0,   width: 1.8, sweep: 3.5, warmth: 10 },
  'Angel Pad':     { reverb: 0.35, drive: 1.0, drift: 10, sub: 0,   width: 1.6, sweep: 4.0, warmth: 14 },
  'Space Pad':     { reverb: 0.40, drive: 1.5, drift: 12, sub: 0.8, width: 2.0, sweep: 4.0, warmth: 18 },
  'Glass Pad':     { reverb: 0.15, drive: 1.0, drift: 4,  sub: 0,   width: 1.4, sweep: 3.0, warmth: 8  },
  'Vapor Pad':     { reverb: 0.30, drive: 1.5, drift: 14, sub: 0.5, width: 1.8, sweep: 3.5, warmth: 20 },
  // ── STRINGS ─────────────────────────────────────────────────────────────────────────────
  'Solo Violin':   { reverb: 0.18, drive: 1.8, drift: 9,  sub: 0,   width: 0.8, sweep: 2.0, warmth: 12 },
  'Cello':         { reverb: 0.15, drive: 2.0, drift: 8,  sub: 0.3, width: 0.7, sweep: 2.0, warmth: 10 },
  'Orchestra':     { reverb: 0.25, drive: 2.0, drift: 8,  sub: 0.5, width: 2.0, sweep: 3.0, warmth: 14 },
  'Chamber':       { reverb: 0.10, drive: 1.8, drift: 7,  sub: 0,   width: 1.2, sweep: 2.0, warmth: 10 },
  // ── CHOIR ───────────────────────────────────────────────────────────────────────────────
  'Ah Choir':      { reverb: 0.28, drive: 1.5, drift: 8,  sub: 0,   width: 1.4, sweep: 3.5, warmth: 14 },
  'Oh Voice':      { reverb: 0.30, drive: 1.5, drift: 9,  sub: 0,   width: 1.2, sweep: 3.5, warmth: 16 },
  'Falsetto':      { reverb: 0.20, drive: 1.2, drift: 6,  sub: 0,   width: 1.0, sweep: 2.5, warmth: 8  },
  // ── SYNTH ───────────────────────────────────────────────────────────────────────────────
  'Acid 303':      { reverb: 0,    drive: 3.5, drift: 3,  sub: 0.4, width: 1.0, sweep: 5.0, warmth: 4  },
  'Unison Lead':   { reverb: 0.05, drive: 3.0, drift: 4,  sub: 0.8, width: 2.0, sweep: 2.5, warmth: 16 },
  'Poly Lead':     { reverb: 0.08, drive: 2.0, drift: 5,  sub: 0.3, width: 1.2, sweep: 2.0, warmth: 8  },
  'Fat Saw':       { reverb: 0.05, drive: 3.5, drift: 5,  sub: 1.0, width: 1.8, sweep: 3.0, warmth: 12 },
  'Pulse Lead':    { reverb: 0,    drive: 2.5, drift: 4,  sub: 0.5, width: 1.1, sweep: 2.5, warmth: 6  },
  // ── BASS ────────────────────────────────────────────────────────────────────────────────
  'Sub Bass':      { reverb: 0,    drive: 1.5, drift: 1,  sub: 1.0, width: 0.3, sweep: 1.0, warmth: 0  },
  'Synth Bass':    { reverb: 0,    drive: 3.0, drift: 2,  sub: 0.8, width: 0.5, sweep: 4.0, warmth: 4  },
  'Growl Bass':    { reverb: 0,    drive: 4.5, drift: 3,  sub: 0.8, width: 0.6, sweep: 3.0, warmth: 6  },
  'Upright Bass':  { reverb: 0.05, drive: 1.5, drift: 3,  sub: 0.3, width: 0.5, sweep: 1.5, warmth: 4  },
  // ── BELLS ───────────────────────────────────────────────────────────────────────────────
  'Vibraphone':    { reverb: 0.10, drive: 1.0, drift: 8,  sub: 0,   width: 1.0, sweep: 1.0, warmth: 2  },
  'Glockenspiel':  { reverb: 0,    drive: 1.0, drift: 1,  sub: 0,   width: 0.7, sweep: 1.0, warmth: 0  },
  'Music Box':     { reverb: 0.08, drive: 1.0, drift: 2,  sub: 0,   width: 0.6, sweep: 1.0, warmth: 0  },
  'Kalimba':       { reverb: 0.05, drive: 1.2, drift: 2,  sub: 0,   width: 0.7, sweep: 1.0, warmth: 2  },
  // ── PLUCKED ─────────────────────────────────────────────────────────────────────────────
  'Harp':          { reverb: 0.10, drive: 1.5, drift: 2,  sub: 0,   width: 1.2, sweep: 2.0, warmth: 3  },
  'Nylon Guitar':  { reverb: 0.05, drive: 1.5, drift: 2,  sub: 0,   width: 0.8, sweep: 1.5, warmth: 4  },
  'Koto':          { reverb: 0.08, drive: 1.5, drift: 3,  sub: 0,   width: 0.9, sweep: 2.0, warmth: 4  },
  'Sitar':         { reverb: 0.05, drive: 2.0, drift: 7,  sub: 0,   width: 1.0, sweep: 2.0, warmth: 8  },
  // ── BRASS ───────────────────────────────────────────────────────────────────────────────
  'Brass Section': { reverb: 0.08, drive: 2.5, drift: 5,  sub: 0.4, width: 1.5, sweep: 3.0, warmth: 8  },
  'French Horn':   { reverb: 0.12, drive: 1.8, drift: 6,  sub: 0.2, width: 1.0, sweep: 2.0, warmth: 10 },
  'Trumpet':       { reverb: 0.05, drive: 2.0, drift: 4,  sub: 0,   width: 0.8, sweep: 2.5, warmth: 6  },
  'Flute':         { reverb: 0.12, drive: 1.0, drift: 6,  sub: 0,   width: 0.9, sweep: 2.0, warmth: 4  },
  // ── AMBIENT ─────────────────────────────────────────────────────────────────────────────
  'Texture':       { reverb: 0.45, drive: 1.5, drift: 16, sub: 0.5, width: 2.0, sweep: 5.0, warmth: 22 },
  'Atmosphere':    { reverb: 0.50, drive: 1.0, drift: 18, sub: 0.8, width: 2.0, sweep: 5.0, warmth: 26 },
  'Shimmer':       { reverb: 0.35, drive: 1.0, drift: 8,  sub: 0,   width: 2.0, sweep: 4.0, warmth: 18 },
  'Sweep FX':      { reverb: 0.15, drive: 2.5, drift: 6,  sub: 0.4, width: 1.6, sweep: 5.0, warmth: 12 },
  // ── KEYS (more) ─────────────────────────────────────────────────────────────────────────
  'Toy Piano':     { reverb: 0,    drive: 1.0, drift: 1,  sub: 0,   width: 0.5, sweep: 1.0, warmth: 0  },
  'Honky Tonk':    { reverb: 0.05, drive: 2.0, drift: 2,  sub: 0,   width: 1.0, sweep: 1.5, warmth: 8  },
  'Clavichord':    { reverb: 0.08, drive: 1.2, drift: 2,  sub: 0,   width: 0.6, sweep: 1.0, warmth: 2  },
  // ── ORGAN (more) ────────────────────────────────────────────────────────────────────────
  'Farfisa':       { reverb: 0.04, drive: 2.0, drift: 4,  sub: 0,   width: 0.7, sweep: 1.0, warmth: 3  },
  'Harmonium':     { reverb: 0.12, drive: 1.5, drift: 5,  sub: 0.4, width: 0.9, sweep: 1.0, warmth: 6  },
  // ── PADS (more) ─────────────────────────────────────────────────────────────────────────
  'Rain Pad':      { reverb: 0.30, drive: 1.0, drift: 10, sub: 0,   width: 2.0, sweep: 3.5, warmth: 16 },
  'Haunted Pad':   { reverb: 0.40, drive: 1.5, drift: 14, sub: 1.0, width: 1.8, sweep: 4.5, warmth: 20 },
  'Lo-Fi Pad':     { reverb: 0.20, drive: 2.0, drift: 12, sub: 0.3, width: 1.4, sweep: 2.0, warmth: 18 },
  // ── STRINGS (more) ──────────────────────────────────────────────────────────────────────
  'Pizzicato':     { reverb: 0.08, drive: 1.5, drift: 3,  sub: 0,   width: 1.2, sweep: 2.0, warmth: 4  },
  'Tremolo Strings':{ reverb: 0.16, drive: 1.8, drift: 6, sub: 0.2, width: 1.8, sweep: 2.5, warmth: 10 },
  'Viola':         { reverb: 0.14, drive: 1.8, drift: 8,  sub: 0.2, width: 0.9, sweep: 2.2, warmth: 11 },
  'Contrabass':    { reverb: 0.12, drive: 1.8, drift: 5,  sub: 0.6, width: 0.8, sweep: 1.5, warmth: 8  },
  // ── CHOIR (more) ────────────────────────────────────────────────────────────────────────
  'Mm Voice':      { reverb: 0.22, drive: 1.2, drift: 5,  sub: 0,   width: 1.0, sweep: 2.0, warmth: 8  },
  'Ee Voice':      { reverb: 0.18, drive: 1.2, drift: 5,  sub: 0,   width: 1.0, sweep: 2.2, warmth: 6  },
  'Gospel Choir':  { reverb: 0.28, drive: 1.8, drift: 7,  sub: 0,   width: 1.6, sweep: 2.5, warmth: 14 },
  // ── SYNTH (more) ────────────────────────────────────────────────────────────────────────
  'DX7 Bell':      { reverb: 0.10, drive: 1.0, drift: 1,  sub: 0,   width: 0.8, sweep: 1.0, warmth: 0  },
  'Juno Chorus':   { reverb: 0.14, drive: 1.5, drift: 5,  sub: 0,   width: 1.4, sweep: 2.5, warmth: 8  },
  'SID Chip':      { reverb: 0,    drive: 2.5, drift: 2,  sub: 0,   width: 0.8, sweep: 1.5, warmth: 2  },
  'Reese Bass':    { reverb: 0.05, drive: 3.0, drift: 3,  sub: 0.8, width: 0.6, sweep: 4.0, warmth: 6  },
  // ── BASS (more) ─────────────────────────────────────────────────────────────────────────
  'Fretless Bass': { reverb: 0.06, drive: 1.5, drift: 4,  sub: 0.4, width: 0.5, sweep: 2.0, warmth: 5  },
  'Slap Bass':     { reverb: 0,    drive: 2.5, drift: 1,  sub: 0.3, width: 0.5, sweep: 3.0, warmth: 2  },
  '808':           { reverb: 0,    drive: 1.0, drift: 0,  sub: 1.0, width: 0.2, sweep: 1.0, warmth: 0  },
  // ── BELLS (more) ────────────────────────────────────────────────────────────────────────
  'Handpan':       { reverb: 0.25, drive: 1.0, drift: 2,  sub: 0,   width: 1.2, sweep: 1.0, warmth: 2  },
  'Tubular Bells': { reverb: 0.30, drive: 1.0, drift: 1,  sub: 0,   width: 1.0, sweep: 1.0, warmth: 0  },
  'Steel Drum':    { reverb: 0.10, drive: 1.2, drift: 1,  sub: 0,   width: 0.9, sweep: 1.0, warmth: 0  },
  // ── PLUCKED (more) ──────────────────────────────────────────────────────────────────────
  'Banjo':         { reverb: 0.05, drive: 2.0, drift: 2,  sub: 0,   width: 0.8, sweep: 2.0, warmth: 3  },
  'Ukulele':       { reverb: 0.06, drive: 1.2, drift: 2,  sub: 0,   width: 0.8, sweep: 1.5, warmth: 2  },
  'Mandolin':      { reverb: 0.06, drive: 1.5, drift: 2,  sub: 0,   width: 0.9, sweep: 1.8, warmth: 3  },
  // ── GUITAR ──────────────────────────────────────────────────────────────────────────────
  'Clean Guitar':  { reverb: 0.06, drive: 1.5, drift: 2,  sub: 0,   width: 0.9, sweep: 2.0, warmth: 3  },
  'Jazz Guitar':   { reverb: 0.08, drive: 1.2, drift: 3,  sub: 0,   width: 0.7, sweep: 1.0, warmth: 4  },
  'Funk Strat':    { reverb: 0,    drive: 2.0, drift: 1,  sub: 0,   width: 0.8, sweep: 2.5, warmth: 2  },
  'Crunch Guitar': { reverb: 0.05, drive: 3.5, drift: 3,  sub: 0.2, width: 1.0, sweep: 2.0, warmth: 5  },
  'Lap Steel':     { reverb: 0.14, drive: 1.5, drift: 8,  sub: 0,   width: 1.0, sweep: 2.0, warmth: 10 },
  // ── WORLD ───────────────────────────────────────────────────────────────────────────────
  'Duduk':         { reverb: 0.20, drive: 1.5, drift: 7,  sub: 0,   width: 0.9, sweep: 2.0, warmth: 8  },
  'Erhu':          { reverb: 0.14, drive: 1.8, drift: 9,  sub: 0,   width: 0.8, sweep: 2.0, warmth: 10 },
  'Santur':        { reverb: 0.10, drive: 1.2, drift: 2,  sub: 0,   width: 1.0, sweep: 1.5, warmth: 2  },
  'Oud':           { reverb: 0.08, drive: 1.5, drift: 4,  sub: 0,   width: 0.8, sweep: 1.5, warmth: 5  },
  'Gamelan':       { reverb: 0.30, drive: 1.0, drift: 3,  sub: 0,   width: 1.4, sweep: 1.0, warmth: 4  },
  'Didgeridoo':    { reverb: 0.15, drive: 2.5, drift: 6,  sub: 1.0, width: 0.6, sweep: 1.5, warmth: 6  },
  'Shamisen':      { reverb: 0.06, drive: 2.0, drift: 3,  sub: 0,   width: 0.7, sweep: 2.0, warmth: 3  },
  'Kora':          { reverb: 0.12, drive: 1.2, drift: 3,  sub: 0,   width: 1.4, sweep: 1.5, warmth: 4  },
};

// Preset categories — emoji drives the tab selector, label is the display text
const PRESET_CATEGORIES = [
  { emoji:'🎹', label:'Keys',    presets:['Piano','Grand Piano','Upright Piano','Bright Keys','E.Piano','Wurlitzer','Harpsichord','Celesta','Clavinet','Toy Piano','Honky Tonk','Clavichord'] },
  { emoji:'🪗', label:'Organ',   presets:['Organ','Jazz Organ','Church Organ','Pipe Organ','Farfisa','Harmonium'] },
  { emoji:'☁️', label:'Pads',    presets:['Pad','Crystal Pad','Angel Pad','Space Pad','Glass Pad','Vapor Pad','Rain Pad','Haunted Pad','Lo-Fi Pad'] },
  { emoji:'🎻', label:'Strings', presets:['Strings','Solo Violin','Cello','Orchestra','Chamber','Pizzicato','Tremolo Strings','Viola','Contrabass'] },
  { emoji:'🎤', label:'Choir',   presets:['Choir','Ah Choir','Oh Voice','Falsetto','Mm Voice','Ee Voice','Gospel Choir'] },
  { emoji:'⚡', label:'Synth',   presets:['Lead','Acid 303','Unison Lead','Poly Lead','Fat Saw','Pulse Lead','DX7 Bell','Juno Chorus','SID Chip','Reese Bass'] },
  { emoji:'🔊', label:'Bass',    presets:['Sub Bass','Synth Bass','Growl Bass','Upright Bass','Fretless Bass','Slap Bass','808'] },
  { emoji:'🔔', label:'Bells',   presets:['Bell','Marimba','Vibraphone','Glockenspiel','Music Box','Kalimba','Handpan','Tubular Bells','Steel Drum'] },
  { emoji:'🪕', label:'Plucked', presets:['Pluck','Harp','Nylon Guitar','Koto','Sitar','Banjo','Ukulele','Mandolin'] },
  { emoji:'🎸', label:'Guitar',  presets:['Clean Guitar','Jazz Guitar','Funk Strat','Crunch Guitar','Lap Steel'] },
  { emoji:'🎺', label:'Brass',   presets:['Brass Section','French Horn','Trumpet','Flute'] },
  { emoji:'🌍', label:'World',   presets:['Duduk','Erhu','Santur','Oud','Gamelan','Didgeridoo','Shamisen','Kora'] },
  { emoji:'🌌', label:'Ambient', presets:['Texture','Atmosphere','Shimmer','Sweep FX'] },
];

// Snapshot tab is a special synthetic category in the patches panel
PRESET_CATEGORIES.push({ emoji:'📸', label:'Snaps', presets:[] });

// Which category tab is currently open
let activePatchCategory = 'Keys';

// ════════════════════════════════════════════════════════
//  FIXED QUALITY COLORS  (mode does not affect colors)
//  Major = Green · Minor = Yellow · Dim = Orange · Sus = White
// ════════════════════════════════════════════════════════

function modeKeyStyle(quality) {
  // Alpha tuned for light (white) background
  const Q = {
    major:      { bg:'rgba(34,197,94,0.14)',   border:'rgba(34,197,94,0.45)',   led:'#22c55e', glow:'rgba(34,197,94,0.35)'  },
    minor:      { bg:'rgba(202,138,4,0.12)',    border:'rgba(202,138,4,0.42)',   led:'#ca8a04', glow:'rgba(202,138,4,0.32)'  },
    diminished: { bg:'rgba(249,115,22,0.13)',   border:'rgba(249,115,22,0.44)',  led:'#f97316', glow:'rgba(249,115,22,0.34)' },
    dominant:   { bg:'rgba(251,146,60,0.11)',   border:'rgba(251,146,60,0.38)',  led:'#fb923c', glow:'rgba(251,146,60,0.30)' },
    suspended:  { bg:'rgba(100,116,139,0.10)',  border:'rgba(100,116,139,0.35)', led:'#64748b', glow:'rgba(100,116,139,0.28)' },
    augmented:  { bg:'rgba(168,85,247,0.11)',   border:'rgba(168,85,247,0.38)',  led:'#a855f7', glow:'rgba(168,85,247,0.32)' },
    default:    { bg:'rgba(0,0,0,0.02)',        border:'rgba(0,0,0,0.12)',       led:'#9090aa', glow:'rgba(0,0,0,0.10)'      },
  };
  return Q[quality] || Q.default;
}

// ════════════════════════════════════════════════════════
//  MOBILE SELECTS  (replaces canvas drum-roller on ≤700px)
// ════════════════════════════════════════════════════════

function buildMobileSelects() {
  const rootSel  = document.getElementById('mobileRootSelect');
  const scaleSel = document.getElementById('mobileScaleSelect');
  if (!rootSel || !scaleSel) return;

  CIRCLE_ORDER.forEach((note, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = note;
    rootSel.appendChild(opt);
  });
  MODES.forEach((mode, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = mode;
    scaleSel.appendChild(opt);
  });

  rootSel.addEventListener('change', () => {
    if (!circle) return;
    circle.rootIdx = parseInt(rootSel.value);
    circle.noteRot = -circle.rootIdx * (Math.PI * 2 / CIRCLE_ORDER.length);
    circle.draw();
    circle.onChange(0);
  });
  scaleSel.addEventListener('change', () => {
    if (!circle) return;
    circle.modeIdx = parseInt(scaleSel.value);
    circle.modeRot = -circle.modeIdx * (Math.PI * 2 / MODES.length);
    circle.draw();
    circle.onChange(0);
  });
}

function syncMobileSelects() {
  if (!circle) return;
  const rootSel  = document.getElementById('mobileRootSelect');
  const scaleSel = document.getElementById('mobileScaleSelect');
  if (rootSel)  rootSel.value  = circle.rootIdx;
  if (scaleSel) scaleSel.value = circle.modeIdx;
}

// ════════════════════════════════════════════════════════
//  BUILD KEY PADS
// ════════════════════════════════════════════════════════

function _meterPips(value, max) {
  let html = '';
  for (let i = 0; i < max; i++) {
    html += `<div class="meter-pip${i < value ? ' on' : ''}"></div>`;
  }
  return html;
}

function buildKeys() {
  const scaleRow = document.getElementById('scaleRow');
  const extRow   = document.getElementById('extRow');
  const oct2Row  = document.getElementById('oct2Row');
  scaleRow.innerHTML = ''; extRow.innerHTML = '';
  if (oct2Row) oct2Row.innerHTML = '';
  keyEls.length = 0; keyEls2.length = 0; keyOctKnobs.length = 0; keyFlvKnobs.length = 0;

  // 8 scale keys (0-7): 7 diatonic chords + octave root (key 8)
  // 4 extension keys (8-11)
  for (let i = 0; i < 12; i++) {
    const isExt = i >= 8;
    const row   = isExt ? extRow : scaleRow;

    const d = document.createElement('div');
    d.className = 'key' + (isExt ? ' ext-key' : '');

    const led      = document.createElement('div');
    led.className  = 'key-led';

    const mood     = document.createElement('div');
    mood.className = 'key-mood';

    const cname    = document.createElement('div');
    cname.className = 'key-chord-name';
    cname.textContent = '—';

    const roman    = document.createElement('div');
    roman.className = 'key-roman';

    const shortcut = document.createElement('div');
    shortcut.className = 'key-shortcut';
    shortcut.textContent = KEY_SHORTCUTS[i];

    // OCT knob — left side of note name
    const octSlot = document.createElement('div');
    octSlot.className = 'mini-knob-slot';
    const octKnob = new RotaryKnob(octSlot, {
      min: -2, max: 2,
      default: 0,
      snapValues: [-2, -1, 0, 1, 2],
      snapLabels: ['-2', '-1', '0', '+1', '+2'],
      label: 'oct',
      size: 28,
      arcColor: '#44ff88',
      sensitivity: 1,
      onChange: v => {
        keyConfigs[i]._userDelta = Math.round(v);
        updateKeyLabels(0);
        scheduleSave();
      },
    });
    keyOctKnobs.push(octKnob);

    // FLV knob — right side of note name
    const flvSlot = document.createElement('div');
    flvSlot.className = 'mini-knob-slot';
    const flvKnob = new RotaryKnob(flvSlot, {
      min: 0, max: KCP_FLAVOURS.length - 1,
      default: 0,
      snapValues: KCP_FLAVOURS.map((_, idx) => idx),
      snapLabels: KCP_LABELS,
      label: 'flv',
      size: 28,
      arcColor: '#6366f1',
      sensitivity: 1,
      format: v => KCP_LABELS[Math.round(v)].slice(0, 3),
      onChange: v => {
        keyConfigs[i].flavour = KCP_FLAVOURS[Math.round(v)];
        scheduleSave();
      },
    });
    keyFlvKnobs.push(flvKnob);

    // Center row: [oct] [name+roman] [flv] — fills the key's vertical space
    const nameGroup = document.createElement('div');
    nameGroup.className = 'key-name-group';
    nameGroup.appendChild(cname);
    nameGroup.appendChild(roman);

    const centerRow = document.createElement('div');
    centerRow.className = 'key-center-row';
    centerRow.appendChild(octSlot);
    centerRow.appendChild(nameGroup);
    centerRow.appendChild(flvSlot);

    const tooltip = document.createElement('div');
    tooltip.className = 'key-tooltip';

    const voiceDot = document.createElement('div');
    voiceDot.className = 'key-voice-dot';

    // Inline voicing controls — always visible in the key's empty space
    const keyVoicePanel = document.createElement('div');
    keyVoicePanel.className = 'key-voice-panel';
    const keyToneRow = document.createElement('div');
    keyToneRow.className = 'key-voice-tones';
    const keyExtRow = document.createElement('div');
    keyExtRow.className = 'key-voice-exts';
    const keyInvRow = document.createElement('div');
    keyInvRow.className = 'key-voice-inv';
    keyVoicePanel.appendChild(keyToneRow);
    keyVoicePanel.appendChild(keyExtRow);
    keyVoicePanel.appendChild(keyInvRow);

    d.appendChild(led);
    d.appendChild(mood);
    d.appendChild(centerRow);
    d.appendChild(keyVoicePanel);
    d.appendChild(shortcut);
    d.appendChild(voiceDot);
    d.appendChild(tooltip);

    d.addEventListener('mousedown', e => {
      if (e.target.closest('.mini-knob-slot') || e.target.closest('.key-vp-btn')) return;
      if (e.button === 0) onKeyDown(i);
    });
    d.addEventListener('mouseup',    e => { if (e.button === 0) onKeyUp(i); });
    d.addEventListener('mouseleave', () => onKeyUp(i));

    let _lpTimer = null;
    d.addEventListener('touchstart',  e => {
      if (e.target.closest('.mini-knob-slot') || e.target.closest('.key-vp-btn')) return;
      e.preventDefault();
      unlockAudio();
      onKeyDown(i);
      _lpTimer = setTimeout(() => {
        _lpTimer = null;
        onKeyUp(i);
        showVoiceEditorSheet(i);
      }, 650);
    }, {passive: false});
    d.addEventListener('touchend',   e => {
      e.preventDefault();
      clearTimeout(_lpTimer); _lpTimer = null;
      onKeyUp(i);
    }, {passive: false});
    d.addEventListener('touchcancel', e => {
      clearTimeout(_lpTimer); _lpTimer = null;
      onKeyUp(i);
    }, {passive: false});

    row.appendChild(d);
    keyEls.push(d);
  }

  // ── Oct2 cards — simple cards for locked-mode second octave ──
  if (oct2Row) {
    const OCT2_SHORTCUTS = ['a','s','d','f','z','x','c','v'];
    for (let i = 0; i < 8; i++) {
      const d2 = document.createElement('div');
      d2.className = 'key';

      const led2 = document.createElement('div');
      led2.className = 'key-led';

      const mood2 = document.createElement('div');
      mood2.className = 'key-mood';

      const cname2 = document.createElement('div');
      cname2.className = 'key-chord-name';
      cname2.textContent = '—';

      const roman2 = document.createElement('div');
      roman2.className = 'key-roman';

      const shortcut2 = document.createElement('div');
      shortcut2.className = 'key-shortcut';
      shortcut2.textContent = OCT2_SHORTCUTS[i];

      const nameGroup2 = document.createElement('div');
      nameGroup2.className = 'key-name-group';
      nameGroup2.appendChild(cname2);
      nameGroup2.appendChild(roman2);

      const centerRow2 = document.createElement('div');
      centerRow2.className = 'key-center-row';
      centerRow2.appendChild(nameGroup2);

      d2.appendChild(led2);
      d2.appendChild(mood2);
      d2.appendChild(centerRow2);
      d2.appendChild(shortcut2);

      d2.addEventListener('mousedown', e => { if (e.button === 0) onKeyDown(i, 1); });
      d2.addEventListener('mouseup',    e => { if (e.button === 0) onKeyUp(i, 1); });
      d2.addEventListener('mouseleave', () => onKeyUp(i, 1));

      let _lp2 = null;
      d2.addEventListener('touchstart', e => {
        e.preventDefault(); unlockAudio();
        onKeyDown(i, 1);
        _lp2 = setTimeout(() => { _lp2 = null; onKeyUp(i, 1); }, 650);
      }, {passive: false});
      d2.addEventListener('touchend',   e => { e.preventDefault(); clearTimeout(_lp2); _lp2 = null; onKeyUp(i, 1); }, {passive: false});
      d2.addEventListener('touchcancel',e => { clearTimeout(_lp2); _lp2 = null; onKeyUp(i, 1); }, {passive: false});

      oct2Row.appendChild(d2);
      keyEls2.push(d2);
    }
  }
}

// ════════════════════════════════════════════════════════
//  KEY LABEL + TOOLTIP UPDATES
//  dir: +1 = clockwise (slide from right), -1 = CCW (slide from left), 0 = no animation
// ════════════════════════════════════════════════════════

function computeAscendingOctOffsets(rootNoteIdx, modeName) {
  const ivl   = MODE_INTERVALS[modeName];
  const notes = ivl.map(interval => (rootNoteIdx + interval) % 12);
  let level   = 0;
  return notes.map((note, i) => {
    if (i > 0 && note <= notes[i - 1]) level++;
    return level;
  });
}

function updateRelDisplay() {
  const rels = getRelatives(circle.rootNote, circle.modeName);
  const majEl = document.getElementById('relMaj');
  const minEl = document.getElementById('relMin');
  if (majEl) majEl.textContent = rels.major;
  if (minEl) minEl.textContent = rels.minor;
}

function updateKeyLabels(dir = 0) {
  const rootIdx  = circle.rootNoteIdx;
  const modeName = circle.modeName;
  const ivl      = MODE_INTERVALS[modeName];
  const quals    = CHORD_QUALITIES[modeName];
  const moods    = MOOD_WORDS[modeName] || [];
  const descs    = CHORD_DESCRIPTIONS[modeName] || [];

  // Phosphor display
  if (typeof window._teachHook === 'function') window._teachHook({ type: 'keyChange' });
  document.getElementById('rootLabel').textContent  = circle.rootNote;
  const scaleLabelEl = document.getElementById('scaleLabel');
  scaleLabelEl.textContent    = formatScaleName(modeName);
  scaleLabelEl.dataset.info   = 'scale_' + modeName;
  const summaryEl = document.getElementById('circleSummaryText');
  if (summaryEl) summaryEl.textContent = circle.rootNote + ' · ' + modeName;

  if (playMode === 'chord') {
    const autoOffsets = computeAscendingOctOffsets(rootIdx, modeName);

    for (let i = 0; i < 7; i++) {
      const crIdx     = (rootIdx + ivl[i]) % 12;
      const q         = quals[i];
      const userDelta = keyConfigs[i]._userDelta || 0;
      keyConfigs[i].octOffset = autoOffsets[i] + userDelta;
      setKeyDisplay(i, getRoman(i, q), NOTES[crIdx], q, moods[i] || '', descs[i] || null);
    }

    // Key 7 = octave root (I chord + 1 oct)
    // octAdj=1 is added in onKeyDown, so octOffset must stay at user delta only.
    keyConfigs[7].octOffset = keyConfigs[7]._userDelta || 0;
    const crIdxOct = (rootIdx + ivl[0]) % 12;
    setKeyDisplay(7, 'I+8', NOTES[crIdxOct], quals[0], 'RISE', null, false, true);

    EXTENSION_CONFIGS.forEach((cfg, ei) => {
      // Extension keys inherit the auto-offset of their chord degree so they sit
      // at the same pitch level as the matching diatonic key (not carried over
      // from scale mode where they were boosted by +1).
      keyConfigs[8 + ei].octOffset = autoOffsets[cfg.degree] + (keyConfigs[8 + ei]._userDelta || 0);
      const crIdx = (rootIdx + ivl[cfg.degree]) % 12;
      setKeyDisplay(8 + ei,
        getRoman(cfg.degree, quals[cfg.degree]),
        NOTES[crIdx] + cfg.suffix,
        cfg.quality,
        EXT_MOOD_WORDS[ei] || '',
        null
      );
    });
  } else if (playMode === 'scale') {
    // Individual scale notes — ascending by octave offset, same logic as chord mode
    const autoOffsets = computeAscendingOctOffsets(rootIdx, modeName);
    for (let i = 0; i < 7; i++) {
      const semitone = (rootIdx + ivl[i]) % 12;
      keyConfigs[i].octOffset = autoOffsets[i] + (keyConfigs[i]._userDelta || 0);
      setKeyDisplay(i, getRoman(i, 'default'), NOTES[semitone], 'default', 'note', null);
    }
    const rootSemitone = (rootIdx + ivl[0]) % 12;
    keyConfigs[7].octOffset = autoOffsets[0] + 1 + (keyConfigs[7]._userDelta || 0);
    setKeyDisplay(7, '+8', NOTES[rootSemitone], 'default', 'RISE', null, false, true);
    for (let i = 0; i < 4; i++) {
      const semitone = (rootIdx + ivl[i % ivl.length]) % 12;
      keyConfigs[8 + i].octOffset = autoOffsets[i] + 1 + (keyConfigs[8 + i]._userDelta || 0);
      setKeyDisplay(8 + i, '', NOTES[semitone], 'default', '', null);
    }
    // Mirror visual state to oct2 cards
    for (let i = 0; i < Math.min(8, keyEls2.length); i++) {
      const e1 = keyEls[i], e2 = keyEls2[i];
      e2.querySelector('.key-chord-name').textContent = e1.querySelector('.key-chord-name').textContent;
      e2.querySelector('.key-roman').textContent      = e1.querySelector('.key-roman').textContent;
      e2.querySelector('.key-mood').textContent       = e1.querySelector('.key-mood').textContent;
      e2.style.backgroundColor = e1.style.backgroundColor;
      e2.style.borderColor     = e1.style.borderColor;
      e2.style.setProperty('--key-glow', e1.style.getPropertyValue('--key-glow'));
      const l1 = e1.querySelector('.key-led'), l2 = e2.querySelector('.key-led');
      if (l1 && l2) { l2.style.background = l1.style.background; l2.style.boxShadow = l1.style.boxShadow; }
    }
  } else {
    // Free mode — all 12 chromatic notes
    for (let i = 0; i < 12; i++) {
      setKeyDisplay(i, '', NOTES[(rootIdx + i) % 12], 'default', '', null);
      keyConfigs[i].octOffset = 0;
    }
  }

  syncMobileSelects();
}

function _slideKeys(dir) {
  // dir +1 (clockwise) = new note came from right → slide labels in from right
  // dir -1 (CCW)       = new note came from left  → slide labels in from left
  const cls = dir > 0 ? 'slide-from-right' : 'slide-from-left';
  keyEls.forEach(el => {
    const content = el.querySelector('.key-chord-name');
    const moodEl  = el.querySelector('.key-mood');
    [content, moodEl].forEach(target => {
      if (!target) return;
      target.classList.remove('slide-from-left', 'slide-from-right');
      // Force reflow so re-adding the class triggers the animation
      void target.offsetWidth;
      target.classList.add(cls);
    });
  });
}

function formatScaleName(modeName) {
  const common = {
    Ionian: 'Major', Aeolian: 'Minor',
    Dorian: 'Dorian Minor', Mixolydian: 'Dom. 7th',
  };
  return common[modeName] ? `${modeName} (${common[modeName]})` : modeName;
}

function setKeyDisplay(i, roman, name, quality, mood, desc, _unused, isOctRoot = false) {
  const el = keyEls[i];
  el.querySelector('.key-roman').textContent      = roman;
  el.querySelector('.key-chord-name').textContent = name;
  el.querySelector('.key-mood').textContent        = mood;

  // Fixed quality colors — green/yellow/orange/white regardless of mode
  const style = modeKeyStyle(quality);
  el.style.backgroundColor = style.bg;
  el.style.borderColor     = style.border;
  el.style.setProperty('--key-glow', style.glow);

  const ledEl = el.querySelector('.key-led');
  ledEl.style.background = style.led;
  ledEl.style.boxShadow  = `0 0 6px ${style.glow}`;

  // Info-mode data attributes — updated each time labels change
  el.dataset.info        = 'chord_' + quality;
  el.dataset.chordName   = name;
  el.dataset.chordRoman  = roman;
  el.dataset.chordMood   = mood;
  el.dataset.chordQuality = quality;

  // Keep quality class only for the pressed depth shadow (glow handled via CSS var)
  const qClass = {
    major: 'q-major', minor: 'q-minor', diminished: 'q-diminished',
    dominant: 'q-dominant', augmented: 'q-augmented',
  }[quality] || 'q-default';
  const baseClasses = ['key', qClass];
  if (i >= 8) baseClasses.push('ext-key');
  if (isOctRoot) baseClasses.push('oct-root-key');
  const kc = keyConfigs[i];
  if (kc && (kc.omit.length || kc.add.length)) baseClasses.push('voice-custom');
  el.className = baseClasses.join(' ');

  // Tooltip
  const tip = el.querySelector('.key-tooltip');
  if (desc) {
    tip.innerHTML = `
      <div class="tooltip-header">${roman} · ${name} · ${mood}</div>
      <div class="tooltip-desc">${desc.long}</div>
      <div class="tooltip-meters">
        <div class="tooltip-meter">
          <span class="tooltip-meter-label">STABLE</span>
          <div class="tooltip-meter-bar">${_meterPips(desc.stable, 5)}</div>
        </div>
        <div class="tooltip-meter">
          <span class="tooltip-meter-label">TENSION</span>
          <div class="tooltip-meter-bar">${_meterPips(desc.tension, 5)}</div>
        </div>
        <div class="tooltip-meter">
          <span class="tooltip-meter-label">BRIGHT</span>
          <div class="tooltip-meter-bar">${_meterPips(desc.bright, 5)}</div>
        </div>
      </div>`;
    tip.style.display = '';
  } else {
    tip.style.display = 'none';
  }

  try { updateKeyVoiceRows(i); } catch(e) { console.error('updateKeyVoiceRows', i, e); }
}

function updateKeyVoiceRows(i) {
  const el = keyEls[i];
  if (!el) return;
  const kc       = keyConfigs[i];
  const toneRow  = el.querySelector('.key-voice-tones');
  const extRow   = el.querySelector('.key-voice-exts');
  const invRow   = el.querySelector('.key-voice-inv');
  if (!toneRow || !extRow) return;

  // ── OMIT row: triad base + 7th if FLV quality has one + any added b7/7 ─
  toneRow.innerHTML = '';
  const omitDegrees = [
    { label: 'R',  deg: '1', type: 'base' },
    { label: '3',  deg: '3', type: 'base' },
    { label: '5',  deg: '5', type: 'base' },
  ];
  const flvQuality = kc.flavour && QUALITY_CHROMATIC[kc.flavour];
  if (flvQuality && flvQuality.length >= 4) {
    omitDegrees.push({ label: '7', deg: '7', type: 'base' });
  }
  // For extension chord keys, show their structural extra tone (b7, 7, 9 etc.) as a locked pill
  if (i >= 8) {
    const extCfg = EXTENSION_CONFIGS[i - 8];
    const qualToExt = { dominant: { '7th':'b7','9th':'9' }, major: { '7th':'7','9th':'9' }, minor: { '7th':'b7','9th':'9' } };
    const qmap = (extCfg && qualToExt[extCfg.quality]) || {};
    (extCfg?.extra || []).forEach(t => {
      const lbl = qmap[t];
      if (lbl && !omitDegrees.find(d => d.label === lbl))
        omitDegrees.push({ label: lbl, deg: null, type: 'structural' });
    });
  }

  // All manually-added extensions surface in the tones row so they're visible and removable
  ['b7','7','b9','9','#9','#11','b13','13'].forEach(extLabel => {
    if (kc.add.includes(extLabel) && !omitDegrees.find(d => d.label === extLabel))
      omitDegrees.push({ label: extLabel, deg: null, type: 'ext', ext: extLabel });
  });
  omitDegrees.forEach(({ label, deg, type, ext }) => {
    const isOmitted = type === 'base' && kc.omit.includes(deg);
    const btn = document.createElement('button');
    if (type === 'structural') {
      btn.className = 'key-vp-btn key-vp-omit key-vp-structural on';
      btn.title = 'Built-in chord tone';
    } else {
      btn.className = 'key-vp-btn key-vp-omit' + (isOmitted ? ' off' : ' on');
      btn.title = type === 'ext' ? 'Click to remove' : (isOmitted ? 'Click to include' : 'Click to omit');
    }
    btn.textContent = label;
    btn.addEventListener('mousedown', e => e.stopPropagation());
    if (type !== 'structural') {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (type === 'ext') {
          kc.add = kc.add.filter(x => x !== ext);
        } else {
          if (isOmitted) kc.omit = kc.omit.filter(x => x !== deg);
          else           kc.omit = [...kc.omit, deg];
        }
        scheduleSave();
        updateKeyVoiceRows(i);
        const qClass = el.className.replace(' voice-custom', '');
        el.className = (kc.omit.length || kc.add.length) ? qClass + ' voice-custom' : qClass;
      });
    }
    toneRow.appendChild(btn);
  });

  // ── ADD row: 7ths and chromatic extensions ────────────
  extRow.innerHTML = '';
  const EXT_ORDER = ['b7','7','b9','9','#9','#11','b13','13'];
  const _quality = el.dataset.chordQuality || 'default';
  const _naturalExts = NATURAL_EXTENSIONS[_quality] || NATURAL_EXTENSIONS.default || [];
  EXT_ORDER.forEach(ext => {
    const added = kc.add.includes(ext);
    const isNatural = _naturalExts.includes(ext);
    const btn = document.createElement('button');
    btn.className = 'key-vp-btn key-vp-ext' + (added ? ' on' : '') + (isNatural ? ' natural' : '');
    btn.title     = added ? 'Click to remove' : 'Click to add';
    btn.textContent = ext;
    btn.addEventListener('mousedown', e => e.stopPropagation());
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (added) kc.add = kc.add.filter(x => x !== ext);
      else       kc.add = [...kc.add, ext];
      scheduleSave();
      updateKeyVoiceRows(i);
      const qClass = el.className.replace(' voice-custom', '');
      el.className = (kc.omit.length || kc.add.length) ? qClass + ' voice-custom' : qClass;
    });
    extRow.appendChild(btn);
  });

  // ── INVERSION row ─────────────────────────────────────
  if (invRow) {
    invRow.innerHTML = '';
    const currentInv = kc.inversion || 0;
    [['R',0],['1st',1],['2nd',2],['3rd',3]].forEach(([label, n]) => {
      const btn = document.createElement('button');
      btn.className = 'key-vp-btn key-vp-inv' + (n === currentInv ? ' active' : '');
      btn.textContent = label;
      btn.title = n === 0 ? 'Root position' : `${label} inversion`;
      btn.addEventListener('mousedown', e => e.stopPropagation());
      btn.addEventListener('click', e => {
        e.stopPropagation();
        kc.inversion = n;
        scheduleSave();
        updateKeyVoiceRows(i);
        if (typeof window.chordInspector !== 'undefined') window.chordInspector.refresh();
      });
      invRow.appendChild(btn);
    });
  }
}

// ════════════════════════════════════════════════════════
//  PLAY
// ════════════════════════════════════════════════════════

function onKeyDown(idx, extraOct = 0) {
  const keyId = makeKeyId(idx, extraOct);

  // Latch mode: tap once to hold, tap same key again to release.
  if (latchMode) {
    if (latchedKeys.has(keyId)) {
      latchedKeys.delete(keyId);
      heldKeys.delete(keyId);
      if (typeof stopKeyAudio === 'function') stopKeyAudio(keyId);
      if (heldKeys.size === 0 && typeof circle !== 'undefined' && circle.setChordNotes) circle.setChordNotes([]);
      const el = extraOct === 1 ? keyEls2[idx] : keyEls[idx];
      if (el) el.classList.remove('pressed');
      return;
    }
    latchedKeys.add(keyId);
  }

  if (heldKeys.has(keyId)) return; // already held — don't retrigger
  heldKeys.add(keyId);

  const _pressEl = extraOct === 1 ? keyEls2[idx] : keyEls[idx];
  if (_pressEl) _pressEl.classList.add('pressed');
  if (typeof window._teachHook === 'function') window._teachHook({ type: 'chord', idx });

  const keyCfg = keyConfigs[idx];
  const modOct = modifiers.octUp ? 1 : (modifiers.octDown ? -1 : 0);
  const effectiveOctave  = currentOctave + keyCfg.octOffset + modOct + extraOct;
  const effectiveFlavour = keyCfg.flavour !== null ? keyCfg.flavour : activeFlavour;

  const _playAndNotify = (freqs) => {
    playFreqs(freqs, { keyId });
    if (typeof circle !== 'undefined' && circle.setChordNotes) {
      const pcs = freqs.map(f => ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12);
      circle.setChordNotes(pcs);
    }
    if (typeof window._looperOnKeyDown === 'function')
      window._looperOnKeyDown({ idx, frequencies: freqs,
        rootNoteIdx: circle.rootNoteIdx, modeName: circle.modeName,
        octave: effectiveOctave, flavour: effectiveFlavour,
        lockedMode: playMode === 'chord', playMode });
  };

  if (playMode === 'chord') {
    if (typeof window.chordInspector !== 'undefined') window.chordInspector.show(idx);

    const rootIdx  = circle.rootNoteIdx;
    const modeName = circle.modeName;
    const ivl      = MODE_INTERVALS[modeName];

    // Resolve chord degree and octave adjustment for the pressed key
    let chordDeg, octAdj, extraTones;
    if (idx < 7) {
      chordDeg = idx; octAdj = 0; extraTones = modifiers.extension ? ['7th'] : [];
    } else if (idx === 7) {
      chordDeg = 0;   octAdj = 1; extraTones = modifiers.extension ? ['7th'] : [];
    } else {
      const cfg = EXTENSION_CONFIGS[idx - 8];
      chordDeg = keyCfg.degree !== null ? keyCfg.degree : cfg.degree;
      octAdj = 0; extraTones = cfg.extra;
    }

    const kInv = keyCfg.inversion || 0;
    const chordRootNote = (rootIdx + ivl[((chordDeg % 7) + 7) % 7]) % 12;
    const chordRootMidi = 12 * (effectiveOctave + octAdj) + chordRootNote;

    if (effectiveFlavour && QUALITY_CHROMATIC[effectiveFlavour]) {
      let ivs;
      if (keyCfg.omit.length || keyCfg.add.length) {
        ivs = resolveKeyIntervals(effectiveFlavour, keyCfg.omit, keyCfg.add, modifiers.extension);
      } else {
        ivs = [...QUALITY_CHROMATIC[effectiveFlavour]];
        if (modifiers.extension && ivs.every(iv => iv !== 10 && iv !== 11)) ivs.push(10);
      }
      if (kInv) ivs = applyInversion(ivs, kInv);
      _playAndNotify([...new Set(ivs.map(iv => chordRootMidi + iv))].map(midiToFreq));
    } else {
      if (keyCfg.omit.length || keyCfg.add.length || kInv) {
        // Diatonic with voicing overrides or inversion: compute triad intervals explicitly
        const OMIT_LABELS = ['1', '3', '5'];
        let ivs = [0, 2, 4].map((offset, pos) => {
          const di = ((chordDeg + offset) % 7 + 7) % 7;
          return (ivl[di] - ivl[((chordDeg % 7) + 7) % 7] + 12) % 12;
        }).filter((_, pos) => !keyCfg.omit.includes(OMIT_LABELS[pos]));
        const extIvls = keyCfg.add.flatMap(ext => {
          const st = EXTENSION_SEMITONES[ext];
          return (st != null && !ivs.includes(st)) ? [st] : [];
        });
        ivs = [...new Set([...ivs, ...extIvls])].sort((a, b) => a - b);
        if (kInv) ivs = applyInversion(ivs, kInv);
        _playAndNotify(ivs.map(iv => chordRootMidi + iv).map(midiToFreq));
      } else {
        const voicing = effectiveFlavour
          ? Object.assign({}, defaultVoicing, FLAVOUR_VOICING[effectiveFlavour] || {})
          : defaultVoicing;
        _playAndNotify(getChordFreqs(rootIdx, modeName, chordDeg, effectiveOctave + octAdj, voicing, extraTones));
      }
    }
  } else if (playMode === 'scale') {
    // Scale-locked: ascending offset already baked into effectiveOctave via keyConfigs[idx].octOffset
    const rootIdx  = circle.rootNoteIdx;
    const modeName = circle.modeName;
    const ivl      = MODE_INTERVALS[modeName];
    const degIdx   = idx <= 6 ? idx : (idx === 7 ? 0 : idx - 8);
    const semitone = (rootIdx + ivl[degIdx % ivl.length]) % 12;
    const scaleMidi = 12 * effectiveOctave + semitone;
    if (typeof window.chordInspector !== 'undefined')
      window.chordInspector.showNote(scaleMidi, NOTES[semitone]);
    _playAndNotify([midiToFreq(scaleMidi)]);
  } else {
    // Free mode — chromatic individual notes
    const rootIdx = circle.rootNoteIdx;
    const freePc  = (rootIdx + idx) % 12;
    const freeMidi = 12 * effectiveOctave + freePc;
    if (typeof window.chordInspector !== 'undefined')
      window.chordInspector.showNote(freeMidi, NOTES[freePc]);
    _playAndNotify([getNoteFreq(rootIdx, idx, effectiveOctave)]);
  }
}

function onKeyUp(idx, extraOct = 0) {
  const keyId = makeKeyId(idx, extraOct);

  // Stale release guard: mouseleave fires after mouseup already cleaned up,
  // and physical keyup fires after applyPreset clears heldKeys. Calling
  // stopKeyAudio with a stale keyId poisons pendingStops and kills the next press.
  if (!heldKeys.has(keyId)) {
    const _staleEl = extraOct === 1 ? keyEls2[idx] : keyEls[idx];
    if (_staleEl) _staleEl.classList.remove('pressed');
    return;
  }

  // In latch mode, key-up does nothing — key stays held until tapped again.
  if (latchMode && latchedKeys.has(keyId)) return;

  const _pressEl = extraOct === 1 ? keyEls2[idx] : keyEls[idx];
  if (_pressEl) _pressEl.classList.remove('pressed');

  heldKeys.delete(keyId);
  if (typeof stopKeyAudio === 'function') stopKeyAudio(keyId);

  if (heldKeys.size === 0 && typeof circle !== 'undefined' && circle.setChordNotes) {
    circle.setChordNotes([]);
  }

  if (typeof window._looperOnKeyUp === 'function') window._looperOnKeyUp(idx);
}

// ════════════════════════════════════════════════════════
//  MODE / OCTAVE
// ════════════════════════════════════════════════════════

function setMode(mode) {
  playMode = mode;
  ['chord','scale','free'].forEach(m => {
    document.getElementById(m + 'Opt')?.classList.toggle('active', m === mode);
  });
  const mc = document.getElementById('mobChordBtn');
  const ms = document.getElementById('mobScaleBtn');
  const mf = document.getElementById('mobFreeBtn');
  if (mc) mc.classList.toggle('active', mode === 'chord');
  if (ms) ms.classList.toggle('active', mode === 'scale');
  if (mf) mf.classList.toggle('active', mode === 'free');

  const locked = mode === 'scale';
  document.body.classList.toggle('mode-locked', locked);

  const extDivider  = document.getElementById('extDivider');
  const extSection  = document.getElementById('extSection');
  const oct2Divider = document.getElementById('oct2Divider');
  const oct2Section = document.getElementById('oct2Section');
  const scaleRowHint = document.getElementById('scaleRowHint');

  const extChevron = document.getElementById('extDividerChevron');
  if (locked) {
    if (extDivider)  extDivider.style.display = 'none';
    if (extSection)  extSection.style.display = 'none';
  } else if (mode === 'chord') {
    extSectionOpen = false;
    if (extDivider)  extDivider.style.display = '';
    if (extSection)  extSection.style.display = 'none';
    if (extChevron)  extChevron.textContent = '▶';
  } else {
    // free mode — ext section always visible
    if (extDivider)  extDivider.style.display = '';
    if (extSection)  extSection.style.display = '';
    if (extChevron)  extChevron.textContent = '▼';
  }
  if (oct2Divider) oct2Divider.style.display  = locked ? ''     : 'none';
  if (oct2Section) oct2Section.style.display  = locked ? ''     : 'none';
  if (scaleRowHint) scaleRowHint.textContent  = locked ? ' · Octave 1 · 1 2 3 4 Q W E R' : ' · 1 2 3 4 · Q W E R';

  updateKeyLabels();
  scheduleSave();
}

function changeOct(delta) {
  currentOctave = Math.max(1, Math.min(8, currentOctave + delta));
  if (octaveKnob) octaveKnob.setValue(currentOctave, false);
}

// Voicing overrides per flavour
const FLAVOUR_VOICING = {
  // ── Existing ────────────────────────────────────────────
  'maj':   {'1':true, '3':true,  '5':true,  '7':false, '9':false, '11':false},
  'min':   {'1':true, '3':true,  '5':true,  '7':false, '9':false, '11':false},
  '7':     {'1':true, '3':true,  '5':true,  '7':true,  '9':false, '11':false},
  'maj7':  {'1':true, '3':true,  '5':true,  '7':true,  '9':false, '11':false},
  'min7':  {'1':true, '3':true,  '5':true,  '7':true,  '9':false, '11':false},
  'sus2':  {'1':true, '3':false, '5':true,  '7':false, '9':true,  '11':false},
  'sus4':  {'1':true, '3':false, '5':true,  '7':false, '9':false, '11':true },
  'add9':  {'1':true, '3':true,  '5':true,  '7':false, '9':true,  '11':false},
  'dim':   {'1':true, '3':true,  '5':true,  '7':false, '9':false, '11':false},
  'aug':   {'1':true, '3':true,  '5':true,  '7':false, '9':false, '11':false},
  // ── New — quality grid row 2 & 3 ─────────────────────────
  'augM7': {'1':true, '3':true,  '5':true,  '7':true,  '9':false, '11':false}, // aug + maj7
  'aug7':  {'1':true, '3':true,  '5':true,  '7':true,  '9':false, '11':false}, // aug + dom7
  '7sus4': {'1':true, '3':false, '5':true,  '7':true,  '9':false, '11':true }, // sus4 + dom7
  'dim7':  {'1':true, '3':true,  '5':true,  '7':true,  '9':false, '11':false}, // fully dim
  'hdim7': {'1':true, '3':true,  '5':true,  '7':true,  '9':false, '11':false}, // half-dim ø7
  'min9':  {'1':true, '3':true,  '5':true,  '7':true,  '9':true,  '11':false}, // min9
};

// ════════════════════════════════════════════════════════
//  GLOBAL KNOBS (ADSR + FILTER)
// ════════════════════════════════════════════════════════

function buildGlobalKnobs() {
  const knobSize = 52;
  const arc = '#44ff88';

  new RotaryKnob(document.getElementById('masterVolKnob'), {
    min: 0, max: 1, default: 0.72,
    label: 'Vol', size: 44, arcColor: arc,
    format: v => Math.round(v * 100) + '%',
    onChange: v => setAudioParam('masterVol', v),
  });

  octaveKnob = new RotaryKnob(document.getElementById('octaveKnob'), {
    min: 1, max: 8, default: 4,
    snapValues: [1,2,3,4,5,6,7,8],
    label: '', size: 42, arcColor: arc,
    format: v => String(Math.round(v)),
    onChange: v => { currentOctave = Math.round(v); scheduleSave(); },
  });

  atkKnob = new RotaryKnob(document.getElementById('atkKnob'), {
    min: 0, max: 2000, default: 0,
    label: 'ATK', size: knobSize, arcColor: arc,
    format: v => v < 1000 ? Math.round(v) + 'ms' : (v/1000).toFixed(1) + 's',
    onChange: v => setAudioParam('attack', v / 1000),
  });
  dcyKnob = new RotaryKnob(document.getElementById('dcyKnob'), {
    min: 0, max: 2000, default: 0,
    label: 'DCY', size: knobSize, arcColor: arc,
    format: v => v < 1000 ? Math.round(v) + 'ms' : (v/1000).toFixed(1) + 's',
    onChange: v => setAudioParam('decay', v / 1000),
  });
  susKnob = new RotaryKnob(document.getElementById('susKnob'), {
    min: 0, max: 1, default: 0,
    label: 'SUS', size: knobSize, arcColor: arc,
    format: v => Math.round(v * 100) + '%',
    onChange: v => setAudioParam('sustain', v),
  });
  relKnob = new RotaryKnob(document.getElementById('relKnob'), {
    min: 0, max: 4000, default: 0,
    label: 'REL', size: knobSize, arcColor: arc,
    format: v => v < 1000 ? Math.round(v) + 'ms' : (v/1000).toFixed(1) + 's',
    onChange: v => setAudioParam('release', v / 1000),
  });

  cutKnob = new RotaryKnob(document.getElementById('cutKnob'), {
    min: 200, max: 12000, default: 0,
    label: 'CUT', size: knobSize, arcColor: '#6366f1',
    format: v => v <= 200 ? 'off' : (v >= 1000 ? (v/1000).toFixed(1) + 'k' : Math.round(v) + 'Hz'),
    onChange: v => setAudioParam('cutoff', v <= 200 ? null : v),
  });
  resKnob = new RotaryKnob(document.getElementById('resKnob'), {
    min: 0.1, max: 18, default: 0.1,
    label: 'RES', size: knobSize, arcColor: '#6366f1',
    format: v => v.toFixed(1),
    onChange: v => setAudioParam('resonance', v),
  });
  warmKnob = new RotaryKnob(document.getElementById('warmKnob'), {
    min: 0, max: 30, default: 0,
    label: 'WARM', size: knobSize, arcColor: '#6366f1',
    format: v => Math.round(v) + 'c',
    onChange: v => setAudioParam('warmth', v),
  });
  revKnob = new RotaryKnob(document.getElementById('revKnob'), {
    min: 0, max: 1, default: 0,
    label: 'REV', size: knobSize, arcColor: '#6366f1',
    format: v => Math.round(v * 100) + '%',
    onChange: v => setAudioParam('reverb', v),
  });

  const charArc = '#e67e22';
  driveKnob = new RotaryKnob(document.getElementById('driveKnob'), {
    min: 0, max: 5, default: 2.0,
    label: 'DRIVE', size: knobSize, arcColor: charArc,
    format: v => v.toFixed(1),
    onChange: v => setAudioParam('drive', v),
  });
  driftKnob = new RotaryKnob(document.getElementById('driftKnob'), {
    min: 0, max: 20, default: 5,
    label: 'DRIFT', size: knobSize, arcColor: charArc,
    format: v => Math.round(v) + '¢',
    onChange: v => setAudioParam('drift', v),
  });
  subKnob = new RotaryKnob(document.getElementById('subKnob'), {
    min: 0, max: 1, default: 0,
    label: 'SUB', size: knobSize, arcColor: charArc,
    format: v => Math.round(v * 100) + '%',
    onChange: v => setAudioParam('sub', v),
  });
  widthKnob = new RotaryKnob(document.getElementById('widthKnob'), {
    min: 0, max: 2, default: 1.0,
    label: 'WIDTH', size: knobSize, arcColor: charArc,
    format: v => Math.round(v * 100) + '%',
    onChange: v => setAudioParam('width', v),
  });
  sweepKnob = new RotaryKnob(document.getElementById('sweepKnob'), {
    min: 1, max: 5, default: 2.0,
    label: 'SWEEP', size: knobSize, arcColor: charArc,
    format: v => v.toFixed(1) + '×',
    onChange: v => setAudioParam('sweep', v),
  });

  const pbArc = '#8b5cf6';   // violet — matches vpc-pb-lbl color
  strumKnob = new RotaryKnob(document.getElementById('strumKnob'), {
    min: 0, max: 50, default: 6,
    label: 'STRUM', size: knobSize, arcColor: pbArc,
    format: v => Math.round(v) === 0 ? 'off' : Math.round(v) + 'ms',
    onChange: v => setAudioParam('strum', v),
  });
  humanizeKnob = new RotaryKnob(document.getElementById('humanizeKnob'), {
    min: 0, max: 10, default: 5,
    label: 'HUMAN', size: knobSize, arcColor: pbArc,
    format: v => v.toFixed(1),
    onChange: v => setAudioParam('humanize', v),
  });
  glideKnob = new RotaryKnob(document.getElementById('glideKnob'), {
    min: 0, max: 300, default: 0,
    label: 'GLIDE', size: knobSize, arcColor: pbArc,
    format: v => v < 1 ? 'off' : Math.round(v) + 'ms',
    onChange: v => setAudioParam('glide', v),
  });
}

// ════════════════════════════════════════════════════════
//  PATCH BANK  (factory presets + user patches)
// ════════════════════════════════════════════════════════

let activePreset = 'Piano';

function applyPreset(name) {
  if (!(name in SOUND_PRESETS)) return;
  const _prevPreset = SOUND_PRESETS[activePreset];
  activePreset = name;
  const summaryName = document.getElementById('patchesSummaryName');
  if (summaryName) {
    const presetCat = PRESET_CATEGORIES.find(c => c.presets.includes(name));
    summaryName.textContent = presetCat ? `${presetCat.emoji} ${name}` : name;
  }
  document.querySelectorAll('.user-patch-btn').forEach(b => b.classList.remove('active'));

  // Auto-switch tab to the category containing this preset, then refresh grid
  const cat = PRESET_CATEGORIES.find(c => c.presets.includes(name));
  if (cat && cat.label !== activePatchCategory) {
    setActivePatchCategory(cat.label);   // this also calls renderPresetGrid
  } else {
    // Already on the right tab — just update active state in the visible grid
    document.querySelectorAll('.preset-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.preset === name));
  }

  // Snap all knobs to this preset's values.
  const d  = PRESET_ANALOG_DEFAULTS[name] ?? {};
  const sp = SOUND_PRESETS[name] ?? {};

  // Helper: snap a knob + set the live audio param
  const snap = (knob, key, v) => {
    setAudioParam(key, v);
    if (knob) knob.setValue(v, false);
  };

  // ── Character (stored in PRESET_ANALOG_DEFAULTS) ───────
  snap(revKnob,   'reverb', d.reverb ?? 0);
  snap(driveKnob, 'drive',  d.drive  ?? 2.0);
  snap(driftKnob, 'drift',  d.drift  ?? 5);
  snap(subKnob,   'sub',    d.sub    ?? 0);
  snap(widthKnob, 'width',  d.width  ?? 1.0);
  snap(sweepKnob, 'sweep',  d.sweep  ?? 2.0);
  snap(warmKnob,  'warmth', d.warmth ?? 0);

  // ── Envelope — read from SOUND_PRESETS, convert to knob units ─
  // Knob units: ATK/DCY ms (0-2000), REL ms (0-4000), SUS ratio (0-1)
  // Setting audioParams to null resets the override so the audio engine
  // uses the preset's built-in value; the knob shows it visually only.
  if (sp.attack  != null) { atkKnob?.setValue(Math.min(sp.attack  * 1000, 2000), false); audioParams.attack  = null; }
  if (sp.decay   != null) { dcyKnob?.setValue(Math.min(sp.decay   * 1000, 2000), false); audioParams.decay   = null; }
  if (sp.sustain != null) { susKnob?.setValue(sp.sustain, false);                         audioParams.sustain = null; }
  if (sp.release != null) { relKnob?.setValue(Math.min(sp.release * 1000, 4000), false); audioParams.release = null; }

  // ── Filter — read from SOUND_PRESETS ──────────────────────────
  if (sp.filter?.freq != null) { cutKnob?.setValue(Math.min(sp.filter.freq, 12000), false); audioParams.cutoff    = null; }
  if (sp.filter?.Q    != null) { resKnob?.setValue(Math.min(sp.filter.Q, 18),       false); audioParams.resonance = null; }
  // Presets without a filter: reset cut to "off" position (200 = minimum = off)
  if (!sp.filter) { cutKnob?.setValue(200, false); audioParams.cutoff = null; }

  // Update instrument waveform panel
  if (typeof computeInstrumentWaveform === 'function') computeInstrumentWaveform(name);
  updateLegatoToggle();
  // Release all active notes naturally (capped at 400ms) and reset all key
  // tracking state. releaseAllForSwitch ignores held-key ownership so no nodes
  // are orphaned after the switch.
  if (typeof releaseAllForSwitch === 'function') releaseAllForSwitch(_prevPreset);
  heldKeys.clear();
  latchedKeys.clear();
  scheduleSave();
}

// ── Legato toggle ────────────────────────────────────────
// Reads / writes directly into the LEGATO_PRESETS Set defined in audio.js.
// Changes take effect immediately on the next chord — no reload needed.
function updateLegatoToggle() {
  const on  = LEGATO_PRESETS.has(activePreset);
  const pip = document.getElementById('legatoPip');
  const btn = document.getElementById('legatoToggle');
  if (!pip || !btn) return;
  pip.classList.toggle('led-pip-on',    on);
  btn.classList.toggle('led-pill-active', on);
}

function toggleLegato() {
  if (LEGATO_PRESETS.has(activePreset)) {
    LEGATO_PRESETS.delete(activePreset);
  } else {
    LEGATO_PRESETS.add(activePreset);
  }
  updateLegatoToggle();
}

function toggleMono() {
  setAudioParam('mono', !audioParams.mono);
  const pip = document.getElementById('monoPip');
  const btn = document.getElementById('monoToggle');
  if (pip) pip.classList.toggle('led-pip-on',    audioParams.mono);
  if (btn) btn.classList.toggle('led-pill-active', audioParams.mono);
}

function toggleHold() {
  setAudioParam('hold', !audioParams.hold);
  // Turning sustain off: release any notes that were sustained.
  if (!audioParams.hold) releaseActiveNotes(SOUND_PRESETS[activePreset]);
  const pip = document.getElementById('holdPip');
  const btn = document.getElementById('holdToggle');
  if (pip) pip.classList.toggle('led-pip-on',    audioParams.hold);
  if (btn) btn.classList.toggle('led-pill-active', audioParams.hold);
}

// Latch mode: tapping a key once holds it; tapping it again releases it.
let latchMode = false;
const latchedKeys = new Set(); // keyIds currently latched on

function toggleLatch() {
  latchMode = !latchMode;
  if (!latchMode) {
    // Release all latched keys when turning off
    for (const keyId of latchedKeys) {
      if (typeof stopKeyAudio === 'function') stopKeyAudio(keyId);
    }
    latchedKeys.clear();
    document.querySelectorAll('.key.pressed').forEach(el => el.classList.remove('pressed'));
  }
  const pip = document.getElementById('latchPip');
  const btn = document.getElementById('latchToggle');
  if (pip) pip.classList.toggle('led-pip-on',     latchMode);
  if (btn) btn.classList.toggle('led-pill-active', latchMode);
}

function buildPatchBank() {
  const bank = document.getElementById('patchBank');
  if (!bank) return;
  bank.innerHTML = '';

  // ── Emoji tab row ─────────────────────────────────────
  const tabRow = document.createElement('div');
  tabRow.className = 'patch-cat-tabs';

  PRESET_CATEGORIES.forEach(cat => {
    const tab = document.createElement('button');
    tab.className = 'patch-cat-tab' + (cat.label === activePatchCategory ? ' active' : '');
    tab.dataset.catLabel = cat.label;
    tab.title = cat.label;
    tab.innerHTML =
      `<span class="pct-emoji">${cat.emoji}</span>` +
      `<span class="pct-label">${cat.label}</span>`;
    tab.onclick = () => setActivePatchCategory(cat.label);
    tabRow.appendChild(tab);
  });

  bank.appendChild(tabRow);

  // ── Preset grid (filled by renderPresetGrid) ──────────
  const grid = document.createElement('div');
  grid.className = 'patch-preset-grid';
  grid.id = 'patchPresetGrid';
  bank.appendChild(grid);

  renderPresetGrid();
}

function setActivePatchCategory(label) {
  activePatchCategory = label;
  document.querySelectorAll('.patch-cat-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.catLabel === label));
  renderPresetGrid();
}

function renderPresetGrid() {
  const grid = document.getElementById('patchPresetGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // ── Snaps tab — render snapshot chips inline ───────────
  if (activePatchCategory === 'Snaps') {
    grid.className = 'patch-preset-grid snap-in-patches';
    _renderSnapsInGrid(grid);
    return;
  }

  grid.className = 'patch-preset-grid';
  const cat = PRESET_CATEGORIES.find(c => c.label === activePatchCategory);
  if (!cat) return;
  cat.presets.forEach(name => {
    if (!(name in SOUND_PRESETS)) return;
    const b = document.createElement('button');
    b.className = 'preset-btn' + (name === activePreset ? ' active' : '');
    b.textContent = name;
    b.dataset.preset = name;
    b.onclick = () => applyPreset(name);
    grid.appendChild(b);
  });
}

function _renderSnapsInGrid(container) {
  const snaps = loadSnapshots();
  if (!snaps.length) {
    const ph = document.createElement('span');
    ph.className = 'snap-empty';
    ph.textContent = 'No snapshots — hit + SNAP to save one';
    container.appendChild(ph);
  } else {
    snaps.forEach((snap, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'snap-chip';

      const lbl = document.createElement('button');
      lbl.className = 'snap-chip-lbl';
      lbl.textContent = snap.name;
      lbl.title = 'Tap to restore · Hold to rename';
      lbl.addEventListener('click', () => { restoreStateFrom(snap.state); updateKeyLabels(0); });
      lbl.addEventListener('dblclick', e => {
        e.stopPropagation();
        const n = prompt('Rename snapshot:', snap.name);
        if (n && n.trim()) {
          const s2 = loadSnapshots(); s2[idx].name = n.trim().slice(0, 28);
          _saveSnapshots(s2); renderPresetGrid();
        }
      });

      const del = document.createElement('button');
      del.className = 'snap-chip-del';
      del.textContent = '×';
      del.title = 'Delete';
      del.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Delete "${snap.name}"?`)) return;
        const s2 = loadSnapshots(); s2.splice(idx, 1);
        _saveSnapshots(s2); renderPresetGrid();
      });

      wrap.appendChild(lbl);
      wrap.appendChild(del);
      container.appendChild(wrap);
    });
  }

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'snap-save-btn';
  saveBtn.textContent = '+ SNAP';
  saveBtn.addEventListener('click', e => { e.stopPropagation(); promptSaveSnapshot(); });
  container.appendChild(saveBtn);
}

// ── User patches (persisted in localStorage) ──────────────
const USER_PATCHES_KEY = 'am_user_patches';

function loadUserPatches() {
  try { return JSON.parse(localStorage.getItem(USER_PATCHES_KEY)) || []; }
  catch(e) { return []; }
}

function saveUserPatches(patches) {
  localStorage.setItem(USER_PATCHES_KEY, JSON.stringify(patches));
}

function captureCurrentParams() {
  // Read knob display values (not audioParams which can be null for ADSR)
  // so the snapshot reflects exactly what the user sees on every dial.
  return {
    basePreset: activePreset,
    // Envelope
    atk:       atkKnob?.value   ?? null,
    dcy:       dcyKnob?.value   ?? null,
    sus:       susKnob?.value   ?? null,
    rel:       relKnob?.value   ?? null,
    // Filter
    cut:       cutKnob?.value   ?? null,
    res:       resKnob?.value   ?? null,
    warm:      warmKnob?.value  ?? null,
    rev:       revKnob?.value   ?? null,
    // Character
    drive:     driveKnob?.value ?? null,
    drift:     driftKnob?.value ?? null,
    sub:       subKnob?.value   ?? null,
    width:     widthKnob?.value ?? null,
    sweep:     sweepKnob?.value ?? null,
    // Playback
    strum:     strumKnob?.value    ?? null,
    humanize:  humanizeKnob?.value ?? null,
    glide:     glideKnob?.value    ?? null,
    // Toggles
    legato:    LEGATO_PRESETS.has(activePreset),
    mono:      audioParams.mono  ?? false,
    hold:      audioParams.hold  ?? false,
    // Master
    masterVol: audioParams.masterVol ?? 0.72,
  };
}

function applyUserPatch(patch) {
  // 1. Base preset (sets oscillator layers, default ADSR, etc.)
  if (patch.basePreset && patch.basePreset in SOUND_PRESETS) {
    applyPreset(patch.basePreset);
  }

  // Helper: set knob display + audio param in one shot
  const snap = (knob, audioKey, val, toAudio = v => v) => {
    if (val == null) return;
    knob?.setValue(val, false);
    setAudioParam(audioKey, toAudio(val));
  };

  // 2. Envelope (knob values are in ms; audioParams uses seconds)
  snap(atkKnob,  'attack',    patch.atk,  v => v / 1000);
  snap(dcyKnob,  'decay',     patch.dcy,  v => v / 1000);
  snap(susKnob,  'sustain',   patch.sus);
  snap(relKnob,  'release',   patch.rel,  v => v / 1000);

  // 3. Filter
  if (patch.cut != null) {
    cutKnob?.setValue(patch.cut, false);
    setAudioParam('cutoff', patch.cut <= 200 ? null : patch.cut);
  }
  snap(resKnob,   'resonance', patch.res);
  snap(warmKnob,  'warmth',    patch.warm);
  snap(revKnob,   'reverb',    patch.rev);

  // 4. Character
  snap(driveKnob, 'drive',  patch.drive);
  snap(driftKnob, 'drift',  patch.drift);
  snap(subKnob,   'sub',    patch.sub);
  snap(widthKnob, 'width',  patch.width);
  snap(sweepKnob, 'sweep',  patch.sweep);

  // 5. Playback knobs
  snap(strumKnob,   'strum',    patch.strum);
  snap(humanizeKnob,'humanize', patch.humanize);
  snap(glideKnob,   'glide',    patch.glide);

  // 6. Toggles — legato is stored in a Set keyed on the preset name
  if (patch.legato != null) {
    const legatoKey = '__user__' + patch.name; // will be set as activePreset below
    if (patch.legato) LEGATO_PRESETS.add(legatoKey);
    else              LEGATO_PRESETS.delete(legatoKey);
  }
  if (patch.mono != null) {
    audioParams.mono = patch.mono;
    const pip = document.getElementById('monoPip');
    const btn = document.getElementById('monoToggle');
    pip?.classList.toggle('led-pip-on',     audioParams.mono);
    btn?.classList.toggle('led-pill-active', audioParams.mono);
  }
  if (patch.hold != null) {
    audioParams.hold = patch.hold;
    const pip = document.getElementById('holdPip');
    const btn = document.getElementById('holdToggle');
    pip?.classList.toggle('led-pip-on',     audioParams.hold);
    btn?.classList.toggle('led-pill-active', audioParams.hold);
  }

  // 7. Master volume
  if (patch.masterVol != null) setAudioParam('masterVol', patch.masterVol);

  // 8. Mark this user patch as active
  activePreset = '__user__' + patch.name;
  updateLegatoToggle();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.user-patch-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.patchName === patch.name));
}

function deleteUserPatch(name) {
  const patches = loadUserPatches().filter(p => p.name !== name);
  saveUserPatches(patches);
  buildUserPatchRow();
}

function buildUserPatchRow() {
  const row = document.getElementById('userPatchRow');
  if (!row) return;
  row.innerHTML = '';
  const patches = loadUserPatches();
  if (patches.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'user-patch-hint';
    hint.textContent = 'No saved patches yet';
    row.appendChild(hint);
    return;
  }
  patches.forEach(patch => {
    const wrap = document.createElement('div');
    wrap.className = 'user-patch-wrap';

    const btn = document.createElement('button');
    btn.className = 'preset-btn user-patch-btn';
    btn.textContent = patch.name;
    btn.dataset.patchName = patch.name;
    btn.onclick = () => applyUserPatch(patch);

    const del = document.createElement('button');
    del.className = 'user-patch-del';
    del.innerHTML = '&times;';
    del.title = 'Delete patch';
    del.onclick = e => {
      e.stopPropagation();
      if (confirm(`Delete "${patch.name}"?`)) deleteUserPatch(patch.name);
    };

    wrap.appendChild(btn);
    wrap.appendChild(del);
    row.appendChild(wrap);
  });
}

function promptSavePatch() {
  const modal = document.getElementById('saveModal');
  if (!modal) return;
  modal.style.display = 'flex';
  const input = document.getElementById('saveModalInput');
  input.value = '';
  setTimeout(() => input.focus(), 50);
}

function closeSaveModal() {
  const modal = document.getElementById('saveModal');
  if (modal) modal.style.display = 'none';
}

function confirmSavePatch() {
  const input = document.getElementById('saveModalInput');
  const name = input.value.trim().toUpperCase();
  if (!name) { input.focus(); return; }

  const patches = loadUserPatches();
  const existing = patches.findIndex(p => p.name === name);
  const patch = { name, ...captureCurrentParams() };

  if (existing >= 0) {
    patches[existing] = patch;
  } else {
    patches.push(patch);
  }
  saveUserPatches(patches);
  closeSaveModal();
  buildUserPatchRow();
  // Flash the saved button active and transfer legato state to new key
  setTimeout(() => {
    const savedBtn = document.querySelector(`.user-patch-btn[data-patch-name="${name}"]`);
    if (savedBtn) savedBtn.classList.add('active');
    const oldPreset = activePreset;
    activePreset    = '__user__' + name;
    // Carry legato state from the old preset key to the new user-patch key
    if (LEGATO_PRESETS.has(oldPreset)) LEGATO_PRESETS.add(activePreset);
    else                               LEGATO_PRESETS.delete(activePreset);
    updateLegatoToggle();
  }, 50);
}

// Keep alias for legacy calls
function buildPresetRow() { buildPatchBank(); }

// ── Quality hold model ─────────────────────────────────
// Holding a quality key/button sets activeFlavour for the duration.
// Releasing returns to AUTO (null). No latching — purely instrumental.

let heldQualKey = null; // keyboard key currently held ('y', 'h', etc.)

// Piano-mode per-key hold tracking
const heldKeys = new Set(); // keyId strings currently pressed
function makeKeyId(idx, extraOct) { return `${idx}_${extraOct}`; }

function holdQual(key) {
  // key = quality string like 'maj7', or null for AUTO
  activeFlavour = key;
  if (typeof window._teachHook === 'function') window._teachHook({ type: 'quality', key });
  syncQualVisual();
}

function releaseQual(fromKey) {
  // Only release if this key is still the one holding
  if (fromKey && fromKey !== heldQualKey) return;
  heldQualKey = null;
  activeFlavour = null;
  syncQualVisual();
}

function syncQualVisual() {
  document.querySelectorAll('.qual-key').forEach(b => {
    b.classList.toggle('held', b.dataset.qualKey === activeFlavour && activeFlavour !== null);
  });
  const ro = document.getElementById('qualReadout');
  if (ro) ro.textContent = activeFlavour ?? 'AUTO';
}

// ── Long-press drag: hold quality button 450ms → drag to quick-slot ──────────
const _lp = { timer: null, data: null, active: false, ghost: null, startX: 0, startY: 0 };

function _lpBeginDrag(x, y) {
  _lp.active = true;
  _lp.ghost  = document.createElement('div');
  _lp.ghost.className = 'touch-drag-ghost';
  _lp.ghost.textContent = _lp.data.label;
  _lp.ghost.style.setProperty('--qrgb', _lp.data.rgb);
  _lp.ghost.style.left = (x - 36) + 'px';
  _lp.ghost.style.top  = (y - 22) + 'px';
  document.body.appendChild(_lp.ghost);
  if (navigator.vibrate) navigator.vibrate(25);
}

function _lpOnDocMove(e) {
  const t = e.touches && e.touches[0];
  if (!t || !_lp.data) return;
  if (_lp.timer) {
    // Pre-long-press: cancel if finger moved more than 10px
    if (Math.hypot(t.clientX - _lp.startX, t.clientY - _lp.startY) > 10) {
      clearTimeout(_lp.timer); _lp.timer = null; _lp.data = null;
    }
    return;
  }
  if (!_lp.active) return;
  e.preventDefault();
  if (_lp.ghost) {
    _lp.ghost.style.left = (t.clientX - 36) + 'px';
    _lp.ghost.style.top  = (t.clientY - 22) + 'px';
    _lp.ghost.style.visibility = 'hidden';
    const el = document.elementFromPoint(t.clientX, t.clientY);
    _lp.ghost.style.visibility = '';
    document.querySelectorAll('.quick-flv-key').forEach(s => s.classList.remove('drag-over'));
    const slot = el && el.closest('.quick-flv-key');
    if (slot) slot.classList.add('drag-over');
  }
}

function _lpOnDocEnd(e) {
  document.removeEventListener('touchmove', _lpOnDocMove);
  document.removeEventListener('touchend',  _lpOnDocEnd);
  clearTimeout(_lp.timer); _lp.timer = null;
  if (_lp.ghost) { _lp.ghost.remove(); _lp.ghost = null; }
  document.querySelectorAll('.quick-flv-key').forEach(s => s.classList.remove('drag-over'));
  const wasActive = _lp.active;
  const savedData = _lp.data;
  _lp.data = null; _lp.active = false;
  if (wasActive && savedData && e.changedTouches && e.changedTouches[0]) {
    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const slot = el && el.closest('.quick-flv-key');
    if (slot) {
      const slotIdx = [...document.querySelectorAll('.quick-flv-key')].indexOf(slot);
      if (slotIdx >= 0) assignFlavourSlot(slotIdx, savedData);
    }
  }
}

function startLongPressDrag(data, touch) {
  _lp.data   = data;
  _lp.active = false;
  _lp.startX = touch.clientX;
  _lp.startY = touch.clientY;
  document.addEventListener('touchmove', _lpOnDocMove, { passive: false });
  document.addEventListener('touchend',  _lpOnDocEnd);
  _lp.timer = setTimeout(() => {
    _lp.timer = null;
    if (_lp.data) _lpBeginDrag(_lp.startX, _lp.startY);
  }, 450);
}

// Right-zone 5-col keyboard quality grid
function buildQualityPanel() {
  const panel = document.getElementById('qualityPanel');
  if (!panel) return;
  panel.innerHTML = '';

  const familyRgb = Object.fromEntries(QUAL_FAMILIES.map(f => [f.id, f.rgb]));

  // Row 0: column family headers
  QUAL_FAMILIES.forEach(f => {
    const hdr = document.createElement('div');
    hdr.className = 'qual-family-hdr';
    hdr.style.setProperty('--qrgb', f.rgb);
    hdr.textContent = f.label;
    panel.appendChild(hdr);
  });

  // Rows 1-3: quality keys (row-major order matches CSS grid flow)
  QUAL_GRID.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'qual-key';
    btn.dataset.qualKey = q.key;
    btn.dataset.row     = q.row;
    btn.dataset.info    = 'qual_' + q.key;
    btn.style.setProperty('--qrgb', familyRgb[q.family]);
    btn.innerHTML = `<span class="qk-kb">${q.kb}</span><span class="qk-name">${q.label}</span>`;

    // Drag to assign to a ZXCV slot (mouse)
    btn.draggable = true;
    btn.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/x-flavour', JSON.stringify(
        { key: q.key, label: q.label, rgb: familyRgb[q.family] }
      ));
      e.dataTransfer.effectAllowed = 'copy';
      btn.classList.add('dragging');
    });
    btn.addEventListener('dragend', () => btn.classList.remove('dragging'));

    // Click when a slot is in edit mode → assign to that slot
    btn.addEventListener('click', () => {
      if (editingSlot !== null) {
        assignFlavourSlot(editingSlot, { key: q.key, label: q.label, rgb: familyRgb[q.family] });
        return;
      }
    });

    // Toggle quality on click/tap — activate if off, deactivate if already active
    btn.addEventListener('mousedown',  () => { if (editingSlot !== null) return; activeFlavour === q.key ? releaseQual(null) : holdQual(q.key); });
    btn.addEventListener('touchstart', e => {
      if (editingSlot !== null) {
        assignFlavourSlot(editingSlot, { key: q.key, label: q.label, rgb: familyRgb[q.family] });
        return;
      }
      // Long-press (450ms) initiates drag-to-assign; immediate tap just holds quality
      startLongPressDrag({ key: q.key, label: q.label, rgb: familyRgb[q.family] }, e.touches[0]);
      activeFlavour === q.key ? releaseQual(null) : holdQual(q.key);
    }, {passive: true});
    panel.appendChild(btn);
  });

  buildQuickFlavours();
  syncQualVisual();
}

function buildFlavourStrip() {
  const row = document.getElementById('flavourRow');
  if (!row) return; // replaced by quality panel
}

// ════════════════════════════════════════════════════════
//  STATE PERSISTENCE  (localStorage key: 'am_state')
// ════════════════════════════════════════════════════════

let _isRestoring = false;
let _saveTimer   = null;

function scheduleSave() {
  if (_isRestoring) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(commitSave, 800);
}

function captureState() {
  return {
    v: 4,
    preset:    activePreset,
    rootIdx:   circle?.rootIdx ?? 0,
    modeIdx:   circle?.modeIdx ?? 0,
    octave:    currentOctave,
    playMode:  playMode,
    locked:    playMode === 'chord',
    knobs: {
      vol:      audioParams.masterVol,
      oct:      octaveKnob?.value,
      atk:      atkKnob?.value,
      dcy:      dcyKnob?.value,
      sus:      susKnob?.value,
      rel:      relKnob?.value,
      cut:      cutKnob?.value,
      res:      resKnob?.value,
      warm:     warmKnob?.value,
      rev:      revKnob?.value,
      drive:    driveKnob?.value,
      drift:    driftKnob?.value,
      sub:      subKnob?.value,
      width:    widthKnob?.value,
      sweep:    sweepKnob?.value,
      strum:    strumKnob?.value,
      humanize: humanizeKnob?.value,
      glide:    glideKnob?.value,
    },
    toggles: {
      legato: LEGATO_PRESETS.has(activePreset),
      mono:   audioParams.mono  ?? false,
      hold:   audioParams.hold  ?? false,
    },
    keyConfigs: keyConfigs.map(kc => ({
      octOffset:  kc.octOffset,
      flavour:    kc.flavour,
      _userDelta: kc._userDelta,
      omit:       kc.omit,
      add:        kc.add,
      inversion:  kc.inversion || 0,
      degree:     kc.degree,
    })),
    customFlavours: CUSTOM_FLAVOURS.map(f => ({ key: f.key, label: f.label, rgb: f.rgb })),
  };
}

function commitSave() {
  try { localStorage.setItem('am_state', JSON.stringify(captureState())); } catch(_) {}
}

function restoreStateFrom(s) {
    clearTimeout(_saveTimer);
    _isRestoring = true;

    // 1. Preset base (must come before knob overrides so overrides win)
    if (s.preset && s.preset in SOUND_PRESETS) applyPreset(s.preset);

    // 2. Circle position
    if (circle) {
      const nStep = (Math.PI * 2) / CIRCLE_ORDER.length;
      const mStep = (Math.PI * 2) / MODES.length;
      if (s.rootIdx != null) { circle.rootIdx = s.rootIdx; circle.noteRot = -s.rootIdx * nStep; }
      if (s.modeIdx != null) { circle.modeIdx = s.modeIdx; circle.modeRot = -s.modeIdx * mStep; }
      circle.draw();
      updateKeyLabels(0);
    }

    // 3. Octave
    if (s.octave != null) {
      currentOctave = s.octave;
      octaveKnob?.setValue(s.octave, false);
    }

    // 4. Play mode state
    if (s.playMode != null) {
      playMode = s.playMode;
    } else if (s.locked != null) {
      playMode = s.locked ? 'chord' : 'free'; // migrate old boolean format
    }
    ['chord','scale','free'].forEach(m => {
      document.getElementById(m + 'Opt')?.classList.toggle('active', m === playMode);
    });
    const mc = document.getElementById('mobChordBtn');
    const ms = document.getElementById('mobScaleBtn');
    const mf = document.getElementById('mobFreeBtn');
    if (mc) mc.classList.toggle('active', playMode === 'chord');
    if (ms) ms.classList.toggle('active', playMode === 'scale');
    if (mf) mf.classList.toggle('active', playMode === 'free');

    // 5. All knobs (overriding preset defaults where the user had diverged)
    const kn = s.knobs ?? {};
    const snapKnob = (knob, audioKey, val, toAudio = v => v) => {
      if (val == null) return;
      knob?.setValue(val, false);
      setAudioParam(audioKey, toAudio(val));
    };
    if (kn.vol  != null) setAudioParam('masterVol', kn.vol);
    snapKnob(revKnob,   'reverb',    kn.rev);
    snapKnob(driveKnob, 'drive',     kn.drive);
    snapKnob(driftKnob, 'drift',     kn.drift);
    snapKnob(subKnob,   'sub',       kn.sub);
    snapKnob(widthKnob, 'width',     kn.width);
    snapKnob(sweepKnob, 'sweep',     kn.sweep);
    snapKnob(warmKnob,  'warmth',    kn.warm);
    snapKnob(atkKnob,   'attack',    kn.atk,  v => v / 1000);
    snapKnob(dcyKnob,   'decay',     kn.dcy,  v => v / 1000);
    snapKnob(susKnob,   'sustain',   kn.sus);
    snapKnob(relKnob,   'release',   kn.rel,  v => v / 1000);
    if (kn.cut != null) {
      cutKnob?.setValue(kn.cut, false);
      setAudioParam('cutoff', kn.cut <= 200 ? null : kn.cut);
    }
    snapKnob(resKnob, 'resonance', kn.res);
    // Playback knobs (added in v2)
    snapKnob(strumKnob,    'strum',    kn.strum);
    snapKnob(humanizeKnob, 'humanize', kn.humanize);
    snapKnob(glideKnob,    'glide',    kn.glide);

    // 5b. Toggles (added in v2)
    const tg = s.toggles ?? {};
    if (tg.legato != null) {
      if (tg.legato) LEGATO_PRESETS.add(s.preset ?? '');
      else           LEGATO_PRESETS.delete(s.preset ?? '');
      updateLegatoToggle();
    }
    if (tg.mono != null) {
      audioParams.mono = tg.mono;
      document.getElementById('monoPip')?.classList.toggle('led-pip-on',     tg.mono);
      document.getElementById('monoToggle')?.classList.toggle('led-pill-active', tg.mono);
    }
    if (tg.hold != null) {
      audioParams.hold = tg.hold;
      document.getElementById('holdPip')?.classList.toggle('led-pip-on',     tg.hold);
      document.getElementById('holdToggle')?.classList.toggle('led-pill-active', tg.hold);
    }

    // 6. Per-key configs
    if (Array.isArray(s.keyConfigs)) {
      s.keyConfigs.forEach((kc, i) => {
        if (i >= keyConfigs.length) return;
        keyConfigs[i].octOffset  = kc.octOffset  ?? 0;
        keyConfigs[i].flavour    = kc.flavour    ?? null;
        keyConfigs[i]._userDelta = kc._userDelta ?? 0;
        keyConfigs[i].omit       = Array.isArray(kc.omit) ? kc.omit : [];
        keyConfigs[i].add        = Array.isArray(kc.add)  ? kc.add  : [];
        keyConfigs[i].inversion  = typeof kc.inversion === 'number' ? kc.inversion : 0;
        keyConfigs[i].degree     = typeof kc.degree    === 'number' ? kc.degree    : null;
        keyOctKnobs[i]?.setValue(kc._userDelta ?? 0, false);
        if (keyFlvKnobs[i]) {
          const fi = KCP_FLAVOURS.indexOf(kc.flavour ?? null);
          keyFlvKnobs[i].setValue(fi >= 0 ? fi : 0, false);
        }
      });
    }

    // 7. Custom flavour slots
    if (Array.isArray(s.customFlavours)) {
      s.customFlavours.forEach((f, i) => {
        if (i < CUSTOM_FLAVOURS.length && f.key && f.label && f.rgb) {
          CUSTOM_FLAVOURS[i].key   = f.key;
          CUSTOM_FLAVOURS[i].label = f.label;
          CUSTOM_FLAVOURS[i].rgb   = f.rgb;
          QUAL_KB[CUSTOM_FLAVOURS[i].kb.toLowerCase()] = f.key;
        }
      });
      buildQuickFlavours();
      syncQualVisual();
    }

  _isRestoring = false;
}

function restoreState() {
  try {
    const raw = localStorage.getItem('am_state');
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s || (s.v !== 1 && s.v !== 2 && s.v !== 3 && s.v !== 4)) return;
    restoreStateFrom(s);
  } catch(_) {}
}

// ════════════════════════════════════════════════════════
//  SNAPSHOTS  — named full-state saves, recalled on demand
// ════════════════════════════════════════════════════════

const SNAPSHOTS_KEY = 'am_snapshots';

function loadSnapshots() {
  try { return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY)) || []; } catch(e) { return []; }
}
function _saveSnapshots(snaps) {
  try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps)); } catch(_) {}
}

function buildSnapshotRow() {
  const row = document.getElementById('snapSlotRow');
  if (!row) return;
  row.innerHTML = '';
  const snaps = loadSnapshots();
  if (!snaps.length) {
    const ph = document.createElement('span');
    ph.className = 'snap-empty';
    ph.textContent = 'No snapshots — hit + SNAP to save one';
    row.appendChild(ph);
    return;
  }
  snaps.forEach((snap, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'snap-chip';

    const lbl = document.createElement('button');
    lbl.className = 'snap-chip-lbl';
    lbl.textContent = snap.name;
    lbl.title = 'Click to restore · Double-click to rename';
    lbl.addEventListener('click', () => { restoreStateFrom(snap.state); updateKeyLabels(0); });
    lbl.addEventListener('dblclick', e => {
      e.stopPropagation();
      const n = prompt('Rename snapshot:', snap.name);
      if (n && n.trim()) {
        const s2 = loadSnapshots(); s2[idx].name = n.trim().slice(0, 28); _saveSnapshots(s2); buildSnapshotRow();
      }
    });

    const del = document.createElement('button');
    del.className = 'snap-chip-del';
    del.textContent = '×';
    del.title = 'Delete';
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm(`Delete "${snap.name}"?`)) return;
      const s2 = loadSnapshots(); s2.splice(idx, 1); _saveSnapshots(s2); buildSnapshotRow();
    });

    wrap.appendChild(lbl);
    wrap.appendChild(del);
    row.appendChild(wrap);
  });
}

function promptSaveSnapshot() {
  const el = document.getElementById('snapModal');
  const inp = document.getElementById('snapModalInput');
  if (!el || !inp) return;
  const d = new Date();
  inp.value = `Snap ${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  el.style.display = 'flex';
  requestAnimationFrame(() => { inp.focus(); inp.select(); });
}
function closeSnapModal() {
  const el = document.getElementById('snapModal');
  if (el) el.style.display = 'none';
}
function confirmSaveSnapshot() {
  const inp = document.getElementById('snapModalInput');
  const name = (inp?.value || '').trim() || 'Snapshot';
  closeSnapModal();
  const snaps = loadSnapshots();
  snaps.push({ name: name.slice(0, 28), ts: Date.now(), state: captureState() });
  _saveSnapshots(snaps);
  buildSnapshotRow();           // legacy strip (no-op if element missing)
  if (activePatchCategory === 'Snaps') renderPresetGrid(); // refresh inline view
}

// ── Custom flavour slot management ────────────────────────

let editingSlot = null; // index into CUSTOM_FLAVOURS while in assign mode

function loadCustomFlavours() {
  try {
    // Prefer unified state key; fall back to legacy key
    const main = JSON.parse(localStorage.getItem('am_state') || 'null');
    const saved = main?.customFlavours
      ?? JSON.parse(localStorage.getItem('customFlavours') || 'null');
    if (Array.isArray(saved)) {
      saved.forEach((f, i) => {
        if (i < CUSTOM_FLAVOURS.length && f.key && f.label && f.rgb) {
          CUSTOM_FLAVOURS[i].key   = f.key;
          CUSTOM_FLAVOURS[i].label = f.label;
          CUSTOM_FLAVOURS[i].rgb   = f.rgb;
        }
      });
    }
  } catch(_) {}
  CUSTOM_FLAVOURS.forEach(f => { QUAL_KB[f.kb.toLowerCase()] = f.key; });
}

// Flavour saves are folded into the unified state; keep this as a thin shim
// so assignFlavourSlot() still works without changes.
function saveCustomFlavours() { scheduleSave(); }

function assignFlavourSlot(slotIdx, data) {
  CUSTOM_FLAVOURS[slotIdx].key   = data.key;
  CUSTOM_FLAVOURS[slotIdx].label = data.label;
  CUSTOM_FLAVOURS[slotIdx].rgb   = data.rgb;
  QUAL_KB[CUSTOM_FLAVOURS[slotIdx].kb.toLowerCase()] = data.key;
  saveCustomFlavours();
  clearSlotEditMode();
  buildQuickFlavours();
  syncQualVisual();
}

function _cancelOnOutside(e) {
  if (!e.target.closest('.quick-flv-key') && !e.target.closest('.qual-key')) {
    clearSlotEditMode();
  }
}

function enterSlotEditMode(slotIdx) {
  editingSlot = slotIdx;
  document.querySelectorAll('.quick-flv-key').forEach((el, i) =>
    el.classList.toggle('slot-editing', i === slotIdx));
  document.querySelectorAll('#qualityPanel .qual-key').forEach(el =>
    el.classList.add('assign-mode'));
  document.addEventListener('pointerdown', _cancelOnOutside, { capture: true });
}

function clearSlotEditMode() {
  editingSlot = null;
  document.querySelectorAll('.quick-flv-key').forEach(el => el.classList.remove('slot-editing'));
  document.querySelectorAll('#qualityPanel .qual-key').forEach(el => el.classList.remove('assign-mode'));
  document.removeEventListener('pointerdown', _cancelOnOutside, { capture: true });
}

function buildQuickFlavours() {
  const flvRow = document.getElementById('quickFlavoursRow');
  if (!flvRow) return;
  flvRow.innerHTML = '';

  CUSTOM_FLAVOURS.forEach((f, slotIdx) => {
    const btn = document.createElement('button');
    btn.className = 'qual-key quick-flv-key';
    btn.dataset.qualKey = f.key;
    btn.dataset.info    = 'qual_' + f.key;
    btn.style.setProperty('--qrgb', f.rgb);
    btn.innerHTML =
      `<span class="qk-kb">${f.kb}</span>` +
      `<span class="qk-name">${f.label}</span>` +
      `<span class="flv-edit-btn" title="Drag from above or click to assign">✎</span>`;

    // Toggle quality — activate if off, deactivate if already active
    btn.addEventListener('mousedown', e => {
      if (e.target.closest('.flv-edit-btn')) return;
      activeFlavour === f.key ? releaseQual(null) : holdQual(f.key);
    });
    btn.addEventListener('touchstart', e => {
      if (e.target.closest('.flv-edit-btn')) return;
      e.preventDefault(); activeFlavour === f.key ? releaseQual(null) : holdQual(f.key);
    }, {passive:false});

    // Edit button — enter / exit assign mode
    const editBtn = btn.querySelector('.flv-edit-btn');
    editBtn.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); });
    editBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (editingSlot === slotIdx) clearSlotEditMode();
      else enterSlotEditMode(slotIdx);
    });

    // Drop target for mouse drag
    btn.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; btn.classList.add('drag-over'); });
    btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
    btn.addEventListener('dragenter', e => { e.preventDefault(); btn.classList.add('drag-over'); });
    btn.addEventListener('drop', e => {
      e.preventDefault();
      btn.classList.remove('drag-over');
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/x-flavour'));
        assignFlavourSlot(slotIdx, data);
      } catch(_) {}
    });

    flvRow.appendChild(btn);
  });
}

// ════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
//  LEFT HAND — chord degrees:
//    1 2 3 4  →  I   II   III  IV
//    Q W E R  →  V   VI   VII  oct-root
//    A S D F  →  ext1 ext2 ext3 ext4
//  QUICK FLAVOURS (hold like right-hand quality keys):
//    Z X C V  →  dom7  maj7  min7  add9
//  RIGHT HAND — quality latch (tap to set, tap again to clear):
//    Y=auto  U=maj  I=min  O=7  P=maj7
//    H=min7  J=sus4 K=add9 L=dim ;=aug
//  MODIFIERS:
//    Space=+oct  C=−oct  Tab=+7th
// ════════════════════════════════════════════════════════

// Row 1: 1 2 3 4  →  indices 0 1 2 3
// Row 2: Q W E R  →  indices 4 5 6 7
// Row 3: A S D F  →  indices 8 9 10 11
const KB_MAP = {
  '1':0,'2':1,'3':2,'4':3,
  'q':4,'w':5,'e':6,'r':7,
  'a':8,'s':9,'d':10,'f':11,
};

// In chord-locked mode: A S D F Z X C V → second octave (same indices 0–7, +1 oct)
const KB_MAP_OCT2 = { 'a':0,'s':1,'d':2,'f':3,'z':4,'x':5,'c':6,'v':7 };

// ── Patch navigation helpers ───────────────────────────
function navigatePreset(dir) {
  const cat = PRESET_CATEGORIES.find(c => c.label === activePatchCategory);
  if (!cat) return;
  const presets = cat.presets.filter(n => n in SOUND_PRESETS);
  if (!presets.length) return;
  let idx = presets.indexOf(activePreset);
  if (idx === -1) idx = 0;
  else idx = (idx + dir + presets.length) % presets.length;
  applyPreset(presets[idx]);
}

function navigateCategory(dir) {
  const labels = PRESET_CATEGORIES.map(c => c.label);
  let idx = labels.indexOf(activePatchCategory);
  idx = (idx + dir + labels.length) % labels.length;
  setActivePatchCategory(labels[idx]);
}

let _physHoldStart = 0;

window.addEventListener('keydown', e => {
  if (!e.repeat && _physHoldStart === 0) _physHoldStart = performance.now();

  // Modifier tracking — Space = +oct, Tab = add 7th
  if (e.key === ' ')   { e.preventDefault(); modifiers.octUp    = true; return; }
  if (e.key === 'Tab') { e.preventDefault(); modifiers.extension = true; return; }

  if (e.repeat) return;
  if (e.target.tagName === 'INPUT') return;

  // Arrow keys — instrument navigation
  if (e.key === 'ArrowLeft')  { e.preventDefault(); navigatePreset(-1);   return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); navigatePreset(+1);   return; }
  if (e.key === 'ArrowUp')    { e.preventDefault(); navigateCategory(-1); return; }
  if (e.key === 'ArrowDown')  { e.preventDefault(); navigateCategory(+1); return; }

  // Normalise — preserve punctuation that would be mangled by toLowerCase
  const k = (e.key === ';' || e.key === ',' || e.key === '.' || e.key === '/')
              ? e.key : e.key.toLowerCase();

  // In locked mode: second octave row (A S D F Z X C V)
  if (playMode === 'scale' && k in KB_MAP_OCT2) {
    e.preventDefault();
    onKeyDown(KB_MAP_OCT2[k], 1);
    return;
  }

  // RIGHT HAND — quality hold (keydown = hold, keyup = release)
  if (k in QUAL_KB) {
    e.preventDefault();
    heldQualKey = k;
    holdQual(QUAL_KB[k]);
    return;
  }

  // LEFT HAND — chord degree
  if (k in KB_MAP) { e.preventDefault(); onKeyDown(KB_MAP[k]); }
});

window.addEventListener('keyup', e => {
  if (_physHoldStart !== 0) {
    window.dispatchEvent(new CustomEvent('ev:holdEnd', {
      detail: { holdMs: performance.now() - _physHoldStart }
    }));
    _physHoldStart = 0;
  }

  if (e.key === ' ')   { modifiers.octUp    = false; return; }
  if (e.key === 'Tab') { modifiers.extension = false; return; }

  const k = (e.key === ';' || e.key === ',' || e.key === '.' || e.key === '/')
              ? e.key : e.key.toLowerCase();

  // Second octave row release in locked mode
  if (playMode === 'scale' && k in KB_MAP_OCT2) { onKeyUp(KB_MAP_OCT2[k], 1); return; }

  // Release quality hold
  if (k in QUAL_KB) { releaseQual(k); return; }

  if (k in KB_MAP) onKeyUp(KB_MAP[k]);
});

// ════════════════════════════════════════════════════════
//  TOUCH MODIFIER BUTTONS (+Oct / -Oct)
// ════════════════════════════════════════════════════════

function attachModifierButtons() {
  const upBtn   = document.getElementById('modOctUp');
  const downBtn = document.getElementById('modOctDown');
  if (!upBtn || !downBtn) return;

  const hold = (btn, key) => {
    btn.addEventListener('touchstart', e => {
      e.preventDefault(); modifiers[key] = true; btn.classList.add('mod-active');
    }, {passive:false});
    btn.addEventListener('touchend',   () => { modifiers[key] = false; btn.classList.remove('mod-active'); });
    btn.addEventListener('touchcancel',() => { modifiers[key] = false; btn.classList.remove('mod-active'); });
    // Also work with mouse (desktop testing)
    btn.addEventListener('mousedown', e => { e.preventDefault(); modifiers[key] = true;  btn.classList.add('mod-active'); });
    window.addEventListener('mouseup', () => { modifiers[key] = false; btn.classList.remove('mod-active'); });
  };

  hold(upBtn,   'octUp');
  hold(downBtn, 'octDown');
}

// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════

// Global release — lifting mouse/touch anywhere drops the held quality
window.addEventListener('mouseup',    () => { if (activeFlavour !== null && !heldQualKey) return; releaseQual(heldQualKey); });
window.addEventListener('touchend',   () => { if (activeFlavour !== null && !heldQualKey) return; releaseQual(heldQualKey); });
window.addEventListener('touchcancel',() => { releaseQual(heldQualKey); });

// ════════════════════════════════════════════════════════
//  SECTION PRESETS  —  quick snapshots for each voice group
// ════════════════════════════════════════════════════════

// All time values in knob units: ATK/DCY in ms, REL in ms, SUS in 0–1
const ENV_PRESETS = [
  { label: 'Stab',   atk: 2,    dcy: 60,   sus: 0,    rel: 80   },
  { label: 'Pluck',  atk: 2,    dcy: 350,  sus: 0.05, rel: 180  },
  { label: 'Keys',   atk: 5,    dcy: 280,  sus: 0.28, rel: 850  },
  { label: 'Pad',    atk: 750,  dcy: 180,  sus: 0.80, rel: 1800 },
  { label: 'Swell',  atk: 1400, dcy: 0,    sus: 1.0,  rel: 2500 },
  { label: 'Drone',  atk: 180,  dcy: 0,    sus: 1.0,  rel: 4000 },
];

// cut = Hz (200–12000), res = Q (0.1–18), warm = cents (0–30)
const FLT_PRESETS = [
  { label: 'Open',     cut: 12000, res: 0.5,  warm: 0  },
  { label: 'Warm',     cut: 3000,  res: 0.8,  warm: 12 },
  { label: 'Dark',     cut: 1200,  res: 0.7,  warm: 8  },
  { label: 'Mellow',   cut: 2000,  res: 0.6,  warm: 6  },
  { label: 'Resonant', cut: 900,   res: 8.0,  warm: 4  },
  { label: 'Acid',     cut: 600,   res: 12.0, warm: 2  },
];

// All values already match knob ranges
const CHR_PRESETS = [
  { label: 'Clean',   rev: 0,    drive: 1.0, drift: 2,  sub: 0,   width: 1.0, sweep: 2.0 },
  { label: 'Vintage', rev: 0.08, drive: 2.5, drift: 8,  sub: 0.3, width: 1.2, sweep: 2.5 },
  { label: 'Wide',    rev: 0.15, drive: 1.5, drift: 10, sub: 0.4, width: 2.0, sweep: 3.0 },
  { label: 'Pushed',  rev: 0.05, drive: 4.0, drift: 5,  sub: 0.6, width: 1.4, sweep: 3.0 },
  { label: 'Ambient', rev: 0.45, drive: 1.0, drift: 15, sub: 0.6, width: 2.0, sweep: 5.0 },
  { label: 'Mono',    rev: 0,    drive: 2.0, drift: 2,  sub: 1.0, width: 0.3, sweep: 1.5 },
];

function _buildSecPresetRow(containerId, presets, applyFn) {
  const row = document.getElementById(containerId);
  if (!row) return;
  presets.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'vpc-sec-preset-btn';
    btn.textContent = p.label;
    btn.onclick = () => {
      row.querySelectorAll('.vpc-sec-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFn(p);
    };
    row.appendChild(btn);
  });
}

function buildVoicePresets() {
  _buildSecPresetRow('envPresets', ENV_PRESETS, p => {
    atkKnob?.setValue(p.atk, true);
    dcyKnob?.setValue(p.dcy, true);
    susKnob?.setValue(p.sus, true);
    relKnob?.setValue(p.rel, true);
  });

  _buildSecPresetRow('fltPresets', FLT_PRESETS, p => {
    cutKnob?.setValue(p.cut,  true);
    resKnob?.setValue(p.res,  true);
    warmKnob?.setValue(p.warm, true);
  });

  _buildSecPresetRow('chrPresets', CHR_PRESETS, p => {
    revKnob?.setValue(p.rev,   true);
    driveKnob?.setValue(p.drive, true);
    driftKnob?.setValue(p.drift, true);
    subKnob?.setValue(p.sub,   true);
    widthKnob?.setValue(p.width, true);
    sweepKnob?.setValue(p.sweep, true);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  loadCustomFlavours();  // must run before buildQualityPanel
  buildKeys();
  buildPatchBank();
  buildUserPatchRow();
  buildFlavourStrip();   // no-op if flavourRow removed from HTML
  buildQualityPanel();   // right-zone 5-col keyboard grid
  buildGlobalKnobs();
  buildVoicePresets();
  applyPreset('Piano');
  attachModifierButtons();

  circle = new CircleWidget(
    document.getElementById('circleCanvas'),
    () => {
      updateKeyLabels();
      updateRelDisplay();
      syncMobileSelects();
      if (typeof SongsModule !== 'undefined') SongsModule.updatePlayerChords();
      scheduleSave();
    }
  );
  circle.draw();
  updateRelDisplay();
  buildMobileSelects();
  updateKeyLabels(0);
  if (typeof window.chordInspector !== 'undefined') window.chordInspector.showDefault();

  // Wrap setAudioParam so every knob twist schedules a save
  const _origSetAudioParam = window.setAudioParam;
  window.setAudioParam = function(key, val) {
    _origSetAudioParam(key, val);
    scheduleSave();
  };

  // Unlock Web Audio on first touch — creates AudioContext synchronously in the gesture
  document.addEventListener('touchstart', () => unlockAudio(), { once: true, passive: true });

  buildSnapshotRow();

  startVisualizers();
  if (typeof SongsModule !== 'undefined') SongsModule.init();
  console.log('Approachable Music ready.');
  console.log('Shortcuts: 1-2-3-4 / Q-W-E-R / A-S-D-F');
  console.log('Quick flavours: Z X C V  |  +oct: Space  |  +7th: Tab');
});

// ════════════════════════════════════════════════════════
//  VOICE EDITOR  — per-key extension/voicing customization
// ════════════════════════════════════════════════════════

let _vocEl = null;        // currently open popover or sheet
let _vocBackdrop = null;  // sheet backdrop
let _vocKeyIdx = null;    // which key is being edited

function _closeVoiceEditor() {
  if (_vocEl) { _vocEl.remove(); _vocEl = null; }
  if (_vocBackdrop) { _vocBackdrop.remove(); _vocBackdrop = null; }
  _vocKeyIdx = null;
}

function _buildVoiceEditorInner(keyIdx) {
  const kc   = keyConfigs[keyIdx];
  const qual  = kc.flavour;
  const base  = qual ? QUALITY_CHROMATIC[qual] : null;
  const name  = keyEls[keyIdx]?.querySelector('.key-chord-name')?.textContent || '';
  const roman = keyEls[keyIdx]?.querySelector('.key-roman')?.textContent || '';

  const wrap = document.createElement('div');
  wrap.className = 'voc-editor-inner';

  // ── Header ──────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'voc-editor-header';

  const title = document.createElement('div');
  title.className = 'voc-editor-title';
  title.textContent = `VOICE EDIT · ${name}${roman ? ' · ' + roman : ''}`;

  const clrBtn = document.createElement('button');
  clrBtn.className = 'voc-editor-btn';
  clrBtn.textContent = 'CLR';
  clrBtn.addEventListener('click', () => {
    kc.omit = []; kc.add = [];
    scheduleSave();
    updateKeyLabels(0);
    _refreshVocEditor(keyIdx, wrap);
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'voc-editor-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', _closeVoiceEditor);

  header.appendChild(title);
  header.appendChild(clrBtn);
  header.appendChild(closeBtn);
  wrap.appendChild(header);

  // ── Base quality row ─────────────────────────────────
  const baseRow = document.createElement('div');
  baseRow.className = 'voc-editor-base';
  baseRow.textContent = qual ? 'BASE: ' + qual : 'BASE: AUTO (set FLV to enable OMIT)';
  wrap.appendChild(baseRow);

  // ── Degree selector (extension keys only) ─────────────
  if (keyIdx >= 8) {
    const cfgDefault = EXTENSION_CONFIGS[keyIdx - 8];
    const degLabel = document.createElement('div');
    degLabel.className = 'voc-editor-section-label';
    degLabel.textContent = 'CHORD DEGREE (scale step)';
    wrap.appendChild(degLabel);

    const degRow = document.createElement('div');
    degRow.className = 'voc-editor-row';
    const ROMAN = ['I','II','III','IV','V','VI','VII'];
    ROMAN.forEach((roman, di) => {
      const activeDeg = kc.degree !== null ? kc.degree : cfgDefault.degree;
      const btn = document.createElement('button');
      btn.className = 'voc-tone-btn' + (di === activeDeg ? ' on' : '');
      btn.textContent = roman;
      btn.addEventListener('click', () => {
        kc.degree = di;
        scheduleSave();
        updateKeyLabels(0);
        _refreshVocEditor(keyIdx, wrap);
      });
      degRow.appendChild(btn);
    });
    // Reset button
    const rstBtn = document.createElement('button');
    rstBtn.className = 'voc-tone-btn';
    rstBtn.textContent = 'auto';
    rstBtn.title = 'Reset to default (' + ROMAN[cfgDefault.degree] + ')';
    rstBtn.addEventListener('click', () => {
      kc.degree = null;
      scheduleSave();
      updateKeyLabels(0);
      _refreshVocEditor(keyIdx, wrap);
    });
    degRow.appendChild(rstBtn);
    wrap.appendChild(degRow);
  }

  // ── OMIT section ─────────────────────────────────────
  const omitLabel = document.createElement('div');
  omitLabel.className = 'voc-editor-section-label';
  omitLabel.textContent = 'OMIT';
  wrap.appendChild(omitLabel);

  const omitRow = document.createElement('div');
  omitRow.className = 'voc-editor-row';

  if (base) {
    base.forEach(sv => {
      const isOmitted = kc.omit.includes(sv);
      const btn = document.createElement('button');
      btn.className = 'voc-tone-btn' + (isOmitted ? ' off' : ' on');
      btn.textContent = SEMITONE_LABEL[sv] || sv;
      btn.addEventListener('click', () => {
        if (isOmitted) { kc.omit = kc.omit.filter(x => x !== sv); }
        else           { kc.omit = [...kc.omit, sv]; }
        scheduleSave();
        updateKeyVoiceRows(keyIdx);
        _refreshVocEditor(keyIdx, wrap);
      });
      omitRow.appendChild(btn);
    });
  } else {
    const hint = document.createElement('div');
    hint.className = 'voc-editor-hint';
    hint.textContent = 'Set a FLV on this key to enable omit controls.';
    omitRow.appendChild(hint);
  }
  wrap.appendChild(omitRow);

  // ── ADD section ───────────────────────────────────────
  const addLabel = document.createElement('div');
  addLabel.className = 'voc-editor-section-label';
  addLabel.textContent = 'ADD EXTENSIONS';
  wrap.appendChild(addLabel);

  const addRow = document.createElement('div');
  addRow.className = 'voc-editor-row';

  Object.keys(EXTENSION_SEMITONES).forEach(ext => {
    const isAdded = kc.add.includes(ext);
    const btn = document.createElement('button');
    btn.className = 'voc-tone-btn' + (isAdded ? ' on' : '');
    btn.textContent = ext;
    btn.addEventListener('click', () => {
      if (isAdded) { kc.add = kc.add.filter(x => x !== ext); }
      else         { kc.add = [...kc.add, ext]; }
      scheduleSave();
      updateKeyVoiceRows(keyIdx);
      _refreshVocEditor(keyIdx, wrap);
    });
    addRow.appendChild(btn);
  });
  wrap.appendChild(addRow);

  return wrap;
}

function _refreshVocEditor(keyIdx, container) {
  container.innerHTML = '';
  const inner = _buildVoiceEditorInner(keyIdx);
  while (inner.firstChild) container.appendChild(inner.firstChild);
}

function showVoiceEditorPopover(keyIdx, anchorEl) {
  _closeVoiceEditor();
  _vocKeyIdx = keyIdx;

  const pop = document.createElement('div');
  pop.className = 'voice-editor-popover';
  pop.appendChild(_buildVoiceEditorInner(keyIdx));
  document.body.appendChild(pop);
  _vocEl = pop;

  // Position below (or above) the anchor
  const rect = anchorEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  pop.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';
  if (spaceBelow > 200) {
    pop.style.top  = (rect.bottom + 6) + 'px';
  } else {
    pop.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  }

  // Dismiss on outside click
  setTimeout(() => {
    document.addEventListener('click', _handlePopoverOutside, { capture: true, once: true });
  }, 0);
}

function _handlePopoverOutside(e) {
  if (_vocEl && !_vocEl.contains(e.target)) { _closeVoiceEditor(); }
  else if (_vocEl) {
    document.addEventListener('click', _handlePopoverOutside, { capture: true, once: true });
  }
}

function showVoiceEditorSheet(keyIdx) {
  _closeVoiceEditor();
  _vocKeyIdx = keyIdx;

  const backdrop = document.createElement('div');
  backdrop.className = 'voice-editor-sheet-backdrop';
  backdrop.addEventListener('click', _closeVoiceEditor);
  document.body.appendChild(backdrop);
  _vocBackdrop = backdrop;

  const sheet = document.createElement('div');
  sheet.className = 'voice-editor-sheet';

  const handle = document.createElement('div');
  handle.className = 'voice-editor-sheet-handle';
  sheet.appendChild(handle);
  sheet.appendChild(_buildVoiceEditorInner(keyIdx));

  document.body.appendChild(sheet);
  _vocEl = sheet;

  // Animate in
  requestAnimationFrame(() => sheet.classList.add('open'));
}
