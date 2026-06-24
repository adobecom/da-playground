function buildCard(cells) {
  // cells: [picture cell] [heading + body cell] [link cell]
  const imgCell = cells[0];
  const textCell = cells[1];
  const linkCell = cells[2];

  const picture = imgCell?.querySelector('picture, img');
  const heading = textCell?.querySelector('h4')?.outerHTML ?? '';
  const body = textCell?.querySelector('p')?.outerHTML ?? '';
  const link = linkCell?.querySelector('a');
  const linkHtml = link ? `<a href="${link.href}">${link.textContent.trim()}</a>` : '';

  const imgHtml = picture
    ? `<div class="wn-img">${picture.outerHTML}</div>`
    : '<div class="wn-img"></div>';

  return `
    <div class="wn-card">
      ${imgHtml}
      ${heading}
      ${body}
      ${linkHtml}
    </div>
  `;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: eyebrow text
  const eyebrowText = rows[0]?.querySelector('div')?.textContent?.trim() ?? '';
  // Row 1: headline
  const headlineEl = rows[1]?.querySelector('h2');
  const headlineHtml = headlineEl
    ? headlineEl.outerHTML
    : `<h2 class="wn-headline">${rows[1]?.querySelector('div')?.textContent?.trim() ?? ''}</h2>`;

  // Rows 2+ are cards (3 cells each)
  const cardRows = rows.slice(2);
  const cardsHtml = cardRows.map((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    return buildCard(cells);
  }).join('');

  // Ensure headline has the right class
  const headlineFixed = headlineHtml.replace('<h2', '<h2 class="wn-headline"');

  block.innerHTML = `
    <div class="whats-new">
      <p class="wn-eyebrow">${eyebrowText}</p>
      ${headlineFixed}
      <div class="wn-grid">
        ${cardsHtml}
      </div>
    </div>
  `;
}
