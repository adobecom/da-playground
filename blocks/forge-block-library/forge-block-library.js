/**
 * forge-block-library — block catalogue tile grid
 * DA content model:
 *   Row 0: section head — h2 + p
 *   Row 1–8: tiles — 2 cells: [badge-category] [title link (a href)]
 *   Last row: "browse all" link row — single cell with link
 */

const ARROW_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"
  stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Row 0 = section head
  const headRow = rows[0];
  const headCell = headRow.querySelector(':scope > div');
  const headEl = document.createElement('div');
  headEl.className = 'section__head';
  if (headCell) {
    const h2 = headCell.querySelector('h2');
    const p = headCell.querySelector('p');
    if (h2) headEl.appendChild(h2.cloneNode(true));
    if (p) headEl.appendChild(p.cloneNode(true));
  }

  // Grid
  const grid = document.createElement('div');
  grid.className = 'blocks__grid';

  // "Browse all" link (last row — single cell with a link, no badge)
  let moreEl = null;

  rows.slice(1).forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (!cells.length) return;

    // Check if this is a "browse all" row: single cell or first cell has no badge-like text
    const firstCell = cells[0];
    const link = firstCell.querySelector('a');

    if (cells.length === 1 && link) {
      // This is the "browse all" row
      moreEl = document.createElement('p');
      moreEl.className = 'blocks__more';
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.textContent.trim();
      a.innerHTML = a.textContent + ' ' + ARROW_ICON;
      moreEl.appendChild(a);
      return;
    }

    // Tile row: [badge] [link]
    const badgeText = cells[0]?.textContent.trim();
    const linkCell = cells[1] || cells[0];
    const tileLink = linkCell?.querySelector('a');
    if (!tileLink) return;

    const tile = document.createElement('a');
    tile.className = 'tile';
    tile.href = tileLink.href;

    if (badgeText) {
      const badge = document.createElement('span');
      badge.className = 'tile__badge';
      badge.textContent = badgeText;
      tile.appendChild(badge);
    }

    const h3 = document.createElement('h3');
    h3.textContent = tileLink.textContent.trim();
    tile.appendChild(h3);

    grid.appendChild(tile);
  });

  block.textContent = '';
  block.appendChild(headEl);
  block.appendChild(grid);
  if (moreEl) block.appendChild(moreEl);
}
