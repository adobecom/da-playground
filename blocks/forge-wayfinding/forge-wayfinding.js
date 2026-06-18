/**
 * forge-wayfinding — dark wayfinding band
 * DA content model:
 *   Row 0: single cell with h2 + nav links (as paragraphs with links) + CTA link
 *
 * Or 2-cell row:
 *   Cell 0: h2
 *   Cell 1: nav links + CTA
 */

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const mainRow = rows[0];
  const cells = [...mainRow.querySelectorAll(':scope > div')];

  const inner = document.createElement('div');
  inner.className = 'wayfinding__inner';

  let h2El = null;
  const navLinks = [];
  let ctaLink = null;

  // Gather from all cells
  cells.forEach((cell) => {
    const h2 = cell.querySelector('h2');
    if (h2 && !h2El) {
      h2El = h2;
    }
    const links = [...cell.querySelectorAll('a')];
    links.forEach((link) => {
      const text = link.textContent.trim();
      // Detect CTA: strong wraps the link (<strong><a>) or link wraps strong (<a><strong>)
      // DA may normalize either way, so check both
      const parent = link.parentElement;
      const isStrong = parent?.nodeName === 'STRONG'
        || parent?.closest('strong')
        || link.querySelector('strong') != null;
      if (isStrong) {
        if (!ctaLink) ctaLink = { href: link.href, text };
      } else {
        navLinks.push({ href: link.href, text });
      }
    });
  });

  // If we couldn't distinguish CTA from nav, use heuristic: last link = CTA
  // but only if there are enough nav links
  if (!ctaLink && navLinks.length > 4) {
    const last = navLinks.pop();
    ctaLink = last;
  }

  // H2
  if (h2El) {
    const newH2 = h2El.cloneNode(true);
    inner.appendChild(newH2);
  }

  // Row: nav + CTA
  const row = document.createElement('div');
  row.className = 'wayfinding__row';

  if (navLinks.length) {
    const nav = document.createElement('nav');
    nav.className = 'wayfinding__nav';
    nav.setAttribute('aria-label', 'Site sections');
    navLinks.forEach(({ href, text }) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      nav.appendChild(a);
    });
    row.appendChild(nav);
  }

  if (ctaLink) {
    const a = document.createElement('a');
    a.className = 'btn btn--primary';
    a.href = ctaLink.href;
    a.textContent = ctaLink.text;
    row.appendChild(a);
  }

  inner.appendChild(row);

  block.textContent = '';
  block.appendChild(inner);
}
