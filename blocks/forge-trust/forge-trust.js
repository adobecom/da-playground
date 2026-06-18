/**
 * forge-trust — trust band block
 * DA content model: one row per trust item, single cell with text label.
 * Decorator adds the SVG icons (purely decorative, derived from item index/text).
 */

const ICONS = {
  'open source': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-4z"/>
  </svg>`,
  'edge delivery': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8z"/>
  </svg>`,
  'adobe.com': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>
  </svg>`,
};

function getIcon(text) {
  const lower = text.toLowerCase();
  if (lower.includes('open source')) return ICONS['open source'];
  if (lower.includes('edge')) return ICONS['edge delivery'];
  return ICONS['adobe.com'];
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  const inner = document.createElement('div');
  inner.className = 'trust__inner';

  rows.forEach((row) => {
    const cell = row.querySelector(':scope > div');
    if (!cell) return;
    const label = cell.textContent.trim();
    const item = document.createElement('div');
    item.className = 'trust__item';
    item.innerHTML = getIcon(label);
    item.appendChild(document.createTextNode(label));
    inner.appendChild(item);
  });

  block.textContent = '';
  block.appendChild(inner);
}
