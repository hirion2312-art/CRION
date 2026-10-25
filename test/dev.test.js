// 개발자 모드 시험: node test/dev.test.js
'use strict';
const assert = require('assert');
const D = require('../src/renderer/dev');
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; };
const t = [];
const test = (n, f) => t.push([n, f]);

test('열쇠를 비밀번호로 잠그고 열기', async () => {
  const s = mem();
  const v = new D.Vault(s);
  assert.ok(!v.exists());
  await v.save('github_pat_ABC', '히리온1234');
  assert.ok(v.exists());
  assert.ok(!JSON.stringify(s._m).includes('github_pat_ABC'), '열쇠가 그대로 저장되면 안 된다');
  assert.ok(!JSON.stringify(s._m).includes('히리온1234'), '비밀번호도 저장 안 함');
  assert.strictEqual(await new D.Vault(s).open('히리온1234'), 'github_pat_ABC');
  await assert.rejects(() => v.open('틀림'), /wrong/);
  v.clear();
  assert.ok(!v.exists());
});
test('짧은 비밀번호 거부', async () => {
  await assert.rejects(() => new D.Vault(mem()).save('x', '12'), /4자/);
});
const base = () => ({ works: [{ id: 'a', name: '가', url: 'https://crack.wrtn.ai/detail/a', featured: true }, { id: 'b', name: '나', url: '' }], hidden: [] });
test('작품 추가는 맨 앞, 주소 검사·중복 검사', async () => {
  const d = base();
  const w = D.upsert(d, { name: ' 새 작품 ', url: 'https://share.crack.wrtn.ai/okelh4', genre: '캐릭터챗', featured: true });
  assert.strictEqual(d.works[0], w);
  assert.strictEqual(w.name, '새 작품');
  assert.ok(w.featured && !d.works[1].featured, '추천은 하나만');
  assert.throws(() => D.upsert(d, { name: 'x', url: 'https://evil.com/a' }), /크랙 작품 주소/);
  assert.throws(() => D.upsert(d, { name: 'x', url: 'https://crack.wrtn.ai/detail/a/' }), /같은 주소/);
  assert.throws(() => D.upsert(d, { name: ' ', url: '' }), /이름/);
});
test('수정은 제자리', async () => {
  const d = base();
  D.upsert(d, { id: 'b', name: '나나', url: 'https://crack.wrtn.ai/detail/b', desc: '소개' });
  assert.strictEqual(d.works[1].name, '나나');
  assert.strictEqual(d.works[1].desc, '소개');
  assert.ok(d.works[0].featured, '추천 표시를 안 건드린 다른 작품은 그대로');
});
test('삭제·순서·숨기기', async () => {
  const d = base();
  D.toggleHide(d, 'a');
  assert.deepStrictEqual(d.hidden, ['https://crack.wrtn.ai/detail/a']);
  assert.ok(D.move(d, 'b', -1));
  assert.strictEqual(d.works[0].id, 'b');
  assert.ok(!D.move(d, 'b', -1));
  D.remove(d, 'a');
  assert.deepStrictEqual(d.works.map(x => x.id), ['b']);
  assert.deepStrictEqual(d.hidden, [], '지운 작품의 숨김 표시도 정리');
  assert.throws(() => D.toggleHide(d, 'b'), /주소/);
});
test('한글 내용 그대로 올라간다', () => {
  assert.strictEqual(D.dec(D.enc('평가혜 ♥')), '평가혜 ♥');
});

(async () => {
  let fail = 0;
  for (const [n, f] of t) {
    try { await f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + e.message); }
  }
  console.log(fail ? `\n${fail}개 실패` : `\n개발자 모드 시험 ${t.length}개 통과`);
  process.exit(fail ? 1 : 0);
})();
