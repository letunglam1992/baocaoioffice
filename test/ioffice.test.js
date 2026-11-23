'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { IOffice, ALLOWED_APIS, partitionFor, PARTITION_PREFIX } = require('../src/ioffice');

test('partitionFor tạo tên phân vùng an toàn cho mỗi tài khoản', () => {
  assert.strictEqual(PARTITION_PREFIX, 'persist:ioffice-');
  assert.strictEqual(partitionFor('lam'), 'persist:ioffice-lam');
  assert.strictEqual(partitionFor('Lâm Tùng!'), 'persist:ioffice-lam-tung');
  assert.strictEqual(partitionFor('Đức  Anh'), 'persist:ioffice-duc-anh');
});

test('danh sách trắng chỉ gồm API đọc', () => {
  assert.ok(ALLOWED_APIS.length >= 8);
  assert.ok(ALLOWED_APIS.every(a => /danh-sach|chi-tiet|but-phe|phuc-dap|cay-xu-ly|qua-trinh/.test(a)));
});

test('call từ chối API ngoài danh sách trắng trước khi mở cửa sổ', async () => {
  const io = new IOffice({ partition: partitionFor('x') });
  await assert.rejects(io.call('/api/van-ban-den/chuyen-xu-ly'), /API_KHONG_DUOC_PHEP/);
  assert.strictEqual(io.win, null);
});
