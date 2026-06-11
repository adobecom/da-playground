#!/usr/bin/env node
/**
 * Generate the DA document HTML for figma-d4fea3 (BizPro Hub page).
 * Produces a Milo block-level page with forge-* blocks.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, '..', 'drafts', 'figma-d4fea3.html');
mkdirSync(dirname(OUT), { recursive: true });

const M = 'https://content.da.live/adobecom/da-playground/media/drafts/cod87753/snowflake/figma-d4fea3';
const img = (n, alt = '') => `<picture><img src="${M}/${n}" alt="${alt}" loading="lazy"></picture>`;

// Animation sidecar helper (default fade-up reveal)
const anim = (target, rangeStart = 'entry 0%') => `
    <div class="animation ${target}">
      <div><div>--pa-opacity-from</div><div>0</div></div>
      <div><div>--pa-translate-y</div><div>24</div></div>
      <div><div>range-start</div><div>${rangeStart}</div></div>
      <div><div>range-end</div><div>entry 60%</div></div>
    </div>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head><title>BizPro — Hub</title></head>
<body>
<header></header>
<main>

  <!-- ── forge-nav ── -->
  <div>
    <div class="forge-nav">
      <div><div>Use Cases | PDF &amp; Productivity (active) | Acrobat | Express | Sign | Scan</div></div>
      <div><div>Sign In | View Pricing</div></div>
    </div>${anim('forge-nav', 'entry 0%')}
  </div>

  <!-- ── forge-hero ── -->
  <div>
    <div class="forge-hero">
      <div><div>PDF &amp; Productivity</div></div>
      <div><div><h1>With great power<br>comes great productivity.</h1></div></div>
      <div><div><p>Do your best work faster with trusted PDF tools, AI-powered document insights, secure collaboration, and professional content creation &#8212; all in one place.</p></div></div>
      <div>
        <div>${img('img-000.svg', 'Acrobat')}</div>
        <div><p>Start an Acrobat free trial</p></div>
      </div>
      <div>
        <div>${img('img-001.jpg')}</div>
        <div>${img('img-002.jpg')}</div>
        <div>${img('img-003.jpg')}</div>
      </div>
      <div>
        <div>${img('img-004.jpg')}</div>
        <div>${img('img-005.jpg', 'Signature card')}</div>
        <div>${img('img-006.jpg')}</div>
      </div>
      <div>
        <div>${img('img-007.jpg')}</div>
        <div>${img('img-008.jpg')}</div>
      </div>
      <div>
        <div>${img('img-009.jpg')}</div>
        <div>${img('img-010.jpg')}</div>
        <div>${img('img-011.jpg')}</div>
      </div>
      <div>
        <div>${img('img-012.jpg')}</div>
        <div>${img('img-013.jpg')}</div>
        <div>${img('img-014.jpg')}</div>
      </div>
    </div>${anim('forge-hero', 'entry 0%')}
  </div>

  <!-- ── forge-audience ── -->
  <div>
    <div class="forge-audience">
      <div><div><h2>Work faster.<br>No matter the work.</h2></div></div>
      <div>
        <div>Sales</div>
        <div>${img('img-015.jpg', 'Pipeline generation dashboard')}</div>
        <div>Close more deals.</div>
      </div>
      <div>
        <div>Marketing</div>
        <div>${img('img-016.jpg', 'Team reviewing marketing materials')}</div>
        <div>Take the pain out of campaigns.</div>
      </div>
      <div>
        <div>Legal</div>
        <div>${img('img-017.jpg', 'Master service agreement document')}</div>
        <div>Move the fine print faster.</div>
      </div>
      <div>
        <div>Human Resources</div>
        <div>${img('img-018.jpg', 'HR professional at desk')}</div>
        <div>Make policy more personal.</div>
      </div>
      <div><div>${img('img-019.jpg', 'Customer logos: Linktree, Ogilvy, Webflow, TBWA, Spotify and more')}</div></div>
    </div>${anim('forge-audience', 'entry 0%')}
  </div>

  <!-- ── forge-jtbd ── -->
  <div>
    <div class="forge-jtbd">
      <div><div><h2>There&#8217;s more to<br>Acrobat than Acrobat.</h2></div></div>
      <div><div><p>Create, edit, sign, and more with 70+ professional tools. Use AI to generate a presentation from your files and documents. And that&#8217;s just the beginning.</p></div></div>
      <div>
        <div>${img('img-020.jpg', 'Professional using Acrobat AI')}</div>
        <div>Understand quickly.</div>
        <div>Ask your AI Assistant to quickly summarize, analyze, provide insights, turn docs into decks, and more.</div>
      </div>
      <div>
        <div>${img('img-021.jpg', 'PDF Space sharing interface')}</div>
        <div>Share effortlessly.</div>
        <div>Share a secure PDF Space with teammates, where everyone can ask AI Assistant to help with research, strategy, planning, or quick learning.</div>
      </div>
    </div>${anim('forge-jtbd', 'entry 10%')}
  </div>

  <!-- ── forge-offer ── -->
  <div>
    <div class="forge-offer">
      <div><div>${img('img-022.jpg', 'Acrobat document showcase: invoice, media mix dashboard, white paper')}</div></div>
    </div>${anim('forge-offer', 'entry 20%')}
  </div>

  <!-- ── forge-flow ── -->
  <div>
    <div class="forge-flow">
      <div><div>${img('img-023.jpg', 'Acrobat creation workflow interface')}</div></div>
    </div>${anim('forge-flow', 'entry 20%')}
  </div>

  <!-- ── forge-whats-new ── -->
  <div>
    <div class="forge-whats-new">
      <div>
        <div>Features and Releases</div>
        <div><h2>There&#8217;s always something new with Acrobat.</h2></div>
      </div>
      <div>
        <div>${img('img-024.jpg', 'PDF to Podcast feature: audio player with waveform')}</div>
        <div>PDF to Podcast</div>
        <div>Convert any PDF into audio playback, with options to hear a quick overview or a complete narration.</div>
      </div>
      <div>
        <div>${img('img-025.jpg', 'One-click Brand Kit Setup: colorful logo on black background')}</div>
        <div>One-click Brand Kit Setup</div>
        <div>Set up a complete brand kit in a single click by automatically extracting logos, colors, and fonts from existing content.</div>
      </div>
      <div>
        <div>${img('img-026.jpg', 'AI-Powered Video Highlights: grid of portrait video frames')}</div>
        <div>AI-Powered Video Highlights</div>
        <div>Upload any video and let Adobe Express automatically find the highlights, add captions, and export in any aspect ratio.</div>
      </div>
    </div>${anim('forge-whats-new', 'entry 10%')}
  </div>

  <!-- ── forge-plans ── -->
  <div>
    <div class="forge-plans">
      <div><div><h2>Plans that work for you.</h2></div></div>
      <div>
        <div>Individuals</div>
        <div>Businesses</div>
        <div>Students &amp; Teachers</div>
      </div>
      <div>
        <div>${img('img-027.svg')}</div>
        <div>${img('img-030.svg')}</div>
        <div>${img('img-034.svg')}</div>
        <div>${img('img-037.svg')}</div>
      </div>
      <div>
        <div>PDF viewing</div>
        <div>AI Insights and creation</div>
        <div>Full PDF toolset</div>
        <div>All-in-one solution</div>
      </div>
      <div>
        <div>Acrobat Reader</div>
        <div>Acrobat Express</div>
        <div>Acrobat Pro</div>
        <div>Acrobat Studio</div>
      </div>
      <div>
        <div>Get started with the trusted standard for viewing and sharing PDFs.</div>
        <div>Get document insights with AI-powered tools, and quickly create on-brand content.</div>
        <div>Create, edit, and sign PDFs with secure document and e-signature workflows.</div>
        <div>Do it all with the complete AI-powered PDF and design solution for document workflows.</div>
      </div>
      <div>
        <div>Free</div>
        <div>US$9.99/mo</div>
        <div>US$19.99/mo</div>
        <div>US$24.99/mo</div>
      </div>
      <div>
        <div>Download today</div>
        <div>Annual, billed monthly</div>
        <div>Annual, billed monthly</div>
        <div>Annual, billed monthly</div>
      </div>
      <div>
        <div><p>Get free app</p></div>
        <div><p>Free trial</p><p>Learn more</p></div>
        <div><p>Free trial</p><p>Learn more</p></div>
        <div><p>Free trial</p><p>Learn more</p></div>
      </div>
      <div>
        <div>${img('img-028.svg')}</div>
        <div>${img('img-031.svg')}</div>
        <div>${img('img-035.svg')}</div>
        <div>${img('img-038.svg')}</div>
      </div>
    </div>${anim('forge-plans', 'entry 20%')}
  </div>

  <!-- ── forge-agentic ── -->
  <div>
    <div class="forge-agentic">
      <div><div><h2>Find what you&#8217;re looking for.</h2></div></div>
      <div><div>Get answers from our agent about Adobe products and solutions.</div></div>
      <div><div>Ask anything</div></div>
      <div><div><p>Use of this beta AI chatbot is subject to Adobe&#8217;s <a href="#">Privacy Policy</a>. Don&#8217;t share sensitive data.<br>AI responses are not your Content, may be inaccurate and any offers provided are non-binding. <a href="#">Generative AI Terms</a>.</p></div></div>
    </div>${anim('forge-agentic', 'entry 0%')}
  </div>

  <!-- ── forge-page-footer ── -->
  <div>
    <div class="forge-page-footer">
      <div>
        <div>${img('img-042.svg')}</div>
        <div>Acrobat Reader</div>
      </div>
      <div>
        <div>${img('img-043.svg')}</div>
        <div>Firefly</div>
      </div>
      <div>
        <div>${img('img-044.svg')}</div>
        <div>Adobe Express</div>
      </div>
      <div>
        <div>${img('img-045.svg')}</div>
        <div>Photoshop</div>
      </div>
    </div>
  </div>

  <!-- ── metadata ── -->
  <div>
    <div class="metadata">
      <div><div>title</div><div>BizPro &#8212; Hub</div></div>
      <div><div>foundation</div><div>c2</div></div>
    </div>
  </div>

</main>
<footer></footer>
</body>
</html>`;

writeFileSync(OUT, html, 'utf8');
console.log(`Written: ${OUT} (${html.length} chars)`);
