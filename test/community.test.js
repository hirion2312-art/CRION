// 신고·건의 보내기 시험: node test/community.test.js
'use strict';
const assert = require('assert');
const C = require('../src/renderer/community');

const t = [];
const test = (n, f) => t.push([n, f]);
const HOOK = 'https://discord.com/api/webhooks/123456789/abcDEF_-xyz';

test('웹후크 주소만 받는다', () => {
  assert.ok(C.isWebhook(HOOK));
  assert.ok(!C.isWebhook('https://evil.example/api/webhooks/1/a'));
  assert.ok(!C.isWebhook(''));
});
test('디스코드 형식으로 만든다 (멘션 막기)', () => {
  const p = C.buildPayload('bug', { work: '평가혜', title: '응답이 안 나와요 @everyone', body: '내용 <@123>', nick: '팬1' }, { app: '0.3.0', engine: '0.3.7', os: 'win32' });
  assert.strictEqual(p.embeds[0].color, C.KINDS.bug.color);
  assert.ok(!/@everyone/.test(p.embeds[0].title.replace('​', 'X')));
  assert.ok(p.embeds[0].description.includes('[멘션]'));
  assert.deepStrictEqual(p.allowed_mentions, { parse: [] });
  assert.ok(p.embeds[0].fields.some(f => f.name === '작품' && f.value === '평가혜'));
});
test('긴 글은 자른다', () => {
  const p = C.buildPayload('idea', { body: 'ㄱ'.repeat(5000) }, null);
  assert.ok(p.embeds[0].description.length <= 3800);
});
test('횟수 제한', () => {
  const now = 10_000_000;
  const h = Array.from({ length: 5 }, (_, i) => ({ at: now - i * 1000 }));
  assert.strictEqual(C.allowed(h, now).ok, false);
  assert.strictEqual(C.allowed(h, now + 11 * 60 * 1000).ok, true);
});
test('보내기: multipart로 payload_json과 첨부 파일', async () => {
  let got = null;
  await C.send(HOOK, { content: 'x' }, { text: '진단', name: 'diag.txt' }, async (url, opts) => { got = { url, opts }; return {}; });
  assert.ok(got.url.startsWith(HOOK));
  assert.strictEqual(got.opts.mode, 'no-cors');
  assert.strictEqual(got.opts.body.get('payload_json'), JSON.stringify({ content: 'x' }));
  assert.ok(got.opts.body.get('files[0]'));
});
test('받을 곳이 없으면 오류', async () => {
  await assert.rejects(C.send('', {}, null, async () => ({})), /설정/);
});

(async () => {
  let fail = 0;
  for (const [n, f] of t) {
    try { await f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + e.message); }
  }
  console.log(fail ? `\n${fail}개 실패` : `\n신고·건의 시험 ${t.length}개 통과`);
  process.exit(fail ? 1 : 0);
})();
