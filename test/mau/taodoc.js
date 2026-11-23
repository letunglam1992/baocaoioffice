'use strict';
/** Sinh tài liệu GIẢ cho kiểm thử (không dùng dữ liệu thật). */
const JSZip = require('jszip');

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function pXml(b) {
  const rPr = (b.bold ? '<w:b/>' : '') + (b.italic ? '<w:i/>' : '');
  const pPr = b.pPr || (b.center ? '<w:pPr><w:jc w:val="center"/></w:pPr>' : '');
  return `<w:p>${pPr}<w:r>${rPr ? '<w:rPr>' + rPr + '</w:rPr>' : ''}<w:t xml:space="preserve">${esc(b.text)}</w:t></w:r></w:p>`;
}
function tblXml(rows, borders = true) {
  const tblPr = borders ? '<w:tblPr><w:tblBorders><w:top w:val="single"/><w:bottom w:val="single"/><w:insideH w:val="single"/><w:insideV w:val="single"/></w:tblBorders></w:tblPr>' : '<w:tblPr/>';
  return `<w:tbl>${tblPr}` + rows.map(r => '<w:tr>' + r.map(c => `<w:tc>${String(c).split('\n').map(t => pXml({ text: t })).join('')}</w:tc>`).join('') + '</w:tr>').join('') + '</w:tbl>';
}
/** blocks: [{type:'p', text, bold, italic, center} | {type:'table', rows, borders}] */
async function taoDocx({ blocks }) {
  const body = blocks.map(b => b.type === 'table' ? tblXml(b.rows, b.borders !== false) : pXml(b)).join('');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="851" w:right="964" w:bottom="964" w:left="1701" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** sheets: { 'Tên sheet': [[ô, ô], ...] } — chuỗi dạng inline string. */
async function taoXlsx({ sheets }) {
  const names = Object.keys(sheets);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>');
  names.forEach((n, i) => {
    const rows = sheets[n].map((r, ri) => `<row r="${ri + 1}">` + r.map((c, ci) => {
      const ref = String.fromCharCode(65 + ci) + (ri + 1);
      return typeof c === 'number' ? `<c r="${ref}"><v>${c}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(c)}</t></is></c>`;
    }).join('') + '</row>').join('');
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
  });
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** PDF một trang có lớp chữ (ASCII), dựng tay với bảng xref đúng. */
function taoPdfChu(lines) {
  const content = 'BT /F1 11 Tf 50 780 Td 14 TL ' + lines.map(l => `(${l.replace(/[()\\]/g, '')}) Tj T*`).join(' ') + ' ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let out = '%PDF-1.4\n';
  const off = [];
  objs.forEach((o, i) => { off.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

module.exports = { taoDocx, taoXlsx, taoPdfChu, esc };
