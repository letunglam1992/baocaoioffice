'use strict';
/** Vỏ Electron: một phiên bản, khay hệ thống, tự khởi động, lịch quét nền, OCR lúc rảnh, IPC cho giao diện. */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Notification, shell, nativeImage, dialog, ipcMain, powerMonitor } = require('electron');
const { IOffice, partitionFor } = require('./ioffice');
const { cleanUserAgent } = require('./useragent');
const { Store } = require('./store');
const { Kho } = require('./kho');
const { DieuPhoi } = require('./app/dieuphoi');
const { PhienBaoCao } = require('./app/baocao');
const { createTray } = require('./app/tray');
const { denHan, buKhiMoMay } = require('./lich');
const { tinhChinhMuc } = require('./ai');
const { readAny } = require('./docread');
const { boDau } = require('./vntext');
const pdf = require('./pdftext');

const APP_ID = 'vn.sonla.snnmt.baocao-ioffice';
app.setAppUserModelId(APP_ID);
if (process.env.BCIO_USERDATA) app.setPath('userData', process.env.BCIO_USERDATA);
const laSelfTest = process.argv.includes('--self-test');
if (!laSelfTest && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.userAgentFallback = cleanUserAgent(app.userAgentFallback);

let store, kho, dp, phien, tray, mainWin, quitting = false;
const ios = new Map();
const startedAt = Date.now();
const userData = () => app.getPath('userData');
const tamDir = () => path.join(userData(), 'tam');
const icon = () => nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'));
const khoDir = () => store.data.caiDat.khoDir || path.join(process.env.LOCALAPPDATA || userData(), 'BaoCaoIOffice', 'kho');

function notify(title, body) { try { new Notification({ title, body, icon: icon() }).show(); } catch { /* không hỗ trợ */ } }
function log(level, msg) { store.log(level, msg); }

function taoIo(id) {
  if (!ios.has(id)) ios.set(id, new IOffice({ partition: partitionFor(id), log }));
  return ios.get(id);
}

function trangThai() {
  const bc = store.data.baoCao;
  return {
    phienBan: app.getVersion(),
    caiDat: store.data.caiDat,
    taiKhoan: Object.entries(store.data.taiKhoan).map(([id, t]) => ({ id, ...t })),
    kho: kho.thongKe(), khoDir: khoDir(),
    dangChay: dp.dangChay, lastRunAt: store.data.lastRunAt,
    baoCao: bc, nhatKy: store.data.log.slice(-200)
  };
}
function push() { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('trangThai', trangThai()); }

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600, show: false, title: 'Tổng hợp báo cáo iOffice', icon: icon(), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWin.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWin.on('close', e => { if (!quitting) { e.preventDefault(); mainWin.hide(); } });
  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}
function showMain() { mainWin.show(); mainWin.focus(); push(); }

async function chayLuot(lyDo) {
  const r = await dp.chayLuot({ lyDo });
  push();
  return r;
}

function hen() {
  setInterval(async () => {
    try {
      const S = store.data.caiDat;
      const now = Date.now();
      if (!dp.dangChay && Object.keys(store.data.taiKhoan).length && buKhiMoMay(startedAt, now, S.buSauPhut) &&
        denHan({ lich: S.lich, lastRunAt: store.data.lastRunAt, lastFailAt: store.data.lastFailAt, thuLaiPhut: S.thuLaiPhut, now })) {
        await chayLuot(store.data.lastRunAt ? 'lich' : 'dau');
      } else if (!dp.dangChay && S.ocrLucRanh && powerMonitor.getSystemIdleTime() >= 300) {
        const n = await dp.ocrLucRanh({ gioiHanTrang: 10, soTep: 2 });
        if (n) { log('info', `OCR lúc rảnh: ${n} tệp.`); store.save(); push(); }
      }
    } catch (e) { log('error', 'Lịch: ' + e.message); }
  }, 60000);
}

function dongBoKhoiDong() {
  if (!app.isPackaged || process.env.BCIO_USERDATA) return;
  app.setLoginItemSettings({ openAtLogin: !!store.data.caiDat.tuKhoiDong, args: ['--an'] });
}

function donTam() { // cách lưu B: không để tệp tạm sót lại
  try { fs.rmSync(tamDir(), { recursive: true, force: true }); } catch { /* bỏ qua */ }
  fs.mkdirSync(tamDir(), { recursive: true });
}

function dangKyIpc() {
  const h = (k, fn) => ipcMain.handle(k, async (_e, ...a) => {
    try { const r = await fn(...a); push(); return { ok: true, r }; } catch (e) { log('error', `${k}: ${e.message}`); return { ok: false, loi: e.message }; }
  });
  h('trangThai', () => trangThai());
  h('taiKhoan.them', ten => {
    const t = String(ten || '').trim(); if (!t) throw new Error('Nhập tên gợi nhớ cho tài khoản.');
    let id = boDau(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tk';
    while (store.data.taiKhoan[id]) id += '-2';
    store.data.taiKhoan[id] = { ten: t }; store.save(); return id;
  });
  h('taiKhoan.xoa', id => { delete store.data.taiKhoan[id]; const io = ios.get(id); if (io) { io.destroy(); ios.delete(id); } store.save(); });
  h('taiKhoan.dangNhap', async id => {
    const who = await taoIo(id).interactiveLogin();
    if (who) { store.data.taiKhoan[id].hoTen = who.ho_ten; store.data.taiKhoan[id].loi = null; store.save(); }
    return !!who;
  });
  h('quet.ngay', () => { chayLuot('tay'); return true; });
  h('quet.dung', () => dp.dung());
  h('kho.tim', (q, o) => kho.tim(q, o || {}).map(({ vb, score }) => ({ score, id: vb.id, chieu: vb.chieu, soKyHieu: vb.soKyHieu, ngay: vb.ngayBanHanh, coQuan: vb.coQuan, trichYeu: vb.trichYeu, taiKhoan: vb.taiKhoan })));
  h('kho.layTheoSo', so => dp.layTheoSo(so).then(ds => ds.map(v => ({ id: v.id, soKyHieu: v.soKyHieu, ngay: v.ngayBanHanh, trichYeu: v.trichYeu }))));
  h('kho.moGoc', async id => {
    const v = kho.get(id); if (!v) throw new Error('Không thấy văn bản trong kho.');
    if (v.doMat) throw new Error('Văn bản có độ mật — không tải tự động.');
    const tep = v.tep.find(t => /\.pdf$/i.test(t.name)) || v.tep[0];
    if (!tep) throw new Error('Văn bản không có tệp.');
    const buf = await taoIo(v.taiKhoan[0]).downloadFile(tep.path, tep.name);
    const f = path.join(tamDir(), `${Date.now()}-${tep.name.replace(/[<>:"\/\\|?*\x00-\x1f]/g, '_')}`);
    fs.writeFileSync(f, buf);
    await shell.openPath(f);
  });
  h('baoCao.chonTep', async loai => {
    const r = await dialog.showOpenDialog(mainWin, { properties: ['openFile'], filters: loai === 'xlsx' ? [{ name: 'Excel', extensions: ['xlsx'] }] : [{ name: 'Word', extensions: ['docx', 'doc'] }] });
    return r.canceled ? null : r.filePaths[0];
  });
  h('baoCao.napDeCuong', p => phien.napDeCuong(fs.readFileSync(p), p));
  h('baoCao.napBieuMau', (p, mucId) => phien.napBieuMau(fs.readFileSync(p), p, mucId));
  h('baoCao.napChuDe', (text, so) => phien.napChuDe(text, so));
  h('baoCao.phanTich', patch => { if (patch) phien.capNhatPhien(patch); return phien.phanTich(); });
  h('baoCao.capNhatMuc', (id, patch) => phien.capNhatMuc(id, patch));
  h('baoCao.chonTrich', (mucId, n, chon) => phien.chonTrich(mucId, n, chon));
  h('baoCao.tinhChinh', async mucId => {
    const S = store.data.caiDat.ai;
    if (!S.bat) throw new Error('Chưa bật tinh chỉnh bằng AI trong Cài đặt.');
    const { timMuc } = require('./app/baocao');
    const bc = store.data.baoCao;
    const m = timMuc(bc.dc.muc, mucId);
    const r = await tinhChinhMuc(m, bc.dc, bc.ketQua[mucId] || { trichDoan: [] }, { diaChi: S.diaChi, kho, khongGui: S.khongGui });
    if (!r.ok) throw new Error(r.loi);
    phien.datVanAi(mucId, r.van);
    log('info', `AI tinh chỉnh mục «${m.tieuDe}» (${r.model || 'không rõ mô hình'})${r.soLa.length ? `, ${r.soLa.length} số cần kiểm tra` : ''}.`);
    return r;
  });
  h('baoCao.xuat', async o => {
    const thuMuc = path.join(app.getPath('documents'), 'BaoCaoIOffice');
    const khungP = store.data.caiDat.khung && fs.existsSync(store.data.caiDat.khung) ? store.data.caiDat.khung : path.join(__dirname, '..', 'assets', 'khung-bao-cao.docx');
    const r = await phien.xuat({ ...(o || {}), khungBuf: fs.readFileSync(khungP), thuMuc });
    log('info', `Đã xuất báo cáo: ${path.basename(r.baoCao)}`);
    shell.showItemInFolder(r.baoCao);
    return r;
  });
  h('baoCao.moThuMuc', p => shell.showItemInFolder(p));
  h('caiDat.ghi', patch => {
    const S = store.data.caiDat;
    for (const k of Object.keys(patch || {})) S[k] = (k === 'ai' || k === 'giuTep') ? { ...S[k], ...patch[k] } : patch[k];
    store.save(); dongBoKhoiDong();
    if ('khoDir' in (patch || {})) kho = dp.kho = phien.kho = Kho.load(khoDir());
    return S;
  });
  h('caiDat.chonThuMuc', async () => { const r = await dialog.showOpenDialog(mainWin, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  h('ghiNhan.bat', id => taoIo(id).batGhiNhan());
  h('ghiNhan.lay', async id => {
    const ds = await taoIo(id).layGhiNhan();
    const f = path.join(userData(), 'api-ghi-nhan.json');
    let cu = []; try { cu = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* chưa có */ }
    const { gopGhiNhan } = require('./ghinhan');
    fs.writeFileSync(f, JSON.stringify(gopGhiNhan([...cu, ...ds]), null, 1));
    shell.showItemInFolder(f);
    return { tep: f, so: ds.length };
  });
}

async function selfTest() {
  const i = process.argv.indexOf('--self-test');
  const [inp, outp] = [process.argv[i + 1], process.argv[i + 2]];
  try {
    const buf = fs.readFileSync(inp);
    let r = await readAny(buf, inp);
    let method = r.method, text = r.pages.join('\n');
    if (r.canOcr) { const o = await pdf.readPdf(buf, { maxPages: 3 }); method = o.method; text = o.text; }
    fs.writeFileSync(outp, JSON.stringify({ ok: true, method, head: text.slice(0, 300) }, null, 1));
  } catch (e) { fs.writeFileSync(outp, JSON.stringify({ ok: false, error: String(e && e.stack || e) })); }
  await pdf.shutdown().catch(() => {});
  app.exit(0);
}

app.on('second-instance', () => { if (mainWin) showMain(); });
app.on('window-all-closed', e => e.preventDefault && e.preventDefault());

app.whenReady().then(async () => {
  pdf.setDataDir(path.join(userData(), 'ocr'));
  if (laSelfTest) return selfTest();
  store = new Store(path.join(userData(), 'data'));
  kho = Kho.load(khoDir());
  donTam();
  dp = new DieuPhoi({
    store, kho, taoIo, log, tamDir: tamDir(), caiDat: () => store.data.caiDat,
    thongBao: m => notify('Tổng hợp báo cáo iOffice', m),
    ocrFn: (buf, o) => pdf.readPdf(buf, o),
    onTienDo: p => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('tienDo', p); }
  });
  phien = new PhienBaoCao({ store, kho });
  dangKyIpc();
  createMainWindow();
  tray = createTray({ icon: icon(), on: { show: showMain, scan: () => chayLuot('tay'), quit: () => { quitting = true; app.quit(); } } });
  dongBoKhoiDong();
  log('info', `Khởi động (phiên bản ${app.getVersion()}); kho: ${khoDir()}.`);
  store.save();
  if (process.env.BCIO_SNAPSHOT) {
    mainWin.show();
    mainWin.webContents.once('did-finish-load', () => require('./app/snapshot').chup(mainWin, process.env.BCIO_SNAPSHOT, () => { quitting = true; app.quit(); }));
    return;
  }
  if (!process.argv.includes('--an')) mainWin.once('ready-to-show', () => mainWin.show());
  hen();
});

app.on('before-quit', () => { quitting = true; for (const io of ios.values()) { io.quitting = true; } try { kho && kho.save(); store && store.save(); } catch { /* bỏ qua */ } });
