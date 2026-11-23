'use strict';
// Tự tải lại trang iOffice khi máy chủ/cổng proxy lỗi tạm thời (502, 503, 504…) hoặc mất mạng.
// Tách khỏi ioffice.js (cần electron) để kiểm thử được.

const MAX_RELOADS = 8;
const ERR_ABORTED = -3; // điều hướng bị thay bằng điều hướng khác — không phải lỗi

/** Có nên tự tải lại không: lỗi HTTP 5xx của khung chính, hoặc lỗi mạng (trừ bị hủy). */
function shouldReload({ httpCode, errorCode } = {}) {
  if (errorCode != null) return errorCode !== 0 && errorCode !== ERR_ABORTED;
  return httpCode >= 500 && httpCode <= 599;
}

/** Thời gian chờ trước lần tải lại thứ `attempt` (0-based): 5, 10, 20, 40, 60, 60… giây. */
function reloadDelay(attempt) {
  return Math.min(5000 * 2 ** attempt, 60000);
}

module.exports = { shouldReload, reloadDelay, MAX_RELOADS };
