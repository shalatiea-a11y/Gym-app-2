// Minimal dependency-free canvas charts (line + bar), dark-theme by default.

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w: rect.width, h: rect.height };
}

export function drawLineChart(canvas, points, opts = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 40, r: 12, t: 16, b: 24 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const color = opts.color || '#4f8cff';

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px -apple-system, Roboto, Arial, sans-serif';
  ctx.lineWidth = 1;

  if (!points.length) {
    ctx.fillText('No data yet', pad.l, pad.t + plotH / 2);
    return;
  }

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;

  // gridlines
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.t + (plotH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    const val = max - (range * i) / gridLines;
    ctx.fillText(Math.round(val * 10) / 10, 2, y + 3);
  }

  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xy = (i) => {
    const x = pad.l + stepX * i;
    const y = pad.t + plotH - ((points[i].value - min) / range) * plotH;
    return [x, y];
  };

  // area fill
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = xy(i);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  const [lastX] = xy(points.length - 1);
  ctx.lineTo(lastX, pad.t + plotH);
  ctx.lineTo(pad.l, pad.t + plotH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
  grad.addColorStop(0, color + '55');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fill();

  // line
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = xy(i);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // dots
  points.forEach((p, i) => {
    const [x, y] = xy(i);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
}

export function drawBarChart(canvas, points, opts = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 40, r: 12, t: 16, b: 24 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const color = opts.color || '#4f8cff';

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px -apple-system, Roboto, Arial, sans-serif';

  if (!points.length) {
    ctx.fillText('No data yet', pad.l, pad.t + plotH / 2);
    return;
  }

  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);

  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = pad.t + (plotH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    const val = max - (max * i) / gridLines;
    ctx.fillText(Math.round(val), 2, y + 3);
  }

  const barW = (plotW / points.length) * 0.6;
  const gap = (plotW / points.length) * 0.4;
  points.forEach((p, i) => {
    const x = pad.l + i * (barW + gap) + gap / 2;
    const barH = (p.value / max) * plotH;
    const y = pad.t + plotH - barH;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(p.label, x, h - 6);
  });
}
