/**
 * chart.js – Leichtgewichtige Canvas-Charts
 * Keine externen Bibliotheken – rein mit Canvas API.
 * Unterstützt: Donut-Chart, Balken-Chart, Linien-Chart
 */

const Chart = (() => {

  // ── Donut / Kreis-Diagramm ──

  /**
   * Donut-Chart zeichnen
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label, value, color}>} data
   * @param {string} centerText – Text in der Mitte
   * @param {string} centerSub  – Untertitel Mitte
   */
  function drawDonut(canvas, data, centerText = '', centerSub = '') {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.offsetWidth || 200;

    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx    = size / 2;
    const cy    = size / 2;
    const outer = size * 0.42;
    const inner = size * 0.28;

    // Hintergrund leer
    ctx.clearRect(0, 0, size, size);

    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) {
      // Leerer Kreis wenn keine Daten
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill();
    } else {
      let startAngle = -Math.PI / 2;
      const gap = 0.03; // Lücke zwischen Segmenten

      data.forEach((segment, i) => {
        const sliceAngle = (segment.value / total) * (Math.PI * 2) - gap;
        if (sliceAngle <= 0) return;

        ctx.beginPath();
        ctx.arc(cx, cy, outer, startAngle + gap / 2, startAngle + sliceAngle + gap / 2);
        ctx.arc(cx, cy, inner, startAngle + sliceAngle + gap / 2, startAngle + gap / 2, true);
        ctx.closePath();
        ctx.fillStyle = segment.color;
        ctx.fill();

        startAngle += sliceAngle + gap;
      });
    }

    // Zentrum-Text
    if (centerText) {
      ctx.fillStyle = '#f0f2f8';
      ctx.font      = `700 ${size * 0.13}px 'DM Serif Display', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textY = centerSub ? cy - size * 0.04 : cy;
      ctx.fillText(centerText, cx, textY);

      if (centerSub) {
        ctx.fillStyle = '#8a90a8';
        ctx.font      = `400 ${size * 0.07}px 'DM Sans', sans-serif`;
        ctx.fillText(centerSub, cx, cy + size * 0.08);
      }
    }
  }

  // ── Balken-Chart ──

  /**
   * Horizontaler Balken-Chart
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label, value, color}>} data
   * @param {object} options
   */
  function drawBars(canvas, data, options = {}) {
    const {
      maxValue = Math.max(...data.map(d => d.value), 1),
      showValues = true,
      barColor = 'var(--accent-primary)',
    } = options;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || 300;
    const H   = canvas.offsetHeight || 160;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (!data.length) return;

    const paddingLeft   = 70;
    const paddingRight  = showValues ? 60 : 16;
    const paddingTop    = 8;
    const paddingBottom = 8;
    const barAreaW = W - paddingLeft - paddingRight;
    const barH     = Math.max(8, (H - paddingTop - paddingBottom) / data.length - 8);
    const rowH     = (H - paddingTop - paddingBottom) / data.length;

    data.forEach((item, i) => {
      const y    = paddingTop + i * rowH + (rowH - barH) / 2;
      const barW = Math.max(4, (item.value / maxValue) * barAreaW);

      // Label
      ctx.fillStyle = '#8a90a8';
      ctx.font = `400 11px 'DM Sans', sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, paddingLeft - 8, y + barH / 2);

      // Hintergrund-Spur
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      roundRect(ctx, paddingLeft, y, barAreaW, barH, barH / 2);
      ctx.fill();

      // Balken
      ctx.fillStyle = item.color || barColor;
      roundRect(ctx, paddingLeft, y, barW, barH, barH / 2);
      ctx.fill();

      // Wert
      if (showValues) {
        ctx.fillStyle = '#f0f2f8';
        ctx.font = `500 11px 'DM Sans', sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(
          Utils.formatCompact(item.value),
          paddingLeft + barAreaW + 8,
          y + barH / 2
        );
      }
    });
  }

  // ── Linien-Chart ──

  /**
   * Einfacher Linien-Chart (z.B. Monatsverlauf)
   * @param {HTMLCanvasElement} canvas
   * @param {Array<{label, value}>} data
   * @param {string} color
   */
  function drawLine(canvas, data, color) {
    color = '#f5a623'
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || 300;
    const H   = canvas.offsetHeight || 120;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (data.length < 2) return;

    const pTop    = 16;
    const pBottom = 24;
    const pLeft   = 8;
    const pRight  = 8;

    const values = data.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range  = maxVal - minVal || 1;

    const toX = (i) => pLeft + (i / (data.length - 1)) * (W - pLeft - pRight);
    const toY = (v) => H - pBottom - ((v - minVal) / range) * (H - pTop - pBottom);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pTop, 0, H - pBottom);
    grad.addColorStop(0, color + '40');
    grad.addColorStop(1, color + '00');

    ctx.beginPath();
    data.forEach((d, i) => {
      const x = toX(i);
      const y = toY(d.value);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = toX(i - 1);
        const py = toY(data[i - 1].value);
        const cx1 = (px + x) / 2;
        ctx.bezierCurveTo(cx1, py, cx1, y, x, y);
      }
    });

    // Fläche füllen
    ctx.lineTo(toX(data.length - 1), H - pBottom);
    ctx.lineTo(toX(0), H - pBottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Linie
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = toX(i);
      const y = toY(d.value);
      if (i === 0) ctx.moveTo(x, y);
      else {
        const px = toX(i - 1);
        const py = toY(data[i - 1].value);
        const cx1 = (px + x) / 2;
        ctx.bezierCurveTo(cx1, py, cx1, y, x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Punkte
    data.forEach((d, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(d.value), 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // X-Achsenbeschriftungen
    ctx.fillStyle = '#555b72';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    data.forEach((d, i) => {
      if (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) {
        ctx.fillText(d.label, toX(i), H);
      }
    });
  }

  // ── Hilfsfunktion: Abgerundetes Rechteck ──
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Legende für einen Chart rendern (HTML)
   * @param {Array<{label, value, color}>} data
   * @param {number} total
   */
  function renderLegend(data, total) {
    if (!data.length) return '<p class="text-muted text-sm">Keine Daten</p>';

    return data.map(item => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <div style="width:10px;height:10px;border-radius:50%;background:${item.color};flex-shrink:0"></div>
          <span style="font-size:0.82rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.label}</span>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <span style="font-size:0.85rem;font-weight:500">${Utils.formatCurrency(item.value)}</span>
          ${total ? `<span style="font-size:0.75rem;color:var(--text-muted);margin-left:4px">${Utils.percent(item.value, total)}%</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  return { drawDonut, drawBars, drawLine, renderLegend };
})();
