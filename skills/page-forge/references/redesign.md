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

## ⛔ The one rule that makes this work: YOU are the stardust engine

stardust and impeccable are **markdown methodologies, not programs.** There is no separate engine to
run — **you (the scoop) ARE the engine.** You read their `SKILL.md` procedures and produce the
prototypes yourself, applying impeccable's craft principles and the **injected C2 brand surface**.

- **Do NOT `exec()` stardust/impeccable `.mjs` scripts.** The only script the methodology mentions is
  impeccable's `scripts/load-context.mjs`, and it merely *reports whether* `PRODUCT.md`/`DESIGN.md`
  exist at the project root. SLICC's runtime can't run ESM `.mjs` — **that is expected and harmless:**
  just check those files yourself with `fs.exists`/`fs.readFile`. `command-metadata.json` is likewise
  **read** (`fs.readFile` + `JSON.parse`), never executed.
- **An `import`/ESM error from a `.mjs` is NOT a platform limitation and NOT a reason to stop.** Do
  **not** claim stardust "can't run here", do **not** suggest a "tray runtime", do **not** punt to the
  DA tool — that is fabricating an excuse instead of doing the work. Read the file's inputs directly
  and continue the methodology.
- **The ONE real script you DO run is `scripts/inject-c2-brand.jsh`** — it's a `.jsh` (works fine) and
  it's mandatory (below).
- **Produce real C2, not your generic idea of "Adobe-ish".** Read the injected brand surface
  (`stardust/current/_brand-extraction.json` + `DESIGN.json`) and design to *those exact tokens*
  (palette, type, spacing, motifs). Improvising from your own notion of Adobe styling — ignoring the
  injected brand — is exactly what produced the off-brand variants the first time. Don't.
- **Write each prototype to a file** at `stardust/prototypes/<slug>-*-proposed.html` (the names the
  prototype/uplift methodology defines), then deliver with `scripts/emit-prototypes.jsh` — never
  stream prototype HTML through your own output (it blows your token budget).

## Prerequisites

stardust + impeccable must be **installed** (reachable as `.claude/skills/stardust` and
`.claude/skills/impeccable` from the working dir — symlink if needed). "Installed" just means the
**markdown** `SKILL.md` files are present for you to read — nothing executes. If a skill is genuinely
absent, emit `action:"error"` telling the user to `upskill adobe/skills --path plugins/stardust --all`
and `upskill pbakaus/impeccable`. Do the design work on **Opus + extended thinking** (flagged by Karl
Pauls).

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

### ⚠️ Output-budget rule for uplift — write ONE variant per turn

A full prototype is ~6–10KB of HTML, and **writing it to a file still spends your output budget**
(the file content is your output). Producing all four variants (A/B/C + cinematic) in a **single
turn** overruns the ceiling — that's what truncated the early runs after two variants. So:

- **Write and save ONE variant at a time.** Finish variant A → `fs.writeFile` it to
  `stardust/prototypes/<slug>-A-proposed.html` → then continue to B in the **next** turn, etc. Do
  not try to emit all four in one reply.
- **Do not stream HTML in chat** between variants; the file IS the deliverable.
- Only after all expected files exist, run `emit-prototypes.jsh` **once** to deliver them all.
- If a session's budget is tight, **prefer `mode: intent` (one variant)** — it always fits one turn
  and exercises the whole pipeline. Blank-intent (4 variants) is the heavy path.

## Collect + deliver the prototypes → ONE script (do not do this by hand)

Stardust writes its prototypes to `stardust/prototypes/`:
- intent flow → `<slug>-proposed.html` (one variant, labelled `Redesign`).
- uplift flow → `<slug>-A-proposed.html` / `-B-` / `-C-` + `<slug>-C-cinematic.html`
  (`Variant A` / `B` / `C` / `Variant C — cinematic`).

**Do NOT read these files into your context and emit preview licks yourself** — that is what blew
the output budget (4 × 6-9KB of HTML through your output) and tempted hand-authoring. Instead run
**one** deterministic script that discovers the files, prepares them, and delivers them as chunked
`preview-chunk` messages straight to the panel — **without any HTML passing through you:**

```
scripts/emit-prototypes.jsh <workdir> '{"stage":"redesigned","intent":"<intent or empty>","baseV":1}'
```

(`baseV` = the first variant's version number: `1` for a fresh Reimagine, `fromV+1` for a refine.)

It (a) **fails loud (non-zero exit) if `stardust/prototypes/` has no `*-proposed.html`** — that means
stardust did NOT run, so emit `action:"error"` and **do not fabricate variants**; (b) rewrites local
`assets/media/` refs → absolute source URLs so images render in the `srcdoc` iframe; (c) inlines
`lenis.min.{js,css}` for the cinematic; (d) sends each variant in chunks (the panel reassembles by
`id`). It prints `{ emitted, variants:[{v,label,chunks,bytes}] }`.

If `emit-prototypes.jsh` exits non-zero with "stardust did NOT run", the engine isn't installed/
reachable or the design phase produced nothing — **emit `action:"error"` with that reason. Never
substitute hand-written HTML.** After a successful emit, **STOP** — Reimagine is preview-only; never
deploy (no `data.da` is present, by design).

*(`scripts/collect-prototype.jsh` remains for one-off single-file prep, but the normal path is
`emit-prototypes.jsh`, which handles discovery, the postcondition guard, prep, and delivery in one
deterministic pass.)*
