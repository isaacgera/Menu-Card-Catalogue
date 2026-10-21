/**
 * Local persistence — all data stays on the device (localStorage), namespaced with `mcc_`
 * so this app can never read or clobber any other app's data.
 */
const KEY = 'mcc_catalogue_v1';

/**
 * Shape stored:
 *   {
 *     version: {...}, items: [...], counts: {...},
 *     source: 'bundled' | 'upload',   // where this catalogue came from
 *     signature: string               // identifies a bundled card version (see makeSignature)
 *   }
 * Returns null if nothing imported yet.
 */
export function loadCatalogue() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCatalogue(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearCatalogue() {
  localStorage.removeItem(KEY);
}

/**
 * A stable fingerprint of a parsed catalogue, used by precedence-(c) to detect when a NEWER
 * bundled Menu Card has been dropped into the repo. Combines the source filename, the version
 * label from the workbook's Version tab, and the item count — enough to tell "same card" from
 * "a different/updated card" without hashing the whole file.
 */
export function makeSignature(version, items) {
  const v = version || {};
  return [v.sourceFilename || '', v.label || '', (items || []).length].join('|');
}

// theme preference (shared convention with the app family)
const THEME_KEY = 'mcc_theme';
export function loadTheme() {
  return localStorage.getItem(THEME_KEY); // 'light' | 'dark' | null (follow OS)
}
export function saveTheme(t) {
  if (t) localStorage.setItem(THEME_KEY, t);
  else localStorage.removeItem(THEME_KEY);
}
