'use strict';
/**
 * Phiên làm báo cáo: nạp đề cương / chủ đề, phân tích (tổng hợp trích đoạn), lựa chọn của người dùng, xuất tệp.
 * Lựa chọn của người dùng (bật/tắt mục, từ khóa thêm, ghim, bỏ chọn trích đoạn, văn AI) không bị phân tích lại ghi đè.
 */
const fs = require('fs');
const path = require('path');
const { readAny } = require('../docread');
const { parseDeCuong, parseChuDe } = require('../decuong');
const { tongHop, danhMucVanBan } = require('../tonghop');
const { docKhung, xuatBaoCao, xuatDuLieuTho, xuatDuLieuThoDocx } = require('../xuatword');
const { boDau } = require('../vntext');

const khoaTrich = t => t.vbId + '|' + boDau(t.text).toLowerCase().slice(0, 80);
const timMuc = (ds, id) => { for (const m of ds) { if (m.id === id) return m; const c = timMuc(m.con, id); if (c) return c; } return null; };
const pad = n => String(n).padStart(2, '0');

class PhienBaoCao {
  constructor({ store, kho, now = () => new Date() }) { Object.assign(this, { store, kho, now }); }

  get bc() { return this.store.data.baoCao; }

  batDau(dc, nguon) {
    const nam = dc.nam || this.now().getFullYear();
    this.store.data.baoCao = {
      dc, nguon, tuNgay: `01/01/${nam}`, denNgay: `31/12/${nam}`,
      trichYeu: dc.trichYeu, kinhGui: 'Sở Tài chính',
      moDau: dc.trichYeu ? `Thực hiện …, Sở Nông nghiệp và Môi trường báo cáo ${dc.trichYeu.charAt(0).toLowerCase() + dc.trichYeu.slice(1)} như sau:` : '',
      ketQua: {}, danhMuc: [], boChon: [], vanBanAi: {}
    };
    this.store.save();
    return this.bc;
  }

  async napDeCuong(buf, name) {
    const r = await readAny(buf, name);
    if (!r.blocks) throw new Error(r.error || 'Chỉ nạp được đề cương Word (.docx, .doc).');
    return this.batDau(parseDeCuong(r.blocks), name);
  }

  napChuDe(text, soKyHieu) { return this.batDau(parseChuDe(text, soKyHieu), 'Chủ đề gõ tay'); }

  async napBieuMau(buf, name, mucId) {
    const r = await readAny(buf, name);
    if (r.method !== 'xlsx') throw new Error(r.error || 'Biểu mẫu phải là tệp Excel (.xlsx).');
    const cha = mucId ? timMuc(this.bc.dc.muc, mucId) : null;
    const ds = cha ? cha.con : this.bc.dc.phuLuc;
    r.pages.forEach((text, i) => {
      const rows = text.split('\n').map(l => l.split(' | '));
      ds.push({ id: `bm${Date.now()}${i}`, so: '-', cap: cha ? cha.cap + 1 : 1, tieuDe: `${path.basename(name)} — biểu ${i + 1}`, moTa: [], chiDan: [], donViDeNghi: [], dang: 'bangSoLieu', bat: true, bang: rows, tuKhoaThem: [], ghim: [], con: [] });
    });
    this.store.save();
    return this.bc;
  }

  capNhatMuc(id, patch) {
    const m = timMuc(this.bc.dc.muc, id) || timMuc(this.bc.dc.phuLuc, id);
    if (!m) throw new Error('Không thấy mục');
    for (const k of ['bat', 'tuKhoaThem', 'ghim', 'dang', 'tieuDe']) if (k in patch) m[k] = patch[k];
    this.store.save();
    return m;
  }

  capNhatPhien(patch) {
    for (const k of ['tuNgay', 'denNgay', 'trichYeu', 'kinhGui', 'moDau']) if (k in patch) this.bc[k] = patch[k];
    this.store.save();
  }

  chonTrich(mucId, n, chon) {
    const t = ((this.bc.ketQua[mucId] || {}).trichDoan || []).find(x => x.n === n);
    if (!t) return;
    t.chon = !!chon;
    const k = khoaTrich(t);
    this.bc.boChon = this.bc.boChon.filter(x => x !== k);
    if (!chon) this.bc.boChon.push(k);
    this.store.save();
  }

  phanTich() {
    const bc = this.bc;
    const ketQua = tongHop(bc.dc, this.kho, { tuNgay: bc.tuNgay, denNgay: bc.denNgay });
    const bo = new Set(bc.boChon);
    for (const kq of Object.values(ketQua)) for (const t of kq.trichDoan) if (bo.has(khoaTrich(t))) t.chon = false;
    bc.ketQua = ketQua;
    bc.danhMuc = danhMucVanBan(bc.dc, this.kho, { tuNgay: bc.tuNgay, denNgay: bc.denNgay });
    this.store.save();
    return bc;
  }

  datVanAi(mucId, van) { if (van) this.bc.vanBanAi[mucId] = van; else delete this.bc.vanBanAi[mucId]; this.store.save(); }

  async xuat({ khungBuf, thuMuc, kinhGui, trichYeu, moDau }) {
    const bc = this.bc;
    if (kinhGui !== undefined || trichYeu !== undefined || moDau !== undefined) this.capNhatPhien({ ...(kinhGui !== undefined && { kinhGui }), ...(trichYeu !== undefined && { trichYeu }), ...(moDau !== undefined && { moDau }) });
    const d = this.now();
    const ten = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    fs.mkdirSync(thuMuc, { recursive: true });
    const out = { baoCao: path.join(thuMuc, `BaoCao-${ten}.docx`), duLieuTho: path.join(thuMuc, `DuLieuTho-${ten}.docx`), duLieuThoMd: path.join(thuMuc, `DuLieuTho-${ten}.md`) };
    const buf = await xuatBaoCao(await docKhung(khungBuf), { dc: bc.dc, ketQua: bc.ketQua, danhMuc: bc.danhMuc, kinhGui: bc.kinhGui, trichYeu: bc.trichYeu, moDau: bc.moDau, vanBanAi: bc.vanBanAi });
    const { md } = xuatDuLieuTho({ dc: bc.dc, ketQua: bc.ketQua, danhMuc: bc.danhMuc });
    fs.writeFileSync(out.baoCao, buf, { flag: 'wx' });
    fs.writeFileSync(out.duLieuTho, await xuatDuLieuThoDocx(md), { flag: 'wx' });
    fs.writeFileSync(out.duLieuThoMd, md, { flag: 'wx' });
    return out;
  }
}

module.exports = { PhienBaoCao, timMuc };
