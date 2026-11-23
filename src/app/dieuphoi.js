'use strict';
/**
 * Điều phối lượt quét nền cho mọi tài khoản (tuần tự), OCR lúc rảnh, lấy văn bản theo số ký hiệu.
 * Thuần Node (Electron tiêm vào qua taoIo) để kiểm thử được.
 */
const { khoangLuot } = require('../lich');
const { thuThap: thuThapMacDinh, layChiTiet: layChiTietMacDinh } = require('../thuthap');
const { boDau } = require('../vntext');

const chuanSo = s => boDau(String(s || '')).toLowerCase().replace(/\s+/g, '');

class DieuPhoi {
  constructor({ store, kho, taoIo, thuThap = thuThapMacDinh, layChiTiet = layChiTietMacDinh, now = Date.now, log = () => {}, thongBao = () => {}, caiDat, tamDir, ocrFn, onTienDo = () => {} }) {
    Object.assign(this, { store, kho, taoIo, thuThap, layChiTiet, now, log, thongBao, caiDat, tamDir, ocrFn, onTienDo });
    this.dangChay = false;
    this.yeuCauDung = false;
  }

  dsTaiKhoan() { return Object.entries(this.store.data.taiKhoan || {}); }

  dung() { this.yeuCauDung = true; }

  async chayLuot({ lyDo = 'lich' } = {}) {
    if (this.dangChay) return { dangChay: true };
    this.dangChay = true; this.yeuCauDung = false;
    const S = this.caiDat();
    const theoTaiKhoan = {};
    let coLoi = false, conViec = false;
    try {
      for (const [id, tk] of this.dsTaiKhoan()) {
        if (this.yeuCauDung) break;
        const t = this.now();
        const kl = khoangLuot({ lastOkAt: tk.lastOkAt, luiNgay: S.luiNgay, tuNgayDau: S.tuNgayDau, now: t });
        let r;
        try {
          r = await this.thuThap({
            io: this.taoIo(id), kho: this.kho, taiKhoan: id, ...kl, chiDanhSach: true,
            gioiHan: { maxCalls: S.maxCalls, maxFiles: S.maxFiles, maxMB: S.maxMB }, tamDir: this.tamDir,
            thuMucQuetVanBan: S.thuMucQuetVanBan, giuTep: (S.giuTep && S.giuTep.loai && S.giuTep.loai.length) ? S.giuTep : null,
            nenDung: () => this.yeuCauDung, onTienDo: e => this.onTienDo({ ...e, taiKhoan: tk.ten || id }), log: this.log
          });
        } catch (e) {
          r = { ok: false, loi: [{ so: '', msg: String(e.message || e) }] };
        }
        theoTaiKhoan[id] = r;
        if (r.ok && r.hetGioiHan && !r.dung) conViec = true;
        tk.lastRunAt = t;
        const msg = r.loi && r.loi.length ? r.loi[r.loi.length - 1].msg : '';
        // còn văn bản/tệp lỗi → giữ mốc cũ để lượt sau liệt kê lại và thử lại (văn bản đã xong được bỏ qua nhanh)
        if (r.ok && !r.hetGioiHan && !r.dung && !(r.loi && r.loi.length) && !r.loiTep) { tk.lastOkAt = kl.denNgay; tk.lastFailAt = null; tk.loi = null; }
        else if (!r.ok) {
          tk.loi = msg || 'Lỗi không rõ';
          if (msg === 'CHUA_DANG_NHAP') this.thongBao(`Tài khoản ${tk.ten || id} cần đăng nhập lại iOffice.`);
          else { tk.lastFailAt = t; coLoi = true; }
        }
        this.log(r.ok ? 'info' : 'warn', `[${lyDo}] ${tk.ten || id}: mới ${r.moi || 0}, cập nhật ${r.capNhat || 0}, tệp ${r.tep || 0}${r.hetGioiHan ? ', chạm giới hạn lượt' : ''}${r.ok ? '' : ', lỗi: ' + tk.loi}`);
      }
    } finally {
      this.store.data.lastRunAt = this.now();
      this.store.data.lastFailAt = coLoi ? this.now() : null;
      // còn văn bản chưa lấy (chạm giới hạn lượt) và người dùng không bấm Dừng → hẹn lượt tiếp
      this.store.data.tiepTucAt = conViec && !this.yeuCauDung ? this.now() + (S.quetTiepPhut || 15) * 60000 : null;
      this.store.save();
      this.dangChay = false;
    }
    return { theoTaiKhoan };
  }

  /** Chờ lượt quét nền dừng (tối đa ~60 giây) để dùng iOffice cho việc người dùng đang làm. */
  async choRanh() {
    if (!this.dangChay) return;
    this.dung();
    for (let k = 0; k < 120 && this.dangChay; k++) await new Promise(r => setTimeout(r, 500));
    if (this.dangChay) throw new Error('Đang quét nền — vui lòng thử lại sau ít phút.');
  }

  /**
   * 0.2.0: tải chi tiết + tệp cho các văn bản được chọn khi phân tích báo cáo.
   * Mỗi văn bản thử lần lượt các tài khoản đã thấy nó (tài khoản chưa đăng nhập thì chuyển sang tài khoản khác).
   */
  async layNoiDung(ids) {
    await this.choRanh();
    this.dangChay = true; this.yeuCauDung = false;
    const S = this.caiDat();
    const daThu = new Map(ids.map(id => [id, new Set()]));
    let con = ids.slice(), daTai = 0, coOk = false;
    const loi = [];
    try {
      while (con.length && !this.yeuCauDung) {
        const nhom = new Map();
        for (const id of con) {
          const v = this.kho.get(id);
          const tk = v && v.taiKhoan.find(t => !daThu.get(id).has(t) && this.store.data.taiKhoan[t]);
          if (!tk) continue;
          if (!nhom.has(tk)) nhom.set(tk, []);
          nhom.get(tk).push(id);
        }
        if (!nhom.size) break;
        const conLai = [];
        for (const [tk, ds] of nhom) {
          ds.forEach(id => daThu.get(id).add(tk));
          const r = await this.layChiTiet({
            io: this.taoIo(tk), kho: this.kho, ids: ds, taiKhoan: tk, tamDir: this.tamDir,
            thuMucQuetVanBan: S.thuMucQuetVanBan, giuTep: (S.giuTep && S.giuTep.loai && S.giuTep.loai.length) ? S.giuTep : null,
            gioiHan: { maxCalls: 100000, maxFiles: 100000, maxMB: S.maxMB },
            nenDung: () => this.yeuCauDung, onTienDo: e => this.onTienDo({ ...e, taiKhoan: (this.store.data.taiKhoan[tk] || {}).ten || tk, lamBaoCao: true }), log: this.log
          });
          daTai += r.tep || 0;
          if (r.ok) coOk = true; else { loi.push(...(r.loi || [])); conLai.push(...ds); }
        }
        con = conLai;
      }
    } finally {
      this.kho.save();
      this.dangChay = false;
    }
    this.log('info', `Tải nội dung cho báo cáo: ${ids.length - con.length}/${ids.length} văn bản, ${daTai} tệp.`);
    return { ok: coOk || !ids.length, daTai, soVanBan: ids.length - con.length, loi };
  }

  async ocrLucRanh({ gioiHanTrang = 10, soTep = 3 } = {}) {
    if (this.dangChay || !this.ocrFn) return 0;
    let n = 0;
    for (const { vb, tepIdx } of this.kho.canOcr(soTep)) {
      if (this.yeuCauDung) break;
      const tep = vb.tep[tepIdx];
      const datTep = patch => vb.tep.map((t, i) => i === tepIdx ? { ...t, ...patch } : t);
      // tải: thử lần lượt các tài khoản đã thấy văn bản; lỗi tải/phiên là tạm thời
      let buf = null, loiTai = '';
      for (const tk of vb.taiKhoan) {
        try { buf = await this.taoIo(tk).downloadFile(tep.path, tep.name); break; } catch (e) { loiTai = String(e.message || e); }
      }
      if (!buf) {
        const thu = (tep.ocrThu || 0) + 1;
        this.log('warn', `OCR ${vb.soKyHieu}: chưa tải được tệp (${loiTai}) — lần ${thu}/5.`);
        this.kho.upsert({ ...vb, tep: datTep({ ocrThu: thu, ...(thu >= 5 && { ocrDone: true, error: loiTai.slice(0, 200) }) }) });
        continue;
      }
      try {
        const r = await this.ocrFn(buf, { maxPages: gioiHanTrang });
        const pages = String(r.text || '').split(/\n?\f\n?/);
        const trang = vb.trang.filter(t => t.tep !== tepIdx);
        pages.forEach((text, k) => { if (text.trim()) trang.push({ tep: tepIdx, so: k + 1, text: text.trim() }); });
        this.kho.upsert({ ...vb, tep: datTep({ method: r.method || 'ocr', ocrDone: true }), trang });
        n++;
      } catch (e) { // lỗi đọc nội dung: không thử lại
        this.log('warn', `OCR ${vb.soKyHieu}: ${e.message}`);
        this.kho.upsert({ ...vb, tep: datTep({ ocrDone: true, error: String(e.message || e).slice(0, 200) }) });
      }
    }
    this.kho.save();
    return n;
  }

  async layTheoSo(soKyHieu) {
    const co = this.kho.timTheoSo(soKyHieu);
    if (co.length) {
      const can = co.filter(v => v.chuaChiTiet && !v.doMat).map(v => v.id);
      if (can.length) await this.layNoiDung(can);
      return this.kho.timTheoSo(soKyHieu);
    }
    if (this.dangChay) throw new Error('Đang quét nền — chờ lượt quét xong hoặc bấm Dừng rồi thử lại.');
    this.dangChay = true;
    try { return await this.layTheoSoNoi(soKyHieu); } finally { this.dangChay = false; }
  }

  async layTheoSoNoi(soKyHieu) {
    const q = chuanSo(soKyHieu);
    const S = this.caiDat();
    const khop = rows => (rows || []).filter(x => chuanSo(x.so_ky_hieu) === q);
    for (const [id] of this.dsTaiKhoan()) {
      const io = this.taoIo(id);
      const loc = Object.create(io);
      loc.listVanBanDen = async (a, b) => khop(await io.listVanBanDen(a, b));
      loc.listVanBanDiDaPhatHanh = async (a, b) => khop(await io.listVanBanDiDaPhatHanh(a, b));
      loc.whoAmI = io.whoAmI ? () => io.whoAmI() : async () => ({});
      const kl = khoangLuot({ lastOkAt: null, luiNgay: 0, tuNgayDau: S.tuNgayDau, now: this.now() });
      await this.thuThap({ io: loc, kho: this.kho, taiKhoan: id, ...kl, gioiHan: { maxCalls: 50, maxFiles: 20 }, tamDir: this.tamDir, thuMucQuetVanBan: S.thuMucQuetVanBan, log: this.log });
      const r = this.kho.timTheoSo(soKyHieu);
      if (r.length) return r;
    }
    return [];
  }
}

module.exports = { DieuPhoi };
