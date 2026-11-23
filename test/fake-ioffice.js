'use strict';
/** Adapter iOffice GIẢ (dữ liệu bịa) cho kiểm thử luồng thu thập. */
const { taoDocx, taoPdfChu } = require('./mau/taodoc');

async function taoFakeIo({ hetPhienSau = Infinity, chuaDangNhap = false } = {}) {
  const pdfChu = n => taoPdfChu(Array.from({ length: 6 }, (_, i) => `Van ban so ${n}: da ban giao 12,5 ha dong ${i}`));
  const files = {
    'f/1__131-KH-UBND.pdf': pdfChu(131),
    'f/2__55-BC-UBND.pdf': pdfChu(55),
    'f/2__phuluc.docx': await taoDocx({ blocks: [{ type: 'p', text: 'Phụ lục số liệu giải phóng mặt bằng 7 dự án' }] }),
    'f/3__hoso.zip': Buffer.from('PK\x03\x04rac'),
    'f/4__hong.docx': Buffer.from('khong phai docx'),
    'f/5__scan-77.pdf': taoPdfChu(['x']),
    'f/6__1410-TTr-SNNMT.pdf': pdfChu(1410),
    'f/7__88-CV-SNNMT.pdf': pdfChu(88),
    'f/9__mat.pdf': pdfChu(9)
  };
  const den = [
    { ma_van_ban_den_kc: 1, ma_xu_ly_den: 11, ngay_nhan: '15/05/2026' },
    { ma_van_ban_den_kc: 1, ma_xu_ly_den: 12, ngay_nhan: '16/05/2026' }, // trùng văn bản, khác luồng
    { ma_van_ban_den_kc: 2, ma_xu_ly_den: 21, ngay_nhan: '11/03/2026' },
    { ma_van_ban_den_kc: 5, ma_xu_ly_den: 51, ngay_nhan: '01/06/2026' },
    { ma_van_ban_den_kc: 9, ma_xu_ly_den: 91, ngay_nhan: '02/06/2026' }
  ];
  const ctDen = {
    1: { so_ky_hieu: '131/KH-UBND', trich_yeu: 'Kế hoạch thực hiện Nghị quyết 09-NQ/TU', ten_loai_van_ban: 'Kế hoạch', ten_co_quan_ban_hanh: 'UBND tỉnh', ngay_ban_hanh: '14/05/2026', ten_cap_do_mat: 'Bình thường', file_van_ban: 'f/1__131-KH-UBND.pdf' },
    2: { so_ky_hieu: '55/BC-UBND', trich_yeu: 'Báo cáo tình hình', ten_loai_van_ban: 'Báo cáo', ten_co_quan_ban_hanh: 'UBND tỉnh', ngay_ban_hanh: '10/03/2026', ten_cap_do_mat: '', file_van_ban: 'f/2__55-BC-UBND.pdf:f/2__phuluc.docx:f/3__hoso.zip:f/4__hong.docx' },
    5: { so_ky_hieu: '77/CV-UBND', trich_yeu: 'Bản scan', ten_loai_van_ban: 'Công văn', ten_co_quan_ban_hanh: 'UBND xã', ngay_ban_hanh: '30/05/2026', ten_cap_do_mat: 'Bình thường', file_van_ban: 'f/5__scan-77.pdf' },
    9: { so_ky_hieu: '9/CV-CA', trich_yeu: 'Văn bản mật', ten_loai_van_ban: 'Công văn', ten_co_quan_ban_hanh: 'Công an tỉnh', ngay_ban_hanh: '01/06/2026', ten_cap_do_mat: 'Mật', file_van_ban: 'f/9__mat.pdf' }
  };
  const di = [{ ma_van_ban_di_kc: 6, ngay_di: '20/11/2026' }, { ma_van_ban_di_kc: 7, ngay_di: '05/11/2026' }];
  const ctDi = {
    6: { so_ky_hieu: '1410/TTr-SNNMT', trich_yeu: 'Tờ trình xử lý dự án tồn đọng', ten_loai_van_ban: 'Tờ trình', ngay_ban_hanh: '20/11/2026', file_van_ban: 'f/6__1410-TTr-SNNMT.pdf' },
    7: { so_ky_hieu: '88/CV-SNNMT', trich_yeu: 'Công văn báo cáo kết quả', ten_loai_van_ban: 'Công văn', ngay_ban_hanh: '05/11/2026', file_van_ban: 'f/7__88-CV-SNNMT.pdf' }
  };
  const io = {
    goi: [], taiVe: [],
    dem() { this.goi.push(1); if (this.goi.length > hetPhienSau) throw new Error('NOT_READY'); },
    async whoAmI() { return chuaDangNhap ? null : { ma_ctcb: 1, ho_ten: 'Người dùng thử', ma_dvqt: 1 }; },
    async listVanBanDen() { this.dem(); return den; },
    async listVanBanDiDaPhatHanh() { this.dem(); return di; },
    async chiTiet(ma) { this.dem(); return ctDen[ma]; },
    async chiTietVanBanDi(ma) { this.dem(); return ctDi[ma]; },
    async downloadFile(p) { this.dem(); this.taiVe.push(p); if (!files[p]) throw new Error('404'); return files[p]; }
  };
  return io;
}
module.exports = { taoFakeIo };
