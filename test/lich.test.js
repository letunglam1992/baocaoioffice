'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { denHan, khoangLuot, buKhiMoMay } = require('../src/lich');

// mốc giờ Việt Nam (UTC+7)
const vn = (d, m, y, hh, mm) => Date.UTC(y, m - 1, d, hh - 7, mm);
const base = { lich: ['12:00'], thuLaiPhut: 30, lastFailAt: null };

test('chưa tới 12:00 thì chưa đến hạn', () => {
  assert.strictEqual(denHan({ ...base, lastRunAt: vn(22, 11, 2026, 12, 5), now: vn(23, 11, 2026, 11, 59) }), false);
});
test('qua 12:00 mà hôm nay chưa chạy thì đến hạn', () => {
  assert.strictEqual(denHan({ ...base, lastRunAt: vn(22, 11, 2026, 12, 5), now: vn(23, 11, 2026, 12, 1) }), true);
});
test('đã chạy sau 12:00 hôm nay thì không chạy lại', () => {
  assert.strictEqual(denHan({ ...base, lastRunAt: vn(23, 11, 2026, 12, 0), now: vn(23, 11, 2026, 16, 0) }), false);
});
test('máy tắt lúc 12:00, mở lúc 18:00 thì đến hạn (bù)', () => {
  assert.strictEqual(denHan({ ...base, lastRunAt: vn(22, 11, 2026, 12, 1), now: vn(23, 11, 2026, 18, 0) }), true);
});
test('chưa chạy lần nào thì đến hạn', () => {
  assert.strictEqual(denHan({ ...base, lastRunAt: null, now: vn(23, 11, 2026, 9, 0) }), true);
});
test('lỗi: thử lại sau 30 phút', () => {
  const run = vn(23, 11, 2026, 12, 0);
  assert.strictEqual(denHan({ ...base, lastRunAt: run, lastFailAt: run, now: run + 29 * 60000 }), false);
  assert.strictEqual(denHan({ ...base, lastRunAt: run, lastFailAt: run, now: run + 30 * 60000 }), true);
});
test('khoảng lượt đầu từ mốc lùi', () => {
  assert.deepStrictEqual(khoangLuot({ lastOkAt: null, luiNgay: 3, tuNgayDau: '01/01/2025', now: vn(23, 11, 2026, 12, 0) }),
    { tuNgay: '01/01/2025', denNgay: '23/11/2026' });
});
test('khoảng lượt sau lùi 3 ngày', () => {
  assert.deepStrictEqual(khoangLuot({ lastOkAt: '20/11/2026', luiNgay: 3, tuNgayDau: '01/01/2025', now: vn(23, 11, 2026, 12, 0) }),
    { tuNgay: '17/11/2026', denNgay: '23/11/2026' });
  assert.strictEqual(khoangLuot({ lastOkAt: '02/01/2025', luiNgay: 3, tuNgayDau: '01/01/2025', now: vn(23, 11, 2026, 12, 0) }).tuNgay, '01/01/2025');
});
test('bù khi mở máy sau 5 phút', () => {
  const t0 = vn(23, 11, 2026, 8, 0);
  assert.strictEqual(buKhiMoMay(t0, t0 + 4 * 60000, 5), false);
  assert.strictEqual(buKhiMoMay(t0, t0 + 5 * 60000, 5), true);
});

test('đến giờ lượt tiếp (tiepTucAt) thì chạy dù chưa tới giờ lịch', () => {
  const now = vn(23, 11, 2026, 14, 0);
  assert.strictEqual(denHan({ ...base, lastRunAt: vn(23, 11, 2026, 13, 0), tiepTucAt: now - 1, now }), true);
  assert.strictEqual(denHan({ ...base, lastRunAt: vn(23, 11, 2026, 13, 0), tiepTucAt: now + 60000, now }), false);
});
