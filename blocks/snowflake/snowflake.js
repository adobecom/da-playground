/*
 * Snowflake block — Milo flavor
 * Reads the template slug from the first "template | <slug>" row, then:
 *  1. Sets data-overlay="<slug>" on <main> for scoped CSS
 *  2. Loads /styles/<slug>.css
 *  3. Fetches /templates/<slug>.html and replaces <main> content with it
 *  4. Activates proto-* interactive widgets (carousel, marquee, tabs, accordion)
 *
 * The injected DOM is pre-decorated — Milo will NOT re-decorate it.
 */

/* ─── Lightweight widget activators ─── */
const ACTIVATORS = {
  carousel(root) {
    const track = root.querySelector('.proto-carousel-track');
    if (!track) return;
    const slides = [...track.querySelectorAll('.proto-slide')];
    if (slides.length < 2) return;
    let current = 0;

    const show = (i) => {
      slides.forEach((s, j) => s.setAttribute('aria-hidden', String(j !== i)));
      root.querySelectorAll('.proto-carousel-dot').forEach((d, j) => {
        d.setAttribute('aria-selected', String(j === i));
      });
      current = i;
    };

    // Prev / next arrows
    const prev = document.createElement('button');
    prev.className = 'proto-carousel-prev';
    prev.setAttribute('aria-label', 'Previous slide');
    prev.innerHTML = '&#8592;';
    const next = document.createElement('button');
    next.className = 'proto-carousel-next';
    next.setAttribute('aria-label', 'Next slide');
    next.innerHTML = '&#8594;';
    root.append(prev, next);
    prev.addEventListener('click', () => show((current - 1 + slides.length) % slides.length));
    next.addEventListener('click', () => show((current + 1) % slides.length));

    // Dots
    const dots = document.createElement('div');
    dots.className = 'proto-carousel-dots';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'proto-carousel-dot';
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => show(i));
      dots.append(dot);
    });
    root.append(dots);

    show(0);
    const interval = Number(root.dataset.protoAutoplay) || 0;
    if (interval) setInterval(() => show((current + 1) % slides.length), interval);
  },

  marquee(root) {
    const slides = [...root.querySelectorAll('.proto-marquee-slide')];
    if (slides.length < 2) return;
    let current = 0;
    const interval = Number(root.dataset.protoInterval) || 5000;
    const show = (i) => {
      slides.forEach((s, j) => s.setAttribute('aria-hidden', String(j !== i)));
      current = i;
    };
    show(0);
    setInterval(() => show((current + 1) % slides.length), interval);
    root.querySelectorAll('.proto-marquee-nav-item').forEach((btn, i) => {
      btn.addEventListener('click', () => show(i));
    });
  },

  tabs(root) {
    const tabs = [...root.querySelectorAll('.proto-tab')];
    const panels = [...root.querySelectorAll('.proto-tabpanel')];
    const show = (i) => {
      tabs.forEach((t, j) => t.setAttribute('aria-selected', String(j === i)));
      panels.forEach((p, j) => {
        if (j === i) p.removeAttribute('hidden');
        else p.setAttribute('hidden', '');
      });
    };
    tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
    const active = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    show(active >= 0 ? active : 0);
  },

  accordion(root) {
    root.querySelectorAll('.proto-acc-item').forEach((item) => {
      const trigger = item.querySelector('.proto-acc-trigger');
      const panel = item.querySelector('.proto-acc-panel');
      if (!trigger || !panel) return;
      trigger.addEventListener('click', () => {
        const expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!expanded));
        if (!expanded) panel.removeAttribute('hidden');
        else panel.setAttribute('hidden', '');
      });
      // Set initial state
      if (trigger.getAttribute('aria-expanded') !== 'true') panel.setAttribute('hidden', '');
    });
  },
};

/* ─── Main block init ─── */
export default async function init(block) {
  // Find slug from "template | <slug>" row
  let slug = '';
  for (const row of block.querySelectorAll(':scope > div')) {
    const cells = [...row.querySelectorAll(':scope > div')];
    const label = cells[0]?.textContent?.trim().toLowerCase();
    if (label === 'template' && cells[1]) {
      slug = cells[1].textContent.trim();
      break;
    }
  }

  // Fallback: second cell of first row
  if (!slug) {
    const first = block.querySelector(':scope > div');
    const cells = first ? [...first.querySelectorAll(':scope > div')] : [];
    slug = cells[1]?.textContent?.trim() || '';
  }

  if (!slug) {
    console.warn('[snowflake] no template slug found in block');
    return;
  }

  const main = document.querySelector('main');
  if (!main) return;

  // 1. Mark main for scoped CSS before anything renders
  main.setAttribute('data-overlay', slug);

  // 2. Load template CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/styles/${slug}.css`;
  document.head.appendChild(link);

  // 3. Fetch + inject template HTML
  try {
    const resp = await fetch(`/templates/${slug}.html`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching /templates/${slug}.html`);
    const html = await resp.text();

    // Parse the template document and extract <main> content
    const parser = new DOMParser();
    const tDoc = parser.parseFromString(html, 'text/html');
    const tMain = tDoc.querySelector('main') || tDoc.body;

    // Replace main content (pre-decorated — Milo will not re-decorate)
    const frag = document.createDocumentFragment();
    [...tMain.childNodes].forEach((n) => frag.appendChild(n.cloneNode(true)));
    main.innerHTML = '';
    main.appendChild(frag);

    // 4. Activate interactive proto widgets
    main.querySelectorAll('.proto-carousel').forEach((el) => ACTIVATORS.carousel(el));
    main.querySelectorAll('.proto-marquee').forEach((el) => ACTIVATORS.marquee(el));
    main.querySelectorAll('.proto-tabs').forEach((el) => ACTIVATORS.tabs(el));
    main.querySelectorAll('.proto-accordion').forEach((el) => ACTIVATORS.accordion(el));
  } catch (e) {
    console.error('[snowflake] template load failed:', e);
  }
}
