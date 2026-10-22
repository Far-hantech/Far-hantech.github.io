# Mohammed Farhan — Portfolio

Vite + vanilla JS, GSAP (ScrollTrigger, SplitText, Draggable, Inertia), Lenis and Matter.js.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

## Live site

**https://far-hantech.github.io**, hosted on GitHub Pages from the `gh-pages` branch.

To publish an update after editing:

```bash
npm run deploy
```

This builds the site and pushes `dist/` to `gh-pages`. Also commit and push your source changes to `main`.

## Editing content

- **Page copy, projects, career, credentials:** `index.html`
- **"Ask my résumé" knowledge base, suggestions, stack pills:** `src/data.js`
- **Colours and type:** CSS variables at the top of `src/styles.css`
- **Résumé download:** `public/Mohammed-Farhan-Resume.pdf`
- **Social share image:** `public/og.jpg`

## Easter eggs

- The Konami code (↑↑↓↓←→←→BA), or clicking the logo five times, turns on party mode.
- Clicking the hero name recolours it.
- The coder cat in the hero follows your cursor, smiles on hover and chats when clicked. Its speech bubble jumps to "Ask my résumé".
