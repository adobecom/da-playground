#!/usr/bin/env node
/**
 * Upload the DA document to DA and trigger AEM preview.
 */
import { readFileSync } from 'node:fs';

const token = process.env.DA_TOKEN;
if (!token) { console.error('DA_TOKEN not set'); process.exit(1); }

const org = 'adobecom';
const repo = 'da-playground';
const daPath = 'drafts/osahin/snowflake/figma-d84180';
const localFile = '/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6/.snowflake/projects/001-figma-d84180/output/da/figma-d84180.html';

// Get the current git branch for the AEM preview URL
import { execSync } from 'node:child_process';
let branch;
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: '/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6', encoding: 'utf8' }).trim();
} catch (e) {
  branch = 'main';
}
console.log(`Branch: ${branch}`);

async function uploadDoc() {
  const html = readFileSync(localFile);
  const form = new FormData();
  form.append('data', new Blob([html], { type: 'text/html' }), 'figma-d84180.html');

  const adminUrl = `https://admin.da.live/source/${org}/${repo}/${daPath}.html`;
  console.log(`Uploading DA doc to ${adminUrl}...`);

  const r = await fetch(adminUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const body = await r.text();
  if (r.status !== 200 && r.status !== 201) {
    console.error(`Upload failed: HTTP ${r.status}: ${body.slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`Upload OK (${r.status})`);
  return branch;
}

async function triggerPreview(branch) {
  // AEM preview API: POST to admin.aem.page/preview/{org}/{repo}/{branch}/{path}
  const previewUrl = `https://admin.aem.page/preview/${org}/${repo}/${branch}/${daPath}`;
  console.log(`Triggering AEM preview at ${previewUrl}...`);

  const r = await fetch(previewUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await r.text();
  console.log(`Preview API response (${r.status}): ${body.slice(0, 300)}`);

  if (r.status >= 200 && r.status < 300) {
    const aemPageUrl = `https://${branch}--${repo}--${org}.aem.page/${daPath}`;
    console.log(`\nPreview URL: ${aemPageUrl}`);
    return aemPageUrl;
  } else {
    console.warn(`Preview trigger returned ${r.status} — page may still be accessible`);
    const aemPageUrl = `https://${branch}--${repo}--${org}.aem.page/${daPath}`;
    return aemPageUrl;
  }
}

const br = await uploadDoc();
const previewUrl = await triggerPreview(br);
console.log(`\nDONE. Preview: ${previewUrl}`);
