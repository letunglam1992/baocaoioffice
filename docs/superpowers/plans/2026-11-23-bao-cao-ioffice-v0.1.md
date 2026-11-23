# Tổng hợp báo cáo iOffice v0.1 — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ứng dụng Windows chạy nền, gom văn bản đến/đi từ nhiều tài khoản iOffice (chỉ đọc) vào kho chữ cục bộ có chỉ mục toàn văn. Từ một đề cương Word hoặc vài dòng chủ đề, ứng dụng sinh báo cáo Word trên khung mẫu của Sở, kèm tệp dữ liệu thô; có tùy chọn tinh chỉnh bằng Cloudflare Worker.

**Architecture:** Electron (vỏ, lịch, khay, cửa sổ iOffice ẩn theo từng tài khoản) bọc các mô-đun Node thuần, có kiểm thử: đọc tài liệu → cây đề cương → kho + chỉ mục → tổng hợp trích đoạn → xuất Word bằng sửa XML trên khung. Phần iOffice/OCR chép từ `letunglam1992/quetvanban` (chỉ mã, không chép `test/`).

**Tech Stack:** Node ≥ 20 (CI 22), Electron 33, electron-builder 26 (NSIS), `node:test`; pdfjs-dist 4, tesseract.js 5 + @tesseract.js-data/vie, pngjs (từ quetvanban); jszip 3.10, word-extractor 1.0.4, minisearch 7.2.

**Spec:** `docs/superpowers/specs/2026-11-23-bao-cao-ioffice-design.md`

## Global Constraints

- iOffice **chỉ đọc**: mọi lời gọi qua `window.__iosync` trong trang; `IOffice.call()` từ chối API ngoài `ALLOWED_APIS`; giãn cách ≥ 700 ms giữa các lời gọi.
- Không đọc, lưu hay ghi log mật khẩu/token iOffice. Mỗi tài khoản một phân vùng `persist:ioffice-<id>`.
- Văn bản có độ mật (`ten_cap_do_mat` khác rỗng/«Thường»): chỉ lưu metadata, cờ `DO_MAT`, không tải tệp, không đưa vào trích đoạn, không gửi AI.
- Cách lưu B: tệp tải vào `<userData>/tam/`, đọc xong xóa; kho chỉ giữ chữ + metadata + `path/name` iOffice. Thư mục `H:\Van ban den\` chỉ đọc.
- Kho mặc định `%LOCALAPPDATA%\BaoCaoIOffice\kho` (Electron: `path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'BaoCaoIOffice', 'kho')`), chia theo năm.
- Giới hạn mặc định mỗi tài khoản mỗi lượt: `maxCalls: 300`, `maxFiles: 100`. Lịch `['12:00']`, lượt trước lùi 3 ngày, bù sau 5 phút khi mở máy, lỗi thì thử lại sau 30 phút. Lượt đầu lùi từ `01/01/2025`.
- AI mặc định **tắt**; Worker mặc định `https://rasoatvanban.letunglam1992.workers.dev`; giao thức `POST {messages:[{role,content}]}` → `{text, model}`.
- Không bịa số/ngày văn bản: số `Số:        /BC-SNNMT`, ngày `Sơn La, ngày      tháng      năm 2026` để trống.
- Repo công khai: **không commit** đề cương/báo cáo thật, `du-lieu*.json`, kho, khóa. Dữ liệu kiểm thử phải là **chữ giả tự tạo**.
- Giao diện, nhật ký, thông báo: tiếng Việt. CSP `default-src 'self'`.
- Mỗi bộ cài gửi đi phải tăng phiên bản và cập nhật `#whatsNew` (kiểm thử `test/version.test.js`).

## Review Focus

1. Đề cương có mục lệch chuẩn (`1.1` không có dấu chấm cuối, `I -` thay `I.`, đoạn trống, chữ in hoa toàn dòng, khoảng trắng không ngắt `\u00a0`) → vẫn dựng đúng cây. Kiểm thử ở Task 3.
2. Văn bản không có chữ (PDF scan) hoặc tệp hỏng/.zip/.rar → kho ghi `canOcr`/`KHONG_DOC_DUOC`, lượt quét không dừng. Kiểm thử ở Task 2 và Task 6.
3. Phiên iOffice hết hạn giữa lượt, hoặc một tài khoản lỗi → các tài khoản khác vẫn chạy, mốc `lastOkAt` của tài khoản lỗi không bị dời. Kiểm thử ở Task 6.
4. Tìm kiếm khi người dùng gõ không dấu («giai phong mat bang») hoặc khác hoa thường → vẫn ra văn bản có dấu. Kiểm thử ở Task 4.
5. Ký tự đặc biệt trong trích đoạn (`&`, `<`, `"`, xuống dòng) → XML Word hợp lệ, mở được bằng Word/LibreOffice. Kiểm thử ở Task 8.

---

## Cấu trúc tệp

```
package.json  .gitignore  CLAUDE.md  README.md  CHANGELOG.md
.github/workflows/ci.yml
build/icon.ico  build/icon.png                 (chép từ quetvanban)
assets/khung-bao-cao.docx                      (khung rỗng, Task 8)
src/constants.js        URL iOffice, mặc định cài đặt
src/ioffice.js          adapter (chép + tham số hóa phân vùng + chế độ ghi nhận API)
src/retry.js  src/pdftext.js  src/useragent.js (chép nguyên)
src/docread.js          đọc .docx/.doc/.xlsx/.pdf → chữ theo trang + đoạn + bảng
src/vntext.js           chuẩn hóa, bỏ dấu, tách từ, từ dừng
src/decuong.js          cây đề cương, ngữ cảnh, chủ đề gõ tay
src/kho.js              kho theo năm + chỉ mục MiniSearch
src/thuthap.js          lượt thu thập cho một tài khoản (adapter tiêm vào)
src/tonghop.js          truy vấn, xếp hạng, trích đoạn, danh mục văn bản
src/xuatword.js         khung → báo cáo .docx; dữ liệu thô .md/.docx
src/ai.js               Worker Cloudflare, lọc, kiểm số
src/ghinhan.js          làm sạch bản ghi API (thuần) + mã cầu nối ghi nhận
src/lich.js             đến hạn/bù/thử lại
src/store.js            trạng thái JSON ghi nguyên tử (chép từ quetvanban, rút gọn)
src/main.js  src/preload.js  src/app/*.js     vỏ Electron, IPC, khay, tài khoản
src/ui/index.html style.css core.js tab-*.js app.js
test/*.test.js  test/fake-ioffice.js  test/mau/*.js (sinh tài liệu giả)
```

---

### Task 1: Khung dự án và mô-đun chép từ quetvanban

**Files:**
- Create: `package.json`, `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `.gitignore` (bổ sung), `src/constants.js`
- Copy từ `/home/user/quetvanban`: `src/ioffice.js`, `src/retry.js`, `src/pdftext.js`, `src/useragent.js`, `build/icon.ico`, `build/icon.png`
- Test: `test/ioffice.test.js`

**Interfaces:**
- Produces: `new IOffice({ log, partition })`; `IOffice.call(api, method, data)` ném lỗi `API_KHONG_DUOC_PHEP` với API ngoài danh sách; `ALLOWED_APIS` (8 API đọc của quetvanban); `PARTITION_PREFIX = 'persist:ioffice-'`; `partitionFor(id: string) => string`.
- Produces: `DEFAULTS` trong `src/constants.js`: `{ lich:['12:00'], luiNgay:3, buSauPhut:5, thuLaiPhut:30, tuNgayDau:'01/01/2025', maxCalls:300, maxFiles:100, gianCachMs:700, ai:{bat:false, diaChi:'https://rasoatvanban.letunglam1992.workers.dev', khongGui:[]}, khoDir:null, thuMucQuetVanBan:'H:\\Van ban den' }`.

- [ ] **Step 1:** `package.json`: name `bao-cao-ioffice`, productName «Tổng hợp báo cáo iOffice», version `0.1.0`, `main: src/main.js`, scripts `start`/`test` (`node --test "test/*.test.js"`)/`dist` (`electron-builder --win nsis --x64`)/`dist:dir`. Build: appId `vn.sonla.snnmt.baocao-ioffice`, artifactName `BaoCaoIOffice-Setup-${version}.exe`, `files: ["src/**/*","assets/**/*","build/icon.png","package.json"]`, `asarUnpack: ["node_modules/**"]`, NSIS như quetvanban. Dependencies như phần Tech Stack. Chạy `npm install`.
- [ ] **Step 2:** Viết kiểm thử `test/ioffice.test.js`: `partitionFor('lam') === 'persist:ioffice-lam'`; `partitionFor('Lâm Tùng!')` chỉ còn `[a-z0-9-]` (`'persist:ioffice-lam-tung'`); `ALLOWED_APIS.every(a => /danh-sach|chi-tiet|but-phe|phuc-dap|cay-xu-ly|qua-trinh/.test(a))`; `await new IOffice({}).call('/api/van-ban-den/chuyen-xu-ly')` bị từ chối với `/API_KHONG_DUOC_PHEP/` (không cần cửa sổ, vì kiểm tra trước `ensureWindow`).
- [ ] **Step 3:** Chạy `node --test test/ioffice.test.js` → FAIL.
- [ ] **Step 4:** Sửa `src/ioffice.js`: thay hằng `PARTITION` bằng tham số constructor (mặc định `partitionFor('chinh')`); thêm `partitionFor` (bỏ dấu, chữ thường, ký tự khác → `-`, gộp `-`); bảo đảm kiểm danh sách trắng chạy trước `ensureWindow()` trong `call`; export thêm `partitionFor`, `PARTITION_PREFIX`. Không đổi các hàm khác.
- [ ] **Step 5:** Chạy kiểm thử → PASS. Viết `CLAUDE.md` (tiếng Việt: nguyên tắc cứng ở Global Constraints, lệnh, không commit dữ liệu thật, đọc spec trước khi sửa) và `README.md` (cài đặt, phát triển, bảo mật).
- [ ] **Step 6:** Commit `feat: khung dự án, adapter iOffice theo tài khoản`.

### Task 2: Đọc tài liệu (`src/docread.js`)

**Files:** Create `src/docread.js`, `test/mau/taodoc.js` (sinh .docx/.xlsx giả bằng JSZip), Test `test/docread.test.js`

**Interfaces:**
- Consumes: `extractText(buf, {maxPages})` từ `src/pdftext.js` (trả `{ text, pages: string[] }` hoặc tương đương — đọc mã để khớp).
- Produces: `docBlocks(buf: Buffer) => Promise<{ blocks: Block[] }>` cho .docx, với `Block = {type:'p', text, bold:boolean, italic:boolean} | {type:'table', rows: string[][]}`, theo đúng thứ tự trong body.
- Produces: `readAny(buf: Buffer, name: string) => Promise<{ method: 'docx'|'doc'|'xlsx'|'pdf-text'|'none', pages: string[], blocks?: Block[], canOcr: boolean, error?: string }>`. `.pdf`: lớp chữ; nếu tổng chữ < 200 ký tự thì `canOcr: true`, `pages` rỗng. `.doc`: word-extractor `getBody()`, mỗi đoạn một block. `.xlsx`: mỗi sheet một trang, ô nối bằng ` | `. Đuôi khác (.zip, .rar, ảnh): `method: 'none'`. Tệp hỏng: `method: 'none'`, `error`, không ném lỗi.
- Produces (test helper): `taoDocx({ blocks }) => Promise<Buffer>`, `taoXlsx({ sheets: {name: string[][]} }) => Promise<Buffer>`.

- [ ] **Step 1:** Viết kiểm thử:
  - `docBlocks` trên docx giả `[p 'I. CÔNG TÁC'(đậm), p '1. Quán triệt', table [['TT','Số, ký hiệu văn bản'],['1','']], p 'II. KẾT QUẢ']` → đúng 4 block, đúng thứ tự, `blocks[0].bold === true`, `blocks[2].rows[0][1] === 'Số, ký hiệu văn bản'`.
  - `readAny` với xlsx giả → `method 'xlsx'`, `pages[0]` chứa `'Diện tích | 12,5'`.
  - `readAny(Buffer.from('rác'), 'x.docx')` → `method 'none'`, có `error`.
  - `readAny(buf, 'a.zip')` → `method 'none'`.
  - `readAny` với PDF có lớp chữ (sinh bằng pdf giả tối thiểu viết tay trong `test/mau/taodoc.js`: một trang, chữ ASCII) → `method 'pdf-text'`.
  - Đoạn có `&` và `<` trong docx → `text` đã giải mã thực thể.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt `docBlocks`: JSZip mở `word/document.xml`, duyệt con trực tiếp của `w:body` bằng regex an toàn hoặc parser nhỏ (`<w:p>`/`<w:tbl>`), ghép `w:t`, `w:tab`→`\t`, `w:br`→`\n`; đậm nếu mọi run có chữ đều có `w:b` (không có `w:val="0"`). Cài đặt `readAny` như Interfaces.
- [ ] **Step 4:** Chạy → PASS. Commit `feat: đọc docx/doc/xlsx/pdf`.

### Task 3: Tiếng Việt và cây đề cương (`src/vntext.js`, `src/decuong.js`)

**Files:** Create `src/vntext.js`, `src/decuong.js`, `test/mau/decuong-gia.js` (đề cương giả cùng cấu trúc đề cương NQ 09, chữ thay bằng nội dung bịa), Test `test/vntext.test.js`, `test/decuong.test.js`

**Interfaces:**
- Produces (`vntext.js`): `chuanHoa(s) => string` (NFC, `\u00a0`→space, gộp khoảng trắng, trim); `boDau(s) => string` (gồm `đ→d`); `tachTu(s) => string[]` (chữ thường, bỏ dấu câu, giữ số ký hiệu dạng `09-nq/tu` nguyên khối); `TU_DUNG: Set<string>` (gồm: kết quả, thực hiện, báo cáo, đề nghị, các, của, và, về, theo, công tác, triển khai, tình hình, đánh giá, nội dung, liên quan, cụ thể, năm, giai đoạn); `tuKhoa(s) => string[]` (tachTu − TU_DUNG, ghép thêm bigram); `timSoKyHieu(s) => string[]` (regex `\b\d{1,5}\/[A-ZĐ][A-ZĐ0-9\-]*(\/[A-ZĐ0-9\-]+)?\b` và dạng `09-NQ/TU`).
- Produces (`decuong.js`):
  ```
  type Muc = { id: string, so: string, cap: 1|2|3|4|5, tieuDe: string, moTa: string[], chiDan: string[],
               donViDeNghi: string[], dang: 'van'|'danhMucVB'|'bangSoLieu', bat: boolean,
               bang?: string[][], tuKhoaThem: string[], ghim: string[], con: Muc[] }
  type DeCuong = { tieuDe: string, trichYeu: string, vanBanGoc: string[], nam: number|null, muc: Muc[], phuLuc: Muc[] }
  parseDeCuong(blocks: Block[], { donViMinh = ['Sở Nông nghiệp và Môi trường','các sở, ngành','các sở, ban, ngành','các cơ quan, đơn vị'] } = {}) => DeCuong
  parseChuDe(text: string, soKyHieu: string) => DeCuong   // mỗi dòng không rỗng = Muc cấp 1 dạng 'van'; soKyHieu tách theo dòng/dấu phẩy → ghim của mục đầu tiên và vanBanGoc
  ```
- Quy tắc cấp: `^[IVXLC]+[.\-–]\s` → 1; `^\d+[.)]\s` → 2; `^\d+\.\d+\.?\s` → 3; `^[a-zđ]\)\s` → 4; `^[-–+•]\s` → 5 (gạch đầu dòng: nếu ngay sau mục cấp ≤4 thì vào `moTa`, không thành mục con, trừ khi người dùng đổi). Đoạn bắt đầu `Đề nghị` hoặc `(Đề nghị` → `chiDan`; phần tiêu đề sau dấu `:` chứa «Đề nghị…» cũng tách sang `chiDan`. `donViDeNghi` = cụm sau «Đề nghị» tới `báo cáo|rà soát|đánh giá`. `bat = chiDan.length === 0 || donViDeNghi.some(khớp donViMinh)`. Hai đoạn đầu trước mục cấp 1: `tieuDe` («ĐỀ CƯƠNG BÁO CÁO»), `trichYeu`. `vanBanGoc` = `timSoKyHieu(trichYeu)`; `nam` = năm 4 chữ số đầu tiên sau «năm» trong trichYeu. Đoạn «Phụ lục»/«Phục lục» → bắt đầu `phuLuc`; bảng có cột chứa «Số, ký hiệu» và «Trích yếu» → `dang 'danhMucVB'`; bảng khác → `'bangSoLieu'`.

- [ ] **Step 1:** Viết kiểm thử `vntext`: `boDau('Giải phóng mặt bằng Đất')==='Giai phong mat bang Dat'`; `tachTu('Nghị quyết 09-NQ/TU, ngày 30/12/2025')` chứa `'09-nq/tu'`; `tuKhoa('Kết quả thực hiện bồi thường, giải phóng mặt bằng')` không chứa `'ket qua'`, chứa `'giai phong'` hoặc `'giai_phong'` (chọn một dạng và dùng nhất quán); `timSoKyHieu('Kế hoạch số 131/KH-UBND và 1410/TTr-SNNMT')` → `['131/KH-UBND','1410/TTr-SNNMT']`; `chuanHoa('a\u00a0 b ')==='a b'`.
- [ ] **Step 2:** Viết kiểm thử `decuong` trên đề cương giả:
  - 5 mục cấp 1 (I–V); `muc[1].con[0].con.length === 6` (1.1–1.6);
  - mục «1.4 … FDI: Đề nghị Ban quản lý các Khu công nghiệp…» → `bat === false`, `chiDan.length === 1`, `tieuDe` không chứa «Đề nghị»;
  - mục «2.8 … Đề nghị Sở Nông nghiệp và Môi trường, UBND các xã…» → `bat === true`;
  - mục «2.2» có `moTa.length === 3` (ba gạch đầu dòng);
  - `vanBanGoc` gồm `'09-NQ/TU'` và `'131/KH-UBND'`; `nam === 2026`;
  - `phuLuc[0].dang === 'danhMucVB'`, `phuLuc[0].bang[0]` có 6 cột;
  - Review Focus 1: biến thể `'1.1 Kết quả'` (không chấm), `'I - CÔNG TÁC'`, đoạn rỗng, `\u00a0` sau số → cây không đổi.
  - `parseChuDe('Giải phóng mặt bằng\n\nĐất đai', '131/KH-UBND, 09-NQ/TU')` → 2 mục, `muc[0].ghim.length === 2`.
- [ ] **Step 3:** Chạy → FAIL. **Step 4:** Cài đặt. **Step 5:** Chạy → PASS. Commit `feat: cây đề cương và xử lý tiếng Việt`.

### Task 4: Kho và chỉ mục (`src/kho.js`)

**Files:** Create `src/kho.js`, Test `test/kho.test.js`

**Interfaces:**
- Consumes: `tachTu`, `boDau` từ Task 3.
- Produces:
  ```
  type VanBan = { id: string /* 'den:<ma>' | 'di:<ma>' */, chieu: 'den'|'di', soKyHieu: string, ngayBanHanh: string /* dd/mm/yyyy */,
                  coQuan: string, loai: string, trichYeu: string, taiKhoan: string[], doMat: boolean,
                  tep: { name: string, path: string, method: string, canOcr: boolean, ocrDone: boolean, error?: string }[],
                  trang: { tep: number, so: number, text: string }[], capNhat: string /* ISO */ }
  class Kho {
    constructor(dir: string)
    upsert(vb: VanBan): void          // gộp taiKhoan, giữ trang cũ nếu vb.trang rỗng; doMat → trang = []
    get(id: string): VanBan|null
    has(id: string): boolean
    timTheoSo(soKyHieu: string): VanBan[]   // so khớp không phân biệt hoa thường/dấu, bỏ khoảng trắng
    tim(query: string, { tuNgay?, denNgay?, chieu?, limit = 50 }): { vb: VanBan, score: number }[]
    canOcr(limit: number): { vb: VanBan, tepIdx: number }[]
    save(): void      // ghi kho/<năm>/vanban.ndjson + kho/<năm>/chimuc.json, ghi nguyên tử (tmp + rename)
    static load(dir: string): Kho     // nạp metadata; chỉ mục theo năm nạp lười khi tim() cần năm đó
  }
  ```
  Năm lấy từ `ngayBanHanh`; không có → năm `capNhat`. MiniSearch: trường `soKyHieu, trichYeu, noiDung`, `tokenize` = tachTu trên cả bản có dấu lẫn `boDau`, `processTerm` = bỏ dấu + lowercase, `boost: {soKyHieu:4, trichYeu:2}`, `prefix: true`, `fuzzy: 0.1`. Văn bản `doMat` không đưa vào chỉ mục.

- [ ] **Step 1:** Viết kiểm thử: upsert 3 văn bản giả (2025 và 2026) → `save()` → `Kho.load()` → `get` trả đúng; thư mục có `2025/` và `2026/`; `tim('giai phong mat bang')` (không dấu) ra văn bản có chữ «giải phóng mặt bằng» đứng đầu (Review Focus 4); `tim('GIẢI PHÓNG')` cũng ra; lọc `tuNgay:'01/01/2026'` loại văn bản 2025; `timTheoSo('131/kh-ubnd')` ra văn bản `131/KH-UBND`; upsert văn bản `doMat:true` có trang → `get().trang.length === 0` và `tim` không trả về; upsert lần hai với `taiKhoan:['b']` → `taiKhoan` là `['a','b']`.
- [ ] **Step 2:** FAIL → **Step 3:** cài đặt → **Step 4:** PASS → commit `feat: kho văn bản theo năm và chỉ mục toàn văn`.

### Task 5: Lịch chạy (`src/lich.js`)

**Files:** Create `src/lich.js`, Test `test/lich.test.js`

**Interfaces:**
- Produces: `denHan({ lich: string[], lastRunAt: number|null, lastFailAt: number|null, thuLaiPhut, now }) => boolean` (true khi đã qua một mốc giờ trong ngày mà `lastRunAt` trước mốc đó; hoặc khi `lastFailAt` cách `now` ≥ `thuLaiPhut`); `khoangLuot({ lastOkAt: string|null /* dd/mm/yyyy */, luiNgay, tuNgayDau, now }) => { tuNgay: string, denNgay: string }`; `buKhiMoMay(startedAt, now, buSauPhut) => boolean`.
- Mốc giờ theo giờ Việt Nam (UTC+7), giống `src/schedule.js` của quetvanban.

- [ ] **Step 1:** Kiểm thử: 11:59 VN cùng ngày, lần chạy hôm qua → false; 12:01 → true; đã chạy 12:00 hôm nay → false; `lastFailAt` cách 29 phút → false, 30 phút → true; `khoangLuot({lastOkAt:null, luiNgay:3, tuNgayDau:'01/01/2025', now: 23/11/2026})` → `{tuNgay:'01/01/2025', denNgay:'23/11/2026'}`; với `lastOkAt:'20/11/2026'` → `tuNgay:'17/11/2026'`; `buKhiMoMay` đúng 5 phút.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS. Commit `feat: lịch quét nền`.

### Task 6: Thu thập một tài khoản (`src/thuthap.js`)

**Files:** Create `src/thuthap.js`, `test/fake-ioffice.js`, Test `test/thuthap.test.js`

**Interfaces:**
- Consumes: `Kho` (Task 4), `readAny` (Task 2); adapter có các phương thức của `IOffice`: `whoAmI()`, `listVanBanDen(tu, den)`, `listVanBanDiDaPhatHanh(tu, den)`, `chiTiet(ma, xld)`, `chiTietVanBanDi(ma)`, `downloadFile(path, name)`.
- Produces:
  ```
  thuThap({ io, kho, taiKhoan: string, tuNgay, denNgay, gioiHan: { maxCalls, maxFiles }, tamDir: string,
            thuMucQuetVanBan?: string, nenDung?: () => boolean, onTienDo?: (e:{buoc, da, tong, so}) => void, log })
    => Promise<{ ok: boolean, moi: number, capNhat: number, tep: number, loi: {so, msg}[], hetGioiHan: boolean, dung: boolean }>
  ```
  Luồng: `whoAmI` (null → `ok:false`, lỗi `CHUA_DANG_NHAP`) → liệt kê đến + đi → bỏ văn bản đã có trong kho mà mọi tệp đã đọc → chi tiết → độ mật → mỗi tệp: tìm bản trong `thuMucQuetVanBan` (khớp tên tệp chứa số ký hiệu đã làm sạch và ngày) thì đọc từ đó; không thì `downloadFile` → ghi `tamDir` → `readAny` → **xóa tệp tạm** (cả khi lỗi, dùng `finally`) → `kho.upsert`. Đếm lời gọi; chạm `maxCalls`/`maxFiles` → dừng, `hetGioiHan:true`, `ok:true`. Lỗi một văn bản → ghi `loi`, đi tiếp. `nenDung()` true → dừng giữa hai văn bản, `dung:true`. Tùy chọn `giuTep: { loai: string[], tranMB: number }` (mặc định tắt): văn bản có `loai` thuộc danh sách thì chép tệp sang `<kho>/giu-tep/` trước khi xóa tệp tạm; vượt `tranMB` → xóa tệp giữ lâu nhất **trong thư mục `giu-tep` của ứng dụng**. Gọi `kho.save()` mỗi 20 văn bản và khi kết thúc. Khi tài khoản tự hiểu là chưa thu thập đủ khoảng ngày (`hetGioiHan` hoặc `dung`), **không** báo đủ để vỏ không dời `lastOkAt`.

- [ ] **Step 1:** `test/fake-ioffice.js`: adapter giả dữ liệu bịa (3 VB đến, 2 VB đi, 1 VB mật, 1 tệp .zip, 1 tệp hỏng, 1 PDF scan), đếm số lời gọi, có cờ `hetPhienSau: n`.
- [ ] **Step 2:** Kiểm thử:
  - lượt đủ: `moi === 6`, VB mật có `doMat` và không có lời gọi `downloadFile` cho nó, tệp .zip và tệp hỏng có `method:'none'`, PDF scan có `canOcr:true`; `tamDir` rỗng sau lượt;
  - `gioiHan.maxFiles: 2` → `hetGioiHan:true`, `tep === 2`;
  - lượt thứ hai cùng dữ liệu → 0 lời gọi `downloadFile`;
  - `hetPhienSau: 3` → các lời gọi sau ném `NOT_READY` → `ok:false`, có `loi`, các văn bản đã lấy vẫn được lưu (Review Focus 3);
  - có thư mục quetvanban giả chứa `123_05-11-2026.pdf` khớp → không gọi `downloadFile` cho văn bản đó, tệp trong thư mục không bị xóa;
  - `giuTep:{loai:['Báo cáo'], tranMB:1}` → tệp Báo cáo có trong `giu-tep/`, tệp loại khác không; vượt trần → tệp cũ nhất bị xóa;
  - `nenDung` trả true sau văn bản thứ 2 → `dung:true`, `moi === 2`.
- [ ] **Step 3–5:** FAIL → cài đặt → PASS. Commit `feat: thu thập văn bản một tài khoản`.

### Task 7: Tổng hợp trích đoạn (`src/tonghop.js`)

**Files:** Create `src/tonghop.js`, Test `test/tonghop.test.js`

**Interfaces:**
- Consumes: `DeCuong`/`Muc` (Task 3), `Kho` (Task 4), `tuKhoa`, `timSoKyHieu` (Task 3).
- Produces:
  ```
  type TrichDoan = { n: number, vbId: string, soKyHieu: string, ngay: string, coQuan: string, trang: number, text: string, coSoLieu: boolean, chon: boolean }
  type KetQuaMuc = { mucId: string, truyVan: string, vanBan: { id, soKyHieu, score }[], trichDoan: TrichDoan[] }
  truyVanMuc(muc: Muc, dc: DeCuong) => string
  tongHopMuc(muc: Muc, dc: DeCuong, kho: Kho, { tuNgay, denNgay, K = 8, M = 6, maxKyTu = 600 }) => KetQuaMuc
  tongHop(dc: DeCuong, kho: Kho, opts) => Record<string /*mucId*/, KetQuaMuc>   // chỉ mục bat, đệ quy
  danhMucVanBan(dc: DeCuong, kho: Kho, { tuNgay, denNgay, coQuan?: string[] }) => { soKyHieu, ngay, coQuan, trichYeu, vbId }[]
  ```
  - Truy vấn = `tuKhoa(tieuDe + moTa)` ∪ `tuKhoaThem`; điểm thưởng ×1,5 nếu toàn văn chứa một `vanBanGoc`, ×1,2 nếu `chieu === 'di'`; văn bản `ghim` luôn đứng đầu.
  - Đoạn = tách `trang.text` theo `\n\s*\n` hoặc câu nếu đoạn dài hơn `maxKyTu` (cắt ở ranh giới câu). Đoạn đạt khi chứa ≥ 1 từ khóa; `coSoLieu` = khớp `/\d[\d.,]*\s*(dự án|tỷ|triệu|đồng|ha|%|hộ|văn bản|km|m2|m²|lượt|cuộc|trường hợp)/i`. Thứ tự: số từ khóa khớp, rồi `coSoLieu`, rồi điểm văn bản. Bỏ đoạn trùng (cùng 80 ký tự đầu sau chuẩn hóa). Đánh số `n` từ 1 trong mỗi mục.
  - `danhMucVanBan`: văn bản mà `trichYeu` hoặc 2 trang đầu chứa một `vanBanGoc`, ngày trong khoảng, không phải chính văn bản gốc; sắp theo ngày tăng dần.

- [ ] **Step 1:** Kiểm thử trên kho giả 6 văn bản:
  - mục «Bồi thường, hỗ trợ, tái định cư, giải phóng mặt bằng» → văn bản GPMB đứng đầu; trích đoạn đầu có `coSoLieu:true` («đã bàn giao 12,5 ha cho 3 dự án»);
  - mỗi trích đoạn có `soKyHieu`, `ngay`, `trang` khác rỗng; `text.length <= 600`;
  - văn bản `ghim` có `id` đứng đầu `vanBan` dù không khớp từ khóa;
  - `danhMucVanBan` trả đúng 3 văn bản viện dẫn `09-NQ/TU`, đúng thứ tự ngày, không chứa văn bản `09-NQ/TU`;
  - mục `bat:false` không có trong kết quả `tongHop`;
  - kho rỗng → `trichDoan: []`, không ném lỗi.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS. Commit `feat: chọn văn bản và trích đoạn cho từng mục`.

### Task 8: Khung báo cáo và xuất Word (`src/xuatword.js`, `assets/khung-bao-cao.docx`)

**Files:** Create `src/xuatword.js`, `assets/khung-bao-cao.docx`, `tools/tao-khung.js`, Test `test/xuatword.test.js`

**Interfaces:**
- Consumes: `DeCuong`, `KetQuaMuc`, danh mục (Task 3, 7).
- Produces:
  ```
  type Khung = { zip: JSZip, docXml: string, phan: { dau: string /* XML từ đầu body tới hết đoạn tên loại+trích yếu */, kinhGui: string, moDau: string,
                 ketThuc: string /* đoạn «… trân trọng báo cáo./.» */, noiNhan: string /* bảng nơi nhận/ký + sectPr */ },
                 kieu: { muc1: string, muc2: string, muc3: string, gach: string, doan: string } /* XML w:pPr mẫu */ }
  docKhung(buf: Buffer) => Promise<Khung>
  xuatBaoCao(khung: Khung, { dc: DeCuong, ketQua: Record<string,KetQuaMuc>, danhMuc, kinhGui: string, trichYeu: string, moDau: string, vanBanAi?: Record<string,string> })
    => Promise<Buffer>
  xuatDuLieuTho({ dc, ketQua, danhMuc }) => { md: string }   // và Promise<Buffer> docx qua xuatBaoCao trên khung rỗng tối giản
  escXml(s: string) => string
  ```
  - Nhận diện phần trong khung: đoạn có chữ «Kính gửi» → `kinhGui`; đoạn đầu tiên sau đó → `moDau`; đoạn chứa «trân trọng báo cáo» → `ketThuc`; bảng cuối → `noiNhan`. `kieu.*` lấy từ đoạn mẫu cấp tương ứng (đoạn bắt đầu `I.`, `1.`, `a)`, `-`, đoạn thường) trong thân khung.
  - Thân: bỏ toàn bộ đoạn giữa `moDau` và `ketThuc`; sinh lại theo cây mục `bat`: cấp 1 giữ số La Mã (đánh lại liên tục I, II…), cấp 2 `1.`, `2.`… (đánh lại), cấp 3 `a)`, `b)`… (bỏ chữ «Đề nghị…»); mỗi trích đoạn `chon` → đoạn kiểu `gach` dạng `- <text> (<soKyHieu> ngày <ngay>, tr. <trang>)`; mục không có trích đoạn → đoạn `[Chưa tìm thấy văn bản liên quan — cần bổ sung]` có `w:highlight w:val="yellow"`; có `vanBanAi[mucId]` → dùng văn AI (số lạ đã đánh dấu bằng `[[?…]]` → run highlight vàng).
  - Đầu: thay số bằng `Số:        /BC-SNNMT`; ngày bằng `Sơn La, ngày      tháng      năm <dc.nam ?? năm hiện tại>`; trích yếu bằng tham số.
  - Mục `dang 'bangSoLieu'` (bảng Word trong đề cương, hoặc sheet Excel biểu mẫu nạp kèm): chèn lại bảng đúng cột/dòng, **ô số để trống**, ngay dưới bảng là các trích đoạn `coSoLieu` của mục (không tự điền số — hướng a).
  - Phụ lục: ngắt trang `<w:br w:type="page"/>`, đoạn «Phụ lục 01» (đậm, giữa), tên phụ lục, dòng nghiêng `(Kèm theo Báo cáo số        /BC-SNNMT ngày      tháng      năm …)`, bảng giữ cột của `phuLuc[0].bang[0]` + dòng `(1)…(n)`, rồi các dòng danh mục.
  - `tools/tao-khung.js <báo cáo thật .docx> <ra .docx>`: giữ khối đầu, tên loại, «Kính gửi», một đoạn mẫu mỗi kiểu (thay chữ bằng «Mẫu …»), câu kết, bảng nơi nhận với tên người ký thay bằng chuỗi rỗng. Người phát triển chạy công cụ này với tệp thật (ngoài repo) để tạo `assets/khung-bao-cao.docx`, rồi kiểm tra tệp đầu ra không còn chữ nào của thân báo cáo thật trước khi commit.
- [ ] **Step 1:** Viết kiểm thử dùng khung giả sinh bằng `taoDocx` (cấu trúc như mô tả):
  - `xuatBaoCao` → mở lại bằng `docBlocks`: có «BÁO CÁO», «Kính gửi: Sở Tài chính», các mục «I.», «II.» đánh liên tục khi mục giữa bị tắt; không còn chữ «Mẫu nội dung thân» của khung; có «trân trọng báo cáo./.»; có «Phụ lục 01» và bảng 6 cột với 3 dòng dữ liệu;
  - trích đoạn chứa `A & B <c> "d"` → XML parse được (`new DOMParser` không có → dùng kiểm tra `docBlocks` không ném lỗi và chữ ra đúng nguyên văn) (Review Focus 5);
  - mục rỗng → đoạn có `w:highlight w:val="yellow"`;
  - `Số:` trong đầu không chứa chữ số;
  - `xuatDuLieuTho().md` có tiêu đề từng mục, nguyên văn yêu cầu đề cương (gồm `chiDan`), đủ trích đoạn kèm `[n]` và nguồn.
- [ ] **Step 2:** FAIL. **Step 3:** cài đặt `xuatword.js`, `tools/tao-khung.js`. **Step 4:** PASS.
- [ ] **Step 5:** Chạy `node tools/tao-khung.js <BC_NQ_09.docx ngoài repo> assets/khung-bao-cao.docx`; `unzip -p assets/khung-bao-cao.docx word/document.xml | grep -c "tỷ\|dự án"` → `0`; chuyển PDF bằng LibreOffice, xem ảnh trang 1 (khối đầu, tên loại, khối ký đúng vị trí). Kết quả ghép thử đề cương NQ 09 thật cũng xuất ra ngoài repo để tự xem.
- [ ] **Step 6:** Commit `feat: xuất báo cáo Word trên khung mẫu`.

### Task 9: Tinh chỉnh bằng Worker AI (`src/ai.js`)

**Files:** Create `src/ai.js`, Test `test/ai.test.js`

**Interfaces:**
- Consumes: `KetQuaMuc`, `Muc`, `Kho` (để biết `doMat`).
- Produces:
  ```
  locGui(ketQua: KetQuaMuc, kho: Kho, khongGui: string[]) => TrichDoan[]    // bỏ doMat, bỏ đoạn/văn bản khớp từ khóa hoặc cơ quan trong khongGui (không phân biệt dấu)
  taoTinNhan(muc: Muc, dc: DeCuong, trich: TrichDoan[]) => { role, content }[]
  kiemSo(van: string, trich: TrichDoan[]) => { van: string /* số lạ bọc [[?…]] */, soLa: string[] }
  tinhChinhMuc(muc, dc, ketQua, { diaChi, fetchFn = fetch, kho, khongGui, timeoutMs = 60000 }) => Promise<{ ok: boolean, van?: string, model?: string, soLa?: string[], loi?: string }>
  ```
  Tin nhắn hệ thống (cố định): «Bạn là chuyên viên Sở Nông nghiệp và Môi trường tỉnh Sơn La soạn báo cáo hành chính. Chỉ dùng thông tin trong các trích đoạn đánh số. Sau mỗi số liệu ghi [n]. Không có số liệu thì ghi "(chưa có số liệu)". Không chào hỏi, không giải thích, viết thành đoạn văn hành chính ngôi "Sở Nông nghiệp và Môi trường".» Số trong `kiemSo` = chuỗi `\d[\d.,]*` có ≥ 2 chữ số hoặc có dấu phân cách; so sau khi chuẩn hóa `.`/`,`; bỏ qua số trong `[n]`.

- [ ] **Step 1:** Kiểm thử với `fetchFn` giả: gửi đúng `POST` JSON `{messages}`; `messages[0].role === 'system'`; trích đoạn của văn bản `doMat` không có trong nội dung gửi; `khongGui:['Công an tỉnh']` loại đoạn có cơ quan đó; phản hồi `{text:'Đã bàn giao 12,5 ha [1] và 99 tỷ [2]', model:'x'}` với trích đoạn chỉ có 12,5 → `soLa: ['99']`, `van` chứa `[[?99]]`; `fetchFn` ném lỗi/HTTP 500/hết `timeoutMs` → `ok:false`, có `loi`; không trích đoạn nào → không gọi `fetchFn`, `ok:false, loi:'KHONG_CO_TRICH_DOAN'`.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS. Commit `feat: tinh chỉnh tùy chọn qua Cloudflare Worker`.

### Task 10: Chế độ ghi nhận API (`src/ghinhan.js` + `src/ioffice.js`)

**Files:** Create `src/ghinhan.js`, Modify `src/ioffice.js` (thêm `batGhiNhan()`, `layGhiNhan()`, `hienCuaSo()`), Test `test/ghinhan.test.js`

**Interfaces:**
- Produces: `lamSach(raw: { api, method, data, res }) => { api: string /* bỏ query string, giữ tên tham số query */, method, thamSo: string[], mauThamSo: Record<string,string> /* chỉ kiểu: 'string'|'number'|'date dd/mm/yyyy'|'boolean' */, mauKetQua: object /* cấu trúc: khóa → kiểu, mảng chỉ lấy phần tử đầu, chuỗi thay bằng '<string:độ dài>' */ }`; `gopGhiNhan(ds) => ds` (gộp theo `api`+`method`).
- `ghiNhanBridge()` (chạy trong trang): bọc `$Vpdt.Api2` một lần, đẩy `{api, method, data, res}` vào `window.__iosyncLog` (tối đa 200 phần tử); **không** đọc header/token.
- `IOffice.batGhiNhan()` chèn bridge; `layGhiNhan()` lấy log → `lamSach` → `gopGhiNhan`; vỏ lưu `userData/api-ghi-nhan.json`.

- [ ] **Step 1:** Kiểm thử `lamSach`: `api:'/api/x?ma=1&tu=2'` → `api:'/api/x'`, `thamSo` có `ma`,`tu`; `data:{tu_ngay:'01/11/2026', page:1, token:'abc'}` → `mauThamSo.tu_ngay === 'date dd/mm/yyyy'`, khóa nào có tên chứa `token|password|mat_khau|authorization` bị bỏ hẳn; `res:{data:[{trich_yeu:'Bí mật nội dung', so:5}], total_row: 9}` → kết quả không chứa chuỗi `'Bí mật nội dung'`, có `mauKetQua.data[0].trich_yeu === '<string:15>'`; `gopGhiNhan` gộp 2 bản ghi cùng api.
- [ ] **Step 2–4:** FAIL → cài đặt → PASS. Commit `feat: chế độ ghi nhận API tra cứu`.

### Task 11: Vỏ Electron — tài khoản, lịch, khay, IPC (`src/main.js`, `src/preload.js`, `src/app/*`, `src/store.js`)

**Files:** Create `src/main.js`, `src/preload.js`, `src/app/taikhoan.js`, `src/app/dieuphoi.js`, `src/app/tray.js` (chép), `src/store.js` (chép quetvanban, rút gọn `DEFAULT_SETTINGS` = `DEFAULTS` Task 1), Test `test/dieuphoi.test.js`

**Interfaces:**
- Consumes: `IOffice`, `partitionFor` (1), `Kho` (4), `denHan/khoangLuot/buKhiMoMay` (5), `thuThap` (6), `readPdf`/`ocrPdf` (pdftext), `tongHop`, `danhMucVanBan` (7), `docKhung/xuatBaoCao/xuatDuLieuTho` (8), `tinhChinhMuc` (9), ghi nhận (10).
- Produces (`dieuphoi.js`, thuần, có kiểm thử):
  ```
  class DieuPhoi {
    constructor({ store, kho, taoIo: (tk) => IOffice-like, thuThap, now, log, thongBao })
    async chayLuot({ lyDo: 'lich'|'bu'|'tay'|'thulai' }) => { theoTaiKhoan: Record<string, ket qua thuThap> }   // tuần tự từng tài khoản; một tài khoản lỗi không chặn tài khoản sau
    async ocrLucRanh({ gioiHanTrang = 10 }) => number
    async layTheoSo(soKyHieu: string) => VanBan[]   // tìm trong kho; chưa có → liệt kê theo khoảng tuNgayDau..nay ở từng tài khoản, lọc số ký hiệu, thu thập chỉ văn bản đó
    dung(): void
  }
  ```
  `store.data.taiKhoan[id] = { ten, partition, lastOkAt, lastRunAt, lastFailAt, loi }`. `lastOkAt` chỉ cập nhật khi `ok && !hetGioiHan && !dung`. Một lượt chạy mỗi lần (khóa `dangChay`).
- `main.js`: một phiên bản (`requestSingleInstanceLock`); `app.setLoginItemSettings({ openAtLogin: true, args: ['--an'] })` (bật mặc định, tắt được ở Cài đặt); `--an` → khởi động ẩn ở khay; đóng cửa sổ = ẩn xuống khay; hẹn giờ kiểm tra mỗi 60 giây gọi `denHan`/`buKhiMoMay`; OCR lúc rảnh khi `powerMonitor.getSystemIdleTime() >= 300`; thông báo khay khi tài khoản cần đăng nhập lại; `--self-test <pdf> <json>` chạy `readAny` + `ocrPdf` rồi thoát (CI dùng).
- IPC (preload `window.bc`): `taiKhoan.ds/them/xoa/dangNhap`, `quet.ngay/dung/tienDo(cb)`, `kho.tim/thongKe/layTheoSo/moGoc(vbId)` (tải lại tệp vào thư mục tạm, mở bằng `shell.openPath`), `baoCao.napDeCuong(path)/napBieuMau(path) /* .xlsx: mỗi sheet thành một Muc 'bangSoLieu' gắn vào mục người dùng chọn hoặc cuối phụ lục */ /napChuDe(text, so)/phanTich(opts)/capNhatMuc(id, patch)/xuat(opts) => {baoCao, duLieuTho}`, `caiDat.doc/ghi`, `ghiNhan.bat/lay`, `nhatKy.doc`. Đề cương đang làm + lựa chọn người dùng lưu `store.data.baoCao` (lựa chọn `chon`, `bat`, `tuKhoaThem`, `ghim` không bị `phanTich` lần sau ghi đè).
- [ ] **Step 1:** Kiểm thử `DieuPhoi` với `taoIo` giả và `thuThap` giả: hai tài khoản, tài khoản 1 ném lỗi → tài khoản 2 vẫn chạy, tài khoản 1 có `lastFailAt`, `lastOkAt` không đổi; `hetGioiHan:true` → `lastOkAt` không đổi; gọi `chayLuot` hai lần song song → lần hai trả ngay `{ dangChay: true }`; `layTheoSo('131/KH-UBND')` khi kho đã có → không gọi `thuThap`.
- [ ] **Step 2–4:** FAIL → cài đặt `dieuphoi.js` → PASS.
- [ ] **Step 5:** Cài đặt `main.js`, `preload.js`, `taikhoan.js` (mở cửa sổ iOffice hiển thị cho đăng nhập qua `IOffice.interactiveLogin`). Chạy `npx electron . --self-test <pdf giả> out.json` trên Linux có `xvfb-run` → `out.json` có `ok:true`.
- [ ] **Step 6:** Commit `feat: vỏ Electron, nhiều tài khoản, lịch và khay`.

### Task 12: Giao diện (`src/ui/*`)

**Files:** Create `src/ui/index.html`, `style.css`, `core.js`, `tab-baocao.js`, `tab-decuong.js`, `tab-kho.js`, `tab-caidat.js`, `tab-nhatky.js`, `app.js`, `src/ui/cay.js` (hàm thuần dựng cây hiển thị), Test `test/cay.test.js`, `test/version.test.js`

**Interfaces:**
- Consumes: IPC `window.bc` (Task 11).
- Produces: `cay.js`: `phangCay(muc: Muc[]) => { id, cap, nhan: string /* 'I.' | '1.' | '1.1.' | 'a)' */, tieuDe, bat, soTrich: number }[]` dùng cho danh sách mục.
- 5 tab theo spec §5.9: **Báo cáo mới** (kéo-thả Word/Excel; ô chủ đề; ô số ký hiệu ghim; từ ngày/đến ngày mặc định 01/01–31/12 của `dc.nam`; «Phân tích»); **Đề cương** (danh sách mục bên trái với công tắc bật/tắt + nhãn dạng; bên phải trích đoạn có ô chọn, nguồn bấm được → `kho.moGoc`; ô từ khóa thêm; nút «Tinh chỉnh AI mục này» chỉ hiện khi AI bật; nút «Xuất báo cáo» → hai tệp, mở thư mục chứa); **Kho văn bản** (ô tìm, lọc năm/chiều, bảng kết quả, thống kê số văn bản/tài khoản/chờ OCR, tiến độ lượt, «Quét ngay», «Dừng», «Lấy ngay theo số ký hiệu»); **Tài khoản & Cài đặt** (danh sách tài khoản + «Đăng nhập» + ghi chú «Chỉ dùng tài khoản khi chủ tài khoản đồng ý»; giờ quét; mốc lùi; giới hạn; thư mục kho; thư mục quetvanban; tự khởi động; AI: công tắc, địa chỉ Worker, danh sách không gửi, cảnh báo «Trích đoạn sẽ được gửi tới Cloudflare Workers AI»; «Ghi nhận API»: bật → mở cửa sổ iOffice → «Lưu kết quả»); **Nhật ký & Giới thiệu** (phiên bản, `#whatsNew`).
- Trước lượt gửi AI đầu tiên của một báo cáo: hộp xác nhận nêu số trích đoạn và số văn bản sẽ gửi.
- [ ] **Step 1:** Kiểm thử `phangCay` (nhãn đúng cấp, giữ thứ tự) và `test/version.test.js` (phiên bản `package.json` xuất hiện trong `#whatsNew` của `index.html`).
- [ ] **Step 2–4:** FAIL → cài đặt → PASS.
- [ ] **Step 5:** Chạy với dữ liệu mẫu: `node test/mau/seed.js .demo && IOSYNC_USERDATA=.demo xvfb-run npx electron .` (seed tạo kho giả và một đề cương giả); chụp ảnh các tab (cách `IOSYNC_SNAPSHOT` của quetvanban), tự xem bố cục ở chiều rộng 1280 và 900.
- [ ] **Step 6:** Commit `feat: giao diện 5 tab`.

### Task 13: CI, đóng gói, tài liệu phát hành

**Files:** Create `.github/workflows/ci.yml`, `test/mau/scan-gia.pdf` (ảnh chữ giả, sinh bằng `tools/tao-scan-gia.js`), Modify `README.md`, `CHANGELOG.md`

- [ ] **Step 1:** `ci.yml` theo quetvanban: job `test` (windows-latest, Node 22, `npm ci`, `npm test`); job `build` (`npm run dist`; self-test `--self-test test/mau/scan-gia.pdf selftest.json`, yêu cầu `ok:true` và `method` là `ocr`; tải artifact `BaoCaoIOffice-Setup-*.exe`); tag `v*` → bản phát hành nháp.
- [ ] **Step 2:** `tools/tao-scan-gia.js`: dựng một trang PDF chỉ có ảnh PNG chữ «BÁO CÁO THỬ NGHIỆM 12,5 ha» (vẽ bằng pngjs + phông bitmap đơn giản, hoặc dựng ảnh bằng LibreOffice trong lúc phát triển rồi commit tệp kết quả).
- [ ] **Step 3:** Chạy `npm test 2>&1 | tail -25` → tất cả PASS. Đẩy nhánh, chờ CI xanh trên Windows, tải artifact.
- [ ] **Step 4:** README: hướng dẫn cài; đăng nhập tài khoản; ghi nhận API; làm báo cáo đầu tiên; bảo mật (không lưu mật khẩu; độ mật; AI mặc định tắt; dữ liệu nằm ở `%LOCALAPPDATA%`). CHANGELOG `0.1.0`. Commit `ci: đóng gói bộ cài Windows`.

---

## Kiểm tra trên máy cơ quan (sau khi có bộ cài, anh Lâm làm)

1. Đăng nhập 1–2 tài khoản → «Quét ngay» → kiểm tra Kho có văn bản đến/đi, văn bản mật chỉ có trích yếu; trạng thái văn bản trên iOffice không đổi.
2. Ghi nhận API: tra cứu một lần trên kho Sở → gửi `api-ghi-nhan.json` cho người phát triển (để làm bản 0.2).
3. Nạp đề cương NQ 09 → Phân tích → Xuất → so với BC_NQ_09 đã ban hành.
