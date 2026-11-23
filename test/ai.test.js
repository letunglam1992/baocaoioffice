'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { locGui, taoTinNhan, kiemSo, tinhChinhMuc, HE_THONG } = require('../src/ai');

const td = (n, text, o = {}) => ({ n, vbId: o.vbId || 'di:1', soKyHieu: '1/BC-X', ngay: '01/01/2026', coQuan: o.coQuan || 'Sở NNMT', trang: 1, text, coSoLieu: true, chon: o.chon !== false });
const khoGia = { get: id => ({ id, doMat: id === 'den:mat' }) };
const muc = { id: 'm1', so: '2.8', tieuDe: 'Bồi thường, giải phóng mặt bằng', moTa: ['Số dự án, diện tích đã bàn giao'], chiDan: [] };
const dc = { trichYeu: 'Báo cáo kết quả năm 2026' };
const ketQua = { trichDoan: [td(1, 'Đã bàn giao 12,5 ha cho 3 dự án.'), td(2, 'Nội dung mật 77 ha', { vbId: 'den:mat' }), td(3, 'Ý kiến Công an tỉnh 5 vụ', { coQuan: 'Công an tỉnh' }), td(4, 'Bỏ chọn', { chon: false })] };

test('lọc: bỏ văn bản mật, đoạn bỏ chọn, cơ quan/từ khóa không gửi', () => {
  const ds = locGui(ketQua, khoGia, ['cong an tinh']);
  assert.deepStrictEqual(ds.map(t => t.n), [1]);
});

test('tin nhắn: hệ thống cố định, trích đoạn đánh số lại từ 1', () => {
  const m = taoTinNhan(muc, dc, [td(5, 'Đã bàn giao 12,5 ha.')]);
  assert.strictEqual(m[0].role, 'system');
  assert.strictEqual(m[0].content, HE_THONG);
  assert.match(m[1].content, /\[1\] Đã bàn giao 12,5 ha\./);
  assert.match(m[1].content, /Bồi thường, giải phóng mặt bằng/);
});

test('kiểm số: số không có trong trích đoạn bị đánh dấu', () => {
  const r = kiemSo('Đã bàn giao 12,5 ha [1] cho 3 dự án [1] và 99 tỷ đồng, tỷ lệ 1.250 m2', [td(1, 'Đã bàn giao 12,5 ha cho 3 dự án, 1250 m2')]);
  assert.deepStrictEqual(r.soLa, ['99']);
  assert.match(r.van, /\[\[\?99\]\]/);
  assert.doesNotMatch(r.van, /\[\[\?1\]\]/);
});

test('gọi Worker: POST {messages}, nhận {text, model}', async () => {
  let goi = null;
  const fetchFn = async (url, init) => { goi = { url, init }; return { ok: true, status: 200, json: async () => ({ text: 'Đã bàn giao 12,5 ha [1] và 99 tỷ [1].', model: 'm' }) }; };
  const r = await tinhChinhMuc(muc, dc, ketQua, { diaChi: 'https://w.example', fetchFn, kho: khoGia, khongGui: [] });
  assert.strictEqual(goi.init.method, 'POST');
  const body = JSON.parse(goi.init.body);
  assert.ok(Array.isArray(body.messages));
  assert.doesNotMatch(goi.init.body, /Nội dung mật/);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.model, 'm');
  assert.deepStrictEqual(r.soLa, ['99']);
  assert.match(r.van, /\[\[\?99\]\]/);
});

test('Worker lỗi, HTTP 500, quá thời gian → ok:false', async () => {
  const a = await tinhChinhMuc(muc, dc, ketQua, { diaChi: 'x', fetchFn: async () => { throw new Error('mất mạng'); }, kho: khoGia });
  assert.strictEqual(a.ok, false); assert.match(a.loi, /mất mạng/);
  const b = await tinhChinhMuc(muc, dc, ketQua, { diaChi: 'x', fetchFn: async () => ({ ok: false, status: 500, json: async () => ({}) }), kho: khoGia });
  assert.strictEqual(b.ok, false); assert.match(b.loi, /500/);
  const c = await tinhChinhMuc(muc, dc, ketQua, { diaChi: 'x', timeoutMs: 20, fetchFn: (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted')))), kho: khoGia });
  assert.strictEqual(c.ok, false);
});

test('không có trích đoạn thì không gọi Worker', async () => {
  let goi = 0;
  const r = await tinhChinhMuc(muc, dc, { trichDoan: [] }, { diaChi: 'x', fetchFn: async () => { goi++; }, kho: khoGia });
  assert.strictEqual(goi, 0);
  assert.deepStrictEqual(r, { ok: false, loi: 'KHONG_CO_TRICH_DOAN' });
});
