'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { docBlocks, readAny } = require('../src/docread');
const { taoDocx, taoXlsx, taoPdfChu } = require('./mau/taodoc');

test('docBlocks giữ thứ tự đoạn và bảng, nhận chữ đậm', async () => {
  const buf = await taoDocx({ blocks: [
    { type: 'p', text: 'I. CÔNG TÁC', bold: true },
    { type: 'p', text: '1. Quán triệt' },
    { type: 'table', rows: [['TT', 'Số, ký hiệu văn bản'], ['1', '']] },
    { type: 'p', text: 'II. KẾT QUẢ' }
  ] });
  const { blocks } = await docBlocks(buf);
  assert.strictEqual(blocks.length, 4);
  assert.deepStrictEqual(blocks.map(b => b.type), ['p', 'p', 'table', 'p']);
  assert.strictEqual(blocks[0].bold, true);
  assert.strictEqual(blocks[1].bold, false);
  assert.strictEqual(blocks[2].rows[0][1], 'Số, ký hiệu văn bản');
  assert.strictEqual(blocks[3].text, 'II. KẾT QUẢ');
});

test('docBlocks giải mã thực thể XML', async () => {
  const buf = await taoDocx({ blocks: [{ type: 'p', text: 'A & B <c> "d"' }] });
  const { blocks } = await docBlocks(buf);
  assert.strictEqual(blocks[0].text, 'A & B <c> "d"');
});

test('readAny đọc docx thành trang', async () => {
  const buf = await taoDocx({ blocks: [{ type: 'p', text: 'Diện tích giải phóng mặt bằng 12,5 ha' }] });
  const r = await readAny(buf, 'bc.docx');
  assert.strictEqual(r.method, 'docx');
  assert.match(r.pages[0], /12,5 ha/);
  assert.ok(Array.isArray(r.blocks));
});

test('readAny đọc xlsx mỗi sheet một trang', async () => {
  const buf = await taoXlsx({ sheets: { 'Biểu 1': [['Chỉ tiêu', 'Giá trị'], ['Diện tích', '12,5']], 'Biểu 2': [['Số dự án', 3]] } });
  const r = await readAny(buf, 'bieu.xlsx');
  assert.strictEqual(r.method, 'xlsx');
  assert.strictEqual(r.pages.length, 2);
  assert.match(r.pages[0], /Diện tích \| 12,5/);
  assert.match(r.pages[1], /Số dự án \| 3/);
});

test('readAny tệp hỏng không ném lỗi', async () => {
  const r = await readAny(Buffer.from('rác'), 'x.docx');
  assert.strictEqual(r.method, 'none');
  assert.ok(r.error);
});

test('readAny bỏ qua tệp nén', async () => {
  const r = await readAny(Buffer.from('PK'), 'hoso.zip');
  assert.strictEqual(r.method, 'none');
  assert.strictEqual(r.canOcr, false);
});

test('readAny đọc lớp chữ PDF', async () => {
  const lines = Array.from({ length: 12 }, (_, i) => `Bao cao thu nghiem dong ${i + 1}: da ban giao 12,5 ha cho 3 du an`);
  const r = await readAny(taoPdfChu(lines), 'a.pdf');
  assert.strictEqual(r.method, 'pdf-text');
  assert.strictEqual(r.canOcr, false);
  assert.match(r.pages[0], /12,5 ha/);
});

test('readAny PDF ít chữ đánh dấu cần OCR', async () => {
  const r = await readAny(taoPdfChu(['x']), 'scan.pdf');
  assert.strictEqual(r.canOcr, true);
  assert.deepStrictEqual(r.pages, []);
});
