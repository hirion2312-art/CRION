// 내 기록 저장 시험: node test/store.test.js
'use strict';
const assert = require('assert');
const { WorkStore, fmtTime, ago } = require('../src/renderer/store');

const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
const t = [];
const test = (n, f) => t.push([n, f]);

test('턴·인물·그림을 모은다', () => {
  const s = new WorkStore(mem());
  const beats = [{ kind: 'narr', text: '밤.' }, { kind: 'say', who: '세라', text: '안녕', imgs: [{ src: 'a.png', w: 300, h: 600 }] }, { kind: 'say', who: '카일', text: '왔어' }];
  const frames = [{}, { person: { src: 'a.png' } }, {}];
  const r = s.recordTurn('w', beats, frames, 1000);
  assert.strictEqual(r.turns, 1);
  assert.deepStrictEqual(Object.keys(r.chars).sort(), ['세라', '카일']);
  assert.strictEqual(r.chars['세라'].img, 'a.png');
  assert.strictEqual(r.album.length, 1);
  s.recordTurn('w', beats, frames, 2000);
  assert.strictEqual(s.get('w').album.length, 1, '같은 그림은 한 번만');
  assert.strictEqual(s.get('w').chars['세라'].lines, 2);
});
test('다시 열어도 남아 있다', () => {
  const m = mem();
  new WorkStore(m).recordTurn('w', [{ kind: 'say', who: '세라', text: 'x' }], [], 1);
  assert.strictEqual(new WorkStore(m).get('w').turns, 1);
});
test('별표 대사 켜고 끄기', () => {
  const s = new WorkStore(mem());
  assert.strictEqual(s.toggleQuote('w', { who: '세라', text: '안녕' }), true);
  assert.ok(s.hasQuote('w', { who: '세라', text: '안녕' }));
  assert.strictEqual(s.toggleQuote('w', { who: '세라', text: '안녕' }), false);
  assert.strictEqual(s.get('w').quotes.length, 0);
});
test('플레이 시간: 30분 넘는 한 번은 무시', () => {
  const s = new WorkStore(mem());
  s.addTime('w', 60000); s.addTime('w', 40 * 60000);
  assert.strictEqual(s.get('w').playMs, 60000);
});
test('합계', () => {
  const s = new WorkStore(mem());
  s.recordTurn('a', [], [], 1); s.recordTurn('a', [], [], 2); s.recordTurn('b', [], [], 3);
  const r = s.totals(['a', 'b', 'c']);
  assert.deepStrictEqual([r.turns, r.played], [3, 2]);
});
test('시간 글자', () => {
  assert.strictEqual(fmtTime(5 * 60000), '5분');
  assert.strictEqual(fmtTime(125 * 60000), '2시간 5분');
  assert.strictEqual(ago(1000, 1000 + 3 * 3600 * 1000), '3시간 전');
});
test('저장소가 없어도 죽지 않는다', () => {
  const s = new WorkStore(null);
  s.recordTurn('w', [], [], 1);
  assert.strictEqual(s.get('w').turns, 1);
});

let fail = 0;
for (const [n, f] of t) {
  try { f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + e.message); }
}
console.log(fail ? `\n${fail}개 실패` : `\n내 기록 시험 ${t.length}개 통과`);
process.exit(fail ? 1 : 0);
