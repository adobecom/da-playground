export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: headline
  const headline = rows[0]?.children[0]?.innerHTML.trim() || '';
  // Row 1: body
  const body = rows[1]?.children[0]?.innerHTML.trim() || '';
  // Row 2: files panel (2 cells: panel title | panel body)
  const filesTitle = rows[2]?.children[0]?.innerHTML.trim() || 'Files';
  const filesBody = rows[2]?.children[1]?.innerHTML.trim() || 'Add or select files and links to update your PDF Space.';
  // Row 3: explore panel (2 cells: panel title | explore body; CTA link in cell 1)
  const exploreTitle = rows[3]?.children[0]?.innerHTML.trim() || 'Explore insights or ask a question.';
  const exploreBody = rows[3]?.children[1]?.innerHTML.trim() || '';
  const ctaEl = rows[3]?.querySelector('a');
  const ctaText = ctaEl?.textContent.trim() || 'Try PDF Spaces now';
  const ctaHref = ctaEl?.href || '#';

  block.innerHTML = '';

  const hl = document.createElement('h2');
  hl.className = 'ftd-headline';
  hl.innerHTML = headline;
  block.append(hl);

  const bd = document.createElement('p');
  bd.className = 'ftd-body';
  bd.innerHTML = body;
  block.append(bd);

  const mockup = document.createElement('div');
  mockup.className = 'ftd-mockup';

  // Files panel
  const filesPanel = document.createElement('div');
  filesPanel.className = 'ftd-panel';
  filesPanel.innerHTML = `
    <h4>${filesTitle}</h4>
    <p class="ftd-panel-desc">${filesBody}</p>
    <div class="ftd-drop-zone">
      <p>Drag and drop your files, or choose files</p>
    </div>
  `;

  // Explore panel
  const explorePanel = document.createElement('div');
  explorePanel.className = 'ftd-panel';
  explorePanel.innerHTML = `
    <h4>${exploreTitle}</h4>
    <p class="ftd-panel-desc">${exploreBody}</p>
    <div class="ftd-search">
      <input type="text" placeholder="Ask a question or describe what you'd like to work on" />
      <a href="${ctaHref}" class="ftd-cta-btn">${ctaText}</a>
    </div>
  `;

  mockup.append(filesPanel, explorePanel);
  block.append(mockup);
}
