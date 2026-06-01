// deploy.jsh — commit the snowflake worktree and push the forge-proto-* branch.
// SLICC .jsh: global exec()/fs/process. The snowflake skill already uploaded DA content via
// `aem put`; this lands the substrate code (templates/, scripts/, fragments/) on a branch so
// the Helix preview resolves.
//
// SLICC .jsh runtime: exec() is ASYNC and resolves to { stdout, stderr, exitCode } (NOT .code),
// and the file must have NO shebang (it's wrapped in an AsyncFunction). git runs against the
// worktree via `git -C <wt>` rather than a cwd option, so no exec-options support is assumed.
//
// Usage:  deploy.jsh <worktree-dir> <branch> "<commit message>"
//
// Auth: SLICC's git is isomorphic-git (HTTP over the fetch-proxy). The designer's GITHUB_PAT
// secret (set via `secret set GITHUB_PAT … --domain github.com,*.github.com`) is injected into
// github.com requests, so plain `git push` authenticates as the designer. The OAuth-app
// "Sign in with GitHub" path is org-blocked on adobecom, hence the scoped PAT. The pusher must
// have Write on the target repo (via the milo-contributors team). No credential helper needed.

const wt = process.argv[2];
const branch = process.argv[3];
const msg = process.argv[4] || '[page-forge] snowflake prototype';
if (!wt || !branch) { console.error('usage: deploy.jsh <worktree> <branch> [msg]'); process.exit(1); }

function git(args) { return `git -C ${JSON.stringify(wt)} ${args}`; }
async function run(args) {
  const r = await exec(git(args));            // exec() → Promise<{ stdout, stderr, exitCode }>
  if (r.exitCode !== 0) throw new Error(`\`git ${args}\` failed (${r.exitCode}): ${(r.stderr || r.stdout || '').slice(-400)}`);
  return (r.stdout || '').trim();
}

await run('add -A');
// Fail loudly if the agent produced no diff (substrate/templates missing).
const staged = await exec(git('diff --cached --quiet'));
if (staged.exitCode === 0) { console.error('ERROR: no diff to commit (substrate/templates missing?)'); process.exit(2); }

await run(`-c user.name=page-forge -c user.email=page-forge@adobe.com commit -q -m ${JSON.stringify(msg)}`);
const sha = await run('rev-parse HEAD');

const push = await exec(git(`push origin HEAD:${branch}`));
if (push.exitCode !== 0) {
  console.error(JSON.stringify({ pushed: false, sha, branch, error: (push.stderr || push.stdout || '').slice(-500) }));
  process.exit(3);
}
console.log(JSON.stringify({ pushed: true, sha, branch }));
