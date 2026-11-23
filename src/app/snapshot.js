'use strict';
/** Chụp ảnh từng tab giao diện rồi thoát (BCIO_SNAPSHOT=<thư mục>) — dùng để tự kiểm tra bố cục. */
const fs = require('fs');
const path = require('path');

async function chup(win, dir, done) {
  fs.mkdirSync(dir, { recursive: true });
  const wc = win.webContents;
  const doi = ms => new Promise(r => setTimeout(r, ms));
  await doi(800);
  for (const [w, h] of [[1280, 860], [900, 760]]) {
    win.setContentSize(w, h);
    for (const tab of ['baocao', 'decuong', 'kho', 'caidat', 'nhatky']) {
      await wc.executeJavaScript(`goTab('${tab}'); if ('${tab}' === 'decuong') { const it = [...document.querySelectorAll('.mitem')].find(x => /2\.3\./.test(x.textContent)); if (it) it.click(); } if ('${tab}' === 'kho') { document.querySelector('#oTim').value = 'giải phóng mặt bằng'; document.querySelector('#btnTim').click(); }`);
      await doi(500);
      const img = await wc.capturePage();
      fs.writeFileSync(path.join(dir, `${w}-${tab}.png`), img.toPNG());
    }
  }
  done();
}

module.exports = { chup };
