# Tổng hợp báo cáo iOffice

Ứng dụng Windows chạy nền, gom văn bản đến/đi trên **VNPT iOffice** (chỉ đọc) của một hoặc nhiều tài khoản vào **kho chữ cục bộ** có tìm kiếm toàn văn. Từ một **đề cương báo cáo** (tệp Word cấp trên gửi) hoặc vài dòng chủ đề, ứng dụng tìm văn bản liên quan, trích các đoạn có số liệu **kèm nguồn**, rồi xuất:

- **Báo cáo Word** trên khung mẫu của Sở (khối đầu, tên loại, Kính gửi, nội dung theo đề cương, phụ lục danh mục văn bản, nơi nhận, khối ký; số và ngày để trống);
- **Tệp dữ liệu thô** (.docx và .md) gồm yêu cầu từng mục và toàn bộ trích đoạn, để tự đưa vào AI tinh chỉnh.

Tùy chọn (mặc định **tắt**): gửi trích đoạn đã chọn của từng mục tới Cloudflare Worker để viết thành văn. Số liệu không có trong trích đoạn được tô vàng để kiểm tra.

Thiết kế: [`docs/superpowers/specs/2026-11-23-bao-cao-ioffice-design.md`](docs/superpowers/specs/2026-11-23-bao-cao-ioffice-design.md)

## Cài đặt

1. Tải `BaoCaoIOffice-Setup-x.y.z.exe` ở mục **Releases** (hoặc **Actions → artifact**) của repo này.
2. Cài theo người dùng (không cần quyền quản trị). Bộ cài chưa ký số: SmartScreen → *More info → Run anyway*.
3. Ứng dụng tự chạy khi mở máy và nằm ở khay hệ thống (tắt được trong Cài đặt).

## Sử dụng

1. **Tài khoản & Cài đặt** → *Thêm tài khoản* → *Đăng nhập*: tự đăng nhập trong cửa sổ iOffice. Ứng dụng **không lưu mật khẩu**; chỉ dùng tài khoản người khác khi chủ tài khoản đồng ý.
2. Quét nền: 12:00 hằng ngày (đổi được), máy tắt lúc đó thì chạy bù sau khi mở máy ~5 phút. Lượt đầu lấy từ 01/01/2025 và chia nhiều ngày theo giới hạn tải (mặc định 300 lời gọi, 100 tệp mỗi tài khoản mỗi lượt). Nút **Quét ngay** để chạy lập tức.
3. **Báo cáo mới**: kéo thả đề cương Word, hoặc gõ chủ đề (+ số ký hiệu văn bản cần lấy) → kiểm tra kỳ báo cáo, trích yếu, Kính gửi, đoạn mở → **Phân tích**.
4. **Đề cương**: bật/tắt từng mục (mục chỉ đề nghị đơn vị khác báo cáo mặc định tắt), bỏ chọn trích đoạn không phù hợp, thêm từ khóa, mở văn bản gốc; có thể nạp biểu mẫu Excel → **Xuất báo cáo Word** (lưu ở `Documents\BaoCaoIOffice\`).
5. **Kho văn bản**: tìm toàn văn (có dấu hoặc không dấu), **Lấy ngay theo số ký hiệu** khi cần một văn bản chưa có.
6. **Ghi nhận API tra cứu** (một lần, để làm bản 0.2): bật → tra cứu văn bản trong cửa sổ iOffice → *Lưu kết quả* → gửi tệp `api-ghi-nhan.json` cho người phát triển. Tệp chỉ có tên API, tên/kiểu tham số và cấu trúc kết quả.

## Dữ liệu và bảo mật

- iOffice **chỉ đọc**: danh sách trắng API đọc; mọi lời gọi chạy trong trang đã đăng nhập, ứng dụng không thấy mật khẩu hay token.
- **Đọc xong xóa tệp**: tệp tải về thư mục tạm, đọc chữ (PDF, Word, Excel; bản scan được OCR tiếng Việt ngay trên máy) rồi xóa; kho chỉ giữ chữ và thông tin văn bản (~100–300 MB/năm/tài khoản) tại `%LOCALAPPDATA%\BaoCaoIOffice\kho`. Có thể giữ tệp gốc cho một số loại văn bản, có trần dung lượng.
- Văn bản có **độ mật**: chỉ lưu số, ngày, trích yếu; không tải, không đọc, không gửi AI.
- Tệp do phần mềm quetvanban đã lưu (`H:\Van ban den\`) được đọc lại để đỡ tải, không bao giờ bị sửa hay xóa.
- Repo **công khai**: không chứa văn bản thật; dữ liệu kiểm thử là chữ giả tự tạo.

## Phát triển

Node ≥ 20 (CI dùng 22). Phát triển/kiểm thử được trên Linux; chạy thật trên Windows.

```bash
npm ci
npm test                                                         # kiểm thử node:test
node test/mau/seed.js .demo && BCIO_USERDATA=$PWD/.demo npm start  # xem giao diện với dữ liệu mẫu
BCIO_USERDATA=$PWD/.demo BCIO_SNAPSHOT=./shots npx electron .     # chụp ảnh các tab rồi thoát
npm run dist                                                     # bộ cài NSIS (CI làm trên windows-latest)
node tools/tao-khung.js <báo cáo thật.docx> assets/khung-bao-cao.docx   # dựng lại khung rỗng từ một báo cáo đã ban hành
```

| Tệp | Vai trò |
|---|---|
| `src/ioffice.js` | Adapter iOffice chỉ đọc, phân vùng đăng nhập theo tài khoản, ghi nhận API |
| `src/docread.js` | Đọc .docx/.doc/.xlsx/.pdf thành chữ |
| `src/vntext.js`, `src/decuong.js` | Tiếng Việt (bỏ dấu, từ khóa, số ký hiệu); cây đề cương |
| `src/kho.js`, `src/thuthap.js` | Kho theo năm + chỉ mục MiniSearch; lượt thu thập một tài khoản |
| `src/tonghop.js` | Chọn văn bản, trích đoạn có số liệu, danh mục văn bản |
| `src/xuatword.js` | Báo cáo Word trên khung (sửa XML), dữ liệu thô |
| `src/ai.js` | Cloudflare Worker (tùy chọn), kiểm số liệu |
| `src/app/*` | Điều phối quét, phiên báo cáo, khay; `src/main.js` vỏ Electron; `src/ui/` giao diện |

Phát hành: mỗi bộ cài tăng phiên bản (`npm version x.y.z --no-git-tag-version`) và cập nhật `#whatsNew` trong `src/ui/index.html` (kiểm thử `test/version.test.js`).
