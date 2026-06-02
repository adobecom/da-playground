export default function decorate(block) {
  const rows = [...block.children];
  block.innerHTML = '';

  const container = document.createElement('div');
  container.className = 'ffaq-container';

  // Row 0 — section heading
  if (rows[0]) {
    const h2 = document.createElement('h2');
    h2.textContent = rows[0].firstElementChild?.textContent?.trim() || '';
    container.appendChild(h2);
  }

  // Rows 1+ — FAQ pairs (question | answer)
  rows.forEach((row, idx) => {
    if (idx === 0) return; // skip heading
    const cells = [...row.children];
    const question = cells[0]?.textContent?.trim() || '';
    const answerCell = cells[1];

    const details = document.createElement('details');
    details.className = 'ffaq-item';
    if (idx === 1) details.open = true; // first item open by default

    const summary = document.createElement('summary');
    summary.textContent = question;
    details.appendChild(summary);

    const answerDiv = document.createElement('div');
    answerDiv.className = 'ffaq-answer';
    if (answerCell) {
      // Preserve any inner HTML (links etc.) from DA
      answerDiv.innerHTML = answerCell.innerHTML || answerCell.textContent;
    }
    details.appendChild(answerDiv);

    container.appendChild(details);
  });

  block.appendChild(container);
}
