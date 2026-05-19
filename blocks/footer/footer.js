export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  const navCols = [];
  let logoEl = null;
  let productsEl = null;
  const bottomCells = [];

  rows.forEach((row, idx) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (!cells.length) return;

    // ── Single-cell rows ──────────────────────────────────────────
    if (cells.length === 1) {
      const cell = cells[0];

      if (idx === 0) {
        // First single-cell row → Logo
        logoEl = document.createElement('div');
        logoEl.className = 'footer-logo';
        [...cell.childNodes].forEach((n) => logoEl.append(n));
        return;
      }

      // Remaining single-cell rows → bottom bar content (legal or social)
      bottomCells.push(cell);
      return;
    }

    // ── Two-cell rows ─────────────────────────────────────────────
    const [headCell, contentCell] = cells;
    const headText = headCell.textContent.trim();

    if (/featured\s+products?/i.test(headText)) {
      // Featured products section
      productsEl = document.createElement('div');
      productsEl.className = 'footer-products';

      const label = document.createElement('p');
      label.className = 'footer-products-label';
      label.textContent = headText;
      productsEl.append(label);

      const list = document.createElement('div');
      list.className = 'footer-products-list';

      // Each direct child is a product item (icon + label)
      const productItems = [...contentCell.children];
      if (productItems.length) {
        productItems.forEach((child) => {
          const item = document.createElement('div');
          item.className = 'footer-product-item';
          [...child.childNodes].forEach((n) => item.append(n));
          list.append(item);
        });
      } else {
        // Fallback: move content directly
        [...contentCell.childNodes].forEach((n) => list.append(n));
      }

      productsEl.append(list);
      return;
    }

    // ── Nav column ────────────────────────────────────────────────
    const col = document.createElement('div');
    col.className = 'footer-nav-col';

    const heading = document.createElement('p');
    heading.className = 'footer-nav-heading';
    heading.textContent = headText;
    col.append(heading);

    const ul = document.createElement('ul');
    ul.className = 'footer-nav-list';

    // Prefer direct <p> or <li> children for link items
    const items = [...contentCell.querySelectorAll(':scope > p, :scope > li')];
    if (items.length) {
      items.forEach((item) => {
        if (!item.textContent.trim()) return;
        const li = document.createElement('li');
        [...item.childNodes].forEach((n) => li.append(n));
        ul.append(li);
      });
    } else {
      // Fallback: each direct child becomes a list item
      [...contentCell.children].forEach((child) => {
        if (!child.textContent.trim()) return;
        const li = document.createElement('li');
        [...child.childNodes].forEach((n) => li.append(n));
        ul.append(li);
      });
    }

    col.append(ul);
    navCols.push(col);
  });

  // ── Assemble bottom bar ───────────────────────────────────────
  let bottomEl = null;
  if (bottomCells.length) {
    bottomEl = document.createElement('div');
    bottomEl.className = 'footer-bottom';

    bottomCells.forEach((cell) => {
      const links = [...cell.querySelectorAll('a')];
      const text = cell.textContent.trim();

      // Classify as social if short link text and no copyright symbol
      const isSocial = links.length >= 2
        && !text.includes('©')
        && links.every((a) => a.textContent.trim().length < 30);

      const section = document.createElement('div');
      section.className = isSocial ? 'footer-social' : 'footer-legal';
      [...cell.childNodes].forEach((n) => section.append(n));
      bottomEl.append(section);
    });
  }

  // ── Build final structure ─────────────────────────────────────
  if (logoEl) inner.append(logoEl);

  if (navCols.length) {
    const nav = document.createElement('nav');
    nav.className = 'footer-nav';
    nav.setAttribute('aria-label', 'Footer');
    navCols.forEach((c) => nav.append(c));
    inner.append(nav);
  }

  if (productsEl) inner.append(productsEl);
  if (bottomEl) inner.append(bottomEl);

  block.innerHTML = '';
  block.append(inner);
}
