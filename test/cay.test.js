'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { phangCay } = require('../src/ui/cay');
const { parseDeCuong } = require('../src/decuong');
const { blocksDeCuong } = require('./mau/decuong-gia');

test('phangCay: nhãn đúng cấp, giữ thứ tự, đếm trích đoạn', () => {
  const dc = parseDeCuong(blocksDeCuong());
  const m23 = dc.muc[1].con[1].con.find(m => m.so === '2.3');
  const ketQua = { [m23.id]: { trichDoan: [{ chon: true }, { chon: false }, { chon: true }] } };
  const ds = phangCay(dc.muc, ketQua);
  assert.deepStrictEqual(ds.slice(0, 3).map(x => [x.nhan, x.cap]), [['I.', 1], ['1.', 2], ['2.', 2]]);
  const r = ds.find(x => x.id === m23.id);
  assert.strictEqual(r.nhan, '2.3.');
  assert.strictEqual(r.soTrich, 2);
  assert.strictEqual(r.coKetQua, true);
  assert.strictEqual(ds.find(x => x.nhan === '1.4.').bat, false);
  assert.strictEqual(ds.length, 22); // I(2) + II(1:6, 2:3) + III(2) + IV(1) + V(1)
});
