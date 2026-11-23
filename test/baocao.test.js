'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PhienBaoCao } = require('../src/app/baocao');
const { Kho } = require('../src/kho');
const { taoDocx, taoXlsx } = require('./mau/taodoc');
const { blocksDeCuong } = require('./mau/decuong-gia');
const { docBlocks } = require('../src/docread');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bc-'));
function khoMau() {
  const k = new Kho(tmp());
  k.upsert({ id: 'di:3', chieu: 'di', soKyHieu: '1410/TTr-SNNMT', ngayBanHanh: '20/11/2026', coQuan: 'Sở', loai: 'Tờ trình', trichYeu: 'Tờ trình bồi thường, giải phóng mặt bằng', taiKhoan: ['a'], doMat: false, tep: [],
    trang: [{ tep: 0, so: 1, text: 'Thực hiện Nghị quyết số 09-NQ/TU.\n\nĐã bồi thường, giải phóng mặt bằng 12,5 ha cho 3 dự án.\n\nGiải phóng mặt bằng còn vướng mắc về giá đất bồi thường.' }], capNhat: '' });
  return k;
}
const tim = (ds, so) => { for (const m of ds) { if (m.so === so) return m; const c = tim(m.con, so); if (c) return c; } return null; };
async function phien() {
  const store = { data: { baoCao: null }, save() {} };
  const p = new PhienBaoCao({ store, kho: khoMau() });
  await p.napDeCuong(await taoDocx({ blocks: blocksDeCuong() }), 'decuong.docx');
  return { p, store };
}

test('nạp đề cương: kỳ báo cáo mặc định theo năm đề cương', async () => {
  const { store } = await phien();
  const bc = store.data.baoCao;
  assert.strictEqual(bc.dc.muc.length, 5);
  assert.deepStrictEqual([bc.tuNgay, bc.denNgay], ['01/01/2026', '31/12/2026']);
  assert.match(bc.trichYeu, /^Kết quả thực hiện năm 2026/);
});

test('phân tích lại giữ lựa chọn bỏ chọn trích đoạn và bật/tắt mục', async () => {
  const { p, store } = await phien();
  await p.phanTich();
  const m = tim(store.data.baoCao.dc.muc, '2.3');
  const kq = store.data.baoCao.ketQua[m.id];
  assert.ok(kq.trichDoan.length >= 1);
  p.chonTrich(m.id, kq.trichDoan[0].n, false);
  const m14 = tim(store.data.baoCao.dc.muc, '1.4');
  p.capNhatMuc(m14.id, { bat: true, tuKhoaThem: ['FDI'] });
  await p.phanTich();
  const kq2 = store.data.baoCao.ketQua[m.id];
  assert.strictEqual(kq2.trichDoan.find(t => t.text === kq.trichDoan[0].text).chon, false);
  assert.strictEqual(tim(store.data.baoCao.dc.muc, '1.4').bat, true);
  assert.ok(m14.id in store.data.baoCao.ketQua);
});

test('nạp biểu mẫu Excel thành mục bảng số liệu', async () => {
  const { p, store } = await phien();
  const m = tim(store.data.baoCao.dc.muc, '2.3');
  await p.napBieuMau(await taoXlsx({ sheets: { 'Biểu GPMB': [['Chỉ tiêu', 'Số dự án', 'Diện tích'], ['Năm 2026', '', '']] } }), 'bieu.xlsx', m.id);
  const con = tim(store.data.baoCao.dc.muc, '2.3').con;
  assert.strictEqual(con.length, 1);
  assert.strictEqual(con[0].dang, 'bangSoLieu');
  assert.deepStrictEqual(con[0].bang[0], ['Chỉ tiêu', 'Số dự án', 'Diện tích']);
});

test('xuất ra hai tệp Word và một tệp Markdown', async () => {
  const { p } = await phien();
  await p.phanTich();
  const khung = fs.readFileSync(path.join(__dirname, '..', 'assets', 'khung-bao-cao.docx'));
  const dir = tmp();
  const r = await p.xuat({ khungBuf: khung, thuMuc: dir, kinhGui: 'Sở Tài chính' });
  for (const f of [r.baoCao, r.duLieuTho, r.duLieuThoMd]) assert.ok(fs.existsSync(f), f);
  const { blocks } = await docBlocks(fs.readFileSync(r.baoCao));
  assert.ok(blocks.some(b => b.text === 'Kính gửi: Sở Tài chính'));
  assert.ok(blocks.some(b => /12,5 ha/.test(b.text || '')));
});

test('chủ đề gõ tay', async () => {
  const store = { data: {}, save() {} };
  const p = new PhienBaoCao({ store, kho: khoMau() });
  p.napChuDe('Giải phóng mặt bằng năm 2026', '1410/TTr-SNNMT');
  await p.phanTich();
  const m = store.data.baoCao.dc.muc[0];
  assert.strictEqual(store.data.baoCao.ketQua[m.id].vanBan[0].id, 'di:3');
});

test('phân tích: chọn văn bản cần tải, gọi hàm tải nội dung trước khi trích đoạn', async () => {
  const store = { data: {}, save() {} };
  const kho = khoMau();
  kho.upsert({ id: 'den:7', chieu: 'den', soKyHieu: '7/CV-X', ngayBanHanh: '01/06/2026', coQuan: 'UBND xã', loai: '', trichYeu: 'Về bồi thường, giải phóng mặt bằng dự án đường', taiKhoan: ['a'], doMat: false, tep: [], trang: [], chuaChiTiet: true, nguon: { ma_van_ban_den_kc: 7 }, capNhat: '' });
  const p = new PhienBaoCao({ store, kho });
  p.napChuDe('Bồi thường, giải phóng mặt bằng năm 2026', '');
  let goi = null;
  await p.phanTich({ layNoiDung: async ids => {
    goi = ids;
    kho.upsert({ ...kho.get('den:7'), chuaChiTiet: false, trang: [{ tep: 0, so: 1, text: 'Đã bồi thường, giải phóng mặt bằng 30 ha cho dự án đường.' }], tep: [{ name: 'a.pdf', path: 'p', method: 'pdf-text' }] });
    return { ok: true, daTai: ids.length };
  } });
  assert.deepStrictEqual(goi, ['den:7']);
  const m = store.data.baoCao.dc.muc[0];
  assert.ok(store.data.baoCao.ketQua[m.id].trichDoan.some(t => /30 ha/.test(t.text)));
  assert.strictEqual(store.data.baoCao.lanTai.daTai, 1);
});
