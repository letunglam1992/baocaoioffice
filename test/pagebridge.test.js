'use strict';
/** Chạy cầu nối trong trang (pageBridge) với trang iOffice giả lập — bắt lỗi kiểu «r is not defined». */
const test = require('node:test');
const assert = require('node:assert');
const vm = require('vm');
const { pageBridge } = require('../src/ioffice');

function trangGia({ body = Buffer.from('%PDF-1.4 noi dung'), headers = {}, status = 200 } = {}) {
  const ctx = {
    document: { body: {} },
    fetch: async () => ({ ok: status === 200, status, headers: { get: k => headers[k.toLowerCase()] ?? null }, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) }),
    btoa: s => Buffer.from(s, 'latin1').toString('base64'),
    AbortController, setTimeout, clearTimeout, Uint8Array, String, Math, Error, Promise
  };
  ctx.window = ctx;
  ctx.angular = { element: () => ({ injector: () => ({ get: n => (n === '$fileManager' ? { generateAPIViewFile: () => 'https://x/view#toolbar=1' } : {}) }) }) };
  vm.createContext(ctx);
  vm.runInContext(`(${pageBridge.toString()})()`, ctx);
  return ctx;
}

test('tải tệp trong trang trả về base64 đúng nội dung và kiểu', async () => {
  const ctx = trangGia({ headers: { 'content-type': 'application/pdf', 'content-length': '17' } });
  const r = await ctx.window.__iosync.file('p/a.pdf', 'a.pdf', 30);
  assert.strictEqual(Buffer.from(r.b64, 'base64').toString('latin1'), '%PDF-1.4 noi dung');
  assert.strictEqual(r.type, 'application/pdf');
});

test('tệp lớn hơn giới hạn: báo QUA_LON trước khi tải', async () => {
  const ctx = trangGia({ headers: { 'content-length': String(40 * 1048576) } });
  await assert.rejects(ctx.window.__iosync.file('p/a.pdf', 'a.pdf', 30), /QUA_LON 40 MB/);
});

test('máy chủ trả lỗi HTTP', async () => {
  const ctx = trangGia({ status: 404 });
  await assert.rejects(ctx.window.__iosync.file('p/a.pdf', 'a.pdf', 30), /HTTP 404/);
});
