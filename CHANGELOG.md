# Nhật ký thay đổi

## 0.1.1
- Quét: tệp quá thời gian (TIMEOUT) không còn bị coi là mất phiên — kiểm tra lại phiên, còn đăng nhập thì đi tiếp; tệp > 30 MB bỏ qua (chặn trong trang trước khi tải); tệp lỗi thử lại tối đa 3 lượt, chỉ tải lại tệp lỗi; văn bản chưa có trong kho được xử lý trước văn bản cần thử lại.
- Dừng có hiệu lực giữa các tệp; tiến độ ghi tên tệp; giao diện cập nhật số văn bản trong lúc quét; nhật ký ghi tệp tải lâu (≥ 5 giây) và lỗi từng tệp.
- Chạm giới hạn lượt → tự chạy lượt tiếp sau 15 phút (cài đặt quetTiepPhut).
- Biểu tượng mới (tờ báo cáo + biểu đồ, nền xanh ngọc), màu giao diện xanh ngọc.
- Lỗi nhỏ: xóa tài khoản xóa phiên đăng nhập; không đổi thư mục kho/xóa tài khoản khi đang quét; lấy theo số ký hiệu không chạy chồng lượt quét; dọn tệp tạm sau 2 giờ; tên tệp tạm/giữ tệp an toàn trên Windows; escXml bỏ U+FFFE/U+FFFF/surrogate lẻ; danh mục văn bản chỉ nạp chữ các năm trong kỳ; nguồn ghi «(Văn bản số …, ngày …, tr. …)»; tình trạng tài khoản ghi lỗi làm dừng lượt.

## 0.1.0
- Bản đầu: nhiều tài khoản iOffice (chỉ đọc), kho văn bản cục bộ có tìm toàn văn, đọc đề cương Word, xuất báo cáo Word theo khung mẫu của Sở và tệp dữ liệu thô, tùy chọn tinh chỉnh qua Cloudflare Worker, chế độ ghi nhận API tra cứu.
