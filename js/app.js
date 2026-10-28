/**
 * Menu Card Catalogue — app shell. Vanilla ES modules, no build step, no server.
 * Flow: upload .xlsx -> parse in-browser -> store in localStorage -> show catalogue.
 */
import { parseXlsx } from './xlsx-reader.js';
import { parseMenuCard, componentLabel, componentPill } from './parser.js';
import { loadCatalogue, saveCatalogue, clearCatalogue, loadTheme, saveTheme, makeSignature } from './store.js';
import { exportCataloguePdf } from './pdf.js';

const APP_VERSION = '1.2.2';
// A Menu Card shipped WITH the app. If present, it auto-loads so users don't each upload one.
// Drop the current workbook here and redeploy; precedence-(c) picks it up (see boot()).
const BUNDLED_CARD_URL = './data/Middleware_Menu_Card.xlsx';
const BUNDLED_CARD_NAME = 'Middleware_Menu_Card.xlsx';

// Preferred ordering for the well-known components + sizes. Anything not listed is still shown —
// unknown components are appended (alphabetically) and unknown sizes sort after the known ladder.
const SIZE_SEQUENCE = ['TO', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COMPONENT_ORDER = ['MQ', 'WLS', 'WILDFLY', 'CFT'];
const SIZE_ORDER = { TO: 0, XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6 };

/** Components present in the current catalogue, in a stable order (known first, then the rest A–Z). */
function componentsPresent() {
  const present = [...new Set(catalogue.items.map((i) => i.component))];
  return present.sort((a, b) => {
    const ia = COMPONENT_ORDER.indexOf(a);
    const ib = COMPONENT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;   // both known: preferred order
    if (ia !== -1) return -1;                      // known before unknown
    if (ib !== -1) return 1;
    return a.localeCompare(b);                      // both unknown: alphabetical
  });
}

/** Sizes present in the current catalogue, known ladder first then any extras alphabetically. */
function sizesPresent() {
  const present = [...new Set(catalogue.items.map((i) => i.size))];
  return present.sort(sizeCompare);
}
function sizeCompare(a, b) {
  const sa = SIZE_ORDER[a]; const sb = SIZE_ORDER[b];
  if (sa !== undefined && sb !== undefined) return sa - sb;
  if (sa !== undefined) return -1;
  if (sb !== undefined) return 1;
  return a.localeCompare(b);
}

// ---- small helpers ----
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function money(n) {
  if (typeof n !== 'number') return esc(n);
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(n) { return typeof n === 'number' ? String(n) : esc(n); }
function firstLine(d) {
  const s = String(d || '');
  const nl = s.indexOf('\n');
  return nl === -1 ? s : s.slice(0, nl);
}
function compLabelShort(code) { return componentPill(code); }
function $(sel) { return document.querySelector(sel); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

// ---- state ----
let catalogue = null;              // { version, items, counts }
let forceUpload = false;           // when true, render() shows the upload screen (Re-import)
const selComponents = new Set();
const selSizes = new Set();
let searchText = '';

// ============================================================
// Boot — precedence (c): bundled card auto-loads; a newer bundled card refreshes a
// previously-bundled catalogue; a user's own upload is kept; graceful fallback to upload.
// ============================================================
async function boot() {
  showVersion();
  initTheme();
  registerServiceWorker();

  const stored = loadCatalogue();

  // If the user has their OWN uploaded card, always respect it (they chose it).
  if (stored && stored.source === 'upload' && stored.items && stored.items.length) {
    catalogue = stored;
    render();
    return;
  }

  // Try the bundled card (fetch only works over HTTP, not file://).
  let bundled = null;
  try {
    bundled = await fetchBundledCatalogue();
  } catch { /* no bundled card / offline-uncached / file:// — handled below */ }

  if (bundled) {
    // Precedence (c): load bundled if nothing stored, OR if the bundled signature differs
    // from a previously-bundled catalogue (i.e. a newer card was dropped in).
    if (!stored || stored.source === 'bundled' && stored.signature !== bundled.signature) {
      catalogue = bundled;
      saveCatalogue(catalogue);
      render();
      return;
    }
  }

  // Otherwise use whatever was stored (unchanged bundled or nothing).
  catalogue = stored;
  render();
}

/** Fetch + parse the bundled Menu Card. Returns a catalogue object, or null if unavailable. */
async function fetchBundledCatalogue() {
  const res = await fetch(BUNDLED_CARD_URL, { cache: 'no-cache' });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (!buf || buf.byteLength === 0) return null;
  const workbook = await parseXlsx(buf);
  const result = parseMenuCard(workbook, { sourceFilename: BUNDLED_CARD_NAME });
  if (!result.items.length) return null;
  return {
    version: result.version,
    items: result.items,
    counts: result.counts,
    source: 'bundled',
    signature: makeSignature(result.version, result.items),
  };
}

/** Show the app version badge next to the title (single source of truth: APP_VERSION). */
function showVersion() {
  const el = $('#app-version');
  if (el) el.textContent = 'v' + APP_VERSION;
}

function initTheme() {
  const t = loadTheme();
  if (t) document.documentElement.setAttribute('data-theme', t);
  const btn = $('#theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      saveTheme(next);
    });
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // path is relative so it works whether served at root or a subfolder
    navigator.serviceWorker.register('./sw.js').catch(() => { /* non-fatal */ });
  }
}

// ============================================================
// Render dispatch
// ============================================================
function render() {
  const main = $('#view');
  if (forceUpload || !catalogue || !catalogue.items || !catalogue.items.length) {
    renderUpload(main);
  } else {
    renderCatalogue(main);
  }
}

// ============================================================
// Upload screen
// ============================================================
function renderUpload(main) {
  const hasExisting = !!(catalogue && catalogue.items && catalogue.items.length);
  const intro = hasExisting
    ? 'Choose a different Menu Card workbook (.xlsx) to view. It replaces the current one on this device only (nothing is uploaded to any server).'
    : 'Choose a Menu Card workbook (.xlsx) to view. It is read entirely on this device — nothing is uploaded to any server.';
  main.innerHTML = `
    <section class="card upload-card">
      <h1>${hasExisting ? 'Import a different Menu Card' : 'Import a Menu Card'}</h1>
      <p class="muted">${intro}</p>
      <div id="drop" class="dropzone" tabindex="0" role="button" aria-label="Choose or drop a Menu Card .xlsx file">
        <input id="file" type="file" accept=".xlsx" hidden />
        <div class="dropzone-inner">
          <strong>Drop the .xlsx here</strong>
          <span class="muted">or click to choose a file</span>
        </div>
      </div>
      <div id="import-status" class="import-status" aria-live="polite"></div>
      ${hasExisting ? '<p style="margin-top:var(--space-4);"><a href="#" id="back-link">← Back to catalogue</a></p>' : ''}
    </section>
  `;

  if (hasExisting) {
    const back = $('#back-link');
    if (back) back.addEventListener('click', (e) => { e.preventDefault(); forceUpload = false; render(); });
  }

  const drop = $('#drop');
  const file = $('#file');
  drop.addEventListener('click', () => file.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  file.addEventListener('change', () => { if (file.files[0]) handleFile(file.files[0]); });
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
}

async function handleFile(f) {
  const statusEl = $('#import-status');
  if (!/\.xlsx$/i.test(f.name)) {
    statusEl.innerHTML = `<p class="form-error">Please choose an .xlsx file.</p>`;
    return;
  }
  statusEl.innerHTML = `<p class="muted">Reading “${esc(f.name)}”…</p>`;
  try {
    const buf = await f.arrayBuffer();
    const workbook = await parseXlsx(buf);
    const result = parseMenuCard(workbook, { sourceFilename: f.name });
    if (!result.items.length) {
      statusEl.innerHTML = `<div class="form-error"><p>No catalogue rows were found. Check this is the Menu Card workbook.</p>
        ${result.warnings.map((w) => `<div class="muted">• ${esc(w)}</div>`).join('')}</div>`;
      return;
    }
    catalogue = {
      version: result.version,
      items: result.items,
      counts: result.counts,
      source: 'upload', // a user-chosen card — kept across refreshes, overrides the bundled one
      signature: makeSignature(result.version, result.items),
    };
    saveCatalogue(catalogue);
    const total = result.items.length;
    const byComp = Object.entries(result.counts).map(([c, n]) => `${compLabelShort(c)}: ${n}`).join(', ');
    statusEl.innerHTML = `<p class="import-ok">Imported ${total} services (${esc(byComp)}).</p>`;
    // reset filters and show the catalogue
    forceUpload = false;
    selComponents.clear(); selSizes.clear(); searchText = '';
    setTimeout(render, 400);
  } catch (err) {
    statusEl.innerHTML = `<p class="form-error">Could not read the file: ${esc(err.message)}</p>`;
  }
}

// ============================================================
// Catalogue screen
// ============================================================
const LIST_COLUMNS = [
  { key: 'component', label: 'Component', get: (v) => compLabelShort(v.component) },
  { key: 'size', label: 'Size', get: (v) => v.size },
  { key: 'description', label: 'Service', get: (v) => firstLine(v.description) },
  { key: 'usp', label: 'USP', get: (v) => num(v.usp), num: true },
  { key: 'uspCost', label: 'TCS Cost', get: (v) => money(v.uspCost), num: true },
  { key: 'overheadCost', label: 'FTE Cost', get: (v) => money(v.overheadCost), num: true },
  { key: 'totalCost', label: 'Total Cost', get: (v) => money(v.totalCost), num: true, strong: true },
];

function sortedItems() {
  const order = componentsPresent();
  const rank = (c) => { const i = order.indexOf(c); return i === -1 ? 999 : i; };
  return [...catalogue.items].sort((a, b) => {
    const ca = rank(a.component); const cb = rank(b.component);
    if (ca !== cb) return ca - cb;
    const s = sizeCompare(a.size, b.size);
    if (s !== 0) return s;
    if ((a.usp ?? 0) !== (b.usp ?? 0)) return (a.usp ?? 0) - (b.usp ?? 0);
    return (a.description || '').localeCompare(b.description || '');
  });
}

function renderCatalogue(main) {
  const v = catalogue.version || {};
  const fy = v.financialYear ? ` · ${esc(v.financialYear)}` : '';
  main.innerHTML = `
    <div class="cat-head">
      <div>
        <h1>Product Catalogue</h1>
        <p class="muted" style="margin-top:4px;">
          Source: <strong>${esc(v.sourceFilename || 'Menu Card')}</strong>${fy} · ${catalogue.items.length} services
          <span class="badge source-badge">${catalogue.source === 'upload' ? 'Uploaded' : 'Bundled'}</span>
        </p>
      </div>
      <div class="cat-head-actions">
        <button type="button" class="btn-primary" id="pdf-btn">Save as PDF</button>
        <button type="button" class="btn-ghost" id="reimport-btn">Re-import</button>
      </div>
    </div>

    <div class="card cat-controls">
      <div class="pill-group">
        <span class="pill-label">Component</span>
        <div class="pills" id="comp-pills"></div>
      </div>
      <div class="pill-group">
        <span class="pill-label">Size</span>
        <div class="pills" id="size-pills"></div>
      </div>
      <div class="cat-search">
        <input id="search" type="search" placeholder="Search all columns…" aria-label="Search services" />
        <span id="count" class="muted"></span>
        <button type="button" class="btn-ghost" id="clear-btn">Clear</button>
      </div>
    </div>

    <div id="results" style="margin-top: var(--space-5);"></div>
    <div id="detail"></div>
  `;

  buildPills(main);

  const searchEl = $('#search');
  searchEl.addEventListener('input', debounce(() => { searchText = searchEl.value.trim().toLowerCase(); renderTable(main); }, 120));
  $('#clear-btn').addEventListener('click', () => {
    selComponents.clear(); selSizes.clear(); searchText = '';
    searchEl.value = '';
    const detail = $('#detail');
    if (detail) detail.innerHTML = ''; // also close any open line-item detail panel
    buildPills(main); renderTable(main);
  });
  $('#reimport-btn').addEventListener('click', () => {
    // Show the upload screen with the file picker so a different .xlsx can be chosen.
    // (We keep the stored catalogue until a new file is successfully imported, so Cancelling
    // via the "Back to catalogue" link leaves the current view intact.)
    forceUpload = true;
    render();
  });
  $('#pdf-btn').addEventListener('click', onExportPdf);

  renderTable(main);
}

function buildPills(main) {
  const comps = $('#comp-pills');
  comps.innerHTML = [pill('All', selComponents.size === 0, '')]
    .concat(componentsPresent().map((c) => pill(compLabelShort(c), selComponents.has(c), c)))
    .join('');
  comps.querySelectorAll('[data-val]').forEach((el) => el.addEventListener('click', () => {
    const val = el.getAttribute('data-val');
    if (val === '') selComponents.clear();
    else { selComponents.has(val) ? selComponents.delete(val) : selComponents.add(val); }
    buildPills(main); renderTable(main);
  }));

  const sizes = $('#size-pills');
  sizes.innerHTML = [pill('All', selSizes.size === 0, '', 'size')]
    .concat(sizesPresent().map((s) => pill(s, selSizes.has(s), s, 'size')))
    .join('');
  sizes.querySelectorAll('[data-val]').forEach((el) => el.addEventListener('click', () => {
    const val = el.getAttribute('data-val');
    if (val === '') selSizes.clear();
    else { selSizes.has(val) ? selSizes.delete(val) : selSizes.add(val); }
    buildPills(main); renderTable(main);
  }));
}

function pill(label, active, val, kind = 'comp') {
  return `<button type="button" class="pill${active ? ' active' : ''}" data-kind="${kind}" data-val="${esc(val)}">${esc(label)}</button>`;
}

function visibleItems() {
  return sortedItems().filter((v) => {
    if (selComponents.size && !selComponents.has(v.component)) return false;
    if (selSizes.size && !selSizes.has(v.size)) return false;
    if (searchText) {
      const hay = LIST_COLUMNS.map((c) => String(c.get(v))).join(' ').toLowerCase();
      if (!hay.includes(searchText)) return false;
    }
    return true;
  });
}

function renderTable(main) {
  const el = $('#results');
  const items = visibleItems();
  const countEl = $('#count');
  if (countEl) countEl.textContent = `${items.length} of ${catalogue.items.length} services`;

  if (!items.length) {
    el.innerHTML = '<p class="muted">No services match the current filters.</p>';
    return;
  }

  el.innerHTML = `
    <table class="data-table cat-table">
      <thead>
        <tr>${LIST_COLUMNS.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${items.map((v) => `
          <tr data-id="${esc(v.id)}" style="cursor:pointer;">
            <td data-label="Component">${esc(compLabelShort(v.component))}</td>
            <td data-label="Size"><span class="badge">${esc(v.size)}</span></td>
            <td data-label="Service">${esc(firstLine(v.description))}</td>
            <td data-label="USP" class="num">${num(v.usp)}</td>
            <td data-label="TCS Cost" class="num">${money(v.uspCost)}</td>
            <td data-label="FTE Cost" class="num">${money(v.overheadCost)}</td>
            <td data-label="Total Cost" class="num"><strong>${money(v.totalCost)}</strong></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  el.querySelectorAll('tr[data-id]').forEach((row) => {
    row.addEventListener('click', () => showDetail(main, row.getAttribute('data-id')));
  });
}

function showDetail(main, id) {
  const v = catalogue.items.find((x) => x.id === id);
  if (!v) return;
  const panel = $('#detail');
  panel.innerHTML = `
    <div class="card cat-detail">
      <h2 style="margin-top:0;">${esc(componentLabel(v.component))} — <span class="badge">${esc(v.size)}</span></h2>
      <p style="white-space:pre-line;">${esc(v.description)}</p>
      <table class="kv">
        <tr><th>Story Points (USP)</th><td>${num(v.usp)}</td></tr>
        <tr><th>ATOM</th><td>${num(v.atom)}</td></tr>
        <tr><th>PD (Person Days)</th><td>${num(v.pd)}</td></tr>
        <tr><th>TCS Cost</th><td>${money(v.uspCost)}</td></tr>
        <tr><th>FTE Cost</th><td>${money(v.overheadCost)}</td></tr>
        <tr><th>Total Cost</th><td><strong>${money(v.totalCost)}</strong></td></tr>
        ${v.currentPartnerCost ? `<tr><th>Current Partner Cost (ref)</th><td>${esc(v.currentPartnerCost)}</td></tr>` : ''}
      </table>
      <button class="btn-ghost" id="detail-close" type="button">Close</button>
    </div>`;
  $('#detail-close').addEventListener('click', () => { panel.innerHTML = ''; });
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function onExportPdf() {
  const btn = $('#pdf-btn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    // Full catalogue, sorted, regardless of on-screen filters.
    await exportCataloguePdf({ version: catalogue.version, items: sortedItems() });
  } catch (err) {
    alert('Could not create the PDF: ' + (err && err.message ? err.message : 'unknown error'));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

boot();
