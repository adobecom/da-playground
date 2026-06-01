// inject-c2-brand.jsh — overwrite a fresh stardust capture's brand surface with the
// canonical Adobe Consonant 2 (C2) brand, so the redesign targets C2 even though the
// page being redesigned is public (possibly old C1) and the real C2 pages are auth-walled.
//
// This is the SLICC port of redesignStardust.js `injectC2Brand()`. In DA that copy runs
// in Node OUTSIDE the agent, so it can't be skipped. In SLICC the scoop (an agent) runs
// this between `stardust:extract` and `stardust:direct`/`uplift`. It is therefore a
// MANDATORY step the scoop MUST run — see references/redesign.md. The script fails LOUD
// (non-zero exit) if anything is off, so a missed/partial injection surfaces instead of
// silently shipping an off-brand redesign.
//
// SLICC .jsh runtime: async fs API ONLY (fs.exists/readFile/writeFile — there is NO
// fs.existsSync/copyFileSync/etc) and NO shebang (the file is wrapped in an AsyncFunction,
// so a `#!` line is a syntax error). Top-level await is available.
//
// Usage:  inject-c2-brand.jsh <workdir> [brandDir]
//   <workdir>  — the stardust project root (contains stardust/current/ after extract)
//   [brandDir] — the canonical C2 brand surface dir; defaults to this skill's vendored copy
//                (references/_vendored/acom-c2-brand-extraction), resolved from this script.

const workdir = process.argv[2];
if (!workdir) { console.error('usage: inject-c2-brand.jsh <workdir> [brandDir]'); process.exit(1); }

// Resolve the vendored C2 brand dir: explicit arg → relative to this script → workspace path.
function dirname(p) { return (p || '').replace(/\/[^/]*$/, '') || '.'; }
async function firstExisting(cands) {
  for (const c of cands) { if (c && (await fs.exists(c))) return c; }
  return null;
}

const scriptDir = dirname(process.argv[1] || '');
const brandDir = process.argv[3] || (await firstExisting([
  `${scriptDir}/../references/_vendored/acom-c2-brand-extraction`,
  '/workspace/skills/page-forge/references/_vendored/acom-c2-brand-extraction',
]));

if (!brandDir || !(await fs.exists(`${brandDir}/_brand-extraction.json`))) {
  console.error(`ERROR: canonical C2 brand surface not found${brandDir ? ` at ${brandDir}` : ''} — `
    + 'vendor references/_vendored/acom-c2-brand-extraction/ (sync-references.mjs) before running.');
  process.exit(2);
}

const currentDir = `${workdir}/stardust/current`;
if (!(await fs.exists(currentDir))) {
  console.error(`ERROR: ${currentDir} does not exist — extract did not produce a capture, so there is `
    + 'nothing to inject the C2 brand over. Run stardust:extract first.');
  process.exit(3);
}

// Copy the brand surface (required) + DESIGN.json (optional) over the captured ones.
// SLICC has no fs.copyFileSync — copy = readFile + writeFile (these are JSON text files).
const brandSrc = `${brandDir}/_brand-extraction.json`;
const brandDst = `${currentDir}/_brand-extraction.json`;
const want = await fs.readFile(brandSrc);
await fs.writeFile(brandDst, want);

const designSrc = `${brandDir}/DESIGN.json`;
let designCopied = false;
if (await fs.exists(designSrc)) {
  await fs.writeFile(`${currentDir}/DESIGN.json`, await fs.readFile(designSrc));
  designCopied = true;
}

// Post-injection assertion: the target must now byte-match the canonical brand. This is the
// fail-loud guard that replaces DA's out-of-agent determinism — if the copy didn't land, stop.
const got = (await fs.exists(brandDst)) ? await fs.readFile(brandDst) : '';
if (got !== want) {
  console.error('ERROR: post-injection check failed — stardust/current/_brand-extraction.json does not '
    + 'match the canonical C2 surface. Do NOT proceed; the redesign would be off-brand.');
  process.exit(4);
}

console.log(JSON.stringify({ injected: true, brandDir, brandDst, designCopied }));
