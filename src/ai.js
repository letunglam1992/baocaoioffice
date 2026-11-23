'use strict';
/**
 * Tinh chỉnh TÙY CHỌN (mặc định tắt) qua Cloudflare Worker dùng chung với dashboard theodoinhiemvu:
 * POST {messages:[{role, content}]} → {text, model}. Chỉ gửi trích đoạn đã chọn; không gửi văn bản mật
 * hay nguồn trong danh sách «không gửi». Số liệu trong văn AI phải có trong trích đoạn, số lạ bọc [[?…]].
 */
const { boDau } = require('./vntext');

const HE_THONG = 'Bạn là chuyên viên Sở Nông nghiệp và Môi trường tỉnh Sơn La soạn báo cáo hành chính. Chỉ dùng thông tin trong các trích đoạn đánh số. Sau mỗi số liệu ghi [n]. Không có số liệu thì ghi "(chưa có số liệu)". Không chào hỏi, không giải thích, viết thành đoạn văn hành chính ngôi "Sở Nông nghiệp và Môi trường".';

const kd = s => boDau(String(s || '')).toLowerCase();

function locGui(ketQua, kho, khongGui = []) {
  const cam = (khongGui || []).map(kd).filter(Boolean);
  return (ketQua.trichDoan || []).filter(t => {
    if (!t.chon) return false;
    const v = kho && kho.get(t.vbId);
    if (v && v.doMat) return false;
    const xet = kd(`${t.text} ${t.coQuan} ${t.soKyHieu}`);
    return !cam.some(c => xet.includes(c));
  });
}

function taoTinNhan(muc, dc, trich) {
  const yc = [...(muc.moTa || []), ...(muc.chiDan || [])].join(' ');
  const doan = trich.map((t, i) => `[${i + 1}] ${t.text} (Nguồn: ${t.soKyHieu}${t.ngay ? ', ngày ' + t.ngay : ''})`).join('\n');
  return [
    { role: 'system', content: HE_THONG },
    { role: 'user', content: `Báo cáo: ${dc.trichYeu || ''}\nMục: ${muc.tieuDe}${yc ? '\nYêu cầu của đề cương: ' + yc : ''}\n\nCác trích đoạn:\n${doan}\n\nViết nội dung cho mục này.` }
  ];
}

const chuanSo = s => s.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');

function kiemSo(van, trich) {
  const co = new Set();
  for (const t of trich) for (const m of String(t.text).matchAll(/\d[\d.,]*\d|\d/g)) co.add(chuanSo(m[0]));
  const soLa = [];
  const out = String(van).replace(/\[\d+\]|\d[\d.,]*\d|\d/g, s => {
    if (/^\[\d+\]$/.test(s)) return s;
    const daiDu = s.length >= 2 || /[.,]/.test(s);
    if (!daiDu || co.has(chuanSo(s))) return s;
    soLa.push(s);
    return `[[?${s}]]`;
  });
  return { van: out, soLa };
}

async function tinhChinhMuc(muc, dc, ketQua, { diaChi, fetchFn = globalThis.fetch, kho, khongGui = [], timeoutMs = 60000 } = {}) {
  const trich = locGui(ketQua, kho, khongGui);
  if (!trich.length) return { ok: false, loi: 'KHONG_CO_TRICH_DOAN' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchFn(diaChi, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: taoTinNhan(muc, dc, trich) }), signal: ac.signal });
    if (!res || !res.ok) return { ok: false, loi: `Worker trả lỗi HTTP ${res ? res.status : '?'}` };
    const j = await res.json();
    if (!j || !j.text) return { ok: false, loi: 'Worker không trả nội dung' };
    // [n] trong văn AI đánh theo thứ tự gửi đi → đổi về số của trích đoạn gốc
    const vanGoc = String(j.text).replace(/\[(\d+)\]/g, (s, n) => trich[+n - 1] ? `[${trich[+n - 1].n}]` : s);
    const { van, soLa } = kiemSo(vanGoc, trich);
    return { ok: true, van, model: j.model || '', soLa };
  } catch (e) {
    return { ok: false, loi: ac.signal.aborted ? 'Quá thời gian chờ Worker' : String(e.message || e) };
  } finally { clearTimeout(timer); }
}

module.exports = { locGui, taoTinNhan, kiemSo, tinhChinhMuc, HE_THONG };
