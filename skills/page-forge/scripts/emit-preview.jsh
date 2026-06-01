// emit-preview.jsh — deliver ONE bespoke HTML file to the panel as chunked preview-chunk messages.
//
// WHY: Match (Figma 1:1 and URL capture) produces a single large HTML. Sending it inline in one
// `sprinkle send` overruns the scoop's output budget / message size, so the scoop improvised its own
// chunking and BASE64-encoded the data — but the panel's preview-chunk handler concatenates RAW
// chunk strings, so it reassembled base64 gibberish and nothing rendered. This is the established,
// correct delivery: read the file, split into raw chunks, send via exec.spawn (no shell quoting,
// no base64). The panel reassembles by `id`. Mirror of emit-prototypes.jsh's delivery, for the
// single-file bespoke case (no media rewrite — Match HTML already has absolute URLs).
//
// SLICC .jsh: exec.spawn(argv[]) bypasses shell quoting; NO shebang; async fs. Verified against
// SLICC source: `sprinkle send <name> <json>` JSON.parses the arg and routes to the panel.
//
// Usage:  emit-preview.jsh <html-file> '<meta-json>'
//   meta = {"stage":"bespoke","v":1,"label":"","intent":""}  (stage defaults to "bespoke", v to 1)

const file = process.argv[2];
let meta = {};
try { meta = JSON.parse(process.argv[3] || '{}'); } catch { /* defaults below */ }
if (!file) { console.error('usage: emit-preview.jsh <html-file> \'<meta-json>\''); process.exit(1); }
if (!(await fs.exists(file))) { console.error(`ERROR: ${file} not found — nothing to deliver.`); process.exit(2); }

const stage = meta.stage || 'bespoke';
const v = Number.isFinite(meta.v) ? meta.v : 1;
const label = meta.label || '';
const intent = meta.intent || '';
const CHUNK = 6000;

function shArg(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
async function sprinkleSend(payload) {
  const json = JSON.stringify(payload);
  if (typeof exec.spawn === 'function') return exec.spawn(['sprinkle', 'send', 'page-forge', json]);
  return exec('sprinkle send page-forge ' + shArg(json));
}

const html = await fs.readFile(file);
const id = `v${v}-${(label || stage).replace(/\s+/g, '_')}`;
const total = Math.max(1, Math.ceil(html.length / CHUNK));
for (let seq = 0; seq < total; seq += 1) {
  const r = await sprinkleSend({
    action: 'preview-chunk', id, seq, total,
    v, stage, intent, label,
    data: html.slice(seq * CHUNK, (seq + 1) * CHUNK), // RAW slice — never base64
  });
  if (r.exitCode !== 0) {
    console.error(`sprinkle send failed (chunk ${seq + 1}/${total}, exit ${r.exitCode}): `
      + (r.stderr || r.stdout || '').slice(-300));
    process.exit(3);
  }
}
console.log(JSON.stringify({ emitted: 1, v, label, stage, chunks: total, bytes: html.length }));
