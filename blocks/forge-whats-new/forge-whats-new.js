export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: eyebrow
  const eyebrow = rows[0]?.children[0]?.textContent.trim() || 'Features and Releases';
  // Row 1: headline
  const headline = rows[1]?.children[0]?.innerHTML.trim() || '';
  // Rows 2+: cards (3 cells: title | body | link)
  const cards = [];
  for (let i = 2; i < rows.length; i += 1) {
    const cells = rows[i].children;
    const linkEl = cells[2]?.querySelector('a');
    cards.push({
      title: cells[0]?.textContent.trim() || '',
      body: cells[1]?.innerHTML.trim() || '',
      linkText: linkEl?.textContent.trim() || 'Learn more',
      linkHref: linkEl?.href || '#',
    });
  }

  block.innerHTML = '';

  const ey = document.createElement('p');
  ey.className = 'fwn-eyebrow';
  ey.textContent = eyebrow;
  block.append(ey);

  const hl = document.createElement('h2');
  hl.className = 'fwn-headline';
  hl.innerHTML = headline;
  block.append(hl);

  const grid = document.createElement('div');
  grid.className = 'fwn-grid';

  cards.forEach(({ title, body, linkText, linkHref }) => {
    const card = document.createElement('div');
    card.className = 'fwn-card';
    card.innerHTML = `
      <div class="fwn-img"></div>
      <h4>${title}</h4>
      <p>${body}</p>
      <a href="${linkHref}">${linkText}</a>
    `;
    grid.append(card);
  });

  block.append(grid);
}
