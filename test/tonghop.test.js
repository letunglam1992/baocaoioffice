'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Kho } = require('../src/kho');
const { truyVanMuc, tongHopMuc, tongHop, danhMucVanBan } = require('../src/tonghop');
const { parseDeCuong, parseChuDe } = require('../src/decuong');
const { blocksDeCuong } = require('./mau/decuong-gia');

const vb = (id, so, ngay, trich, text, o = {}) => ({ id, chieu: id.startsWith('di:') ? 'di' : 'den', soKyHieu: so, ngayBanHanh: ngay, coQuan: o.coQuan || 'UBND tỉnh', loai: 'Công văn', trichYeu: trich, taiKhoan: ['a'], doMat: false, tep: [], trang: [{ tep: 0, so: 1, text }], capNhat: '2026-11-23T00:00:00Z' });
function khoMau() {
  const k = new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'th-')));
  k.upsert(vb('den:1', '09-NQ/TU', '30/12/2025', 'Nghị quyết về thu hút đầu tư', 'Nghị quyết của Ban Chấp hành về thu hút đầu tư.'));
  k.upsert(vb('den:2', '131/KH-UBND', '14/05/2026', 'Kế hoạch thực hiện Nghị quyết số 09-NQ/TU', 'Căn cứ Nghị quyết số 09-NQ/TU, UBND tỉnh ban hành kế hoạch.'));
  k.upsert(vb('di:3', '1410/TTr-SNNMT', '20/11/2026', 'Tờ trình về bồi thường, giải phóng mặt bằng', 'Thực hiện Nghị quyết số 09-NQ/TU.\n\nNăm 2026, Sở đã phối hợp tổ chức bồi thường, giải phóng mặt bằng, đã bàn giao 12,5 ha cho 3 dự án.\n\nCông tác giải phóng mặt bằng còn vướng mắc về giá đất.'));
  k.upsert(vb('di:4', '88/CV-SNNMT', '05/06/2026', 'Công văn triển khai Kế hoạch 131/KH-UBND', 'Triển khai Nghị quyết 09-NQ/TU trong ngành nông nghiệp.', { coQuan: 'Sở Nông nghiệp và Môi trường' }));
  k.upsert(vb('den:5', '7/BC-X', '01/02/2026', 'Báo cáo chung', 'Tình hình quốc phòng an ninh ổn định.'));
  k.upsert(vb('den:6', '3/CV-Y', '01/12/2024', 'Công văn cũ về giải phóng mặt bằng', 'Giải phóng mặt bằng năm 2024 đạt 2 ha.'));
  return k;
}
const tim = (ds, so) => { for (const m of ds) { if (m.so === so) return m; const c = tim(m.con, so); if (c) return c; } return null; };
const opts = { tuNgay: '01/01/2026', denNgay: '31/12/2026' };

test('truy vấn bỏ từ dừng và thêm từ khóa người dùng', () => {
  const dc = parseDeCuong(blocksDeCuong());
  const m = tim(dc.muc, '2.3'); m.tuKhoaThem = ['đền bù'];
  const q = truyVanMuc(m, dc);
  assert.match(q, /giai phong/);
  assert.match(q, /den bu/);
  assert.doesNotMatch(q, /ket qua/);
});

test('mục GPMB: văn bản GPMB đứng đầu, trích đoạn có số liệu, có nguồn', () => {
  const dc = parseDeCuong(blocksDeCuong());
  const kq = tongHopMuc(tim(dc.muc, '2.3'), dc, khoMau(), opts);
  assert.strictEqual(kq.vanBan[0].id, 'di:3');
  assert.strictEqual(kq.trichDoan[0].coSoLieu, true);
  assert.match(kq.trichDoan[0].text, /12,5 ha/);
  for (const t of kq.trichDoan) {
    assert.ok(t.soKyHieu && t.ngay && t.trang);
    assert.ok(t.text.length <= 600);
    assert.strictEqual(t.chon, true);
  }
  assert.deepStrictEqual(kq.trichDoan.map(t => t.n), kq.trichDoan.map((_, i) => i + 1));
  assert.ok(!kq.vanBan.some(v => v.id === 'den:6'), 'ngoài khoảng ngày');
});

test('văn bản ghim luôn đứng đầu', () => {
  const dc = parseChuDe('Giải phóng mặt bằng', '7/BC-X');
  const kq = tongHopMuc(dc.muc[0], dc, khoMau(), opts);
  assert.strictEqual(kq.vanBan[0].id, 'den:5');
});

test('trích đoạn dài bị cắt ở ranh giới câu', () => {
  const k = khoMau();
  const dai = Array.from({ length: 30 }, (_, i) => `Câu ${i} về giải phóng mặt bằng tại dự án số ${i}.`).join(' ');
  k.upsert(vb('di:7', '99/BC-SNNMT', '01/10/2026', 'Báo cáo giải phóng mặt bằng', dai));
  const dc = parseChuDe('Giải phóng mặt bằng');
  const kq = tongHopMuc(dc.muc[0], dc, k, opts);
  assert.ok(kq.trichDoan.every(t => t.text.length <= 600));
  assert.ok(kq.trichDoan.filter(t => t.vbId === 'di:7').every(t => /\.$/.test(t.text)));
});

test('danh mục văn bản viện dẫn văn bản gốc, sắp theo ngày, bỏ chính văn bản gốc', () => {
  const dc = parseDeCuong(blocksDeCuong());
  const ds = danhMucVanBan(dc, khoMau(), opts);
  // 131/KH-UBND là văn bản gốc nêu trong trích yếu đề cương → không đưa vào danh mục
  assert.deepStrictEqual(ds.map(d => d.soKyHieu), ['88/CV-SNNMT', '1410/TTr-SNNMT']);
  assert.strictEqual(ds[0].ngay, '05/06/2026');
});

test('tongHop bỏ mục tắt; kho rỗng không lỗi', () => {
  const dc = parseDeCuong(blocksDeCuong());
  const kq = tongHop(dc, khoMau(), opts);
  assert.ok(!(tim(dc.muc, '1.4').id in kq));
  assert.ok(tim(dc.muc, '2.3').id in kq);
  const rong = tongHop(dc, new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'th-'))), opts);
  assert.deepStrictEqual(rong[tim(dc.muc, '2.3').id].trichDoan, []);
});
