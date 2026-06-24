export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: eyebrow
  const eyebrowText = rows[0]?.querySelector('div')?.textContent?.trim() ?? '';
  // Row 1: headline
  const headlineEl = rows[1]?.querySelector('h2');
  const headlineHtml = headlineEl
    ? headlineEl.outerHTML.replace('<h2', '<h2 class="search-headline"')
    : `<h2 class="search-headline">${rows[1]?.querySelector('div')?.textContent?.trim() ?? ''}</h2>`;
  // Row 2: body text
  const bodyEl = rows[2]?.querySelector('p');
  const bodyHtml = bodyEl
    ? bodyEl.outerHTML.replace('<p', '<p class="search-body"')
    : `<p class="search-body">${rows[2]?.querySelector('div')?.textContent?.trim() ?? ''}</p>`;
  // Row 3: [placeholder text] [CTA link]
  const row3Cells = rows[3] ? [...rows[3].querySelectorAll(':scope > div')] : [];
  const inputPlaceholder = row3Cells[0]?.textContent?.trim() ?? 'Ask anything';
  const ctaEl = row3Cells[1]?.querySelector('a');
  const ctaText = ctaEl?.textContent?.trim() ?? 'Try in Photoshop Web';
  const ctaHref = ctaEl?.href ?? '#';
  // Row 4: disclaimer
  const disclaimerEl = rows[4]?.querySelector('p');
  const disclaimerHtml = disclaimerEl
    ? disclaimerEl.outerHTML.replace('<p', '<p class="beta-disclaimer"')
    : `<p class="beta-disclaimer">${rows[4]?.querySelector('div')?.textContent?.trim() ?? ''}</p>`;

  block.innerHTML = `
    <section class="section-overlay">
      <p class="search-eyebrow">${eyebrowText}</p>
      ${headlineHtml}
      ${bodyHtml}
      <div class="search-input-group">
        <input type="text" placeholder="${inputPlaceholder}">
        <a href="${ctaHref}" class="btn-primary">${ctaText}</a>
      </div>
      ${disclaimerHtml}
    </section>
  `;
}
