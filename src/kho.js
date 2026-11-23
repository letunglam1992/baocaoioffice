'use strict';
/**
 * Kho văn bản cục bộ, chia theo năm:
 *   <dir>/<năm>/meta.ndjson     — metadata (không có chữ), nạp hết khi mở kho
 *   <dir>/<năm>/noidung.ndjson  — chữ theo trang {id, trang}, nạp lười
 *   <dir>/<năm>/chimuc.json     — chỉ mục MiniSearch, nạp lười
 * Văn bản có độ mật: không giữ chữ, không vào chỉ mục.
 */
const fs = require('fs');
const path = require('path');
const MiniSearch = require('minisearch');
const { tachTu, boDau } = require('./vntext');

const MS_OPTS = {
  idField: 'id',
  fields: ['soKyHieu', 'trichYeu', 'noiDung'],
  tokenize: s => tachTu(boDau(s)),
  processTerm: t => boDau(t).toLowerCase(),
  searchOptions: { boost: { soKyHieu: 4, trichYeu: 2 }, prefix: true, fuzzy: 0.1, combineWith: 'OR' }
};

const parseNgay = s => { const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : null; };
const chuanSo = s => boDau(String(s || '')).toLowerCase().replace(/\s+/g, '');

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
function readNdjson(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

class Kho {
  constructor(dir) {
    this.dir = dir;
    this.meta = new Map();      // id → VanBan (trang không giữ ở đây)
    this.noiDung = new Map();   // năm → Map(id → trang[])
    this.chiMuc = new Map();    // năm → MiniSearch
    this.namCua = new Map();    // id → năm
    this.ban = new Set();       // năm có thay đổi chưa lưu
  }

  static load(dir) {
    const k = new Kho(dir);
    if (!fs.existsSync(dir)) return k;
    for (const nam of fs.readdirSync(dir).filter(n => /^\d{4}$/.test(n))) {
      for (const v of readNdjson(path.join(dir, nam, 'meta.ndjson'))) { k.meta.set(v.id, v); k.namCua.set(v.id, +nam); }
    }
    return k;
  }

  namOf(vb) {
    const n = parseNgay(vb.ngayBanHanh);
    if (n) return Math.floor(n / 10000);
    const d = new Date(vb.capNhat || Date.now());
    return isNaN(d) ? new Date().getFullYear() : d.getFullYear();
  }

  nd(nam) {
    if (!this.noiDung.has(nam)) {
      const m = new Map();
      for (const r of readNdjson(path.join(this.dir, String(nam), 'noidung.ndjson'))) m.set(r.id, r.trang);
      this.noiDung.set(nam, m);
    }
    return this.noiDung.get(nam);
  }

  idx(nam) {
    if (!this.chiMuc.has(nam)) {
      const f = path.join(this.dir, String(nam), 'chimuc.json');
      let ms = null;
      if (fs.existsSync(f)) { try { ms = MiniSearch.loadJSON(fs.readFileSync(f, 'utf8'), MS_OPTS); } catch { ms = null; } }
      if (!ms) { // dựng lại từ dữ liệu
        ms = new MiniSearch(MS_OPTS);
        const nd = this.nd(nam);
        for (const [id, v] of this.meta) if (this.namCua.get(id) === nam && !v.doMat) ms.add(this.docIdx(v, nd.get(id) || []));
      }
      this.chiMuc.set(nam, ms);
    }
    return this.chiMuc.get(nam);
  }

  docIdx(v, trang) {
    return { id: v.id, soKyHieu: v.soKyHieu || '', trichYeu: v.trichYeu || '', noiDung: trang.map(t => t.text).join('\n') };
  }

  has(id) { return this.meta.has(id); }

  get(id) {
    const v = this.meta.get(id);
    if (!v) return null;
    return { ...v, trang: v.doMat ? [] : (this.nd(this.namCua.get(id)).get(id) || []) };
  }

  upsert(vb) {
    const cu = this.get(vb.id);
    const nam = this.namOf(vb);
    const taiKhoan = [...new Set([...(cu ? cu.taiKhoan : []), ...(vb.taiKhoan || [])])];
    const trang = vb.doMat ? [] : ((vb.trang && vb.trang.length) ? vb.trang : (cu ? cu.trang : []));
    const { trang: _bo, ...meta } = { ...vb, taiKhoan };
    if (cu && this.namCua.get(vb.id) !== nam) { // đổi năm → gỡ khỏi phân mảnh cũ
      const namCu = this.namCua.get(vb.id);
      this.nd(namCu).delete(vb.id);
      const ic = this.idx(namCu); if (ic.has(vb.id)) ic.discard(vb.id);
      this.ban.add(namCu);
    }
    this.meta.set(vb.id, meta);
    this.namCua.set(vb.id, nam);
    const nd = this.nd(nam);
    if (trang.length) nd.set(vb.id, trang); else nd.delete(vb.id);
    const ix = this.idx(nam);
    if (ix.has(vb.id)) ix.discard(vb.id);
    if (!meta.doMat) ix.add(this.docIdx(meta, trang));
    this.ban.add(nam);
  }

  timTheoSo(soKyHieu) {
    const q = chuanSo(soKyHieu);
    if (!q) return [];
    return [...this.meta.values()].filter(v => chuanSo(v.soKyHieu) === q).map(v => this.get(v.id));
  }

  cacNam(tuNgay, denNgay) {
    const all = [...new Set(this.namCua.values())].sort();
    const a = parseNgay(tuNgay), b = parseNgay(denNgay);
    return all.filter(n => (!a || n >= Math.floor(a / 10000)) && (!b || n <= Math.floor(b / 10000)));
  }

  tim(query, { tuNgay, denNgay, chieu, limit = 50 } = {}) {
    const a = parseNgay(tuNgay), b = parseNgay(denNgay);
    const out = [];
    for (const nam of this.cacNam(tuNgay, denNgay)) {
      for (const r of this.idx(nam).search(String(query || ''))) {
        const v = this.meta.get(r.id);
        if (!v || v.doMat) continue;
        if (chieu && v.chieu !== chieu) continue;
        const n = parseNgay(v.ngayBanHanh);
        if (n && ((a && n < a) || (b && n > b))) continue;
        out.push({ vb: this.get(r.id), score: r.score });
      }
    }
    return out.sort((x, y) => y.score - x.score).slice(0, limit);
  }

  canOcr(limit = 10) {
    const out = [];
    for (const v of this.meta.values()) {
      if (v.doMat) continue;
      (v.tep || []).forEach((t, i) => { if (t.canOcr && !t.ocrDone && out.length < limit) out.push({ vb: this.get(v.id), tepIdx: i }); });
      if (out.length >= limit) break;
    }
    return out;
  }

  thongKe() {
    let mat = 0, choOcr = 0, coNoiDung = 0;
    for (const v of this.meta.values()) {
      if (v.doMat) mat++;
      else if (!v.chuaChiTiet) coNoiDung++;
      choOcr += (v.tep || []).filter(t => t.canOcr && !t.ocrDone).length;
    }
    return { tong: this.meta.size, coNoiDung, mat, choOcr, nam: this.cacNam() };
  }

  save() {
    for (const nam of this.ban) {
      const d = path.join(this.dir, String(nam));
      const ids = [...this.namCua].filter(([, n]) => n === nam).map(([id]) => id);
      writeAtomic(path.join(d, 'meta.ndjson'), ids.map(id => JSON.stringify(this.meta.get(id))).join('\n') + '\n');
      const nd = this.nd(nam);
      writeAtomic(path.join(d, 'noidung.ndjson'), ids.filter(id => nd.has(id)).map(id => JSON.stringify({ id, trang: nd.get(id) })).join('\n') + '\n');
      writeAtomic(path.join(d, 'chimuc.json'), JSON.stringify(this.idx(nam)));
    }
    this.ban.clear();
  }
}

module.exports = { Kho, parseNgay };
