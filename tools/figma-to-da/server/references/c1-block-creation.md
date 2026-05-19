# Block Creation Guide — upp

This guide applies when Phase 0 identifies a section that requires a `NEW:` block. Follow every step before writing any code.

---

## Step 0: Read existing blocks first

Before writing any new code, read TWO existing block implementations as structural templates:

```
BLOCKS_PATH/homepage-brick/homepage-brick.js
BLOCKS_PATH/callout/callout.js
```

Study the DOM reading conventions and how blocks query their rows/cells. Note that these existing blocks differ from new prototype blocks in two ways — **do not copy either pattern**:
- They use `export default async function init(el)` — prototype blocks must use `export default function decorate(block)` (synchronous, different name)
- They use Milo async imports (`getLibs`, `createTag`, etc.) — prototype blocks must be **self-contained** with no imports

---

## File structure

Every block lives in its own folder:

```
BLOCKS_PATH/<block-name>/
  <block-name>.js    ← required: default export is decorate(block)
  <block-name>.css   ← required: scoped styles
```

The folder name, the JS filename, and the CSS filename must all match exactly and use **kebab-case**. Example: `metric-strip/metric-strip.js`.

EDS auto-discovers blocks by class name on the page DOM. No registration needed. The block's class on the outer `div` matches the folder name (`metric-strip` → loads `blocks/metric-strip/metric-strip.js`).

---

## JavaScript pattern

### Minimum viable structure

```js
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // 1. Read the authored DOM (rows and cells)
  // 2. Create semantic wrapper elements
  // 3. Reparent content into wrappers
  // 4. Replace block content or append wrappers
}
```

The function signature is always `decorate(block)` — never `init`. No async, no imports. EDS calls it synchronously on page load.

### DOM reading conventions

Authored tables become nested divs: `block > div (row) > div (cell)`.

```js
// All rows
const rows = [...block.querySelectorAll(':scope > div')];

// Cells of a row
const cells = [...row.querySelectorAll(':scope > div')];

// Two-column destructuring
const [leftCell, rightCell] = [...row.querySelectorAll(':scope > div')];

// Detect single-cell heading row
const firstCells = rows[0].querySelectorAll(':scope > div');
const isHeadingRow = firstCells.length === 1 && firstCells[0].querySelector('h2, h3, strong');

// Safe single-cell read (handles both authored structures)
const cell = row.querySelector(':scope > div') || row;
```

### Creating wrapper elements

```js
// Create a wrapper div
const wrapper = document.createElement('div');
wrapper.className = 'metric-strip-content';

// Move all children into it
[...sourceCell.childNodes].forEach((node) => wrapper.append(node));

// Build a CTA actions container
const links = [...textCell.querySelectorAll('a')];
if (links.length) {
  const actions = document.createElement('div');
  actions.className = 'metric-strip-actions';
  const parents = [...new Set(links.map((a) => a.closest('p') || a))];
  parents.forEach((node) => actions.append(node));
  textCell.append(actions);
}
```

### Optional content detection

```js
// Eyebrow: first <p> before the heading, no link inside
const firstP = textCell.querySelector('p:first-child');
const heading = textCell.querySelector('h2, h3');
if (firstP && heading && firstP !== heading && !firstP.querySelector('a')) {
  firstP.classList.add('metric-strip-eyebrow');
}

// Eager LCP image
const img = mediaCell?.querySelector('img');
if (img) img.loading = 'eager';
```

### Replacing block content

```js
// Clear and rebuild
block.innerHTML = '';
if (headingRow) block.append(headingRow);
const wrapper = document.createElement('div');
wrapper.append(grid);
block.append(wrapper);
```

### Dark variant

CSS handles dark mode — no JS needed. Simply check the class if you need to branch on it:

```js
if (block.classList.contains('dark')) {
  // any JS-specific dark handling, usually nothing
}
```

---

## CSS pattern

### File skeleton

```css
/* ── Block wrapper ── */
.metric-strip {
  --metric-strip-bg: #f8f8f8;
  --metric-strip-text: #2c2c2c;
  --metric-strip-accent: #eb1000;

  background: var(--metric-strip-bg);
  padding: 80px 48px;
}

/* ── Inner container ── */
.metric-strip > div {
  max-width: 1280px;
  margin: 0 auto;
}

/* ── Layout ── */
.metric-strip-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}

/* ── Typography ── */
.metric-strip h2 {
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 700;
  color: var(--metric-strip-text);
  margin: 0 0 16px;
}

.metric-strip p {
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--metric-strip-text);
}

/* ── CTA actions ── */
.metric-strip-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.metric-strip-actions strong a {
  display: inline-block;
  padding: 13px 28px;
  border-radius: 4px;
  background: var(--metric-strip-accent);
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9375rem;
}

.metric-strip-actions em a {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 4px;
  border: 2px solid var(--metric-strip-accent);
  color: var(--metric-strip-accent);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.9375rem;
}

/* ── Media ── */
.metric-strip-media img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
}

/* ── Dark variant ── */
.metric-strip.dark {
  --metric-strip-bg: #141414;
  --metric-strip-text: #fff;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .metric-strip {
    padding: 60px 32px;
  }

  .metric-strip-inner {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .metric-strip {
    padding: 48px 20px;
  }

  .metric-strip-actions {
    flex-direction: column;
  }
}
```

---

## CSS conventions

### CSS custom properties

- Scope all block-specific vars to the block root: `.<name> { --<name>-<prop>: value; }`
- Property names: `--<name>-bg`, `--<name>-text`, `--<name>-accent`, `--<name>-border`, etc.
- Override vars in `.<name>.dark { }` — never duplicate property declarations

### Class naming

- Block root: `.<block-name>` (matches the block div, already set by EDS)
- Inner container: `.<block-name> > div` (direct child, the EDS row wrapper)
- Sub-components: `.<block-name>-<component>` (e.g., `.metric-strip-eyebrow`, `.metric-strip-actions`)
- State: `.<block-name>.dark`, `.<block-name>.media-right`

### Layout

- Always: `max-width: 1280px; margin: 0 auto;` on the inner container
- Two-column: `display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;`
- Stack at ≤900px: `grid-template-columns: 1fr;`
- No fixed widths on the block wrapper — it fills 100% of its section

### Typography scale

```css
/* Display / H1 */
font-size: clamp(2.25rem, 4.5vw, 3.75rem); font-weight: 700;

/* Section heading / H2 */
font-size: clamp(1.75rem, 3vw, 2.5rem); font-weight: 700;

/* Card heading / H3 */
font-size: 1rem; font-weight: 700;

/* Body */
font-size: 1.0625rem; line-height: 1.65;

/* Eyebrow */
font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
```

### Color palette (reuse these values — do not invent new ones)

```css
/* Reference values — use these as literals in your block-specific vars */
#eb1000   /* Adobe red — primary CTA background */
#0265dc   /* blue — secondary/ghost border and text */
#2c2c2c   /* dark body text on light bg */
#6e6e6e   /* secondary/muted text */
#f8f8f8   /* light section background */
#141414   /* dark variant background */
#ffffff   /* text on dark background */
```

Use these as the values of your block-specific CSS vars:
```css
.metric-strip {
  --metric-strip-accent: #eb1000;
  --metric-strip-bg:     #f8f8f8;
  --metric-strip-text:   #2c2c2c;
}
```

---

## Checklist before finishing a new block

- [ ] `export default function decorate(block)` — no other export, no imports, synchronous
- [ ] All DOM queries use `:scope > div` to avoid reaching into nested blocks
- [ ] LCP image (first/hero image) has `img.loading = 'eager'`
- [ ] Links gathered into a `.<block-name>-actions` container
- [ ] Dark variant handled via CSS vars only (no JS branching needed)
- [ ] `max-width: 1280px; margin: 0 auto` on inner container
- [ ] Two-column collapses to single column at ≤900px
- [ ] All class names prefixed with `<block-name>-`
- [ ] No TypeScript, no `import` statements, no build tools
