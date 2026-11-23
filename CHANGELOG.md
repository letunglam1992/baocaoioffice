# Nhật ký thay đổi

## 0.2.0
- Chỉ tải văn bản liên quan (thiết kế §8): quét nền `chiDanhSach` — lưu số, ngày, cơ quan, trích yếu, mã văn bản; không gọi chi tiết, không tải tệp.
- «Phân tích»: `chonVanBanCanTai` chọn theo trích yếu (≥ 1 cụm hai âm tiết hoặc ≥ 2 từ khóa), ghim số ký hiệu, văn bản viện dẫn văn bản gốc, trong kỳ báo cáo; tối đa `moiMuc` (15) / `toiDaBaoCao` (150); `DieuPhoi.layNoiDung` tự tải chi tiết + tệp (thử lần lượt các tài khoản đã thấy văn bản), rồi trích đoạn.
- `layTheoSo`, «Mở văn bản gốc» tự tải nội dung văn bản mới có trong danh sách; thống kê kho thêm `coNoiDung`; cài đặt thay «tối đa tệp/lượt» bằng «văn bản tối đa mỗi mục / mỗi báo cáo».

## 0.1.2
- Sửa lỗi 0.1.1: hàm tải tệp trong trang iOffice dùng biến `r` ngoài phạm vi khối `try` → mọi tệp tải hỏng («r is not defined»). Thêm kiểm thử chạy cầu nối trong trang với trang iOffice giả lập (`test/pagebridge.test.js`).
- Tệp lỗi do lỗi phần mềm (`is not defined`, `is not a function`, `Cannot read prop…`) không tính vào giới hạn 3 lần thử, luôn được tải lại.

## 0.1.1
- Quét: tệp quá thời gian (TIMEOUT) không còn bị coi là mất phiên — kiểm tra lại phiên, còn đăng nhập thì đi tiếp; tệp > 30 MB bỏ qua (chặn trong trang trước khi tải); tệp lỗi thử lại tối đa 3 lượt, chỉ tải lại tệp lỗi; văn bản chưa có trong kho được xử lý trước văn bản cần thử lại.
- Dừng có hiệu lực giữa các tệp; tiến độ ghi tên tệp; giao diện cập nhật số văn bản trong lúc quét; nhật ký ghi tệp tải lâu (≥ 5 giây) và lỗi từng tệp.
- Chạm giới hạn lượt → tự chạy lượt tiếp sau 15 phút (cài đặt quetTiepPhut).
- Biểu tượng mới (tờ báo cáo + biểu đồ, nền xanh ngọc), màu giao diện xanh ngọc.
- Lỗi nhỏ: xóa tài khoản xóa phiên đăng nhập; không đổi thư mục kho/xóa tài khoản khi đang quét; lấy theo số ký hiệu không chạy chồng lượt quét; dọn tệp tạm sau 2 giờ; tên tệp tạm/giữ tệp an toàn trên Windows; escXml bỏ U+FFFE/U+FFFF/surrogate lẻ; danh mục văn bản chỉ nạp chữ các năm trong kỳ; nguồn ghi «(Văn bản số …, ngày …, tr. …)»; tình trạng tài khoản ghi lỗi làm dừng lượt.

## 0.1.0
- Bản đầu: nhiều tài khoản iOffice (chỉ đọc), kho văn bản cục bộ có tìm toàn văn, đọc đề cương Word, xuất báo cáo Word theo khung mẫu của Sở và tệp dữ liệu thô, tùy chọn tinh chỉnh qua Cloudflare Worker, chế độ ghi nhận API tra cứu.
