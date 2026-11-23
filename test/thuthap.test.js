'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { thuThap } = require('../src/thuthap');
const { Kho } = require('../src/kho');
const { taoFakeIo } = require('./fake-ioffice');
const { taoPdfChu } = require('./mau/taodoc');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tt-'));
const gh = { maxCalls: 300, maxFiles: 100 };
async function chay(o = {}) {
  const io = o.io || await taoFakeIo(o.fake);
  const kho = o.kho || new Kho(tmp());
  const tamDir = o.tamDir || tmp();
  const r = await thuThap({ io, kho, taiKhoan: 'a', tuNgay: '01/01/2026', denNgay: '23/11/2026', gioiHan: o.gioiHan || gh, tamDir, thuMucQuetVanBan: o.thuMucQuetVanBan, nenDung: o.nenDung, giuTep: o.giuTep, log: () => {} });
  return { r, io, kho, tamDir };
}

test('lượt đầy đủ: lưu văn bản, mật chỉ metadata, tệp tạm bị xóa', async () => {
  const { r, io, kho, tamDir } = await chay();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.moi, 6);
  const mat = kho.get('den:9');
  assert.strictEqual(mat.doMat, true);
  assert.ok(!io.taiVe.includes('f/9__mat.pdf'));
  const v2 = kho.get('den:2');
  const theoTen = n => v2.tep.find(t => t.name === n);
  assert.strictEqual(theoTen('hoso.zip').method, 'none');
  assert.strictEqual(theoTen('hong.docx').method, 'none');
  assert.ok(theoTen('hong.docx').error);
  assert.strictEqual(theoTen('phuluc.docx').method, 'docx');
  assert.ok(v2.trang.some(t => /7 dự án/.test(t.text)));
  assert.strictEqual(kho.get('den:5').tep[0].canOcr, true);
  assert.strictEqual(kho.get('di:6').chieu, 'di');
  assert.match(kho.get('di:6').trang[0].text, /12,5 ha/);
  assert.deepStrictEqual(fs.readdirSync(tamDir), []);
  assert.strictEqual(io.taiVe.filter(p => p === 'f/1__131-KH-UBND.pdf').length, 1); // trùng luồng chỉ tải một lần
});

test('chạm giới hạn tệp thì dừng và báo hết giới hạn', async () => {
  const { r } = await chay({ gioiHan: { maxCalls: 300, maxFiles: 2 } });
  assert.strictEqual(r.hetGioiHan, true);
  assert.strictEqual(r.tep, 2);
  assert.strictEqual(r.ok, true);
});

test('lượt thứ hai không tải lại', async () => {
  const kho = new Kho(tmp());
  await chay({ kho });
  const { io, r } = await chay({ kho });
  assert.strictEqual(io.taiVe.length, 0);
  assert.strictEqual(r.moi, 0);
});

test('hết phiên giữa lượt: không ok, giữ văn bản đã lấy', async () => {
  const { r, kho } = await chay({ fake: { hetPhienSau: 5 } });
  assert.strictEqual(r.ok, false);
  assert.ok(r.loi.length >= 1);
  assert.ok(kho.thongKe().tong >= 1);
});

test('chưa đăng nhập', async () => {
  const { r } = await chay({ fake: { chuaDangNhap: true } });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.loi[0].msg, 'CHUA_DANG_NHAP');
});

test('dùng tệp quetvanban có sẵn, không tải, không xóa', async () => {
  const qvb = tmp();
  fs.mkdirSync(path.join(qvb, 'Kế hoạch'));
  const f = path.join(qvb, 'Kế hoạch', '131-KH-UBND_14052026.pdf');
  fs.writeFileSync(f, taoPdfChu(Array.from({ length: 6 }, () => 'Ban luu cua quetvanban ve thu hut dau tu')));
  const { io, kho } = await chay({ thuMucQuetVanBan: qvb });
  assert.ok(!io.taiVe.includes('f/1__131-KH-UBND.pdf'));
  assert.ok(fs.existsSync(f));
  assert.match(kho.get('den:1').trang[0].text, /quetvanban/);
});

test('dừng giữa lượt', async () => {
  const io = await taoFakeIo();
  let vb = 0;
  const goc = io.chiTietVanBanDi.bind(io), goc2 = io.chiTiet.bind(io);
  io.chiTietVanBanDi = async m => { vb++; return goc(m); };
  io.chiTiet = async (m, x) => { vb++; return goc2(m, x); };
  const { r } = await chay({ io, nenDung: () => vb >= 2 });
  assert.strictEqual(r.dung, true);
  assert.strictEqual(r.moi, 2);
});

test('giữ tệp gốc theo loại, có trần dung lượng', async () => {
  const kho = new Kho(tmp());
  await chay({ kho, giuTep: { loai: ['Báo cáo'], tranMB: 1 } });
  const giu = path.join(kho.dir, 'giu-tep');
  const ds = fs.readdirSync(giu);
  assert.ok(ds.some(n => /55-BC-UBND/.test(n)));
  assert.ok(!ds.some(n => /131-KH-UBND/.test(n)));
  fs.writeFileSync(path.join(giu, '000-cu.pdf'), Buffer.alloc(1100 * 1024));
  const old = Date.now() / 1000 - 3600; fs.utimesSync(path.join(giu, '000-cu.pdf'), old, old);
  const { kho: k2 } = await chay({ kho: new Kho(kho.dir), giuTep: { loai: ['Báo cáo'], tranMB: 1 } });
  // lượt mới không có tệp Báo cáo mới (đã có trong kho mới? không — kho mới rỗng nên tải lại và giữ lại) → trần buộc xóa tệp cũ nhất
  assert.ok(!fs.existsSync(path.join(giu, '000-cu.pdf')));
  assert.ok(k2);
});

test('độ mật: thiếu chi tiết hoặc thiếu trường độ mật thì coi là mật (an toàn)', async () => {
  const { laMatCT } = require('../src/thuthap');
  assert.strictEqual(laMatCT(null), true);
  assert.strictEqual(laMatCT({}), true);
  assert.strictEqual(laMatCT({ ten_cap_do_mat: 'Bình thường' }), false);
  assert.strictEqual(laMatCT({ ten_cap_do_mat: '' , ma_cap_do_mat: 1 }), false);
  assert.strictEqual(laMatCT({ ma_cap_do_mat: 1 }), false);
  assert.strictEqual(laMatCT({ ma_cap_do_mat: 2 }), true);
  assert.strictEqual(laMatCT({ ten_cap_do_mat: 'Bình thường', ma_cap_do_mat: 3 }), true);
  assert.strictEqual(laMatCT({ ten_cap_do_mat: 'Mật' }), true);
});

test('chi tiết rỗng: không tải tệp từ dòng danh sách', async () => {
  const io = await taoFakeIo();
  const goc = io.chiTiet.bind(io);
  io.chiTiet = async ma => (ma === 1 ? null : goc(ma));
  const { kho } = await chay({ io });
  assert.strictEqual(kho.get('den:1').doMat, true);
  assert.ok(!io.taiVe.includes('f/1__131-KH-UBND.pdf'));
});

test('đếm tệp tải lỗi', async () => {
  const io = await taoFakeIo();
  const goc = io.downloadFile.bind(io);
  io.downloadFile = async (p, n) => { if (p === 'f/7__88-CV-SNNMT.pdf') { io.taiVe.push(p); throw new Error('mạng chập chờn'); } return goc(p, n); };
  const { r } = await chay({ io });
  assert.strictEqual(r.loiTep, 1);
  assert.strictEqual(r.ok, true);
});

test('lỗi phiên rõ ràng; TIMEOUT phải kiểm tra lại phiên mới kết luận', () => {
  const { loiPhien } = require('../src/thuthap');
  assert.strictEqual(loiPhien(new Error('NOT_READY')), true);
  assert.strictEqual(loiPhien(new Error('TIMEOUT exec')), false);
  assert.strictEqual(loiPhien(new Error('404')), false);
});

// ---- 0.1.1: kẹt ở văn bản có tệp lớn / quá thời gian ----
async function ioLoiTep(loi, { conPhien = true } = {}) {
  const io = await taoFakeIo();
  const goc = io.downloadFile.bind(io);
  io.whoAmI = async () => (conPhien ? { ma_ctcb: 1 } : null);
  io.downloadFile = async (p, n) => { if (p === 'f/6__1410-TTr-SNNMT.pdf') { io.taiVe.push(p); throw new Error(loi); } return goc(p, n); };
  io.dangNhapLaiSau = () => {};
  return io;
}

test('tải một tệp quá thời gian nhưng phiên vẫn còn: đi tiếp văn bản khác', async () => {
  const io = await ioLoiTep('TIMEOUT exec');
  const { r, kho } = await chay({ io });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.moi, 6);
  assert.strictEqual(r.loiTep, 1);
  assert.strictEqual(kho.get('di:6').tep[0].loiTai, true);
});

test('quá thời gian và mất phiên: dừng tài khoản', async () => {
  const io = await ioLoiTep('TIMEOUT exec', { conPhien: false });
  const { r } = await chay({ io });
  assert.strictEqual(r.ok, false);
});

test('tệp quá lớn: bỏ qua, không thử lại', async () => {
  const io = await ioLoiTep('QUA_LON 95 MB');
  const kho = new Kho(tmp());
  const { r } = await chay({ io, kho });
  const t = kho.get('di:6').tep[0];
  assert.strictEqual(t.loiTai, undefined);
  assert.strictEqual(t.boQua, 'qua-lon');
  assert.strictEqual(r.loiTep, 0);
  io.taiVe.length = 0;
  await chay({ io, kho });
  assert.ok(!io.taiVe.includes('f/6__1410-TTr-SNNMT.pdf'));
});

test('tệp lỗi chỉ thử lại tối đa 3 lượt; văn bản mới được xử lý trước văn bản thử lại', async () => {
  const io = await ioLoiTep('mạng chập chờn');
  const kho = new Kho(tmp());
  for (let k = 0; k < 3; k++) await chay({ io, kho });
  assert.strictEqual(kho.get('di:6').tep[0].thu, 3);
  io.taiVe.length = 0;
  await chay({ io, kho });
  assert.strictEqual(io.taiVe.length, 0, 'sau 3 lần không tải lại');
});

test('thử lại chỉ tải tệp lỗi, giữ chữ của tệp đã đọc', async () => {
  const io = await taoFakeIo();
  const goc = io.downloadFile.bind(io);
  let hong = true;
  io.downloadFile = async (p, n) => { if (hong && p === 'f/2__phuluc.docx') { io.taiVe.push(p); throw new Error('mạng'); } return goc(p, n); };
  const kho = new Kho(tmp());
  await chay({ io, kho });
  hong = false; io.taiVe.length = 0;
  await chay({ io, kho });
  assert.deepStrictEqual(io.taiVe, ['f/2__phuluc.docx']);
  const v = kho.get('den:2');
  assert.ok(v.trang.some(t => /7 dự án/.test(t.text)));
  assert.ok(v.trang.some(t => /12,5 ha/.test(t.text)));
});

test('dừng được giữa các tệp của một văn bản', async () => {
  let n = 0;
  const io = await taoFakeIo();
  const goc = io.downloadFile.bind(io);
  io.downloadFile = async (p, nm) => { n++; return goc(p, nm); };
  const { r, kho } = await chay({ io, nenDung: () => n >= 1 });
  assert.strictEqual(r.dung, true);
  assert.strictEqual(n, 1);
  assert.ok(kho.thongKe().tong <= 1);
});

test('tệp lỗi do lỗi phần mềm 0.1.1 («r is not defined») được tải lại, không tính lần thử', async () => {
  const io = await taoFakeIo();
  const kho = new Kho(tmp());
  kho.upsert({ id: 'di:6', chieu: 'di', soKyHieu: '1410/TTr-SNNMT', ngayBanHanh: '20/11/2026', coQuan: 'Sở', loai: 'Tờ trình', trichYeu: 'x', taiKhoan: ['a'], doMat: false,
    tep: [{ name: '1410-TTr-SNNMT.pdf', path: 'f/6__1410-TTr-SNNMT.pdf', method: 'none', canOcr: false, ocrDone: false, loiTai: true, thu: 3, error: 'r is not defined' }], trang: [], capNhat: '' });
  await chay({ io, kho });
  assert.ok(io.taiVe.includes('f/6__1410-TTr-SNNMT.pdf'));
  const t = kho.get('di:6').tep[0];
  assert.strictEqual(t.loiTai, undefined);
  assert.match(kho.get('di:6').trang[0].text, /12,5 ha/);
});
