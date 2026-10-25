// 작가 프로필 페이지에서 작품 목록(제목·주소·썸네일·소개)을 뽑는다. 앱이 숨은 창에서 실행한다.
// 화면 엔진과 함께 업데이트되므로, 크랙 화면이 바뀌면 여기만 고치면 된다.
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // 목록이 아래로 더 불러와지는 경우를 위해 몇 번 내려 본다
  for (let i = 0; i < 10; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    document.querySelectorAll('*').forEach(el => { if (el.scrollHeight > el.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight; });
    await sleep(600);
  }
  const here = location.href.split('#')[0];
  const hereUrl = new URL(here);

  const imgOf = (el) => {
    const ims = [...el.querySelectorAll('img')]
      .map(im => ({ src: im.currentSrc || im.src || '', a: (im.naturalWidth || im.width) * (im.naturalHeight || im.height), alt: (im.alt || '').trim() }))
      .filter(x => /^https?:/.test(x.src) && x.a > 4000)
      .sort((a, b) => b.a - a.a);
    if (ims[0]) return ims[0];
    for (const n of [el, ...el.querySelectorAll('*')].slice(0, 60)) {
      const m = /url\(["']?(https?:[^"')]+)/.exec(getComputedStyle(n).backgroundImage || '');
      if (m) return { src: m[1], a: 0, alt: '' };
    }
    return null;
  };

  // 제목으로 쓰면 안 되는 줄: 숫자·조회수, 태그, 배지, 버튼 글자
  const BAD = /^(#|@)|^[\d.,\s]+[kKmM만천억+]?$|^(new|hot|up|무료|유료|성인|19|19\+|좋아요|팔로우|팔로잉|대화|대화하기|플레이|시작|공유|더보기|신고)$/i;
  const goodLine = (l) => l && l.length >= 2 && l.length <= 60 && !BAD.test(l) && !/^[\d.,]+\s*(회|명|개|만|천|k)?$/i.test(l);

  // 카드: 링크를 감싼 상자 중 그림과 글자가 다 있는 가장 작은 것
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

  // 주소 모양(작품 페이지끼리는 같은 모양): /detail/abc123 → /detail/*
  const shapeOf = (u) => u.hostname + '/' + u.pathname.split('/').filter(Boolean).map(s => (/\d/.test(s) || s.length > 10) ? '*' : s).join('/');

  const cands = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    let u;
    try { u = new URL(a.getAttribute('href'), here); } catch (e) { continue; }
    if (!/(^|\.)wrtn\.ai$/.test(u.hostname)) continue;
    const key = u.origin + u.pathname.replace(/\/$/, '');
    if (key === hereUrl.origin + hereUrl.pathname.replace(/\/$/, '')) continue;
    if (u.pathname.split('/').filter(Boolean).length === 0) continue;
    if (a.closest('nav, header, footer, aside')) continue;
    const card = cardOf(a);
    const img = imgOf(card);
    if (!img) continue;
    const title = titleOf(card, a, img);
    if (!title) continue;
    const text = (card.innerText || '').replace(/\s+/g, ' ').trim();
    if (!cands.has(key)) cands.set(key, { url: key, title, thumb: img.src, text: text.slice(0, 400), shape: shapeOf(u) });
  }
  // 가장 많이 나온 주소 모양만 작품으로 본다 (메뉴·광고·다른 링크 걸러내기)
  const count = {};
  for (const c of cands.values()) count[c.shape] = (count[c.shape] || 0) + 1;
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  const works = [...cands.values()].filter(c => !best || best[1] < 2 || c.shape === best[0]).map(({ shape, ...c }) => c);
  return { page: here, title: document.title, works, shapes: count };
})();
