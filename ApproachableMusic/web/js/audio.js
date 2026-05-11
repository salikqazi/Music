// ════════════════════════════════════════════════════════
//  SOUND PRESETS  (layered additive synthesis)
//  Each layer: { type, mult (freq multiplier), vol (0-1), detuneC (cents) }
//  ADSR in seconds: attack, decay, sustain (0-1 fraction), release, duration
//  filter (optional): { type, freq, Q }
//  masterVol: overall level (compensates for layer count)
// ════════════════════════════════════════════════════════

const SOUND_PRESETS = {
  Piano: {
    // Acoustic grand: hammer transient + natural harmonic decay
    // Real pianos have 2–3 strings per note tuned within ±1–2 cents of each other.
    // Their beating creates the characteristic shimmer and warmth. Three unison layers
    // at slightly different detuning values model this; inharmonicity shifts upper partials.
    layers: [
      { type:'sine', mult:1,     vol:0.24, detuneC:0   },                                    // string 1 — center
      { type:'sine', mult:1,     vol:0.20, detuneC:0.9                                  },   // string 2 — +0.9c (beats ~0.23 Hz at A4)
      { type:'sine', mult:1,     vol:0.18, detuneC:-0.9                                 },   // string 3 — −0.9c
      { type:'triangle', mult:2, vol:0.20, detuneC:1,  decMult:0.65, susMult:0.50 },        // 2nd — fades to half
      { type:'sine', mult:3.006, vol:0.10, detuneC:3,  decMult:0.38, susMult:0.10 },        // 3rd — inharmonic, nearly gone by sustain
      { type:'sine', mult:4.022, vol:0.05, detuneC:5,  decMult:0.22, susMult:0    },        // 4th — fully decays
      { type:'sine', mult:6.072, vol:0.02, detuneC:8,  decMult:0.12, susMult:0    },        // 6th — very fast die-off
    ],
    filter:   { type:'lowpass', freq:5800, Q:0.7 },
    freqBrightness: 0.35,   // treble keys are naturally brighter
    attack:   0.004, decay: 1.20, sustain: 0.08, release: 0.85, duration: 3.2,
    masterVol: 0.78, noSweep: true, naturalDecay: true,
  },

  'E.Piano': {
    // Rhodes-style: warm tines with characteristic inharmonic bell partial
    // The tine bell partials decay faster than the fundamental warm sustain
    layers: [
      { type:'sine',     mult:1,    vol:0.58, detuneC:0                             },  // fundamental — full sustain
      { type:'sine',     mult:1,    vol:0.32, detuneC:-7,  decMult:0.85, susMult:0.8 },  // warm detune — mostly sustained
      { type:'triangle', mult:2.76, vol:0.14, detuneC:0,   decMult:0.42, susMult:0.1 },  // inharmonic tine bell — fades quickly
      { type:'sine',     mult:5.4,  vol:0.05, detuneC:0,   decMult:0.18, susMult:0   },  // upper shimmer — dies fast
    ],
    filter:   { type:'lowpass', freq:3800, Q:0.9 },
    freqBrightness: 0.20,
    attack:   0.003, decay: 0.85, sustain: 0.07, release: 1.1, duration: 4.0,
    masterVol: 0.72, naturalDecay: true,
  },

  Organ: {
    // Hammond B3 drawbars (888000000): instant on/off, rich harmonics, no decay
    layers: [
      { type:'sine', mult:1,   vol:0.38, detuneC:0 },  // 8' fundamental
      { type:'sine', mult:1.5, vol:0.28, detuneC:0 },  // 5⅓' (3rd harmonic)
      { type:'sine', mult:2,   vol:0.26, detuneC:0 },  // 4'
      { type:'sine', mult:3,   vol:0.16, detuneC:0 },  // 2⅔'
      { type:'sine', mult:4,   vol:0.12, detuneC:0 },  // 2'
      { type:'sine', mult:6,   vol:0.06, detuneC:0 },  // 1⅓'
      { type:'sine', mult:8,   vol:0.04, detuneC:0 },  // 1'
    ],
    attack:   0.008, decay: 0.01, sustain: 1.0, release: 0.04, duration: 5.0,
    masterVol: 0.62,
  },

  Pad: {
    // Lush synth pad: detuned layers, slow attack, long dreamy sustain
    layers: [
      { type:'sine',     mult:1, vol:0.48, detuneC:0   },
      { type:'sine',     mult:1, vol:0.38, detuneC:9   },  // chorus +9 cents
      { type:'sine',     mult:1, vol:0.28, detuneC:-9  },  // chorus -9 cents
      { type:'triangle', mult:2, vol:0.14, detuneC:0   },  // octave warmth
      { type:'sine',     mult:3, vol:0.05, detuneC:0   },
    ],
    filter:   { type:'lowpass', freq:2000, Q:0.8 },
    attack:   0.55, decay: 0.30, sustain: 0.78, release: 1.20, duration: 5.5,
    masterVol: 0.65,
  },

  Strings: {
    // Ensemble strings: bow noise and octave air decay into steady sustain
    layers: [
      { type:'sawtooth', mult:1, vol:0.50, detuneC:0                           },  // main voice — full sustain
      { type:'sawtooth', mult:1, vol:0.42, detuneC:-6, decMult:0.90, susMult:0.90 },  // ensemble lower
      { type:'sawtooth', mult:1, vol:0.30, detuneC:6,  decMult:0.90, susMult:0.90 },  // ensemble upper
      { type:'sine',     mult:2, vol:0.10, detuneC:0,  decMult:0.55, susMult:0.40 },  // octave air — fades some
    ],
    filter:   { type:'lowpass', freq:1600, Q:0.7 },
    attack:   0.38, decay: 0.20, sustain: 0.76, release: 0.95, duration: 5.0,
    masterVol: 0.65, naturalDecay: true,
  },

  Choir: {
    // Vocal choir: sawtooth source → formant bank (FORMANT_CHAINS) shapes the vowel "Ah".
    // Source must be harmonically rich (sawtooth) so the formant bandpass filters have
    // partials to select — the single old bandpass is replaced by parallel formants in playFreqs().
    layers: [
      { type:'sawtooth', mult:1, vol:0.42, detuneC:0  },   // center voice
      { type:'sawtooth', mult:1, vol:0.34, detuneC:8  },   // ensemble +8c
      { type:'sawtooth', mult:1, vol:0.26, detuneC:-8 },   // ensemble -8c
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.6 },   // gentle HPF rolloff above formants
    attack:   0.46, decay: 0.25, sustain: 0.80, release: 0.85, duration: 5.0,
    masterVol: 0.55,
  },

  Bell: {
    // Vibraphone/bell: each partial rings for its own duration — the tierce (2.76×)
    // decays fastest, the fundamental rings longest (just like a real bell)
    layers: [
      { type:'sine', mult:1,    vol:0.60, detuneC:0                          },  // fundamental — full ring
      { type:'sine', mult:2,    vol:0.12, detuneC:0, decMult:0.55, susMult:0 },  // octave — 55% duration
      { type:'sine', mult:2.76, vol:0.20, detuneC:0, decMult:0.32, susMult:0 },  // tierce — quickest to fade
      { type:'sine', mult:5.4,  vol:0.08, detuneC:0, decMult:0.16, susMult:0 },  // upper — gone very fast
    ],
    attack:   0.002, decay: 4.2, sustain: 0.0, release: 0.4, duration: 6.0,
    masterVol: 0.75, naturalDecay: true,
  },

  Marimba: {
    // Marimba: the 4× partial (2 octaves up) decays dramatically faster than the
    // warm fundamental — that transient brightness then giving way to the pure woody
    // tone is the defining sonic signature of a real marimba
    layers: [
      { type:'sine', mult:1,   vol:0.72, detuneC:0                           },  // fundamental — full decay
      { type:'sine', mult:4.0, vol:0.22, detuneC:0, decMult:0.10, susMult:0 },  // 2-oct — 10× faster, gone quickly
      { type:'sine', mult:10,  vol:0.06, detuneC:0, decMult:0.05, susMult:0 },  // click transient — nearly instant
    ],
    attack:   0.002, decay: 0.70, sustain: 0.0, release: 0.15, duration: 1.6,
    masterVol: 0.82, naturalDecay: true,
  },

  Pluck: {
    // Guitar/harp pluck: the sawtooth transient and upper sparkle vanish fast;
    // the fundamental sustains as a warm, round tone — mimics a real pluck envelope
    layers: [
      { type:'sine',     mult:1, vol:0.60, detuneC:0                           },  // fundamental — sustains
      { type:'sawtooth', mult:1, vol:0.28, detuneC:0, decMult:0.20, susMult:0 },  // pick transient — very fast
      { type:'sine',     mult:2, vol:0.12, detuneC:0, decMult:0.38, susMult:0 },  // octave sparkle — fades
    ],
    filter:   { type:'lowpass', freq:3200, Q:0.9 },
    attack:   0.003, decay: 0.55, sustain: 0.06, release: 0.28, duration: 2.0,
    masterVol: 0.82, naturalDecay: true,
    ksOptions: { feedback: 0.996, stretch: 0.50, exciteFilter: 0.35 },  // soft fingertip pluck
  },

  Lead: {
    // Synth lead: fat detuned sawtooths, punchy attack
    layers: [
      { type:'sawtooth', mult:1, vol:0.52, detuneC:0  },
      { type:'sawtooth', mult:1, vol:0.42, detuneC:-8 },  // detune for fatness
      { type:'square',   mult:2, vol:0.12, detuneC:4  },  // sub octave bite
    ],
    filter:   { type:'lowpass', freq:2800, Q:1.4 },
    attack:   0.010, decay: 0.14, sustain: 0.68, release: 0.32, duration: 2.8,
    masterVol: 0.68,
  },

  // ════════════════════════════════════════════════════════
  //  KEYS (extended)
  // ════════════════════════════════════════════════════════

  'Grand Piano': {
    // Concert grand: wider harmonic range, staggered partial decay.
    // Triple-stringing with ±0.7 cent detune produces the hall-filling shimmer of a Steinway.
    layers: [
      { type:'sine', mult:1,     vol:0.25, detuneC:0                              },   // string 1 — center
      { type:'sine', mult:1,     vol:0.22, detuneC:0.7                            },   // string 2 — +0.7c
      { type:'sine', mult:1,     vol:0.18, detuneC:-0.7                           },   // string 3 — −0.7c
      { type:'triangle', mult:2, vol:0.22, detuneC:1,  decMult:0.70, susMult:0.55 },
      { type:'sine', mult:3.008, vol:0.12, detuneC:3,  decMult:0.42, susMult:0.12 },  // inharmonic stretch
      { type:'sine', mult:4.028, vol:0.06, detuneC:5,  decMult:0.24, susMult:0    },
      { type:'sine', mult:6.085, vol:0.03, detuneC:7,  decMult:0.14, susMult:0    },
      { type:'sine', mult:8.16,  vol:0.01, detuneC:10, decMult:0.08, susMult:0    },
    ],
    filter:   { type:'lowpass', freq:6500, Q:0.60 },
    freqBrightness: 0.38,
    attack:   0.003, decay: 1.40, sustain: 0.07, release: 1.0, duration: 3.8,
    masterVol: 0.78, noSweep: true, naturalDecay: true,
  },

  'Upright Piano': {
    // Warmer woodier upright: less high-end shimmer, body resonance, faster decay.
    // Upright strings are shorter → more inharmonicity; 2-string unison (no third string).
    layers: [
      { type:'sine', mult:1,     vol:0.32, detuneC:0                              },   // string 1
      { type:'sine', mult:1,     vol:0.28, detuneC:1.2                            },   // string 2 — slightly wider detune (shorter strings)
      { type:'triangle', mult:2, vol:0.18, detuneC:2,  decMult:0.58, susMult:0.40 },
      { type:'triangle', mult:3.004, vol:0.07, detuneC:4, decMult:0.30, susMult:0.08 }, // inharmonicity
      { type:'sine', mult:4.016, vol:0.03, detuneC:6,  decMult:0.16, susMult:0    },
      { type:'sine', mult:1,     vol:0.05, detuneC:8,  decMult:0.90, susMult:0.80 },   // body resonance — sustained
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.8 },
    freqBrightness: 0.28,
    attack:   0.004, decay: 1.10, sustain: 0.06, release: 0.75, duration: 2.8,
    masterVol: 0.78, noSweep: true, naturalDecay: true,
  },

  'Bright Keys': {
    // Honky-tonk bright: elevated high harmonics, percussive edge, fast shimmer decay
    layers: [
      { type:'sine',     mult:1, vol:0.44, detuneC:0                              },
      { type:'triangle', mult:2, vol:0.32, detuneC:2,  decMult:0.65, susMult:0.55 },
      { type:'sine',     mult:3, vol:0.18, detuneC:4,  decMult:0.38, susMult:0.15 },
      { type:'sine',     mult:4, vol:0.10, detuneC:6,  decMult:0.20, susMult:0    },
      { type:'sine',     mult:5, vol:0.05, detuneC:8,  decMult:0.10, susMult:0    },
    ],
    filter:   { type:'lowpass', freq:8000, Q:0.6 },
    freqBrightness: 0.30,
    attack:   0.002, decay: 0.65, sustain: 0.07, release: 0.65, duration: 2.5,
    masterVol: 0.74, noSweep: true, naturalDecay: true,
  },

  'Wurlitzer': {
    // Reedy nasal quality: triangle-dominant with characteristic inharmonic partial
    layers: [
      { type:'triangle', mult:1,    vol:0.52, detuneC:0  },
      { type:'sine',     mult:1,    vol:0.28, detuneC:-5 },
      { type:'triangle', mult:2,    vol:0.16, detuneC:0  },
      { type:'sine',     mult:3.28, vol:0.08, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:3100, Q:1.1 },
    attack:   0.005, decay: 0.70, sustain: 0.08, release: 0.80, duration: 3.2,
    masterVol: 0.72, naturalDecay: true,
  },

  'Harpsichord': {
    // Plucked jack mechanism: very sharp, bright, virtually no sustain
    layers: [
      { type:'sawtooth', mult:1,   vol:0.48, detuneC:0 },
      { type:'sawtooth', mult:2,   vol:0.28, detuneC:0 },
      { type:'sine',     mult:3,   vol:0.14, detuneC:0 },
      { type:'sine',     mult:4,   vol:0.08, detuneC:0 },
      { type:'sine',     mult:5,   vol:0.04, detuneC:0 },
    ],
    filter:   { type:'lowpass', freq:5500, Q:0.75 },
    attack:   0.001, decay: 0.62, sustain: 0.01, release: 0.12, duration: 2.0,
    masterVol: 0.74, noiseBurstGain: 0.012, naturalDecay: true,
  },

  'Celesta': {
    // Delicate bell box: pure sine + bell partials, sweet fairy-tale sparkle
    layers: [
      { type:'sine', mult:1,    vol:0.65, detuneC:0 },
      { type:'sine', mult:2,    vol:0.14, detuneC:0 },
      { type:'sine', mult:2.76, vol:0.12, detuneC:0 },
      { type:'sine', mult:5.4,  vol:0.05, detuneC:0 },
    ],
    attack:   0.002, decay: 1.80, sustain: 0.0, release: 0.35, duration: 3.5,
    masterVol: 0.72, naturalDecay: true,
  },

  'Clavinet': {
    // Funky electric clavichord: sharp pluck, mid-forward bandpass, bite
    layers: [
      { type:'sawtooth', mult:1, vol:0.42, detuneC:0  },
      { type:'square',   mult:1, vol:0.32, detuneC:5  },
      { type:'sawtooth', mult:2, vol:0.16, detuneC:0  },
      { type:'sine',     mult:3, vol:0.08, detuneC:0  },
    ],
    filter:   { type:'bandpass', freq:2200, Q:1.5 },
    attack:   0.001, decay: 0.22, sustain: 0.08, release: 0.18, duration: 1.8,
    masterVol: 0.70, noiseBurstGain: 0.012, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  ORGAN (extended)
  // ════════════════════════════════════════════════════════

  'Church Organ': {
    // Pipe organ: wide harmonic spread, stately, sub-bass 16' + upper mixtures
    layers: [
      { type:'sine', mult:0.5, vol:0.18, detuneC:0  },
      { type:'sine', mult:1,   vol:0.38, detuneC:0  },
      { type:'sine', mult:2,   vol:0.28, detuneC:0  },
      { type:'sine', mult:3,   vol:0.18, detuneC:0  },
      { type:'sine', mult:4,   vol:0.12, detuneC:0  },
      { type:'sine', mult:6,   vol:0.06, detuneC:0  },
      { type:'sine', mult:8,   vol:0.04, detuneC:0  },
      { type:'sine', mult:1,   vol:0.04, detuneC:4  },
    ],
    filter:   { type:'lowpass', freq:4000, Q:0.6 },
    attack:   0.055, decay: 0.05, sustain: 1.0, release: 0.15, duration: 5.0,
    masterVol: 0.58,
  },

  'Jazz Organ': {
    // Funkier Hammond: Leslie speaker adds amplitude tremolo at ~6 Hz alongside the pitch drift
    layers: [
      { type:'sine', mult:1,   vol:0.42, detuneC:0 },
      { type:'sine', mult:2,   vol:0.30, detuneC:0 },
      { type:'sine', mult:3,   vol:0.18, detuneC:0 },
      { type:'sine', mult:4,   vol:0.10, detuneC:0 },
      { type:'sine', mult:6,   vol:0.05, detuneC:0 },
      { type:'sine', mult:1,   vol:0.10, detuneC:8 },
    ],
    ampLfo:   { rate: 6.0, depth: 0.09 },  // Leslie cabinet rotation — ~6 Hz fast speed
    attack:   0.010, decay: 0.05, sustain: 0.92, release: 0.06, duration: 5.0,
    masterVol: 0.64,
  },

  'Pipe Organ': {
    // Grand cathedral organ: all registers open, massive resonant
    layers: [
      { type:'sine', mult:0.5,  vol:0.22, detuneC:0  },
      { type:'sine', mult:1,    vol:0.38, detuneC:0  },
      { type:'sine', mult:2,    vol:0.24, detuneC:0  },
      { type:'sine', mult:4,    vol:0.14, detuneC:0  },
      { type:'sine', mult:6,    vol:0.08, detuneC:0  },
      { type:'sine', mult:8,    vol:0.05, detuneC:0  },
      { type:'sine', mult:12,   vol:0.03, detuneC:0  },
      { type:'sine', mult:1,    vol:0.05, detuneC:-3 },
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.55 },
    attack:   0.12, decay: 0.05, sustain: 1.0, release: 0.22, duration: 6.0,
    masterVol: 0.55,
  },

  // ════════════════════════════════════════════════════════
  //  PADS (extended)
  // ════════════════════════════════════════════════════════

  'Crystal Pad': {
    // Glassy shimmer: bright high harmonics, phasing detuned layers
    layers: [
      { type:'sine',     mult:1,    vol:0.40, detuneC:0   },
      { type:'sine',     mult:2,    vol:0.28, detuneC:5   },
      { type:'sine',     mult:4,    vol:0.18, detuneC:-5  },
      { type:'triangle', mult:8,    vol:0.08, detuneC:8   },
      { type:'sine',     mult:1,    vol:0.18, detuneC:-12 },
    ],
    filter:   { type:'highpass', freq:200, Q:0.5 },
    attack:   0.65, decay: 0.40, sustain: 0.72, release: 1.50, duration: 6.0,
    masterVol: 0.60,
  },

  'Angel Pad': {
    // Ethereal heavenly: choir-like formant, ultra-soft attack, celestial
    layers: [
      { type:'sine',     mult:1,   vol:0.42, detuneC:0   },
      { type:'sine',     mult:1,   vol:0.32, detuneC:7   },
      { type:'sine',     mult:1,   vol:0.24, detuneC:-7  },
      { type:'triangle', mult:2,   vol:0.14, detuneC:3   },
      { type:'sine',     mult:3,   vol:0.06, detuneC:0   },
      { type:'sine',     mult:1,   vol:0.10, detuneC:14  },
    ],
    filter:   { type:'lowpass', freq:2500, Q:0.6 },
    attack:   0.90, decay: 0.50, sustain: 0.82, release: 2.00, duration: 7.0,
    masterVol: 0.60,
  },

  'Space Pad': {
    // Cosmic ambient: detuned subs, cavernous width, slow evolving
    layers: [
      { type:'sine',     mult:0.5, vol:0.32, detuneC:0   },
      { type:'sine',     mult:1,   vol:0.45, detuneC:0   },
      { type:'sine',     mult:1,   vol:0.28, detuneC:11  },
      { type:'sine',     mult:1,   vol:0.22, detuneC:-11 },
      { type:'triangle', mult:2,   vol:0.12, detuneC:0   },
      { type:'sine',     mult:3,   vol:0.05, detuneC:7   },
    ],
    filter:   { type:'lowpass', freq:1800, Q:0.7 },
    attack:   1.20, decay: 0.60, sustain: 0.80, release: 2.50, duration: 8.0,
    masterVol: 0.62,
  },

  'Glass Pad': {
    // Clean translucent: sine-dominant, resonant lowpass, pure
    layers: [
      { type:'sine', mult:1,   vol:0.55, detuneC:0  },
      { type:'sine', mult:2,   vol:0.22, detuneC:3  },
      { type:'sine', mult:1,   vol:0.20, detuneC:-4 },
      { type:'sine', mult:4,   vol:0.08, detuneC:6  },
    ],
    filter:   { type:'lowpass', freq:3500, Q:1.0 },
    attack:   0.45, decay: 0.25, sustain: 0.75, release: 1.20, duration: 5.5,
    masterVol: 0.65,
  },

  'Vapor Pad': {
    // Vaporwave dreamy: lo-fi heavy detune, flutter, slow evolve
    layers: [
      { type:'sine',     mult:1,   vol:0.46, detuneC:0   },
      { type:'sine',     mult:1,   vol:0.38, detuneC:15  },
      { type:'sine',     mult:1,   vol:0.30, detuneC:-15 },
      { type:'triangle', mult:2,   vol:0.16, detuneC:7   },
      { type:'sine',     mult:0.5, vol:0.18, detuneC:0   },
    ],
    filter:   { type:'lowpass', freq:1400, Q:1.2 },
    attack:   0.80, decay: 0.40, sustain: 0.72, release: 1.80, duration: 7.0,
    masterVol: 0.62,
  },

  // ════════════════════════════════════════════════════════
  //  STRINGS (extended)
  // ════════════════════════════════════════════════════════

  'Solo Violin': {
    // Bowed violin: higher harmonics settle faster into steady sustain after the bow onset
    layers: [
      { type:'sawtooth', mult:1, vol:0.50, detuneC:0                            },  // fundamental — full sustain
      { type:'sawtooth', mult:2, vol:0.24, detuneC:0, decMult:0.70, susMult:0.75 },  // octave
      { type:'sine',     mult:3, vol:0.12, detuneC:2, decMult:0.50, susMult:0.45 },  // 3rd
      { type:'sine',     mult:4, vol:0.06, detuneC:3, decMult:0.32, susMult:0.18 },  // 4th — settles back
      { type:'sine',     mult:1, vol:0.08, detuneC:4, decMult:0.85, susMult:0.90 },  // body resonance — sustained
    ],
    filter:   { type:'lowpass', freq:4500, Q:0.8 },
    attack:   0.18, decay: 0.12, sustain: 0.78, release: 0.55, duration: 5.5,
    masterVol: 0.68, naturalDecay: true,
  },

  'Cello': {
    // Rich dark bowed: upper harmonics ease into steady sustain after the bow catches
    layers: [
      { type:'sawtooth', mult:1, vol:0.55, detuneC:0                            },  // fundamental — full sustain
      { type:'sawtooth', mult:2, vol:0.20, detuneC:0,  decMult:0.75, susMult:0.80 },  // octave
      { type:'triangle', mult:3, vol:0.10, detuneC:2,  decMult:0.50, susMult:0.40 },  // 3rd — woody warmth
      { type:'sine',     mult:4, vol:0.05, detuneC:4,  decMult:0.30, susMult:0.10 },  // 4th — settles back
      { type:'sine',     mult:1, vol:0.10, detuneC:-6, decMult:0.90, susMult:0.90 },  // body resonance
    ],
    filter:   { type:'lowpass', freq:2800, Q:0.9 },
    attack:   0.25, decay: 0.18, sustain: 0.80, release: 0.65, duration: 5.5,
    masterVol: 0.68, naturalDecay: true,
  },

  'Orchestra': {
    // Full ensemble: all sections blended, massive stereo width
    layers: [
      { type:'sawtooth', mult:1,   vol:0.45, detuneC:0   },
      { type:'sawtooth', mult:1,   vol:0.35, detuneC:-7  },
      { type:'sawtooth', mult:1,   vol:0.28, detuneC:7   },
      { type:'sawtooth', mult:2,   vol:0.18, detuneC:0   },
      { type:'sine',     mult:3,   vol:0.10, detuneC:0   },
      { type:'triangle', mult:4,   vol:0.06, detuneC:3   },
      { type:'sine',     mult:0.5, vol:0.14, detuneC:0   },
    ],
    filter:   { type:'lowpass', freq:3200, Q:0.65 },
    attack:   0.55, decay: 0.30, sustain: 0.80, release: 1.50, duration: 6.0,
    masterVol: 0.56, naturalDecay: true,
  },

  'Chamber': {
    // Intimate string quartet: focused, precise, natural
    layers: [
      { type:'sawtooth', mult:1,   vol:0.48, detuneC:0  },
      { type:'sawtooth', mult:1,   vol:0.34, detuneC:-4 },
      { type:'sawtooth', mult:2,   vol:0.14, detuneC:0  },
      { type:'sine',     mult:3,   vol:0.07, detuneC:2  },
    ],
    filter:   { type:'lowpass', freq:2200, Q:0.8 },
    attack:   0.22, decay: 0.15, sustain: 0.72, release: 0.55, duration: 4.5,
    masterVol: 0.68, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  CHOIR / VOCAL (extended)
  // ════════════════════════════════════════════════════════

  'Ah Choir': {
    // Open Ah vowel: sawtooth source → FORMANT_CHAINS formant bank at 850/1200/2800 Hz
    layers: [
      { type:'sawtooth', mult:1, vol:0.40, detuneC:0  },
      { type:'sawtooth', mult:1, vol:0.32, detuneC:6  },
      { type:'sawtooth', mult:1, vol:0.24, detuneC:-6 },
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.6 },
    attack:   0.50, decay: 0.28, sustain: 0.82, release: 0.90, duration: 5.0,
    masterVol: 0.55,
  },

  'Oh Voice': {
    // Round Oh vowel: sawtooth source → FORMANT_CHAINS at 500/875/2500 Hz
    layers: [
      { type:'sawtooth', mult:1, vol:0.44, detuneC:0  },
      { type:'sawtooth', mult:1, vol:0.34, detuneC:9  },
      { type:'sawtooth', mult:1, vol:0.26, detuneC:-9 },
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.6 },
    attack:   0.55, decay: 0.30, sustain: 0.80, release: 0.95, duration: 5.0,
    masterVol: 0.55,
  },

  'Falsetto': {
    // High clear pure voice: sawtooth source → FORMANT_CHAINS at 400/2000/2900 Hz
    layers: [
      { type:'sawtooth', mult:1, vol:0.50, detuneC:0  },
      { type:'sawtooth', mult:1, vol:0.32, detuneC:5  },
      { type:'sawtooth', mult:1, vol:0.22, detuneC:-5 },
    ],
    filter:   { type:'lowpass', freq:4000, Q:0.7 },
    attack:   0.40, decay: 0.20, sustain: 0.75, release: 0.80, duration: 4.5,
    masterVol: 0.55,
  },

  // ════════════════════════════════════════════════════════
  //  SYNTH (extended)
  // ════════════════════════════════════════════════════════

  'Acid 303': {
    // TB-303: resonant sawtooth, extremely high Q filter, glide feel
    layers: [
      { type:'sawtooth', mult:1, vol:0.65, detuneC:0  },
      { type:'square',   mult:1, vol:0.25, detuneC:2  },
      { type:'sine',     mult:2, vol:0.10, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:600, Q:6.0 },
    attack:   0.008, decay: 0.28, sustain: 0.25, release: 0.20, duration: 1.8,
    masterVol: 0.72,
  },

  'Unison Lead': {
    // Super-saw: 7 detuned oscillators, massive wall of sound
    layers: [
      { type:'sawtooth', mult:1, vol:0.50, detuneC:0   },
      { type:'sawtooth', mult:1, vol:0.45, detuneC:-16 },
      { type:'sawtooth', mult:1, vol:0.45, detuneC:16  },
      { type:'sawtooth', mult:1, vol:0.36, detuneC:-8  },
      { type:'sawtooth', mult:1, vol:0.36, detuneC:8   },
      { type:'sawtooth', mult:2, vol:0.18, detuneC:-4  },
      { type:'sawtooth', mult:2, vol:0.18, detuneC:4   },
    ],
    filter:   { type:'lowpass', freq:4000, Q:0.8 },
    attack:   0.015, decay: 0.18, sustain: 0.70, release: 0.45, duration: 3.5,
    masterVol: 0.50,
  },

  'Poly Lead': {
    // Soft poly synth: triangle-heavy, warm, less aggressive
    layers: [
      { type:'triangle', mult:1, vol:0.55, detuneC:0  },
      { type:'triangle', mult:1, vol:0.40, detuneC:-8 },
      { type:'sine',     mult:2, vol:0.20, detuneC:4  },
      { type:'sine',     mult:3, vol:0.08, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:3000, Q:1.0 },
    attack:   0.025, decay: 0.20, sustain: 0.60, release: 0.50, duration: 3.2,
    masterVol: 0.70,
  },

  'Fat Saw': {
    // Thick detuned saws with sub reinforcement, big bottom end
    layers: [
      { type:'sawtooth', mult:1,   vol:0.55, detuneC:0   },
      { type:'sawtooth', mult:1,   vol:0.48, detuneC:-12 },
      { type:'sawtooth', mult:1,   vol:0.35, detuneC:12  },
      { type:'sine',     mult:0.5, vol:0.22, detuneC:0   },
      { type:'square',   mult:2,   vol:0.10, detuneC:5   },
    ],
    filter:   { type:'lowpass', freq:3500, Q:1.2 },
    attack:   0.012, decay: 0.16, sustain: 0.72, release: 0.40, duration: 3.0,
    masterVol: 0.53,
  },

  'Pulse Lead': {
    // Hollow square/pulse: classic monophonic vintage character
    layers: [
      { type:'square', mult:1, vol:0.55, detuneC:0  },
      { type:'square', mult:1, vol:0.35, detuneC:-7 },
      { type:'sine',   mult:2, vol:0.14, detuneC:0  },
      { type:'sine',   mult:3, vol:0.06, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:2500, Q:1.5 },
    attack:   0.010, decay: 0.15, sustain: 0.65, release: 0.35, duration: 2.8,
    masterVol: 0.70,
  },

  // ════════════════════════════════════════════════════════
  //  BASS
  // ════════════════════════════════════════════════════════

  'Sub Bass': {
    // Pure sine sub: clean deep rumble, minimal harmonics
    layers: [
      { type:'sine', mult:1,   vol:0.85, detuneC:0 },
      { type:'sine', mult:2,   vol:0.10, detuneC:0 },
      { type:'sine', mult:0.5, vol:0.12, detuneC:0 },
    ],
    attack:   0.025, decay: 0.14, sustain: 0.80, release: 0.30, duration: 3.0,
    masterVol: 0.88,
  },

  'Synth Bass': {
    // Classic synth bass: sawtooth + tight lowpass, punchy click
    layers: [
      { type:'sawtooth', mult:1,   vol:0.65, detuneC:0  },
      { type:'sawtooth', mult:1,   vol:0.45, detuneC:-6 },
      { type:'sine',     mult:0.5, vol:0.25, detuneC:0  },
      { type:'square',   mult:2,   vol:0.08, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:800, Q:2.0 },
    attack:   0.006, decay: 0.22, sustain: 0.35, release: 0.25, duration: 2.2,
    masterVol: 0.80,
  },

  'Growl Bass': {
    // Dirty distorted bass: overdriven sawtooth + square for electronic music
    layers: [
      { type:'sawtooth', mult:1,   vol:0.62, detuneC:0  },
      { type:'square',   mult:1,   vol:0.40, detuneC:4  },
      { type:'sawtooth', mult:2,   vol:0.22, detuneC:0  },
      { type:'sine',     mult:0.5, vol:0.28, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:1200, Q:3.0 },
    attack:   0.004, decay: 0.18, sustain: 0.45, release: 0.20, duration: 2.0,
    masterVol: 0.72,
  },

  'Upright Bass': {
    // Acoustic double bass: plucked, dark, woody fundamental
    layers: [
      { type:'triangle', mult:1,   vol:0.62, detuneC:0 },
      { type:'sine',     mult:2,   vol:0.24, detuneC:0 },
      { type:'sine',     mult:3,   vol:0.10, detuneC:2 },
      { type:'triangle', mult:4,   vol:0.04, detuneC:0 },
    ],
    filter:   { type:'lowpass', freq:2400, Q:0.8 },
    attack:   0.010, decay: 0.50, sustain: 0.12, release: 0.35, duration: 2.5,
    masterVol: 0.80, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  BELLS / MALLETS (extended)
  // ════════════════════════════════════════════════════════

  'Vibraphone': {
    // Metal bar: staggered partial ring-times + amplitude tremolo from the spinning motor
    // The motor runs at ~5 Hz and is the vibraphone's most distinctive real-world feature
    layers: [
      { type:'sine', mult:1,    vol:0.58, detuneC:0                           },  // fundamental — full ring
      { type:'sine', mult:2,    vol:0.18, detuneC:0, decMult:0.48, susMult:0 },  // octave — roughly half duration
      { type:'sine', mult:3.52, vol:0.16, detuneC:0, decMult:0.30, susMult:0 },  // inharmonic partial
      { type:'sine', mult:5.4,  vol:0.06, detuneC:0, decMult:0.15, susMult:0 },  // upper — fades early
    ],
    ampLfo:   { rate: 5.2, depth: 0.12 },  // motor tremolo — hallmark vibraphone character
    attack:   0.003, decay: 3.0, sustain: 0.02, release: 0.50, duration: 5.0,
    masterVol: 0.76, naturalDecay: true,
  },

  'Glockenspiel': {
    // Bright tinkling metal bars: each inharmonic partial has its own short ring time
    layers: [
      { type:'sine', mult:1,    vol:0.60, detuneC:0                           },  // fundamental — longest ring
      { type:'sine', mult:2.76, vol:0.22, detuneC:0, decMult:0.32, susMult:0 },  // tierce — fades fast
      { type:'sine', mult:5.4,  vol:0.12, detuneC:0, decMult:0.16, susMult:0 },  // 5th partial — very short
      { type:'sine', mult:8.93, vol:0.06, detuneC:0, decMult:0.08, susMult:0 },  // upper click — near instant
    ],
    attack:   0.001, decay: 1.80, sustain: 0.0, release: 0.20, duration: 3.0,
    masterVol: 0.78, naturalDecay: true,
  },

  'Music Box': {
    // Delicate comb tines: pure, overtones die almost immediately leaving the fundamental alone
    layers: [
      { type:'sine', mult:1,   vol:0.68, detuneC:0                           },  // fundamental — full ring
      { type:'sine', mult:2,   vol:0.14, detuneC:0, decMult:0.28, susMult:0 },  // octave — gone early
      { type:'sine', mult:3,   vol:0.06, detuneC:0, decMult:0.14, susMult:0 },  // attack click
      { type:'sine', mult:5.4, vol:0.04, detuneC:0, decMult:0.07, susMult:0 },  // near-instant sparkle
    ],
    attack:   0.002, decay: 0.80, sustain: 0.0, release: 0.12, duration: 1.8,
    masterVol: 0.72, naturalDecay: true,
  },

  'Kalimba': {
    // African thumb piano: plucked tines — upper partials vanish quickly leaving the warm tone
    layers: [
      { type:'sine', mult:1,   vol:0.70, detuneC:0                           },  // fundamental
      { type:'sine', mult:2,   vol:0.18, detuneC:0, decMult:0.32, susMult:0 },  // octave — quick fade
      { type:'sine', mult:3,   vol:0.08, detuneC:2, decMult:0.16, susMult:0 },  // pluck click
      { type:'sine', mult:4.5, vol:0.04, detuneC:0, decMult:0.08, susMult:0 },  // near-instant shimmer
    ],
    attack:   0.002, decay: 0.90, sustain: 0.01, release: 0.20, duration: 2.2,
    masterVol: 0.80, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  PLUCKED (extended)
  // ════════════════════════════════════════════════════════

  'Harp': {
    // Concert harp: bright attack shimmer that quickly gives way to the warm fundamental ring
    layers: [
      { type:'sine',     mult:1, vol:0.58, detuneC:0                           },  // fundamental — long ring
      { type:'sine',     mult:2, vol:0.22, detuneC:0, decMult:0.42, susMult:0 },  // octave — half duration
      { type:'triangle', mult:3, vol:0.12, detuneC:1, decMult:0.22, susMult:0 },  // 3rd — fades fast
      { type:'sine',     mult:4, vol:0.06, detuneC:2, decMult:0.12, susMult:0 },  // pluck transient
      { type:'sine',     mult:6, vol:0.03, detuneC:4, decMult:0.06, susMult:0 },  // sparkle click
    ],
    filter:   { type:'lowpass', freq:5000, Q:0.75 },
    freqBrightness: 0.25,
    attack:   0.002, decay: 1.20, sustain: 0.08, release: 0.65, duration: 4.0,
    masterVol: 0.78, naturalDecay: true,
    ksOptions: { feedback: 0.997, stretch: 0.45, exciteFilter: 0.20 },  // fingernail on string — brighter
  },

  'Nylon Guitar': {
    // Classical guitar: upper harmonics die fast — warm, round fundamental remains
    layers: [
      { type:'triangle', mult:1, vol:0.60, detuneC:0                           },  // fundamental
      { type:'sine',     mult:2, vol:0.22, detuneC:0, decMult:0.38, susMult:0 },  // octave — fades
      { type:'sine',     mult:3, vol:0.10, detuneC:2, decMult:0.18, susMult:0 },  // finger noise
      { type:'sine',     mult:4, vol:0.04, detuneC:3, decMult:0.09, susMult:0 },  // click transient
    ],
    filter:   { type:'lowpass', freq:3000, Q:0.8 },
    freqBrightness: 0.20,
    attack:   0.003, decay: 0.65, sustain: 0.04, release: 0.35, duration: 2.5,
    masterVol: 0.80, naturalDecay: true,
    ksOptions: { feedback: 0.9985, stretch: 0.55, exciteFilter: 0.60 },  // warm nylon + soft fingertip
  },

  'Koto': {
    // Japanese plucked string: bright attack edge dies fast; warm fundamental sustains
    layers: [
      { type:'sine',     mult:1, vol:0.55, detuneC:0                           },  // fundamental
      { type:'sawtooth', mult:1, vol:0.20, detuneC:0, decMult:0.18, susMult:0 },  // string edge — very fast
      { type:'sine',     mult:2, vol:0.18, detuneC:0, decMult:0.38, susMult:0 },  // octave resonance
      { type:'sine',     mult:3, vol:0.08, detuneC:3, decMult:0.18, susMult:0 },  // brightness
      { type:'sine',     mult:5, vol:0.03, detuneC:5, decMult:0.09, susMult:0 },  // click
    ],
    filter:   { type:'lowpass', freq:4500, Q:1.0 },
    attack:   0.002, decay: 0.80, sustain: 0.05, release: 0.40, duration: 2.8,
    masterVol: 0.78, naturalDecay: true,
    ksOptions: { feedback: 0.993, stretch: 0.48, exciteFilter: 0.25 },  // ivory pick, bright attack
  },

  'Sitar': {
    // Indian sitar: the jhari wire buzz decays into resonant sympathetic string sustain
    layers: [
      { type:'sawtooth', mult:1,   vol:0.50, detuneC:0                           },  // main string — sustained
      { type:'sawtooth', mult:2,   vol:0.24, detuneC:2,  decMult:0.55, susMult:0.3 },  // wire buzz octave
      { type:'sine',     mult:3,   vol:0.14, detuneC:4,  decMult:0.35, susMult:0.1 },
      { type:'sine',     mult:4,   vol:0.08, detuneC:6,  decMult:0.20, susMult:0   },
      { type:'sine',     mult:0.5, vol:0.12, detuneC:-3                            },  // sympathetic sub — sustained
      { type:'sine',     mult:5,   vol:0.04, detuneC:8,  decMult:0.10, susMult:0   },  // high buzz — dies fast
    ],
    filter:   { type:'lowpass', freq:4000, Q:1.5 },
    attack:   0.004, decay: 0.90, sustain: 0.15, release: 0.50, duration: 3.5,
    masterVol: 0.72, naturalDecay: true,
    ksOptions: { feedback: 0.994, stretch: 0.52, exciteFilter: 0.45 },  // mixed: wire buzz + finger
  },

  // ════════════════════════════════════════════════════════
  //  BRASS / WIND
  // ════════════════════════════════════════════════════════

  'Brass Section': {
    // Full horn section: powerful, assertive, wide detuned ensemble
    layers: [
      { type:'sawtooth', mult:1, vol:0.52, detuneC:0   },
      { type:'sawtooth', mult:1, vol:0.38, detuneC:-5  },
      { type:'sawtooth', mult:2, vol:0.28, detuneC:0   },
      { type:'sine',     mult:3, vol:0.14, detuneC:0   },
      { type:'sine',     mult:4, vol:0.08, detuneC:0   },
      { type:'square',   mult:1, vol:0.12, detuneC:7   },
    ],
    filter:   { type:'lowpass', freq:3500, Q:1.2 },
    attack:   0.045, decay: 0.14, sustain: 0.72, release: 0.28, duration: 3.8,
    masterVol: 0.62, naturalDecay: true,
  },

  'French Horn': {
    // Warm mellow horn: rounded harmonics, smooth mid-register
    layers: [
      { type:'sine',     mult:1, vol:0.52, detuneC:0  },
      { type:'triangle', mult:2, vol:0.28, detuneC:0  },
      { type:'sine',     mult:3, vol:0.14, detuneC:0  },
      { type:'sine',     mult:4, vol:0.06, detuneC:0  },
      { type:'sine',     mult:1, vol:0.12, detuneC:-4 },
    ],
    filter:   { type:'lowpass', freq:2200, Q:0.9 },
    attack:   0.08, decay: 0.15, sustain: 0.78, release: 0.40, duration: 4.5,
    masterVol: 0.68, naturalDecay: true,
  },

  'Trumpet': {
    // Bright assertive: strong 1st and 2nd harmonics, crisp attack
    layers: [
      { type:'sawtooth', mult:1, vol:0.48, detuneC:0  },
      { type:'sine',     mult:2, vol:0.35, detuneC:0  },
      { type:'sine',     mult:3, vol:0.18, detuneC:0  },
      { type:'sine',     mult:4, vol:0.10, detuneC:0  },
      { type:'sine',     mult:5, vol:0.05, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:5000, Q:1.0 },
    attack:   0.020, decay: 0.12, sustain: 0.75, release: 0.22, duration: 4.0,
    masterVol: 0.68, naturalDecay: true,
  },

  'Flute': {
    // Breathy flute: sine-dominant, airy high-pass breath texture
    layers: [
      { type:'sine',     mult:1, vol:0.70, detuneC:0 },
      { type:'sine',     mult:2, vol:0.14, detuneC:0 },
      { type:'triangle', mult:3, vol:0.06, detuneC:2 },
      { type:'sine',     mult:4, vol:0.03, detuneC:0 },
    ],
    filter:   { type:'highpass', freq:150, Q:0.7 },
    attack:   0.055, decay: 0.10, sustain: 0.78, release: 0.28, duration: 4.5,
    masterVol: 0.72, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  AMBIENT / FX
  // ════════════════════════════════════════════════════════

  'Texture': {
    // Evolving ambient noise texture: wide detuned, slow-moving
    layers: [
      { type:'sine',     mult:1,   vol:0.38, detuneC:0   },
      { type:'sine',     mult:1,   vol:0.30, detuneC:18  },
      { type:'sine',     mult:1,   vol:0.24, detuneC:-18 },
      { type:'triangle', mult:2,   vol:0.18, detuneC:9   },
      { type:'sine',     mult:0.5, vol:0.22, detuneC:-9  },
      { type:'sine',     mult:3,   vol:0.08, detuneC:5   },
    ],
    filter:   { type:'lowpass', freq:1200, Q:0.6 },
    attack:   1.50, decay: 0.80, sustain: 0.75, release: 3.00, duration: 8.0,
    masterVol: 0.58,
  },

  'Atmosphere': {
    // Vast ambient: extremely slow, huge reverb feel, barely-there
    layers: [
      { type:'sine', mult:1,   vol:0.42, detuneC:0   },
      { type:'sine', mult:1,   vol:0.35, detuneC:12  },
      { type:'sine', mult:1,   vol:0.28, detuneC:-12 },
      { type:'sine', mult:2,   vol:0.15, detuneC:6   },
      { type:'sine', mult:0.5, vol:0.20, detuneC:0   },
      { type:'sine', mult:1,   vol:0.14, detuneC:-20 },
    ],
    filter:   { type:'lowpass', freq:1000, Q:0.5 },
    attack:   2.00, decay: 1.00, sustain: 0.70, release: 4.00, duration: 10.0,
    masterVol: 0.55,
  },

  'Shimmer': {
    // Octave shimmer: high harmonics only, ethereal sparkle
    layers: [
      { type:'sine',     mult:2, vol:0.45, detuneC:0   },
      { type:'sine',     mult:4, vol:0.28, detuneC:5   },
      { type:'sine',     mult:8, vol:0.18, detuneC:-5  },
      { type:'triangle', mult:2, vol:0.20, detuneC:10  },
      { type:'sine',     mult:1, vol:0.12, detuneC:0   },
    ],
    filter:   { type:'highpass', freq:400, Q:0.8 },
    attack:   0.80, decay: 0.50, sustain: 0.68, release: 1.80, duration: 6.0,
    masterVol: 0.60,
  },

  'Sweep FX': {
    // Rising filter sweep: dramatic harmonic opening, cinematic
    layers: [
      { type:'sawtooth', mult:1, vol:0.52, detuneC:0   },
      { type:'sawtooth', mult:1, vol:0.40, detuneC:-10 },
      { type:'sawtooth', mult:1, vol:0.35, detuneC:10  },
      { type:'sine',     mult:2, vol:0.15, detuneC:0   },
    ],
    filter:   { type:'lowpass', freq:200, Q:4.0 },
    attack:   0.05, decay: 0.50, sustain: 0.70, release: 0.80, duration: 4.0,
    masterVol: 0.68,
  },

  // ════════════════════════════════════════════════════════
  //  KEYS (more)
  // ════════════════════════════════════════════════════════

  'Toy Piano': {
    // Tiny keys with metal tines — thin, bright, slightly inharmonic
    layers: [
      { type:'sine',     mult:1,    vol:0.60, detuneC:0                            },
      { type:'sine',     mult:2.80, vol:0.22, detuneC:0,  decMult:0.28, susMult:0 },  // inharmonic tine
      { type:'sine',     mult:5.6,  vol:0.10, detuneC:0,  decMult:0.12, susMult:0 },
      { type:'triangle', mult:3,    vol:0.06, detuneC:5,  decMult:0.20, susMult:0 },
    ],
    filter:   { type:'bandpass', freq:3500, Q:1.2 },
    freqBrightness: 0.40,
    attack:   0.001, decay: 0.55, sustain: 0.0, release: 0.15, duration: 1.8,
    masterVol: 0.78, naturalDecay: true,
  },

  'Honky Tonk': {
    // Two detuned pianos playing together — saloon-style seasick shimmer
    layers: [
      { type:'sine',     mult:1,   vol:0.44, detuneC:0                              },
      { type:'triangle', mult:2,   vol:0.18, detuneC:1,   decMult:0.60, susMult:0.5 },
      { type:'sine',     mult:1,   vol:0.40, detuneC:25,  decMult:0.90, susMult:0.8 },  // detuned piano B
      { type:'triangle', mult:2,   vol:0.14, detuneC:26,  decMult:0.55, susMult:0.4 },
      { type:'sine',     mult:3,   vol:0.08, detuneC:2,   decMult:0.30, susMult:0   },
      { type:'sine',     mult:3,   vol:0.06, detuneC:27,  decMult:0.28, susMult:0   },
    ],
    filter:   { type:'lowpass', freq:4500, Q:0.7 },
    freqBrightness: 0.25,
    attack:   0.004, decay: 1.00, sustain: 0.07, release: 0.80, duration: 2.8,
    masterVol: 0.70, noSweep: true, naturalDecay: true,
  },

  'Clavichord': {
    // Softest keyboard — tangent strikes string gently, intimate, touch-sensitive feel
    layers: [
      { type:'sine',     mult:1,   vol:0.58, detuneC:0                              },
      { type:'triangle', mult:2,   vol:0.22, detuneC:2,  decMult:0.45, susMult:0.25 },
      { type:'sine',     mult:3,   vol:0.08, detuneC:4,  decMult:0.20, susMult:0    },
      { type:'sine',     mult:4,   vol:0.04, detuneC:6,  decMult:0.10, susMult:0    },
    ],
    filter:   { type:'lowpass', freq:2800, Q:0.9 },
    attack:   0.008, decay: 0.45, sustain: 0.18, release: 0.60, duration: 2.2,
    masterVol: 0.74, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  ORGAN (more)
  // ════════════════════════════════════════════════════════

  'Farfisa': {
    // 1960s Italian combo organ — thin, reedy, nasal. Staple of garage rock.
    layers: [
      { type:'square',   mult:1,   vol:0.42, detuneC:0 },
      { type:'square',   mult:2,   vol:0.22, detuneC:0 },
      { type:'triangle', mult:3,   vol:0.14, detuneC:0 },
      { type:'square',   mult:4,   vol:0.08, detuneC:0 },
    ],
    filter:   { type:'bandpass', freq:1200, Q:1.4 },
    attack:   0.006, decay: 0.01, sustain: 0.92, release: 0.05, duration: 5.0,
    masterVol: 0.62,
  },

  'Harmonium': {
    // Bellows-driven reed organ — warm, slightly breathy, devotional
    layers: [
      { type:'sawtooth', mult:1,   vol:0.46, detuneC:0  },
      { type:'triangle', mult:1,   vol:0.28, detuneC:4  },
      { type:'sawtooth', mult:2,   vol:0.20, detuneC:0  },
      { type:'sine',     mult:3,   vol:0.10, detuneC:0  },
      { type:'sine',     mult:1,   vol:0.08, detuneC:-5 },
    ],
    filter:   { type:'lowpass', freq:2200, Q:0.8 },
    attack:   0.12, decay: 0.10, sustain: 0.90, release: 0.20, duration: 5.0,
    masterVol: 0.64, noiseBurstGain: 0.008,
  },

  // ════════════════════════════════════════════════════════
  //  PADS (more)
  // ════════════════════════════════════════════════════════

  'Rain Pad': {
    // Watery shimmer: high-register detuned sines, translucent
    layers: [
      { type:'sine',     mult:2,   vol:0.38, detuneC:0   },
      { type:'sine',     mult:2,   vol:0.28, detuneC:8   },
      { type:'sine',     mult:4,   vol:0.22, detuneC:-6  },
      { type:'triangle', mult:8,   vol:0.14, detuneC:5   },
      { type:'sine',     mult:1,   vol:0.18, detuneC:12  },
      { type:'sine',     mult:3,   vol:0.10, detuneC:-8  },
    ],
    filter:   { type:'highpass', freq:300, Q:0.6 },
    attack:   0.70, decay: 0.45, sustain: 0.68, release: 1.60, duration: 6.5,
    masterVol: 0.58,
  },

  'Haunted Pad': {
    // Unsettling dark ambient: tritone-spaced detuning, low formant, dim glow
    layers: [
      { type:'sine',     mult:1,    vol:0.40, detuneC:0   },
      { type:'sine',     mult:1,    vol:0.30, detuneC:-6  },
      { type:'triangle', mult:1.41, vol:0.22, detuneC:0   },  // tritone partial
      { type:'sine',     mult:0.5,  vol:0.28, detuneC:0   },  // sub darkness
      { type:'sine',     mult:2,    vol:0.10, detuneC:10  },
    ],
    filter:   { type:'lowpass', freq:900, Q:1.2 },
    attack:   1.20, decay: 0.60, sustain: 0.70, release: 2.00, duration: 8.0,
    masterVol: 0.60,
  },

  'Lo-Fi Pad': {
    // Degraded, dream-like: heavy detuning, crushed highs, vinyl warmth
    layers: [
      { type:'sine',     mult:1,   vol:0.50, detuneC:0   },
      { type:'triangle', mult:1,   vol:0.38, detuneC:22  },
      { type:'triangle', mult:1,   vol:0.30, detuneC:-22 },
      { type:'sine',     mult:2,   vol:0.14, detuneC:11  },
      { type:'sine',     mult:0.5, vol:0.18, detuneC:0   },
    ],
    filter:   { type:'lowpass', freq:1100, Q:0.9 },
    attack:   0.60, decay: 0.35, sustain: 0.72, release: 1.50, duration: 6.0,
    masterVol: 0.62,
  },

  // ════════════════════════════════════════════════════════
  //  STRINGS (more)
  // ════════════════════════════════════════════════════════

  'Pizzicato': {
    // Plucked orchestral strings — short, bouncy, playful
    layers: [
      { type:'sine',     mult:1, vol:0.58, detuneC:0                           },
      { type:'triangle', mult:2, vol:0.24, detuneC:0, decMult:0.22, susMult:0 },
      { type:'sine',     mult:3, vol:0.10, detuneC:2, decMult:0.10, susMult:0 },
      { type:'sine',     mult:4, vol:0.04, detuneC:3, decMult:0.05, susMult:0 },
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.8 },
    attack:   0.002, decay: 0.40, sustain: 0.0, release: 0.20, duration: 1.5,
    masterVol: 0.82, naturalDecay: true,
    ksOptions: { feedback: 0.984, stretch: 0.50, exciteFilter: 0.40 },  // light pizzicato touch
  },

  'Tremolo Strings': {
    // Rapid bow tremolo: amplitude flutter at 13 Hz, orchestra tension effect
    layers: [
      { type:'sawtooth', mult:1, vol:0.50, detuneC:0  },
      { type:'sawtooth', mult:1, vol:0.38, detuneC:-5 },
      { type:'sawtooth', mult:1, vol:0.28, detuneC:5  },
      { type:'sine',     mult:2, vol:0.10, detuneC:0  },
    ],
    filter:   { type:'lowpass', freq:2800, Q:0.7 },
    ampLfo:   { rate: 13.0, depth: 0.22 },  // rapid bow tremolo
    attack:   0.22, decay: 0.15, sustain: 0.80, release: 0.65, duration: 5.0,
    masterVol: 0.62, naturalDecay: true,
  },

  'Viola': {
    // Darker than violin — alto register warmth, slightly nasal
    layers: [
      { type:'sawtooth', mult:1, vol:0.52, detuneC:0                            },
      { type:'sawtooth', mult:2, vol:0.22, detuneC:0,  decMult:0.72, susMult:0.78 },
      { type:'triangle', mult:3, vol:0.12, detuneC:2,  decMult:0.50, susMult:0.42 },
      { type:'sine',     mult:4, vol:0.05, detuneC:3,  decMult:0.28, susMult:0.12 },
      { type:'sine',     mult:1, vol:0.08, detuneC:-5, decMult:0.88, susMult:0.90 },
    ],
    filter:   { type:'lowpass', freq:3200, Q:0.85 },
    attack:   0.22, decay: 0.14, sustain: 0.76, release: 0.60, duration: 5.5,
    masterVol: 0.68, naturalDecay: true,
  },

  'Contrabass': {
    // Deep orchestral double bass — massive, dark, slow bow attack
    layers: [
      { type:'sawtooth', mult:1,   vol:0.58, detuneC:0  },
      { type:'sawtooth', mult:2,   vol:0.18, detuneC:0  },
      { type:'triangle', mult:3,   vol:0.08, detuneC:2  },
      { type:'sine',     mult:1,   vol:0.14, detuneC:-5 },
      { type:'sine',     mult:0.5, vol:0.20, detuneC:0  },  // sub fundamental
    ],
    filter:   { type:'lowpass', freq:1400, Q:0.8 },
    attack:   0.40, decay: 0.22, sustain: 0.82, release: 0.80, duration: 5.5,
    masterVol: 0.65, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  CHOIR (more)
  // ════════════════════════════════════════════════════════

  'Mm Voice': {
    // Closed-mouth hum: sawtooth source → FORMANT_CHAINS at 280/1000/2200 Hz
    layers: [
      { type:'sawtooth', mult:1, vol:0.48, detuneC:0  },
      { type:'sawtooth', mult:1, vol:0.30, detuneC:5  },
      { type:'sawtooth', mult:1, vol:0.22, detuneC:-5 },
    ],
    filter:   { type:'lowpass', freq:3000, Q:0.7 },
    attack:   0.38, decay: 0.22, sustain: 0.85, release: 0.70, duration: 5.0,
    masterVol: 0.55,
  },

  'Ee Voice': {
    // Front-vowel brightness: sawtooth source → FORMANT_CHAINS at 350/2200/3000 Hz
    layers: [
      { type:'sawtooth', mult:1, vol:0.44, detuneC:0  },
      { type:'sawtooth', mult:1, vol:0.30, detuneC:6  },
      { type:'sawtooth', mult:1, vol:0.22, detuneC:-6 },
    ],
    filter:   { type:'lowpass', freq:4000, Q:0.7 },
    attack:   0.42, decay: 0.24, sustain: 0.80, release: 0.75, duration: 5.0,
    masterVol: 0.55,
  },

  'Gospel Choir': {
    // Wide, energetic: sawtooth source → FORMANT_CHAINS at 800/1300/2700 Hz
    layers: [
      { type:'sawtooth', mult:1, vol:0.38, detuneC:0   },
      { type:'sawtooth', mult:1, vol:0.30, detuneC:8   },
      { type:'sawtooth', mult:1, vol:0.26, detuneC:-8  },
      { type:'sawtooth', mult:1, vol:0.18, detuneC:14  },
      { type:'sawtooth', mult:1, vol:0.16, detuneC:-14 },
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.6 },
    attack:   0.35, decay: 0.20, sustain: 0.88, release: 0.80, duration: 5.5,
    masterVol: 0.50,
  },

  // ════════════════════════════════════════════════════════
  //  SYNTH (more)
  // ════════════════════════════════════════════════════════

  'DX7 Bell': {
    // FM-style bell: carrier + fast-decaying modulator sines at FM ratios
    // 14:1 ratio is the classic DX7 E.Piano/bell operator configuration
    layers: [
      { type:'sine', mult:1,    vol:0.55, detuneC:0                             },  // carrier
      { type:'sine', mult:14,   vol:0.30, detuneC:0,  decMult:0.08, susMult:0  },  // modulator (dies instantly = FM attack)
      { type:'sine', mult:3.5,  vol:0.20, detuneC:0,  decMult:0.22, susMult:0  },
      { type:'sine', mult:2.76, vol:0.12, detuneC:0,  decMult:0.15, susMult:0  },
      { type:'sine', mult:5.4,  vol:0.06, detuneC:0,  decMult:0.08, susMult:0  },
    ],
    attack:   0.001, decay: 2.20, sustain: 0.0, release: 0.35, duration: 4.5,
    masterVol: 0.72, naturalDecay: true,
  },

  'Juno Chorus': {
    // Roland Juno-style: three chorus layers at different rates, lush warmth
    layers: [
      { type:'triangle', mult:1, vol:0.48, detuneC:0   },
      { type:'triangle', mult:1, vol:0.38, detuneC:10  },
      { type:'triangle', mult:1, vol:0.30, detuneC:-10 },
      { type:'sine',     mult:2, vol:0.16, detuneC:5   },
      { type:'sine',     mult:3, vol:0.06, detuneC:0   },
    ],
    filter:   { type:'lowpass', freq:3200, Q:0.8 },
    attack:   0.045, decay: 0.18, sustain: 0.75, release: 0.65, duration: 4.0,
    masterVol: 0.66,
  },

  'SID Chip': {
    // Commodore 64 SID: square wave with raw digital character
    layers: [
      { type:'square', mult:1, vol:0.60, detuneC:0  },
      { type:'square', mult:1, vol:0.35, detuneC:5  },
      { type:'square', mult:2, vol:0.15, detuneC:0  },
      { type:'square', mult:3, vol:0.06, detuneC:0  },
    ],
    filter:   { type:'bandpass', freq:1800, Q:1.8 },
    attack:   0.004, decay: 0.08, sustain: 0.70, release: 0.15, duration: 2.5,
    masterVol: 0.68,
  },

  'Reese Bass': {
    // Classic drum & bass: two heavily detuned saws beating slowly against each other
    layers: [
      { type:'sawtooth', mult:1, vol:0.60, detuneC:0   },
      { type:'sawtooth', mult:1, vol:0.55, detuneC:-18 },
      { type:'sine',     mult:1, vol:0.22, detuneC:9   },
      { type:'square',   mult:2, vol:0.10, detuneC:0   },
    ],
    filter:   { type:'lowpass', freq:500, Q:2.8 },
    attack:   0.025, decay: 0.20, sustain: 0.80, release: 0.30, duration: 3.5,
    masterVol: 0.72,
  },

  // ════════════════════════════════════════════════════════
  //  BASS (more)
  // ════════════════════════════════════════════════════════

  'Fretless Bass': {
    // Smooth mwah: round fundamental, no fret click, slight portamento feel
    layers: [
      { type:'triangle', mult:1,   vol:0.65, detuneC:0  },
      { type:'sine',     mult:2,   vol:0.28, detuneC:0  },
      { type:'triangle', mult:3,   vol:0.10, detuneC:2  },
      { type:'sine',     mult:1,   vol:0.12, detuneC:-4 },
    ],
    filter:   { type:'lowpass', freq:1800, Q:1.4 },
    attack:   0.018, decay: 0.28, sustain: 0.55, release: 0.35, duration: 3.0,
    masterVol: 0.80,
  },

  'Slap Bass': {
    // Thumb slap technique: bright, percussive, funky click then thumping body
    layers: [
      { type:'sine',     mult:1,   vol:0.62, detuneC:0,  decMult:1.0,  susMult:0.2 },
      { type:'sawtooth', mult:1,   vol:0.35, detuneC:0,  decMult:0.08, susMult:0   },  // thumb click — ultra fast
      { type:'triangle', mult:2,   vol:0.18, detuneC:0,  decMult:0.30, susMult:0   },
      { type:'sine',     mult:0.5, vol:0.20, detuneC:0,  decMult:0.80, susMult:0.1 },
    ],
    filter:   { type:'bandpass', freq:1200, Q:1.6 },
    attack:   0.002, decay: 0.35, sustain: 0.08, release: 0.20, duration: 1.8,
    masterVol: 0.82, noiseBurstGain: 0.020, naturalDecay: true,
  },

  '808': {
    // Roland 808 pitched: pure sine sub-thud with ultra-fast attack and long tail
    layers: [
      { type:'sine', mult:1,   vol:0.88, detuneC:0 },
      { type:'sine', mult:2,   vol:0.08, detuneC:0, decMult:0.04, susMult:0 },  // click harmonic
      { type:'sine', mult:0.5, vol:0.12, detuneC:0 },
    ],
    attack:   0.003, decay: 1.80, sustain: 0.0, release: 0.30, duration: 3.5,
    masterVol: 0.88, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  BELLS (more)
  // ════════════════════════════════════════════════════════

  'Handpan': {
    // Modern steel tongue drum: warm, spacious, meditative
    // Real handpan partials: fundamental, octave, fifth above octave
    layers: [
      { type:'sine', mult:1,    vol:0.62, detuneC:0                           },  // ding (fundamental)
      { type:'sine', mult:2,    vol:0.25, detuneC:0, decMult:0.55, susMult:0 },  // octave — fades
      { type:'sine', mult:1.87, vol:0.18, detuneC:0, decMult:0.40, susMult:0 },  // unique handpan partial
      { type:'sine', mult:3,    vol:0.08, detuneC:0, decMult:0.22, susMult:0 },
    ],
    attack:   0.003, decay: 3.5, sustain: 0.02, release: 0.60, duration: 6.0,
    masterVol: 0.78, naturalDecay: true,
  },

  'Tubular Bells': {
    // Orchestral struck tubes: rich inharmonic partials, dramatic long ring
    layers: [
      { type:'sine', mult:1,    vol:0.55, detuneC:0                           },
      { type:'sine', mult:2.81, vol:0.28, detuneC:0, decMult:0.60, susMult:0 },  // prominent 2nd mode
      { type:'sine', mult:5.19, vol:0.16, detuneC:0, decMult:0.30, susMult:0 },
      { type:'sine', mult:6.66, vol:0.10, detuneC:0, decMult:0.15, susMult:0 },
      { type:'sine', mult:8.93, vol:0.06, detuneC:0, decMult:0.08, susMult:0 },
    ],
    attack:   0.002, decay: 5.0, sustain: 0.0, release: 0.80, duration: 8.0,
    masterVol: 0.72, naturalDecay: true,
  },

  'Steel Drum': {
    // Caribbean steel pan: bright, punchy, tropical
    // Partials: fundamental + octave + 5th above octave + double octave
    layers: [
      { type:'sine', mult:1,    vol:0.60, detuneC:0                           },
      { type:'sine', mult:2,    vol:0.30, detuneC:0, decMult:0.45, susMult:0 },
      { type:'sine', mult:3,    vol:0.18, detuneC:0, decMult:0.25, susMult:0 },
      { type:'sine', mult:4.18, vol:0.12, detuneC:0, decMult:0.14, susMult:0 },
    ],
    attack:   0.002, decay: 1.60, sustain: 0.0, release: 0.25, duration: 3.0,
    masterVol: 0.80, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  PLUCKED (more)
  // ════════════════════════════════════════════════════════

  'Banjo': {
    // Bright metallic twang — head resonance gives it a nasal upper bark
    layers: [
      { type:'triangle', mult:1,   vol:0.50, detuneC:0                           },
      { type:'sawtooth', mult:1,   vol:0.28, detuneC:0,  decMult:0.15, susMult:0 },  // metallic edge
      { type:'sine',     mult:2,   vol:0.22, detuneC:0,  decMult:0.35, susMult:0 },
      { type:'sine',     mult:3,   vol:0.12, detuneC:2,  decMult:0.18, susMult:0 },
      { type:'sine',     mult:5,   vol:0.05, detuneC:4,  decMult:0.08, susMult:0 },
    ],
    filter:   { type:'bandpass', freq:2800, Q:1.2 },
    attack:   0.002, decay: 0.55, sustain: 0.04, release: 0.22, duration: 1.8,
    masterVol: 0.80, noiseBurstGain: 0.014, naturalDecay: true,
    ksOptions: { feedback: 0.990, stretch: 0.42, exciteFilter: 0.10 },  // hard pick, very bright metallic
  },

  'Ukulele': {
    // Warm, bright, small body — high-strung Hawaiian cheer
    layers: [
      { type:'triangle', mult:1, vol:0.58, detuneC:0                           },
      { type:'sine',     mult:2, vol:0.24, detuneC:0,  decMult:0.38, susMult:0 },
      { type:'sine',     mult:3, vol:0.10, detuneC:2,  decMult:0.18, susMult:0 },
      { type:'sine',     mult:4, vol:0.04, detuneC:3,  decMult:0.09, susMult:0 },
    ],
    filter:   { type:'lowpass', freq:4500, Q:0.8 },
    freqBrightness: 0.22,
    attack:   0.002, decay: 0.50, sustain: 0.03, release: 0.28, duration: 1.8,
    masterVol: 0.80, naturalDecay: true,
    ksOptions: { feedback: 0.993, stretch: 0.50, exciteFilter: 0.50 },  // soft nylon/gut string
  },

  'Mandolin': {
    // Double-string shimmer: each course detuned slightly, fast tremolo in fast playing
    layers: [
      { type:'sine',     mult:1, vol:0.52, detuneC:0                           },
      { type:'sine',     mult:1, vol:0.40, detuneC:6,  decMult:0.92, susMult:0.85 },  // double course
      { type:'triangle', mult:2, vol:0.20, detuneC:0,  decMult:0.40, susMult:0    },
      { type:'sine',     mult:3, vol:0.08, detuneC:2,  decMult:0.18, susMult:0    },
    ],
    filter:   { type:'lowpass', freq:4800, Q:0.9 },
    attack:   0.002, decay: 0.60, sustain: 0.04, release: 0.25, duration: 2.0,
    masterVol: 0.80, naturalDecay: true,
    ksOptions: { feedback: 0.991, stretch: 0.43, exciteFilter: 0.15 },  // hard pick, metallic double course
  },

  // ════════════════════════════════════════════════════════
  //  GUITAR  (new category)
  // ════════════════════════════════════════════════════════

  'Clean Guitar': {
    // Single-coil electric clean — round, warm, Fender-style
    layers: [
      { type:'triangle', mult:1, vol:0.55, detuneC:0                           },
      { type:'sine',     mult:2, vol:0.26, detuneC:0,  decMult:0.50, susMult:0.20 },
      { type:'sine',     mult:3, vol:0.12, detuneC:2,  decMult:0.28, susMult:0    },
      { type:'sine',     mult:4, vol:0.05, detuneC:3,  decMult:0.14, susMult:0    },
    ],
    filter:   { type:'lowpass', freq:3800, Q:0.9 },
    freqBrightness: 0.22,
    attack:   0.004, decay: 0.70, sustain: 0.12, release: 0.40, duration: 2.8,
    masterVol: 0.80, noiseBurstGain: 0.010, naturalDecay: true,
    ksOptions: { feedback: 0.9988, stretch: 0.52, exciteFilter: 0.30 },  // medium pick, electric guitar
  },

  'Jazz Guitar': {
    // Hollow-body archtop — dark, warm, round. No treble, pure midrange
    layers: [
      { type:'triangle', mult:1, vol:0.65, detuneC:0                           },
      { type:'sine',     mult:2, vol:0.20, detuneC:0,  decMult:0.42, susMult:0.12 },
      { type:'sine',     mult:3, vol:0.06, detuneC:2,  decMult:0.18, susMult:0    },
      { type:'sine',     mult:1, vol:0.08, detuneC:-4, decMult:0.88, susMult:0.80 },  // body warmth
    ],
    filter:   { type:'lowpass', freq:1800, Q:0.75 },
    attack:   0.005, decay: 0.55, sustain: 0.08, release: 0.35, duration: 2.2,
    masterVol: 0.80, naturalDecay: true,
    ksOptions: { feedback: 0.9985, stretch: 0.55, exciteFilter: 0.65 },  // thick jazz string, very warm
  },

  'Funk Strat': {
    // Bright single-coil: tight, percussive, snappy — Nile Rodgers territory
    layers: [
      { type:'triangle', mult:1, vol:0.48, detuneC:0                           },
      { type:'sawtooth', mult:1, vol:0.22, detuneC:0,  decMult:0.12, susMult:0 },  // pick attack
      { type:'sine',     mult:2, vol:0.28, detuneC:0,  decMult:0.38, susMult:0 },
      { type:'sine',     mult:3, vol:0.12, detuneC:3,  decMult:0.18, susMult:0 },
    ],
    filter:   { type:'bandpass', freq:3000, Q:1.3 },
    attack:   0.002, decay: 0.38, sustain: 0.06, release: 0.22, duration: 1.6,
    masterVol: 0.80, noiseBurstGain: 0.014, naturalDecay: true,
    ksOptions: { feedback: 0.990, stretch: 0.48, exciteFilter: 0.12 },  // thin pick, aggressive attack
  },

  'Crunch Guitar': {
    // Mild overdrive: the harmonics grow and sustain — classic rock rhythm
    layers: [
      { type:'sawtooth', mult:1, vol:0.50, detuneC:0  },
      { type:'square',   mult:1, vol:0.30, detuneC:4  },
      { type:'sawtooth', mult:2, vol:0.20, detuneC:0  },
      { type:'sine',     mult:3, vol:0.10, detuneC:0  },
      { type:'square',   mult:2, vol:0.08, detuneC:8  },
    ],
    filter:   { type:'lowpass', freq:3200, Q:1.4 },
    attack:   0.010, decay: 0.22, sustain: 0.55, release: 0.40, duration: 3.2,
    masterVol: 0.68, naturalDecay: true,
  },

  'Lap Steel': {
    // Pedal steel / slide: slow gliding tone, sustained, Hawaiian lilt
    layers: [
      { type:'sine',     mult:1, vol:0.58, detuneC:0  },
      { type:'triangle', mult:2, vol:0.26, detuneC:0  },
      { type:'sine',     mult:3, vol:0.10, detuneC:2  },
      { type:'sine',     mult:1, vol:0.12, detuneC:-6 },
    ],
    filter:   { type:'lowpass', freq:3500, Q:0.85 },
    attack:   0.22, decay: 0.18, sustain: 0.72, release: 0.90, duration: 5.5,
    masterVol: 0.72, naturalDecay: true,
  },

  // ════════════════════════════════════════════════════════
  //  WORLD  (new category)
  // ════════════════════════════════════════════════════════

  'Duduk': {
    // Armenian double-reed: mournful, breathy, ancient sorrow
    layers: [
      { type:'sawtooth', mult:1, vol:0.42, detuneC:0  },
      { type:'triangle', mult:1, vol:0.32, detuneC:5  },
      { type:'sawtooth', mult:2, vol:0.18, detuneC:0  },
      { type:'sine',     mult:3, vol:0.10, detuneC:2  },
      { type:'triangle', mult:1, vol:0.08, detuneC:-4 },
    ],
    filter:   { type:'bandpass', freq:550, Q:2.2 },
    attack:   0.14, decay: 0.15, sustain: 0.82, release: 0.45, duration: 5.5,
    masterVol: 0.68, noiseBurstGain: 0.010, naturalDecay: true,
  },

  'Erhu': {
    // Chinese bowed string: nasal, ornamental, deeply expressive
    layers: [
      { type:'sawtooth', mult:1, vol:0.50, detuneC:0  },
      { type:'sawtooth', mult:2, vol:0.22, detuneC:0  },
      { type:'triangle', mult:3, vol:0.14, detuneC:3  },
      { type:'sine',     mult:4, vol:0.06, detuneC:5  },
      { type:'sine',     mult:1, vol:0.10, detuneC:6  },
    ],
    filter:   { type:'bandpass', freq:700, Q:2.5 },
    attack:   0.20, decay: 0.12, sustain: 0.80, release: 0.55, duration: 5.5,
    masterVol: 0.68, naturalDecay: true,
  },

  'Santur': {
    // Persian hammered dulcimer: bright struck wire strings, double courses
    layers: [
      { type:'sine',     mult:1, vol:0.56, detuneC:0                           },
      { type:'sine',     mult:1, vol:0.42, detuneC:8,  decMult:0.92, susMult:0.80 },  // double course
      { type:'sine',     mult:2, vol:0.20, detuneC:0,  decMult:0.40, susMult:0    },
      { type:'sine',     mult:3, vol:0.08, detuneC:3,  decMult:0.18, susMult:0    },
    ],
    filter:   { type:'lowpass', freq:5000, Q:0.9 },
    attack:   0.001, decay: 1.20, sustain: 0.06, release: 0.45, duration: 3.5,
    masterVol: 0.78, naturalDecay: true,
  },

  'Oud': {
    // Arabic lute: warm, dark pluck, no frets, ancient resonance
    layers: [
      { type:'triangle', mult:1, vol:0.58, detuneC:0                           },
      { type:'sawtooth', mult:1, vol:0.18, detuneC:0,  decMult:0.15, susMult:0 },  // pick transient
      { type:'sine',     mult:2, vol:0.22, detuneC:0,  decMult:0.45, susMult:0 },
      { type:'sine',     mult:3, vol:0.08, detuneC:3,  decMult:0.22, susMult:0 },
      { type:'sine',     mult:1, vol:0.06, detuneC:-6, decMult:0.90, susMult:0.80 },
    ],
    filter:   { type:'lowpass', freq:2800, Q:1.0 },
    attack:   0.003, decay: 0.85, sustain: 0.06, release: 0.45, duration: 3.0,
    masterVol: 0.78, noiseBurstGain: 0.010, naturalDecay: true,
  },

  'Gamelan': {
    // Balinese bronze gong / gender: shimmering inharmonic, hypnotic cycling
    layers: [
      { type:'sine', mult:1,    vol:0.55, detuneC:0                           },
      { type:'sine', mult:1.51, vol:0.30, detuneC:0,  decMult:0.55, susMult:0 },  // 5th below octave
      { type:'sine', mult:2.25, vol:0.20, detuneC:0,  decMult:0.35, susMult:0 },
      { type:'sine', mult:3.03, vol:0.12, detuneC:0,  decMult:0.20, susMult:0 },
      { type:'sine', mult:4.09, vol:0.06, detuneC:0,  decMult:0.10, susMult:0 },
    ],
    attack:   0.003, decay: 4.0, sustain: 0.0, release: 0.60, duration: 7.0,
    masterVol: 0.75, naturalDecay: true,
  },

  'Didgeridoo': {
    // Circular-breathing drone: deep, resonant, ancient Australian ritual
    layers: [
      { type:'sawtooth', mult:1,   vol:0.60, detuneC:0  },
      { type:'sine',     mult:0.5, vol:0.40, detuneC:0  },  // sub-drone
      { type:'triangle', mult:2,   vol:0.20, detuneC:0  },
      { type:'sine',     mult:3,   vol:0.10, detuneC:0  },
      { type:'sine',     mult:1,   vol:0.08, detuneC:8  },
    ],
    filter:   { type:'bandpass', freq:180, Q:2.8 },
    ampLfo:   { rate: 2.5, depth: 0.10 },  // breath pulse
    attack:   0.35, decay: 0.20, sustain: 0.88, release: 0.60, duration: 6.0,
    masterVol: 0.65,
  },

  'Shamisen': {
    // Japanese 3-string: bright buzz (sawari), fast decay, dramatic pluck
    layers: [
      { type:'sawtooth', mult:1, vol:0.52, detuneC:0                           },
      { type:'sawtooth', mult:2, vol:0.26, detuneC:2,  decMult:0.20, susMult:0 },  // sawari buzz — fast
      { type:'sine',     mult:3, vol:0.12, detuneC:4,  decMult:0.12, susMult:0 },
      { type:'sine',     mult:1, vol:0.08, detuneC:-3, decMult:0.90, susMult:0.70 },
    ],
    filter:   { type:'lowpass', freq:5500, Q:1.2 },
    attack:   0.002, decay: 0.75, sustain: 0.10, release: 0.35, duration: 2.5,
    masterVol: 0.78, noiseBurstGain: 0.012, naturalDecay: true,
    ksOptions: { feedback: 0.991, stretch: 0.44, exciteFilter: 0.20 },  // bamboo pick, bright edge
  },

  'Kora': {
    // West African bridge harp: 21 strings, shimmering waterfall of overtones
    layers: [
      { type:'sine',     mult:1, vol:0.55, detuneC:0                           },
      { type:'sine',     mult:2, vol:0.28, detuneC:0,  decMult:0.42, susMult:0 },
      { type:'triangle', mult:3, vol:0.14, detuneC:2,  decMult:0.22, susMult:0 },
      { type:'sine',     mult:1, vol:0.12, detuneC:7,  decMult:0.80, susMult:0.60 },  // sympathetic string
      { type:'sine',     mult:4, vol:0.06, detuneC:4,  decMult:0.12, susMult:0 },
    ],
    filter:   { type:'lowpass', freq:6000, Q:0.75 },
    attack:   0.002, decay: 1.00, sustain: 0.08, release: 0.55, duration: 3.5,
    masterVol: 0.78, naturalDecay: true,
    ksOptions: { feedback: 0.993, stretch: 0.47, exciteFilter: 0.30 },  // soft kora style pluck
  },
};

// ════════════════════════════════════════════════════════
//  KARPLUS-STRONG PHYSICAL STRING SYNTHESIS
// ════════════════════════════════════════════════════════

// Generates a plucked-string waveform entirely in JavaScript — no AudioWorklet needed.
// Algorithm: fill a delay-line of length N = sr/freq with noise, then recirculate
// through a 1-pole lowpass (simple average). The lowpass slowly damps high frequencies
// each cycle, producing the exponentially-decaying, spectrally-evolving sound of a
// real plucked string. stretch < 0.5 = brighter (faster HF decay), > 0.5 = darker.
function generateKarplusStrong(frequency, duration, sr, opts = {}) {
  const N = Math.round(sr / frequency);
  if (N < 2) return new Float32Array(Math.ceil(duration * sr));
  const total    = Math.ceil(duration * sr);
  const out      = new Float32Array(total);
  const buf      = new Float32Array(N);
  const exciteLen = Math.min(opts.exciteLen ?? N, N);
  for (let i = 0; i < exciteLen; i++) buf[i] = Math.random() * 2 - 1;

  // Excitation filter: models where on the string the pick/finger contacts.
  // exciteFilter=0 → white noise (bright, metallic, near-bridge pluck)
  // exciteFilter=0.7 → warm filtered noise (soft fingertip, neck pluck)
  // A simple 1-pole IIR lowpass on the delay-line content shapes the initial timbre
  // without affecting the resonant decay (which is controlled by stretch).
  const ef = opts.exciteFilter ?? 0.0;
  if (ef > 0.001) {
    let prev = 0;
    for (let i = 0; i < exciteLen; i++) {
      buf[i] = (1 - ef) * buf[i] + ef * prev;
      prev = buf[i];
    }
  }

  const feedback = opts.feedback ?? 0.996;   // decay rate per cycle (higher = longer ring)
  const stretch  = opts.stretch  ?? 0.5;     // lowpass blend (0.5 = simple average)
  let ptr = 0;
  for (let i = 0; i < total; i++) {
    const curr = buf[ptr];
    const next = buf[(ptr + 1) % N];
    out[i] = curr;
    buf[ptr] = (stretch * curr + (1 - stretch) * next) * feedback;
    ptr = (ptr + 1) % N;
  }
  // Cosine fade-in over first 3ms — prevents the DC-step click at onset
  const fadeIn = Math.min(Math.ceil(0.003 * sr), total);
  for (let i = 0; i < fadeIn; i++) out[i] *= 0.5 * (1 - Math.cos(Math.PI * i / fadeIn));
  return out;
}

// Presets that use Karplus-Strong synthesis instead of oscillators.
// All must have naturalDecay:true (KS has its own built-in exponential decay).
const KS_PRESETS = new Set([
  'Pluck', 'Harp', 'Nylon Guitar', 'Koto', 'Sitar', 'Pizzicato',
  'Banjo', 'Ukulele', 'Mandolin',
  'Clean Guitar', 'Jazz Guitar', 'Funk Strat',
  'Shamisen', 'Kora',
]);

// ════════════════════════════════════════════════════════
//  MULTI-FORMANT VOCAL SYNTHESIS
// ════════════════════════════════════════════════════════

// Formant frequencies [Hz] and Q-factor for each vocal/wind preset.
// Each entry is an array of [freq, Q] pairs (parallel bandpass filters).
// This approximates the source-filter model of the voice: a harmonically rich
// sawtooth "buzz" is shaped by the resonant cavities of the vocal tract.
const FORMANT_CHAINS = {
  'Choir':        [[750, 8],  [1200, 6], [2600, 5]],
  'Ah Choir':     [[850, 9],  [1200, 7], [2800, 5]],
  'Oh Voice':     [[500, 9],  [875,  6], [2500, 5]],
  'Falsetto':     [[400, 8],  [2000, 6], [2900, 5]],
  'Mm Voice':     [[280, 10], [1000, 5], [2200, 4]],
  'Ee Voice':     [[350, 9],  [2200, 8], [3000, 5]],
  'Gospel Choir': [[800, 7],  [1300, 6], [2700, 5]],
};

// Build a parallel bank of bandpass filters that shape the source signal into
// a vowel timbre. Returns a GainNode that acts as the combined input; oscillators
// connect here rather than to the downstream destination.
function buildFormantDest(formants, finalNode) {
  const inputGain = audioCtx.createGain();
  inputGain.gain.value = 0.7 / formants.length;   // normalize so summed filters don't clip
  formants.forEach(([freq, Q]) => {
    const bpf = audioCtx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = freq;
    bpf.Q.value = Q;
    inputGain.connect(bpf);
    bpf.connect(finalNode);
  });
  return inputGain;
}

// ════════════════════════════════════════════════════════
//  VIBRATO WITH DELAYED ONSET
// ════════════════════════════════════════════════════════

// Real string players and singers start notes straight, then fade vibrato in after
// ~0.3–0.5s. Immediate vibrato sounds mechanical. Each preset has:
//   rate  — LFO frequency in Hz (typical violin ~6 Hz, cello ~5.5 Hz, choir ~5.5 Hz)
//   depth — peak pitch deviation in cents (±cents via osc.detune modulation)
//   delay — seconds before vibrato begins to fade in
const VIBRATO_PRESETS = {
  'Solo Violin':     { rate: 6.2, depth: 30, delay: 0.40 },
  'Cello':           { rate: 5.5, depth: 24, delay: 0.50 },
  'Viola':           { rate: 5.8, depth: 27, delay: 0.45 },
  'Contrabass':      { rate: 4.8, depth: 18, delay: 0.60 },  // slow heavy bow vibrato
  'Strings':         { rate: 5.0, depth: 14, delay: 0.35 },
  'Orchestra':       { rate: 5.2, depth: 12, delay: 0.30 },
  'Chamber':         { rate: 5.5, depth: 16, delay: 0.35 },
  'Choir':           { rate: 5.4, depth: 18, delay: 0.38 },
  'Ah Choir':        { rate: 5.6, depth: 16, delay: 0.40 },
  'Tremolo Strings': { rate: 5.0, depth: 12, delay: 0.20 },
  'Falsetto':        { rate: 5.8, depth: 14, delay: 0.30 },
  'Flute':           { rate: 5.5, depth: 16, delay: 0.45 },  // embouchure vibrato
  'French Horn':     { rate: 5.0, depth: 20, delay: 0.55 },  // warm delayed horn vibrato
  'Erhu':            { rate: 6.5, depth: 35, delay: 0.25 },  // fast expressive Chinese bow
};

// ════════════════════════════════════════════════════════
//  CONTINUOUS BOW NOISE
// ════════════════════════════════════════════════════════

// Bowed instruments have a continuous low-level noise component from the bow
// hair sliding across the string. A looping pink-noise layer through a bandpass
// filter at 1.8–2.5 kHz reproduces this texture during the sustained portion.
const BOW_NOISE_PRESETS = new Set(['Solo Violin', 'Cello', 'Viola', 'Erhu']);

// ════════════════════════════════════════════════════════
//  PIANO INHARMONICITY
// ════════════════════════════════════════════════════════

// Real piano strings are stiff, causing partial frequencies to be slightly sharp
// of their theoretical harmonic positions. The deviation grows with partial number
// and is larger for low-register (stiffer, heavier) strings.
// Formula: f_n = n * f0 * sqrt(1 + B*n²), additional cents = 1200*log2(sqrt(1+B*n²))
// B coefficient: ~0.00035 at A2 (110 Hz), ~0.00007 at A5 (880 Hz).
const INHARMONIC_PRESETS = new Set([
  'Piano', 'Grand Piano', 'Upright Piano', 'Bright Keys', 'Wurlitzer', 'Honky Tonk',
]);

// ════════════════════════════════════════════════════════
//  BODY RESONANCE FOR BOWED STRINGS
// ════════════════════════════════════════════════════════

// Acoustic string instruments have strong resonant peaks from their wooden body.
// These are NOT formants (they don't replace the spectrum like vocal formants do) —
// they ADD resonant coloring on top of the raw oscillator signal. Each entry is
// an array of [freq Hz, Q] pairs. Frequencies are measured from real instruments:
//   Violin: air resonance A0 ~275 Hz, corpus A1 ~460 Hz, strong "bridge hill" ~2500 Hz
//   Cello:  A0 ~108 Hz, A1 ~195 Hz, mid-body resonances ~300 Hz
//   Viola:  between violin and cello (~175 Hz, ~310 Hz, ~440 Hz)
const BODY_RESONANCE_CHAINS = {
  'Solo Violin': [[275, 6],  [462, 10], [580, 5],  [2500, 5]],
  'Cello':       [[108, 7],  [195, 10], [318, 5],  [1100, 4]],
  'Viola':       [[175, 7],  [312, 10], [448, 5],  [1800, 4]],
  'Strings':     [[195, 4],  [390, 7],  [630, 3]],
  'Orchestra':   [[180, 4],  [380, 6],  [610, 3]],
  'Chamber':     [[200, 5],  [415, 8],  [650, 4]],
};

// Build a parallel resonance network that ADDS body-resonance coloring to the dry signal.
// Unlike buildFormantDest (which replaces the signal path), this mixes resonant peaks
// IN with the original signal — the dry path is preserved at full gain, resonances add color.
function buildBodyResonanceMix(resonances, finalNode) {
  const inputGain = audioCtx.createGain();
  inputGain.gain.value = 1.0;
  inputGain.connect(finalNode);   // dry path: passes through unchanged
  const addAmt = 0.28 / resonances.length;  // each resonance adds ~28%/count of gain
  resonances.forEach(([freq, Q]) => {
    const bpf = audioCtx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = freq;
    bpf.Q.value = Q;
    const resGain = audioCtx.createGain();
    resGain.gain.value = addAmt;
    inputGain.connect(bpf);
    bpf.connect(resGain);
    resGain.connect(finalNode);
  });
  return inputGain;
}

// ════════════════════════════════════════════════════════
//  CONTINUOUS WIND / BREATH NOISE
// ════════════════════════════════════════════════════════

// Wind instruments have a sustained breath noise throughout the note.
// Flute: embouchure noise ~600 Hz (edge tone turbulence)
// Trumpet/Brass: mouthpiece buzz leakage at higher frequencies
// Each entry: { freq: bandpass center Hz, Q: filter Q, vol: gain level }
const WIND_NOISE_PRESETS = {
  'Flute':         { freq: 600,  Q: 0.5, vol: 0.014 },   // airy embouchure edge tone
  'Trumpet':       { freq: 2400, Q: 1.0, vol: 0.007 },   // lip buzz residue
  'Brass Section': { freq: 1800, Q: 0.8, vol: 0.006 },   // ensemble air
  'French Horn':   { freq: 1400, Q: 0.9, vol: 0.007 },   // warm mouthpiece breath
};

// Choir/vocal breathiness: very low-gain pink noise through a lowpass ~400 Hz.
// Adds the slight "air" of real singing without obscuring the vowel formants.
const BREATH_NOISE_PRESETS = new Set([
  'Choir', 'Ah Choir', 'Oh Voice', 'Mm Voice', 'Ee Voice', 'Gospel Choir', 'Falsetto',
]);

// ════════════════════════════════════════════════════════
//  PER-NOTE ENSEMBLE DETUNING
// ════════════════════════════════════════════════════════

// String and choir ensembles have multiple players, each slightly out of tune with
// the others. For each note in a chord we add a small random offset (±5 cents) that
// applies to ALL layers of that note — so adjacent chord tones subtly drift against
// each other, sounding like a real section rather than a synthesizer.
const ENSEMBLE_DETUNE_PRESETS = new Set([
  // Bowed sections — each player has natural micro-tuning variance
  'Strings', 'Orchestra', 'Chamber', 'Tremolo Strings',
  'Solo Violin', 'Cello', 'Viola', 'Contrabass',
  // Choral / vocal
  'Choir', 'Ah Choir', 'Gospel Choir', 'Oh Voice', 'Mm Voice', 'Ee Voice', 'Falsetto',
]);

// Instruments that are "already in motion" when a chord change arrives.
// For these, new notes skip the slow attack swell and enter at sustain level
// (30ms crossfade) — exactly what a cellist or singer does when moving between
// chords without stopping. Only activates when notes are already playing;
// the very first chord still gets the full attack swell.
// Add/remove presets here to control legato behaviour per instrument.
const LEGATO_PRESETS = new Set([
  // Bowed strings — bow is already moving
  'Solo Violin', 'Cello', 'Viola', 'Strings', 'Orchestra', 'Chamber', 'Tremolo Strings',
  // Choir / voice — breath is continuous
  'Choir', 'Ah Choir', 'Oh Voice', 'Mm Voice', 'Ee Voice', 'Gospel Choir', 'Falsetto',
  // Pads — sustained synth textures
  'Pad',
  // Sustained winds — embouchure stays engaged
  'Flute', 'French Horn', 'Brass Section',
]);

// ════════════════════════════════════════════════════════
//  ANALOG ENHANCEMENT CONSTANTS
// ════════════════════════════════════════════════════════

// Stereo panning spread: index = layer index, value = pan position (-1 to +1)
// Fundamental stays center; upper harmonics fan out alternately L/R
const PANNER_SPREAD = [0, 0.20, -0.20, 0.15, -0.30, 0.25, -0.15, 0.35];

// Presets that get a high-frequency noise burst on attack (adds "air" and texture).
//
// INCLUSION RULE — only presets where HPF noise (3.5–6 kHz) is physically real:
//   ✓ Plucked strings  — pick/nail/finger noise at the pluck point
//   ✓ Bowed strings    — bow hair on string, short scratch at onset
//   ✓ Breath/brass     — air turbulence and lip buzz
//   ✓ Harpsichord/Clavinet — jack/tangent mechanism click is authentic
//
// EXCLUDED — adding HF noise creates a click artifact, not a real sound:
//   ✗ Keyboards (Piano, Grand Piano, Upright Piano, Bright Keys)
//       Hammer strikes are broadband, not HF-only; attack shape already models this.
//   ✗ Bells/mallets (Bell, Marimba, Glockenspiel, Vibraphone, Kalimba, Music Box)
//       Character comes from inharmonic sine partials, not noise. Bell has no burst
//       and doesn't click — that's the proof.
//   ✗ Upright Bass — HF noise is spectrally wrong for a bass-register instrument.
const NOISE_BURST_PRESETS = new Set([
  'Harpsichord', 'Clavinet',
  'Pluck', 'Harp', 'Nylon Guitar', 'Koto', 'Sitar',
  'Strings', 'Solo Violin', 'Cello', 'Chamber', 'Orchestra',
  'Flute', 'Brass Section', 'Trumpet',
]);


// ════════════════════════════════════════════════════════
//  AUDIO ENGINE  (Web Audio API)
// ════════════════════════════════════════════════════════

const voices = {
  sine:     { enabled:true,  volume:70, duration:1500, fadeIn:20, fadeOut:500, delay:0 },
  square:   { enabled:false, volume:30, duration:1500, fadeIn:20, fadeOut:500, delay:0 },
  sawtooth: { enabled:false, volume:30, duration:1500, fadeIn:20, fadeOut:500, delay:0 },
  triangle: { enabled:false, volume:40, duration:1500, fadeIn:20, fadeOut:500, delay:0 },
};

let activeNodes    = [];   // { osc, gain, lfo?, lfoGain?, panner? } — all currently ringing nodes
let releasingNodes = [];   // previous chord in natural decay — one generation at a time
const keyNodeMap   = new Map(); // keyId → [nodes] for piano-mode per-key sustain
const pendingStops = new Set(); // keyIds released before playFreqs finished populating keyNodeMap
const voiceInputEls = {};  // { sine: { enabled: el, volume: el, ... }, ... }

let audioCtx = null, masterGain = null, analyser = null;
let waveshaper = null, convolver = null, wetGain = null, noiseBuffer = null;

// Live parameter overrides — null means "use the active preset's value"
const audioParams = {
  attack:    null,
  decay:     null,
  sustain:   null,
  release:   null,
  cutoff:    null,   // Hz
  resonance: null,   // Q
  warmth:    0,      // extra detuning in cents (stacks on top of preset)
  masterVol: 0.72,
  reverb:    0.15,   // wet level 0–1
  drive:     2.0,    // tape saturation amount 0–5 (0 = clean, 5 = heavy)
  drift:     5,      // LFO depth in cents 0–20 (0 = locked, 20 = very wobbly)
  sub:       0,      // sub-oscillator level 0–1 (0 = off, 1 = full 17.5%)
  width:     1.0,    // stereo spread multiplier 0–2 (0 = mono, 2 = extra wide)
  sweep:     2.0,    // filter envelope sweep multiplier 1–5 (1 = no sweep)
  // ── Playback controls ──────────────────────────────────────────
  strum:     6,      // chord roll speed in ms per note (0 = block chord)
  humanize:  5,      // randomness depth 0–10 (0 = mechanical, 10 = loose player)
  glide:     0,      // portamento time in ms (0 = instant pitch jump)
  mono:      false,  // monophonic: hard-cut previous chord before playing new one
  hold:      false,  // sustain pedal: notes keep ringing through key releases
};

// Frequencies played in the most recent playFreqs() call — used by glide
// to find the closest previous pitch to ramp from for each new note.
let lastFreqs = [];

// Build (or rebuild) the WaveShaperNode curve for the given drive amount.
// drive=0 → linear (bypass), drive=5 → heavy saturation.
function rebuildSatCurve(drive) {
  if (!waveshaper) return;
  const n256 = 256;
  const curve = new Float32Array(n256);
  if (drive < 0.01) {
    // Pass-through: linear identity curve
    for (let i = 0; i < n256; i++) curve[i] = (i * 2 / (n256 - 1)) - 1;
  } else {
    const satNorm = Math.tanh(drive);
    for (let i = 0; i < n256; i++) {
      const x = (i * 2 / (n256 - 1)) - 1;
      curve[i] = Math.tanh(x * drive) / satNorm;
    }
  }
  waveshaper.curve = curve;
}

function setAudioParam(key, val) {
  audioParams[key] = val;
  if (key === 'masterVol' && masterGain) {
    masterGain.gain.setTargetAtTime(val, audioCtx.currentTime, 0.02);
  }
  if (key === 'reverb' && wetGain && audioCtx) {
    wetGain.gain.setTargetAtTime(val, audioCtx.currentTime, 0.02);
  }
  if (key === 'drive') {
    rebuildSatCurve(val);
  }
}

// Build a synthetic reverb impulse response with pre-delay, early reflections,
// and a pink-noise late tail — far more realistic than a plain white-noise decay.
//   • 16ms pre-delay    → simulates the gap before the first reflection in a real room
//   • 8 early reflections → discrete echoes 22–80ms after the pre-delay arrive at
//                           slightly different L/R delays for stereo width
//   • Pink late tail    → decays exponentially at RT60=2.4s; pink noise (-3dB/oct)
//                         matches the natural high-frequency absorption of real rooms
async function buildReverbIR() {
  if (!audioCtx || !convolver) return;
  const sr       = audioCtx.sampleRate;
  const durS     = 2.8;
  const preDelay = 0.016;   // 16ms pre-delay (small-to-medium room)
  const earlyMs  = [22, 31, 41, 52, 59, 67, 72, 80];
  const earlyGns = [0.82, 0.72, 0.63, 0.55, 0.48, 0.42, 0.37, 0.32];
  try {
    const offline = new OfflineAudioContext(2, Math.ceil(sr * durS), sr);
    const irBuf   = offline.createBuffer(2, Math.ceil(sr * durS), sr);

    for (let c = 0; c < 2; c++) {
      const d = irBuf.getChannelData(c);
      // Paul Kellet pink noise with exponential decay for the late reverb tail
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        if (t < preDelay) { d[i] = 0; continue; }
        const white = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + white*0.0555179;
        b1 = 0.99332*b1 + white*0.0750759;
        b2 = 0.96900*b2 + white*0.1538520;
        b3 = 0.86650*b3 + white*0.3104856;
        b4 = 0.55000*b4 + white*0.5329522;
        b5 = -0.7616*b5 - white*0.0168980;
        const pink = (b0+b1+b2+b3+b4+b5+b6+white*0.5362)*0.11;
        b6 = white*0.115926;
        d[i] = pink * Math.pow(0.001, (t - preDelay) / 2.4);   // RT60 = 2.4s
      }
      // Superimpose early reflections as discrete impulses; L/R are flipped for
      // stereo spread — slight asymmetry mimics non-rectangular room geometry.
      const flip = c === 0 ? 0.9 : -0.9;
      earlyMs.forEach((ms, idx) => {
        const si = Math.round((preDelay + ms / 1000) * sr);
        if (si < d.length) d[si] += earlyGns[idx] * flip;
      });
    }

    const src = offline.createBufferSource();
    src.buffer = irBuf;
    src.connect(offline.destination);
    src.start(0);
    convolver.buffer = await offline.startRendering();
  } catch (e) {
    // IR build failed — reverb stays silent (wetGain defaults to 0)
  }
}

// Synchronous audio unlock — MUST be called directly from a touchstart/click handler.
// iOS requires AudioContext creation AND resume() to happen synchronously in a gesture.
// This builds the full audio graph without any await so iOS grants audio permission.
function unlockAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch(e) {}
  audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  analyser   = audioCtx.createAnalyser();
  analyser.fftSize              = 4096;
  analyser.smoothingTimeConstant = 0.80;
  analyser.minDecibels          = -100;
  analyser.maxDecibels          = 0;
  masterGain.gain.value = audioParams.masterVol;

  waveshaper = audioCtx.createWaveShaper();
  waveshaper.oversample = '2x';
  rebuildSatCurve(audioParams.drive);

  convolver = audioCtx.createConvolver();
  wetGain   = audioCtx.createGain();
  wetGain.gain.value = audioParams.reverb;

  masterGain.connect(waveshaper);
  waveshaper.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(analyser);
  waveshaper.connect(analyser);
  analyser.connect(audioCtx.destination);

  if (typeof window._looperOnAudioInit === 'function')
    window._looperOnAudioInit(audioCtx, analyser);

  const noiseSamples = Math.ceil(audioCtx.sampleRate * 0.2);
  noiseBuffer = audioCtx.createBuffer(2, noiseSamples, audioCtx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = noiseBuffer.getChannelData(c);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + white*0.0555179;
      b1 = 0.99332*b1 + white*0.0750759;
      b2 = 0.96900*b2 + white*0.1538520;
      b3 = 0.86650*b3 + white*0.3104856;
      b4 = 0.55000*b4 + white*0.5329522;
      b5 = -0.7616*b5 - white*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+white*0.5362)*0.11;
      b6 = white*0.115926;
    }
  }

  const primeSamples = 4096;
  const primeBuffer  = audioCtx.createBuffer(1, primeSamples, audioCtx.sampleRate);
  const primeSrc     = audioCtx.createBufferSource();
  primeSrc.buffer    = primeBuffer;
  primeSrc.connect(masterGain);
  primeSrc.start(0);

  setTimeout(() => buildReverbIR(), 500);

  // Synchronous resume — iOS requires this to be called in the same gesture handler
  audioCtx.resume();
}

async function ensureAudio() {
  if (!audioCtx) {
    // Desktop fallback: AudioContext not yet created (no prior touch gesture)
    unlockAudio();
  }
  // Re-resume if context was auto-suspended after 30s of silence
  if (audioCtx.state !== 'running') {
    await audioCtx.resume();
  }
}

function getAudioCtx() { return audioCtx; }

// Hard-stop all sound (used for silence/no-chord). Uses a 80ms fade to avoid
// a click — short enough to feel instant, long enough to not be audible.
function stopAllNotes(fadeMs = 80) {
  if (!audioCtx) return;
  const now  = audioCtx.currentTime;
  const fade = fadeMs / 1000;
  [...activeNodes, ...releasingNodes].forEach(node => {
    const { osc, gain, lfo } = node;
    try {
      if (gain.gain.cancelAndHoldAtTime) {
        gain.gain.cancelAndHoldAtTime(now);
      } else {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(computeHoldValue(node, now), now);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      osc.stop(now + fade + 0.01);
      if (lfo) lfo.stop(now + fade + 0.01);
    } catch(e) {}
  });
  activeNodes    = [];
  releasingNodes = [];
  keyNodeMap.clear();
  pendingStops.clear();
}

// Natural release of ALL currently active nodes for a sound/preset switch.
// Unlike releaseActiveNotes, this ignores held-key ownership so no nodes are
// orphaned. The fade is capped at 400ms so the old sound doesn't drag on.
function releaseAllForSwitch(prevPreset) {
  if (!audioCtx) return;
  keyNodeMap.clear();
  pendingStops.clear();
  if (!activeNodes.length) return;
  const now = audioCtx.currentTime;
  const rel = Math.min(0.4, Math.max(0.05, audioParams.release ?? prevPreset?.release ?? 0.3));
  const endT = now + rel;
  activeNodes.forEach(node => {
    const { osc, gain, lfo } = node;
    try {
      if (gain.gain.cancelAndHoldAtTime) {
        gain.gain.cancelAndHoldAtTime(now);
      } else {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(computeHoldValue(node, now), now);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, endT);
      osc.stop(endT + 0.05);
      if (lfo) lfo.stop(endT + 0.05);
    } catch (e) {}
    releasingNodes.push(node);
    osc.onended = () => { releasingNodes = releasingNodes.filter(nd => nd !== node); };
  });
  activeNodes = [];
}

// Clear per-key tracking state without stopping audio — call this on preset
// switches so stale pendingStops entries don't kill the next note played.
function resetKeyNodeState() {
  keyNodeMap.clear();
  pendingStops.clear();
}

// Natural release transition for chord changes.
// Old chord decays over the preset's release time while new chord attacks — this
// overlap is exactly what makes transitions sound like a real player instead of
// a toy synth. Only one releasing generation is kept alive at a time; any prior
// releasing generation gets a fast 100ms cut to prevent polyphony buildup during
// rapid playing.
// Compute the gain value a node's ADSR automation would produce at time `t`.
// Used as a cancelAndHoldAtTime polyfill: browsers without that API need an explicit
// setValueAtTime to anchor the ramp, and gain.gain.value (the intrinsic) is stale
// during automation — reading it produces 0.0001 instead of the actual mid-ramp value,
// causing a jump-to-silence click. This approximates the correct value from stored metadata.
function computeHoldValue(node, t) {
  const { peakVol, peakTime, susLevel, susStart } = node;
  if (!peakVol || !peakTime) return 0.0001;
  if (t <= peakTime) {
    // Still in attack — linear interpolation from 0.0001 → peakVol
    const frac = Math.max(0, (t - (peakTime - 0.005)) / 0.005);
    return Math.max(0.0001, 0.0001 + (peakVol - 0.0001) * Math.min(1, frac));
  }
  if (t <= susStart) {
    // In decay — exponential interpolation from peakVol → susLevel
    const frac = (t - peakTime) / (susStart - peakTime);
    return Math.max(0.0001, peakVol * Math.pow(susLevel / peakVol, frac));
  }
  // In sustain or release — close enough to susLevel
  return Math.max(0.0001, susLevel);
}

function releaseActiveNotes(preset) {
  if (!audioCtx) return;
  // Hold mode acts as a sustain pedal — key releases are silently swallowed.
  // Toggle hold off to release everything.
  if (audioParams.hold) return;
  window.dispatchEvent(new CustomEvent('ev:noteRelease', { detail: { time: audioCtx.currentTime } }));
  const now = audioCtx.currentTime;

  // Nodes owned by piano-held keys are immune to chord-change release.
  const ownedByHeldKey = new Set([...keyNodeMap.values()].flat());

  // Hard-cut any previous releasing generation (prevents voice accumulation).
  // 200ms gives enough time to avoid audible clicks without letting old chords pile up.
  if (releasingNodes.length) {
    const cutoff = now + 0.20;
    releasingNodes.forEach(node => {
      if (ownedByHeldKey.has(node)) return;
      const { osc, gain, lfo } = node;
      try {
        if (gain.gain.cancelAndHoldAtTime) {
          gain.gain.cancelAndHoldAtTime(now);
        } else {
          // cancelAndHoldAtTime fallback: compute a safe hold value from stored ADSR data.
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(computeHoldValue(node, now), now);
        }
        gain.gain.exponentialRampToValueAtTime(0.0001, cutoff);
        osc.stop(cutoff + 0.01);
        if (lfo) lfo.stop(cutoff + 0.01);
      } catch (e) {}
    });
    releasingNodes = releasingNodes.filter(nd => ownedByHeldKey.has(nd));
  }

  // Separate active nodes into releasable vs. held-key-owned.
  const releasable = activeNodes.filter(nd => !ownedByHeldKey.has(nd));
  const keepActive = activeNodes.filter(nd => ownedByHeldKey.has(nd));

  if (!releasable.length) {
    activeNodes = keepActive;
    return;
  }

  // ── Natural-decay instruments (piano, bells, plucked strings) ──────────────
  // These have their own amplitude automation already scheduled — the note will
  // fade on its own without any intervention. Forcing a release envelope onto them
  // is what causes the "synthy cut-off" feeling. Instead, hand the nodes to
  // releasingNodes and let them expire naturally. The NEXT chord change will
  // hard-kill them (at 200ms) if they haven't finished yet — giving one generation
  // of natural ring-out beneath the new chord, just like a real acoustic instrument.
  if (preset && preset.naturalDecay) {
    releasable.forEach(node => {
      releasingNodes.push(node);
      node.osc.onended = () => {
        activeNodes    = activeNodes.filter(nd => nd !== node);
        releasingNodes = releasingNodes.filter(nd => nd !== node);
      };
    });
    activeNodes = keepActive;
    return;
  }

  // ── Sustained instruments (pads, synths, strings, choir) ───────────────────
  // Apply a release envelope. Cap raised from 500ms → 1200ms so pads and strings
  // breathe out musically rather than cutting off abruptly.
  const rel  = Math.min(Math.max(0.05, audioParams.release ?? preset?.release ?? 0.3), 5.0);
  const endT = now + rel;

  releasable.forEach(node => {
    const { osc, gain, lfo } = node;
    try {
      if (gain.gain.cancelAndHoldAtTime) {
        gain.gain.cancelAndHoldAtTime(now);
      } else {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(computeHoldValue(node, now), now);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, endT);
      osc.stop(endT + 0.05);
      if (lfo) lfo.stop(endT + 0.05);
    } catch (e) {}
    releasingNodes.push(node);
    osc.onended = () => { releasingNodes = releasingNodes.filter(nd => nd !== node); };
  });

  activeNodes = keepActive;
}

async function playFreqs(frequencies, opts = {}) {
  const keyId      = opts.keyId || null;
  const holdForKey = !!keyId;   // piano-mode: sustain this key's nodes until keyup

  await ensureAudio();
  window.dispatchEvent(new CustomEvent('ev:noteStart', { detail: { time: audioCtx.currentTime } }));

  const preset = SOUND_PRESETS[activePreset];

  // Trigger natural release on old chord — new chord overlaps immediately,
  // creating the organic legato crossfade that real players produce.
  // Piano mode (keyId): skip release so other held keys keep sounding.
  // Mono mode: hard-cut the previous chord before playing the new one.
  // Normal mode: natural release crossfade (old chord breathes out under new one).
  if (!holdForKey) {
    if (audioParams.mono) {
      stopAllNotes(15);    // 15ms fade — clean cut, no click
    } else {
      releaseActiveNotes(preset);
    }
  }

  if (!frequencies.length) return;
  if (!preset) return;

  // Hold-mode accumulation guard: if many chords have been held without
  // releasing, hard-cut the oldest nodes to prevent runaway polyphony.
  if (audioParams.hold && activeNodes.length > 48) {
    const excess = activeNodes.splice(0, activeNodes.length - 48);
    const now2 = audioCtx.currentTime;
    excess.forEach(nd => {
      try {
        nd.gain.gain.cancelScheduledValues(now2);
        nd.gain.gain.setValueAtTime(nd.gain.gain.value, now2);
        nd.gain.gain.exponentialRampToValueAtTime(0.0001, now2 + 0.04);
        nd.osc.stop(now2 + 0.05);
      } catch (e) {}
    });
  }

  computeChordWaveform(frequencies);   // update static waveform snapshot

  // Schedule 25ms ahead so all gain automations are queued before the audio
  // thread reaches this timestamp. Without lookahead, `now` is already in the
  // past by the time osc.start(now) is called — the GainNode fires at its
  // default value (1.0) for a brief slice before automation takes hold → click.
  const now = audioCtx.currentTime + 0.025;
  const n   = Math.max(1, frequencies.length);

  // ADSR values — use knob overrides when set, otherwise preset defaults
  const atk = Math.max(0.001, audioParams.attack    ?? preset.attack);
  const dec = Math.max(0.001, audioParams.decay     ?? preset.decay);
  const sus =                 audioParams.sustain   ?? preset.sustain;
  const dur = preset.duration;
  const rel = Math.max(0.001, audioParams.release   ?? preset.release);

  const peakTime = now + atk;
  const relStart = now + Math.max(atk + dec, dur - rel);
  const endTime  = now + dur;

  // ── Humanize scale ────────────────────────────────────────────────────────
  // Master randomness dial: 0 = perfectly mechanical, 10 = loose human player.
  // All per-note randomness (velocity, timing jitter, ensemble detune, chord
  // dynamics) scales linearly with this value so one knob controls everything.
  const humanizeScale = (audioParams.humanize ?? 5) / 10;

  // ── Chord-level dynamic variation ────────────────────────────────────────
  // One random ±10 % multiplier per chord call — scaled by humanize.
  const chordDynamic = 1 - 0.10 * humanizeScale + Math.random() * 0.20 * humanizeScale;

  // ── Glide (portamento) time ───────────────────────────────────────────────
  // When > 0, oscillator frequencies ramp from the closest previous pitch
  // rather than jumping instantly. Gives strings/vocals a connected feel.
  const glideTime = (audioParams.glide ?? 0) / 1000;

  // ── Legato mode detection ─────────────────────────────────────────────────
  // For sustained instruments (strings, choir, pads, winds) that are already
  // playing, new notes skip the slow attack swell and enter at sustain level —
  // simulating a bow already in motion or a voice already projecting.
  // Only true when something is actively playing, so the first chord of a phrase
  // still gets the full beautiful attack; only chord changes are legato.
  // Piano mode (holdForKey): always give the full attack — each key is a fresh onset.
  const isLegato = !holdForKey && LEGATO_PRESETS.has(activePreset) &&
                   activeNodes.some(nd => nd.freq);

  // ── Strum step ─────────────────────────────────────────────────────────────
  // Computed once per chord — uses the knob value (ms → s), falling back to the
  // preset's built-in strumSpeed, then a 6ms default.
  const strumStep = (audioParams.strum ?? (preset.strumSpeed != null
    ? preset.strumSpeed * 1000 : 6)) / 1000;

  const nodesBefore = activeNodes.length; // snapshot for per-key node collection

  frequencies.forEach((baseFreq, noteIdx) => {
    // ── Per-note velocity variation ───────────────────────────────────────
    // Randomises amplitude — range shrinks to zero as humanize → 0.
    const velocity = 1 - 0.15 * humanizeScale + Math.random() * 0.30 * humanizeScale;

    // ── Glide: find closest previous note to ramp from ────────────────────
    // Matches each new note to the nearest old frequency so glide follows the
    // voice-leading of the progression rather than always gliding from the bass.
    let glideFrom = baseFreq;
    if (glideTime > 0.001 && lastFreqs.length > 0) {
      glideFrom = lastFreqs.reduce((best, f) =>
        Math.abs(f - baseFreq) < Math.abs(best - baseFreq) ? f : best
      , lastFreqs[0]);
    }

    // ── Strum timing ──────────────────────────────────────────────────────
    // Note 0 always fires at `now` — zero perceived latency, guitarist-safe.
    // Subsequent notes stagger by strumStep plus jitter (scaled by humanize).
    const strumOff  = noteIdx * strumStep + (noteIdx > 0 ? Math.random() * 0.003 * humanizeScale : 0);
    // Legato attack: skip the slow swell, crossfade in over 30ms instead.
    // tPk is recalculated from t0 so it accounts for the shortened attack.
    const localAtk = isLegato ? 0.030 : atk;
    // Local time references for this note — all scheduling offsets from t0.
    const t0   = now      + strumOff;
    const tPk  = t0 + localAtk;          // recalculated from t0, not outer peakTime
    const tRl  = relStart + strumOff;
    const tEnd = endTime  + strumOff;

    // ── Frequency-dependent release: bass rings longer, treble fades faster ─
    // Physical fact: longer, heavier strings (bass) store more energy and ring longer.
    // A2 (110 Hz) ≈ ×1.8 release duration; A4 baseline; A5 ≈ ×0.6; A6 ≈ ×0.3.
    // Only applied when using preset default — knob override is respected as-is.
    const freqRelMult = (audioParams.release === null)
      ? Math.max(0.4, Math.min(2.0, 1.0 + Math.log2(220 / Math.max(baseFreq, 20)) * 0.38))
      : 1.0;
    const freqRelEnd = tRl + rel * freqRelMult;

    // ── Common tone preservation (voice leading) ──────────────────────────
    // If a node at this frequency is already active (within ±15 cents), skip
    // retriggering it — let it sustain through the chord change.
    // This is the single biggest source of the "sample" feel on progressions:
    // shared notes like the 5th of Am→C retrigger and create an audible re-attack
    // flutter. Real players hold common tones; now the synth does too.
    const centsApart = (f1, f2) => Math.abs(1200 * Math.log2(f1 / f2));
    // Piano mode: each key owns its nodes exclusively — skip common-tone reuse so
    // nodes can be cleanly tracked and released per-key on keyup.
    const alreadyPlaying = !holdForKey && activeNodes.some(
      nd => nd.freq && centsApart(nd.freq, baseFreq) < 15
    );
    if (alreadyPlaying) return;

    // Each note gets its own filter with an envelope sweep
    let dest = masterGain;
    if (preset.filter || audioParams.cutoff !== null) {
      const flt = audioCtx.createBiquadFilter();
      flt.type  = preset.filter ? preset.filter.type : 'lowpass';
      flt.Q.value = audioParams.resonance ?? (preset.filter ? preset.filter.Q || 1 : 1);

      let targetCutoff = audioParams.cutoff ?? (preset.filter ? preset.filter.freq : 4000);
      // Velocity also shifts the filter a little: harder hits are brighter (louder → brighter)
      targetCutoff = Math.min(targetCutoff * (0.88 + velocity * 0.14), audioCtx.sampleRate / 2 * 0.9);
      // Frequency-dependent brightness: real instruments are brighter in higher registers.
      // freqBrightness=0 (default) → flat; 0.35 → piano-style register scaling.
      // Scale reference: A4=440 Hz. At 110 Hz (low) cutoff×0.75; at 1760 Hz (high) cutoff×1.73.
      if (preset.freqBrightness && audioParams.cutoff === null) {
        const scale = Math.pow(Math.max(baseFreq, 20) / 220, preset.freqBrightness);
        targetCutoff = Math.min(targetCutoff * scale, audioCtx.sampleRate / 2 * 0.9);
      }
      // Filter envelope: open sweep× higher at start, sweep to target over attack+decay.
      // sweep=1 = no movement; sweep=5 = dramatic opening. Classic analog VCF feel.
      // noSweep: preset opt-out — piano-like presets have no physical filter sweep;
      // applying one starts the filter at 2×cutoff (very bright) and creates an
      // audible high-frequency transient on the attack that reads as a click.
      const sweepMult  = preset.noSweep ? 1.0 : Math.max(1.0, audioParams.sweep);
      const sweepStart = Math.min(targetCutoff * sweepMult, audioCtx.sampleRate / 2 * 0.9);
      // Set .value directly to initialize the filter's internal state (z1/z2) at
      // sweepStart. Without this, the filter is created at 350 Hz and its state
      // mismatch with the scheduled setValueAtTime causes a brief transient → click.
      flt.frequency.value = sweepStart;
      flt.frequency.setValueAtTime(sweepStart, t0);
      flt.frequency.exponentialRampToValueAtTime(targetCutoff, tPk + dec);

      flt.connect(masterGain);
      dest = flt;
    }

    // ── Amplitude LFO (tremolo) ───────────────────────────────────────────
    // preset.ampLfo = { rate: Hz, depth: 0–1 }
    // Creates a GainNode whose gain oscillates around 1.0 ± depth.
    // All layers of this note feed into it, so one LFO drives the whole note.
    // Examples: vibraphone motor (5 Hz), Leslie speaker on organ (6 Hz).
    if (preset.ampLfo) {
      const tremGain = audioCtx.createGain();
      tremGain.gain.value = 1.0;
      const tremLfo  = audioCtx.createOscillator();
      const tremMod  = audioCtx.createGain();
      tremLfo.type = 'sine';
      tremLfo.frequency.value = preset.ampLfo.rate;
      tremMod.gain.value = preset.ampLfo.depth;
      tremLfo.connect(tremMod);
      tremMod.connect(tremGain.gain);
      tremGain.connect(dest);
      tremLfo.start(t0);
      if (!audioParams.hold && !holdForKey) tremLfo.stop(tEnd + 0.1);
      dest = tremGain;   // layers connect here; signal flows tremGain → old dest
    }

    // ── Multi-formant vocal synthesis ─────────────────────────────────────
    // Insert parallel bandpass filters (vowel formants) between oscillators and dest.
    // Choir/vocal presets use harmonically rich sawtooth sources; the formant bank
    // selects the right partials to give each vowel its characteristic color.
    // Per-note ±3% formant frequency variation: each chord voice uses a slightly
    // different vocal tract — sounds like multiple singers rather than one model cloned.
    if (FORMANT_CHAINS[activePreset]) {
      const varFormants = FORMANT_CHAINS[activePreset].map(([f, Q]) => [
        f * (0.97 + Math.random() * 0.06),   // ±3% per note
        Q,
      ]);
      dest = buildFormantDest(varFormants, dest);
    }

    // ── Instrument body resonance ─────────────────────────────────────────
    // Adds the characteristic resonant peaks of the instrument body ON TOP OF
    // the dry oscillator signal (unlike formants which replace it). The dry path
    // is preserved at full level; BPF peaks contribute a fraction of their level
    // additively, colouring the tone without swamping it.
    if (BODY_RESONANCE_CHAINS[activePreset]) {
      dest = buildBodyResonanceMix(BODY_RESONANCE_CHAINS[activePreset], dest);
    }

    // ── Karplus-Strong plucked string synthesis ──────────────────────────
    // Bypasses the oscillator layers entirely — generates a pre-computed
    // Float32Array via the KS delay-line algorithm and plays it as AudioBufferSource.
    // This branch and the oscillator branch below are mutually exclusive.
    if (KS_PRESETS.has(activePreset)) {
      // Apply same humanize scaling as oscillator path so a single knob controls everything
      const vol = (preset.masterVol ?? 0.75) * velocity * chordDynamic / n;
      const ksSamples = generateKarplusStrong(baseFreq, preset.duration, audioCtx.sampleRate, preset.ksOptions);
      const ksAudioBuf = audioCtx.createBuffer(1, ksSamples.length, audioCtx.sampleRate);
      ksAudioBuf.getChannelData(0).set(ksSamples);
      const src  = audioCtx.createBufferSource();
      src.buffer = ksAudioBuf;
      const gain = audioCtx.createGain();
      gain.gain.value = vol;
      // Slight random stereo spread per note (small ensemble effect)
      const panner = audioCtx.createStereoPanner();
      panner.pan.value = (Math.random() * 2 - 1) * 0.12 * (audioParams.width ?? 1);
      src.connect(gain);
      gain.connect(panner);
      panner.connect(dest);
      src.start(t0);
      // naturalDecay:true on all KS presets — let the buffer play out naturally
      const ksNode = { osc: src, gain, panner, freq: baseFreq,
        peakVol: vol, peakTime: t0, susLevel: vol * 0.3, susStart: t0 };
      activeNodes.push(ksNode);
      src.onended = () => {
        activeNodes    = activeNodes.filter(nd => nd !== ksNode);
        releasingNodes = releasingNodes.filter(nd => nd !== ksNode);
      };
    } else {

      // ── Ensemble detuning ─────────────────────────────────────────────────
      // A random ±5-cent offset is applied to EVERY layer of this note (not per
      // layer — all layers shift together so the harmonic ratios are preserved).
      // Simulates the micro-pitch spread of a real ensemble: each player sits at
      // a slightly different tuning, giving the section a "breathing" texture.
      const ensembleDetune = ENSEMBLE_DETUNE_PRESETS.has(activePreset)
        ? (Math.random() * 10 - 5) * humanizeScale   // scales to zero when humanize=0
        : 0;

      // ── Per-layer oscillators ─────────────────────────────────────────────
      preset.layers.forEach((layer, layerIdx) => {
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.0001;  // never let the default 1.0 leak if osc fires early

        osc.type            = layer.type;
        // Glide: start at the previous closest pitch and ramp to the target.
        // No glide: set frequency directly (instantaneous pitch).
        osc.frequency.value = glideFrom * layer.mult;
        if (glideTime > 0.001) {
          osc.frequency.setValueAtTime(glideFrom * layer.mult, t0);
          osc.frequency.linearRampToValueAtTime(baseFreq * layer.mult, t0 + glideTime);
        }

        // ── Piano inharmonicity: stiff strings cause partials to be slightly sharp ──
        // The B coefficient (stiffness) is frequency-dependent: low bass strings are
        // much more inharmonic than treble strings. Only applied to partials > 1.5×
        // so the fundamental and close sub-harmonics are left untouched.
        let inharmonicCents = 0;
        if (INHARMONIC_PRESETS.has(activePreset) && layer.mult > 1.5) {
          const B  = 0.00035 * Math.pow(110 / Math.max(baseFreq, 20), 0.9);
          const hn = layer.mult;
          inharmonicCents = 1200 * Math.log2(Math.sqrt(1 + B * hn * hn));
        }
        osc.detune.value = (layer.detuneC || 0) + audioParams.warmth + inharmonicCents + ensembleDetune;

        // ── LFO drift: per-oscillator slow pitch variation ──────────────────
        // drift=0 → skip entirely (dead stable). drift=20 → very wobbly.
        // Each oscillator gets ±30% random variation around the global drift depth.
        let lfo = null, lfoGain = null;
        if (audioParams.drift > 0.1) {
          lfo     = audioCtx.createOscillator();
          lfoGain = audioCtx.createGain();
          lfo.type = 'sine';
          lfo.frequency.value = 0.3 + Math.random() * 2.2;   // 0.3–2.5 Hz each
          lfoGain.gain.value  = audioParams.drift * (0.7 + Math.random() * 0.6);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.detune);
          const lfoPhaseOffset = Math.random() * (1 / lfo.frequency.value);
          lfo.start(Math.max(0, t0 - lfoPhaseOffset));
          if (preset.naturalDecay || (!audioParams.hold && !holdForKey)) lfo.stop(tEnd + 0.1);
        }

        // ── Vibrato with delayed onset ──────────────────────────────────────
        // Real players start straight and add vibrato ~0.3–0.5s into the note.
        // The LFO ramps from 0 to full depth over 250ms after the onset delay.
        const vib = VIBRATO_PRESETS[activePreset];
        if (vib) {
          const vibLfo  = audioCtx.createOscillator();
          const vibGain = audioCtx.createGain();
          vibLfo.type = 'sine';
          // Slight per-oscillator rate variation gives ensemble the natural chorus of
          // real players whose vibrato rates are never perfectly synchronized.
          vibLfo.frequency.value = vib.rate + (Math.random() * 0.4 - 0.2);
          vibGain.gain.setValueAtTime(0, t0);
          vibGain.gain.setValueAtTime(0, t0 + vib.delay);
          vibGain.gain.linearRampToValueAtTime(vib.depth, t0 + vib.delay + 0.25);
          vibLfo.connect(vibGain);
          vibGain.connect(osc.detune);
          vibLfo.start(t0);
          if (preset.naturalDecay || (!audioParams.hold && !holdForKey)) vibLfo.stop(tEnd + 0.1);
          // Track so releaseActiveNotes can stop the vibrato LFO cleanly
          activeNodes.push({ osc: vibLfo, gain: vibGain,
            peakVol: 0, peakTime: t0, susLevel: 0, susStart: t0 });
        }

        // Scale volume: per layer, per note (so chords don't clip).
        // velocity 85–115% per-note; chordDynamic 90–110% per-chord.
        const vol = (layer.vol * (preset.masterVol || 0.75) * velocity * chordDynamic) / n;

        // Per-layer decay control — higher harmonics of real instruments decay faster
        // decMult: multiplier on the global decay time (1.0 = normal, 0.3 = 3× faster)
        // susMult: multiplier on sustain level (0 = partial fully dies, 1 = normal)
        const layerDec     = dec * (layer.decMult ?? 1.0);
        const layerSusMult = layer.susMult ?? 1.0;
        const susLevel     = Math.max(0.0001, vol * sus * layerSusMult);
        const layerSusStart = tPk + layerDec;

        // ── Exponential ADSR ─────────────────────────────────────────────────
        // Exponential curves = how real audio behaves (perceived as natural and musical)
        // Guard: exponentialRamp cannot target exactly 0 — use 0.0001 instead
        if (isLegato) {
          // Enter at sustain level immediately — instrument was already in motion.
          // 30ms linear crossfade prevents a click; then continue decaying or hold.
          gain.gain.setValueAtTime(susLevel, t0);
          if (preset.naturalDecay && !audioParams.hold) {
            // Acoustic instrument already in motion: continue natural decay arc.
            gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(t0 + 0.1, tEnd));
          } else {
            gain.gain.setValueAtTime(susLevel, tRl);
          }
        } else {
          gain.gain.setValueAtTime(0.0001, t0);
          if (atk < 0.005) {
            // Fast attacks (< 5ms): keep linear to avoid click artifacts
            gain.gain.linearRampToValueAtTime(vol, tPk);
          } else {
            gain.gain.exponentialRampToValueAtTime(vol, tPk);
          }
          gain.gain.exponentialRampToValueAtTime(susLevel, layerSusStart);
          if (preset.naturalDecay && !audioParams.hold) {
            // Acoustic instruments always decay — no plateau at sustain level.
            // Real strings/brass/etc. continuously lose energy even while "held".
            // stopKeyAudio() calls cancelScheduledValues() first, so early key
            // releases cleanly override this ramp with the key-up release envelope.
            const natDecayEnd = Math.max(layerSusStart + 0.1, tEnd);
            gain.gain.exponentialRampToValueAtTime(0.0001, natDecayEnd);
          } else {
            // Synths, organs, pads: hold at sustain level until key release.
            // Hold mode (sustain pedal): skip pre-scheduled release so note rings indefinitely.
            gain.gain.setValueAtTime(susLevel, tRl);
            if (!audioParams.hold && !holdForKey) {
              gain.gain.exponentialRampToValueAtTime(0.0001, freqRelEnd);
            }
          }
        }

        // ── Stereo spread: harmonics fan out L/R; width=0 mono, width=2 extra wide ──
        const panner = audioCtx.createStereoPanner();
        panner.pan.value = PANNER_SPREAD[Math.min(layerIdx, PANNER_SPREAD.length - 1)] * audioParams.width;

        osc.connect(gain);
        gain.connect(panner);
        panner.connect(dest);

        osc.start(t0);
        // Schedule oscillator stop. naturalDecay: always stop at decay end (the string
        // has died out by then). Others: stop at freqRelEnd (bass notes ring longer).
        // In hold mode without naturalDecay: don't pre-schedule — releaseActiveNotes() handles it.
        if (preset.naturalDecay) {
          osc.stop(Math.max(layerSusStart + 0.1, tEnd) + 0.08);
        } else if (!audioParams.hold && !holdForKey) {
          osc.stop(freqRelEnd + 0.08);
        }

        const node = { osc, gain, lfo, lfoGain, panner, freq: baseFreq,
          peakVol: vol, peakTime: tPk, susLevel, susStart: layerSusStart };
        activeNodes.push(node);
        osc.onended = () => {
          activeNodes    = activeNodes.filter(nd => nd !== node);
          releasingNodes = releasingNodes.filter(nd => nd !== node);
        };
      });

      // ── Sub-oscillator: one octave below for bass weight ─────────────────
      // sub=0 → skip. sub=1 → 17.5% of masterVol. Controllable per preset.
      if (audioParams.sub > 0.001 && baseFreq / 2 >= 20) {
        const subOsc  = audioCtx.createOscillator();
        const subGain = audioCtx.createGain();
        subGain.gain.value = 0.0001;  // never let the default 1.0 leak if osc fires early
        subOsc.type = 'sine';
        subOsc.frequency.value = baseFreq / 2;
        const subVol    = (0.175 * audioParams.sub * (preset.masterVol || 0.75)) / n;
        const subSusLvl = Math.max(0.0001, subVol * sus);
        if (isLegato) {
          subGain.gain.setValueAtTime(subSusLvl, t0);
          if (preset.naturalDecay && !audioParams.hold) {
            subGain.gain.exponentialRampToValueAtTime(0.0001, Math.max(t0 + 0.1, tEnd));
          } else {
            subGain.gain.setValueAtTime(subSusLvl, tRl);
          }
        } else {
          subGain.gain.setValueAtTime(0.0001, t0);
          if (atk < 0.005) {
            subGain.gain.linearRampToValueAtTime(subVol, tPk);
          } else {
            subGain.gain.exponentialRampToValueAtTime(subVol, tPk);
          }
          subGain.gain.exponentialRampToValueAtTime(subSusLvl, tPk + dec);
          if (preset.naturalDecay && !audioParams.hold) {
            subGain.gain.exponentialRampToValueAtTime(0.0001, Math.max(tPk + dec + 0.1, tEnd));
          } else {
            subGain.gain.setValueAtTime(subSusLvl, tRl);
            if (!audioParams.hold && !holdForKey) {
              subGain.gain.exponentialRampToValueAtTime(0.0001, freqRelEnd);
            }
          }
        }
        subOsc.connect(subGain);
        subGain.connect(dest);
        subOsc.start(t0);
        if (preset.naturalDecay) {
          subOsc.stop(Math.max(tPk + dec + 0.1, tEnd) + 0.1);
        } else if (!audioParams.hold && !holdForKey) {
          subOsc.stop(freqRelEnd + 0.1);
        }
        const subNode = { osc: subOsc, gain: subGain, freq: baseFreq,
          peakVol: subVol, peakTime: tPk, susLevel: subSusLvl, susStart: tPk + dec };
        activeNodes.push(subNode);
        subOsc.onended = () => {
          activeNodes    = activeNodes.filter(nd => nd !== subNode);
          releasingNodes = releasingNodes.filter(nd => nd !== subNode);
        };
      }

    } // end if/else KS_PRESETS

    // ── Noise burst: high-frequency air on attack ─────────────────────────
    // Adds the "breath" or "bow attack" texture of real instruments.
    // Must ramp from silence to peak (not step to it) — an instant non-zero
    // onset creates a step function in amplitude that sounds like a click.
    if (NOISE_BURST_PRESETS.has(activePreset) && noiseBuffer && !isLegato) {
      // noiseRamp tracks the preset's attack time so the noise burst and oscillators
      // peak simultaneously. A fixed ramp (was 8ms) peaks AFTER fast-attack oscillators
      // (1–5ms), creating a second energy event in the 3.5–6 kHz band = audible click.
      // Capped at 20ms so slow-attack presets (strings, choir) still get a short burst.
      const noiseRamp  = Math.min(Math.max(0.001, atk), 0.020);
      const noiseDecay = Math.max(0.025, noiseRamp * 4);    // decay proportional to ramp, min 25ms
      const burstPeak  = (preset.noiseBurstGain ?? 0.018) / n;  // global default lowered to 0.018
      const nSrc  = audioCtx.createBufferSource();
      nSrc.buffer = noiseBuffer;
      nSrc.loop   = false;
      const nHPF  = audioCtx.createBiquadFilter();
      nHPF.type   = 'highpass';
      nHPF.frequency.value = 3500 + Math.random() * 2500;   // 3.5–6 kHz, random per note
      const nGain = audioCtx.createGain();
      nGain.gain.value = 0.0001;
      nGain.gain.setValueAtTime(0.0001, t0);
      nGain.gain.linearRampToValueAtTime(burstPeak, t0 + noiseRamp);
      nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + noiseRamp + noiseDecay);
      nSrc.connect(nHPF);
      nHPF.connect(nGain);
      nGain.connect(masterGain);   // bypass per-note filter — goes straight to mix
      nSrc.start(t0);
      nSrc.stop(t0 + noiseRamp + noiseDecay + 0.01);
      // No activeNodes tracking needed — self-stopping, very short duration
    }

    // ── Continuous bow noise for bowed string instruments ─────────────────
    // A looping pink-noise layer through a bandpass at 1.8–2.5 kHz reproduces
    // the sustained friction texture of bow hair on string. Fades in with the
    // note attack and out with the release — inaudible on its own but adds realism.
    if (BOW_NOISE_PRESETS.has(activePreset) && noiseBuffer) {
      const bowSrc  = audioCtx.createBufferSource();
      bowSrc.buffer = noiseBuffer;
      bowSrc.loop   = true;
      const bowBPF  = audioCtx.createBiquadFilter();
      bowBPF.type   = 'bandpass';
      bowBPF.frequency.value = 1800 + Math.random() * 600;   // 1.8–2.4 kHz, varies per note
      bowBPF.Q.value = 0.7;
      const bowGain = audioCtx.createGain();
      const bowVol  = 0.006 / n;
      bowGain.gain.value = 0.0001;
      bowGain.gain.setValueAtTime(0.0001, t0);
      bowGain.gain.linearRampToValueAtTime(bowVol, t0 + atk);
      bowGain.gain.setValueAtTime(bowVol, tRl);
      if (!audioParams.hold && !holdForKey) {
        bowGain.gain.exponentialRampToValueAtTime(0.0001, tEnd);
      }
      bowSrc.connect(bowBPF);
      bowBPF.connect(bowGain);
      bowGain.connect(dest);
      bowSrc.start(t0);
      if (!audioParams.hold && !holdForKey) bowSrc.stop(tEnd + 0.1);
      // Track in activeNodes so releaseActiveNotes() stops the loop when hold turns off
      const bowNode = { osc: bowSrc, gain: bowGain, freq: null,
        peakVol: bowVol, peakTime: t0 + atk, susLevel: bowVol, susStart: t0 + atk };
      activeNodes.push(bowNode);
      bowSrc.onended = () => {
        activeNodes    = activeNodes.filter(nd => nd !== bowNode);
        releasingNodes = releasingNodes.filter(nd => nd !== bowNode);
      };
    }

    // ── Wind instrument breath noise ──────────────────────────────────────
    // Looping pink noise filtered to the embouchure frequency band of each
    // wind instrument. Flute: airy low turbulence (~600 Hz). Brass: metallic
    // high-frequency buzz (~1.4–2.4 kHz). Follows the note's ADSR envelope.
    const windCfg = WIND_NOISE_PRESETS[activePreset];
    if (windCfg && noiseBuffer) {
      const windSrc  = audioCtx.createBufferSource();
      windSrc.buffer = noiseBuffer;
      windSrc.loop   = true;
      const windBPF  = audioCtx.createBiquadFilter();
      windBPF.type   = 'bandpass';
      windBPF.frequency.value = windCfg.freq * (0.95 + Math.random() * 0.10);  // ±5% per note
      windBPF.Q.value = windCfg.Q;
      const windGain = audioCtx.createGain();
      const windVol  = windCfg.vol / n;
      windGain.gain.value = 0.0001;
      windGain.gain.setValueAtTime(0.0001, t0);
      windGain.gain.linearRampToValueAtTime(windVol, t0 + atk + 0.01);
      windGain.gain.setValueAtTime(windVol, tRl);
      if (!audioParams.hold && !holdForKey) {
        windGain.gain.exponentialRampToValueAtTime(0.0001, tEnd);
      }
      windSrc.connect(windBPF);
      windBPF.connect(windGain);
      windGain.connect(masterGain);   // bypass per-note filter — goes straight to mix
      windSrc.start(t0);
      if (!audioParams.hold && !holdForKey) windSrc.stop(tEnd + 0.1);
      const windNode = { osc: windSrc, gain: windGain, freq: null,
        peakVol: windVol, peakTime: t0 + atk, susLevel: windVol, susStart: t0 + atk };
      activeNodes.push(windNode);
      windSrc.onended = () => {
        activeNodes    = activeNodes.filter(nd => nd !== windNode);
        releasingNodes = releasingNodes.filter(nd => nd !== windNode);
      };
    }

    // ── Choir breathiness layer ───────────────────────────────────────────
    // Real singing has a constant low-level breath component under the vocal tone.
    // A very quiet pink-noise layer through a lowpass at ~400 Hz reproduces
    // this "air" without obscuring the vowel formants above it.
    if (BREATH_NOISE_PRESETS.has(activePreset) && noiseBuffer) {
      const breathSrc  = audioCtx.createBufferSource();
      breathSrc.buffer = noiseBuffer;
      breathSrc.loop   = true;
      const breathLPF  = audioCtx.createBiquadFilter();
      breathLPF.type   = 'lowpass';
      breathLPF.frequency.value = 380 + Math.random() * 80;   // 380–460 Hz, per note
      breathLPF.Q.value = 0.5;
      const breathGain = audioCtx.createGain();
      const breathVol  = 0.004 / n;
      breathGain.gain.value = 0.0001;
      breathGain.gain.setValueAtTime(0.0001, t0);
      breathGain.gain.linearRampToValueAtTime(breathVol, t0 + atk + 0.05);
      breathGain.gain.setValueAtTime(breathVol, tRl);
      if (!audioParams.hold && !holdForKey) {
        breathGain.gain.exponentialRampToValueAtTime(0.0001, tEnd);
      }
      breathSrc.connect(breathLPF);
      breathLPF.connect(breathGain);
      breathGain.connect(dest);   // goes through formant chain → keeps vowel character
      breathSrc.start(t0);
      if (!audioParams.hold && !holdForKey) breathSrc.stop(tEnd + 0.1);
      const breathNode = { osc: breathSrc, gain: breathGain, freq: null,
        peakVol: breathVol, peakTime: t0 + atk + 0.05, susLevel: breathVol, susStart: t0 + atk + 0.05 };
      activeNodes.push(breathNode);
      breathSrc.onended = () => {
        activeNodes    = activeNodes.filter(nd => nd !== breathNode);
        releasingNodes = releasingNodes.filter(nd => nd !== breathNode);
      };
    }
  });

  // Store nodes created by this key for per-key release on keyup.
  if (keyId) {
    keyNodeMap.set(keyId, activeNodes.slice(nodesBefore));
    // If the key was released before we finished setting up audio, stop it now.
    if (pendingStops.has(keyId)) {
      pendingStops.delete(keyId);
      stopKeyAudio(keyId);
    }
  }

  // Track these frequencies so the next chord can glide from them.
  lastFreqs = [...frequencies];
}

// Release audio for a specific held piano key. Called from onKeyUp.
function stopKeyAudio(keyId) {
  const nodes = keyNodeMap.get(keyId);
  if (!nodes || !nodes.length) {
    keyNodeMap.delete(keyId);
    // Audio not set up yet — mark for stop once playFreqs finishes.
    if (!keyNodeMap.has(keyId)) pendingStops.add(keyId);
    return;
  }
  keyNodeMap.delete(keyId);

  if (!audioCtx) return;
  const preset = SOUND_PRESETS[activePreset];
  const rel  = Math.min(Math.max(0.05, audioParams.release ?? preset?.release ?? 0.3), 5.0);
  const now  = audioCtx.currentTime;
  const endT = now + rel;

  nodes.forEach(node => {
    const { osc, gain, lfo } = node;
    try {
      if (gain.gain.cancelAndHoldAtTime) {
        gain.gain.cancelAndHoldAtTime(now);
      } else {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(computeHoldValue(node, now), now);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, endT);
      osc.stop(endT + 0.05);
      if (lfo) lfo.stop(endT + 0.05);
    } catch(e) {}
    activeNodes    = activeNodes.filter(nd => nd !== node);
    releasingNodes = releasingNodes.filter(nd => nd !== node);
  });
}
