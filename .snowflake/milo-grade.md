## Milo-grade forge-* block authoring checklist
Every `blocks/forge-<name>/forge-<name>.js` MUST follow these 18 rules. A linter (`shared/lint/forge-block-lint.js`) runs against each block before it is copied into the Milo branch — blocks that fail a "blocking" rule are rejected and the deploy stops.

**Decorator shape (L1, L2, L3, L4)**
- **L1 (BLOCKING)** `blocks/forge-<name>/forge-<name>.js` MUST export `export default async function init(el)`. `function decorate(block)` is the Helix Boilerplate signature — Milo's C2 path will not call it. Confirmed-known violation in past sessions: do not regress.
- C2. Probe outward from required content (`el.querySelector('h1, .hero-title')`) — never `el.children[N]` / `el.firstElementChild`. Authors rearrange rows; positional reads drift.
- C3. **Never `block.innerHTML = ""` or `el.innerHTML = ""`.** Wipes Target / MEP / authored DOM. Build the rebuilt section with `createElement` + `appendChild`, then `el.replaceChildren(rebuilt)` once at the end.
- C4. Preserve `<picture>`/`<source>`/`<img>` attributes — `loading`, `width`, `height`, `srcset`, `sizes`. Stripping `loading="lazy"` blows Milo's LCP budget; stripping `width`/`height` reflows the page.

**Use Milo services (L5)**
- C5. Import from `../../utils/utils.js` (relative to `libs/c2/blocks/forge-<name>/`): `decorateButtons`, `decorateBlockText`, `decorateViewportContent`, `getFederatedUrl`. Re-rolling these by hand drops analytics + a11y wiring.

**Design tokens + typography (L6)**
- C6. Use `--s2a-*` CSS custom properties (e.g. `var(--s2a-color-text)`, `var(--s2a-space-md)`) and C2 typography classes (`title-2`, `body-md`, `eyebrow`, `con-button`). Hard-coded hex literals are warned; tokenize them.

**Analytics (L7)**
- C7. Set `daa-lh` on the block root (`el.setAttribute('daa-lh', 'forge-<name>')`), `daa-ll` on every link/button created (`link.setAttribute('daa-ll', '<short-label>')`), and `daa-im` on any inserted image.

**Semantics (L8, L9)**
- C8. **At most one `<h1>` per block.** Use h2/h3 for sub-headings even if Figma styled them like h1. Multiple h1s break SR outline + Milo SEO.
- C9. `<button>` for actions (no real navigation); `<a>` only when `href` is a real URL. `<a href="#">` styled as a button fails L9 and harms keyboard nav.

**Animations (L14, L17, L21)**
- C10. **Do NOT emit motion here.** Animations are applied later in forge-adjustments from the design-system catalog; do NOT emit reveals or `--pa-*` vars in a ship block. If a block does carry motion, gate it behind `@media (prefers-reduced-motion: reduce) { … }` in CSS, or check `window.matchMedia('(prefers-reduced-motion: reduce)')` in JS, and disable the animation when matched.
- C13. **No invented motion.** Animations are applied later in forge-adjustments from the design-system catalog; do NOT emit reveals or `--pa-*` vars here, and do NOT add an `animation forge-<name>` sidecar. Do NOT bundle GSAP/Lenis/scroll listeners into block JS, and never inline `@keyframes` in JS template strings (warned).

**MEP / personalization (L15)**
- C11. Preserve `data-manifest-id`, `data-adobe-target-testid`, and `data-mep-*` on every node you `replaceChildren` / `replaceWith` / `appendChild`. Copy from the source element via `node.getAttribute` BEFORE you wipe-and-rebuild.

**Link hash modifiers (L16)**
- C12. Decorate Milo's hash modifiers (`#_button-fill`, `#_blank`, `#_modal`, `#_tcl`) per Milo conventions — `decorateLinks` / `getButtonHash` / `getModalHash`. Do not hard-code suffix anchors.

**Per-viewport content (L18)**
- C14. For content that differs across viewports, use `decorateViewportContent` (consistent SSR/CSR behavior). Direct `window.matchMedia` checks are warned; `@media` queries in CSS are fine for purely visual differences.

**CSS scope (L10, L19)**
- C15. **Every top-level CSS rule selector must start with `.forge-<name>`.** Never `:root`, `body`, `@font-face`, `@import`, or bare element selectors. Tokens go inside `.forge-<name> { --my-thing: …; }`, not in `:root`.

**Globals (L12)**
- C16. **No `window.X = …`, no `document.body.X = …`.** Keep state local to the block element. Page Animator + MEP + Milo all assume blocks don't mutate globals.

**Test fixture (L22)**
- C17. **Required for every block.** Emit `test/blocks/forge-<name>/mocks/body.html` (the authored block table as rendered by DA, before decorate) and `test/blocks/forge-<name>/forge-<name>.test.js` (loads mocks/body.html, runs `init`, asserts the rebuilt DOM). The lint BLOCKS if either is missing.
- C17b. **The test fixture is mandatory — the deploy stops without it.** L22 is now a blocking rule: a forge-* block that ships without both `test/blocks/forge-<name>/mocks/body.html` and `test/blocks/forge-<name>/forge-<name>.test.js` is rejected and never copied into the Milo branch. Generate the fixture for every block you author, and make the `.test.js` assertions pass (the Milo worktree runs `npm test` as a gate before the push).

**Reserved names (L20)**
- C18. **Refuse to generate `forge-nav`, `forge-footer`, `forge-header`, or `forge-pricing-grid`.** Milo provides `gnav` / `gfooter` via federated fragments; commerce uses `merch-card`. If the source section is a nav/footer/pricing grid, capture it as page metadata or hand off to the appropriate Milo block — do NOT make a forge-* block out of it.

**File size**
- L11. Caps: `forge-<name>.js` ≤ 400 lines (warn 250); `forge-<name>.css` ≤ 300 lines (warn 150). A block over the JS cap is doing too much — split it or simplify the rebuild.
- L24 — Responsive layout (BLOCKING): the block CSS MUST NOT contain a top-level rule with `width:` or `min-width:` greater than 1920px. The Figma frame may be 2560px-wide, but the block must reflow to its container via flex/grid/max-width:100%. Bake the Figma layout INTENT (column counts, gaps, ratios), not the literal design-width pixels.
- L25 — Single-responsibility (BLOCKING): a forge-* block represents ONE content section. It MUST NOT render LNAV, gnav, header navigation, breadcrumb chrome, or footer chrome. Milo provides those via federated fragments — if the Figma frame includes a nav stripe above the section, EMIT THE SECTION ONLY and drop the nav. Class names `.lnav`, `.main-nav`, `.gnav`, `.breadcrumb`, `.global-navigation` inside a forge-* block are a category mistake.
- L26 — <picture> decoration (WARNING): every <img> the block creates (not authored) SHOULD be inside a <picture> with at least one <source srcset="..."> entry. Raw <img src="..."> with no <picture> is acceptable for inline icons but a warning at media-density level for hero/feature images.