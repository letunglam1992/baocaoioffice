'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { chuanHoa, boDau, tachTu, tuKhoa, timSoKyHieu, TU_DUNG } = require('../src/vntext');

test('chuanHoa gộp khoảng trắng và khoảng trắng không ngắt', () => {
  assert.strictEqual(chuanHoa('a  b '), 'a b');
});
test('boDau bỏ dấu kể cả đ', () => {
  assert.strictEqual(boDau('Giải phóng mặt bằng Đất'), 'Giai phong mat bang Dat');
});
test('tachTu giữ nguyên số ký hiệu', () => {
  const t = tachTu('Nghị quyết 09-NQ/TU, ngày 30/12/2025');
  assert.ok(t.includes('09-nq/tu'));
  assert.ok(t.includes('nghị'));
});
test('tuKhoa bỏ từ dừng, có cụm hai âm tiết không dấu', () => {
  const k = tuKhoa('Kết quả thực hiện bồi thường, giải phóng mặt bằng');
  assert.ok(!k.includes('ket qua'));
  assert.ok(!k.includes('thuc hien'));
  assert.ok(k.includes('giai phong'));
  assert.ok(k.includes('boi thuong'));
  assert.ok(TU_DUNG.has('báo cáo'));
});
test('timSoKyHieu nhận các dạng số ký hiệu, không nhận ngày', () => {
  assert.deepStrictEqual(timSoKyHieu('Kế hoạch số 131/KH-UBND và Tờ trình 1410/TTr-SNNMT ngày 20/11/2026'), ['131/KH-UBND', '1410/TTr-SNNMT']);
  assert.deepStrictEqual(timSoKyHieu('Nghị quyết số 09-NQ/TU; Quyết định 3462/QĐ-UBND'), ['09-NQ/TU', '3462/QĐ-UBND']);
});
