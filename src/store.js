'use strict';
/** Trạng thái ứng dụng: một tệp JSON ghi nguyên tử, giữ một bản sao lưu; nhật ký tối đa 500 dòng. */
const fs = require('fs');
const path = require('path');
const { DEFAULTS } = require('./constants');

const MAX_LOG = 500;

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'du-lieu.json');
    this.data = this.load();
  }

  load() {
    let d = {};
    for (const f of [this.file, this.file + '.bak']) {
      try { d = JSON.parse(fs.readFileSync(f, 'utf8')); break; } catch { /* thử bản sao lưu */ }
    }
    const caiDat = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...(d.caiDat || {}) };
    caiDat.ai = { ...DEFAULTS.ai, ...((d.caiDat || {}).ai || {}) };
    caiDat.giuTep = { ...DEFAULTS.giuTep, ...((d.caiDat || {}).giuTep || {}) };
    return { taiKhoan: {}, baoCao: null, log: [], lastRunAt: null, lastFailAt: null, ...d, caiDat };
  }

  save() {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
    fs.renameSync(tmp, this.file);
  }

  log(level, msg) {
    this.data.log.push({ t: new Date().toISOString(), level, msg: String(msg).slice(0, 500) });
    if (this.data.log.length > MAX_LOG) this.data.log.splice(0, this.data.log.length - MAX_LOG);
  }
}

module.exports = { Store };
