# Redesign Guide — Matchday Ledger

Everything about how this app looks lives in two files. There's no hidden
styling system, no build-time theme file, nothing else to hunt for.

## The two files that control 100% of the look

| File | Controls |
|---|---|
| `src/App.jsx` | Structure — what elements exist, what order they're in, what text/labels say, the chart components |
| `src/App.css` | Every color, font, spacing value, border, and layout rule |

## Start here: the design tokens

At the very top of `src/App.css` is a `:root { ... }` block. This is the
control panel for the entire visual identity — every color used anywhere in
the app pulls from one of these ~13 variables:

```css
:root {
  --color-bg: #0A0D0A;           /* page background */
  --color-surface: #12160F;      /* card backgrounds */
  --color-surface-2: #181D14;    /* inputs, nested panels */
  --color-line: #272E20;         /* borders, dividers */
  --color-text: #E9ECE4;         /* primary text */
  --color-dim: #818A76;          /* secondary text, labels */
  --color-dimmer: #565D4B;       /* tertiary text, placeholders */
  --color-green: #3DDC84;        /* wins, positive numbers, primary buttons */
  --color-red: #EA5B4E;          /* losses, negative numbers, danger actions */
  --color-amber: #F0A93C;        /* pending bets, warnings, support banner */
  ...
}
```

**To restyle the whole app's color scheme, you only need to change values in
this one block.** Want a blue-and-white look instead of the dark green
"vidiprinter" theme? Change `--color-bg`, `--color-green`, etc. here and it
cascades everywhere automatically.

The two font stacks (`--font-mono` for the ledger/numbers, `--font-sans` for
body text) are defined right below the colors.

## The one exception: charts

The bankroll/ROI charts are drawn with an SVG charting library that can't
read CSS variables directly, so their colors are duplicated as a small JS
object near the top of `src/App.jsx`:

```js
const CHART_COLORS = {
  line: '#272E20',
  dim: '#565D4B',
  dimmer: '#818A76',
  surface2: '#181D14',
  green: '#3DDC84',
  red: '#EA5B4E',
};
```

If you change a color in `App.css`'s `:root` block, update the matching value
here too so the charts stay consistent with the rest of the app.

## Finding a specific element to change

Every visual chunk in `App.css` is labeled with a comment, e.g.:

```css
/* Header */
/* Scoreboard */
/* Bet form */
/* Ticker */
/* Platforms */
/* Settings modal */
/* Support banner */
```

Search for the section name to jump straight to the relevant CSS. Class
names in `App.jsx` match these 1:1 — e.g. everything with `className="score-*"`
is styled under the `/* Scoreboard */` section.

## Common redesign moves

- **Change the accent color**: edit `--color-green` (and its chart twin)
- **Different corner roundness**: search-and-replace `border-radius: 4px` /
  `3px` in `App.css`
- **Different fonts**: change `--font-mono` / `--font-sans` — any real font
  name works if you also add a `<link>` for it in `index.html`
- **Different spacing/density**: most cards use `padding: 16px` or similar —
  adjust those values for a tighter or airier feel
- **Rename or reorder sections**: happens in `App.jsx`, in the JSX return
  block near the bottom of the file (search for `card-label` to find each
  section's heading)

## After making changes

```
npm run dev
```

...then check it in the browser. When you're happy:

```
git add .
git commit -m "Redesign: describe what you changed"
git push
```

Vercel rebuilds and updates your live link automatically.
