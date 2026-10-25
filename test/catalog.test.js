// 작품 목록 합치기 시험: node test/catalog.test.js
'use strict';
const assert = require('assert');
const C = require('../src/renderer/catalog');

const t = [];
const test = (n, f) => t.push([n, f]);

// 지금 관리 페이지에 있는 모양 그대로 (고정 4개는 주소 없음)
const catalog = { hidden: [], works: [
  { id: 'safehouse', name: '아포칼립스 안전지대의 관리자', genre: '좀비 생존 운영', url: '', thumb: '' },
  { id: 'magical', name: '마법소녀의 최종보스', genre: '샌드박스', url: '', thumb: '' },
  { id: 'guild', name: '이종족 길드의 유일한 남자', genre: '판타지 모험', url: '', thumb: '' },
  { id: 'univ', name: '크랙대학교', genre: '캠퍼스 로맨스 코미디', url: '', thumb: '' },
  { id: 'pyeonggahye', name: '돌아온 프로필 평가하는 평가혜', genre: '캐릭터챗', url: 'https://share.crack.wrtn.ai/okelh4', thumb: 'https://x/pg.webp', featured: true }
] };
const profile = [
  { url: 'https://crack.wrtn.ai/detail/a1', title: '아포칼립스 안전지대의 관리자', thumb: 'https://cdn/a1.png', text: '아포칼립스 안전지대의 관리자 좀비가 들끓는 도시에서 살아남아라 1.2만' },
  { url: 'https://crack.wrtn.ai/detail/b2', title: '용사하렘파티의 노예', thumb: 'https://cdn/b2.png', text: '용사하렘파티의 노예 노예로 팔려 간 나' },
  { url: 'https://crack.wrtn.ai/detail/c3', title: '[완결] 온리펜슬', thumb: 'https://cdn/c3.png', text: '' },
  { url: 'https://crack.wrtn.ai/detail/d4', title: '돌아온 프로필 평가하는 평가혜', thumb: 'https://cdn/d4.png', text: '' },
  { url: 'https://crack.wrtn.ai/detail/e5', title: '크랙대학교', thumb: 'https://cdn/e5.png', text: '' }
];

test('프로필 작품이 모두 들어간다 (프로필 순서)', () => {
  const w = C.merge(catalog, profile, []);
  assert.deepStrictEqual(w.map(x => x.name), ['아포칼립스 안전지대의 관리자', '용사하렘파티의 노예', '[완결] 온리펜슬', '돌아온 프로필 평가하는 평가혜', '크랙대학교']);
});
test('관리 페이지 값이 같은 작품에 덧입혀진다', () => {
  const w = C.merge(catalog, profile, []);
  const a = w.find(x => x.name.startsWith('아포칼립스'));
  assert.strictEqual(a.id, 'safehouse');                 // 기존 기록·이어하기가 이어지도록 같은 id
  assert.strictEqual(a.genre, '좀비 생존 운영');
  assert.strictEqual(a.url, 'https://crack.wrtn.ai/detail/a1');
  assert.strictEqual(a.thumb, 'https://cdn/a1.png');
  const p = w.find(x => x.id === 'pyeonggahye');
  assert.ok(p.featured);
  assert.strictEqual(p.thumb, 'https://x/pg.webp');      // 관리 페이지 썸네일 우선
});
test('주소 없는 예전 고정 작품은 프로필에 없으면 빠진다', () => {
  const w = C.merge(catalog, profile, []);
  assert.ok(!w.some(x => x.id === 'magical' || x.id === 'guild'));
});
test('짧은 글자로 엉뚱한 작품에 붙지 않는다', () => {
  assert.strictEqual(C.sameWork({ name: '크랙대학교' }, { title: '대학' }), false);
  assert.strictEqual(C.sameWork({ name: '평가혜' }, { title: '돌아온 프로필 평가하는 평가혜' }), false);
  assert.strictEqual(C.sameWork({ name: '온리펜슬' }, { title: '[완결] 온리펜슬' }), true);
});
test('숨긴 작품은 빠진다', () => {
  const w = C.merge(Object.assign({}, catalog, { hidden: ['https://crack.wrtn.ai/detail/b2'] }), profile, []);
  assert.ok(!w.some(x => x.name === '용사하렘파티의 노예'));
});
test('관리 페이지에만 있는 주소 있는 작품은 뒤에 남는다', () => {
  const cat2 = { works: catalog.works.concat({ id: 'extra', name: '비공개 테스트', url: 'https://crack.wrtn.ai/detail/zz' }) };
  const w = C.merge(cat2, profile, []);
  assert.strictEqual(w[w.length - 1].id, 'extra');
});
test('프로필을 못 읽었으면 예전 목록 그대로', () => {
  const w = C.merge(catalog, [], [{ id: 'x', name: 'x' }]);
  assert.deepStrictEqual(w.map(x => x.id), ['x']);
});
test('새 작품 id는 주소로 정해져서 매번 같다', () => {
  assert.strictEqual(C.idFor('https://crack.wrtn.ai/detail/b2'), C.idFor('https://crack.wrtn.ai/detail/b2/'));
});

let fail = 0;
for (const [n, f] of t) {
  try { f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + e.message); }
}
console.log(fail ? `\n${fail}개 실패` : `\n작품 목록 시험 ${t.length}개 통과`);
process.exit(fail ? 1 : 0);
