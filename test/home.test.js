// 홈 카테고리·추천 슬라이드 계산 시험
const assert = require('assert');
const H = require('../src/renderer/home.js');
const t = [];
const test = (n, f) => t.push([n, f]);

const works = [
  { id: 'a', name: '로맨스 A', url: 'https://crack.wrtn.ai/a', cats: ['romance'] },
  { id: 'b', name: '판타지 B', url: 'https://crack.wrtn.ai/b', cats: ['fantasy', 'academy'], featured: true },
  { id: 'c', name: '생존 C', url: 'https://crack.wrtn.ai/c', genre: '좀비' },
  { id: 'd', name: '아카데미 D', url: 'https://crack.wrtn.ai/d', cats: ['academy'] }
];
const packs = { c: 'https://x/c.webp', d: 'https://x/d.webp' };
const hasPack = (w) => !!packs[w.id];
const cat = { categories: [{ id: 'romance', name: '로맨스' }, { id: 'fantasy', name: '판타지' }, { id: 'academy', name: '아카데미' }, { id: 'empty', name: '빈 칸' }, { id: 'pack', name: '겹침' }] };

test('전체: 플레이팩 작품이 맨 위, 나머지는 원래 순서', () => {
  assert.deepStrictEqual(H.list(works, { cat: 'all', hasPack }).map(w => w.id), ['c', 'd', 'a', 'b']);
});
test('플레이팩 칸 · 카테고리 칸 · 찾기', () => {
  assert.deepStrictEqual(H.list(works, { cat: 'pack', hasPack }).map(w => w.id), ['c', 'd']);
  assert.deepStrictEqual(H.list(works, { cat: 'academy', hasPack }).map(w => w.id), ['d', 'b']);
  assert.deepStrictEqual(H.list(works, { cat: 'all', q: '좀비', hasPack }).map(w => w.id), ['c']);
});
test('탭: 빈 카테고리와 기본 칸 이름 겹침은 빠진다', () => {
  assert.deepStrictEqual(H.tabs(cat, works, hasPack).map(x => x.id + ':' + x.n), ['all:4', 'pack:2', 'romance:1', 'fantasy:1', 'academy:2']);
  assert.deepStrictEqual(H.tabs({}, works, () => false).map(x => x.id), ['all']);
});
test('슬라이드: 관리 페이지 것 우선, 안 보이는 작품 연결은 빠짐', () => {
  const s = H.slides({ banners: [{ id: '1', img: 'https://x/1.webp', work: 'a', title: '이번 주 추천' }, { id: '2', img: 'https://x/2.webp', work: 'zz' }, { id: '3', img: 'https://x/3.webp', on: false, work: 'b' }, { id: '4', img: 'https://x/4.webp', title: '이벤트', link: 'https://discord.gg/x' }] }, works, {});
  assert.deepStrictEqual(s.map(x => x.id), ['1', '4']);
  assert.strictEqual(s[0].work.id, 'a');
  assert.strictEqual(s[0].title, '이번 주 추천');
  assert.strictEqual(s[1].link, 'https://discord.gg/x');
});
test('슬라이드: 없으면 추천 작품 → 플레이팩 작품(팩 표지) 자동', () => {
  const s = H.slides({}, works, { packCover: (w) => packs[w.id] || '', recent: ['a'] });
  assert.deepStrictEqual(s.map(x => x.work.id), ['b', 'c', 'd', 'a']);
  assert.strictEqual(s[1].img, 'https://x/c.webp');
  assert.strictEqual(s[0].eyebrow, '추천 작품');
});

(async () => {
  let fail = 0;
  for (const [n, f] of t) {
    try { await f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + e.message); }
  }
  console.log(fail ? `\n${fail}개 실패` : `\n홈 화면 시험 ${t.length}개 통과`);
  process.exit(fail ? 1 : 0);
})();
