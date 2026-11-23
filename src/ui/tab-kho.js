'use strict';
/* Tab «Kho văn bản»: thống kê, tìm toàn văn, lấy ngay theo số ký hiệu, mở văn bản gốc. */
/* global $, bc, goi, ban, toast, esc, fmtTime, RENDER */
function veKetQuaTim(ds) {
  $('#kqTim').innerHTML = ds.length ? ds.map(v => `<tr><td>${esc(v.soKyHieu)} <span class="tag">${v.chieu === 'di' ? 'đi' : 'đến'}</span></td><td>${esc(v.ngay)}</td><td>${esc(v.coQuan)}</td><td>${esc(v.trichYeu)}</td><td><button type="button" class="btn small" data-mo="${esc(v.id)}">Mở</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted">Không tìm thấy văn bản phù hợp. Thử từ khóa khác hoặc lấy theo số ký hiệu.</td></tr>';
}

function ganTabKho() {
  const tim = () => ban($('#btnTim'), 'Đang tìm…', async () => {
    const q = $('#oTim').value.trim();
    if (!q) { $('#oTim').focus(); return; }
    const ds = await goi(bc.kho.tim, q, { chieu: $('#locChieu').value || undefined, limit: 100 });
    if (ds) veKetQuaTim(ds);
  });
  $('#btnTim').onclick = tim;
  $('#oTim').addEventListener('keydown', e => { if (e.key === 'Enter') tim(); });
  $('#btnLaySo').onclick = e => ban(e.currentTarget, 'Đang lấy…', async () => {
    const so = $('#oSo').value.trim();
    if (!so) { $('#oSo').focus(); return; }
    const ds = await goi(bc.kho.layTheoSo, so);
    if (!ds) return;
    if (ds.length) { toast(`Đã có văn bản ${ds[0].soKyHieu} trong kho.`); veKetQuaTim(ds.map(v => ({ ...v, coQuan: '', chieu: v.id.startsWith('di:') ? 'di' : 'den' }))); }
    else toast(`Không thấy văn bản ${so} trong các tài khoản đã đăng nhập.`, { tone: 'err' });
  });
  $('#kqTim').addEventListener('click', e => { const b = e.target.closest('[data-mo]'); if (b) ban(b, '…', () => goi(bc.kho.moGoc, b.dataset.mo)); });
}

RENDER.push(s => {
  const k = s.kho;
  $('#demKho').textContent = k.tong;
  $('#theKho').innerHTML = [
    ['Văn bản trong danh sách', k.tong], ['Đã tải nội dung', k.coNoiDung], ['Văn bản mật (chỉ trích yếu)', k.mat], ['Chờ OCR (bản scan)', k.choOcr]
  ].map(([t, v]) => `<div class="card"><div class="muted">${t}</div><div class="big">${esc(v)}</div></div>`).join('');
});
