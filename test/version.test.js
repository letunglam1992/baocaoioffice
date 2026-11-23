'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('phiên bản package.json có trong mục «Có gì mới» của giao diện', () => {
  const v = require('../package.json').version;
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'index.html'), 'utf8');
  const m = html.match(/<section id="whatsNew"[\s\S]*?<\/section>/);
  assert.ok(m, 'thiếu #whatsNew');
  assert.ok(m[0].includes(v), `#whatsNew chưa có phiên bản ${v}`);
});
