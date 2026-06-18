/**
 * forge-features — features 3-up grid block
 * DA content model:
 *   Row 0: section head — single cell with h2 + p (description)
 *   Row 1–3: feature cards — single cell with h3 + p
 */

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Row 0 = section head
  const headRow = rows[0];
  const headCell = headRow.querySelector(':scope > div');
  const headEl = document.createElement('div');
  headEl.className = 'section__head';
  if (headCell) {
    // Migrate h2 and first p into section__head
    const h2 = headCell.querySelector('h2');
    const p = headCell.querySelector('p');
    if (h2) headEl.appendChild(h2.cloneNode(true));
    if (p) headEl.appendChild(p.cloneNode(true));
  }

  // Rows 1+ = feature cards
  const grid = document.createElement('div');
  grid.className = 'features__grid';

  rows.slice(1).forEach((row) => {
    const cell = row.querySelector(':scope > div');
    if (!cell) return;
    const article = document.createElement('article');
    article.className = 'feature';
    const h3 = cell.querySelector('h3');
    const p = cell.querySelector('p');
    if (h3) article.appendChild(h3.cloneNode(true));
    if (p) article.appendChild(p.cloneNode(true));
    grid.appendChild(article);
  });

  block.textContent = '';
  block.appendChild(headEl);
  block.appendChild(grid);
}
