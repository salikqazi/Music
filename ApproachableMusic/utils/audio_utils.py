import numpy as np

# Constants
NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
MODES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian']
WAVEFORMS = ['Sine', 'Square', 'Sawtooth', 'Triangle']
DEFAULT_OCTAVE = 4
MODE_INTERVALS = {
    'Ionian': [0, 2, 4, 5, 7, 9, 11],      # Major scale
    'Dorian': [0, 2, 3, 5, 7, 9, 10],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10],
    'Lydian': [0, 2, 4, 6, 7, 9, 11],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'Aeolian': [0, 2, 3, 5, 7, 8, 10],     # Natural minor scale
    'Locrian': [0, 1, 3, 5, 6, 8, 10]
}

# Chord qualities based on scale degree for each mode
CHORD_QUALITIES = {
    'Ionian': ["major", "minor", "minor", "major", "major", "minor", "diminished"],
    'Dorian': ["minor", "minor", "major", "major", "minor", "diminished", "major"],
    'Phrygian': ["minor", "major", "major", "minor", "diminished", "major", "minor"],
    'Lydian': ["major", "major", "minor", "diminished", "major", "minor", "minor"],
    'Mixolydian': ["major", "minor", "diminished", "major", "minor", "minor", "major"],
    'Aeolian': ["minor", "diminished", "major", "minor", "minor", "major", "major"],
    'Locrian': ["diminished", "major", "minor", "minor", "major", "major", "minor"]
}

def get_frequency(midi_note):
    """Convert MIDI note number to frequency in Hz"""
    return 440 * (2 ** ((midi_note - 69) / 12))

def generate_waveform(frequency, duration, sample_rate, waveform_type='Sine', volume=0.5, delay=0.0, fade_in=0.02, fade_out=0.5):
    """Generate waveform samples for a given frequency with envelope controls."""
    # Calculate total samples (duration without the delay padding handled by caller)
    total_samples = int(sample_rate * duration)

    if total_samples <= 0:
        return np.zeros(0, dtype=np.float32)

    # Create output buffer using float32 to reduce allocations when mixing later
    samples = np.zeros(total_samples, dtype=np.float32)

    # Calculate delay in samples
    delay_samples = int(delay * sample_rate)
    
    # Calculate actual sound duration (accounting for delay)
    sound_duration = duration - delay
    if sound_duration <= 0:
        return samples  # Return silence if delay exceeds duration
    
    # Calculate sound samples
    sound_samples = int(sound_duration * sample_rate)
    
    # Generate base waveform for the non-delayed portion
    if delay_samples < total_samples:
        # Time array for the sound portion
        sound_t = np.linspace(0.0, sound_duration, sound_samples, endpoint=False, dtype=np.float32)

        # Generate the appropriate waveform
        if waveform_type == 'Sine':
            sound = np.sin(2 * np.pi * frequency * sound_t).astype(np.float32, copy=False)
        elif waveform_type == 'Square':
            sound = np.sign(np.sin(2 * np.pi * frequency * sound_t)).astype(np.float32, copy=False)
        elif waveform_type == 'Sawtooth':
            sound = (2 * (sound_t * frequency - np.floor(0.5 + sound_t * frequency))).astype(np.float32, copy=False)
        elif waveform_type == 'Triangle':
            sound = (2 * np.abs(2 * (sound_t * frequency - np.floor(0.5 + sound_t * frequency))) - 1).astype(np.float32, copy=False)
        else:
            sound = np.sin(2 * np.pi * frequency * sound_t).astype(np.float32, copy=False)  # Default to sine

        # Apply envelope
        envelope = np.ones_like(sound, dtype=np.float32)
        fade_in_samples = int(fade_in * sample_rate)
        fade_out_samples = int(fade_out * sample_rate)

        # Apply fade in (using half-cosine for smoother transition)
        if fade_in_samples > 0 and fade_in_samples < sound_samples:
            fade_in_curve = 0.5 * (1 - np.cos(np.linspace(0, np.pi, fade_in_samples, dtype=np.float32)))
            envelope[:fade_in_samples] = fade_in_curve.astype(np.float32, copy=False)

        # Apply fade out (using half-cosine for smoother transition)
        if fade_out_samples > 0 and fade_out_samples < sound_samples:
            fade_out_curve = 0.5 * (1 + np.cos(np.linspace(0, np.pi, fade_out_samples, dtype=np.float32)))
            envelope[sound_samples - fade_out_samples:] = fade_out_curve.astype(np.float32, copy=False)

        # Apply envelope to sound
        sound = sound * envelope

        # Insert sound into samples array after delay
        samples[delay_samples:delay_samples + sound_samples] = sound[:min(sound_samples, total_samples - delay_samples)]

    # Apply volume
    return np.float32(volume) * samples
