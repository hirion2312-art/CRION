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

  const S = {
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
      tools += `<button class="icon-btn" data-act="immersive" title="몰입 모드 (F)">${I.full}</button>`;
      tools += `<button class="icon-btn" data-act="toggle-side" title="옆 패널">${I.side}</button>`;
    }
    if (S.view === 'home') tools += `<button class="btn" data-act="login">${I.user}크랙 로그인</button>`;
    tools += `<button class="icon-btn" data-act="settings" title="설정">${I.gear}</button>`;
    return `<header class="top"><div class="brand"><svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#14161b"/><path d="M18 17h28a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7H31l-10 8v-8h-3a7 7 0 0 1-7-7V24a7 7 0 0 1 7-7z" fill="#fff"/><path d="M28 24.5 40 31l-12 6.5z" fill="#5b5bd6"/></svg>CRION</div><div class="crumb">${crumb}</div><div class="tools">${tools}</div></header>`;
  }

  // ---------- 홈 ----------
  function homeHtml() {
    const recent = (S.settings.recent || []).map(workById).filter(Boolean).slice(0, 4);
    const cont = recent.length ? `
      <div class="section-h"><h2>이어하기</h2></div>
      <div class="continue">${recent.map(w => `
        <button class="cont" data-act="play" data-id="${esc(w.id)}">
          ${thumbHtml(w, 'mini')}
          <div><b>${esc(w.name)}</b><span>${S.settings.workUrls[w.id] ? '마지막 대화로 바로 이어져요' : '작품 페이지부터 열려요'}</span></div>
          <span class="go">이어하기 →</span>
        </button>`).join('')}</div>` : '';
    const syncLine = S.syncing ? '<span class="spin"></span> 작가 프로필에서 작품을 불러오는 중'
      : S.syncedAt ? `프로필 기준 ${new Date(S.syncedAt).toLocaleDateString('ko-KR')} 업데이트` : '';
    const cards = S.works.map(w => `
      <button class="card" data-act="play" data-id="${esc(w.id)}" title="${esc(w.name)}">
        <div class="thumb">${thumbInner(w)}
          ${w.auto ? '<span class="tag">새 작품</span>' : ''}
          <span class="play">${I.play} 플레이</span>
        </div>
        <div class="meta"><b>${esc(w.name)}</b><span>${esc(w.genre || (w.url ? '' : '주소 확인 중'))}</span></div>
      </button>`).join('');
    const needSync = !S.works.some(w => w.url);
    return `<main class="home"><div class="home-in">
      ${noticeHtml()}
      <div class="hello"><div><h1>히리온 작품</h1><p>작품을 누르면 바로 게임 화면으로 플레이해요.</p></div>
        <div style="display:flex;gap:8px"><button class="btn" data-act="sync" ${S.syncing ? 'disabled' : ''}>${I.sync}목록 새로고침</button></div></div>
      ${!S.settings.onboarded ? `<div class="welcome"><div><b>처음 오셨나요?</b><span>① 크랙에 로그인 → ② 작품 고르기. 로그인은 한 번만 하면 돼요.</span></div>
        <button class="btn primary" data-act="login">${I.user}크랙 로그인하기</button></div>`
        : needSync && !S.syncing ? `<div class="note">작품 주소를 아직 못 불러왔어요. <b>목록 새로고침</b>을 눌러 주세요. 계속 안 되면 설정의 <b>목록 진단 복사</b> 결과를 보내 주세요.</div>` : ''}
      ${cont}
      <div class="section-h"><h2>전체 작품</h2><span class="sub">${S.works.length}개</span><span class="right muted">${syncLine}</span></div>
      <div class="grid">${cards}</div>
    </div></main>`;
  }

  // ---------- 크랙 로그인 화면 ----------
  function loginHtml() {
    return `<div class="login">
      <div class="hint"><b>크랙 로그인</b><span>여기서 한 번 로그인해 두면 모든 작품에서 계속 로그인돼 있어요.</span>
        <button class="btn primary sm" data-act="login-done">로그인 완료</button></div>
      <webview id="crack" src="${esc(S.info.crackOrigin)}" partition="persist:crack" allowpopups></webview></div>`;
  }

  // ---------- 플레이 화면 ----------
  function newRoom(work) {
    return {
      work, url: S.settings.workUrls[work.id] || work.url || S.creatorUrl || S.info.crackOrigin,
      orig: true, autoOrig: true, side: true,
      turn: null,        // { key, segs, beats, frames, status, choices, done, live }
      idx: 0, typed: true, follow: false,
      status: null, waiting: false, hasInput: false,
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
            <h2>${esc(w.name)}</h2><p id="coverText">크랙 화면을 불러오는 중이에요…</p></div></div>
          <div class="choices" id="choices"></div>
          <div class="dlg hidden" id="dlg" tabindex="0">
            <div class="name hidden" id="dlgName"></div>
            <div class="text" id="dlgText"></div>
            <div class="foot"><span class="pos" id="dlgPos"></span><span id="dlgLive"></span>
              <span class="nav"><button data-act="prev">◀ 이전</button><button data-act="first">처음부터</button><button data-act="next">다음 ▶</button></span></div>
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
        </div>
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
    return `<div class="side-in">
      <div class="work-head">${thumbHtml(w, 'mini')}<div><b>${esc(w.name)}</b><span>${esc(w.genre || '')}</span></div></div>
      <div class="panel"><h4>상태<span class="right">${st ? `<button class="btn ghost sm" data-act="copy-status">복사</button>` : ''}</span></h4>${stHtml}</div>
      <div class="panel"><h4>조작</h4><div class="muted">화면 클릭 · Space · → 다음<br>← 이전 · 1~6 선택지 · F 몰입 모드</div></div>
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

  function showCover(text) {
    const c = $('#cover');
    if (!c) return;
    c.classList.toggle('hidden', !text);
    if (text) $('#coverText').textContent = text;
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
    if (d.waiting) {
      r.waiting = true;
      if (!r.orig) { $('#dlgLive') && ($('#dlgLive').innerHTML = '<span class="live"><i></i>응답 기다리는 중</span>'); }
      drawChoices();
    }
    if (r.hasInput && r.autoOrig && r.orig && !r.turn) {
      // 대화창은 열렸는데 아직 응답이 없을 때: 게임 화면으로 넘어가 첫 입력을 기다린다
      setOrig(false, false);
      showCover(getLearned() ? '이어서 진행해 보세요. 아래 입력창에 쓰고 보내면 돼요.'
        : '아래 입력창에 첫 행동을 보내 주세요. 첫 응답을 받으면서 이 작품 화면을 맞춰요. (지난 대화는 크랙 원본 화면 버튼으로 볼 수 있어요)');
    }
  }

  function onUrl(d) {
    const r = S.room;
    if (!r || !d.url) return;
    r.url = d.url;
    // 대화방 주소를 '이어하기' 주소로 기억 (작품 소개·프로필 페이지는 제외)
    if (r.hasInput || /\/(chat|room|c|episodes?|play)\b/i.test(d.url)) {
      const urls = Object.assign({}, S.settings.workUrls, { [r.work.id]: d.url });
      save({ workUrls: urls });
    }
  }

  // ---------- 보내기 ----------
  let sendGuard = null;
  function setSending(on) {
    const b = $('#sendBtn');
    if (b) b.disabled = !!on;
    clearTimeout(sendGuard);
    if (on) sendGuard = setTimeout(() => setSending(false), 8000);
  }
  function wv() { return $('#crack'); }

  function sendText(text) {
    const r = S.room;
    text = String(text || '').trim();
    if (!r || !text) return;
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

  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }

  // 크랙 응답 상자 모양: 첫 응답에서 배우고 기억해 둔다 (작품이 달라도 크랙 화면은 같다)
  function getLearned() { try { return JSON.parse(localStorage.getItem('crion.learned2') || 'null'); } catch (e) { return null; } }
  function setLearned(v) { try { localStorage.setItem('crion.learned2', JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } }

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
      if (S.room.turn) drawBeat();
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
        case 'crion:diag': copy(diagText(d), '화면 진단을 복사했어요. 그대로 붙여서 보내 주세요.'); break;
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
  async function openWork(id) {
    const w = workById(id);
    if (!w) return;
    S.work = w;
    S.room = newRoom(w);
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
        ...(r.sample || []).map(x => `- ${x.title} | ${x.url} | ${x.thumb ? 'thumb' : 'no-thumb'}`)].join('\n'), '목록 진단을 복사했어요. 붙여서 보내 주세요.');
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
      case 'home': S.view = 'home'; S.room = null; S.work = null; render(); break;
      case 'login': S.view = 'login'; S.room = null; S.work = null; render(); break;
      case 'login-done': S.view = 'home'; await save({ onboarded: true }); render(); doSync(false); break;
      case 'play': openWork(el.dataset.id); break;
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

  // 시험용
  window.__crion = { S, onReply, onState, render, step };
})();
