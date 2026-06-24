export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: headline
  const headline = rows[0]?.children[0]?.innerHTML.trim() || '';
  // Row 1: body text
  const body = rows[1]?.children[0]?.innerHTML.trim() || '';
  // Rows 2+: feature panels (3 cells: heading | body | link)
  const panels = [];
  for (let i = 2; i < rows.length; i += 1) {
    const cells = rows[i].children;
    const linkEl = cells[2]?.querySelector('a');
    panels.push({
      heading: cells[0]?.innerHTML.trim() || '',
      text: cells[1]?.innerHTML.trim() || '',
      linkText: linkEl?.textContent.trim() || 'Learn more',
      linkHref: linkEl?.href || '#',
      flipped: (i - 2) % 2 === 1,
    });
  }

  block.innerHTML = '';

  const hl = document.createElement('h2');
  hl.className = 'fam-headline';
  hl.innerHTML = headline;
  block.append(hl);

  const bd = document.createElement('p');
  bd.className = 'fam-body';
  bd.innerHTML = body;
  block.append(bd);

  const featureGrid = document.createElement('div');
  featureGrid.className = 'fam-feature-grid';

  panels.forEach(({ heading, text, linkText, linkHref, flipped }) => {
    const panel = document.createElement('div');
    panel.className = `fam-panel${flipped ? ' fam-panel-flipped' : ''}`;

    const copy = document.createElement('div');
    copy.className = 'fam-copy';
    copy.innerHTML = `
      <h3>${heading}</h3>
      <p>${text}</p>
      <a href="${linkHref}" class="fam-learn-more">${linkText}</a>
    `;

    const visual = document.createElement('div');
    visual.className = 'fam-visual';
    const mock = document.createElement('div');
    mock.className = 'fam-mock';
    visual.append(mock);

    if (flipped) {
      panel.append(visual, copy);
    } else {
      panel.append(copy, visual);
    }
    featureGrid.append(panel);
  });

  block.append(featureGrid);
}
