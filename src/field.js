// Hero "embedding field": a grid of colourful dots that the cursor pushes around.
// Clicking sends a ripple through the field. Pauses when off-screen.

const PALETTE = ['#3355ff', '#ff4d9d', '#ffc93c', '#1fc979', '#8a5cf6', '#ff6a2b'];

export function initField(canvas, { reduce = false } = {}) {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  let w = 0, h = 0, dpr = 1;
  let dots = [];
  let ripples = [];
  let running = false;
  let raf = 0;
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  const R = 160;

  function build() {
    const gap = w < 700 ? 26 : 32;
    dots = [];
    const cols = Math.ceil(w / gap) + 1;
    const rows = Math.ceil(h / gap) + 1;
    const ox = (w - (cols - 1) * gap) / 2;
    const oy = (h - (rows - 1) * gap) / 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const bx = ox + i * gap;
        const by = oy + j * gap;
        // diagonal colour bands, so the palette reads as a gradient rather than noise
        const band = Math.floor((i * 0.6 + j * 0.9 + Math.sin(i * 0.3) * 2) / 5);
        dots.push({ bx, by, x: bx, y: by, vx: 0, vy: 0, s: 0, c: PALETTE[((band % 6) + 6) % 6] });
      }
    }
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (!running) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    mouse.x += (mouse.tx - mouse.x) * 0.25;
    mouse.y += (mouse.ty - mouse.y) * 0.25;
    const dark = document.documentElement.dataset.theme === 'dark';
    const baseAlpha = dark ? 0.22 : 0.26;

    // advance ripples
    for (const r of ripples) r.r += 9;
    ripples = ripples.filter((r) => r.r < r.max);

    const active = [];
    ctx.globalAlpha = baseAlpha;
    let lastC = '';
    ctx.beginPath();
    for (const d of dots) {
      let fx = (d.bx - d.x) * 0.055;
      let fy = (d.by - d.y) * 0.055;

      const dx = d.x - mouse.x;
      const dy = d.y - mouse.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < R * R) {
        const dist = Math.sqrt(dist2) || 1;
        const f = 1 - dist / R;
        fx += (dx / dist) * f * 5.5;
        fy += (dy / dist) * f * 5.5;
        if (f > d.s) d.s = f;
      }

      for (const r of ripples) {
        const rx = d.bx - r.x;
        const ry = d.by - r.y;
        const rd = Math.sqrt(rx * rx + ry * ry) || 1;
        const band = Math.abs(rd - r.r);
        if (band < 40) {
          const f = (1 - band / 40) * (1 - r.r / r.max);
          fx += (rx / rd) * f * 9;
          fy += (ry / rd) * f * 9;
          if (f > d.s) { d.s = f; d.c = r.c; }
        }
      }

      d.vx = (d.vx + fx) * 0.8;
      d.vy = (d.vy + fy) * 0.8;
      d.x += d.vx;
      d.y += d.vy;
      d.s *= 0.95;

      if (d.s > 0.03) {
        active.push(d);
      } else {
        // idle shimmer: a slow travelling wave of size
        const wave = reduce ? 0 : Math.sin(t * 0.0012 - d.bx * 0.008 - d.by * 0.012);
        const rad = 1.3 + Math.max(0, wave) * 0.9;
        if (d.c !== lastC) {
          ctx.fill();
          ctx.fillStyle = d.c;
          lastC = d.c;
          ctx.beginPath();
        }
        ctx.moveTo(d.x + rad, d.y);
        ctx.arc(d.x, d.y, rad, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    for (const d of active) {
      ctx.globalAlpha = baseAlpha + d.s * (1 - baseAlpha);
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.4 + d.s * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left;
    mouse.ty = e.clientY - r.top;
    if (mouse.x < -1000) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
  });
  host.addEventListener('pointerleave', () => { mouse.tx = mouse.ty = -9999; mouse.x = mouse.y = -9999; });

  function ripple(x, y) {
    ripples.push({ x, y, r: 0, max: Math.max(w, h) * 0.9, c: PALETTE[(Math.random() * PALETTE.length) | 0] });
    if (ripples.length > 5) ripples.shift();
  }
  host.addEventListener('click', (e) => {
    if (e.target.closest('a, button, .sticker, .hero__title')) return;
    const r = canvas.getBoundingClientRect();
    ripple(e.clientX - r.left, e.clientY - r.top);
  });

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop())).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  resize();

  return { ripple: (x, y) => ripple(x ?? w / 2, y ?? h / 2) };
}
