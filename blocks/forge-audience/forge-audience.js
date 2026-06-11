export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: h2 title
  const titleRow = rows[0];
  const titleCell = titleRow.querySelector(':scope > div');
  const h2 = titleCell ? titleCell.querySelector('h2') : null;
  if (h2) {
    h2.className = 'title-2';
    h2.removeAttribute('style');
  }

  // Rows 1-4: role cards
  const cardDefs = [rows[1], rows[2], rows[3], rows[4]].filter(Boolean);
  const routingRow = document.createElement('div');
  routingRow.className = 'routing-row';

  cardDefs.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const [titleCell, imgCell, footCell] = cells;

    const card = document.createElement('div');
    card.className = 'rcard';

    // head
    const head = document.createElement('div');
    head.className = 'rcard-head';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'rcard-title';
    titleSpan.textContent = titleCell ? (titleCell.textContent || '').trim() : '';
    head.append(titleSpan);

    // img
    const imgWrap = document.createElement('div');
    imgWrap.className = 'rcard-img';
    if (imgCell) {
      const pic = imgCell.querySelector('picture');
      const img = imgCell.querySelector('img');
      if (pic) imgWrap.append(pic);
      else if (img) imgWrap.append(img);
    }

    // foot
    const foot = document.createElement('div');
    foot.className = 'rcard-foot';
    foot.textContent = footCell ? (footCell.textContent || '').trim() : '';

    card.append(head, imgWrap, foot);
    routingRow.append(card);
  });

  // Row 5: logo bar
  const logoRow = rows[5];
  const logoBarWrap = document.createElement('div');
  logoBarWrap.className = 'logo-bar-wrap';
  if (logoRow) {
    const logoCell = logoRow.querySelector(':scope > div');
    if (logoCell) {
      const pic = logoCell.querySelector('picture');
      const img = logoCell.querySelector('img');
      if (pic) logoBarWrap.append(pic);
      else if (img) logoBarWrap.append(img);
    }
  }

  // Build section
  const section = document.createElement('section');
  section.className = 'audience';
  if (h2) section.append(h2);
  section.append(routingRow);
  section.append(logoBarWrap);

  block.innerHTML = '';
  block.append(section);
}
