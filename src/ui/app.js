'use strict';
/* Khởi động giao diện. */
/* global $, $$, bc, goi, toast, goTab, capNhat, fmtTime, ganTabBaoCao, ganTabDeCuong, ganTabKho, ganTabCaiDat, RENDER */
RENDER.push(s => {
  $('#btnDung').hidden = !s.dangChay; $('#btnQuet').disabled = s.dangChay;
  if (!s.dangChay) $('#tienDo').hidden = true;
  const n = s.taiKhoan.length;
  $('#trangThaiNen').textContent = !n ? 'Chưa có tài khoản iOffice — vào «Tài khoản & Cài đặt» để thêm.'
    : `${n} tài khoản · ${s.kho.tong} văn bản trong kho · lượt quét gần nhất ${fmtTime(s.lastRunAt)}${s.dangChay ? ' · đang quét…' : ''}`;
});

$$('.tab').forEach(t => { t.onclick = () => goTab(t.dataset.tab); });
// thả tệp ngoài vùng kéo-thả: không để trình duyệt mở tệp đó
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());
$('#btnQuet').onclick = async () => { if (await goi(bc.quet.ngay)) toast('Đã bắt đầu quét. Theo dõi tiến độ ở dòng trên cùng.'); };
$('#btnDung').onclick = () => goi(bc.quet.dung);
ganTabBaoCao(); ganTabDeCuong(); ganTabKho(); ganTabCaiDat();
bc.onTrangThai(capNhat);
bc.onTienDo(p => { const el = $('#tienDo'); el.hidden = false; el.textContent = `Đang quét ${p.taiKhoan || ''}: ${p.da + 1}/${p.tong}${p.so ? ' — ' + p.so : ''}`; });
bc.trangThai().then(x => { if (x && x.ok) capNhat(x.r); });
