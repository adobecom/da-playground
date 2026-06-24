export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: eyebrow
  const eyebrow = rows[0]?.children[0]?.textContent.trim() || '';
  // Row 1: headline
  const headline = rows[1]?.children[0]?.innerHTML.trim() || '';
  // Row 2: body
  const body = rows[2]?.children[0]?.innerHTML.trim() || '';
  // Row 3: input placeholder | CTA
  const inputPlaceholder = rows[3]?.children[0]?.textContent.trim() || 'Ask anything';
  const ctaEl = rows[3]?.querySelector('a');
  const ctaText = ctaEl?.textContent.trim() || 'Try in Photoshop Web';
  const ctaHref = ctaEl?.href || '#';
  // Row 4: disclaimer
  const disclaimer = rows[4]?.children[0]?.innerHTML.trim() || '';

  block.innerHTML = '';

  const ey = document.createElement('p');
  ey.className = 'fs-eyebrow';
  ey.innerHTML = eyebrow;
  block.append(ey);

  const hl = document.createElement('h2');
  hl.className = 'fs-headline';
  hl.innerHTML = headline;
  block.append(hl);

  const bd = document.createElement('p');
  bd.className = 'fs-body';
  bd.innerHTML = body;
  block.append(bd);

  const inputGroup = document.createElement('div');
  inputGroup.className = 'fs-input-group';
  inputGroup.innerHTML = `
    <input type="text" placeholder="${inputPlaceholder}" class="fs-input" />
    <a href="${ctaHref}" class="fs-cta">${ctaText}</a>
  `;
  block.append(inputGroup);

  const ps = document.createElement('a');
  ps.className = 'fs-ps-cta';
  ps.href = '#';
  ps.textContent = 'Try Photoshop on the web free';
  block.append(ps);

  if (disclaimer) {
    const dis = document.createElement('p');
    dis.className = 'fs-disclaimer';
    dis.innerHTML = disclaimer;
    block.append(dis);
  }
}
