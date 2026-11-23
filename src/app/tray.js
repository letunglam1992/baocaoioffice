'use strict';
/** Biểu tượng khay hệ thống và menu chuột phải. */
const { Tray, Menu } = require('electron');

function createTray({ icon, on }) {
  const tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Tổng hợp báo cáo iOffice');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở cửa sổ', click: on.show },
    { label: 'Quét ngay', click: on.scan },
    { type: 'separator' },
    { label: 'Thoát', click: on.quit }
  ]));
  tray.on('click', on.show);
  return tray;
}

module.exports = { createTray };
