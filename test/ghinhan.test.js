'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { lamSach, gopGhiNhan, ghiNhanBridge } = require('../src/ghinhan');

test('bỏ query string, giữ tên tham số', () => {
  const r = lamSach({ api: '/api/tra-cuu?ma=1&tu=2', method: 'GET', data: null, res: {} });
  assert.strictEqual(r.api, '/api/tra-cuu');
  assert.deepStrictEqual(r.thamSo.sort(), ['ma', 'tu']);
});

test('tham số chỉ ghi kiểu; bỏ hẳn khóa nhạy cảm', () => {
  const r = lamSach({ api: '/api/x', method: 'POST', data: { tu_ngay: '01/11/2026', page: 1, tu_khoa: 'giải phóng', co: true, token: 'abc', mat_khau: 'x', Authorization: 'y' }, res: {} });
  assert.strictEqual(r.mauThamSo.tu_ngay, 'date dd/mm/yyyy');
  assert.strictEqual(r.mauThamSo.page, 'number');
  assert.strictEqual(r.mauThamSo.tu_khoa, 'string');
  assert.strictEqual(r.mauThamSo.co, 'boolean');
  for (const k of ['token', 'mat_khau', 'Authorization']) { assert.ok(!(k in r.mauThamSo)); assert.ok(!r.thamSo.includes(k)); }
  assert.doesNotMatch(JSON.stringify(r), /abc|giải phóng/);
});

test('kết quả chỉ giữ cấu trúc, không giữ nội dung', () => {
  const r = lamSach({ api: '/api/x', method: 'POST', data: {}, res: { data: [{ trich_yeu: 'Bí mật nội dung', so: 5, con: { a: 'x' } }, { trich_yeu: 'khác' }], total_row: 9 } });
  const s = JSON.stringify(r);
  assert.doesNotMatch(s, /Bí mật nội dung|khác/);
  assert.strictEqual(r.mauKetQua.data[0].trich_yeu, '<string:15>');
  assert.strictEqual(r.mauKetQua.data[0].so, '<number>');
  assert.strictEqual(r.mauKetQua.data.length, 1);
  assert.strictEqual(r.mauKetQua.total_row, '<number>');
});

test('gộp theo api + phương thức', () => {
  const a = lamSach({ api: '/api/x?p=1', method: 'POST', data: { a: 1 }, res: {} });
  const b = lamSach({ api: '/api/x?q=2', method: 'POST', data: { b: 'x' }, res: {} });
  const c = lamSach({ api: '/api/x', method: 'GET', data: null, res: {} });
  const g = gopGhiNhan([a, b, c]);
  assert.strictEqual(g.length, 2);
  const post = g.find(x => x.method === 'POST');
  assert.deepStrictEqual(post.thamSo.sort(), ['a', 'b', 'p', 'q']);
  assert.strictEqual(post.soLan, 2);
});

test('cầu nối trong trang không đụng header/token', () => {
  const src = ghiNhanBridge.toString();
  assert.doesNotMatch(src, /header|token|localStorage|cookie/i);
});
