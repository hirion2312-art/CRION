// 스토어(플레이팩) 시험: node test/packs.test.js
'use strict';
const assert = require('assert');
const P = require('../src/renderer/packs');

const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const t = [];
const test = (n, f) => t.push([n, f]);
const index = { packs: [
  { id: 'safehouse', name: '안전지대 관리 화면', version: '1.0.0', base: 'https://x.github.io/CRION/packs/safehouse/', cover: 'cover.webp', previews: ['p1.webp', '../evil', 'javascript:alert(1)', 'https://cdn/p3.webp'], ui: 'ui.html', workId: 'safehouse', tags: ['생존', '관리'], minEngine: '0.4.0' },
  { id: 'bad', name: '주소 없음', base: 'http://insecure/' },
  { id: 'guild', name: '길드 화면', version: '0.2.0', base: 'https://x.github.io/CRION/packs/guild/', workUrl: 'https://share.crack.wrtn.ai/abc' }
] };

test('index.json 팩을 읽고 https 아닌 것은 뺀다', () => {
  const l = P.fromIndex(index);
  assert.deepStrictEqual(l.map(p => p.id), ['safehouse', 'guild']);
  assert.strictEqual(l[0].cover, 'https://x.github.io/CRION/packs/safehouse/cover.webp');
  assert.deepStrictEqual(l[0].previews, ['https://x.github.io/CRION/packs/safehouse/p1.webp', 'https://cdn/p3.webp']);
});
test('팩이 없으면 빈 목록', () => {
  assert.deepStrictEqual(P.fromIndex({ packs: [] }), []);
  assert.deepStrictEqual(P.fromIndex(null), []);
});
test('작품과 팩 연결 (id 또는 주소)', () => {
  const l = P.fromIndex(index);
  assert.strictEqual(P.forWork(l, { id: 'safehouse' }).id, 'safehouse');
  assert.strictEqual(P.forWork(l, { id: 'x', url: 'https://share.crack.wrtn.ai/abc/' }).id, 'guild');
  assert.strictEqual(P.forWork(l, { id: 'none', url: '' }), null);
});
test('설치·업데이트·삭제', () => {
  const l = P.fromIndex(index);
  const s = mem();
  const i = new P.Installed(s);
  i.install(Object.assign({}, l[1], { version: '0.1.0' }));
  assert.ok(new P.Installed(s).has('guild'), '다시 열어도 남아 있다');
  assert.ok(i.needsUpdate(l[1]));
  i.install(l[1]);
  assert.ok(!i.needsUpdate(l[1]));
  i.remove('guild');
  assert.ok(!i.has('guild'));
});
test('엔진 버전 맞는지', () => {
  const l = P.fromIndex(index);
  assert.ok(P.compatible(l[0], '0.4.0'));
  assert.ok(!P.compatible(l[0], '0.3.14'));
  assert.ok(P.compatible(l[1], '0.1.0'));
});
test('검색·탭', () => {
  const l = P.fromIndex(index);
  const i = new P.Installed(mem());
  i.install(l[0]);
  assert.deepStrictEqual(P.filter(l, { q: '생존' }, i).map(p => p.id), ['safehouse']);
  assert.deepStrictEqual(P.filter(l, { tab: 'installed' }, i).map(p => p.id), ['safehouse']);
  assert.deepStrictEqual(P.filter(l, { tab: 'update' }, i).map(p => p.id), []);
});

const PS = require('../src/renderer/packstore');
test('팩 파일 받기 계획: 바뀐 것만 받고 없어진 것은 지운다, 위험한 경로는 뺀다', () => {
  const old = [{ path: 'a.webp', sha256: '1' }, { path: 'b.webp', sha256: '2' }, { path: 'gone.webp', sha256: '3' }];
  const now = [{ path: 'a.webp', sha256: '1', size: 10 }, { path: 'b.webp', sha256: '9', size: 20 }, { path: 'c.webp', sha256: '4', size: 5 }, { path: '../x', sha256: '5', size: 1 }, { path: 'https://evil/x', sha256: '6', size: 1 }];
  const p = PS.plan(old, now);
  assert.deepStrictEqual(p.get.map(f => f.path), ['b.webp', 'c.webp']);
  assert.deepStrictEqual(p.drop, ['gone.webp']);
  assert.strictEqual(p.bytes, 25);
  assert.strictEqual(PS.plan(null, now.slice(0, 1)).get.length, 1);
});
test('index.json 파일 목록·rev 를 싣고 이상한 경로는 뺀다, 작품 이름으로도 연결', () => {
  const sha = 'a'.repeat(64);
  const l = P.fromIndex({ packs: [{ id: 'sa', name: '학생 수첩', version: '1.0.0', base: 'https://x/packs/sa/', rev: 'r1', runner: 'academy', workName: '소환수 아카데미', files: [{ path: 'manifest.json', sha256: sha, size: 3 }, { path: '../evil', sha256: sha }, { path: 'x', sha256: 'zz' }] }] });
  assert.deepStrictEqual(l[0].files.map(f => f.path), ['manifest.json']);
  assert.strictEqual(l[0].rev, 'r1');
  assert.strictEqual(P.forWork(l, { id: 'q', name: '소환수 아카데미 (베타)' }).id, 'sa');
  const i = new P.Installed(mem());
  i.install(l[0]);
  assert.ok(i.isOn('sa'));
  i.setOn('sa', false);
  assert.ok(!i.isOn('sa'));
  i.install(Object.assign({}, l[0], { rev: 'r2' }));
  assert.ok(!i.isOn('sa'), '업데이트해도 끈 상태 유지');
  assert.ok(!i.needsUpdate(Object.assign({}, l[0], { rev: 'r2' })));
  assert.ok(i.needsUpdate(Object.assign({}, l[0], { rev: 'r3' })), '같은 버전이라도 파일이 바뀌면 업데이트');
});

t.push(['개발자 전용 팩: 개발자 로그인일 때만 목록에', () => {
  const sha = 'a'.repeat(64);
  const idx = { packs: [{ id: 'a', name: '공개 팩', base: 'https://x/packs/a/', files: [] }], devPacks: [{ id: 'sh', name: '안전지대', base: 'https://x/packs/sh/', runner: 'safehouse', workId: 'safehouse', files: [{ path: 'manifest.json', sha256: sha, size: 1 }] }] };
  assert.deepStrictEqual(P.fromIndex(idx).map(p => p.id), ['a'], '일반 사용자에겐 안 보임');
  assert.deepStrictEqual(P.fromIndex(idx, { dev: false }).map(p => p.id), ['a']);
  const d = P.fromIndex(idx, { dev: true });
  assert.deepStrictEqual(d.map(p => p.id), ['a', 'sh']);
  assert.ok(d[1].devOnly && !d[0].devOnly);
  assert.strictEqual(d[1].runner, 'safehouse');
  assert.strictEqual(P.forWork(d, { id: 'safehouse', name: '아포칼립스 안전지대의 관리자' }).id, 'sh');
  assert.strictEqual(P.forWork(P.fromIndex(idx), { id: 'safehouse', name: '아포칼립스 안전지대의 관리자' }), null, '팔로워에겐 작품 연결도 없음');
  // 같은 id가 공개 목록에도 있으면 공개 쪽 하나만
  assert.strictEqual(P.fromIndex({ packs: idx.devPacks, devPacks: idx.devPacks }, { dev: true }).length, 1);
}]);

let fail = 0;
for (const [n, f] of t) {
  try { f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + e.message); }
}
console.log(fail ? `\n${fail}개 실패` : `\n스토어 시험 ${t.length}개 통과`);
process.exit(fail ? 1 : 0);
