# Menu Card Catalogue — SPEC: Design

- **Project:** Menu Card Catalogue
- **Companion docs:** `SPEC-requirements.md`, `SPEC-tasks.md`
- **Last updated:** 2026-10-21

---

## 1. Architecture

A **client-only** single-page app. No server, no build step, no framework — vanilla ES modules
loaded by `index.html`, styled with shared design tokens (the MDP look), persisted in
localStorage, and made installable/offline by a service worker.

```
index.html
  styles/tokens.css   design tokens (light/dark, reduced-motion) — shared with MDP
  styles/app.css      layout, controls, table→card responsive rules, footer
  js/app.js           shell: boot, upload screen, catalogue screen, filters, PDF wiring
  js/xlsx-reader.js   dependency-free .xlsx reader (ZIP walk + DecompressionStream + XML)
  js/parser.js        Menu Card parser (header-text columns, off-by-one costs) — ported from MDP
  js/store.js         localStorage load/save (mcc_ namespace) + theme
  js/pdf.js           full-catalogue PDF (jsPDF) + adaptive delivery
  vendor/jspdf.es.min.js   vendored jsPDF 2.5.2 (no CDN)
  manifest.webmanifest
  sw.js               offline precache (core atomic + optional best-effort)
  icons/icon.svg, icons/icon-maskable.svg
```

## 2. Parsing pipeline (the heart)

`File → ArrayBuffer → parseXlsx() → {sheets:[{name,rows}]} → parseMenuCard() → {version, items, counts, warnings}`

- **xlsx-reader.js** is a faithful browser port of MDP's `server/xlsx.js`. An `.xlsx` is a ZIP of
  XML; the reader walks the ZIP central directory, inflates deflate entries with the browser's
  native **`DecompressionStream('deflate-raw')`** (replacing Node's `zlib.inflateRawSync`), and
  parses `sharedStrings` + each sheet with small regex helpers. `Buffer` is replaced by
  `Uint8Array` + manual little-endian reads. The whole read is **async** (DecompressionStream).
- **parser.js** is a faithful port of MDP's `server/menucard-parser.js`. It finds the header row,
  maps columns **by header text**, and encodes the **confirmed cost-column off-by-one** (header
  "Vendor Cost" is the real TCS/USP cost, "Overhead" the overhead cost). Reads the size from the
  "Change Category" column and the text from "Change Category Description". Pulls blended rate /
  overhead % / people-day rate from `Variables` and the label from `Version`. Emits warnings for
  unknown sheets, missing columns, duplicates, or empty results. **No value is recomputed.**

This port is what guarantees the standalone app produces the *same* numbers as MDP — proven
against a real stored workbook (MQ XL = PD 54 / USP 108 / ATOM 54 / TCS 6000.48 / FTE 2400.19 /
Total 8400.67).

## 3. UI

Two screens, chosen at boot by whether a catalogue is stored:
- **Upload** — a drop-zone (click or drag) + import status (summary / warnings).
- **Catalogue** — header (source + count + Save as PDF + Re-import), a controls card
  (Component pills, Size pills, generic search, count, Clear), the results table, and a detail
  panel. Columns: Component / Size / Service / PD / Story Points / TCS Cost / FTE Cost / Total.

**Filtering** is layered and all client-side: pill selections (multi-select) ∩ generic search
(across all columns) ∩ per-column filters. Sorting: component order (MQ, WLS, WILDFLY, CFT) →
size (TO→XXL) → USP → description.

**Responsive/mobile:** at ≤720px the table's header/filter row is hidden and each row renders as
a **stacked card** with `data-label` field captions, so it reads cleanly on a phone.

## 4. PDF export

`js/pdf.js` lazy-imports the vendored jsPDF, draws the **entire** catalogue (sorted, ignoring
on-screen filters) as a paginated landscape table with wrapped Service text, then delivers
**adaptively** (ios-pwa-patterns): on mobile/installed-PWA it offers the native **share sheet**
via `navigator.share({files})`; on desktop it **downloads**; last-resort `doc.save()`. Lazy
import means a missing/blocked vendor file can't break the rest of the app.

## 5. PWA / offline

- **manifest.webmanifest** — name, standalone display, theme `#0a66c2`, SVG icons (any +
  maskable). (PNG icons are a later nice-to-have; see requirements O1.)
- **sw.js** — `CACHE_NAME = 'mcc-v1'`. Install precaches **CORE** (shell + all JS) atomically and
  **OPTIONAL** (vendored lib + icons) best-effort, so a missing optional asset can't fail install
  and kill offline. Fetch is cache-first with runtime caching of same-origin GETs and an
  app-shell fallback for navigations. **Bump `CACHE_NAME` on every release.**

## 6. Data safety & isolation

localStorage keys are namespaced `mcc_` so the app can never read or overwrite another app's
data. Re-import is explicit + confirmed. No network, no server, no cross-app coupling; MDP is
entirely independent.

---

*Powered by Forjé*
*© 2026 Isaac A Gera. All rights reserved.*
