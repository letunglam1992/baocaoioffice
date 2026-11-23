'use strict';
/**
 * Một lượt thu thập văn bản cho MỘT tài khoản iOffice (chỉ đọc).
 * Cách lưu B: tệp tải vào thư mục tạm → đọc chữ → lưu chữ vào kho → xóa tệp tạm.
 * Văn bản có độ mật: chỉ lưu metadata, không tải tệp.
 */
const fs = require('fs');
const path = require('path');
const { readAny } = require('./docread');
const { parseNgay } = require('./kho');

const fmtDate = v => {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`;
  return '';
};
const splitFiles = s => String(s || '').split(':').map(x => x.trim()).filter(Boolean);
const fileName = p => String(p).split('__').pop();
const safeFileBase = (so, ngay) => {
  const s = String(so || 'khong-so').normalize('NFC').replace(/[\/\\]/g, '-').replace(/[<>:"|?*\x00-\x1f]/g, '').replace(/\s+/g, '').slice(0, 80);
  const d = fmtDate(ngay).replace(/\//g, '');
  return d ? `${s}_${d}` : s;
};
const safeDirName = loai => String(loai || 'Văn bản khác').replace(/[<>:"\/\\|?*\x00-\x1f]/g, '').trim() || 'Văn bản khác';
const laMat = ten => { const t = String(ten || '').trim().toLowerCase(); return !!t && !['bình thường', 'thường', 'binh thuong'].includes(t); };
/**
 * Độ mật theo chi tiết văn bản — AN TOÀN: không có chi tiết, hoặc không có cả tên lẫn mã độ mật → coi là mật
 * (không tải, không đọc). Mã độ mật khác 1 (1 = bình thường) → mật.
 */
function laMatCT(ct) {
  if (!ct || typeof ct !== 'object') return true;
  const coTen = Object.prototype.hasOwnProperty.call(ct, 'ten_cap_do_mat') && ct.ten_cap_do_mat != null;
  const coMa = ct.ma_cap_do_mat != null && ct.ma_cap_do_mat !== '';
  if (!coTen && !coMa) return true;
  if (coMa && +ct.ma_cap_do_mat !== 1) return true;
  return laMat(ct.ten_cap_do_mat);
}
const loiPhien = e => /NOT_READY|NOT_LOGGED_IN|phiên|CHUA_DANG_NHAP/i.test(String(e && e.message || e));
const MAX_THU = 3; // số lượt thử lại tối đa cho một tệp tải lỗi
/** Lỗi do chính phần mềm (vd bản 0.1.1: «r is not defined») — không tính vào số lần thử, luôn tải lại. */
const loiPhanMem = t => /is not defined|is not a function|Cannot read prop/i.test(String(t.error || ''));
const soLanThu = t => (loiPhanMem(t) ? 0 : (t.thu || 0));

/** Tệp do quetvanban đã lưu: <thư mục>\<Loại>\<số>_<ddmmyyyy>[_vN].pdf — chỉ đọc. */
function timTepQuetVanBan(root, vb) {
  if (!root) return null;
  try {
    const dir = path.join(root, safeDirName(vb.loai));
    const base = safeFileBase(vb.soKyHieu, vb.ngayBanHanh);
    const p = path.join(dir, base + '.pdf');
    return fs.existsSync(p) ? p : null;
  } catch { return null; }
}

function giuTepGoc(khoDir, tenGoc, buf, { tranMB }) {
  const dir = path.join(khoDir, 'giu-tep');
  fs.mkdirSync(dir, { recursive: true });
  // tên an toàn trên Windows: bỏ ký tự cấm và dấu gạch chéo, giới hạn độ dài
  const ext = path.extname(tenGoc).slice(0, 6);
  const name = tenGoc.slice(0, tenGoc.length - ext.length).replace(/[<>:"\/\\|?*\x00-\x1f]+/g, '-').slice(0, 100) + ext;
  let p = path.join(dir, name), v = 2;
  while (fs.existsSync(p)) { const e = path.extname(name); p = path.join(dir, path.basename(name, e) + `_v${v++}` + e); }
  fs.writeFileSync(p, buf, { flag: 'wx' });
  const ds = fs.readdirSync(dir).map(n => { const f = path.join(dir, n); const s = fs.statSync(f); return { f, size: s.size, t: s.mtimeMs }; })
    .sort((a, b) => a.t - b.t);
  let tong = ds.reduce((a, x) => a + x.size, 0);
  const tran = (tranMB || 500) * 1024 * 1024;
  for (const x of ds) { if (tong <= tran || x.f === p) continue; fs.unlinkSync(x.f); tong -= x.size; }
}

async function thuThap(o) {
  const { io, kho, taiKhoan, tuNgay, denNgay, gioiHan = {}, tamDir, chiDanhSach = false } = o;
  const kq = taoKq();
  const { dem, het } = boDem(kq, gioiHan);

  const me = await io.whoAmI().catch(() => null);
  if (!me) return { ...kq, ok: false, loi: [{ so: '', msg: 'CHUA_DANG_NHAP' }] };
  fs.mkdirSync(tamDir, { recursive: true });

  let ds = [];
  try {
    dem(); const den = await io.listVanBanDen(tuNgay, denNgay);
    const daCo = new Set();
    for (const x of den) {
      const ma = String(x.ma_van_ban_den_kc);
      if (daCo.has(ma)) continue; daCo.add(ma);
      ds.push({ id: 'den:' + ma, chieu: 'den', x, ngay: parseNgay(fmtDate(x.ngay_nhan || x.ngay_den || x.ngay_ban_hanh)) || 0 });
    }
    dem(); const di = await io.listVanBanDiDaPhatHanh(tuNgay, denNgay);
    for (const x of di) ds.push({ id: 'di:' + x.ma_van_ban_di_kc, chieu: 'di', x, ngay: parseNgay(fmtDate(x.ngay_di || x.ngay_ban_hanh)) || 0 });
  } catch (e) {
    return { ...kq, ok: false, loi: [{ so: '', msg: String(e.message || e) }] };
  }
  if (chiDanhSach) return luuDanhSach(ds, kho, taiKhoan, kq);
  ds = ds.filter(d => !daXong(kho, d.id));
  // văn bản CHƯA có trong kho trước (mới nhất trước), văn bản cần thử lại tệp lỗi sau — một văn bản lỗi không chặn cả lượt
  ds.sort((a, b) => (kho.has(a.id) - kho.has(b.id)) || (b.ngay - a.ngay));
  return xuLyDs(ds, { ...o, kq, dem, het });
}

const taoKq = () => ({ ok: true, moi: 0, capNhat: 0, tep: 0, loiTep: 0, loi: [], hetGioiHan: false, dung: false });
function boDem(kq, gioiHan = {}) {
  const maxCalls = gioiHan.maxCalls || 300, maxFiles = gioiHan.maxFiles || 100;
  let calls = 0;
  return { dem: () => { calls++; }, het: () => calls >= maxCalls || kq.tep >= maxFiles };
}
const tepXong = t => t.method && (!t.loiTai || soLanThu(t) >= MAX_THU);
/** Đã có đủ nội dung (hoặc là văn bản mật)? Văn bản mới chỉ có danh sách thì chưa. */
const daXong = (kho, id) => { const v = kho.get(id); return !!v && !v.chuaChiTiet && (v.doMat || (v.tep || []).every(tepXong)); };
/** Mã cần để gọi chi tiết văn bản sau này. */
const rutGon = x => { const o = {}; for (const k of ['ma_van_ban_den_kc', 'ma_xu_ly_den', 'ma_van_ban_di_kc']) if (x[k] != null) o[k] = x[k]; return o; };

/** Quét nền 0.2.0: chỉ lưu số ký hiệu, ngày, cơ quan, trích yếu + mã văn bản; không gọi chi tiết, không tải tệp. */
function luuDanhSach(ds, kho, taiKhoan, kq) {
  for (const d of ds) {
    const cu = kho.get(d.id);
    if (cu) {
      if (!cu.taiKhoan.includes(taiKhoan)) { kho.upsert({ ...cu, taiKhoan: [taiKhoan] }); kq.capNhat++; }
      continue;
    }
    const x = d.x;
    kho.upsert({
      id: d.id, chieu: d.chieu, soKyHieu: x.so_ky_hieu || '',
      ngayBanHanh: fmtDate(x.ngay_ban_hanh || (d.chieu === 'di' ? x.ngay_di : (x.ngay_nhan || x.ngay_den))),
      coQuan: x.ten_co_quan_ban_hanh || (d.chieu === 'di' ? 'Sở Nông nghiệp và Môi trường' : ''),
      loai: x.ten_loai_van_ban || '', trichYeu: x.trich_yeu || '',
      taiKhoan: [taiKhoan], doMat: false, tep: [], trang: [], chuaChiTiet: true, nguon: rutGon(x), capNhat: new Date().toISOString()
    });
    kq.moi++;
  }
  kho.save();
  return kq;
}

/** Tải chi tiết + tệp cho các văn bản được chọn (đã có trong kho từ danh sách). */
async function layChiTiet(o) {
  const { io, kho, ids } = o;
  const kq = taoKq();
  const { dem, het } = boDem(kq, o.gioiHan);
  const me = await io.whoAmI().catch(() => null);
  if (!me) return { ...kq, ok: false, loi: [{ so: '', msg: 'CHUA_DANG_NHAP' }] };
  fs.mkdirSync(o.tamDir, { recursive: true });
  const ds = ids.map(id => kho.get(id)).filter(v => v && v.nguon && !daXong(kho, v.id)).map(v => ({
    id: v.id, chieu: v.chieu, ngay: parseNgay(v.ngayBanHanh) || 0,
    x: { ...v.nguon, so_ky_hieu: v.soKyHieu, trich_yeu: v.trichYeu, ngay_ban_hanh: v.ngayBanHanh, ten_co_quan_ban_hanh: v.coQuan, ten_loai_van_ban: v.loai }
  }));
  return xuLyDs(ds, { ...o, kq, dem, het });
}

async function xuLyDs(ds, { io, kho, taiKhoan, tamDir, thuMucQuetVanBan, giuTep, gioiHan = {}, kq, dem, het, nenDung = () => false, onTienDo = () => {}, log = () => {} }) {
  /** Lỗi có phải do mất phiên? TIMEOUT thì hỏi lại trang: còn đăng nhập → chỉ là lỗi của tệp/văn bản này. */
  const matPhien = async e => {
    if (loiPhien(e)) return true;
    if (!/TIMEOUT/.test(String(e && e.message || e))) return false;
    const who = await Promise.resolve(io.whoAmI(8000)).catch(() => null);
    return !who;
  };

  let i = 0;
  for (const d of ds) {
    if (nenDung()) { kq.dung = true; break; }
    if (het()) { kq.hetGioiHan = true; break; }
    onTienDo({ buoc: 'van-ban', da: i, tong: ds.length });
    try {
      dem();
      const ct = d.chieu === 'den' ? await io.chiTiet(d.x.ma_van_ban_den_kc, d.x.ma_xu_ly_den) : await io.chiTietVanBanDi(d.x.ma_van_ban_di_kc);
      const c = ct || {};
      const cu = kho.get(d.id);
      const vb = {
        id: d.id, chieu: d.chieu,
        soKyHieu: c.so_ky_hieu || d.x.so_ky_hieu || '',
        ngayBanHanh: fmtDate(c.ngay_ban_hanh || c.ngay_ban_hanh_out || d.x.ngay_ban_hanh || d.x.ngay_di),
        coQuan: c.ten_co_quan_ban_hanh || d.x.ten_co_quan_ban_hanh || (d.chieu === 'di' ? 'Sở Nông nghiệp và Môi trường' : ''),
        loai: c.ten_loai_van_ban || d.x.ten_loai_van_ban || '',
        trichYeu: c.trich_yeu || d.x.trich_yeu || '',
        taiKhoan: [taiKhoan], doMat: laMatCT(ct), tep: [], trang: [], nguon: rutGon(d.x), capNhat: new Date().toISOString()
      };
      onTienDo({ buoc: 'van-ban', da: i, tong: ds.length, so: vb.soKyHieu });
      if (!vb.doMat) {
        const soNum = (vb.soKyHieu.match(/\d+/) || [''])[0];
        const ban = timTepQuetVanBan(thuMucQuetVanBan, vb);
        let daDungBan = false;
        const dsTep = splitFiles(c.file_van_ban || d.x.file_van_ban || c.file_dinh_kem);
        for (let ti = 0; ti < dsTep.length; ti++) {
          const p = dsTep[ti];
          const name = fileName(p);
          const idx = vb.tep.length;
          // lượt trước đã đọc xong tệp này → giữ nguyên, không tải lại
          const tCu = cu && (cu.tep || []).findIndex(t => t.path === p);
          if (cu && tCu >= 0 && tepXong(cu.tep[tCu])) {
            vb.tep.push(cu.tep[tCu]);
            cu.trang.filter(t => t.tep === tCu).forEach(t => vb.trang.push({ ...t, tep: idx }));
            continue;
          }
          const thuCu = cu && tCu >= 0 ? soLanThu(cu.tep[tCu]) : 0;
          const tep = { name, path: p, method: '', canOcr: false, ocrDone: false };
          if (nenDung()) { kq.dung = true; tep.loiTai = true; tep.thu = thuCu; vb.tep.push(tep); continue; }
          let buf = null, tam = null;
          const t0 = Date.now();
          try {
            if (ban && !daDungBan && /\.pdf$/i.test(name) && soNum && name.includes(soNum)) {
              buf = fs.readFileSync(ban); daDungBan = true; tep.nguon = 'quetvanban';
            } else if (/\.(pdf|docx?|xlsx)$/i.test(name)) {
              if (het()) { kq.hetGioiHan = true; tep.loiTai = true; tep.thu = thuCu; vb.tep.push(tep); continue; }
              onTienDo({ buoc: 'tep', da: i, tong: ds.length, so: vb.soKyHieu, tep: name, tepThu: ti + 1, tepTong: dsTep.length });
              dem(); buf = await io.downloadFile(p, name, { maxMB: gioiHan.maxMB }); kq.tep++;
              tam = path.join(tamDir, `${Date.now()}-${kq.tep}${path.extname(name).slice(0, 6)}`);
              fs.writeFileSync(tam, buf);
            }
            if (buf) {
              const r = await readAny(buf, name);
              tep.method = r.method; tep.canOcr = r.canOcr; if (r.error) tep.error = r.error;
              r.pages.forEach((text, k) => { if (text && text.trim()) vb.trang.push({ tep: idx, so: k + 1, text }); });
              if (giuTep && (giuTep.loai || []).includes(vb.loai) && tep.nguon !== 'quetvanban') giuTepGoc(kho.dir, `${safeFileBase(vb.soKyHieu, vb.ngayBanHanh)}-${name}`, buf, giuTep);
              const giay = (Date.now() - t0) / 1000;
              if (giay >= 5) log('info', `${vb.soKyHieu}: tệp ${name} (${Math.round(buf.length / 1024)} KB) mất ${giay.toFixed(0)} giây.`);
            } else tep.method = 'none';
          } catch (e) {
            if (await matPhien(e)) throw e;
            const msg = String(e.message || e);
            tep.method = 'none'; tep.error = msg.slice(0, 200);
            if (/QUA_LON/.test(msg)) { tep.boQua = 'qua-lon'; log('info', `${vb.soKyHieu}: bỏ qua tệp ${name} — ${msg.replace('QUA_LON', 'quá lớn')}.`); }
            else { tep.loiTai = true; tep.thu = thuCu + 1; kq.loiTep++; log('warn', `${vb.soKyHieu}: lỗi tải tệp ${name} (lần ${tep.thu}/${MAX_THU}): ${msg.slice(0, 120)}`); }
          } finally {
            if (tam) { try { fs.unlinkSync(tam); } catch { /* đã xóa */ } }
          }
          vb.tep.push(tep);
        }
      }
      kho.upsert(vb);
      cu ? kq.capNhat++ : kq.moi++;
      if (kq.dung) break;
    } catch (e) {
      kq.loi.push({ so: d.x.so_ky_hieu || d.id, msg: String(e.message || e).slice(0, 200) });
      log('warn', `Lỗi thu thập ${d.id}: ${e.message}`);
      if (await matPhien(e)) { kq.ok = false; break; }
    }
    if (++i % 20 === 0) kho.save();
  }
  kho.save();
  return kq;
}

module.exports = { thuThap, layChiTiet, loiPhien, splitFiles, fileName, safeFileBase, fmtDate, laMat, laMatCT };
