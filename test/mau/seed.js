'use strict';
/**
 * Dữ liệu mẫu GIẢ cho xem giao diện: node test/mau/seed.js <thư mục userData>
 * Tạo kho (qua luồng thu thập với adapter giả), một tài khoản, một đề cương đã phân tích.
 */
const fs = require('fs');
const path = require('path');
const { Store } = require('../../src/store');
const { Kho } = require('../../src/kho');
const { thuThap } = require('../../src/thuthap');
const { PhienBaoCao } = require('../../src/app/baocao');
const { taoFakeIo } = require('../fake-ioffice');
const { taoDocx } = require('./taodoc');
const { blocksDeCuong } = require('./decuong-gia');

(async () => {
  const dir = path.resolve(process.argv[2] || '.demo');
  fs.mkdirSync(dir, { recursive: true });
  const store = new Store(path.join(dir, 'data'));
  const khoDir = path.join(dir, 'kho');
  store.data.caiDat.khoDir = khoDir;
  store.data.taiKhoan = { 'chuyen-vien': { ten: 'Chuyên viên (mẫu)', hoTen: 'Người dùng thử', lastOkAt: '23/11/2026' }, 'van-thu': { ten: 'Văn thư (mẫu)', loi: 'CHUA_DANG_NHAP' } };
  const kho = new Kho(khoDir);
  await thuThap({ io: await taoFakeIo(), kho, taiKhoan: 'chuyen-vien', tuNgay: '01/01/2026', denNgay: '23/11/2026', tamDir: path.join(dir, 'tam'), log: () => {} });
  kho.upsert({ id: 'di:100', chieu: 'di', soKyHieu: '200/BC-SNNMT', ngayBanHanh: '15/10/2026', coQuan: 'Sở Nông nghiệp và Môi trường', loai: 'Báo cáo', trichYeu: 'Báo cáo tiến độ bồi thường, giải phóng mặt bằng các dự án (mẫu)', taiKhoan: ['chuyen-vien'], doMat: false, tep: [],
    trang: [{ tep: 0, so: 1, text: 'Thực hiện Nghị quyết số 09-NQ/TU.\n\nĐến nay đã hoàn thành bồi thường, giải phóng mặt bằng 45,2 ha cho 6 dự án; còn 2 dự án vướng mắc về giá đất bồi thường.\n\nSở đã tổ chức 4 cuộc làm việc với UBND các xã để tháo gỡ khó khăn trong giải phóng mặt bằng.' }], capNhat: new Date().toISOString() });
  kho.save();
  store.data.lastRunAt = Date.now() - 3600 * 1000;
  store.log('info', 'Dữ liệu mẫu cho xem giao diện.');
  const p = new PhienBaoCao({ store, kho });
  await p.napDeCuong(await taoDocx({ blocks: blocksDeCuong() }), 'de-cuong-mau.docx');
  await p.phanTich();
  store.save();
  console.log('Đã tạo dữ liệu mẫu tại', dir);
})();
