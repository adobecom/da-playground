const SPARKLE_SVG = `<svg style="opacity:0.6;filter:invert(1)" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6.56084 13.6591C5.57317 9.75967 4.23691 8.42341 0.340901 7.43916C-0.113634 7.32296 -0.113634 6.67704 0.340901 6.56084C4.24033 5.57317 5.57659 4.23691 6.56084 0.340901C6.67704 -0.113634 7.32296 -0.113634 7.43916 0.340901C8.42683 4.24033 9.76309 5.57659 13.6591 6.56084C14.1136 6.67704 14.1136 7.32296 13.6591 7.43916C9.75967 8.42683 8.42341 9.76309 7.43916 13.6591C7.32296 14.1136 6.67704 14.1136 6.56084 13.6591Z" fill="url(#sparkle-gradient)"/>
  <defs>
    <linearGradient id="sparkle-gradient" x1="7" y1="14" x2="7" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8D88F2"/>
      <stop offset="1" stop-color="#EB1000"/>
    </linearGradient>
  </defs>
</svg>`;

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: h2 title
  const titleEl = rows[0]?.querySelector('div');
  const titleText = titleEl?.textContent?.trim() || 'Find what you\'re looking for.';

  // Row 1: subtitle text
  const subtitleEl = rows[1]?.querySelector('div');
  const subtitleText = subtitleEl?.textContent?.trim() || 'Get answers from our agent about Adobe products and solutions.';

  // Row 2: search placeholder text
  const placeholderEl = rows[2]?.querySelector('div');
  const placeholderText = placeholderEl?.textContent?.trim() || 'Ask anything';

  // Row 3: disclaimer HTML
  const discEl = rows[3]?.querySelector('div');
  const discHTML = discEl?.innerHTML?.trim() || '';

  block.innerHTML = `
    <div class="agentic">
      <h2 class="agentic-h2">${titleText}</h2>
      <p class="agentic-sub">${subtitleText}</p>
      <div class="search-bar">
        <div class="search-icon-wrap">${SPARKLE_SVG}</div>
        <div class="search-placeholder">${placeholderText}</div>
      </div>
      <p class="agentic-disc">${discHTML}</p>
    </div>
  `;
}
