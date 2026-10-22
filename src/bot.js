// The hero coder cat: types away, eyes and head follow the cursor, it blinks,
// twitches its ears, smiles on hover and hops + chats when clicked.

import gsap from 'gsap';

const LINES = [
  "Meow. I'm Farhan's coder cat ✦",
  'git commit -m "purrfect" ✓',
  'Ask me about him ↓ I review his PRs.',
  'Zero bugs. Only catnip.',
  'He codes at 2am. I keep the keyboard warm.',
  'Shipping to prod… 🐾',
];

export function initBot(el, { reduce = false, onAsk } = {}) {
  const eyes = el.querySelector('.cat__eyes');
  const head = el.querySelector('.cat__head');
  const ears = [...el.querySelectorAll('.cat__ear')];
  const msg = el.querySelector('.bot__msg');
  const bubble = el.querySelector('.bot__bubble');
  const squash = el.querySelector('.bot__squash');
  const touch = !matchMedia('(pointer: fine)').matches;
  let line = 0, talkTimer = 0, lastMove = 0;

  // --- looking (SVG user units) ---------------------------------------------
  gsap.set(head, { svgOrigin: '70 86' });
  const eyeX = gsap.quickTo(eyes, 'x', { duration: 0.5, ease: 'power3.out' });
  const eyeY = gsap.quickTo(eyes, 'y', { duration: 0.5, ease: 'power3.out' });
  const tilt = gsap.quickTo(head, 'rotation', { duration: 0.9, ease: 'power3.out' });
  function look(nx, ny) {
    eyeX(nx * 2.4);
    eyeY(ny * 1.8);
    tilt(nx * 6);
  }
  if (!reduce) {
    addEventListener('pointermove', (e) => {
      lastMove = performance.now();
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.35);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 380);
      look((dx / d) * k, (dy / d) * k);
    }, { passive: true });

    // idle: look around like a curious cat
    setInterval(() => {
      if (performance.now() - lastMove < 3500 || document.hidden) return;
      look(gsap.utils.random(-1, 1), gsap.utils.random(-0.7, 0.7));
    }, 2400);
  }

  // --- blinking & ear twitches --------------------------------------------
  function blink() {
    el.classList.add('is-blink');
    setTimeout(() => el.classList.remove('is-blink'), 130);
  }
  function twitch() {
    const ear = ears[(Math.random() * ears.length) | 0];
    ear.classList.add('is-twitch');
    setTimeout(() => ear.classList.remove('is-twitch'), 170);
    setTimeout(() => ear.classList.add('is-twitch'), 300);
    setTimeout(() => ear.classList.remove('is-twitch'), 460);
  }
  function every(min, max, fn) {
    setTimeout(() => { if (!document.hidden) fn(); every(min, max, fn); }, min + Math.random() * (max - min));
  }
  if (!reduce) {
    every(2400, 6000, () => { blink(); if (Math.random() < 0.25) setTimeout(blink, 260); });
    every(3500, 8000, twitch);
  }

  // --- talking ------------------------------------------------------------
  function say(text, ms = 3200) {
    msg.textContent = text;
    el.classList.add('is-talking');
    clearTimeout(talkTimer);
    talkTimer = setTimeout(() => el.classList.remove('is-talking'), ms);
  }
  const happy = (on) => el.classList.toggle('is-happy', on);

  el.addEventListener('pointerenter', () => {
    if (touch) return;
    happy(true);
    say(LINES[line % LINES.length], 60000);
  });
  el.addEventListener('pointerleave', () => {
    if (touch) return;
    happy(false);
    clearTimeout(talkTimer);
    talkTimer = setTimeout(() => el.classList.remove('is-talking'), 900);
  });

  el.addEventListener('click', (e) => {
    if (e.target.closest('.bot__bubble')) return;
    line++;
    say(LINES[line % LINES.length], touch ? 2800 : 60000);
    if (touch) { happy(true); setTimeout(() => happy(false), 1600); }
    el.classList.add('is-wink');
    setTimeout(() => el.classList.remove('is-wink'), 340);
    twitch();
    if (!reduce) {
      gsap.timeline()
        .to(squash, { scaleX: 1.1, scaleY: 0.88, duration: 0.12, ease: 'power2.out' })
        .to(squash, { scaleX: 0.96, scaleY: 1.06, yPercent: -16, duration: 0.24, ease: 'power2.out' })
        .to(squash, { scaleX: 1, scaleY: 1, yPercent: 0, duration: 0.7, ease: 'bounce.out' });
    }
  });

  bubble.addEventListener('click', () => onAsk?.());

  return {
    greet() {
      if (reduce) return;
      setTimeout(() => {
        happy(true);
        twitch();
        say(LINES[0], 3400);
        setTimeout(() => happy(false), 1400);
      }, 400);
    },
  };
}
