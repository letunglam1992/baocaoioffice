'use strict';
/** Hàm thuần cho giao diện: làm phẳng cây đề cương để hiển thị danh sách mục. Dùng cả trong Node (kiểm thử) và trình duyệt. */
(function (root) {
  function phangCay(muc, ketQua) {
    const out = [];
    const di = ds => ds.forEach(m => {
      const so = String(m.so || '');
      const nhan = so === '-' ? '–' : /^[a-zđ]$/.test(so) ? so + ')' : so + '.';
      const kq = ketQua && ketQua[m.id];
      out.push({ id: m.id, cap: m.cap, nhan, tieuDe: m.tieuDe, bat: m.bat, dang: m.dang, coKetQua: !!kq, soTrich: kq ? kq.trichDoan.filter(t => t.chon).length : 0 });
      di(m.con || []);
    });
    di(muc || []);
    return out;
  }
  const api = { phangCay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cay = api;
})(typeof window !== 'undefined' ? window : globalThis);
