/**
 * Menu Card parser — turns a parsed workbook ({sheets:[{name,rows}]}) into a catalogue of
 * ServiceVariants, with validation warnings. Faithful browser port of the MDP server parser.
 *
 * Strategy: locate columns by HEADER TEXT (not fixed indices), so the four components' differing
 * layouts are all handled by the same logic, and minor column shuffles don't break import.
 */

// Component-agnostic: ANY worksheet that isn't a known non-component sheet is treated as a
// component, keyed by its (normalised) tab name. The four well-known tabs get canonical codes
// + friendly labels; anything else uses the tab name as both code and label.
const NonComponentSheets = ['Version', 'Variables'];

// Known worksheet names -> canonical component code (kept so the familiar workbook stays tidy).
const KnownWorksheetToComponent = {
  mq: 'MQ',
  weblogic: 'WLS',
  wls: 'WLS',
  cft: 'CFT',
  wildfly: 'WILDFLY',
};

// Friendly labels / short pills for the known components. Unknown components fall back to their
// own code for both (resolved via the helper functions below, which the UI also uses).
const KNOWN_LABEL = {
  MQ: 'IBM MQ',
  WLS: 'Oracle WebLogic',
  CFT: 'Axway CFT',
  WILDFLY: 'WildFly',
};
const KNOWN_PILL = { MQ: 'MQ', WLS: 'WLS', WILDFLY: 'WFY', CFT: 'CFT' };

/** Resolve a worksheet name to a component code: canonical for known tabs, else the tab name. */
export function componentCodeFor(sheetName) {
  const key = norm(sheetName).toLowerCase();
  return KnownWorksheetToComponent[key] || norm(sheetName);
}

/** Full display label for a component code (friendly for known; the code itself otherwise). */
export function componentLabel(code) {
  return KNOWN_LABEL[code] || code;
}

/** Short pill label for a component code (WFY for WildFly; the code itself otherwise). */
export function componentPill(code) {
  return KNOWN_PILL[code] || code;
}

// Back-compat objects (the app imported these as maps). They now only carry the known ones;
// callers should prefer the helper functions above for arbitrary components.
export const ComponentLabel = { ...KNOWN_LABEL };
export const ComponentPill = { ...KNOWN_PILL };

const norm = (v) => (v === undefined || v === null ? '' : String(v)).trim();
const normLower = (v) => norm(v).toLowerCase().replace(/\s+/g, ' ');

/** Clean a description cell: strip stray leading tabs, normalise newlines, trim. */
function cleanText(v) {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\s*t\*/gm, '*') // workbook has some "t*" artefacts before bullets
    .replace(/\t/g, ' ')
    .trim();
}

/** Parse a cost/number cell -> number or null (ignores currency symbols/commas). */
function toNumber(v) {
  if (typeof v === 'number') return v;
  const s = norm(v).replace(/[£$,]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

const HEADER = {
  description: (h) => h.includes('change category description') || h === 'description',
  pd: (h) => h.includes('median effort') || h === 'pd' || h.includes('- pd'),
  partnerCost: (h) => h.includes('current partner cost'),
};

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = rows[i].map(normLower);
    const hasCat = cells.some((c) => c === 'change category');
    const hasPd = cells.some((c) => c.includes('median effort') || c.includes('- pd'));
    if (hasCat && hasPd) return i;
  }
  return -1;
}

/**
 * Build a column-index map from the header row.
 * IMPORTANT — the workbook's cost headers are off-by-one vs their real meaning (confirmed
 * against MQ XL golden values: USP Cost 6000.48, Overhead 2400.19, Total 8400.67, where
 * 6000.48 x 0.40 = 2400.19 and 6000.48 + 2400.19 = 8400.67):
 *   header "USP Cost"    -> actually the per-USP RATE (e.g. 55.56)   -> NOT stored as a cost
 *   header "Vendor Cost" -> actually the real USP/TCS COST (6000.48) -> store as uspCost
 *   header "Overhead"    -> actually the overhead COST (2400.19)      -> store as overheadCost
 *   header "Total Cost"  -> the grand total (8400.67)                 -> store as totalCost
 */
function mapColumns(headerCells) {
  const lower = headerCells.map(normLower);
  const find = (pred) => lower.findIndex((h) => pred(h));
  return {
    changeCategory: find((h) => h === 'change category'),
    description: find(HEADER.description),
    pd: find(HEADER.pd),
    usp: find((h) => h === 'usp'),
    atom: find((h) => h === 'atom'),
    rate: find((h) => h === 'usp cost'), // mislabelled: this is the rate, not a cost
    uspCost: find((h) => h === 'vendor cost'), // the real USP/TCS cost
    overheadCost: find((h) => h === 'overhead'), // the overhead cost
    totalCost: find((h) => h === 'total cost'),
    partnerCost: find(HEADER.partnerCost),
  };
}

function parseComponentSheet(component, rows, warnings) {
  const headerRowIdx = findHeaderRow(rows);
  if (headerRowIdx === -1) {
    warnings.push(`${component}: could not locate a header row; sheet skipped.`);
    return [];
  }
  const header = rows[headerRowIdx];
  const col = mapColumns(header);

  if (col.changeCategory === -1 || col.pd === -1 || col.totalCost === -1) {
    warnings.push(
      `${component}: missing required columns (need Change Category, Median Effort - PD, Total Cost); sheet skipped.`,
    );
    return [];
  }

  const variants = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const sizeRaw = norm(row[col.changeCategory]);
    if (!sizeRaw) continue;
    if (sizeRaw.toLowerCase().includes('overhead %')) continue;

    const pd = toNumber(row[col.pd]);
    const totalCost = toNumber(row[col.totalCost]);
    if (pd === null || totalCost === null) continue;

    variants.push({
      id: `${component}|${sizeRaw}|${r}`,
      component,
      size: sizeRaw,
      changeCategory: sizeRaw,
      description: cleanText(col.description !== -1 ? row[col.description] : ''),
      pd,
      usp: toNumber(row[col.usp]) ?? 0,
      atom: toNumber(row[col.atom]) ?? 0,
      uspCost: toNumber(row[col.uspCost]) ?? 0,
      overheadCost: toNumber(row[col.overheadCost]) ?? 0,
      totalCost,
      currentPartnerCost: col.partnerCost !== -1 ? norm(row[col.partnerCost]) || null : null,
      rowIndex: r,
    });
  }

  if (variants.length === 0) warnings.push(`${component}: no valid variant rows found.`);
  return variants;
}

function parseVariables(rows) {
  let blendedUspRate = null;
  let peopleDayRate = null;
  for (const row of rows) {
    const label = normLower(row[0]);
    if (label === 'people day' && peopleDayRate === null) peopleDayRate = toNumber(row[2]);
    for (let i = 0; i < row.length; i++) {
      if (normLower(row[i]).includes('blended usp')) {
        for (let j = i + 1; j < row.length; j++) {
          const n = toNumber(row[j]);
          if (n !== null) { blendedUspRate = n; break; }
        }
      }
    }
  }
  return { blendedUspRate, peopleDayRate };
}

function parseVersionTab(rows) {
  let label = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = norm(rows[i][0]);
    if (v && v.toLowerCase() !== 'version') { label = v; break; }
  }
  return { label };
}

function findOverheadPct(sheets) {
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (let i = 0; i < row.length; i++) {
        if (normLower(row[i]).includes('overhead %')) {
          const n = toNumber(row[i + 1]);
          if (n !== null) return n;
        }
      }
    }
  }
  return null;
}

/**
 * @param workbook {sheets:[{name,rows}]}
 * @param meta { financialYear, sourceFilename }
 * @returns { version, items, warnings, counts }
 */
export function parseMenuCard(workbook, { financialYear, sourceFilename } = {}) {
  const warnings = [];
  const items = [];
  const counts = {};

  for (const sheet of workbook.sheets) {
    // skip the known non-component sheets by name (case-insensitive)
    if (NonComponentSheets.some((n) => n.toLowerCase() === norm(sheet.name).toLowerCase())) continue;
    // component-agnostic: every other sheet is a component (canonical code for known tabs,
    // otherwise the tab name itself). parseComponentSheet still requires the expected columns,
    // so a stray/unrelated tab is skipped with a warning rather than polluting the catalogue.
    const component = componentCodeFor(sheet.name);
    const sheetVariants = parseComponentSheet(component, sheet.rows, warnings);
    counts[component] = sheetVariants.length;
    items.push(...sheetVariants);
  }

  // flag duplicate variants (same component+size+description)
  const seen = new Map();
  for (const v of items) {
    const key = `${v.component}|${v.size}|${v.description}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, n] of seen) {
    if (n > 1) warnings.push(`Duplicate variant (${n}x): ${key.slice(0, 80)}…`);
  }

  const varsSheet = workbook.sheets.find((s) => s.name === 'Variables');
  const versionSheet = workbook.sheets.find((s) => s.name === 'Version');
  const vars = varsSheet ? parseVariables(varsSheet.rows) : {};
  const ver = versionSheet ? parseVersionTab(versionSheet.rows) : {};
  const overheadPct = findOverheadPct(workbook.sheets);

  const version = {
    label: ver.label ?? 'imported',
    financialYear: financialYear ?? null,
    sourceFilename: sourceFilename ?? 'menu-card.xlsx',
    blendedUspRate: vars.blendedUspRate ?? 55.56,
    overheadPct: overheadPct ?? 40,
    peopleDayRate: vars.peopleDayRate ?? 144,
    importedAt: new Date().toISOString(),
  };

  if (items.length === 0) {
    warnings.push('No variants parsed from any component sheet — check the workbook format.');
  }

  return { version, items, warnings, counts };
}
