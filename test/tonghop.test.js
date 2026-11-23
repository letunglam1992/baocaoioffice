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

test('chọn văn bản cần tải theo trích yếu, ghim và văn bản gốc; giới hạn mỗi mục và cả báo cáo', () => {
  const { chonVanBanCanTai } = require('../src/tonghop');
  const k = new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'th-')));
  const ds = (id, so, ngay, trich) => k.upsert({ id, chieu: 'den', soKyHieu: so, ngayBanHanh: ngay, coQuan: 'X', loai: '', trichYeu: trich, taiKhoan: ['a'], doMat: false, tep: [], trang: [], chuaChiTiet: true, nguon: {}, capNhat: '' });
  for (let n = 1; n <= 25; n++) ds('den:g' + n, `${n}/CV-X`, '01/06/2026', `Về bồi thường, giải phóng mặt bằng dự án số ${n}`);
  ds('den:qp', '7/CV-Y', '01/06/2026', 'Về công tác quốc phòng địa phương');
  ds('den:nq', '88/CV-Z', '02/06/2026', 'Triển khai Nghị quyết số 09-NQ/TU về thu hút đầu tư');
  ds('den:cu', '3/CV-W', '01/06/2025', 'Về giải phóng mặt bằng năm 2025');
  ds('den:ghim', '55/BC-UBND', '01/03/2026', 'Báo cáo tình hình chung');
  k.upsert({ ...k.get('den:g1'), chuaChiTiet: false, tep: [{ name: 'a.pdf', path: 'p', method: 'pdf-text' }], trang: [{ tep: 0, so: 1, text: 'đã có' }] });
  const dc = parseChuDe('Bồi thường, giải phóng mặt bằng', '55/BC-UBND');
  dc.vanBanGoc.push('09-NQ/TU');
  const ids = chonVanBanCanTai(dc, k, { tuNgay: '01/01/2026', denNgay: '31/12/2026', moiMuc: 15, toiDa: 150 });
  assert.ok(ids.includes('den:ghim'));
  assert.ok(ids.includes('den:nq'));
  assert.ok(!ids.includes('den:qp'));
  assert.ok(!ids.includes('den:cu'), 'ngoài kỳ báo cáo');
  assert.ok(!ids.includes('den:g1'), 'đã có nội dung');
  const g = ids.filter(i => /^den:g\d/.test(i)).length;
  assert.ok(g >= 14 && g <= 15, 'tối đa 15 văn bản/mục (kể cả văn bản đã có nội dung): ' + g);
  const it = chonVanBanCanTai(dc, k, { tuNgay: '01/01/2026', denNgay: '31/12/2026', moiMuc: 15, toiDa: 5 });
  assert.strictEqual(it.length, 5);
  assert.strictEqual(it[0], 'den:ghim');
});
