const CHEVRON_SVG = `<svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 1l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  const getCells = (rowIndex) => {
    const row = rows[rowIndex];
    if (!row) return [];
    return [...row.querySelectorAll(':scope > div')];
  };

  // Row 0: [eyebrow text] | [h2 title text]
  const headerCells = getCells(0);
  const eyebrowText = headerCells[0]?.textContent?.trim() ?? '';
  const titleCell = headerCells[1];
  let titleHtml = '';
  if (titleCell) {
    const h2El = titleCell.querySelector('h2');
    titleHtml = h2El ? h2El.innerHTML : titleCell.textContent.trim();
  }

  // Rows 1-3: [feature image (picture)] | [feature title] | [feature body text]
  const features = [1, 2, 3].map((rowIdx) => {
    const cells = getCells(rowIdx);
    const picEl = cells[0]?.querySelector('picture, img') ?? null;
    const titleText = cells[1]?.textContent?.trim() ?? '';
    const bodyText = cells[2]?.textContent?.trim() ?? '';
    return { picEl, titleText, bodyText };
  });

  // Build section
  const section = document.createElement('section');
  section.className = 'whats-new';

  // Header
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center';

  const eyebrow = document.createElement('span');
  eyebrow.className = 'wn-eyebrow';
  eyebrow.textContent = eyebrowText;

  const h2 = document.createElement('h2');
  h2.className = 'wn-title';
  h2.innerHTML = titleHtml;

  headerDiv.appendChild(eyebrow);
  headerDiv.appendChild(h2);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'wn-grid';

  features.forEach(({ picEl, titleText, bodyText }) => {
    const col = document.createElement('div');
    col.className = 'wn-col';

    // Asset
    const assetDiv = document.createElement('div');
    assetDiv.className = 'wn-asset';
    if (picEl) {
      assetDiv.appendChild(picEl.cloneNode(true));
    }

    // Copy
    const copyDiv = document.createElement('div');
    copyDiv.className = 'wn-copy';

    const textWrap = document.createElement('div');

    const titleSm = document.createElement('span');
    titleSm.className = 'wn-title-sm';
    titleSm.textContent = titleText;

    const bodyP = document.createElement('p');
    bodyP.className = 'wn-body';
    bodyP.textContent = bodyText;

    textWrap.appendChild(titleSm);
    textWrap.appendChild(bodyP);

    const ctaDiv = document.createElement('div');
    ctaDiv.className = 'wn-cta';

    const ctaLabel = document.createElement('span');
    ctaLabel.textContent = 'Learn more';

    ctaDiv.appendChild(ctaLabel);
    ctaDiv.innerHTML += CHEVRON_SVG;

    copyDiv.appendChild(textWrap);
    copyDiv.appendChild(ctaDiv);

    col.appendChild(assetDiv);
    col.appendChild(copyDiv);
    grid.appendChild(col);
  });

  section.appendChild(headerDiv);
  section.appendChild(grid);

  block.innerHTML = '';
  block.appendChild(section);
}
