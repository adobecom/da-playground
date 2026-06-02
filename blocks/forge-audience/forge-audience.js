/**
 * forge-audience — Audience routing cards (3-up).
 *
 * DA content shape:
 *   Row 0 | Col 0: section heading (h2)
 *   Row 1 | Col 0: card image (picture/img)  | Col 1: h3 + p + a
 *   Row 2 | Col 0: card image                | Col 1: h3 + p + a
 *   Row 3 | Col 0: card image                | Col 1: h3 + p + a
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Section head
  const sectionHead = document.createElement('div');
  sectionHead.className = 'section-head';
  const headRow = rows[0];
  const headCell = headRow?.querySelector(':scope > div');
  if (headCell) {
    // Move h2 (or create from text) into sectionHead
    const h2 = headCell.querySelector('h2') || document.createElement('h2');
    if (!h2.textContent) h2.textContent = headCell.textContent.trim();
    sectionHead.append(h2);
  }

  // Card grid
  const grid = document.createElement('div');
  grid.className = 'aud__grid';

  rows.slice(1).forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const [imgCell, bodyCell] = cells;

    const article = document.createElement('article');
    article.className = 'card';

    // Media
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'card__media';
    if (imgCell) {
      const img = imgCell.querySelector('img');
      if (img) {
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      }
      mediaWrap.append(...imgCell.children);
    }
    article.append(mediaWrap);

    // Body
    if (bodyCell) {
      const h3 = bodyCell.querySelector('h3');
      const p = bodyCell.querySelector('p');
      const a = bodyCell.querySelector('a');

      if (h3) article.append(h3);
      if (p) { p.style.cssText = ''; article.append(p); }
      if (a) {
        a.className = 'more';
        article.append(a);
      }
    }

    grid.append(article);
  });

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(sectionHead, grid);

  block.innerHTML = '';
  block.append(wrap);
}
