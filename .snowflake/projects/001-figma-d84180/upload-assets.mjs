#!/usr/bin/env node
/**
 * Upload staged images to DA using DA_TOKEN env var.
 * Outputs image-mapping.json with local-filename → content.da.live URL.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const token = process.env.DA_TOKEN;
if (!token) { console.error('DA_TOKEN not set'); process.exit(1); }

const org = 'adobecom';
const repo = 'da-playground';
const scope = 'media/snowflake/figma-d84180';
const uploadDir = '/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6/.snowflake/projects/001-figma-d84180/upload';
const outFile = '/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6/.snowflake/projects/001-figma-d84180/output/image-mapping.json';

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

async function upload(file) {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  const mime = MIME[ext] || 'image/png';
  const remotePath = `${scope}/${file}`;
  const adminUrl = `https://admin.da.live/source/${org}/${repo}/${remotePath}`;
  const contentUrl = `https://content.da.live/${org}/${repo}/${remotePath}`;

  const bytes = await readFile(join(uploadDir, file));
  const form = new FormData();
  form.append('data', new Blob([bytes], { type: mime }), file);

  const r = await fetch(adminUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (r.status !== 200 && r.status !== 201) {
    const body = await r.text();
    return { file, ok: false, reason: `HTTP ${r.status}: ${body.slice(0, 200)}` };
  }
  return { file, ok: true, contentUrl, size: bytes.length };
}

async function main() {
  const files = (await readdir(uploadDir)).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
  console.log(`Uploading ${files.length} files...`);

  const mapping = {};
  let ok = 0, fail = 0;

  for (const file of files) {
    const r = await upload(file);
    if (r.ok) {
      mapping[file] = r.contentUrl;
      console.log(`OK   ${file} (${r.size}B) → ${r.contentUrl}`);
      ok++;
    } else {
      console.error(`FAIL ${file}: ${r.reason}`);
      fail++;
    }
  }

  writeFileSync(outFile, JSON.stringify(mapping, null, 2));
  console.log(`\nDone: ${ok} ok, ${fail} failed. Mapping written to ${outFile}`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
