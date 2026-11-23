'use strict';
/** Lịch quét nền theo giờ Việt Nam (UTC+7), không phụ thuộc múi giờ máy. */
const VN = 7 * 3600000;
const pad = n => String(n).padStart(2, '0');

/** dd/mm/yyyy theo giờ Việt Nam. */
function ngayVN(t) { const d = new Date(t + VN); return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; }
/** dd/mm/yyyy (hiểu là 00:00 giờ VN) → mốc thời gian. */
function tuNgayVN(s) { const [d, m, y] = s.split('/').map(Number); return Date.UTC(y, m - 1, d) - VN; }

/** Các mốc lịch (giờ VN) trong 3 ngày gần nhất tính đến now. */
function cacMoc(lich, now) {
  const out = [];
  const d0 = new Date(now + VN);
  for (let k = -2; k <= 0; k++) {
    for (const hm of lich || []) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(hm); if (!m) continue;
      out.push(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate() + k, +m[1], +m[2]) - VN);
    }
  }
  return out.filter(t => t <= now);
}

function denHan({ lich, lastRunAt, lastFailAt, tiepTucAt, thuLaiPhut = 30, now = Date.now() }) {
  if (tiepTucAt && now >= tiepTucAt) return true; // lượt trước chạm giới hạn → làm tiếp
  if (lastFailAt && now - lastFailAt >= thuLaiPhut * 60000) return true;
  if (!lastRunAt) return true;
  return cacMoc(lich, now).some(t => t > lastRunAt);
}

function khoangLuot({ lastOkAt, luiNgay = 3, tuNgayDau, now = Date.now() }) {
  const dau = tuNgayVN(tuNgayDau);
  let tu = lastOkAt ? tuNgayVN(lastOkAt) - luiNgay * 86400000 : dau;
  if (tu < dau) tu = dau;
  return { tuNgay: ngayVN(tu), denNgay: ngayVN(now) };
}

function buKhiMoMay(startedAt, now, buSauPhut = 5) { return now - startedAt >= buSauPhut * 60000; }

module.exports = { denHan, khoangLuot, buKhiMoMay, ngayVN, tuNgayVN };
