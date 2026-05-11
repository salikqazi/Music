from PyQt5.QtWidgets import QFrame, QSizePolicy
from PyQt5.QtCore import Qt, pyqtSignal, QRectF
from PyQt5.QtGui import (
    QPainter, QColor, QPen, QFont, QFontMetricsF, QBrush, QLinearGradient
)

from .theme import MATERIAL_COLORS, FONT_FAMILY

# (normal_bg, pressed_bg, text_color)
QUALITY_COLORS = {
    'major':      ('#2E7D32', '#1B5E20', '#FFFFFF'),
    'minor':      ('#1565C0', '#0D47A1', '#FFFFFF'),
    'diminished': ('#6A1B9A', '#4A148C', '#FFFFFF'),
    'augmented':  ('#BF360C', '#7F2F11', '#FFFFFF'),
    'dominant':   ('#E65100', '#9E3900', '#FFFFFF'),
    'default':    ('#37474F', '#263238', '#ECEFF1'),
}

KEYBOARD_SHORTCUTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=']


class InstrumentKeyWidget(QFrame):
    """A single playable pad in the 12-key instrument surface."""

    keyPressed   = pyqtSignal(int)   # emits key_index
    keyReleased  = pyqtSignal(int)
    rightClicked = pyqtSignal(int)   # for per-key flavour menu (future)

    def __init__(self, key_index: int, is_extension: bool = False, parent=None):
        super().__init__(parent)
        self.key_index    = key_index
        self.is_extension = is_extension   # True for keys 8-12 (extension chords)
        self._pressed     = False
        self._hovered     = False
        self._active      = True

        self.roman_numeral  = ''
        self.chord_name     = ''
        self.quality        = 'default'
        self.shortcut       = (KEYBOARD_SHORTCUTS[key_index]
                               if key_index < len(KEYBOARD_SHORTCUTS) else '')
        self.custom_flavour = False   # dot indicator for per-key override

        self.setMinimumSize(55, 100)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        self.setFocusPolicy(Qt.NoFocus)
        self.setCursor(Qt.PointingHandCursor)
        self.setMouseTracking(True)

    # ── public API ────────────────────────────────────────────────────

    def set_chord_info(self, roman_numeral: str, chord_name: str,
                       quality: str, active: bool = True):
        self.roman_numeral = roman_numeral
        self.chord_name    = chord_name
        self.quality       = quality.lower() if quality else 'default'
        self._active       = active
        self.update()

    def set_pressed(self, pressed: bool):
        if self._pressed != pressed:
            self._pressed = pressed
            self.update()

    # ── events ────────────────────────────────────────────────────────

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton and self._active:
            self._pressed = True
            self.update()
            self.keyPressed.emit(self.key_index)
        elif event.button() == Qt.RightButton:
            self.rightClicked.emit(self.key_index)
        else:
            super().mousePressEvent(event)
        event.accept()

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton:
            self._pressed = False
            self.update()
            self.keyReleased.emit(self.key_index)
        else:
            super().mouseReleaseEvent(event)
        event.accept()

    def enterEvent(self, event):
        self._hovered = True
        self.update()
        super().enterEvent(event)

    def leaveEvent(self, event):
        self._hovered = False
        self.update()
        super().leaveEvent(event)

    # ── paint ─────────────────────────────────────────────────────────

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        w, h  = self.width(), self.height()
        rect  = QRectF(3, 3, w - 6, h - 6)
        r     = 10  # corner radius

        # Inactive slot
        if not self._active:
            painter.setPen(Qt.NoPen)
            painter.setBrush(QColor('#1C1C1C'))
            painter.drawRoundedRect(rect, r, r)
            painter.end()
            return

        bg_hex, pressed_hex, text_hex = QUALITY_COLORS.get(
            self.quality, QUALITY_COLORS['default']
        )
        base = QColor(pressed_hex if self._pressed else bg_hex)

        # Extension keys are slightly more muted (lower contrast gradient top)
        top_brightness = 115 if self.is_extension else 140

        # Gradient fill
        grad = QLinearGradient(0, 0, 0, h)
        grad.setColorAt(0.0, base.lighter(top_brightness))
        grad.setColorAt(0.6, base)
        grad.setColorAt(1.0, base.darker(140))

        # Border: white glow on press, accent on hover, subtle default
        if self._pressed:
            border_col = QColor('#FFFFFF')
            border_w   = 2.5
        elif self._hovered:
            border_col = base.lighter(220)
            border_w   = 1.5
        else:
            border_col = base.lighter(150 if self.is_extension else 180)
            border_w   = 1.0

        painter.setPen(QPen(border_col, border_w))
        painter.setBrush(QBrush(grad))
        painter.drawRoundedRect(rect, r, r)

        tc = QColor(text_hex)

        # Roman numeral (top, small)
        f_roman = QFont(FONT_FAMILY, 8, QFont.Bold)
        painter.setFont(f_roman)
        painter.setPen(tc.lighter(160))
        painter.drawText(QRectF(0, 8, w, 16), Qt.AlignHCenter, self.roman_numeral)

        # Chord name (centre, auto-shrink font to fit)
        f_chord = QFont(FONT_FAMILY, 13, QFont.Bold)
        fm = QFontMetricsF(f_chord)
        while fm.horizontalAdvance(self.chord_name) > w - 10 and f_chord.pointSize() > 7:
            f_chord.setPointSize(f_chord.pointSize() - 1)
            fm = QFontMetricsF(f_chord)
        painter.setFont(f_chord)
        painter.setPen(tc)
        painter.drawText(QRectF(0, 0, w, h - 20), Qt.AlignCenter, self.chord_name)

        # Keyboard shortcut badge (bottom) — visible pill behind the key number
        f_short = QFont(FONT_FAMILY, 7)
        painter.setFont(f_short)
        badge_rect = QRectF(w / 2 - 11, h - 19, 22, 14)
        badge_alpha = 90 if self._pressed else 55
        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(0, 0, 0, badge_alpha))
        painter.drawRoundedRect(badge_rect, 4, 4)
        shortcut_color = tc.lighter(160) if self._pressed else tc.lighter(135)
        painter.setPen(shortcut_color)
        painter.drawText(QRectF(0, h - 19, w, 14),
                         Qt.AlignHCenter, self.shortcut)

        # Custom-flavour dot (top-right corner)
        if self.custom_flavour:
            painter.setPen(Qt.NoPen)
            painter.setBrush(QColor(MATERIAL_COLORS.get('accent', '#FF4081')))
            painter.drawEllipse(QRectF(w - 14, 5, 7, 7))

        painter.end()
