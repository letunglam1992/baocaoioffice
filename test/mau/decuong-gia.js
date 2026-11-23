'use strict';
/** Đề cương GIẢ, cùng kiểu đánh số với đề cương báo cáo thật (nội dung bịa). */
const P = (text, o = {}) => ({ type: 'p', text, bold: !!o.bold, italic: false });
function blocksDeCuong() {
  return [
    P('ĐỀ CƯƠNG BÁO CÁO', { bold: true }),
    P('Kết quả thực hiện năm 2026 triển khai Nghị quyết số 09-NQ/TU ngày 30/12/2025 của Ban Chấp hành Đảng bộ tỉnh về phát triển thử nghiệm và Kế hoạch số 131/KH-UBND ngày 14/5/2026 của UBND tỉnh'),
    P(''),
    P('I. CÔNG TÁC LÃNH ĐẠO, CHỈ ĐẠO, TỔ CHỨC TRIỂN KHAI', { bold: true }),
    P('1. Công tác quán triệt, tuyên truyền Nghị quyết'),
    P('2. Công tác chỉ đạo, điều hành và ban hành văn bản'),
    P('Đề nghị các đơn vị báo cáo cụ thể các văn bản chỉ đạo theo Phụ lục 01'),
    P('II. KẾT QUẢ THỰC HIỆN', { bold: true }),
    P('1. Kết quả thực hiện chỉ tiêu'),
    P('1.1. Kết quả chung: Tổng số dự án mới và vốn đăng ký năm 2026; so sánh cùng kỳ'),
    P('1.2. Kết quả theo ngành, lĩnh vực: Đề nghị các sở, ngành được giao chủ trì báo cáo theo Phụ lục 02.'),
    P('1.3. Kết quả theo địa bàn trọng điểm (xã A, xã B). Đề nghị các xã, phường rà soát, đánh giá kết quả.'),
    P('1.4. Kết quả thu hút FDI: Đề nghị Ban quản lý các Khu công nghiệp tỉnh rà soát, bổ sung nội dung liên quan.'),
    P('1.5. Kết quả các dự án đối tác công tư: Đề nghị Sở Khoa học và Công nghệ rà soát, đánh giá (nếu có)'),
    P('1.6. Đánh giá mức độ đạt chỉ tiêu: Đề nghị các cơ quan, đơn vị thực hiện đánh giá kết quả'),
    P('2. Kết quả thực hiện nhiệm vụ, giải pháp'),
    P('2.1. Công tác quy hoạch: Đề nghị các sở Xây dựng, Công thương, Nông nghiệp và Môi trường báo cáo kết quả tham mưu'),
    P('2.2. Cải cách hành chính, cải thiện môi trường đầu tư'),
    P('- Kết quả thực hiện quy chế phối hợp thẩm định dự án.'),
    P('- Giải quyết tồn đọng đất đai; cải cách thủ tục hành chính.'),
    P('- Các chỉ số PCI, PAR INDEX (kết quả, thứ hạng).'),
    P('2.3. Bồi thường, hỗ trợ, tái định cư, giải phóng mặt bằng: Đề nghị Sở Nông nghiệp và Môi trường, UBND các xã báo cáo số dự án, diện tích đã bàn giao'),
    P('(Đề nghị các sở, ngành, đơn vị báo cáo kết quả theo phụ lục 02)'),
    P('III. ĐÁNH GIÁ CHUNG', { bold: true }),
    P('1. Kết quả đạt được'),
    P('2. Tồn tại, hạn chế'),
    P('IV. NHIỆM VỤ, GIẢI PHÁP NĂM 2027', { bold: true }),
    P('1. Mục tiêu, chỉ tiêu năm 2027'),
    P('V. ĐỀ XUẤT, KIẾN NGHỊ', { bold: true }),
    P('1. Với các bộ, ngành Trung ương'),
    P('Phục lục 01', { bold: true }),
    P('DANH MỤC VĂN BẢN LÃNH ĐẠO, CHỈ ĐẠO, TRIỂN KHAI THỰC HIỆN NGHỊ QUYẾT SỐ 09-NQ/TU', { bold: true }),
    { type: 'table', rows: [['TT', 'Số, ký hiệu văn bản', 'Ngày ban hành', 'Cơ quan ban hành', 'Trích yếu nội dung', 'Ghi chú'], ['(1)', '(2)', '(3)', '(4)', '(5)', '(6)'], ['1', '', '', '', '', '']] }
  ];
}
module.exports = { blocksDeCuong, P };
