/**
 * forge-features — Dark feature showcase.
 *
 * DA content shape:
 *   Row 0  | Col 0: section heading h2
 *   Row 1  | Col 0: lead feature image  | Col 1: "Beta" chip text + h3 + p + a
 *   Row 2+ | Col 0: feature image + h3 + p + a  (single cell, or 2 cells)
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Section head (row 0)
  const sectionHead = document.createElement('div');
  sectionHead.className = 'section-head';
  const headCell = rows[0]?.querySelector(':scope > div');
  if (headCell) {
    const h2 = headCell.querySelector('h2') || document.createElement('h2');
    if (!h2.textContent) h2.textContent = headCell.textContent.trim();
    sectionHead.append(h2);
  }

  // Feature grid
  const grid = document.createElement('div');
  grid.className = 'feat__grid';

  // Row 1 = lead feature
  if (rows[1]) {
    const leadCells = [...rows[1].querySelectorAll(':scope > div')];
    const article = document.createElement('article');
    article.className = 'feat feat--lead';

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'feat__media';
    const imgCell = leadCells[0];
    if (imgCell) {
      const img = imgCell.querySelector('img');
      if (img) img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      mediaWrap.append(...imgCell.children);
    }

    const body = document.createElement('div');
    body.className = 'feat__body';
    const bodyCell = leadCells[1] || leadCells[0];
    if (bodyCell) {
      // First p that has no img = chip text
      const allP = [...bodyCell.querySelectorAll('p')];
      const chipP = allP.find((p) => !p.querySelector('img') && p !== allP.find((q) => q.querySelector('a')));
      if (chipP && chipP !== allP[allP.length - 1]) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = chipP.textContent.trim();
        body.append(chip);
        chipP.remove();
      }
      const h3 = bodyCell.querySelector('h3');
      const p = bodyCell.querySelector('p:not(:has(a))') || bodyCell.querySelector('p');
      const a = bodyCell.querySelector('a');
      if (h3) body.append(h3);
      if (p && p !== a?.closest('p')) body.append(p);
      if (a) {
        a.className = 'more';
        body.append(a);
      }
    }

    article.append(mediaWrap, body);
    grid.append(article);
  }

  // Rows 2+ = regular features
  rows.slice(2).forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const article = document.createElement('article');
    article.className = 'feat';

    // If 2 cells: img | body; if 1 cell: all in one
    if (cells.length >= 2) {
      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'feat__media';
      const img = cells[0].querySelector('img');
      if (img) img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      mediaWrap.append(...cells[0].children);

      const h3 = cells[1].querySelector('h3');
      const p = cells[1].querySelector('p:not(:has(a))') || cells[1].querySelector('p');
      const a = cells[1].querySelector('a');

      article.append(mediaWrap);
      if (h3) article.append(h3);
      if (p && p !== a?.closest('p')) article.append(p);
      if (a) { a.className = 'more'; article.append(a); }
    } else {
      const cell = cells[0];
      if (!cell) { grid.append(article); return; }

      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'feat__media';
      const img = cell.querySelector('img');
      if (img) {
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        const pic = img.closest('picture') || img;
        mediaWrap.append(pic);
      }

      const h3 = cell.querySelector('h3');
      const ps = [...cell.querySelectorAll('p')];
      const a = cell.querySelector('a');
      const textP = ps.find((p) => !p.querySelector('img') && p !== a?.closest('p'));

      article.append(mediaWrap);
      if (h3) article.append(h3);
      if (textP) article.append(textP);
      if (a) { a.className = 'more'; article.append(a); }
    }

    grid.append(article);
  });

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(sectionHead, grid);

  block.innerHTML = '';
  block.append(wrap);
}
