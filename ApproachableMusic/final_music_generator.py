import sys
import numpy as np
import pyaudio
import wave
import tempfile
import os
import threading
import json
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QPushButton,
                            QVBoxLayout, QHBoxLayout, QGridLayout, QLabel,
                            QComboBox, QCheckBox, QGroupBox, QDial, QSpinBox,
                            QRadioButton, QButtonGroup, QSlider, QTabWidget,
                            QFrame, QStyleFactory, QSizePolicy, QScrollArea,
                            QMessageBox, QInputDialog)
from PyQt5.QtCore import Qt, QPoint, QTimer, QRect, QSize, QPropertyAnimation, QEasingCurve, pyqtSignal # Added pyqtSignal
from PyQt5.QtGui import QFont, QPainter, QColor, QPen, QBrush, QLinearGradient, QPalette, QRadialGradient, QFontDatabase

# Import from our modules
from utils.audio_utils import (NOTES, MODES, WAVEFORMS, DEFAULT_OCTAVE,
                              MODE_INTERVALS, CHORD_QUALITIES,
                              get_frequency, generate_waveform)
from ui.theme import MATERIAL_COLORS, APP_STYLE, FONT_FAMILY, FONT_SIZES
from ui.components import (MaterialCard, ModernSlider, ModernDial,
                          ModernCheckBox, CircleOfFifthsWidget)
from ui.spectrum_analyzer import SpectrumAnalyzer
from ui.waveform_visualizer import WaveformVisualizer # Import the new visualizer
from presets import PresetManager, DEFAULT_PRESET

class ChordOctaveButtonSet(QWidget):
    """A widget containing three buttons for a chord: Oct-, Main, Oct+."""
    def __init__(self, chord_idx, app_ref, parent=None):
        super().__init__(parent)
        self.chord_idx = chord_idx
        self.app_ref = app_ref # Reference to the main MusicGeneratorApp instance
        self.voicing_checkboxes = {} # To store references to its own checkboxes { '1': cb_1, ... }

        # Main QVBoxLayout for this widget
        main_v_layout = QVBoxLayout() # Don't set parent here, set it on self.setLayout later
        main_v_layout.setContentsMargins(2, 2, 2, 2) 
        main_v_layout.setSpacing(3)                 

        # --- Top Row: 1, 3, 5 toggles ---
        top_toggles_layout = QHBoxLayout()
        top_toggles_layout.setSpacing(5)
        top_toggles_layout.setAlignment(Qt.AlignCenter)

        voicing_keys_top = {'1': "1", '3': "3", '5': "5"} # key: label
        for key, label_text in voicing_keys_top.items():
            cb = ModernCheckBox(label_text)
            # Ensure checkbox is not too wide if label is just a number
            cb.setSizePolicy(QSizePolicy.Minimum, QSizePolicy.Fixed) 
            cb.setChecked(self.app_ref.chord_degree_voicings[self.chord_idx].get(key, False))
            cb.stateChanged.connect(lambda state, k=key: self._on_voicing_toggle_changed(k, state))
            self.voicing_checkboxes[key] = cb
            top_toggles_layout.addWidget(cb)
        main_v_layout.addLayout(top_toggles_layout)

        # --- Middle Row: Oct-, Main Chord, Oct+ buttons ---
        middle_buttons_layout = QHBoxLayout()
        middle_buttons_layout.setSpacing(2)

        self.oct_down_button = QPushButton("-")
        self.oct_down_button.setFixedWidth(25)
        self.oct_down_button.clicked.connect(lambda: self.app_ref.play_chord(self.chord_idx, octave_offset=-1))
        middle_buttons_layout.addWidget(self.oct_down_button)

        self.main_chord_button = QPushButton(f"Chord {self.chord_idx + 1}")
        self.main_chord_button.setMinimumHeight(35) 
        self.main_chord_button.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        self.main_chord_button.clicked.connect(lambda: self.app_ref.play_chord(self.chord_idx, octave_offset=0))
        middle_buttons_layout.addWidget(self.main_chord_button, 1)

        self.oct_up_button = QPushButton("+")
        self.oct_up_button.setFixedWidth(25)
        self.oct_up_button.clicked.connect(lambda: self.app_ref.play_chord(self.chord_idx, octave_offset=1))
        middle_buttons_layout.addWidget(self.oct_up_button)
        
        # Initial style for the main chord button - will be overridden by update_button_text_and_style
        self.main_chord_button.setStyleSheet(f"""
            QPushButton {{
                background-color: {MATERIAL_COLORS.get('primary', '#1976D2')};
                color: white;
                border-radius: 3px; /* Slightly smaller radius for internal button */
                padding: 5px;
                border: none;
                font-weight: bold;
            }}
            QPushButton:hover {{ background-color: {MATERIAL_COLORS.get('primary_light', '#42A5F5')}; }}
            QPushButton:pressed {{ background-color: {MATERIAL_COLORS.get('primary_dark', '#0D47A1')}; }}
        """)
        main_v_layout.addLayout(middle_buttons_layout)

        # --- Bottom Row: 7, 9, 11, 13 toggles ---
        bottom_toggles_layout = QHBoxLayout()
        bottom_toggles_layout.setSpacing(5)
        bottom_toggles_layout.setAlignment(Qt.AlignCenter)

        voicing_keys_bottom = {'7': "7", '9': "9", '11': "11", '13': "13"} # key: label
        for key, label_text in voicing_keys_bottom.items():
            cb = ModernCheckBox(label_text)
            cb.setSizePolicy(QSizePolicy.Minimum, QSizePolicy.Fixed)
            cb.setChecked(self.app_ref.chord_degree_voicings[self.chord_idx].get(key, False))
            cb.stateChanged.connect(lambda state, k=key: self._on_voicing_toggle_changed(k, state))
            self.voicing_checkboxes[key] = cb
            bottom_toggles_layout.addWidget(cb)
        main_v_layout.addLayout(bottom_toggles_layout)
        
        self.setLayout(main_v_layout) # Set the main layout for the QWidget

        # Apply "own box" style to the ChordOctaveButtonSet widget itself
        self.setStyleSheet(f"""
            ChordOctaveButtonSet {{
                border: 1px solid {MATERIAL_COLORS.get('divider', '#1F1F1F')};
                border-radius: 4px;
                background-color: {MATERIAL_COLORS.get('surface', '#424242')};
                padding: 3px;
            }}
        """)

    def _on_voicing_toggle_changed(self, tone_key, state):
        """Called when one of this widget's voicing checkboxes changes."""
        self.app_ref._update_per_degree_voicing(self.chord_idx, tone_key, bool(state))

    def update_button_text_and_style(self, main_text_line, roman_numeral_line, quality):
        """Sets the text and style of the main chord button based on quality."""
        self.main_chord_button.setText(f"{main_text_line}\n{roman_numeral_line}")

        # Standardized quality input
        quality_lower = quality.lower()

        # Define desired colors directly for now, can be moved to theme.py
        color_major_bg = "#4CAF50"  # Green
        color_minor_bg = "#2196F3"  # Blue (as per "current blue")
        color_dim_bg = "#AB47BC"    # Light Purple
        color_aug_bg = "#FF7043"    # Orange (example for augmented)
        color_default_bg = MATERIAL_COLORS.get('primary', '#1976D2')

        text_color_on_dark_bg = "#FFFFFF" # White
        text_color_on_light_bg = "#000000" # Black

        bg_color_hex = color_default_bg
        text_color_hex = text_color_on_dark_bg


        if quality_lower == "major": # Assuming CHORD_QUALITIES provides "Major", "Minor", etc.
            bg_color_hex = color_major_bg
            text_color_hex = text_color_on_dark_bg
        elif quality_lower == "minor":
            bg_color_hex = color_minor_bg
            text_color_hex = text_color_on_dark_bg
        elif quality_lower == "diminished": # Check for full "diminished"
            bg_color_hex = color_dim_bg
            text_color_hex = text_color_on_dark_bg
        elif quality_lower == "augmented": # Check for full "augmented"
            bg_color_hex = color_aug_bg
            text_color_hex = text_color_on_dark_bg
        
        # Create QColor objects to easily get lighter/darker versions for hover/pressed states
        q_bg_color = QColor(bg_color_hex)
        hover_bg_color_hex = q_bg_color.lighter(120).name()
        pressed_bg_color_hex = q_bg_color.darker(120).name()
        
        self.main_chord_button.setStyleSheet(f"""
            QPushButton {{
                background-color: {bg_color_hex};
                color: {text_color_hex};
                border-radius: 3px;
                padding: 5px;
                border: none;
                font-weight: bold;
            }}
            QPushButton:hover {{ 
                background-color: {hover_bg_color_hex}; 
            }}
            QPushButton:pressed {{ 
                background-color: {pressed_bg_color_hex}; 
            }}
        """)

class MusicGeneratorApp(QMainWindow):
    # Define signals at class level
    audio_chunk_for_spectrum = pyqtSignal(np.ndarray, int)

    def __init__(self):
        super().__init__()

        # Initialize audio
        self.sample_rate = 44100
        self.p = pyaudio.PyAudio()
        # self.stream = None # Stream will be managed by the playback thread
        self.audio_playback_thread = None 
        self.abort_audio_flag = False
        self.audio_processing_lock = threading.Lock() # For potential future use if needed for shared audio resources
        # self.audio_chunk_for_spectrum = pyqtSignal(np.ndarray, int) # Moved to class level

        # Initialize preset manager
        self.preset_manager = PresetManager()

        # Data structure for per-degree voicing settings
        # Moved earlier to be available when ChordOctaveButtonSet is initialized
        self.chord_degree_voicings = []
        for _ in range(7): # For each chord degree I to vii
            self.chord_degree_voicings.append({
                '1': True, '3': True, '5': True, # Root, Third, Fifth default ON
                '7': False, '9': False, '11': False, '13': False # Extensions default OFF
            })

        # Set up the UI
        self.setWindowTitle("Modern Music Generator")
        self.setGeometry(100, 100, 1000, 700)
        self.setStyleSheet(APP_STYLE)

        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(10)
        main_layout.setContentsMargins(15, 15, 15, 15)

        # Top row for Spectrum and Waveform Visualizers
        top_visualizers_layout = QHBoxLayout()
        
        # Add spectrum analyzer
        self.spectrum_analyzer = SpectrumAnalyzer()
        self.audio_chunk_for_spectrum.connect(self.spectrum_analyzer.update_spectrum) # Connect signal
        spectrum_card = MaterialCard()
        spectrum_layout = QVBoxLayout(spectrum_card)
        spectrum_layout.addWidget(self.spectrum_analyzer)
        top_visualizers_layout.addWidget(spectrum_card, 2) # Spectrum takes more space

        # Add Waveform Visualizer
        self.waveform_visualizer = WaveformVisualizer()
        waveform_card = MaterialCard()
        waveform_layout = QVBoxLayout(waveform_card)
        waveform_layout.addWidget(self.waveform_visualizer)
        top_visualizers_layout.addWidget(waveform_card, 1) # Waveform takes less space
        
        main_layout.addLayout(top_visualizers_layout)

        # Create controls
        controls_layout = QHBoxLayout()
        main_layout.addLayout(controls_layout)

        # Left panel - Root note and mode selection
        left_panel = MaterialCard()
        left_layout = QVBoxLayout(left_panel)

        # Circle of fifths selection
        tonality_group = QGroupBox("Tonality")
        tonality_layout = QVBoxLayout(tonality_group)

        self.circle_widget = CircleOfFifthsWidget(NOTES, MODES)
        tonality_layout.addWidget(self.circle_widget, alignment=Qt.AlignCenter)

        selection_row = QHBoxLayout()
        self.root_selection_label = QLabel()
        self.mode_selection_label = QLabel()
        root_display = self.circle_widget.get_root_name() or (NOTES[0] if NOTES else "")
        mode_display = self.circle_widget.get_mode_name() or (MODES[0] if MODES else "")
        self.root_selection_label.setText(f"Root: {root_display}")
        self.mode_selection_label.setText(f"Mode: {mode_display}")
        selection_row.addWidget(self.root_selection_label)
        selection_row.addStretch()
        selection_row.addWidget(self.mode_selection_label)
        tonality_layout.addLayout(selection_row)

        # Octave selection
        octave_layout = QHBoxLayout()
        octave_label = QLabel("Octave:")
        octave_layout.addWidget(octave_label)

        self.octave_spin = QSpinBox()
        self.octave_spin.setRange(1, 8)
        self.octave_spin.setValue(DEFAULT_OCTAVE)
        self.octave_spin.setStyleSheet("""
            QSpinBox {
                background-color: """ + MATERIAL_COLORS['surface'] + """;
                color: """ + MATERIAL_COLORS['text_primary'] + """;
                border: 1px solid """ + MATERIAL_COLORS['primary'] + """;
                border-radius: 4px;
                padding: 4px;
            }
            QSpinBox::up-button, QSpinBox::down-button {
                background-color: """ + MATERIAL_COLORS['primary'] + """;
                width: 16px;
                border-radius: 2px;
            }
            QSpinBox::up-button:hover, QSpinBox::down-button:hover {
                background-color: """ + MATERIAL_COLORS['primary_light'] + """;
            }
        """)
        octave_layout.addWidget(self.octave_spin)
        tonality_layout.addLayout(octave_layout)

        left_layout.addWidget(tonality_group)

        controls_layout.addWidget(left_panel, 1)

        # Create chord buttons
        chord_card = MaterialCard()
        chords_layout = QVBoxLayout(chord_card)

        chord_title = QLabel("Chord Progression")
        chord_title.setFont(QFont(FONT_FAMILY, FONT_SIZES['large'], QFont.Bold))
        chord_title.setAlignment(Qt.AlignCenter)
        chord_title.setStyleSheet("color: " + MATERIAL_COLORS['text_primary'] + ";")
        chords_layout.addWidget(chord_title)

        chord_buttons_layout = QGridLayout()
        chord_buttons_layout.setSpacing(10)

        # Create 7 chord button sets
        self.chord_buttons = [] # Will now store ChordOctaveButtonSet instances
        for i in range(7):
            # Create the ChordOctaveButtonSet, passing 'self' as app_ref
            button_set = ChordOctaveButtonSet(chord_idx=i, app_ref=self)
            # button_set.main_chord_button.setMinimumHeight(50) # Already set in ChordOctaveButtonSet
            chord_buttons_layout.addWidget(button_set, 0, i)
            self.chord_buttons.append(button_set)

        chords_layout.addLayout(chord_buttons_layout)
        main_layout.addWidget(chord_card) # This was missing, added it back

        # Voice controls with presets
        voice_card = MaterialCard()
        voice_layout = QVBoxLayout(voice_card)

        voice_header = QHBoxLayout()
        voice_title = QLabel("Voice Controls")
        voice_title.setFont(QFont(FONT_FAMILY, FONT_SIZES['large'], QFont.Bold))
        voice_title.setStyleSheet("color: " + MATERIAL_COLORS['text_primary'] + ";")
        voice_header.addWidget(voice_title)

        # Add preset management buttons
        preset_layout = QHBoxLayout()
        preset_layout.setSpacing(10)

        preset_label = QLabel("Preset:")
        preset_label.setStyleSheet("color: " + MATERIAL_COLORS['text_primary'] + ";")
        preset_layout.addWidget(preset_label)

        self.preset_combo = QComboBox()
        self.preset_combo.addItems(self.preset_manager.get_preset_names())
        self.preset_combo.setStyleSheet("""
            QComboBox {
                background-color: """ + MATERIAL_COLORS['surface'] + """;
                color: """ + MATERIAL_COLORS['text_primary'] + """;
                border: 1px solid """ + MATERIAL_COLORS['primary'] + """;
                border-radius: 4px;
                padding: 4px;
                min-width: 100px;
            }
            QComboBox::drop-down {
                border: none;
                width: 20px;
            }
            QComboBox::down-arrow {
                image: url(image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSIjRkZGRkZGIiBkPSJNNyAxMGw1IDUgNS01eiIvPjwvc3ZnPg==);
            }
            QComboBox QAbstractItemView {
                background-color: """ + MATERIAL_COLORS['surface'] + """;
                color: """ + MATERIAL_COLORS['text_primary'] + """;
                selection-background-color: """ + MATERIAL_COLORS['primary'] + """;
                selection-color: """ + MATERIAL_COLORS['text_primary'] + """;
                border: 1px solid """ + MATERIAL_COLORS['primary'] + """;
            }
        """)
        self.preset_combo.currentIndexChanged.connect(self.load_preset)
        preset_layout.addWidget(self.preset_combo)

        save_preset_btn = QPushButton("Save")
        save_preset_btn.clicked.connect(self.save_preset_dialog)
        preset_layout.addWidget(save_preset_btn)

        new_preset_btn = QPushButton("New")
        new_preset_btn.clicked.connect(self.new_preset_dialog)
        preset_layout.addWidget(new_preset_btn)

        delete_preset_btn = QPushButton("Delete")
        delete_preset_btn.clicked.connect(self.delete_preset)
        preset_layout.addWidget(delete_preset_btn)

        voice_header.addLayout(preset_layout)
        voice_layout.addLayout(voice_header)

        # Create a TabWidget for voice controls
        self.voice_tabs = QTabWidget()
        self.voice_tabs.setStyleSheet("""
            QTabWidget::pane {
                border-top: 1px solid """ + MATERIAL_COLORS['primary_dark'] + """;
                background: """ + MATERIAL_COLORS['surface'] + """;
            }
            QTabBar::tab {
                background: """ + MATERIAL_COLORS['background'] + """; /* Corrected: Was 'surface_dark' */
                color: """ + MATERIAL_COLORS['text_secondary'] + """;
                border: 1px solid """ + MATERIAL_COLORS['primary_dark'] + """;
                border-bottom: none; 
                padding: 8px 12px;
                margin-right: 2px;
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            QTabBar::tab:selected {
                background: """ + MATERIAL_COLORS['primary'] + """;
                color: """ + MATERIAL_COLORS['text_primary'] + """; /* Corrected: Was 'text_primary_on_primary' */
                border-bottom: none; /* To merge with pane visually */
            }
            QTabBar::tab:hover:!selected { /* Apply hover only to non-selected tabs */
                background: """ + MATERIAL_COLORS['primary_light'] + """;
                color: """ + MATERIAL_COLORS['text_primary'] + """; /* Corrected: Was 'text_primary_on_primary' */
            }
            QTabBar::tab:!selected {
                 margin-top: 2px; /* Makes selected tab look like it comes forward */
            }
        """)
        voice_layout.addWidget(self.voice_tabs)

        self.voice_controls = []

        for waveform_idx, waveform in enumerate(WAVEFORMS):
            # Create a page (widget) for each tab
            voice_page_widget = QWidget()
            voice_page_layout = QVBoxLayout(voice_page_widget) # Use QVBoxLayout for the page content
            
            # Create group for this voice (can still use QGroupBox for structure within the tab page)
            voice_type_group = QGroupBox() # Title will be set by the tab
            voice_type_layout = QGridLayout(voice_type_group)
            voice_type_layout.setSpacing(10)
            
            # Add the groupbox to the page layout
            voice_page_layout.addWidget(voice_type_group)

            # Enable checkbox
            enable_cb = ModernCheckBox("Enable")
            enable_cb.setChecked(DEFAULT_PRESET[waveform_idx]['enable'])
            enable_cb.stateChanged.connect(self._update_waveform_visualization_data) # Connect signal
            voice_type_layout.addWidget(enable_cb, 0, 0, 1, 2)

            # Volume slider
            volume_label = QLabel("Volume:")
            voice_type_layout.addWidget(volume_label, 1, 0)

            volume_slider = ModernSlider(Qt.Horizontal)
            volume_slider.setRange(0, 100)
            volume_slider.setValue(DEFAULT_PRESET[waveform_idx]['volume'])
            volume_slider.valueChanged.connect(self._update_waveform_visualization_data) # Connect signal
            voice_type_layout.addWidget(volume_slider, 1, 1)

            volume_value = QLabel(f"{DEFAULT_PRESET[waveform_idx]['volume']}%")
            voice_type_layout.addWidget(volume_value, 1, 2)
            volume_slider.valueChanged.connect(lambda v, label=volume_value: label.setText(f"{v}%"))

            # Duration slider
            duration_label = QLabel("Duration:")
            voice_type_layout.addWidget(duration_label, 2, 0)

            duration_slider = ModernSlider(Qt.Horizontal)
            duration_slider.setRange(100, 5000)
            duration_slider.setValue(DEFAULT_PRESET[waveform_idx]['duration'])
            voice_type_layout.addWidget(duration_slider, 2, 1)

            duration_value = QLabel(f"{DEFAULT_PRESET[waveform_idx]['duration']} ms")
            voice_type_layout.addWidget(duration_value, 2, 2)
            duration_slider.valueChanged.connect(lambda v, label=duration_value: label.setText(f"{v} ms"))

            # Delay slider
            delay_label = QLabel("Delay:")
            voice_type_layout.addWidget(delay_label, 3, 0)

            delay_slider = ModernSlider(Qt.Horizontal)
            delay_slider.setRange(0, 1000)
            delay_slider.setValue(DEFAULT_PRESET[waveform_idx]['delay'])
            voice_type_layout.addWidget(delay_slider, 3, 1)

            delay_value = QLabel(f"{DEFAULT_PRESET[waveform_idx]['delay']} ms")
            voice_type_layout.addWidget(delay_value, 3, 2)
            delay_slider.valueChanged.connect(lambda v, label=delay_value: label.setText(f"{v} ms"))

            # Fade In slider
            fade_in_label = QLabel("Fade In:")
            voice_type_layout.addWidget(fade_in_label, 4, 0)

            fade_in_slider = ModernSlider(Qt.Horizontal)
            fade_in_slider.setRange(0, 1000)
            fade_in_slider.setValue(DEFAULT_PRESET[waveform_idx]['fade_in'])
            voice_type_layout.addWidget(fade_in_slider, 4, 1)

            fade_in_value = QLabel(f"{DEFAULT_PRESET[waveform_idx]['fade_in']} ms")
            voice_type_layout.addWidget(fade_in_value, 4, 2)
            fade_in_slider.valueChanged.connect(lambda v, label=fade_in_value: label.setText(f"{v} ms"))

            # Fade Out slider
            fade_out_label = QLabel("Fade Out:")
            voice_type_layout.addWidget(fade_out_label, 5, 0)

            fade_out_slider = ModernSlider(Qt.Horizontal)
            fade_out_slider.setRange(0, 2000)
            fade_out_slider.setValue(DEFAULT_PRESET[waveform_idx]['fade_out'])
            voice_type_layout.addWidget(fade_out_slider, 5, 1)

            fade_out_value = QLabel(f"{DEFAULT_PRESET[waveform_idx]['fade_out']} ms")
            voice_type_layout.addWidget(fade_out_value, 5, 2)
            fade_out_slider.valueChanged.connect(lambda v, label=fade_out_value: label.setText(f"{v} ms"))

            # Test button
            test_button = QPushButton("Test")
            test_button.clicked.connect(lambda checked, idx=waveform_idx: self.test_voice(idx))
            voice_type_layout.addWidget(test_button, 6, 0, 1, 3)

            # Add the page widget (containing the groupbox) to the tab widget
            self.voice_tabs.addTab(voice_page_widget, waveform)

            # Store controls for later access
            self.voice_controls.append({
                'enable': enable_cb,
                'volume': volume_slider,
                'duration': duration_slider,
                'delay': delay_slider,
                'fade_in': fade_in_slider,
                'fade_out': fade_out_slider,
                'test': test_button
            })

        # main_layout.addWidget(voice_card) # Removed from main_layout
        controls_layout.addWidget(voice_card, 2) # Added to controls_layout next to left_panel

        # Master Settings Card (for interruption fade, etc.)
        master_settings_card = MaterialCard()
        master_settings_layout = QVBoxLayout(master_settings_card)
        
        interruption_fade_group = QGroupBox("Master Audio Settings")
        interruption_fade_grid = QGridLayout(interruption_fade_group)

        # Interruption Fade Out Slider
        if_label = QLabel("Interruption Fade (ms):")
        interruption_fade_grid.addWidget(if_label, 0, 0)

        self.interruption_fade_slider = ModernSlider(Qt.Horizontal)
        self.interruption_fade_slider.setRange(0, 500) # 0 to 500 ms
        self.interruption_fade_slider.setValue(90)    # Default 90 ms
        interruption_fade_grid.addWidget(self.interruption_fade_slider, 0, 1)

        self.interruption_fade_value_label = QLabel(f"{self.interruption_fade_slider.value()} ms")
        interruption_fade_grid.addWidget(self.interruption_fade_value_label, 0, 2)
        self.interruption_fade_slider.valueChanged.connect(
            lambda v, label=self.interruption_fade_value_label: label.setText(f"{v} ms")
        )
        
        # Spectrum Analyzer Dynamic Range Slider
        sr_label = QLabel("Spectrum Range (dB):")
        interruption_fade_grid.addWidget(sr_label, 1, 0) # Add to row 1

        self.spectrum_range_slider = ModernSlider(Qt.Horizontal)
        self.spectrum_range_slider.setRange(40, 120) # e.g., 40dB to 120dB range
        self.spectrum_range_slider.setValue(65)      # Default 65dB
        interruption_fade_grid.addWidget(self.spectrum_range_slider, 1, 1)

        self.spectrum_range_value_label = QLabel(f"{self.spectrum_range_slider.value()} dB")
        interruption_fade_grid.addWidget(self.spectrum_range_value_label, 1, 2)
        
        self.spectrum_range_slider.valueChanged.connect(
            lambda v, label=self.spectrum_range_value_label: label.setText(f"{v} dB")
        )
        self.spectrum_range_slider.valueChanged.connect(
            lambda v: self.spectrum_analyzer.set_dynamic_range(v)
        )
        # Set initial dynamic range on the analyzer instance
        self.spectrum_analyzer.set_dynamic_range(self.spectrum_range_slider.value())

        # Spectrum Analyzer Min Frequency Slider
        sminf_label = QLabel("Spectrum Min Freq (Hz):")
        interruption_fade_grid.addWidget(sminf_label, 2, 0)

        self.spectrum_min_freq_slider = ModernSlider(Qt.Horizontal)
        min_min_freq = 20
        max_min_freq = 5000 # Max value for the min frequency slider
        self.spectrum_min_freq_slider.setRange(min_min_freq, max_min_freq)
        self.spectrum_min_freq_slider.setValue(100) # Default 100 Hz
        interruption_fade_grid.addWidget(self.spectrum_min_freq_slider, 2, 1)

        self.spectrum_min_freq_value_label = QLabel(f"{self.spectrum_min_freq_slider.value()} Hz")
        interruption_fade_grid.addWidget(self.spectrum_min_freq_value_label, 2, 2)
        
        self.spectrum_min_freq_slider.valueChanged.connect(
            lambda v, label=self.spectrum_min_freq_value_label: label.setText(f"{v} Hz")
        )
        self.spectrum_min_freq_slider.valueChanged.connect(self._update_spectrum_display_range)

        # Spectrum Analyzer Max Frequency Slider
        smaxf_label = QLabel("Spectrum Max Freq (Hz):")
        interruption_fade_grid.addWidget(smaxf_label, 3, 0) # Next row

        self.spectrum_max_freq_slider = ModernSlider(Qt.Horizontal)
        min_max_freq = 1000 
        max_max_freq = int(self.sample_rate / 2) # Nyquist
        # Ensure 6000 is within the slider's possible range, adjust min_max_freq if necessary
        if 6000 < min_max_freq: min_max_freq = 500 # Lower min if 6000 is too low for current min_max_freq
        self.spectrum_max_freq_slider.setRange(min_max_freq, max_max_freq) 
        self.spectrum_max_freq_slider.setValue(6000) # Default 6000 Hz
        interruption_fade_grid.addWidget(self.spectrum_max_freq_slider, 3, 1)

        self.spectrum_max_freq_value_label = QLabel(f"{self.spectrum_max_freq_slider.value()} Hz")
        interruption_fade_grid.addWidget(self.spectrum_max_freq_value_label, 3, 2)
        
        self.spectrum_max_freq_slider.valueChanged.connect(
            lambda v, label=self.spectrum_max_freq_value_label: label.setText(f"{v} Hz")
        )
        self.spectrum_max_freq_slider.valueChanged.connect(self._update_spectrum_display_range)
        
        # Initial call to set the range on the analyzer from slider defaults
        self._update_spectrum_display_range()

        master_settings_layout.addWidget(interruption_fade_group)
        # Global chord_voicing_group removed from master_settings_layout
        main_layout.addWidget(master_settings_card) # Add master settings card to main layout (already contains interruption_fade_group)

        # Data structure for per-degree voicing settings initialization moved earlier.
        
        # Shared Voicing Editor Panel and its logic are now removed.
        # The ChordOctaveButtonSet will handle its own voicing toggles.
        # self.current_editing_degree_idx = -1 # No longer needed here

        # Update chord button labels
        self.update_chord_labels()

        # Connect signals
        self.circle_widget.rootChanged.connect(self.update_chord_labels)
        self.circle_widget.modeChanged.connect(self.update_chord_labels)
        self.octave_spin.valueChanged.connect(self.update_chord_labels)

        # Load default preset
        self.load_preset(0) # Load the first preset (usually "Default")
        self._update_waveform_visualization_data() # Initial update for waveform visualizer

    def get_roman_numeral_for_chord(self, degree_index, quality_str):
        """Generates a Roman numeral string for a chord degree and quality."""
        # degree_index is 0-6
        base_numerals = ["I", "II", "III", "IV", "V", "VI", "VII"]
        numeral = base_numerals[degree_index]
        quality_lower = quality_str.lower() # Work with lowercase quality

        if quality_lower == "minor":
            numeral = numeral.lower()
        elif quality_lower == "diminished": # Check for full "diminished"
            numeral = numeral.lower() + "°"
        elif quality_lower == "augmented": # Check for full "augmented"
            numeral = numeral.upper() + "+" # Augmented is often uppercase
        # "major" uses the uppercase default from base_numerals
        
        return numeral

    def _update_spectrum_display_range(self):
        """Updates the spectrum analyzer's min and max display frequency."""
        if hasattr(self, 'spectrum_analyzer') and hasattr(self, 'spectrum_min_freq_slider') and hasattr(self, 'spectrum_max_freq_slider'):
            min_freq = self.spectrum_min_freq_slider.value()
            max_freq = self.spectrum_max_freq_slider.value()
            
            # Optional: Add logic to ensure min_freq < max_freq if sliders allow them to cross
            # For now, SpectrumAnalyzer's set_display_frequency_range handles basic validation
            self.spectrum_analyzer.set_display_frequency_range(min_freq, max_freq)

    # This method is now called by ChordOctaveButtonSet's internal toggles
    def _update_per_degree_voicing(self, degree_index, tone_key, state):
        """Updates the stored voicing for a specific degree and tone."""
        if 0 <= degree_index < len(self.chord_degree_voicings):
            if tone_key in self.chord_degree_voicings[degree_index]:
                self.chord_degree_voicings[degree_index][tone_key] = bool(state)
                # print(f"App: Updated voicing for Chord {degree_index+1}, {tone_key}: {bool(state)}") # For debugging
            else:
                print(f"Warning: Invalid tone_key '{tone_key}' for voicing update.")
        else:
            print(f"Warning: Invalid degree_index '{degree_index}' for voicing update.")

    def _update_waveform_visualization_data(self):
        """Generates and updates the waveform visualization based on current voice settings."""
        if not hasattr(self, 'waveform_visualizer'): # Ensure visualizer exists
            return

        base_freq = 220  # A3, a bit lower for better visualization of a few cycles
        num_cycles = 2  # Reduced from 4 to show fewer cycles, e.g., "one full cycle view"
        viz_duration_s = num_cycles / base_freq
        
        combined_viz_waveform = np.zeros(int(viz_duration_s * self.sample_rate))

        any_voice_enabled = False
        for i, voice_setting_controls in enumerate(self.voice_controls):
            settings = self._get_current_voice_settings(i)
            if settings['enable']:
                any_voice_enabled = True
                waveform_type = WAVEFORMS[i]
                # Use actual volume, but ignore duration/delay/fades for cycle shape
                volume = settings['volume'] / 100.0 

                # Generate a short segment for this voice
                voice_segment = generate_waveform(
                    frequency=base_freq,
                    duration=viz_duration_s,
                    sample_rate=self.sample_rate,
                    waveform_type=waveform_type,
                    volume=volume,
                    delay=0,        # No delay for viz
                    fade_in=0,    # No fade_in for viz
                    fade_out=0    # No fade_out for viz
                )
                
                # Ensure voice_segment is same length as combined_viz_waveform for addition
                if len(voice_segment) > len(combined_viz_waveform):
                    voice_segment = voice_segment[:len(combined_viz_waveform)]
                elif len(voice_segment) < len(combined_viz_waveform):
                    voice_segment = np.pad(voice_segment, (0, len(combined_viz_waveform) - len(voice_segment)), 'constant')
                
                combined_viz_waveform += voice_segment
        
        if not any_voice_enabled:
            # If no voices enabled, show flat line
            self.waveform_visualizer.update_waveform(np.zeros(int(viz_duration_s * self.sample_rate)))
            return

        # Normalize the combined waveform for visualization
        # (update_waveform in visualizer also normalizes, but good to do it here too)
        max_abs = np.max(np.abs(combined_viz_waveform))
        if max_abs > 0:
            final_viz_waveform = combined_viz_waveform / max_abs
        else:
            final_viz_waveform = combined_viz_waveform # Should be all zeros

        self.waveform_visualizer.update_waveform(final_viz_waveform)


    def _get_current_voice_settings(self, waveform_index):
        controls = self.voice_controls[waveform_index]
        return {
            'enable': controls['enable'].isChecked(),
            'volume': controls['volume'].value(),
            'duration': controls['duration'].value(),
            'delay': controls['delay'].value(),
            'fade_in': controls['fade_in'].value(),
            'fade_out': controls['fade_out'].value()
        }

    def _apply_preset(self, preset_data):
        for i, voice_setting in enumerate(preset_data):
            if i < len(self.voice_controls):
                controls = self.voice_controls[i]
                controls['enable'].setChecked(voice_setting['enable'])
                controls['volume'].setValue(voice_setting['volume'])
                controls['duration'].setValue(voice_setting['duration'])
                controls['delay'].setValue(voice_setting['delay'])
                controls['fade_in'].setValue(voice_setting['fade_in'])
                controls['fade_out'].setValue(voice_setting['fade_out'])
        self._update_waveform_visualization_data() # Update waveform after applying preset

    def _get_current_settings_as_preset(self):
        current_settings = []
        for i in range(len(WAVEFORMS)):
            current_settings.append(self._get_current_voice_settings(i))
        return current_settings

    def load_preset(self, index=None):
        if index is None:
            preset_name = self.preset_combo.currentText()
        else:
            preset_name = self.preset_combo.itemText(index)
            if not preset_name: # If index is out of bounds or combo is empty
                if self.preset_combo.count() > 0:
                    preset_name = self.preset_combo.itemText(0) # Fallback to first
                    self.preset_combo.setCurrentIndex(0)
                else: # No presets available
                    self._apply_preset(DEFAULT_PRESET) # Apply hardcoded default
                    return


        preset_data = self.preset_manager.get_preset(preset_name)

        if preset_data is not None:
            self._apply_preset(preset_data)
        elif preset_name == "Default": # preset_data is None, and preset_name is "Default"
            # This handles the case where "Default" is selected but not yet saved in presets.json
            self._apply_preset(DEFAULT_PRESET)
        else: # preset_data is None, and preset_name is not "Default"
            # This might indicate an inconsistency if preset_name came from the combo.
            # For robustness, load the hardcoded default.
            print(f"Warning: Preset '{preset_name}' not found in manager and is not 'Default'. Applying hardcoded DEFAULT_PRESET.")
            self._apply_preset(DEFAULT_PRESET)


    def save_preset_dialog(self):
        preset_name = self.preset_combo.currentText()
        if not preset_name or preset_name == "Default": # Don't overwrite default directly, prompt for new name
            preset_name, ok = QInputDialog.getText(self, "Save Preset", "Enter preset name:")
            if ok and preset_name:
                current_settings = self._get_current_settings_as_preset()
                self.preset_manager.save_preset(preset_name, current_settings)
                self.preset_combo.blockSignals(True)
                self.preset_combo.addItem(preset_name)
                self.preset_combo.setCurrentText(preset_name)
                self.preset_combo.blockSignals(False)
                QMessageBox.information(self, "Preset Saved", f"Preset '{preset_name}' saved.")
            elif ok and not preset_name:
                 QMessageBox.warning(self, "Save Preset", "Preset name cannot be empty.")
        else: # Overwrite existing preset
            reply = QMessageBox.question(self, "Save Preset", f"Overwrite preset '{preset_name}'?",
                                         QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
            if reply == QMessageBox.Yes:
                current_settings = self._get_current_settings_as_preset()
                self.preset_manager.save_preset(preset_name, current_settings)
                QMessageBox.information(self, "Preset Saved", f"Preset '{preset_name}' updated.")


    def new_preset_dialog(self):
        preset_name, ok = QInputDialog.getText(self, "New Preset", "Enter new preset name:")
        if ok and preset_name:
            if preset_name in self.preset_manager.get_preset_names():
                QMessageBox.warning(self, "New Preset", f"Preset '{preset_name}' already exists.")
                return
            # Apply default settings to the UI for the new preset
            self._apply_preset(DEFAULT_PRESET)
            # Save this new preset with default values
            self.preset_manager.save_preset(preset_name, DEFAULT_PRESET)
            # Update combo box
            self.preset_combo.blockSignals(True)
            self.preset_combo.addItem(preset_name)
            self.preset_combo.setCurrentText(preset_name)
            self.preset_combo.blockSignals(False)
            QMessageBox.information(self, "Preset Created", f"Preset '{preset_name}' created with default settings.")
        elif ok and not preset_name:
            QMessageBox.warning(self, "New Preset", "Preset name cannot be empty.")


    def delete_preset(self):
        preset_name = self.preset_combo.currentText()
        if not preset_name or preset_name == "Default":
            QMessageBox.warning(self, "Delete Preset", "Cannot delete the default preset or an invalid selection.")
            return

        reply = QMessageBox.question(self, "Delete Preset", f"Are you sure you want to delete preset '{preset_name}'?",
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)
        if reply == QMessageBox.Yes:
            self.preset_manager.delete_preset(preset_name)
            current_index = self.preset_combo.currentIndex()
            self.preset_combo.removeItem(current_index)
            if self.preset_combo.count() > 0:
                 self.preset_combo.setCurrentIndex(0) # Select first item
                 self.load_preset(0)
            else: # No presets left, load hardcoded default
                 self._apply_preset(DEFAULT_PRESET)
            QMessageBox.information(self, "Preset Deleted", f"Preset '{preset_name}' deleted.")


    def update_chord_labels(self):
        root_note_index = self.circle_widget.get_root_index()
        root_note_name = NOTES[root_note_index]
        mode_index = self.circle_widget.get_mode_index()
        mode_name = MODES[mode_index]
        self.root_selection_label.setText(f"Root: {root_note_name}")
        self.mode_selection_label.setText(f"Mode: {mode_name}")
        octave = self.octave_spin.value()

        intervals = MODE_INTERVALS[mode_name]
        qualities = CHORD_QUALITIES[mode_name]

        for i in range(7):
            chord_root_index = (root_note_index + intervals[i]) % 12
            chord_root_name = NOTES[chord_root_index]
            chord_quality = qualities[i]
            
            roman_numeral = self.get_roman_numeral_for_chord(i, chord_quality)
            main_text_line = f"{chord_root_name}{chord_quality}"
            
            # self.chord_buttons is a list of ChordOctaveButtonSet instances
            self.chord_buttons[i].update_button_text_and_style(main_text_line, roman_numeral, chord_quality)

    def _play_audio_data(self, audio_data_list):
        """Plays a list of audio data arrays, mixing them and updating spectrum."""
        if not audio_data_list:
            return

        # Determine the maximum length for mixing
        max_len = 0
        for data in audio_data_list:
            if data is not None and len(data) > max_len:
                max_len = len(data)

        if max_len == 0:
            return # No valid audio data

        # Mix audio data
        mixed_audio = np.zeros(max_len, dtype=np.float32)
        for data in audio_data_list:
            if data is None:
                continue

            if len(data) == 0:
                continue

            if data.dtype != np.float32:
                data = data.astype(np.float32, copy=False)

            mix_len = min(len(data), max_len)
            mixed_audio[:mix_len] += data[:mix_len]

        # Normalize mixed audio to prevent clipping, if sum exceeds 1.0
        max_abs_val = np.max(np.abs(mixed_audio))
        if max_abs_val > 1.0:
            mixed_audio /= max_abs_val

        # Ensure final buffer stays within [-1.0, 1.0]
        mixed_audio = np.clip(mixed_audio, -1.0, 1.0)

        # Convert to 16-bit PCM
        samples_16bit = (mixed_audio * 32767).astype(np.int16)

        # Update spectrum analyzer with the mixed audio -- THIS WILL BE REMOVED
        # The spectrum will now be updated chunk by chunk via the signal from _perform_play_task
        # self.spectrum_analyzer.update_spectrum(samples_16bit.astype(np.float32) / 32767.0, self.sample_rate)

        # Stop any existing playback thread
        if self.audio_playback_thread and self.audio_playback_thread.is_alive():
            self.abort_audio_flag = True
            self.audio_playback_thread.join() # Wait for the old thread to finish

        self.abort_audio_flag = False # Reset flag for the new thread
        
        # Make a copy of the samples to ensure the thread has its own data
        samples_to_play = samples_16bit.copy()
        
        self.audio_playback_thread = threading.Thread(target=self._perform_play_task, args=(samples_to_play,))
        self.audio_playback_thread.daemon = True # Allow app to exit even if thread is running
        self.audio_playback_thread.start()

    def _perform_play_task(self, audio_buffer_int16): # Renamed for clarity
        """Plays the given audio buffer (np.int16) in a separate thread with chunking and fade-out on abort."""
        stream = None
        chunk_size_samples = 512  # Number of samples per chunk (1024 bytes for int16)

        try:
            stream = self.p.open(format=pyaudio.paInt16,
                                 channels=1,
                                 rate=self.sample_rate,
                                 output=True,
                                 frames_per_buffer=chunk_size_samples) # Align PyAudio buffer with our chunk size
            stream.start_stream()

            num_total_samples = len(audio_buffer_int16)
            current_sample_offset = 0

            while current_sample_offset < num_total_samples:
                if self.abort_audio_flag:
                    # Abort signalled, perform fade-out
                    fade_duration_ms = self.interruption_fade_slider.value()
                    # print(f"Abort signalled. Attempting {fade_duration_ms}ms fade-out.")

                    if fade_duration_ms > 0:
                        fade_duration_s = fade_duration_ms / 1000.0
                        # Number of samples for the desired fade duration
                        fade_samples_to_generate = int(fade_duration_s * self.sample_rate)
                        
                        # Samples remaining in the original buffer from the current playback position
                        remaining_samples_in_buffer = audio_buffer_int16[current_sample_offset:]
                        
                        # We will fade out over at most fade_samples_to_generate, 
                        # or fewer if less data remains in original buffer.
                        actual_fade_len_samples = min(fade_samples_to_generate, len(remaining_samples_in_buffer))

                        if actual_fade_len_samples > 0:
                            samples_to_fade_int16 = remaining_samples_in_buffer[:actual_fade_len_samples]
                            
                            # Convert to float for applying envelope
                            samples_to_fade_float = samples_to_fade_int16.astype(np.float32) / 32767.0
                            
                            # Create fade-out envelope (linear ramp from 1 to 0)
                            envelope = np.linspace(1.0, 0.0, actual_fade_len_samples, endpoint=True) # Ensure ramp to 0.0
                            
                            faded_samples_float = samples_to_fade_float * envelope
                            faded_samples_int16 = (faded_samples_float * 32767.0).astype(np.int16)
                            
                            # Write faded samples in chunks
                            fade_offset = 0
                            while fade_offset < actual_fade_len_samples:
                                chunk_end = min(fade_offset + chunk_size_samples, actual_fade_len_samples)
                                stream.write(faded_samples_int16[fade_offset:chunk_end].tobytes())
                                fade_offset = chunk_end
                    break # Exit main playback loop after handling abort (fade or immediate)

                # Normal playback of one chunk
                chunk_end_sample_offset = min(current_sample_offset + chunk_size_samples, num_total_samples)
                data_chunk_samples_int16 = audio_buffer_int16[current_sample_offset:chunk_end_sample_offset]
                stream.write(data_chunk_samples_int16.tobytes())
                
                # Emit signal for spectrum analyzer with the played chunk
                # Convert to float32 and normalize for the spectrum analyzer
                chunk_float32 = data_chunk_samples_int16.astype(np.float32) / 32767.0
                self.audio_chunk_for_spectrum.emit(chunk_float32, self.sample_rate)
                
                current_sample_offset = chunk_end_sample_offset
            
        except Exception as e:
            print(f"Error in audio playback thread: {e}")
        finally:
            if stream:
                try:
                    if stream.is_active():
                        stream.stop_stream()
                    stream.close()
                except Exception as e_close:
                    print(f"Error closing stream: {e_close}")
            # print("Playback thread finished.")

    def play_chord(self, chord_index, octave_offset=0): # Added octave_offset parameter
        root_note_idx = self.circle_widget.get_root_index()
        mode_name = MODES[self.circle_widget.get_mode_index()]
        base_octave = self.octave_spin.value()
        effective_octave = base_octave + octave_offset

        # Clamp effective_octave to a reasonable range (e.g., 0-8 for typical MIDI)
        # Assuming self.octave_spin has range 1-8, offset of -1 could make it 0, offset of +1 could make it 9.
        # MIDI notes are 0-127. Octave 0 (MIDI 12-23 for C0-B0) to Octave 8 (MIDI 108-119 for C8-B8) is common.
        # Let's say our practical range for effective_octave is 0 to 8.
        effective_octave = max(0, min(effective_octave, 8))

        mode_intervals = MODE_INTERVALS[mode_name]
        chord_qualities = CHORD_QUALITIES[mode_name]

        # Determine notes in the chord
        chord_root_offset = mode_intervals[chord_index]
        current_chord_root_note_idx = (root_note_idx + chord_root_offset) % 12
        quality = chord_qualities[chord_index]

        # Basic triad: root, third, fifth
        # This logic needs to be more robust based on 'quality' (maj, min, dim, aug, etc.)
        # For now, a simple major/minor triad structure
        third_interval = 4 if 'maj' in quality or quality == '' else 3 # Major third or minor third
        fifth_interval = 7 # Perfect fifth

        if 'dim' in quality:
            third_interval = 3 # Minor third
            fifth_interval = 6 # Diminished fifth
        elif 'aug' in quality:
            third_interval = 4 # Major third
            fifth_interval = 8 # Augmented fifth
        
        # Determine notes in the chord based on voicing toggles
        notes_to_play_tuples = [] # Stores (absolute_note_index, octave_adjustment_for_this_note)
        
        main_scale_intervals = MODE_INTERVALS[mode_name] # Intervals from the tonic of the mode

        # Diatonic degree indices relative to the main scale tonic (0-6 for the 7 notes of the scale)
        # chord_index is 0 for I, 1 for ii, etc.
        
        # Root of the current chord
        degree_idx_root_in_scale = main_scale_intervals[chord_index] 
        
        # Calculate absolute note indices for each potential chord member, diatonically
        # These are indices within the 12-note chromatic scale (0-11)
        
        # Note: main_scale_intervals are offsets from the main_scale_root (root_note_idx)
        # So, main_scale_abs_notes are the actual chromatic notes of the current scale.
        # e.g., C Ionian: root_note_idx=0. main_scale_intervals=[0,2,4,5,7,9,11]
        # main_scale_abs_notes = [0,2,4,5,7,9,11] (C,D,E,F,G,A,B)

        # Chord Root Note (absolute chromatic index)
        # current_chord_root_note_idx is already (root_note_idx + mode_intervals[chord_index]) % 12
        # This is the 1st degree of the chord itself.

        # Diatonic degrees relative to the CHORD'S ROOT, using steps in the main scale
        # Example: C Ionian. Chord ii (Dmin). chord_index = 1.
        # D is the root of ii. The 3rd of Dmin is F. F is the 3rd note of the D Dorian scale,
        # or, the (1+2)=3rd degree *from D* within the C Ionian scale.
        
        # Get the sequence of intervals for the current main scale
        # scale_semitones = MODE_INTERVALS[mode_name] # e.g. [0, 2, 4, 5, 7, 9, 11] for Ionian

        # Determine the absolute chromatic note index for each degree of the chord,
        # by stepping through the main scale starting from the chord's position in that scale.
        
        # Root (1st degree of the chord)
        current_voicing_settings = self.chord_degree_voicings[chord_index]

        if current_voicing_settings['1']:
            notes_to_play_tuples.append({'abs_note': current_chord_root_note_idx, 'oct_adj': 0, 'degree_name': "R"})

        # Third (3rd degree of the chord)
        if current_voicing_settings['3']:
            third_degree_in_scale_idx = (chord_index + 2) % 7
            abs_note_3rd = (root_note_idx + main_scale_intervals[third_degree_in_scale_idx]) % 12
            notes_to_play_tuples.append({'abs_note': abs_note_3rd, 'oct_adj': 0, 'degree_name': "3rd"})
            
        # Fifth (5th degree of the chord)
        if current_voicing_settings['5']:
            fifth_degree_in_scale_idx = (chord_index + 4) % 7
            abs_note_5th = (root_note_idx + main_scale_intervals[fifth_degree_in_scale_idx]) % 12
            notes_to_play_tuples.append({'abs_note': abs_note_5th, 'oct_adj': 0, 'degree_name': "5th"})

        # Seventh (7th degree of the chord)
        if current_voicing_settings['7']:
            seventh_degree_in_scale_idx = (chord_index + 6) % 7
            abs_note_7th = (root_note_idx + main_scale_intervals[seventh_degree_in_scale_idx]) % 12
            notes_to_play_tuples.append({'abs_note': abs_note_7th, 'oct_adj': 0, 'degree_name': "7th"})

        # Ninth (9th degree of the chord - 2nd an octave up)
        if current_voicing_settings['9']:
            ninth_degree_in_scale_idx = (chord_index + 1) % 7 # The 2nd degree of the scale
            abs_note_9th = (root_note_idx + main_scale_intervals[ninth_degree_in_scale_idx]) % 12
            notes_to_play_tuples.append({'abs_note': abs_note_9th, 'oct_adj': 1, 'degree_name': "9th"})
            
        # Eleventh (11th degree of the chord - 4th an octave up)
        if current_voicing_settings['11']:
            eleventh_degree_in_scale_idx = (chord_index + 3) % 7 # The 4th degree of the scale
            abs_note_11th = (root_note_idx + main_scale_intervals[eleventh_degree_in_scale_idx]) % 12
            notes_to_play_tuples.append({'abs_note': abs_note_11th, 'oct_adj': 1, 'degree_name': "11th"})

        # Thirteenth (13th degree of the chord - 6th an octave up)
        if current_voicing_settings['13']:
            thirteenth_degree_in_scale_idx = (chord_index + 5) % 7 # The 6th degree of the scale
            abs_note_13th = (root_note_idx + main_scale_intervals[thirteenth_degree_in_scale_idx]) % 12
            notes_to_play_tuples.append({'abs_note': abs_note_13th, 'oct_adj': 1, 'degree_name': "13th"})

        frequencies = []
        if not notes_to_play_tuples: # If no toggles selected for this specific chord degree, play nothing.
            self._play_audio_data([]) # Play silence
            return

        # Ensure no duplicate chromatic notes at the same effective octave (e.g. aug4 and dim5)
        # This simple diatonic stacking should avoid it, but good to be aware.
        # More advanced voicing might drop/alter notes (e.g. omit root or 5th in dense jazz chords, omit 3rd for 11th chords if it clashes).
        # For now, we play all selected diatonic notes.

        # print(f"Chord {chord_index+1} ({NOTES[current_chord_root_note_idx]}{quality}):")
        for note_info in notes_to_play_tuples:
            abs_note = note_info['abs_note']
            oct_adj = note_info['oct_adj']
            # The +1 is to align with MIDI standard where C4=60, and our effective_octave=4 means C4's octave.
            midi_note = 12 * (effective_octave + oct_adj + 1) + abs_note
            
            # Prevent notes from going too high (e.g. above MIDI 127)
            if midi_note > 127: 
                midi_note -= 12 # Drop an octave if too high
            if midi_note < 0: # Should not happen with current octave clamping
                midi_note +=12

            frequencies.append(get_frequency(midi_note))
            # print(f"  Playing {note_info['degree_name']}: {NOTES[abs_note]} (MIDI {midi_note})")
        
        # Remove duplicate frequencies if any (e.g. if a 9th is same as a 2nd due to octave wrap)
        frequencies = sorted(list(set(frequencies)))

        all_audio_data = []

        for i, voice_setting_controls in enumerate(self.voice_controls):
            settings = self._get_current_voice_settings(i)
            if settings['enable']:
                waveform_type = WAVEFORMS[i]
                duration_s = settings['duration'] / 1000.0
                volume = settings['volume'] / 100.0
                delay_s = settings['delay'] / 1000.0
                fade_in_s = settings['fade_in'] / 1000.0
                fade_out_s = settings['fade_out'] / 1000.0

                voice_audio_data = np.zeros(int(self.sample_rate * (duration_s + delay_s)), dtype=np.float32)
                
                for freq in frequencies:
                    note_audio = generate_waveform(
                        frequency=freq,
                        duration=duration_s,
                        sample_rate=self.sample_rate,
                        waveform_type=waveform_type,
                        volume=volume,
                        fade_in=fade_in_s,
                        fade_out=fade_out_s
                    )
                    # Apply delay by padding at the beginning
                    start_sample = int(delay_s * self.sample_rate)
                    end_sample = start_sample + len(note_audio)
                    
                    if end_sample <= len(voice_audio_data):
                         voice_audio_data[start_sample:end_sample] += note_audio
                    else: # If note_audio is too long due to rounding or small duration_s
                         can_fit = len(voice_audio_data) - start_sample
                         if can_fit > 0:
                            voice_audio_data[start_sample:] += note_audio[:can_fit]


                all_audio_data.append(voice_audio_data)
        
        self._play_audio_data(all_audio_data)


    def test_voice(self, waveform_index):
        settings = self._get_current_voice_settings(waveform_index)
        if not settings['enable']:
            QMessageBox.information(self, "Voice Disabled", "This voice is not enabled.")
            return

        waveform_type = WAVEFORMS[waveform_index]
        duration_s = settings['duration'] / 1000.0
        volume = settings['volume'] / 100.0
        delay_s = settings['delay'] / 1000.0
        fade_in_s = settings['fade_in'] / 1000.0
        fade_out_s = settings['fade_out'] / 1000.0
        
        # Use a standard test frequency (e.g., A4)
        a_note_idx = NOTES.index("A")
        # Standard octave for A440 is 4 in a 0-indexed system where C0 is octave 0,
        # but our formula uses octave+1, so octave 4 is correct for A4.
        midi_A4 = 12 * (4 + 1) + a_note_idx 
        test_freq = get_frequency(midi_A4)

        audio_data = generate_waveform(
            frequency=test_freq,
            duration=duration_s,
            sample_rate=self.sample_rate,
            waveform_type=waveform_type,
            volume=volume,
            fade_in=fade_in_s,
            fade_out=fade_out_s
        )
        
        # Apply delay
        if delay_s > 0:
            delay_samples = int(delay_s * self.sample_rate)
            delayed_audio_data = np.zeros(len(audio_data) + delay_samples)
            delayed_audio_data[delay_samples:] = audio_data
            audio_data = delayed_audio_data
            
        self._play_audio_data([audio_data])

    def closeEvent(self, event):
        # Clean up PyAudio
        if self.audio_playback_thread and self.audio_playback_thread.is_alive():
            self.abort_audio_flag = True
            self.audio_playback_thread.join(timeout=1.0) # Wait for max 1 sec
        
        self.p.terminate()
        super().closeEvent(event)


if __name__ == '__main__':
    app = QApplication(sys.argv)
    
    # Load custom font if available (optional)
    # font_id = QFontDatabase.addApplicationFont("path/to/your/font.ttf")
    # if font_id != -1:
    #     font_family = QFontDatabase.applicationFontFamilies(font_id)[0]
    #     app.setFont(QFont(font_family))
    # else:
    #     app.setFont(QFont(FONT_FAMILY)) # Fallback to defined family

    window = MusicGeneratorApp()
    window.show()
    sys.exit(app.exec_())
