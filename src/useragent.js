'use strict';
// Electron tự chèn tên ứng dụng vào User-Agent (vd "ĐồngbộNhiệmvụiOffice/33.4.11"). Tên có dấu tiếng Việt
// làm cổng proxy của máy chủ iOffice trả 502 (curl: 400) — đã tái hiện; bỏ token đó thì 200.
// Bỏ mọi token chứa ký tự ngoài ASCII in được, còn lại dạng Chrome/Electron chuẩn.

function cleanUserAgent(ua) {
  return String(ua || '').split(/\s+/).filter(t => t && /^[\x21-\x7E]+$/.test(t)).join(' ');
}

module.exports = { cleanUserAgent };
