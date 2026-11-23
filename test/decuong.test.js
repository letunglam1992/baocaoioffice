'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseDeCuong, parseChuDe } = require('../src/decuong');
const { blocksDeCuong, P } = require('./mau/decuong-gia');

const tim = (ds, so) => { for (const m of ds) { if (m.so === so) return m; const c = tim(m.con, so); if (c) return c; } return null; };

test('dựng cây 5 mục La Mã và mục cấp 3', () => {
  const dc = parseDeCuong(blocksDeCuong());
  assert.strictEqual(dc.tieuDe, 'ĐỀ CƯƠNG BÁO CÁO');
  assert.match(dc.trichYeu, /^Kết quả thực hiện năm 2026/);
  assert.deepStrictEqual(dc.muc.map(m => m.so), ['I', 'II', 'III', 'IV', 'V']);
  assert.strictEqual(dc.muc[1].con[0].con.length, 6);
  assert.strictEqual(dc.muc[1].con[0].con[0].so, '1.1');
  assert.strictEqual(dc.muc[1].con[0].con[0].cap, 3);
});

test('câu Đề nghị là chỉ dẫn; mục giao đơn vị khác mặc định tắt', () => {
  const dc = parseDeCuong(blocksDeCuong());
  const m14 = tim(dc.muc, '1.4');
  assert.strictEqual(m14.bat, false);
  assert.strictEqual(m14.chiDan.length, 1);
  assert.doesNotMatch(m14.tieuDe, /Đề nghị/);
  assert.strictEqual(m14.tieuDe, 'Kết quả thu hút FDI');
  assert.strictEqual(tim(dc.muc, '2.3').bat, true);
  assert.strictEqual(tim(dc.muc, '2.1').bat, true);
  assert.strictEqual(tim(dc.muc, '1.2').bat, true);
  assert.strictEqual(tim(dc.muc, '1.3').bat, false);
  assert.strictEqual(tim(dc.muc, '1.1').bat, true);
  assert.deepStrictEqual(tim(dc.muc, '1.1').moTa, ['Tổng số dự án mới và vốn đăng ký năm 2026; so sánh cùng kỳ']);
});

test('gạch đầu dòng vào mô tả của mục', () => {
  const dc = parseDeCuong(blocksDeCuong());
  const m22 = tim(dc.muc, '2.2');
  assert.strictEqual(m22.moTa.length, 3);
  assert.strictEqual(m22.con.length, 0);
});

test('ngữ cảnh: văn bản gốc và năm', () => {
  const dc = parseDeCuong(blocksDeCuong());
  assert.ok(dc.vanBanGoc.includes('09-NQ/TU'));
  assert.ok(dc.vanBanGoc.includes('131/KH-UBND'));
  assert.strictEqual(dc.nam, 2026);
});

test('phụ lục danh mục văn bản', () => {
  const dc = parseDeCuong(blocksDeCuong());
  assert.strictEqual(dc.phuLuc.length, 1);
  assert.strictEqual(dc.phuLuc[0].dang, 'danhMucVB');
  assert.strictEqual(dc.phuLuc[0].bang[0].length, 6);
  assert.match(dc.phuLuc[0].tieuDe, /^DANH MỤC VĂN BẢN/);
  assert.match(dc.phuLuc[0].so, /Phụ lục 01/);
});

test('chịu được đánh số lệch chuẩn, đoạn rỗng, khoảng trắng không ngắt', () => {
  const chuan = parseDeCuong(blocksDeCuong());
  const lech = parseDeCuong(blocksDeCuong().flatMap(b => {
    if (b.type !== 'p') return [b];
    let t = b.text.replace(/^1\.1\. /, '1.1 ').replace(/^I\. /, 'I - ').replace(/^2\.2\. /, '2.2. ');
    return [P(t, b), P('   ')];
  }));
  const khung = ds => ds.map(m => [m.so, m.cap, m.tieuDe, khung(m.con)]);
  assert.deepStrictEqual(khung(lech.muc), khung(chuan.muc));
});

test('chủ đề gõ tay và số ký hiệu ghim', () => {
  const dc = parseChuDe('Giải phóng mặt bằng\n\nĐất đai', '131/KH-UBND, 09-NQ/TU');
  assert.strictEqual(dc.muc.length, 2);
  assert.strictEqual(dc.muc[0].dang, 'van');
  assert.strictEqual(dc.muc[0].bat, true);
  assert.strictEqual(dc.muc[0].ghim.length, 2);
  assert.deepStrictEqual(dc.vanBanGoc, ['131/KH-UBND', '09-NQ/TU']);
});

test('mục ba cấp 1.1.1, chữ có dấu chấm a., dòng thân bắt đầu bằng số', () => {
  const dc = parseDeCuong([P('ĐỀ CƯƠNG'), P('Báo cáo năm 2026'), P('I. MỤC MỘT'), P('1. Mục số'), P('1.1. Mục hai cấp'),
    P('1.1.1. Mục ba cấp'), P('a. Mục chữ có chấm'), P('1.500 ha đất đã được giao trong năm'), P('2. Mục số hai')]);
  const m1 = dc.muc[0].con[0];
  assert.deepStrictEqual(m1.con.map(m => m.so), ['1.1']);
  const m11 = m1.con[0];
  assert.deepStrictEqual(m11.con.map(m => [m.so, m.tieuDe]), [['1.1.1', 'Mục ba cấp'], ['a', 'Mục chữ có chấm']]);
  assert.ok(m11.con[1].moTa.includes('1.500 ha đất đã được giao trong năm'));
  assert.deepStrictEqual(dc.muc[0].con.map(m => m.so), ['1', '2']);
});

test('đánh số tự động của Word (numPr) vẫn dựng được cây', () => {
  const dc = parseDeCuong([P('ĐỀ CƯƠNG'), P('Báo cáo năm 2026'),
    { type: 'p', text: 'CÔNG TÁC CHỈ ĐẠO', numLvl: 0 }, { type: 'p', text: 'Quán triệt nghị quyết', numLvl: 1 },
    { type: 'p', text: 'Ban hành văn bản', numLvl: 1 }, { type: 'p', text: 'KẾT QUẢ', numLvl: 0 }]);
  assert.deepStrictEqual(dc.muc.map(m => m.tieuDe), ['CÔNG TÁC CHỈ ĐẠO', 'KẾT QUẢ']);
  assert.deepStrictEqual(dc.muc[0].con.map(m => [m.cap, m.tieuDe]), [[2, 'Quán triệt nghị quyết'], [2, 'Ban hành văn bản']]);
});
