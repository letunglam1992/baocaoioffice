'use strict';
/**
 * Đọc tài liệu thành chữ: .docx (đoạn + bảng theo thứ tự), .doc (word-extractor), .xlsx (mỗi sheet một trang),
 * .pdf (lớp chữ; ít chữ → đánh dấu cần OCR). Không bao giờ ném lỗi: tệp hỏng → method 'none' + error.
 */
const JSZip = require('jszip');

const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&');

/** Tách các phần tử con cấp đầu (w:p, w:tbl) của một đoạn XML, có tính lồng nhau. */
function topElements(xml, names) {
  const out = [];
  const re = /<(\/?)(w:p|w:tbl|w:tr|w:tc|w:sdt|w:sdtContent)\b[^>]*?(\/?)>/g;
  let depth = 0, start = -1, cur = null, m;
  while ((m = re.exec(xml))) {
    const [tag, close, name, self] = m;
    if (self) { if (depth === 0 && names.includes(name)) out.push({ name, xml: tag }); continue; }
    if (!close) {
      if (depth === 0 && names.includes(name)) { start = m.index; cur = name; }
      if (cur) depth++;
    } else if (cur) {
      depth--;
      if (depth === 0) { out.push({ name: cur, xml: xml.slice(start, m.index + tag.length) }); cur = null; }
    }
  }
  return out;
}

function runText(pXml) {
  let t = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:br [^>]*\/>/g;
  let m;
  while ((m = re.exec(pXml))) {
    if (m[1] !== undefined) t += unesc(m[1]);
    else if (m[0].startsWith('<w:tab')) t += '\t';
    else t += '\n';
  }
  return t;
}

function paraInfo(pXml) {
  const runs = pXml.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
  const withText = runs.filter(r => /<w:t[\s>]/.test(r) && runText(r).trim());
  const has = (r, tag) => new RegExp(`<w:${tag}(?:\\s+w:val="(?:true|1|on)")?\\s*/>`).test(r);
  return {
    type: 'p',
    text: runText(pXml),
    bold: withText.length > 0 && withText.every(r => has(r, 'b')),
    italic: withText.length > 0 && withText.every(r => has(r, 'i'))
  };
}

function tableRows(tblXml) {
  const inner = tblXml.replace(/^<w:tbl\b[^>]*>/, '').replace(/<\/w:tbl>$/, '');
  return topElements(inner, ['w:tr']).map(tr => {
    const trInner = tr.xml.replace(/^<w:tr\b[^>]*>/, '').replace(/<\/w:tr>$/, '');
    return topElements(trInner, ['w:tc']).map(tc => topElements(tc.xml.replace(/^<w:tc\b[^>]*>/, ''), ['w:p']).map(p => runText(p.xml)).join('\n'));
  });
}

/** Các khối của thân văn bản .docx theo thứ tự. */
async function docBlocks(buf) {
  const zip = await JSZip.loadAsync(buf);
  const f = zip.file('word/document.xml');
  if (!f) throw new Error('Không có word/document.xml');
  const xml = await f.async('string');
  const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1] || '';
  const blocks = [];
  const expand = (part) => {
    for (const el of topElements(part, ['w:p', 'w:tbl', 'w:sdt'])) {
      if (el.name === 'w:p') blocks.push(paraInfo(el.xml));
      else if (el.name === 'w:tbl') blocks.push({ type: 'table', rows: tableRows(el.xml) });
      else expand(((el.xml.match(/<w:sdtContent>([\s\S]*)<\/w:sdtContent>/) || [])[1]) || '');
    }
  };
  expand(body);
  return { blocks };
}

function blocksToText(blocks) {
  return blocks.map(b => b.type === 'p' ? b.text : b.rows.map(r => r.join(' | ')).join('\n')).join('\n\n');
}

async function readXlsx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const ssF = zip.file('xl/sharedStrings.xml');
  const shared = ssF ? ((await ssF.async('string')).match(/<si>[\s\S]*?<\/si>/g) || [])
    .map(si => (si.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) || []).map(t => unesc(t.replace(/<[^>]+>/g, ''))).join('')) : [];
  const sheetFiles = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
  const pages = [];
  for (const n of sheetFiles) {
    const xml = await zip.file(n).async('string');
    const rows = (xml.match(/<row\b[\s\S]*?<\/row>/g) || []).map(row => (row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []).map(c => {
      const t = (c.match(/\bt="(\w+)"/) || [])[1];
      if (t === 'inlineStr') return (c.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) || []).map(x => unesc(x.replace(/<[^>]+>/g, ''))).join('');
      const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (v === undefined) return '';
      return t === 's' ? (shared[+v] || '') : unesc(v);
    }).filter(x => x !== '').join(' | ')).filter(Boolean);
    pages.push(rows.join('\n'));
  }
  return pages;
}

/**
 * @returns {Promise<{method:'docx'|'doc'|'xlsx'|'pdf-text'|'none', pages:string[], blocks?:object[], canOcr:boolean, error?:string}>}
 */
async function readAny(buf, name) {
  const ext = (String(name).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
  try {
    if (ext === 'docx') {
      const { blocks } = await docBlocks(buf);
      return { method: 'docx', pages: [blocksToText(blocks)], blocks, canOcr: false };
    }
    if (ext === 'doc') {
      const WordExtractor = require('word-extractor');
      const d = await new WordExtractor().extract(buf);
      const body = d.getBody() || '';
      const blocks = body.split(/\r?\n/).map(t => ({ type: 'p', text: t, bold: false, italic: false }));
      return { method: 'doc', pages: [body], blocks, canOcr: false };
    }
    if (ext === 'xlsx') return { method: 'xlsx', pages: await readXlsx(buf), canOcr: false };
    if (ext === 'pdf') {
      const { extractText } = require('./pdftext');
      const t = await extractText(buf, { maxPages: 200 });
      if (!t.hasTextLayer) return { method: 'pdf-text', pages: [], canOcr: true };
      return { method: 'pdf-text', pages: t.pages, canOcr: false };
    }
    return { method: 'none', pages: [], canOcr: false };
  } catch (e) {
    return { method: 'none', pages: [], canOcr: false, error: String(e && e.message || e).slice(0, 200) };
  }
}

module.exports = { docBlocks, readAny, blocksToText, topElements, runText, unesc };
