// 작품 목록 합치기 (화면 엔진 쪽에서 해서 앱 재설치 없이 고칠 수 있게)
//  - 작가 프로필에서 읽은 작품이 기본 목록이다 (프로필 순서 그대로)
//  - 관리 페이지(catalog.json) 값은 같은 작품(주소가 같거나 제목이 같은 것)에 덧입힌다: 이름·장르·소개·썸네일·추천·음악·공략
//  - 관리 페이지에만 있고 주소가 있는 작품은 뒤에 붙인다 (직접 추가한 작품)
//  - 관리 페이지에만 있고 주소가 없는 작품(예전 고정 목록)은 프로필을 읽은 뒤엔 뺀다
(function (root) {
  'use strict';
  const normUrl = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, ''); } catch (e) { return String(u || ''); } };
  const normTitle = (t) => String(t || '').toLowerCase().replace(/[\s\[\](){}<>「」『』【】"'“”‘’!?.,:;~\-_·…♡♥★☆]/g, '');
  const idFor = (url) => {
    let h = 5381;
    for (const c of normUrl(url)) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return 'p' + (h >>> 0).toString(36);
  };

  function sameWork(c, p) {
    if (c.url && p.url && normUrl(c.url) === normUrl(p.url)) return true;
    const a = normTitle(c.name), b = normTitle(p.title);
    if (!a || !b) return false;
    if (a === b) return true;
    // 한쪽 제목이 다른 쪽을 충분히 길게 포함할 때만 (짧은 글자 오인 방지)
    const short = a.length < b.length ? a : b, long = a.length < b.length ? b : a;
    return short.length >= 4 && long.includes(short) && short.length / long.length >= 0.5;
  }

  function descFrom(p) {
    let t = String(p.text || '').replace(/\s+/g, ' ').trim();
    if (p.title && t.startsWith(p.title)) t = t.slice(p.title.length).trim();
    return t.length >= 10 ? t.slice(0, 200) : '';
  }

  // catalog: { works:[], hidden:[] } (관리 페이지), profile: [{url,title,thumb,text}], fallback: 앱 본체가 준 목록
  function merge(catalog, profile, fallback) {
    const cat = (catalog && Array.isArray(catalog.works)) ? catalog.works : [];
    const hidden = new Set(((catalog && catalog.hidden) || []).map(normUrl));
    const prof = (profile || []).filter(p => p && p.url && p.title);
    if (!prof.length) return (fallback && fallback.length ? fallback : cat).filter(w => !(w.url && hidden.has(normUrl(w.url))));
    const used = new Set();
    const out = [];
    const seen = new Set();
    for (const p of prof) {
      const k = normUrl(p.url);
      if (seen.has(k) || hidden.has(k)) continue;
      seen.add(k);
      const c = cat.find(x => !used.has(x) && sameWork(x, p));
      if (c) used.add(c);
      if (c && c.url && hidden.has(normUrl(c.url))) continue;
      out.push(Object.assign({}, c || {}, {
        id: (c && c.id) || idFor(p.url),
        name: (c && c.name) || p.title,
        url: (c && c.url) || p.url,
        thumb: (c && c.thumb) || p.thumb || '',
        desc: (c && c.desc) || descFrom(p),
        fromProfile: true,
        auto: !c
      }));
    }
    for (const c of cat) {
      if (used.has(c) || !c.url) continue;                 // 주소 없는 예전 고정 작품은 뺀다
      if (hidden.has(normUrl(c.url)) || seen.has(normUrl(c.url))) continue;
      out.push(Object.assign({}, c));
    }
    return out;
  }

  const api = { merge, normUrl, normTitle, sameWork, idFor };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionCatalog = api;
})(typeof window !== 'undefined' ? window : globalThis);
