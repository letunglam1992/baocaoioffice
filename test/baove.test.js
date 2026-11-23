'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { chanDieuHuong } = require('../src/app/baove');

test('cửa sổ chính không điều hướng sang trang khác và không mở cửa sổ mới', () => {
  const wc = new EventEmitter();
  let handler = null;
  wc.setWindowOpenHandler = h => { handler = h; };
  chanDieuHuong(wc, 'file:///app/src/ui/index.html');
  let chan = false;
  wc.emit('will-navigate', { preventDefault: () => { chan = true; } }, 'file:///C:/Users/x/Downloads/evil.html');
  assert.strictEqual(chan, true);
  assert.deepStrictEqual(handler({ url: 'https://x' }), { action: 'deny' });
  let chan2 = false;
  wc.emit('will-navigate', { preventDefault: () => { chan2 = true; } }, 'file:///app/src/ui/index.html');
  assert.strictEqual(chan2, false, 'tải lại chính trang giao diện thì cho phép');
});
