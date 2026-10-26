import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import './styles.css';

import { initField } from './field.js';
import { initBot } from './bot.js';
import { initRag } from './rag.js';
import { initPlayground } from './playground.js';
import { confetti } from './confetti.js';

gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, InertiaPlugin);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const PALETTE = ['#3355ff', '#ff4d9d', '#ffc93c', '#1fc979', '#8a5cf6', '#ff6a2b'];
const LIGHT_BG = ['#ffc93c', '#1fc979', '#ff6a2b'];

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);

let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  if (import.meta.env.DEV) window.__lenis = lenis;
}

function scrollToTarget(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ */
/* Text splitting helpers                                              */
/* ------------------------------------------------------------------ */
function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  [...text].forEach((ch) => {
    const s = document.createElement('span');
    s.className = 'char';
    s.textContent = ch;
    el.appendChild(s);
  });
  return [...el.children];
}

// Split into word spans, but keep inline elements (.ipill) as one unit.
function splitWords(el) {
  const out = [];
  [...el.childNodes].forEach((node) => {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
        else {
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.appendChild(s);
          out.push(s);
        }
      });
      node.replaceWith(frag);
    } else if (node.nodeType === 1) {
      node.classList.add('w');
      out.push(node);
    }
  });
  return out;
}

const heroChars = $$('.hero__title [data-letters]').flatMap(splitChars);
const giantChars = $$('.contact__giant [data-letters]').flatMap(splitChars);

/* ------------------------------------------------------------------ */
/* Preloader + hero intro                                              */
/* ------------------------------------------------------------------ */
function runLoader() {
  const loader = $('.loader');
  return new Promise((resolve) => {
    if (reduce) { loader.remove(); resolve(); return; }
    let seen = false;
    try { seen = sessionStorage.getItem('seen') === '1'; sessionStorage.setItem('seen', '1'); } catch (e) {}
    const statuses = ['initializing weights…', 'tokenizing portfolio…', 'embedding experience…', 'retrieving projects…', 'generating ✦'];
    const count = $('[data-count]', loader);
    const status = $('[data-status]', loader);
    const o = { v: 0 };
    const tl = gsap.timeline({ onComplete: () => loader.remove() });
    tl.to(o, {
      v: 100,
      duration: seen ? 0.7 : 1.9,
      ease: 'power2.inOut',
      onUpdate() {
        count.textContent = Math.round(o.v);
        status.textContent = statuses[Math.min(statuses.length - 1, Math.floor(o.v / 20.01))];
      },
    })
      .to('.loader__inner', { yPercent: -40, opacity: 0, duration: 0.45, ease: 'power3.in' })
      .to('.loader__base', { yPercent: -100, duration: 0.85, ease: 'expo.inOut' }, '-=0.15')
      .to('.loader__panels i', { yPercent: -100, duration: 0.9, ease: 'expo.inOut', stagger: 0.06 }, '-=0.55')
      .add(resolve, '-=0.75');
  });
}

function heroIntro() {
  if (reduce) return;
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from(heroChars, { yPercent: 115, rotate: 8, duration: 1.3, stagger: 0.035 })
    .from('.bot', { y: -60, scale: 0, duration: 1.2, ease: 'back.out(1.8)' }, 0.75)
    .from('.hero__top > *', { y: -20, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.3)
    .from('[data-hero-fade]', { y: 30, opacity: 0, duration: 1, stagger: 0.1 }, 0.5)
    .from('.sticker', { scale: 0, opacity: 0, duration: 0.9, stagger: 0.09, ease: 'back.out(2.2)' }, 0.75)
    .from('.nav__inner', { y: -30, opacity: 0, duration: 1 }, 0.2);
}

/* ------------------------------------------------------------------ */
/* Hero interactions                                                   */
/* ------------------------------------------------------------------ */
const field = initField($('.hero__field'), { reduce });
const bot = initBot($('.bot'), { reduce, onAsk: () => scrollToTarget('#ask') });

let colorIdx = 0;
heroChars.forEach((ch) => {
  ch.addEventListener('pointerenter', () => {
    if (reduce || gsap.isTweening(ch)) return;
    const c = PALETTE[colorIdx++ % PALETTE.length];
    gsap.timeline()
      .to(ch, { yPercent: -16, rotate: gsap.utils.random(-12, 12), scaleY: 1.12, color: c, duration: 0.2, ease: 'power2.out' })
      .to(ch, { yPercent: 0, rotate: 0, scaleY: 1, duration: 1.2, ease: 'elastic.out(1, 0.32)' });
  });
});
$('.hero__title').addEventListener('click', (e) => {
  if (e.target.closest('.bot')) return;
  heroChars.forEach((ch, i) => {
    gsap.to(ch, { color: PALETTE[(i + colorIdx) % PALETTE.length], duration: 0.4, delay: i * 0.025 });
    gsap.fromTo(ch, { yPercent: 0 }, { yPercent: -22, duration: 0.18, delay: i * 0.025, yoyo: true, repeat: 1, ease: 'power2.out' });
  });
  colorIdx += 2;
});

// draggable stickers
Draggable.create('.sticker', {
  type: 'x,y',
  bounds: '.hero',
  inertia: true,
  zIndexBoost: true,
  onPress() { gsap.to(this.target, { scale: 1.08, duration: 0.3, ease: 'back.out(3)' }); },
  onRelease() { gsap.to(this.target, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }); },
});

// parallax colour blobs
if (!reduce && finePointer) {
  const blobs = $$('.hero__blobs i').map((b, i) => ({
    x: gsap.quickTo(b, 'x', { duration: 1.6 + i * 0.5, ease: 'power3.out' }),
    y: gsap.quickTo(b, 'y', { duration: 1.6 + i * 0.5, ease: 'power3.out' }),
    f: [60, -90, 120][i],
  }));
  $('.hero').addEventListener('pointermove', (e) => {
    const nx = e.clientX / innerWidth - 0.5;
    const ny = e.clientY / innerHeight - 0.5;
    blobs.forEach((b) => { b.x(nx * b.f); b.y(ny * b.f); });
  });
}

/* ------------------------------------------------------------------ */
/* Velocity-reactive marquee bands                                     */
/* ------------------------------------------------------------------ */
const marquees = $$('[data-marquee]').map((track) => {
  const dir = Number(track.dataset.marquee);
  const unit = track.innerHTML;
  track.innerHTML = `<span>${unit}</span>`.repeat(8);
  const tw = dir > 0
    ? gsap.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 })
    : gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: 38, ease: 'none', repeat: -1 });
  return tw;
});
if (reduce) marquees.forEach((t) => t.pause());
if (lenis) {
  let ts = 1, dirSign = 1;
  gsap.ticker.add(() => {
    const v = lenis.velocity || 0;
    if (Math.abs(v) > 0.3) dirSign = Math.sign(v);
    const target = dirSign * (1 + Math.min(Math.abs(v) * 0.35, 7));
    ts += (target - ts) * 0.08;
    marquees.forEach((t) => t.timeScale(ts));
  });
}

/* ------------------------------------------------------------------ */
/* About                                                               */
/* ------------------------------------------------------------------ */
const words = splitWords($('[data-words]'));
if (!reduce) {
  gsap.fromTo(
    words,
    { opacity: 0.14 },
    {
      opacity: 1,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: { trigger: '[data-words]', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 },
    }
  );
}

// count-ups
$$('[data-count-to]').forEach((el) => {
  const to = parseFloat(el.dataset.countTo);
  const dec = Number(el.dataset.decimals || 0);
  const fmt = (n) => (el.dataset.format === 'comma' ? Math.round(n).toLocaleString('en-US') : n.toFixed(dec));
  if (reduce) { el.textContent = fmt(to); return; }
  const o = { v: 0 };
  el.textContent = fmt(0);
  ScrollTrigger.create({
    trigger: el,
    start: 'top 90%',
    once: true,
    onEnter: () => gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)) }),
  });
});

// stat hover: the colour floods in from where the cursor entered
$$('.stat').forEach((s) => {
  s.addEventListener('pointerenter', (e) => {
    const r = s.getBoundingClientRect();
    s.style.setProperty('--mx', `${e.clientX - r.left}px`);
    s.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

/* ------------------------------------------------------------------ */
/* Work — horizontal scroll on desktop                                 */
/* ------------------------------------------------------------------ */
// seed the CSS scenes with a bit of randomness
$$('.sw-bars i').forEach((b, i) => {
  b.style.setProperty('--h', (0.35 + Math.abs(Math.sin(i * 1.7)) * 0.65).toFixed(2));
  b.style.animationDelay = `${-(i * 0.09 + Math.random() * 0.4).toFixed(2)}s`;
  b.style.animationDuration = `${0.8 + Math.random() * 0.6}s`;
});
$$('.sc-dots i').forEach((d) => {
  d.style.left = `${Math.random() * 95}%`;
  d.style.top = `${Math.random() * 95}%`;
  d.style.animationDelay = `${-Math.random() * 5}s`;
  d.style.transform = `scale(${0.4 + Math.random()})`;
});
$$('.scal-grid i').forEach((c) => {
  c.style.animationDelay = `${-Math.random() * 6}s`;
  c.style.animationDuration = `${4 + Math.random() * 5}s`;
});
$$('.scl-group').forEach((g) => {
  $$('i', g).forEach((d, i, arr) => {
    const a = (i / arr.length) * Math.PI * 2;
    const rad = 34 + Math.random() * 30;
    const dx = Math.cos(a) * rad, dy = Math.sin(a) * rad;
    d.style.left = `${dx}px`;
    d.style.top = `${dy}px`;
    d.style.transformOrigin = `${-dx + 7}px ${-dy + 7}px`;
    d.style.animationDuration = `${7 + Math.random() * 6}s`;
  });
});
// RedBench grid: a scan that sweeps row by row
$$('.rb-grid i').forEach((c, i) => { c.style.animationDelay = `${(Math.floor(i / 4) * 0.55 + (i % 4) * 0.14).toFixed(2)}s`; });
// pause CSS scenes off-screen
const sceneIO = new IntersectionObserver((ents) => ents.forEach((en) => en.target.classList.toggle('is-paused', !en.isIntersecting)));
$$('.project, .paper--feature').forEach((p) => sceneIO.observe(p));

const mm = gsap.matchMedia();
mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
  const track = $('.work__track');
  const dist = () => track.scrollWidth - innerWidth;
  const tween = gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.work__pin',
      start: 'top top',
      end: () => `+=${dist()}`,
      pin: true,
      scrub: 0.8,
      invalidateOnRefresh: true,
      anticipatePin: 1,
    },
  });
  $$('.project').forEach((card) => {
    gsap.fromTo(card, { rotate: 5, yPercent: 8 }, {
      rotate: 0, yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 105%', end: 'left 45%', scrub: true },
    });
    gsap.fromTo($('.project__visual > *:not(.sc-dots)', card), { x: 80 }, {
      x: -30, ease: 'none',
      scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
    });
  });
});

/* ------------------------------------------------------------------ */
/* Generic reveals                                                     */
/* ------------------------------------------------------------------ */
if (!reduce) {
  document.fonts.ready.then(() => {
    $$('[data-split]').forEach((el) => {
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'split-line',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.2,
            ease: 'expo.out',
            stagger: 0.09,
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          }),
      });
    });
    ScrollTrigger.refresh();
  });

  const revealSel = '.stat, .commit, .edu, .certs, .paper, .research__sub, .rag__win, .rag__kb, .ask__sub, .work__sub, .stack__sub, .stack__filters, .playground, .contact__sub, .contact__actions, .contact__links, .holo';
  gsap.set(revealSel, { y: 50, opacity: 0 });
  ScrollTrigger.batch(revealSel, {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
  mm.add('(max-width: 900px)', () => {
    gsap.set('.project', { y: 60, opacity: 0 });
    ScrollTrigger.batch('.project', {
      start: 'top 90%',
      once: true,
      onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.1 }),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Ask my résumé                                                       */
/* ------------------------------------------------------------------ */
initRag($('.ask'), { reduce });

/* ------------------------------------------------------------------ */
/* Journey — git rail                                                  */
/* ------------------------------------------------------------------ */
if (!reduce) {
  gsap.to('.gitlog__rail i', {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: { trigger: '.gitlog', start: 'top 70%', end: 'bottom 70%', scrub: 0.5 },
  });
} else {
  gsap.set('.gitlog__rail i', { scaleY: 1 });
}
$$('.commit').forEach((c) =>
  ScrollTrigger.create({ trigger: c, start: 'top 70%', onEnter: () => c.classList.add('is-in'), onLeaveBack: () => c.classList.remove('is-in') })
);

/* ------------------------------------------------------------------ */
/* Stack playground                                                    */
/* ------------------------------------------------------------------ */
const pg = initPlayground($('.playground'), { reduce });
$$('.stack__filters [data-cat]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const on = !btn.classList.contains('is-on');
    $$('.stack__filters [data-cat]').forEach((b) => b.classList.remove('is-on'));
    btn.classList.toggle('is-on', on);
    pg.highlight(on ? btn.dataset.cat : null);
  })
);
$('[data-shake]').addEventListener('click', () => pg.shake());

/* ------------------------------------------------------------------ */
/* Holographic award card                                              */
/* ------------------------------------------------------------------ */
const holo = $('.holo');
const card = $('.holo__card');
holo.addEventListener('pointermove', (e) => {
  const r = card.getBoundingClientRect();
  const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  holo.classList.add('is-active');
  card.style.setProperty('--rx', `${(0.5 - py) * 22}deg`);
  card.style.setProperty('--ry', `${(px - 0.5) * 26}deg`);
  card.style.setProperty('--px', `${px * 100}%`);
  card.style.setProperty('--py', `${py * 100}%`);
  card.style.setProperty('--o', '1');
});
holo.addEventListener('pointerleave', () => {
  holo.classList.remove('is-active');
  card.style.setProperty('--rx', '0deg');
  card.style.setProperty('--ry', '0deg');
  card.style.setProperty('--o', '0');
});

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */
giantChars.forEach((ch) => {
  ch.addEventListener('pointerenter', () => {
    ch.classList.add('is-lit');
    clearTimeout(ch._t);
    ch._t = setTimeout(() => ch.classList.remove('is-lit'), 1400);
  });
});
ScrollTrigger.create({
  trigger: '.contact__giant',
  start: 'top 85%',
  onEnter: () =>
    giantChars.forEach((ch, i) => {
      setTimeout(() => ch.classList.add('is-lit'), i * 110);
      setTimeout(() => ch.classList.remove('is-lit'), 900 + i * 110);
    }),
});

const emailBtn = $('.email-btn');
emailBtn.addEventListener('click', async () => {
  const addr = emailBtn.dataset.copy;
  let ok = false;
  try { await navigator.clipboard.writeText(addr); ok = true; } catch (e) {}
  const hint = $('.email-btn__hint', emailBtn);
  if (ok) {
    hint.textContent = 'copied to clipboard ✓';
    emailBtn.classList.add('is-copied');
  } else {
    window.location.href = `mailto:${addr}`;
  }
  const r = emailBtn.getBoundingClientRect();
  confetti(r.left + r.width / 2, r.top + r.height / 2, { count: 70 });
  setTimeout(() => { hint.textContent = 'click to copy'; emailBtn.classList.remove('is-copied'); }, 2600);
});

/* ------------------------------------------------------------------ */
/* Cursor + magnetic                                                   */
/* ------------------------------------------------------------------ */
if (finePointer && !reduce) {
  root.classList.add('has-cursor');
  const cur = $('.cursor');
  const dot = $('.cursor__dot');
  const ring = $('.cursor__ring');
  const label = $('.cursor__label');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    if (cur.classList.contains('is-hidden')) { gsap.set([dot, ring], { x: e.clientX, y: e.clientY }); cur.classList.remove('is-hidden'); }
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
  });
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));
  document.addEventListener('pointerenter', () => cur.classList.remove('is-hidden'));

  document.addEventListener('pointerover', (e) => {
    const lab = e.target.closest('[data-cursor]');
    cur.classList.toggle('is-bot', !!e.target.closest('.bot'));
    const link = e.target.closest('a, button, input');
    if (lab && !(link && lab.contains(link) && link !== lab && !link.closest('.sticker'))) {
      const c = getComputedStyle(lab).getPropertyValue('--c').trim() || '#ff4d9d';
      cur.style.setProperty('--cursor-c', c);
      label.style.color = LIGHT_BG.includes(c.toLowerCase()) ? '#141217' : '#fff';
      label.textContent = lab.dataset.cursor;
      cur.classList.add('is-label');
      cur.classList.remove('is-link');
    } else if (link) {
      cur.classList.add('is-link');
      cur.classList.remove('is-label');
    } else {
      cur.classList.remove('is-link', 'is-label');
    }
  });
  $('#rag-q').addEventListener('focus', () => cur.classList.remove('is-label'));

  $$('.magnetic').forEach((m) => {
    const xTo = gsap.quickTo(m, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(m, 'y', { duration: 0.6, ease: 'power3' });
    m.addEventListener('pointermove', (e) => {
      const r = m.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    m.addEventListener('pointerleave', () => {
      gsap.to(m, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.3)', overwrite: true });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Nav, menu, progress, clock, theme                                   */
/* ------------------------------------------------------------------ */
const nav = $('.nav');
let lastY = 0;
function onScroll(y) {
  nav.classList.toggle('is-scrolled', y > 40);
  const down = y > lastY + 2;
  const up = y < lastY - 2;
  if (!root.classList.contains('menu-open')) {
    if (down && y > 500) nav.classList.add('is-hidden');
    else if (up) nav.classList.remove('is-hidden');
  }
  lastY = y;
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else addEventListener('scroll', () => onScroll(scrollY), { passive: true });

gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

// sliding hover indicator: follows the hovered link, rests on the active one
const navLinks = $('.nav__links');
const indicator = $('.nav__indicator');
function moveIndicator(a) {
  if (!a) return gsap.to(indicator, { opacity: 0, duration: 0.3 });
  gsap.to(indicator, {
    x: a.offsetLeft, width: a.offsetWidth, opacity: 1,
    duration: reduce ? 0 : 0.5, ease: 'expo.out',
  });
}
const activeLink = () => $('.nav__links a.is-active');
$$('.nav__links a').forEach((a) => a.addEventListener('pointerenter', () => moveIndicator(a)));
navLinks.addEventListener('pointerleave', () => moveIndicator(activeLink()));

$$('[data-nav]').forEach((a) => {
  const sec = $(a.getAttribute('href'));
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => {
      a.classList.toggle('is-active', self.isActive);
      if (!navLinks.matches(':hover')) moveIndicator(activeLink());
    },
  });
});

// anchor links → smooth scroll
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const t = $(id);
  if (!t) return;
  e.preventDefault();
  closeMenu();
  scrollToTarget(t);
  history.replaceState(null, '', id);
});

// mobile menu
const menuBtn = $('.menu-btn');
function closeMenu() {
  root.classList.remove('menu-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  $('.menu').setAttribute('aria-hidden', 'true');
  lenis?.start();
}
menuBtn.addEventListener('click', () => {
  const open = !root.classList.contains('menu-open');
  if (!open) return closeMenu();
  root.classList.add('menu-open');
  nav.classList.remove('is-hidden');
  menuBtn.setAttribute('aria-expanded', 'true');
  $('.menu').setAttribute('aria-hidden', 'false');
  lenis?.stop();
  if (!reduce) gsap.from('.menu__links a', { yPercent: 60, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.15 });
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

// local clock (Chantilly, VA)
const clock = $('[data-clock]');
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const tick = () => (clock.textContent = fmt.format(new Date()));
tick();
setInterval(tick, 15000);

// theme toggle with a circular reveal
const metaTheme = $('meta[name="theme-color"]');
const syncMeta = () => metaTheme.setAttribute('content', root.dataset.theme === 'dark' ? '#0f0e13' : '#f5f0e6');
syncMeta();
$('.theme-btn').addEventListener('click', (e) => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  const apply = () => {
    root.dataset.theme = next;
    syncMeta();
    try { localStorage.setItem('theme', next); } catch (err) {}
  };
  if (!document.startViewTransition || reduce) return apply();
  const x = e.clientX, y = e.clientY;
  const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(apply).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
      { duration: 750, easing: 'cubic-bezier(.7,0,.25,1)', pseudoElement: '::view-transition-new(root)' }
    );
  });
});

/* ------------------------------------------------------------------ */
/* Easter eggs                                                         */
/* ------------------------------------------------------------------ */
function party() {
  root.classList.toggle('party');
  confetti(innerWidth * 0.3, innerHeight * 0.6, { count: 60 });
  confetti(innerWidth * 0.7, innerHeight * 0.6, { count: 60 });
  field.ripple();
}
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let kIdx = 0;
addEventListener('keydown', (e) => {
  kIdx = e.key === KONAMI[kIdx] ? kIdx + 1 : e.key === KONAMI[0] ? 1 : 0;
  if (kIdx === KONAMI.length) { kIdx = 0; party(); }
});
let logoClicks = [];
$('.nav__logo').addEventListener('click', () => {
  const now = Date.now();
  logoClicks = logoClicks.filter((t) => now - t < 2000).concat(now);
  if (logoClicks.length >= 5) { logoClicks = []; party(); }
});

console.log(
  '%c Hey, you opened the console. %c\nI like you already. Try the Konami code, or click my logo 5×.\n→ farhanay916@gmail.com',
  'background:#ff4d9d;color:#fff;font:700 14px system-ui;padding:6px 10px;border-radius:6px',
  'color:#8a5cf6;font:500 12px ui-monospace'
);

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
if (!reduce) {
  gsap.set(heroChars, { yPercent: 115 });
}
document.fonts.ready.then(() => {
  ScrollTrigger.refresh();
});
runLoader().then(() => {
  lenis?.start();
  if (!reduce) gsap.set(heroChars, { clearProps: 'transform' });
  heroIntro();
  setTimeout(() => bot.greet(), reduce ? 0 : 1500);
});
