// 플레이팩 실행기 — 「아포칼립스 안전지대의 관리자」 (runner: "safehouse")
//  크랙 AI가 그대로 GM. 크랙 응답·상태창을 읽어 「프로젝트 A」 화면(로비·스마트폰·도면·인사 파일·지도·일지)으로 그린다.
//  - 게임 쪽 계산(자원·파견·웨이브)은 하지 않는다. 숫자는 전부 크랙 상태창에서 읽은 것
//  - 보내기: 플레이어가 '보내기'를 한 번 누르면 한 번만. 지시서·스마트폰 버튼은 입력칸에 글만 채운다
//  - 숨김 값(요구치·웨이브 강도·등급·신뢰·호감·확률·인물 진실)은 보여 주지 않는다. 해야 할 일을 알려 주는 문구도 없다
//  - 세이브/새 대화 연결은 packrun.js(아카데미)와 같은 방식
(function (root) {
  'use strict';
  const SH = root.CrionSafehouse;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => u ? `url('${String(u).replace(/['"\\\n<>]/g, (c) => encodeURIComponent(c))}')` : 'none';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pad2 = (n) => String(n).padStart(2, '0');
  const SPEED = { slow: 42, normal: 24, fast: 10, instant: 0 };
  const CLOCK = { 아침: '07:00', 낮: '13:00', 저녁: '18:00', 밤: '22:00' };
  const TIME_IC = { 아침: '🌅', 낮: '☀️', 저녁: '🌆', 밤: '🌙' };
  const CAP_BY_LV = { 1: 3, 2: 10, 3: 15, 4: 22, 5: 30, 6: 40 };
  const ROOMS_BY_LV = { 1: 3, 2: 5, 3: 7, 4: 9, 5: 9, 6: 9 };
  const END_DAY = '오늘은 여기까지. 문단속을 확인하고 잠자리에 든다.';
  const ICON = {
    people: '<circle cx="12" cy="6.5" r="2.6"/><circle cx="5.2" cy="8.3" r="2"/><circle cx="18.8" cy="8.3" r="2"/><path d="M8.5 21v-6.5a3.5 3.5 0 0 1 7 0V21M2.5 19v-4.2a2.8 2.8 0 0 1 4.3-2.4M21.5 19v-4.2a2.8 2.8 0 0 0-4.3-2.4"/>',
    map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
    building: '<path d="M4 21V6l8-3 8 3v15M2.5 21h19M9.5 21v-4h5v4M8 8.5h2M14 8.5h2M8 12.5h2M14 12.5h2"/>',
    flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3M7.3 15h9.4"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3M8.5 7h6"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    log: '<path d="M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M8 8h4M8 12h7M8 16h5M17.5 2.5l3 3L14 12h-3V9z"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    pin: '<path d="M12 22s7-6.6 7-12a7 7 0 0 0-14 0c0 5.4 7 12 7 12zm0-9.2a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>'
  };
  const ic = (k) => `<svg class="ic" viewBox="0 0 24 24">${ICON[k]}</svg>`;
  const RES = [['food', '식량', '식', '#d8b56a'], ['med', '의료품', '약', '#e39a9a'], ['mat', '자재', '자', '#bdbdbd'], ['fuel', '연료', '연', '#e0a35a'], ['rare', '희귀', '희', '#9fd0e6'], ['rmat', '연구재료', '재', '#b6a3e0']];
  const seedRot = (i, amp) => ((Math.sin(i * 12.9898) * 43758.5453) % 1) * amp;

  function start(o) {
    const el = o.el;
    const files = o.files;
    const man = o.manifest || {};
    const data = o.data || {};
    const roster = new SH.Roster(data);
    const RO = Object.fromEntries((data.roster || []).map(r => [r.name, r]));
    const REG = data.regions || [];
    const HOME = data.home || { x: 21, y: 24 };
    const BUILDING = data.building || '석벽빌라';
    const res = (p) => !p ? '' : files.has(p) ? p : files.has('assets/' + p) ? 'assets/' + p : '';
    const url = (p) => { const r = res(p); return r ? files.url(r) : ''; };
    const { josa, joinNames } = SH;

    // ---------- 세이브 (packrun.js와 같은 방식) ----------
    const PK_ID = o.pack.id, WORK = (o.work && o.work.id) || 'work';
    const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } };
    const SAVES_KEY = `crion.pk.${PK_ID}.saves.${WORK}`, PREF_KEY = `crion.pk.${PK_ID}.prefs`;
    const memKey = (id) => `crion.pk.${PK_ID}.s.${id}`;
    const normUrl = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, ''); } catch (e) { return String(u || ''); } };
    let saves = lsGet(SAVES_KEY, []).filter(x => x && x.id);
    const putSaves = () => lsSet(SAVES_KEY, saves);
    const M = SH.blank();
    M.prefs = Object.assign({ speed: 'normal', fx: true, music: true, vol: 55 }, lsGet(PREF_KEY, {}));
    let saveId = null, saveT = null;
    const save = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        lsSet(PREF_KEY, M.prefs);
        if (!saveId) return;
        M.log = M.log.slice(-400); M.lines = M.lines.slice(-200);
        const { prefs, ...mem } = M;
        lsSet(memKey(saveId), mem);
        const sv = curSave();
        if (sv) { const st = M.status || {}; sv.sum = { day: st.day || 0, time: st.time || '', place: st.place || '', ppl: st.ppl, cap: st.cap, bg: M.lastBg || '' }; sv.last = Date.now(); putSaves(); }
      }, 300);
    };
    function useSave(id) {
      saveId = id;
      const mem = Object.assign(SH.blank(), id ? lsGet(memKey(id), {}) : {});
      Object.keys(SH.blank()).forEach(k => { M[k] = mem[k]; });
    }
    const curSave = () => saves.find(x => x.id === saveId) || null;

    const R = {
      mode: 'title', boundUrl: '', away: false, newFlow: null, curUrl: '', page: 'chat', actions: [],
      beats: [], i: -1, typing: null, waiting: false, sentAt: 0, lastKey: '', mood: {},
      view: 'lobby', phone: 'peek', note: null, sel: null, region: null, floor: 2, team: [], form: '표준', stay: 2, withMe: false, keeper: '', dexf: 'all',
      cen: null, cine: null, modal: null, lastView: 'lobby', bgKey: ''
    };

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="sh">
      <div class="sh-stage"><div id="sh-scene">
        <div class="bg" id="sh-bg"><div class="sh-bgl"></div><div class="sh-bgl"></div></div>
        <div class="sh-tint"></div><div class="shade"></div><div class="sh-fx"></div>
        <div id="sh-dlg" data-sh="next"></div>
        <div id="sh-view" hidden></div>
        <div id="sh-cen" hidden></div>
        <div class="hud-l" id="sh-hudl"></div>
        <div class="hud-c" id="sh-hudc"></div>
        <div class="hud-r" id="sh-hudr"></div>
        <button id="sh-topnav" data-sh="lobby" hidden aria-label="로비로">${ic('up')}<span>로비</span></button>
        <div id="sh-phone" class="peek"><button class="chev" data-sh="phone" aria-label="관리 폰 접기/펼치기">${ic('down')}<span class="sh-chevt"></span></button><div class="device"><div class="screen" id="sh-screen"></div></div></div>
      </div></div>
      <footer class="sh-foot">
        <textarea id="sh-in" rows="1" placeholder="하고 싶은 걸 그대로 적어 보세요 (Enter 보내기 · Shift+Enter 줄바꿈)"></textarea>
        <button class="sh-fb" data-sh="regen" title="크랙에서 다시 생성">다시</button>
        <button class="sh-fb primary" data-sh="send">보내기</button>
      </footer>
      <div class="layer" id="sh-splash"><img alt="HIRION GAMES"><small>TAP TO SKIP</small></div>
      <div class="layer" id="sh-title" hidden></div>
      <div class="layer" id="sh-cine" hidden></div>
      <div class="layer" id="sh-reg" hidden></div>
      <div class="overlay" id="sh-modal" hidden><div class="box" id="sh-box"></div></div>
      <div class="sh-banner" id="sh-banner" hidden></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const shRoot = $('.sh');
    const narrow = () => { try { return root.matchMedia('(max-width: 720px)').matches; } catch (e) { return false; } };
    if (narrow()) $('#sh-in').placeholder = '하고 싶은 걸 그대로 적어 보세요';
    const portrait = () => { const st = $('.sh-stage'); return !!st && st.clientHeight > st.clientWidth; };
    // 숨김 넘침 상자가 포커스·클릭 때문에 스스로 스크롤되지 않게 (화면이 위로 밀리는 것 방지)
    [shRoot, $('.sh-stage'), $('#sh-scene')].forEach(n => n.addEventListener('scroll', () => { if (n.scrollTop || n.scrollLeft) { n.scrollTop = 0; n.scrollLeft = 0; } }));
    shRoot.classList.toggle('nofx', !M.prefs.fx);
    const toast = (t) => o.toast(t);

    // ---------- 음악 (팩 manifest의 bgm 맵 · 장면 고르기는 CrionSafehouse.pickBgm) ----------
    const bgm = root.CrionBgm ? new root.CrionBgm() : null;
    if (bgm) bgm.setVolume(M.prefs.vol / 100);
    let bgmId = '';
    const regionNames = (data.regions || []).map(r => r.n);
    function playBgm(id) {
      if (!bgm || !id) return;
      const p = (man.bgm || {})[id];
      if (!p || !res(p)) return;
      if (id === bgmId && bgm.src) return;
      bgmId = id;
      if (!M.prefs.music) return;
      bgm.play(url(p));
    }
    const sceneBgm = (ctx) => playBgm(SH.pickBgm(man, Object.assign({ regions: regionNames, status: M.status }, ctx || {})));

    // ---------- 배경 (응답 그림을 나온 순서대로 풀화면) ----------
    let bgFlip = 0;
    function setBg(src) {
      if (!src || src === R.bgKey) return;
      R.bgKey = src;
      const ls = el.querySelectorAll('.sh-bgl');
      bgFlip = 1 - bgFlip;
      ls[bgFlip].style.backgroundImage = cssUrl(src);
      ls[bgFlip].classList.add('on'); ls[1 - bgFlip].classList.remove('on');
      M.lastBg = src;
    }
    function setMood(m) {
      R.mood = m || {};
      const fx = $('.sh-fx'), tint = $('.sh-tint');
      const night = R.mood.night || (M.status && M.status.time === '밤');
      tint.className = 'sh-tint' + (night ? ' night' : (M.status && M.status.time === '저녁') ? ' dusk' : '');
      fx.className = 'sh-fx' + (R.mood.crisis && M.prefs.fx ? ' crisis' : '');
      if (R.mood.crisis && M.prefs.fx) { const s = $('#sh-scene'); s.classList.remove('sh-shake'); void s.offsetWidth; s.classList.add('sh-shake'); }
    }

    // ---------- HUD ----------
    const st0 = () => M.status || {};
    const nOr = (v) => v == null ? '–' : v;
    function waveChip(st) {
      if (!M.firstWave || !st.day) return '';
      const next = st.day % 10 === 1 ? st.day : st.day + ((11 - (st.day % 10)) % 10 || 10);
      const left = next - st.day;
      return `<span class="s-sp plain ${left <= 1 ? 'warn' : ''}">${left === 0 ? '오늘 밤 웨이브' : `웨이브 D-${left}`}</span>`;
    }
    function renderHud() {
      const st = st0(), lobby = R.view === 'lobby';
      const hl = $('#sh-hudl');
      hl.classList.toggle('compact', !lobby);
      hl.innerHTML = `<div class="dayt">${st.day ? st.day + '일차' : 'D-'}</div>
        <div class="loc">${ic('pin')}${esc(st.place || BUILDING)}${st.time ? `<span class="sh-time">${TIME_IC[st.time] || ''} ${esc(st.time)}</span>` : ''}</div>
        <div class="stat-row">
          <span class="s-sp"><i style="background:#8fb4d6">방</i>방어력 <span class="num">${nOr(st.def)}</span></span>
          <span class="s-sp"><i style="background:#e6b86a">사</i>사기 <span class="num">${nOr(st.morale)}</span></span>
          <span class="s-sp"><i style="background:#a6c99a">주</i>주민 <span class="num">${nOr(st.ppl)}/${nOr(st.cap)}</span></span>
          ${waveChip(st)}${st.god ? '<span class="s-sp plain">👁️ 갓모드</span>' : ''}
        </div>`;
      const hc = $('#sh-hudc');
      hc.hidden = !lobby;
      hc.innerHTML = `<div class="hc">${RES.map(([k, n, c, col]) => `<span class="hi"><i style="background:${col}">${c}</i><span class="lb">${n}</span><b class="num ${st[k] === 0 && (k === 'food' || k === 'med') ? 'low' : ''}">${nOr(st[k])}</b></span>`).join('')}${st.rlv != null ? `<span class="sep"></span><span class="hi"><span class="lb">연구</span><b class="num">Lv ${st.rlv}</b></span>` : ''}</div>`;
      $('#sh-hudr').innerHTML = `<button class="${R.view === 'log' ? 'on' : ''}" data-sh="go" data-k="log">${ic('log')}<span>운영일지</span></button>
        <button data-sh="lines">${ic('chat')}<span>지난 대사</span></button>
        <button data-sh="set">${ic('gear')}<span>설정</span></button>`;
    }

    // ---------- 스마트폰 ----------
    const PAPPS = [['people', '주민관리', 'people'], ['explore', '파견', 'map'], ['building', '건물관리', 'building'], ['lab', '연구소', 'flask'], ['dex', '생존자 도감', 'book']];
    function renderPhone() {
      const ph = $('#sh-phone');
      ph.className = R.phone;
      const st = st0();
      const chores = (st.chores || []);
      const disp = st.dispatch || [], wait = st.wait || [];
      const hurt = Object.values(M.people).filter(p => p.st === 'res' && p.hurt).length;
      const bar = (n, v, c) => `<div class="sbr"><span>${n}</span><i><b style="width:${clamp(v || 0, 0, 100)}%;background:${c}"></b></i><em>${v == null ? '–' : v}</em></div>`;
      $('#sh-screen').innerHTML = `<div class="sbar"><span>${CLOCK[st.time] || '--:--'}</span><span class="bat">${st.day ? 'D' + st.day : ''}<i></i></span></div><div class="pscroll">
        <div class="apps">${PAPPS.map(([k, n, i]) => `<button class="appi" data-sh="go" data-k="${k}"><span class="ico">${ic(i)}</span>${n}${k === 'people' && hurt ? `<span class="s-bd">${hurt}</span>` : ''}${k === 'explore' && disp.length ? `<span class="s-bd" style="background:var(--info)">${disp.length}</span>` : ''}</button>`).join('')}
          <button class="appi hot" data-sh="endday"><span class="ico">${ic('moon')}</span>하루 마치기</button></div>
        <div class="widget"><span class="wt">🛠️ 오늘의 일과</span>${chores.length ? chores.map(c => `<div class="wchore"><span>${esc(c.name)}</span><span class="s-st">${esc(c.job)}</span></div>`).join('') : '<div class="wchore"><span class="s-st">미정</span></div>'}</div>
        ${disp.length ? `<div class="widget"><span class="wt">🚶 파견 중</span>${disp.map(d => `<div class="wchore"><span>${esc(d.party.join('·'))} → ${esc(d.dest)}</span><span class="s-st auto">귀환 D${d.ret}</span></div>`).join('')}</div>` : ''}
        ${wait.length ? `<div class="widget"><span class="wt">🚪 대기</span>${wait.map(w => `<div class="wchore"><span>${esc(w.name)}</span><span class="s-st">${w.days}일째</span></div>`).join('')}</div>` : ''}
        <div class="widget"><span class="wt">🏢 건물 상태</span>${bar('사기', st.morale, '#e6b86a')}<div class="wchore"><span>방어력</span><b class="num">${nOr(st.def)}</b></div><div class="wchore"><span>확장</span><span class="s-st">${st.exp ? st.exp + '단계 · 수용 ' + nOr(st.cap) : '–'}</span></div></div>
        <div class="widget"><span class="wt">🌙 오늘 밤 식량</span><span style="font-size:12px">주민 ${nOr(st.ppl)}명 · <b class="num">−${st.ppl || 0}</b> <span class="s-st">(보유 ${nOr(st.food)})</span></span></div>
      </div>`;
    }

    // ---------- 로비 대사창 ----------
    let typeT = null;
    function typeTo(node, text, done) {
      clearInterval(typeT);
      const ms = SPEED[M.prefs.speed] == null ? 24 : SPEED[M.prefs.speed];
      if (!ms || !text) { node.textContent = text; R.typing = null; done && done(); return; }
      let i = 0;
      node.textContent = '';
      R.typing = { finish() { clearInterval(typeT); node.textContent = text; R.typing = null; done && done(); } };
      typeT = setInterval(() => { i += 1; node.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typeT); R.typing = null; done && done(); } }, ms);
    }
    const owner = () => M.owner || '관리인';
    function endPhrase() { return `${josa(owner(), '은', '는')} 어떻게 할까?`; }
    function showBeat(i) {
      const d = $('#sh-dlg');
      const b = R.beats[i];
      if (!b) {
        d.innerHTML = `<div class="dline sh-endq">${esc(endPhrase())}</div>`;
        return;
      }
      if (b.img) setBg(b.img.src);
      const last = i >= R.beats.length - 1;
      const name = b.kind === 'say' ? b.who : '';
      d.className = 'k-' + b.kind;
      d.innerHTML = `${name ? `<div class="dname">${esc(name)}${b.known ? `<button class="pfbtn" data-sh="openp" data-id="${esc(b.who)}">인사 파일 ›</button>` : ''}</div>` : ''}
        ${b.act ? `<div class="sh-act">${esc(b.act)}</div>` : ''}
        <div class="dline">${b.kind === 'sys' ? '' : ''}</div>
        <span class="dnext">${last ? '' : '탭해서 계속 ▼'}</span>${last ? `<div class="sh-endq" hidden>${esc(endPhrase())}</div>` : ''}`;
      const text = b.kind === 'say' ? `“${b.text}”` : b.kind === 'sys' ? `( ${b.text} )` : b.text;
      typeTo(d.querySelector('.dline'), text, () => { if (last) { const q = d.querySelector('.sh-endq'); if (q) q.hidden = false; } });
    }
    function next() {
      if (R.typing) { R.typing.finish(); return; }
      if (R.cen || R.view !== 'lobby' || R.waiting) return;
      if (R.i < R.beats.length - 1) { R.i++; showBeat(R.i); }
    }

    // ---------- 응답 처리 ----------
    function handle(segs) {
      if (R.sm) R.sm.done = true;
      const P = SH.parse(segs, roster);
      const ev = SH.absorb(M, P, data);
      P.beats.forEach(b => M.lines.push({ d: (M.status && M.status.day) || 0, who: b.kind === 'say' ? b.who : '', act: b.act || '', t: b.text, sys: b.kind === 'sys' }));
      save();
      R.beats = P.beats.filter(b => b.text || b.img);
      R.i = -1;
      renderHud(); renderPhone();
      if (R.view !== 'lobby') renderView();
      setMood(P.mood);
      R.nextBgm = { imgs: P.imgs, delta: P.delta, joined: ev.joined };
      if (!M.prologue) { M.prologue = true; save(); sceneBgm({ screen: 'title' }); playCine(R.beats); return; }
      if (ev.dayChanged) { sceneBgm({ screen: 'rollcall' }); showCen(ev); return; }
      sceneBgm(R.nextBgm);
      startBeats();
    }
    function startBeats() {
      R.i = R.beats.length ? 0 : -1;
      if (R.i < 0) { showBeat(-1); return; }
      // 대사 앞의 그림이 첫 조각에 없으면 앞 그림 유지
      showBeat(0);
    }

    // ---------- 아침점호 카드 ----------
    function showCen(ev) {
      const lines = [].concat(
        ev.lines.map(esc),
        ev.returned.map(d => `${esc(d.party.join('·'))} — ${esc(d.dest)}에서 귀환`),
        ev.joined.filter(n => !ev.lines.some(l => l.includes(n))).map(n => `${esc(n)} 입주`)
      );
      R.cen = true;
      const c = $('#sh-cen');
      c.hidden = false; $('#sh-dlg').hidden = true;
      c.innerHTML = `<div class="ctitle">${ev.day}일차<br>아침점호</div><div class="clines">${lines.length ? lines.map(t => `<p>${t}</p>`).join('') : '<p>밤사이 별다른 보고는 없었다.</p>'}</div>
        <div class="cbtns"><button class="pl" data-sh="cen-ok">확인</button></div>`;
    }
    function hideCen() { R.cen = null; $('#sh-cen').hidden = true; $('#sh-dlg').hidden = R.view !== 'lobby'; sceneBgm(R.nextBgm); startBeats(); }

    // ---------- 프롤로그 (영화식) → 건물주 등록증 ----------
    function playCine(beats) {
      const pages = beats.filter(b => b.text);
      if (!pages.length) { showReg(); return; }
      R.cine = { pages, i: 0 };
      const c = $('#sh-cine');
      c.hidden = false; c.classList.remove('out');
      c.innerHTML = `<div class="cbg"><i></i></div><div class="cdate">${esc((M.status && M.status.dateText) || 'D1')} · ${esc(BUILDING)}</div><p class="ctext"></p><span class="chint">탭하여 계속 ▾</span><button class="cskip" data-sh="cine-skip">건너뛰기 ›</button><div class="cbar"></div>`;
      cineShow();
    }
    function cineShow() {
      const C = R.cine, p = C.pages[C.i], c = $('#sh-cine');
      let img = p.img; for (let k = C.i; !img && k >= 0; k--) img = C.pages[k].img;
      if (img) { c.querySelector('.cbg i').style.backgroundImage = cssUrl(img.src); setBg(img.src); }
      const t = c.querySelector('.ctext');
      t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
      c.querySelector('.chint').style.opacity = 0;
      typeTo(t, p.kind === 'say' ? `${p.who} — “${p.text}”` : p.text, () => { const h = c.querySelector('.chint'); if (h) h.style.opacity = 1; });
      c.querySelector('.cbar').style.width = ((C.i + 1) / C.pages.length * 100) + '%';
    }
    function cineNext() {
      if (R.typing) { R.typing.finish(); return; }
      if (!R.cine) return;
      if (R.cine.i < R.cine.pages.length - 1) { R.cine.i++; cineShow(); } else cineEnd();
    }
    function cineEnd() {
      if (!R.cine) return;
      R.cine = null; clearInterval(typeT); R.typing = null;
      const c = $('#sh-cine'); c.classList.add('out');
      setTimeout(() => { c.hidden = true; c.classList.remove('out'); showReg(); }, M.prefs.fx ? 450 : 0);
    }
    const FIRST_ACTS = ['인터폰 화면을 확인한다.', '철문 너머로 누구냐고 묻는다.', '창고부터 다시 확인한다.'];
    function showReg() {
      R.regAct = R.regAct == null ? -1 : R.regAct;
      const r = $('#sh-reg');
      r.hidden = false;
      r.innerHTML = `<div class="vbg desk"></div><div class="paper">
        <div><div class="rt">건물주 등록증</div><div class="rs">${esc(BUILDING)} 관리대장 · 제 1호</div></div>
        <div class="rf"><label for="sh-rname">성명</label><input id="sh-rname" maxlength="8" autocomplete="off" spellcheck="false" placeholder="이름을 적어 주세요" value="${esc(M.owner || '')}"></div>
        <div class="rrow"><span>첫 행동</span></div>
        <div class="sh-racts">${FIRST_ACTS.map((a, i) => `<button class="${R.regAct === i ? 'on' : ''}" data-sh="reg-act" data-i="${i}">${esc(a)}</button>`).join('')}</div>
        <div class="rnote">※ 목표: D100 구조까지 버티기.<br>※ 선택지는 없어요. 하고 싶은 걸 그대로 적어도 돼요. 고른 행동은 입력칸에 채워지고, 보내기는 직접 눌러 주세요.</div>
        <div class="rbtn"><button class="pl ghost" data-sh="reg-skip">나중에</button><button class="pl" data-sh="reg-ok">서명하고 시작</button></div>
      </div>`;
    }
    function regDone(fillIt) {
      const n = ((($('#sh-rname') || {}).value) || '').replace(/[<>&"'`]/g, '').trim().slice(0, 8);
      if (n) M.owner = n;
      save();
      $('#sh-reg').hidden = true;
      sceneBgm(R.nextBgm);
      if (fillIt && R.regAct >= 0) fill(FIRST_ACTS[R.regAct]);
      R.i = R.beats.length - 1;
      showBeat(R.beats.length ? R.i : -1);
      if (R.beats.length) { clearInterval(typeT); R.typing = null; const d = $('#sh-dlg .dline'); const b = R.beats[R.i]; if (d && b) d.textContent = b.kind === 'say' ? `“${b.text}”` : b.text; const q = $('#sh-dlg .sh-endq'); if (q) q.hidden = false; }
    }

    // ---------- 입력칸 ----------
    function autosize() { const ta = $('#sh-in'); ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; }
    function fill(text) {
      const ta = $('#sh-in');
      ta.value = text; ta.focus(); ta.setSelectionRange(text.length, text.length); autosize();
      ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
    }
    function doSend() {
      const ta = $('#sh-in');
      const text = ta.value.trim();
      if (!text || R.waiting) return;
      if (R.mode !== 'play' || R.away || R.page !== 'chat') { toast(R.away ? '이 세이브의 대화로 돌아온 뒤에 보낼 수 있어요' : '대화 화면이 열린 뒤에 보낼 수 있어요'); return; }
      R.waiting = true; R.sentAt = Date.now();
      M.lines.push({ d: (M.status && M.status.day) || 0, who: owner(), t: text, me: true }); save();
      o.send(text);
      ta.value = ''; autosize();
      waitingUi(true);
    }

    // ---------- 응답 대기 화면: 무전기 잡음 + 팁 ----------
    const TIPS = Array.isArray(data.tips) && data.tips.length ? data.tips : ['위쪽 「크랙 화면」 버튼으로 언제든 원래 크랙 화면을 볼 수 있어요.'];
    let tipI = Math.floor(Math.random() * TIPS.length), tipT = null;
    function waitingUi(on, preview) {
      el.classList.toggle('sh-wait', !!on);
      clearInterval(tipT);
      if (!on) return;
      if (R.view !== 'lobby') { R.view = 'lobby'; R.phone = 'peek'; render(); }
      const d = $('#sh-dlg');
      d.className = 'k-wait';
      d.innerHTML = `<div class="sh-radio"><span class="sh-wave"><i></i><i></i><i></i><i></i><i></i></span><b>치직… 무전 너머로 이야기가 들려오는 중<em>.</em><em>.</em><em>.</em></b></div>
        <div class="sh-tip">📻 ${esc(TIPS[tipI % TIPS.length])}</div>${preview ? `<small class="sh-stream">${esc(preview.slice(-140))}</small>` : ''}`;
      tipT = setInterval(() => { tipI++; const t = el.querySelector('.sh-tip'); if (t) t.textContent = '📻 ' + TIPS[tipI % TIPS.length]; else clearInterval(tipT); }, 5000);
    }
    const waitT = setInterval(() => { if (R.waiting && Date.now() - R.sentAt > 45000) banner('slow'); }, 5000);

    // ---------- 안내 띠 (packrun.js와 같은 경우들) ----------
    function banner(kind) {
      const b = $('#sh-banner');
      if (!kind) { b.hidden = true; b.innerHTML = ''; b.className = 'sh-banner'; return; }
      const row = (btns) => `<div class="sh-brow">${btns}</div>`;
      const std = '<button class="sh-fb" data-sh="crack">크랙 화면 보기</button><button class="sh-fb" data-sh="title">처음 화면</button><button class="sh-fb" data-sh="diag">화면 진단 복사</button>';
      b.hidden = false; b.className = 'sh-banner center';
      if (kind === 'other') b.innerHTML = `<div class="sh-gate"><b>세이브의 대화가 열리지 않았어요</b><span>크랙에서 대화가 지워졌거나 로그인이 풀렸을 수 있어요.</span>${row('<button class="sh-fb primary" data-sh="back-save">다시 열기</button>' + std)}</div>`;
      else if (kind === 'mode') {
        const ms = (R.actions || []).filter(a => a.kind === 'mode');
        const picked = R.sm && R.sm.picked;
        b.innerHTML = `<div class="sh-gate"><b>시작 설정을 골라 주세요</b><span>${picked ? `「${esc(picked)}」를 골랐어요. 크랙이 시작하기를 기다리는 중이에요.` : '어떤 설정으로 시작할까요? 고른 것만 크랙에 한 번 눌러 줘요.'}</span>
          <div class="sh-modes">${ms.map(a => `<button class="sh-mode ${picked === a.label ? 'on' : ''}" data-sh="pick-mode" data-id="${a.id}" data-label="${esc(a.label)}">${esc(a.label)}</button>`).join('')}</div>
          ${row('<button class="sh-fb" data-sh="crack-pick">크랙 화면에서 직접 고르기</button><button class="sh-fb" data-sh="title">처음 화면</button><button class="sh-fb" data-sh="diag">화면 진단 복사</button>')}</div>`;
      }
      else if (kind === 'new') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        const why = R.newFlow && R.newFlow.clicked ? '크랙에서 새 대화가 열리면 바로 시작해요.'
          : (R.page === 'detail' && !acts.length ? '크랙 작품 화면에서 「새로하기」 버튼을 찾지 못했어요. 크랙 화면 보기를 눌러 직접 「새로하기」를 누르면 바로 이어져요.' : '크랙 작품 화면을 여는 중이에요…');
        b.innerHTML = `<div class="sh-gate"><span class="sh-wave"><i></i><i></i><i></i><i></i><i></i></span><b>새 대화를 여는 중이에요</b><span>${why}</span>${R.newFlow && R.newFlow.clicked ? '<span class="sh-small">기본모드·하드모드 같은 시작 설정을 고르는 창이 떠서 멈췄다면 「크랙 화면에서 직접 고르기」를 눌러 고르세요. 대화가 열리면 게임 화면으로 저절로 돌아와요.</span>' : ''}${row(acts.map(a => `<button class="sh-fb primary" data-sh="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + '<button class="sh-fb primary" data-sh="crack-pick">크랙 화면에서 직접 고르기</button>' + std)}</div>`;
      } else if (kind === 'old') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        b.innerHTML = `<div class="sh-gate"><b>크랙이 예전 대화를 열었어요</b><span>처음부터 하려면 새 대화가 필요해요. 「작품 화면에서 새로하기」를 누르면 CRION이 새 대화를 열어요. 예전 대화는 읽지 않아요.</span>${row(acts.map(a => `<button class="sh-fb primary" data-sh="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + `<button class="sh-fb ${acts.length ? '' : 'primary'}" data-sh="retry-new">작품 화면에서 새로하기</button>` + std)}</div>`;
      } else if (kind === 'away') b.innerHTML = `<div class="sh-gate"><b>이 세이브의 대화가 아니에요</b><span>크랙 화면에서 다른 대화로 옮겨 갔어요. 이 대화는 읽지 않아요.</span>${row('<button class="sh-fb primary" data-sh="back-save">세이브 대화로 돌아가기</button>' + std)}</div>`;
      else if (kind === 'slow') { b.className = 'sh-banner'; b.innerHTML = `<span>응답을 아직 못 읽었어요. 크랙에서 답이 왔는지 확인해 보세요.</span><button class="sh-fb" data-sh="crack">크랙 화면 보기</button><button class="sh-fb" data-sh="diag">화면 진단 복사</button><button class="sh-fb" data-sh="unwait">닫기</button>`; }
    }

    // ---------- 관리 화면 ----------
    const people = (f) => Object.entries(M.people).map(([name, p]) => Object.assign({ name }, p)).filter(f || (() => true)).sort((a, b) => (a.order || 0) - (b.order || 0));
    const residents = () => people(p => p.st === 'res');
    const awayNames = () => new Set([].concat(...(st0().dispatch || []).map(d => d.party)));
    const jobOf = (n) => { const c = (st0().chores || []).find(x => x.name === n); return c ? c.job : ''; };
    const VIEWS = { building: { anim: 'drop', bg: '', fn: viewBuilding }, people: { anim: 'slidel', bg: 'desk', fn: viewPeople }, explore: { anim: 'unfold', bg: 'desk', fn: viewExplore }, log: { anim: 'flip', bg: 'desk', fn: viewLog }, lab: { anim: 'slider', bg: '', fn: viewLab }, dex: { anim: 'pin', bg: 'cork', fn: viewDex } };
    function renderView() {
      const v = R.view, box = $('#sh-view'), def = VIEWS[v];
      if (!def) return;
      const keep = {}; box.querySelectorAll('[data-sk]').forEach(n => { keep[n.dataset.sk] = n.scrollTop; });
      const out = def.fn();
      box.innerHTML = `<div class="vbg ${def.bg}"></div>${out.main}${out.pills ? `<div class="obar ${out.pills.length > 3 ? 'many' : ''}">${out.pills.map((b, i) => `<button class="ob ${b.on ? 'on' : ''}" style="--i:${i}" data-sh="${b.act}" ${b.k != null ? `data-k="${esc(b.k)}"` : ''} ${b.dis ? 'disabled' : ''}>${b.t}${b.sm ? `<small>${b.sm}</small>` : ''}</button>`).join('')}</div>` : ''}${noteHtml()}`;
      box.querySelectorAll('[data-sk]').forEach(n => { if (keep[n.dataset.sk] != null) n.scrollTop = keep[n.dataset.sk]; });
      if (v !== R.lastView) { box.className = 'anim-' + def.anim + ' enter'; clearTimeout(box._t); box._t = setTimeout(() => box.classList.remove('enter'), 1300); R.lastView = v; }
    }
    function render() {
      const lobby = R.view === 'lobby';
      $('#sh-view').hidden = lobby; $('#sh-topnav').hidden = lobby; $('#sh-dlg').hidden = !lobby || !!R.cen;
      if (!lobby) $('#sh-cen').hidden = true; else if (R.cen) $('#sh-cen').hidden = false;
      renderHud();
      if (lobby) R.lastView = 'lobby'; else renderView();
      renderPhone();
    }
    function go(v) { R.view = v; R.phone = v === 'lobby' ? 'peek' : 'hide'; R.note = null; render(); }

    // ── 지시서 (메모지): 사람·지역·형태를 고르면 문장이 만들어지고 '입력칸에 채우기'
    const pickList = (names, sel, key, multi) => names.length ? `<div class="team">${names.map(n => `<button class="pick ${(multi ? (sel || []).includes(n) : sel === n) ? 'on' : ''}" data-sh="npick" data-key="${key}" data-v="${esc(n)}" data-multi="${multi ? 1 : ''}">${esc(n)}</button>`).join('')}</div>` : '<span class="s-hint">고를 수 있는 사람이 없어요</span>';
    const segPick = (opts, cur, key) => `<div class="team">${opts.map(([v, l, dis]) => `<button class="pick ${cur === v ? 'on' : ''}" data-sh="npick" data-key="${key}" data-v="${esc(v)}" ${dis ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>`;
    const hereNames = () => residents().map(p => p.name).filter(n => !awayNames().has(n));
    function noteSentence(N) {
      const s = N.s || {};
      const who = (a) => joinNames(a || []);
      switch (N.k) {
        case 'expand': return (s.who || []).length ? `확장 공사를 시작한다. 공사는 ${who(s.who)}에게 맡긴다.` : '확장 공사를 시작한다.';
        case 'defend': return (s.who || []).length ? `${who(s.who)}에게 자재로 방어를 보강하라고 한다.` : '자재로 방어를 보강한다.';
        case 'repair': return s.one ? `부서진 곳을 보수한다. 보수는 ${s.one}에게 맡긴다.` : '부서진 곳을 보수한다.';
        case 'ration': return s.mode === '균등' ? '오늘부터 배급은 균등하게 나눈다.' : s.mode === '기여' ? '오늘부터 배급은 일한 만큼 나눈다.' : s.mode === '감량' ? '오늘부터 배급을 줄인다.' : s.mode === '편애' ? (s.one ? `오늘부터 ${s.one}에게 배급을 더 많이 준다.` : '') : '';
        case 'feast': return '오늘 저녁은 다 같이 잔치를 연다.';
        case 'job': return s.job ? `오늘 ${N.who}에게 ${josa(s.job, '을', '를')} 맡긴다.` : '';
        case 'research': return s.one ? `${s.one}에게 연구를 맡긴다.` : '';
        case 'explore': {
          const r = R.region, team = R.team;
          if (!r || !team.length) return '';
          const t = josa(who(team), '을', '를');
          let out = R.form === '당일치기' ? `${t} ${r}에 당일치기로 보낸다.` : R.form === '정찰' ? `${t} ${r}에 정찰 보낸다.` : R.form === '원정' ? `${t} ${r}에 원정 보낸다. 현지에 ${R.stay}일 머물게 한다.` : `${t} ${r}에 파견한다.`;
          if (R.withMe) out += R.keeper ? ` 나도 같이 간다. 집은 ${R.keeper}에게 맡긴다.` : ' 나도 같이 간다.';
          return out;
        }
      }
      return '';
    }
    function noteHtml() {
      const N = R.note;
      if (!N) return '';
      const s = N.s || (N.s = {});
      const pos = R.view === 'people' ? 'left:calc(18*var(--vw));bottom:calc(calc(12*var(--vh)) + var(--gut));width:min(420px,calc(44*var(--vw)));max-height:calc(56*var(--vh))'
        : 'right:calc(calc(11*var(--vw)) + 1%);top:calc(calc(9*var(--vh)) + 10px);width:min(360px,calc(40*var(--vw)));max-height:calc(66*var(--vh))';
      let title = '', body = '';
      const here = hereNames();
      if (N.k === 'expand') { title = '확장 공사'; body = `<span class="s-hint">공사를 맡을 사람</span>${pickList(here, s.who, 'who', true)}`; }
      if (N.k === 'defend') { title = '방어 보강'; body = `<span class="s-hint">보강을 맡을 사람</span>${pickList(here, s.who, 'who', true)}`; }
      if (N.k === 'repair') { title = '보수'; body = `<span class="s-hint">보수를 맡을 사람 (안 골라도 돼요)</span>${pickList(here, s.one, 'one')}`; }
      if (N.k === 'ration') { title = '배급 방식'; body = segPick((data.rations || ['균등', '기여', '편애', '감량']).map(r => [r, r]), s.mode, 'mode') + (s.mode === '편애' ? `<span class="s-hint">누구에게</span>${pickList(residents().map(p => p.name), s.one, 'one')}` : ''); }
      if (N.k === 'feast') { title = '잔치'; body = '<span class="s-hint">오늘 저녁 식사 자리에서 다 같이.</span>'; }
      if (N.k === 'job') { title = `${N.who} · 일과 맡기기`; body = segPick((data.jobs || []).map(j => [j, j]), s.job, 'job'); }
      if (N.k === 'research') { title = '연구 담당 정하기'; body = pickList(here, s.one, 'one'); }
      const sent = noteSentence(N);
      return `<div class="note" style="${pos}" data-sk="note"><button class="x" data-sh="noteclose" aria-label="닫기">×</button><h3>${esc(title)}</h3>${body}
        <div class="sh-sent">${sent ? esc(sent) : '<span class="s-hint">고르면 문장이 만들어져요</span>'}</div>
        <button class="s-btn primary" data-sh="note-fill" ${sent ? '' : 'disabled'}>입력칸에 채우기</button></div>`;
    }

    // ── 건물관리: 도면
    const RM = { TL: [4, 6, 29, 37], TR: [67, 6, 29, 37], UL: [4, 43, 29, 10], UR: [67, 43, 29, 10], BL: [4, 53, 29, 38], BR: [67, 53, 29, 38], HALL: [33, 6, 34, 85] };
    function planSVG(lobby) {
      const ink = '#2a2927';
      return `<svg class="plan" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="${ink}" stroke-linecap="square">
        <rect x="360" y="4" width="280" height="36" stroke-width="3"/><rect x="360" y="604" width="280" height="30" stroke-width="3"/>
        <rect x="40" y="38" width="920" height="546" stroke-width="10"/>
        <path d="M330 38v150M330 250v92M330 400v184M670 38v150M670 250v92M670 400v184" stroke-width="7"/>
        <path d="M40 275h290M40 340h290M670 275h290M670 340h290" stroke-width="5"/>
        <path d="M330 190a60 60 0 0 1 60 60M670 190a60 60 0 0 0-60 60M330 342a58 58 0 0 1 58 58M670 342a58 58 0 0 0-58 58" stroke-width="1.6"/>
        <g stroke-width="1.6" opacity=".75"><rect x="70" y="70" width="110" height="60"/><rect x="74" y="74" width="30" height="52"/><rect x="220" y="80" width="60" height="44"/>
          <rect x="820" y="70" width="110" height="60"/><rect x="896" y="74" width="30" height="52"/><rect x="700" y="80" width="60" height="44"/>
          <rect x="70" y="480" width="110" height="60"/><rect x="74" y="484" width="30" height="52"/><rect x="220" y="490" width="60" height="44"/>
          <rect x="820" y="480" width="110" height="60"/><rect x="896" y="484" width="30" height="52"/><rect x="700" y="490" width="60" height="44"/>
          ${lobby ? '<path d="M380 470h240M380 490h240M380 510h240M380 530h240M380 550h240M380 570h240"/><rect x="430" y="140" width="140" height="70"/><path d="M430 175h140"/>' : '<rect x="380" y="90" width="50" height="170"/><rect x="570" y="90" width="50" height="170"/><rect x="470" y="140" width="60" height="80"/><rect x="400" y="440" width="200" height="50"/>'}</g>
        <g stroke-width="1.3" opacity=".55"><path d="M112 180l18 22-6 14 20 18M745 120l-14 26 10 12-8 22M520 300l24 18-8 16 26 10M860 420l-20 12 6 20-16 14M200 380l16 14-4 18"/></g></g>
        <text x="500" y="28" text-anchor="middle" font-family="Nanum Pen Script, cursive" font-size="26" fill="${ink}">${lobby ? '철문' : '계단'}</text>
        <text x="500" y="626" text-anchor="middle" font-family="Nanum Pen Script, cursive" font-size="24" fill="${ink}">계단실</text></svg>`;
    }
    const roomBox = (pos, inner, cls, act) => { const [x, y, w, h] = pos; return `<button class="rm ${cls || ''}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%" ${act || 'disabled'}>${inner}</button>`; };
    const FLOORS = [['B1', '지하'], ['1', '1F'], ['2', '2F'], ['3', '3F'], ['4', '4F'], ['R', '옥상']];
    function facBox(pos, name, extra) {
      return M.facilities[name] ? roomBox(pos, `<span class="s-nm">${esc(name)}</span><span class="ac">D${M.facilities[name]} 완공${extra ? ' · ' + extra : ''}</span>`, '') : roomBox(pos, '<span class="s-nm" style="opacity:.7">빈 공간</span>', 'vacant');
    }
    function viewBuilding() {
      const st = st0(), lv = st.exp || 1, f = String(R.floor);
      const cap = st.cap || CAP_BY_LV[lv] || 3, open = ROOMS_BY_LV[lv] || 3, per = Math.max(1, Math.ceil(cap / open));
      const ROOMNO = ['201', '202', '203', '204', '301', '302', '303', '304', '402'];
      const res = residents();
      const roomOf = (idx) => idx < open ? res.slice(idx * per, idx * per + per) : null;
      let rooms = '';
      const roomAt = (pos, idx) => {
        const list = roomOf(idx);
        if (list == null) return roomBox(pos, '<span class="s-nm">폐쇄</span>', 'lock');
        if (!list.length) return roomBox(pos, `<span class="s-nm">${ROOMNO[idx]}호</span><span class="ac">빈 방</span>`, 'vacant');
        const away = awayNames();
        return roomBox(pos, `<span class="s-nm">${ROOMNO[idx]}호</span><span class="ac">${list.map(p => `${esc(p.name)}${away.has(p.name) ? '·파견' : p.hurt ? '·' + esc(p.hurt) : ''}`).join('<br>')}</span>`, list.some(p => away.has(p.name)) ? 'exp' : list.some(p => p.hurt) ? 's-low' : '', `data-sh="openp" data-id="${esc(list[0].name)}"`);
      };
      if (f === '1') {
        rooms += roomBox(RM.TL, `<span class="s-nm">식당</span><span class="ac">102호를 튼 곳</span>`, '');
        rooms += roomBox(RM.TR, `<span class="s-nm">창고</span><span class="ac">식량 ${nOr(st.food)} · 의료품 ${nOr(st.med)} · 자재 ${nOr(st.mat)}</span>`, '');
        rooms += facBox(RM.BL, '의무실'); rooms += facBox(RM.BR, '무전실');
        rooms += roomBox(RM.UL, '우편함', 'lbl') + roomBox(RM.UR, 'CCTV · 인터폰', 'lbl');
        rooms += roomBox(RM.HALL, `<span style="font-family:var(--f-pen);font-size:clamp(18px,calc(4.6*var(--vh)),30px)">철문 · 로비</span><span class="ac" style="font-family:var(--f-pen);font-size:clamp(13px,calc(3*var(--vh)),20px)">방어력 ${nOr(st.def)}</span>`, 'lbl');
      } else if (f === 'B1') {
        rooms += roomBox(RM.TL, `<span class="s-nm">발전기실</span><span class="ac">연료 ${nOr(st.fuel)}</span>`, '');
        rooms += facBox(RM.TR, '연구실', st.rlv != null ? 'Lv ' + st.rlv : ''); rooms += facBox(RM.BL, '격리실');
        rooms += roomBox(RM.BR, '<span class="s-nm">보일러실</span>', 'lock');
        rooms += roomBox(RM.UL, '배전반', 'lbl') + roomBox(RM.UR, '배수구', 'lbl') + roomBox(RM.HALL, '지하 복도', 'lbl');
      } else if (f === 'R') {
        rooms += roomBox(RM.TL, '<span class="s-nm">물탱크</span>', '');
        rooms += M.facilities['텃밭'] ? roomBox(RM.TR, `<span class="s-nm">텃밭</span><span class="ac">D${M.facilities['텃밭']}부터</span>`, '') : roomBox(RM.TR, '<span class="s-nm" style="opacity:.7">빈 화분</span>', 'vacant');
        rooms += roomBox(RM.BL, '<span class="s-nm">빨랫줄</span>', '') + roomBox(RM.BR, '<span class="s-nm">난간</span>', '');
        rooms += roomBox(RM.UL, '배수관', 'lbl') + roomBox(RM.UR, '안테나', 'lbl') + roomBox(RM.HALL, '옥상', 'lbl');
      } else if (f === '4') {
        rooms += roomBox(RM.TL, `<span class="s-nm">집주인방</span><span class="ac">${esc(owner())}</span>`, '');
        rooms += roomAt(RM.TR, 8);
        rooms += roomBox(RM.BL, '<span class="s-nm">다락</span>', 'lock') + roomBox(RM.BR, '<span class="s-nm">세탁실</span>', 'lock');
        rooms += roomBox(RM.UL, '화장실', 'lbl') + roomBox(RM.UR, '창고', 'lbl') + roomBox(RM.HALL, '거실', 'lbl');
      } else {
        const base = f === '2' ? 0 : 4;
        rooms += roomAt(RM.TL, base) + roomAt(RM.TR, base + 1) + roomAt(RM.BL, base + 2) + roomAt(RM.BR, base + 3);
        rooms += roomBox(RM.UL, '화장실', 'lbl') + roomBox(RM.UR, '창고', 'lbl') + roomBox(RM.HALL, '복도', 'lbl');
      }
      const tabs = FLOORS.map(([k, n]) => `<button class="flt ${k === f ? 'on' : ''}" data-sh="floor" data-k="${k}">${n}</button>`).join('');
      const fname = FLOORS.find(x => x[0] === f)[1];
      const main = `<div class="vmain"><div class="bp"><div class="paper torn bpbg"></div>${planSVG(f === '1')}${rooms}<span class="title">${esc(BUILDING)} ${fname} 평면도</span><span class="sh-planinfo">확장 ${lv}단계 · 수용 ${cap}</span><div class="floors">${tabs}</div></div></div>`;
      const nk = R.note && R.note.k;
      return { main, pills: [{ t: '확장 공사', act: 'note', k: 'expand', on: nk === 'expand' }, { t: '방어 보강', act: 'note', k: 'defend', on: nk === 'defend' }, { t: '보수', act: 'note', k: 'repair', on: nk === 'repair' }, { t: '배급 방식', act: 'note', k: 'ration', on: nk === 'ration' }, { t: '잔치', act: 'note', k: 'feast', on: nk === 'feast' }] };
    }

    // ── 주민관리: 인사 파일
    const ST_ORDER = { res: 0, wait: 1, met: 2, gone: 3, dead: 4 };
    function viewPeople() {
      const list = people(p => p.st !== 'dead' && p.st !== 'gone').sort((a, b) => (ST_ORDER[a.st] - ST_ORDER[b.st]) || (a.order - b.order));
      const all = list.concat(people(p => p.st === 'gone' || p.st === 'dead'));
      if (!all.length) return { main: '<div class="vmain"><div class="paper torn pen" style="padding:30px 40px;font-size:28px;transform:rotate(-1deg);color:var(--ink)">인사 기록이 비어 있다.<br>아직 만난 사람이 없다.</div></div>' };
      if (!R.sel || !M.people[R.sel]) R.sel = all[0].name;
      const p = Object.assign({ name: R.sel }, M.people[R.sel]);
      const ro = RO[p.name] || {};
      const job = jobOf(p.name), away = awayNames().has(p.name);
      const disp = (st0().dispatch || []).find(d => d.party.includes(p.name));
      const wait = (st0().wait || []).find(w => w.name === p.name);
      const face = M.face[p.name];
      const stamps = [];
      stamps.push({ res: '<span class="s-stamp blue">거주</span>', wait: '<span class="s-stamp">대기</span>', met: '<span class="s-stamp">만남</span>', gone: '<span class="s-stamp">떠남</span>', dead: '<span class="s-stamp red">사망</span>' }[p.st] || '');
      if (job && !away) stamps.push(`<span class="s-stamp violet">${esc(job)}</span>`);
      if (away) stamps.push('<span class="s-stamp blue">파견 중</span>');
      if (p.hurt) stamps.push(`<span class="s-stamp red">${esc(p.hurt)}</span>`);
      const sk = M.stats[p.name];
      const myLog = M.log.filter(l => l.t.includes(p.name) || (roster.alias && Object.keys(roster.alias).some(a => roster.alias[a] === p.name && l.t.includes(a)))).slice(-8).reverse();
      const tabs = all.map(q => `<button class="ftab ${q.name === p.name ? 'on' : ''}" data-sh="selp" data-id="${esc(q.name)}"><span>${esc(q.name)}</span><small style="font-weight:500;opacity:.7">${{ res: '거주', wait: '대기', met: '만남', gone: '떠남', dead: '사망' }[q.st] || ''}</small></button>`).join('');
      const main = `<div class="vmain" style="right:calc(calc(11*var(--vw)) + 90px)"><div class="folder">
        <div class="fpage" data-sk="pl">
          <div class="idrow"><div class="polaroid"><span class="pclip"></span><div class="s-ph">${face ? `<img src="${esc(face)}" alt="">` : esc(p.name[0])}</div></div>
            <div style="display:flex;flex-direction:column;gap:5px"><span class="s-hint">No.${pad2(ro.no || 0)} · ${esc(ro.sex || '')}${ro.age ? ' · ' + ro.age + '세' : ''}</span><span class="pname">${esc(p.name)}</span><span>${stamps.join(' ')}</span>
              <span class="s-hint">처음 만난 날 D${p.first || '?'}${p.since ? ` · 입주 D${p.since}` : ''}</span></div></div>
          <div class="sgrid">${sk ? `<div>탐사력<b>${sk.E}</b></div><div>전투력<b>${sk.C}</b></div><div>스테미나<b>${sk.S}</b></div>` : '<div>탐사력<b>?</b></div><div>전투력<b>?</b></div><div>스테미나<b>?</b></div>'}</div>
          <span class="s-hint">${sk ? '면접 때 확인한 능력이에요.' : '면접 전 — 첫인상은 체격뿐이에요.'}</span>
        </div>
        <div class="fpage" data-sk="pr">
          <b style="font-family:var(--f-hero);font-size:16px">기록</b>
          <div class="s-row"><div class="who"><b>오늘 일과</b><span class="s-hint">${away ? '파견 중' : esc(job || '미정')}</span></div></div>
          ${disp ? `<div class="s-row"><div class="who"><b>파견</b><span class="s-hint">${esc(disp.dest)} · 귀환 D${disp.ret}</span></div></div>` : ''}
          ${wait ? `<div class="s-row"><div class="who"><b>대기</b><span class="s-hint">${wait.days}일째 문 앞에서 기다리는 중</span></div></div>` : ''}
          <b style="font-family:var(--f-hero);font-size:14px;margin-top:4px">메모</b>
          ${myLog.length ? myLog.map(l => `<span class="s-hint">D${l.d} · ${esc(l.t)}</span>`).join('') : '<span class="s-hint">아직 적어 둔 게 없다.</span>'}
        </div>
        <div class="ftabs" data-sk="ft">${tabs}</div></div></div>`;
      const live = p.st === 'res', gone = p.st === 'gone' || p.st === 'dead';
      return {
        main, pills: [
          { t: '말 걸기', act: 'pfill', k: 'talk', dis: gone || away },
          { t: '면접', act: 'pfill', k: 'interview', dis: gone || away },
          { t: '입주 허락', act: 'pfill', k: 'admit', dis: p.st !== 'wait' && p.st !== 'met' },
          { t: '일과 맡기기', act: 'note', k: 'job', dis: !live || away, on: R.note && R.note.k === 'job' },
          { t: '치료', act: 'pfill', k: 'heal', dis: !live || away }
        ]
      };
    }
    function personSentence(k, n) {
      if (k === 'talk') return `${n}에게 다가가 말을 건다.`;
      if (k === 'interview') return `${josa(n, '을', '를')} 불러 면접을 본다.`;
      if (k === 'admit') return `${n}의 입주를 허락한다.`;
      if (k === 'heal') return `${josa(n, '을', '를')} 치료한다.`;
      return '';
    }

    // ── 파견: 손그림 지도
    const regionKnown = (g) => g.tier === '근거리' || !!M.regions[g.n];
    function viewExplore() {
      const st = st0();
      const g = REG.find(x => x.n === R.region) || null;
      const ink = '#3a332a';
      const disp = st.dispatch || [];
      const roads = `<svg class="roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke-linecap="round">
        <path d="M0 96 C20 90 45 97 62 92 S90 86 100 90" stroke="#8fb2c4" stroke-width="4" opacity=".55"/>
        <path d="M100 70 C85 76 80 84 72 100" stroke="#8fb2c4" stroke-width="2.4" opacity=".45"/>
        <g stroke="${ink}" stroke-width=".5" opacity=".55"><path d="M0 60h100M0 30h100M30 0v100M64 0v100M0 12 L100 96M44 0 C40 40 70 60 76 100"/></g>
        <g stroke="${ink}" stroke-width=".22" opacity=".35">${Array.from({ length: 14 }, (_, i) => `<path d="M${i * 7.5} 0v100"/><path d="M0 ${i * 7.5}h100"/>`).join('')}</g>
        ${g ? `<path d="M${HOME.x} ${HOME.y} L${g.x} ${g.y}" stroke="var(--pill)" stroke-width=".8" stroke-dasharray="2 1.4"/><circle cx="${g.x}" cy="${g.y - 3}" r="5" stroke="var(--pill)" stroke-width=".7"/>` : ''}
        ${disp.map(d => { const r = REG.find(x => x.n === d.dest); return r ? `<path d="M${HOME.x} ${HOME.y} L${r.x} ${r.y}" stroke="#1f5d93" stroke-width=".7" stroke-dasharray="1 1"/>` : ''; }).join('')}</g></svg>`;
      const pins = REG.map(r => regionKnown(r)
        ? `<button class="pinb ${R.region === r.n ? 'sel' : ''}" style="left:${r.x}%;top:${r.y}%" data-sh="region" data-k="${esc(r.n)}"><span class="pn"></span><span class="lb">${esc(r.n)}</span><span class="dg">${esc(r.tier)}</span></button>`
        : `<span class="pinb sh-unk" style="left:${r.x}%;top:${r.y}%"><span class="pn"></span><span class="lb">?</span></span>`).join('');
      const tags = disp.map(d => { const r = REG.find(x => x.n === d.dest); if (!r) return ''; return `<span class="xtag" style="left:${(HOME.x + r.x) / 2}%;top:${(HOME.y + r.y) / 2}%">${esc(d.party.join('·'))} → 귀환 D${d.ret}</span>`; }).join('');
      const here = hereNames();
      R.team = R.team.filter(n => here.includes(n));
      let note;
      if (!g) note = `<h3>파견 지도</h3><span class="s-hint">핀을 눌러 목적지를 고르세요. 아직 소문을 못 들은 곳은 ‘?’로 남아 있어요.</span>${disp.length ? `<b>진행 중</b>${disp.map(d => `<span class="s-hint">${esc(d.party.join('·'))} → ${esc(d.dest)} · 귀환 D${d.ret}</span>`).join('')}` : ''}`;
      else {
        const forms = [['당일치기', '당일치기', !g.day], ['정찰', '정찰'], ['표준', '표준'], ['원정', '원정']];
        const sent = noteSentence({ k: 'explore' });
        const went = (M.regions[g.n] || {}).went || 0;
        note = `<h3>${esc(g.n)}</h3>
          <div class="req"><span>${esc(g.tier)}</span><span>최소 <b>${g.ppl}</b>명</span><span>표준 <b>${g.days}</b>일</span><span>${g.day ? '당일치기 가능' : '당일치기 불가'}</span>${went ? `<span>보낸 적 <b>${went}</b>번</span>` : ''}</div>
          <span class="s-hint">파티</span>${pickList(here, R.team, 'team', true)}
          <span class="s-hint">형태</span>${segPick(forms, R.form, 'form')}
          ${R.form === '원정' ? `<span class="s-hint">현지에 머물 날</span>${segPick([1, 2, 3, 4, 5].map(n => [String(n), n + '일']), String(R.stay), 'stay')}` : ''}
          <label class="sh-chk"><input type="checkbox" data-sh="withme" ${R.withMe ? 'checked' : ''}> 나도 같이 간다</label>
          ${R.withMe ? `<span class="s-hint">집 맡을 사람</span>${pickList(here.filter(n => !R.team.includes(n)), R.keeper, 'keeper')}` : ''}
          <div class="sh-sent">${sent ? esc(sent) : '<span class="s-hint">파티를 고르면 문장이 만들어져요</span>'}</div>`;
      }
      const main = `<div class="vmain wide" style="right:calc(var(--gut) + 8px)"><div class="mapwrap">
        <div class="map paper torn">${roads}<span class="home" style="left:${HOME.x}%;top:${HOME.y}%">${esc(BUILDING)}</span>${pins}${tags}<span class="sh-sea">바다 · 해령항 방면</span></div>
        <div class="mapnote"><div class="note" style="position:relative;inset:auto;height:100%;transform:none" data-sk="en">${note}</div></div></div></div>`;
      const sent = g ? noteSentence({ k: 'explore' }) : '';
      return { main, pills: [{ t: '입력칸에 채우기', act: 'xfill', dis: !sent }, { t: '고르기 초기화', act: 'xclear', dis: !R.team.length && !R.region }] };
    }

    // ── 연구소
    function viewLab() {
      const st = st0(), lv = st.rlv || 0;
      const steps = [1, 2, 3, 4, 5, 6].map(n => `<div class="stp ${n === lv + 1 ? 'cur' : ''}"><span class="bx">${n <= lv ? '✓' : ''}</span><span>${n <= lv ? `연구 ${n}단계 달성` : n === lv + 1 ? `연구 ${n}단계 · ???` : '???'}</span></div>`).join('');
      const btl = (n, v, col) => `<div class="btl"><span class="cap"></span><div class="s-body" style="background-color:${col}"><span class="s-cnt">${nOr(v)}</span><span class="s-lbl">${n}</span></div></div>`;
      const main = `<div class="vmain"><div class="labwrap"><div class="clipb"><div class="sheet" data-sk="lab">
          <b style="font-family:var(--f-hero);font-size:20px">의약 연구 일지</b><span class="s-hint">현재 연구 Lv ${lv}${M.facilities['연구실'] ? ` · 연구실 D${M.facilities['연구실']} 완공` : ''}</span>
          <div class="s-steps">${steps}</div><span class="s-hint" style="margin-top:auto">숫자는 크랙 상태창에서 읽은 값이에요.</span></div></div>
        <div class="shelf"><div class="bottles">${btl('의료품', st.med, '#c9474a')}${btl('연구재료', st.rmat, '#6f7fc2')}${btl('희귀', st.rare, '#5e9fb8')}${btl('연료', st.fuel, '#c98a3a')}</div><div class="plank"></div></div></div></div>`;
      return { main, pills: [{ t: '진척 묻기', act: 'xfill2', k: '연구 진척이 어떤지 물어본다.' }, { t: '연구 담당 정하기', act: 'note', k: 'research', on: R.note && R.note.k === 'research' }] };
    }

    // ── 생존자 도감: 코르크보드
    function viewDex() {
      const f = R.dexf, pinsC = ['#c0392b', '#2c6fb3', '#d4a017', '#3f8f4f'];
      const metN = Object.keys(M.people).length;
      const pols = (data.roster || []).map((r, i) => {
        const p = M.people[r.name];
        const st = p && p.st;
        const show = f === 'all' || (f === 'res' && st === 'res') || (f === 'gone' && (st === 'dead' || st === 'gone'));
        const cls = !p ? 'unk' : st === 'dead' ? 'dead' : st === 'gone' ? 'gone' : '';
        const face = p && M.face[r.name];
        return `<div class="pol ${cls}" style="--i:${i};--rot:${seedRot(i, 5).toFixed(1)}deg;--pc:${pinsC[i % 4]};${show ? '' : 'visibility:hidden'}" ${p ? `data-sh="openp" data-id="${esc(r.name)}"` : ''}><div class="s-ph">${face ? `<img src="${esc(face)}" alt="">` : (p ? esc(r.name[0]) : '?')}</div><span class="cp">${p ? esc(r.name) : 'No.' + pad2(r.no)}</span></div>`;
      }).join('');
      const main = `<div class="vmain wide" style="right:calc(var(--gut) + 8px);left:calc(19*var(--vw))"><div class="board sh-board">${pols}</div></div>`;
      return { main, pills: [{ t: '전체', act: 'dexf', k: 'all', on: f === 'all' }, { t: '거주 중', act: 'dexf', k: 'res', on: f === 'res' }, { t: '떠난 사람', act: 'dexf', k: 'gone', on: f === 'gone' }, { t: `만남 ${metN}/${(data.roster || []).length}`, act: 'noop', dis: true }] };
    }

    // ── 운영일지: 스프링 노트
    function viewLog() {
      const by = {};
      M.log.forEach(l => { (by[l.d] = by[l.d] || []).push(l.t); });
      const days = Object.keys(by).map(Number).sort((a, b) => b - a);
      const half = Math.ceil(days.length / 2);
      const page = (ds) => ds.map(d => `<h4>${d ? d + '일차' : '시작'}</h4>${by[d].map(t => `<p>- ${esc(t)}</p>`).join('')}`).join('') || '<p>…아직 적은 게 없다.</p>';
      return { main: `<div class="vmain"><div class="notebook"><div class="npage" data-sk="l1">${page(days.slice(0, half))}</div><div class="npage" data-sk="l2">${page(days.slice(half))}</div></div></div>` };
    }

    // ---------- 겹창: 지난 대사 · 설정 ----------
    function openModal(k) {
      R.modal = k;
      const box = $('#sh-box');
      if (k === 'lines') {
        const ls = M.lines.slice(-120);
        box.className = 'box wide';
        box.innerHTML = `<button class="sh-x" data-sh="mclose" aria-label="닫기">×</button><h3>지난 대사</h3><div class="sh-lines" data-sk="lines">${ls.length ? ls.map(l => `<p class="${l.me ? 'me' : l.sys ? 'sys' : ''}">${l.who ? `<b>${esc(l.who)}</b>` : ''}${l.act ? `<i>${esc(l.act)}</i>` : ''}<span>${esc(l.t)}</span></p>`).join('') : '<p class="s-hint">아직 없어요.</p>'}</div><div class="btns"><button class="s-btn primary" data-sh="mclose">닫기</button></div>`;
        setTimeout(() => { const n = box.querySelector('.sh-lines'); if (n) n.scrollTop = n.scrollHeight; }, 0);
      } else if (k === 'set') {
        const seg = (key, opts) => `<div class="s-seg">${opts.map(([v, l]) => `<button class="${String(M.prefs[key]) === String(v) ? 'on' : ''}" data-sh="pref" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
        box.className = 'box';
        box.innerHTML = `<button class="sh-x" data-sh="mclose" aria-label="닫기">×</button><h3>설정</h3>
          <div class="setrow"><span>글자 속도</span>${seg('speed', [['slow', '느림'], ['normal', '보통'], ['fast', '빠름'], ['instant', '즉시']])}</div>
          <div class="setrow"><span>화면 연출</span>${seg('fx', [[false, '끔'], [true, '켜짐']])}</div>
          <div class="setrow"><span>배경 음악</span>${seg('music', [[false, '끔'], [true, '켜짐']])}</div>
          <div class="setrow"><span>음량</span><span style="display:flex;gap:8px;align-items:center"><input type="range" id="sh-vol" min="0" max="100" value="${M.prefs.vol}"><b class="num" id="sh-volv">${M.prefs.vol}</b></span></div>
          <div class="setrow"><span>관리인 이름</span><span class="s-hint">${esc(owner())}</span></div>
          <p class="s-hint">게임 화면은 크랙 응답을 읽어 그려요. 크랙 프롬프트·진행은 그대로예요.</p>
          <div class="btns" style="justify-content:flex-start"><button class="s-btn" data-sh="title">처음 화면</button><button class="s-btn" data-sh="crack">크랙 화면 보기</button><button class="s-btn" data-sh="diag">화면 진단 복사</button><button class="s-btn danger" data-sh="pack-off">플레이팩 끄기</button></div>
          <div class="btns"><button class="s-btn primary" data-sh="mclose">닫기</button></div>`;
      }
      $('#sh-modal').hidden = false;
    }
    function closeModal() { R.modal = null; $('#sh-modal').hidden = true; $('#sh-box').innerHTML = ''; }

    // ---------- 입력 ----------
    // 세로 화면: 올라온 관리 폰 밖을 누르면 폰만 접는다
    el.addEventListener('click', (e) => {
      if (R.phone === 'down' && portrait() && !e.target.closest('#sh-phone') && !e.target.closest('.sh-foot') && !e.target.closest('#sh-modal') && !e.target.closest('.layer:not([hidden])')) {
        e.stopPropagation(); e.preventDefault(); R.phone = 'peek'; renderPhone();
      }
    }, true);
    el.addEventListener('click', (e) => {
      if (e.target.id === 'sh-modal') { closeModal(); return; }
      const t = e.target.closest('[data-sh]');
      if (!t || !el.contains(t)) {
        if (e.target.closest('#sh-cine') && !e.target.closest('button')) cineNext();
        return;
      }
      const k = t.dataset.sh;
      switch (k) {
        case 'next': if (!e.target.closest('button')) next(); break;
        case 'send': doSend(); break;
        case 'regen': if (R.waiting) break; o.action('regen'); R.waiting = true; R.sentAt = Date.now(); waitingUi(true); break;
        case 'phone': R.phone = R.phone === 'peek' ? (R.view === 'lobby' ? 'down' : 'hide') : 'peek'; renderPhone(); break;
        case 'go': if (R.waiting && t.dataset.k !== 'log') { toast('응답이 오면 열 수 있어요'); break; } go(R.view === t.dataset.k ? 'lobby' : t.dataset.k); break;
        case 'lobby': go('lobby'); break;
        case 'endday': fill(END_DAY); break;
        case 'openp': R.sel = t.dataset.id; R.note = null; go('people'); R.sel = t.dataset.id; render(); break;
        case 'selp': R.sel = t.dataset.id; R.note = null; render(); break;
        case 'pfill': fill(personSentence(t.dataset.k, R.sel)); break;
        case 'floor': R.floor = t.dataset.k; render(); break;
        case 'note': R.note = R.note && R.note.k === t.dataset.k ? null : { k: t.dataset.k, s: {}, who: R.sel }; render(); break;
        case 'noteclose': R.note = null; render(); break;
        case 'npick': {
          const key = t.dataset.key, v = t.dataset.v, multi = !!t.dataset.multi;
          if (key === 'team') { R.team = R.team.includes(v) ? R.team.filter(x => x !== v) : R.team.concat(v); if (R.keeper === v) R.keeper = ''; }
          else if (key === 'form') R.form = v;
          else if (key === 'stay') R.stay = Number(v);
          else if (key === 'keeper') R.keeper = R.keeper === v ? '' : v;
          else if (R.note) { const s = R.note.s; if (multi) { s[key] = s[key] || []; s[key] = s[key].includes(v) ? s[key].filter(x => x !== v) : s[key].concat(v); } else s[key] = s[key] === v ? '' : v; }
          render(); break;
        }
        case 'note-fill': { const s = R.note && noteSentence(R.note); if (s) { R.note = null; render(); fill(s); toast('입력칸에 채웠어요. 보내기는 직접 눌러 주세요'); } break; }
        case 'region': R.region = t.dataset.k; { const g = REG.find(x => x.n === R.region); if (g && R.form === '당일치기' && !g.day) R.form = '표준'; } render(); break;
        case 'withme': R.withMe = !!t.checked; render(); break;
        case 'xfill': { const s = noteSentence({ k: 'explore' }); if (s) { fill(s); toast('입력칸에 채웠어요. 보내기는 직접 눌러 주세요'); } break; }
        case 'xfill2': fill(t.dataset.k); break;
        case 'xclear': R.team = []; R.region = null; R.withMe = false; R.keeper = ''; render(); break;
        case 'dexf': R.dexf = t.dataset.k; render(); break;
        case 'lines': openModal('lines'); break;
        case 'set': openModal('set'); break;
        case 'mclose': closeModal(); break;
        case 'pref': { const v = t.dataset.v; M.prefs[t.dataset.key] = v === 'true' ? true : v === 'false' ? false : v; save(); if (t.dataset.key === 'music' && bgm) { if (M.prefs.music) { const id = bgmId; bgmId = ''; playBgm(id || SH.pickBgm(man, { screen: R.mode === 'title' ? 'title' : '', regions: regionNames, status: M.status })); } else bgm.stop(); } shRoot.classList.toggle('nofx', !M.prefs.fx); setMood(R.mood); openModal('set'); break; }
        case 'cen-ok': hideCen(); break;
        case 'cine-skip': cineEnd(); break;
        case 'reg-act': R.regAct = Number(t.dataset.i); el.querySelectorAll('.sh-racts button').forEach((b, i) => b.classList.toggle('on', i === R.regAct)); break;
        case 'reg-ok': regDone(true); break;
        case 'reg-skip': regDone(false); break;
        case 'title': closeModal(); showTitle(); break;
        case 'back-save': { const sv = curSave(); if (sv && sv.url) o.load(sv.url); break; }
        case 't-new': startNew(); break;
        case 't-cont': continueSave(t.dataset.id); break;
        case 't-del': { const id = t.dataset.id; if (R.delAsk === id) { saves = saves.filter(x => x.id !== id); putSaves(); try { localStorage.removeItem(memKey(id)); } catch (err) { /* 없음 */ } R.delAsk = null; toast('세이브를 지웠어요 (크랙 대화는 그대로 남아요)'); } else R.delAsk = id; renderTitle(); break; }
        case 't-set': openModal('set'); break;
        case 'click': o.click(t.dataset.id); if (R.newFlow) { R.newFlow.clicked = true; R.newFlow.fromUrl = R.curUrl; banner('new'); } else banner(null); break;
        case 'crack': closeModal(); o.showCrack(true); break;
        case 'pick-mode': if (R.sm && !R.sm.picked) { R.sm.picked = t.dataset.label; o.click(t.dataset.id); banner('mode'); toast(`「${t.dataset.label}」로 시작해요`); } break;
        case 'crack-pick': if (R.sm) R.sm.viaCrack = true; o.showCrack(true); break;
        case 'diag': o.diag(); break;
        case 'retry-new': if (R.newFlow) { R.newFlow = { clicked: false, fromUrl: '', at: Date.now() }; banner('new'); o.load(startUrl()); } break;
        case 'unwait': banner(null); R.waiting = false; waitingUi(false); if (R.i >= 0) showBeat(R.i); else showBeat(-1); break;
        case 'pack-off': o.packOff(); break;
      }
    });
    el.addEventListener('input', (e) => {
      if (e.target.id === 'sh-in') autosize();
      if (e.target.id === 'sh-vol') { M.prefs.vol = Number(e.target.value); const v = el.querySelector('#sh-volv'); if (v) v.textContent = M.prefs.vol; if (bgm) bgm.setVolume(M.prefs.vol / 100); save(); }
    });
    const onKey = (e) => {
      if (!el.isConnected || el.classList.contains('off') || document.querySelector('#layer .scrim')) return;
      if (e.target.id === 'sh-in' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); return; }
      if (/^(TEXTAREA|INPUT|SELECT|WEBVIEW)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { if (R.modal) closeModal(); else if (R.note) { R.note = null; render(); } else if (R.view !== 'lobby') go('lobby'); }
      if ((e.key === ' ' || e.key === 'Enter') && !R.modal && !e.target.closest('button')) {
        e.preventDefault();
        if (R.cine) cineNext(); else if (R.cen) hideCen(); else if ($('#sh-title').hidden) next();
      }
    };
    document.addEventListener('keydown', onKey);
    // 안드로이드 뒤로 버튼: 팩 안의 창부터 하나씩 닫는다 (앱 겹창이 떠 있으면 앱이 먼저)
    const onBack = (e) => {
      if (!el.isConnected || el.closest('.off') || document.querySelector('#layer > *')) return;
      const done = () => e.preventDefault();
      if (R.modal) { closeModal(); return done(); }
      if (!$('#sh-reg').hidden) { regDone(false); return done(); }
      if (R.cine) { cineEnd(); return done(); }
      if (R.note) { R.note = null; render(); return done(); }
      if (R.view !== 'lobby') { go('lobby'); return done(); }
      if (R.phone === 'down') { R.phone = 'peek'; renderPhone(); return done(); }
      if (R.mode !== 'title' && $('#sh-title').hidden) { showTitle(); return done(); }
    };
    document.addEventListener('crion-back', onBack);

    // ---------- 스플래시 · 타이틀 (세이브 고르기) ----------
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.round(m / 60) + '시간 전' : Math.round(m / 1440) + '일 전'; };
    const fmtMs = (ms) => { const m = Math.round((ms || 0) / 60000); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
    const LOGO = url('assets/logo.png') || url('logo.png');
    function renderTitle() {
      const box = $('#sh-title');
      const list = saves.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
      const lastBg = (list[0] && list[0].sum && list[0].sum.bg) || '';
      box.innerHTML = `<div class="tbg">${lastBg ? `<img src="${esc(lastBg)}" alt="">` : ''}</div><div class="tdust"></div><div class="tvig"></div>
        ${LOGO ? `<img class="tlogo" src="${esc(LOGO)}" alt="HIRION GAMES">` : '<b class="tlogo sh-wm">HIRION<span>GAMES</span></b>'}
        <div class="tcopy"><div class="teye">좀비 생존 운영 · 크랙 플레이팩</div><h1 class="thero">아포칼립스<br>안전지대의 관리자</h1><div class="tsub">${esc(BUILDING)}에서 100일</div></div>
        <div class="tmenu">
          <button class="pl" data-sh="t-new">처음부터 시작</button>
          ${list.find(x => x.url) ? `<button class="pl ghost" data-sh="t-cont" data-id="${esc(list.find(x => x.url).id)}">이어하기<small>${esc(sumText(list.find(x => x.url)))}</small></button>` : ''}
          <button class="pl ghost" data-sh="t-set">설정</button>
        </div>
        <div class="sh-saves">
          <h4>세이브 <em>${list.length}</em></h4>
          ${list.length ? list.map((sv, i) => `<div class="sh-save">
              <div class="sh-save-img" style="background-image:${cssUrl(sv.sum && sv.sum.bg)}"></div>
              <div class="sh-save-meta"><b>${esc(sumText(sv))}</b><span>${sv.sum && sv.sum.ppl != null ? `주민 ${sv.sum.ppl}/${sv.sum.cap} · ` : ''}${fmtMs(sv.playMs)} 플레이</span><em>세이브 ${list.length - i} · ${sv.url ? '마지막 ' + ago(sv.last || sv.created) : '대화 연결 전'}</em></div>
              <div class="sh-save-btns">${sv.url ? `<button class="sh-fb primary" data-sh="t-cont" data-id="${esc(sv.id)}">이어하기</button>` : ''}<button class="sh-fb ${R.delAsk === sv.id ? 'danger' : ''}" data-sh="t-del" data-id="${esc(sv.id)}">${R.delAsk === sv.id ? '한 번 더 누르면 삭제' : '지우기'}</button></div>
            </div>`).join('') : '<p class="s-hint">아직 세이브가 없어요. 처음부터는 늘 크랙의 <b>새 대화</b>로 시작해요.</p>'}
        </div>
        <div class="tfoot"><span>CRION 플레이팩 · 크랙 AI가 진행해요</span></div>`;
      box.hidden = false;
    }
    const sumText = (sv) => { const s = (sv && sv.sum) || {}; return s.day ? `D${s.day}${s.time ? ' ' + s.time : ''}${s.place ? ' · ' + s.place : ''}` : '프롤로그'; };
    function resetScene() {
      R.beats = []; R.i = -1; R.lastKey = ''; R.waiting = false; R.away = false; R.cen = null; R.cine = null; R.note = null; R.view = 'lobby'; R.phone = 'peek'; R.team = []; R.region = null; R.sel = null;
      R.bgKey = ''; el.querySelectorAll('.sh-bgl').forEach(x => { x.style.backgroundImage = ''; x.classList.remove('on'); });
      if (M.lastBg) setBg(M.lastBg);
      $('#sh-cine').hidden = true; $('#sh-reg').hidden = true; closeModal();
      setMood({}); render();
      const d = $('#sh-dlg'); d.className = ''; d.innerHTML = '';
    }
    const hideTitle = () => { $('#sh-title').hidden = true; };
    function showTitle() { R.mode = 'title'; R.newFlow = null; R.delAsk = null; banner(null); waitingUi(false); renderTitle(); sceneBgm({ screen: 'title' }); }
    function loading(msg) { const d = $('#sh-dlg'); d.className = 'k-wait'; d.innerHTML = `<div class="sh-radio"><span class="sh-wave"><i></i><i></i><i></i><i></i><i></i></span><b>${esc(msg)}<em>.</em><em>.</em><em>.</em></b></div>`; }
    // 새 게임은 기억해 둔 크랙 작품 화면 주소로 연다 (공유 링크 share.crack.wrtn.ai 는 폰에서 '앱으로 열기'로 넘어가려 해서 멈춤)
    function startUrl() {
      const d = lsGet(`crion.pk.${PK_ID}.detail.${WORK}`, '');
      return (typeof d === 'string' && /^https:\/\/([a-z0-9-]+\.)*wrtn\.ai\//.test(d) && !/^https:\/\/share\./.test(d)) ? d : o.workUrl;
    }
    function startNew() {
      const id = 'sv' + Date.now().toString(36);
      saves.push({ id, url: '', created: Date.now(), last: Date.now(), playMs: 0 });
      putSaves();
      useSave(id); save();
      resetScene();
      R.mode = 'binding'; R.newFlow = { clicked: false, fromUrl: '', at: Date.now() };
      R.sm = { picked: '', confirmed: false, viaCrack: false, newLabel: '', done: false };
      hideTitle(); loading('새 대화를 여는 중이에요'); banner('new');
      o.load(startUrl());
    }
    function continueSave(id) {
      const sv = saves.find(x => x.id === id);
      if (!sv || !sv.url) return;
      useSave(id);
      resetScene();
      R.mode = 'play'; R.boundUrl = normUrl(sv.url); R.newFlow = null; R.sm = null;
      hideTitle(); banner(null); loading('지난 대화를 불러오는 중이에요');
      sceneBgm({});
      o.load(sv.url);
    }
    // 새로하기 뒤 크랙이 띄우는 '시작 설정'(기본모드·하드모드) 고르기 창 → 게임 화면 팝업
    //  작품 화면 위든 대화 화면 위든, 첫 응답이 오기 전까지. 플레이어가 고른 것만 한 번 누르고, 이어서 시작 버튼 한 번
    function startModeStep(st) {
      const sm = R.sm;
      if (!sm || sm.done) return false;
      if (R.mode === 'binding' && !(R.newFlow && R.newFlow.clicked)) return false;   // 새로하기를 누르기 전(작품 화면의 설정 탭 등)은 무시
      const acts = st.actions || [];
      const modes = acts.filter(x => x.kind === 'mode');
      const modeBannerOn = !!$('#sh-banner').querySelector('.sh-modes');
      if (!sm.picked) {
        if (modes.length && !sm.viaCrack) { R.actions = acts; banner('mode'); return true; }
        if (modeBannerOn) banner(R.mode === 'binding' ? 'new' : null);
        return false;
      }
      if (!sm.confirmed) {
        const go2 = acts.find(x => x.kind === 'confirm') || (st.page !== 'chat' ? acts.find(x => x.kind === 'new' && x.label !== sm.newLabel && !x.hidden) : null);
        if (go2) { sm.confirmed = true; o.click(go2.id); banner(R.mode === 'binding' ? 'new' : null); if (R.mode === 'play') loading('이야기를 불러오는 중이에요'); return true; }
        if (modes.length) { R.actions = acts; banner('mode'); return true; }
      }
      if (modeBannerOn) banner(R.mode === 'binding' ? 'new' : null);
      return false;
    }
    function bindNew(st) {
      const nf = R.newFlow;
      if (!nf) return;
      if (startModeStep(st)) return;
      const cf = (st.actions || []).find(x => x.kind === 'confirm');
      if (cf && st.page !== 'chat' && nf.clicked && !nf.confirmed && !(R.sm && (R.sm.picked || R.sm.viaCrack))) { nf.confirmed = true; o.click(cf.id); banner('new'); return; }
      const used = new Set(saves.filter(x => x.id !== saveId && x.url).map(x => normUrl(x.url)));
      if (st.page === 'detail') {
        if (st.url) lsSet(`crion.pk.${PK_ID}.detail.${WORK}`, st.url);
        const a = (st.actions || []).find(x => x.kind === 'new');
        if (a && !nf.clicked) { nf.clicked = true; nf.newLabel = a.label; if (R.sm) R.sm.newLabel = a.label; nf.fromUrl = st.url || R.curUrl; o.click(a.id); }
        banner('new');
        return;
      }
      if (st.page !== 'chat') { banner('new'); return; }
      const u = normUrl(st.url || R.curUrl);
      const noUser = st.users != null ? (st.users === 0 && st.msgs >= 1) : (st.msgs != null && st.msgs >= 0 && st.msgs <= 2);
      const fresh = !used.has(u) && ((nf.clicked && u !== normUrl(nf.fromUrl)) || noUser);
      if (fresh) {
        const sv = curSave();
        if (sv) { sv.url = st.url || R.curUrl; sv.last = Date.now(); putSaves(); }
        R.mode = 'play'; R.boundUrl = u; R.newFlow = null;
        banner(null); loading('이야기를 불러오는 중이에요');
        if (o.showPack) o.showPack();   // 크랙 화면에서 직접 골랐다면 게임 화면으로 돌아온다
        o.rescan();
        return;
      }
      const a = (st.actions || []).find(x => x.kind === 'new');
      if (a && !nf.clicked) { nf.clicked = true; nf.newLabel = a.label; if (R.sm) R.sm.newLabel = a.label; nf.fromUrl = st.url || R.curUrl; o.click(a.id); banner('new'); return; }
      if (nf.clicked && Date.now() - (nf.clickAt || (nf.clickAt = Date.now())) < 6000) { banner('new'); return; }
      const detail = lsGet(`crion.pk.${PK_ID}.detail.${WORK}`, '');
      if (detail && !nf.triedDetail && normUrl(detail) !== u) { nf.triedDetail = true; nf.clicked = false; o.load(detail); banner('new'); return; }
      banner('old');
    }
    const playT = setInterval(() => { const sv = curSave(); if (sv && R.mode === 'play' && !R.away && document.visibilityState === 'visible' && !el.closest('.off')) { sv.playMs = (sv.playMs || 0) + 30000; putSaves(); } }, 30000);

    // 시작: 스플래시(HIRION GAMES 로고) → 타이틀
    render();
    showTitle();
    const sp = $('#sh-splash');
    if (M.prefs.fx) {
      if (LOGO) sp.querySelector('img').src = LOGO; else sp.querySelector('img').outerHTML = '<b class="sh-wm big">HIRION<span>GAMES</span></b>';
      let done = false;
      const fin = () => { if (done) return; done = true; sp.hidden = true; };
      setTimeout(() => sp.classList.add('on'), 200); setTimeout(() => sp.classList.remove('on'), 1900); setTimeout(fin, 2400);
      sp.addEventListener('click', fin);
    } else sp.hidden = true;

    return {
      onIpc(ch, d) {
        if (ch === 'crion:url' && d) {
          R.curUrl = d.url || '';
          if (R.mode === 'play' && d.chat && R.boundUrl) { const away = normUrl(d.url) !== R.boundUrl; if (away !== R.away) { R.away = away; banner(away ? 'away' : null); if (!away) o.rescan(); } }
          return;
        }
        if (ch === 'crion:reply' && (R.mode !== 'play' || R.away)) return;
        if (ch === 'crion:state' && d && R.mode === 'binding') {
          if (d.page) { R.page = d.page; R.actions = d.actions || []; }
          if (d.url) R.curUrl = d.url;
          bindNew(d);
          return;
        }
        if (ch === 'crion:state' && d && R.mode === 'title') return;
        if (ch === 'crion:reply' && d) {
          if (!d.done) { if (R.waiting || d.key !== R.lastKey) { R.waiting = true; R.sentAt = R.sentAt || Date.now(); waitingUi(true, (d.segs || []).filter(s => s.t === 'text' && !s.code).map(s => s.s).join(' ').trim()); } return; }
          if (d.key === R.lastKey && !R.waiting) return;
          R.lastKey = d.key;
          R.waiting = false; waitingUi(false); banner(null);
          handle(d.segs || []);
        } else if (ch === 'crion:state' && d) {
          if (d.page) { R.page = d.page; R.actions = d.actions || []; } else if (d.input) R.page = 'chat';
          if (R.mode === 'play' && !R.away && startModeStep(d)) return;
          if (d.page === 'chat' && d.url && R.boundUrl) { const away = normUrl(d.url) !== R.boundUrl; if (away !== R.away) { R.away = away; banner(away ? 'away' : null); if (!away) o.rescan(); } if (away) return; }
          if (R.page === 'detail' || R.page === 'other') banner('other');
          else if ($('#sh-banner').querySelector('.sh-gate')) banner(null);
        } else if (ch === 'crion:sent' && d) {
          if (!d.ok) { R.waiting = false; waitingUi(false); if (R.i >= 0) showBeat(R.i); toast(d.why === 'no-input' ? '크랙 입력창을 찾지 못했어요. 크랙 화면을 확인해 주세요' : '보내지 못했어요'); }
        }
      },
      destroy() { if (bgm) bgm.stop(); document.removeEventListener('keydown', onKey); document.removeEventListener('crion-back', onBack); clearInterval(waitT); clearInterval(playT); clearInterval(tipT); clearInterval(typeT); save(); },
      demo(segs) { handle(segs); },
      go, state: R, memory: M, saves: () => saves, bgmNow: () => bgmId
    };
  }

  root.CrionSafehouseRun = { start };
})(window);
