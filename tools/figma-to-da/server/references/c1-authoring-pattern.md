# Authoring Pattern — DA HTML for upp

This file defines the HTML structure for DA documents on the upp site (`adobecom/upp`).

**Critical rules:**
- **No** `foundation: c2` metadata section
- **No** `Mobile-viewport` / `Tablet-viewport` / `Desktop-viewport` rows
- **No** `--s2a-` typography token variants in block names
- **No** `section-metadata` with `container, wide` (except for Tabs/Carousel — see below)
- Blocks handle responsive layout entirely through CSS

For most page sections, **prefer Milo standard blocks** from the block inventory (marquee,
columns, accordion, etc.). Use upp's native blocks (`Homepage Brick`, `Callout`,
`Catalog Marquee`) only when the design specifically matches their visual pattern.

---

## Document skeleton

```html
<!doctype html>
<html>
<head><title>Page Title</title></head>
<body>
  <header></header>
  <main>
    <div>
      <!-- Block 1 table goes here -->
    </div>
    <div>
      <!-- Block 2 table goes here -->
    </div>
    <!-- One <div> per block/section; each wraps exactly one <table> -->
  </main>
  <footer></footer>
</body>
</html>
```

Each `<div>` inside `<main>` is one section. Each section contains one block `<table>`.

---

## Block table structure

```html
<table>
  <tbody>
    <tr><td colspan="2">Block Name</td></tr>   <!-- Name row: 1 cell, colspan = number of content columns -->
    <tr>
      <td><!-- column 0 content --></td>
      <td><!-- column 1 content --></td>
    </tr>
  </tbody>
</table>
```

**Name row rules:**
- First row of every table: one `<td>` containing the block name
- EDS lowercases and hyphenates it: `Homepage Brick` → class `homepage-brick`
- Variants in parentheses, comma-separated: `Marquee (large, light)` → classes `marquee large light`
- The name `<td>` must span ALL content columns — use `colspan` equal to the number of cells in a normal content row. For 1-column blocks, omit `colspan`. **Never put more than one `<td>` in the name row.**
- Never use `<th>` — always `<td>`

---

## CTA / link conventions

```html
<!-- Primary CTA (filled button) -->
<p><strong><a href="https://www.adobe.com/">Try for free</a></strong></p>

<!-- Secondary CTA (ghost / outline button) -->
<p><em><a href="https://www.adobe.com/">Learn more</a></em></p>

<!-- Plain text link (no button styling) -->
<p><a href="https://www.adobe.com/">See all plans</a></p>
```

Use `https://www.adobe.com/` as a placeholder URL for all links. The user will replace them with real destinations after reviewing in DA.

---

## Image authoring

After uploading images to the DA shadow folder, reference them with their `content.da.live` URL:

```html
<td>
  <picture>
    <img src="https://content.da.live/<org>/<repo>/drafts/<username>/.<slug>/<filename>" alt="Description">
  </picture>
</td>
```

Shadow folder convention: page at `drafts/<username>/<slug>.html` stores images at `drafts/<username>/.<slug>/<filename>`.

---

## UPP native blocks

These are blocks that exist in the upp repo and can be used in prototypes.

### Homepage Brick

A content brick with a background image/color layer and a foreground text+CTA layer.
The first row is the background, the second row is the foreground content.

```html
<table>
  <tbody>
    <tr><td colspan="2">Homepage Brick</td></tr>
    <!-- Background row: image or solid color -->
    <tr>
      <td>
        <picture><img src="https://content.da.live/.../bg.png" alt="Background"></picture>
      </td>
    </tr>
    <!-- Foreground row: text + CTAs -->
    <tr>
      <td>
        <h2>Section heading</h2>
        <p>Supporting body text for this section.</p>
        <p><strong><a href="https://www.adobe.com/">Get started</a></strong></p>
        <p><em><a href="https://www.adobe.com/">Learn more</a></em></p>
      </td>
    </tr>
  </tbody>
</table>
```

Variants: `large`, `medium`, `small`, `xlarge`, `above-pods`, `news`, `link`.

---

### Callout

A simple text callout section with paragraphs. Multiple callout items are separated
by horizontal rules (`<hr>`).

```html
<table>
  <tbody>
    <tr><td>Callout</td></tr>
    <tr>
      <td>
        <p>First callout message or feature highlight.</p>
        <hr>
        <p>Second callout message or feature highlight.</p>
        <hr>
        <p>Third callout message.</p>
      </td>
    </tr>
  </tbody>
</table>
```

Single column; no images. Use for short marketing copy, disclaimers, or feature highlights.

---

### Catalog Marquee

A marquee block designed for catalog and plans pages. Works like Milo's `marquee`
but styled for the catalog context.

```html
<table>
  <tbody>
    <tr><td colspan="2">Catalog Marquee</td></tr>
    <tr>
      <td>
        <h1>Creative Cloud plans</h1>
        <p>Find the right plan for you.</p>
        <p><strong><a href="https://www.adobe.com/">See all plans</a></strong></p>
      </td>
      <td>
        <picture><img src="https://content.da.live/.../hero.png" alt="Creative Cloud"></picture>
      </td>
    </tr>
  </tbody>
</table>
```

Col 0 = text (heading + body + CTAs), Col 1 = optional media image.

---

## Milo block examples (most common for upp pages)

For full authoring tables for all Milo blocks, see the Milo Block Inventory reference.

### marquee (hero banner)

```html
<table>
  <tbody>
    <tr><td colspan="2">Marquee (large, light)</td></tr>
    <tr>
      <td>
        <h1>Main headline</h1>
        <p>Supporting descriptor text.</p>
        <p><strong><a href="https://www.adobe.com/">Get started free</a></strong></p>
        <p><em><a href="https://www.adobe.com/">View plans</a></em></p>
      </td>
      <td>
        <picture><img src="https://content.da.live/.../hero-image.png" alt="Hero illustration"></picture>
      </td>
    </tr>
  </tbody>
</table>
```

---

### columns (N-column layout)

```html
<table>
  <tbody>
    <tr><td colspan="3">Columns</td></tr>
    <tr>
      <td>
        <h3>Feature one</h3>
        <p>Description of feature one.</p>
      </td>
      <td>
        <h3>Feature two</h3>
        <p>Description of feature two.</p>
      </td>
      <td>
        <h3>Feature three</h3>
        <p>Description of feature three.</p>
      </td>
    </tr>
  </tbody>
</table>
```

---

### accordion (FAQ)

```html
<table>
  <tbody>
    <tr><td>Accordion</td></tr>
    <tr><td>What is included in Creative Cloud?</td></tr>
    <tr><td><p>Creative Cloud includes 20+ apps, 100GB cloud storage, and more.</p></td></tr>
    <tr><td>Can I cancel anytime?</td></tr>
    <tr><td><p>Yes. Annual plans can be cancelled within 14 days for a full refund.</p></td></tr>
  </tbody>
</table>
```

---

## Special Milo block patterns

### Tabs and Carousel — content lives in tagged sections

The `Tabs` and `Carousel` blocks are just anchors. Their content is authored in **separate `<div>` sections** tagged with `section-metadata`:

```html
<!-- Tabs anchor block -->
<div>
  <table><tbody>
    <tr><td colspan="3">Tabs</td></tr>
    <tr><td>Tab One</td><td>Tab Two</td><td>Tab Three</td></tr>
  </tbody></table>
</div>

<!-- Tab One content section -->
<div>
  <table><tbody>
    <tr><td colspan="2">Marquee (large, light)</td></tr>
    <tr>
      <td><h2>Tab One heading</h2><p>Content.</p></td>
      <td><picture><img src="..." alt="..."></picture></td>
    </tr>
  </tbody></table>
  <div class="section-metadata">
    <div><div>tab</div><div>Tab One</div></div>
  </div>
</div>
```

The `section-metadata` div is structured as: row → key div + value div.

---

## Common mistakes to avoid

- Do NOT add a `<div class="metadata"><div>foundation</div><div>c2</div></div>`
- Do NOT add `<div class="section-metadata">` blocks — not needed **except** when using Milo `tabs` or `carousel` blocks
- Do NOT use `Mobile-viewport` / `Tablet-viewport` rows inside tables — blocks are CSS-responsive only
- Do NOT use `<th>` in block tables — always `<td>`
- Do NOT embed images as base64 — always use `content.da.live` URLs
- For newly-created custom blocks, derive the DA table name from the block folder name using title-case: `metric-strip` → `Metric Strip`, `app-grid` → `App Grid`
