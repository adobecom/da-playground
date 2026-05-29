#!/usr/bin/env jsh
// deploy.jsh — commit the snowflake worktree and push the forge-proto-* branch.
// SLICC .jsh: global exec()/fs/process. The snowflake skill already uploaded DA content via
// `aem put`; this lands the substrate code (templates/, scripts/, fragments/) on a branch so
// the Helix preview resolves.
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

function run(cmd) {
  const r = exec(cmd, { cwd: wt });        // exec() → { code, stdout, stderr }
  if (r.code !== 0) throw new Error(`\`${cmd}\` failed (${r.code}): ${(r.stderr || r.stdout || '').slice(-400)}`);
  return (r.stdout || '').trim();
}

run('git add -A');
// Fail loudly if the agent produced no diff (substrate/templates missing).
const staged = exec('git diff --cached --quiet', { cwd: wt });
if (staged.code === 0) { console.error('ERROR: no diff to commit (substrate/templates missing?)'); process.exit(2); }

run(`git -c user.name=page-forge -c user.email=page-forge@adobe.com commit -q -m ${JSON.stringify(msg)}`);
const sha = run('git rev-parse HEAD');

const push = exec(`git push origin HEAD:${branch}`, { cwd: wt });
if (push.code !== 0) {
  console.error(JSON.stringify({ pushed: false, sha, branch, error: (push.stderr || push.stdout || '').slice(-500) }));
  process.exit(3);
}
console.log(JSON.stringify({ pushed: true, sha, branch }));
