---
name: page-forge
description: >-
  Turn a Figma frame, a live page URL, or raw HTML into a pixel-faithful 1:1 prototype
  published to Adobe DA and rendered on a real Helix URL — with an optional Stardust
  (Consonant 2 + brand-knowledge) redesign loop in between. Opens a side-panel sprinkle
  (page-forge.shtml) with three inputs (Figma URL / page URL / HTML), a live preview iframe,
  and a generate → refine (Stardust, versioned) → deploy flow; each refine adds a version the
  designer can compare, then deploy the chosen one. Streams every version's HTML + the final
  preview URL back to the panel.
  Use when the user wants to: build a page from a Figma design, prototype a redesign of an
  existing page, snowflake an HTML page into an authorable DA page, or "ship this design to
  DA / Milo / da-playground". Triggers on "page forge", "figma to page", "figma to da",
  "snowflake this", "make a prototype", "1:1 prototype", "redesign this page", "deploy to da".
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
  handles `preflight` / `generate` lick events (routed from the sprinkle via the cone) and
  pushes updates back with `sprinkle send page-forge '{…}'`.
- Everything in "Preflight" and "Pipeline" below is the **scoop's** behavior.

## Install

```
# this skill (team distribution)
upskill adobecom/da-playground --path skills/page-forge

# the snowflake deploy skill (PR #154 — ships as a SLICC package)
upskill adobe/skills --path plugins/aem/edge-delivery-services --all --branch feat/eds-snowflake-da-content
```

Both land in `/workspace/skills/<name>/`. Regenerate `references/_vendored/` for the redesign
step (see `references/README.md`) before publishing the skill.

## The pipeline — generate → refine* → deploy (iterative)

Three separate actions, mirroring the da.live Page Forge tool. Each produces a **version**;
the designer flips between versions in the panel and deploys whichever one they pick.

```
input (figma | url | html)
        │
        ▼
   [generate]  ──►  v1  =  bespoke 1:1 HTML      (Figma extract  /  URL+HTML passthrough)
        │
        ▼  (repeatable — each refine = a new version off the viewed one)
   [refine]    ──►  v2, v3 …  Stardust redesign  (Consonant 2 + brand; `intent` is a modifier)
        │
        ▼  (on the version the designer chose)
   [deploy]    ──►  snowflake skill → git push forge-proto-* → aem preview → preview URL
```

Keep every version's HTML in the working dir (`output/v<N>.html`) so refine can base off any
version and deploy can ship the chosen one. Emit an `action:"preview"` (with the version
number) after **every** generate/refine so the panel updates live.

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
- **`scripts/deploy.jsh`** — commit + push the `forge-proto-*` substrate branch.

## Sprinkle ⇄ scoop protocol

The sprinkle fires:

```js
slicc.lick({ action: 'preflight' })
// 1. generate v1 (NO deploy) — produces the 1:1 bespoke HTML
slicc.lick({ action: 'generate', data: {
  source: 'figma' | 'url' | 'html',
  input:  '<figma url | page url | raw html>',
  da: { org: 'adobecom', site: 'da-playground' }
}})
// 2. refine (repeatable) — Stardust pass off the viewed version → a new version
slicc.lick({ action: 'refine', data: {
  intent: '<optional — empty = default Consonant 2 redesign>',
  fromV: <version number being viewed>,
  da: { org: 'adobecom', site: 'da-playground' }
}})
// 3. deploy the chosen version
slicc.lick({ action: 'deploy', data: {
  v: <version number to ship>,
  slug: '<optional — blank means auto-derive>',
  da: { org: 'adobecom', site: 'da-playground' }
}})
```

The scoop pushes back:

```bash
sprinkle send page-forge '{"action":"check","key":"adobe|figma|github","status":"ok|missing","fix":"…"}'
sprinkle send page-forge '{"action":"preflight-done","ready":true}'
sprinkle send page-forge '{"action":"update","phase":"generate|refine|deploy","status":"…"}'
# After EVERY generate/refine: stream the version's HTML so the panel shows it in the
# preview iframe and adds a version chip. stage: "bespoke" (v1) | "redesigned" (refines).
sprinkle send page-forge '{"action":"preview","v":1,"stage":"bespoke","intent":"","html":"<full HTML>"}'
sprinkle send page-forge '{"action":"preview","v":2,"stage":"redesigned","intent":"<the intent>","html":"<full HTML>"}'
# done — only after DEPLOY. The panel swaps the preview to the live URL and shows a report.
sprinkle send page-forge '{"action":"done","url":"https://forge-proto-…--da-playground--adobecom.aem.page/<slug>","slug":"<slug>","branchUrl":"…","branchName":"forge-proto-…","sha":"<full-sha>"}'
sprinkle send page-forge '{"action":"error","message":"…"}'
```

**Versions:** keep each version's HTML as `output/v<N>.html`. `generate` makes v1.
Each `refine` reads `output/v<fromV>.html`, applies the Stardust redesign with `intent` as a
modifier, writes `output/v<N+1>.html`, and emits a `preview` for the new version. `deploy`
ships `output/v<v>.html`.

**Slug:** the panel keeps it auto-derived (hidden under "Advanced"). If `data.slug` is
blank, the scoop derives one (URL → last path segment; figma → `figma`; html → `page`)
and **echoes the final slug back in the `done` message**.

**Preview:** the panel's centerpiece is a preview iframe. A `preview` after every
generate/refine is **mandatory** — it's how the designer sees and compares versions before
deploying. `done` (deploy only) swaps it to the live `.aem.page`.

## Preflight / onboarding (scoop) — runs before generate

Designers won't know what to set up. On the `preflight` lick (fired when the panel opens and by
"Check access"), **probe each prerequisite and report a checklist** — detect and instruct, don't
point at docs.

1. **Adobe (DA access).** Check the connected Adobe provider (`oauth-token adobe`, or probe
   `aem list /` / a `da://` read). Missing → `fix: "Settings → Providers → Sign in with Adobe (also enables DA)."`
2. **Figma.** Try a lightweight read of the user's Figma URL (or a known file). Fail →
   `fix: "Open figma.com and sign in in this browser, then re-check."`
3. **GitHub push (per designer, scoped PAT).** Check
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

Emit the gate. The deploy pushes a branch **as the designer (via their PAT)**, so `ready` is true
only when **adobe + figma + github** are all ok. The panel keeps Generate disabled until then.

## Pipeline (scoop)

Keep a working dir per session with `input/`, `output/`. Versions live as `output/v<N>.html`.
Three lick handlers — **generate**, **refine**, **deploy** — plus **preflight**.

### `generate` → v1 (no deploy)

1. Make/clear the working dir; emit `phase:"generate"`.
2. Produce the bespoke 1:1 HTML → `output/v1.html`:
   - `source:'html'` → pasted HTML *is* v1 (passthrough).
   - `source:'url'` → fetch the rendered page (SLICC `playwright` / tab control) → v1.
   - `source:'figma'` → follow `references/figma-extract.md` (strict 1:1 rules). Read via SLICC's
     native Figma, or `figma-fetch.jsh` REST + `/images`. **Don't relax the fidelity rules.**
3. Emit **`action:"preview"` with `v:1, stage:"bespoke"`** and the full HTML. **Do not deploy.**

### `refine` → v(N+1) (repeatable, no deploy)

1. Read `output/v<fromV>.html` as the base; emit `phase:"refine"`.
2. Follow `references/redesign.md`, injecting `references/_vendored/{c2-brief,design-knowledge}.md`.
   Apply `data.intent` as a *modifier* on the Consonant 2 baseline (empty intent = default C2
   redesign). Write the result to `output/v<N+1>.html` (N = current max version).
3. Emit **`action:"preview"` with `v:<N+1>, stage:"redesigned", intent:<the intent>`** and the
   HTML. **Do not deploy** — the designer keeps refining until they pick a version.

### `deploy` → ship the chosen version

Follow `references/snowflake-deploy.md` against `output/v<data.v>.html`:
- Fresh git worktree of `<org>/<site>` on `forge-proto-<short>-<ts>`; seed the chosen version
  as the bespoke HTML. Emit `phase:"deploy"`.
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
