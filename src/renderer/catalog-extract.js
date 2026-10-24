// 작가 프로필 페이지에서 작품 목록(제목·주소·썸네일)을 뽑는다. 앱이 숨은 창에서 실행한다.
// 화면 엔진과 함께 업데이트되므로, 크랙 화면이 바뀌면 여기만 고치면 된다.
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // 목록이 아래로 더 불러와지는 경우를 위해 몇 번 내려 본다
  for (let i = 0; i < 8; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    document.querySelectorAll('*').forEach(el => { if (el.scrollHeight > el.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight; });
    await sleep(700);
  }
  const here = location.href;
  const out = new Map();
  const bigImg = (el) => [...el.querySelectorAll('img')]
    .map(im => ({ src: im.currentSrc || im.src || '', a: (im.naturalWidth || im.width) * (im.naturalHeight || im.height), alt: im.alt || '' }))
    .filter(x => /^https?:/.test(x.src) && x.a > 4000)
    .sort((a, b) => b.a - a.a)[0];
  const bgImg = (el) => {
    for (const n of [el, ...el.querySelectorAll('*')].slice(0, 40)) {
      const m = /url\(["']?(https?:[^"')]+)/.exec(getComputedStyle(n).backgroundImage || '');
      if (m) return m[1];
    }
    return '';
  };
  const cards = [...document.querySelectorAll('a[href]')];
  for (const a of cards) {
    let href;
    try { href = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
    if (!/(^|\.)wrtn\.ai$/.test(href.hostname)) continue;
    if (href.href.split('#')[0] === here.split('#')[0]) continue;
    const im = bigImg(a);
    const thumb = (im && im.src) || bgImg(a);
    if (!thumb) continue;
    const lines = (a.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
    // 숫자·조회수 같은 줄을 빼고 첫 번째 그럴듯한 줄을 제목으로
    const title = (lines.find(l => l.length >= 2 && l.length <= 60 && !/^[\d.,\s]+[kKmM만천]?$/.test(l)) || (im && im.alt) || '').slice(0, 80);
    const key = href.origin + href.pathname;
    if (!out.has(key)) out.set(key, { url: key, title, thumb, text: (a.innerText || '').trim().slice(0, 300) });
  }
  return { page: here, title: document.title, works: [...out.values()] };
})();
