'use strict';
/**
 * Trích chữ từ PDF (lớp chữ của văn bản ký số) và OCR cục bộ cho bản scan/sao y.
 * Chạy hoàn toàn trên máy — không gửi dữ liệu ra ngoài.
 *
 *  - Lớp chữ: pdf.js (legacy build cho Node), ghép các mảnh chữ theo tọa độ để giữ đúng xuống dòng/khoảng trắng.
 *  - Bản scan: lấy trực tiếp ảnh nhúng trong trang (pdf.js tự giải mã JPEG), mã hóa PNG, OCR bằng Tesseract (tiếng Việt).
 */
const path = require('path');
const { PNG } = require('pngjs');

let pdfjsPromise = null;
function pdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

const MIN_CHARS_PER_PAGE = 40; // dưới ngưỡng này coi như trang không có lớp chữ

/** Ghép các text item của một trang thành văn bản có xuống dòng. */
function joinItems(items) {
  let out = '';
  let prev = null;
  for (const it of items) {
    if (!it.str && !it.hasEOL) continue;
    const x = it.transform[4], y = it.transform[5];
    const h = Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10;
    if (prev) {
      const sameLine = Math.abs(y - prev.y) < Math.max(2, h * 0.5);
      if (!sameLine) out += '\n';
      else {
        const gap = x - (prev.x + prev.w);
        if (gap > h * 0.15 && !/\s$/.test(out) && !/^\s/.test(it.str)) out += ' ';
      }
    }
    out += it.str;
    prev = { x, y, w: it.width, h };
    if (it.hasEOL) { out += '\n'; prev = null; }
  }
  return out.replace(/[ \t]+\n/g, '\n');
}

let soLanMo = 0; // chỉ dùng cho kiểm thử: đếm số lần mở tài liệu PDF
async function loadDoc(buf) {
  const lib = await pdfjs();
  soLanMo++;
  const data = buf instanceof Uint8Array ? new Uint8Array(buf) : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return lib.getDocument({ data, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
}

/** Mở PDF, chạy fn(doc) rồi luôn giải phóng tài liệu (kể cả khi lỗi). */
async function withDoc(buf, fn) {
  const doc = await loadDoc(buf);
  try { return await fn(doc); } finally { await doc.destroy(); }
}

async function textFromDoc(doc, maxPages) {
  const pages = [];
  const n = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(joinItems(tc.items));
    page.cleanup();
  }
  const chars = pages.reduce((a, s) => a + s.replace(/\s/g, '').length, 0);
  return { pages, numPages: doc.numPages, hasTextLayer: chars >= MIN_CHARS_PER_PAGE * Math.max(1, Math.min(n, 2)) };
}

async function imagesFromDoc(doc, maxPages) {
  const lib = await pdfjs();
  const out = [];
  const n = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const ops = await page.getOperatorList();
    let best = null;
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== lib.OPS.paintImageXObject) continue;
      const name = ops.argsArray[i][0];
      const img = await new Promise(resolve => {
        const store = name.startsWith('g_') ? page.commonObjs : page.objs;
        try { store.get(name, resolve); } catch { resolve(null); }
      });
      if (img && img.width * img.height > (best ? best.width * best.height : 0)) best = img;
    }
    if (best) out.push({ page: p, png: toPng(best) });
    page.cleanup();
  }
  return out;
}

/**
 * @returns {Promise<{pages: string[], numPages: number, hasTextLayer: boolean}>}
 */
function extractText(buf, { maxPages = 30 } = {}) {
  return withDoc(buf, doc => textFromDoc(doc, maxPages));
}

/** Lấy ảnh lớn nhất trên mỗi trang (bản scan thường là 1 ảnh/trang) dưới dạng PNG buffer. */
function extractPageImages(buf, { maxPages = 12 } = {}) {
  return withDoc(buf, doc => imagesFromDoc(doc, maxPages));
}

/** Chuyển ảnh pdf.js (kind 1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP) hoặc ImageBitmap-like sang PNG. */
function toPng(img) {
  const { width, height } = img;
  const src = img.data;
  const png = new PNG({ width, height });
  const dst = png.data;
  if (img.kind === 3) {
    dst.set(src.subarray(0, width * height * 4));
  } else if (img.kind === 2) {
    for (let i = 0, j = 0; i < width * height; i++, j += 3) {
      dst[i * 4] = src[j]; dst[i * 4 + 1] = src[j + 1]; dst[i * 4 + 2] = src[j + 2]; dst[i * 4 + 3] = 255;
    }
  } else if (img.kind === 1) {
    const rowBytes = (width + 7) >> 3;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      const v = bit ? 255 : 0; const k = (y * width + x) * 4;
      dst[k] = dst[k + 1] = dst[k + 2] = v; dst[k + 3] = 255;
    }
  } else {
    throw new Error('Không hỗ trợ định dạng ảnh kind=' + img.kind);
  }
  return PNG.sync.write(png);
}

let workerPromise = null;
// D9: bộ nhận dạng chữ (Tesseract + dữ liệu tiếng Việt) chiếm nhiều bộ nhớ — ứng dụng chạy nền cả ngày nên
// tắt worker sau một thời gian không dùng; lần OCR sau tự khởi tạo lại (chậm thêm vài giây).
let idleMs = 5 * 60 * 1000, idleTimer = null, busy = 0;
/** Chỉ dùng cho kiểm thử: đổi thời gian chờ trước khi tắt worker. */
function setIdleMs(ms) { idleMs = ms; }
function workerAlive() { return !!workerPromise; }
function scheduleIdleStop() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!busy) shutdown().catch(() => {}); }, idleMs);
  if (idleTimer.unref) idleTimer.unref(); // không giữ tiến trình sống chỉ vì hẹn giờ này
}
let dataDir = path.join(require('os').tmpdir(), 'iosync-tessdata');
/** Thư mục chứa dữ liệu OCR (đặt trong %APPDATA% của ứng dụng khi chạy thật). */
function setDataDir(d) { dataDir = d; }

/**
 * Chuẩn bị dữ liệu tiếng Việt (đóng gói kèm ứng dụng, không tải từ Internet) vào thư mục ngoài asar.
 * Tesseract đọc qua cơ chế cache (readOnly) — cách duy nhất chạy ổn định cả trong Node, Electron và bản đóng gói
 * (trong Electron, Tesseract coi langPath là URL và gọi fetch → lỗi).
 */
function prepareLangData() {
  const fs = require('fs');
  const src = path.join(path.dirname(require.resolve('@tesseract.js-data/vie/package.json')), '4.0.0_best_int', 'vie.traineddata.gz');
  const dst = path.join(dataDir, 'vie.traineddata'); // giữ nguyên dạng gzip; Tesseract tự nhận biết qua magic number
  fs.mkdirSync(dataDir, { recursive: true });
  const srcBuf = fs.readFileSync(src);
  if (!fs.existsSync(dst) || fs.statSync(dst).size !== srcBuf.length) fs.writeFileSync(dst, srcBuf);
  return dataDir;
}

/** Trong bản đóng gói, worker thread phải chạy từ thư mục đã giải nén (app.asar.unpacked). */
function unpacked(p) { return p.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep); }

async function getWorker() {
  if (!workerPromise) {
    const { createWorker } = require('tesseract.js');
    const tjsDir = path.dirname(require.resolve('tesseract.js/package.json'));
    workerPromise = createWorker('vie', 1, {
      workerPath: unpacked(path.join(tjsDir, 'src', 'worker-script', 'node', 'index.js')),
      cachePath: prepareLangData(),
      cacheMethod: 'readOnly',
      langPath: 'local-only-no-download',
      gzip: true,
      logger: () => {},
      errorHandler: () => {}
    });
  }
  return workerPromise;
}

/**
 * A2 (quyết định #37): thứ tự OCR ưu tiên — `dau` trang đầu rồi `cuoi` trang cuối (nơi thường ghi hạn), sau đó các
 * trang giữa theo thứ tự. Trả về chỉ số (0-based) trong mảng ảnh; tài liệu ngắn thì giữ nguyên thứ tự.
 */
function thuTuOcr(n, { dau = 2, cuoi = 1 } = {}) {
  const all = [...Array(n).keys()];
  if (n <= dau + cuoi) return { uuTien: all, conLai: [] };
  const uuTien = [...all.slice(0, dau), ...all.slice(n - cuoi)];
  return { uuTien, conLai: all.filter(i => !uuTien.includes(i)) };
}

/**
 * OCR theo thứ tự ưu tiên; sau nhóm ưu tiên, nếu `du(text)` trả true thì dừng (các trang chưa OCR để chuỗi rỗng,
 * GIỮ đúng vị trí trang để số trang trong «căn cứ hạn» không lệch). Không có `du` → OCR tất cả như trước.
 * @param recognize (png) => Promise<string>
 * @returns {{pages: string[], soTrangOcr: number, motPhan: boolean}}
 */
async function ocrTheoThuTu(imgs, recognize, { du, onTrang } = {}) {
  const pages = imgs.map(() => '');
  const { uuTien, conLai } = du ? thuTuOcr(imgs.length) : { uuTien: imgs.map((_x, i) => i), conLai: [] };
  let dem = 0;
  const lam = async i => { dem++; if (onTrang) onTrang(dem, imgs.length); pages[i] = (await recognize(imgs[i].png)) || ''; };
  for (const i of uuTien) await lam(i);
  if (conLai.length && du(pages.join('\n\f\n'))) return { pages, soTrangOcr: dem, motPhan: true };
  for (const i of conLai) await lam(i);
  return { pages, soTrangOcr: dem, motPhan: false };
}

/** OCR các ảnh trang đã trích. */
async function ocrImages(imgs, opts = {}) {
  if (!imgs.length) return { pages: [], ocr: true, note: 'Không tìm thấy ảnh trang để OCR' };
  busy++; clearTimeout(idleTimer);
  try {
    const worker = await getWorker();
    const r = await ocrTheoThuTu(imgs, async png => (await worker.recognize(png)).data.text, opts);
    return { pages: r.pages, ocr: true, soTrangOcr: r.soTrangOcr, motPhan: r.motPhan };
  } finally { busy--; if (!busy) scheduleIdleStop(); }
}

async function ocrPdf(buf, { maxPages = 12 } = {}) {
  return ocrImages(await extractPageImages(buf, { maxPages }));
}

/**
 * Đọc toàn bộ chữ: ưu tiên lớp chữ, không có thì OCR.
 * A3: mở PDF MỘT lần cho cả hai bước; giải phóng tài liệu trước khi OCR để bớt bộ nhớ.
 * A2: opts.du(text) → OCR trang đầu/cuối trước, đủ thì dừng (xem ocrTheoThuTu). opts.onTrang(i, n) báo tiến trình OCR.
 */
async function readPdf(buf, opts = {}) {
  const { maxPages } = opts;
  const r = await withDoc(buf, async doc => {
    const t = await textFromDoc(doc, maxPages || 30);
    if (t.hasTextLayer || opts.noOcr) return { t };
    return { t, imgs: await imagesFromDoc(doc, maxPages || 12) };
  });
  const { t } = r;
  if (t.hasTextLayer) return { text: t.pages.join('\n\f\n'), numPages: t.numPages, method: 'text' };
  if (opts.noOcr) return { text: '', numPages: t.numPages, method: 'none' };
  const o = await ocrImages(r.imgs, { du: opts.du, onTrang: opts.onTrang });
  const out = { text: o.pages.join('\n\f\n'), numPages: t.numPages, method: 'ocr', note: o.note };
  if (o.motPhan) out.ocrMotPhan = { soTrang: o.soTrangOcr, tong: r.imgs.length };
  return out;
}

async function shutdown() {
  clearTimeout(idleTimer);
  if (workerPromise) { const p = workerPromise; workerPromise = null; const w = await p; await w.terminate(); }
}

/** Chỉ dùng cho kiểm thử: số lần đã mở tài liệu PDF. */
function demSoLanMo() { return soLanMo; }

module.exports = { extractText, extractPageImages, ocrPdf, readPdf, joinItems, shutdown, setDataDir, setIdleMs, workerAlive, demSoLanMo, thuTuOcr, ocrTheoThuTu };
