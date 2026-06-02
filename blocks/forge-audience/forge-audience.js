/**
 * forge-audience block
 * DA rows (positional):
 *   0   — section heading (h2)
 *   1–N — one row per audience card: image | heading | description | link
 */
export default function decorate(block) {
  const rows = [...block.children];
  const headingRow = rows[0];
  const cardRows = rows.slice(1);

  const h2 = headingRow?.querySelector('h1,h2,h3,h4') || (() => {
    const h = document.createElement('h2');
    h.textContent = headingRow?.textContent?.trim() || '';
    return h;
  })();
  h2.tagName !== 'H2' && (h2.outerHTML = `<h2>${h2.innerHTML}</h2>`);

  const sectionHead = document.createElement('div');
  sectionHead.className = 'section-head';
  sectionHead.setAttribute('data-anim', '');

  const safeH2 = document.createElement('h2');
  safeH2.textContent = headingRow?.textContent?.trim() || '';
  sectionHead.append(safeH2);

  const grid = document.createElement('div');
  grid.className = 'aud__grid';

  cardRows.forEach((row) => {
    const cells = [...row.children];
    const imgEl = cells[0]?.querySelector('img');
    const picture = cells[0]?.querySelector('picture') || imgEl;
    const cardHeading = cells[1]?.textContent?.trim() || '';
    const cardBody = cells[2]?.textContent?.trim() || '';
    const linkEl = cells[3]?.querySelector('a');

    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-anim', '');

    const mediaDv = document.createElement('div');
    mediaDv.className = 'card__media';
    if (picture) mediaDv.append(picture);
    card.append(mediaDv);

    const h3 = document.createElement('h3');
    h3.textContent = cardHeading;
    card.append(h3);

    const p = document.createElement('p');
    p.textContent = cardBody;
    card.append(p);

    if (linkEl) {
      const a = document.createElement('a');
      a.href = linkEl.href;
      a.textContent = linkEl.textContent;
      a.className = 'more';
      card.append(a);
    }

    grid.append(card);
  });

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(sectionHead, grid);

  block.textContent = '';
  block.id = 'audience';
  block.append(wrap);
}
