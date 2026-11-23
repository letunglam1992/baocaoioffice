'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DieuPhoi } = require('../src/app/dieuphoi');
const { Kho } = require('../src/kho');
const { DEFAULTS } = require('../src/constants');

const NOW = Date.UTC(2026, 10, 23, 5, 0); // 12:00 VN 23/11/2026
function moiTruong(thuThap, o = {}) {
  const store = { data: { taiKhoan: { a: { ten: 'A' }, b: { ten: 'B', lastOkAt: '01/11/2026' } }, ...(o.data || {}) }, save() { this.luu = (this.luu || 0) + 1; } };
  const kho = o.kho || new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-')));
  const thongBao = [];
  const dp = new DieuPhoi({ store, kho, taoIo: id => ({ id }), thuThap, now: () => NOW, log: () => {}, thongBao: m => thongBao.push(m), caiDat: () => ({ ...DEFAULTS }), tamDir: fs.mkdtempSync(path.join(os.tmpdir(), 'tam-')), ocrFn: o.ocrFn });
  return { dp, store, kho, thongBao };
}

test('một tài khoản lỗi không chặn tài khoản sau; mốc chỉ dời khi đủ', async () => {
  const goi = [];
  const { dp, store } = moiTruong(async (o) => {
    goi.push([o.taiKhoan, o.tuNgay]);
    if (o.taiKhoan === 'a') throw new Error('hỏng');
    return { ok: true, moi: 1, hetGioiHan: false, dung: false, loi: [] };
  });
  const r = await dp.chayLuot({ lyDo: 'lich' });
  assert.deepStrictEqual(goi, [['a', '01/01/2025'], ['b', '29/10/2026']]);
  assert.strictEqual(store.data.taiKhoan.a.lastFailAt, NOW);
  assert.strictEqual(store.data.taiKhoan.a.lastOkAt, undefined);
  assert.strictEqual(store.data.taiKhoan.b.lastOkAt, '23/11/2026');
  assert.ok(r.theoTaiKhoan.b.ok);
  assert.strictEqual(store.data.lastRunAt, NOW);
  assert.strictEqual(store.data.lastFailAt, NOW);
});

test('hết giới hạn hoặc dừng thì không dời mốc', async () => {
  const { dp, store } = moiTruong(async () => ({ ok: true, hetGioiHan: true, dung: false, loi: [] }));
  await dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(store.data.taiKhoan.b.lastOkAt, '01/11/2026');
  assert.strictEqual(store.data.lastFailAt, null);
});

test('chưa đăng nhập: thông báo, không đặt thử lại', async () => {
  const { dp, store, thongBao } = moiTruong(async () => ({ ok: false, loi: [{ msg: 'CHUA_DANG_NHAP' }] }));
  await dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(thongBao.length, 2);
  assert.match(thongBao[0], /A.*đăng nhập/);
  assert.strictEqual(store.data.lastFailAt, null);
});

test('hai lượt song song: lượt sau trả ngay', async () => {
  let mo;
  const { dp } = moiTruong(() => new Promise(r => { mo = () => r({ ok: true, loi: [] }); }));
  const p1 = dp.chayLuot({ lyDo: 'tay' });
  const r2 = await dp.chayLuot({ lyDo: 'tay' });
  assert.deepStrictEqual(r2, { dangChay: true });
  mo(); await new Promise(r => setTimeout(r, 5)); mo(); await p1;
});

test('layTheoSo: đã có trong kho thì không gọi thu thập', async () => {
  let goi = 0;
  const { dp, kho } = moiTruong(async () => { goi++; return { ok: true, loi: [] }; });
  kho.upsert({ id: 'den:1', chieu: 'den', soKyHieu: '131/KH-UBND', ngayBanHanh: '14/05/2026', coQuan: '', loai: '', trichYeu: '', taiKhoan: ['a'], doMat: false, tep: [], trang: [], capNhat: '' });
  const r = await dp.layTheoSo('131/kh-ubnd');
  assert.strictEqual(goi, 0);
  assert.strictEqual(r[0].id, 'den:1');
});

test('layTheoSo: chưa có thì chỉ thu thập văn bản khớp số', async () => {
  const { dp } = moiTruong(async (o) => {
    const den = await o.io.listVanBanDen('01/01/2025', '23/11/2026');
    assert.deepStrictEqual(den.map(x => x.so_ky_hieu), ['131/KH-UBND']);
    return { ok: true, loi: [] };
  });
  dp.taoIo = () => ({ listVanBanDen: async () => [{ so_ky_hieu: '131/KH-UBND' }, { so_ky_hieu: '5/CV-X' }], listVanBanDiDaPhatHanh: async () => [] });
  await dp.layTheoSo('131/KH-UBND');
});

test('OCR lúc rảnh: tải lại tệp, ghi chữ, đánh dấu đã OCR', async () => {
  const kho = new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-')));
  kho.upsert({ id: 'den:5', chieu: 'den', soKyHieu: '5/CV', ngayBanHanh: '01/02/2026', coQuan: '', loai: '', trichYeu: 'scan', taiKhoan: ['a'], doMat: false, tep: [{ name: 's.pdf', path: 'p/s.pdf', method: 'pdf-text', canOcr: true, ocrDone: false }], trang: [], capNhat: '' });
  const { dp } = moiTruong(null, { kho, ocrFn: async () => ({ text: 'Trang một chữ OCR\n\f\nTrang hai', method: 'ocr' }) });
  dp.taoIo = () => ({ downloadFile: async () => Buffer.from('%PDF') });
  const n = await dp.ocrLucRanh({ gioiHanTrang: 10, soTep: 3 });
  assert.strictEqual(n, 1);
  const v = kho.get('den:5');
  assert.strictEqual(v.tep[0].ocrDone, true);
  assert.deepStrictEqual(v.trang.map(t => t.so), [1, 2]);
  assert.strictEqual(kho.canOcr(5).length, 0);
});

test('lượt còn văn bản/tệp lỗi thì không dời mốc (để lượt sau thử lại)', async () => {
  const { dp, store } = moiTruong(async () => ({ ok: true, hetGioiHan: false, dung: false, loi: [{ so: '5/CV', msg: 'TIMEOUT' }], loiTep: 0 }));
  await dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(store.data.taiKhoan.b.lastOkAt, '01/11/2026');
  const m2 = moiTruong(async () => ({ ok: true, hetGioiHan: false, dung: false, loi: [], loiTep: 2 }));
  await m2.dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(m2.store.data.taiKhoan.b.lastOkAt, '01/11/2026');
});

function khoScan(taiKhoan) {
  const kho = new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-')));
  kho.upsert({ id: 'den:5', chieu: 'den', soKyHieu: '5/CV', ngayBanHanh: '01/02/2026', coQuan: '', loai: '', trichYeu: 'scan', taiKhoan, doMat: false, tep: [{ name: 's.pdf', path: 'p/s.pdf', method: 'pdf-text', canOcr: true, ocrDone: false }], trang: [], capNhat: '' });
  return kho;
}

test('OCR: tải lỗi ở tài khoản đầu thì thử tài khoản khác', async () => {
  const kho = khoScan(['a', 'b']);
  const { dp } = moiTruong(null, { kho, ocrFn: async () => ({ text: 'Chữ', method: 'ocr' }) });
  dp.taoIo = id => ({ downloadFile: async () => { if (id === 'a') throw new Error('NOT_READY'); return Buffer.from('%PDF'); } });
  assert.strictEqual(await dp.ocrLucRanh({}), 1);
  assert.strictEqual(kho.get('den:5').tep[0].ocrDone, true);
});

test('OCR: lỗi tạm thời không đánh dấu hỏng ngay; sau 5 lần mới thôi', async () => {
  const kho = khoScan(['a']);
  const { dp } = moiTruong(null, { kho, ocrFn: async () => ({ text: 'x' }) });
  dp.taoIo = () => ({ downloadFile: async () => { throw new Error('Nội dung tải về là trang web (có thể phiên đã hết hạn)'); } });
  await dp.ocrLucRanh({});
  assert.strictEqual(kho.get('den:5').tep[0].ocrDone, false);
  for (let i = 0; i < 4; i++) await dp.ocrLucRanh({});
  assert.strictEqual(kho.get('den:5').tep[0].ocrDone, true);
});

test('OCR: lỗi đọc nội dung thì đánh dấu đã xử lý', async () => {
  const kho = khoScan(['a']);
  const { dp } = moiTruong(null, { kho, ocrFn: async () => { throw new Error('PDF hỏng'); } });
  dp.taoIo = () => ({ downloadFile: async () => Buffer.from('%PDF') });
  await dp.ocrLucRanh({});
  assert.strictEqual(kho.get('den:5').tep[0].ocrDone, true);
});

test('chạm giới hạn lượt: hẹn lượt tiếp sau 15 phút; lượt đủ thì bỏ hẹn', async () => {
  const { dp, store } = moiTruong(async () => ({ ok: true, hetGioiHan: true, dung: false, loi: [], loiTep: 0 }));
  await dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(store.data.tiepTucAt, NOW + 15 * 60000);
  const m2 = moiTruong(async () => ({ ok: true, hetGioiHan: false, dung: false, loi: [], loiTep: 0 }), { data: { tiepTucAt: 1 } });
  await m2.dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(m2.store.data.tiepTucAt, null);
});

test('người dùng bấm Dừng thì không hẹn lượt tiếp', async () => {
  const { dp, store } = moiTruong(async () => ({ ok: true, hetGioiHan: false, dung: true, loi: [], loiTep: 0 }));
  await dp.chayLuot({ lyDo: 'tay' });
  assert.strictEqual(store.data.tiepTucAt, null);
});

test('layTheoSo không chạy chồng lên lượt quét đang chạy', async () => {
  let mo;
  const { dp } = moiTruong(() => new Promise(r => { mo = () => r({ ok: true, loi: [] }); }));
  const p1 = dp.chayLuot({ lyDo: 'tay' });
  await assert.rejects(dp.layTheoSo('999/X'), /đang quét/i);
  mo(); await new Promise(r => setTimeout(r, 5)); mo(); await p1;
});

test('tình trạng lỗi của tài khoản là lỗi làm dừng lượt (lỗi cuối)', async () => {
  const { dp, store } = moiTruong(async () => ({ ok: false, loi: [{ msg: 'lỗi tệp 1' }, { msg: 'NOT_READY' }] }));
  await dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(store.data.taiKhoan.a.loi, 'NOT_READY');
});

test('quét nền chỉ lấy danh sách (chiDanhSach)', async () => {
  let o = null;
  const { dp } = moiTruong(async x => { o = x; return { ok: true, loi: [] }; });
  await dp.chayLuot({ lyDo: 'lich' });
  assert.strictEqual(o.chiDanhSach, true);
});

test('layNoiDung: chia văn bản theo tài khoản, thử tài khoản khác nếu chưa đăng nhập', async () => {
  const kho = new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-')));
  const vb = (id, tk) => kho.upsert({ id, chieu: 'den', soKyHieu: id, ngayBanHanh: '01/02/2026', coQuan: '', loai: '', trichYeu: 'x', taiKhoan: tk, doMat: false, tep: [], trang: [], chuaChiTiet: true, nguon: {}, capNhat: '' });
  vb('den:1', ['a']); vb('den:2', ['b', 'a']);
  const goi = [];
  const { dp } = moiTruong(null, { kho });
  dp.layChiTiet = async o => { goi.push([o.taiKhoan, o.ids]); return o.taiKhoan === 'b' ? { ok: false, loi: [{ msg: 'CHUA_DANG_NHAP' }], tep: 0 } : { ok: true, loi: [], tep: o.ids.length }; };
  const r = await dp.layNoiDung(['den:1', 'den:2']);
  assert.deepStrictEqual(goi, [['a', ['den:1']], ['b', ['den:2']], ['a', ['den:2']]]);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(dp.dangChay, false);
});

test('layTheoSo: văn bản mới có trong danh sách thì tải luôn nội dung', async () => {
  const kho = new Kho(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-')));
  kho.upsert({ id: 'den:1', chieu: 'den', soKyHieu: '131/KH-UBND', ngayBanHanh: '14/05/2026', coQuan: '', loai: '', trichYeu: 'x', taiKhoan: ['a'], doMat: false, tep: [], trang: [], chuaChiTiet: true, nguon: { ma_van_ban_den_kc: 1 }, capNhat: '' });
  const { dp } = moiTruong(null, { kho });
  let goi = null;
  dp.layChiTiet = async o => { goi = o.ids; kho.upsert({ ...kho.get('den:1'), chuaChiTiet: false }); return { ok: true, loi: [], tep: 1 }; };
  const r = await dp.layTheoSo('131/KH-UBND');
  assert.deepStrictEqual(goi, ['den:1']);
  assert.ok(!r[0].chuaChiTiet);
});
