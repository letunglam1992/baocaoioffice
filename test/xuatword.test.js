'use strict';
const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const { docKhung, xuatBaoCao, xuatDuLieuTho, xuatDuLieuThoDocx } = require('../src/xuatword');
const { docBlocks } = require('../src/docread');
const { parseDeCuong } = require('../src/decuong');
const { taoDocx } = require('./mau/taodoc');
const { blocksDeCuong } = require('./mau/decuong-gia');

const P = (text, o = {}) => ({ type: 'p', text, ...o });
async function khungGia() {
  return taoDocx({ blocks: [
    { type: 'table', borders: false, rows: [['UBND TỈNH SƠN LA\nSỞ NÔNG NGHIỆP VÀ MÔI TRƯỜNG\nSố: 123/BC-SNNMT', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\nSơn La, ngày 01 tháng 12 năm 2026']] },
    P('BÁO CÁO', { bold: true, center: true }),
    P('Trích yếu cũ của mẫu', { bold: true, center: true }),
    P('Kính gửi: Cơ quan cũ', { center: true }),
    P('Mẫu đoạn mở đầu.'),
    P('I. MẪU MỤC LA MÃ', { bold: true }),
    P('1. Mẫu mục số', { bold: true }),
    P('a) Mẫu mục chữ', { italic: true }),
    P('- Mẫu gạch đầu dòng'),
    P('Mẫu nội dung thân.'),
    P('Sở Nông nghiệp và Môi trường trân trọng báo cáo./.'),
    { type: 'table', borders: false, rows: [['Nơi nhận:\n- Như trên;\n- Lưu: VT, KHTC.', 'GIÁM ĐỐC\n\n\n']] }
  ] });
}
const tim = (ds, so) => { for (const m of ds) { if (m.so === so) return m; const c = tim(m.con, so); if (c) return c; } return null; };
const td = (n, text, o = {}) => ({ n, vbId: 'di:3', soKyHieu: '1410/TTr-SNNMT', ngay: '20/11/2026', coQuan: 'Sở', trang: 1, text, coSoLieu: true, chon: true, ...o });

async function xuat(sua = () => {}) {
  const dc = parseDeCuong(blocksDeCuong());
  const ketQua = {};
  const m23 = tim(dc.muc, '2.3');
  ketQua[m23.id] = { mucId: m23.id, trichDoan: [td(1, 'Đã bàn giao 12,5 ha cho 3 dự án.'), td(2, 'A & B <c> "d"'), td(3, 'Đoạn bỏ chọn', { chon: false })] };
  const m11 = tim(dc.muc, '1.1');
  ketQua[m11.id] = { mucId: m11.id, trichDoan: [] };
  sua(dc, ketQua);
  const danhMuc = [
    { soKyHieu: '88/CV-SNNMT', ngay: '05/06/2026', coQuan: 'Sở NNMT', trichYeu: 'Triển khai' },
    { soKyHieu: '1410/TTr-SNNMT', ngay: '20/11/2026', coQuan: 'Sở NNMT', trichYeu: 'Tờ trình' },
    { soKyHieu: '99/BC-SNNMT', ngay: '21/11/2026', coQuan: 'Sở NNMT', trichYeu: 'Báo cáo' }
  ];
  const buf = await xuatBaoCao(await docKhung(await khungGia()), { dc, ketQua, danhMuc, kinhGui: 'Sở Tài chính', trichYeu: 'Kết quả thực hiện năm 2026', moDau: 'Thực hiện Công văn số 1/STC, Sở báo cáo như sau:' });
  const { blocks } = await docBlocks(buf);
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string');
  return { blocks, xml, texts: blocks.filter(b => b.type === 'p').map(b => b.text) };
}

test('giữ khung, thay trích yếu, Kính gửi, đoạn mở; bỏ thân mẫu', async () => {
  const { texts } = await xuat();
  assert.ok(texts.includes('BÁO CÁO'));
  assert.ok(texts.includes('Kết quả thực hiện năm 2026'));
  assert.ok(texts.includes('Kính gửi: Sở Tài chính'));
  assert.ok(texts.includes('Thực hiện Công văn số 1/STC, Sở báo cáo như sau:'));
  assert.ok(texts.some(t => /trân trọng báo cáo\.\/\./.test(t)));
  assert.ok(!texts.some(t => /^Mẫu|Trích yếu cũ|Cơ quan cũ/.test(t)));
});

test('số và ngày để trống trong khối đầu', async () => {
  const { blocks } = await xuat();
  const dau = blocks[0].rows.flat().join('\n');
  const so = dau.split('\n').find(l => /^Số:/.test(l));
  assert.ok(so && !/\d/.test(so), so);
  assert.match(dau, /Sơn La, ngày\s+tháng\s+năm 2026/);
});

test('đánh số lại liên tục khi có mục tắt; mục cấp 3 thành a), b)', async () => {
  const { texts } = await xuat(dc => { dc.muc[2].bat = false; });
  const la = texts.filter(t => /^[IVX]+\. /.test(t)).map(t => t.split('.')[0]);
  assert.deepStrictEqual(la, ['I', 'II', 'III', 'IV']);
  assert.ok(texts.includes('a) Kết quả chung'));
  assert.ok(texts.some(t => /^b\) Kết quả thu hút|^b\) Kết quả theo ngành/.test(t)));
  assert.ok(!texts.some(t => /Kết quả thu hút FDI/.test(t)), 'mục tắt không xuất');
});

test('trích đoạn có nguồn, ký tự đặc biệt giữ nguyên, bỏ đoạn không chọn', async () => {
  const { texts } = await xuat();
  assert.ok(texts.includes('- Đã bàn giao 12,5 ha cho 3 dự án. (1410/TTr-SNNMT ngày 20/11/2026, tr. 1)'));
  assert.ok(texts.includes('- A & B <c> "d" (1410/TTr-SNNMT ngày 20/11/2026, tr. 1)'));
  assert.ok(!texts.some(t => /Đoạn bỏ chọn/.test(t)));
});

test('mục không có trích đoạn tô vàng', async () => {
  const { xml, texts } = await xuat();
  const i = texts.indexOf('a) Kết quả chung');
  assert.match(texts[i + 1], /Chưa tìm thấy văn bản liên quan/);
  assert.match(xml, /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">\[Chưa tìm thấy/);
});

test('phụ lục 01 có bảng 6 cột, dòng (1)…(6) và 3 dòng dữ liệu', async () => {
  const { blocks, texts } = await xuat();
  assert.ok(texts.includes('Phụ lục 01'));
  assert.ok(texts.some(t => /^\(Kèm theo Báo cáo số\s+\/BC-SNNMT/.test(t)));
  const bang = blocks.filter(b => b.type === 'table').pop();
  assert.strictEqual(bang.rows[0].length, 6);
  assert.strictEqual(bang.rows.length, 5);
  assert.deepStrictEqual(bang.rows[2].slice(0, 3), ['1', '88/CV-SNNMT', '05/06/2026']);
});

test('văn AI: số lạ tô vàng', async () => {
  const { xml, texts } = await xuat((dc, kq) => { kq.vanBanAi = true; });
  assert.ok(texts.length);
  const dc = parseDeCuong(blocksDeCuong());
  const m = tim(dc.muc, '2.3');
  const buf = await xuatBaoCao(await docKhung(await khungGia()), { dc, ketQua: {}, vanBanAi: { [m.id]: 'Đã bàn giao 12,5 ha [1] và [[?99]] tỷ đồng.' } });
  const x2 = await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string');
  assert.match(x2, /<w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">99<\/w:t>/);
  assert.ok(xml);
});

test('dữ liệu thô Markdown đủ yêu cầu và trích đoạn có nguồn', async () => {
  const dc = parseDeCuong(blocksDeCuong());
  const m = tim(dc.muc, '2.3');
  const { md } = xuatDuLieuTho({ dc, ketQua: { [m.id]: { trichDoan: [td(1, 'Đã bàn giao 12,5 ha.')] } }, danhMuc: [] });
  assert.match(md, /Bồi thường, hỗ trợ, tái định cư, giải phóng mặt bằng/);
  assert.match(md, /Đề nghị Sở Nông nghiệp và Môi trường/);
  assert.match(md, /\[1\] Đã bàn giao 12,5 ha\./);
  assert.match(md, /Nguồn: 1410\/TTr-SNNMT, ngày 20\/11\/2026/);
  assert.match(md, /Kết quả thu hút FDI \(đang tắt\)/);
  const { blocks } = await docBlocks(await xuatDuLieuThoDocx(md));
  assert.ok(blocks.some(b => /\[1\] Đã bàn giao/.test(b.text)));
});

test('thay chữ giữ hình vẽ (đường kẻ) và chuẩn hóa tên phông ghép', () => {
  const { datChu } = require('../src/xuatword');
  const p = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:anchor/></w:drawing></w:r><w:r><w:rPr><w:rFonts w:ascii="Times New Roman Bold;Times New Roman" w:hAnsi="Times New Roman Bold;Times New Roman"/><w:b/></w:rPr><w:t>Cũ</w:t></w:r></w:p>';
  const x = datChu(p, 'Mới');
  assert.match(x, /<w:drawing><wp:anchor\/><\/w:drawing>/);
  assert.match(x, /w:ascii="Times New Roman"/);
  assert.doesNotMatch(x, /;/);
  assert.match(x, />Mới</);
});

test('chỉ ghi «Có Phụ lục … kèm theo» khi phụ lục đó có trong đề cương', async () => {
  const { texts } = await xuat();
  assert.ok(texts.includes('(Có Phụ lục 01 kèm theo)'));
  assert.ok(!texts.includes('(Có Phụ lục 02 kèm theo)'));
});

test('trích yếu nhiều dòng: dời đường kẻ dưới xuống theo số dòng', () => {
  const { datChu } = require('../src/xuatword');
  const p = '<w:p><w:r><w:drawing><wp:anchor><wp:positionV relativeFrom="paragraph"><wp:posOffset>419100</wp:posOffset></wp:positionV></wp:anchor></w:drawing></w:r><w:r><w:t>Cũ</w:t></w:r></w:p>';
  const ngan = datChu(p, 'Ngắn', { doiNeo: true });
  const dai = datChu(p, 'x'.repeat(220), { doiNeo: true });
  const off = x => +x.match(/<wp:posOffset>(\d+)/)[1];
  assert.ok(off(dai) > off(ngan));
  assert.ok(off(dai) >= 3 * 200000);
});
