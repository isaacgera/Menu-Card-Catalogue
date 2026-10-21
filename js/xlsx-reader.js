/**
 * Dependency-free .xlsx reader — BROWSER edition.
 *
 * An .xlsx is a ZIP of XML files. We walk the ZIP central directory ourselves and parse
 * sharedStrings + each sheet with small regex helpers. No third-party library (no SheetJS).
 *
 * Ported from the MDP server reader. The only platform differences from the Node version:
 *   - node:zlib inflateRawSync  ->  the browser's native DecompressionStream('deflate-raw')
 *     (so the whole read is async)
 *   - Node Buffer               ->  Uint8Array + DataView
 * Target: modern evergreen browsers (Edge/Chrome/Safari), which all support DecompressionStream.
 *
 * Returns: { sheets: [{ name, rows: [ [cellA, cellB, ...], ... ] }] }
 * Cell values are strings/numbers; empty cells are '' and rows are dense up to the last cell.
 */

const td = new TextDecoder('utf-8');

// ---- little-endian readers over a Uint8Array ----
function u16(buf, off) { return buf[off] | (buf[off + 1] << 8); }
function u32(buf, off) {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}
function str(buf, start, end) { return td.decode(buf.subarray(start, end)); }

/** Raw-inflate a deflate stream using the browser's DecompressionStream. */
async function inflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  const ab = await stream.arrayBuffer();
  return new Uint8Array(ab);
}

// ---- ZIP parsing (EOCD -> Central Directory -> local entries) ----
async function readZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (u32(buf, i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('Not a valid .xlsx file (no ZIP end-of-directory record).');

  const entryCount = u16(buf, eocd + 10);
  let cdOffset = u32(buf, eocd + 16);

  const entries = {};
  const CDH_SIG = 0x02014b50;
  const LFH_SIG = 0x04034b50;
  for (let n = 0; n < entryCount; n++) {
    if (u32(buf, cdOffset) !== CDH_SIG) break;
    const compMethod = u16(buf, cdOffset + 10);
    const compSize = u32(buf, cdOffset + 20);
    const nameLen = u16(buf, cdOffset + 28);
    const extraLen = u16(buf, cdOffset + 30);
    const commentLen = u16(buf, cdOffset + 32);
    const localHeaderOffset = u32(buf, cdOffset + 42);
    const name = str(buf, cdOffset + 46, cdOffset + 46 + nameLen);

    if (u32(buf, localHeaderOffset) === LFH_SIG) {
      const lfhNameLen = u16(buf, localHeaderOffset + 26);
      const lfhExtraLen = u16(buf, localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;
      const raw = buf.subarray(dataStart, dataStart + compSize);
      let content = null;
      if (compMethod === 0) content = raw; // stored
      else if (compMethod === 8) content = await inflateRaw(raw); // deflate
      if (content) entries[name] = content;
    }
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---- tiny XML helpers (regex-based; enough for Excel's simple cell XML) ----
function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&'); // amp last
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml)) !== null) {
    const inner = m[1];
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let t;
    let s = '';
    while ((t = tRe.exec(inner)) !== null) s += t[1];
    out.push(decodeXmlEntities(s));
  }
  return out;
}

function colToIndex(ref) {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml)) !== null) {
    const rowXml = rm[1];
    const cells = [];
    let maxIdx = -1;
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let cm;
    while ((cm = cellRe.exec(rowXml)) !== null) {
      const attrs = cm[1] ?? cm[3] ?? '';
      const body = cm[2] ?? '';
      const refMatch = /r="([A-Z]+)\d+"/.exec(attrs);
      const idx = refMatch ? colToIndex(refMatch[1]) : maxIdx + 1;
      const typeMatch = /t="([^"]+)"/.exec(attrs);
      const type = typeMatch ? typeMatch[1] : null;

      let value = '';
      if (type === 's') {
        const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
        if (vM) value = shared[parseInt(vM[1], 10)] ?? '';
      } else if (type === 'inlineStr') {
        const tM = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
        if (tM) value = decodeXmlEntities(tM[1]);
      } else {
        const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
        if (vM) {
          const raw = decodeXmlEntities(vM[1]);
          const nnum = Number(raw);
          value = raw !== '' && !Number.isNaN(nnum) ? nnum : raw;
        }
      }
      cells[idx] = value;
      if (idx > maxIdx) maxIdx = idx;
    }
    const dense = [];
    for (let i = 0; i <= maxIdx; i++) dense[i] = cells[i] === undefined ? '' : cells[i];
    rows.push(dense);
  }
  return rows;
}

/**
 * Parse an .xlsx (ArrayBuffer or Uint8Array) into { sheets: [{ name, rows }] }.
 * Async because deflate decompression uses DecompressionStream.
 */
export async function parseXlsx(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const entries = await readZipEntries(buf);

  const shared = parseSharedStrings(
    entries['xl/sharedStrings.xml'] ? str(entries['xl/sharedStrings.xml'], 0, entries['xl/sharedStrings.xml'].length) : '',
  );

  const workbookXml = entries['xl/workbook.xml'] ? str(entries['xl/workbook.xml'], 0, entries['xl/workbook.xml'].length) : '';
  const relsXml = entries['xl/_rels/workbook.xml.rels'] ? str(entries['xl/_rels/workbook.xml.rels'], 0, entries['xl/_rels/workbook.xml.rels'].length) : '';

  const relMap = {};
  const relRe = /<Relationship\b([^>]*)\/>/g;
  let r;
  while ((r = relRe.exec(relsXml)) !== null) {
    const idM = /Id="([^"]+)"/.exec(r[1]);
    const tgtM = /Target="([^"]+)"/.exec(r[1]);
    if (idM && tgtM) relMap[idM[1]] = tgtM[1];
  }

  const sheets = [];
  const sheetRe = /<sheet\b([^>]*)\/>/g;
  let s;
  while ((s = sheetRe.exec(workbookXml)) !== null) {
    const nameM = /name="([^"]*)"/.exec(s[1]);
    const ridM = /r:id="([^"]+)"/.exec(s[1]);
    if (!nameM || !ridM) continue;
    const name = decodeXmlEntities(nameM[1]);
    let target = relMap[ridM[1]];
    if (!target) continue;
    if (!target.startsWith('xl/')) target = 'xl/' + target.replace(/^\//, '');
    const entry = entries[target];
    if (!entry) continue;
    sheets.push({ name, rows: parseSheet(str(entry, 0, entry.length), shared) });
  }

  return { sheets };
}
