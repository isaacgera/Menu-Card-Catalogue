# Menu Card Catalogue

A standalone, installable **PWA** that imports the middleware **Menu Card** Excel workbook,
parses it **entirely in the browser** (no server), and shows a searchable / filterable
**Product Catalogue** — with an optional full-catalogue **PDF** export. Spun out of the
Middleware Delivery Portal (MDP) so the "just view the catalogue" need stays simple.

## Features
- Import a Menu Card `.xlsx` (drag-drop or picker) — parsed on the device, nothing uploaded
- **Component-agnostic**: any component tabs (not just MQ/WLS/CFT/WildFly) are read; sizes and
  filters are driven by whatever the workbook contains
- Searchable, filterable catalogue (Component / Size pills + generic search)
- Per-service detail panel; full-catalogue PDF export (download on desktop / share on mobile)
- Installable PWA, works offline, responsive incl. mobile, light/dark theme
- No server, no sign-in, no roles — all data stays in `localStorage` on the device

## Tech
Vanilla HTML/CSS/JS, no build step. XLSX parsing is dependency-free (hand-rolled reader using
the browser's `DecompressionStream`). One vendored library: **jsPDF** (local, no CDN).

## Run locally
PWA features (service worker, install) need HTTP, not `file://`. From this folder:
```
python -m http.server
```
then open the URL it prints. (Plain file open works for everything except install/offline.)

## Deployment

The static files are served as-is. `index.html` is at the repo root, so both GitHub Pages and
GitLab Pages serve it directly (no redirect shim needed).

### GitHub Pages (external, installable)
1. Push to the GitHub repo.
2. Settings → Pages → Source: *Deploy from branch* → Branch: `main`, folder: `/ (root)`.
3. Live at `https://USERNAME.github.io/REPO-NAME/` (HTTPS → installable).

### GitLab Pages (internal / team)
Deployed via `.gitlab-ci.yml` — a `pages` job that copies the static tree (preserving the
`js/ styles/ icons/ vendor/` subfolders) into `public/`. Runs on every push to the default
branch (`main`).

### Repositories & remotes (three)

| Remote    | Purpose                                   |
|-----------|-------------------------------------------|
| `origin`  | Personal GitLab                           |
| `team`    | Team GitLab (runs GitLab Pages)           |
| `github`  | External GitHub (runs GitHub Pages)       |

Default branch is `main` on all three.

### Push workflow
A `pushall` alias pushes to all three remotes:
```
git config --global alias.pushall "!git push origin main && git push team main && git push github main"
git add <files>
git commit -m "Describe your change"
git pushall
```

### Notes (learned on Idea Board)
- GitLab runner assignments do **not** transfer on project import — after importing, assign a
  runner (Settings → CI/CD → Runners) or the `pages` job stays pending.
- GitLab project paths are case-sensitive; copy the exact clone URL from the **Code** button.
- Never embed access tokens in remote URLs — let the OS credential manager hold them.
- Bump the service worker `CACHE_NAME` (in `sw.js`) on each release so clients pick up updates.

## Docs
`userguide.html`, `overview.html`, and the SPEC trilogy (`SPEC-requirements.md`,
`SPEC-design.md`, `SPEC-tasks.md`) + `SESSION-LOG.md`.

---
Powered by Forjé · © 2026 Isaac A Gera. All rights reserved.
