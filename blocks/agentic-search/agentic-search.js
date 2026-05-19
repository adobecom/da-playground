export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const cell = (row) => row?.querySelector(':scope > div') || row;

  const headingCell = cell(rows[0]);
  const subheadingCell = cell(rows[1]);
  const placeholderCell = cell(rows[2]);
  const disclaimerCell = cell(rows[3]);

  const placeholderText = placeholderCell?.textContent?.trim() || 'Ask anything';

  // Ensure heading has a heading element
  if (headingCell && !headingCell.querySelector('h1, h2, h3')) {
    const h2 = document.createElement('h2');
    [...headingCell.childNodes].forEach((n) => h2.append(n));
    headingCell.append(h2);
  }

  // Tag the subheading paragraph
  if (subheadingCell) {
    const p = subheadingCell.querySelector('p');
    if (p) p.classList.add('agentic-search-subheading');
  }

  // Tag disclaimer paragraph
  if (disclaimerCell) {
    const p = disclaimerCell.querySelector('p');
    if (p) p.classList.add('agentic-search-disclaimer');
  }

  // Build search bar with gradient icon and send button
  const searchBar = document.createElement('div');
  searchBar.className = 'agentic-search-bar';
  searchBar.setAttribute('role', 'search');
  searchBar.innerHTML = `
    <div class="agentic-search-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="agentic-search-sg" x1="0" y1="18" x2="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop stop-color="#8d88f2"/>
            <stop offset="1" stop-color="#eb1000"/>
          </linearGradient>
        </defs>
        <path fill="url(#agentic-search-sg)" d="M7.5 1a6.5 6.5 0 0 1 4.95 10.79l3.88 3.88a.75.75 0 1 1-1.06 1.06l-3.88-3.88A6.5 6.5 0 1 1 7.5 1zm0 1.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
      </svg>
    </div>
    <input
      type="text"
      class="agentic-search-input"
      placeholder="${placeholderText}"
      aria-label="${placeholderText}"
    />
    <button class="agentic-search-send" type="button" aria-label="Submit search">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;

  // Assemble inner layout
  const inner = document.createElement('div');
  inner.className = 'agentic-search-inner';

  const copy = document.createElement('div');
  copy.className = 'agentic-search-copy';
  if (headingCell) copy.append(...headingCell.childNodes);
  if (subheadingCell) copy.append(...subheadingCell.childNodes);

  inner.append(copy, searchBar);
  if (disclaimerCell) inner.append(...disclaimerCell.childNodes);

  block.innerHTML = '';
  block.append(inner);
}
