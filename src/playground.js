// Tech-stack physics playground: DOM pills driven by Matter.js bodies.
// Fine pointers can drag & fling; touch users tap to kick (so page scroll still works).

import Matter from 'matter-js';
import { STACK, STACK_BALLS, CAT_COLORS } from './data.js';

const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Query, Events } = Matter;

export function initPlayground(el, { reduce = false } = {}) {
  const hint = el.querySelector('.playground__hint');
  const fine = matchMedia('(pointer: fine)').matches;
  let engine, runner, items = [], walls = [], started = false, raf = 0, mc;
  let w = 0, h = 0;

  // accessible list
  const srList = el.parentElement.querySelector('.stack__list');
  if (srList) srList.innerHTML = STACK.map(([n]) => `<li>${n}</li>`).join('');

  function makeWalls() {
    const t = 200;
    walls.forEach((wb) => Composite.remove(engine.world, wb));
    walls = [
      Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, { isStatic: true }),
      Bodies.rectangle(-t / 2, h / 2 - 1000, t, h * 2 + 2000, { isStatic: true }),
      Bodies.rectangle(w + t / 2, h / 2 - 1000, t, h * 2 + 2000, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
  }

  function start() {
    if (started) return;
    started = true;
    hint.style.opacity = '0';
    w = el.clientWidth;
    h = el.clientHeight;
    const small = w < 640;

    engine = Engine.create({ gravity: { y: 1.1 } });
    makeWalls();

    const list = small ? STACK.filter((s) => s[2]) : STACK;
    const order = [...list].sort(() => Math.random() - 0.5);
    const frag = document.createDocumentFragment();
    const pillH = small ? 38 : 48;
    const font = small ? 0.88 : 1.04;

    order.forEach(([name, cat], i) => {
      const node = document.createElement('div');
      node.className = 'pill';
      node.dataset.cat = cat;
      node.style.setProperty('--c', CAT_COLORS[cat]);
      node.style.height = `${pillH}px`;
      node.style.fontSize = `${font}rem`;
      if (small) node.style.padding = '0 14px';
      node.textContent = name;
      frag.appendChild(node);
      items.push({ node, cat, name, i });
    });
    STACK_BALLS.forEach((color, i) => {
      const node = document.createElement('div');
      node.className = 'pill pill--ball';
      const d = (small ? 40 : 54) + (i % 2) * 14;
      node.style.width = node.style.height = `${d}px`;
      node.style.setProperty('--c', color);
      frag.appendChild(node);
      items.push({ node, cat: 'ball', ball: d, i: order.length + i });
    });
    el.appendChild(frag);

    // measure once in the DOM, then create bodies
    items.forEach((it) => {
      const bw = it.ball || it.node.offsetWidth;
      const bh = it.ball || it.node.offsetHeight;
      it.w = bw;
      it.h = bh;
      const x = 40 + Math.random() * (w - 80);
      const y = -60 - it.i * (small ? 28 : 22) - Math.random() * 40;
      it.body = it.ball
        ? Bodies.circle(x, y, bw / 2, { restitution: 0.6, friction: 0.1, density: 0.002 })
        : Bodies.rectangle(x, y, bw, bh, {
            chamfer: { radius: bh / 2 - 1 },
            restitution: 0.35,
            friction: 0.3,
            frictionAir: 0.012,
            angle: (Math.random() - 0.5) * 0.6,
          });
      it.node.style.transform = `translate(${x - bw / 2}px, ${y - bh / 2}px)`;
    });
    Composite.add(engine.world, items.map((it) => it.body));

    if (fine) {
      const mouse = Mouse.create(el);
      // let the page scroll normally over the playground
      el.removeEventListener('wheel', mouse.mousewheel);
      el.removeEventListener('mousewheel', mouse.mousewheel);
      el.removeEventListener('DOMMouseScroll', mouse.mousewheel);
      mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, damping: 0.1, render: { visible: false } } });
      Composite.add(engine.world, mc);
      Events.on(mc, 'startdrag', () => el.classList.add('is-grabbing'));
      Events.on(mc, 'enddrag', () => el.classList.remove('is-grabbing'));
    } else {
      el.addEventListener('pointerdown', (e) => {
        const r = el.getBoundingClientRect();
        const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
        const hit = Query.point(items.map((it) => it.body), pt);
        hit.forEach((b) => Body.setVelocity(b, { x: (Math.random() - 0.5) * 14, y: -16 - Math.random() * 6 }));
      });
    }

    runner = Runner.create();
    Runner.run(runner, engine);
    raf = requestAnimationFrame(render);

    new ResizeObserver(() => {
      const nw = el.clientWidth, nh = el.clientHeight;
      if (Math.abs(nw - w) < 2 && Math.abs(nh - h) < 2) return;
      w = nw; h = nh;
      makeWalls();
      items.forEach((it) => {
        const p = it.body.position;
        if (p.x > w - 20 || p.x < 20) Body.setPosition(it.body, { x: Math.min(w - 40, Math.max(40, p.x)), y: -50 });
      });
    }).observe(el);
  }

  // pause physics when off-screen
  new IntersectionObserver(
    ([en]) => {
      if (en.isIntersecting) {
        if (!started) start();
        else if (runner) { runner.enabled = true; if (!raf) raf = requestAnimationFrame(render); }
      } else if (runner) {
        runner.enabled = false;
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { threshold: 0.25 }
  ).observe(el);

  function render() {
    for (const it of items) {
      const { x, y } = it.body.position;
      it.node.style.transform = `translate(${x - it.w / 2}px, ${y - it.h / 2}px) rotate(${it.body.angle}rad)`;
    }
    raf = requestAnimationFrame(render);
  }

  function shake() {
    if (!started) return start();
    items.forEach((it) =>
      Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 22, y: -14 - Math.random() * 14 })
    );
  }

  function highlight(cat) {
    if (!started) start();
    el.classList.toggle('is-filtering', !!cat);
    items.forEach((it) => {
      const match = it.cat === cat;
      it.node.classList.toggle('is-match', match);
      if (match && !reduce) {
        Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 6, y: -13 - Math.random() * 6 });
        Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.3);
      }
    });
  }

  return { shake, highlight };
}
