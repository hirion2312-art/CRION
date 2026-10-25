// CRION 화면 (0.4) — 홈 · 스토어 · 커뮤니티 · 내 기록 · 설정 / 플레이 = 크랙 화면 그대로
// 예전 공용 게임 화면(응답을 읽어 다시 그리던 화면)은 archive/common-game-ui 에 보관
(function () {
  'use strict';
  const api = window.crion;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => `url('${String(u).replace(/['"\\\n<>]/g, (c) => encodeURIComponent(c))}')`;
  const BOOT_AT = Date.now();

  const svg = (d, w) => `<svg width="${w || 18}" height="${w || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    home: svg('<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>', 19),
    store: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>', 19),
    comm: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>', 19),
    rec: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 19),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>', 19),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 18),
    back: svg('<path d="m15 6-6 6 6 6"/>', 18),
    fwd: svg('<path d="m9 6 6 6-6 6"/>', 18),
    reload: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>', 17),
    page: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>', 17),
    play: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    book: svg('<path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h9"/>', 17),
    flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', 17),
    full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 17),
    music: svg('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>', 17),
    mute: svg('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/><path d="M3 3l18 18"/>', 17),
    x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 18),
    search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>', 16),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 16),
    down: svg('<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>', 16),
    check: svg('<path d="m5 12 5 5 9-10"/>', 16),
    eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 16),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 16),
    menu: svg('<path d="M4 6h16M4 12h16M4 18h16"/>', 18),
    spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>', 18),
    ext: svg('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>', 15)
  };
  const TINTS = ['#e8573a', '#d0457a', '#2f7fd1', '#0f9d76', '#d07a1f', '#7a5bd0', '#b0473a', '#3b8e9e'];
  const tintOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return TINTS[Math.abs(h) % TINTS.length]; };

  // 화면 취향 (이 컴퓨터에만)
  const PREF_DEFAULT = { splash: true, navSmall: false, openMode: 'continue', bgmAuto: true };
  function loadPrefs() { try { return Object.assign({}, PREF_DEFAULT, JSON.parse(localStorage.getItem('crion.prefs') || '{}')); } catch (e) { return Object.assign({}, PREF_DEFAULT); } }
  const P = loadPrefs();
  function savePref(k, v) { P[k] = v; try { localStorage.setItem('crion.prefs', JSON.stringify(P)); } catch (e) { /* 저장 안 됨 */ } }
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 저장 안 됨 */ } };

  const ls = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const store = new window.CrionStore.WorkStore(ls);
  const { fmtTime, ago } = window.CrionStore;
  const PK = window.CrionPacks;
  const installed = new PK.Installed(ls);
  const bgm = window.CrionBgm ? new window.CrionBgm() : null;
  const CM = window.CrionCommunity;

  const S = {
    info: null, settings: null, works: [], creatorUrl: '',
    cat: { links: {}, news: [], report: {} }, notice: null,
    packs: [], packsState: 'loading',
    view: 'home', play: null,
    homeQ: '', storeTab: 'all', storeQ: '', commTab: 'news', form: { kind: 'bug' },
    update: null, diagText: '', waitDiag: false
  };

  // ---------- 공통 ----------
  async function save(patch) { S.settings = await api.setSettings(patch); }
  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('#toast').appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  async function copy(text, msg) { try { await api.copy(text); toast(msg || '복사했어요'); } catch (e) { toast('복사하지 못했어요'); } }
  function thumbInner(w) {
    const ph = `<div class="ph" style="background:linear-gradient(150deg, ${tintOf(w.name)}, #2a1f1c)">${esc((w.name || '?').slice(0, 1))}</div>`;
    return ph + (w.thumb ? `<img src="${esc(w.thumb)}" alt="" loading="lazy" onerror="this.remove()">` : '');
  }
  const workById = (id) => S.works.find(w => w.id === id);
  const regBase = () => { const u = S.info && S.info.registryUrl; return u ? u.replace(/[^/]*$/, '') : ''; };
  const packFor = (w) => PK.forWork(S.packs, w);
  const hasCont = (w) => !!(S.settings.workUrls || {})[w.id];

  // ---------- 작품 목록: 관리 페이지(catalog.json)만 쓴다 ----------
  function setCatalog(c) {
    const hidden = new Set((c.hidden || []).map(u => String(u).replace(/\/$/, '')));
    S.works = (c.works || []).filter(w => w && w.id && w.name && !(w.url && hidden.has(String(w.url).replace(/\/$/, ''))));
    if (c.creatorUrl) S.creatorUrl = c.creatorUrl;
  }
  async function loadCatalog() {
    const b = regBase();
    if (!b) return false;
    try {
      const res = await fetch(b + 'catalog.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return false;
      const c = await res.json();
      const n = c && c.notice;
      S.notice = n && n.on !== false && n.text ? n : null;
      S.cat = { links: (c && c.links) || {}, news: (c && Array.isArray(c.news)) ? c.news : [], report: (c && c.report) || {} };
      if (c && Array.isArray(c.works)) setCatalog(c);
      return true;
    } catch (e) { return false; }
  }
  async function loadShellWorks() {
    try {
      const r = await api.getWorks();
      S.creatorUrl = r.creatorUrl || '';
      // 예전 버전이 프로필에서 자동으로 모은 작품(auto)은 쓰지 않는다
      if (!S.works.length) setCatalog({ works: (r.works || []).filter(w => !w.auto && !w.fromProfile) });
    } catch (e) { /* 본체 목록 없음 */ }
  }
  async function loadPacks() {
    const u = S.info && S.info.registryUrl;
    if (!u) { S.packsState = 'off'; return; }
    try {
      const res = await fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      S.packs = PK.fromIndex(await res.json());
      S.packsState = 'ok';
    } catch (e) { S.packsState = 'err'; }
  }

  // ---------- 왼쪽 메뉴 ----------
  const NAV = [['home', '홈', I.home], ['store', '스토어', I.store], ['community', '커뮤니티', I.comm], ['records', '내 기록', I.rec], ['settings', '설정', I.gear]];
  function navHtml() {
    const upd = S.update;
    const packUpd = S.packs.filter(p => installed.needsUpdate(p)).length;
    return `<nav class="nav ${P.navSmall ? 'small' : ''}">
      <div class="nav-brand"><img class="wordmark" src="logo.png" alt="CRION"><img class="mark" src="icon.png" alt="CRION"></div>
      <div class="nav-list">${NAV.map(([k, l, ic]) => `<button class="nav-i ${S.view === k ? 'on' : ''}" data-act="go" data-v="${k}" data-tut="${k}" title="${l}">${ic}<span>${l}</span>${k === 'store' && packUpd ? `<em>${packUpd}</em>` : ''}${k === 'community' && S.cat.news.length && !newsSeen() ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>
      <div class="nav-foot">
        ${upd ? `<button class="nav-upd" data-act="${upd.type === 'engine' ? 'relaunch' : 'open-link'}" data-url="${esc(upd.url || '')}">${I.spark}<span>${upd.type === 'engine' ? '새 버전 준비됨<small>눌러서 다시 시작</small>' : '새 설치 파일이 나왔어요<small>눌러서 받기</small>'}</span></button>` : ''}
        <button class="nav-i ${S.view === 'login' ? 'on' : ''}" data-act="go" data-v="login" data-tut="login" title="크랙 로그인">${I.user}<span>크랙 로그인</span></button>
        <button class="nav-fold" data-act="nav-fold" title="${P.navSmall ? '메뉴 펼치기' : '메뉴 접기'}">${P.navSmall ? I.fwd : I.back}<span>메뉴 접기</span></button>
      </div>
    </nav>`;
  }
  const newsKey = () => 'crion.newsSeen';
  function newsSeen() { const top = (S.cat.news || []).map(n => n.date + n.title).sort().pop() || ''; return lsGet(newsKey()) === top; }
  function markNewsSeen() { const top = (S.cat.news || []).map(n => n.date + n.title).sort().pop() || ''; lsSet(newsKey(), top); }

  function pageHead(title, sub, right) {
    return `<div class="page-h"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right ? `<div class="page-h-r">${right}</div>` : ''}</div>`;
  }

  // ---------- 홈 ----------
  const noticeId = (n) => 'crion.notice.' + String(n.id || n.text).slice(0, 80);
  function noticeHtml() {
    const n = S.notice;
    if (!n || lsGet(noticeId(n))) return '';
    return `<div class="notice"><b>공지</b><span>${esc(n.text)}</span>
      ${n.link && /^https:\/\//.test(n.link) ? `<button class="btn sm" data-act="open-link" data-url="${esc(n.link)}">자세히</button>` : ''}
      <button class="icon-btn sm" data-act="close-notice" title="닫기">${I.x}</button></div>`;
  }
  function featuredWork() {
    return S.works.find(w => w.featured && w.url) || (S.settings.recent || []).map(workById).find(w => w && w.url) || S.works.find(w => w.thumb && w.url) || S.works[0] || null;
  }
  function playBtns(w, big) {
    if (!w.url) return `<button class="btn ${big ? 'big' : ''}" disabled>준비 중</button>`;
    const c = hasCont(w);
    return `<button class="btn primary ${big ? 'big' : ''}" data-act="play" data-id="${esc(w.id)}">${I.play}${c && P.openMode === 'continue' ? '이어하기' : '플레이'}</button>`
      + (c ? `<button class="btn ${big ? 'big glass' : ''}" data-act="play-fresh" data-id="${esc(w.id)}" title="작품 페이지부터 열기">처음 화면</button>` : '');
  }
  function heroHtml() {
    const w = featuredWork();
    if (!w) return '';
    const rec = store.get(w.id);
    return `<section class="hero">
      <div class="hero-bg" ${w.thumb ? `style="background-image:${cssUrl(w.thumb)}"` : ''}></div>
      <div class="hero-in">
        <button class="hero-poster" data-act="info" data-id="${esc(w.id)}">${thumbInner(w)}</button>
        <div class="hero-text">
          <span class="eyebrow">${w.featured ? '추천 작품' : rec.lastAt ? '최근 플레이' : '오늘의 작품'}</span>
          <h2>${esc(w.name)}</h2>
          ${w.genre ? `<p class="genre">${esc(w.genre)}</p>` : ''}
          ${w.desc ? `<p class="desc">${esc(w.desc)}</p>` : ''}
          <div class="hero-btns">${playBtns(w, true)}<button class="btn big glass" data-act="info" data-id="${esc(w.id)}">${I.info}작품 정보</button></div>
          ${rec.lastAt ? `<p class="hero-meta">마지막 플레이 ${ago(rec.lastAt)}${rec.playMs > 60000 ? ' · 함께한 시간 ' + fmtTime(rec.playMs) : ''}</p>` : ''}
        </div>
      </div>
    </section>`;
  }
  function cardHtml(w) {
    const rec = store.get(w.id);
    const pk = packFor(w);
    const sub = !w.url ? '준비 중' : rec.lastAt ? `${ago(rec.lastAt)} 플레이` : (w.genre || '');
    return `<div class="card ${w.url ? '' : 'off'}">
      <button class="thumb" data-act="${w.url ? 'play' : 'info'}" data-id="${esc(w.id)}" title="${esc(w.name)}">${thumbInner(w)}
        ${w.featured ? '<span class="tag hot">추천</span>' : ''}
        ${pk ? `<span class="tag pack">${installed.has(pk.id) ? '전용 화면' : '플레이팩'}</span>` : ''}
        ${w.url ? `<span class="play">${I.play}${hasCont(w) && P.openMode === 'continue' ? '이어하기' : '플레이'}</span>` : ''}
      </button>
      <div class="meta"><button class="name" data-act="info" data-id="${esc(w.id)}">${esc(w.name)}</button><span>${esc(sub)}</span></div>
      <button class="info-btn" data-act="info" data-id="${esc(w.id)}" title="작품 정보">${I.info}</button>
    </div>`;
  }
  function gridHtml() {
    const q = S.homeQ.trim().toLowerCase();
    const list = q ? S.works.filter(w => [w.name, w.genre, w.desc].join(' ').toLowerCase().includes(q)) : S.works;
    if (!S.works.length) return `<div class="empty"><b>작품 목록을 불러오는 중이에요</b><span>인터넷 연결을 확인해 주세요. 계속 비어 있으면 커뮤니티에서 알려 주세요.</span></div>`;
    if (!list.length) return `<div class="empty"><b>“${esc(S.homeQ)}” 작품이 없어요</b><span>다른 말로 찾아보세요.</span></div>`;
    return `<div class="grid">${list.map(cardHtml).join('')}</div>`;
  }
  function homeHtml() {
    const recent = (S.settings.recent || []).map(workById).filter(w => w && w.url).slice(0, 4);
    const cont = recent.length ? `<div class="section-h"><h2>이어하기</h2><span class="sub">마지막으로 보던 대화로 바로 열려요</span></div>
      <div class="continue">${recent.map(w => {
        const rec = store.get(w.id);
        return `<button class="cont" data-act="play" data-id="${esc(w.id)}"><div class="mini">${thumbInner(w)}</div>
          <div><b>${esc(w.name)}</b><span>${[rec.lastAt ? ago(rec.lastAt) : '', rec.playMs > 60000 ? fmtTime(rec.playMs) : '', hasCont(w) ? '마지막 대화로 바로' : '작품 페이지부터'].filter(Boolean).join(' · ')}</span></div><span class="go">${I.play}</span></button>`;
      }).join('')}</div>` : '';
    const first = !S.settings.onboarded ? `<div class="start-card">
        <div class="steps"><div><i>1</i><b>크랙 로그인</b><span>한 번만 하면 계속 유지돼요</span></div><div><i>2</i><b>작품 고르기</b><span>크랙 화면 그대로 열려요</span></div><div><i>3</i><b>이어하기</b><span>보던 대화를 기억해 둬요</span></div></div>
        <button class="btn primary" data-act="go" data-v="login">${I.user}크랙 로그인하기</button></div>` : '';
    return `<main class="page"><div class="page-in">
      ${noticeHtml()}${first}${heroHtml()}${cont}
      <div class="section-h"><h2>전체 작품</h2><span class="sub">${S.works.length}개</span>
        <label class="search right">${I.search}<input id="homeQ" placeholder="작품 찾기" value="${esc(S.homeQ)}"></label></div>
      <div id="homeGrid">${gridHtml()}</div>
    </div></main>`;
  }

  // ---------- 작품 정보 ----------
  function mdLite(t) {
    const inline = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    let html = '', list = false;
    for (const raw of String(t || '').split('\n')) {
      const l = raw.trim();
      const li = /^[-*•]\s+(.*)$/.exec(l);
      if (li) { if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(li[1])}</li>`; continue; }
      if (list) { html += '</ul>'; list = false; }
      const h = /^(#{1,3})\s+(.*)$/.exec(l);
      if (h) html += `<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`;
      else if (l) html += `<p>${inline(l)}</p>`;
    }
    return html + (list ? '</ul>' : '');
  }
  function openInfo(id) {
    const w = workById(id);
    if (!w) return;
    const rec = store.get(w.id);
    const pk = packFor(w);
    modal(`<div class="info-head"><div class="hero-bg" ${w.thumb ? `style="background-image:${cssUrl(w.thumb)}"` : ''}></div>
        <div class="info-head-in"><div class="info-poster">${thumbInner(w)}</div><div><h3>${esc(w.name)}</h3>${w.genre ? `<span>${esc(w.genre)}</span>` : ''}
          <div class="hero-btns">${playBtns(w, false)}</div></div></div>
        <button class="icon-btn close-x" data-act="close-modal">${I.x}</button></div>
      <div class="body">
        ${w.desc ? `<p class="lead">${esc(w.desc)}</p>` : ''}
        <dl class="kv">
          <dt>플레이 방식</dt><dd>${pk ? `전용 플레이팩 있음 · <button class="link" data-act="pack" data-id="${esc(pk.id)}">스토어에서 보기</button>` : '크랙 화면 그대로 (전용 플레이팩 준비 전)'}</dd>
          <dt>내 기록</dt><dd>${rec.lastAt ? `${rec.opens || 1}번 열어 봄 · ${fmtTime(rec.playMs)} · 마지막 ${ago(rec.lastAt)}` : '아직 플레이 전'}</dd>
          ${hasCont(w) ? `<dt>이어하기</dt><dd>마지막 대화 기억 중 · <button class="link" data-act="forget-cont" data-id="${esc(w.id)}">잊기</button></dd>` : ''}
        </dl>
        ${w.guide ? `<h4 class="sub-h">공략</h4><div class="guide">${mdLite(w.guide)}</div>` : ''}
      </div>`, true);
  }

  // ---------- 스토어 ----------
  function packCard(p) {
    const w = (p.workId && workById(p.workId)) || S.works.find(x => p.workUrl && x.url && PK.forWork([p], x));
    const st = installed.needsUpdate(p) ? ['update', '업데이트'] : installed.has(p.id) ? ['on', '설치됨'] : ['', '받기'];
    return `<div class="pcard">
      <button class="pcover" data-act="pack" data-id="${esc(p.id)}">${p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : `<div class="ph" style="background:linear-gradient(150deg, ${tintOf(p.name)}, #2a1f1c)">${esc(p.name.slice(0, 1))}</div>`}</button>
      <div class="pmeta"><button class="name" data-act="pack" data-id="${esc(p.id)}">${esc(p.name)}</button>
        <span>${esc(w ? w.name : p.summary)}</span>
        <div class="ptags">${p.tags.map(t => `<i>${esc(t)}</i>`).join('')}</div></div>
      <button class="btn sm ${st[0] === 'on' ? '' : 'primary'}" data-act="${st[0] === 'on' ? 'pack' : 'pack-install'}" data-id="${esc(p.id)}">${st[0] === 'on' ? I.check : I.down}${st[1]}</button>
    </div>`;
  }
  function storeHtml() {
    const list = PK.filter(S.packs, { tab: S.storeTab, q: S.storeQ }, installed);
    const nInst = S.packs.filter(p => installed.has(p.id)).length;
    const nUpd = S.packs.filter(p => installed.needsUpdate(p)).length;
    const tabs = [['all', `전체 ${S.packs.length}`], ['installed', `설치됨 ${nInst}`], ['update', `업데이트 ${nUpd}`]];
    let body;
    if (S.packsState === 'loading') body = '<div class="empty"><span class="spin"></span><b>스토어를 여는 중이에요</b></div>';
    else if (S.packsState === 'err' || S.packsState === 'off') body = '<div class="empty"><b>스토어에 연결하지 못했어요</b><span>인터넷 연결을 확인하고 다시 눌러 주세요.</span><button class="btn" data-act="store-reload">다시 시도</button></div>';
    else if (!S.packs.length) body = `<div class="empty big">
        <div class="empty-art" aria-hidden="true"><i></i><i></i><i></i></div>
        <b>첫 플레이팩 준비 중</b>
        <span>작품마다 어울리는 전용 화면을 만들고 있어요. 준비되면 여기에 올라오고, 커뮤니티 소식으로도 알려 드릴게요.<br>그동안 모든 작품은 크랙 화면 그대로 플레이할 수 있어요.</span>
        <div class="row"><button class="btn primary" data-act="go" data-v="home">${I.play}작품 플레이하러 가기</button><button class="btn" data-act="go" data-v="community">소식 보기</button></div></div>`;
    else if (!list.length) body = `<div class="empty"><b>${S.storeTab === 'installed' ? '설치한 플레이팩이 없어요' : S.storeTab === 'update' ? '모두 최신이에요' : '찾는 플레이팩이 없어요'}</b></div>`;
    else body = `<div class="pgrid">${list.map(packCard).join('')}</div>`;
    return `<main class="page"><div class="page-in">
      ${pageHead('스토어', '작품 전용 플레이 화면(플레이팩)을 둘러보고 받을 수 있어요.', `<label class="search">${I.search}<input id="storeQ" placeholder="플레이팩 찾기" value="${esc(S.storeQ)}"></label>`)}
      <div class="explain">
        <div><i>${I.store}</i><b>플레이팩이란?</b><span>작품에 맞춘 상태창·대사창·연출이 들어 있는 전용 화면이에요.</span></div>
        <div><i>${I.eye}</i><b>미리 보고 받기</b><span>받기 전에 화면 미리보기로 어떻게 생겼는지 볼 수 있어요.</span></div>
        <div><i>${I.reload}</i><b>언제든 되돌리기</b><span>지우면 그 작품은 다시 크랙 화면 그대로 열려요.</span></div>
      </div>
      <nav class="tabs">${tabs.map(([k, l]) => `<button class="${S.storeTab === k ? 'on' : ''}" data-act="store-tab" data-v="${k}">${l}</button>`).join('')}</nav>
      ${body}
    </div></main>`;
  }
  function openPack(id) {
    const p = S.packs.find(x => x.id === id);
    if (!p) return;
    const w = (p.workId && workById(p.workId)) || S.works.find(x => PK.forWork([p], x));
    const ok = PK.compatible(p, S.info.engineVersion);
    const inst = installed.has(p.id);
    const btn = !ok ? '<button class="btn big" disabled>앱 업데이트 후 받을 수 있어요</button>'
      : installed.needsUpdate(p) ? `<button class="btn primary big" data-act="pack-install" data-id="${esc(p.id)}">${I.down}업데이트</button>`
        : inst ? `<button class="btn big" data-act="pack-remove" data-id="${esc(p.id)}">${I.trash}지우기</button>`
          : `<button class="btn primary big" data-act="pack-install" data-id="${esc(p.id)}">${I.down}받기</button>`;
    modal(`<div class="pack-head">${p.cover ? `<img src="${esc(p.cover)}" alt="">` : ''}<button class="icon-btn close-x" data-act="close-modal">${I.x}</button></div>
      <div class="body">
        <div class="pack-title"><div><h3>${esc(p.name)}</h3><span>${esc(p.author)} · v${esc(p.version)}${p.bytes ? ' · ' + (p.bytes / 1048576).toFixed(1) + 'MB' : ''}${w ? ' · ' + esc(w.name) : ''}</span></div>
          <div class="row">${p.ui ? `<button class="btn big" data-act="pack-preview" data-id="${esc(p.id)}">${I.eye}화면 미리보기</button>` : ''}${btn}</div></div>
        ${p.previews.length ? `<div class="shots">${p.previews.map(s => `<button data-act="view-img" data-src="${esc(s)}"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
        ${p.summary ? `<p class="lead">${esc(p.summary)}</p>` : ''}
        ${p.desc ? `<div class="guide">${mdLite(p.desc)}</div>` : ''}
        ${w && w.url ? `<div class="row end"><button class="btn" data-act="play" data-id="${esc(w.id)}">${I.play}이 작품 플레이</button></div>` : ''}
      </div>`, true);
  }
  function openPackPreview(id) {
    const p = S.packs.find(x => x.id === id);
    if (!p || !p.ui) return;
    modal(`<header><h3>${esc(p.name)} · 화면 미리보기</h3><span class="muted sm">예시 장면이에요. 실제 대화는 보내지지 않아요.</span><button class="icon-btn" data-act="close-modal">${I.x}</button></header>
      <div class="preview-frame"><iframe src="${esc(p.ui)}${p.ui.includes('?') ? '&' : '?'}preview=1" sandbox="allow-scripts" referrerpolicy="no-referrer" title="미리보기"></iframe></div>`, 'xl');
  }

  // ---------- 커뮤니티 ----------
  function sentHistory() { try { return JSON.parse(lsGet('crion.sent') || '[]'); } catch (e) { return []; } }
  function pushSent(item) { lsSet('crion.sent', JSON.stringify(sentHistory().concat(item).slice(-50))); }
  const hookFor = (kind) => { const r = S.cat.report || {}; return (r.webhooks && r.webhooks[kind]) || r.webhook || ''; };
  function formHtml(kind, opt) {
    opt = opt || {};
    const works = S.works.map(w => `<option ${opt.work === w.name ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
    const workSel = (req) => `<label class="f"><span>작품${req ? '' : ' (선택)'}</span><select id="fWork" class="field">${req ? '' : '<option value="">작품과 상관없음</option>'}${works}</select></label>`;
    const nick = `<label class="f"><span>닉네임 (선택 · 답장이나 공략 출처 표시용)</span><input id="fNick" class="field" maxlength="30" value="${esc(lsGet('crion.nick') || '')}"></label>`;
    let body = '';
    if (kind === 'bug') {
      body = `${workSel(false)}
        <label class="f"><span>무슨 문제가 있었나요?</span><textarea id="fBody" class="field" rows="4" placeholder="예) 작품이 안 열려요 / 이어하기가 다른 대화로 가요"></textarea></label>
        <label class="f"><span>어떻게 하다가 생겼나요? (선택)</span><input id="fSteps" class="field" placeholder="예) 작품 열고 바로"></label>
        ${opt.diag ? '<label class="chk"><input type="checkbox" id="fDiag" checked> 지금 화면 정보 첨부 (주소·화면 크기만 들어가요)</label>' : ''}`;
    } else if (kind === 'idea') {
      body = `<label class="f"><span>한 줄 요약</span><input id="fTitle" class="field" maxlength="80" placeholder="예) 이런 플레이팩이 있으면 좋겠어요"></label>
        <label class="f"><span>자세히</span><textarea id="fBody" class="field" rows="5"></textarea></label>${workSel(false)}`;
    } else {
      body = `${workSel(true)}<label class="f"><span>공략·팁</span><textarea id="fBody" class="field" rows="5" placeholder="다른 플레이어에게 도움이 될 팁을 적어 주세요. 좋은 공략은 작품 공략에 실려요."></textarea></label>`;
    }
    const ready = CM.isWebhook(hookFor(kind));
    return `<div class="form" data-kind="${kind}">${body}${nick}
      <div class="form-foot">${ready ? '<span class="muted">히리온에게 바로 전달돼요</span>' : '<span class="muted warn-text">받을 곳이 아직 준비 중이에요. 버튼을 누르면 내용이 복사돼요.</span>'}
        <button class="btn primary" data-act="form-send" data-kind="${kind}">${ready ? '보내기' : '내용 복사'}</button></div></div>`;
  }
  function communityHtml() {
    const L = S.cat.links || {};
    const links = [
      L.discord && ['디스코드', '플레이어들과 이야기하고 소식 받기', L.discord],
      L.openchat && ['오픈채팅', '카카오톡 오픈채팅방', L.openchat],
      ...((L.other || []).map(o => o && o.url && [o.label || '바로가기', o.desc || '', o.url]))
    ].filter(Boolean);
    const news = (S.cat.news || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const hist = sentHistory().slice().reverse().slice(0, 20);
    const tabs = [['news', '소식'], ['links', '커뮤니티'], ['send', '신고 · 건의 · 공략'], ['sent', `보낸 것 ${hist.length || ''}`]];
    let body = '';
    if (S.commTab === 'news') {
      body = (S.notice ? `<div class="news hot"><b>공지</b><p>${esc(S.notice.text)}</p></div>` : '')
        + (news.length ? news.map(n => `<article class="news"><div class="news-h"><b>${esc(n.title || '')}</b><span>${esc(n.date || '')}</span></div>
            ${n.text ? `<p>${esc(n.text)}</p>` : ''}${n.link && /^https:\/\//.test(n.link) ? `<button class="link" data-act="open-link" data-url="${esc(n.link)}">자세히 보기 →</button>` : ''}</article>`).join('')
          : (!S.notice ? '<div class="empty"><b>아직 소식이 없어요</b><span>새 작품, 플레이팩, 업데이트 소식이 여기에 올라와요.</span></div>' : ''));
    } else if (S.commTab === 'links') {
      body = links.length ? `<div class="links">${links.map(([t, d, u]) => `<button class="link-card" data-act="open-link" data-url="${esc(u)}"><b>${esc(t)}</b><span>${esc(d)}</span><i>${I.ext}</i></button>`).join('')}</div>`
        : '<div class="empty"><b>커뮤니티가 곧 열려요</b><span>디스코드·오픈채팅이 생기면 여기에서 바로 들어갈 수 있어요.</span></div>';
    } else if (S.commTab === 'send') {
      const kinds = [['bug', '오류 신고'], ['idea', '건의'], ['tip', '공략 제보']];
      body = `<div class="send-box"><div class="seg">${kinds.map(([k, l]) => `<button class="${S.form.kind === k ? 'on' : ''}" data-act="form-kind" data-kind="${k}">${l}</button>`).join('')}</div>
        ${formHtml(S.form.kind, {})}</div>`;
    } else {
      body = hist.length ? `<div class="hist">${hist.map(h => `<div><b>${esc((CM.KINDS[h.kind] || {}).label || '')}</b><span>${esc(h.title || '')}</span><small>${ago(h.at)}${h.copied ? ' · 복사만 함' : ''}</small></div>`).join('')}</div>`
        : '<div class="empty"><b>아직 보낸 것이 없어요</b></div>';
    }
    return `<main class="page"><div class="page-in narrow">
      ${pageHead('커뮤니티', '소식을 보고, 문제나 의견을 히리온에게 바로 보낼 수 있어요.')}
      <nav class="tabs">${tabs.map(([k, l]) => `<button class="${S.commTab === k ? 'on' : ''}" data-act="comm-tab" data-v="${k}">${l}</button>`).join('')}</nav>
      <div class="tab-body">${body}</div>
    </div></main>`;
  }
  async function sendForm(kind) {
    const v = (id) => { const el = $('#' + id); return el ? el.value.trim() : ''; };
    const f = { work: v('fWork'), title: v('fTitle'), body: v('fBody'), steps: v('fSteps'), nick: v('fNick') };
    if (!f.body) { toast('내용을 적어 주세요'); return; }
    if (kind === 'bug' && !f.title) f.title = f.body.split('\n')[0].slice(0, 60);
    if (kind === 'tip' && !f.title) f.title = (f.work ? f.work + ' 공략: ' : '') + f.body.slice(0, 40);
    lsSet('crion.nick', f.nick);
    const ctx = { app: S.info.version, engine: S.info.engineVersion, os: S.info.platform };
    const hook = hookFor(kind);
    if (!CM.isWebhook(hook)) {
      copy(CM.asText(kind, f, ctx), '내용을 복사했어요. 커뮤니티나 히리온에게 붙여서 보내 주세요');
      pushSent({ kind, title: f.title, work: f.work, at: Date.now(), copied: true });
      return finishForm();
    }
    const lim = CM.allowed(sentHistory());
    if (!lim.ok) { toast(lim.why); return; }
    const attach = ($('#fDiag') && $('#fDiag').checked && S.diagText) ? { text: S.diagText, name: 'crion-diag.txt' } : null;
    const btn = document.querySelector('[data-act=form-send]');
    if (btn) { btn.disabled = true; btn.textContent = '보내는 중…'; }
    try {
      await CM.send(hook, CM.buildPayload(kind, f, ctx), attach);
      pushSent({ kind, title: f.title, work: f.work, at: Date.now() });
      toast('보냈어요. 고마워요!');
      finishForm();
    } catch (e) {
      toast('보내지 못했어요. 인터넷 연결을 확인해 주세요');
      if (btn) { btn.disabled = false; btn.textContent = '보내기'; }
    }
  }
  function finishForm() { if ($('#layer').innerHTML) closeModal(); if (S.view === 'community') render(); }

  // ---------- 내 기록 ----------
  function recordsHtml() {
    const ids = S.works.map(w => w.id);
    const t = store.totals(ids);
    const list = S.works.map(w => ({ w, r: store.get(w.id) })).filter(x => x.r.lastAt || x.r.playMs).sort((a, b) => b.r.lastAt - a.r.lastAt);
    const stats = [['플레이한 작품', t.played + '개'], ['함께한 시간', fmtTime(t.playMs)], ['작품을 연 횟수', (t.opens || 0) + '번'], ['플레이팩', S.packs.filter(p => installed.has(p.id)).length + '개']];
    return `<main class="page"><div class="page-in narrow">
      ${pageHead('내 기록', '이 컴퓨터에서 플레이한 기록이에요.')}
      <div class="stats">${stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="section-h"><h2>작품별</h2></div>
      ${list.length ? `<div class="rec-list">${list.map(({ w, r }) => `<div class="rec">
          <div class="mini">${thumbInner(w)}</div>
          <div class="rec-t"><b>${esc(w.name)}</b><span>마지막 ${ago(r.lastAt)} · ${fmtTime(r.playMs)} · ${r.opens || 1}번${hasCont(w) ? ' · 이어하기 가능' : ''}</span>
            <div class="bar"><i style="width:${t.playMs ? Math.max(3, Math.round(r.playMs / t.playMs * 100)) : 0}%"></i></div></div>
          <div class="row">${playBtns(w, false)}</div></div>`).join('')}</div>`
        : '<div class="empty"><b>아직 기록이 없어요</b><span>작품을 플레이하면 시간과 이어하기 정보가 여기에 쌓여요.</span><button class="btn primary" data-act="go" data-v="home">작품 보러 가기</button></div>'}
      <p class="muted note-line">기록은 이 컴퓨터에만 저장돼요. 나중에 CRION 계정이 생기면 다른 기기에서도 이어지게 할 예정이에요.</p>
    </div></main>`;
  }

  // ---------- 설정 ----------
  const pseg = (key, opts) => `<span class="seg">${opts.map(([v, l]) => `<button data-act="pref" data-k="${key}" data-v="${v}" class="${String(P[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
  const seg = (key, opts) => `<span class="seg">${opts.map(([v, l]) => `<button data-act="set" data-k="${key}" data-v="${v}" class="${String(S.settings[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
  const row = (title, sub, ctrl) => `<div class="set"><div class="lbl"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div><div class="ctrl">${ctrl}</div></div>`;
  function settingsHtml() {
    const i = S.info;
    const vol = S.settings.volume == null ? 60 : S.settings.volume;
    const nCont = Object.keys(S.settings.workUrls || {}).length;
    return `<main class="page"><div class="page-in narrow">
      ${pageHead('설정', '')}
      <section class="set-group"><h3>플레이</h3>
        ${row('작품을 열 때', '이어하기: 마지막으로 보던 대화로 · 처음 화면: 항상 작품 페이지부터', pseg('openMode', [['continue', '이어하기'], ['page', '처음 화면']]))}
        ${row('배경 음악', '작품에 음악이 있으면 플레이할 때 틀어 줘요', pseg('bgmAuto', [[true, '켜기'], [false, '끄기']]))}
        ${row('음량', '', `<input type="range" min="0" max="100" step="5" value="${vol}" id="vol"><output id="volOut">${vol}</output>`)}
        ${row('이어하기 기억', nCont ? `${nCont}개 작품의 마지막 대화를 기억하고 있어요` : '아직 기억한 대화가 없어요', `<button class="btn sm" data-act="forget-all" ${nCont ? '' : 'disabled'}>모두 잊기</button>`)}
      </section>
      <section class="set-group"><h3>화면</h3>
        ${row('시작 애니메이션', '앱을 켤 때 로고 화면', pseg('splash', [[true, '켜기'], [false, '끄기']]))}
        ${row('왼쪽 메뉴', '', pseg('navSmall', [[false, '넓게'], [true, '아이콘만']]))}
      </section>
      <section class="set-group"><h3>크랙 계정</h3>
        ${row('크랙 로그인', '한 번 로그인하면 모든 작품에서 유지돼요', `<button class="btn sm" data-act="go" data-v="login">${I.user}로그인 화면 열기</button>`)}
      </section>
      <section class="set-group"><h3>업데이트</h3>
        ${row('자동 업데이트', '새 화면·작품 목록을 알아서 받아요', seg('autoUpdate', [['true', '켜기'], ['false', '끄기']]))}
        ${row('버전', `앱 ${esc(i.version)} · 화면 ${esc(i.engineVersion)}${i.engineSource === 'update' ? ' (업데이트됨)' : ''}`, `<button class="btn sm" data-act="check-update">지금 확인</button>${S.update && S.update.type === 'engine' ? '<button class="btn sm primary" data-act="relaunch">다시 시작해서 적용</button>' : ''}`)}
      </section>
      <section class="set-group"><h3>도움말</h3>
        ${row('사용법 다시 보기', '처음 켰을 때 나온 안내', '<button class="btn sm" data-act="tutorial">사용법 보기</button>')}
        ${row('문제가 있나요?', '커뮤니티에서 바로 신고할 수 있어요', '<button class="btn sm" data-act="go-report">오류 신고</button>')}
        ${row('데이터 폴더', '설정·업데이트 파일이 있는 곳', '<button class="btn sm ghost" data-act="open-folder">열기</button>')}
      </section>
      <p class="muted note-line">CRION · 히리온의 크랙 작품 플레이어</p>
    </div></main>`;
  }

  // ---------- 크랙 로그인 ----------
  function loginHtml() {
    return `<main class="page flush"><div class="login">
      <div class="hint">${I.user}<div><b>크랙 로그인</b><span>여기서 한 번 로그인해 두면 모든 작품에서 계속 로그인돼 있어요.</span></div>
        <button class="btn primary" data-act="login-done">로그인 완료</button></div>
      <webview id="crack" src="${esc(S.info.crackOrigin)}" partition="persist:crack" allowpopups></webview></div></main>`;
  }

  // ---------- 플레이 = 크랙 화면 그대로 ----------
  function playHtml() {
    const p = S.play;
    const w = p.work;
    return `<div class="play" id="play">
      <header class="pbar">
        <button class="btn ghost" data-act="leave">${I.back}나가기</button>
        <div class="pwork"><div class="mini">${thumbInner(w)}</div><b>${esc(w.name)}</b><span class="badge">크랙 화면</span></div>
        <div class="ptools">
          <button class="icon-btn" data-act="wv-back" title="뒤로">${I.back}</button>
          <button class="icon-btn" data-act="wv-reload" title="새로고침">${I.reload}</button>
          <button class="icon-btn" data-act="wv-page" title="작품 페이지로">${I.page}</button>
          <span class="sep"></span>
          ${w.guide ? `<button class="icon-btn ${p.guide ? 'on' : ''}" data-act="guide" title="공략">${I.book}</button>` : ''}
          ${w.bgm && bgm ? `<button class="icon-btn" data-act="music" id="musicBtn" title="배경 음악">${bgm.paused || !bgm.src ? I.mute : I.music}</button>` : ''}
          <button class="icon-btn" data-act="report" title="문제 신고">${I.flag}</button>
          <button class="icon-btn" data-act="fullscreen" title="전체 화면 (F11)">${I.full}</button>
        </div>
        <div class="pload" id="pload"><i></i></div>
      </header>
      <div class="pbody">
        <div class="pview">
          <webview id="crack" src="${esc(p.url)}" partition="persist:crack" allowpopups></webview>
          <div class="pwait" id="pwait"><img src="icon.png" alt=""><b>크랙 화면을 여는 중이에요</b><span>${esc(w.name)}</span></div>
        </div>
        ${w.guide ? `<aside class="pguide ${p.guide ? '' : 'hidden'}" id="pguide"><div class="pguide-h"><b>공략</b><button class="icon-btn sm" data-act="guide">${I.x}</button></div><div class="guide">${mdLite(w.guide)}</div></aside>` : ''}
      </div>
    </div>`;
  }
  function openWork(id, fresh) {
    const w = workById(id);
    if (!w || !w.url) return;
    closeModal();
    const saved = (S.settings.workUrls || {})[w.id];
    const useSaved = !fresh && saved && P.openMode === 'continue';
    S.play = { work: w, url: useSaved ? saved : w.url, guide: false, startedAt: Date.now() };
    S.view = 'play';
    store.recordOpen(w.id);
    save({ recent: [w.id].concat((S.settings.recent || []).filter(x => x !== w.id)).slice(0, 8) });
    render();
    if (w.bgm && bgm && P.bgmAuto) { bgm.setVolume((S.settings.volume == null ? 60 : S.settings.volume) / 100); bgm.play(w.bgm); setTimeout(updMusicBtn, 50); }
  }
  function updMusicBtn() { const b = $('#musicBtn'); if (b) b.innerHTML = bgm.paused || !bgm.src ? I.mute : I.music; }
  function leavePlay() {
    if (bgm) bgm.stop();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    S.play = null;
    go('home');
  }
  const wv = () => $('#crack');
  function bindWebview() {
    const v = wv();
    if (!v) return;
    const bar = $('#pload'), cover = $('#pwait');
    v.addEventListener('did-start-loading', () => { if (bar) bar.classList.add('on'); });
    v.addEventListener('did-stop-loading', () => { if (bar) bar.classList.remove('on'); if (cover) cover.classList.add('gone'); });
    v.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3 || !e.isMainFrame) return;
      if (cover) { cover.classList.remove('gone'); cover.innerHTML = `<img src="icon.png" alt=""><b>크랙에 연결하지 못했어요</b><span>인터넷 연결을 확인해 주세요.</span><button class="btn primary" data-act="wv-reload">다시 시도</button>`; }
    });
    v.addEventListener('ipc-message', (e) => {
      const d = e.args && e.args[0];
      if (e.channel === 'crion:url' && d && S.play) {
        S.play.cur = d.url;
        // 대화 화면이 열렸을 때만 이어하기 주소로 기억 (작품 소개·로그인 화면은 기억하지 않는다)
        if (d.chat && d.url && (S.settings.workUrls || {})[S.play.work.id] !== d.url) save({ workUrls: Object.assign({}, S.settings.workUrls, { [S.play.work.id]: d.url }) });
      } else if (e.channel === 'crion:diag' && d) {
        const t = ['[CRION 화면 진단]', `앱 ${S.info.version} / 화면 ${S.info.engineVersion} / ${S.info.platform}`, `작품: ${S.play ? S.play.work.name : '-'}`,
          `주소: ${d.url}`, `제목: ${d.title}`, `대화 화면: ${d.chat ? '예' : '아니오'}`, `크기: ${d.size}`, '입력칸: ' + (d.inputs || []).join(' / ')].join('\n');
        if (S.waitDiag) { S.waitDiag = false; S.diagText = t; } else copy(t, '화면 진단을 복사했어요');
      }
    });
  }
  function openReport() {
    S.diagText = '';
    const v = wv();
    if (v && S.view === 'play') { S.waitDiag = true; try { v.send('crion:diag'); } catch (e) { /* 아직 안 열림 */ } }
    modal(`<header><h3>문제 신고</h3><button class="icon-btn" data-act="close-modal">${I.x}</button></header>
      <div class="body">${formHtml('bug', { work: S.play && S.play.work.name, diag: S.view === 'play' })}</div>`);
  }

  // ---------- 모달 ----------
  function modal(html, size) {
    $('#layer').innerHTML = `<div class="scrim" data-act="close-modal"><div class="modal ${size === true ? 'wide' : size || ''}" role="dialog">${html}</div></div>`;
  }
  const closeModal = () => { $('#layer').innerHTML = ''; };

  // ---------- 처음 사용법 (튜토리얼) ----------
  const TUT = [
    { k: 'home', t: 'CRION에 오신 걸 환영해요', d: '히리온의 크랙 작품을 한곳에서 고르고 바로 플레이하는 앱이에요. 30초면 다 알려 드릴게요.', art: 'logo' },
    { k: 'login', t: '먼저 크랙에 로그인', d: '왼쪽 아래 <b>크랙 로그인</b>에서 한 번만 로그인하면 돼요. 앱을 껐다 켜도 로그인이 유지돼요.' },
    { k: 'home', t: '작품을 누르면 바로 플레이', d: '<b>홈</b>에서 작품을 누르면 크랙 화면이 그대로 열려요. 보던 대화는 기억해 뒀다가 다음에 <b>이어하기</b>로 바로 열어 드려요.' },
    { k: 'store', t: '스토어에서 전용 화면 받기', d: '작품마다 어울리는 전용 플레이 화면(<b>플레이팩</b>)이 <b>스토어</b>에 올라와요. 미리 보고 받을 수 있어요.' },
    { k: 'community', t: '소식 · 신고 · 건의', d: '<b>커뮤니티</b>에서 새 소식을 보고, 문제나 의견을 히리온에게 바로 보낼 수 있어요. 플레이 중엔 위쪽 깃발 버튼으로도 신고돼요.' },
    { k: 'settings', t: '내 기록과 설정', d: '<b>내 기록</b>에는 작품별 플레이 시간이, <b>설정</b>에는 음악·이어하기·업데이트가 있어요. 사용법은 설정에서 다시 볼 수 있어요.' }
  ];
  let tutI = -1;
  function showTut(i) {
    tutI = i;
    const s = TUT[i];
    document.querySelectorAll('.nav [data-tut]').forEach(el => el.classList.toggle('tut-hl', i > 0 && el.dataset.tut === s.k));
    const last = i === TUT.length - 1;
    $('#tut').innerHTML = `<div class="tut-scrim"></div><div class="tut-card" role="dialog">
      <div class="tut-art">${s.art === 'logo' ? '<img src="logo.png" alt="CRION">' : `<i>${{ login: I.user, home: I.home, store: I.store, community: I.comm, settings: I.gear }[s.k]}</i>`}</div>
      <h3>${s.t}</h3><p>${s.d}</p>
      <div class="tut-dots">${TUT.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tut-btns">${i ? '<button class="btn ghost" data-act="tut-prev">이전</button>' : '<button class="btn ghost" data-act="tut-end">건너뛰기</button>'}
        ${last ? `<button class="btn" data-act="tut-end">둘러보기</button><button class="btn primary" data-act="tut-login">${I.user}크랙 로그인하기</button>` : '<button class="btn primary" data-act="tut-next">다음</button>'}</div>
    </div>`;
    $('#tut').classList.add('on');
  }
  function endTut() {
    tutI = -1;
    $('#tut').classList.remove('on');
    $('#tut').innerHTML = '';
    document.querySelectorAll('.tut-hl').forEach(el => el.classList.remove('tut-hl'));
    lsSet('crion.tut4', '1');
  }

  // ---------- 그리기 ----------
  function render() {
    const app = $('#app');
    app.classList.toggle('playing', S.view === 'play');
    let main = '';
    if (S.view === 'play' && S.play) { app.innerHTML = playHtml(); bindWebview(); return; }
    if (S.view === 'login') main = loginHtml();
    else if (S.view === 'store') main = storeHtml();
    else if (S.view === 'community') main = communityHtml();
    else if (S.view === 'records') main = recordsHtml();
    else if (S.view === 'settings') main = settingsHtml();
    else main = homeHtml();
    app.innerHTML = navHtml() + main;
    if (S.view === 'login') bindWebview();
    if (tutI >= 0) showTut(tutI);
  }
  function go(view) {
    if (S.view === 'play' && view !== 'play') { if (bgm) bgm.stop(); S.play = null; }
    S.view = view;
    if (view === 'community' && S.commTab === 'news') markNewsSeen();
    render();
    const pg = $('.page'); if (pg) pg.scrollTop = 0;
    if (view === 'store' && S.packsState !== 'loading') loadPacks().then(() => { if (S.view === 'store') render(); });
  }
  const refresh = () => { if (S.view !== 'play' && S.view !== 'login') render(); };

  function setFull(on) {
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (e) { /* 전체 화면 안 됨 */ }
  }

  // ---------- 동작 ----------
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'close-modal' && el.classList.contains('scrim') && e.target !== el) return;
    const id = el.dataset.id;
    switch (act) {
      case 'go': closeModal(); go(el.dataset.v); break;
      case 'nav-fold': savePref('navSmall', !P.navSmall); render(); break;
      case 'play': openWork(id); break;
      case 'play-fresh': openWork(id, true); break;
      case 'info': openInfo(id); break;
      case 'leave': leavePlay(); break;
      case 'login-done': await save({ onboarded: true }); toast('로그인했어요. 이제 작품을 골라 보세요'); go('home'); break;
      case 'close-modal': closeModal(); break;
      case 'close-notice': if (S.notice) lsSet(noticeId(S.notice), '1'); refresh(); break;
      case 'open-link': if (el.dataset.url) api.openExternal(el.dataset.url); break;
      case 'view-img': modal(`<div class="lightbox"><img src="${esc(el.dataset.src)}" alt=""><button class="icon-btn close-x" data-act="close-modal">${I.x}</button></div>`, true); break;
      case 'forget-cont': { const u = Object.assign({}, S.settings.workUrls); delete u[id]; await save({ workUrls: u }); openInfo(id); refresh(); break; }
      case 'forget-all': await save({ workUrls: {} }); toast('이어하기 기억을 지웠어요'); render(); break;
      // 플레이 화면
      case 'wv-back': { const v = wv(); if (v && v.canGoBack()) v.goBack(); break; }
      case 'wv-reload': { const v = wv(); if (v) v.reload(); break; }
      case 'wv-page': { const v = wv(); if (v && S.play) v.loadURL(S.play.work.url); break; }
      case 'guide': if (S.play) { S.play.guide = !S.play.guide; const g = $('#pguide'); if (g) g.classList.toggle('hidden', !S.play.guide); document.querySelectorAll('[data-act=guide].icon-btn').forEach(b => b.classList.toggle('on', S.play.guide)); } break;
      case 'music': if (bgm && S.play) { if (!bgm.src) { bgm.setVolume((S.settings.volume == null ? 60 : S.settings.volume) / 100); bgm.paused = false; bgm.play(S.play.work.bgm); } else bgm.toggle(); updMusicBtn(); } break;
      case 'fullscreen': setFull(!document.fullscreenElement); break;
      case 'report': openReport(); break;
      case 'go-report': S.commTab = 'send'; S.form.kind = 'bug'; go('community'); break;
      // 스토어
      case 'store-tab': S.storeTab = el.dataset.v; render(); break;
      case 'store-reload': S.packsState = 'loading'; render(); await loadPacks(); render(); break;
      case 'pack': openPack(id); break;
      case 'pack-preview': openPackPreview(id); break;
      case 'pack-install': { const p = S.packs.find(x => x.id === id); if (!p) break; installed.install(p); toast(`${p.name}을(를) 받았어요`); if ($('#layer').innerHTML) openPack(id); refresh(); break; }
      case 'pack-remove': { installed.remove(id); toast('지웠어요. 이 작품은 크랙 화면으로 열려요'); openPack(id); refresh(); break; }
      // 커뮤니티
      case 'comm-tab': S.commTab = el.dataset.v; if (S.commTab === 'news') markNewsSeen(); render(); break;
      case 'form-kind': S.form.kind = el.dataset.kind; render(); break;
      case 'form-send': sendForm(el.dataset.kind); break;
      // 설정
      case 'pref': { let v = el.dataset.v; if (v === 'true' || v === 'false') v = v === 'true'; savePref(el.dataset.k, v); render(); break; }
      case 'set': { let v = el.dataset.v; if (v === 'true' || v === 'false') v = v === 'true'; await save({ [el.dataset.k]: v }); render(); break; }
      case 'check-update': {
        el.disabled = true;
        const r = await api.checkUpdates();
        el.disabled = false;
        toast(r.skipped === 'no-registry' ? '업데이트 주소가 없어요' : r.error ? '확인하지 못했어요: ' + r.error : r.engine && r.engine.state === 'ready' ? '새 버전을 받았어요. 다시 시작하면 적용돼요' : r.engine && r.engine.state === 'shell-old' ? '새 설치 파일이 필요해요' : '최신 상태예요');
        break;
      }
      case 'relaunch': api.relaunch(); break;
      case 'open-folder': api.openFolder(); break;
      case 'tutorial': showTut(0); break;
      case 'tut-next': showTut(Math.min(TUT.length - 1, tutI + 1)); break;
      case 'tut-prev': showTut(Math.max(0, tutI - 1)); break;
      case 'tut-end': endTut(); break;
      case 'tut-login': endTut(); go('login'); break;
      default: break;
    }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'homeQ') { S.homeQ = e.target.value; const g = $('#homeGrid'); if (g) g.innerHTML = gridHtml(); }
    else if (e.target.id === 'storeQ') { S.storeQ = e.target.value; const pos = e.target.selectionStart; render(); const i = $('#storeQ'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } }
    else if (e.target.id === 'vol') { const v = Number(e.target.value); $('#volOut').textContent = v; if (bgm) bgm.setVolume(v / 100); clearTimeout(volTimer); volTimer = setTimeout(() => save({ volume: v }), 300); }
  });
  let volTimer = null;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tutI >= 0) endTut();
      else if ($('#layer').innerHTML) closeModal();
      else if (document.fullscreenElement) setFull(false);
      return;
    }
    if (e.key === 'F11' && S.view === 'play') { e.preventDefault(); setFull(!document.fullscreenElement); }
    if (tutI >= 0 && (e.key === 'ArrowRight' || e.key === 'Enter')) { e.preventDefault(); if (tutI < TUT.length - 1) showTut(tutI + 1); else endTut(); }
    if (tutI >= 0 && e.key === 'ArrowLeft') { e.preventDefault(); showTut(Math.max(0, tutI - 1)); }
  });
  document.addEventListener('fullscreenchange', () => { const a = $('#app'); if (a) a.classList.toggle('full', !!document.fullscreenElement); });

  // ---------- 시작 ----------
  function hideSplash() {
    const sp = $('#splash');
    if (!sp) return;
    const wait = P.splash ? Math.max(0, 1500 - (Date.now() - BOOT_AT)) : 0;
    setTimeout(() => {
      sp.classList.add('out');
      setTimeout(() => { sp.remove(); if (!lsGet('crion.tut4')) showTut(0); }, P.splash ? 450 : 0);
    }, wait);
  }
  if (!P.splash) { const sp = $('#splash'); if (sp) sp.classList.add('quick'); }

  api.onUpdate((ev) => {
    if (ev.type === 'catalog') loadCatalog().then(refresh);
    else if (ev.type === 'engine-ready') { S.update = { type: 'engine', version: ev.version }; refresh(); toast('새 버전이 준비됐어요. 왼쪽 아래를 눌러 다시 시작하면 적용돼요', 5000); }
    else if (ev.type === 'shell-old') { S.update = { type: 'shell', url: ev.url || '' }; refresh(); }
  });

  (async function boot() {
    S.info = await api.info();
    S.settings = await api.getSettings();
    if (!S.settings.workUrls) S.settings.workUrls = {};
    await Promise.all([loadCatalog(), loadPacks()]);
    if (!S.works.length) await loadShellWorks();
    render();
    api.engineReady();
    hideSplash();
    setInterval(() => loadCatalog().then(refresh), 30 * 60 * 1000);
  })().catch((err) => { console.error(err); hideSplash(); });

  // 플레이 시간: 플레이 화면이 열려 있고 창이 보일 때만 센다
  setInterval(() => { if (S.view === 'play' && S.play && document.visibilityState === 'visible') store.addTime(S.play.work.id, 30000); }, 30000);

  // 시험용
  window.__crion = { S, render, go, showTut, endTut };
})();
