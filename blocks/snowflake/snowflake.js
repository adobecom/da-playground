/*
 * Snowflake overlay block — Milo flavor.
 *
 * Reads the template name from its own block rows, fetches
 * /templates/<name>.html, lifts its head-level <link> tags into <head>,
 * applies any authored slot values from the block rows, then replaces
 * <main> with the populated template and stamps main.dataset.overlay.
 *
 * Block row format:
 *   template           | <template-name>            (required)
 *   <section>::<slot>  | <slot-value-html>          (optional, repeatable)
 */

/** Parse an HTML fragment and return the first matching element, or null. */
function parseFirst(value, selector) {
  const tmp = document.createElement('div');
  tmp.innerHTML = value;
  return tmp.querySelector(selector);
}

/**
 * Write a slot value into a [data-slot] element.
 * Mirrors the five writer cases in the EDS substrate's writeSlot().
 */
function writeSlot(el, value) {
  const { tagName } = el;

  if (tagName === 'IMG') {
    const img = parseFirst(value, 'img');
    if (img) {
      el.src = img.getAttribute('src');
      if (img.alt) el.alt = img.alt;
    }
    return;
  }

  if (tagName === 'PICTURE') {
    const newPic = parseFirst(value, 'picture');
    if (newPic) el.replaceWith(newPic);
    return;
  }

  // Background-image check BEFORE generic link check — a slotted <a>
  // with background-image should update the CSS url(), not the href.
  if (el.style && el.style.backgroundImage) {
    const img = parseFirst(value, 'img');
    if (img) {
      el.style.backgroundImage = `url("${img.getAttribute('src')}")`;
    }
    return;
  }

  if (tagName === 'A') {
    const a = parseFirst(value, 'a');
    if (a) {
      el.href = a.getAttribute('href');
      el.innerHTML = a.innerHTML;
    } else {
      el.innerHTML = value;
    }
    return;
  }

  // Heading: unwrap inner same-tag heading to avoid auto-close nesting.
  if (/^H[1-6]$/.test(tagName)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = value;
    const inner = tmp.querySelector(tagName.toLowerCase());
    el.innerHTML = inner ? inner.innerHTML : value;
    return;
  }

  // Default: set innerHTML.
  el.innerHTML = value;
}

/**
 * Walk template sections and apply slot values from the slots map.
 * slots: { sectionClass: { slotName: htmlString } }
 */
function applySlotsToTemplate(templateMain, slots) {
  templateMain.querySelectorAll('section[class]').forEach((section) => {
    const blockName = section.className.trim().split(/\s+/)[0];
    const blockSlots = slots[blockName];
    if (!blockSlots) return;
    section.querySelectorAll('[data-slot]').forEach((el) => {
      const slotName = el.getAttribute('data-slot');
      if (slotName in blockSlots) writeSlot(el, blockSlots[slotName]);
    });
  });
}

export default async function decorate(block) {
  // --- 1. Read template name and slot values from this block's rows --------
  let templateName = null;
  const slots = {}; // { sectionClass: { slotName: valueHtml } }

  block.querySelectorAll(':scope > div').forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length < 2) return;
    const key = cells[0].textContent.trim().toLowerCase();
    const rawValue = cells[1].innerHTML.trim();
    const textValue = cells[1].textContent.trim();

    if (key === 'template') {
      templateName = textValue;
      return;
    }
    // Slot rows use "sectionClass::slotName" as the key.
    if (key.includes('::')) {
      const sep = key.indexOf('::');
      const sectionClass = key.slice(0, sep).trim();
      const slotName = key.slice(sep + 2).trim();
      if (!slots[sectionClass]) slots[sectionClass] = {};
      slots[sectionClass][slotName] = rawValue;
    }
  });

  if (!templateName) {
    // eslint-disable-next-line no-console
    console.warn('[snowflake] no template row found in snowflake block');
    return;
  }

  const main = block.closest('main');
  if (!main) return;

  // --- 2. Fetch template HTML. Load CSS in parallel (fire-and-forget). ----
  // Root-relative paths work on both aem.page (proxied through code bus)
  // and localhost (aem-cli serves the repo root).
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = `/styles/${templateName}.css`;
  document.head.appendChild(cssLink);

  let templateResp;
  try {
    templateResp = await fetch(`/templates/${templateName}.html`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[snowflake] fetch failed for template "${templateName}":`, err);
    return;
  }

  if (!templateResp.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[snowflake] template not found: /templates/${templateName}.html (${templateResp.status})`);
    return;
  }

  const templateHtml = await templateResp.text();

  // --- 3. Parse template HTML. --------------------------------------------
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<!DOCTYPE html><html><body>${templateHtml}</body></html>`,
    'text/html',
  );
  const newMain = doc.body.querySelector('main');
  if (!newMain) {
    // eslint-disable-next-line no-console
    console.warn(`[snowflake] template "${templateName}" has no <main>`);
    return;
  }

  // --- 4. Lift top-level <link> tags into document.head. -----------------
  // Template files declare their own CSS dependencies as bare <link> tags
  // above <main>. The overlay engine lifts them into <head> at runtime so
  // those stylesheets are deduped and load in the right context.
  const existingLinks = [...document.head.querySelectorAll('link')];
  doc.body.querySelectorAll(':scope > link').forEach((link) => {
    const clone = link.cloneNode(true);
    // Dedupe by href+rel so we don't double-inject what Milo/head.html already loaded.
    if (existingLinks.some((l) => l.href === clone.href && l.rel === clone.rel)) return;
    document.head.appendChild(clone);
    existingLinks.push(clone);
  });

  // --- 5. Apply authored slot values into template. -----------------------
  applySlotsToTemplate(newMain, slots);

  // --- 6. Replace <main> and stamp the overlay attribute. -----------------
  main.innerHTML = newMain.innerHTML;
  main.dataset.overlay = templateName;
}
