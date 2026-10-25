// 작가 프로필 페이지에서 '이 작가의 작품'만 뽑는다. 앱이 숨은 창에서 실행한다. (화면 엔진과 함께 업데이트됨)
// 1순위: 페이지에 들어 있는 데이터(JSON)에서 작가가 같은 작품 묶음
// 2순위: 화면의 작품 카드 — 추천·인기 같은 구역은 빼고, 같은 작품은 한 번만
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 6; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(600);
  }
  window.scrollTo(0, 0);
  const here = location.href.split('#')[0];
  const hereUrl = new URL(here);
  const normT = (t) => String(t || '').toLowerCase().replace(/[\s\[\](){}<>「」『』【】"'“”‘’!?.,:;~\-_·…♡♥★☆]/g, '');
  const isUrl = (s) => typeof s === 'string' && /^https?:\/\//.test(s);
  const log = [];

  // ---------- 1) 페이지 데이터 ----------
  function sources() {
    const out = [];
    const nd = document.getElementById('__NEXT_DATA__');
    if (nd) { try { out.push(JSON.parse(nd.textContent)); } catch (e) { /* 무시 */ } }
    document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]').forEach((s) => {
      if (s.id === '__NEXT_DATA__') return;
      try { out.push(JSON.parse(s.textContent)); } catch (e) { /* 무시 */ }
    });
    // Next.js 앱 라우터가 흘려보내는 데이터 조각 (줄마다 "번호:JSON")
    try {
      const chunks = (self.__next_f || []).map(x => (Array.isArray(x) && typeof x[1] === 'string') ? x[1] : '').join('');
      for (const line of chunks.split('\n')) {
        const m = /^[0-9a-z]+:(\[|\{)/i.exec(line);
        if (!m) continue;
        try { out.push(JSON.parse(line.slice(line.indexOf(':') + 1))); } catch (e) { /* 조각이 잘린 줄 */ }
      }
    } catch (e) { /* 없음 */ }
    return out;
  }
  const TITLE_KEYS = ['name', 'title', 'storyName', 'characterName', 'displayName'];
  const IMG_KEY = /image|img|thumb|cover|profile|poster|banner/i;
  const ID_KEYS = ['_id', 'id', 'storyId', 'characterId', 'contentId', 'slug'];
  function creatorOf(o) {
    const c = o.creator || o.author || o.user || o.owner || o.writer;
    if (c && typeof c === 'object') return String(c._id || c.id || c.nickname || c.name || c.wrtnUid || '');
    return String(o.creatorId || o.authorId || o.userId || o.ownerId || o.creatorNickname || '');
  }
  function itemOf(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const title = TITLE_KEYS.map(k => o[k]).find(v => typeof v === 'string' && v.trim().length >= 2);
    if (!title) return null;
    let thumb = '';
    for (const [k, v] of Object.entries(o)) {
      if (!IMG_KEY.test(k)) continue;
      if (isUrl(v)) { thumb = v; break; }
      if (v && typeof v === 'object') { const u = Object.values(v).find(isUrl); if (u) { thumb = u; break; } }
    }
    const id = ID_KEYS.map(k => o[k]).find(v => (typeof v === 'string' || typeof v === 'number') && String(v).length >= 4);
    if (!thumb || !id) return null;
    return { id: String(id), title: title.trim(), thumb, creator: creatorOf(o), desc: String(o.description || o.shortDescription || o.summary || '').slice(0, 300) };
  }
  function scan(node, found, depth) {
    if (!node || depth > 14) return;
    if (Array.isArray(node)) {
      const items = node.map(itemOf).filter(Boolean);
      if (items.length >= 1 && items.length >= node.length * 0.6) found.push(items);
      node.forEach(n => scan(n, found, depth + 1));
    } else if (typeof node === 'object') {
      Object.values(node).forEach(n => scan(n, found, depth + 1));
    }
  }
  // 작품 주소: 화면 링크 중 그 작품 id가 들어 있는 것
  const anchors = [...document.querySelectorAll('a[href]')].map(a => { try { return new URL(a.getAttribute('href'), here); } catch (e) { return null; } })
    .filter(u => u && /(^|\.)wrtn\.ai$/.test(u.hostname));
  function urlFor(id) {
    const hit = anchors.find(u => u.pathname.split('/').includes(id));
    if (hit) return hit.origin + hit.pathname.replace(/\/$/, '');
    return '';
  }
  function fromData() {
    const found = [];
    for (const src of sources()) scan(src, found, 0);
    const all = [].concat(...found);
    if (!all.length) return null;
    // 프로필 주인 = 작품 묶음들에서 가장 많이 나온 작가 (추천 작품은 작가가 제각각)
    const count = {};
    all.forEach(i => { if (i.creator) count[i.creator] = (count[i.creator] || 0) + 1; });
    const owner = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    let mine = owner && owner[1] >= 2 ? all.filter(i => i.creator === owner[0]) : (found.sort((a, b) => b.length - a.length)[0] || []);
    const seen = new Set();
    const works = [];
    for (const i of mine) {
      const k = normT(i.title);
      if (!k || seen.has(k) || seen.has(i.id)) continue;
      seen.add(k); seen.add(i.id);
      const url = urlFor(i.id);
      works.push({ url, title: i.title, thumb: i.thumb, text: (i.title + ' ' + i.desc).trim(), id: i.id });
    }
    log.push(`data: 묶음 ${found.length}개, 항목 ${all.length}개, 작가 ${owner ? owner[0] + '×' + owner[1] : '-'}, 고른 것 ${works.length}개, 주소 찾음 ${works.filter(w => w.url).length}개`);
    return works.filter(w => w.url).length ? works.filter(w => w.url) : null;
  }

  // ---------- 2) 화면 카드 ----------
  const SKIP_SECTION = /추천|인기|비슷한|다른\s*(작품|크리에이터|작가)|랭킹|순위|최근\s*본|함께|trending|recommend|popular|best/i;
  const BAD = /^(#|@)|^[\d.,\s]+[kKmM만천억+]?$|^(new|hot|up|무료|유료|성인|19|19\+|좋아요|팔로우|팔로잉|대화|대화하기|플레이|시작|공유|더보기|신고)$/i;
  const goodLine = (l) => l && l.length >= 2 && l.length <= 60 && !BAD.test(l) && !/^[\d.,]+\s*(회|명|개|만|천|k)?$/i.test(l);
  const imgOf = (el) => {
    const ims = [...el.querySelectorAll('img')]
      .map(im => ({ src: im.currentSrc || im.src || '', a: (im.naturalWidth || im.width) * (im.naturalHeight || im.height), alt: (im.alt || '').trim() }))
      .filter(x => /^https?:/.test(x.src) && x.a > 4000).sort((a, b) => b.a - a.a);
    if (ims[0]) return ims[0];
    for (const n of [el, ...el.querySelectorAll('*')].slice(0, 60)) {
      const m = /url\(["']?(https?:[^"')]+)/.exec(getComputedStyle(n).backgroundImage || '');
      if (m) return { src: m[1], a: 0, alt: '' };
    }
    return null;
  };
  function cardOf(a) {
    let el = a;
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (r.width > window.innerWidth * 0.7) break;
      if (imgOf(el) && (el.innerText || '').trim().length >= 2) return el;
    }
    return a;
  }
  function titleOf(card, a, img) {
    const tries = [];
    for (const h of card.querySelectorAll('h1,h2,h3,h4,h5,strong,b,[class*="title" i],[class*="name" i]')) tries.push((h.innerText || '').trim().split('\n')[0]);
    tries.push((a.getAttribute('title') || '').trim(), (a.getAttribute('aria-label') || '').trim());
    for (const l of (card.innerText || '').split('\n')) tries.push(l.trim());
    if (img && img.alt) tries.push(img.alt);
    return (tries.find(goodLine) || '').slice(0, 80);
  }
  // 그 카드 앞에 나온 가장 가까운 제목 (구역 이름)
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"],[class*="section" i] > :first-child')];
  function sectionOf(el) {
    let best = null;
    for (const h of heads) {
      if (h.contains(el) || el.contains(h)) continue;
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = h; else break;
    }
    return best ? (best.innerText || '').trim().slice(0, 40) : '';
  }
  const shapeOf = (u) => u.hostname + '/' + u.pathname.split('/').filter(Boolean).map(s => (/\d/.test(s) || s.length > 10) ? '*' : s).join('/');
  function fromDom() {
    const cands = [];
    const seenUrl = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), here); } catch (e) { continue; }
      if (!/(^|\.)wrtn\.ai$/.test(u.hostname)) continue;
      const key = u.origin + u.pathname.replace(/\/$/, '');
      if (key === hereUrl.origin + hereUrl.pathname.replace(/\/$/, '') || seenUrl.has(key)) continue;
      if (u.pathname.split('/').filter(Boolean).length === 0) continue;
      if (a.closest('nav, header, footer, aside, [role="navigation"]')) continue;
      const sec = sectionOf(a);
      if (SKIP_SECTION.test(sec)) continue;
      const card = cardOf(a);
      const img = imgOf(card);
      if (!img) continue;
      const title = titleOf(card, a, img);
      if (!title) continue;
      seenUrl.add(key);
      cands.push({ url: key, title, thumb: img.src, text: (card.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400), shape: shapeOf(u), sec });
    }
    const count = {};
    cands.forEach(c => { count[c.shape] = (count[c.shape] || 0) + 1; });
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    const seenT = new Set(), seenImg = new Set();
    const works = [];
    for (const c of cands) {
      if (best && best[1] >= 2 && c.shape !== best[0]) continue;
      const t = normT(c.title);
      if (seenT.has(t) || seenImg.has(c.thumb)) continue;      // 같은 작품이 여러 번(캐러셀 복제 등) 나와도 한 번만
      seenT.add(t); seenImg.add(c.thumb);
      works.push({ url: c.url, title: c.title, thumb: c.thumb, text: c.text, sec: c.sec });
    }
    log.push(`dom: 후보 ${cands.length}개, 주소 모양 ${JSON.stringify(count)}, 고른 것 ${works.length}개`);
    return works;
  }

  let works = null, method = 'data';
  try { works = fromData(); } catch (e) { log.push('data 오류: ' + e.message); }
  if (!works || !works.length) { method = 'dom'; works = fromDom(); }
  if (works[0]) { works[0]._method = method; works[0]._log = log.join(' / '); }
  return { page: here, title: document.title, works, method, log };
})();
