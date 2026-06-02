export default function decorate(block) {
  const rows = [...block.children];
  block.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'fpc-container';

  const grid = document.createElement('div');
  grid.className = 'fpc-grid';

  rows.forEach((row) => {
    const cells = [...row.children];
    const name      = cells[0]?.textContent?.trim() || '';
    const desc      = cells[1]?.textContent?.trim() || '';
    const ctaLabel  = cells[2]?.textContent?.trim() || '';
    const ctaHref   = cells[3]?.textContent?.trim() || '#';
    const featured  = cells[4]?.textContent?.trim()?.toLowerCase() === 'true';
    const flagLabel = cells[5]?.textContent?.trim() || '';

    const card = document.createElement('article');
    card.className = 'fpc-card' + (featured ? ' fpc-card--featured' : '');
    card.setAttribute('data-tile-anim', '');

    if (featured && flagLabel) {
      const flag = document.createElement('span');
      flag.className = 'fpc-flag';
      flag.textContent = flagLabel;
      card.appendChild(flag);
    }

    const nameEl = document.createElement('h3');
    nameEl.className = 'fpc-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);

    // Price placeholder (commerce-injected — represented as an empty price row)
    const priceDiv = document.createElement('div');
    priceDiv.className = 'fpc-price';
    const pricePlaceholder = document.createElement('span');
    pricePlaceholder.className = 'fpc-price-placeholder';
    pricePlaceholder.textContent = '—';
    pricePlaceholder.setAttribute('aria-label', 'Price coming soon');
    priceDiv.appendChild(pricePlaceholder);
    card.appendChild(priceDiv);

    const descEl = document.createElement('p');
    descEl.className = 'fpc-desc';
    descEl.textContent = desc;
    card.appendChild(descEl);

    const cta = document.createElement('a');
    cta.className = 'fpc-btn' + (featured ? ' fpc-btn--primary' : ' fpc-btn--outline');
    cta.href = ctaHref;
    cta.textContent = ctaLabel;
    card.appendChild(cta);
    grid.appendChild(card);
  });

  container.appendChild(grid);
  block.appendChild(container);
}
