'use strict';
/**
 * Chế độ «Ghi nhận API»: người dùng tự tra cứu một lần trong cửa sổ iOffice; ứng dụng ghi TÊN API, phương thức,
 * tên + kiểu tham số và CẤU TRÚC kết quả (không ghi nội dung, không ghi header/token) để người phát triển
 * xác minh API tra cứu kho văn bản của Sở rồi thêm vào danh sách trắng chỉ đọc.
 */
const NHAY_CAM = /token|password|mat_?khau|authorization|cookie|secret|otp|captcha/i;

function kieu(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string') return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v) ? 'date dd/mm/yyyy' : 'string';
  if (Array.isArray(v)) return 'array';
  return 'object';
}

function cauTruc(v, sau = 0) {
  if (sau > 6) return '<…>';
  if (Array.isArray(v)) return v.length ? [cauTruc(v[0], sau + 1)] : [];
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) if (!NHAY_CAM.test(k)) o[k] = cauTruc(v[k], sau + 1);
    return o;
  }
  if (typeof v === 'string') return `<string:${v.length}>`;
  return `<${kieu(v)}>`;
}

function lamSach({ api, method, data, res }) {
  const [duong, query = ''] = String(api || '').split('?');
  const thamSo = new Set(query.split('&').map(x => decodeURIComponent(x.split('=')[0] || '')).filter(k => k && !NHAY_CAM.test(k)));
  const mauThamSo = {};
  if (data && typeof data === 'object') for (const k of Object.keys(data)) { if (NHAY_CAM.test(k)) continue; thamSo.add(k); mauThamSo[k] = kieu(data[k]); }
  return { api: duong, method: String(method || 'POST').toUpperCase(), thamSo: [...thamSo], mauThamSo, mauKetQua: cauTruc(res) };
}

function gopGhiNhan(ds) {
  const m = new Map();
  for (const r of ds) {
    const k = r.method + ' ' + r.api;
    const cu = m.get(k);
    if (!cu) { m.set(k, { ...r, soLan: 1 }); continue; }
    cu.thamSo = [...new Set([...cu.thamSo, ...r.thamSo])];
    cu.mauThamSo = { ...cu.mauThamSo, ...r.mauThamSo };
    cu.soLan++;
  }
  return [...m.values()];
}

/** Chạy TRONG trang iOffice: bọc $Vpdt.Api2 một lần, ghi {api, method, data, res} vào window.__iosyncLog (≤ 200). */
function ghiNhanBridge() {
  if (window.__iosyncLogOn) return true;
  const inj = window.angular && angular.element(document.body).injector && angular.element(document.body).injector();
  if (!inj) return false;
  const V = inj.get('$Vpdt');
  const goc = V.Api2;
  window.__iosyncLog = [];
  V.Api2 = function (opt, cb) {
    const o = opt || {};
    return goc.call(this, opt, function (res) {
      try {
        if (window.__iosyncLog.length < 200) window.__iosyncLog.push({ api: o.api, method: o.method, data: o.data, res: JSON.parse(JSON.stringify(res)) });
      } catch (e) { /* bỏ qua bản ghi không tuần tự hóa được */ }
      return cb && cb.apply(this, arguments);
    });
  };
  window.__iosyncLogOn = true;
  return true;
}

module.exports = { lamSach, gopGhiNhan, ghiNhanBridge, cauTruc };
