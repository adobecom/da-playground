export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: h2 title
  const titleRow = rows[0];
  const titleCell = titleRow ? titleRow.querySelector(':scope > div') : null;
  const h2 = titleCell ? titleCell.querySelector('h2') : null;
  if (h2) {
    h2.className = 'title-2';
    h2.removeAttribute('style');
  }

  // Row 1: body text
  const bodyRow = rows[1];
  const bodyCell = bodyRow ? bodyRow.querySelector(':scope > div') : null;
  const bodyP = bodyCell ? bodyCell.querySelector('p') : null;
  if (bodyP) bodyP.className = 'jtbd-body';

  // Row 2: left image | left h3 title | left body text
  const leftRow = rows[2];
  const leftCells = leftRow ? [...leftRow.querySelectorAll(':scope > div')] : [];
  const [leftImgCell, leftH3Cell, leftBodyCell] = leftCells;

  const leftWrap = document.createElement('div');
  leftWrap.className = 'jtbd-left-wrap';

  if (leftImgCell) {
    const pic = leftImgCell.querySelector('picture');
    const img = leftImgCell.querySelector('img');
    if (pic) leftWrap.append(pic);
    else if (img) leftWrap.append(img);
  }

  const leftCopy = document.createElement('div');
  leftCopy.className = 'jtbd-left-copy';
  if (leftH3Cell) {
    const h3 = leftH3Cell.querySelector('h3') || document.createElement('h3');
    if (!leftH3Cell.querySelector('h3')) h3.textContent = (leftH3Cell.textContent || '').trim();
    leftCopy.append(h3);
  }
  if (leftBodyCell) {
    const p = leftBodyCell.querySelector('p') || document.createElement('p');
    if (!leftBodyCell.querySelector('p')) p.textContent = (leftBodyCell.textContent || '').trim();
    leftCopy.append(p);
  }
  leftWrap.append(leftCopy);

  // Row 3: right image | right h3 title | right body text
  const rightRow = rows[3];
  const rightCells = rightRow ? [...rightRow.querySelectorAll(':scope > div')] : [];
  const [rightImgCell, rightH3Cell, rightBodyCell] = rightCells;

  const right = document.createElement('div');
  right.className = 'jtbd-right';

  const rightImgWrap = document.createElement('div');
  rightImgWrap.className = 'jtbd-right-img';
  if (rightImgCell) {
    const pic = rightImgCell.querySelector('picture');
    const img = rightImgCell.querySelector('img');
    if (pic) rightImgWrap.append(pic);
    else if (img) rightImgWrap.append(img);
  }

  const rightCopy = document.createElement('div');
  rightCopy.className = 'jtbd-right-copy';
  if (rightH3Cell) {
    const h3 = rightH3Cell.querySelector('h3') || document.createElement('h3');
    if (!rightH3Cell.querySelector('h3')) h3.textContent = (rightH3Cell.textContent || '').trim();
    rightCopy.append(h3);
  }
  if (rightBodyCell) {
    const p = rightBodyCell.querySelector('p') || document.createElement('p');
    if (!rightBodyCell.querySelector('p')) p.textContent = (rightBodyCell.textContent || '').trim();
    rightCopy.append(p);
  }

  right.append(rightImgWrap, rightCopy);

  // Cols container
  const cols = document.createElement('div');
  cols.className = 'jtbd-cols';
  cols.append(leftWrap, right);

  // Header group
  const headerGroup = document.createElement('div');
  headerGroup.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center';
  if (h2) headerGroup.append(h2);
  if (bodyP) headerGroup.append(bodyP);

  // Build section
  const section = document.createElement('section');
  section.className = 'jtbd';
  section.append(headerGroup, cols);

  block.innerHTML = '';
  block.append(section);
}
