import sys
import queue as _queue
import numpy as np
import threading

try:
    import sounddevice as sd
    _AUDIO_AVAILABLE = True
except (ImportError, OSError):
    _AUDIO_AVAILABLE = False
    print("Warning: audio output not available (sounddevice/PortAudio missing). "
          "UI will work but no sound.")


class _AudioEngine:
    """Persistent-stream audio engine.

    Keeps ONE sd.OutputStream open for the application lifetime — opening and
    closing PortAudio streams on every chord press injects a hardware-level
    click each time (stream init + teardown).  Here we write silence while
    idle and crossfade into new audio on demand, so the stream never closes.
    """
    CHUNK = 512   # write block size in samples (~11.6 ms @ 44100 Hz)
    XFADE = 1024  # crossfade window when interrupting (~23 ms @ 44100 Hz)

    def __init__(self, sample_rate=44100, on_chunk=None):
        self.sample_rate = sample_rate
        self._on_chunk   = on_chunk   # callable(chunk: np.ndarray) for spectrum
        self._q          = _queue.Queue()
        self._stop       = threading.Event()
        self._thread     = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def _loop(self):
        buf = np.zeros(0, dtype=np.float32)
        try:
            with sd.OutputStream(samplerate=self.sample_rate, channels=1,
                                  dtype='float32', blocksize=self.CHUNK) as stream:
                while not self._stop.is_set():
                    # Drain queue — keep only the most-recent audio (stale
                    # chord data produced during join() latency is discarded).
                    newest = None
                    try:
                        while True:
                            newest = self._q.get_nowait()
                    except _queue.Empty:
                        pass

                    if newest is not None:
                        # Crossfade from current playback position into new audio.
                        # This removes the hard-cut click when chords are changed
                        # mid-playback.
                        xf = min(self.XFADE, len(buf), len(newest))
                        if xf > 0:
                            ramp_out = np.linspace(1., 0., xf, dtype=np.float32)
                            ramp_in  = np.linspace(0., 1., xf, dtype=np.float32)
                            overlap  = buf[:xf] * ramp_out + newest[:xf] * ramp_in
                            buf = np.concatenate([overlap, newest[xf:]])
                        else:
                            buf = newest

                    if len(buf) >= self.CHUNK:
                        chunk = buf[:self.CHUNK]
                        stream.write(chunk.reshape(-1, 1))
                        if self._on_chunk:
                            self._on_chunk(chunk)
                        buf = buf[self.CHUNK:]
                    else:
                        # Flush leftover samples padded with silence, then stay
                        # open writing silence — stream never closes.
                        out = np.zeros(self.CHUNK, dtype=np.float32)
                        out[:len(buf)] = buf
                        stream.write(out.reshape(-1, 1))
                        buf = np.zeros(0, dtype=np.float32)
        except Exception as e:
            print(f'AudioEngine error: {e}')

    def play(self, audio_f32: np.ndarray):
        """Enqueue audio for immediate crossfaded playback."""
        self._q.put(audio_f32)

    def shutdown(self):
        self._stop.set()

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QPushButton, QVBoxLayout,
    QHBoxLayout, QGridLayout, QLabel, QComboBox, QTabWidget,
    QSizePolicy, QMessageBox, QInputDialog, QFrame
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont, QColor

from utils.audio_utils import (
    NOTES, MODES, WAVEFORMS, DEFAULT_OCTAVE,
    MODE_INTERVALS, CHORD_QUALITIES, get_frequency, generate_waveform
)
from ui.theme import MATERIAL_COLORS, APP_STYLE, FONT_FAMILY, FONT_SIZES
from ui.components import (
    MaterialCard, ModernSlider, ModernCheckBox, CircleOfFifthsWidget
)
from ui.instrument_key import InstrumentKeyWidget
from ui.spectrum_analyzer import SpectrumAnalyzer
from ui.waveform_visualizer import WaveformVisualizer
from presets import PresetManager, DEFAULT_PRESET

# ── Extension chord definitions (keys 8-12) ───────────────────────────────────
# Each entry: scale degree (0-6), extra voicing tones to force ON,
#             display suffix, quality colour key
EXTENSION_KEY_CONFIGS = [
    {'degree': 0, 'extra': {'7': True},  'suffix': 'maj7',  'quality': 'major'},
    {'degree': 4, 'extra': {'7': True},  'suffix': '7',     'quality': 'dominant'},
    {'degree': 3, 'extra': {'9': True},  'suffix': 'add9',  'quality': 'major'},
    {'degree': 1, 'extra': {'7': True},  'suffix': 'm7',    'quality': 'minor'},
    {'degree': 5, 'extra': {'7': True},  'suffix': 'm7',    'quality': 'minor'},
]

# Qt key → key pad index (0-11)
KEY_SHORTCUT_QT = {
    Qt.Key_1: 0,  Qt.Key_2: 1,  Qt.Key_3: 2,  Qt.Key_4: 3,
    Qt.Key_5: 4,  Qt.Key_6: 5,  Qt.Key_7: 6,  Qt.Key_8: 7,
    Qt.Key_9: 8,  Qt.Key_0: 9,  Qt.Key_Minus: 10, Qt.Key_Equal: 11,
}

# Chromatic semitone offsets from root for detach mode
CHROMATIC_INTERVALS = list(range(12))


class MusicGeneratorApp(QMainWindow):
    audio_chunk_for_spectrum = pyqtSignal(np.ndarray, int)

    def __init__(self):
        super().__init__()

        # ── Audio state ───────────────────────────────────────────────
        self.sample_rate = 44100
        if _AUDIO_AVAILABLE:
            self._audio_engine = _AudioEngine(
                sample_rate=self.sample_rate,
                on_chunk=self._on_audio_chunk,
            )
        else:
            self._audio_engine = None

        # ── Preset manager ────────────────────────────────────────────
        self.preset_manager = PresetManager()

        # ── Per-degree chord voicings (1 dict per diatonic chord) ─────
        self.chord_degree_voicings = [
            {'1': True, '3': True, '5': True,
             '7': False, '9': False, '11': False, '13': False}
            for _ in range(7)
        ]

        # ── Instrument state ──────────────────────────────────────────
        self.locked_mode     = True          # False = detach (chromatic)
        self._current_octave = DEFAULT_OCTAVE

        # ── Window ────────────────────────────────────────────────────
        self.setWindowTitle("Approachable Music")
        self.setMinimumSize(960, 680)
        self.resize(1280, 820)
        self.setStyleSheet(APP_STYLE)

        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QVBoxLayout(central)
        main_layout.setSpacing(8)
        main_layout.setContentsMargins(12, 12, 12, 12)

        self._build_top_section(main_layout)
        self._build_key_section(main_layout)
        self._build_flavour_strip(main_layout)
        self._build_bottom_section(main_layout)
        self._build_voice_panel(main_layout)

        # ── Signal wiring ─────────────────────────────────────────────
        self.circle_widget.rootChanged.connect(self.update_chord_labels)
        self.circle_widget.modeChanged.connect(self.update_chord_labels)
        self.audio_chunk_for_spectrum.connect(self.spectrum_analyzer.update_spectrum)

        # ── Initialise ────────────────────────────────────────────────
        self.load_preset(0)
        self.update_chord_labels()
        self._update_waveform_visualization_data()

    # ══════════════════════════════════════════════════════════════════
    # UI builders
    # ══════════════════════════════════════════════════════════════════

    def _build_top_section(self, parent_layout):
        """Circle of Fifths (left) | status bar + visualisers (right)."""
        row = QHBoxLayout()
        row.setSpacing(10)

        # ── Left: Circle of Fifths ────────────────────────────────────
        circle_card = MaterialCard()
        circle_card.setFixedWidth(290)
        circle_inner = QVBoxLayout(circle_card)
        circle_inner.setContentsMargins(8, 8, 8, 8)
        self.circle_widget = CircleOfFifthsWidget(NOTES, MODES)
        circle_inner.addWidget(self.circle_widget)
        row.addWidget(circle_card)

        # ── Right: status bar + visualisers ───────────────────────────
        right = QVBoxLayout()
        right.setSpacing(6)
        right.addLayout(self._build_status_bar())

        viz = QHBoxLayout()
        viz.setSpacing(6)

        # Waveform (user wants this prominent)
        wf_card = MaterialCard()
        wf_inner = QVBoxLayout(wf_card)
        wf_inner.setContentsMargins(6, 4, 6, 4)
        wf_lbl = QLabel("WAVEFORM")
        wf_lbl.setAlignment(Qt.AlignCenter)
        wf_lbl.setStyleSheet(
            f"color: {MATERIAL_COLORS['accent']}; font-size: 9px; font-weight: bold; letter-spacing: 1px;"
        )
        self.waveform_visualizer = WaveformVisualizer()
        self.waveform_visualizer.setMinimumHeight(130)
        wf_inner.addWidget(wf_lbl)
        wf_inner.addWidget(self.waveform_visualizer)
        viz.addWidget(wf_card, 3)

        # Spectrum
        sp_card = MaterialCard()
        sp_inner = QVBoxLayout(sp_card)
        sp_inner.setContentsMargins(6, 4, 6, 4)
        sp_lbl = QLabel("SPECTRUM")
        sp_lbl.setAlignment(Qt.AlignCenter)
        sp_lbl.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 9px; font-weight: bold; letter-spacing: 1px;"
        )
        self.spectrum_analyzer = SpectrumAnalyzer()
        sp_inner.addWidget(sp_lbl)
        sp_inner.addWidget(self.spectrum_analyzer)
        viz.addWidget(sp_card, 2)

        right.addLayout(viz)
        row.addLayout(right, 1)
        parent_layout.addLayout(row)

    def _build_status_bar(self) -> QHBoxLayout:
        """ROOT label | SCALE label | LOCKED/DETACH toggle | OCT control."""
        bar = QHBoxLayout()
        bar.setSpacing(10)

        # Root / Scale labels
        self.root_label = QLabel("ROOT: C")
        self.root_label.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_primary']}; font-size: 13px; font-weight: bold;"
        )
        bar.addWidget(self.root_label)

        sep = QLabel("|")
        sep.setStyleSheet(f"color: {MATERIAL_COLORS['text_secondary']};")
        bar.addWidget(sep)

        self.scale_label = QLabel("SCALE: Ionian")
        self.scale_label.setStyleSheet(
            f"color: {MATERIAL_COLORS['accent']}; font-size: 13px; font-weight: bold;"
        )
        bar.addWidget(self.scale_label)

        bar.addStretch()

        # SCALE / FREE toggle
        self.locked_btn = QPushButton("SCALE")
        self.locked_btn.setToolTip(
            "Scale Mode — keys 1–7 play diatonic chords that always stay in key.\n"
            "Keys 8–= play extension chords (maj7, 7th, add9…)."
        )
        self.detach_btn = QPushButton("FREE")
        self.detach_btn.setToolTip(
            "Free Mode — all 12 keys play chromatic semitones from the root note.\n"
            "Use this to explore notes freely outside the scale."
        )
        for btn in (self.locked_btn, self.detach_btn):
            btn.setCheckable(True)
            btn.setFixedHeight(28)
            btn.setMinimumWidth(72)
        self.locked_btn.setChecked(True)
        self._style_mode_buttons()
        self.locked_btn.clicked.connect(lambda: self._set_mode(True))
        self.detach_btn.clicked.connect(lambda: self._set_mode(False))
        bar.addWidget(self.locked_btn)
        bar.addWidget(self.detach_btn)

        sep2 = QLabel("|")
        sep2.setStyleSheet(f"color: {MATERIAL_COLORS['text_secondary']};")
        bar.addWidget(sep2)

        # Octave control
        oct_lbl = QLabel("OCT")
        oct_lbl.setToolTip("Transpose the instrument up or down by one octave")
        oct_lbl.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 11px;"
        )
        bar.addWidget(oct_lbl)

        self.oct_down = QPushButton("◄")
        self.oct_down.setFixedSize(26, 26)
        self.oct_down.setToolTip("Octave down")
        self.oct_down.clicked.connect(lambda: self._change_octave(-1))
        bar.addWidget(self.oct_down)

        self.oct_display = QLabel(str(self._current_octave))
        self.oct_display.setFixedWidth(22)
        self.oct_display.setAlignment(Qt.AlignCenter)
        self.oct_display.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_primary']}; font-size: 14px; font-weight: bold;"
        )
        bar.addWidget(self.oct_display)

        self.oct_up = QPushButton("►")
        self.oct_up.setFixedSize(26, 26)
        self.oct_up.setToolTip("Octave up")
        self.oct_up.clicked.connect(lambda: self._change_octave(1))
        bar.addWidget(self.oct_up)

        return bar

    def _build_key_section(self, parent_layout):
        """12 playable key pads in two labelled groups: 7 diatonic + 5 extension."""
        keys_card = MaterialCard()
        keys_card.setMinimumHeight(150)
        outer = QHBoxLayout(keys_card)
        outer.setContentsMargins(8, 6, 8, 8)
        outer.setSpacing(8)

        self.instrument_keys: list[InstrumentKeyWidget] = []

        _group_label_style = (
            f"color: {MATERIAL_COLORS['text_secondary']}; "
            "font-size: 8px; font-weight: bold; letter-spacing: 1.5px; border: none;"
        )

        # ── Diatonic group (keys 1–7) ──────────────────────────────────
        diatonic_frame = QFrame()
        diatonic_frame.setStyleSheet("QFrame { border: none; }")
        d_layout = QVBoxLayout(diatonic_frame)
        d_layout.setContentsMargins(0, 0, 0, 0)
        d_layout.setSpacing(3)

        d_lbl = QLabel("SCALE CHORDS  ·  keys 1–7")
        d_lbl.setAlignment(Qt.AlignCenter)
        d_lbl.setStyleSheet(_group_label_style)
        d_layout.addWidget(d_lbl)

        d_keys = QHBoxLayout()
        d_keys.setSpacing(4)
        for i in range(7):
            key = InstrumentKeyWidget(i, is_extension=False)
            key.keyPressed.connect(self.on_key_pressed)
            key.keyReleased.connect(self.on_key_released)
            d_keys.addWidget(key)
            self.instrument_keys.append(key)
        d_layout.addLayout(d_keys)
        outer.addWidget(diatonic_frame, 7)

        # Subtle vertical divider
        divider = QFrame()
        divider.setFixedWidth(1)
        divider.setStyleSheet(f"background-color: {MATERIAL_COLORS['divider']};")
        outer.addWidget(divider)

        # ── Extension group (keys 8–12) ────────────────────────────────
        ext_frame = QFrame()
        ext_frame.setStyleSheet("QFrame { border: none; }")
        e_layout = QVBoxLayout(ext_frame)
        e_layout.setContentsMargins(0, 0, 0, 0)
        e_layout.setSpacing(3)

        e_lbl = QLabel("EXTENSIONS  ·  keys 8–=")
        e_lbl.setAlignment(Qt.AlignCenter)
        e_lbl.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; "
            "font-size: 8px; font-weight: bold; letter-spacing: 1.5px; "
            "border: none;"
        )
        e_layout.addWidget(e_lbl)

        e_keys = QHBoxLayout()
        e_keys.setSpacing(4)
        for i in range(7, 12):
            key = InstrumentKeyWidget(i, is_extension=True)
            key.keyPressed.connect(self.on_key_pressed)
            key.keyReleased.connect(self.on_key_released)
            e_keys.addWidget(key)
            self.instrument_keys.append(key)
        e_layout.addLayout(e_keys)
        outer.addWidget(ext_frame, 5)

        parent_layout.addWidget(keys_card, 2)

    def _build_flavour_strip(self, parent_layout):
        """Global chord-flavour selector. Pro flavours are locked."""
        row = QHBoxLayout()
        row.setSpacing(6)

        lbl = QLabel("CHORD STYLE:")
        lbl.setToolTip(
            "Override the chord quality for every key you press.\n"
            "Leave unselected to let the scale determine major/minor/dim automatically."
        )
        lbl.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 10px; font-weight: bold; letter-spacing: 1px;"
        )
        row.addWidget(lbl)

        self.flavour_buttons: dict[str, QPushButton] = {}
        self.active_flavour: str | None = None

        free_flavours = ['maj', 'min', '7']
        pro_flavours  = ['maj7', 'min7', 'sus2', 'sus4', 'add9', 'dim', 'aug']

        for label in free_flavours:
            btn = QPushButton(label)
            btn.setCheckable(True)
            btn.setFixedHeight(26)
            btn.setFixedWidth(46)
            btn.setStyleSheet(self._flavour_btn_style(False))
            btn.clicked.connect(lambda _, l=label: self._on_flavour_selected(l))
            self.flavour_buttons[label] = btn
            row.addWidget(btn)

        pro_sep = QLabel("  PRO  →")
        pro_sep.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 9px;"
        )
        row.addWidget(pro_sep)

        for label in pro_flavours:
            btn = QPushButton(f"  {label}")
            btn.setEnabled(False)
            btn.setFixedHeight(26)
            btn.setFixedWidth(58)
            btn.setToolTip("Available on hardware / Pro version")
            btn.setStyleSheet(f"""
                QPushButton {{
                    background-color: {MATERIAL_COLORS['background']};
                    color: #4A4A4A;
                    border: 1px dashed #404040;
                    border-radius: 4px;
                    font-size: 9px;
                }}
            """)
            row.addWidget(btn)

        row.addStretch()
        parent_layout.addLayout(row)

    def _build_bottom_section(self, parent_layout):
        """Looper placeholder | Effects placeholder — wired up in later steps."""
        row = QHBoxLayout()
        row.setSpacing(8)

        # Looper card
        looper_card = MaterialCard()
        looper_card.setFixedHeight(80)
        looper_inner = QVBoxLayout(looper_card)
        looper_inner.setContentsMargins(10, 6, 10, 6)

        looper_title = QLabel("LOOPER   —   coming soon")
        looper_title.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 10px; font-weight: bold; letter-spacing: 1px;"
        )
        looper_inner.addWidget(looper_title)

        btns = QHBoxLayout()
        for label, tip in [("● REC", "Record"), ("▶", "Play"),
                            ("■", "Stop"), ("✕", "Clear")]:
            b = QPushButton(label)
            b.setEnabled(False)
            b.setFixedHeight(28)
            b.setToolTip(tip)
            btns.addWidget(b)
        btns.addStretch()

        time_lbl = QLabel("0:00 / 0:30")
        time_lbl.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 10px;"
        )
        btns.addWidget(time_lbl)
        looper_inner.addLayout(btns)
        row.addWidget(looper_card, 2)

        # Effects card
        fx_card = MaterialCard()
        fx_card.setFixedHeight(80)
        fx_inner = QVBoxLayout(fx_card)
        fx_inner.setContentsMargins(10, 6, 10, 6)

        fx_title = QLabel("EFFECTS   —   coming soon")
        fx_title.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 10px; font-weight: bold; letter-spacing: 1px;"
        )
        fx_inner.addWidget(fx_title)

        fx_sliders = QHBoxLayout()
        for label in ["Reverb", "Delay", "Filter"]:
            col = QVBoxLayout()
            col.setSpacing(2)
            l = QLabel(label)
            l.setAlignment(Qt.AlignCenter)
            l.setStyleSheet(
                f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 9px;"
            )
            sl = ModernSlider(Qt.Horizontal)
            sl.setEnabled(False)
            sl.setRange(0, 100)
            sl.setValue(30)
            col.addWidget(l)
            col.addWidget(sl)
            fx_sliders.addLayout(col)
        fx_inner.addLayout(fx_sliders)
        row.addWidget(fx_card, 3)

        parent_layout.addLayout(row)

    def _build_voice_panel(self, parent_layout):
        """Collapsible sound-design panel (waveform tabs + presets + master settings)."""
        self.voice_toggle_btn = QPushButton("▶   Sound Design")
        self.voice_toggle_btn.setCheckable(True)
        self.voice_toggle_btn.setChecked(False)
        self.voice_toggle_btn.setFixedHeight(28)
        self.voice_toggle_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {MATERIAL_COLORS['surface']};
                color: {MATERIAL_COLORS['text_secondary']};
                border: 1px solid #555;
                border-radius: 4px;
                text-align: left;
                padding-left: 10px;
                font-size: 11px;
            }}
            QPushButton:checked {{ color: {MATERIAL_COLORS['text_primary']}; }}
        """)
        self.voice_toggle_btn.toggled.connect(self._toggle_voice_panel)
        parent_layout.addWidget(self.voice_toggle_btn)

        self.voice_panel = QWidget()
        self.voice_panel.setVisible(False)
        panel_outer = QVBoxLayout(self.voice_panel)
        panel_outer.setContentsMargins(0, 4, 0, 0)
        panel_outer.setSpacing(6)

        voice_card = MaterialCard()
        voice_inner = QHBoxLayout(voice_card)
        voice_inner.setContentsMargins(10, 8, 10, 8)
        voice_inner.setSpacing(14)

        # ── Left column: presets + master settings ────────────────────
        left_col = QVBoxLayout()
        left_col.setSpacing(8)

        # Preset row
        preset_row = QHBoxLayout()
        preset_lbl = QLabel("Preset:")
        preset_lbl.setStyleSheet(f"color: {MATERIAL_COLORS['text_primary']};")
        preset_row.addWidget(preset_lbl)

        self.preset_combo = QComboBox()
        self.preset_combo.addItems(self.preset_manager.get_preset_names())
        self.preset_combo.setStyleSheet(f"""
            QComboBox {{
                background-color: {MATERIAL_COLORS['surface']};
                color: {MATERIAL_COLORS['text_primary']};
                border: 1px solid {MATERIAL_COLORS['primary']};
                border-radius: 4px;
                padding: 4px;
                min-width: 100px;
            }}
            QComboBox QAbstractItemView {{
                background-color: {MATERIAL_COLORS['surface']};
                color: {MATERIAL_COLORS['text_primary']};
                selection-background-color: {MATERIAL_COLORS['primary']};
            }}
        """)
        self.preset_combo.currentIndexChanged.connect(self.load_preset)
        preset_row.addWidget(self.preset_combo)
        left_col.addLayout(preset_row)

        preset_btns = QHBoxLayout()
        for label, slot in [
            ("Save",   self.save_preset_dialog),
            ("New",    self.new_preset_dialog),
            ("Delete", self.delete_preset),
        ]:
            btn = QPushButton(label)
            btn.clicked.connect(slot)
            preset_btns.addWidget(btn)
        left_col.addLayout(preset_btns)

        # Crossfade length when interrupting a playing chord
        fade_row = QHBoxLayout()
        fade_lbl = QLabel("Crossfade (ms):")
        fade_lbl.setStyleSheet(
            f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 10px;"
        )
        fade_row.addWidget(fade_lbl)
        self.interruption_fade_slider = ModernSlider(Qt.Horizontal)
        self.interruption_fade_slider.setRange(0, 500)
        self.interruption_fade_slider.setValue(23)   # matches engine default XFADE (~23 ms)
        fade_row.addWidget(self.interruption_fade_slider)
        self.interruption_fade_value_label = QLabel("23 ms")
        self.interruption_fade_slider.valueChanged.connect(self._on_crossfade_changed)
        fade_row.addWidget(self.interruption_fade_value_label)
        left_col.addLayout(fade_row)

        # Spectrum range controls
        for label_text, attr, lo, hi, default, unit in [
            ("Spectrum dB",   'spectrum_range_slider',    40,   120, 65,   ' dB'),
            ("Min Freq",      'spectrum_min_freq_slider', 20,  5000, 100,  ' Hz'),
            ("Max Freq",      'spectrum_max_freq_slider', 1000, 22050, 6000, ' Hz'),
        ]:
            sr_row = QHBoxLayout()
            sr_lbl = QLabel(f"{label_text}:")
            sr_lbl.setStyleSheet(
                f"color: {MATERIAL_COLORS['text_secondary']}; font-size: 10px;"
            )
            sr_row.addWidget(sr_lbl)
            sl = ModernSlider(Qt.Horizontal)
            sl.setRange(lo, hi)
            sl.setValue(default)
            setattr(self, attr, sl)
            sr_row.addWidget(sl)
            val_lbl = QLabel(f"{default}{unit}")
            sl.valueChanged.connect(lambda v, l=val_lbl, u=unit: l.setText(f"{v}{u}"))
            sr_row.addWidget(val_lbl)
            left_col.addLayout(sr_row)

        self.spectrum_range_slider.valueChanged.connect(
            lambda v: self.spectrum_analyzer.set_dynamic_range(v)
        )
        self.spectrum_min_freq_slider.valueChanged.connect(self._update_spectrum_display_range)
        self.spectrum_max_freq_slider.valueChanged.connect(self._update_spectrum_display_range)
        self.spectrum_analyzer.set_dynamic_range(self.spectrum_range_slider.value())
        self._update_spectrum_display_range()

        left_col.addStretch()
        voice_inner.addLayout(left_col, 1)

        # ── Right: voice waveform tabs ────────────────────────────────
        self.voice_tabs = QTabWidget()
        self.voice_tabs.setStyleSheet(f"""
            QTabWidget::pane {{
                border-top: 1px solid {MATERIAL_COLORS['primary_dark']};
                background: {MATERIAL_COLORS['surface']};
            }}
            QTabBar::tab {{
                background: {MATERIAL_COLORS['background']};
                color: {MATERIAL_COLORS['text_secondary']};
                border: 1px solid {MATERIAL_COLORS['primary_dark']};
                border-bottom: none;
                padding: 6px 10px;
                margin-right: 2px;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }}
            QTabBar::tab:selected {{
                background: {MATERIAL_COLORS['primary']};
                color: {MATERIAL_COLORS['text_primary']};
            }}
            QTabBar::tab:hover:!selected {{
                background: {MATERIAL_COLORS['primary_light']};
                color: {MATERIAL_COLORS['text_primary']};
            }}
            QTabBar::tab:!selected {{ margin-top: 2px; }}
        """)

        self.voice_controls = []

        for wf_idx, waveform in enumerate(WAVEFORMS):
            page   = QWidget()
            grid   = QGridLayout(page)
            grid.setSpacing(8)

            enable_cb = ModernCheckBox("Enable")
            enable_cb.setChecked(DEFAULT_PRESET[wf_idx]['enable'])
            enable_cb.stateChanged.connect(self._update_waveform_visualization_data)
            grid.addWidget(enable_cb, 0, 0, 1, 2)

            sliders: dict = {}
            for row_i, (key, label, lo, hi, default) in enumerate([
                ('volume',   'Volume',   0,    100,  DEFAULT_PRESET[wf_idx]['volume']),
                ('duration', 'Duration', 100,  5000, DEFAULT_PRESET[wf_idx]['duration']),
                ('delay',    'Delay',    0,    1000, DEFAULT_PRESET[wf_idx]['delay']),
                ('fade_in',  'Fade In',  0,    1000, DEFAULT_PRESET[wf_idx]['fade_in']),
                ('fade_out', 'Fade Out', 0,    2000, DEFAULT_PRESET[wf_idx]['fade_out']),
            ], start=1):
                grid.addWidget(QLabel(f"{label}:"), row_i, 0)
                sl = ModernSlider(Qt.Horizontal)
                sl.setRange(lo, hi)
                sl.setValue(default)
                sl.valueChanged.connect(self._update_waveform_visualization_data)
                grid.addWidget(sl, row_i, 1)
                unit    = '%' if key == 'volume' else ' ms'
                val_lbl = QLabel(f"{default}{unit}")
                sl.valueChanged.connect(lambda v, vl=val_lbl, u=unit: vl.setText(f"{v}{u}"))
                grid.addWidget(val_lbl, row_i, 2)
                sliders[key] = sl

            test_btn = QPushButton("Test")
            test_btn.clicked.connect(lambda _, idx=wf_idx: self.test_voice(idx))
            grid.addWidget(test_btn, 6, 0, 1, 3)

            self.voice_tabs.addTab(page, waveform)
            self.voice_controls.append({'enable': enable_cb, **sliders, 'test': test_btn})

        voice_inner.addWidget(self.voice_tabs, 3)
        panel_outer.addWidget(voice_card)
        parent_layout.addWidget(self.voice_panel)

    # ══════════════════════════════════════════════════════════════════
    # Instrument logic
    # ══════════════════════════════════════════════════════════════════

    def _set_mode(self, locked: bool):
        self.locked_mode = locked
        self.locked_btn.setChecked(locked)
        self.detach_btn.setChecked(not locked)
        self._style_mode_buttons()
        self.update_chord_labels()

    def _style_mode_buttons(self):
        active = f"""
            QPushButton {{
                background-color: {MATERIAL_COLORS['primary']};
                color: white; border-radius: 4px;
                font-weight: bold; font-size: 10px; border: none;
            }}
        """
        inactive = f"""
            QPushButton {{
                background-color: {MATERIAL_COLORS['surface']};
                color: {MATERIAL_COLORS['text_secondary']};
                border: 1px solid #555; border-radius: 4px; font-size: 10px;
            }}
            QPushButton:hover {{
                background-color: {MATERIAL_COLORS['primary_dark']}; color: white;
            }}
        """
        self.locked_btn.setStyleSheet(active   if self.locked_mode else inactive)
        self.detach_btn.setStyleSheet(inactive if self.locked_mode else active)

    def _change_octave(self, delta: int):
        self._current_octave = max(1, min(8, self._current_octave + delta))
        self.oct_display.setText(str(self._current_octave))

    def _toggle_voice_panel(self, checked: bool):
        self.voice_panel.setVisible(checked)
        self.voice_toggle_btn.setText(
            "▼   Sound Design" if checked else "▶   Sound Design"
        )

    def _flavour_btn_style(self, active: bool) -> str:
        if active:
            return f"""
                QPushButton {{
                    background-color: {MATERIAL_COLORS['accent']};
                    color: white; border: none;
                    border-radius: 4px; font-size: 10px; font-weight: bold;
                }}
            """
        return f"""
            QPushButton {{
                background-color: {MATERIAL_COLORS['surface']};
                color: {MATERIAL_COLORS['text_primary']};
                border: 1px solid {MATERIAL_COLORS['primary']};
                border-radius: 4px; font-size: 10px;
            }}
            QPushButton:hover {{ background-color: {MATERIAL_COLORS['primary_dark']}; }}
        """

    def _on_flavour_selected(self, label: str):
        if self.active_flavour == label:
            self.active_flavour = None
            self.flavour_buttons[label].setChecked(False)
            self.flavour_buttons[label].setStyleSheet(self._flavour_btn_style(False))
        else:
            if self.active_flavour and self.active_flavour in self.flavour_buttons:
                self.flavour_buttons[self.active_flavour].setChecked(False)
                self.flavour_buttons[self.active_flavour].setStyleSheet(
                    self._flavour_btn_style(False)
                )
            self.active_flavour = label
            self.flavour_buttons[label].setChecked(True)
            self.flavour_buttons[label].setStyleSheet(self._flavour_btn_style(True))

    # ── Key press / release ───────────────────────────────────────────

    def on_key_pressed(self, key_idx: int):
        self.instrument_keys[key_idx].set_pressed(True)
        if self.locked_mode:
            if key_idx < 7:
                self.play_chord(key_idx)
            else:
                self._play_extension(key_idx - 7)
        else:
            self._play_raw_note(key_idx)

    def on_key_released(self, key_idx: int):
        self.instrument_keys[key_idx].set_pressed(False)

    def _play_extension(self, ext_idx: int):
        """Play one of the 5 extension chords (keys 8-12)."""
        cfg    = EXTENSION_KEY_CONFIGS[ext_idx]
        degree = cfg['degree']
        voicing = {k: v for k, v in self.chord_degree_voicings[degree].items()}
        voicing.update(cfg['extra'])
        self.play_chord(degree, voicing_override=voicing)

    def _play_raw_note(self, key_idx: int):
        """Detach mode — single chromatic note from root."""
        root      = self.circle_widget.get_root_index()
        root_midi = 12 * (self._current_octave + 1) + root
        midi      = max(0, min(127, root_midi + CHROMATIC_INTERVALS[key_idx]))
        freq      = get_frequency(midi)
        audio  = []
        for i, _ in enumerate(self.voice_controls):
            s = self._get_current_voice_settings(i)
            if s['enable']:
                audio.append(generate_waveform(
                    frequency=freq,
                    duration=s['duration'] / 1000.0,
                    sample_rate=self.sample_rate,
                    waveform_type=WAVEFORMS[i],
                    volume=s['volume'] / 100.0,
                    fade_in=s['fade_in'] / 1000.0,
                    fade_out=s['fade_out'] / 1000.0,
                ))
        self._play_audio_data(audio)

    # ── Keyboard shortcuts ────────────────────────────────────────────

    def keyPressEvent(self, event):
        key = event.key()
        if key in KEY_SHORTCUT_QT and not event.isAutoRepeat():
            self.on_key_pressed(KEY_SHORTCUT_QT[key])
            return
        super().keyPressEvent(event)

    def keyReleaseEvent(self, event):
        key = event.key()
        if key in KEY_SHORTCUT_QT and not event.isAutoRepeat():
            self.on_key_released(KEY_SHORTCUT_QT[key])
            return
        super().keyReleaseEvent(event)

    # ══════════════════════════════════════════════════════════════════
    # Chord labels
    # ══════════════════════════════════════════════════════════════════

    def get_roman_numeral_for_chord(self, degree_index: int, quality_str: str) -> str:
        base = ["I", "II", "III", "IV", "V", "VI", "VII"][degree_index]
        q    = quality_str.lower()
        if q == "minor":
            return base.lower()
        if q == "diminished":
            return base.lower() + "°"
        if q == "augmented":
            return base.upper() + "+"
        return base  # major

    # Common names shown alongside music-theory mode names in the status bar
    _MODE_COMMON = {
        'Ionian':     'Major',
        'Aeolian':    'Minor',
        'Dorian':     'Dorian Minor',
        'Mixolydian': 'Dom. 7th',
        'Phrygian':   'Phrygian',
        'Lydian':     'Lydian',
        'Locrian':    'Locrian',
    }

    def update_chord_labels(self):
        root_idx  = self.circle_widget.get_root_index()
        root_name = NOTES[root_idx]
        mode_idx  = self.circle_widget.get_mode_index()
        mode_name = MODES[mode_idx]

        common = self._MODE_COMMON.get(mode_name, '')
        scale_display = (
            f"{mode_name}  ({common})" if common and common != mode_name
            else mode_name
        )

        self.root_label.setText(f"ROOT: {root_name}")
        self.scale_label.setText(f"SCALE: {scale_display}")

        intervals = MODE_INTERVALS[mode_name]
        qualities = CHORD_QUALITIES[mode_name]

        if self.locked_mode:
            # Keys 1-7: diatonic chords
            for i in range(7):
                cr_idx   = (root_idx + intervals[i]) % 12
                cr_name  = NOTES[cr_idx]
                quality  = qualities[i]
                roman    = self.get_roman_numeral_for_chord(i, quality)
                self.instrument_keys[i].set_chord_info(roman, cr_name, quality)

            # Keys 8-12: extension chords
            for ei, cfg in enumerate(EXTENSION_KEY_CONFIGS):
                deg     = cfg['degree']
                cr_idx  = (root_idx + intervals[deg]) % 12
                cr_name = NOTES[cr_idx]
                quality = qualities[deg]
                roman   = self.get_roman_numeral_for_chord(deg, quality)
                self.instrument_keys[7 + ei].set_chord_info(
                    roman,
                    f"{cr_name}{cfg['suffix']}",
                    cfg.get('quality', quality),
                )
        else:
            # Detach mode: chromatic notes from root
            for i in range(12):
                note_idx  = (root_idx + i) % 12
                note_name = NOTES[note_idx]
                self.instrument_keys[i].set_chord_info('', note_name, 'default')

    # ══════════════════════════════════════════════════════════════════
    # Audio engine  (preserved from original)
    # ══════════════════════════════════════════════════════════════════

    def _update_spectrum_display_range(self):
        if hasattr(self, 'spectrum_analyzer'):
            self.spectrum_analyzer.set_display_frequency_range(
                self.spectrum_min_freq_slider.value(),
                self.spectrum_max_freq_slider.value(),
            )

    def _update_waveform_visualization_data(self):
        if not hasattr(self, 'waveform_visualizer'):
            return
        base_freq   = 220
        num_cycles  = 2
        viz_dur     = num_cycles / base_freq
        combined    = np.zeros(int(viz_dur * self.sample_rate))
        any_enabled = False

        for i, _ in enumerate(self.voice_controls):
            s = self._get_current_voice_settings(i)
            if s['enable']:
                any_enabled = True
                seg = generate_waveform(
                    frequency=base_freq,
                    duration=viz_dur,
                    sample_rate=self.sample_rate,
                    waveform_type=WAVEFORMS[i],
                    volume=s['volume'] / 100.0,
                    delay=0, fade_in=0, fade_out=0,
                )
                if len(seg) > len(combined):
                    seg = seg[:len(combined)]
                elif len(seg) < len(combined):
                    seg = np.pad(seg, (0, len(combined) - len(seg)))
                combined += seg

        if not any_enabled:
            self.waveform_visualizer.update_waveform(np.zeros(len(combined)))
            return
        mx = np.max(np.abs(combined))
        self.waveform_visualizer.update_waveform(combined / mx if mx > 0 else combined)

    def _get_current_voice_settings(self, waveform_index: int) -> dict:
        c = self.voice_controls[waveform_index]
        return {
            'enable':   c['enable'].isChecked(),
            'volume':   c['volume'].value(),
            'duration': c['duration'].value(),
            'delay':    c['delay'].value(),
            'fade_in':  c['fade_in'].value(),
            'fade_out': c['fade_out'].value(),
        }

    def _update_per_degree_voicing(self, degree_index: int, tone_key: str, state: bool):
        if 0 <= degree_index < len(self.chord_degree_voicings):
            self.chord_degree_voicings[degree_index][tone_key] = state

    def _apply_preset(self, preset_data):
        for i, vs in enumerate(preset_data):
            if i < len(self.voice_controls):
                c = self.voice_controls[i]
                c['enable'].setChecked(vs['enable'])
                c['volume'].setValue(vs['volume'])
                c['duration'].setValue(vs['duration'])
                c['delay'].setValue(vs['delay'])
                c['fade_in'].setValue(vs['fade_in'])
                c['fade_out'].setValue(vs['fade_out'])
        self._update_waveform_visualization_data()

    def _get_current_settings_as_preset(self) -> list:
        return [self._get_current_voice_settings(i) for i in range(len(WAVEFORMS))]

    # ── Preset management ─────────────────────────────────────────────

    def load_preset(self, index=None):
        if index is None:
            name = self.preset_combo.currentText()
        else:
            name = self.preset_combo.itemText(index)
            if not name:
                if self.preset_combo.count() > 0:
                    name = self.preset_combo.itemText(0)
                    self.preset_combo.setCurrentIndex(0)
                else:
                    self._apply_preset(DEFAULT_PRESET)
                    return
        data = self.preset_manager.get_preset(name)
        if data is not None:
            self._apply_preset(data)
        elif name == "Default":
            self._apply_preset(DEFAULT_PRESET)
        else:
            self._apply_preset(DEFAULT_PRESET)

    def save_preset_dialog(self):
        name = self.preset_combo.currentText()
        if not name or name == "Default":
            name, ok = QInputDialog.getText(self, "Save Preset", "Enter preset name:")
            if ok and name:
                self.preset_manager.save_preset(name, self._get_current_settings_as_preset())
                self.preset_combo.blockSignals(True)
                self.preset_combo.addItem(name)
                self.preset_combo.setCurrentText(name)
                self.preset_combo.blockSignals(False)
                QMessageBox.information(self, "Preset Saved", f"Saved '{name}'.")
        else:
            reply = QMessageBox.question(self, "Save Preset", f"Overwrite '{name}'?",
                                         QMessageBox.Yes | QMessageBox.No)
            if reply == QMessageBox.Yes:
                self.preset_manager.save_preset(name, self._get_current_settings_as_preset())

    def new_preset_dialog(self):
        name, ok = QInputDialog.getText(self, "New Preset", "Enter preset name:")
        if ok and name:
            if name in self.preset_manager.get_preset_names():
                QMessageBox.warning(self, "New Preset", f"'{name}' already exists.")
                return
            self._apply_preset(DEFAULT_PRESET)
            self.preset_manager.save_preset(name, DEFAULT_PRESET)
            self.preset_combo.blockSignals(True)
            self.preset_combo.addItem(name)
            self.preset_combo.setCurrentText(name)
            self.preset_combo.blockSignals(False)

    def delete_preset(self):
        name = self.preset_combo.currentText()
        if not name or name == "Default":
            QMessageBox.warning(self, "Delete", "Cannot delete the Default preset.")
            return
        reply = QMessageBox.question(self, "Delete Preset", f"Delete '{name}'?",
                                     QMessageBox.Yes | QMessageBox.No)
        if reply == QMessageBox.Yes:
            self.preset_manager.delete_preset(name)
            idx = self.preset_combo.currentIndex()
            self.preset_combo.removeItem(idx)
            if self.preset_combo.count() > 0:
                self.preset_combo.setCurrentIndex(0)
                self.load_preset(0)
            else:
                self._apply_preset(DEFAULT_PRESET)

    # ── Chord playback ────────────────────────────────────────────────

    def play_chord(self, chord_index: int, octave_offset: int = 0,
                   voicing_override: dict | None = None):
        root_idx       = self.circle_widget.get_root_index()
        mode_name      = MODES[self.circle_widget.get_mode_index()]
        effective_oct  = max(0, min(8, self._current_octave + octave_offset))

        scale_intervals = MODE_INTERVALS[mode_name]

        # Semitone offset of this chord's root above the key root
        chord_root_semitone = scale_intervals[chord_index]

        voicing  = voicing_override if voicing_override else self.chord_degree_voicings[chord_index]

        # Each entry: (voicing_key, scale_degree, extension_octave)
        # extension_octave=1 pushes the note one octave higher (for 9th/11th/13th)
        tone_configs = [
            ('1',  chord_index,     0),
            ('3',  chord_index + 2, 0),
            ('5',  chord_index + 4, 0),
            ('7',  chord_index + 6, 0),
            ('9',  chord_index + 1, 1),
            ('11', chord_index + 3, 1),
            ('13', chord_index + 5, 1),
        ]

        # Compute semitone offsets from the key root, voiced above the chord root
        semitone_offsets = []
        for tone_key, degree, ext_oct in tone_configs:
            if not voicing.get(tone_key):
                continue
            # Raw semitone of this scale degree above the key root
            semitone = scale_intervals[degree % 7] + ext_oct * 12
            # Push up by octaves until this tone sits at or above the chord root
            while semitone < chord_root_semitone:
                semitone += 12
            semitone_offsets.append(semitone)

        if not semitone_offsets:
            self._play_audio_data([])
            return

        # Key root MIDI; each chord tone = key_root_midi + its semitone offset
        key_root_midi = 12 * (effective_oct + 1) + root_idx
        freqs = sorted(set(
            get_frequency(max(0, min(127, key_root_midi + offset)))
            for offset in semitone_offsets
        ))

        all_audio = []
        for i, _ in enumerate(self.voice_controls):
            s = self._get_current_voice_settings(i)
            if not s['enable']:
                continue
            dur    = s['duration'] / 1000.0
            delay  = s['delay']    / 1000.0
            vol    = s['volume']   / 100.0
            fi     = s['fade_in']  / 1000.0
            fo     = s['fade_out'] / 1000.0
            buf    = np.zeros(int(self.sample_rate * (dur + delay)))
            start  = int(delay * self.sample_rate)
            for freq in freqs:
                seg = generate_waveform(
                    frequency=freq, duration=dur,
                    sample_rate=self.sample_rate,
                    waveform_type=WAVEFORMS[i],
                    volume=vol, fade_in=fi, fade_out=fo,
                )
                end = start + len(seg)
                if end <= len(buf):
                    buf[start:end] += seg
                else:
                    buf[start:] += seg[:len(buf) - start]
            all_audio.append(buf)

        self._play_audio_data(all_audio)

    def test_voice(self, waveform_index: int):
        s = self._get_current_voice_settings(waveform_index)
        if not s['enable']:
            QMessageBox.information(self, "Voice Disabled", "Enable this voice first.")
            return
        a_idx   = NOTES.index("A")
        midi_A4 = 12 * 5 + a_idx
        freq    = get_frequency(midi_A4)
        audio   = generate_waveform(
            frequency=freq,
            duration=s['duration'] / 1000.0,
            sample_rate=self.sample_rate,
            waveform_type=WAVEFORMS[waveform_index],
            volume=s['volume'] / 100.0,
            fade_in=s['fade_in'] / 1000.0,
            fade_out=s['fade_out'] / 1000.0,
        )
        if s['delay'] > 0:
            ds = int(s['delay'] / 1000.0 * self.sample_rate)
            buf = np.zeros(len(audio) + ds)
            buf[ds:] = audio
            audio = buf
        self._play_audio_data([audio])

    def _on_crossfade_changed(self, value_ms: int):
        self.interruption_fade_value_label.setText(f"{value_ms} ms")
        if self._audio_engine:
            self._audio_engine.XFADE = int(value_ms / 1000.0 * self.sample_rate)

    # ── Low-level audio playback (sounddevice) ────────────────────────

    def _on_audio_chunk(self, chunk: np.ndarray):
        """Called by _AudioEngine from its worker thread for each written chunk."""
        self.audio_chunk_for_spectrum.emit(chunk, self.sample_rate)

    def _play_audio_data(self, audio_data_list):
        if not self._audio_engine or not audio_data_list:
            return
        max_len = max((len(d) for d in audio_data_list if d is not None), default=0)
        if max_len == 0:
            return
        mixed = np.zeros(max_len)
        for d in audio_data_list:
            if d is not None:
                mixed += np.pad(d, (0, max_len - len(d)))
        mx = np.max(np.abs(mixed))
        if mx > 1.0:
            mixed /= mx
        self._audio_engine.play(mixed.astype(np.float32))

    def closeEvent(self, event):
        if self._audio_engine:
            self._audio_engine.shutdown()
        super().closeEvent(event)


if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MusicGeneratorApp()
    window.show()
    sys.exit(app.exec_())
