# Stardust redesign (optional)

Ported from `page-forge/server/server.js` `buildRedesignPrompt`. Runs only when the user
toggles **redesign** on. Produces a clean handcrafted prototype that deploys 1:1 (no block
conversion downstream) — write the design you want shipped.

## Input

A rendered version of the source has been saved at `input/current.html`.
Source: `{{SOURCE}}` (a URL, raw HTML, or "(refinement of vN)").

## User intent

`{{INTENT}}` — if empty, apply tasteful modernization only.

## Task

Read `input/current.html`. Produce a redesigned prototype at `output/redesigned.html`.

### Hard requirements

1. Self-contained HTML5 — doctype + `<html>` + `<head>` + `<body>`.
2. All CSS inline in one `<style>` in `<head>`. No external stylesheets, no `@import`, no
   `<link rel="stylesheet">`.
3. `:root` tokens — colors, fonts, spacing, weights as CSS custom properties.
4. Top-level `<section>` elements in `<main>`, one per logical content area (hero, features,
   testimonials, footer-cta, …). Free shape — no required data attributes.
5. Semantic HTML — `<header> <main> <section> <footer>`.
6. Images — reference by their existing URLs from `input/current.html`. Do **not** re-host or
   use placeholder URLs.
7. No scripts, no `<noscript>`, no third-party embeds, no `<iframe>`.
8. Reasonable size — under ~50KB output. Strip verbose framework markup; keep visible content
   (headlines, copy, CTAs, image refs) and the new design direction.
9. CTAs — regular `<a>` with descriptive button styling in your `<style>`. Don't assume any
   external button decoration.

## Consonant 2 baseline (vendored)

Inject the Consonant 2 design brief from `references/_vendored/c2-brief.md` as the design
baseline. **Every output must read as Adobe.com first.**

## Brand knowledge (Stardust — vendored, if present)

If `references/_vendored/design-knowledge.md` exists, apply its extracted brand tokens
(palette, type, spacing) as additional ground truth.

## Intent modifier

The Consonant 2 brief is the baseline; apply `intent` as a MODIFIER on top, never an
override. Examples:

- "more poppy" → up one step on the s2a font-size scale for the hero display; contrast the
  hero on `--s2a-color-gray-1000`; use `--s2a-color-brand-adobe-red` ONCE as a single accent
  (eyebrow or underline); don't saturate the whole palette.
- "more editorial" → light surface (`--s2a-color-gray-25`), generous vertical rhythm at
  `--s2a-layout-lg`, restrained eyebrow, centered narrative.
- "darker / brutalist" → push surfaces to `--s2a-color-gray-1000`, card radius 0, drop card
  shadows, monospace eyebrow labels — still Adobe Clean for headlines.
- (none) → straight Consonant 2 baseline; modernize what's clearly dated without inventing
  new directions.

## Workflow

1. Read `input/current.html`.
2. Survey the sections; pick 3–6 to redesign.
3. Lift the page's brand identity (logo, hero image, key copy).
4. Write `output/redesigned.html` in ONE pass. Don't iterate.

## Done

Confirm `output/redesigned.html` was written and report its path.
