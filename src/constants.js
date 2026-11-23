'use strict';
/** Hằng số và cài đặt mặc định dùng chung. */
const IOFFICE_URL = 'https://stnmtsonla.vnptioffice.vn/';

const DEFAULTS = Object.freeze({
  lich: ['12:00'],
  luiNgay: 3,
  buSauPhut: 5,
  thuLaiPhut: 30,
  tuNgayDau: '01/01/2025',
  maxCalls: 300,
  maxFiles: 100,
  gianCachMs: 700,
  ai: { bat: false, diaChi: 'https://rasoatvanban.letunglam1992.workers.dev', khongGui: [] },
  khoDir: null,
  thuMucQuetVanBan: 'H:\\Van ban den',
  giuTep: { loai: [], tranMB: 500 },
  tuKhoiDong: true,
  ocrLucRanh: true
});

module.exports = { IOFFICE_URL, DEFAULTS };
