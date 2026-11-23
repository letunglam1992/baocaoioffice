'use strict';
/**
 * Adapter VNPT iOffice 4.0 (https://stnmtsonla.vnptioffice.vn).
 *
 * Nguyên tắc bảo mật:
 *  - Người dùng tự đăng nhập trong cửa sổ iOffice thật; ứng dụng không bao giờ thấy mật khẩu.
 *  - Mỗi tài khoản có phân vùng riêng "persist:ioffice-<id>" của ứng dụng (cookie được Chromium mã hóa bằng DPAPI).
 *  - Mọi lời gọi API/tải file chạy TRONG ngữ cảnh trang iOffice, dùng chính dịch vụ $Vpdt/$fileManager của trang;
 *    ứng dụng chỉ nhận về dữ liệu JSON hoặc nội dung file — không đọc, không lưu, không ghi log token.
 *  - Chỉ gọi các API đọc (danh sách, chi tiết, bút phê, phúc đáp, xem file). Không gọi API xử lý/chuyển/cập nhật nào.
 */
const { BrowserWindow } = require('electron');
const { shouldReload, reloadDelay, MAX_RELOADS } = require('./retry');

const { IOFFICE_URL: BASE_URL } = require('./constants');
const PARTITION_PREFIX = 'persist:ioffice-';
/** Tên phân vùng Chromium cho một tài khoản: bỏ dấu, chữ thường, chỉ [a-z0-9-]. */
function partitionFor(id) {
  const s = String(id || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return PARTITION_PREFIX + (s || 'chinh');
}
const MIN_GAP_MS = 700; // giãn cách giữa các lời gọi để không gây tải cho máy chủ

// Danh sách trắng API được phép gọi (chỉ đọc).
const ALLOWED_APIS = [
  '/api/van-ban-den/danh-sach-van-ban-den-theo-trang-thai-cua-chuyen-vien',
  '/api/van-ban-den/van-ban-den-chi-tiet',
  '/api/van-ban-den/but-phe-lanh-dao-chuoi',
  '/api/van-ban-den/danh-sach-vbdi-phuc-dap-vbd',
  '/api/van-ban-di/chi-tiet-van-ban-di',
  '/api/van-ban-di/danh-sach-van-ban-di-da-phat-hanh-cua-chuyen-vien',
  '/api/van-ban-di/qua-trinh-xu-ly-van-ban-di', // #51: bảng «Quá trình xử lý văn bản đi» (GET, chỉ đọc)
  '/api/van-ban-den/cay-xu-ly-van-ban-den', // #52: cây «Quá trình xử lý văn bản đến» (GET, chỉ đọc)
  '/api/van-ban-di/danh-sach-van-ban-di-cho-xu-ly-cua-chuyen-vien' // #54: danh sách «VB chờ xử lý» (văn bản người khác trình) — chỉ đọc
];

/** Mã chạy trong trang iOffice. Phải tự chứa (được tuần tự hóa thành chuỗi). */
function pageBridge() {
  if (window.__iosync) return true;
  const inj = () => (window.angular && angular.element(document.body).injector && angular.element(document.body).injector()) || null;
  window.__iosync = {
    who() {
      const i = inj(); if (!i) return null;
      const rs = i.get('$rootScope');
      if (!rs.chi_tiet_can_bo || !rs.ht_don_vi_quan_tri) return null;
      return {
        ma_ctcb: rs.chi_tiet_can_bo.ma_ctcb_kc,
        ho_ten: rs.chi_tiet_can_bo.ho_va_ten_can_bo || rs.chi_tiet_can_bo.ho_va_ten || '',
        ma_dvqt: rs.ht_don_vi_quan_tri.ma_don_vi_kc
      };
    },
    call(api, method, data, timeoutMs) {
      return new Promise((resolve, reject) => {
        const i = inj(); if (!i) return reject(new Error('NOT_READY'));
        const V = i.get('$Vpdt');
        const timer = setTimeout(() => reject(new Error('TIMEOUT ' + api.split('?')[0])), timeoutMs || 45000);
        try {
          V.Api2({ api, method, data }, res => { clearTimeout(timer); resolve(res); });
        } catch (e) { clearTimeout(timer); reject(e); }
      });
    },
    async file(path, name) {
      const i = inj(); if (!i) throw new Error('NOT_READY');
      const FM = i.get('$fileManager');
      const url = FM.generateAPIViewFile({ name: name || 'file.pdf', path, type: 'view' }).replace('#toolbar=1', '');
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.length > 80 * 1024 * 1024) throw new Error('File quá lớn');
      let bin = '';
      for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
      return { b64: btoa(bin), type: r.headers.get('content-type') || '' };
    }
  };
  return true;
}

class IOffice {
  constructor({ log, partition } = {}) {
    this.partition = partition || partitionFor('chinh');
    this.win = null;
    this.log = log || (() => {});
    this.lastCall = 0;
    this.me = null;
  }

  ensureWindow() {
    if (this.win && !this.win.isDestroyed()) return this.win;
    this.win = new BrowserWindow({
      width: 1280, height: 860, show: false, title: 'iOffice — Đăng nhập',
      autoHideMenuBar: true,
      webPreferences: { partition: this.partition, contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false }
    });
    this.win.on('close', e => { if (!this.quitting) { e.preventDefault(); this.win.hide(); } });
    // Không cho trang mở cửa sổ mới ngoài ý muốn.
    this.win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.watchLoadErrors(this.win.webContents);
    this.win.loadURL(BASE_URL);
    return this.win;
  }

  /**
   * Trang iOffice lỗi 5xx / mất mạng → tự tải lại, giãn dần, tối đa MAX_RELOADS lần; nhật ký ghi host + đường dẫn
   * (không kèm tham số). Lưu ý: 502 liên tục ngày 26/09 là do User-Agent có dấu — đã sửa ở src/useragent.js.
   */
  watchLoadErrors(wc) {
    this.reloadFails = 0; this.loadFailed = false;
    let pending = null;
    const pathOf = u => { try { const x = new URL(u); return x.host + x.pathname; } catch { return ''; } };
    const retry = (url, why) => {
      this.loadFailed = true;
      if (pending || this.quitting) return;
      const where = pathOf(url) ? ` tại ${pathOf(url)}` : '';
      if (this.reloadFails >= MAX_RELOADS) {
        this.log('error', `Máy chủ iOffice vẫn lỗi (${why}${where}) sau ${MAX_RELOADS} lần tự tải lại — bấm «Đăng nhập iOffice» để thử lại.`);
        return;
      }
      const ms = reloadDelay(this.reloadFails++);
      this.log('warn', `Máy chủ iOffice trả lỗi ${why}${where} — tự tải lại sau ${ms / 1000} giây (lần ${this.reloadFails}/${MAX_RELOADS}).`);
      // loadURL luôn là GET: không gửi lại dữ liệu biểu mẫu như reload().
      pending = setTimeout(() => { pending = null; if (this.win && !this.win.isDestroyed()) this.win.loadURL(url || BASE_URL); }, ms);
    };
    this.resetLoadErrors = () => { this.reloadFails = 0; };
    wc.on('did-navigate', (_e, url, httpCode) => {
      if (shouldReload({ httpCode })) retry(url, `HTTP ${httpCode}`);
      else if (httpCode >= 200 && httpCode < 400) { this.reloadFails = 0; this.loadFailed = false; }
    });
    wc.on('did-fail-load', (_e, errorCode, desc, url, isMainFrame) => {
      if (isMainFrame && shouldReload({ errorCode })) retry(url, desc || `mã ${errorCode}`);
    });
  }

  async exec(fnBody) {
    const w = this.ensureWindow();
    return w.webContents.executeJavaScript(fnBody, true);
  }

  /** Chờ trang sẵn sàng; trả về thông tin cán bộ nếu đã đăng nhập, null nếu chưa. */
  async whoAmI(waitMs = 25000) {
    this.ensureWindow();
    const until = Date.now() + waitMs;
    while (Date.now() < until) {
      try {
        if (!this.win.webContents.isLoading()) {
          await this.exec(`(${pageBridge.toString()})()`);
          const who = await this.exec('window.__iosync && window.__iosync.who()');
          if (who && who.ma_ctcb) { this.me = who; return who; }
          const onLogin = await this.exec(`/dang-nhap|login/i.test(location.pathname + location.hash) || !!document.querySelector('input[type=password]')`);
          if (onLogin) { this.me = null; return null; } // phiên hết hạn → trạng thái "Cần đăng nhập"
        }
      } catch (e) { /* trang đang chuyển — thử lại */ }
      await sleep(800);
    }
    return null;
  }

  /** Hiện cửa sổ để người dùng tự đăng nhập; chờ tối đa `timeoutMs`. */
  async interactiveLogin(timeoutMs = 10 * 60 * 1000) {
    const w = this.ensureWindow();
    // Trang đang là trang lỗi (hết lượt tự tải lại) → người dùng bấm đăng nhập lại: đếm lại từ đầu, tải lại.
    if (this.loadFailed) { this.resetLoadErrors(); w.loadURL(BASE_URL); }
    else if (w.webContents.getURL() === '' || w.webContents.getURL() === 'about:blank') w.loadURL(BASE_URL);
    w.show(); w.focus();
    const until = Date.now() + timeoutMs;
    while (Date.now() < until && !w.isDestroyed()) {
      const who = await this.whoAmI(3000);
      if (who) { w.hide(); return who; }
      await sleep(1500);
    }
    return null;
  }

  /** Mở trang chi tiết văn bản trong cửa sổ iOffice để người dùng xem. */
  showDocument(id, xld) {
    const w = this.ensureWindow();
    w.loadURL(`${BASE_URL}van-ban-den/xem-van-ban-den-chi-tiet?id=${encodeURIComponent(id)}&t=vb_den_da_xu_ly_cua_cv&v=cv&xld=${encodeURIComponent(xld)}`);
    w.show(); w.focus();
  }

  async throttle() {
    const wait = this.lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastCall = Date.now();
  }

  async call(api, method = 'POST', data = undefined) {
    const base = api.split('?')[0];
    if (!ALLOWED_APIS.includes(base)) throw new Error('API_KHONG_DUOC_PHEP: ' + base);
    await this.throttle();
    this.callCount = (this.callCount || 0) + 1; // thống kê tải lên máy chủ (nhật ký mỗi lượt quét)
    await this.exec(`(${pageBridge.toString()})()`);
    const res = await this.exec(`window.__iosync.call(${JSON.stringify(api)}, ${JSON.stringify(method)}, ${JSON.stringify(data)})`);
    if (res && res.success === false) throw new Error(`iOffice từ chối: ${res.message || base}`);
    return res;
  }

  requireMe() {
    if (!this.me) throw new Error('NOT_LOGGED_IN');
    return this.me;
  }

  /** Danh sách văn bản đến của chuyên viên (3 trạng thái: chưa xử lý, đang xử lý, đã xử lý), có phân trang. */
  async listVanBanDen(tuNgay, denNgay, trangThai = [1, 2, 3]) {
    const me = this.requireMe();
    const out = [];
    for (const tt of trangThai) {
      for (let page = 1; page <= 50; page++) {
        const r = await this.call('/api/van-ban-den/danh-sach-van-ban-den-theo-trang-thai-cua-chuyen-vien', 'POST', {
          ma_ctcb_nhan: me.ma_ctcb, ma_don_vi_quan_tri: me.ma_dvqt, trang_thai_xu_ly: tt,
          page, size: 100, nhan_tu_ngay: tuNgay, nhan_den_ngay: denNgay
        });
        const rows = (r && r.data) || [];
        rows.forEach(x => out.push({ ...x, __tt: tt }));
        if (rows.length < 100) break;
      }
    }
    return out;
  }

  /** Văn bản đi đã phát hành liên quan đến chuyên viên (lọc theo ngày đi), có phân trang. */
  async listVanBanDiDaPhatHanh(tuNgay, denNgay) {
    const me = this.requireMe();
    const out = [];
    for (let page = 1; page <= 50; page++) {
      const r = await this.call('/api/van-ban-di/danh-sach-van-ban-di-da-phat-hanh-cua-chuyen-vien', 'POST', {
        ma_don_vi_quan_tri: me.ma_dvqt, ma_ctcb_cv: me.ma_ctcb, page, size: 100, nam: '0',
        ngay_di_tu_ngay: tuNgay, ngay_di_den_ngay: denNgay
      });
      const rows = (r && r.data) || [];
      out.push(...rows);
      const total = Number(r && r.total_row) || 0;
      if (rows.length < 100 || (total && out.length >= total)) break;
    }
    return out;
  }

  /** Văn bản đi đang chờ người dùng xử lý (người khác trình / chuyển tới), lọc theo ngày tạo, có phân trang. */
  async listVanBanDiChoXuLy(tuNgay, denNgay) {
    const me = this.requireMe();
    const out = [];
    for (let page = 1; page <= 10; page++) {
      const r = await this.call('/api/van-ban-di/danh-sach-van-ban-di-cho-xu-ly-cua-chuyen-vien', 'POST', {
        ma_don_vi_quan_tri: me.ma_dvqt, ma_ctcb_cv: me.ma_ctcb, page, size: 100, nam: '0',
        ngay_tao_tu_ngay: tuNgay, ngay_tao_den_ngay: denNgay
      });
      const rows = (r && r.data) || [];
      out.push(...rows);
      if (rows.length < 100) break;
    }
    return out;
  }

  async chiTiet(maVanBanDen, maXuLyDen) {
    const me = this.requireMe();
    const r = await this.call('/api/van-ban-den/van-ban-den-chi-tiet', 'POST', { ma_xu_ly_den: maXuLyDen, ma_van_ban_den: maVanBanDen, ma_ctcb: me.ma_ctcb });
    const d = r && r.data;
    return Array.isArray(d) ? d[0] : d;
  }

  async chuoiButPhe(maVanBanDen, maXuLyDen) {
    const r = await this.call(`/api/van-ban-den/but-phe-lanh-dao-chuoi?ma_xu_ly_den=${encodeURIComponent(maXuLyDen)}&ma_van_ban_den=${encodeURIComponent(maVanBanDen)}`, 'GET');
    return Array.isArray(r) ? r : ((r && r.data) || []);
  }

  async phucDap(maVanBanDen) {
    const me = this.requireMe();
    const r = await this.call(`/api/van-ban-den/danh-sach-vbdi-phuc-dap-vbd?ma_van_ban_den=${encodeURIComponent(maVanBanDen)}&ma_dvqt=${encodeURIComponent(me.ma_dvqt)}`, 'GET');
    return (r && r.data) || [];
  }

  async chiTietVanBanDi(maVanBanDi) {
    const me = this.requireMe();
    const r = await this.call(`/api/van-ban-di/chi-tiet-van-ban-di?ma_van_ban_di=${encodeURIComponent(maVanBanDi)}&ma_ctcb=${encodeURIComponent(me.ma_ctcb)}`, 'GET');
    const d = r && r.data;
    return Array.isArray(d) ? d[0] : d;
  }

  /** Cây quá trình xử lý văn bản đến: nút {data: {can_bo_gui, noi_dung_chuyen, ngay_nhan, ten_don_vi, ma_yeu_cau…}, childs: [nút…]}. */
  async cayXuLyVanBanDen(maVanBanDen) {
    const r = await this.call(`/api/van-ban-den/cay-xu-ly-van-ban-den?ma_van_ban_den=${encodeURIComponent(maVanBanDen)}`, 'GET');
    return Array.isArray(r) ? r : ((r && r.data) || []);
  }

  /** Quá trình xử lý văn bản đi: mỗi dòng một người nhận {can_bo_gui, noi_dung_chuyen_ctcb_khac, can_bo_nhan, ma_yeu_cau, ngay_nhan}. */
  async quaTrinhVanBanDi(maVanBanDi) {
    const me = this.requireMe();
    const r = await this.call(`/api/van-ban-di/qua-trinh-xu-ly-van-ban-di?ma_van_ban_di=${encodeURIComponent(maVanBanDi)}&ma_don_vi_quan_tri=${encodeURIComponent(me.ma_dvqt)}`, 'GET');
    return Array.isArray(r) ? r : ((r && r.data) || []);
  }

  async downloadFile(path, name) {
    await this.throttle();
    this.callCount = (this.callCount || 0) + 1;
    await this.exec(`(${pageBridge.toString()})()`);
    const r = await this.exec(`window.__iosync.file(${JSON.stringify(path)}, ${JSON.stringify(name || 'file.pdf')})`);
    const buf = Buffer.from(r.b64, 'base64');
    kiemTraNoiDung(buf, name);
    return buf;
  }

  destroy() {
    this.quitting = true;
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
  }
}

/** Nội dung tải về phải đúng loại tệp; trang HTML nghĩa là phiên đã hết hạn. */
function kiemTraNoiDung(buf, name) {
  if (!buf || !buf.length) throw new Error('Tệp tải về rỗng');
  const dau = buf.slice(0, 64).toString('latin1').trimStart().toLowerCase();
  if (dau.startsWith('<!doctype html') || dau.startsWith('<html')) throw new Error('Nội dung tải về là trang web (có thể phiên đã hết hạn)');
  const ext = (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
  const magic = { pdf: '%PDF', docx: 'PK', xlsx: 'PK', doc: '\xd0\xcf\x11\xe0' }[ext];
  if (magic && buf.slice(0, magic.length).toString('latin1') !== magic) throw new Error(`Nội dung tải về không đúng định dạng .${ext}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { IOffice, BASE_URL, ALLOWED_APIS, partitionFor, PARTITION_PREFIX, kiemTraNoiDung };
