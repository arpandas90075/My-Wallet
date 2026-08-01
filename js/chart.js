/* ─────────────────────────────────────────────────────────────
   chart.js — canvas drawing, no libraries
   Colours are read back from the stylesheet at draw time, so both
   charts follow the theme without knowing anything about it.
   ───────────────────────────────────────────────────────────── */

const Chart = {

  css(name, fallback = '#888') {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  },

  /** Size the canvas for the display density and hand back a clean context. */
  ctxOf(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.width;
    const h = parseInt(getComputedStyle(canvas).height, 10) || canvas.height;

    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  },

  /** Spending split by category. */
  donut(canvas, slices) {
    const { ctx, w, h } = this.ctxOf(canvas);
    const total = slices.reduce((s, x) => s + x.total, 0);
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) / 2 - 6;
    const ring = radius * 0.38;

    ctx.lineWidth = ring;

    if (total <= 0) {                       // empty state: a faint ring
      ctx.beginPath();
      ctx.arc(cx, cy, radius - ring / 2, 0, Math.PI * 2);
      ctx.strokeStyle = this.css('--line');
      ctx.stroke();
      ctx.fillStyle = this.css('--muted');
      ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('no spend', cx, cy + 4);
      return;
    }

    let start = -Math.PI / 2;
    for (const slice of slices) {
      const angle = (slice.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - ring / 2, start, start + angle);
      ctx.strokeStyle = slice.color;
      ctx.stroke();
      start += angle;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = this.css('--muted');
    ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('SPENT', cx, cy - 8);
    ctx.fillStyle = this.css('--text');
    ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(this.short(total), cx, cy + 10);
  },

  /** Daily totals as rounded bars with weekday labels. */
  week(canvas, days) {
    const { ctx, w, h } = this.ctxOf(canvas);
    const pad = { l: 8, r: 8, t: 16, b: 26 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const max = Math.max(...days.map(d => d.total), 1);
    const slot = plotW / days.length;
    const barW = Math.min(46, slot * 0.52);

    ctx.strokeStyle = this.css('--line');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + plotH + .5);
    ctx.lineTo(w - pad.r, pad.t + plotH + .5);
    ctx.stroke();

    days.forEach((day, i) => {
      const cx = pad.l + slot * i + slot / 2;
      const barH = day.total > 0 ? Math.max(4, (day.total / max) * plotH) : 2;
      const y = pad.t + plotH - barH;

      const grad = ctx.createLinearGradient(0, y, 0, pad.t + plotH);
      grad.addColorStop(0, this.css('--accent'));
      grad.addColorStop(1, this.css('--accent-2'));

      ctx.fillStyle = day.total > 0 ? grad : this.css('--line');
      this.roundRect(ctx, cx - barW / 2, y, barW, barH, Math.min(7, barW / 2));
      ctx.fill();

      ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = this.css('--muted');
      ctx.fillText(day.date.toLocaleDateString('en-US', { weekday: 'short' }), cx, h - 8);

      if (day.total > 0) {
        ctx.fillStyle = this.css('--text');
        ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
        ctx.fillText(this.short(day.total), cx, y - 5);
      }
    });
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  /** 12500 → "12.5K", keeps bar labels from colliding. */
  short(v) {
    if (v >= 1e7) return (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (v >= 1e5) return (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return Math.round(v);
  }
};
