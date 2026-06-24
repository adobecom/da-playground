export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: eyebrow text
  const eyebrow = rows[0]?.children[0]?.textContent.trim() || 'PDF & Productivity';
  // Row 1: headline
  const headline = rows[1]?.children[0]?.innerHTML.trim() || '';
  // Row 2: body
  const body = rows[2]?.children[0]?.innerHTML.trim() || '';
  // Row 3: CTA link
  const ctaEl = rows[3]?.querySelector('a');
  const ctaText = ctaEl?.textContent.trim() || 'Start an Acrobat free trial';
  const ctaHref = ctaEl?.href || '#';

  // Rows 4-8: doc columns (2 cards each, 5 columns)
  const docCols = [];
  const colOffsets = ['', 'fh-col-offset-down', 'fh-col-offset-mid', 'fh-col-offset-down', ''];
  for (let i = 4; i < 9 && i < rows.length; i += 1) {
    const cells = [...(rows[i]?.children || [])];
    docCols.push(cells.map((c) => c.textContent.trim()));
  }

  block.innerHTML = '';

  // Breadcrumbs
  const crumbs = document.createElement('div');
  crumbs.className = 'fh-breadcrumbs';
  crumbs.innerHTML = `
    <a class="fh-crumb" href="#">Home</a>
    <span class="fh-slash">/</span>
    <span class="fh-crumb">PDF &amp; document essentials</span>
  `;
  block.append(crumbs);

  // Inner wrapper (matches .header-inner constrained width)
  const inner = document.createElement('div');
  inner.className = 'fh-inner';

  // Hero area
  const hero = document.createElement('div');
  hero.className = 'fh-hero';
  hero.innerHTML = `
    <div class="fh-eyebrow">
      <span class="fh-app-tile">Ac</span>
      <span>${eyebrow}</span>
    </div>
    <h1 class="fh-headline">${headline}</h1>
    <p class="fh-body">${body}</p>
    <a class="fh-cta" href="${ctaHref}">
      <span class="fh-cta-icon">Ac</span>
      <span class="fh-cta-label">${ctaText}</span>
      <span class="fh-cta-arrow">&#x2192;</span>
    </a>
  `;

  // Docs grid
  const grid = document.createElement('div');
  grid.className = 'fh-docs-grid';
  const defaultLabels = [
    ['Sign / Signature', 'Document mock'],
    ['Special Report', 'Research'],
    ['Invoice', 'Asset'],
    ['Sales Playbook', 'Q3 Media Mix'],
    ['White Paper', 'Event Flyer'],
  ];

  for (let ci = 0; ci < 5; ci += 1) {
    const labels = docCols[ci] || defaultLabels[ci] || [];
    const col = document.createElement('div');
    col.className = `fh-docs-col${colOffsets[ci] ? ` ${colOffsets[ci]}` : ''}`;
    (labels.length ? labels : defaultLabels[ci] || []).forEach((label) => {
      const card = document.createElement('div');
      card.className = 'fh-doc-card';
      const thumb = document.createElement('div');
      thumb.className = 'fh-doc-thumb';
      thumb.textContent = label;
      card.append(thumb);
      col.append(card);
    });
    grid.append(col);
  }

  inner.append(hero, grid);
  block.append(inner);
}
