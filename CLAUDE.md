# CLAUDE.md — hướng dẫn cho AI làm tiếp dự án

Người dùng: anh **Lê Tùng Lâm**, Phòng Kế hoạch - Tài chính, Sở NNMT Sơn La. **Luôn trao đổi bằng tiếng Việt**, thuật ngữ hành chính chính xác.

Đọc trước khi sửa: `docs/superpowers/specs/2026-11-23-bao-cao-ioffice-design.md` (thiết kế đã duyệt). Không tự đổi quyết định nghiệp vụ; mâu thuẫn → hỏi.

## Nguyên tắc cứng

- iOffice **chỉ đọc**: mọi lời gọi qua `window.__iosync` trong trang; chỉ thêm API vào `ALLOWED_APIS` khi là API đọc.
- Không đọc, lưu, ghi log mật khẩu/token. Mỗi tài khoản một phân vùng `persist:ioffice-<id>`.
- Văn bản có độ mật: chỉ lưu metadata; không tải tệp, không trích đoạn, không gửi AI.
- Cách lưu B: tệp tạm đọc xong xóa; thư mục quetvanban (`H:\Van ban den`) chỉ đọc.
- AI (Cloudflare Worker) mặc định **tắt**; số liệu AI viết phải có trong trích đoạn, số lạ đánh dấu.
- Không bịa số/ngày văn bản; để trống đúng kiểu mẫu.
- **Repo công khai**: không commit văn bản thật, đề cương/báo cáo thật, kho, dữ liệu chạy; dữ liệu kiểm thử là chữ giả.

## Lệnh

```bash
npm ci && npm test
npm start
npm run dist      # bộ cài Windows (CI làm trên windows-latest)
```

Phát hành: mỗi bộ cài tăng phiên bản (`npm version x.y.z --no-git-tag-version`) và cập nhật `#whatsNew` trong `src/ui/index.html`.
