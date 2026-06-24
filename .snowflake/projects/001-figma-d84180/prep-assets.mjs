#!/usr/bin/env node
/**
 * Prepare only the main-content images (indices 0-23) for DA upload.
 * Copies them to a clean upload staging dir with semantic names.
 */
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const assetsDir = '/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6/.snowflake/projects/001-figma-d84180/output/assets';
const uploadDir = '/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6/.snowflake/projects/001-figma-d84180/upload';
mkdirSync(uploadDir, { recursive: true });

// Only upload images 0-23 (main content, not inventory)
const keep = [
  // Tab images (0-3)
  { from: 'tab-0-Sales.png', to: 'tab-sales.png' },
  { from: 'tab-1-Marketing.png', to: 'tab-marketing.png' },
  { from: 'tab-2-Legal.png', to: 'tab-legal.png' },
  { from: 'tab-3-Human-Resources.png', to: 'tab-human-resources.png' },
  // Feature images (4-6)
  { from: 'feature-4-Understand-quickly-visual.png', to: 'feature-understand-quickly.png' },
  { from: 'feature-5-Share-effortlessly-visual.png', to: 'feature-share-effortlessly.png' },
  { from: 'feature-6-Create-beautifully-visual.png', to: 'feature-create-beautifully.png' },
  // What's new images (7-9)
  { from: 'whats-new-7-PDF-to-Podcast.png', to: 'whats-new-pdf-podcast.png' },
  { from: 'whats-new-8-One-click-Brand-Kit-Setup.png', to: 'whats-new-brand-kit.png' },
  { from: 'whats-new-9-AI-Powered-Video-Highlights.png', to: 'whats-new-ai-video.png' },
  // Plan icons (10-13)
  { from: 'img-10-.png', to: 'plan-icon-reader.png' },
  { from: 'img-11-.png', to: 'plan-icon-standard.png' },
  { from: 'img-12-.png', to: 'plan-icon-pro.png' },
  { from: 'img-13-.png', to: 'plan-icon-studio.png' },
  // Doc thumbnails (14-23)
  { from: 'doc-14-Sign-Signature.png', to: 'doc-sign-signature.png' },
  { from: 'doc-15-Document-mock.png', to: 'doc-document-mock.png' },
  { from: 'doc-16-Special-Report.png', to: 'doc-special-report.png' },
  { from: 'doc-17-Research.png', to: 'doc-research.png' },
  { from: 'doc-18-Invoice.png', to: 'doc-invoice.png' },
  { from: 'doc-19-Asset.png', to: 'doc-asset.png' },
  { from: 'doc-20-Sales-Playbook.png', to: 'doc-sales-playbook.png' },
  { from: 'doc-21-Q3-Media-Mix.png', to: 'doc-q3-media-mix.png' },
  { from: 'doc-22-White-Paper.png', to: 'doc-white-paper.png' },
  { from: 'doc-23-Event-Flyer.png', to: 'doc-event-flyer.png' },
];

for (const { from, to } of keep) {
  const src = join(assetsDir, from);
  const dst = join(uploadDir, to);
  try {
    copyFileSync(src, dst);
    console.log(`OK: ${from} → ${to}`);
  } catch (e) {
    console.error(`FAIL: ${from}: ${e.message}`);
  }
}
console.log(`\nStaged ${keep.length} images in ${uploadDir}`);
