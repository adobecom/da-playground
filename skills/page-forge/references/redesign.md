# Stardust redesign (Reimagine) — two-phase, C2 brand injection

This is the **Reimagine** engine: the published **stardust** redesign skill (built on
**impeccable**), run from the scoop, producing a beautiful Adobe **Consonant 2 (C2)**
prototype. It is the SLICC port of `page-forge/server/stardust/redesignStardust.js` (the DA
tool). **Stardust itself is never modified** — the scoop only *composes* its published
sub-skills (`extract` / `direct` / `prototype` / `uplift`).

## The brand split (the whole point — do not skip)

The canonical Adobe C2 brand lives on **auth-walled** pages the agent can't reach, so it was
pre-extracted offline and **vendored** into `references/_vendored/acom-c2-brand-extraction/`
(`_brand-extraction.json` + `DESIGN.json`). The page the user redesigns is **public** and may
still be an older **C1** design. So the two halves come from two places, deliberately:

- **CONTENT** (words, sections, images) → from the public page, read live.
- **LOOK** (palette, type, motifs) → from the pre-trained **C2** brand surface.

That split isn't stardust's default (it assumes one site gives both look + content), so the
scoop runs it in **two phases with a deterministic injection in between.**

## Prerequisites (once per workspace)

Stardust + its hard dependency impeccable must be installed so the agent finds them:

```
upskill adobe/skills --path plugins/stardust --all
upskill pbakaus/impeccable
```

They must be reachable as `.claude/skills/stardust` and `.claude/skills/impeccable` from the
**working directory** (symlink the installed skills into `<workdir>/.claude/skills/` if needed,
mirroring the snowflake-deploy skill-loading pattern). Stardust runs best on **Opus + extended
thinking** (flagged by Karl Pauls) — use that model for both phases.

## Inputs in the working directory

- `input/current.html` — the source HTML (the page's content). Written by the scoop from the
  `refine` lick's `fromHtml`, or from a fetched URL. Used as the `file://` target when no live
  URL is available.
- `mode` — `intent` (one targeted variant) or `uplift` (three auto variants). Derived by the
  panel: a non-empty intent → `intent`; blank intent → `uplift`.
- `intent` — the redesign direction (only for `mode:intent`).
- `sourceUrl` — the live public URL when the source was `url` (preferred extract target).

## Phase 1 — extract the target page for CONTENT only

Prompt the stardust skill (read `.claude/skills/stardust/SKILL.md` Setup first — verify
impeccable, run its context loader), then run a **single-page** extract of the target:

```
stardust:extract <target> --single
```

`<target>` = the live `sourceUrl` when present (better extraction, live assets); else
`file://<workdir>/input/current.html`. Only this page's **content and structure** matters
(headings, sections, copy, CTAs, images) — the brand surface this writes **will be replaced**,
so don't worry about how on-brand the captured colors/fonts are. Run every phase without
stopping; do **not** ask clarifying questions; do **not** run any "open in browser" step
(headless). Wait until `stardust/current/` and `stardust/state.json` exist.

## ⛔ Injection (MANDATORY — run the script, do not improvise)

The moment extract is done, **run the injection script** to overwrite the captured (possibly C1)
brand surface with the canonical C2 one:

```
scripts/inject-c2-brand.jsh <workdir>
```

It copies the vendored C2 `_brand-extraction.json` (+ `DESIGN.json`) over
`<workdir>/stardust/current/` and **fails loud** (non-zero exit) if the capture is missing or the
copy didn't land. **Do NOT hand-edit the brand files, do NOT skip this, do NOT let a later phase
re-extract or overwrite them.** This is the step that makes a C1 page come out as C2; in DA it
runs outside the agent and cannot be skipped — here it is your responsibility, so treat a
non-zero exit as a hard stop (emit `action:"error"`).

## Phase 2 — design against the existing capture + the injected C2 brand

A stardust capture now exists under `stardust/current/` and its
`_brand-extraction.json` + `DESIGN.json` are the **canonical Adobe C2** brand — the authoritative
*target*. Tell the design phase, explicitly:

- Do **NOT** re-run extract. Do **NOT** re-read the live page.
- Do **NOT** modify or overwrite `stardust/current/_brand-extraction.json` or `DESIGN.json`.
- Treat the captured brand as C2 and stay **brand-faithful (Mode A)** to it. The page being
  redesigned may itself be an older (C1) design — that's expected; the job is to bring its
  content into the C2 look.

### `mode: intent` → one targeted variant

```
1. stardust:direct "<intent>"     # author the direction from the intent, against the C2 brand
                                   # already in stardust/current/_brand-extraction.json.
                                   # Brand-faithful (Mode A) to C2 unless the intent clearly
                                   # calls for a rebrand.
2. stardust:prototype <slug>       # render the proposed prototype.
```

### `mode: uplift` → three brand-faithful variants

```
stardust:uplift <target> --page <slug>
```

**Render against the EXISTING capture** — uplift's documented mode for when a capture already
exists. **Skip uplift's Phase 1 (extract) entirely: do NOT re-read the live URL, do NOT overwrite
`stardust/current/_brand-extraction.json`.** Begin at uplift Phase 2 (tension/trait
identification) using the C2 brand already in `stardust/current/`. Produce variants A / B / C
(plus the cinematic C). Mode A is pinned to the injected C2 palette + type. *(This guard is
load-bearing — without it uplift re-crawls the public page and clobbers C2 with the source's C1
look.)*

`<slug>` is the page slug extract wrote (read it from `stardust/state.json` `pages[].slug`, or the
basename of the `*.json` under `stardust/current/pages/`).

## Collect the prototypes → emit a preview per variant

The prototypes land under `stardust/prototypes/`:
- intent flow → `<slug>-proposed.html` → one version, label `Redesign`.
- uplift flow → `<slug>-A-proposed.html`, `<slug>-B-proposed.html`, `<slug>-C-proposed.html`,
  `<slug>-C-cinematic.html` → variants labelled `Variant A` / `Variant B` / `Variant C` /
  `Variant C — cinematic`.

For the cinematic file, inline its sibling `lenis.min.js` / `lenis.min.css` into the HTML
(replace the `<script src=…lenis.min.js>` / `<link …lenis.min.css>` with inline `<script>` /
`<style>`) so the panel's `srcdoc` iframe renders it self-contained.

Read each prototype's HTML and emit one `preview` lick per variant (stage `redesigned`, with the
`variant`/`label`). After all variants are emitted, **STOP** — Reimagine is preview-only; never
deploy (no `data.da` is present, by design).
