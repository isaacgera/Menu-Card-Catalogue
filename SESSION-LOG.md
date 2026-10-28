# Menu Card Catalogue — Session Log

- **Category:** Work
- **Complexity tier:** Medium
- **Status:** Built (Menu Card Catalogue v1.2.2) — signed off by Isaac
- **Copyright holder:** Isaac A Gera
- **Stack:** vanilla HTML/CSS/JS, no build step, no server; one vendored lib (jsPDF). Installable PWA.

Companion to `SPEC-requirements.md`, `SPEC-design.md`, `SPEC-tasks.md` and the `Ideas.md` row.
Newest entries at the top.

---

## 2026-10-28 (later) — v1.2.2 verified + version badge added

### Lighthouse re-run — confirmed on the live GitHub Pages site
Isaac re-ran Lighthouse against https://isaacgera.github.io/Menu-Card-Catalogue/ after the
v1.2.2 deploy. Result: **Performance 99** (was 77), **Accessibility 100** (was 95),
**Best Practices 100**, **SEO 100**. The CLS and contrast fixes both landed — the improved
scores can only come from the new CSS, so the `mcc-v7` assets are confirmed live.

### Follow-up tweaks (still v1.2.2)
On Isaac's request, added a small **version badge** next to the app title, and fixed a stale
reference spotted while in the header markup:
- `index.html` — added `<span id="app-version" class="app-version">` after `.app-title`;
  **fixed the dead `<link rel="icon" href="./icons/icon.svg">`** (that SVG was deleted at
  v1.2.1) → now points to `./icons/icon-192.png`.
- `js/app.js` — **bumped `APP_VERSION` 1.1.1 → 1.2.2** (it had been left behind through the
  v1.2.x releases) and added `showVersion()` (called first in `boot()`) that writes
  `v{APP_VERSION}` into the badge — single source of truth, same pattern as MathFun.
- `styles/app.css` — `.app-version` pill: tokenised (`--text-light`, `--border`), small,
  rounded, themes correctly in light/dark.
- `sw.js` — `CACHE_NAME` bumped `mcc-v7` → `mcc-v8` so clients pick up the badge + icon fix.

`node --check` passes on `app.js` and `sw.js`. To ship: commit + `git pushall`; then
hard-refresh / reopen the installed PWA so the `mcc-v8` worker activates and the badge appears.

---

## 2026-10-28 — v1.2.2: Lighthouse fixes (CLS, footer contrast, non-composited animation)

Isaac ran a Lighthouse audit on the live GitHub Pages site and asked me to go through the
report. Scores were: **Performance 77**, Accessibility 95, Best Practices 100, SEO 100.
Three actionable issues found and fixed (a fourth — render-blocking CSS — was negligible
at 63 KB total / 0.3 s FCP, so left alone):

### 1. CLS 0.71 → fixed (the main score-killer)
- **Element:** `body > main#view` (the `.app-main` container)
- **Cause:** the bundled Menu Card loads asynchronously; the initial "Loading…" state had no
  reserved height, so when the catalogue table rendered the entire viewport reflowed.
- **Fix:** added `min-height: 60vh` to `.app-main` in `styles/app.css` so the loading state
  reserves space and the content settles in without a large layout shift.

### 2. Accessibility: footer contrast 3.96:1 → fixed (now ~5.17:1)
- **Element:** `body > footer.app-footer > span.app-footer-copy`
- **Cause:** `.app-footer-copy` had `opacity: 0.85`, which blended `--text-light` (`#5a6675`)
  with the `--bg` (`#f6f7f9`) background to an effective `#717c89` — below the 4.5:1 threshold.
- **Fix:** removed the `opacity: 0.85` declaration. Full-opacity `#5a6675` on `#f6f7f9` gives
  ~5.17:1, comfortably passing WCAG AA. Dark theme unaffected (`--text-light: #a9b4c0` on
  `#12171e` is already well above threshold).

### 3. Non-composited animation → fixed
- **Element:** `button#theme-toggle` (`.btn-ghost`)
- **Cause:** the `border-color` transition on `.btn-ghost` hover isn't GPU-composited (border
  properties can't run on the compositor thread), causing potential jank.
- **Fix:** removed `border-color` from the `transition` shorthand on `.btn-primary, .btn-ghost`.
  The border still changes colour on hover (snaps instead of animating) — invisible difference
  for a 1px border. Kept `background` and `transform` transitions (both compositor-friendly).

### 4. Render-blocking CSS — NOT fixed (negligible)
- `tokens.css` (923 B) and `app.css` (2 KB) both block render. FCP is already 0.3 s and the total
  page weight is 63 KB. Inlining or deferring would add complexity for no measurable gain.

### SW cache bump
`CACHE_NAME` bumped `mcc-v6` → `mcc-v7` so deployed clients pick up the updated CSS.

### Verified / shipped
- `node --check sw.js` passes.
- Committed as `1c64aec` and pushed to all three remotes (`origin`, `team`, `github`) —
  confirmed via `git log --all --decorate` showing all remote refs on `1c64aec`.
- **Isaac to do:** hard-refresh the live site (or fully close + reopen the installed PWA on
  iPhone) so the `mcc-v7` service worker activates, then re-run Lighthouse to confirm the CLS
  score has dropped and the contrast / animation warnings are gone.

### Files changed
- `styles/app.css` — three CSS fixes (min-height, opacity removal, transition trim).
- `sw.js` — `CACHE_NAME` bump.

---

## 2026-10-22 — Sign-off: Built (Menu Card Catalogue v1.1.1)

Isaac confirmed both outstanding items on the live sites:
1. ✅ **Auto-load** — the bundled V5 Menu Card (`data/Middleware_Menu_Card.xlsx`) loads
   automatically on open; 38 services across MQ/WLS/CFT/WFY displayed without any upload.
2. ✅ **Re-import fix** — clicking Re-import now shows the upload screen with a working file
   picker (and a "← Back to catalogue" cancel link).

**Backlog row flipped to `Built (Menu Card Catalogue v1.1.1)`** in `Ideas.md`.

The app is fully shipped: deployed to personal GitLab Pages, team GitLab Pages, and GitHub
Pages; all three remotes on commit `fb53a14`; `git pushall` keeps them in sync going forward.

### What shipped (complete feature set at v1.1.1)
- In-browser parse of the real V5 Menu Card workbook (dependency-free — no SheetJS)
- **Component-agnostic** — any tabs beyond MQ/WLS/CFT/WildFly are parsed automatically
- **Auto-load** — bundled `data/Middleware_Menu_Card.xlsx` loads on first open (precedence c:
  user uploads take priority; a newer bundled card auto-refreshes anyone on the old one)
- Searchable/filterable Product Catalogue (Component + Size pills, generic search)
- Per-service detail panel, mobile card layout (≤720px)
- **Save as PDF** — full catalogue, adaptive delivery (download desktop / share mobile)
- Installable PWA, offline-capable, light/dark theme
- Re-import — working file picker with Back link; source badge (Bundled / Uploaded)
- Deployed to 3 remotes; Pages live on all three

### MDP status (parked)
MDP is **In Progress** — Stages 0–5 + Requests UX pass code-complete; awaiting Isaac's browser
sign-off on the Requests area. Restart the server fresh when picking MDP back up.

---

## 2026-10-21 — v1 build (upload → parse → catalogue → PDF, PWA)

### Summary
Built the whole app in one pass, spun out of MDP so the server-backed app stays untouched.
Standalone client-side PWA: import the real Menu Card `.xlsx`, parse it **in the browser**,
show a searchable/filterable Product Catalogue, export the full catalogue to PDF. All verified
against a **real** stored workbook.

### Build-standards flags (agreed with Isaac)
- **Platform:** installable PWA, responsive incl. mobile.
- **Stack:** vanilla, no build/CDN. **No roles/auth** (static tool).
- **Rigour:** Medium — clean modules, localStorage persistence, logic verified against the real file.
- **Copyright:** Isaac A Gera (Forjé footer in app + docs).

### Key decision — zero XLSX dependency
Rather than vendor SheetJS (which couldn't be fetched here anyway: no npm, no CDN), I **ported
MDP's hand-rolled `xlsx.js` reader** to the browser: the ZIP walk + XML parsing are pure JS; the
only swaps were Node `zlib.inflateRawSync` → the browser's native **`DecompressionStream('deflate-raw')`**
(so the read is async) and `Buffer` → `Uint8Array`. The **parser** (`menucard-parser.js`) ported
verbatim, preserving the confirmed **cost-column off-by-one** (header "Vendor Cost" = real TCS
cost, "Overhead" = overhead cost) and the "size lives in the Change Category column" rule. Net
result: a **truly dependency-free, offline** parse that produces the *same* numbers as MDP.

**jsPDF 2.5.2** (ESM) was vendored locally into `vendor/` (copied from the Travel Planner
node_modules — no CDN) for the PDF export.

### What was built (all in `Work/Menu Card Catalogue/`)
- `index.html` + `styles/tokens.css` (shared MDP tokens) + `styles/app.css` (incl. the **mobile
  table→card** rules at ≤720px).
- `js/xlsx-reader.js` — dependency-free `.xlsx` reader (DecompressionStream).
- `js/parser.js` — Menu Card parser (ported from MDP; off-by-one costs preserved).
- `js/store.js` — localStorage (`mcc_` namespace) + theme.
- `js/app.js` — shell: upload (drop/picker) → parse → summary/warnings → persist → catalogue;
  Component/Size pills + generic search + per-column filters + count + detail panel; Re-import;
  PDF button; theme toggle; SW registration.
- `js/pdf.js` — full-catalogue jsPDF export with adaptive delivery (share on mobile / download on
  desktop / fallback), per the ios-pwa-patterns rule.
- `manifest.webmanifest` + `sw.js` (offline precache: core atomic + optional best-effort) +
  `icons/icon.svg`, `icons/icon-maskable.svg`.
- `vendor/jspdf.es.min.js`.
- Docs: real SPEC trilogy, `userguide.html`, `overview.html` (all with the Forjé footer).

### Verified
- All 6 JS modules pass `node --check`.
- **Ported reader + parser run against a REAL stored Menu Card `.xlsx`** (from MDP's uploads):
  8/8 checks, incl. MQ XL golden values — PD 54 / USP 108 / ATOM 54 / TCS £6000.48 / FTE £2400.19 /
  Total £8400.67. Confirms the DecompressionStream unzip + the off-by-one cost logic ported
  correctly. (The available test file was a single-MQ-tab workbook; the four-tab path is the same
  per-sheet code.) Temp harness deleted after running.

### Known gaps / honest caveats
- **Install icons are SVG only** (any + maskable). No image tooling here to author PNG 192/512;
  Chrome/Edge accept SVG manifest icons, but PNGs would broaden install-icon support (esp. older
  iOS). Logged as requirements O1 / a later task. Non-blocking.
- **PWA/offline needs HTTP, not `file://`.** Isaac must serve the folder (e.g. `npx serve` or
  `python -m http.server`) to exercise the service worker / install. (I can't run a live server
  reliably from this shell — the OneDrive-path quirk.)
- Not yet browser/install-tested by Isaac → status stays **In Progress** (per backlog-sync).

### Guardrails honoured
MDP and all other apps left **completely untouched** — this is a separate folder with its own
`mcc_`-namespaced storage and no shared code (the MDP logic was *copied/ported*, not imported).

### Next
- Isaac: run the manual checklist in `SPEC-tasks.md` (serve over HTTP, import the real workbook,
  check MQ XL = £8,400.67, search/filter, PDF, install, offline, mobile). Then sign off → flip
  `Ideas.md` to **Built (Menu Card Catalogue v1.0.0)**.
- Optional later: PNG icons; per-component sub-totals; multiple stored versions.


## 2026-10-21 (later) — post-test fixes (Isaac's first test pass)

Four items from Isaac's testing:
1. **Removed per-column filter row** from the catalogue table (the generic search + pills are
   enough for a single-page tool).
2. **Removed the PD column** from the on-screen table (and from the PDF, for consistency).
3. **Relabelled "Story Points" → "USP"** (table + PDF).
4. **Fixed the "Save as PDF" error.** Root cause: the vendored jsPDF was the **ESM build**
   (`jspdf.es.min.js`), which has bare imports to `@babel/runtime/...` that a no-build browser
   can't resolve → "Failed to resolve module specifier" at export time. Fix: swapped to the
   self-contained **UMD build** (`vendor/jspdf.umd.min.js`, attaches `window.jspdf.jsPDF`) and
   changed `pdf.js` to load it via an injected `<script>` tag instead of `import()`. Removed the
   ESM file; updated the SW precache and **bumped `CACHE_NAME` to `mcc-v2`**.

All changed JS passes `node --check`. Still **In Progress** — re-test the PDF + the trimmed table
(serve over HTTP; hard-refresh / let the new SW activate so the UMD lib is picked up).


## 2026-10-21 (later still) — component-agnostic parsing (Level 1)

Made the app parse **any** Menu Card, not just the four known components (Isaac's "component
agnostic" ask — agreed as **Level 1**: same workbook shape / same cost-header convention, but
variable components, sizes and costs).

- **parser.js** — dropped the hardcoded `WorksheetToComponent` whitelist. Any sheet other than
  `Version`/`Variables` is now a component: known tabs (MQ/Weblogic/CFT/WildFly, case-insensitive)
  resolve to their canonical codes + friendly labels; **unknown tabs use the tab name** as both
  code and label. Added exported helpers `componentCodeFor` / `componentLabel` / `componentPill`.
  A sheet still needs the expected columns to count (else skipped with a warning), so stray tabs
  don't pollute the catalogue. The header-text column mapping and the **cost-column off-by-one**
  are unchanged.
- **app.js** — Component pills, Size pills, and sort order are now **data-driven** from the
  imported items: known components keep their preferred order and known sizes the TO→XXL ladder;
  unknown components append (A–Z) and novel sizes sort after the ladder. Detail panel uses the
  label helper.
- **pdf.js** — uses the shared `componentPill` helper (no local hardcoded map).

**Verified (temp harness, 11 checks, ALL PASS; deleted):** real workbook still gives MQ XL =
£8,400.67 (no regression); a synthetic workbook with an unknown **"Kafka"** tab + a novel **"3XL"**
size parsed correctly with costs intact (TCS 3000 / FTE 1200 / Total 4200) and the right
label/pill fallbacks. All three JS modules pass `node --check`.

Confirmed decisions: same columns/cost-header convention; tab name as the component for unknown
ones; data-driven sizes; required-column bar kept. Still **In Progress** pending Isaac's browser
re-test (import a multi/variant-component card; serve over HTTP; hard-refresh for the SW).


## 2026-10-21 (later) — v1.1.0: bundled Menu Card auto-load + deployed to 3 remotes

### Deployment (done earlier this session)
Pushed to all three remotes, in step on one commit, and GitLab/GitHub Pages confirmed live by
Isaac:
- Personal GitLab Pages: https://pages.gitlab.prod.ec.devops.nat.bt.com/menu-card-catalogue-51bab0
- Team GitLab Pages: https://pages.gitlab.prod.ec.devops.nat.bt.com/menu-card-catalogue-6a9f73/
- GitHub Pages: https://isaacgera.github.io/Menu-Card-Catalogue/index.html

Remotes: `origin` (personal GitLab), `team` (team GitLab, `main` protected — so used a merge of
its init commit rather than a force-push), `github`. `git pushall` keeps all three in sync.

### v1.1.0 — auto-load a bundled Menu Card (precedence c)
So users don't each upload a card, the app now ships one and loads it automatically.
- **Bundled file:** `data/Middleware_Menu_Card.xlsx` (Isaac drops the real workbook in; a
  `data/README.md` placeholder marks the folder + documents the yearly-update steps).
- **Boot logic (precedence c):** a user's own **uploaded** card is always kept; otherwise fetch
  + parse the bundled card and show it; if a previously-**bundled** catalogue's signature differs
  from the bundled file (filename + version label + item count), refresh to the new one;
  graceful fallback to the upload screen if the file is absent / `file://` / offline-uncached.
- **store.js:** saved shape now carries `source: 'bundled'|'upload'` + a `signature`;
  `makeSignature()` added.
- **Header badge:** shows **Bundled** or **Uploaded** so it's clear which card is in view.
- **Re-import:** clears storage and re-runs boot, so the bundled card auto-loads again (or the
  upload screen appears if there's none).
- **sw.js:** `CACHE_NAME` → `mcc-v3`; bundled card precached best-effort and served
  **network-first** so a redeployed card is picked up next online load (cache fallback offline).
- **.gitlab-ci.yml:** copies `data/` into `public/` if present.
- Version constant `APP_VERSION = '1.1.0'` in app.js.

### Verified
All changed JS passes `node --check`. (Parser unchanged this round; its real-workbook pass from
the component-agnostic work still stands.) MDP untouched.

### Note for Isaac
- Drop the real `Middleware_Menu_Card.xlsx` into `data/` before the auto-load does anything on
  the live sites — until then each site shows the upload screen (graceful fallback).
- After dropping it in: `git add data/Middleware_Menu_Card.xlsx`, commit, `git pushall`. On the
  installed PWA, fully close/reopen to pick up the new service worker (`mcc-v3`).


## 2026-10-21 (later) — v1.1.1: fix Re-import

**Bug (introduced by the v1.1 auto-load work):** Re-import popped a confirm dialog but never
offered a file picker. Cause: Re-import cleared storage and re-ran `boot()`, which immediately
re-fetched and loaded the bundled card — so the upload screen never appeared.

**Fix:** Re-import now sets a `forceUpload` flag and renders the upload screen directly (with the
working file picker), independent of the bundled auto-load. The upload screen adapts its wording
when a catalogue already exists ("Import a different Menu Card") and shows a **← Back to
catalogue** link so Re-import is cancellable without losing the current view. The stored
catalogue is kept until a new file is successfully imported; on success `forceUpload` clears and
the app returns to the catalogue. Removed the dead confirm dialog.

Kept Re-import (it's useful for viewing a different card) rather than removing it, now that it
works. `APP_VERSION` → 1.1.1; service worker `CACHE_NAME` → `mcc-v4`. app.js passes `node --check`.

**To ship this fix to the live sites:** `git add` + commit + `git pushall`; then hard-refresh /
reopen the installed PWA so the `mcc-v4` service worker activates.

### Status at end of session
Deployed to all three remotes (personal GitLab, team GitLab, GitHub); Pages live on all three.
v1.1.1 code-complete and verified locally (node --check + real V5 workbook parses: 38 services,
MQ XL £8,400.67). Backlog row stays **In Progress** pending Isaac's live-site confirmation of the
auto-load + the Re-import fix; then → **Built (Menu Card Catalogue v1.1.1)**.

> Session paused here (monthly credits). Next time: pull latest, confirm the three live sites
> auto-load the bundled card and that Re-import now shows the picker, then flip the backlog to Built.

## 2026-10-22 (later) — v1.2.0: fix manifest warnings (PNG icons + screenshots)

Five Chrome DevTools manifest warnings addressed:

1. **Icon SVG 404s** — `icon.svg` and `icon-maskable.svg` were failing to load in Chrome's
   manifest validator (CORS/MIME issue on the GitLab Pages host). Fixed by generating proper
   **PNG icons** using only Node built-ins (no npm/canvas — raw RGBA pixel data → zlib deflate →
   PNG encoder written from scratch). SVGs kept as fallback entries.
2. **"Most operating systems require square icons"** — resolved by the new 192×192 and 512×512
   PNGs, which Chrome recognises as square icons.
3. **Richer install UI (desktop + mobile)** — added a `screenshots` array to the manifest with
   a 1280×720 wide screenshot and a 390×844 narrow screenshot (also generated as placeholder
   PNGs). These enable Chrome's richer install UI preview on both form factors.

**Files added/changed:**
- `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable.png` — generated PNGs.
- `screenshots/screenshot-wide.png` (1280×720), `screenshots/screenshot-narrow.png` (390×844).
- `manifest.webmanifest` — PNG icons as primary entries (SVGs as fallback) + `screenshots` array.
- `index.html` — apple-touch-icon updated to use `icon-192.png`.
- `sw.js` — `CACHE_NAME` → `mcc-v5`; new assets added to OPTIONAL precache.
- `.gitlab-ci.yml` — `screenshots/` included in the Pages deploy copy.
- Generator scripts deleted after running (temporary).

All changed JS passes `node --check`. Committed + pushed to all three remotes (mcc-v5).

## 2026-10-22 (later) — v1.2.1 closed out; SVG icons removed

- Isaac deleted `icons/icon.svg` and `icons/icon-maskable.svg` directly (they were unused after
  the PNG migration and were the source of the earlier 404 warnings).
- Committed and pushed via `git pushall` — all three remotes in step.
- Confirmed on the live site: `caches.keys()` returns `mcc-v6` (latest SW active) and the
  DevTools **Manifest** panel shows **zero errors or warnings**.

**Menu Card Catalogue is fully resolved and clean at v1.2.1.**
