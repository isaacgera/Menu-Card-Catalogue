# Menu Card Catalogue — SPEC: Requirements

- **Project:** Menu Card Catalogue
- **Tier / Category:** Medium / Work
- **Status:** Built (v1.1.1) — deployed to 3 remotes, Pages live on all three, signed off by Isaac
- **Version:** 1.1.1
- **Owner / Copyright:** Isaac A Gera
- **Last updated:** 2026-10-21

---

## 1. Purpose

A small, standalone, **installable PWA** that imports the middleware **Menu Card** Excel
workbook, parses it **entirely in the browser** (no server), and displays a searchable /
filterable **Product Catalogue**, with an optional **full-catalogue PDF** export.

It was spun out of the server-backed **Middleware Delivery Portal (MDP)** so that the simple
"view the catalogue" need doesn't require running MDP's Node server + SQLite. This app is
deliberately client-side only and leaves MDP completely untouched.

## 2. Users & roles

**None.** This is a static, single-user tool — no login, no roles, no auth. (If it ever needs
access control, that would arrive via Entra ID at the same time MDP gets it; not in scope here.)

## 3. Scope

### In scope (v1)
1. **Import** a Menu Card `.xlsx` (drag-drop or file picker).
2. **Parse** the real V5-format workbook in the browser — the four component tabs
   (MQ / Weblogic / CFT / WildFly) plus the Variables / Version tabs — reusing MDP's proven
   parsing logic (incl. the off-by-one cost-column handling).
3. **Persist** the parsed catalogue on the device (localStorage, `mcc_` namespace), so it
   survives refreshes and works offline.
4. **Display** the Product Catalogue: component & size pill filters, a generic cross-column
   search, per-column filters, a result count, and a per-service detail panel.
5. **Export** the **full** catalogue as a PDF (all services, regardless of on-screen filters).
6. **Installable PWA**: manifest + service worker, offline-capable, responsive incl. mobile.

### Out of scope (v1)
Estimates / requests, cost calculation beyond what the workbook already carries, editing the
catalogue, multiple stored versions / history, a server or any network calls, roles/auth,
DOCX export.

## 4. Functional requirements

- **R0 Bundled auto-load (v1.1).** If a Menu Card is shipped with the app at
  `data/Middleware_Menu_Card.xlsx`, it is fetched + parsed + displayed automatically on launch,
  so users don't each upload one. Precedence: a user's own **uploaded** card is kept; a **newer
  bundled** card (detected by filename + version label + item count) refreshes anyone still on
  the previous bundled card; falls back to the upload screen if the file is absent / `file://` /
  offline-uncached. A header badge shows **Bundled** vs **Uploaded**.
- **R1 Import.** Accept a single `.xlsx`. Reject other file types with a clear message. Read it
  locally; never transmit it anywhere. A manual upload overrides the bundled card on that device.
- **R2 Parse (faithful to MDP, component-agnostic).** Locate columns by **header text** (not
  fixed indices). **Every worksheet except `Version`/`Variables` is treated as a component**,
  keyed by its tab name — so a Menu Card with more or fewer components parses with no code change.
  The four well-known tabs (MQ / Weblogic / CFT / WildFly) still get canonical codes + friendly
  labels; any other tab uses its name as both code and label. A tab must still carry the expected
  columns (Change Category, Median Effort – PD, Total Cost) to count as a component; otherwise it
  is skipped with a warning. Preserve the confirmed **cost-column off-by-one**:
  header "USP Cost" = rate (ignored), "Vendor Cost" = real TCS/USP cost, "Overhead" = overhead
  cost, "Total Cost" = grand total. Size value is read from the "Change Category" column; the
  human text from "Change Category Description". Store the six values **as imported** — no
  recomputation.
- **R3 Validation feedback.** Show an import summary (counts per component) and any warnings
  (unknown sheet, missing columns, duplicate variants, no rows).
- **R4 Persist & restore.** Save the parsed catalogue to localStorage; on launch, if a catalogue
  exists, open straight to it; otherwise show the import screen. A **Re-import** action replaces
  the stored catalogue (with confirmation).
- **R5 Catalogue display.** Columns: Component, Size, Service, PD, Story Points (USP), TCS Cost,
  FTE Cost, Total Cost. Sorted by component then size (TO→XXL) then USP. A row opens a detail
  panel (full description + all values + reference Current Partner Cost where present).
- **R6 Search & filter.** Component & Size **pill filters** (multi-select, data-driven from the
  import), a **generic search** matching across all columns, and a **per-column filter row**.
  All client-side for instant response; a result count and Clear control.
- **R7 PDF export.** Generate a **full-catalogue** PDF in-app (jsPDF, vendored locally). Deliver
  adaptively: **share sheet** on mobile / installed PWA, **download** on desktop, with a
  last-resort fallback (per the iOS-PWA pattern — `window.print()` is unreliable in a standalone
  iOS PWA).
- **R8 PWA.** Web app manifest (name, theme, icons incl. maskable), a service worker that
  precaches the shell + vendored lib (core atomic, optional best-effort), works offline, and is
  installable on desktop and mobile.

## 5. Non-functional requirements

- **NFR1 No server, local-first.** Everything runs in the browser; data stays on the device.
  No network calls, no telemetry.
- **NFR2 No build step, no CDN.** Plain ES modules opened directly / served statically. The one
  third-party lib (jsPDF) is **vendored locally**; XLSX parsing needs **no library** (hand-rolled
  reader using the browser's `DecompressionStream`).
- **NFR3 Offline.** After first load, the app works with no connection (service-worker cache).
- **NFR4 Responsive & accessible.** Works desktop-to-mobile; the catalogue table collapses to
  stacked cards on narrow screens. Keyboard-operable, visible focus, light/dark theme honouring
  OS preference + a manual toggle, reduced-motion respected.
- **NFR5 Browsers.** Modern evergreen (Edge, Chrome, Safari) — `DecompressionStream`, ES modules,
  service workers all required.
- **NFR6 Data safety.** Validate the import; never silently produce a wrong catalogue — surface
  warnings. Re-import is explicit and confirmed.

## 6. Data model (client-side)

Stored under `mcc_catalogue_v1` in localStorage:
```
{
  version: { label, financialYear, sourceFilename, blendedUspRate, overheadPct,
             peopleDayRate, importedAt },
  items:   [ { id, component, size, changeCategory, description,
               pd, usp, atom, uspCost, overheadCost, totalCost, currentPartnerCost, rowIndex } ],
  counts:  { [component]: n }
}
```
Theme preference under `mcc_theme`.

## 7. Assumptions & open items

- **A1** The Menu Card format changes ~once a year; the header-text-based parser tolerates minor
  column shuffles.
- **A2** Components are **data-driven from the workbook**: the known tabs `MQ`/`Weblogic`/`CFT`/
  `WildFly` map to MQ/WLS/CFT/WILDFLY; any other tab is a component named after its own tab.
  Sizes and component pills/sort order are likewise derived from whatever the import contains
  (known sizes keep the TO→XXL order; novel sizes sort after, alphabetically). The one fixed
  assumption that remains is the **cost-column header convention** (Vendor Cost = TCS cost,
  Overhead = overhead cost) — new Menu Cards are expected to keep it (confirmed with Isaac).
- **O1 (open)** PWA **install icons are SVG** (any + maskable). This environment had no image
  tooling to author PNG 192/512 icons; Chrome/Edge accept SVG manifest icons, but adding PNGs
  later would broaden install-icon support (notably older iOS). Non-blocking.
- **O2** Licence: Internal / open for now, consistent with MDP; revisit before any wider use.

---

*Powered by Forjé*
*© 2026 Isaac A Gera. All rights reserved.*
