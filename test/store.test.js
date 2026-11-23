'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/store');

test('cài đặt mặc định, ghi rồi đọc lại, hỏng tệp chính thì dùng bản sao lưu', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-'));
  const s = new Store(dir);
  assert.deepStrictEqual(s.data.caiDat.lich, ['12:00']);
  assert.strictEqual(s.data.caiDat.ai.bat, false);
  s.data.caiDat.ai.diaChi = 'https://khac';
  s.data.taiKhoan.a = { ten: 'A' };
  s.save(); s.save();
  fs.writeFileSync(path.join(dir, 'du-lieu.json'), '{hỏng');
  const s2 = new Store(dir);
  assert.strictEqual(s2.data.taiKhoan.a.ten, 'A');
  assert.strictEqual(s2.data.caiDat.ai.diaChi, 'https://khac');
  assert.strictEqual(s2.data.caiDat.ai.bat, false);
  for (let i = 0; i < 600; i++) s2.log('info', 'x' + i);
  assert.strictEqual(s2.data.log.length, 500);
});
