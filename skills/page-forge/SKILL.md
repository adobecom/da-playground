---
name: page-forge
description: >-
  Turn a Figma frame, a live page URL, or raw HTML into a pixel-faithful 1:1 prototype
  published to Adobe DA and rendered on a real Helix URL — with an optional Stardust
  (Consonant 2 + brand-knowledge) redesign pass in between. Opens a side-panel sprinkle
  (page-forge.shtml) with three inputs (Figma URL / page URL / HTML), a "redesign" toggle,
  and a Generate button; runs the extract → optional redesign → snowflake-deploy pipeline
  and streams progress + the final preview URL back to the panel.
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

## The pipeline

```
input (figma | url | html)
        │
        ▼
   [generate]  ──►  bespoke 1:1 HTML            (Figma extract  /  URL+HTML passthrough)
        │
        ▼
   [redesign]  ──►  redesigned HTML  (OPTIONAL — Stardust: Consonant 2 + brand knowledge)
        │
        ▼
   [deploy]    ──►  snowflake skill → git push forge-proto-* → aem preview → preview URL
```

The **generate** step is a **pluggable seam** — its Figma-extraction internals are owned by the
parallel fidelity thread (REST-based motion/static-fidelity work). This skill calls whatever
extract logic is current; everything downstream is unaffected.

## Access model — three per-designer sign-ins, no tokens to paste

| Capability | How it's provided | Who does it |
|---|---|---|
| **DA + AEM preview/publish** | the connected **Adobe IMS** session (`oauth-token adobe`) — used by `mount --source da://…` and the **`aem`** command. **No separate DA token.** | the designer: Settings → Providers → Sign in with Adobe (one click) |
| **Figma read** | the designer's **logged-in figma.com browser session** (SLICC drives real Chrome); `FIGMA_TOKEN` secret only as a REST/raster fallback | the designer (just be logged in) |
| **GitHub push** | the designer's own **"Sign in with GitHub"** (SLICC device flow). Git is **isomorphic-git over fetch**, so that OAuth token authenticates the push — **no PAT**. Pushes happen **as the designer**, so their account needs **Write** on `adobecom/da-playground` (granted org-wide via the `milo-contributors` team). `main`/`stage`/`forge-poc` are ruleset-protected → only `forge-proto-*` / personal branches are pushable. | the designer (one click) + org grants team Write once |

All three are click-through sign-ins. The agent only ever sees masked credentials.

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
slicc.lick({ action: 'generate', data: {
  source: 'figma' | 'url' | 'html',
  input:  '<figma url | page url | raw html>',
  redesign: true | false, intent: '<optional>', slug: '<optional>',
  da: { org: 'adobecom', site: 'da-playground' }
}})
```

The scoop pushes back:

```bash
sprinkle send page-forge '{"action":"check","key":"adobe|figma|github","status":"ok|missing","fix":"…"}'
sprinkle send page-forge '{"action":"preflight-done","ready":true}'
sprinkle send page-forge '{"action":"update","phase":"deploy","status":"…"}'
sprinkle send page-forge '{"action":"done","url":"https://forge-proto-…--da-playground--adobecom.aem.page/<slug>"}'
sprinkle send page-forge '{"action":"error","message":"…"}'
```

## Preflight / onboarding (scoop) — runs before generate

Designers won't know what to set up. On the `preflight` lick (fired when the panel opens and by
"Check access"), **probe each prerequisite and report a checklist** — detect and instruct, don't
point at docs.

1. **Adobe (DA access).** Check the connected Adobe provider (`oauth-token adobe`, or probe
   `aem list /` / a `da://` read). Missing → `fix: "Settings → Providers → Sign in with Adobe (also enables DA)."`
2. **Figma.** Try a lightweight read of the user's Figma URL (or a known file). Fail →
   `fix: "Open figma.com and sign in in this browser, then re-check."`
3. **GitHub (per designer).** Run **`oauth-token github`** — exit 0 = signed in, non-zero =
   not. Missing →
   `fix: "Click Sign in with GitHub (device flow). Your account needs Write on da-playground — ask to be added to the milo-contributors team."`

Emit the gate. The deploy pushes a branch **as the signed-in designer**, so `ready` is true
only when **adobe + figma + github** are all ok. The panel keeps Generate disabled until then.

## Pipeline (scoop)

1. **On `generate`,** make a working dir with `input/`, `output/`; emit `phase:"start"`.

2. **Generate the bespoke HTML** → `input/bespoke.html`.
   - `source:'html'`, no redesign → pasted HTML *is* the bespoke HTML (passthrough). Skip to 4.
   - `source:'url'` → fetch the rendered page (SLICC `playwright` / tab control) to
     `input/current.html`. No redesign → that's the bespoke HTML.
   - `source:'figma'` → follow `references/figma-extract.md` (strict 1:1 rules). Read via SLICC's
     native Figma, or `figma-fetch.jsh` REST + `/images`. **Don't relax the fidelity rules.**
   - Emit `phase:"generate"`.

3. **(Optional) Redesign** — only if `redesign:true`. Seed `input/current.html`, follow
   `references/redesign.md` injecting `references/_vendored/{c2-brief,design-knowledge}.md`. Apply
   `intent` as a *modifier* on the C2 baseline. Write `output/redesigned.html` → new
   `input/bespoke.html`. Emit `phase:"redesign"`.

4. **Deploy** — follow `references/snowflake-deploy.md`.
   - Fresh git worktree of `<org>/<site>` on `forge-proto-<short>-<ts>`; seed `input/bespoke.html`.
   - Run the snowflake skill (`/workspace/skills/snowflake`) methodology. On a **Milo** repo
     (da-playground) it auto-selects the **Milo flavor** — preserves live gnav/footer, no static
     chrome fragments (avoids the expanded-gnav blob).
   - DA content via **`aem put`**; preview via **`aem preview`**.
   - `scripts/deploy.jsh` commits + pushes the branch **as the signed-in GitHub user**
     (isomorphic-git over fetch → the OAuth token authenticates the push; no PAT).
   - Verify the `.aem.page` URL; emit `phase:"verify"`, then `action:"done"` with the URL.

5. **On failure**, emit `action:"error"` with a one-line reason; clean up the worktree.

## Notes / footguns

- Output is a **`.aem.page`** preview (enough for the demo). For `.aem.live`, run
  `aem publish /<slug>` (same Adobe auth, no token).
- `data-variants` is comma-separated, not space-separated.
- Never inject the C2 brief / design-knowledge into the **Figma** extract (hurts fidelity) —
  redesign step only.
- Keep bespoke HTML self-contained (inline `<style>`, no external stylesheets / Google Fonts).
