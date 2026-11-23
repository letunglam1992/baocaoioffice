'use strict';
/* Tab «Báo cáo mới»: nạp đề cương / chủ đề, thông tin chung của báo cáo, phân tích. */
/* global $, bc, goi, ban, toast, goTab, RENDER, S */
async function napDeCuongTu(p) {
  if (!p) return;
  if (!/\.docx?$/i.test(p)) { toast('Đề cương phải là tệp Word (.docx hoặc .doc).', { tone: 'err' }); return; }
  if (await goi(bc.baoCao.napDeCuong, p)) toast('Đã nạp đề cương. Kiểm tra thông tin rồi bấm «Phân tích».');
}

function ganTabBaoCao() {
  const drop = $('#dropDeCuong');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) napDeCuongTu(bc.duongDanTep(f)); });
  $('#btnChonDeCuong').onclick = async () => napDeCuongTu(await goi(bc.baoCao.chonTep, 'word'));
  $('#btnNapChuDe').onclick = async () => {
    const t = $('#chuDe').value.trim();
    if (!t) { toast('Nhập ít nhất một chủ đề.', { tone: 'err' }); $('#chuDe').focus(); return; }
    if (await goi(bc.baoCao.napChuDe, t, $('#soGhim').value)) toast('Đã tạo đề cương từ chủ đề. Bấm «Phân tích».');
  };
  const phanTich = btn => ban(btn, 'Đang tải văn bản liên quan…', async () => {
    const patch = { tuNgay: $('#tuNgay').value.trim(), denNgay: $('#denNgay').value.trim(), kinhGui: $('#kinhGui').value.trim(), trichYeu: $('#trichYeu').value.trim(), moDau: $('#moDau').value.trim() };
    const kq = await goi(bc.baoCao.phanTich, patch);
    if (kq) {
      const t = kq.lanTai;
      toast(t && t.canTai ? `Đã tải nội dung ${t.soVanBan || 0}/${t.canTai} văn bản liên quan (${t.daTai || 0} tệp) và phân tích xong.` : 'Đã phân tích xong (không có văn bản mới cần tải).');
      goTab('decuong');
    }
  });
  $('#btnPhanTich').onclick = e => phanTich(e.currentTarget);
  $('#btnPhanTich2').onclick = e => phanTich(e.currentTarget);
}

RENDER.push(s => {
  const b = s.baoCao;
  $('#phienHienTai').hidden = !b;
  if (!b) return;
  // không ghi đè ô người dùng đang gõ
  for (const k of ['tuNgay', 'denNgay', 'kinhGui', 'trichYeu', 'moDau']) { const el = $('#' + k); if (document.activeElement !== el) el.value = b[k] || ''; }
  const n = Object.keys(b.ketQua || {}).length;
  $('#ttPhanTich').textContent = `Nguồn: ${b.nguon.split(/[\\/]/).pop()}` + (n ? ` · đã phân tích ${n} mục` : ' · chưa phân tích');
});
