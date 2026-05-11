// ════════════════════════════════════════════════════════
//  CIRCLE OF FIFTHS
//  Desktop: full rotating ring — indicator fixed at 12 o'clock.
//  Mobile:  two horizontal drum-roller strips (mode top, note bottom).
//  Inner ring  = root note   (drag → chord keys slide L/R)
//  Outer ring  = mode/scale  (drag → chord key colors shift)
// ════════════════════════════════════════════════════════

class CircleWidget {
  constructor(canvasEl, onChange) {
    this.el = canvasEl;
    this.c  = canvasEl.getContext('2d');
    this.onChange = onChange;
    this.rootIdx  = 0;
    this.modeIdx  = 0;
    this.noteRot  = 0;
    this.modeRot  = 0;
    this._drag    = null;
    this._dragA0  = 0;
    this._dragX0  = 0;
    this._dragR0  = 0;
    this._moved   = false;
    this._lastDir = 0;
    this.chordNoteCircleIdxs = [];

    this._ro = new ResizeObserver(() => this._onResize());
    this._ro.observe(canvasEl.parentElement);
    this._onResize();
    this._attach();
  }

  // Map chromatic pitch classes (0-11) to CIRCLE_ORDER positions and redraw
  setChordNotes(chromaticPcs) {
    this.chordNoteCircleIdxs = chromaticPcs
      .map(pc => CIRCLE_ORDER.indexOf(NOTES[((pc % 12) + 12) % 12]))
      .filter(i => i !== -1);
    this.draw();
  }

  get rootNote()    { return CIRCLE_ORDER[this.rootIdx]; }
  get rootNoteIdx() { return NOTES.indexOf(this.rootNote); }
  get modeName()    { return MODES[this.modeIdx]; }

  _isMobile() { return window.matchMedia('(max-width: 700px)').matches; }

  _onResize() {
    const dpr = window.devicePixelRatio || 1;
    if (this._isMobile()) {
      const panelW = (this.el.parentElement.clientWidth || 360) - 0;
      const cssW   = Math.min(panelW, 500);
      const cssH   = 118;
      this.el.width  = Math.round(cssW * dpr);
      this.el.height = Math.round(cssH * dpr);
      this.el.style.width  = cssW + 'px';
      this.el.style.height = cssH + 'px';
    } else {
      this.el.width  = 160;
      this.el.height = 160;
      this.el.style.width  = '';
      this.el.style.height = '';
    }
    this.draw();
  }

  // ── Draw dispatcher ──────────────────────────────────
  draw() {
    if (this._isMobile()) { this._drawMobile(); return; }
    this._drawDesktop();
  }

  // ── Desktop: full circle ─────────────────────────────
  _drawDesktop() {
    const {el, c} = this;
    const W = el.width, H = el.height;
    const cx = W/2, cy = H/2;
    const outerR = Math.min(W,H)/2 - 4;
    c.clearRect(0, 0, W, H);

    const bg = c.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    bg.addColorStop(0, '#252528');
    bg.addColorStop(1, '#1a1a1c');
    c.fillStyle = bg;
    c.beginPath(); c.arc(cx, cy, outerR, 0, Math.PI*2); c.fill();

    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, outerR - 0.5, 0, Math.PI*2); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, outerR + 0.5, 0, Math.PI*2); c.stroke();

    const mOuter = outerR, mInner = outerR * 0.72;
    const nOuter = outerR * 0.68, nInner = outerR * 0.38;

    this._ring(cx, cy, mInner, mOuter, MODES,
      this.modeRot, this.modeIdx,
      '#0a1a0a', '#1c1c1f', '#44ff88', 'rgba(200,181,154,0.38)', 9
    );
    this._ring(cx, cy, nInner, nOuter, CIRCLE_ORDER,
      this.noteRot, this.rootIdx,
      '#0a1a0a', '#1a1a1c', 'rgba(68,255,136,0.85)', 'rgba(200,181,154,0.55)', 11,
      this.chordNoteCircleIdxs
    );

    // Center cap
    const capGrad = c.createRadialGradient(cx, cy, 0, cx, cy, nInner);
    capGrad.addColorStop(0, '#0d1a0d');
    capGrad.addColorStop(1, '#0a1a0a');
    c.fillStyle = capGrad;
    c.beginPath(); c.arc(cx, cy, nInner - 1, 0, Math.PI*2); c.fill();
    c.strokeStyle = 'rgba(68,255,136,0.15)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, nInner - 1, 0, Math.PI*2); c.stroke();

    // Root note + mode name (shifted up slightly to fit relative line)
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(68,255,136,0.6)'; c.shadowBlur = 8;
    c.fillStyle = '#44ff88';
    c.font = `bold ${Math.round(W * 0.11)}px "Share Tech Mono", monospace`;
    c.fillText(this.rootNote, cx, cy - 11);
    c.shadowBlur = 4;
    c.fillStyle = 'rgba(68,255,136,0.7)';
    c.font = `bold ${Math.round(W * 0.065)}px "DM Mono", monospace`;
    c.fillText(MODES[this.modeIdx].toUpperCase(), cx, cy + 3);

    // Relative major / minor
    const rels = getRelatives(this.rootNote, MODES[this.modeIdx]);
    c.shadowBlur = 2;
    c.fillStyle = 'rgba(68,255,136,0.45)';
    c.font = `${Math.round(W * 0.050)}px "DM Mono", monospace`;
    c.fillText(`${rels.major}▲ ${rels.minor}▼`, cx, cy + 16);
    c.shadowBlur = 0;

    this._drawIndicator(cx, cy, mInner, mOuter, nInner, nOuter, outerR);
  }

  _drawIndicator(cx, cy, mInner, mOuter, nInner, nOuter, outerR) {
    const c   = this.c;
    const top = -Math.PI / 2;

    const nSegs  = CIRCLE_ORDER.length;
    const mSegs  = MODES.length;
    const spanN  = (Math.PI * 2 / nSegs)  * 0.55;
    const spanM  = (Math.PI * 2 / mSegs)  * 0.55;

    c.save();

    c.beginPath();
    c.arc(cx, cy, nOuter,     top - spanN/2, top + spanN/2);
    c.arc(cx, cy, nInner + 1, top + spanN/2, top - spanN/2, true);
    c.closePath();
    c.fillStyle = 'rgba(68,255,136,0.10)';
    c.fill();
    c.shadowColor = '#44ff88'; c.shadowBlur = 6;
    c.strokeStyle = '#44ff88'; c.lineWidth = 1.5;
    c.beginPath();
    c.arc(cx, cy, nOuter - 0.5, top - spanN/2, top + spanN/2);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, nInner + 1, top - spanN/2, top + spanN/2);
    c.stroke();
    c.shadowBlur = 0;

    c.beginPath();
    c.arc(cx, cy, mOuter,     top - spanM/2, top + spanM/2);
    c.arc(cx, cy, mInner + 1, top + spanM/2, top - spanM/2, true);
    c.closePath();
    c.fillStyle = 'rgba(68,255,136,0.07)';
    c.fill();
    c.shadowColor = 'rgba(68,255,136,0.7)'; c.shadowBlur = 4;
    c.strokeStyle = 'rgba(68,255,136,0.5)'; c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, mOuter - 0.5, top - spanM/2, top + spanM/2);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, mInner + 1, top - spanM/2, top + spanM/2);
    c.stroke();
    c.shadowBlur = 0;

    const tipY = cy - outerR + 1;
    c.shadowColor = '#44ff88'; c.shadowBlur = 10;
    c.fillStyle = '#44ff88';
    c.beginPath();
    c.moveTo(cx, tipY + 2);
    c.lineTo(cx - 5, tipY - 7);
    c.lineTo(cx + 5, tipY - 7);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;

    c.restore();
  }

  _ring(cx, cy, r0, r1, labels, rot, selIdx, selText, baseColor, selFill, baseFill, fs, chordIdxs = []) {
    const c = this.c, n = labels.length, step = (Math.PI*2)/n, base = -Math.PI/2;
    for (let i = 0; i < n; i++) {
      const mid = base + rot + i * step;
      const sa  = mid - step/2 + 0.03, ea = mid + step/2 - 0.03;
      const isSel   = i === selIdx;
      const isChord = !isSel && chordIdxs.includes(i);
      c.beginPath();
      c.arc(cx, cy, r1, sa, ea);
      c.arc(cx, cy, r0, ea, sa, true);
      c.closePath();
      c.fillStyle = isSel ? selFill : (isChord ? 'rgba(251,191,36,0.28)' : baseColor);
      c.fill();
      c.strokeStyle = isChord ? 'rgba(251,191,36,0.50)' : 'rgba(0,0,0,0.55)';
      c.lineWidth = 1.5; c.stroke();
      const tr = (r0 + r1) / 2;
      if (isSel)        { c.shadowColor = 'rgba(68,255,136,0.4)';  c.shadowBlur = 4; }
      else if (isChord) { c.shadowColor = 'rgba(251,191,36,0.7)';  c.shadowBlur = 5; }
      c.fillStyle = isSel ? selText : (isChord ? '#fbbf24' : baseFill);
      c.font = `${(isSel || isChord) ? '700 ' : ''}${fs}px "DM Mono", monospace`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(labels[i], cx + Math.cos(mid) * tr, cy + Math.sin(mid) * tr);
      c.shadowBlur = 0;
    }
  }

  // ── Mobile: two drum-roller strips ───────────────────
  _drawMobile() {
    const {el, c} = this;
    const dpr = window.devicePixelRatio || 1;
    const W = el.width / dpr, H = el.height / dpr;

    c.save();
    c.scale(dpr, dpr);
    c.clearRect(0, 0, W, H);

    // Background
    c.fillStyle = '#1a1a1c';
    c.fillRect(0, 0, W, H);

    const modeH = 48;   // mode strip height
    const noteH = H - modeH - 1;  // note strip height
    const divY  = modeH;

    // Mode strip (top)
    this._drawStrip(c, W, 0, modeH, MODES, this.modeIdx, this.modeRot, 10.5, 3);

    // Divider
    c.strokeStyle = 'rgba(68,255,136,0.22)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, divY); c.lineTo(W, divY); c.stroke();

    // Note strip (bottom)
    this._drawStrip(c, W, divY + 1, noteH, CIRCLE_ORDER, this.rootIdx, this.noteRot, 15, 5);

    // Strip labels (far left, small engraved text)
    c.fillStyle = 'rgba(68,255,136,0.3)';
    c.font = '7px "DM Mono", monospace';
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText('SCALE', 5, 3);
    c.fillText('KEY',   5, divY + 4);

    // Center selection window — dashed vertical guides
    const noteItemW = W / 5;
    const modeItemW = W / 3;
    c.strokeStyle = 'rgba(68,255,136,0.45)';
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    // note window
    c.beginPath(); c.moveTo(W/2 - noteItemW/2, divY + 1); c.lineTo(W/2 - noteItemW/2, H); c.stroke();
    c.beginPath(); c.moveTo(W/2 + noteItemW/2, divY + 1); c.lineTo(W/2 + noteItemW/2, H); c.stroke();
    // mode window
    c.beginPath(); c.moveTo(W/2 - modeItemW/2, 0); c.lineTo(W/2 - modeItemW/2, divY); c.stroke();
    c.beginPath(); c.moveTo(W/2 + modeItemW/2, 0); c.lineTo(W/2 + modeItemW/2, divY); c.stroke();
    c.setLineDash([]);

    c.restore();
  }

  // items: visible count = visN (3 for modes, 5 for notes)
  _drawStrip(c, W, stripY, stripH, labels, selIdx, rot, fontSize, visN) {
    const n      = labels.length;
    const step   = (Math.PI * 2) / n;
    const itemW  = W / visN;
    // Fractional position offset: how far we are from the snap point, in item-widths
    const frac   = -rot / step;
    const cy     = stripY + stripH * 0.56;
    const arcAmp = stripH * 0.16;  // vertical arc amplitude

    const halfVis = Math.ceil(visN / 2) + 1;
    for (let di = -halfVis - 1; di <= halfVis + 1; di++) {
      const px = W / 2 + (di - frac) * itemW;
      if (px < -itemW || px > W + itemW) continue;

      const idx  = ((selIdx + di) % n + n) % n;
      const dist = Math.abs(px - W / 2) / (W / 2);    // 0 = center, 1 = edge
      const alpha = Math.max(0, 1 - dist * 1.55);
      if (alpha < 0.03) continue;

      const scale = Math.max(0.52, 1 - dist * 0.52);
      // Cosine arc: items bow downward away from center
      const py = cy + arcAmp * (1 - Math.cos(Math.PI * Math.min(dist, 1)));
      const isCenter = Math.abs(di - frac) < 0.45;

      c.save();
      c.globalAlpha = alpha;
      if (isCenter) {
        c.shadowColor = 'rgba(68,255,136,0.9)';
        c.shadowBlur  = 7;
        c.fillStyle   = '#44ff88';
      } else {
        c.fillStyle = 'rgba(190,175,145,0.75)';
      }
      c.font = `${isCenter ? 'bold ' : ''}${Math.round(fontSize * scale)}px "DM Mono", monospace`;
      c.textAlign    = 'center';
      c.textBaseline = 'middle';
      c.fillText(labels[idx], px, py);
      c.restore();
    }
  }

  // ── Helpers ───────────────────────────────────────────
  _ang(x, y) { return Math.atan2(y - this.el.height/2, x - this.el.width/2); }
  _norm(a)   { while(a>Math.PI)a-=2*Math.PI; while(a<=-Math.PI)a+=2*Math.PI; return a; }

  _ringAt(x, y) {
    const cx = this.el.width/2, cy = this.el.height/2;
    const d  = Math.hypot(x-cx, y-cy);
    const R  = Math.min(this.el.width, this.el.height)/2 - 3;
    if (d >= R*0.36 && d <= R*0.67) return 'note';
    if (d >= R*0.71 && d <= R)      return 'mode';
    return null;
  }

  _snap(ring, dir) {
    this._lastDir = dir;
    if (ring === 'note') {
      const n = CIRCLE_ORDER.length, step = (Math.PI*2)/n;
      this.rootIdx = (((Math.round(-this.noteRot/step))%n)+n)%n;
      this.noteRot = -this.rootIdx * step;
    } else {
      const n = MODES.length, step = (Math.PI*2)/n;
      this.modeIdx = (((Math.round(-this.modeRot/step))%n)+n)%n;
      this.modeRot = -this.modeIdx * step;
    }
  }

  _fireChange() {
    const dir = this._lastDir;
    this._lastDir = 0;
    this.draw();
    this.onChange(dir);
  }

  // ── Event handlers ────────────────────────────────────
  _attach() {
    const el = this.el;

    // ── DESKTOP: angular drag ───────────────────────────
    el.addEventListener('mousedown', e => {
      if (this._isMobile()) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX-r.left, y = e.clientY-r.top;
      const ring = this._ringAt(x, y);
      if (!ring) return;
      this._drag   = ring;
      this._dragA0 = this._ang(x, y);
      this._dragR0 = ring === 'note' ? this.noteRot : this.modeRot;
      this._moved  = false;
    });

    window.addEventListener('mousemove', e => {
      if (!this._drag || this._isMobile()) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX-r.left, y = e.clientY-r.top;
      const delta = this._norm(this._ang(x,y) - this._dragA0);
      if (Math.abs(delta) > 0.008) this._moved = true;
      const newRot = this._norm(this._dragR0 + delta);
      let crossed = false;
      if (this._drag === 'note') {
        this.noteRot = newRot;
        const n = CIRCLE_ORDER.length, step = (Math.PI*2)/n;
        const t = (((Math.round(-this.noteRot/step))%n)+n)%n;
        if (t !== this.rootIdx) { this.rootIdx = t; crossed = true; }
      } else {
        this.modeRot = newRot;
        const n = MODES.length, step = (Math.PI*2)/n;
        const t = (((Math.round(-this.modeRot/step))%n)+n)%n;
        if (t !== this.modeIdx) { this.modeIdx = t; crossed = true; }
      }
      this.draw();
      if (crossed) this.onChange(0);
    });

    window.addEventListener('mouseup', e => {
      if (!this._drag || this._isMobile()) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX-r.left, y = e.clientY-r.top;
      const finalDelta = this._norm(this._ang(x,y) - this._dragA0);
      const dir = finalDelta >= 0 ? 1 : -1;
      if (!this._moved) {
        const ang = this._ang(x, y), ring = this._drag;
        const labels = ring==='note' ? CIRCLE_ORDER : MODES;
        const rot    = ring==='note' ? this.noteRot  : this.modeRot;
        const n = labels.length, step = (Math.PI*2)/n;
        const rel = this._norm(ang - (-Math.PI/2) - rot);
        const idx = (((Math.round(rel/step))%n)+n)%n;
        if (ring==='note') { this.rootIdx=idx; this.noteRot=-idx*step; }
        else               { this.modeIdx=idx; this.modeRot=-idx*step; }
        this._lastDir = dir;
      } else {
        this._snap(this._drag, dir);
      }
      this._drag = null; this._moved = false;
      this._fireChange();
    });

    el.addEventListener('wheel', e => {
      if (this._isMobile()) return;
      e.preventDefault();
      const r    = el.getBoundingClientRect();
      const ring = this._ringAt(e.clientX-r.left, e.clientY-r.top);
      const dir  = e.deltaY > 0 ? 1 : -1;
      if (ring==='note') {
        this.rootIdx = ((this.rootIdx+dir+CIRCLE_ORDER.length)%CIRCLE_ORDER.length);
        this.noteRot = -this.rootIdx * (Math.PI*2/CIRCLE_ORDER.length);
        this._lastDir = dir;
      } else if (ring==='mode') {
        this.modeIdx = ((this.modeIdx+dir+MODES.length)%MODES.length);
        this.modeRot = -this.modeIdx * (Math.PI*2/MODES.length);
        this._lastDir = dir;
      }
      this._fireChange();
    }, {passive:false});

    // ── TOUCH (both desktop canvas touch + mobile strips) ─
    el.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0], r = el.getBoundingClientRect();
      const x = t.clientX - r.left, y = t.clientY - r.top;

      if (this._isMobile()) {
        // Determine which strip: top = mode, bottom = note
        const dpr  = window.devicePixelRatio || 1;
        const cssH = this.el.height / dpr;
        const divY = 48;
        this._drag   = y < divY ? 'mode' : 'note';
        this._dragX0 = x;
        this._dragR0 = this._drag === 'note' ? this.noteRot : this.modeRot;
        this._moved  = false;
        return;
      }

      const ring = this._ringAt(x, y);
      if (!ring) return;
      this._drag = ring;
      this._dragA0 = this._ang(x, y);
      this._dragR0 = ring === 'note' ? this.noteRot : this.modeRot;
      this._moved = false;
    }, { passive: false });

    el.addEventListener('touchmove', e => {
      if (!this._drag || e.touches.length !== 1) { this._drag = null; return; }
      e.preventDefault();
      const t = e.touches[0], r = el.getBoundingClientRect();
      const x = t.clientX - r.left;

      if (this._isMobile()) {
        const dx = x - this._dragX0;
        if (Math.abs(dx) > 3) this._moved = true;
        const n    = this._drag === 'note' ? CIRCLE_ORDER.length : MODES.length;
        const cssW = this.el.width / (window.devicePixelRatio || 1);
        const visN = this._drag === 'note' ? 5 : 3;
        const itemW = cssW / visN;
        const step  = (Math.PI * 2) / n;
        // Drag right → negative delta_rot (items follow finger rightward)
        this.noteRot = this._drag === 'note'
          ? this._norm(this._dragR0 - dx / itemW * step)
          : this.noteRot;
        this.modeRot = this._drag === 'mode'
          ? this._norm(this._dragR0 - dx / itemW * step)
          : this.modeRot;

        // Live index update while dragging
        let crossed = false;
        if (this._drag === 'note') {
          const t2 = (((Math.round(-this.noteRot/step))%n)+n)%n;
          if (t2 !== this.rootIdx) { this.rootIdx = t2; crossed = true; }
        } else {
          const t2 = (((Math.round(-this.modeRot/step))%n)+n)%n;
          if (t2 !== this.modeIdx) { this.modeIdx = t2; crossed = true; }
        }
        this.draw();
        if (crossed) this.onChange(0);
        return;
      }

      // Desktop touch (angular)
      const y = t.clientY - r.top;
      const delta = this._norm(this._ang(x, y) - this._dragA0);
      if (Math.abs(delta) > 0.008) this._moved = true;
      const newRot = this._norm(this._dragR0 + delta);
      let crossed = false;
      if (this._drag === 'note') {
        this.noteRot = newRot;
        const n = CIRCLE_ORDER.length, step = (Math.PI * 2) / n;
        const t2 = (((Math.round(-this.noteRot / step)) % n) + n) % n;
        if (t2 !== this.rootIdx) { this.rootIdx = t2; crossed = true; }
      } else {
        this.modeRot = newRot;
        const n = MODES.length, step = (Math.PI * 2) / n;
        const t2 = (((Math.round(-this.modeRot / step)) % n) + n) % n;
        if (t2 !== this.modeIdx) { this.modeIdx = t2; crossed = true; }
      }
      this.draw();
      if (crossed) this.onChange(0);
    }, { passive: false });

    el.addEventListener('touchend', e => {
      if (!this._drag) return;
      e.preventDefault();

      if (this._isMobile()) {
        this._snap(this._drag, 0);
        this._drag = null; this._moved = false;
        this._fireChange();
        return;
      }

      const t = e.changedTouches[0], r = el.getBoundingClientRect();
      const x = t.clientX - r.left, y = t.clientY - r.top;
      const finalDelta = this._norm(this._ang(x, y) - this._dragA0);
      const dir = finalDelta >= 0 ? 1 : -1;
      if (!this._moved) {
        const ang = this._ang(x, y), ring = this._drag;
        const labels = ring === 'note' ? CIRCLE_ORDER : MODES;
        const rot = ring === 'note' ? this.noteRot : this.modeRot;
        const n = labels.length, step = (Math.PI * 2) / n;
        const rel = this._norm(ang - (-Math.PI / 2) - rot);
        const idx = (((Math.round(rel / step)) % n) + n) % n;
        if (ring === 'note') { this.rootIdx = idx; this.noteRot = -idx * step; }
        else { this.modeIdx = idx; this.modeRot = -idx * step; }
        this._lastDir = dir;
      } else {
        this._snap(this._drag, dir);
      }
      this._drag = null; this._moved = false;
      this._fireChange();
    }, { passive: false });
  }
}
