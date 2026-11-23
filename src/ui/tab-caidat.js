'use strict';
/* Tab «Tài khoản & Cài đặt» và «Nhật ký & Giới thiệu». */
/* global $, bc, goi, ban, toast, esc, fmtTime, RENDER, S */
const dsPhay = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const NGAY = /^\d{2}\/\d{2}\/\d{4}$/;

function ganTabCaiDat() {
  $('#btnThemTk').onclick = async () => {
    const t = $('#tenTk').value.trim();
    if (!t) { toast('Nhập tên gợi nhớ cho tài khoản.', { tone: 'err' }); $('#tenTk').focus(); return; }
    const id = await goi(bc.taiKhoan.them, t);
    if (id) { $('#tenTk').value = ''; toast('Đã thêm. Bấm «Đăng nhập» để đăng nhập iOffice cho tài khoản này.'); }
  };
  $('#dsTaiKhoan').addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'dn') ban(b, 'Đang chờ đăng nhập…', async () => { if (await goi(bc.taiKhoan.dangNhap, id)) toast('Đăng nhập thành công.'); });
    if (b.dataset.act === 'xoa' && window.confirm(`Xóa tài khoản «${b.dataset.ten}» khỏi phần mềm? Văn bản đã có trong kho vẫn giữ.`)) goi(bc.taiKhoan.xoa, id);
  });
  $('#btnChonKho').onclick = async () => { const p = await goi(bc.caiDat.chonThuMuc); if (p) $('#cdKho').value = p; };
  $('#btnLuuCd').onclick = e => ban(e.currentTarget, 'Đang lưu…', async () => {
    const lich = dsPhay($('#cdLich').value);
    if (!lich.length || !lich.every(x => HM.test(x))) { toast('Giờ quét phải có dạng 12:00, nhiều giờ cách nhau bằng dấu phẩy.', { tone: 'err' }); $('#cdLich').focus(); return; }
    if (!NGAY.test($('#cdTuNgayDau').value.trim())) { toast('Ngày bắt đầu phải có dạng dd/mm/yyyy.', { tone: 'err' }); $('#cdTuNgayDau').focus(); return; }
    const patch = {
      lich, tuNgayDau: $('#cdTuNgayDau').value.trim(), moiMuc: +$('#cdMoiMuc').value || 15, toiDaBaoCao: +$('#cdToiDa').value || 150, maxCalls: +$('#cdMaxCalls').value || 300,
      thuMucQuetVanBan: $('#cdQvb').value.trim(), ocrLucRanh: $('#cdOcr').checked, tuKhoiDong: $('#cdKhoiDong').checked,
      giuTep: { loai: dsPhay($('#cdGiuLoai').value), tranMB: +$('#cdGiuTran').value || 500 },
      ai: { bat: $('#cdAi').checked, diaChi: $('#cdAiDiaChi').value.trim(), khongGui: dsPhay($('#cdAiKhong').value) }
    };
    if ($('#cdKho').value && $('#cdKho').value !== S.khoDir) patch.khoDir = $('#cdKho').value;
    if (await goi(bc.caiDat.ghi, patch)) toast('Đã lưu cài đặt.');
  });
  $('#btnGhiBat').onclick = e => ban(e.currentTarget, 'Đang mở…', async () => { if (await goi(bc.ghiNhan.bat, $('#ghiTk').value)) toast('Đã bật ghi nhận. Hãy tra cứu văn bản trong cửa sổ iOffice rồi bấm «Lưu kết quả».'); });
  $('#btnGhiLay').onclick = e => ban(e.currentTarget, 'Đang lưu…', async () => { const r = await goi(bc.ghiNhan.lay, $('#ghiTk').value); if (r) toast(`Đã lưu ${r.so} bản ghi vào ${r.tep.split(/[\\/]/).pop()}.`); });
}

let daNapCaiDat = false;
RENDER.push(s => {
  $('#dsTaiKhoan').innerHTML = s.taiKhoan.length ? s.taiKhoan.map(t => `<tr><td>${esc(t.ten)}</td><td>${esc(t.hoTen || '—')}</td><td>${esc(t.lastOkAt || '—')}</td>
    <td>${t.loi ? `<span class="tag err">${esc(t.loi === 'CHUA_DANG_NHAP' ? 'Cần đăng nhập' : t.loi)}</span>` : t.lastOkAt ? '<span class="tag ok">Bình thường</span>' : '<span class="tag">Chưa quét</span>'}</td>
    <td><button type="button" class="btn small" data-act="dn" data-id="${esc(t.id)}">Đăng nhập</button> <button type="button" class="btn small danger" data-act="xoa" data-id="${esc(t.id)}" data-ten="${esc(t.ten)}">Xóa</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">Chưa có tài khoản. Thêm tài khoản đầu tiên bên dưới.</td></tr>';
  const sel = $('#ghiTk'), cu = sel.value;
  sel.innerHTML = s.taiKhoan.map(t => `<option value="${esc(t.id)}">${esc(t.ten)}</option>`).join('');
  if (cu) sel.value = cu;
  if (!daNapCaiDat) { // chỉ điền form một lần, tránh ghi đè khi người dùng đang sửa
    const c = s.caiDat;
    $('#cdLich').value = c.lich.join(', '); $('#cdTuNgayDau').value = c.tuNgayDau; $('#cdMoiMuc').value = c.moiMuc; $('#cdToiDa').value = c.toiDaBaoCao; $('#cdMaxCalls').value = c.maxCalls;
    $('#cdKho').value = s.khoDir; $('#cdQvb').value = c.thuMucQuetVanBan || ''; $('#cdOcr').checked = !!c.ocrLucRanh; $('#cdKhoiDong').checked = !!c.tuKhoiDong;
    $('#cdGiuLoai').value = (c.giuTep.loai || []).join(', '); $('#cdGiuTran').value = c.giuTep.tranMB;
    $('#cdAi').checked = !!c.ai.bat; $('#cdAiDiaChi').value = c.ai.diaChi; $('#cdAiKhong').value = (c.ai.khongGui || []).join(', ');
    daNapCaiDat = true;
  }
  $('#phienBan').textContent = s.phienBan;
  $('#dsNhatKy').innerHTML = s.nhatKy.slice().reverse().map(l => `<tr class="${esc(l.level)}"><td>${esc(fmtTime(l.t))}</td><td>${esc(l.level)}</td><td>${esc(l.msg)}</td></tr>`).join('');
});
