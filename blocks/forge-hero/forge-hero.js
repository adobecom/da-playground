export default function decorate(block) {
  const rows = [...block.children];
  block.innerHTML = '';

  const section = block.closest('.section');

  const container = document.createElement('div');
  container.className = 'fh-container';

  // Row 0 — H1 heading
  if (rows[0]) {
    const h1 = document.createElement('h1');
    h1.className = 'fh-title';
    h1.textContent = rows[0].firstElementChild?.textContent?.trim() || '';
    container.appendChild(h1);
  }

  // Row 1 — subtitle paragraph
  if (rows[1]) {
    const p = document.createElement('p');
    p.className = 'fh-sub';
    p.textContent = rows[1].firstElementChild?.textContent?.trim() || '';
    container.appendChild(p);
  }

  // Row 2 — tab labels (comma-separated in one cell)
  if (rows[2]) {
    const raw = rows[2].firstElementChild?.textContent?.trim() || '';
    const labels = raw.split(',').map((s) => s.trim()).filter(Boolean);

    const switcher = document.createElement('div');
    switcher.className = 'fh-switcher';
    switcher.setAttribute('role', 'tablist');
    switcher.setAttribute('aria-label', 'Choose your audience');

    const group = document.createElement('div');
    group.className = 'fh-switcher-group';

    labels.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.className = 'fh-tab';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.type = 'button';
      btn.textContent = label;
      group.appendChild(btn);
    });

    switcher.appendChild(group);
    container.appendChild(switcher);

    // Wire tab toggle
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.fh-tab');
      if (!btn) return;
      group.querySelectorAll('.fh-tab').forEach((t) => t.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');
    });
  }

  block.appendChild(container);
}
