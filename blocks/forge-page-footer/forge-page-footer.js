const FOOTER_COLS = [
  {
    head: 'For individuals\n& small business',
    links: ['Creative AI', 'Photography', 'Design & Illustration', 'Video & animation', 'PDF', '3D', 'Elements Family', 'Stock images & video', 'View all products'],
  },
  {
    head: 'For medium\n& large business',
    links: ['Personalization at scale', 'Content supply chain', 'Unified customer experience', 'Creativity and production', 'B2B GTM orchestration', 'View all products'],
  },
  {
    head: 'For\nOrganizations',
    links: ['Education', 'Nonprofits', 'Government'],
  },
  {
    head: 'Support',
    links: ['Help Center', 'Download and install', 'Adobe Community', 'Adobe Learn', 'Medium & large business support'],
  },
  {
    head: 'Contact',
    links: ['Chat with sales', 'Request information'],
  },
  {
    head: 'Adobe',
    links: ['Log into your account', 'About', 'Careers', 'Events', 'Newsroom', 'Corporate Responsibility', 'Investor Relations', 'Trust Center', 'Adobe Blog', 'Terms', 'Cookie preferences'],
  },
];

const SVG_CHEVRON = `<svg width="6" height="4" viewBox="0 0 6 4" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 0L3 3L6 0" fill="rgba(255,255,255,0.64)"/>
</svg>`;

const SVG_ADBE = `<svg width="49" height="13" viewBox="0 0 49 13" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="11" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="rgba(255,255,255,0.64)" letter-spacing="1">ADBE</text>
</svg>`;

const SVG_FACEBOOK = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 0C4.02948 0 0 4.02948 0 9C0 13.2206 2.90592 16.7623 6.82596 17.735V11.7504H4.97016V9H6.82596V7.81488C6.82596 4.75164 8.21232 3.3318 11.2198 3.3318C11.79 3.3318 12.7739 3.44376 13.1764 3.55536V6.04836C12.964 6.02604 12.595 6.01488 12.1367 6.01488C10.661 6.01488 10.0908 6.57396 10.0908 8.02728V9H13.0306L12.5255 11.7504H10.0908V17.9341C14.5472 17.3959 18.0004 13.6015 18.0004 9C18 4.02948 13.9705 0 9 0Z" fill="rgba(255,255,255,0.64)"/>
</svg>`;

const SVG_LINKEDIN = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16.6676 0H1.32891C0.594141 0 0 0.580078 0 1.29727V16.6992C0 17.4164 0.594141 18 1.32891 18H16.6676C17.4023 18 18 17.4164 18 16.7027V1.29727C18 0.580078 17.4023 0 16.6676 0ZM5.34023 15.3387H2.66836V6.74648H5.34023V15.3387ZM4.0043 5.57578C3.14648 5.57578 2.45391 4.8832 2.45391 4.02891C2.45391 3.17461 3.14648 2.48203 4.0043 2.48203C4.85859 2.48203 5.55117 3.17461 5.55117 4.02891C5.55117 4.87969 4.85859 5.57578 4.0043 5.57578ZM15.3387 15.3387H12.6703V11.1621C12.6703 10.1672 12.6527 8.88398 11.2816 8.88398C9.89297 8.88398 9.68203 9.97031 9.68203 11.0918V15.3387H7.01719V6.74648H9.57656V7.9207H9.61172C9.9668 7.2457 10.8387 6.53203 12.1359 6.53203C14.8395 6.53203 15.3387 8.31094 15.3387 10.6242V15.3387V15.3387Z" fill="rgba(255,255,255,0.64)"/>
</svg>`;

const SVG_INSTAGRAM = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 1.6207C11.4047 1.6207 11.6895 1.63125 12.6352 1.67344C13.5141 1.71211 13.9887 1.85977 14.3051 1.98281C14.7234 2.14453 15.0258 2.34141 15.3387 2.6543C15.6551 2.9707 15.8484 3.26953 16.0102 3.68789C16.1332 4.0043 16.2809 4.48242 16.3195 5.35781C16.3617 6.30703 16.3723 6.5918 16.3723 8.99297C16.3723 11.3977 16.3617 11.6824 16.3195 12.6281C16.2809 13.507 16.1332 13.9816 16.0102 14.298C15.8484 14.7164 15.6516 15.0187 15.3387 15.3316C15.0223 15.648 14.7234 15.8414 14.3051 16.0031C13.9887 16.1262 13.5105 16.2738 12.6352 16.3125C11.6859 16.3547 11.4012 16.3652 9 16.3652C6.59531 16.3652 6.31055 16.3547 5.36484 16.3125C4.48594 16.2738 4.01133 16.1262 3.69492 16.0031C3.27656 15.8414 2.97422 15.6445 2.66133 15.3316C2.34492 15.0152 2.15156 14.7164 1.98984 14.298C1.8668 13.9816 1.71914 13.5035 1.68047 12.6281C1.63828 11.6789 1.62773 11.3941 1.62773 8.99297C1.62773 6.58828 1.63828 6.30351 1.68047 5.35781C1.71914 4.47891 1.8668 4.0043 1.98984 3.68789C2.15156 3.26953 2.34844 2.96719 2.66133 2.6543C2.97773 2.33789 3.27656 2.14453 3.69492 1.98281C4.01133 1.85977 4.48945 1.71211 5.36484 1.67344C6.31055 1.63125 6.59531 1.6207 9 1.6207ZM9 0C6.55664 0 6.25078 0.0105469 5.29102 0.0527344C4.33477 0.0949219 3.67734 0.249609 3.10781 0.471094C2.51367 0.703125 2.01094 1.00898 1.51172 1.51172C1.00898 2.01094 0.703125 2.51367 0.471094 3.1043C0.249609 3.67734 0.0949219 4.33125 0.0527344 5.2875C0.0105469 6.25078 0 6.55664 0 9C0 11.4434 0.0105469 11.7492 0.0527344 12.709C0.0949219 13.6652 0.249609 14.3227 0.471094 14.8922C0.703125 15.4863 1.00898 15.9891 1.51172 16.4883C2.01094 16.9875 2.51367 17.2969 3.1043 17.5254C3.67734 17.7469 4.33125 17.9016 5.2875 17.9437C6.24727 17.9859 6.55312 17.9965 8.99648 17.9965C11.4398 17.9965 11.7457 17.9859 12.7055 17.9437C13.6617 17.9016 14.3191 17.7469 14.8887 17.5254C15.4793 17.2969 15.982 16.9875 16.4813 16.4883C16.9805 15.9891 17.2898 15.4863 17.5184 14.8957C17.7398 14.3227 17.8945 13.6687 17.9367 12.7125C17.9789 11.7527 17.9895 11.4469 17.9895 9.00352C17.9895 6.56016 17.9789 6.2543 17.9367 5.29453C17.8945 4.33828 17.7398 3.68086 17.5184 3.11133C17.2969 2.51367 16.991 2.01094 16.4883 1.51172C15.9891 1.0125 15.4863 0.703125 14.8957 0.474609C14.3227 0.253125 13.6688 0.0984375 12.7125 0.05625C11.7492 0.0105469 11.4434 0 9 0Z" fill="rgba(255,255,255,0.64)"/>
</svg>`;

const SVG_TWITTER = `<svg width="17" height="15" viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12.9947 0H15.5248L9.99729 6.31762L16.5 14.9145H11.4084L7.42053 9.70053L2.85746 14.9145H0.325824L6.23808 8.15707L0 0H5.22083L8.82555 4.76575L12.9947 0ZM12.1067 13.4001H13.5087L4.45905 1.43485H2.9546L12.1067 13.4001Z" fill="rgba(255,255,255,0.64)"/>
</svg>`;

const SVG_WORDMARK = `<svg viewBox="0 0 1494 358" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M145.073 10.3137H246.648L390.101 352.729H282.742L192.043 125.369L132.116 274.574H203.38L231.84 352.729H0L145.073 10.3137ZM509.723 81.3636C520.135 81.3636 531.473 82.2804 542.81 85.0307V0.229177H632.584V337.602C611.992 346.77 567.567 358 523.143 358C442.624 358 373.442 312.62 373.442 222.088C373.442 131.557 440.079 81.5928 509.723 81.5928V81.3636ZM521.061 284.658C529.39 284.658 536.1 283.054 542.81 280.991V156.768C536.1 154.247 529.39 153.101 520.598 153.101C491.213 153.101 463.911 174.645 463.911 220.026C463.911 265.406 491.676 284.429 521.061 284.429V284.658ZM792.466 81.3636C867.2 81.3636 930.829 131.328 930.829 219.338C930.829 307.348 867.432 357.312 792.466 357.312C717.5 357.312 653.64 307.348 653.64 219.338C653.64 131.328 716.574 81.3636 792.466 81.3636ZM792.466 283.283C818.148 283.283 841.98 262.885 841.98 219.338C841.98 175.791 818.148 155.393 792.466 155.393C766.783 155.393 743.414 175.791 743.414 219.338C743.414 262.885 765.626 283.283 792.466 283.283ZM952.347 0.229177H1042.58V85.0307C1053.46 82.968 1064.8 81.3636 1076.13 81.3636C1146.24 81.3636 1211.26 126.744 1211.26 215.671C1211.26 309.64 1142.08 357.312 1060.17 357.312C1025 357.312 980.112 350.207 952.347 337.373V0V0.229177ZM1062.25 284.2C1093.26 284.2 1121.48 262.197 1121.48 216.817C1121.48 174.416 1093.72 154.476 1063.64 154.476C1055.31 154.476 1048.6 155.393 1042.58 158.143V280.762C1047.67 282.825 1054.38 284.429 1062.25 284.429V284.2ZM1364.43 81.3636C1431.99 81.3636 1494 124.223 1494 210.629C1494 222.318 1493.54 233.548 1491.92 244.779H1323.71C1332.96 275.032 1359.8 289.242 1393.35 289.242C1420.65 289.242 1445.87 282.595 1474.33 270.448V338.519C1447.96 351.812 1416.49 357.312 1384.1 357.312C1298.49 357.312 1231.85 306.202 1231.85 219.338C1231.85 132.474 1292.24 81.3636 1364.43 81.3636ZM1409.78 189.085C1405.15 159.977 1385.48 148.288 1365.35 148.288C1345.22 148.288 1328.8 160.665 1322.09 189.085H1409.78Z" fill="white"/>
</svg>`;

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Rows 0-3: featured product rows — each has 2 cells: [picture] | [product name]
  const products = rows.slice(0, 4).map((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const picEl = cells[0];
    const nameEl = cells[1];
    const picture = picEl?.querySelector('picture, img');
    const name = nameEl?.textContent?.trim() || '';
    return { picture, name };
  });

  // Build footer columns HTML
  const colsHTML = FOOTER_COLS.map((col) => `
    <div class="fcol">
      <span class="fcol-hd">${col.head}</span>
      <div class="fcol-links">
        ${col.links.map((link) => `<span class="fcol-link">${link}</span>`).join('')}
      </div>
    </div>
  `).join('');

  // Build featured products HTML
  const prodsHTML = products.map((prod) => {
    const imgHTML = prod.picture ? prod.picture.outerHTML : '';
    return `<div class="fprod">${imgHTML}<span class="fprod-name">${prod.name}</span></div>`;
  }).join('');

  block.innerHTML = `
    <footer class="footer">
      <div class="footer-main">
        <div class="footer-cols">
          ${colsHTML}
        </div>
        <div class="footer-prods">
          <span class="footer-prods-hd">Featured Products</span>
          <div class="footer-prod-row">
            ${prodsHTML}
          </div>
        </div>
        <div class="footer-bottom">
          <div class="fb-left">
            <div class="fb-region">Change region ${SVG_CHEVRON}</div>
            <div class="fb-copy">
              <span>© 2026 Adobe Inc. All rights reserved.</span>
              <span>Do not sell or share my personal information</span>
            </div>
            <div class="fb-ad">
              ${SVG_ADBE}
              <span>AdChoices</span>
            </div>
          </div>
          <div class="fb-social">
            ${SVG_FACEBOOK}
            ${SVG_LINKEDIN}
            ${SVG_INSTAGRAM}
            ${SVG_TWITTER}
          </div>
        </div>
      </div>
      <div class="footer-wordmark">
        ${SVG_WORDMARK}
      </div>
    </footer>
  `;
}
