// check-aem-auth.jsh — verify the Adobe IMS / DA token actually WORKS before deploying.
//
// WHY THIS EXISTS: deploy's credential check only confirmed the token *exists*
// (`oauth-token adobe` returns ~1200 chars). But a stale/revoked token still exists — DA just
// rejects it, and every `aem put`/`aem list`/`aem preview` fails with:
//     forbidden: oauth.adobe.token on admin.da.live
// The scoop then silently retried `aem put` for 15+ minutes mid-deploy (after it had already run
// the heavy snowflake conversion + committed). This script turns that silent hang into an instant,
// clear failure BEFORE any snowflake work: run it as the FIRST deploy step. If it exits non-zero,
// emit action:"error" with the re-sign-in instruction and do NOT start the conversion.
//
// SLICC .jsh runtime: exec() / exec.spawn() async → { stdout, stderr, exitCode }; NO shebang.
// We prefer exec.spawn (no shell quoting); fall back to exec() on older builds.

async function aem(argv) {
  if (typeof exec.spawn === 'function') return exec.spawn(['aem', ...argv]);
  return exec('aem ' + argv.join(' '));
}

// `aem list /` is a cheap authenticated read against admin.da.live. A good token lists (or returns
// a benign non-auth response); a stale token returns the `oauth.adobe.token` / forbidden signature.
const r = await aem(['list', '/']);
const blob = `${r.stderr || ''} ${r.stdout || ''}`.toLowerCase();

// Key on the specific stale-token signature; only treat a generic forbidden/401/403 as auth-bad
// when it co-occurs with an auth/oauth/token word (avoids false-positives on unrelated 403s).
const authBad =
  /oauth\.adobe\.token/.test(blob) ||
  (/(forbidden|unauthorized|401|403)/.test(blob) && /(oauth|token|sign[- ]?in|auth)/.test(blob));

if (authBad) {
  console.error(
    'ERROR: Adobe sign-in is stale/revoked — DA rejected the token ("forbidden: oauth.adobe.token '
    + 'on admin.da.live"). Re-authenticate BEFORE deploying: Settings → Providers → Sign in with '
    + 'Adobe, then retry. Do NOT start the snowflake conversion — every aem call will fail the same '
    + 'way and the deploy will hang.',
  );
  process.exit(2);
}

// A non-zero exit WITHOUT the auth signature is inconclusive (e.g. empty root, transient network).
// Don't hard-block on it — report it so the scoop can decide, but the token itself looks usable.
console.log(JSON.stringify({ adobeAuth: 'ok', probe: 'aem list /', exitCode: r.exitCode }));
