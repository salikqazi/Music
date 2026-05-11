// ════════════════════════════════════════════════════════
//  ROTARY KNOB  —  analog SVG dial component
//  The track sweeps 270° (gap at the bottom):
//    min = 7:30 position (canvas angle ≈ 135°)
//    max = 4:30 position (canvas angle ≈ 45°, after 270° sweep)
// ════════════════════════════════════════════════════════

const KNOB_START = Math.PI * 0.75;   // 135° — 7:30 position (min)
const KNOB_SWEEP = Math.PI * 1.5;    // 270° total travel

class RotaryKnob {
  /**
   * @param {HTMLElement} container  — element that receives the knob markup
   * @param {object}      opts
   *   min, max         — value range
   *   default          — initial value
   *   step             — discrete step (0 = continuous)
   *   snapValues       — array of specific snap points (overrides step)
   *   snapLabels       — display label per snap value (optional)
   *   label            — engraved label below the knob
   *   unit             — unit suffix for display (e.g. 'ms', 'Hz')
   *   size             — SVG diameter in px
   *   arcColor         — colour of the value arc and needle
   *   trackColor       — colour of the background arc track
   *   sensitivity      — value-per-pixel when dragging (default auto)
   *   format           — function(value) → string for center display
   *   onChange         — callback(value) when value changes
   */
  constructor(container, opts = {}) {
    this.el          = container;
    this.min         = opts.min         ?? 0;
    this.max         = opts.max         ?? 1;
    this.value       = opts.default     ?? this.min;
    this.step        = opts.step        ?? 0;
    this.snapValues  = opts.snapValues  ?? null;
    this.snapLabels  = opts.snapLabels  ?? null;
    this.label       = opts.label       ?? '';
    this.unit        = opts.unit        ?? '';
    this.size        = opts.size        ?? 56;
    this.arcColor    = opts.arcColor    ?? '#22c55e';
    this.trackColor  = opts.trackColor  ?? 'rgba(0,0,0,0.12)';
    this.sensitivity = opts.sensitivity ?? (2.5 / (this.max - this.min || 1));
    this.format      = opts.format      ?? null;
    this.onChange    = opts.onChange    ?? null;

    this._dragging = false;
    this._dragY    = 0;
    this._dragV    = 0;

    this._build();
    this._attach();
    this.setValue(this.value, false);
  }

  // ── Public API ─────────────────────────────────────────

  setValue(v, fireCallback = true) {
    if (this.snapValues) {
      let closest = this.snapValues[0], minDist = Infinity;
      for (const sv of this.snapValues) {
        const d = Math.abs(sv - v);
        if (d < minDist) { minDist = d; closest = sv; }
      }
      v = closest;
    } else if (this.step > 0) {
      v = Math.round(v / this.step) * this.step;
    }
    this.value = Math.max(this.min, Math.min(this.max, v));
    this._render();
    if (fireCallback && this.onChange) this.onChange(this.value);
  }

  // ── DOM build ──────────────────────────────────────────

  _build() {
    const s  = this.size;
    const cx = s / 2, cy = s / 2;
    const R  = s * 0.40;   // outer arc radius
    const rF = R * 0.58;   // face circle radius

    const ns = 'http://www.w3.org/2000/svg';

    const wrap = document.createElement('div');
    wrap.className = 'knob-wrap';

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.setAttribute('viewBox', `0 0 ${s} ${s}`);
    svg.style.cursor  = 'ns-resize';
    svg.style.display = 'block';
    svg.style.overflow = 'visible';
    this.svg = svg;

    // Shadow/glow filter
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `
      <filter id="knob-glow-${this._uid = Math.random().toString(36).slice(2)}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    svg.appendChild(defs);

    // Track arc (full 270° range, dimmed)
    const track = document.createElementNS(ns, 'path');
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', this.trackColor);
    track.setAttribute('stroke-width', Math.max(2, s * 0.055));
    track.setAttribute('stroke-linecap', 'round');
    track.setAttribute('d', this._arc(KNOB_START, KNOB_START + KNOB_SWEEP, cx, cy, R));
    svg.appendChild(track);

    // Value arc (fills from min up to current)
    const arc = document.createElementNS(ns, 'path');
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', this.arcColor);
    arc.setAttribute('stroke-width', Math.max(2, s * 0.055));
    arc.setAttribute('stroke-linecap', 'round');
    arc.setAttribute('filter', `url(#knob-glow-${this._uid})`);
    this.arcEl = arc;
    svg.appendChild(arc);

    // Knob face circle
    const face = document.createElementNS(ns, 'circle');
    face.setAttribute('cx', cx); face.setAttribute('cy', cy);
    face.setAttribute('r', rF);
    face.setAttribute('fill', '#d8d8e2');
    face.setAttribute('stroke', 'rgba(0,0,0,0.18)');
    face.setAttribute('stroke-width', '1');
    svg.appendChild(face);

    // Needle: dot marker on the face rim that moves with value
    const needle = document.createElementNS(ns, 'circle');
    needle.setAttribute('r', Math.max(1.5, s * 0.045));
    needle.setAttribute('fill', this.arcColor);
    needle.setAttribute('filter', `url(#knob-glow-${this._uid})`);
    this.needleEl = needle;
    svg.appendChild(needle);

    // Center value text (only for non-snap knobs or when there's room)
    const valTxt = document.createElementNS(ns, 'text');
    valTxt.setAttribute('x', cx);
    valTxt.setAttribute('y', cy + 1);
    valTxt.setAttribute('text-anchor', 'middle');
    valTxt.setAttribute('dominant-baseline', 'middle');
    valTxt.setAttribute('fill', 'rgba(26,26,46,0.65)');
    valTxt.setAttribute('font-family', 'DM Mono, monospace');
    valTxt.setAttribute('font-size', Math.max(6, s * 0.15));
    valTxt.setAttribute('font-weight', '400');
    this.valTxtEl = valTxt;
    svg.appendChild(valTxt);

    // Label below
    const lbl = document.createElement('div');
    lbl.className = 'knob-label';
    lbl.textContent = this.label;

    wrap.appendChild(svg);
    wrap.appendChild(lbl);
    this.el.appendChild(wrap);

    // Store geometry for rendering
    this._cx = cx; this._cy = cy; this._R = R; this._rF = rF;
  }

  // ── SVG helpers ────────────────────────────────────────

  _arc(a1, a2, cx, cy, r) {
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const large = (a2 - a1) > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  _valueToAngle(v) {
    const t = (this.max === this.min) ? 0 : (v - this.min) / (this.max - this.min);
    return KNOB_START + Math.max(0, Math.min(1, t)) * KNOB_SWEEP;
  }

  _render() {
    const {_cx: cx, _cy: cy, _R: R, _rF: rF} = this;
    const angle = this._valueToAngle(this.value);

    // Value arc
    const t = (this.max === this.min) ? 0 : (this.value - this.min) / (this.max - this.min);
    if (t > 0.002) {
      this.arcEl.setAttribute('d', this._arc(KNOB_START, angle, cx, cy, R));
    } else {
      this.arcEl.setAttribute('d', '');
    }

    // Needle dot on face perimeter
    const nx = cx + rF * Math.cos(angle);
    const ny = cy + rF * Math.sin(angle);
    this.needleEl.setAttribute('cx', nx.toFixed(2));
    this.needleEl.setAttribute('cy', ny.toFixed(2));

    // Center label
    let display;
    if (this.format) {
      display = this.format(this.value);
    } else if (this.snapLabels && this.snapValues) {
      const idx = this.snapValues.indexOf(this.value);
      display = idx >= 0 ? (this.snapLabels[idx] ?? String(this.value)) : String(this.value);
    } else {
      const v = this.value;
      if (Math.abs(v) >= 1000)       display = Math.round(v / 100) / 10 + 'k' + this.unit;
      else if (Math.abs(v) >= 10)    display = Math.round(v) + this.unit;
      else if (this.unit === '')      display = v.toFixed(1);
      else                            display = v.toFixed(1) + this.unit;
    }
    this.valTxtEl.textContent = display;
  }

  // ── Events ─────────────────────────────────────────────

  _attach() {
    const svg = this.svg;
    const range = this.max - this.min || 1;

    svg.addEventListener('mousedown', e => {
      e.preventDefault();
      this._dragging = true;
      this._dragY    = e.clientY;
      this._dragV    = this.value;
      svg.style.cursor = 'ns-resize';

      const onMove = ev => {
        if (!this._dragging) return;
        const dy   = this._dragY - ev.clientY;   // drag up = increase
        const delta = dy / 200 * range;           // 200px drag = full range
        this.setValue(this._dragV + delta);
      };
      const onUp = () => {
        this._dragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    });

    // Touch drag support
    svg.addEventListener('touchstart', e => {
      e.preventDefault();
      this._dragging = true;
      this._dragY    = e.touches[0].clientY;
      this._dragV    = this.value;
    }, {passive: false});

    svg.addEventListener('touchmove', e => {
      if (!this._dragging) return;
      e.preventDefault();
      const dy    = this._dragY - e.touches[0].clientY;
      const delta = dy / 200 * range;
      this.setValue(this._dragV + delta);
    }, {passive: false});

    svg.addEventListener('touchend',    () => { this._dragging = false; }, {passive: false});
    svg.addEventListener('touchcancel', () => { this._dragging = false; }, {passive: false});

    // Scroll wheel for discrete stepping
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      if (this.snapValues) {
        const idx    = this.snapValues.indexOf(this.value);
        const newIdx = Math.max(0, Math.min(this.snapValues.length - 1, idx + dir));
        this.setValue(this.snapValues[newIdx]);
      } else {
        const increment = this.step > 0 ? this.step : range * 0.02;
        this.setValue(this.value + dir * increment);
      }
    }, {passive: false});
  }
}
