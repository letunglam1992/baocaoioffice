'use strict';
/**
 * Tạo KHUNG báo cáo rỗng từ một báo cáo thật (.docx) — chạy ngoài repo với tệp thật:
 *   node tools/tao-khung.js <báo cáo thật.docx> assets/khung-bao-cao.docx
 * Giữ: khối đầu (số/ngày để trống), tên loại, kiểu đoạn, câu kết, khối nơi nhận/ký (bỏ họ tên người ký), lề, phông.
 * Bỏ: toàn bộ nội dung thân, chú thích cuối trang, thông tin tác giả.
 */
const fs = require('fs');
const JSZip = require('jszip');
const { docKhung, tachBody, datChu, para } = require('../src/xuatword');
const { runText } = require('../src/docread');

async function taoKhung(buf) {
  const k = await docKhung(buf);
  const { truoc, sau, els, sect } = tachBody(k.docXml);
  const { kinhGui: iKG, moDau: iMD, ketThuc: iKT, noiNhan: iNN } = k.idx;
  const dau = els.slice(0, iKG).map((e, i) => {
    if (e.name === 'w:tbl') return e.xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, p => {
      const t = runText(p).trim();
      if (/^Số\s*:/.test(t)) return datChu(p, 'Số:        /BC-SNNMT');
      if (/ngày[\s\S]*tháng[\s\S]*năm/.test(t)) return datChu(p, 'Sơn La, ngày      tháng      năm');
      return p.replace(/<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:footnoteReference[^>]*\/>[\s\S]*?<\/w:r>/g, '');
    });
    if (i === iKG - 1) return datChu(e.xml, 'Trích yếu nội dung báo cáo');
    return e.xml;
  });
  let nn = iNN >= 0 ? els[iNN].xml : '';
  if (nn) { // bỏ họ tên người ký: đoạn có chữ cuối cùng của ô cuối
    const cells = nn.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const cuoi = cells[cells.length - 1] || '';
    const ps = cuoi.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
    const pTen = [...ps].reverse().find(p => runText(p).trim());
    if (pTen && ps.filter(p => runText(p).trim()).length > 1) nn = nn.replace(pTen, datChu(pTen, ''));
  }
  const K = k.kieu;
  const parts = [
    ...dau,
    datChu(els[iKG].xml, 'Kính gửi: '),
    datChu(els[iMD].xml, 'Mẫu đoạn mở đầu.'),
    para(K.muc1, 'I. MẪU MỤC LA MÃ'), para(K.muc2, '1. Mẫu mục số'), para(K.muc3, 'a) Mẫu mục chữ'),
    para(K.gach, '- Mẫu gạch đầu dòng'), para(K.doan, 'Mẫu đoạn nội dung.'),
    datChu(els[iKT].xml, 'Sở Nông nghiệp và Môi trường trân trọng báo cáo./.'),
    nn,
    ...els.slice((iNN >= 0 ? iNN : iKT) + 1).map(e => e.name === 'w:p' && !runText(e.xml).trim() ? e.xml : '')
  ];
  const zip = await JSZip.loadAsync(buf);
  const docMoi = (truoc + parts.join('') + sect + sau).replace(/<w:footnoteReference[^>]*\/>/g, '');
  zip.file('word/document.xml', docMoi);
  // bỏ liên kết (hyperlink) không còn được dùng — báo cáo gốc có thể chứa đường dẫn tới văn bản iOffice thật
  const rels = zip.file('word/_rels/document.xml.rels');
  if (rels) {
    const x = await rels.async('string');
    zip.file('word/_rels/document.xml.rels', x.replace(/<Relationship\b[^>]*\/>/g, r => {
      const id = (r.match(/\bId="([^"]+)"/) || [])[1];
      return /\/hyperlink"/.test(r) && !docMoi.includes(`r:id="${id}"`) ? '' : r;
    }));
  }
  const fn = zip.file('word/footnotes.xml');
  if (fn) {
    const x = await fn.async('string');
    zip.file('word/footnotes.xml', x.replace(/<w:footnote\b(?![^>]*w:type="(?:separator|continuationSeparator|continuationNotice)")[\s\S]*?<\/w:footnote>/g, ''));
  }
  const core = zip.file('docProps/core.xml');
  if (core) zip.file('docProps/core.xml', (await core.async('string')).replace(/(<(dc:creator|cp:lastModifiedBy|dc:title|dc:subject|cp:keywords|dc:description)[^>]*>)[\s\S]*?(<\/\2>)/g, '$1$3')
    .replace(/<cp:revision>[^<]*<\/cp:revision>/g, '<cp:revision>1</cp:revision>').replace(/<cp:lastPrinted>[^<]*<\/cp:lastPrinted>/g, ''));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

if (require.main === module) {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) { console.error('Cách dùng: node tools/tao-khung.js <báo cáo.docx> <khung.docx>'); process.exit(1); }
  taoKhung(fs.readFileSync(src)).then(b => { fs.writeFileSync(dst, b); console.log('Đã tạo', dst); });
}
module.exports = { taoKhung };
