'use strict';
/** Không cho cửa sổ giao diện điều hướng ra ngoài trang của ứng dụng (vd thả nhầm tệp .html vào cửa sổ). */
function chanDieuHuong(wc, urlGiaoDien) {
  wc.on('will-navigate', (e, url) => { if (url !== urlGiaoDien) e.preventDefault(); });
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
}
module.exports = { chanDieuHuong };
