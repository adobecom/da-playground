const ADOBE_LOGO_PATH = 'M6.50596 0.460947H11.0612L17.4945 15.7644H12.6799L8.61236 5.60307L5.92489 12.2714H9.1208L10.3971 15.7644H0L6.50596 0.460947ZM22.8591 3.63636C23.326 3.63636 23.8344 3.67734 24.3429 3.80026V0.0102425H28.3689V15.0883C27.4454 15.4981 25.4532 16 23.4609 16C19.8499 16 16.7474 13.9718 16.7474 9.92574C16.7474 5.87964 19.7358 3.64661 22.8591 3.64661V3.63636ZM23.3675 12.7222C23.7411 12.7222 24.042 12.6504 24.3429 12.5583V7.0064C24.042 6.89373 23.7411 6.84251 23.3468 6.84251C22.029 6.84251 20.8046 7.80538 20.8046 9.83355C20.8046 11.8617 22.0497 12.7119 23.3675 12.7119V12.7222ZM35.539 3.63636C38.8905 3.63636 41.744 5.8694 41.744 9.80282C41.744 13.7362 38.9009 15.9693 35.539 15.9693C32.177 15.9693 29.3132 13.7362 29.3132 9.80282C29.3132 5.8694 32.1355 3.63636 35.539 3.63636ZM35.539 12.6607C36.6907 12.6607 37.7595 11.749 37.7595 9.80282C37.7595 7.85659 36.6907 6.94494 35.539 6.94494C34.3872 6.94494 33.3392 7.85659 33.3392 9.80282C33.3392 11.749 34.3353 12.6607 35.539 12.6607ZM42.709 0.0102425H46.7558V3.80026C47.2435 3.70807 47.7519 3.63636 48.2603 3.63636C51.4044 3.63636 54.3201 5.66453 54.3201 9.63893C54.3201 13.8387 51.2176 15.9693 47.5444 15.9693C45.9672 15.9693 43.9542 15.6517 42.709 15.0781V0V0.0102425ZM47.6378 12.7017C49.0282 12.7017 50.2941 11.7183 50.2941 9.69014C50.2941 7.79513 49.0489 6.90397 47.7 6.90397C47.3265 6.90397 47.0256 6.94494 46.7558 7.06786V12.548C46.9841 12.6402 47.285 12.7119 47.6378 12.7119V12.7017ZM61.1893 3.63636C64.2191 3.63636 67 5.55186 67 9.41357C67 9.93598 66.9793 10.4379 66.9066 10.9398H59.363C59.7781 12.2919 60.9817 12.927 62.4863 12.927C63.7107 12.927 64.8417 12.63 66.118 12.0871V15.1293C64.9351 15.7234 63.5239 15.9693 62.0712 15.9693C58.232 15.9693 55.2436 13.685 55.2436 9.80282C55.2436 5.92061 57.9518 3.63636 61.1893 3.63636ZM63.223 8.45071C63.0155 7.14981 62.1335 6.6274 61.2308 6.6274C60.328 6.6274 59.5913 7.18054 59.2904 8.45071H63.223Z';

const CHEVRON_SVG = `<svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M1 1l4 4 4-4" stroke="rgba(0,0,0,0.64)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const APPS_SVG = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="3" cy="3" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="9" cy="3" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="15" cy="3" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="3" cy="9" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="9" cy="9" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="15" cy="9" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="3" cy="15" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="9" cy="15" r="1.5" fill="rgba(0,0,0,0.64)"/>
  <circle cx="15" cy="15" r="1.5" fill="rgba(0,0,0,0.64)"/>
</svg>`;

export default function decorate(block) {
  // Extract content from DA rows
  const rows = [...block.querySelectorAll(':scope > div')];

  // Row 0: nav item labels (pipe-separated text in single cell)
  const navItemsRaw = rows[0]?.querySelector('div')?.textContent?.trim() ?? '';
  const navItems = navItemsRaw.split('|').map((s) => s.trim()).filter(Boolean);

  // Row 1: right buttons (pipe-separated)
  const rightButtonsRaw = rows[1]?.querySelector('div')?.textContent?.trim() ?? '';
  const rightButtons = rightButtonsRaw.split('|').map((s) => s.trim()).filter(Boolean);

  // Build nav-left items HTML
  let navItemsHtml = '';
  navItems.forEach((item, i) => {
    // Check for "(active)" marker
    const isActive = /\(active\)/i.test(item);
    const label = item.replace(/\s*\(active\)/i, '').trim();

    if (i === 1 && navItems.length > 1) {
      // First item (Use Cases) gets a chevron; add slash before second
      navItemsHtml = navItemsHtml.trimEnd();
      navItemsHtml += `\n      <div class="nav-slash"></div>`;
    }

    const activeClass = isActive ? ' active' : '';
    // First item (index 0, "Use Cases") gets a chevron
    const chevron = i === 0 ? ` ${CHEVRON_SVG}` : '';
    navItemsHtml += `\n      <div class="nav-item${activeClass}">${label}${chevron}</div>`;
  });

  // Build right buttons HTML
  let rightBtnsHtml = '';
  rightButtons.forEach((label, i) => {
    const cls = i === 0 ? 'btn-outlined' : 'btn-solid-black';
    rightBtnsHtml += `\n      <button class="${cls}">${label}</button>`;
  });

  // Build full nav HTML
  block.innerHTML = `
<nav class="lnav">
  <div class="nav-row">
    <div class="nav-left">
      <div class="nav-logo" aria-label="Adobe">
        <svg width="67" height="16" viewBox="0 0 67 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="${ADOBE_LOGO_PATH}" fill="#FA0F00"/>
        </svg>
      </div>${navItemsHtml}
    </div>
    <div class="nav-right">
      <div class="nav-apps" aria-label="Apps">${APPS_SVG}</div>${rightBtnsHtml}
    </div>
  </div>
  <div class="nav-divider"></div>
</nav>
`;
}
