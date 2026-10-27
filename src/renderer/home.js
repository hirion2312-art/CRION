// 홈 화면 계산 (화면 그리기와 분리해 시험할 수 있게)
//  - 카테고리: 기본 '전체'(플레이팩 있는 작품이 맨 위) · '플레이팩' + 관리 페이지에서 만든 카테고리(works.json categories, 작품의 cats)
//  - 오늘의 추천작 슬라이드: 관리 페이지에서 넣은 슬라이드(works.json banners). 없으면 추천 작품 + 플레이팩 작품으로 자동
(function (root) {
  'use strict';
  const ALL = 'all', PACK = 'pack';

  function categories(catalog) {
    const seen = new Set([ALL, PACK]);
    return (Array.isArray(catalog && catalog.categories) ? catalog.categories : [])
      .map(c => (typeof c === 'string' ? { id: c, name: c } : c))
      .filter(c => c && c.id && c.name && !seen.has(String(c.id)) && seen.add(String(c.id)))
      .map(c => ({ id: String(c.id), name: String(c.name) }));
  }
  // 고를 수 있는 칸: 전체 · 플레이팩(있을 때) · 작품이 하나라도 든 카테고리
  function tabs(catalog, works, hasPack) {
    const out = [{ id: ALL, name: '전체', n: works.length }];
    const np = works.filter(hasPack).length;
    if (np) out.push({ id: PACK, name: '플레이팩', n: np });
    for (const c of categories(catalog)) {
      const n = works.filter(w => (w.cats || []).includes(c.id)).length;
      if (n) out.push({ id: c.id, name: c.name, n });
    }
    return out;
  }
  function list(works, opt) {
    const o = opt || {};
    const hasPack = o.hasPack || (() => false);
    let l = works.slice();
    if (o.cat === PACK) l = l.filter(hasPack);
    else if (o.cat && o.cat !== ALL) l = l.filter(w => (w.cats || []).includes(o.cat));
    const q = String(o.q || '').trim().toLowerCase();
    if (q) l = l.filter(w => [w.name, w.genre, w.desc].join(' ').toLowerCase().includes(q));
    // 플레이팩 있는 작품을 위로 (그 안에서는 관리 페이지 순서 그대로)
    return l.map((w, i) => [w, hasPack(w) ? 0 : 1, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
  }

  // 슬라이드: {img, work, title, sub, link, eyebrow}
  function slides(catalog, works, opt) {
    const o = opt || {};
    const byId = new Map(works.map(w => [w.id, w]));
    const max = o.max || 6;
    const made = (Array.isArray(catalog && catalog.banners) ? catalog.banners : [])
      .filter(b => b && b.on !== false && (b.img || b.work))
      .map(b => {
        const w = b.work ? byId.get(b.work) : null;
        if (b.work && !w) return null;   // 숨긴 작품·성인 작품(설정 꺼짐)은 안 보인다
        const link = /^https:\/\//.test(b.link || '') ? b.link : '';
        if (!w && !link && !b.title) return null;
        return { id: b.id || '', img: b.img || '', work: w, title: b.title || (w && w.name) || '', sub: b.sub || (w && (w.desc || w.genre)) || '', link, eyebrow: b.eyebrow || '', own: { title: !!b.title, sub: !!b.sub } };
      })
      .filter(Boolean).slice(0, max);
    if (made.length) return made;
    // 자동: 추천 작품 → 플레이팩 작품(팩 표지를 그림으로) → 최근 플레이
    const out = [], used = new Set();
    const add = (w, img, eyebrow) => { if (!w || used.has(w.id) || !w.url) return; used.add(w.id); out.push({ id: 'auto-' + w.id, img: img || '', work: w, title: w.name, sub: w.desc || w.genre || '', link: '', eyebrow: eyebrow || '', own: { title: false, sub: false } }); };
    const cover = o.packCover || (() => '');
    works.filter(w => w.featured).forEach(w => add(w, cover(w), '추천 작품'));
    works.filter(w => cover(w)).forEach(w => add(w, cover(w), '플레이팩'));
    (o.recent || []).map(id => byId.get(id)).forEach(w => add(w, '', '최근 플레이'));
    if (!out.length && works[0]) add(works.find(w => w.thumb && w.url) || works[0], '', '오늘의 작품');
    return out.slice(0, max);
  }

  const api = { ALL, PACK, categories, tabs, list, slides };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionHome = api;
})(typeof window !== 'undefined' ? window : globalThis);
