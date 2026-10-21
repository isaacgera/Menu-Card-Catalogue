# Bundled Menu Card

Place the current Menu Card workbook here as **`Middleware_Menu_Card.xlsx`**.

When present, the app **auto-loads** it on launch, so users don't each have to upload a card.
Users can still Upload / Re-import their own `.xlsx` locally (that overrides the bundled one on
their device until they Re-import again).

## Updating the card (≈ once a year)
1. Drop the new workbook in here, keeping the exact name `Middleware_Menu_Card.xlsx`.
2. Bump `CACHE_NAME` in `../sw.js` (e.g. `mcc-v3` → `mcc-v4`) so clients fetch the new file
   instead of a cached copy.
3. Commit and `git pushall` (origin + team + github).

The app detects the change (filename + version label + item count) and refreshes anyone who was
on the previous bundled card automatically; people with their own uploaded card keep theirs.

> This README is just a placeholder so the folder exists in git. The real `.xlsx` is what the
> app loads.
