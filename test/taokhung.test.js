'use strict';
const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const { taoKhung } = require('../tools/tao-khung');
const { taoDocx } = require('./mau/taodoc');

const P = (text, o = {}) => ({ type: 'p', text, ...o });
async function baoCaoGia() {
  const buf = await taoDocx({ blocks: [
    { type: 'table', borders: false, rows: [['SỞ\nSố: 9/BC-SNNMT', 'Sơn La, ngày 1 tháng 2 năm 2026']] },
    P('BÁO CÁO'), P('Trích yếu thật'), P('Kính gửi: Sở Tài chính'), P('Thực hiện văn bản thật.'),
    P('I. MỤC THẬT'), P('Nội dung thật có số liệu 99 tỷ.'), P('Sở Nông nghiệp và Môi trường trân trọng báo cáo./.'),
    { type: 'table', borders: false, rows: [['Nơi nhận:\n- Như trên;', 'GIÁM ĐỐC\n\nNguyễn Văn A']] }
  ] });
  const z = await JSZip.loadAsync(buf);
  z.file('word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://stnmtsonla.vnptioffice.vn/van-ban-den/xem?id=33351939" TargetMode="External"/><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  z.file('docProps/core.xml', '<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>lam le</dc:creator><cp:revision>45</cp:revision></cp:coreProperties>');
  return z.generateAsync({ type: 'nodebuffer' });
}

test('khung rỗng: bỏ thân, tên người ký, liên kết không dùng, tác giả', async () => {
  const z = await JSZip.loadAsync(await taoKhung(await baoCaoGia()));
  const doc = await z.file('word/document.xml').async('string');
  for (const s of ['Trích yếu thật', 'MỤC THẬT', '99 tỷ', 'Nguyễn Văn A', '9/BC']) assert.ok(!doc.includes(s), s);
  const rels = await z.file('word/_rels/document.xml.rels').async('string');
  assert.doesNotMatch(rels, /vnptioffice|33351939/);
  assert.match(rels, /styles\.xml/);
  const core = await z.file('docProps/core.xml').async('string');
  assert.doesNotMatch(core, /lam le|>45</);
});
