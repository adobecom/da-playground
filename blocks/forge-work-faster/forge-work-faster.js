export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: headline
  const headline = rows[0]?.children[0]?.innerHTML.trim() || '';
  // Rows 1+: tab cards (2 cells: title | subtitle)
  const tabs = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i].children;
    tabs.push({
      title: cells[0]?.textContent.trim() || '',
      sub: cells[1]?.textContent.trim() || '',
    });
  }

  block.innerHTML = '';

  const hl = document.createElement('h2');
  hl.className = 'fwf-headline';
  hl.innerHTML = headline;
  block.append(hl);

  const grid = document.createElement('div');
  grid.className = 'fwf-grid';

  tabs.forEach(({ title, sub }) => {
    const card = document.createElement('div');
    card.className = 'fwf-card';
    card.innerHTML = `
      <div class="fwf-card-img"></div>
      <h3 class="fwf-card-title">${title}</h3>
      <p class="fwf-card-sub">${sub}</p>
    `;
    grid.append(card);
  });

  block.append(grid);
}
