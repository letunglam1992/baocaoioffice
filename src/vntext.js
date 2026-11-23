'use strict';
/** Xử lý chữ tiếng Việt: chuẩn hóa, bỏ dấu, tách từ, từ dừng hành chính, tìm số ký hiệu văn bản. */

function chuanHoa(s) {
  return String(s == null ? '' : s).normalize('NFC').replace(/[   \t]/g, ' ').replace(/ {2,}/g, ' ').trim();
}

function boDau(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFC');
}

const SKH_RE = /(?<![\p{L}\d\/-])\d{1,5}[\/-][A-ZĐ][\p{L}]*(?:[\/-][A-ZĐ][\p{L}\d]*)*/gu;

/** Số ký hiệu văn bản trong chuỗi (vd 131/KH-UBND, 09-NQ/TU, 1410/TTr-SNNMT), theo thứ tự, không trùng. */
function timSoKyHieu(s) {
  const out = [];
  for (const m of String(s).matchAll(SKH_RE)) {
    const v = m[0];
    if (v.includes('/') && !out.includes(v)) out.push(v);
  }
  return out;
}

/** Tách từ (âm tiết) chữ thường; số ký hiệu giữ nguyên khối. */
function tachTu(s) {
  const str = chuanHoa(s);
  const out = [];
  const re = new RegExp(SKH_RE.source + '|[\\p{L}\\d]+(?:[.,]\\d+)*', 'gu');
  for (const m of str.matchAll(re)) out.push(m[0].toLowerCase());
  return out;
}

const TU_DUNG = new Set(['kết quả', 'thực hiện', 'báo cáo', 'đề nghị', 'công tác', 'triển khai', 'tình hình', 'đánh giá',
  'nội dung', 'liên quan', 'cụ thể', 'giai đoạn', 'các', 'của', 'và', 'về', 'theo', 'năm', 'được', 'cho', 'với', 'trên',
  'tại', 'đã', 'có', 'là', 'những', 'một', 'này', 'đến', 'từ', 'số', 'ngày', 'trong', 'việc', 'đối', 'như', 'sau', 'khi',
  'nếu', 'gồm', 'đó', 'để', 'hoặc', 'thì', 'mà', 'ra', 'vào', 'lại', 'nhằm']);
const TU_DUNG_KD = [...TU_DUNG].map(boDau);

/** Từ khóa không dấu: âm tiết (≥ 2 ký tự, không phải số thuần) và cụm hai âm tiết liền nhau, sau khi bỏ từ dừng. */
function tuKhoa(s) {
  const doan = boDau(chuanHoa(s).toLowerCase()).split(/[,.;:()\[\]"“”!?\n]+/);
  const out = new Set();
  for (const d of doan) {
    let toks = tachTu(d);
    // bỏ cụm dừng hai âm tiết trước, rồi một âm tiết
    const kept = [];
    for (let i = 0; i < toks.length; i++) {
      if (i + 1 < toks.length && TU_DUNG_KD.includes(toks[i] + ' ' + toks[i + 1])) { kept.push(null); i++; continue; }
      kept.push(TU_DUNG_KD.includes(toks[i]) ? null : toks[i]);
    }
    for (let i = 0; i < kept.length; i++) {
      const t = kept[i];
      if (!t) continue;
      if (t.length >= 2 && !/^[\d.,]+$/.test(t)) out.add(t);
      const n = kept[i + 1];
      if (n && !/^[\d.,]+$/.test(t) && !/^[\d.,]+$/.test(n)) out.add(t + ' ' + n);
    }
  }
  return [...out];
}

module.exports = { chuanHoa, boDau, tachTu, tuKhoa, timSoKyHieu, TU_DUNG };
