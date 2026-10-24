// CRION 화면 로직
(function () {
  'use strict';
  const api = window.crion;
  const P = window.CrionParser;
  const Game = window.CrionGame;
  const isV2 = (p) => !!(p && p.schemaVersion >= 2 && /^(vn|hud|hybrid)$/.test(p.mode) && Game && window.CrionPlay);
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const svg = (d, w) => `<svg width="${w || 18}" height="${w || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    home: svg('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
    chev: svg('<path d="m9 6 6 6-6 6"/>', 14),
    music: svg('<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/>', 20),
    dash: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 15v-3M12 15V9M17 15v-5"/>'),
    alert: svg('<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/>'),
    shield: svg('<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>', 16),
    pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>'
  };

  const S = {
    info: null, settings: null, works: [], installed: [], available: [],
    view: 'onboard', work: null, room: null, modal: null, dismissed: {}, game: null, banner: null
  };
  const bgm = new window.CrionBgm();
  const bgmErr = () => { bgm.onError = () => { if (S.room) { S.room.bgmMissing = true; renderAside(); } }; };
  bgmErr();

  // ---------- 데이터 ----------
  async function refreshPacks() {
    const r = await api.listPacks();
    S.installed = r.installed || [];
    S.available = r.available || [];
  }
  const installedPack = (id) => S.installed.find(p => p.id === id) || null;
  const isAvailable = (id) => S.available.some(p => p.id === id);
  const packOn = (id) => S.settings.packEnabled[id] !== false;
  const packOpts = (id) => S.settings.packOptions[id] || {};
  const workUrl = (w) => (w && (S.settings.workUrls[w.id] || w.url)) || S.info.crackOrigin;
  async function save(patch) { S.settings = await api.setSettings(patch); }

  // ---------- 공통 조각 ----------
  function topHtml() {
    let crumb = '';
    let tools = '';
    if (S.view === 'room') {
      const title = S.work ? S.work.name : '크랙 로그인';
      const p = S.room.pack;
      let pill = '<span class="pill off"><i></i>기본 화면</span>';
      if (p) pill = packOn(p.id) ? '<span class="pill on"><i></i>전용 팩 적용 중</span>' : '<span class="pill off"><i></i>팩 꺼짐</span>';
      crumb = `<button class="link" data-act="home">홈</button><span style="color:#9ca3af">${ICON.chev}</span><span class="title">${esc(title)}</span>${S.work ? pill : ''}`;
      if (p) tools += `<button class="switch" data-act="toggle-pack" aria-pressed="${packOn(p.id)}"><span>팩</span><span class="track"></span></button>`;
    }
    tools += `<button class="icon-btn" data-act="settings" aria-label="설정">${ICON.gear}</button>`;
    return `<header class="top"><div class="brand"><span class="logo">C</span><b>CRION</b></div><div class="crumb">${crumb}</div><div class="tools">${tools}</div></header>`;
  }

  function navHtml() {
    const packs = S.installed.map(p => {
      const w = S.works.find(x => x.pack === p.id);
      const on = S.view === 'room' && S.room && S.room.pack && S.room.pack.id === p.id;
      return `<button class="pack-item ${on ? 'on' : ''}" data-act="open-work" data-id="${esc(w ? w.id : '')}">
        <span class="badge" style="background:${esc(p.tint || '#f0f1f4')};color:${esc(p.tintText || '#4b5262')}">${esc(p.short || p.name.slice(0, 1))}</span>
        <span class="two"><b>${esc(p.name)}</b><span>팩 v${esc(p.version)}</span></span></button>`;
    }).join('');
    return `<nav class="nav" aria-label="CRION 메뉴">
      <div class="items">
        <button class="nav-btn ${S.view === 'home' ? 'on' : ''}" data-act="home">${ICON.home}<span>홈</span></button>
        <button class="nav-btn" data-act="settings">${ICON.gear}<span>설정</span></button>
      </div>
      <div class="items"><h6>설치된 팩</h6>${packs || '<span class="empty" style="padding:0 12px;margin:0">아직 없어요. 작품에 들어가면 설치를 권해 드려요.</span>'}</div>
      <div class="foot">CRION ${esc(S.info.version)}</div>
    </nav>`;
  }

  // ---------- 화면 ----------
  function render() {
    if (S.view !== 'room') bgm.stop();
    const app = $('#app');
    if (S.view === 'onboard') {
      app.innerHTML = topHtml() + `<main class="onboard">
        <div class="pitch">
          <span class="tag" style="align-self:flex-start;background:#f0f1f4;color:#4b5262">히리온 작품 전용 클라이언트</span>
          <h1>히리온 작품을<br>더 깊게 플레이하세요.</h1>
          <p>작품에 들어가면 전용 팩이 알아서 설치돼요. 크랙만으로는 없던 음악, 상태창 대시보드, 장면 연출이 함께 켜져요.</p>
          <div class="feat"><span class="ic">${ICON.music}</span><span><b>장면마다 바뀌는 BGM</b> <span>— 상황에 맞게 곡이 흘러요</span></span></div>
          <div class="feat"><span class="ic">${ICON.dash}</span><span><b>상태창 대시보드</b> <span>— 자원 변화가 한눈에 보여요</span></span></div>
          <div class="feat"><span class="ic">${ICON.alert}</span><span><b>장면 연출과 경보</b> <span>— 위기가 오면 화면이 먼저 알려 줘요</span></span></div>
        </div>
        <div class="start">
          <b style="font-size:20px;font-weight:800">시작하기</b>
          <span style="color:#4b5262">평소 쓰던 크랙 계정으로 로그인하면 바로 플레이할 수 있어요.</span>
          <button class="btn dark big" data-act="login">크랙 계정으로 계속하기</button>
          <div class="hint">${ICON.shield}<span>로그인은 크랙 공식 화면에서 진행돼요. CRION은 비밀번호를 받거나 저장하지 않아요.</span></div>
        </div></main>`;
      return;
    }
    if (S.view === 'home') {
      const notices = S.works.filter(w => w.isNew && w.pack).map(w => `<div class="notice">
          <span class="tag" style="background:${esc(w.tint)};color:${esc(w.tintText)}">전용 팩 출시</span>
          <span style="flex:1 1 280px;min-width:0"><b>${esc(w.name)}</b> <span style="color:#4b5262">— 들어가면 바로 설치할 수 있어요.</span></span>
          <button class="btn dark" data-act="open-work" data-id="${esc(w.id)}">바로 플레이</button></div>`).join('');
      const cards = S.works.map(w => {
        const inst = w.pack && installedPack(w.pack);
        const corner = inst ? '팩 설치됨' : (w.pack ? '전용 팩' : '');
        const meta = w.pack
          ? (inst ? '팩 적용 · ' + (inst.features || []).join(' · ') : '전용 팩 있음 · 들어가면 설치를 권해요')
          : '전용 팩 준비 중 · 기본 화면으로 플레이';
        return `<article class="work">
          <div class="cover" style="background:${esc(w.tint)}">
            <small style="color:${esc(w.tintText)}">${esc(w.genre)}</small><b>${esc(w.name)}</b>
            ${corner ? `<span class="corner" style="color:${esc(w.tintText)}">${corner}</span>` : ''}
          </div>
          <div class="meta"><span>${esc(meta)}</span>
            <button class="btn ${w.pack ? 'dark' : 'light'}" data-act="open-work" data-id="${esc(w.id)}">플레이</button></div>
        </article>`;
      }).join('');
      app.innerHTML = topHtml() + `<div class="body">${navHtml()}<main class="home">
        <div><h1>히리온 작품</h1><p class="lead">작품을 고르면 크랙 채팅방이 이 창 안에서 열려요.</p></div>
        ${notices}<div class="grid">${cards}</div></main></div>`;
      return;
    }
  }

  // ---------- 플레이 화면 ----------
  function openRoom(work) {
    const pack = work && work.pack ? installedPack(work.pack) : null;
    const v2 = isV2(pack) && packOn(pack.id);
    if (S.game) { S.game.destroy(); S.game = null; }
    S.view = 'room';
    S.work = work;
    S.room = { pack, v2, status: null, delta: {}, scene: null, lastText: null, lastKey: null, url: '', bgmMissing: false, chatOpen: true, firstReply: true };
    bgm.stop();
    const app = $('#app');
    if (v2) {
      app.innerHTML = topHtml() + `<div class="body"><div class="room v2 chat-open" id="room" style="background:${esc((pack.theme || {}).bg || '#0e1432')}">
        <div class="gameroot" id="gameRoot"></div>
        <div class="chatdock" id="dock">
          <div class="dockbar"><b>크랙 채팅</b><span>입력하고 보내는 건 여기서 해요</span><button class="btn line" data-act="chat-close">게임 화면으로</button></div>
          <div class="stage" id="stage">
            <div class="urlbar" id="urlbar"><span>이 작품의 크랙 주소가 아직 없어요. 작품 화면을 연 뒤 저장하면 다음부터 바로 열려요.</span><button class="btn line" data-act="save-url">지금 페이지를 작품 주소로 저장</button></div>
          </div>
        </div></div></div>`;
    } else {
      bgmErr();
      app.innerHTML = topHtml() + `<div class="body">${navHtml()}<div class="room">
      <div class="stage" id="stage">
        <div class="scene-bar" id="sceneBar"></div>
        <div class="alert" id="alert"><span class="tape"></span><span id="alertText"></span><small id="alertSub"></small></div>
        <div class="urlbar" id="urlbar"><span>이 작품의 크랙 주소가 아직 없어요. 작품 화면을 연 뒤 저장하면 다음부터 바로 열려요.</span><button class="btn line" data-act="save-url">지금 페이지를 작품 주소로 저장</button></div>
      </div>
      <aside class="aside" id="aside"></aside></div></div>`;
    }

    const wv = document.createElement('webview');
    wv.id = 'crack';
    wv.setAttribute('partition', 'persist:crack');
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('src', workUrl(work));
    wv.addEventListener('dom-ready', sendConfig);
    wv.addEventListener('ipc-message', (e) => {
      const d = e.args && e.args[0];
      if (e.channel === 'crion:status') onStatus(d);
      else if (e.channel === 'crion:ready') sendConfig();
      else if (e.channel === 'crion:url') {
        if (S.room.url && d.url !== S.room.url) resetStatus();
        S.room.url = d.url;
        updateUrlbar();
      }
      else if (e.channel === 'crion:filled') onFilled(d);
      else if (e.channel === 'crion:diag') onDiag(d);
    });
    wv.addEventListener('did-navigate', (e) => { S.room.url = e.url; updateUrlbar(); });
    $('#stage').appendChild(wv);

    if (v2) {
      S.game = Game.mount($('#gameRoot'), {
        pack, audio: bgm, settings: () => S.settings,
        fill: fillInput, openChat: () => setChat(true), copy: copyText
      });
    }
    updateUrlbar();
    if (!v2) { applyScene(); renderAside(); }
    if (work && work.pack && !pack && isAvailable(work.pack) && !S.dismissed[work.pack]) {
      S.modal = { type: 'offer', id: work.pack };
      renderModal();
    }
  }

  function setChat(open) {
    const r = $('#room');
    if (!r || !S.room) return;
    S.room.chatOpen = !!open;
    r.classList.toggle('chat-open', !!open);
    if (open) { const wv = $('#crack'); if (wv && wv.focus) try { wv.focus(); } catch (e) { /* 준비 전 */ } }
  }

  async function copyText(t) {
    try { await navigator.clipboard.writeText(String(t)); toast('복사했어요'); }
    catch (e) { toast('복사하지 못했어요'); }
  }

  // 선택지 글을 크랙 입력창에 채운다. 전송은 플레이어가 직접.
  function fillInput(text) {
    const wv = $('#crack');
    if (!wv || !S.room) return;
    S.room.pendingFill = text;
    try { wv.send('crion:fill', text); } catch (e) { /* 준비 전 */ }
    setChat(true);
    clearTimeout(S.room.fillT);
    S.room.fillT = setTimeout(() => {
      if (S.room && S.room.pendingFill) {
        copyText(S.room.pendingFill);
        toast('입력창을 못 찾아서 글을 복사해 뒀어요. 붙여넣고 보내 주세요');
        S.room.pendingFill = null;
      }
    }, 1500);
  }
  function onFilled(d) {
    if (!S.room) return;
    clearTimeout(S.room.fillT);
    if (S.room.pendingFill && d && d.ok) toast('입력창에 채웠어요 · 보내기는 직접 눌러 주세요');
    S.room.pendingFill = null;
  }

  // 크랙 화면 구조 진단: 인식이 안 될 때 복사해서 보내 주면 규칙을 맞출 수 있다
  function requestDiag() {
    const wv = $('#crack');
    if (!wv) { toast('작품 화면을 연 뒤에 눌러 주세요'); return; }
    try { wv.send('crion:diag'); } catch (e) { toast('아직 준비 중이에요'); }
  }
  function onDiag(d) {
    const txt = '[CRION 진단 ' + S.info.version + ' / 엔진 ' + S.info.engineVersion + ']\n' + JSON.stringify(d, null, 1);
    copyText(txt);
  }

  function resetStatus() {
    S.room.status = null; S.room.delta = {}; S.room.scene = null; S.room.lastText = null; S.room.lastKey = null;
    if (S.room.v2) return;
    applyScene(); renderAside();
  }

  function sendConfig() {
    const wv = $('#crack');
    if (!wv || !S.room) return;
    const p = S.room.pack;
    const cfg = p && packOn(p.id)
      ? {
          detect: p.status.detect,
          anchor: p.status.anchor,
          hide: !!p.hideStatusInChat,
          reply: !!S.room.v2,
          lineHint: (p.status.lineHint || (p.status.fields || []).map(f => f.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).concat(['📍']).join('|')),
          chipText: '상태창 → CRION 대시보드 (눌러서 펼치기)'
        }
      : null;
    try { wv.send('crion:config', cfg); } catch (e) { /* 아직 준비 전 */ }
  }

  function onStatus(d) {
    const p = S.room && S.room.pack;
    if (!p || !packOn(p.id) || !d || !d.text) return;
    if (!P.isStatus(p, d.text)) return;
    if (S.room.v2) {
      if (d.key && d.key === S.room.lastKey) return;
      S.room.lastKey = d.key || null;
      const st2 = P.parseStatus(p, d.text);
      S.room.delta = S.room.status ? P.diff(S.room.status, st2) : {};
      S.room.status = st2;
      if (S.game) S.game.onReply({ parsed: st2, delta: S.room.delta, text: d.text, reply: d.reply || '', imgs: d.imgs || [] });
      if (S.room.chatOpen && S.room.firstReply) {
        S.room.firstReply = false;
        setChat(false);
        toast('게임 화면으로 바꿨어요 · 오른쪽 위 💬로 채팅을 볼 수 있어요');
      }
      return;
    }
    if (d.text === S.room.lastText) return;
    const st = P.parseStatus(p, d.text);
    S.room.delta = S.room.status ? P.diff(S.room.status, st) : {};
    S.room.scene = P.decideScene(p, packOpts(p.id), st, d.narration, S.room.scene);
    S.room.status = st;
    S.room.lastText = d.text;
    applyScene();
    renderAside();
  }

  function applyScene() {
    const bar = $('#sceneBar'), alert = $('#alert');
    if (!bar || !S.room || S.room.v2) return;
    const p = S.room.pack;
    const on = p && packOn(p.id);
    const sc = on && S.room.scene ? p.scenes[S.room.scene] : null;
    const low = S.settings.intensity === 'low';
    bar.style.background = sc && !low ? sc.color : '';
    if (sc && sc.alert && !low) {
      alert.classList.add('show');
      $('#alertText').textContent = sc.alert;
      $('#alertSub').textContent = S.room.status && S.room.status.day ? 'D' + S.room.status.day : '';
    } else {
      alert.classList.remove('show');
    }
    if (sc && sc.bgm) { S.room.bgmMissing = false; bgm.play(`crionpack://${p.id}/${sc.bgm}`); }
    else if (!on) bgm.stop();
  }

  function updateUrlbar() {
    const bar = $('#urlbar');
    if (!bar) return;
    const need = S.work && !S.settings.workUrls[S.work.id] && !S.work.url;
    const onCrack = S.room.url && S.room.url.startsWith(S.info.crackOrigin) && S.room.url.replace(/\/+$/, '') !== S.info.crackOrigin;
    bar.classList.toggle('show', !!(need && onCrack));
  }

  function fieldValue(f, v) {
    if (v == null) return '—';
    if (f.type === 'ratio') return v.max != null ? `${v.value} / ${v.max}` : String(v.value);
    return String(v) + (f.suffix || '');
  }

  function renderAside() {
    const el = $('#aside');
    if (!el) return;
    const w = S.work, p = S.room.pack;
    if (!w) {
      el.innerHTML = `<section class="card"><h3>로그인을 마쳤나요?</h3><p class="empty">왼쪽 크랙 화면에서 로그인하면 이 창이 기억해요. 다 됐으면 홈에서 작품을 고르세요.</p>
        <button class="btn dark" style="width:100%;margin-top:12px" data-act="home">홈으로</button></section>`;
      return;
    }
    if (w.pack && !p) {
      const feats = (w.packFeatures || []).map(f => `<div class="row" style="justify-content:flex-start"><span style="flex:none;width:88px;color:#111318;font-weight:600">${esc(f[0])}</span><span style="font-weight:400;text-align:left;color:#4b5262">${esc(f[1])}</span></div>`).join('');
      el.innerHTML = `<section class="card" style="display:flex;flex-direction:column;gap:10px">
        <span class="tag" style="align-self:flex-start;background:${esc(w.tint)};color:${esc(w.tintText)}">전용 팩 있음</span>
        <b style="font-size:17px;font-weight:800">이 작품은 팩과 함께하면 더 재밌어요</b>
        ${feats ? `<div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:12px;background:#f7f8fa">${feats}</div>` : ''}
        <button class="btn dark" data-act="install" data-id="${esc(w.pack)}">${isAvailable(w.pack) ? '설치하고 적용' : '팩을 찾을 수 없어요'}</button></section>`;
      return;
    }
    if (!w.pack) {
      el.innerHTML = `<section class="card"><h3>전용 팩 준비 중</h3><p class="empty">이 작품은 아직 기본 크랙 화면으로 플레이해요. 팩이 나오면 홈에 알려 드릴게요.</p></section>`;
      return;
    }
    if (!packOn(p.id)) {
      el.innerHTML = `<section class="card"><h3>팩이 꺼져 있어요</h3><p class="empty">원본 크랙 화면으로 보는 중이에요. 상태창은 채팅 안에 원래 글자로 보여요.</p>
        <button class="btn dark" style="margin-top:12px" data-act="toggle-pack">팩 다시 켜기</button></section>`;
      return;
    }
    const st = S.room.status;
    if (!st) {
      el.innerHTML = `<section class="card"><h3>상태창을 기다리는 중</h3><p class="empty">대화를 이어 가면 응답 속 상태창을 읽어서 여기에 대시보드로 보여 줘요. 이미 진행 중인 대화라면 마지막 상태창을 곧 읽어 와요.</p></section>`;
      return;
    }
    const fields = p.status.fields || [];
    const d = S.room.delta;
    const delta = (k) => (d[k] ? `<span class="dl ${d[k] > 0 ? 'up' : 'down'}">${d[k] > 0 ? '+' : ''}${d[k]}</span>` : '');
    const tiles = fields.filter(f => f.group === 'tile').map(f => `<div class="tile"><span class="tl">${esc(f.label)}</span><span><span class="tv">${esc(fieldValue(f, st.fields[f.key]))}</span>${delta(f.key)}</span></div>`).join('');
    const gauges = fields.filter(f => f.group === 'gauge').map(f => {
      const v = st.fields[f.key];
      const pct = typeof v === 'number' && f.max ? Math.max(0, Math.min(100, v / f.max * 100)) : 0;
      return `<div class="gauge"><div class="lbl"><span>${esc(f.label)} ${delta(f.key)}</span><b>${esc(fieldValue(f, v))}${f.max ? ' / ' + f.max : ''}</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('');
    const rows = fields.filter(f => f.group === 'row' && st.fields[f.key] != null).map(f => `<div class="row"><span>${esc(f.label)}</span><span>${esc(fieldValue(f, st.fields[f.key]))}</span></div>`).join('');
    const minis = fields.filter(f => f.group === 'mini' && st.fields[f.key] != null).map(f => `<span>${esc(f.label)} <b>${esc(fieldValue(f, st.fields[f.key]))}</b></span>`).join('');
    const cd = P.countdown(p, packOpts(p.id), st);
    const sc = S.room.scene ? p.scenes[S.room.scene] : null;

    el.innerHTML = `<section class="card">
        <div class="day"><b>${st.day != null ? 'D' + st.day : ''}${st.phase ? ' · ' + esc(st.phase) : ''}</b><span>${esc(st.loc || '')}</span></div>
        ${cd ? `<div class="cd ${cd.hot ? 'hot' : ''}"><span>다음 ${esc(p.cycle.name)}</span><b>${esc(cd.label)}</b></div>` : ''}
        <div class="tiles">${tiles}</div>${gauges}
        ${rows ? `<div class="rows">${rows}</div>` : ''}
        ${minis ? `<div class="mini">${minis}</div>` : ''}
      </section>
      ${sc ? `<section class="card play">
        <span class="art" style="background:${esc(sc.tint)};color:${esc(sc.text)}">${ICON.music}</span>
        <span class="two" style="flex:1 1 auto"><span>지금 재생 · ${esc(sc.label)} 장면</span><b>${esc(S.room.bgmMissing ? '곡 파일 없음' : sc.title)}</b></span>
        <button class="icon-btn" data-act="bgm-toggle" aria-label="${bgm.paused ? '재생' : '일시정지'}" style="border:1px solid #e7e9ee">${bgm.paused ? ICON.play : ICON.pause}</button>
      </section>` : ''}`;
  }

  // ---------- 모달 ----------
  function renderModal() {
    const layer = $('#layer');
    const m = S.modal;
    if (!m) { layer.innerHTML = ''; return; }
    let inner = '';
    if (m.type === 'offer' || m.type === 'install' || m.type === 'error') {
      const w = S.works.find(x => x.pack === m.id) || {};
      const head = `<div style="display:flex;align-items:center;gap:12px">
        <span class="badge" style="width:44px;height:44px;border-radius:12px;font-size:17px;background:${esc(w.tint || '#f0f1f4')};color:${esc(w.tintText || '#4b5262')}">${esc(w.short || '팩')}</span>
        <div class="two"><b style="font-size:18px;font-weight:800">이 작품 전용 팩이 있어요</b><span>${esc(w.name || m.id)}</span></div></div>`;
      if (m.type === 'offer') {
        const feats = (w.packFeatures || []).map(f => `<div><b>${esc(f[0])}</b><span>${esc(f[1])}</span></div>`).join('');
        inner = head + (feats ? `<div class="list">${feats}</div>` : '') +
          `<div class="acts"><button class="btn line" data-act="later">나중에</button><button class="btn dark" style="flex-grow:2" data-act="install" data-id="${esc(m.id)}">설치하고 적용</button></div>`;
      } else if (m.type === 'install') {
        inner = head + `<div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;font-size:13.5px"><span style="color:#4b5262;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.file ? '받는 중 · ' + m.file : '준비 중')}${m.mb ? ' · ' + esc(m.mb) : ''}</span><b>${m.prog || 0}%</b></div>
          <div class="bar" style="height:8px"><i style="width:${m.prog || 0}%;background:#111318"></i></div>
          <span style="font-size:12.5px;color:#6b7280">설치가 끝나면 지금 대화에 바로 적용돼요.</span></div>`;
      } else {
        inner = head + `<p class="err">설치하지 못했어요: ${esc(m.msg)}</p><div class="acts"><button class="btn line" data-act="close">닫기</button><button class="btn dark" data-act="install" data-id="${esc(m.id)}">다시 시도</button></div>`;
      }
    } else if (m.type === 'settings') {
      const s = S.settings;
      const p = S.room && S.room.pack;
      const seg = (name, cur, list) => `<div class="seg">${list.map(([v, l]) => `<button data-act="seg" data-name="${name}" data-value="${esc(v)}" aria-pressed="${cur === v}">${esc(l)}</button>`).join('')}</div>`;
      const opts = p ? (p.options || []).map(o => `<div class="field"><span>${esc(p.name)} · ${esc(o.label)}</span>${seg('opt:' + p.id + ':' + o.key, packOpts(p.id)[o.key] || (o.choices[0] || {}).value, o.choices.map(c => [c.value, c.label]))}</div>`).join('') : '';
      const packs = S.installed.map(x => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px"><span>${esc(x.name)} <span style="color:#6b7280">v${esc(x.version)}</span></span><button class="btn line" style="min-height:32px;font-size:12px" data-act="uninstall" data-id="${esc(x.id)}">삭제</button></div>`).join('');
      inner = `<h2>설정</h2>
        <label class="field"><span>음량 <span id="volVal" style="font-weight:400;color:#6b7280">${s.volume}</span></span><input type="range" min="0" max="100" value="${s.volume}" data-act="volume" style="accent-color:#111318"></label>
        <div class="field"><span>연출 강도</span>${seg('intensity', s.intensity, [['low', '약하게'], ['mid', '보통'], ['high', '강하게']])}<small>약하게: 흔들림·번쩍임·떨림 없이 차분하게 보여요.</small></div>
        <div class="field"><span>대사 글자 속도</span>${seg('textSpeed', s.textSpeed || 'normal', [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게'], ['instant', '바로']])}</div>
        <div class="field"><span>자동 업데이트</span>${seg('autoUpdate', s.autoUpdate === false ? 'off' : 'on', [['on', '켜기'], ['off', '끄기']])}<small>켜 두면 팩과 화면이 새 버전으로 알아서 바뀌어요. 화면 엔진은 다시 시작할 때 적용돼요.</small></div>
        ${opts}
        ${S.work ? `<label class="field"><span>${esc(S.work.name)} 크랙 주소</span><input type="url" id="setWorkUrl" value="${esc(s.workUrls[S.work.id] || S.work.url || '')}" placeholder="https://crack.wrtn.ai/..."><small>비워 두면 크랙 첫 화면이 열려요.</small></label>` : ''}
        <label class="field"><span>팩 목록 주소 (선택)</span><input type="url" id="setRegistry" value="${esc(s.registryUrl || '')}" placeholder="https://(깃허브 페이지)/crion/index.json"><small>여기에 새 팩과 업데이트를 올리면 팔로워 앱이 받아 가요.</small></label>
        ${packs ? `<div class="field"><span>설치된 팩</span>${packs}</div>` : ''}
        <div class="field"><span>업데이트</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn line" data-act="check-updates">지금 확인</button>
            ${S.room && S.room.v2 ? '<button class="btn line" data-act="diag">화면 진단 복사</button>' : ''}
            <button class="btn line" data-act="open-folder">데이터 폴더</button>
          </div>
          <small>앱 ${esc(S.info.version)} · 화면 엔진 ${esc(S.info.engineVersion)} (${S.info.engineSource === 'update' ? '업데이트로 받음' : '앱 내장'})</small>
        </div>
        <div class="acts"><button class="btn line" data-act="close">닫기</button><button class="btn dark" data-act="save-settings">저장</button></div>
        <small style="color:#6b7280;text-align:center">CRION ${esc(S.info.version)}</small>`;
    }
    layer.innerHTML = `<div class="modal-bg" data-act="bg"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
  }
  function closeModal() { S.modal = null; renderModal(); }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.innerHTML = `<i></i><span>${esc(msg)}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function refreshRoomChrome() {
    const top = $('.top');
    if (top) top.outerHTML = topHtml();
    const nav = $('.nav');
    if (nav) nav.outerHTML = navHtml();
  }

  // ---------- 동작 ----------
  async function install(id) {
    S.modal = { type: 'install', id, prog: 0, file: '' };
    renderModal();
    const off = api.onPackProgress((d) => {
      if (d.id !== id || !S.modal || S.modal.type !== 'install') return;
      S.modal.prog = d.bytesTotal ? Math.round(d.bytesDone / d.bytesTotal * 100) : (d.total ? Math.round(d.done / d.total * 100) : 0);
      S.modal.file = d.file;
      S.modal.mb = d.bytesTotal ? `${(d.bytesDone / 1048576).toFixed(1)} / ${(d.bytesTotal / 1048576).toFixed(1)} MB` : '';
      renderModal();
    });
    const r = await api.installPack(id);
    off();
    if (!r.ok) { S.modal = { type: 'error', id, msg: r.error }; renderModal(); return; }
    await refreshPacks();
    await save({ packEnabled: Object.assign({}, S.settings.packEnabled, { [id]: true }) });
    closeModal();
    if (S.view === 'room' && S.work && S.work.pack === id) {
      if (isV2(installedPack(id))) { openRoom(S.work); }
      else {
        S.room.pack = installedPack(id);
        refreshRoomChrome();
        renderAside();
        sendConfig();
      }
    } else {
      render();
    }
    toast('팩 적용 완료 · 지금 대화의 상태창부터 읽어요');
  }

  async function togglePack() {
    const p = S.room && S.room.pack;
    if (!p) return;
    await save({ packEnabled: Object.assign({}, S.settings.packEnabled, { [p.id]: !packOn(p.id) }) });
    if (isV2(p)) { openRoom(S.work); return; }
    if (!packOn(p.id)) { bgm.stop(); }
    S.room.lastText = null;
    S.room.status = null;
    S.room.scene = null;
    refreshRoomChrome();
    applyScene();
    renderAside();
    sendConfig();
  }

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'bg') { if (e.target === el && S.modal && S.modal.type !== 'install') closeModal(); return; }
    if (act === 'login') { await save({ onboarded: true }); openRoom(null); }
    else if (act === 'home') { if (S.game) { S.game.destroy(); S.game = null; } S.view = 'home'; S.room = null; S.work = null; render(); }
    else if (act === 'chat-close') setChat(false);
    else if (act === 'open-work') { const w = S.works.find(x => x.id === el.dataset.id); if (w) openRoom(w); }
    else if (act === 'toggle-pack') togglePack();
    else if (act === 'install') install(el.dataset.id);
    else if (act === 'later') { if (S.modal) S.dismissed[S.modal.id] = true; closeModal(); }
    else if (act === 'close') closeModal();
    else if (act === 'settings') { S.modal = { type: 'settings' }; renderModal(); }
    else if (act === 'bgm-toggle') { bgm.toggle(); renderAside(); }
    else if (act === 'save-url') {
      const url = S.room && S.room.url;
      if (S.work && url && url.startsWith(S.info.crackOrigin)) {
        await save({ workUrls: Object.assign({}, S.settings.workUrls, { [S.work.id]: url }) });
        updateUrlbar();
        toast('작품 주소를 저장했어요. 다음부터 바로 열려요.');
      }
    }
    else if (act === 'seg') {
      const name = el.dataset.name, value = el.dataset.value;
      if (name === 'intensity') { await save({ intensity: value }); if (S.room) applyScene(); }
      else if (name === 'textSpeed') await save({ textSpeed: value });
      else if (name === 'autoUpdate') await save({ autoUpdate: value === 'on' });
      else if (name.startsWith('opt:')) {
        const [, id, key] = name.split(':');
        const all = Object.assign({}, S.settings.packOptions);
        all[id] = Object.assign({}, all[id], { [key]: value });
        await save({ packOptions: all });
        if (S.room && S.room.status && S.room.pack) {
          S.room.scene = P.decideScene(S.room.pack, packOpts(S.room.pack.id), S.room.status, '', S.room.scene);
          applyScene(); renderAside();
        }
      }
      renderModal();
    }
    else if (act === 'save-settings') {
      const patch = {};
      const reg = $('#setRegistry');
      if (reg) patch.registryUrl = reg.value.trim();
      const wu = $('#setWorkUrl');
      if (wu && S.work) {
        const v = wu.value.trim();
        const urls = Object.assign({}, S.settings.workUrls);
        if (v && v.startsWith(S.info.crackOrigin)) urls[S.work.id] = v; else if (!v) delete urls[S.work.id];
        patch.workUrls = urls;
      }
      await save(patch);
      await refreshPacks();
      closeModal();
      if (S.view === 'room') updateUrlbar(); else render();
      toast('설정을 저장했어요');
    }
    else if (act === 'check-updates') {
      toast('업데이트를 확인하는 중…');
      const r = await api.checkUpdates();
      if (r.skipped === 'no-registry') toast('팩 목록 주소가 아직 없어요. 설정에 입력하거나 배포판에 넣어 주세요.');
      else if (r.error) toast('확인하지 못했어요: ' + r.error);
      else if (r.skipped === 'busy') toast('이미 확인하는 중이에요');
      else {
        const up = r.packs.filter(x => x.state === 'updated').length;
        toast(up || (r.engine && r.engine.state === 'ready') ? '업데이트를 받았어요' : '모두 최신이에요');
      }
    }
    else if (act === 'diag') requestDiag();
    else if (act === 'open-folder') api.openFolder();
    else if (act === 'banner-go') {
      const b = S.banner; S.banner = null; renderBanner();
      if (b && b.go === 'relaunch') api.relaunch();
      else if (b && b.go === 'url' && b.url) api.openExternal(b.url);
      else if (b && b.go === 'check') document.querySelector('[data-act=check-updates]') ? 0 : api.checkUpdates();
    }
    else if (act === 'banner-x') { S.banner = null; renderBanner(); }
    else if (act === 'uninstall') {
      await api.uninstallPack(el.dataset.id);
      await refreshPacks();
      if (S.room && S.room.pack && S.room.pack.id === el.dataset.id) {
        if (S.room.v2) { openRoom(S.work); }
        else { S.room.pack = null; bgm.stop(); sendConfig(); refreshRoomChrome(); applyScene(); renderAside(); }
      }
      renderModal();
    }
  });

  document.addEventListener('input', async (e) => {
    if (e.target.dataset && e.target.dataset.act === 'volume') {
      const v = Number(e.target.value);
      bgm.setVolume(v / 100);
      const lbl = $('#volVal'); if (lbl) lbl.textContent = v;
      clearTimeout(e.target._t);
      e.target._t = setTimeout(() => save({ volume: v }), 300);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.modal && S.modal.type !== 'install') closeModal();
  });

  function renderBanner() {
    const b = S.banner, host = $('#banner');
    if (!host) return;
    host.innerHTML = b ? `<div class="banner"><span>${esc(b.text)}</span><button class="btn dark" data-act="banner-go">${esc(b.label)}</button><button class="icon-btn" data-act="banner-x" aria-label="닫기">×</button></div>` : '';
  }

  api.onUpdate(async (ev) => {
    if (ev.type === 'engine-ready') S.banner = { text: `새 화면 ${ev.version}이 준비됐어요. 다시 시작하면 적용돼요.`, label: '지금 다시 시작', go: 'relaunch' };
    else if (ev.type === 'needs-restart') S.banner = { text: '팩 업데이트를 위해 앱을 다시 시작해야 해요.', label: '지금 다시 시작', go: 'relaunch' };
    else if (ev.type === 'shell-old') S.banner = { text: '앱 본체가 오래돼서 새 기능을 쓸 수 없어요. 새 설치 파일이 필요해요.', label: ev.url ? '받으러 가기' : '확인', go: ev.url ? 'url' : 'x', url: ev.url };
    else if (ev.type === 'pack-available') S.banner = { text: '팩 업데이트가 있어요.', label: '지금 받기', go: 'check' };
    else if (ev.type === 'error') toast('업데이트 확인 실패: ' + ev.message);
    else if (ev.type === 'pack-updated') {
      await refreshPacks();
      if (S.room && S.room.pack && S.room.pack.id === ev.id) {
        S.room.pack = installedPack(ev.id);
        if (S.game) S.game.setPack(S.room.pack);
        sendConfig();
      } else if (S.view === 'home') render();
      toast(`${ev.name || '팩'}이 v${ev.version}으로 업데이트됐어요`);
    }
    renderBanner();
  });

  (async function boot() {
    S.info = await api.info();
    S.settings = await api.getSettings();
    S.works = await api.getWorks();
    await refreshPacks();
    bgm.setVolume(S.settings.volume / 100);
    S.view = S.settings.onboarded ? 'home' : 'onboard';
    render();
    api.engineReady();
  })();
})();
