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

## Prereq — install the snowflake skill

Install it from PR #154 (it ships as a SLICC-installable package), once per workspace:

```
upskill adobe/skills --path plugins/aem/edge-delivery-services --all --branch feat/eds-snowflake-da-content
```

It lands at `/workspace/skills/snowflake/SKILL.md`. No vendoring, no `.claude` symlink.

## Milo repos (e.g. da-playground) — use the Milo substrate flavor

If the target repo is a **Milo** repo (its `head.html` boots milolibs / `scripts/scripts.js`
calls `setLibs()`), the skill's `install-substrate.mjs` auto-detects this and installs the
**Milo flavor**: it adds only `blocks/snowflake/{js,css}` and leaves Milo's
`head.html`/`scripts.js`/`styles.css` intact. This is required — the EDS flavor replaces
those files and rips out the Milo runtime that loads the live global-nav + footer, which
produces a broken, fully-expanded static gnav blob.

On a Milo repo:
- **Do not** capture/emit static header/footer fragments. Milo renders the live gnav/footer
  from the page's `gnav-source`/`footer-source`/`foundation:c2` metadata — preserve those
  from the source page onto the DA page (see `phases/3-generate.md` "Milo flavor deltas").
- The DA page is a Milo page: empty `<header>`/`<footer>`, one `snowflake` block (template
  name + optional slot overrides), and a `metadata` block carrying the chrome metadata +
  `template` + `title`.
- **Skip the `scripts/aem.js` backfill below** — that's only for the EDS substrate, which
  imports `./aem.js`. Milo ships its own runtime.

## What to do — snowflake skill methodology

Read `/workspace/skills/snowflake/SKILL.md`, then walk `phases/0-prereq.md` →
`phases/5-roundtrip.md` in order against this working directory:

1. **Phase 0 — Prereq.** Install the substrate:
   `node /workspace/skills/snowflake/scripts/install-substrate.mjs` (use `--force` if a prior
   run on the same branch left one). On a Milo repo this auto-selects the Milo flavor (above).
2. **Phases 1–3 — Capture / Analyze / Generate.** Read `input/bespoke.html`. Produce:
   - `templates/<slug>.html` — static layout with `[data-slot]` markers on the text/image/link
     nodes that should be DA-authorable.
   - DA-shape block tables (block-name + slot-name + cell-content per
     `da-content/references/html-content.md`) for the authorable content.
   - Upload referenced images to DA with **`aem put`** so block tables reference DA-hosted URLs.
3. **Phase 4 — Wire.** Upload the block-table HTML to DA at `/<slug>` under `<org>/<site>`
   with **`aem put`**. Set `<meta name="template" content="<slug>">` (or `body[data-template]`)
   so the substrate's `scripts.js` loads the right template.
4. **Phase 5 — Roundtrip.** Trigger the preview with **`aem preview /<slug>`**, then confirm
   the substrate resolves the template. Runtime preview:
   `https://<branch>--<site>--<org>.aem.page/<slug>`.

## Post-agent backfills (the Cone / scripts handle these)

- **`scripts/aem.js`** — the substrate imports `./aem.js` but doesn't ship it; custom-scaffold
  repos like da-playground lack it. Backfill from canonical Helix Boilerplate before pushing.
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
