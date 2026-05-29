/*
 * Snowflake overlay block — Milo flavor.
 *
 * Reads the template name from its first row ("template | <name>"),
 * fetches /templates/<name>.html, lifts its per-block <link> stylesheet
 * tags into document.head, and replaces <main>'s content with the
 * template's <main> content. Sets main.dataset.overlay = name as the
 * sentinel that CSS uses to reveal the injected sections.
 *
 * The block itself is a control — it is intentionally replaced by the
 * template content and disappears from the live DOM.
 */
export default async function decorate(block) {
  // Find the "template" row (first column = "template", second = name)
  const rows = [...block.querySelectorAll(':scope > div')];
  const templateRow = rows.find((r) => {
    const cells = r.querySelectorAll(':scope > div');
    return cells[0]?.textContent?.trim().toLowerCase() === 'template';
  });
  const templateName = templateRow
    ?.querySelectorAll(':scope > div')[1]
    ?.textContent?.trim();

  if (!templateName) {
    console.warn('[snowflake] no template name found in block');
    return;
  }

  const main = block.closest('main');
  if (!main) return;

  // Load page-scoped CSS immediately (stylesheet fetch is non-blocking)
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = `/styles/${templateName}.css`;
  document.head.appendChild(cssLink);

  // Fetch the template HTML
  let html;
  try {
    const resp = await fetch(`/templates/${templateName}.html`);
    if (!resp.ok) {
      console.warn(`[snowflake] template fetch failed: ${resp.status} /templates/${templateName}.html`);
      return;
    }
    html = await resp.text();
  } catch (err) {
    console.warn('[snowflake] template fetch error:', err);
    return;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Lift <link rel="stylesheet"> elements from template into document.head.
  // These are the per-block C2 CSS files (rich-content, base-card, etc.)
  // that foundation:c2 does NOT automatically load.
  const existingLinks = new Set(
    [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href),
  );
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    // link.href is absolute in the parsed document context
    if (link.href && !existingLinks.has(link.href)) {
      document.head.appendChild(link.cloneNode(true));
      existingLinks.add(link.href);
    }
  }

  // Replace <main> content with the template's <main> content
  const templateMain = doc.querySelector('main') || doc.body;
  main.innerHTML = templateMain.innerHTML;

  // Set the sentinel attribute — CSS scoped to [data-overlay] now activates,
  // revealing the injected sections and applying scoped rules.
  main.dataset.overlay = templateName;
}
