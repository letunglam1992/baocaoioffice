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
  let n = 0;
  const { r } = await chay({ nenDung: () => ++n > 2 });
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
