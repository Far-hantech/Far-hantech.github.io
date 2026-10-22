// Minimal confetti cannon. confetti(x, y, { count, spread })

const COLORS = ['#3355ff', '#ff4d9d', '#ffc93c', '#1fc979', '#8a5cf6', '#ff6a2b'];
let canvas, ctx, parts = [], running = false;

function setup() {
  canvas = document.querySelector('canvas.confetti');
  ctx = canvas.getContext('2d');
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);
}

function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.vy += 0.18;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / 40);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.c;
    if (p.shape === 0) ctx.fillRect(-p.s / 2, -1, p.s, 2); // slim ribbon
    else { ctx.beginPath(); ctx.arc(0, 0, p.s / 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 40);
  if (parts.length) requestAnimationFrame(tick);
  else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

export function confetti(x = innerWidth / 2, y = innerHeight / 2, { count = 90, spread = 1 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!canvas) setup();
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread;
    const v = 5 + Math.random() * 8;
    parts.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      s: 6 + Math.random() * 6,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      shape: Math.random() < 0.7 ? 0 : 1,
      life: 140 + Math.random() * 60,
    });
  }
  if (!running) { running = true; requestAnimationFrame(tick); }
}
