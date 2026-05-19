export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  block.innerHTML = '';

  // ── Section heading: single-cell first row containing eyebrow, h2, body ──
  let startIdx = 0;
  const firstCells = [...rows[0].querySelectorAll(':scope > div')];
  if (firstCells.length === 1) {
    const headingRow = rows[0];
    headingRow.classList.add('whats-new-grid-heading');
    const cell = firstCells[0];
    const heading = cell.querySelector('h2, h3');
    if (heading) {
      const prev = heading.previousElementSibling;
      if (prev && prev.tagName === 'P' && !prev.querySelector('a')) {
        prev.classList.add('whats-new-grid-eyebrow');
      }
    }
    block.append(headingRow);
    startIdx = 1;
  }

  // ── Cards: row 1 = featured (full-width), remaining rows = 3-column grid ──
  const cardRows = rows.slice(startIdx);
  const gridEl = document.createElement('div');
  gridEl.className = 'whats-new-grid-columns';

  cardRows.forEach((row, i) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const [mediaCell, textCell] = cells;

    const card = document.createElement('div');
    card.className = i === 0 ? 'whats-new-grid-card featured' : 'whats-new-grid-card';

    // Media cell
    if (mediaCell) {
      const media = document.createElement('div');
      media.className = 'whats-new-grid-media';
      [...mediaCell.childNodes].forEach((n) => media.append(n));
      const img = media.querySelector('img');
      if (img && i === 0) img.loading = 'eager';
      card.append(media);
    }

    // Copy cell — separate text content from CTA links
    if (textCell) {
      const copy = document.createElement('div');
      copy.className = 'whats-new-grid-copy';

      const textWrap = document.createElement('div');
      textWrap.className = 'whats-new-grid-text';

      const links = [...textCell.querySelectorAll('a')];
      const linkParents = [...new Set(links.map((a) => a.closest('p') || a))];

      [...textCell.childNodes].forEach((n) => {
        if (!linkParents.includes(n)) textWrap.append(n);
      });
      copy.append(textWrap);

      if (links.length) {
        const actions = document.createElement('div');
        actions.className = 'whats-new-grid-actions';
        linkParents.forEach((p) => actions.append(p));
        copy.append(actions);
      }

      card.append(copy);
    }

    if (i === 0) {
      block.append(card);
    } else {
      gridEl.append(card);
    }
  });

  if (gridEl.children.length) block.append(gridEl);
}
