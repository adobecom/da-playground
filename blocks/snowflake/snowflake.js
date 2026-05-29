/**
 * Snowflake block — Milo-compatible overlay template engine.
 *
 * Reads a template name from the block table, fetches the
 * pre-rendered template HTML, injects its <link> stylesheet tags
 * into <head>, loads the scoped page CSS, then replaces <main>
 * with the template's content.
 *
 * Block table format (DA authoring):
 *   | template | <template-name> |
 *
 * The scoped CSS at /styles/<template-name>.css MUST contain:
 *   main[data-overlay="<template-name>"] > div { display: block; }
 * as its first rule — this overrides Milo's progressive section
 * appearance (`main > div { display: none }`) for the injected content.
 */

export default async function decorate(block) {
  // ── 1. Read template name from block ──────────────────────────────────
  let templateName;
  for (const row of block.querySelectorAll(':scope > div')) {
    const cells = row.querySelectorAll(':scope > div');
    if (cells.length >= 2 && cells[0].textContent.trim().toLowerCase() === 'template') {
      templateName = cells[1].textContent.trim();
      break;
    }
  }
  if (!templateName) {
    // eslint-disable-next-line no-console
    console.error('[snowflake] no template row found in block');
    return;
  }

  const main = block.closest('main');
  if (!main) return;

  // ── 2. Mark <main> immediately so the reveal CSS takes effect ─────────
  main.dataset.overlay = templateName;

  const base = window.hlx?.codeBasePath ?? '';

  // ── 3. Load scoped CSS (contains the `main[data-overlay] > div { display:block }` rule) ──
  const cssLoaded = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${base}/styles/${templateName}.css`;
    link.onload = resolve;
    link.onerror = resolve; // non-fatal
    document.head.appendChild(link);
  });

  // ── 4. Fetch template HTML ────────────────────────────────────────────
  let templateDoc;
  try {
    const resp = await fetch(`${base}/templates/${templateName}.html`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const parser = new DOMParser();
    templateDoc = parser.parseFromString(text, 'text/html');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[snowflake] template fetch failed:', templateName, e);
    return;
  }

  // ── 5. Wait for scoped CSS before touching the DOM ────────────────────
  await cssLoaded;

  // ── 6. Inject block-level CSS <link> tags from the template ──────────
  const existingHrefs = new Set(
    [...document.head.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
  );
  templateDoc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    // link.href is fully resolved against the template document's base URL
    if (link.href && !existingHrefs.has(link.href)) {
      document.head.appendChild(link.cloneNode(true));
      existingHrefs.add(link.href);
    }
  });

  // Also inject <mas-commerce-service> if present (needed for merch blocks)
  if (!document.querySelector('mas-commerce-service')) {
    const mas = templateDoc.querySelector('mas-commerce-service');
    if (mas) document.head.appendChild(mas.cloneNode(true));
  }

  // ── 7. Replace <main> content with the template ───────────────────────
  const templateMain = templateDoc.querySelector('main');
  if (!templateMain) return;

  main.innerHTML = templateMain.innerHTML;
  // Re-apply overlay attribute — innerHTML replacement wipes dataset
  main.dataset.overlay = templateName;
}
