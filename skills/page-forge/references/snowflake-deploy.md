# Snowflake deploy → DA + Helix preview

Ported from `page-forge/server/server.js` `buildSnowflakeDeployPrompt` + `runDeployPrototype`.
Publishes `input/bespoke.html` as an authorable Adobe DA page that renders 1:1.

## Inputs in the working directory

- `input/bespoke.html` — the bespoke HTML to snowflake. **Preserve the visual output 1:1.**
  This file is the only source of truth for layout, styling, copy, and assets.
- The cwd is a **fresh git worktree** of `<org>/<site>` on a new branch
  `forge-proto-<short>-<ts>`. `scripts/deploy.jsh` commits + pushes after you finish — do
  **not** `git commit` yourself.

## DA target & auth

- org: `<org>` (e.g. `adobecom`), repo: `<site>` (e.g. `da-playground`), DA path: `/<slug>`.
- **Auth is the connected Adobe IMS session** (`oauth-token adobe`). It covers DA + AEM admin
  (`admin.aem.page/.live`, `admin.hlx.page`). **No `DA_TOKEN`, no manual admin curl.**
- **Use SLICC's `aem` command** for DA + preview/publish — it wraps the admin API:
  `aem put <local> <da-path>` · `aem get` · `aem list` · `aem preview <path>` · `aem publish <path>`.

## ⛔ Step 0 — verify Adobe auth BEFORE any conversion work

Run **`scripts/check-aem-auth.jsh`** first. It does a live `aem list /` probe. A stale/revoked
Adobe token still *exists* (`oauth-token adobe` returns ~1200 chars) but DA rejects it with
`forbidden: oauth.adobe.token on admin.da.live`, and every `aem put`/`aem preview` then hangs —
this is what stalled a deploy for 15+ minutes *after* the snowflake conversion had already run. If
the probe exits non-zero, **stop and emit `action:"error"`** telling the user to re-sign-in
(Settings → Providers → Sign in with Adobe). Do **not** install the substrate or start the
conversion until the probe passes.

## Prereq — install the snowflake skill

Install it from **PR #166** — the Milo **block-level + animation** flavor (ships as a SLICC-installable
package), once per workspace. The branch lives on the **fork `vhargrave/skills`** until #166 merges
into `adobe/skills`:

```
upskill vhargrave/skills --path plugins/aem/edge-delivery-services --all --branch feat/snowflake-milo-substrate-v2
```

It lands at `/workspace/skills/snowflake/SKILL.md`. No vendoring, no `.claude` symlink.
**When #166 merges upstream,** switch to `upskill adobe/skills --path plugins/aem/edge-delivery-services --all`
(default branch) and drop the fork pin.

## Milo repos (e.g. da-playground) — block-level **editable blocks** (default)

da-playground is a **Milo** repo (its `head.html` boots milolibs / `scripts/scripts.js` calls
`setLibs()`), so the skill's `install-substrate.mjs` auto-selects the **Milo flavor**: it adds
project-local blocks and leaves Milo's `head.html`/`scripts.js`/`styles.css` intact — replacing
them rips out the runtime that loads the live gnav/footer (→ a broken, fully-expanded static gnav
blob). The EDS flavor (which replaces them) is for vanilla-EDS repos only.

**The default Milo deploy is `conversionLevel: block-level`** — the goal is an **editable** DA page:
every section authored as a real **block table** (so authors/designers can edit it in DA), rendered
**1:1** with the bespoke design, with the **live Milo gnav/footer**, plus **adjustable `--pa-*`
scroll animations**. This mirrors the DA tool's `buildSnowflakeDeployPrompt` Milo block methodology
(forge `stage`). Do **not** produce the page-level overlay by default — that's the fallback below.
In Phase 3, **read the "Milo flavor deltas" at the top of the skill's Block-level path FIRST.**

## What to do — snowflake skill methodology (Milo block-level)

Read `/workspace/skills/snowflake/SKILL.md`, then walk `phases/0-prereq.md` → `phases/5-roundtrip.md`
in order against this working directory, with `conversionLevel: block-level`:

1. **Phase 0 — Prereq.** Install the substrate:
   `node /workspace/skills/snowflake/scripts/install-substrate.mjs` (use `--force` if a prior run on
   this branch left one). It auto-selects the Milo flavor; on the block-level path the
   `blocks/snowflake` overlay block it adds is simply unused (harmless). It also drops the vendored
   **`blocks/animation` + `tools/page-animator/controls.js`** scroll-animation runtime (from
   `milo @ page-animator-poc`). Do NOT force the EDS flavor; leave Milo's
   `head.html`/`scripts.js`/`styles.css` untouched.
2. **Phases 1–3 — Capture / Analyze / Generate (block-level).** Read `input/bespoke.html`. Capture the
   source's chrome metadata from its `<head>` (`foundation`, `gnav-source`, `footer-source`, `unav`,
   `universal-nav`, …) — do **not** snapshot the rendered gnav/footer DOM. Then for **each content
   section** emit a bespoke block:
   - **Block name `forge-<kebab(section)>`** (e.g. `forge-hero`, `forge-compare-plans`) — never a real
     Milo block id. Milo loads any block from the repo root with no allow-list, so these decorate
     natively.
   - **`blocks/forge-<name>/forge-<name>.js`** — a `decorate(block)` that reads the authored rows and
     **rebuilds the section's source DOM** (re-add `.lede`, `.btn`, grid/column wrappers via
     `createElement`). DA stores only bare semantic elements; the decorator restores the structure the
     CSS targets. **This is the crux of 1:1 fidelity.**
   - **`blocks/forge-<name>/forge-<name>.css`** — the section's scoped styles, **self-contained**:
     include any `:root` tokens + shared-component rules the block needs (Milo owns `styles/styles.css`
     — do NOT write/replace it, or edit `head.html`/`scripts.js`). For full-bleed sections, override
     Milo's wrapper constraints (`.section .forge-<name>-wrapper { max-width: unset; padding: 0; }` —
     match Milo's actual wrapper class) and scope rules specifically enough to beat Milo's base
     `main`/`.section`/typography. **Full-bleed/width regressions are the #1 cause of "not 1:1" —
     handle them per block.**
   - **Animations (step B.5b) — emit adjustable `--pa-*` `animation` sidecar blocks, NOT bundled JS.**
     For each animated section, add a sibling `<div class="animation forge-<name>">` of
     `--pa-*`/`range-*`/`timing-*` rows (values are **bare numbers**, no px). The vendored
     `blocks/animation` runtime finds the target by class name and drives a CSS scroll animation the
     page-animator panel can adjust. **Policy = `default`:** a tasteful conservative reveal per major
     section (fade-up: `--pa-opacity-from 0`, `--pa-translate-y 24`, range `entry 0%` → `entry 60%`),
     lightly staggered across siblings; animate the section/primary block, not tiny atoms. Above-the-fold
     sections render settled (`view()` is scroll-driven) — emit anyway. Follow the skill's
     `knowledge/animation-sidecars.md`. (`preserve` = only where the source had motion; `off` = none.)
3. **Phase 4 — Wire + DA upload.** Upload to DA at `/<slug>` a **Milo page** whose `<main>` is standard
   positional **block tables**, one `<div class="forge-…">` per section (+ its `animation` sidecar),
   plus a `metadata` block re-emitting the captured chrome metadata + `title`. **Empty
   `<header>`/`<footer>`. Do NOT emit a `template` metadata key** (that's the overlay path and makes
   Milo try to load a non-existent template). No slot-keyed rows. Upload the page + referenced images
   with **`aem put`** so block-table cells reference DA-hosted URLs. Copy each `blocks/forge-*/{js,css}`
   (and the substrate's `blocks/animation` + `tools/page-animator/controls.js`) into the repo. Do NOT
   copy `templates/`, `styles/`, `head.html`, or `fragments/`, and do NOT create `blocks/header|footer`.
4. **Phase 5 — Roundtrip + 1:1 gate.** Trigger the preview with **`aem preview /<slug>`**. Before
   declaring done, confirm at `https://<branch>--<site>--<org>.aem.page/<slug>`: the **live Milo
   global-nav + footer** render (NOT a static blob), every `forge-*` block renders **1:1** (fix any
   layout drift in the block CSS — screenshot the source section vs the rendered block), and the body
   is **editable block tables** in DA.

### Fallback — page-level frozen overlay (only if a section won't converge to 1:1 in time)

The legacy overlay is faithful 1:1 but the body is **not editable**. To use it, set
`conversionLevel: page-level` and follow the skill's Milo page-level path: empty `<header>`/`<footer>`,
one `snowflake` block whose first row is `template | <slug>` (the ONLY template signal — `snowflake.js`
reads it), a `metadata` block with the chrome metadata + `title` (**no `template` row in metadata** —
it would fight Milo's own template system), and `templates/<slug>.html` + `styles/<slug>.css` copied
into the repo. Keep **all** the source's C2 block stylesheet `<link>`s in the template (drop only
gnav/footer CSS) — the overlay injects pre-decorated DOM Milo does not re-decorate. This is a demo
safety net, not the default.

## Post-agent backfills (the Cone / scripts handle these)

- **`scripts/aem.js`** (**EDS substrate only** — skip on da-playground / any Milo repo, where the
  Milo flavor keeps Milo's runtime and never imports `./aem.js`). On a vanilla-EDS substrate the
  generated code imports `./aem.js` but doesn't ship it; backfill from canonical Helix Boilerplate
  before pushing.
- **Forge Sidekick listeners** — re-add Adjustments/Annotations/Publish listeners so the proto
  page exposes the same overlay entry points Milo pages get.

## Push + verify

- `scripts/deploy.jsh` commits all changes and pushes the branch. If there's no diff, that's a
  failure (substrate/templates missing).
- **git push auth:** SLICC's git is **isomorphic-git** (HTTP over `fetch`), so the designer's
  scoped **`GITHUB_PAT`** secret authenticates the push (the OAuth-app sign-in is org-blocked on
  adobecom). The push happens **as the designer**, so their account must have **Write** on the
  repo (granted via the `milo-contributors` team); `main`/`stage`/`forge-poc` are ruleset-protected.
- Verify `https://<branch>--<site>--<org>.aem.page/<slug>` resolves (retry ~12× / 5s — a new
  branch needs ~20–60s for the edge to learn it). A non-resolving URL after retries is a soft
  warning, not a hard failure, if the DA upload was confirmed.

## .aem.live (only if the demo needs it)

The above yields a **`.aem.page`** preview. For the live hostname, run **`aem publish /<slug>`**
(same Adobe IMS auth — no token). Otherwise `.aem.page` is the shareable prototype URL.

## Finish signal

On success, the agent's final lines must be exactly:

```
SNOWFLAKE_DONE
{"daPreviewUrl":"<the .aem.page url>", "slug":"<slug>"}
```

On failure:

```
SNOWFLAKE_FAILED
<one-line reason>
```

Don't emit either until you actually succeed/fail. Don't fabricate URLs.
