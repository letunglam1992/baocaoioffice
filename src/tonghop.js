'use strict';
/**
 * Tổng hợp không dùng AI: với mỗi mục đề cương, tìm văn bản trong kho, chọn đoạn liên quan (ưu tiên đoạn có số liệu),
 * kèm nguồn (số ký hiệu, ngày, cơ quan, trang). Không cộng gộp, không suy diễn số liệu.
 */
const { tuKhoa, boDau, chuanHoa } = require('./vntext');
const { parseNgay } = require('./kho');

const RE_SO_LIEU = /\d[\d.,]*\s*(dự án|tỷ|triệu|đồng|ha|%|hộ|văn bản|km|m2|m²|lượt|cuộc|trường hợp|công trình|xã|người|lao động|doanh nghiệp|hồ sơ)/i;
const kd = s => boDau(String(s || '')).toLowerCase();

function tuKhoaMuc(muc) {
  const kw = tuKhoa([muc.tieuDe, ...(muc.moTa || [])].join('. '));
  for (const t of muc.tuKhoaThem || []) for (const k of tuKhoa(t)) if (!kw.includes(k)) kw.push(k);
  return kw;
}

function truyVanMuc(muc) {
  return tuKhoaMuc(muc).filter(k => !k.includes(' ')).join(' ');
}

/** Cắt chữ thành đoạn ≤ maxKyTu, theo đoạn văn rồi theo câu. */
function catDoan(text, maxKyTu) {
  const out = [];
  for (const p of String(text).split(/\n\s*\n|\f/).map(chuanHoa).filter(Boolean)) {
    if (p.length <= maxKyTu) { out.push(p); continue; }
    const cau = p.split(/(?<=[.;!?])\s+/);
    let cur = '';
    for (const c of cau) {
      if (c.length > maxKyTu) { if (cur) out.push(cur); out.push(c.slice(0, maxKyTu - 1) + '…'); cur = ''; continue; }
      if ((cur + ' ' + c).trim().length > maxKyTu) { out.push(cur); cur = c; } else cur = (cur + ' ' + c).trim();
    }
    if (cur) out.push(cur);
  }
  return out;
}

function diemDoan(doanKd, kw) {
  let d = 0;
  for (const k of kw) if (doanKd.includes(k)) d += k.includes(' ') ? 2 : 1;
  return d;
}

function tongHopMuc(muc, dc, kho, { tuNgay, denNgay, K = 8, M = 6, maxKyTu = 600 } = {}) {
  const kw = tuKhoaMuc(muc);
  const q = truyVanMuc(muc);
  const goc = (dc.vanBanGoc || []).map(kd);
  const dsVb = new Map();
  for (const so of muc.ghim || []) for (const v of kho.timTheoSo(so)) dsVb.set(v.id, { vb: v, score: Infinity });
  if (q) {
    for (const r of kho.tim(q, { tuNgay, denNgay, limit: K * 4 })) {
      if (dsVb.has(r.vb.id)) continue;
      const toan = kd(r.vb.trichYeu + ' ' + r.vb.trang.map(t => t.text).join(' '));
      let s = r.score;
      if (goc.some(g => toan.includes(g))) s *= 1.5;
      if (r.vb.chieu === 'di') s *= 1.2;
      dsVb.set(r.vb.id, { vb: r.vb, score: s });
    }
  }
  const vanBan = [...dsVb.values()].sort((a, b) => b.score - a.score).slice(0, K);
  const ung = [];
  const daThay = new Set();
  vanBan.forEach(({ vb, score }, hang) => {
    for (const t of vb.trang) {
      for (const doan of catDoan(t.text, maxKyTu)) {
        const dkd = kd(doan);
        const diem = diemDoan(dkd, kw);
        if (diem < 2 && score !== Infinity) continue;
        if (diem < 1) continue;
        const khoa = dkd.slice(0, 80);
        if (daThay.has(khoa)) continue; daThay.add(khoa);
        ung.push({ vbId: vb.id, soKyHieu: vb.soKyHieu, ngay: vb.ngayBanHanh, coQuan: vb.coQuan, trang: t.so, text: doan, coSoLieu: RE_SO_LIEU.test(doan), chon: true, diem, hang });
      }
    }
  });
  ung.sort((a, b) => (b.diem - a.diem) || (b.coSoLieu - a.coSoLieu) || (a.hang - b.hang));
  const trichDoan = ung.slice(0, M).map(({ diem, hang, ...t }, i) => ({ n: i + 1, ...t }));
  return { mucId: muc.id, truyVan: q, vanBan: vanBan.map(({ vb, score }) => ({ id: vb.id, soKyHieu: vb.soKyHieu, score })), trichDoan };
}

function tongHop(dc, kho, opts = {}) {
  const out = {};
  const di = ds => ds.forEach(m => {
    if (!m.bat) return;
    if (!m.con.length || m.moTa.length || m.ghim.length) out[m.id] = tongHopMuc(m, dc, kho, opts);
    di(m.con);
  });
  di(dc.muc);
  return out;
}

function danhMucVanBan(dc, kho, { tuNgay, denNgay, coQuan } = {}) {
  const goc = (dc.vanBanGoc || []).map(kd);
  if (!goc.length) return [];
  const a = parseNgay(tuNgay), b = parseNgay(denNgay);
  const out = [];
  const cacNam = new Set(kho.cacNam(tuNgay, denNgay));
  for (const [id, meta] of kho.meta) {
    if (meta.doMat || !cacNam.has(kho.namCua.get(id))) continue; // chỉ nạp chữ của các năm trong kỳ báo cáo
    const v = kho.get(id);
    if (v.doMat || goc.includes(kd(v.soKyHieu))) continue;
    const n = parseNgay(v.ngayBanHanh);
    if (!n || (a && n < a) || (b && n > b)) continue;
    if (coQuan && coQuan.length && !coQuan.some(c => kd(v.coQuan).includes(kd(c)))) continue;
    const xet = kd(v.trichYeu + ' ' + v.trang.slice(0, 2).map(t => t.text).join(' '));
    if (!goc.some(g => xet.includes(g))) continue;
    out.push({ vbId: v.id, soKyHieu: v.soKyHieu, ngay: v.ngayBanHanh, coQuan: v.coQuan, trichYeu: v.trichYeu, n });
  }
  return out.sort((x, y) => x.n - y.n).map(({ n, ...r }) => r);
}

/** Các mục dùng để chọn văn bản: giống tongHop (mục đang bật; lá, hoặc có mô tả/ghim). */
function cacMucTinh(dc) {
  const out = [];
  const di = ds => ds.forEach(m => { if (!m.bat) return; if (!m.con.length || m.moTa.length || m.ghim.length) out.push(m); di(m.con); });
  di(dc.muc);
  return out;
}

/**
 * 0.2.0 — chọn văn bản cần tải nội dung cho báo cáo, theo TRÍCH YẾU (kho chỉ có danh sách):
 * văn bản ghim (số ký hiệu) → văn bản có trích yếu viện dẫn văn bản gốc → mỗi mục tối đa `moiMuc` văn bản khớp
 * trích yếu (≥ 1 cụm hai âm tiết hoặc ≥ 2 từ khóa), trong kỳ báo cáo. Trả về id văn bản CHƯA có nội dung, tối đa `toiDa`.
 */
function chonVanBanCanTai(dc, kho, { tuNgay, denNgay, moiMuc = 15, toiDa = 150 } = {}) {
  const a = parseNgay(tuNgay), b = parseNgay(denNgay);
  const trongKy = v => { const n = parseNgay(v.ngayBanHanh); return !n || ((!a || n >= a) && (!b || n <= b)); };
  const chon = [];
  const them = v => { if (v && !chon.includes(v.id)) chon.push(v.id); };
  const mucs = cacMucTinh(dc);
  for (const m of mucs) for (const so of m.ghim || []) kho.timTheoSo(so).forEach(them);
  const goc = (dc.vanBanGoc || []).map(kd);
  if (goc.length) {
    for (const [id, v] of kho.meta) {
      if (goc.includes(kd(v.soKyHieu)) || !trongKy(v)) continue;
      if (goc.some(g => kd(v.trichYeu).includes(g))) them(v);
    }
  }
  for (const m of mucs) {
    const kw = tuKhoaMuc(m);
    const q = truyVanMuc(m);
    if (!q) continue;
    const kq = kho.tim(q, { tuNgay, denNgay, limit: moiMuc * 6 })
      .filter(r => diemDoan(kd(r.vb.trichYeu), kw) >= 2)
      .slice(0, moiMuc);
    kq.forEach(r => them(r.vb));
  }
  const canNoiDung = id => { const v = kho.meta.get(id); return v && !v.doMat && (v.chuaChiTiet || (v.tep || []).some(t => t.loiTai)); };
  return chon.filter(canNoiDung).slice(0, toiDa);
}

module.exports = { truyVanMuc, tongHopMuc, tongHop, danhMucVanBan, catDoan, tuKhoaMuc, chonVanBanCanTai };
