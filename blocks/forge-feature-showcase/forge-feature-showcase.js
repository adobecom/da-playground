/**
 * forge-feature-showcase block
 * DA rows (positional):
 *   0    — section heading (h2) — 1 cell
 *   1    — LEAD feature — 4 cells: image | chip-label | heading | body+link
 *   2–6  — regular features — 3 cells: image | heading | body+link
 *
 * The decorator uses cell count to differentiate lead vs regular.
 */
export default function decorate(block) {
  const rows = [...block.children];
  const headingRow = rows[0];
  const featureRows = rows.slice(1);

  /* Section heading */
  const sectionHead = document.createElement('div');
  sectionHead.className = 'section-head';
  sectionHead.setAttribute('data-anim', '');

  const h2 = document.createElement('h2');
  h2.textContent = headingRow?.textContent?.trim() || '';
  sectionHead.append(h2);

  /* Feature grid */
  const grid = document.createElement('div');
  grid.className = 'feat__grid';

  featureRows.forEach((row, idx) => {
    const cells = [...row.children];
    const isLead = idx === 0; /* first feature is always the lead */

    const article = document.createElement('article');
    article.className = isLead ? 'feat feat--lead' : 'feat';
    article.setAttribute('data-anim', '');

    /* Image cell — always first */
    const imgCell = cells[0];
    const picture = imgCell?.querySelector('picture') || imgCell?.querySelector('img');
    const mediaDv = document.createElement('div');
    mediaDv.className = 'feat__media';
    if (picture) mediaDv.append(picture);

    if (isLead) {
      /* Lead: image | chip | heading | body+link — 4 cells */
      const chipText = cells[1]?.textContent?.trim() || '';
      const headingText = cells[2]?.textContent?.trim() || '';
      const bodyCell = cells[3];
      const linkEl = bodyCell?.querySelector('a') || cells[3]?.querySelector('a');
      const bodyText = bodyCell?.querySelector('p')?.textContent?.trim()
        || bodyCell?.textContent?.trim().replace(linkEl?.textContent || '', '').trim()
        || '';

      article.append(mediaDv);

      const body = document.createElement('div');
      body.className = 'feat__body';

      if (chipText) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = chipText;
        body.append(chip);
      }

      const h3 = document.createElement('h3');
      h3.textContent = headingText;
      body.append(h3);

      const p = document.createElement('p');
      p.textContent = bodyText;
      body.append(p);

      if (linkEl) {
        const a = document.createElement('a');
        a.href = linkEl.href;
        a.textContent = linkEl.textContent;
        a.className = 'more';
        body.append(a);
      }
      article.append(body);
    } else {
      /* Regular: image | heading | body+link — 3 cells */
      const headingText = cells[1]?.textContent?.trim() || '';
      const bodyCell = cells[2];
      const linkEl = bodyCell?.querySelector('a');
      const bodyText = bodyCell?.querySelector('p')?.textContent?.trim()
        || bodyCell?.textContent?.trim().replace(linkEl?.textContent || '', '').trim()
        || '';

      article.append(mediaDv);

      const h3 = document.createElement('h3');
      h3.textContent = headingText;
      article.append(h3);

      const p = document.createElement('p');
      p.textContent = bodyText;
      article.append(p);

      if (linkEl) {
        const a = document.createElement('a');
        a.href = linkEl.href;
        a.textContent = linkEl.textContent;
        a.className = 'more';
        article.append(a);
      }
    }

    grid.append(article);
  });

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(sectionHead, grid);

  block.textContent = '';
  block.id = 'features';
  block.append(wrap);
}
