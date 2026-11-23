'use strict';
/* Giao diện — phần dùng chung: trạng thái S, tiện ích DOM, gọi IPC, thông báo, chuyển tab. Script thường, nạp theo thứ tự trong index.html. */
/* global bc */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let S = null;
const RENDER = [];

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p2 = n => String(n).padStart(2, '0');
const fmtTime = t => { if (!t) return '—'; const d = new Date(t); return `${p2(d.getHours())}:${p2(d.getMinutes())} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`; };

function toast(msg, o = {}) {
  const t = $('#toast');
  t.className = 'toast' + (o.tone === 'err' ? ' err' : '');
  t.innerHTML = `<span>${esc(msg)}</span><button type="button" class="tclose" aria-label="Đóng thông báo">×</button>`;
  t.setAttribute('role', o.tone === 'err' ? 'alert' : 'status');
  t.hidden = false;
  t.querySelector('.tclose').onclick = () => { t.hidden = true; };
  clearTimeout(toast.h);
  if (o.tone !== 'err') toast.h = setTimeout(() => { t.hidden = true; }, 4000);
}

/** Gọi IPC: {ok, r|loi}. Lỗi → thông báo đỏ, trả undefined. */
async function goi(fn, ...a) {
  const x = await fn(...a);
  if (!x || !x.ok) { toast((x && x.loi) || 'Có lỗi, vui lòng thử lại.', { tone: 'err' }); return undefined; }
  return x.r === undefined ? true : x.r;
}

/** Nút bận: khóa nút và đổi chữ trong lúc chờ. */
async function ban(btn, chu, fn) {
  const cu = btn.textContent; btn.disabled = true; btn.textContent = chu;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = cu; }
}

function goTab(id) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === id));
}

function capNhat(s) {
  S = s;
  for (const f of RENDER) { try { f(s); } catch (e) { console.error(e); } }
}
