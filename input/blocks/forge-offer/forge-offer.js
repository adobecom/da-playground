export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: single cell with picture/img
  const row = rows[0];
  const cell = row ? row.querySelector(':scope > div') : null;

  const section = document.createElement('section');
  section.className = 'offer';

  if (cell) {
    const pic = cell.querySelector('picture');
    const img = cell.querySelector('img');
    if (pic) {
      section.append(pic);
    } else if (img) {
      img.style.cssText = 'width:100%;display:block';
      section.append(img);
    }
  }

  block.innerHTML = '';
  block.append(section);
}
