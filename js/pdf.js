/**
 * Full-catalogue PDF export (jsPDF, vendored locally — no CDN).
 *
 * Follows the ios-pwa-patterns rule: GENERATE the artifact in-app (don't rely on window.print,
 * which is a silent no-op in an installed iOS PWA), then DELIVER adaptively —
 *   - touch / mobile (incl. installed iPhone PWA): hand the file to navigator.share({files})
 *   - desktop: download the file
 * with a last-resort fallback so the button never dead-ends. Library is loaded lazily so a
 * missing/blocked vendor file can't break the rest of the app.
 */

import { componentPill } from './parser.js';

function firstLine(s) {
  const str = String(s || '');
  const nl = str.indexOf('\n');
  return nl === -1 ? str : str.slice(0, nl);
}
function money(n) {
  if (typeof n !== 'number') return String(n ?? '');
  return 'GBP ' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Detect a touch/mobile context (coarse pointer), with a UA fallback. */
function isMobile() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
  } catch { /* ignore */ }
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

let _jsPDFPromise = null;
/**
 * Load the self-contained UMD build of jsPDF by injecting a <script> tag (it attaches to the
 * global scope — it is NOT an ES module, so it can't be import()ed). The ESM build was dropped
 * because it has bare imports to "@babel/runtime/..." that a no-build browser can't resolve.
 */
function loadJsPDF() {
  if (_jsPDFPromise) return _jsPDFPromise;
  _jsPDFPromise = new Promise((resolve, reject) => {
    const existing = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (existing) { resolve(existing); return; }
    const s = document.createElement('script');
    // resolve the vendor path relative to this module, independent of the page URL
    s.src = new URL('../vendor/jspdf.umd.min.js', import.meta.url).href;
    s.onload = () => {
      const jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (jsPDF) resolve(jsPDF);
      else reject(new Error('jsPDF loaded but was not found on the global scope.'));
    };
    s.onerror = () => reject(new Error('Could not load the PDF library (vendor/jspdf.umd.min.js).'));
    document.head.appendChild(s);
  });
  return _jsPDFPromise;
}

/**
 * Build and deliver a PDF of the WHOLE catalogue (all items, ignoring on-screen filters).
 * @param catalogue { version, items }
 */
export async function exportCataloguePdf(catalogue) {
  const jsPDF = await loadJsPDF();
  if (!jsPDF) throw new Error('PDF library could not be loaded.');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  let y = margin;

  const v = catalogue.version || {};
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Middleware Menu Card — Product Catalogue', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const metaBits = [
    v.sourceFilename ? `Source: ${v.sourceFilename}` : null,
    v.financialYear ? `FY: ${v.financialYear}` : null,
    v.label ? `Version: ${v.label}` : null,
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    `${(catalogue.items || []).length} services`,
  ].filter(Boolean);
  doc.text(metaBits.join('   |   '), margin, y);
  y += 16;

  // columns
  const cols = [
    { label: 'Component', w: 70, get: (it) => componentPill(it.component) },
    { label: 'Size', w: 45, get: (it) => it.size },
    { label: 'Service', w: 300, get: (it) => firstLine(it.description) },
    { label: 'USP', w: 55, get: (it) => String(it.usp ?? ''), align: 'right' },
    { label: 'TCS Cost', w: 85, get: (it) => money(it.uspCost), align: 'right' },
    { label: 'FTE Cost', w: 85, get: (it) => money(it.overheadCost), align: 'right' },
    { label: 'Total Cost', w: 90, get: (it) => money(it.totalCost), align: 'right' },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const rowH = 16;

  const drawHeader = () => {
    doc.setFillColor(10, 102, 194);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.rect(margin, y, tableW, rowH, 'F');
    let x = margin;
    for (const c of cols) {
      const tx = c.align === 'right' ? x + c.w - 4 : x + 4;
      doc.text(String(c.label), tx, y + 11, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    }
    y += rowH;
    doc.setTextColor(26, 36, 48);
    doc.setFont('helvetica', 'normal');
  };

  drawHeader();

  const items = catalogue.items || [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    // wrap the Service column; row height grows with the number of lines
    const serviceCol = cols[2];
    const serviceLines = doc.splitTextToSize(serviceCol.get(it), serviceCol.w - 8);
    const thisRowH = Math.max(rowH, serviceLines.length * 11 + 6);

    if (y + thisRowH > pageH - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }

    if (i % 2 === 1) {
      doc.setFillColor(240, 242, 245);
      doc.rect(margin, y, tableW, thisRowH, 'F');
    }

    let x = margin;
    for (const c of cols) {
      const tx = c.align === 'right' ? x + c.w - 4 : x + 4;
      if (c === serviceCol) {
        doc.text(serviceLines, tx, y + 11);
      } else {
        doc.text(String(c.get(it)), tx, y + 11, { align: c.align === 'right' ? 'right' : 'left' });
      }
      x += c.w;
    }
    y += thisRowH;
  }

  // footer credit on the last page
  doc.setFontSize(8);
  doc.setTextColor(138, 148, 163);
  doc.text('Powered by Forjé', margin, pageH - 16);

  const filename = `menu-card-catalogue${v.financialYear ? '-' + v.financialYear : ''}.pdf`;
  const blob = doc.output('blob');

  // Adaptive delivery
  if (isMobile() && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Product Catalogue' });
        return { delivered: 'share' };
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return { delivered: 'cancelled' };
      // fall through to download
    }
  }

  // Desktop / fallback: download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { delivered: 'download' };
  } catch {
    // last-resort: jsPDF's own save
    doc.save(filename);
    return { delivered: 'save' };
  }
}
