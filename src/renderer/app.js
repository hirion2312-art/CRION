// CRION 화면 로직 (홈 · 공용 게임 화면 · 설정)
(function () {
  'use strict';
  const api = window.crion;
  const R = window.CrionReply;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => `url("${String(u).replace(/["\\\n]/g, '')}")`;

  const svg = (d, w) => `<svg width="${w || 18}" height="${w || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
    chev: svg('<path d="m9 6 6 6-6 6"/>', 14),
    back: svg('<path d="m15 6-6 6 6 6"/>', 16),
    play: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    send: svg('<path d="M5 12h13M13 6l6 6-6 6"/>', 16),
    redo: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>', 17),
    log: svg('<path d="M5 5h14M5 10h14M5 15h9M5 20h6"/>', 17),
    web: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>', 17),
    side: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>', 17),
    sync: svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>', 15),
    full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 17),
    book: svg('<path d="M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M5 16a4 4 0 0 1 4-4h9"/>', 17),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 16),
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>', 16),
    flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', 17),
    star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', 15),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 15),
    music: svg('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>', 17),
    mute: svg('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/><path d="M3 3l18 18"/>', 17),
    plus: svg('<path d="M12 5v14M5 12h14"/>', 14),
    x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 18),
    cont: svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', 16)
  };
  const TINTS = ['#6d5bd0', '#d0457a', '#2f7fd1', '#0f9d76', '#d07a1f', '#7a8597', '#b0473a', '#3b8e9e'];
  const tintOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return TINTS[Math.abs(h) % TINTS.length]; };
  const SPEED = { slow: 42, normal: 24, fast: 10, instant: 0 };

  // 화면 취향: 글자 크기 · 자동 진행 · 대사창 진하기 (이 컴퓨터에만 저장)
  const PREF_DEFAULT = { font: 'm', auto: false, dlg: 'normal' };
  function loadPrefs() { try { return Object.assign({}, PREF_DEFAULT, JSON.parse(localStorage.getItem('crion.prefs') || '{}')); } catch (e) { return Object.assign({}, PREF_DEFAULT); } }
  let P = loadPrefs();
  function savePref(k, v) { P[k] = v; try { localStorage.setItem('crion.prefs', JSON.stringify(P)); } catch (e) { /* 저장 안 됨 */ } applyPrefs(); }
  function applyPrefs() {
    const a = document.getElementById('app');
    if (!a) return;
    a.dataset.font = P.font;
    a.dataset.dlg = P.dlg;
  }

  const store = new window.CrionStore.WorkStore((() => { try { return window.localStorage; } catch (e) { return null; } })());
  const { fmtTime, ago } = window.CrionStore;
  const bgm = window.CrionBgm ? new window.CrionBgm() : null;

  const CM = window.CrionCommunity;
  const S = {
    cat: { links: {}, news: [], report: {} }, form: { kind: 'bug' }, diagText: '',
    info: null, settings: null, works: [], creatorUrl: '', syncedAt: null, syncing: false,
    view: 'home', work: null, room: null
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
  async function copy(text, msg) {
    try { await api.copy(text); toast(msg || '복사했어요'); } catch (e) { toast('복사하지 못했어요'); }
  }
  function thumbInner(w) {
    const ph = `<div class="ph" style="background:linear-gradient(140deg, ${tintOf(w.name)}, #1d2130)">${esc((w.name || '?').slice(0, 1))}</div>`;
    return ph + (w.thumb ? `<img src="${esc(w.thumb)}" alt="" loading="lazy" style="position:relative" onerror="this.remove()">` : '');
  }
  const thumbHtml = (w, cls) => `<div class="${cls}">${thumbInner(w)}</div>`;
  const workById = (id) => S.works.find(w => w.id === id);

  // 공지: 업데이트 서버의 catalog.json 에 notice 가 있으면 홈 위에 띄운다
  async function loadNotice() {
    const u = S.info && S.info.registryUrl;
    if (!u) return;
    try {
      const res = await fetch(u.replace(/[^/]*$/, '') + 'catalog.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const c = await res.json();
      const n = c && c.notice;
      S.notice = n && n.on !== false && n.text ? n : null;
      S.cat = { links: (c && c.links) || {}, news: (c && Array.isArray(c.news)) ? c.news : [], report: (c && c.report) || {} };
    } catch (e) { /* 오프라인 */ }
  }
  const noticeId = (n) => 'crion.notice.' + String(n.id || n.text).slice(0, 80);
  function noticeHtml() {
    const n = S.notice;
    if (!n) return '';
    try { if (localStorage.getItem(noticeId(n))) return ''; } catch (e) { /* 저장 안 됨 */ }
    return `<div class="notice"><b>공지</b><span>${esc(n.text)}</span>
      ${n.link && /^https:\/\//.test(n.link) ? `<button class="btn sm" data-act="open-link" data-url="${esc(n.link)}">자세히</button>` : ''}
      <button class="icon-btn" data-act="close-notice" title="닫기">${I.x}</button></div>`;
  }

  async function loadWorks() {
    const r = await api.getWorks();
    S.works = r.works || [];
    S.creatorUrl = r.creatorUrl || '';
    S.syncedAt = r.syncedAt || null;
  }

  // ---------- 상단 ----------
  function topHtml() {
    let crumb = '';
    let tools = '';
    if (S.view === 'login') {
      crumb = `<button class="btn ghost sm" data-act="home">${I.back}홈</button><span class="title">크랙 로그인</span>`;
    } else if (S.view === 'room' && S.work) {
      crumb = `<button class="btn ghost sm" data-act="home">${I.back}홈</button><span class="title">${esc(S.work.name)}</span>`;
      if (S.work.bgm && bgm) tools += `<button class="icon-btn" data-act="music" title="배경 음악">${bgm.paused ? I.mute : I.music}</button>`;
      tools += `<button class="icon-btn" data-act="immersive" title="몰입 모드 (F)">${I.full}</button>`;
      tools += `<button class="icon-btn" data-act="toggle-side" title="옆 패널">${I.side}</button>`;
    }
    if (S.view === 'community') {
      crumb = `<button class="btn ghost sm" data-act="home">${I.back}홈</button><span class="title">소통</span>`;
    }
    if (S.view === 'home') tools += `<button class="btn" data-act="community">${I.chat}소통 · 신고</button><button class="btn" data-act="login">${I.user}크랙 로그인</button>`;
    tools += `<button class="icon-btn" data-act="settings" title="설정">${I.gear}</button>`;
    return `<header class="top"><div class="brand"><svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#14161b"/><path d="M18 17h28a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7H31l-10 8v-8h-3a7 7 0 0 1-7-7V24a7 7 0 0 1 7-7z" fill="#fff"/><path d="M28 24.5 40 31l-12 6.5z" fill="#5b5bd6"/></svg>CRION</div><div class="crumb">${crumb}</div><div class="tools">${tools}</div></header>`;
  }

  // ---------- 홈 ----------
  function featuredWork() {
    return S.works.find(w => w.featured) ||
      (S.settings.recent || []).map(workById).find(Boolean) ||
      S.works.find(w => w.thumb) || S.works[0] || null;
  }
  function heroHtml() {
    const w = featuredWork();
    if (!w) return '';
    const rec = store.get(w.id);
    const label = S.settings.workUrls[w.id] ? '이어하기' : '플레이';
    return `<section class="hero" ${w.thumb ? `style="--hero:${cssUrl(w.thumb)}"` : ''}>
      <div class="hero-bg"></div>
      <div class="hero-in">
        <div class="hero-poster">${thumbInner(w)}</div>
        <div class="hero-text">
          <span class="eyebrow">${w.featured ? '추천 작품' : rec.turns ? '최근 플레이' : '오늘의 작품'}</span>
          <h2>${esc(w.name)}</h2>
          ${w.genre ? `<p class="genre">${esc(w.genre)}</p>` : ''}
          ${w.desc ? `<p class="desc">${esc(w.desc)}</p>` : ''}
          <div class="hero-btns">
            <button class="btn big white" data-act="play" data-id="${esc(w.id)}">${I.play} ${label}</button>
            <button class="btn big glass" data-act="info" data-id="${esc(w.id)}">${I.info} 작품 정보</button>
          </div>
          ${rec.turns ? `<p class="hero-meta">${rec.turns}턴 · ${fmtTime(rec.playMs)} · 마지막 ${ago(rec.lastAt)}</p>` : ''}
        </div>
      </div>
    </section>`;
  }
  function statsHtml() {
    const t = store.totals(S.works.map(w => w.id));
    if (!t.turns) return '';
    const items = [['플레이한 작품', t.played + '개'], ['진행한 턴', t.turns.toLocaleString('ko-KR')], ['플레이 시간', fmtTime(t.playMs)], ['별표 대사', t.quotes + '개'], ['모은 그림', t.album + '장']];
    return `<div class="stats">${items.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
  }
  function homeHtml() {
    const recent = (S.settings.recent || []).map(workById).filter(Boolean).slice(0, 4);
    const cont = recent.length ? `
      <div class="section-h"><h2>이어하기</h2></div>
      <div class="continue">${recent.map(w => {
        const rec = store.get(w.id);
        return `<button class="cont" data-act="play" data-id="${esc(w.id)}">
          ${thumbHtml(w, 'mini')}
          <div><b>${esc(w.name)}</b><span>${rec.turns ? `${rec.turns}턴 · ${ago(rec.lastAt)}` : S.settings.workUrls[w.id] ? '마지막 대화로 바로 이어져요' : '작품 페이지부터 열려요'}</span></div>
          <span class="go">이어하기 →</span>
        </button>`;
      }).join('')}</div>` : '';
    const syncLine = S.syncing ? '<span class="spin"></span> 작가 프로필에서 작품을 불러오는 중'
      : S.syncedAt ? `프로필 기준 ${new Date(S.syncedAt).toLocaleDateString('ko-KR')} 업데이트` : '';
    const cards = S.works.map(w => {
      const rec = store.get(w.id);
      return `<div class="card">
        <button class="thumb" data-act="play" data-id="${esc(w.id)}" title="${esc(w.name)} 플레이">${thumbInner(w)}
          ${w.featured ? '<span class="tag hot">추천</span>' : w.auto ? '<span class="tag">새 작품</span>' : ''}
          ${w.bgm ? `<span class="tag right">${I.music}</span>` : ''}
          <span class="play">${I.play} 플레이</span>
        </button>
        <div class="meta"><button class="name" data-act="info" data-id="${esc(w.id)}">${esc(w.name)}</button>
          <span>${rec.turns ? `${rec.turns}턴 플레이 · ${ago(rec.lastAt)}` : esc(w.genre || (w.url ? '' : '주소 확인 중'))}</span></div>
        <button class="info-btn" data-act="info" data-id="${esc(w.id)}" title="작품 정보">${I.info}</button>
      </div>`;
    }).join('');
    const needSync = !S.works.some(w => w.url);
    return `<main class="home"><div class="home-in">
      ${noticeHtml()}
      ${!S.settings.onboarded ? `<div class="welcome"><div><b>처음 오셨나요?</b><span>① 크랙에 로그인 → ② 작품 고르기. 로그인은 한 번만 하면 돼요.</span></div>
        <button class="btn primary" data-act="login">${I.user}크랙 로그인하기</button></div>`
        : needSync && !S.syncing ? `<div class="note">작품 주소를 아직 못 불러왔어요. <b>목록 새로고침</b>을 눌러 주세요. 계속 안 되면 설정의 <b>목록 진단 복사</b> 결과를 보내 주세요.</div>` : ''}
      ${heroHtml()}
      ${statsHtml()}
      ${cont}
      <div class="section-h"><h2>전체 작품</h2><span class="sub">${S.works.length}개</span>
        <span class="right muted">${syncLine}<button class="btn sm ghost" data-act="sync" ${S.syncing ? 'disabled' : ''}>${I.sync}새로고침</button></span></div>
      <div class="grid">${cards}</div>
    </div></main>`;
  }

  // ---------- 작품 정보 창 ----------
  function charsHtml(rec, empty) {
    const list = Object.entries(rec.chars).sort((a, b) => b[1].lines - a[1].lines);
    if (!list.length) return `<p class="muted">${empty}</p>`;
    return `<div class="chars">${list.map(([name, c]) => `<div class="char">
      <div class="face">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy">` : `<span style="background:${tintOf(name)}">${esc(name.slice(0, 1))}</span>`}</div>
      <div><b>${esc(name)}</b><small>대사 ${c.lines}번</small>${c.last ? `<p>“${esc(c.last)}”</p>` : ''}</div></div>`).join('')}</div>`;
  }
  function albumHtml(rec, empty) {
    if (!rec.album.length) return `<p class="muted">${empty}</p>`;
    return `<div class="album">${rec.album.slice().reverse().map(a => `<button class="ph-item" data-act="view-img" data-src="${esc(a.src)}"><img src="${esc(a.src)}" alt="" loading="lazy"></button>`).join('')}</div>`;
  }
  function quotesHtml(rec, empty, wid) {
    if (!rec.quotes.length) return `<p class="muted">${empty}</p>`;
    return `<div class="quotes">${rec.quotes.slice().reverse().map(q => `<div class="quote">
      ${q.who ? `<b>${esc(q.who)}</b>` : ''}<p>${esc(q.text)}</p>
      <span><small>${ago(q.at)}</small><button class="link" data-act="unquote" data-w="${esc(wid)}" data-who="${esc(q.who)}" data-text="${esc(q.text)}">별표 빼기</button></span></div>`).join('')}</div>`;
  }
  function openInfo(id, tab) {
    const w = workById(id);
    if (!w) return;
    const rec = store.get(w.id);
    tab = tab || 'about';
    const tabs = [['about', '소개'], ['chars', `등장인물 ${Object.keys(rec.chars).length}`], ['album', `앨범 ${rec.album.length}`], ['quotes', `명대사 ${rec.quotes.length}`]];
    if (w.guide) tabs.splice(1, 0, ['guide', '공략']);
    let body = '';
    if (tab === 'about') {
      body = `${w.desc ? `<p class="lead">${esc(w.desc)}</p>` : '<p class="muted">소개가 아직 없어요.</p>'}
        <dl class="kv">${w.genre ? `<dt>장르</dt><dd>${esc(w.genre)}</dd>` : ''}
          <dt>내 기록</dt><dd>${rec.turns ? `${rec.turns}턴 · ${fmtTime(rec.playMs)} · 마지막 ${ago(rec.lastAt)}` : '아직 플레이 전'}</dd>
          ${rec.firstAt ? `<dt>처음 플레이</dt><dd>${new Date(rec.firstAt).toLocaleDateString('ko-KR')}</dd>` : ''}</dl>`;
    } else if (tab === 'guide') body = `<div class="guide">${mdLite(w.guide)}</div>`;
    else if (tab === 'chars') body = charsHtml(rec, '플레이하면서 만난 인물이 여기에 모여요.');
    else if (tab === 'album') body = albumHtml(rec, '응답에 나온 그림이 여기에 모여요.');
    else body = quotesHtml(rec, '대사창의 ☆를 누르면 마음에 드는 대사를 모을 수 있어요.', w.id);
    modal(`<div class="info-head" ${w.thumb ? `style="--hero:${cssUrl(w.thumb)}"` : ''}><div class="hero-bg"></div>
        <div class="info-head-in">${thumbHtml(w, 'info-poster')}<div><h3>${esc(w.name)}</h3>${w.genre ? `<span>${esc(w.genre)}</span>` : ''}
          <div class="hero-btns"><button class="btn white" data-act="play" data-id="${esc(w.id)}">${I.play} ${S.settings.workUrls[w.id] ? '이어하기' : '플레이'}</button>
          ${S.settings.workUrls[w.id] ? `<button class="btn glass" data-act="play-fresh" data-id="${esc(w.id)}">처음부터 (작품 페이지)</button>` : ''}</div></div></div>
        <button class="icon-btn close-x" data-act="close-modal">${I.x}</button></div>
      <nav class="tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="info-tab" data-id="${esc(w.id)}" data-tab="${k}">${l}</button>`).join('')}</nav>
      <div class="body">${body}</div>`, true);
  }

  // ---------- 소통: 소식 · 커뮤니티 · 신고 · 건의 · 공략 제보 ----------
  function sentHistory() { try { return JSON.parse(localStorage.getItem('crion.sent') || '[]'); } catch (e) { return []; } }
  function pushSent(item) { const h = sentHistory().concat(item).slice(-50); try { localStorage.setItem('crion.sent', JSON.stringify(h)); } catch (e) { /* 저장 안 됨 */ } }
  const hookFor = (kind) => { const r = S.cat.report || {}; return (r.webhooks && r.webhooks[kind]) || r.webhook || ''; };

  function formHtml(kind, opt) {
    opt = opt || {};
    const works = S.works.map(w => `<option ${opt.work === w.name ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
    const workSel = (req) => `<label class="f"><span>작품${req ? '' : ' (선택)'}</span><select id="fWork" class="field">${req ? '' : '<option value="">작품과 상관없음</option>'}${works}</select></label>`;
    const nick = `<label class="f"><span>닉네임 (선택 · 답장이나 공략 출처 표시용)</span><input id="fNick" class="field" maxlength="30" value="${esc(localStorage.getItem('crion.nick') || '')}"></label>`;
    let body = '';
    if (kind === 'bug') {
      body = `${workSel(false)}
        <label class="f"><span>무슨 문제가 있었나요?</span><textarea id="fBody" class="field" rows="4" placeholder="예) 응답에 다른 글씨가 섞여 나와요 / 보내기를 눌러도 안 가요"></textarea></label>
        <label class="f"><span>어떻게 하다가 생겼나요? (선택)</span><input id="fSteps" class="field" placeholder="예) 작품 열고 첫 대사 보냈을 때"></label>
        ${opt.diag ? `<label class="chk"><input type="checkbox" id="fDiag" checked> 지금 화면 정보 첨부 (대화 내용 일부가 들어갈 수 있어요)</label>` : ''}`;
    } else if (kind === 'idea') {
      body = `<label class="f"><span>한 줄 요약</span><input id="fTitle" class="field" maxlength="80" placeholder="예) 대사창 글씨체를 바꾸고 싶어요"></label>
        <label class="f"><span>자세히</span><textarea id="fBody" class="field" rows="5"></textarea></label>${workSel(false)}`;
    } else {
      body = `${workSel(true)}
        <label class="f"><span>공략·팁</span><textarea id="fBody" class="field" rows="5" placeholder="다른 플레이어에게 도움이 될 팁을 적어 주세요. 좋은 공략은 작품 공략에 실려요."></textarea></label>`;
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
    const hist = sentHistory().slice().reverse().slice(0, 8);
    const kinds = [['bug', '오류 신고'], ['idea', '건의'], ['tip', '공략 제보']];
    return `<main class="home"><div class="home-in comm">
      <div class="hello"><div><h1>소통</h1><p>소식을 보고, 문제나 의견을 히리온에게 바로 보낼 수 있어요.</p></div></div>
      <div class="comm-grid">
        <section>
          <div class="section-h"><h2>소식</h2></div>
          ${S.notice ? `<div class="news hot"><b>공지</b><p>${esc(S.notice.text)}</p></div>` : ''}
          ${news.length ? news.map(n => `<article class="news">
              <div class="news-h"><b>${esc(n.title || '')}</b><span>${esc(n.date || '')}</span></div>
              ${n.text ? `<p>${esc(n.text)}</p>` : ''}
              ${n.link && /^https:\/\//.test(n.link) ? `<button class="link" data-act="open-link" data-url="${esc(n.link)}">자세히 보기 →</button>` : ''}
            </article>`).join('') : (!S.notice ? '<p class="muted">아직 소식이 없어요.</p>' : '')}
          <div class="section-h"><h2>커뮤니티</h2></div>
          ${links.length ? `<div class="links">${links.map(([t, d, u]) => `<button class="link-card" data-act="open-link" data-url="${esc(u)}"><b>${esc(t)}</b><span>${esc(d)}</span><i>→</i></button>`).join('')}</div>`
            : '<p class="muted">커뮤니티가 곧 열려요.</p>'}
        </section>
        <section>
          <div class="section-h"><h2>보내기</h2></div>
          <div class="send-box">
            <nav class="tabs">${kinds.map(([k, l]) => `<button class="${S.form.kind === k ? 'on' : ''}" data-act="form-kind" data-kind="${k}">${l}</button>`).join('')}</nav>
            <div class="body">${formHtml(S.form.kind, { diag: false })}</div>
          </div>
          ${hist.length ? `<div class="section-h"><h2>내가 보낸 것</h2></div><div class="hist">${hist.map(h => `<div><b>${esc((CM.KINDS[h.kind] || {}).label || '')}</b><span>${esc(h.title || '')}</span><small>${ago(h.at)}${h.copied ? ' · 복사만 함' : ''}</small></div>`).join('')}</div>` : ''}
        </section>
      </div>
    </div></main>`;
  }

  function openReport() {
    const w = S.room && S.room.work;
    S.diagText = '';
    const v = wv();
    if (v) { S.waitDiag = true; v.send('crion:diag'); }
    modal(`<header><h3>문제 신고</h3><button class="icon-btn" data-act="close-modal">${I.x}</button></header>
      <div class="body">${formHtml('bug', { work: w && w.name, diag: !!v })}</div>`);
  }

  async function sendForm(kind) {
    const v = (id) => { const el = $('#' + id); return el ? el.value.trim() : ''; };
    const f = { work: v('fWork'), title: v('fTitle'), body: v('fBody'), steps: v('fSteps'), nick: v('fNick') };
    if (!f.body) { toast('내용을 적어 주세요'); return; }
    if (kind === 'bug' && !f.title) f.title = f.body.split('\n')[0].slice(0, 60);
    if (kind === 'tip' && !f.title) f.title = (f.work ? f.work + ' 공략: ' : '') + f.body.slice(0, 40);
    try { localStorage.setItem('crion.nick', f.nick); } catch (e) { /* 무시 */ }
    const ctx = { app: S.info.version, engine: S.info.engineVersion, os: S.info.platform };
    const hook = hookFor(kind);
    const hist = sentHistory();
    if (!CM.isWebhook(hook)) {
      copy(CM.asText(kind, f, ctx), '내용을 복사했어요. 커뮤니티나 히리온에게 붙여서 보내 주세요');
      pushSent({ kind, title: f.title, work: f.work, at: Date.now(), copied: true });
      return finishForm();
    }
    const lim = CM.allowed(hist);
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
  function finishForm() {
    if ($('#layer').innerHTML) closeModal();
    if (S.view === 'community') render();
  }

  // ---------- 크랙 로그인 화면 ----------
  function loginHtml() {
    return `<div class="login">
      <div class="hint"><b>크랙 로그인</b><span>여기서 한 번 로그인해 두면 모든 작품에서 계속 로그인돼 있어요.</span>
        <button class="btn primary sm" data-act="login-done">로그인 완료</button></div>
      <webview id="crack" src="${esc(S.info.crackOrigin)}" partition="persist:crack" allowpopups></webview></div>`;
  }

  // ---------- 플레이 화면 ----------
  function newRoom(work, fresh) {
    const rec = store.get(work.id);
    return {
      work, url: (!fresh && S.settings.workUrls[work.id]) || work.url || S.creatorUrl || S.info.crackOrigin,
      tab: 'status', baseStatus: null,
      orig: true, autoOrig: true, side: true,
      turn: null,        // { key, segs, beats, frames, status, choices, done, live }
      idx: 0, typed: true, follow: false,
      status: rec.lastStatus || null, waiting: false, hasInput: false,
      log: loadLog(work.id), typing: null
    };
  }

  const logKey = (id) => 'crion.log.' + id;
  function loadLog(id) { try { return JSON.parse(localStorage.getItem(logKey(id)) || '[]'); } catch (e) { return []; } }
  function saveLog() {
    const r = S.room;
    if (!r) return;
    try { localStorage.setItem(logKey(r.work.id), JSON.stringify(r.log.slice(-120))); } catch (e) { /* 저장 안 됨 */ }
  }

  function roomHtml() {
    const r = S.room;
    const w = r.work;
    return `<div class="room ${r.orig ? 'orig-on' : ''} ${r.side ? '' : 'side-off'}" id="room">
      <section class="stage-wrap">
        <div class="stage" id="stage">
          <div class="bg thumbbg" id="bg" ${w.thumb ? `style="background-image:${cssUrl(w.thumb)}"` : ''}></div>
          <div class="scene" id="scene"></div>
          <div class="person off" id="person"></div>
          <div class="vign"></div>
          <div class="cover" id="cover"><div class="in">
            <div class="poster">${w.thumb ? `<img src="${esc(w.thumb)}" alt="">` : ''}</div>
            <h2>${esc(w.name)}</h2><p id="coverText">크랙 화면을 불러오는 중이에요…</p><div class="cover-actions" id="coverActions"></div></div></div>
          <div class="choices" id="choices"></div>
          <div class="dlg hidden" id="dlg" tabindex="0">
            <div class="name hidden" id="dlgName"></div>
            <div class="text" id="dlgText"></div>
            <div class="foot"><span class="pos" id="dlgPos"></span><span id="dlgLive"></span>
              <span class="nav"><button data-act="star" id="starBtn" title="별표 대사 모으기">${I.star}</button><button data-act="prev">◀ 이전</button><button data-act="first">처음부터</button><button data-act="next">다음 ▶</button></span></div>
          </div>
        </div>
        <div class="orig"><div class="hint" id="origHint">${r.autoOrig ? '크랙에 로그인하고 대화를 시작해 주세요. 대화창이 열리면 게임 화면으로 바뀌어요.' : '크랙 원본 화면이에요.'}
          <button class="btn sm" data-act="to-game">게임 화면으로</button></div>
          <webview id="crack" src="${esc(r.url)}" partition="persist:crack" allowpopups></webview></div>
      </section>
      <aside class="side" id="side"></aside>
      <div class="inbar">
        <div class="tools">
          <button class="icon-btn" data-act="regen" title="다시 생성">${I.redo}</button>
          <button class="icon-btn" data-act="log" title="지난 대화">${I.log}</button>
          ${w.guide ? `<button class="icon-btn" data-act="guide" title="공략">${I.book}</button>` : ''}
          <button class="icon-btn" data-act="to-orig" title="크랙 원본 화면">${I.web}</button>
          <button class="icon-btn" data-act="report-here" title="문제 신고 (지금 화면 정보 첨부)">${I.flag}</button>
        </div>
        <div class="quick" id="quick"></div>
        <textarea id="msg" rows="1" placeholder="행동이나 대사를 입력하세요 · Enter 보내기, Shift+Enter 줄바꿈"></textarea>
        <button class="btn ghost" data-act="continue" title="이어서 진행">계속</button>
        <button class="send" data-act="send" id="sendBtn">${I.send}보내기</button>
      </div>
    </div>`;
  }

  // 상태창 칸 이름(숫자 뺀 글자)과 첫 숫자 → 지난 턴과 비교
  const statusKey = (t) => String(t).replace(/-?\d+(?:[.,]\d+)?/g, '#').replace(/\s+/g, ' ').trim();
  function firstNum(c) {
    if (c.max) return c.cur;
    const m = /(-?\d+(?:\.\d+)?)/.exec(String(c.text).replace(/,(?=\d{3})/g, ''));
    return m ? Number(m[1]) : null;
  }
  function statusNums(st) {
    const out = {};
    if (!st || !st.rows) return out;
    for (const row of st.rows) for (const c of row) { const n = firstNum(c); if (n != null) out[statusKey(c.text)] = n; }
    return out;
  }

  function sideHtml() {
    const r = S.room;
    const w = r.work;
    const st = r.status;
    let stHtml = '<p class="muted">응답에 상태창이 있으면 여기에 정리돼요.</p>';
    if (st && st.rows) {
      const base = statusNums(r.baseStatus);
      const delta = (c) => {
        const k = statusKey(c.text);
        const now = firstNum(c);
        if (now == null || !(k in base) || base[k] === now) return '';
        const d = Math.round((now - base[k]) * 10) / 10;
        return `<em class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}</em>`;
      };
      stHtml = st.rows.map(row => `<div class="srow">${row.map(c => {
        if (c.max) {
          const p = Math.max(0, Math.min(100, Math.round(c.cur / c.max * 100)));
          const cls = p <= 30 ? 'low' : p <= 60 ? 'mid' : 'hi';
          return `<div class="chip g">${esc(c.text)}${delta(c)}<div class="bar"><i class="${cls}" style="width:${p}%"></i></div></div>`;
        }
        return `<span class="chip">${esc(c.text)}${delta(c)}</span>`;
      }).join('')}</div>`).join('');
    }
    const rec = store.get(w.id);
    const tabs = [['status', '상태'], ['chars', '인물'], ['album', '앨범'], ['quotes', '명대사']];
    let body = '';
    if (r.tab === 'chars') body = charsHtml(rec, '대사를 한 인물이 여기에 모여요.');
    else if (r.tab === 'album') body = albumHtml(rec, '응답에 나온 그림이 여기에 모여요.');
    else if (r.tab === 'quotes') body = quotesHtml(rec, '대사창의 ☆를 누르면 여기에 모여요.', w.id);
    else body = `<div class="panel"><h4>상태<span class="right">${st ? `<button class="btn ghost sm" data-act="copy-status">복사</button>` : ''}</span></h4>${stHtml}</div>
      <div class="panel"><h4>이번 작품 기록</h4><div class="muted">${rec.turns ? `${rec.turns}턴 · ${fmtTime(rec.playMs)} · 인물 ${Object.keys(rec.chars).length}명 · 그림 ${rec.album.length}장` : '첫 플레이예요. 기록이 여기에 쌓여요.'}</div></div>
      <div class="panel"><h4>조작</h4><div class="muted">화면 클릭 · Space · → 다음<br>← 이전 · 1~6 선택지 · F 몰입 모드</div></div>`;
    return `<div class="side-in">
      <button class="work-head" data-act="info" data-id="${esc(w.id)}">${thumbHtml(w, 'mini')}<div><b>${esc(w.name)}</b><span>${esc(w.genre || '작품 정보 보기')}</span></div></button>
      <nav class="tabs small">${tabs.map(([k, l]) => `<button class="${k === r.tab ? 'on' : ''}" data-act="side-tab" data-tab="${k}">${l}</button>`).join('')}</nav>
      ${body}
    </div>`;
  }

  // ---------- 무대 그리기 ----------
  function setOrig(on, auto) {
    const r = S.room;
    if (!r) return;
    r.orig = on;
    if (auto !== undefined) r.autoOrig = auto;
    const room = $('#room');
    if (room) room.classList.toggle('orig-on', on);
    const hint = $('#origHint');
    if (hint) hint.firstChild.nodeValue = r.autoOrig ? '크랙에 로그인하고 대화를 시작해 주세요. 대화창이 열리면 게임 화면으로 바뀌어요. ' : '크랙 원본 화면이에요. ';
    if (!on) setTimeout(() => { const m = $('#msg'); if (m) m.focus(); }, 50);
  }

  function showCover(text, actions) {
    const c = $('#cover');
    if (!c) return;
    c.classList.toggle('hidden', !text);
    if (text) $('#coverText').textContent = text;
    const box = $('#coverActions');
    if (box) {
      const acts = actions || [];
      // 이어하기를 먼저, 그다음 새로 시작
      acts.sort((a, b) => (a.kind === 'continue' ? 0 : 1) - (b.kind === 'continue' ? 0 : 1));
      box.innerHTML = acts.map((a, i) => `<button class="btn ${i === 0 ? 'primary big' : 'big light'}" data-act="start" data-id="${a.id}">${esc(a.label)}</button>`).join('')
        + (acts.length ? '<button class="btn ghost big light" data-act="to-orig">크랙 화면 보기</button>' : '');
    }
  }

  let typeTimer = null;
  function drawBeat() {
    const r = S.room;
    if (!r || !r.turn) return;
    const t = r.turn;
    const n = t.beats.length;
    if (!n) return;
    r.idx = Math.max(0, Math.min(r.idx, n - 1));
    const b = t.beats[r.idx];
    const f = t.frames[r.idx] || {};
    showCover('');
    // 배경: 장면 그림이 있으면 그 그림을 흐리게 깔고 가운데에 온전히, 없으면 작품 썸네일
    const bg = $('#bg');
    const scene = $('#scene');
    const sceneSrc = f.scene ? f.scene.src : '';
    if (scene.dataset.src !== sceneSrc) {
      scene.dataset.src = sceneSrc;
      scene.innerHTML = sceneSrc && !f.person ? `<img src="${esc(sceneSrc)}" alt="">` : '';
      if (sceneSrc) { bg.classList.remove('thumbbg'); bg.style.backgroundImage = cssUrl(sceneSrc); }
      else { bg.classList.add('thumbbg'); bg.style.backgroundImage = r.work.thumb ? cssUrl(r.work.thumb) : ''; }
    } else if (sceneSrc) {
      scene.innerHTML = f.person ? '' : `<img src="${esc(sceneSrc)}" alt="">`;
    }
    const person = $('#person');
    const pSrc = f.person ? f.person.src : '';
    if (person.dataset.src !== pSrc) {
      person.dataset.src = pSrc;
      if (pSrc) { person.innerHTML = `<img src="${esc(pSrc)}" alt="">`; person.classList.remove('off'); }
      else person.classList.add('off');
    }
    // 대사창
    const dlg = $('#dlg');
    dlg.classList.remove('hidden');
    dlg.classList.toggle('say', b.kind === 'say');
    dlg.classList.toggle('narr', b.kind !== 'say');
    const name = $('#dlgName');
    name.classList.toggle('hidden', !b.who);
    name.textContent = b.who || '';
    $('#dlgPos').textContent = `${r.idx + 1} / ${n}`;
    const sb = $('#starBtn');
    if (sb) sb.classList.toggle('on', !!b.text && store.hasQuote(r.work.id, { who: b.who, text: b.text }));
    $('#dlgLive').innerHTML = !t.done ? '<span class="live"><i></i>쓰는 중</span>' : '';
    const el = $('#dlgText');
    clearInterval(typeTimer);
    const speed = SPEED[S.settings.textSpeed] != null ? SPEED[S.settings.textSpeed] : 24;
    const full = b.text;
    if (r.follow || !speed || r.typed) {
      el.textContent = full;
      r.typed = true;
      onTyped();
    } else {
      let i = 0;
      el.textContent = '';
      typeTimer = setInterval(() => {
        i += 2;
        el.textContent = full.slice(0, i);
        if (i >= full.length) { clearInterval(typeTimer); r.typed = true; onTyped(); }
      }, speed);
    }
    drawChoices();
  }

  function onTyped() {
    const el = $('#dlgText');
    const r = S.room;
    if (!el || !r || !r.turn) return;
    const pos = $('#dlgPos');
    if (pos && r.idx < r.turn.beats.length - 1 && !pos.querySelector('.more')) pos.insertAdjacentHTML('beforeend', '<span class="more"></span>');
    drawChoices();
    // 자동 진행: 다 쓴 응답에서, 글 길이만큼 기다렸다가 다음 장면
    clearTimeout(autoTimer);
    if (P.auto && r.turn.done && !r.follow && r.idx < r.turn.beats.length - 1 && !$('#layer').innerHTML) {
      const len = (r.turn.beats[r.idx].text || '').length;
      autoTimer = setTimeout(() => { if (S.room === r) step(1); }, Math.min(7000, 1400 + len * 45));
    }
  }
  let autoTimer = null;

  function drawChoices() {
    const r = S.room;
    const box = $('#choices');
    if (!box || !r) return;
    const t = r.turn;
    const show = t && t.done && t.choices.length && r.idx >= t.beats.length - 1 && r.typed && !r.waiting;
    box.innerHTML = show ? t.choices.map((c, i) => `<button class="choice" data-act="choose" data-i="${i}"><span class="k">${i + 1}</span>${esc(c)}</button>`).join('') : '';
  }

  function step(d) {
    const r = S.room;
    if (!r || !r.turn) return;
    clearTimeout(autoTimer);
    if (d > 0 && !r.typed) {            // 타자 중이면 먼저 끝까지 보여 준다
      clearInterval(typeTimer);
      $('#dlgText').textContent = r.turn.beats[r.idx].text;
      r.typed = true; onTyped();
      return;
    }
    const n = r.turn.beats.length;
    const next = Math.max(0, Math.min(n - 1, r.idx + d));
    if (next === r.idx) return;
    r.idx = next;
    r.typed = d < 0;
    r.follow = !r.turn.done && next === n - 1;
    drawBeat();
  }

  // ---------- 크랙에서 온 소식 ----------
  function onReply(d) {
    const r = S.room;
    if (!r || !d.input) return;          // 입력창이 없는 화면(작품 소개 등)의 글은 응답이 아니다
    const parsed = R.parse(d.segs || [], { max: 150 });
    const isNew = !r.turn || r.turn.key !== d.key;
    if (isNew && !parsed.beats.length && !parsed.status) return;
    if (isNew) {
      const live = r.waiting || r.expectLive;
      r.baseStatus = r.status;            // 이번 응답 전 상태 (▲▼ 비교용)
      clearTimeout(r.slowTimer);
      r.turn = { key: d.key, live, done: false };
      r.waiting = false;
      r.expectLive = false;
      r.idx = live ? 0 : 0;
      r.follow = live;
      r.typed = false;
      if (r.autoOrig && r.orig) setOrig(false, false);
    }
    const t = r.turn;
    const wasAtEnd = r.idx >= (t.beats ? t.beats.length - 1 : 0);
    t.segs = d.segs;
    t.beats = parsed.beats.length ? parsed.beats : [{ kind: 'narr', who: null, text: '…' }];
    t.frames = R.stageFrames(t.beats);
    t.choices = parsed.choices;
    t.done = !!d.done;
    if (parsed.status) { r.status = parsed.status; renderSide(); }
    if (r.follow && wasAtEnd) { r.idx = t.beats.length - 1; r.typed = true; }
    if (d.done) {
      r.follow = false;
      if (r.recordedKey !== d.key && t.live) {          // 이번 플레이에서 새로 받은 응답만 센다
        r.recordedKey = d.key;
        store.recordTurn(r.work.id, t.beats, t.frames);
        if (r.status) { store.get(r.work.id).lastStatus = r.status; store.save(r.work.id); }
        renderSide();
      }
      const text = (d.segs || []).filter(s => s.t === 'text').map(s => s.s).join('').trim();
      const last = r.log[r.log.length - 1];
      if (text && !(last && last.key === d.key)) { r.log.push({ who: 'ai', key: d.key, text, at: Date.now() }); }
      else if (last && last.key === d.key) last.text = text;
      saveLog();
      setSending(false);
    }
    drawBeat();
  }

  function onState(d) {
    const r = S.room;
    if (!r) return;
    r.hasInput = !!d.input;
    if (!d.page && d.input) d.page = 'chat';
    if (d.page) {
      const was = r.page;
      r.page = d.page;
      if (d.page === 'detail' && !r.turn) {
        // 작품 소개 페이지: 크랙의 '이어하기/대화 시작' 버튼을 CRION 화면에 그대로 보여 준다
        setOrig(false, false);
        showCover(d.actions && d.actions.length ? '이어서 하거나 새로 시작해 주세요.' : '작품 페이지예요.', d.actions || []);
      } else if (d.page === 'chat') {
        if (was !== 'chat' && (d.url || r.url)) {
          const urls = Object.assign({}, S.settings.workUrls, { [r.work.id]: d.url || r.url });
          save({ workUrls: urls });            // 다음엔 이 대화방으로 바로
        }
      } else if (d.page === 'other' && !r.turn && r.autoOrig !== false) {
        setOrig(true, true);                   // 로그인 등: 크랙 화면 그대로
      }
      updateSendable();
    }
    if (d.waiting) {
      r.waiting = true;
      if (!r.orig) { $('#dlgLive') && ($('#dlgLive').innerHTML = '<span class="live"><i></i>응답 기다리는 중</span>'); }
      drawChoices();
    }
    if (r.hasInput && (r.autoOrig || r.page === 'chat') && !r.turn && (r.orig || !$('#cover').classList.contains('hidden'))) {
      // 대화창은 열렸는데 아직 응답이 없을 때: 게임 화면으로 넘어가 첫 입력을 기다린다
      setOrig(false, false);
      showCover(getLearned() ? '이어서 진행해 보세요. 아래 입력창에 쓰고 보내면 돼요.'
        : '아래 입력창에 첫 행동을 보내 주세요. 첫 응답을 받으면서 이 작품 화면을 맞춰요. (지난 대화는 크랙 원본 화면 버튼으로 볼 수 있어요)');
    }
  }

  function onUrl(d) {
    const r = S.room;
    if (!r || !d.url) return;
    r.url = d.url;          // 이어하기 주소는 채팅 화면으로 확인됐을 때만 저장한다 (onState)
  }

  // 채팅 화면일 때만 보낼 수 있다 (작품 소개 페이지의 댓글 칸 등에 들어가지 않게)
  function updateSendable() {
    const r = S.room;
    const ok = !!(r && r.page === 'chat');
    const m = $('#msg');
    if (m) m.placeholder = ok ? '행동이나 대사를 입력하세요 · Enter 보내기, Shift+Enter 줄바꿈' : '대화를 시작하면 여기서 입력할 수 있어요';
    const b = $('#sendBtn');
    if (b && !ok) b.disabled = true;
    else if (b && ok && !sendGuard) b.disabled = false;
  }

  // ---------- 보내기 ----------
  let sendGuard = null;
  function setSending(on) {
    const b = $('#sendBtn');
    if (b) b.disabled = !!on;
    clearTimeout(sendGuard);
    sendGuard = null;
    if (on) sendGuard = setTimeout(() => { sendGuard = null; setSending(false); }, 8000);
  }
  function wv() { return $('#crack'); }

  function sendText(text) {
    const r = S.room;
    text = String(text || '').trim();
    if (!r || !text) return;
    if (r.page !== 'chat') { toast('아직 대화 화면이 아니에요. 이어하기나 새로 시작을 먼저 눌러 주세요'); return; }
    const v = wv();
    if (!v) return;
    if ($('#sendBtn') && $('#sendBtn').disabled) return;
    setSending(true);
    r.expectLive = true;
    clearTimeout(r.slowTimer);
    r.slowTimer = setTimeout(() => {
      if (S.room !== r || !r.expectLive) return;
      const live = $('#dlgLive');
      if (live) live.innerHTML = '<span class="live slow"><i></i>응답이 늦어요 · <button data-act="to-orig">크랙 화면 확인</button></span>';
      toast('응답이 늦어요. 크랙 화면에 안내 창(크래커 부족, 점검 등)이 떴는지 확인해 주세요', 5000);
    }, 25000);
    r.log.push({ who: 'me', text, at: Date.now() });
    saveLog();
    v.send('crion:send', { text });
    const m = $('#msg');
    if (m) { m.value = ''; autosize(m); }
    $('#choices').innerHTML = '';
  }

  function onSent(d) {
    if (!d.ok) {
      setSending(false);
      toast('크랙 입력창을 찾지 못했어요. 원본 화면에서 대화를 열어 주세요.');
      setOrig(true);
      return;
    }
    if (S.room) {
      S.room.waiting = true;
      const live = $('#dlgLive');
      if (live) live.innerHTML = '<span class="live"><i></i>응답 기다리는 중</span>';
    }
  }

  function drawQuick() {
    const box = $('#quick');
    const r = S.room;
    if (!box || !r) return;
    const list = store.get(r.work.id).quick || [];
    box.innerHTML = list.map((q, i) => `<button class="qchip" data-act="quick" data-i="${i}" title="보내기">${esc(q)}</button>`).join('')
      + `<button class="qchip add" data-act="quick-edit" title="자주 쓰는 문장 등록">${I.plus}${list.length ? '' : ' 단축 문장'}</button>`;
  }
  function openQuickEdit() {
    const r = S.room;
    const list = store.get(r.work.id).quick || [];
    modal(`<header><h3>단축 문장</h3><button class="icon-btn" data-act="close-modal">${I.x}</button></header><div class="body">
      <p class="muted">이 작품에서 자주 보내는 말을 한 줄에 하나씩 적어 두세요(최대 8개). 입력창 위 버튼을 누르면 한 번 보내져요.</p>
      <textarea id="quickText" rows="6" class="field" placeholder="주변을 살핀다&#10;상태창을 확인한다&#10;잠시 쉰다">${esc(list.join('\n'))}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="quick-save">저장</button></div></div>`);
  }

  // 작품 BGM: 관리 페이지에서 올린 곡을 반복 재생
  function startBgm() {
    if (!bgm) return;
    const w = S.room && S.room.work;
    if (!w || !w.bgm) { bgm.stop(); return; }
    bgm.setVolume((S.settings.volume == null ? 60 : S.settings.volume) / 100);
    bgm.play(w.bgm);
  }

  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }

  // 크랙 응답 상자 모양: 첫 응답에서 배우고 기억해 둔다 (작품이 달라도 크랙 화면은 같다)
  function getLearned() { try { return JSON.parse(localStorage.getItem('crion.learned3') || 'null'); } catch (e) { return null; } }
  function setLearned(v) { try { localStorage.setItem('crion.learned3', JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } }

  // ---------- 그리기 ----------
  function render() {
    const app = $('#app');
    if (S.view === 'login') {
      app.innerHTML = topHtml() + loginHtml();
      bindWebview();
    } else if (S.view === 'room' && S.room) {
      app.innerHTML = topHtml() + roomHtml();
      renderSide();
      bindWebview();
      updateSendable();
      drawQuick();
      if (S.room.turn) drawBeat();
      startBgm();
    } else if (S.view === 'community') {
      app.innerHTML = topHtml() + communityHtml();
    } else {
      app.innerHTML = topHtml() + homeHtml();
    }
  }
  function renderTop() { const t = $('.top'); if (t) t.outerHTML = topHtml(); }
  function renderSide() { const s = $('#side'); if (s && S.room) s.innerHTML = sideHtml(); }
  function renderHome() { if (S.view === 'home') render(); }

  function bindWebview() {
    const v = wv();
    if (!v) return;
    v.addEventListener('dom-ready', () => {
      v.send('crion:config', { play: S.view === 'room', rules: window.CRACK_RULES || {}, learned: getLearned() });
    });
    v.addEventListener('did-fail-load', (e) => { if (e.errorCode !== -3) showCover('크랙에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.'); });
    v.addEventListener('ipc-message', (e) => {
      const d = e.args && e.args[0];
      switch (e.channel) {
        case 'crion:reply': onReply(d); break;
        case 'crion:state': onState(d); break;
        case 'crion:url': onUrl(d); break;
        case 'crion:sent': onSent(d); break;
        case 'crion:acted': if (!d.ok) toast('크랙에서 해당 버튼을 찾지 못했어요. 원본 화면에서 눌러 주세요.'); break;
        case 'crion:diag':
          if (S.waitDiag) { S.waitDiag = false; S.diagText = diagText(d); }
          else copy(diagText(d), '화면 진단을 복사했어요. 그대로 붙여서 보내 주세요.');
          break;
        case 'crion:clicked': if (!d.ok) { toast('크랙 버튼을 찾지 못했어요. 크랙 화면에서 눌러 주세요'); setOrig(true, false); } else showCover('여는 중이에요…'); break;
        case 'crion:learned': if (d && d.tag) setLearned(d); break;
        default: break;
      }
    });
  }

  function diagText(d) {
    return ['[CRION 화면 진단]', `앱 ${S.info.version} / 엔진 ${S.info.engineVersion} / ${S.info.platform}`,
      `작품: ${S.room ? S.room.work.name : '-'}`, `주소: ${d.url}`, `입력창: ${d.input}`, `보내기: ${d.send}`,
      `목록: ${d.list} (메시지 ${d.messages}개)`, '--- 마지막 메시지 2개 구조 ---', d.lastTwo,
      '--- 마지막 메시지 조각 ---', JSON.stringify(d.segs).slice(0, 3000)].join('\n');
  }

  function setImmersive(on) {
    const a = $('#app');
    if (!a) return;
    a.classList.toggle('immersive', on);
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch (e) { /* 전체 화면 안 됨 */ }
    if (on) toast('몰입 모드 · F 또는 Esc로 나가기');
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) $('#app').classList.remove('immersive'); });

  // 공략: 간단한 표기(# 제목, - 목록, **굵게**)만 그린다
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
  function openGuide() {
    const w = S.room && S.room.work;
    if (!w || !w.guide) return;
    modal(`<header><h3>${esc(w.name)} 공략</h3><button class="icon-btn" data-act="close-modal">${I.x}</button></header><div class="body guide">${mdLite(w.guide)}</div>`, true);
  }

  // ---------- 모달 ----------
  function modal(html, wide) {
    $('#layer').innerHTML = `<div class="scrim" data-act="close-modal"><div class="modal ${wide ? 'wide' : ''}" role="dialog">${html}</div></div>`;
  }
  const closeModal = () => { $('#layer').innerHTML = ''; };
  const pseg = (key, opts) => `<span class="seg">${opts.map(([v, l]) => `<button data-act="pref" data-k="${key}" data-v="${v}" class="${String(P[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
  const seg = (key, opts) => `<span class="seg">${opts.map(([v, l]) => `<button data-act="set" data-k="${key}" data-v="${v}" class="${String(S.settings[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;

  function openSettings() {
    const i = S.info;
    modal(`<header><h3>설정</h3><button class="icon-btn" data-act="close-modal">${I.x}</button></header><div class="body">
      <div class="set"><div class="lbl"><b>글자 나오는 속도</b><span>지난 장면을 다시 볼 때</span></div>${seg('textSpeed', [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게'], ['instant', '바로']])}</div>
      <div class="set"><div class="lbl"><b>글자 크기</b><span>대사창</span></div>${pseg('font', [['s', '작게'], ['m', '보통'], ['l', '크게']])}</div>
      <div class="set"><div class="lbl"><b>자동 진행</b><span>응답을 다 받으면 장면을 저절로 넘김</span></div>${pseg('auto', [[false, '끄기'], [true, '켜기']])}</div>
      <div class="set"><div class="lbl"><b>대사창</b><span>배경 그림이 잘 보이게 옅게, 글이 잘 보이게 진하게</span></div>${pseg('dlg', [['soft', '옅게'], ['normal', '보통'], ['strong', '진하게']])}</div>
      <div class="set"><div class="lbl"><b>선택지를 누르면</b><span>바로 보내거나 입력창에만 넣기</span></div>${seg('choiceSend', [['true', '바로 보내기'], ['false', '입력창에 넣기']])}</div>
      <div class="set"><div class="lbl"><b>자동 업데이트</b><span>화면 엔진·작품 목록</span></div>${seg('autoUpdate', [['true', '켜기'], ['false', '끄기']])}</div>
      <div class="set"><div class="lbl"><b>작품 목록</b><span>${S.syncedAt ? '마지막 ' + new Date(S.syncedAt).toLocaleString('ko-KR') : '아직 안 읽음'}</span></div>
        <button class="btn sm" data-act="sync">${I.sync}새로고침</button><button class="btn sm" data-act="sync-diag">목록 진단 복사</button></div>
      <div class="set"><div class="lbl"><b>문제 보고</b><span>플레이 중 화면이 이상하면 진단을 복사해서 보내 주세요</span></div>
        <button class="btn sm" data-act="diag" ${S.room ? '' : 'disabled'}>화면 진단 복사</button></div>
      <div class="set"><div class="lbl"><b>업데이트</b><span>앱 ${esc(i.version)} · 화면 엔진 ${esc(i.engineVersion)}${i.engineSource === 'update' ? ' (업데이트됨)' : ''}</span></div>
        <button class="btn sm" data-act="check-update">지금 확인</button><button class="btn sm ghost" data-act="open-folder">데이터 폴더</button></div>
    </div>`);
  }

  function openLog() {
    const r = S.room;
    if (!r) return;
    const items = r.log.slice(-80).reverse();
    modal(`<header><h3>지난 대화</h3><button class="icon-btn" data-act="close-modal">${I.x}</button></header><div class="body">
      ${items.length ? items.map(x => `<div class="log-item ${x.who === 'me' ? 'me' : ''}"><small>${x.who === 'me' ? '나' : esc(r.work.name)} · ${new Date(x.at).toLocaleString('ko-KR')}</small>${esc(x.text)}</div>`).join('') : '<p class="muted">아직 기록이 없어요.</p>'}
    </div>`, true);
  }

  // ---------- 동작 ----------
  async function openWork(id, fresh) {
    const w = workById(id);
    if (!w) return;
    S.work = w;
    S.room = newRoom(w, fresh);
    S.view = 'room';
    const recent = [w.id].concat((S.settings.recent || []).filter(x => x !== w.id)).slice(0, 8);
    save({ recent });
    render();
  }

  async function doSync(diag) {
    if (S.syncing) return;
    S.syncing = true;
    renderHome();
    const [r] = await Promise.all([api.syncWorks(), api.checkUpdates().catch(() => null), loadNotice()]);
    S.syncing = false;
    await loadWorks();
    renderHome();
    if (diag) {
      copy(['[CRION 목록 진단]', `결과: ${r.ok ? '성공' : '실패'} ${r.error || ''}`, `페이지: ${r.page || '-'} / ${r.title || '-'}`, `찾은 작품 ${r.count || 0}개`,
        ...(r.sample || []).map(x => `- ${x.title} | ${x.url} | ${x.thumb || '썸네일 없음'}`),
        '--- 소개 글 ---', ...(r.sample || []).map(x => `# ${x.title}\n${(x.text || '').replace(/\s+/g, ' ').slice(0, 220)}`)].join('\n'), '목록 진단을 복사했어요. 붙여서 보내 주세요.');
    } else toast(r.ok ? `작품 ${r.count}개를 불러왔어요` : '목록을 못 읽었어요. 크랙에 로그인한 뒤 다시 눌러 주세요.');
  }

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) {
      if (e.target.closest('#dlg') && !window.getSelection().toString()) step(1);
      return;
    }
    const act = el.dataset.act;
    if (act === 'close-modal' && el.classList.contains('scrim') && e.target !== el) return;
    switch (act) {
      case 'home': S.view = 'home'; S.room = null; S.work = null; if (bgm) bgm.stop(); render(); break;
      case 'login': if (bgm) bgm.stop(); S.view = 'login'; S.room = null; S.work = null; render(); break;
      case 'login-done': S.view = 'home'; await save({ onboarded: true }); render(); doSync(false); break;
      case 'play': closeModal(); openWork(el.dataset.id); break;
      case 'play-fresh': closeModal(); openWork(el.dataset.id, true); break;
      case 'info': openInfo(el.dataset.id); break;
      case 'info-tab': openInfo(el.dataset.id, el.dataset.tab); break;
      case 'side-tab': S.room.tab = el.dataset.tab; renderSide(); break;
      case 'view-img': modal(`<div class="lightbox"><img src="${esc(el.dataset.src)}" alt=""><button class="icon-btn close-x" data-act="close-modal">${I.x}</button></div>`, true); break;
      case 'star': {
        const r = S.room;
        const b = r && r.turn && r.turn.beats[r.idx];
        if (!b || !b.text) break;
        const on = store.toggleQuote(r.work.id, { who: b.who, text: b.text });
        el.classList.toggle('on', on);
        toast(on ? '명대사에 모았어요' : '별표를 뺐어요');
        if (r.tab === 'quotes') renderSide();
        break;
      }
      case 'unquote': {
        store.toggleQuote(el.dataset.w, { who: el.dataset.who, text: el.dataset.text });
        if (S.room) renderSide();
        if ($('#layer').innerHTML) openInfo(el.dataset.w, 'quotes');
        break;
      }
      case 'quick': { const q = (store.get(S.room.work.id).quick || [])[Number(el.dataset.i)]; if (q) sendText(q); break; }
      case 'quick-edit': openQuickEdit(); break;
      case 'quick-save': store.setQuick(S.room.work.id, $('#quickText').value.split('\n')); closeModal(); drawQuick(); break;
      case 'music': if (bgm) { bgm.toggle(); renderTop(); } break;
      case 'settings': openSettings(); break;
      case 'close-modal': closeModal(); break;
      case 'sync': doSync(false); break;
      case 'sync-diag': doSync(true); break;
      case 'diag': { const v = wv(); if (v) v.send('crion:diag'); closeModal(); break; }
      case 'check-update': { const r = await api.checkUpdates(); toast(r.skipped === 'no-registry' ? '업데이트 주소가 없어요' : r.error ? '확인 실패: ' + r.error : r.engine ? '새 화면 엔진을 받았어요. 다시 시작하면 적용돼요' : '최신 상태예요'); break; }
      case 'open-folder': api.openFolder(); break;
      case 'set': {
        let v = el.dataset.v;
        if (v === 'true' || v === 'false') v = v === 'true';
        await save({ [el.dataset.k]: v });
        el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
        break;
      }
      case 'toggle-side': S.room.side = !S.room.side; $('#room').classList.toggle('side-off', !S.room.side); break;
      case 'to-orig': setOrig(true, false); break;
      case 'to-game': setOrig(false, false); break;
      case 'send': sendText($('#msg').value); break;
      case 'continue': sendText('계속'); break;
      case 'regen': { const v = wv(); if (v) { S.room.expectLive = true; v.send('crion:action', 'regen'); } break; }
      case 'log': openLog(); break;
      case 'community': if (bgm) bgm.stop(); S.view = 'community'; S.room = null; S.work = null; render(); loadNotice().then(() => { if (S.view === 'community') render(); }); break;
      case 'form-kind': S.form.kind = el.dataset.kind; render(); break;
      case 'form-send': sendForm(el.dataset.kind); break;
      case 'report-here': openReport(); break;
      case 'start': { const v = wv(); if (v) v.send('crion:click', Number(el.dataset.id)); break; }
      case 'guide': openGuide(); break;
      case 'immersive': setImmersive(!$('#app').classList.contains('immersive')); break;
      case 'pref': {
        let v = el.dataset.v;
        if (v === 'true' || v === 'false') v = v === 'true';
        savePref(el.dataset.k, v);
        el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
        break;
      }
      case 'prev': step(-1); break;
      case 'next': step(1); break;
      case 'first': if (S.room && S.room.turn) { S.room.idx = 0; S.room.typed = false; S.room.follow = false; drawBeat(); } break;
      case 'choose': {
        const t = S.room && S.room.turn;
        const c = t && t.choices[Number(el.dataset.i)];
        if (!c) break;
        if (S.settings.choiceSend === false) { const m = $('#msg'); m.value = c; autosize(m); m.focus(); }
        else sendText(c);
        break;
      }
      case 'close-notice': try { localStorage.setItem(noticeId(S.notice), '1'); } catch (e2) { /* 무시 */ } renderHome(); break;
      case 'open-link': api.openExternal(el.dataset.url); break;
      case 'copy-status': if (S.room && S.room.status) copy(S.room.status.text); break;
      default: break;
    }
  });

  document.addEventListener('input', (e) => { if (e.target.id === 'msg') autosize(e.target); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#layer').innerHTML) closeModal();
      else if ($('#app').classList.contains('immersive')) setImmersive(false);
      return;
    }
    const inText = /^(TEXTAREA|INPUT)$/.test(e.target.tagName);
    if (e.target.id === 'msg' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendText(e.target.value); return; }
    if (inText || !S.room || S.room.orig || $('#layer').innerHTML) return;
    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'f' || e.key === 'F' || e.key === 'F11') { e.preventDefault(); setImmersive(!$('#app').classList.contains('immersive')); }
    else if (/^[1-6]$/.test(e.key)) { const b = document.querySelector(`.choice[data-i="${Number(e.key) - 1}"]`); if (b) b.click(); }
  });

  // ---------- 시작 ----------
  api.onUpdate((ev) => {
    if (ev.type === 'catalog') Promise.all([loadWorks(), loadNotice()]).then(renderHome);
    else if (ev.type === 'engine-ready') toast('새 화면이 준비됐어요. 앱을 다시 시작하면 적용돼요', 5000);
    else if (ev.type === 'shell-old') toast('새 버전 설치 파일이 필요해요. 설정 > 업데이트를 확인해 주세요', 6000);
  });

  (async function boot() {
    S.info = await api.info();
    S.settings = await api.getSettings();
    if (S.settings.choiceSend === undefined) S.settings.choiceSend = true;
    await loadWorks();
    applyPrefs();
    render();
    api.engineReady();
    if (!S.syncedAt) doSync(false);
    else loadNotice().then(renderHome);
    setInterval(() => loadNotice().then(renderHome), 30 * 60 * 1000);
  })();

  // 플레이 시간: 플레이 화면이 열려 있고 창을 보고 있을 때만 센다
  setInterval(() => { if (S.view === 'room' && S.room && document.hasFocus()) store.addTime(S.room.work.id, 30000); }, 30000);

  // 시험용
  window.__crion = { S, onReply, onState, render, step };
})();
