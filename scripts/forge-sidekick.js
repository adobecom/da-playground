// Forge Sidekick wiring — added by page-forge deploy.
// See milo/libs/utils/sidekick.js (vhargrave/forge-sidekick) for the canonical
// version. Inlined here so snowflake proto pages on da-playground get the
// same buttons without depending on Milo being loaded.
(() => {
  const resolveAnimatorSrc = () => {
    if (window.forgeSources?.animator) return window.forgeSources.animator;
    const h = location.hostname;
    const p = location.port;
    const ml = new URLSearchParams(location.search).get('milolibs');
    if (h === 'localhost' && p === '3000') return 'http://localhost:3000/libs/c2/tools/page-animator/page-animator.js';
    if ((h === 'localhost' && p === '6456') || ml === 'local') return 'http://localhost:6456/libs/c2/tools/page-animator/page-animator.js';
    const branch = (ml && ml \!== 'local') ? ml : 'forge-a-panel';
    const env = h.indexOf('.aem.page') \!== -1 ? 'aem.page' : 'aem.live';
    return `https://${branch}--milo--adobecom.${env}/libs/c2/tools/page-animator/page-animator.js`;
  };

  const bind = (sk) => {
    const load = (src) => {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = src;
      document.head.appendChild(s);
    };
    sk.addEventListener('custom:forge-adjustments', () => {
      if (document.querySelector('[data-replay="host"]')) return;
      load(window.forgeSources?.adjustments || 'http://localhost:3001/overlay.js');
    });
    sk.addEventListener('custom:forge-annotations', () => {
      if (document.getElementById('page-commenter-root')) return;
      load(window.forgeSources?.annotations || 'https://page-commenter.jingleh12345.workers.dev/page-commenter.js');
    });
    sk.addEventListener('custom:forge-publish', () => {
      load(window.forgeSources?.publish || 'http://localhost:3001/forge-publish.js');
    });
    sk.addEventListener('custom:forge-animator', () => {
      if (document.getElementById('page-animator-panel')) return;
      load(resolveAnimatorSrc());
    });
  };
  const existing = document.querySelector('aem-sidekick, helix-sidekick');
  if (existing) { bind(existing); return; }
  const obs = new MutationObserver(() => {
    const sk = document.querySelector('aem-sidekick, helix-sidekick');
    if (sk) { obs.disconnect(); bind(sk); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
