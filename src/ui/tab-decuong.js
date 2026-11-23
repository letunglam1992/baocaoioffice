'use strict';
/* Tab «Đề cương»: danh sách mục (bật/tắt), trích đoạn của mục, từ khóa thêm, tinh chỉnh AI, xuất báo cáo. */
/* global $, $$, bc, goi, ban, toast, esc, RENDER, S, Cay */
let mucChon = null;
let daXacNhanAi = false;
const timMucUi = (ds, id) => { for (const m of ds || []) { if (m.id === id) return m; const c = timMucUi(m.con, id); if (c) return c; } return null; };

function veDsMuc(b) {
  const ds = Cay.phangCay(b.dc.muc, b.ketQua).concat(Cay.phangCay(b.dc.phuLuc, b.ketQua));
  $('#demMuc').textContent = ds.filter(x => x.bat).length;
  $('#dsMuc').innerHTML = ds.map(x => `<div class="mitem cap${x.cap}${x.bat ? '' : ' tat'}${x.id === mucChon ? ' sel' : ''}" role="option" tabindex="0" aria-selected="${x.id === mucChon}" data-id="${x.id}">
    <input type="checkbox" ${x.bat ? 'checked' : ''} data-bat="${x.id}" aria-label="Đưa mục ${esc(x.nhan)} vào báo cáo">
    <span class="mten" title="${esc(x.tieuDe)}">${esc(x.nhan)} ${esc(x.tieuDe)}</span>
    ${x.dang === 'danhMucVB' ? '<span class="tag">Danh mục</span>' : x.dang === 'bangSoLieu' ? '<span class="tag">Bảng</span>' : ''}
    ${x.coKetQua ? `<span class="badge${x.soTrich ? '' : ' zero'}">${x.soTrich}</span>` : ''}</div>`).join('');
}

function veChiTiet(b) {
  const box = $('#chiTietMuc');
  const m = mucChon && (timMucUi(b.dc.muc, mucChon) || timMucUi(b.dc.phuLuc, mucChon));
  if (!m) { box.innerHTML = '<div class="empty">Chọn một mục bên trái để xem trích đoạn.</div>'; return; }
  const kq = b.ketQua[m.id];
  const yc = [...m.moTa, ...m.chiDan];
  const ai = b.vanBanAi && b.vanBanAi[m.id];
  let than;
  if (m.dang === 'danhMucVB') {
    than = `<h3>Danh mục văn bản (${b.danhMuc.length})</h3>` + (b.danhMuc.length ? `<table class="grid"><thead><tr><th>Số ký hiệu</th><th>Ngày</th><th>Cơ quan</th><th>Trích yếu</th></tr></thead><tbody>${b.danhMuc.map(d => `<tr><td>${esc(d.soKyHieu)}</td><td>${esc(d.ngay)}</td><td>${esc(d.coQuan)}</td><td>${esc(d.trichYeu)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Chưa có văn bản nào trong kho viện dẫn văn bản gốc của đề cương.</p>');
  } else if (!kq) {
    than = `<p class="muted">${m.con.length ? 'Đề mục — xem các mục con.' : 'Chưa phân tích. Bấm «Phân tích lại».'}</p>`;
  } else {
    than = `<h3>Trích đoạn (${kq.trichDoan.filter(t => t.chon).length}/${kq.trichDoan.length} đang chọn)</h3>` +
      (kq.trichDoan.length ? kq.trichDoan.map(t => `<div class="trich"><input type="checkbox" ${t.chon ? 'checked' : ''} data-trich="${t.n}" aria-label="Đưa trích đoạn ${t.n} vào báo cáo">
        <div class="txt">[${t.n}] ${esc(t.text)} ${t.coSoLieu ? '<span class="so">số liệu</span>' : ''}
        <div class="nguon">${esc(t.soKyHieu)} · ${esc(t.ngay)} · ${esc(t.coQuan)} · trang ${t.trang} · <button type="button" data-mo="${esc(t.vbId)}">Mở văn bản gốc</button></div></div></div>`).join('')
        : '<p class="muted">Chưa tìm thấy văn bản liên quan. Thêm từ khóa hoặc lấy văn bản theo số ký hiệu ở tab «Kho văn bản».</p>');
  }
  box.innerHTML = `<h2>${esc(m.tieuDe)}</h2>
    ${yc.length ? `<div class="yeucau"><b>Yêu cầu của đề cương</b><ul>${yc.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <label for="tuKhoaThem">Từ khóa thêm cho mục này (cách nhau bằng dấu phẩy)</label>
    <div class="row tight"><input id="tuKhoaThem" class="grow" value="${esc((m.tuKhoaThem || []).join(', '))}"><button type="button" class="btn small" id="btnLuuTk">Lưu và phân tích lại</button></div>
    ${S.caiDat.ai.bat && kq ? `<div class="row"><button type="button" class="btn ghost" id="btnAi">Tinh chỉnh AI mục này</button>${ai ? '<button type="button" class="btn small" id="btnBoAi">Bỏ văn AI, dùng trích đoạn</button>' : ''}</div>` : ''}
    ${ai ? `<div class="ai">${esc(ai).replace(/\[\[\?([^\]]*)\]\]/g, '<mark title="Số không có trong trích đoạn — cần kiểm tra">$1</mark>')}</div>` : ''}
    ${than}`;
  const id = m.id;
  $('#btnLuuTk').onclick = e => ban(e.currentTarget, 'Đang lưu…', async () => {
    const tk = $('#tuKhoaThem').value.split(',').map(x => x.trim()).filter(Boolean);
    if (await goi(bc.baoCao.capNhatMuc, id, { tuKhoaThem: tk })) await goi(bc.baoCao.phanTich);
  });
  const btnAi = $('#btnAi');
  if (btnAi) btnAi.onclick = e => ban(e.currentTarget, 'Đang gửi…', async () => {
    if (!daXacNhanAi) {
      const n = kq.trichDoan.filter(t => t.chon).length;
      if (!window.confirm(`Gửi ${n} trích đoạn đang chọn của mục này tới Cloudflare Workers AI để viết thành văn?\nVăn bản có độ mật và nguồn trong danh sách «không gửi» sẽ được bỏ ra.`)) return;
      daXacNhanAi = true;
    }
    const r = await goi(bc.baoCao.tinhChinh, id);
    if (r) toast(r.soLa.length ? `Đã tinh chỉnh; ${r.soLa.length} số liệu cần kiểm tra (tô vàng).` : 'Đã tinh chỉnh.');
  });
  const btnBoAi = $('#btnBoAi');
  if (btnBoAi) btnBoAi.onclick = () => goi(bc.baoCao.boVanAi, id);
}

function ganTabDeCuong() {
  $('#dsMuc').addEventListener('click', async e => {
    const cb = e.target.closest('[data-bat]');
    if (cb) { await goi(bc.baoCao.capNhatMuc, cb.dataset.bat, { bat: cb.checked }); return; }
    const it = e.target.closest('.mitem');
    if (it) { mucChon = it.dataset.id; veDsMuc(S.baoCao); veChiTiet(S.baoCao); }
  });
  $('#dsMuc').addEventListener('keydown', e => {
    const it = e.target.closest('.mitem'); if (!it) return;
    if (e.key === 'Enter') { it.click(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const nb = e.key === 'ArrowDown' ? it.nextElementSibling : it.previousElementSibling; if (nb) nb.focus(); }
  });
  $('#chiTietMuc').addEventListener('change', e => {
    const cb = e.target.closest('[data-trich]');
    if (cb) goi(bc.baoCao.chonTrich, mucChon, +cb.dataset.trich, cb.checked);
  });
  $('#chiTietMuc').addEventListener('click', e => {
    const b = e.target.closest('[data-mo]');
    if (b) ban(b, 'Đang mở…', () => goi(bc.kho.moGoc, b.dataset.mo));
  });
  $('#btnXuat').onclick = e => ban(e.currentTarget, 'Đang xuất…', async () => {
    const r = await goi(bc.baoCao.xuat, {});
    if (r) { $('#ttXuat').textContent = `Đã lưu: ${r.baoCao.split(/[\\/]/).pop()} và tệp dữ liệu thô`; toast('Đã xuất báo cáo Word và tệp dữ liệu thô.'); }
  });
  $('#btnBieuMau').onclick = async () => {
    const p = await goi(bc.baoCao.chonTep, 'xlsx');
    if (p && await goi(bc.baoCao.napBieuMau, p, mucChon)) toast(mucChon ? 'Đã gắn biểu mẫu vào mục đang chọn.' : 'Đã thêm biểu mẫu vào phụ lục.');
  };
}

RENDER.push(s => {
  const b = s.baoCao;
  $('#dcTrong').hidden = !!b; $('#dcCo').hidden = !b; $('#dcHanhDong').hidden = !b;
  if (!b) { $('#demMuc').textContent = 0; return; }
  veDsMuc(b);
  if (!document.activeElement || !$('#chiTietMuc').contains(document.activeElement) || document.activeElement.type === 'checkbox') veChiTiet(b);
});
