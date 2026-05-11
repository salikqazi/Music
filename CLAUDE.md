# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

**Desktop app (Python/PyQt5):**
```bash
python ApproachableMusic/final_music_generator.py
```

**Web app:** Open `ApproachableMusic/web/index.html` directly in a browser — no server needed.

**Python interpreter:** `/home/salik/.local/python/bin/python3`

**Dependencies:**
```bash
pip install PyQt5 numpy sounddevice
```
> Note: The README mentions `pyaudio` but the actual backend uses `sounddevice`.

**Web app (served with proxy):** Python HTTP server on port 8765, accessible at `https://code-salik.salikqazi.com/proxy/8765/`

## Architecture

This project has two independent implementations sharing no code:

### Desktop (Python/PyQt5) — `ApproachableMusic/`
- **`final_music_generator.py`** — Entry point and main window. Wires together all modules, handles chord button clicks, voice controls, preset management, and spawns the audio playback thread.
- **`utils/audio_utils.py`** — Core music theory data and audio synthesis. Defines `NOTES`, `MODES`, `MODE_INTERVALS`, `CHORD_QUALITIES`, `WAVEFORMS`. Contains `generate_waveform()` with ADSR envelope logic using NumPy. All frequency math lives here.
- **`presets.py`** — Preset load/save via `presets.json` (stored alongside the module, making it portable). Each preset is a list of 4 voice config dicts (one per waveform type).
- **`ui/components.py`** — Custom PyQt5 widgets: `ModernRotaryDial` (carousel selector for notes/modes), `CircleOfFifthsWidget`, `MaterialCard`, `ModernSlider`, `ModernDial`, `ModernCheckBox`.
- **`ui/spectrum_analyzer.py`** — Real-time FFT visualization widget using NumPy.
- **`ui/theme.py`** — Material Design dark theme constants and global stylesheet.

Audio playback runs on a background thread to avoid UI blocking. If the audio device is unavailable, the UI still loads silently.

### Web (JavaScript/Web Audio API) — `ApproachableMusic/web/`
- **`js/app.js`** — Main controller: keyboard event handling (keys 1–7 and 8–= for extension chords), per-key octave/quality overrides, UI state.
- **`js/audio.js`** — Web Audio API synthesis: oscillator nodes, harmonic layers, filter chains, cent-based detuning for warmth.
- **`js/circle.js`** — Interactive SVG Circle of Fifths for root note selection.
- **`js/music-theory.js`** — Chord/scale computation (mirrors `audio_utils.py` logic in JS).
- **`js/visualizers.js`** — Canvas-based waveform/spectrum display.

## Key Conventions

- **Keyboard mapping (both platforms):** Keys 1–7 → diatonic chords; keys 8–0, -, = → extension chords (maj7, 7, add9, etc.).
- **Chord colors:** Major=#4CAF50, Minor=#AB47BC, Diminished=#FFD54F, Augmented=#FF7043.
- **Default octave:** 4 (middle C = C4).
- **Sample rate:** 44100 Hz fixed in the desktop app.
- **Voicing degrees:** Each chord independently toggles degrees 1, 3, 5, 7, 9, 11, 13 via checkboxes.
- **Preset format:** `presets.json` is auto-created from defaults ("Default", "Bright", "Soft", "Punchy") if missing.

## No Test Suite

There are no automated tests. Verify changes manually by running the app and exercising chord playback and voice controls.
