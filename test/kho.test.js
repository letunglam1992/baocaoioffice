'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kho } = require('../src/kho');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kho-'));
const vb = (id, so, ngay, trich, text, o = {}) => ({
  id, chieu: id.startsWith('di:') ? 'di' : 'den', soKyHieu: so, ngayBanHanh: ngay, coQuan: o.coQuan || 'UBND tỉnh', loai: o.loai || 'Công văn',
  trichYeu: trich, taiKhoan: o.taiKhoan || ['a'], doMat: !!o.doMat,
  tep: [{ name: 'a.pdf', path: 'p/a.pdf', method: 'pdf-text', canOcr: false, ocrDone: false }],
  trang: text ? [{ tep: 0, so: 1, text }] : [], capNhat: '2026-11-23T00:00:00Z'
});
function mau(kho) {
  kho.upsert(vb('den:1', '131/KH-UBND', '14/05/2026', 'Kế hoạch thực hiện Nghị quyết', 'Tổ chức triển khai thu hút đầu tư.'));
  kho.upsert(vb('di:2', '1410/TTr-SNNMT', '20/11/2026', 'Tờ trình xử lý dự án', 'Đã hoàn thành giải phóng mặt bằng 12,5 ha cho 3 dự án.'));
  kho.upsert(vb('den:3', '55/BC-UBND', '10/03/2025', 'Báo cáo năm 2025', 'Tình hình kinh tế xã hội năm 2025.'));
}

test('lưu và nạp lại theo năm', () => {
  const dir = tmp();
  const k = new Kho(dir); mau(k); k.save();
  assert.ok(fs.existsSync(path.join(dir, '2025')));
  assert.ok(fs.existsSync(path.join(dir, '2026')));
  const k2 = Kho.load(dir);
  assert.strictEqual(k2.get('di:2').soKyHieu, '1410/TTr-SNNMT');
  assert.match(k2.get('di:2').trang[0].text, /12,5 ha/);
  assert.strictEqual(k2.has('den:3'), true);
});

test('tìm không dấu và hoa thường', () => {
  const dir = tmp(); const k = new Kho(dir); mau(k); k.save();
  const k2 = Kho.load(dir);
  assert.strictEqual(k2.tim('giai phong mat bang', {})[0].vb.id, 'di:2');
  assert.strictEqual(k2.tim('GIẢI PHÓNG', {})[0].vb.id, 'di:2');
});

test('lọc theo khoảng ngày và chiều', () => {
  const k = new Kho(tmp()); mau(k);
  const ids = k.tim('năm', { tuNgay: '01/01/2026' }).map(r => r.vb.id);
  assert.ok(!ids.includes('den:3'));
  assert.deepStrictEqual(k.tim('dự án', { chieu: 'di' }).map(r => r.vb.id), ['di:2']);
});

test('timTheoSo không phân biệt hoa thường', () => {
  const k = new Kho(tmp()); mau(k);
  assert.deepStrictEqual(k.timTheoSo('131/kh-ubnd').map(v => v.id), ['den:1']);
  assert.deepStrictEqual(k.timTheoSo(' 131 / KH-UBND').map(v => v.id), ['den:1']);
});

test('văn bản mật không giữ chữ, không vào chỉ mục', () => {
  const k = new Kho(tmp());
  k.upsert(vb('den:9', '9/CV-X', '01/02/2026', 'Mật', 'nội dung tuyệt mật về đất', { doMat: true }));
  assert.strictEqual(k.get('den:9').trang.length, 0);
  assert.strictEqual(k.tim('tuyệt mật', {}).length, 0);
});

test('upsert gộp tài khoản và giữ chữ cũ khi bản mới không có chữ', () => {
  const k = new Kho(tmp()); mau(k);
  k.upsert(vb('di:2', '1410/TTr-SNNMT', '20/11/2026', 'Tờ trình xử lý dự án', '', { taiKhoan: ['b'] }));
  assert.deepStrictEqual(k.get('di:2').taiKhoan, ['a', 'b']);
  assert.match(k.get('di:2').trang[0].text, /12,5 ha/);
});

test('canOcr liệt kê tệp chờ OCR', () => {
  const k = new Kho(tmp());
  const v = vb('den:5', '5/CV-X', '01/02/2026', 'Scan', '');
  v.tep[0].canOcr = true;
  k.upsert(v);
  assert.deepStrictEqual(k.canOcr(5).map(x => [x.vb.id, x.tepIdx]), [['den:5', 0]]);
});
