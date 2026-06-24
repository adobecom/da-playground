export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: headline
  const headlineText = rows[0]?.querySelector('div')?.textContent?.trim() ?? '';
  // Row 1: body
  const bodyText = rows[1]?.querySelector('div')?.textContent?.trim() ?? '';
  // Row 2: Files panel — cells: [label] [description] [drop zone text]
  const row2Cells = rows[2] ? [...rows[2].querySelectorAll(':scope > div')] : [];
  const filesLabel = row2Cells[0]?.textContent?.trim() ?? 'Files';
  const filesDesc = row2Cells[1]?.textContent?.trim() ?? '';
  const filesDropText = row2Cells[2]?.textContent?.trim() ?? '';
  // Row 3: Insights panel — cells: [heading] [insight text] [placeholder | CTA text]
  const row3Cells = rows[3] ? [...rows[3].querySelectorAll(':scope > div')] : [];
  const insightHeading = row3Cells[0]?.textContent?.trim() ?? '';
  const insightText = row3Cells[1]?.textContent?.trim() ?? '';
  const ctaRaw = row3Cells[2]?.textContent?.trim() ?? '';
  const pipIdx = ctaRaw.indexOf('|');
  const inputPlaceholder = pipIdx !== -1 ? ctaRaw.slice(0, pipIdx).trim() : ctaRaw;
  const ctaText = pipIdx !== -1 ? ctaRaw.slice(pipIdx + 1).trim() : 'Try PDF Spaces now';

  block.innerHTML = `
    <div class="testdrive">
      <h2 class="td-headline">${headlineText}</h2>
      <p class="td-body">${bodyText}</p>
      <div class="td-mockup">
        <div class="td-panel">
          <h4>${filesLabel}</h4>
          <p class="td-panel-desc">${filesDesc}</p>
          <div class="td-drop-zone">
            <p>${filesDropText}</p>
          </div>
        </div>
        <div class="td-panel">
          <h4>${insightHeading}</h4>
          <p class="td-panel-desc">${insightText}</p>
          <div class="td-search">
            <input type="text" placeholder="${inputPlaceholder}">
            <a href="#" class="btn-primary">${ctaText}</a>
          </div>
        </div>
      </div>
    </div>
  `;
}
