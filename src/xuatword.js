'use strict';
/**
 * Xuất báo cáo Word bằng cách sửa XML trên KHUNG mẫu của Sở (không dựng văn bản từ đầu):
 * giữ khối đầu, tên loại, «Kính gửi», câu kết, khối nơi nhận/ký, lề và phông; thay trích yếu, số/ngày (để trống),
 * đoạn mở; thân sinh lại theo cây đề cương với kiểu đoạn lấy từ chính khung.
 */
const JSZip = require('jszip');
const { topElements, runText } = require('./docread');
const { chuanHoa } = require('./vntext');

const escXml = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LA_MA = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
const CHU = 'abcdefghiklmnopqrstuvxy'.split('');

const pPrOf = p => (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
function rPrOf(p) {
  for (const r of p.match(/<w:r\b[\s\S]*?<\/w:r>/g) || []) {
    if (/<w:t[\s>]/.test(r) && runText(r).trim()) return (r.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
  }
  return '';
}
const boRPr = (rPr, tags) => tags.reduce((s, t) => s.replace(new RegExp(`<w:${t}(?:\\s[^>]*)?/>`, 'g'), ''), rPr);
function themRPr(rPr, xml) { return rPr ? rPr.replace('</w:rPr>', xml + '</w:rPr>') : `<w:rPr>${xml}</w:rPr>`; }

function canGiua(pPr) {
  if (!pPr) return '<w:pPr><w:jc w:val="center"/></w:pPr>';
  let x = pPr.replace(/<w:jc [^>]*\/>/g, '').replace(/<w:ind [^>]*\/>/g, '');
  return /<w:rPr>/.test(x) ? x.replace('<w:rPr>', '<w:jc w:val="center"/><w:rPr>') : x.replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
}

/** Một đoạn: pPr + các run; phần bọc [[?…]] → tô vàng. */
const chuanPhong = rPr => rPr.replace(/(w:(?:ascii|hAnsi|cs|eastAsia)=")([^"]*;)+([^";]+)"/g, '$1$3"');

function para(kieu, text, { highlight = false, bold, italic, center = false } = {}) {
  let rPr = chuanPhong(kieu.rPr || '');
  if (bold === false) rPr = boRPr(rPr, ['b', 'bCs']);
  if (bold === true && !/<w:b\/>/.test(rPr)) rPr = themRPr(rPr, '<w:b/><w:bCs/>');
  if (italic === false) rPr = boRPr(rPr, ['i', 'iCs']);
  if (italic === true && !/<w:i\/>/.test(rPr)) rPr = themRPr(rPr, '<w:i/><w:iCs/>');
  let pPr = kieu.pPr || '';
  if (center) pPr = canGiua(pPr);
  const hl = themRPr(rPr, '<w:highlight w:val="yellow"/>');
  const runs = [];
  String(text).split(/(\[\[\?[^\]]*\]\])/).forEach(part => {
    if (!part) return;
    const m = part.match(/^\[\[\?([^\]]*)\]\]$/);
    const r = (m || highlight) ? hl : rPr;
    runs.push(`<w:r>${r}<w:t xml:space="preserve">${escXml(m ? m[1] : part)}</w:t></w:r>`);
  });
  return `<w:p>${pPr}${runs.join('')}</w:p>`;
}
/** Thay chữ của một đoạn: giữ pPr, kiểu chữ của run đầu có chữ, và các run hình vẽ (đường kẻ dưới tiêu đề…). */
function datChu(pXml, text, o) {
  let hinh = (pXml.match(/<w:r\b[\s\S]*?<\/w:r>/g) || []).filter(r => /<w:drawing\b|<w:pict\b|<mc:AlternateContent\b/.test(r)).join('');
  if (o && o.doiNeo && hinh) { // đường kẻ neo theo đoạn: đặt ngay dưới dòng chữ cuối (~75 ký tự/dòng, ~0,6 cm/dòng)
    const soDong = Math.max(1, Math.ceil(String(text).length / 75));
    hinh = hinh.replace(/(<wp:positionV relativeFrom="paragraph">\s*<wp:posOffset>)\d+/g, `$1${soDong * 222250 + 30000}`);
  }
  const moi = para({ pPr: pPrOf(pXml), rPr: rPrOf(pXml) }, text, o);
  return hinh ? moi.replace(/^(<w:p>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)/, '$1' + hinh) : moi;
}

function tachBody(xml) {
  const m = xml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!m) throw new Error('Khung không có w:body');
  const body = m[1];
  const sect = (body.match(/<w:sectPr\b[\s\S]*<\/w:sectPr>\s*$/) || [''])[0];
  const els = topElements(body.slice(0, body.length - sect.length), ['w:p', 'w:tbl']);
  return { truoc: xml.slice(0, m.index) + '<w:body>', sau: '</w:body>' + xml.slice(m.index + m[0].length), els, sect };
}
const txt = e => e.name === 'w:p' ? chuanHoa(runText(e.xml)) : '';

async function docKhung(buf) {
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file('word/document.xml').async('string');
  const { els } = tachBody(docXml);
  const iKG = els.findIndex(e => /^Kính gửi/.test(txt(e)));
  const iKT = els.findIndex(e => /trân trọng báo cáo/i.test(txt(e)));
  let iNN = -1; els.forEach((e, i) => { if (e.name === 'w:tbl' && i > iKT) iNN = i; });
  if (iKG < 0 || iKT < 0) throw new Error('Khung thiếu đoạn «Kính gửi» hoặc «… trân trọng báo cáo./.»');
  const than = els.slice(iKG + 2, iKT).filter(e => e.name === 'w:p' && txt(e));
  const lay = re => { const e = than.find(x => re.test(txt(x))); return e ? { pPr: pPrOf(e.xml), rPr: rPrOf(e.xml) } : null; };
  const doan = lay(/^(?![IVX]+\.|\d+\.|[a-zđ]\)|[-–])/) || { pPr: pPrOf(els[iKG + 1].xml), rPr: rPrOf(els[iKG + 1].xml) };
  const kieu = {
    doan,
    muc1: lay(/^[IVX]+\./) || { ...doan, rPr: themRPr(doan.rPr, '<w:b/>') },
    muc2: lay(/^\d+\./) || { ...doan, rPr: themRPr(doan.rPr, '<w:b/>') },
    muc3: lay(/^[a-zđ]\)/) || { ...doan, rPr: themRPr(doan.rPr, '<w:i/>') },
    gach: lay(/^[-–]/) || doan
  };
  return { zip, docXml, idx: { kinhGui: iKG, moDau: iKG + 1, ketThuc: iKT, noiNhan: iNN }, kieu };
}

function bangXml(rows, kieu, { dauDong = 1 } = {}) {
  const n = Math.max(...rows.map(r => r.length));
  const b = '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>';
  const cellK = { pPr: '<w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="center"/></w:pPr>', rPr: boRPr(kieu.doan.rPr || '', ['b', 'i']).replace(/<w:sz w:val="\d+"\/>/, '<w:sz w:val="24"/>') || '<w:rPr><w:sz w:val="24"/></w:rPr>' };
  const tr = (r, dau) => '<w:tr>' + Array.from({ length: n }, (_, i) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${String(r[i] == null ? '' : r[i]).split('\n').map(t => para(cellK, t, { bold: dau || undefined })).join('')}</w:tc>`).join('') + '</w:tr>';
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${b}</w:tblBorders><w:tblLayout w:type="autofit"/></w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(n)}</w:tblGrid>` +
    rows.map((r, i) => tr(r, i < dauDong)).join('') + '</w:tbl>';
}

const nguon = t => `(${t.soKyHieu}${t.ngay ? ' ngày ' + t.ngay : ''}${t.trang ? ', tr. ' + t.trang : ''})`;

function thanBaoCao(kieu, { dc, ketQua, vanBanAi = {}, danhMuc }) {
  const out = [];
  const sinh = (ds, capCha) => {
    let stt = 0;
    for (const m of ds) {
      if (!m.bat) continue;
      stt++;
      let nhan, k;
      if (m.cap === 1) { nhan = LA_MA[stt - 1] + '. '; k = kieu.muc1; }
      else if (capCha === 1) { nhan = stt + '. '; k = kieu.muc2; }
      else if (capCha === 2) { nhan = (CHU[stt - 1] || stt) + ') '; k = kieu.muc3; }
      else { nhan = '- '; k = kieu.gach; }
      out.push(para(k, nhan + m.tieuDe));
      if (m.bang && m.dang !== 'danhMucVB') out.push(bangXml(m.bang, kieu, { dauDong: m.bang.length > 1 && /^\(1\)$/.test(String(m.bang[1][0] || '').trim()) ? 2 : 1 }));
      const kq = ketQua[m.id];
      const nhacPL = (m.chiDan || []).join(' ').match(/Ph[ụu]c? ?l[ụu]c\s*(\d+)/i);
      const coPhuLuc = nhacPL && dc.phuLuc.some(pl => +((pl.so.match(/\d+/) || [0])[0]) === +nhacPL[1]) ? nhacPL : null;
      if (vanBanAi[m.id]) {
        for (const d of String(vanBanAi[m.id]).split(/\n+/).map(s => s.trim()).filter(Boolean)) out.push(para(kieu.doan, d));
      } else if (kq) {
        const chon = kq.trichDoan.filter(t => t.chon && (!m.bang || t.coSoLieu));
        if (chon.length) for (const t of chon) out.push(para(kieu.gach, `- ${t.text} ${nguon(t)}`));
        else if (!coPhuLuc) out.push(para(kieu.doan, '[Chưa tìm thấy văn bản liên quan — cần bổ sung]', { highlight: true }));
      }
      if (coPhuLuc) out.push(para(kieu.doan, `(Có Phụ lục ${coPhuLuc[1].padStart(2, '0')} kèm theo)`, { italic: true }));
      sinh(m.con, m.cap === 1 ? 1 : capCha + 1);
    }
  };
  sinh(dc.muc, 0);
  return out;
}

function phuLucXml(kieu, { dc, danhMuc, nam }) {
  const out = [];
  dc.phuLuc.forEach((pl, i) => {
    out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    out.push(para(kieu.doan, pl.so || `Phụ lục ${String(i + 1).padStart(2, '0')}`, { bold: true, center: true }));
    if (pl.tieuDe) out.push(para(kieu.doan, pl.tieuDe, { bold: true, center: true }));
    out.push(para(kieu.doan, `(Kèm theo Báo cáo số        /BC-SNNMT ngày      tháng      năm ${nam} của Sở Nông nghiệp và Môi trường)`, { italic: true, bold: false, center: true }));
    let rows = (pl.bang || [['TT', 'Số, ký hiệu văn bản', 'Ngày ban hành', 'Cơ quan ban hành', 'Trích yếu nội dung', 'Ghi chú']]).map(r => r.slice());
    const coDongSo = rows.length > 1 && /^\(1\)$/.test(String(rows[1][0] || '').trim());
    const dau = rows.slice(0, coDongSo ? 2 : 1);
    if (pl.dang === 'danhMucVB') {
      const cot = dau[0].map(c => c.toLowerCase());
      const ci = re => cot.findIndex(c => re.test(c));
      const iSo = ci(/số, ký hiệu|số ký hiệu/), iNgay = ci(/ngày/), iCq = ci(/cơ quan/), iTy = ci(/trích yếu/), iTt = ci(/^tt$|stt/);
      rows = dau.concat((danhMuc || []).map((d, k) => {
        const r = Array(dau[0].length).fill('');
        if (iTt >= 0) r[iTt] = String(k + 1);
        if (iSo >= 0) r[iSo] = d.soKyHieu; if (iNgay >= 0) r[iNgay] = d.ngay; if (iCq >= 0) r[iCq] = d.coQuan; if (iTy >= 0) r[iTy] = d.trichYeu;
        return r;
      }));
      if (!(danhMuc || []).length) rows.push(Array(dau[0].length).fill(''));
    }
    out.push(bangXml(rows, kieu, { dauDong: dau.length }));
  });
  return out;
}

/**
 * @returns {Promise<Buffer>}
 */
async function xuatBaoCao(khung, { dc, ketQua = {}, danhMuc = [], kinhGui = 'Sở Tài chính', trichYeu, moDau, vanBanAi = {} }) {
  const { truoc, sau, els, sect } = tachBody(khung.docXml);
  const { kinhGui: iKG, moDau: iMD, ketThuc: iKT, noiNhan: iNN } = khung.idx;
  const nam = dc.nam || new Date().getFullYear();
  const dau = els.slice(0, iKG).map((e, i) => {
    if (e.name === 'w:tbl') {
      return e.xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, p => {
        const t = chuanHoa(runText(p));
        if (/^Số\s*:/.test(t)) return datChu(p, 'Số:        /BC-SNNMT');
        if (/ngày[\s\S]*tháng[\s\S]*năm/.test(t)) return datChu(p, `Sơn La, ngày      tháng      năm ${nam}`);
        return p;
      });
    }
    // đoạn ngay trước «Kính gửi» là trích yếu
    if (i === iKG - 1 && trichYeu) return datChu(e.xml, trichYeu, { doiNeo: true });
    return e.xml;
  });
  const parts = [
    ...dau,
    datChu(els[iKG].xml, 'Kính gửi: ' + kinhGui),
    datChu(els[iMD].xml, moDau || 'Thực hiện …, Sở Nông nghiệp và Môi trường báo cáo như sau:'),
    ...thanBaoCao(khung.kieu, { dc, ketQua, vanBanAi, danhMuc }),
    els[iKT].xml,
    ...els.slice(iKT + 1, iNN >= 0 ? iNN + 1 : iKT + 1).map(e => e.xml),
    ...phuLucXml(khung.kieu, { dc, danhMuc, nam })
  ];
  const zip = await JSZip.loadAsync(await khung.zip.generateAsync({ type: 'nodebuffer' }));
  zip.file('word/document.xml', truoc + parts.join('') + sect + sau);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Tệp dữ liệu thô dạng Markdown để người dùng tự đưa vào AI. */
function xuatDuLieuTho({ dc, ketQua = {}, danhMuc = [] }) {
  const L = [];
  L.push(`# ${dc.trichYeu || dc.tieuDe || 'Báo cáo'}`, '');
  if (dc.vanBanGoc.length) L.push(`Văn bản gốc: ${dc.vanBanGoc.join(', ')}`, '');
  const di = ds => ds.forEach(m => {
    L.push(`${'#'.repeat(Math.min(m.cap + 1, 6))} ${m.so && m.so !== '-' ? m.so + '. ' : ''}${m.tieuDe}${m.bat ? '' : ' (đang tắt)'}`, '');
    if (m.moTa.length || m.chiDan.length) {
      L.push('Yêu cầu của đề cương:');
      [...m.moTa, ...m.chiDan].forEach(x => L.push(`- ${x}`));
      L.push('');
    }
    const kq = ketQua[m.id];
    if (kq) {
      if (!kq.trichDoan.length) L.push('_Chưa tìm thấy văn bản liên quan._', '');
      kq.trichDoan.filter(t => t.chon).forEach(t => L.push(`[${t.n}] ${t.text}`, `    — Nguồn: ${t.soKyHieu}${t.ngay ? ', ngày ' + t.ngay : ''}${t.coQuan ? ', ' + t.coQuan : ''}${t.trang ? ', trang ' + t.trang : ''}`, ''));
    }
    di(m.con);
  });
  di(dc.muc);
  if (danhMuc.length) {
    L.push('## Danh mục văn bản liên quan', '', '| TT | Số, ký hiệu | Ngày | Cơ quan | Trích yếu |', '|---|---|---|---|---|');
    danhMuc.forEach((d, i) => L.push(`| ${i + 1} | ${d.soKyHieu} | ${d.ngay} | ${d.coQuan} | ${String(d.trichYeu).replace(/\|/g, '/')} |`));
    L.push('');
  }
  L.push('---', 'Gợi ý câu lệnh cho AI: «Viết báo cáo hành chính của Sở Nông nghiệp và Môi trường tỉnh Sơn La theo đúng các mục trên. Chỉ dùng số liệu trong các trích đoạn, ghi [n] sau mỗi số liệu; mục chưa có số liệu ghi "(chưa có số liệu)".»');
  return { md: L.join('\n') };
}

/** Bản .docx tối giản của dữ liệu thô (mỗi dòng Markdown một đoạn). */
async function xuatDuLieuThoDocx(md) {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const ps = md.split('\n').map(l => {
    const h = l.match(/^(#+)\s+(.*)$/);
    const t = h ? h[2] : l;
    return `<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${h ? '<w:b/>' : ''}<w:sz w:val="${h ? 28 : 26}"/></w:rPr><w:t xml:space="preserve">${escXml(t)}</w:t></w:r></w:p>`;
  }).join('');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${ps}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { docKhung, xuatBaoCao, xuatDuLieuTho, xuatDuLieuThoDocx, escXml, tachBody, datChu, para, pPrOf, rPrOf };
