export default function decorate(block) {
  const rows = [...block.children];
  block.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'fcg-container';

  // Row 0 — section heading (may contain a capability count)
  if (rows[0]) {
    const head = document.createElement('div');
    head.className = 'fcg-head';

    const h2 = document.createElement('h2');
    // Swap a leading number (e.g. "9") with an animated countup span
    const rawText = rows[0].firstElementChild?.textContent?.trim() || '';
    h2.innerHTML = rawText.replace(/\b(\d+)\b(?=\s+capabilities)/i,
      '<span class="fcg-count" data-countup="$1">0</span>');
    head.appendChild(h2);

    // Row 1 — head subtitle
    if (rows[1]) {
      const p = document.createElement('p');
      p.textContent = rows[1].firstElementChild?.textContent?.trim() || '';
      head.appendChild(p);
    }

    container.appendChild(head);
  }

  // Row 2 — filter chip labels (comma-separated)
  if (rows[2]) {
    const raw = rows[2].firstElementChild?.textContent?.trim() || '';
    const chips = raw.split(',').map((s) => s.trim()).filter(Boolean);

    const filtersEl = document.createElement('div');
    filtersEl.className = 'fcg-filters';
    filtersEl.setAttribute('role', 'group');
    filtersEl.setAttribute('aria-label', 'Filter capabilities');

    chips.forEach((label, i) => {
      const chip = document.createElement('span');
      chip.className = 'fcg-chip';
      if (i === 0) chip.setAttribute('aria-current', 'true');
      chip.textContent = label;
      filtersEl.appendChild(chip);
    });

    // Basic chip toggle (visual only)
    filtersEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.fcg-chip');
      if (!chip) return;
      filtersEl.querySelectorAll('.fcg-chip').forEach((c) => c.removeAttribute('aria-current'));
      chip.setAttribute('aria-current', 'true');
    });

    container.appendChild(filtersEl);
  }

  // Rows 3+ — capability tiles (name | description)
  const grid = document.createElement('div');
  grid.className = 'fcg-grid';

  rows.forEach((row, idx) => {
    if (idx < 3) return; // skip heading, subtitle, filters
    const cells = [...row.children];
    const name = cells[0]?.textContent?.trim() || '';
    const desc = cells[1]?.textContent?.trim() || '';

    const tile = document.createElement('article');
    tile.className = 'fcg-tile';
    tile.setAttribute('data-tile-anim', '');

    const nameEl = document.createElement('h3');
    nameEl.className = 'fcg-tile-name';
    nameEl.textContent = name;
    tile.appendChild(nameEl);

    const descEl = document.createElement('p');
    descEl.className = 'fcg-tile-desc';
    descEl.textContent = desc;
    tile.appendChild(descEl);

    const availDiv = document.createElement('div');
    availDiv.className = 'fcg-tile-avail';
    availDiv.innerHTML = '<span class="fcg-avail-label">Free / Premium / Firefly Pro</span>';
    tile.appendChild(availDiv);

    grid.appendChild(tile);
  });

  container.appendChild(grid);
  block.appendChild(container);

  // Countup animation
  const countEls = block.querySelectorAll('[data-countup]');
  if (countEls.length) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.counted) return;
        entry.target.dataset.counted = '1';
        const target = parseInt(entry.target.getAttribute('data-countup'), 10);
        const duration = target > 20 ? 1400 : target > 5 ? 900 : 600;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min((now - start) / duration, 1);
          entry.target.textContent = String(Math.round((1 - Math.pow(1 - t, 3)) * target));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });
    countEls.forEach((el) => countObserver.observe(el));
  }
}
