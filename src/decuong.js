'use strict';
/**
 * Dựng cây đề cương từ các khối của tệp Word (xem docread.docBlocks), hoặc từ chủ đề gõ tay.
 * Cấp: I./II. (1) → 1. (2) → 1.1. (3) → a) (4) → gạch đầu dòng (5, vào mô tả của mục đang mở).
 * Câu «Đề nghị …» là chỉ dẫn cho đơn vị báo cáo, không phải nội dung; mục chỉ đề nghị đơn vị khác → mặc định tắt.
 */
const { chuanHoa, boDau, timSoKyHieu } = require('./vntext');

const DON_VI_MINH = ['Sở Nông nghiệp và Môi trường', 'Nông nghiệp và Môi trường', 'các sở, ngành', 'các sở, ban, ngành', 'các cơ quan, đơn vị', 'các đơn vị'];

const RE_CAP = [
  [1, /^([IVXLC]+)\s*[.\-–]\s*(?=\S)/],
  [3, /^(\d+\.\d+)\.?\s*(?=\D)/],
  [2, /^(\d+)[.)]\s*(?=\D)/],
  [4, /^([a-zđ])\)\s*/],
  [5, /^[-–+•]\s*/]
];
const RE_PHU_LUC = /^ph[ụu]c? ?l[ụu]c\b/i;
const laDeNghi = s => /^\(?\s*Đề nghị(?=\s|$)/.test(s);

function capCua(text) {
  for (const [cap, re] of RE_CAP) {
    const m = text.match(re);
    if (m) return { cap, so: cap === 5 ? '-' : m[1], rest: text.slice(m[0].length).trim() };
  }
  return null;
}

/** Tách câu: sau dấu chấm/chấm phẩy kết câu, trước chữ hoa hoặc «(». */
function tachCau(s) {
  return s.split(/(?<=[.])\s+(?=[(\p{Lu}])/u).map(x => x.trim()).filter(Boolean);
}

function donViTu(chiDan) {
  const m = chiDan.match(/Đề nghị\s+([\s\S]*?)(?:\s+(?:báo cáo|rà soát|đánh giá|đề xuất|thực hiện|tập trung|tham mưu)(?=[\s,.;]|$)|$)/);
  return m ? m[1].replace(/[()]/g, '').trim() : '';
}

function khopDonVi(cum, donViMinh) {
  const c = boDau(cum).toLowerCase();
  return donViMinh.some(d => c.includes(boDau(d).toLowerCase()));
}

let dem = 0;
function taoMuc(so, cap, tieuDe) {
  return { id: 'm' + (++dem), so, cap, tieuDe, moTa: [], chiDan: [], donViDeNghi: [], dang: 'van', bat: true, tuKhoaThem: [], ghim: [], con: [] };
}

function themNoiDung(muc, text) {
  for (const cau of tachCau(text)) {
    if (laDeNghi(cau)) { muc.chiDan.push(cau); const dv = donViTu(cau); if (dv) muc.donViDeNghi.push(dv); }
    else muc.moTa.push(cau);
  }
}

function dangBang(rows) {
  const dau = boDau((rows[0] || []).join(' | ')).toLowerCase();
  return /so, ky hieu|so ky hieu/.test(dau) && /trich yeu/.test(dau) ? 'danhMucVB' : 'bangSoLieu';
}

function parseDeCuong(blocks, { donViMinh = DON_VI_MINH } = {}) {
  dem = 0;
  const dc = { tieuDe: '', trichYeu: '', vanBanGoc: [], nam: null, muc: [], phuLuc: [] };
  const stack = [];
  let dau = [];          // các đoạn trước mục cấp 1 đầu tiên
  let phuLuc = null;     // mục phụ lục đang mở
  let choTenPhuLuc = false;
  for (const b of blocks) {
    if (b.type === 'table') {
      const rows = b.rows.map(r => r.map(chuanHoa));
      const dich = phuLuc || stack[stack.length - 1];
      if (dich) { dich.bang = rows; dich.dang = dangBang(rows); choTenPhuLuc = false; }
      continue;
    }
    const text = chuanHoa(b.text);
    if (!text) continue;
    if (RE_PHU_LUC.test(text)) {
      phuLuc = taoMuc(text.replace(/^ph[ụu]c? ?l[ụu]c/i, 'Phụ lục'), 1, '');
      dc.phuLuc.push(phuLuc);
      choTenPhuLuc = true;
      continue;
    }
    if (phuLuc) {
      if (choTenPhuLuc) { phuLuc.tieuDe = text; choTenPhuLuc = false; } else phuLuc.moTa.push(text);
      continue;
    }
    const c = capCua(text);
    if (!c && !stack.length) { dau.push(text); continue; }
    if (c && c.cap === 5) {
      const m = stack[stack.length - 1];
      if (m) themNoiDung(m, c.rest); else dau.push(text);
      continue;
    }
    if (!c) { themNoiDung(stack[stack.length - 1], text); continue; }
    // mục mới: «Tiêu đề: mô tả/Đề nghị…» → tách ở dấu «:» đầu tiên
    let tieuDe = c.rest, phanSau = '';
    const i = c.rest.indexOf(':');
    if (i > 0 && i < c.rest.length - 1) { tieuDe = c.rest.slice(0, i).trim(); phanSau = c.rest.slice(i + 1).trim(); }
    else tieuDe = c.rest.replace(/:\s*$/, '').trim();
    // «Tiêu đề (…). Đề nghị …» không có dấu «:» → câu đầu là tiêu đề
    if (!phanSau) {
      const cau = tachCau(tieuDe);
      if (cau.length > 1) { tieuDe = cau[0].replace(/\.$/, ''); phanSau = cau.slice(1).join(' '); }
    }
    const m = taoMuc(c.so, c.cap, tieuDe);
    if (phanSau) themNoiDung(m, phanSau);
    while (stack.length && stack[stack.length - 1].cap >= c.cap) stack.pop();
    (stack.length ? stack[stack.length - 1].con : dc.muc).push(m);
    stack.push(m);
  }
  const datBat = (ds) => ds.forEach(m => {
    m.bat = m.chiDan.length === 0 || m.donViDeNghi.some(d => khopDonVi(d, donViMinh));
    datBat(m.con);
  });
  datBat(dc.muc);
  dc.tieuDe = dau[0] || '';
  dc.trichYeu = dau.slice(1).join(' ');
  dc.vanBanGoc = timSoKyHieu(dc.trichYeu);
  const nam = dc.trichYeu.match(/năm\s+(\d{4})\b/i);
  dc.nam = nam ? +nam[1] : null;
  return dc;
}

function parseChuDe(text, soKyHieu = '') {
  dem = 0;
  const ghim = String(soKyHieu || '').split(/[\n,;]+/).map(chuanHoa).filter(Boolean);
  const muc = String(text || '').split(/\r?\n/).map(chuanHoa).filter(Boolean).map((t, i) => {
    const m = taoMuc(String(i + 1), 1, t);
    m.ghim = ghim.slice();
    return m;
  });
  const nam = String(text).match(/năm\s+(\d{4})\b/i);
  return { tieuDe: '', trichYeu: muc.map(m => m.tieuDe).join('; '), vanBanGoc: ghim, nam: nam ? +nam[1] : null, muc, phuLuc: [] };
}

module.exports = { parseDeCuong, parseChuDe, DON_VI_MINH, capCua };
