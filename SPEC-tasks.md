# Menu Card Catalogue — SPEC: Tasks

- **Project:** Menu Card Catalogue
- **Companion docs:** `SPEC-requirements.md`, `SPEC-design.md`
- **Last updated:** 2026-10-28 (shipped v1.2.2; signed off by Isaac)

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

## v1 — Upload → Parse → Catalogue → PDF (PWA)
- [x] 1. Resolve libraries: no SheetJS needed (ported MDP's dependency-free reader using the
  browser `DecompressionStream`); **jsPDF 2.5.2 vendored locally** (no CDN).
- [x] 2. App shell: `index.html`, `styles/tokens.css` (shared MDP tokens), `styles/app.css`,
  `js/app.js`; header + theme toggle + Forjé footer; responsive meta.
- [x] 3. Port the reader (`js/xlsx-reader.js`) and parser (`js/parser.js`) to the browser —
  header-text columns, the off-by-one cost columns, Variables/Version tabs, four component sheets,
  warnings.
- [x] 4. Upload flow: drop-zone + file picker → parse → import summary/warnings → persist to
  localStorage (`mcc_`) → open catalogue; restore on launch; **Re-import** (confirmed).
- [x] 5. Catalogue view: Component/Size pill filters + generic search + count + detail panel;
  columns Component/Size/Service/USP/TCS/FTE/Total; **mobile card layout** ≤720px.
  (Per-column filters and the PD column were removed after testing; "Story Points" relabelled "USP".)
- [x] 6. Full-catalogue **PDF** (`js/pdf.js`, jsPDF): paginated table, wrapped Service text;
  adaptive delivery (share on mobile / download on desktop / fallback) per ios-pwa-patterns.
- [x] 7. **PWA**: `manifest.webmanifest` (SVG any + maskable icons, theme), `sw.js` offline
  precache (core atomic + optional best-effort). Forjé footer excluded from print.
- [x] 8. Docs: SPEC trilogy + `userguide.html` + `overview.html` (Forjé footer); SESSION-LOG.
- **Verify:** ✅ all 6 JS modules pass `node --check`; ✅ ported reader+parser checked against a
  **real stored Menu Card .xlsx** — 8/8 checks incl. MQ XL golden values (PD 54 / USP 108 /
  ATOM 54 / TCS 6000.48 / FTE 2400.19 / Total 8400.67). **Still to do: Isaac's browser/install
  sign-off** (see checklist below).

## Isaac's manual check (needs a static server, not file://, for the PWA/service-worker bits)
Serve the folder over HTTP (PWA features don't work from `file://`), e.g.:
`npx serve` or `python -m http.server` from the app folder, then open the shown URL.
1. Upload the real Menu Card `.xlsx` → see the import summary (counts per component).
2. Catalogue shows all four components; spot-check MQ XL Total = £8,400.67.
3. Search (e.g. a component code) and a per-column filter both narrow the list; Clear resets.
4. Component/Size pills multi-select correctly; count updates.
5. Open a row → detail panel shows full description + values.
6. **Save as PDF** → desktop downloads the full catalogue; on a phone it offers the share sheet.
7. Resize to phone width → table becomes stacked cards.
8. Install as a PWA (desktop + phone); reload offline → still works.
9. Toggle light/dark; refresh → catalogue persists.

## Post-ship maintenance (v1.1.1 → v1.2.2)
- [x] **v1.2.0** — PNG manifest icons (192/512/maskable) + screenshots; fixed Chrome manifest
  warnings. SW `mcc-v5`.
- [x] **v1.2.1** — removed the now-unused SVG icons (source of 404 warnings); manifest panel
  clean. SW `mcc-v6`.
- [x] **v1.2.2** — Lighthouse pass → **99 / 100 / 100 / 100** on live GitHub Pages:
  - CLS 0.71 → fixed (`min-height` on `.app-main`).
  - Footer contrast 3.96:1 → ~5.17:1 (removed `.app-footer-copy` opacity).
  - Non-composited animation → fixed (dropped `border-color` from the button transition).
  - Version badge (`v1.2.2`) added next to the title; `APP_VERSION` corrected 1.1.1 → 1.2.2.
  - Fixed a dead favicon `<link>` (deleted SVG → `icon-192.png`). SW `mcc-v8`.

## Later / nice-to-have
- [ ] Optional per-component sub-totals or a summary row.
- [ ] Multiple stored versions / history (currently a single current catalogue).

---

*Powered by Forjé*
*© 2026 Isaac A Gera. All rights reserved.*
