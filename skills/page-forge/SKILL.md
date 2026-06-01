---
name: page-forge
description: >-
  Side-panel tool that turns a Figma frame / page URL / raw HTML into either a 1:1 prototype
  (Match) or a beautiful Adobe Consonant 2 redesign (Reimagine, via the real two-phase Stardust
  engine), and — only on explicit request — publishes it to Adobe DA. The panel drives FOUR
  separate actions (preflight, generate, refine, deploy); the scoop handles EXACTLY ONE per event.
  generate = preview only (Match 1:1, or Reimagine → Stardust variants), refine = Stardust preview
  only, deploy = the only action that snowflakes/pushes/publishes. generate and refine MUST NOT deploy.
  Use when the user wants to: preview a page from Figma/URL/HTML, Reimagine it with Stardust, or
  (separately) publish a prototype to DA. Triggers on "page forge", "figma to page", "figma to da",
  "snowflake this", "make a prototype", "1:1 prototype", "reimagine", "redesign this page", "deploy to da".
allowed-tools: bash
---

# Page Forge (SLICC)

Browser-native re-host of the Page Forge pipeline (originally a local `:3002` Node server).
Figma / page URL / raw HTML → 1:1 prototype on Adobe DA, with an optional Stardust redesign.

## Architecture (cone / scoop / sprinkle)

- The **cone** (main agent), on invocation, spawns a dedicated scoop —
  `scoop_scoop("page-forge")` — and feeds it the job — `feed_scoop("page-forge", "…")`. The
  cone does **not** write the UI or call sprinkle commands; it just spawns and routes.
- The **`page-forge` scoop** owns the **`page-forge.shtml` sprinkle** (the side-panel UI). It
  handles `preflight` / `generate` / `refine` / `deploy` lick events (routed from the sprinkle via
  the cone) and pushes updates back with `sprinkle send page-forge '{…}'`.
- Everything in "Preflight" and "Pipeline" below is the **scoop's** behavior.

## ⛔ Action dispatch — the single most important rule

Every lick carries `data.action`. The scoop handles **exactly that one action and then stops.**
**Do NOT chain actions. Do NOT "finish the job."** The designer drives the steps from the panel.

| `data.action` | Do | NEVER do |
|---|---|---|
| `preflight` | probe creds, emit `check`s | anything else |
| `generate` (`mode:'match'`) | make the 1:1 HTML, emit `action:"preview"`, **STOP** | ❌ no git, no snowflake, no `aem`, no deploy |
| `generate` (`mode:'reimagine'`) | run the two-phase Stardust engine (`references/redesign.md`), emit **one `action:"preview"` per variant** (1 with intent, 3–4 blank), **STOP** | ❌ no git, no snowflake, no `aem`, no deploy |
| `refine` | Stardust-redesign the viewed version (intent-mode), emit `action:"preview"`, **STOP** | ❌ no git, no snowflake, no `aem`, no deploy |
| `deploy` | snowflake → git push → `aem` → emit `action:"done"` | — (this is the ONLY action allowed to publish) |

**`generate` and `refine` produce a PREVIEW and nothing else.** They never create a branch, never
run the snowflake skill, never call `aem`, never touch GitHub. Publishing happens **only** when a
separate `deploy` lick arrives (the panel's "Create prototype" button). If you find yourself
running `git`, the snowflake skill, or `aem` during a `generate`/`refine`, you have a bug — stop.

**Structural guard (the panel enforces this for you):** `generate` and `refine` licks **omit the
repo/site (`data.da`)** entirely — only `deploy` (and read-only `preflight`) carry it. So if a lick
has no `data.da`, you have neither the repo nor the slug and **cannot deploy even if you wanted to —
emit the preview and stop.** Each lick also carries `data._rule` restating its constraint; obey it.

## Install

```
# this skill (team distribution)
upskill adobecom/da-playground --path skills/page-forge

# the snowflake deploy skill (PR #154 — ships as a SLICC package)
upskill adobe/skills --path plugins/aem/edge-delivery-services --all --branch feat/eds-snowflake-da-content

# the Reimagine (Stardust) engine + its hard dependency, impeccable
upskill adobe/skills --path plugins/stardust --all
upskill pbakaus/impeccable
```

They land in `/workspace/skills/<name>/`. For the **Reimagine** path the stardust + impeccable
skills must be reachable as `.claude/skills/{stardust,impeccable}` from the **working dir** (symlink
them in, mirroring the snowflake-deploy pattern). Stardust runs best on **Opus + extended thinking**.
Regenerate `references/_vendored/` (incl. the vendored C2 brand surface) before publishing the skill
(see `references/README.md` / `scripts/sync-references.mjs`).

## The pipeline — generate → refine* → deploy (iterative)

Three separate actions, mirroring the da.live Page Forge tool. Each produces a **version**;
the designer flips between versions in the panel and deploys whichever one they pick.

```
input (figma | url | html)  +  mode (match | reimagine; figma is always match)
        │
        ├─ generate · MATCH ──────►  v1  =  bespoke 1:1 HTML   (Figma extract / URL+HTML passthrough)
        │
        ├─ generate · REIMAGINE ──►  two-phase Stardust → 1 variant (intent) or 3–4 (blank: A/B/C+cine)
        │
        ▼  (repeatable — each refine = a new version off the viewed one)
   [refine]    ──►  Stardust redesign (intent-mode, 1 variant) of the viewed version
        │
        ▼  (on the version the designer chose)
   [deploy]    ──►  snowflake skill → git push forge-proto-* → aem preview → preview URL
```

Keep every version's HTML in the working dir (`output/v<N>.html`) so refine can base off any
version and deploy can ship the chosen one. Emit an `action:"preview"` (with the version
number) after **every** generate variant / refine so the panel updates live.

The **generate** step is a **pluggable seam** — its Figma-extraction internals are owned by the
parallel fidelity thread (REST-based motion/static-fidelity work). This skill calls whatever
extract logic is current; everything downstream is unaffected.

## Access model — per-designer, scoped credentials

| Capability | How it's provided | Who does it |
|---|---|---|
| **DA + AEM preview/publish** | the connected **Adobe IMS** session (`oauth-token adobe`) — used by `mount --source da://…` and the **`aem`** command. **No separate DA token.** | the designer: Settings → Providers → Sign in with Adobe (one click) |
| **Figma read** | the designer's **logged-in figma.com browser session** (SLICC drives real Chrome); `FIGMA_TOKEN` secret only as a REST/raster fallback | the designer (just be logged in) |
| **GitHub push** | a **fine-grained PAT** the designer creates, scoped to **the target repo(s) they work with** (e.g. `da-playground`, `da-cc`) with **Contents: Read and Write**. Stored via `secret set GITHUB_PAT --domain "github.com,*.github.com"`. SLICC's git is isomorphic-git over the fetch-proxy → the secret authenticates the push. Pushes **as the designer**, so their account needs **Write** on the target repo (via team membership, e.g. `milo-contributors`). Protected branches are ruleset-locked → only `forge-proto-*` / personal branches are pushable. One-time ~2-min setup; the preflight detects the target repo and walks them through it; multiple repos can share one token. | the designer (one-time, guided by preflight) + org grants team Write once |

Why a PAT, not "Sign in with GitHub": the OAuth-app path is **org-blocked on adobecom**, so the
device-flow sign-in can't authorize against adobecom repos. A per-user fine-grained PAT is the
tightest credential GitHub allows (one repo, one permission) and still pushes **as the designer** —
so "only people with repo Write can push" still holds. The agent only ever sees masked secrets.

> **Org gotcha to verify once:** adobecom must allow fine-grained PATs (org setting). If the org
> requires per-token *approval*, each designer's token needs an org-owner approval before the first
> push works — that adds a step to onboarding. Confirm with an org admin before broad rollout.

## SLICC commands this skill relies on (don't reinvent)

- **`aem`** — `aem put <local> <da-path>` · `aem get` · `aem list` · `aem preview <path>` ·
  `aem publish <path>`. Wraps the DA/AEM admin API with Adobe OAuth. Use instead of curl.
- **`mount --source da://adobecom/da-playground /mnt/da`** — DA as a filesystem (Adobe OAuth).
- **`scripts/figma-fetch.jsh`** — optional Figma REST structure + `/images` raster export.
- **`scripts/inject-c2-brand.jsh`** — Reimagine: overwrite the stardust capture's brand with the
  canonical C2 surface (mandatory, fail-loud). See `references/redesign.md`.
- **`scripts/collect-prototype.jsh`** — Reimagine: prepare a stardust prototype for the preview
  iframe (rewrite local `assets/media/` refs → live URLs so images render; inline lenis for cinematic).
- **`scripts/deploy.jsh`** — commit + push the `forge-proto-*` substrate branch.

## Sprinkle ⇄ scoop protocol

The sprinkle fires:

**The scoop is a STATELESS transform.** The panel owns the version HTML and hands the scoop the
exact HTML to work on. The scoop never keeps version state and never "continues" past its action.

```js
// preflight carries da (read-only) so the GitHub PAT check targets the right repo.
slicc.lick({ action: 'preflight', data: { da: { org: 'adobecom', site: 'da-playground' } } })
// 1. generate — PREVIEW ONLY. NO da (can't deploy). `mode` picks the engine.
//    'match' html source never reaches the scoop (the panel renders pasted HTML itself), so the
//    scoop only sees source 'url' or 'figma'. 'reimagine' runs the two-phase Stardust engine and
//    emits ONE preview per variant (1 with intent, 3–4 blank).
slicc.lick({ action: 'generate', data: {
  source: 'url' | 'figma',
  input:  '<page url | figma url>',
  mode:   'match' | 'reimagine',          // figma is always treated as match (1:1 extract)
  intent: '<reimagine only — blank = 3 auto variants; text = one targeted redesign>',
  _rule:  'PREVIEW ONLY — match: emit action:"preview" + STOP. reimagine: follow references/redesign.md '
        + '(extract → MANDATORY scripts/inject-c2-brand.jsh → direct|uplift), emit one preview per variant, STOP. No repo/slug; no deploy.'
}})
// 2. refine — PREVIEW ONLY. NO da. Intent-mode Stardust on the EXACT html handed in (not a stored file).
slicc.lick({ action: 'refine', data: {
  intent: '<optional — empty = default Consonant 2 redesign>',
  fromV: <version being viewed>,
  fromHtml: '<the full HTML of that version — redesign THIS>',
  _rule:  'PREVIEW ONLY — Stardust-redesign fromHtml (references/redesign.md, inject C2), emit action:"preview", STOP; no repo/slug; no deploy.'
}})
// 3. deploy — the ONLY publishing action (and the ONLY lick with da). Snowflake the EXACT html.
slicc.lick({ action: 'deploy', data: {
  v: <version number being shipped>,
  html: '<the full HTML to snowflake — publish THIS, do not regenerate>',
  slug: '<optional — blank means auto-derive>',
  da: { org: 'adobecom', site: 'da-playground' },
  _rule:  'PUBLISH — verify Adobe+GitHub; snowflake THIS html; push forge-proto-*; aem preview; emit done.'
}})
```

The scoop pushes back:

```bash
sprinkle send page-forge '{"action":"check","key":"adobe|figma|github","status":"ok|missing","fix":"…"}'
sprinkle send page-forge '{"action":"preflight-done","ready":true}'
sprinkle send page-forge '{"action":"update","phase":"generate|refine|deploy","status":"…"}'
# MATCH / Figma (1:1): stream the version's HTML inline so the panel shows it + adds a chip.
# stage "bespoke". Match payloads are produced by you, so the inline form is fine here.
sprinkle send page-forge '{"action":"preview","v":1,"stage":"bespoke","intent":"","html":"<full HTML>"}'
# REIMAGINE / refine: do NOT emit preview yourself — run scripts/emit-prototypes.jsh, which sends
# the stardust prototype files as chunked `preview-chunk` messages (panel reassembles by `id`). This
# keeps HTML OUT of your output budget and forbids hand-authoring. The script emits, per chunk:
#   {"action":"preview-chunk","id":"v1-Variant_A","seq":0,"total":2,"v":1,"stage":"redesigned",
#    "intent":"<intent>","label":"Variant A","data":"<≤6KB slice of the HTML>"}
# (label ∈ "Redesign" | "Variant A/B/C" | "Variant C — cinematic"). You never build these by hand.
# done — only after DEPLOY. The panel swaps the preview to the live URL and shows a report.
sprinkle send page-forge '{"action":"done","url":"https://forge-proto-…--da-playground--adobecom.aem.page/<slug>","slug":"<slug>","branchUrl":"…","branchName":"forge-proto-…","sha":"<full-sha>"}'
sprinkle send page-forge '{"action":"error","message":"…"}'
```

**Versions:** keep each emitted version's HTML as `output/v<N>.html`. `generate · match` makes v1;
`generate · reimagine` emits one version per Stardust variant. `refine` is a **stateless transform**
— it redesigns the `data.fromHtml` handed to it (not a stored file) and emits the new version.
`deploy` ships the exact `data.html` handed to it.

**Slug:** the panel keeps it auto-derived (hidden under "Advanced"). If `data.slug` is
blank, the scoop derives one (URL → last path segment; figma → `figma`; html → `page`)
and **echoes the final slug back in the `done` message**.

**Preview:** the panel's centerpiece is a preview iframe. A `preview` after every
generate/refine is **mandatory** — it's how the designer sees and compares versions before
deploying. `done` (deploy only) swaps it to the live `.aem.page`.

## Preflight / onboarding (scoop) — play vs publish

**Playing (generate + Stardust redesign + preview) requires NO GitHub and NO Adobe** — it's all
local to the panel. Only **Figma** is needed, and only when the input is a Figma frame.
**Publishing to DA** (the `deploy`/"Create prototype" action) is the *only* step that needs
**Adobe + a GitHub token** — the panel prompts for those inline at publish time and continues
automatically once set. So **never block generate/refine on Adobe or GitHub.**

On the `preflight` lick (fired when the panel opens, by "Check access", and re-fired by the panel
right before publishing), **probe each prerequisite and report a checklist** — detect and instruct,
don't point at docs. Emit a `check` for each; the panel decides what gates what.

0. **Dependent skills (auto-install — the "SLICC sets it up for you" step).** The user only
   `upskill`s *this* skill; the scoop bootstraps the rest. Check `/workspace/skills/` for the three
   dependencies and **install any that are missing** by running the `upskill` command yourself
   (don't make the user do it):
   - `snowflake` (deploy) → `upskill adobe/skills --path plugins/aem/edge-delivery-services --all --branch feat/eds-snowflake-da-content`
   - `stardust` (Reimagine) → `upskill adobe/skills --path plugins/stardust --all`
   - `impeccable` (stardust dep) → `upskill pbakaus/impeccable`

   Then symlink stardust + impeccable into the working dir's `.claude/skills/` (so the agent finds
   them at runtime). Emit a single `check` (`key:"skills"`): `ok` once all three resolve; `missing`
   only if an auto-install fails — and then put the **exact failing `upskill` command** in `fix` so
   the user can run it. This makes setup one step (`upskill … skills/page-forge`) + sign-ins; the
   skill installs its own toolchain.

1. **Figma (play — only for Figma input).** Try a lightweight read of the user's Figma URL (or a
   known file). Fail → `fix: "Open figma.com and sign in in this browser, then re-check."`
2. **Adobe (publish — DA access).** Check the connected Adobe provider (`oauth-token adobe`, or
   probe `aem list /` / a `da://` read). Missing → `fix: "Settings → Providers → Sign in with Adobe (also enables DA)."`
3. **GitHub push (publish — per designer, scoped PAT).** Check
   `secret test GITHUB_PAT https://api.github.com/repos/<org>/<site>` where `<org>/<site>` is the
   **target repo from the panel** (`data.da` — e.g. `adobecom/da-playground`, `adobecom/da-cc`).
   Read the target from the sprinkle's `da` config; don't hardcode it.

   If missing or failing, walk the designer through creating a fine-grained PAT **for their target
   repo**:

   ```
   fix: "You need a GitHub token for the repo you're prototyping in (this run: <org>/<site>).
   One-time setup (~2 min):
   1. Open https://github.com/settings/tokens?type=beta
   2. Token name: e.g. slicc-prototyping
   3. Resource owner: <org>  (e.g. adobecom)
   4. Repository access → Only select repositories → select ONLY the repo(s) you want to
      prototype in. <site> is just this run's target — an example; pick whichever repo you'll
      actually deploy to (your own site, da-cc, da-playground, etc.). Don't grant more than that.
   5. Permissions → Repository permissions → Contents: Read and write
   6. Generate token → copy the value
   7. Run here: secret set GITHUB_PAT <your-token> --domain github.com,*.github.com
   Then click 'Check access' again.
   Tip: if you prototype in several sites, add just those repos to the one token.
   Note: if adobecom requires PAT approval, an org owner must approve the token first."
   ```

   The PAT is personal (pushes as the designer), scoped to only the repos they choose, and can't
   touch protected branches. **If the designer switches target repos**, re-check whether the
   existing PAT covers the new repo; if not, they edit the token to add it (no need to recreate).

Emit one `check` per item + `preflight-done`. The panel uses them like this:
**Skills** is informational (auto-installed — only shows if an install failed); **Figma** gates only
Figma-input generate; **Adobe + GitHub** gate only publish. The publish button re-fires `preflight`,
shows the missing items inline, and deploys automatically the moment they pass — so keep the `fix`
strings tight and actionable.

## Pipeline (scoop)

Keep a working dir per session with `input/`, `output/`. Versions live as `output/v<N>.html`.
Three lick handlers — **generate**, **refine**, **deploy** — plus **preflight**.

### `generate` → preview only (NEVER deploy)

`data.mode` picks the engine. Only `source:'url'` and `source:'figma'` reach the scoop (the panel
renders pasted HTML for Match itself). Emit `phase:"generate"`.

**`mode:'match'` (and any Figma input) — 1:1, fast:**
1. Produce the bespoke 1:1 HTML **to a file** (never hold it in your own output):
   - `source:'url'` → run **`scripts/capture-url.jsh <url> output/v1.html`**. It renders the live
     page and writes **clean, self-contained** HTML (scripts/iframes/preload stripped, Milo
     lifecycle hide-body guards + gnav/footer chrome removed, **all URLs absolutized**) — the port of
     forge's `fetch-url.js`. **Do NOT just grab the raw rendered DOM** — that 264KB framework dump
     won't render in the `srcdoc` iframe and can't be snowflaked.
   - `source:'figma'` → follow `references/figma-extract.md` (strict 1:1 rules). Read via SLICC's
     native Figma, or `figma-fetch.jsh` REST + `/images`. **Don't relax the fidelity rules.**
     Then run the **convergence loop** (`scripts/convergence/convergence.jsh <workdir>`) — it
     iterates render→screenshot→pixel-diff→correct up to 4 rounds to converge on the Figma
     reference. See `references/figma-convergence.md`. The loop's `finalVersion` is `output/v<N>.html`.
2. Deliver with **`scripts/emit-preview.jsh <html-file> '{"stage":"bespoke","v":1}'`** — chunked
   **raw** delivery to the panel (the panel reassembles `preview-chunk` by `id`). **Never inline the
   full HTML in a `sprinkle send`, and never base64-encode the chunks** — the panel concatenates raw
   chunk strings. **Then STOP.**

**`mode:'reimagine'` (url only) — two-phase Stardust, several minutes:**

⛔ **YOU are the stardust engine.** stardust + impeccable are **markdown methodologies, not programs** —
you read their `SKILL.md` and do the design yourself. **Do NOT `exec()` their `.mjs` scripts** (the
only one mentioned, impeccable's `load-context.mjs`, just checks whether `PRODUCT.md`/`DESIGN.md`
exist — read those with `fs` instead). **An ESM/`import` error from a `.mjs` is NOT a platform
limit and NOT a reason to stop or punt to the DA tool — read the inputs directly and continue.** The
one script you DO run is the `.jsh` brand injection. **Design to the injected C2 tokens, not your own
idea of "Adobe-ish"** (that produced the off-brand variants the first time).

1. Follow **`references/redesign.md`** exactly: `stardust:extract <url> --single` (content) →
   **run `scripts/inject-c2-brand.jsh <workdir>` (MANDATORY — the C2 brand injection; treat a
   non-zero exit as a hard `error`)** → then `data.intent` present → `stardust:direct "<intent>"` →
   `stardust:prototype` (1 variant); blank → `stardust:uplift` against the existing capture
   (do NOT re-extract / overwrite the injected brand) → 3–4 variants. **Write ONE variant per turn**
   to `stardust/prototypes/<slug>-*-proposed.html` (writing all four in one turn overruns your output
   budget — that truncated the early runs). Tight budget → prefer intent-mode (1 variant).
2. Run **one** command to collect + deliver — **never read prototype HTML into your own output:**
   ```
   scripts/emit-prototypes.jsh <workdir> '{"stage":"redesigned","intent":"<intent or empty>","baseV":1}'
   ```
   It discovers `stardust/prototypes/<slug>-*-proposed.html` (+ cinematic), prepares them (media
   URLs + lenis), and sends each as chunked `preview-chunk` messages the panel reassembles — so **no
   HTML passes through you.** **If it exits non-zero ("stardust did NOT run"), stardust produced no
   files: emit `action:"error"` with that reason — do NOT fabricate variants.** **Then STOP.**

Either way: no git, no snowflake, no `aem`, no deploy. The designer decides next from the panel.

### `refine` → preview only (repeatable, NEVER deploy)

1. Take `data.fromHtml` as the base (it's handed to you — do not look for a stored file);
   emit `phase:"refine"`. Same gate as reimagine: stardust **and** impeccable must be reachable, or
   emit `action:"error"` — never hand-author the redesign.
2. Follow `references/redesign.md` in **intent mode** (one variant): write `fromHtml` to
   `input/current.html`, `stardust:extract file://… --single`, **`scripts/inject-c2-brand.jsh`
   (MANDATORY)**, `stardust:direct "<intent>"` → `stardust:prototype`. Empty intent = default C2
   redesign. (Never inject the C2 brief into a Figma *extract* — redesign only.)
3. Deliver with the same script (no HTML through your output):
   ```
   scripts/emit-prototypes.jsh <workdir> '{"stage":"redesigned","intent":"<the intent>","baseV":<fromV+1>}'
   ```
   Non-zero exit ("stardust did NOT run") → emit `action:"error"`, never fabricate. **Then STOP.**
   No deploy — the designer keeps refining until they pick a version.

### `deploy` → publish (the ONLY action that snowflakes/pushes)

**First re-verify publish creds — for real, before any snowflake work.** Run
**`scripts/check-aem-auth.jsh`** (a live `aem` probe). A token that merely *exists* is not enough:
a stale/revoked one still returns ~1200 chars but DA rejects it with `forbidden: oauth.adobe.token`,
and every `aem` call then hangs. If the script exits non-zero, emit `check` `adobe`=`missing` with
its re-sign-in message and **stop without deploying** (do NOT start the conversion — it will hang).
Also confirm the GitHub PAT (against `data.da`'s repo). Only when both are ok, proceed.

Snowflake **`data.html`** exactly as handed in (do **not** regenerate from the source), following
`references/snowflake-deploy.md`:
- Write `data.html` into a fresh git worktree of `<org>/<site>` on `forge-proto-<short>-<ts>` as
  the bespoke HTML. Emit `phase:"deploy"`.
- Run the snowflake skill (`/workspace/skills/snowflake`) methodology. On a **Milo** repo
  (da-playground) it auto-selects the **Milo flavor** — preserves live gnav/footer, no static
  chrome fragments (avoids the expanded-gnav blob).
- DA content via **`aem put`**; preview via **`aem preview`**.
- `scripts/deploy.jsh` commits + pushes the branch **as the designer** (isomorphic-git over the
  fetch-proxy → the `GITHUB_PAT` secret authenticates the push).
- Verify the `.aem.page` URL; emit `phase:"verify"`, then `action:"done"` with `url`, the final
  `slug`, `branchUrl`, `branchName`, and `sha` (panel swaps the preview to the live URL + report).

**On any failure**, emit `action:"error"` with a one-line reason; clean up the worktree.

## Notes / footguns

- Output is a **`.aem.page`** preview (enough for the demo). For `.aem.live`, run
  `aem publish /<slug>` (same Adobe auth, no token).
- `data-variants` is comma-separated, not space-separated.
- Never inject the C2 brief / design-knowledge into the **Figma** extract (hurts fidelity) —
  redesign step only.
- Keep bespoke HTML self-contained (inline `<style>`, no external stylesheets / Google Fonts).
