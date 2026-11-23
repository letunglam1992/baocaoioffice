# Thiết kế: Phần mềm «Tổng hợp báo cáo iOffice»

Ngày: 23/11/2026 · Người dùng: anh Lê Tùng Lâm, Phòng Kế hoạch - Tài chính, Sở NNMT Sơn La · Repo: `letunglam1992/baocaoioffice` (công khai)

## 1. Mục đích

Chuẩn bị họp/báo cáo hiện tốn nhiều công: dò văn bản đến/đi trên iOffice, mở từng văn bản, chép số liệu, rồi soạn báo cáo theo đề cương cấp trên gửi.
Phần mềm tự làm phần dò - mở - đọc - trích, và ghép thành **bản báo cáo Word đúng thể thức của Sở**, để anh Lâm chỉ còn rà, sửa và trình ký.

Thành công = với đề cương kiểu «Đề cương báo cáo NQ 09-NQ/TU» (Sở Tài chính gửi), phần mềm cho ra:
1. Tệp Word báo cáo theo khung mẫu `BC_NQ_09` (khối đầu, BÁO CÁO, Kính gửi, «Thực hiện …», nội dung theo đề cương, phụ lục, nơi nhận, khối ký) — mỗi mục có các trích đoạn/số liệu kèm nguồn;
2. Phụ lục 01 «Danh mục văn bản lãnh đạo, chỉ đạo …» điền **tự động** từ các văn bản tìm được;
3. Tệp «dữ liệu thô» để anh tự đưa vào AI (hướng a), hoặc — khi bật — các mục đã được Worker AI viết thành văn.

## 2. Mục tiêu / không làm / thất bại

**Mục tiêu**
- Ứng dụng Windows (.exe, NSIS, cài theo người dùng), tự khởi động cùng Windows, nằm ở khay hệ thống.
- Đầu vào: (1) tệp Word đề cương (.docx/.doc), kèm biểu mẫu bảng trong Word hoặc Excel; (2) vài dòng chủ đề tự gõ; (3) danh sách số ký hiệu văn bản cần lấy.
- Nguồn: văn bản đến + văn bản đi của **một hoặc nhiều tài khoản iOffice**, và **kho văn bản chung của Sở** (tra cứu) qua tài khoản có quyền xem.
- Chạy nền: định kỳ tải/đọc văn bản mới vào **kho cục bộ có chỉ mục toàn văn**, để lúc làm báo cáo tìm ngay trên máy.
- Đầu ra: Word báo cáo (khung mẫu của Sở) + Word/Markdown dữ liệu thô; tùy chọn tinh chỉnh bằng Cloudflare Worker.

**Không làm**
- Không ghi bất cứ gì lên iOffice (không chuyển, không đánh dấu đã xem, không cập nhật).
- Không tự trình ký, không tự cấp số/ngày; số, ngày, tên người ký chưa biết → để trống đúng kiểu mẫu.
- Không thay quetvanban (đồng bộ nhiệm vụ → Google Sheet). Hai ứng dụng độc lập, có thể dùng chung thư mục `H:\Van ban den\` (chỉ đọc).
- Không cộng gộp/suy diễn số liệu ở hướng a: chỉ trích nguyên văn kèm nguồn.

**Thất bại dù vẫn «chạy»**
- Bịa số liệu, số văn bản hoặc đưa số liệu không có nguồn vào báo cáo.
- Đưa nội dung văn bản **có độ mật** vào kho, báo cáo hay gửi AI.
- Lưu/ghi log mật khẩu, token iOffice.
- Gây tải bất thường cho máy chủ iOffice (quét ồ ạt) → bị khóa tài khoản.
- Đưa dữ liệu văn bản thật lên repo công khai.

## 3. Ràng buộc

- Nguyên tắc cứng kế thừa từ quetvanban (CLAUDE.md, docs/QUYET-DINH.md): iOffice **chỉ đọc**, danh sách trắng API; gọi qua `window.__iosync` trong ngữ cảnh trang đã đăng nhập; không đọc/lưu token; văn bản độ mật không tải/đọc; file không ghi đè/xóa; giãn cách ≥ 700 ms giữa các lời gọi.
- AI: quyết định #1 của quetvanban (AI tắt) **không áp dụng nguyên trạng** cho ứng dụng này — anh Lâm chỉ đạo 23/11/2026: mặc định hướng a (không gửi ra ngoài), **có tùy chọn** gọi Cloudflare Worker như dashboard theodoinhiemvu. Mặc định **tắt**.
- Thể thức: NĐ 30/2020/NĐ-CP (Điều 8, 9, 13, 15) và skill `van-ban-hanh-chinh`: không dựng văn bản từ đầu — sửa XML trên khung mẫu; Times New Roman 14, căn đều, thụt đầu dòng 1,27 cm.
- Repo **công khai**: chỉ mã + dữ liệu mẫu **tự tạo**. Không chép `test/` của quetvanban; không commit đề cương/báo cáo thật anh Lâm đã gửi (dùng để dựng khung, giữ ngoài repo hoặc thay nội dung bằng chữ giả).
- Máy cơ quan Windows, cấu hình văn phòng; không quyền admin.

## 4. Các phương án đã cân nhắc

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **A. Phát triển từ nền quetvanban (Electron/Node)** | Dùng lại adapter iOffice chỉ đọc, pdf.js + Tesseract tiếng Việt, khay, NSIS, CI Windows đã chạy ổn | Xử lý Word bằng Node phải sửa XML (JSZip) | **Chọn** (anh Lâm duyệt 23/11/2026) |
| B. Viết mới Python + Playwright | python-docx mạnh, có sẵn `vbhc_edit.py` | Viết lại iOffice/OCR; điều khiển trình duyệt dễ gãy; bộ cài nặng | Loại |
| C. Electron + tiến trình Python ghép Word | Tận dụng cả hai | Hai ngôn ngữ, đóng gói/gỡ lỗi phức tạp | Loại |

Về AI: (a) không gửi ra ngoài — **chọn mặc định**; (b) Cloudflare Worker — **chọn làm tùy chọn**; (c) LLM cục bộ (Ollama) — loại (máy chậm, tiếng Việt yếu).

## 5. Thiết kế

### 5.1 Kiến trúc

```
Electron main
 ├─ Tài khoản (mỗi tài khoản 1 phân vùng persist:ioffice-<id>, cửa sổ iOffice ẩn + __iosync)
 ├─ Thu thập nền (lịch) ─► danh sách VB đến/đi + tra cứu kho Sở ─► chi tiết ─► tải file ─► đọc chữ/OCR
 │                                                                     │
 │                                                    Kho cục bộ (JSON/NDJSON + chỉ mục toàn văn)
 ├─ Đề cương: đọc .docx/.doc/.xlsx/gõ tay ─► cây mục ─► truy vấn cho từng mục
 ├─ Tổng hợp: tìm trong kho (+ tìm bổ sung trực tiếp trên iOffice) ─► chọn đoạn ─► (tùy chọn) Worker AI
 └─ Xuất: khung mẫu báo cáo (XML) ─► Báo cáo.docx + Dữ-liệu-thô.docx/.md
Renderer (HTML/CSS/JS thuần, CSP chặt) ◄─ IPC (preload, contextIsolation, sandbox)
```

Mô-đun lấy lại từ quetvanban (chép mã, không chép dữ liệu): `ioffice.js` (tham số hóa phân vùng), `pdftext.js`, `retry.js`, `store.js`, khay/lịch/thông báo, cấu hình electron-builder + CI.

### 5.2 Tài khoản iOffice

- Danh sách tài khoản trong Cài đặt: tên gợi nhớ + phân vùng riêng. Nút «Đăng nhập» mở cửa sổ iOffice thật; người dùng tự nhập mật khẩu. **Ứng dụng không lưu mật khẩu** (phiên cookie nằm trong phân vùng Chromium, mã hóa DPAPI).
- Mỗi văn bản trong kho ghi `taiKhoan` đã lấy được; khi chạy, thứ tự ưu tiên tài khoản cấu hình được.
- Phiên hết hạn → thông báo khay «Tài khoản X cần đăng nhập lại», các tài khoản khác vẫn chạy.
- Dùng tài khoản người khác: giao diện ghi chú cần có sự đồng ý của chủ tài khoản (trách nhiệm người dùng).

### 5.3 Nguồn văn bản và API

| Nguồn | API | Trạng thái |
|---|---|---|
| VB đến của tài khoản | `danh-sach-van-ban-den-theo-trang-thai-cua-chuyen-vien` (1/2/3) + `van-ban-den-chi-tiet` | Đã xác minh (quetvanban) |
| VB đi đã phát hành | `danh-sach-van-ban-di-da-phat-hanh-cua-chuyen-vien` + `chi-tiet-van-ban-di` | Lấy từ mã giao diện, chưa gọi thử |
| Kho chung của Sở (tra cứu) | **chưa biết** | Cần dò |
| File | `$fileManager.generateAPIViewFile` → fetch trong trang | Đã xác minh |

**Dò API tra cứu** — chế độ «Ghi nhận API» trong Cài đặt: mở cửa sổ iOffice hiển thị, người dùng tự tra cứu một lần; ứng dụng bọc `$Vpdt.Api2` trong trang để **ghi tên API, phương thức, tên tham số và một mẫu cấu trúc kết quả** (không ghi token/header), lưu `api-ghi-nhan.json` để gửi cho người phát triển. API tra cứu chỉ được thêm vào `ALLOWED_APIS` sau khi xác nhận là API đọc. Trước khi có API tra cứu, nguồn «kho Sở» dùng được bằng cách đăng nhập tài khoản có quyền xem rộng và đọc danh sách VB đến/đi của tài khoản đó.

### 5.4 Thu thập nền và kho cục bộ

- Lịch mặc định: 1 lượt/ngày 12:00 + khi máy mở lại (bù). Lượt đầu tiên kéo lùi theo cấu hình (mặc định từ 01/01 năm trước) **có giới hạn tốc độ** (≥ 700 ms/lời gọi, tối đa N file/lượt, cấu hình được), dừng được giữa chừng, lượt sau làm tiếp.
- Mỗi văn bản: metadata (số ký hiệu, ngày ban hành, cơ quan ban hành, loại, trích yếu, chiều đến/đi, tài khoản) + danh sách file + **toàn văn đã đọc** (PDF lớp chữ / OCR; .docx; .doc; .xlsx → chữ theo ô). Độ mật ≠ thường → chỉ lưu metadata, gắn cờ, không tải file.
- **Cách lưu B (anh Lâm chọn 23/11/2026): đọc xong xóa tệp, chỉ giữ chữ.** Tệp tải vào thư mục tạm của ứng dụng → đọc chữ → lưu toàn văn theo trang + metadata + `path`/`name` trên iOffice → xóa tệp tạm. Xem bản gốc / OCR sau → tải lại từ iOffice. Ước tính 100–300 MB/năm/tài khoản. Nếu file đã có trong `H:\Van ban den\` (quetvanban) thì đọc trực tiếp từ đó, **không xóa, không ghi** gì vào thư mục đó.
- Tùy chọn «Giữ tệp gốc» theo loại văn bản (mặc định tắt), có trần dung lượng; vượt trần → xóa tệp giữ lâu nhất trong thư mục giữ tệp của ứng dụng.
- Chỉ mục toàn văn: thư viện JS thuần (vd MiniSearch) với bộ tách từ tiếng Việt đơn giản (chuẩn hóa NFC, bỏ dấu song song bản có dấu, n-gram 2 âm tiết); lưu ra đĩa, nạp lười. Tránh SQLite native để khỏi lỗi build Windows.
- Theo trang: lưu toàn văn theo trang để trích dẫn «trang n».

### 5.5 Đọc đề cương

- .docx: đọc `word/document.xml` (JSZip); .doc: chuyển bằng thư viện đọc .doc thuần JS (vd `word-extractor`) → chữ theo đoạn; bảng .doc nếu không đọc được → yêu cầu người dùng lưu sang .docx.
- **Cây mục** theo mẫu đánh số: `I.`/`II.` (La Mã) → `1.` → `1.1.` → `a)` → `-`/`+`. Đoạn không đánh số dưới một mục → mô tả của mục đó.
- Phân loại câu: câu bắt đầu «Đề nghị …», «(Đề nghị …)» → **chỉ dẫn**, không đưa vào báo cáo; trích tên đơn vị được đề nghị (danh mục đơn vị cấu hình được) → nếu không có «Sở Nông nghiệp và Môi trường»/«các sở, ngành» → mục mặc định **tắt** (người dùng bật lại được).
- Dạng mục:
  - **Bảng danh mục văn bản** (có bảng cột «Số, ký hiệu văn bản | Ngày ban hành | Cơ quan ban hành | Trích yếu») → điền tự động.
  - **Bảng/biểu số liệu** (bảng Word khác, hoặc tệp Excel kèm) → giữ nguyên khung, mỗi ô trống kèm danh sách đoạn chứa số liệu ứng viên; **không tự điền số** ở hướng a (người dùng chọn).
  - **Mục văn** (còn lại) → các trích đoạn.
- Giao diện cho sửa cây mục: bật/tắt mục, đổi dạng, thêm từ khóa, ghim văn bản cụ thể cho mục.
- Chủ đề tự gõ: mỗi dòng = một mục văn; danh sách số ký hiệu = ghim văn bản.

### 5.6 Tìm và chọn trích đoạn (không AI)

- Truy vấn mỗi mục = từ khóa trích từ tiêu đề + mô tả (bỏ từ dừng hành chính: «kết quả», «thực hiện», «báo cáo», «đề nghị» …) + **ngữ cảnh chung** của đề cương (văn bản gốc viện dẫn: «09-NQ/TU», «131/KH-UBND»; kỳ báo cáo «năm 2026») + từ khóa người dùng thêm.
- Lọc: khoảng thời gian (mặc định kỳ báo cáo suy từ đề cương, sửa được), cơ quan/chiều đến-đi.
- Xếp hạng văn bản: điểm toàn văn + thưởng nếu viện dẫn văn bản gốc + thưởng văn bản đi của Sở (là kết quả «của mình»). Lấy tối đa K văn bản/mục (mặc định 8).
- Trích đoạn: đoạn văn (theo ngắt đoạn/trang) chứa từ khóa; ưu tiên đoạn có **con số + đơn vị** (dự án, tỷ đồng, ha, %, hộ, văn bản). Tối đa M đoạn/mục (mặc định 6), mỗi đoạn ≤ ~600 ký tự.
- Mỗi trích đoạn mang nguồn: `số ký hiệu, ngày, cơ quan, trang`.
- **Phụ lục danh mục văn bản**: các văn bản trong kho có viện dẫn văn bản gốc trong trích yếu hoặc phần căn cứ/đoạn mở, do cơ quan được chọn ban hành (mặc định văn bản đi của Sở + văn bản UBND tỉnh), sắp theo ngày; người dùng bỏ chọn dòng thừa.
- Tìm bổ sung trực tiếp: nếu mục có ít kết quả và có API tra cứu → gọi tra cứu iOffice theo từ khóa, tải văn bản mới vào kho rồi xếp hạng lại.

### 5.7 Tinh chỉnh bằng AI (tùy chọn, mặc định tắt)

- Cùng Worker và giao thức với theodoinhiemvu: `POST {diaChi}` body `{messages:[{role,content}…]}` → `{text, model}`; địa chỉ mặc định `https://rasoatvanban.letunglam1992.workers.dev`, đổi được trong Cài đặt.
- Gửi **từng mục**: tiêu đề mục + yêu cầu của đề cương + các trích đoạn đánh số `[n]` + chỉ dẫn hệ thống: viết văn hành chính, ngôi «Sở Nông nghiệp và Môi trường», **chỉ dùng số liệu có trong trích đoạn**, ghi `[n]` sau mỗi số liệu, thiếu thì ghi «(chưa có số liệu)».
- Không gửi: văn bản có cờ độ mật; văn bản khớp danh sách «không gửi AI» (từ khóa/cơ quan); trước lượt gửi đầu tiên của mỗi báo cáo hiện hộp xác nhận liệt kê số văn bản sẽ gửi.
- Kiểm tra sau: mọi con số trong văn AI trả về phải xuất hiện trong trích đoạn → số lạ được tô vàng và ghi chú «cần kiểm tra». Worker lỗi/hết hạn mức → mục đó giữ bản thô.

### 5.8 Xuất Word

- **Khung**: tệp báo cáo mẫu của Sở (mẫu đầu tiên: `BC_NQ_09` anh Lâm cung cấp, lề trên 1,5 / dưới 1,7 / trái 3 / phải 1,7 cm). Người dùng có thể nạp thêm khung khác. Ứng dụng tách khung thành: khối đầu (bảng 2 cột), tên loại + trích yếu, «Kính gửi», đoạn mở, **thân** (xóa hết), câu kết «… trân trọng báo cáo./.», khối nơi nhận/ký, và **kiểu đoạn mẫu** (đề mục La Mã, đề mục số, a), gạch đầu dòng, đoạn thường) lấy từ chính khung.
- Sinh: trích yếu = tiêu đề đề cương (sửa được); «Kính gửi:» = cơ quan gửi đề cương (suy từ tên tệp/nội dung, sửa được); đoạn mở «Thực hiện …» liệt kê văn bản yêu cầu báo cáo; số «Số:      /BC-SNNMT», ngày «Sơn La, ngày      tháng … năm …» để trống.
- Thân: đánh số lại theo thể thức báo cáo của Sở (giữ La Mã; mục con cấp 2 của đề cương thành `a)`, `b)`… như mẫu) — **chỉ các mục đang bật**. Mỗi mục: các trích đoạn dạng gạch đầu dòng, cuối mỗi đoạn chú thích nguồn `(Văn bản số …, ngày …)`; mục không có kết quả ghi «[Chưa tìm thấy văn bản liên quan — cần bổ sung]» tô vàng.
- Phụ lục: ngắt trang, `Phụ lục 01` + tên + dòng `(Kèm theo Báo cáo số      /BC-SNNMT ngày …)`; bảng giữ đúng cột của đề cương.
- **Dữ liệu thô** (.docx và .md): mỗi mục: yêu cầu của đề cương → toàn bộ trích đoạn đã chọn + nguồn → gợi ý câu lệnh cho AI; người dùng dán cả tệp vào AI.
- Kiểm tra sau xuất: mở lại tệp bằng JSZip, tìm sót chữ của khung cũ (nội dung thân mẫu), đếm mục/phụ lục; CI chuyển PDF (LibreOffice) để chụp ảnh trang 1.

### 5.9 Giao diện (các tab)

1. **Báo cáo mới**: nạp đề cương (kéo-thả Word/Excel) hoặc gõ chủ đề; nhập số ký hiệu ghim; chọn kỳ báo cáo, khung mẫu → «Phân tích».
2. **Đề cương**: cây mục, công tắc bật/tắt, dạng mục, từ khóa; bấm mục → xem trích đoạn ứng viên, tích chọn/bỏ, mở văn bản gốc.
3. **Kho văn bản**: tìm toàn văn, lọc; tiến độ thu thập nền; nút «Lấy ngay» theo số ký hiệu.
4. **Tài khoản & Cài đặt**: tài khoản iOffice, lịch, giới hạn tốc độ, thư mục kho, danh mục đơn vị, AI Worker (tắt/bật, địa chỉ, danh sách không gửi), Ghi nhận API.
5. **Nhật ký** và **Giới thiệu** (phiên bản, «Có gì mới»).

Lưu trạng thái báo cáo đang làm (đề cương đã phân tích + lựa chọn của người dùng) để mở lại; lựa chọn người dùng không bị lượt phân tích lại ghi đè.

### 5.10 Kiểm thử

- `node:test`: cây mục (đề cương mẫu **tự tạo** cùng kiểu đánh số), phân loại câu «Đề nghị», tách từ/xếp hạng, trích đoạn có số liệu, phụ lục văn bản, ghép XML khung (khung mẫu **tự tạo** cùng cấu trúc, không dùng nội dung thật), giao thức Worker (máy chủ giả), kiểm số liệu AI.
- Adapter iOffice giả lập (như quetvanban) cho luồng thu thập.
- CI Windows: test → đóng gói NSIS → self-test OCR → artifact.

### 5.11 Các điểm đã chốt sau rà soát (người phát triển quyết định, anh Lâm kiểm tra)

- **Tệp mẫu thật**: đề cương NQ 09 (.docx) và BC_NQ_09 (.doc) đã xem cấu trúc: đánh số **gõ tay** (không có `w:numPr`/numbering), bảng phụ lục 6 cột **không gộp ô**, khung báo cáo có bảng khối đầu 2×2 và bảng nơi nhận/ký 1×2. Bộ dựng cây mục làm theo chữ đánh số; vẫn đọc `numbering.xml` ở mức tối thiểu cho đề cương khác dùng đánh số tự động. Hai tệp thật giữ ngoài repo (thư mục `.mau-that/` trong `.gitignore`); repo dùng bản sao **tự tạo** cùng cấu trúc với chữ giả. Khung mặc định đóng gói kèm ứng dụng là khung «rỗng» dựng từ BC_NQ_09 đã xóa hết nội dung thân, tên người ký.
- **Thứ tự giai đoạn**: các API đã biết lọc theo cán bộ, nên «kho Sở» thật sự cần API tra cứu. Bản 0.1 gồm: nhiều tài khoản + văn bản đến/đi của từng tài khoản + **chế độ Ghi nhận API**; bản 0.2 thêm tra cứu kho Sở sau khi dò được API. Phụ lục danh mục văn bản ở 0.1 lấy từ các tài khoản đã đăng nhập.
- **Kho**: chia theo năm (`kho/<năm>/vanban.ndjson` + chỉ mục theo năm, nạp lười). **OCR theo yêu cầu**: lượt nền chỉ đọc lớp chữ PDF/.docx/.doc; bản scan được OCR khi văn bản lọt vào kết quả tìm cho một mục, hoặc lúc máy rảnh (không thao tác ~5 phút), giới hạn số trang/lượt; tệp được tải lại lúc OCR rồi xóa.
- **Lịch nền**: 12:00 hằng ngày (lấy từ lượt trước − 3 ngày); máy tắt lúc 12:00 → chạy bù ~5 phút sau khi mở; chưa đăng nhập/mất mạng → báo khay, thử lại sau 30 phút. Lượt đầu kéo lùi từ 01/01/2025, chia nhiều ngày theo giới hạn tải. Nút «Quét ngay», «Lấy ngay theo số ký hiệu», dừng giữa lượt. Giờ quét, mốc lùi, giới hạn chỉnh được trong Cài đặt.
- **Thư mục kho** mặc định trên ổ máy (`%LOCALAPPDATA%\BaoCaoIOffice\kho`), đổi được trong Cài đặt. Đọc lại từ `H:\Van ban den\` chỉ là tối ưu phụ (khớp theo số + ngày); không khớp thì tải.
- **Không đổi trạng thái khi đọc** (anh Lâm xác nhận 23/11/2026): mở chi tiết/tệp văn bản không làm văn bản chuyển «đã xem/đang xử lý» → tài khoản người khác được đọc đầy đủ như tài khoản của mình. Kiểm thử chạy thật vẫn đối chiếu trạng thái trước/sau trên một văn bản.
- **Đăng nhập song song** (anh Lâm xác nhận 23/11/2026): một tài khoản đăng nhập nhiều nơi không bị đăng xuất → ứng dụng dùng phân vùng riêng, không phải né lịch quetvanban; vẫn chọn giờ 12:00 để tránh dồn tải 09:00/15:00/22:00.
- **Giới hạn tải**: mặc định ≤ 300 lời gọi API và ≤ 100 file mỗi tài khoản mỗi lượt, giãn ≥ 700 ms; cấu hình được.

## 6. Còn để người xây dựng quyết định

Tên thư viện cụ thể (MiniSearch / FlexSearch; word-extractor; SheetJS cho .xlsx), định dạng lưu kho, chi tiết bố cục giao diện, các ngưỡng K/M mặc định, cách chia mô-đun.

## 7. Việc phụ thuộc máy cơ quan

- Gọi thử API văn bản đi đã phát hành; dò API tra cứu kho Sở bằng chế độ «Ghi nhận API».
- Chạy thử với đề cương NQ 09 thật và so với báo cáo BC_NQ_09 đã ban hành.
