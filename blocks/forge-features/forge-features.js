export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: headline (1 cell with h2)
  const headlineRow = rows[0];
  const headlineCell = headlineRow ? headlineRow.children[0] : null;
  const h2Source = headlineCell ? headlineCell.querySelector('h2') : null;
  const headline = document.createElement('h2');
  headline.className = 'more-headline';
  headline.textContent = h2Source ? h2Source.textContent.trim() : '';

  // Row 1: body (1 cell with p)
  const bodyRow = rows[1];
  const bodyCell = bodyRow ? bodyRow.children[0] : null;
  const pSource = bodyCell ? bodyCell.querySelector('p') : null;
  const body = document.createElement('p');
  body.className = 'more-body';
  body.textContent = pSource ? pSource.textContent.trim() : '';

  // Rows 2+: feature panels
  // 3 cells => flipped (cell 0 = "flipped" flag, cell 1 = copy, cell 2 = image)
  // 2 cells => normal (cell 0 = copy, cell 1 = image)
  const featureGrid = document.createElement('div');
  featureGrid.className = 'feature-grid';

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const cells = [...row.children];
    if (cells.length < 2) continue;

    let isFlipped = false;
    let copyCell;
    let imageCell;

    if (cells.length >= 3 && cells[0].textContent.trim().toLowerCase() === 'flipped') {
      isFlipped = true;
      copyCell = cells[1];
      imageCell = cells[2];
    } else {
      copyCell = cells[0];
      imageCell = cells[1];
    }

    // Build .feature-copy
    const featureCopy = document.createElement('div');
    featureCopy.className = 'feature-copy';

    const h3Source = copyCell.querySelector('h3');
    if (h3Source) {
      const h3 = document.createElement('h3');
      h3.textContent = h3Source.textContent.trim();
      featureCopy.append(h3);
    }

    const pCopy = copyCell.querySelector('p');
    if (pCopy) {
      const p = document.createElement('p');
      p.textContent = pCopy.textContent.trim();
      featureCopy.append(p);
    }

    const aSource = copyCell.querySelector('a');
    if (aSource) {
      const a = document.createElement('a');
      a.className = 'learn-more';
      a.href = aSource.href || '#';
      a.textContent = aSource.textContent.trim();
      featureCopy.append(a);
    }

    // Build .feature-visual > .mock > picture/img
    const mock = document.createElement('div');
    mock.className = 'mock';

    const pictureSource = imageCell.querySelector('picture');
    const imgSource = imageCell.querySelector('img');
    if (pictureSource) {
      mock.append(pictureSource.cloneNode(true));
    } else if (imgSource) {
      mock.append(imgSource.cloneNode(true));
    }

    const featureVisual = document.createElement('div');
    featureVisual.className = 'feature-visual';
    featureVisual.append(mock);

    // Build .feature-panel
    const featurePanel = document.createElement('div');
    featurePanel.className = 'feature-panel';
    if (isFlipped) featurePanel.classList.add('flipped');
    featurePanel.append(featureCopy, featureVisual);

    featureGrid.append(featurePanel);
  }

  // Build .more-section
  const moreSection = document.createElement('div');
  moreSection.className = 'more-section';
  moreSection.append(headline, body, featureGrid);

  // Replace block contents
  block.textContent = '';
  block.append(moreSection);
}
