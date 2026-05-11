// ════════════════════════════════════════════════════════════
//  SONG PROGRESSIONS MODULE
//  Depends on globals from app.js: circle, keyEls, onKeyDown
//  Depends on globals from music-theory.js: NOTES, MODE_INTERVALS
//  Depends on globals from knob.js: RotaryKnob
// ════════════════════════════════════════════════════════════

const SONG_DB = [
  // ── POP / IONIAN ────────────────────────────────────────
  {
    title: 'Let Her Go',
    artist: 'Passenger',
    genre: 'Pop',
    mode: 'Ionian',
    degrees: [0, 4, 5, 3],
    roman:   ['I', 'V', 'vi', 'IV'],
    difficulty: 1,
  },
  {
    title: "Don't Stop Believin'",
    artist: 'Journey',
    genre: 'Rock',
    mode: 'Ionian',
    degrees: [0, 4, 5, 3],
    roman:   ['I', 'V', 'vi', 'IV'],
    difficulty: 1,
  },
  {
    title: 'With or Without You',
    artist: 'U2',
    genre: 'Rock',
    mode: 'Ionian',
    degrees: [0, 4, 5, 3],
    roman:   ['I', 'V', 'vi', 'IV'],
    difficulty: 1,
  },
  {
    title: 'Stand By Me',
    artist: 'Ben E. King',
    genre: 'R&B',
    mode: 'Ionian',
    degrees: [0, 5, 3, 4],
    roman:   ['I', 'vi', 'IV', 'V'],
    difficulty: 1,
  },
  {
    title: 'Wonderful Tonight',
    artist: 'Eric Clapton',
    genre: 'Pop',
    mode: 'Ionian',
    degrees: [0, 3, 4, 0],
    roman:   ['I', 'IV', 'V', 'I'],
    difficulty: 1,
  },
  {
    title: "Knockin' on Heaven's Door",
    artist: 'Bob Dylan',
    genre: 'Rock',
    mode: 'Ionian',
    degrees: [0, 4, 5, 0, 4, 3],
    roman:   ['I', 'V', 'vi', 'I', 'V', 'IV'],
    difficulty: 1,
  },
  {
    title: 'No Woman No Cry',
    artist: 'Bob Marley',
    genre: 'Reggae',
    mode: 'Ionian',
    degrees: [0, 3, 5, 4],
    roman:   ['I', 'IV', 'vi', 'V'],
    difficulty: 1,
  },
  {
    title: 'Santeria',
    artist: 'Sublime',
    genre: 'Rock',
    mode: 'Ionian',
    degrees: [0, 2, 3, 4],
    roman:   ['I', 'iii', 'IV', 'V'],
    difficulty: 1,
  },
  {
    title: 'What a Wonderful World',
    artist: 'Louis Armstrong',
    genre: 'Jazz',
    mode: 'Ionian',
    degrees: [0, 5, 3, 0, 3, 4, 0],
    roman:   ['I', 'vi', 'IV', 'I', 'IV', 'V', 'I'],
    difficulty: 2,
  },
  // ── AEOLIAN / MINOR ─────────────────────────────────────
  {
    title: 'Mad World',
    artist: 'Gary Jules / Tears for Fears',
    genre: 'Pop',
    mode: 'Aeolian',
    degrees: [0, 2, 6, 3],
    roman:   ['i', 'III', 'VII', 'iv'],
    difficulty: 1,
  },
  {
    title: 'Losing My Religion',
    artist: 'R.E.M.',
    genre: 'Pop',
    mode: 'Aeolian',
    degrees: [0, 6, 0, 3, 0],
    roman:   ['i', 'VII', 'i', 'iv', 'i'],
    difficulty: 1,
  },
  {
    title: 'Hotel California',
    artist: 'Eagles',
    genre: 'Rock',
    mode: 'Aeolian',
    degrees: [0, 4, 6, 2, 3, 0, 3, 4],
    roman:   ['i', 'V', 'VII', 'III', 'iv', 'i', 'iv', 'V'],
    difficulty: 2,
  },
  {
    title: 'Stairway to Heaven (intro)',
    artist: 'Led Zeppelin',
    genre: 'Rock',
    mode: 'Aeolian',
    degrees: [0, 6, 5, 4],
    roman:   ['i', 'VII', 'VI', 'V'],
    difficulty: 1,
  },
  {
    title: 'Zombie',
    artist: 'The Cranberries',
    genre: 'Rock',
    mode: 'Aeolian',
    degrees: [0, 2, 6, 4],
    roman:   ['i', 'III', 'VII', 'v'],
    difficulty: 1,
  },
  // ── DORIAN ──────────────────────────────────────────────
  {
    title: 'Eleanor Rigby',
    artist: 'The Beatles',
    genre: 'Rock',
    mode: 'Dorian',
    degrees: [0, 2, 0, 2],
    roman:   ['i', 'III', 'i', 'III'],
    difficulty: 1,
  },
  {
    title: 'Scarborough Fair',
    artist: 'Simon & Garfunkel',
    genre: 'Folk',
    mode: 'Dorian',
    degrees: [0, 2, 0, 4, 0, 1, 0],
    roman:   ['i', 'III', 'i', 'v', 'i', 'ii', 'i'],
    difficulty: 2,
  },
  {
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    genre: 'Pop',
    mode: 'Dorian',
    degrees: [0, 1, 0, 1],
    roman:   ['i', 'ii', 'i', 'ii'],
    difficulty: 1,
  },
  // ── JAZZ ────────────────────────────────────────────────
  {
    title: 'Autumn Leaves',
    artist: 'Traditional Jazz',
    genre: 'Jazz',
    mode: 'Ionian',
    degrees: [1, 4, 0, 3, 6, 2, 5],
    roman:   ['ii', 'V', 'I', 'IV', 'vii°', 'iii', 'vi'],
    difficulty: 3,
  },
  {
    title: 'Fly Me to the Moon',
    artist: 'Frank Sinatra',
    genre: 'Jazz',
    mode: 'Ionian',
    degrees: [1, 4, 0, 3, 6, 2, 4, 0],
    roman:   ['ii', 'V', 'I', 'IV', 'vii°', 'iii', 'V', 'I'],
    difficulty: 3,
  },
  // ── BLUES / MIXOLYDIAN ──────────────────────────────────
  {
    title: '12-Bar Blues',
    artist: 'Traditional',
    genre: 'Blues',
    mode: 'Mixolydian',
    degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4],
    roman:   ['I','I','I','I','IV','IV','I','I','V','IV','I','V'],
    difficulty: 2,
  },
  {
    title: 'La Grange',
    artist: 'ZZ Top',
    genre: 'Blues',
    mode: 'Mixolydian',
    degrees: [0, 3, 4],
    roman:   ['I', 'IV', 'V'],
    difficulty: 1,
  },
  // ── IONIAN / MIXED ──────────────────────────────────────
  {
    title: 'Creep',
    artist: 'Radiohead',
    genre: 'Rock',
    mode: 'Ionian',
    degrees: [0, 2, 3, 5],
    roman:   ['I', 'III', 'IV', 'iv'],
    difficulty: 2,
  },
];

// ════════════════════════════════════════════════════════════
//  MODULE
// ════════════════════════════════════════════════════════════

const SongsModule = (() => {

  // ── State ───────────────────────────────────────────────
  let selectedSong  = null;
  let activeGenre   = 'ALL';
  let isPlaying     = false;
  let currentStep   = -1;
  let playTimer     = null;
  let bpm           = 80;

  // ── DOM refs ────────────────────────────────────────────
  let playerEl, playerTitleEl, playerArtistEl, playerChordsEl;
  let playBtn, stopBtn, modeWarnEl;
  let genreStripEl, songsListEl;

  // ── Chord card element refs (rebuilt per song) ───────────
  let chordCardEls = [];   // [ { card, nameEl, deg } ]

  // ════════════════════════════════════════════════════════
  //  INIT
  // ════════════════════════════════════════════════════════

  function init() {
    playerEl        = document.getElementById('songsPlayer');
    playerTitleEl   = document.getElementById('songsPlayerTitle');
    playerArtistEl  = document.getElementById('songsPlayerArtist');
    playerChordsEl  = document.getElementById('songsPlayerChords');
    playBtn         = document.getElementById('songsPlayBtn');
    stopBtn         = document.getElementById('songsStopBtn');
    modeWarnEl      = document.getElementById('songsModeWarning');
    genreStripEl    = document.getElementById('songsGenreFilter');
    songsListEl     = document.getElementById('songsList');

    buildGenreFilter();
    buildSongList();
    buildBpmKnob();

    playBtn.addEventListener('click', () => isPlaying ? stop() : play());
    stopBtn.addEventListener('click', stop);
  }

  // ════════════════════════════════════════════════════════
  //  GENRE FILTER
  // ════════════════════════════════════════════════════════

  function buildGenreFilter() {
    const genres = ['ALL', ...Array.from(new Set(SONG_DB.map(s => s.genre))).sort()];
    genreStripEl.innerHTML = '';
    genres.forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'songs-genre-btn' + (g === activeGenre ? ' active' : '');
      btn.textContent = g;
      btn.addEventListener('click', () => {
        activeGenre = g;
        genreStripEl.querySelectorAll('.songs-genre-btn').forEach(b =>
          b.classList.toggle('active', b.textContent === g)
        );
        buildSongList();
      });
      genreStripEl.appendChild(btn);
    });
  }

  // ════════════════════════════════════════════════════════
  //  SONG LIST
  // ════════════════════════════════════════════════════════

  function buildSongList() {
    const filtered = activeGenre === 'ALL'
      ? SONG_DB
      : SONG_DB.filter(s => s.genre === activeGenre);

    songsListEl.innerHTML = '';

    filtered.forEach(song => {
      const row = document.createElement('div');
      row.className = 'song-row' + (song === selectedSong ? ' active' : '');

      const titleEl = document.createElement('span');
      titleEl.className = 'song-row-title';
      titleEl.textContent = song.title;

      const artistEl = document.createElement('span');
      artistEl.className = 'song-row-artist';
      artistEl.textContent = song.artist;

      const diffEl = document.createElement('div');
      diffEl.className = 'song-difficulty';
      for (let i = 1; i <= 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'song-diff-dot' + (i <= song.difficulty ? ' on' : '');
        diffEl.appendChild(dot);
      }

      const genreEl = document.createElement('span');
      genreEl.className = 'song-row-genre';
      genreEl.textContent = song.genre;

      row.appendChild(titleEl);
      row.appendChild(artistEl);
      row.appendChild(diffEl);
      row.appendChild(genreEl);

      row.addEventListener('click', () => selectSong(song));
      songsListEl.appendChild(row);
    });
  }

  // ════════════════════════════════════════════════════════
  //  SONG SELECTION
  // ════════════════════════════════════════════════════════

  function selectSong(song) {
    stop();
    selectedSong = song;

    // Update active highlight in list
    songsListEl.querySelectorAll('.song-row').forEach(row => {
      row.classList.toggle(
        'active',
        row.querySelector('.song-row-title').textContent === song.title
      );
    });

    playerEl.style.display = '';
    playerTitleEl.textContent  = song.title.toUpperCase();
    playerArtistEl.textContent = '\u00B7 ' + song.artist;

    buildChordCards(song);
    updatePlayerChords();
    checkModeWarning();
  }

  // ════════════════════════════════════════════════════════
  //  CHORD CARDS
  // ════════════════════════════════════════════════════════

  function buildChordCards(song) {
    playerChordsEl.innerHTML = '';
    chordCardEls = [];

    song.degrees.forEach((deg, i) => {
      if (i > 0) {
        const arrow = document.createElement('span');
        arrow.className = 'songs-chord-arrow';
        arrow.textContent = '\u203A';
        playerChordsEl.appendChild(arrow);
      }

      const card = document.createElement('div');
      card.className = 'songs-chord-card';

      const romanEl = document.createElement('div');
      romanEl.className = 'songs-chord-roman';
      romanEl.textContent = song.roman[i];

      const nameEl = document.createElement('div');
      nameEl.className = 'songs-chord-name';
      nameEl.textContent = '\u2014';

      card.appendChild(romanEl);
      card.appendChild(nameEl);

      // Click a card to play that chord manually
      card.addEventListener('click', () => {
        if (deg >= 0 && deg <= 6) onKeyDown(deg);
      });

      playerChordsEl.appendChild(card);
      chordCardEls.push({ card, nameEl, deg });
    });
  }

  // ════════════════════════════════════════════════════════
  //  LIVE CHORD NAME COMPUTATION
  //  Called on song selection AND whenever Circle changes.
  // ════════════════════════════════════════════════════════

  function updatePlayerChords() {
    if (!selectedSong) return;
    chordCardEls.forEach(({ nameEl, deg }) => {
      nameEl.textContent = getChordNameForDegree(deg);
    });
    checkModeWarning();
  }

  function getChordNameForDegree(deg) {
    const rootIdx  = circle.rootNoteIdx;
    const modeName = circle.modeName;
    const ivl      = MODE_INTERVALS[modeName];
    if (!ivl || deg < 0 || deg >= ivl.length) return '?';
    const noteIdx = (rootIdx + ivl[deg]) % 12;
    return NOTES[noteIdx];
  }

  function checkModeWarning() {
    if (!selectedSong) return;
    const mismatch = circle.modeName !== selectedSong.mode;
    modeWarnEl.style.display = mismatch ? '' : 'none';
    if (mismatch) {
      modeWarnEl.textContent =
        '\u26A0 Best in ' + selectedSong.mode + ' (currently ' + circle.modeName + ')';
    }
  }

  // ════════════════════════════════════════════════════════
  //  PLAYBACK ENGINE
  // ════════════════════════════════════════════════════════

  function play() {
    if (!selectedSong) return;
    if (isPlaying) stop();
    isPlaying   = true;
    currentStep = -1;
    playBtn.classList.add('playing');
    playBtn.textContent = '\u23F8 PAUSE';
    tick();
    playTimer = setInterval(tick, Math.round(60000 / bpm));
  }

  function stop() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    isPlaying   = false;
    currentStep = -1;
    playBtn.classList.remove('playing');
    playBtn.textContent = '\u25B6 PLAY';
    clearKeyPadHighlight();
    clearChordCardHighlight();
  }

  function tick() {
    if (!selectedSong) { stop(); return; }
    currentStep = (currentStep + 1) % selectedSong.degrees.length;
    advanceStep(currentStep);
  }

  function advanceStep(step) {
    const deg = selectedSong.degrees[step];
    if (deg >= 0 && deg <= 6) onKeyDown(deg);
    highlightKeyPad(deg);
    chordCardEls.forEach(({ card }, i) => {
      card.classList.toggle('active-step', i === step);
    });
  }

  // ════════════════════════════════════════════════════════
  //  KEY PAD HIGHLIGHTING
  // ════════════════════════════════════════════════════════

  function highlightKeyPad(deg) {
    clearKeyPadHighlight();
    if (deg >= 0 && deg <= 6 && keyEls[deg]) {
      keyEls[deg].classList.add('songs-active');
    }
  }

  function clearKeyPadHighlight() {
    keyEls.forEach(el => el && el.classList.remove('songs-active'));
  }

  function clearChordCardHighlight() {
    chordCardEls.forEach(({ card }) => card.classList.remove('active-step'));
  }

  // ════════════════════════════════════════════════════════
  //  BPM KNOB
  // ════════════════════════════════════════════════════════

  function buildBpmKnob() {
    const slot = document.getElementById('songsBpmKnob');
    if (!slot) return;
    new RotaryKnob(slot, {
      min: 40, max: 200,
      default: 80,
      step: 1,
      label: 'BPM',
      size: 34,
      arcColor: '#44ff88',
      format: v => Math.round(v) + '',
      onChange: v => {
        bpm = Math.round(v);
        if (isPlaying) {
          clearInterval(playTimer);
          playTimer = setInterval(tick, Math.round(60000 / bpm));
        }
      },
    });
  }

  // ── Public API ──────────────────────────────────────────
  return { init, updatePlayerChords };

})();
