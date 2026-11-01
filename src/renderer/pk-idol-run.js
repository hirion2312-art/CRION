// 플레이팩 실행기 — 「반지하 엔터테인먼트」 (runner: "idol") · 모바일 우선
//  디자인: 반지하 사무실의 화이트보드(경영) + 낡은 폰 속 반짝이는 음악 앱 「레몬뮤직」(꿈)
//  - 무대: 크랙 장면, 화이트보드 메모 카드 대사창, 머리줄(년차·월·행동 4칸·자금·유행·상환 D-달·루머)
//  - 레몬뮤직: 레몬차트 TOP100(우리·라이벌 실제 순위 + 분위기용 가상 곡), 곡 상세(커버·데모·순위 추이·후렴·크레딧·반응), 최신, 아티스트, 미니·전체 플레이어
//    우리 곡 = 앱이 만든 가이드 데모(WebAudio), 라이벌 곡 = 팩의 실제 음원(assets/music) — 없으면 '음원 준비 중'
//  - 작업실: 곡 기획서 작성기(배분 10점·장르·테마·작사·후렴·작곡·센터·발매) → 입력칸 채우기
//  - 회사: 자금·부채·숙소·등급 사다리·루머·팬, 이달 행동 4칸, 달력, 약속, 결산 영수증 · 멤버: 카드·소문
//  - 월말 결산 쇼(영수증 → 차트 카운트다운 → 반응·예고), 발매·1위·합류 연출
//  - 버튼은 입력칸에 글만 채운다(보내기는 플레이어 한 번). 숫자는 크랙 상태창·결산 그대로
(function (root) {
  'use strict';
  const U = root.CrionIdol;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => u ? `url('${String(u).replace(/['"\\\n<>]/g, (c) => encodeURIComponent(c))}')` : 'none';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SPEED = { slow: 42, normal: 22, fast: 9, instant: 0 };
  const josa = (w, a, b) => { const c = String(w || '').charCodeAt(String(w || '').length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };
  const ICON = {
    back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    stage: '<path d="M4 5.5h16v11H4z"/><path d="M9 20h6M12 16.5V20"/>',
    lemon: '<path d="M5 15c-1.5-5 2.5-10 8-10 3 0 5 1 6 3 1 2 0 6-2 8-2.5 2.5-6 3.5-9 2.5"/><path d="M5 15l-1.5 2.5M19 8l1.5-2"/>',
    studio: '<rect x="3.5" y="9" width="17" height="10" rx="1.5"/><path d="M7 9v6M10.5 9v6M14 9v6M17.5 9v6"/><path d="M8 5h8"/>',
    office: '<rect x="3.5" y="4.5" width="17" height="12" rx="1"/><path d="M8 20l2-3.5M16 20l-2-3.5M7 8.5h6M7 11.5h9"/>',
    team: '<circle cx="9" cy="8.5" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3.5 19c.6-3.3 3-5 5.5-5s4.9 1.7 5.5 5"/><path d="M14.5 15c2.6-.5 5 1 5.6 4"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>', pause: '<rect x="6.5" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" stroke="none"/><rect x="13.7" y="5.5" width="3.8" height="13" rx="1" fill="currentColor" stroke="none"/>',
    next: '<path d="M6 6l9 6-9 6z" fill="currentColor" stroke="none"/><path d="M17.5 6v12"/>', prev: '<path d="M18 6l-9 6 9 6z" fill="currentColor" stroke="none"/><path d="M6.5 6v12"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', send: '<path d="M4 12l16-7-6 16-3-6.5z"/><path d="M11 14.5L20 5"/>',
    hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 5 16.2L4 13.5a1.5 1.5 0 0 1 2.6-1.4L8 14"/>',
    pin: '<path d="M12 21s6-5.6 6-10.2A6 6 0 0 0 6 10.8C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>', lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', fire: '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4 3.5-5.5 3.5-9.5 3 1.5 4.5 4 4.5 6 1-1 1.5-2.5 1.5-3.5 2 1.5 3.5 4 3.5 7 0 3.4-2.5 6-6.5 6z"/>'
  };
  const ic = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const lemonLogo = () => `<svg class="id-lemonlogo" viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="21" rx="15" ry="12" transform="rotate(-25 20 21)" fill="#ffd23f"/><ellipse cx="20" cy="21" rx="15" ry="12" transform="rotate(-25 20 21)" fill="none" stroke="#e6b800" stroke-width="1.4"/><path d="M30 9c3-2 6-1 7 1-3 1-5 1-7-1z" fill="#2fbf71"/><circle cx="15" cy="18" r="2.4" fill="#fff" opacity=".7"/></svg>`;
  const COND = { 최상: '#2fbf71', 좋음: '#7ccf5a', 보통: '#c9b45a', 지침: '#ef8a3c', 나쁨: '#e5384f', 위험: '#e5384f', 부상: '#9a3b52' };
  const condColor = (c) => { const k = Object.keys(COND).find(x => String(c || '').includes(x)); return k ? COND[k] : '#9aa0ae'; };

  // ---------- 가이드 데모 재생기 (WebAudio) — 우리 곡을 앱이 직접 반주로 만든다 ----------
  function DemoPlayer() {
    let ctx = null, timer = null, score = null, step = 0, nextT = 0, master = null, onStep = null, noiseBuf = null;
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    function env(t, g, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    function tone(t, f, dur, type, peak, dest) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); env(t, g, 0.01, dur, peak); o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05); }
    function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); env(t, g, 0.003, 0.22, 0.9); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3); }
    function noise(t, dur, hp, peak) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = ctx.createGain(); env(t, g, 0.002, dur, peak); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05); }
    function schedule() {
      const spb = 60 / score.bpm / 4;   // 16분음표 길이
      while (nextT < ctx.currentTime + 0.12) {
        const bar = Math.floor(step / 16) % score.bars, s16 = step % 16, t = nextT;
        const ch = score.prog[bar % score.prog.length];
        const tri = [0, ch.minor ? 3 : 4, 7].map(i => ch.root + i);
        const ins = score.inst, soft = ins === 'piano' || ins === 'guitar';
        if (s16 === 0) tri.forEach(m => tone(t, mtof(m + 12), spb * 15, soft ? 'triangle' : 'sawtooth', soft ? 0.05 : 0.025));
        if (soft && s16 % 4 === 2) tri.forEach((m, i) => tone(t + i * 0.02, mtof(m + 24), spb * 3, 'sine', 0.03));
        if (s16 % (ins === 'bass' ? 4 : 8) === 0) tone(t, mtof(ch.root - 12), spb * 6, ins === 'synth' ? 'square' : 'triangle', 0.12);
        if (score.bpm >= 85) { if (s16 % 4 === 0) kick(t); if (s16 === 4 || s16 === 12) noise(t, 0.12, 1800, 0.25); if (s16 % 2 === 0) noise(t, 0.03, 7000, 0.06); }
        else if (s16 === 8) noise(t, 0.05, 6000, 0.04);
        score.melody.filter(n => n.bar === bar && n.step === s16).forEach(n => tone(t, mtof(n.note + 12), spb * n.len * 1.1, ins === 'synth' ? 'square' : 'triangle', ins === 'synth' ? 0.05 : 0.09));
        if (s16 === 0 && onStep) { const b = bar, at = t; setTimeout(() => onStep(b), Math.max(0, (at - ctx.currentTime) * 1000)); }
        nextT += spb; step++;
      }
    }
    return {
      play(sc, cb) {
        this.stop();
        const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
        ctx = ctx || new AC(); if (ctx.state === 'suspended') ctx.resume();
        if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
        master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
        score = sc; step = 0; nextT = ctx.currentTime + 0.08; onStep = cb;
        timer = setInterval(schedule, 25); schedule();
        return true;
      },
      stop() { clearInterval(timer); timer = null; if (master) { try { master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); const m = master; setTimeout(() => { try { m.disconnect(); } catch (e) { /* 이미 끊김 */ } }, 300); } catch (e) { /* 없음 */ } } master = null; },
      get playing() { return !!timer; },
      position() { return score && ctx ? ((step / 16) % score.bars) / score.bars : 0; }
    };
  }

  function start(o) {
    const el = o.el;
    const data = o.data || {};
    const roster = new U.Roster(data);
    const IDX = new U.ImgIndex(data);
    const IMG = (n) => IDX.url(n);
    const asset = (p) => { try { return o.files && o.files.has(p) ? o.files.url(p) : ''; } catch (e) { return ''; } };
    const MEM = data.members || [], RIV = data.rivals || [];
    const MO = Object.fromEntries(MEM.map(m => [m.name, m]));
    const RO = Object.fromEntries(RIV.map(r => [r.group, r]));
    const colorOf = (n) => (MO[n] || {}).color || ((RIV.find(r => r.rep === n) || {}).color) || ((data.staff || []).find(s => s.name === n) || {}).color || '';
    const GROUP = data.group || '레미나';
    const short = (n) => (MO[n] && MO[n].key) || n;

    // ---------- 세이브 ----------
    const PK_ID = o.pack.id, WORK = (o.work && o.work.id) || 'work';
    const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } };
    const SAVES_KEY = `crion.pk.${PK_ID}.saves.${WORK}`, PREF_KEY = `crion.pk.${PK_ID}.prefs`;
    const memKey = (id) => `crion.pk.${PK_ID}.s.${id}`;
    const normUrl = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, ''); } catch (e) { return String(u || ''); } };
    let saves = lsGet(SAVES_KEY, []).filter(x => x && x.id);
    const putSaves = () => lsSet(SAVES_KEY, saves);
    const M = U.blank();
    M.prefs = Object.assign({ speed: 'normal', fx: true, theme: 'light' }, lsGet(PREF_KEY, {}));
    let saveId = null, saveT = null;
    const st0 = () => M.status || {};
    const curSave = () => saves.find(x => x.id === saveId) || null;
    const save = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        lsSet(PREF_KEY, M.prefs);
        if (!saveId) return;
        M.lines = M.lines.slice(-200);
        const { prefs, ...mem } = M;
        lsSet(memKey(saveId), mem);
        const sv = curSave();
        if (sv) { const st = st0(); sv.sum = { y: st.year || 1, m: st.month || 0, money: st.money, best: st.best || null, songs: Object.values(M.songs).filter(s => s.ours && s.released).length, bg: M.lastBg || '' }; sv.last = Date.now(); putSaves(); }
      }, 300);
    };
    function useSave(id) { saveId = id; const mem = Object.assign(U.blank(), id ? lsGet(memKey(id), {}) : {}); Object.keys(U.blank()).forEach(k => { M[k] = mem[k]; }); }

    const R = {
      mode: 'title', boundUrl: '', away: false, newFlow: null, curUrl: '', page: 'chat', actions: [], sm: null,
      beats: [], i: -1, typing: null, waiting: false, sentAt: 0, lastKey: '', sentPlan: null,
      tab: 'stage', sideTab: 'music', mtab: 'chart', song: null, artist: null, chartKey: '', modal: null, bgKey: '', present: [],
      draft: null, play: null, queue: []
    };
    const TABS = [['stage', '무대', 'stage'], ['music', '레몬', 'lemon'], ['studio', '작업실', 'studio'], ['office', '회사', 'office'], ['team', '멤버', 'team']];

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="id ${M.prefs.theme === 'dark' ? 'lm-dark' : ''}">
      <div class="id-main">
        <div class="id-stage" id="id-stage">
          <div class="id-bg"><i class="id-bgl"></i><i class="id-bgl"></i></div><div class="id-shade"></div>
          <div class="id-pt" id="id-pt"><img alt=""></div>
          <header class="id-hud" id="id-hud"></header>
          <div class="id-pops" id="id-pops" aria-live="polite"></div>
          <div class="id-dlg" id="id-dlg" data-id="next"></div>
        </div>
        <aside class="id-side" id="id-side"><nav class="id-stabs" id="id-stabs"></nav><div class="id-panel" id="id-panel"></div></aside>
      </div>
      <div class="id-mini" id="id-mini" hidden></div>
      <footer class="id-foot">
        <div class="id-sugg" id="id-sugg"></div>
        <div class="id-comp">
          <button class="id-planbtn" data-id="tab" data-k="studio" aria-label="곡 작업실">${ic('studio')}<span>곡</span></button>
          <textarea id="id-in" rows="1" placeholder="사장님의 말과 *행동*을 적어요 (Enter 보내기 · Shift+Enter 줄바꿈)"></textarea>
          <button class="id-actbtn" data-id="act" title="*행동* 넣기">${ic('hand')}</button>
          <button class="id-send" data-id="send" aria-label="보내기">${ic('send')}</button>
        </div>
      </footer>
      <nav class="id-tabs" id="id-tabs"></nav>
      <div class="id-layer" id="id-title" hidden></div>
      <div class="id-layer" id="id-show" hidden></div>
      <div class="id-layer" id="id-fx" hidden></div>
      <div class="id-layer" id="id-player" hidden></div>
      <div class="id-over" id="id-modal" hidden><div class="id-box" id="id-box" role="dialog"></div></div>
      <div class="id-banner" id="id-banner" hidden></div>
      <audio id="id-audio" preload="none"></audio>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const idRoot = $('.id');
    const audio = $('#id-audio');
    const demo = DemoPlayer();
    const narrow = () => { try { return root.matchMedia('(max-width: 760px)').matches; } catch (e) { return false; } };
    if (narrow()) $('#id-in').placeholder = '말이나 *행동*을 적어요';
    [idRoot, $('.id-main'), $('#id-stage')].forEach(n => n.addEventListener('scroll', () => { if (n.scrollTop || n.scrollLeft) { n.scrollTop = 0; n.scrollLeft = 0; } }));
    idRoot.classList.toggle('nofx', !M.prefs.fx);
    idRoot.addEventListener('focusin', (e) => { if (e.target.id === 'id-in') idRoot.classList.add('typing'); });
    idRoot.addEventListener('focusout', () => { setTimeout(() => { const a = document.activeElement; if (!a || a.id !== 'id-in') idRoot.classList.remove('typing'); }, 60); });
    const toast = (t) => o.toast(t);
    const K = root.CrionKit ? root.CrionKit.create({
      el, accent: '#e5384f', packId: PK_ID, packName: data.title || '반지하 엔터테인먼트', toast: o.toast,
      fontTargets: ['.id-dlg'], unit: (l) => l.d || '',
      coach: [
        { sel: '#id-hud', title: '이번 달', text: '년차·월과 행동 4칸이에요. 4칸을 다 쓰거나 "월말"이라고 적으면 달이 넘어가요.' },
        { sel: '#id-tabs [data-k=music]', title: '레몬뮤직', text: '레몬차트에서 우리 곡을 찾고, 곡을 눌러 데모를 들어 봐요. 라이벌 곡도 여기서 들어요.' },
        { sel: '#id-stabs [data-k=music]', title: '레몬뮤직', text: '레몬차트에서 우리 곡을 찾고, 곡을 눌러 데모를 들어 봐요. 라이벌 곡도 여기서 들어요.' },
        { sel: '.id-planbtn', title: '곡 작업실', text: '곡 기획서를 채워 입력칸에 넣어요. 배분 10점이 어디 얇은지가 그대로 평가로 돌아와요.' },
        { sel: '#id-sugg', title: '행동 칩', text: '이번 달 할 일을 입력칸에 채워요. 보내기는 직접 눌러요.' }
      ]
    }) : null;

    // ---------- 배경 · 인물 ----------
    let bgFlip = 0;
    function setBg(src) { if (!src || src === R.bgKey) return; R.bgKey = src; const ls = el.querySelectorAll('.id-bgl'); bgFlip = 1 - bgFlip; ls[bgFlip].style.backgroundImage = cssUrl(src); ls[bgFlip].classList.add('on'); ls[1 - bgFlip].classList.remove('on'); M.lastBg = src; }
    function setPortrait(src, who) {
      const pt = $('#id-pt'), im = pt.querySelector('img');
      if (!src) { pt.classList.remove('on'); return; }
      if (im.getAttribute('src') !== src) { pt.classList.remove('on'); void pt.offsetWidth; im.onload = () => pt.classList.toggle('wide', im.naturalWidth / Math.max(1, im.naturalHeight) >= 1.2); im.src = src; }
      pt.style.setProperty('--glow', colorOf(who) || '#e5384f'); pt.classList.add('on');
    }
    const faceOf = (n) => M.faces[n] || IMG(n + '_통상') || '';
    const mono = (n, cls) => `<span class="id-mono ${cls || ''}" style="--c:${colorOf(n) || '#e5384f'}">${esc(short(n).slice(0, 1))}</span>`;
    const avatar = (n, cls) => { const f = faceOf(n); return f ? `<img class="${cls || ''}" src="${esc(f)}" alt="" loading="lazy">` : mono(n, cls); };

    // ---------- 머리줄 ----------
    function renderHud() {
      const st = st0();
      const act = st.act || { n: 0, of: 4 };
      $('#id-hud').innerHTML = `<div class="id-hbar">
          <div class="id-when"><small>${st.year || 1}년차</small><b>${String(st.month || 3).padStart(2, '0')}<i>월</i></b></div>
          <div class="id-acts" title="이달 행동 ${act.n}/${act.of}"><small>행동 ${act.n}/${act.of || 4}</small><span>${Array.from({ length: act.of || 4 }, (_, i) => `<i class="${i < act.n ? 'on' : ''}"></i>`).join('')}</span></div>
          <div class="id-money"><small>자금</small><b>${esc(st.money != null ? U.fmtWon(st.money) : (st.moneyText || '–'))}</b></div>
          <button data-id="more" class="id-more" aria-label="메뉴">${ic('more')}</button>
        </div>
        <div class="id-hrow2">
          ${st.trend ? `<span class="id-trend">${ic('fire')}유행 ${esc(st.trend.genre)}${st.trend.theme ? ', ' + esc(st.trend.theme) : ''}</span>` : ''}
          ${st.debt != null ? `<span class="id-debt ${st.payIn === 0 ? 'due' : ''}">부채 ${esc(U.fmtWon(st.debt))}${st.payIn != null ? ` <em>${st.payIn === 0 ? '이번 달 상환' : st.payIn + '달 뒤 상환'}</em>` : ''}</span>` : ''}
          ${st.rumor ? `<span class="id-rumor lv${st.rumor.n}" title="루머 ${st.rumor.n}/${st.rumor.of}">루머 ${Array.from({ length: st.rumor.of }, (_, i) => `<i class="${i < st.rumor.n ? 'on' : ''}"></i>`).join('')}</span>` : ''}
        </div>`;
    }

    // ---------- 알림 ----------
    function pop(html, cls) {
      if (!M.prefs.fx && !/big/.test(cls || '')) return;
      const box = $('#id-pops'); const n = document.createElement('div'); n.className = 'id-pop ' + (cls || ''); n.innerHTML = html; box.appendChild(n);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 500); }, /big/.test(cls || '') ? 4600 : 3200);
    }

    // ---------- 곡 · 커버 ----------
    const songs = () => Object.values(M.songs || {});
    const ourSongs = () => songs().filter(s => s.ours);
    const rivalSong = (title) => { for (const r of RIV) { const x = (r.songs || []).find(y => y.title === title); if (x) return Object.assign({ artist: r.group, genre: r.genre, theme: r.theme }, x); } return null; };
    const songOf = (title) => { const s = M.songs[title], rs = rivalSong(title); if (s) return rs ? Object.assign({}, rs, s, { genre: s.genre || rs.genre, theme: s.theme || rs.theme, artist: s.artist || rs.artist }) : s; return rs || { title, artist: '', filler: true }; };
    const cover = (s, cls, grain) => U.coverSvg(Object.assign({}, s), data, { cls: 'id-cover ' + (cls || ''), grain: grain || /lg|md|bg/.test(cls || '') });
    const fileOf = (s) => { const rv = RO[s.artist]; const f = rv && (rv.songs || []).find(x => x.title === s.title); return f && f.file ? asset('assets/music/' + f.file) : s.ours ? asset('assets/music/ours/' + s.title + '.mp3') : ''; };
    const canPlay = (s) => !!(s && (s.ours || fileOf(s)));
    const latestKey = () => M.chartOrder.length ? M.chartOrder[M.chartOrder.length - 1] : U.monthKey(st0());

    // ---------- 레몬뮤직 ----------
    function moveHtml(m) { return m === 'new' ? '<em class="mv new">NEW</em>' : m > 0 ? `<em class="mv up">▲${m}</em>` : m < 0 ? `<em class="mv dn">▼${-m}</em>` : '<em class="mv">–</em>'; }
    function chartHtml() {
      const keys = M.chartOrder.length ? M.chartOrder : [U.monthKey(st0())];
      if (!R.chartKey || !keys.includes(R.chartKey)) R.chartKey = keys[keys.length - 1];
      const k = R.chartKey, ki = keys.indexOf(k);
      const list = U.buildChart(M, data, k, 100);
      const ours = list.filter(x => x.ours);
      const real = !!(M.charts[k] || []).length;
      return `<div class="lm-charthead">
          <div><b>TOP 100</b><small>레몬차트, ${esc(U.monthLabel(k))} 집계${real ? '' : ' (결산 전)'}</small></div>
          <div class="lm-month"><button data-id="ck" data-k="${esc(keys[ki - 1] || '')}" ${ki > 0 ? '' : 'disabled'} aria-label="이전 달">${ic('back')}</button><button data-id="ck" data-k="${esc(keys[ki + 1] || '')}" ${ki < keys.length - 1 ? '' : 'disabled'} aria-label="다음 달">${ic('chev')}</button></div>
        </div>
        ${ours.length ? `<button class="lm-findme" data-id="findme"><span class="lm-fm-cv">${cover(songOf(ours[0].title), 'xs')}</span><span><small>${esc(GROUP)}가 차트에 있어요</small><b>${ours.map(x => '「' + esc(x.title) + '」 ' + x.rank + '위').join(', ')}</b></span>${ic('chev')}</button>` : `<div class="lm-notyet"><b>${esc(GROUP)}의 곡은 아직 차트에 없어요</b><span>곡을 발매하고 월말 결산을 받으면 여기 올라와요.</span></div>`}
        <ol class="lm-list">${list.map(x => {
          const s = x.filler ? { title: x.title, artist: x.artist, genre: x.genre } : songOf(x.title);
          const rv = RO[x.artist];
          return `<li class="${x.ours ? 'ours' : ''} ${x.rival ? 'rival' : ''} ${x.rank <= 3 ? 'top' : ''}" data-rank="${x.rank}" style="${rv ? '--rc:' + rv.color : ''}">
            <span class="lm-rk"><b>${x.rank}</b>${moveHtml(x.move)}</span>
            <button class="lm-row" data-id="${x.filler ? 'filler' : 'song'}" data-k="${esc(x.title)}">${cover(s, 'sm')}<span class="lm-tt"><b>${esc(x.title)}</b><small>${x.ours ? `<i class="lm-badge">${esc(GROUP)}</i>` : rv ? `<i class="lm-dot"></i>` : ''}${esc(x.artist)}</small></span></button>
            <button class="lm-pl ${canPlay(s) && !x.filler ? '' : 'off'}" data-id="${x.filler ? 'filler' : 'playsong'}" data-k="${esc(x.title)}" aria-label="재생">${ic('play')}</button>
          </li>`;
        }).join('')}</ol>
        <p class="lm-foot">${esc(GROUP)}와 라이벌 곡의 순위는 크랙 결산 그대로예요. 나머지 칸은 분위기를 위한 가상의 곡이에요.</p>`;
    }
    function songHtml(t) {
      const s = songOf(t);
      const ranks = (s.ranks || []);
      const rv = RO[s.artist];
      const playing = R.play && R.play.song === s.title && R.play.on;
      const sp = ranks.length >= 2 ? (() => { const W = 280, H = 60, n = ranks.length; const pts = ranks.map(([, r], i) => [i / (n - 1) * W, 4 + (r - 1) / 99 * (H - 8)]); return `<svg class="lm-trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="M0 4H${W}" class="g"/><path d="M${pts.map(p => p.join(' ')).join(' L')}"/>${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('')}</svg><div class="lm-trendx">${ranks.map(([k, r]) => `<span>${esc(k.split('-')[1].replace(/^0/, ''))}월 <b>${r}위</b></span>`).join('')}</div>`; })() : '';
      return `<div class="lm-song">
        <button class="lm-back" data-id="msub" data-k="" aria-label="뒤로">${ic('back')}</button>
        <div class="lm-hero" style="--rc:${rv ? rv.color : '#e5384f'}"><div class="lm-disc ${playing ? 'spin' : ''}">${cover(s, 'lg')}</div></div>
        <h3>${esc(s.title)}</h3>
        <p class="lm-art">${s.ours ? `<i class="lm-badge">${esc(GROUP)}</i>` : ''}<button data-id="artist" data-k="${esc(s.ours ? GROUP : s.artist)}">${esc(s.ours ? GROUP : s.artist || '')}</button>${s.released ? ` · ${esc(U.monthLabel(s.released))} 발매` : s.wip ? ' · 제작 중' : ''}</p>
        <div class="lm-actions"><button class="lm-play ${canPlay(s) ? '' : 'off'}" data-id="playsong" data-k="${esc(s.title)}">${ic(playing ? 'pause' : 'play')}<span>${s.ours ? (fileOf(s) ? '듣기' : '가이드 데모') : fileOf(s) ? '듣기' : '음원 준비 중'}</span></button>${s.ours ? `<button class="lm-ghost" data-id="fill" data-v="「${esc(s.title)}」 홍보 계획을 짠다: ">홍보 계획</button>` : `<button class="lm-ghost" data-id="fill" data-v="${esc(s.artist)}의 「${esc(s.title)}」를 들어 본다.">반응 보기</button>`}</div>
        <div class="lm-stats">
          <div><small>등급</small><b>${esc(s.grade || '–')}</b></div><div><small>화력</small><b>${s.heat != null ? s.heat : '–'}</b></div>
          <div><small>최고 순위</small><b>${s.best ? s.best + '위' : '–'}</b></div><div><small>최근</small><b>${s.last ? s.last + '위' : '–'}</b></div>
        </div>
        ${sp ? `<h4 class="lm-h4">순위 추이</h4>${sp}` : ''}
        ${(s.chorus || []).length ? `<h4 class="lm-h4">가사 <small>후렴</small></h4><div class="lm-lyric">${s.chorus.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : s.ours ? '' : '<p class="lm-empty">가사 정보가 없어요.</p>'}
        ${s.ours ? `<h4 class="lm-h4">크레딧</h4><dl class="lm-credit">${[['장르', [s.genre, s.theme].filter(Boolean).join(' · ')], ['작사', s.lyric], ['작곡', s.comp], ['센터', s.center], ['발매', s.channel]].filter(r => r[1]).map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : rv ? `<h4 class="lm-h4">아티스트</h4><p class="lm-rvline">${esc(rv.kind)} · ${esc(rv.concept)}</p>` : ''}
        ${(s.reactions || []).length ? `<h4 class="lm-h4">댓글 <small>${s.reactions.length}</small></h4><ul class="lm-cmts">${s.reactions.map((c, i) => `<li><i style="--h:${(U.hash(c) % 360)}"></i><div><b>${esc(['레몬즙러버', '반지하지킴이', '새벽스밍러', '지나가던청취자', '레미나다시', '귀호강'][i % 6])}</b><p>${esc(c)}</p></div></li>`).join('')}</ul>` : ''}
      </div>`;
    }
    function newHtml() {
      const st = st0();
      const wip = st.wip && st.wip.title ? songOf(st.wip.title) : null;
      const ours = ourSongs().filter(s => s.released).sort((a, b) => (b.released || '').localeCompare(a.released || ''));
      const news = (M.rivalNews || []).slice().reverse();
      return `${wip ? `<div class="lm-wip"><div class="lm-wipc">${cover(Object.assign({}, wip, M.plans[wip.title] || {}), 'md')}</div><div><small>발매 예정 · ${esc(GROUP)}</small><b>${esc(wip.title)}</b><span>${st.wip.prog ? `제작 ${st.wip.prog.n}/${st.wip.prog.of}달` : '제작 중'}${st.wip.rel ? ` · ${st.wip.rel}월 발매` : ''}</span>${st.wip.prog ? `<u><s style="width:${clamp(st.wip.prog.n / Math.max(1, st.wip.prog.of) * 100, 0, 100)}%"></s></u>` : ''}</div></div>` : `<button class="lm-wip empty" data-id="tab" data-k="studio">${ic('studio')}<div><b>진행 중인 곡이 없어요</b><span>곡 작업실에서 기획서를 써 봐요</span></div></button>`}
        <h4 class="lm-h4">최신 발매 <small>${esc(GROUP)}</small></h4>
        ${ours.length ? `<div class="lm-albums">${ours.map(s => `<button data-id="song" data-k="${esc(s.title)}">${cover(s, 'md')}<b>${esc(s.title)}</b><small>${esc(U.monthLabel(s.released))}</small></button>`).join('')}</div>` : '<p class="lm-empty">아직 발매한 곡이 없어요.</p>'}
        <h4 class="lm-h4">라이벌 신곡</h4>
        ${news.length ? `<ul class="lm-news">${news.map(n => { const s = songOf(n.title); return `<li><button data-id="song" data-k="${esc(n.title)}">${cover(s, 'sm')}<span><b>${esc(n.title)}</b><small>${esc(n.group)} · ${esc(U.monthLabel(n.at))}</small></span></button><button class="lm-pl ${canPlay(s) ? '' : 'off'}" data-id="playsong" data-k="${esc(n.title)}">${ic('play')}</button></li>`; }).join('')}</ul>` : '<p class="lm-empty">월초 리포트에 🎧 신곡 공개가 오면 여기 쌓여요.</p>'}`;
    }
    function artistsHtml() {
      if (R.artist) return artistHtml(R.artist);
      const st = st0();
      return `<button class="lm-me" data-id="artist" data-k="${esc(GROUP)}"><div class="lm-mebg"></div><div><small>MY ARTIST</small><b>${esc(GROUP)}</b><span>코어 ${esc(st.core || '0')} · 라이트 ${esc(st.light || '0')} · 구독 ${esc(st.subs || '0')}</span></div>${ic('chev')}</button>
        <h4 class="lm-h4">라이벌</h4>
        <div class="lm-rivals">${RIV.map(r => { const rec = (st.rivals || {})[r.rep]; const f = faceOf(r.rep); return `<button class="lm-rv" data-id="artist" data-k="${esc(r.group)}" style="--rc:${r.color}"><span class="lm-rvimg">${f ? `<img src="${esc(f)}" alt="" loading="lazy">` : `<i>${esc(r.group.slice(0, 1))}</i>`}</span><b>${esc(r.group)}</b><small>${esc(r.kind)}</small>${rec ? `<em>${rec.w}승 ${rec.l}패</em>` : ''}</button>`; }).join('')}</div>`;
    }
    function artistHtml(g) {
      const st = st0();
      if (g === GROUP) {
        const list = ourSongs().sort((a, b) => (b.released || 'z').localeCompare(a.released || 'z'));
        const joined = (M.joined.length ? M.joined : ['윤서하']).filter(n => MO[n]);
        return `<div class="lm-artist ours"><button class="lm-back" data-id="artist-back" aria-label="뒤로">${ic('back')}</button>
          <div class="lm-ahero"><small>${esc(data.groupEn || 'REMINA')}</small><b>${esc(GROUP)}</b><span>${esc(data.company || '')}</span><div class="lm-amem">${joined.map(n => `<i style="--c:${colorOf(n)}" title="${esc(n)}">${avatar(n)}</i>`).join('')}</div></div>
          <div class="lm-stats"><div><small>코어팬</small><b>${esc(st.core || '0')}</b></div><div><small>라이트팬</small><b>${esc(st.light || '0')}</b></div><div><small>구독</small><b>${esc(st.subs || '0')}</b></div><div><small>최고</small><b>${st.best ? st.best + '위' : '–'}</b></div></div>
          <h4 class="lm-h4">디스코그래피 <small>${list.length}</small></h4>
          ${list.length ? `<ul class="lm-news">${list.map(s => `<li><button data-id="song" data-k="${esc(s.title)}">${cover(s, 'sm')}<span><b>${esc(s.title)}</b><small>${s.released ? esc(U.monthLabel(s.released)) : '제작 중'}${s.grade ? ' · ' + esc(s.grade) + '등급' : ''}${s.best ? ' · 최고 ' + s.best + '위' : ''}</small></span></button><button class="lm-pl" data-id="playsong" data-k="${esc(s.title)}">${ic('play')}</button></li>`).join('')}</ul>` : '<p class="lm-empty">첫 곡을 기다리는 중.</p>'}</div>`;
      }
      const r = RO[g]; if (!r) { R.artist = null; return artistsHtml(); }
      const rec = (st.rivals || {})[r.rep];
      const known = songs().filter(s => s.artist === r.group);
      const list = (r.songs || []).map(x => songOf(x.title)).concat(known.filter(k => !(r.songs || []).some(x => x.title === k.title)));
      const f = faceOf(r.rep);
      return `<div class="lm-artist" style="--rc:${r.color}"><button class="lm-back" data-id="artist-back" aria-label="뒤로">${ic('back')}</button>
        <div class="lm-ahero rv">${f ? `<img src="${esc(f)}" alt="">` : ''}<small>${esc(r.kind)}</small><b>${esc(r.group)}</b><span>대표 ${esc(r.rep)} · ${esc(r.concept)}</span></div>
        ${rec ? `<div class="lm-record"><b>${rec.w}</b><span>승</span><i></i><b>${rec.l}</b><span>패</span><small>${esc(GROUP)} 기준 맞대결</small></div>` : ''}
        <h4 class="lm-h4">곡</h4><ul class="lm-news">${list.map(s => { const sn = Object.assign({ artist: r.group }, s); return `<li><button data-id="song" data-k="${esc(sn.title)}">${cover(sn, 'sm')}<span><b>${esc(sn.title)}</b><small>${sn.best ? '최고 ' + sn.best + '위' : sn.released ? esc(U.monthLabel(sn.released)) : '미공개'}</small></span></button><button class="lm-pl ${canPlay(sn) ? '' : 'off'}" data-id="playsong" data-k="${esc(sn.title)}" data-a="${esc(r.group)}">${ic('play')}</button></li>`; }).join('')}</ul></div>`;
    }
    function musicHtml() {
      const sub = R.song ? songHtml(R.song) : R.mtab === 'new' ? newHtml() : R.mtab === 'artist' ? artistsHtml() : chartHtml();
      return `<div class="lm">
        <header class="lm-top">${lemonLogo()}<b class="lm-word">lemon</b><span class="lm-sub">레몬뮤직</span><button class="lm-theme" data-id="lmtheme" aria-label="${M.prefs.theme === 'dark' ? '밝게' : '어둡게'}">${M.prefs.theme === 'dark' ? '☀' : '☾'}</button></header>
        ${R.song ? '' : `<nav class="lm-tabs">${[['chart', '차트'], ['new', '최신'], ['artist', '아티스트']].map(([k, n]) => `<button class="${R.mtab === k ? 'on' : ''}" data-id="mtab" data-k="${k}">${n}</button>`).join('')}</nav>`}
        <div class="lm-body">${sub}</div></div>`;
    }

    // ---------- 곡 작업실 (기획서) ----------
    const ALLOC = ['멜로디', '가사', '퍼포', '비주얼', '홍보'];
    function blankDraft() {
      const st = st0();
      return { title: '', genre: (st.trend && st.trend.genre && data.genres[st.trend.genre]) ? st.trend.genre : '발라드', theme: (st.trend && st.trend.theme) || '청춘', alloc: { 멜로디: 2, 가사: 2, 퍼포: 2, 비주얼: 2, 홍보: 2 }, lyricMode: '공동', lyricGrade: 'C', chorus: ['', '', '', ''], comp: 'C', center: '윤서하', channel: '음원', month: ((st.month || 3) % 12) + 2 > 12 ? ((st.month || 3) + 2 - 12) : (st.month || 3) + 2 };
    }
    const draftPlan = (d) => ({ title: d.title.trim(), genre: d.genre, theme: d.theme, alloc: d.alloc, lyric: d.lyricMode === '외주' ? '외주 ' + d.lyricGrade : d.lyricMode === '공동' ? '공동(서하)' : '직접', chorus: d.chorus.map(x => x.trim()).filter(Boolean), comp: '외주 ' + d.comp, center: d.center, channel: d.channel, month: d.month });
    function studioHtml() {
      const d = R.draft = R.draft || blankDraft();
      const st = st0();
      const sum = ALLOC.reduce((a, k) => a + (d.alloc[k] || 0), 0);
      const left = 10 - sum;
      const trend = st.trend || {};
      const names = (data.names[d.theme] || []).slice(0, 3);
      const members = (M.joined.length ? M.joined : ['윤서하']).filter(n => MO[n]);
      const prev = Object.assign(draftPlan(d), { ours: true, title: d.title.trim() || '제목 미정' });
      const months = Array.from({ length: 4 }, (_, i) => (((st.month || 3) - 1 + i + 1) % 12) + 1);
      const ready = d.title.trim() && left === 0 && d.chorus.some(x => x.trim());
      const seg = (key, opts, cur) => `<div class="st-seg">${opts.map(v => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-id="st-set" data-f="${key}" data-v="${esc(v)}">${esc(v)}${(key === 'genre' && v === trend.genre) || (key === 'theme' && v === trend.theme) ? `<i class="hot" title="이달 유행">${ic('fire')}</i>` : ''}</button>`).join('')}</div>`;
      const grade = (data.grades || []).find(g => g.k === d.comp) || {};
      return `<div class="st">
        <header class="st-head">
          <div class="st-ht"><h3>곡 기획서</h3><p>${esc(GROUP)}의 다음 싱글. 다 채우면 입력칸에 넣어 크랙에 보내요.</p></div>
          <div class="st-prev"><div class="st-case"><div class="st-cv">${cover(prev, 'md', true)}</div></div><button class="st-demo ${R.play && R.play.draft && R.play.on ? 'on' : ''}" data-id="st-demo">${ic(R.play && R.play.draft && R.play.on ? 'pause' : 'play')}<span>데모</span></button></div>
        </header>
        <section class="st-sec"><label class="st-title"><span>곡명</span><input id="st-title" maxlength="24" value="${esc(d.title)}" placeholder="제목을 적어요"></label>
          <div class="st-sugg">${names.map(n => `<button data-id="st-set" data-f="title" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div></section>
        <section class="st-sec"><h4>장르</h4>${seg('genre', Object.keys(data.genres || {}), d.genre)}<h4>테마</h4>${seg('theme', Object.keys(data.themes || {}), d.theme)}</section>
        <section class="st-console">
          <header><h4>믹스 배분</h4><em class="${left === 0 ? 'ok' : left < 0 ? 'bad' : ''}">${left === 0 ? '10점을 다 나눴어요' : left > 0 ? `${left}점 남음` : `${-left}점 넘침`}</em></header>
          <div class="st-strips">${ALLOC.map(k => { const v = d.alloc[k] || 0; return `<div class="st-strip ${v === 0 ? 'zero' : ''}">
            <button data-id="st-al" data-k="${k}" data-d="1" ${left <= 0 || v >= 6 ? 'disabled' : ''} aria-label="${k} 올리기">+</button>
            <u>${[5, 4, 3, 2, 1, 0].map(i => `<i class="${i < v ? 'on' : ''}" style="--i:${i}"></i>`).join('')}</u>
            <b>${v}</b><span>${k}</span>
            <button data-id="st-al" data-k="${k}" data-d="-1" ${v <= 0 ? 'disabled' : ''} aria-label="${k} 내리기">−</button></div>`; }).join('')}</div>
          ${ALLOC.some(k => !d.alloc[k]) ? `<p class="st-warn">${ALLOC.filter(k => !d.alloc[k]).join(', ')}이(가) 0점이에요. 평가에서 약점으로 돌아와요.</p>` : ''}
        </section>
        <section class="st-sec st-sheet"><h4>후렴 <small>짧고 반복될수록 귀에 붙어요</small></h4>${d.chorus.map((l, i) => `<input data-ch="${i}" maxlength="30" value="${esc(l)}" placeholder="${i === 0 ? '후렴 첫 줄' : '선택'}">`).join('')}</section>
        <section class="st-sec"><h4>작사</h4>${seg('lyricMode', ['직접', '공동', '외주'], d.lyricMode)}${d.lyricMode === '외주' ? `<div class="st-sub">${seg('lyricGrade', (data.grades || []).map(g => g.k), d.lyricGrade)}</div>` : `<p class="st-note">${d.lyricMode === '공동' ? '서하가 같이 다듬어요. 품질은 안정적, 개성은 조금 희석돼요.' : '비용 없이 직접 써요. 어떻게 쓰느냐에 따라 평가가 크게 갈려요.'}</p>`}</section>
        <section class="st-sec"><h4>작곡 외주 등급</h4>${seg('comp', (data.grades || []).map(g => g.k), d.comp)}<p class="st-note"><b>${esc(grade.t || '')}</b> ${esc(grade.d || '')}</p></section>
        <section class="st-sec"><h4>센터</h4><div class="st-seg">${members.map(n => `<button class="${d.center === n ? 'on' : ''}" data-id="st-set" data-f="center" data-v="${esc(n)}" style="--c:${colorOf(n)}"><i class="dot"></i>${esc(short(n))}</button>`).join('')}</div></section>
        <section class="st-sec st-two"><div><h4>채널</h4>${seg('channel', ['유튜브', '음원', '실물'], d.channel)}</div><div><h4>발매</h4><div class="st-seg">${months.map(m => `<button class="${d.month === m ? 'on' : ''}" data-id="st-set" data-f="month" data-v="${m}">${m}월</button>`).join('')}</div></div></section>
        <p class="st-note">${d.channel === '유튜브' ? '유튜브는 무료예요. 차트엔 조회수가 간접으로만 반영돼요.' : d.channel === '실물' ? '실물은 제작비가 크고, 코어팬의 화력이 중요해요.' : '음원은 유통 비용이 들고, 차트에 정식으로 올라가요.'}</p>
        <div class="st-btns"><button class="id-btn ghost" data-id="st-reset">새로 쓰기</button><button class="id-btn primary" data-id="st-fill" ${ready ? '' : 'disabled'}>입력칸에 넣기</button></div>
        ${ready ? '' : '<p class="st-note center">곡명, 배분 10점, 후렴 한 줄이 있으면 넣을 수 있어요.</p>'}
      </div>`;
    }

    // ---------- 회사 (화이트보드) ----------
    function officeHtml() {
      const st = st0();
      const lad = data.ladder || [];
      const gi = Math.max(0, lad.indexOf(st.grade || lad[0]));
      const act = st.act || { n: 0, of: 4 };
      const cal = data.calendar || {};
      const mo = st.month || 3;
      return `<div class="of">
        <header class="of-h"><h3>${esc(data.company || '반지하 엔터테인먼트')}</h3><span>${st.year || 1}년차 ${mo}월</span></header>
        <section class="of-money">
          <div class="of-cash"><small>자금</small><b>${esc(st.money != null ? U.fmtWon(st.money) : '–')}</b></div>
          <div class="of-debt"><small>남은 부채</small><b>${esc(st.debt != null ? U.fmtWon(st.debt) : '–')}</b>${st.payIn != null ? `<span class="${st.payIn === 0 ? 'due' : ''}">${st.payIn === 0 ? '이번 달 상환' : st.payIn + '달 뒤 상환'}</span><u><s style="width:${clamp(100 - st.payIn * 33, 6, 100)}%"></s></u>` : ''}</div>
        </section>
        <section class="of-sec"><h4>이달 할 일 <em>${act.n}/${act.of}칸 사용</em></h4>
          <div class="of-slots">${Array.from({ length: act.of || 4 }, (_, i) => `<span class="${i < act.n ? 'used' : ''}">${i < act.n ? ic('play') : i + 1}</span>`).join('')}</div>
          <div class="of-acts">${(data.acts || []).map(a => `<button data-id="fill" data-v="${esc(a.v)}"><i>${a.i}</i><span>${esc(a.k)}</span></button>`).join('')}</div>
          <button class="of-end" data-id="fill" data-v="이번 달을 마무리하고 월말로 넘어간다.">이번 달 마무리하기</button></section>
        <section class="of-sec"><h4>회사 등급</h4><div class="of-ladder">${lad.map((g, i) => `<div class="${i < gi ? 'past' : i === gi ? 'now' : ''}"><i style="--h:${28 + i * 18}%"></i><span>${esc(g)}</span></div>`).join('')}</div></section>
        <section class="of-stats">
          <div><small>숙소</small><b>${esc(st.house || '반지하')}</b></div>
          <div class="${st.rumor && st.rumor.n >= 2 ? 'warn' : ''}"><small>루머</small><b>${st.rumor ? st.rumor.n : 0}<i>/${st.rumor ? st.rumor.of : 3}</i></b></div>
          <div><small>코어팬</small><b>${esc(st.core || '0')}</b></div><div><small>라이트팬</small><b>${esc(st.light || '0')}</b></div>
          <div><small>구독</small><b>${esc(st.subs || '0')}</b></div><div><small>최고 순위</small><b>${st.best ? st.best + '<i>위</i>' : '–'}</b></div>
        </section>
        <section class="of-sec"><h4>올해 달력</h4><div class="of-cal">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<span class="${m === mo ? 'now' : m < mo ? 'past' : ''}"><b>${m}</b><small>${esc(cal[m] ? cal[m].split(/[·,]/)[0].trim() : '')}</small></span>`).join('')}</div></section>
        <section class="of-sec"><h4>지킬 약속</h4>${(M.promises || []).length ? `<div class="of-tickets">${M.promises.map(p => `<p>${esc(p)}</p>`).join('')}</div>` : '<p class="of-empty">멤버와 약속하면 여기 붙어요. 어기면 신뢰가 깎여요.</p>'}</section>
        <section class="of-sec"><h4>라이벌 전적</h4>${Object.keys(st.rivals || {}).length ? `<ul class="of-rec">${Object.entries(st.rivals).map(([n, r]) => `<li style="--c:${colorOf(n) || '#888'}"><b>${esc(n)}</b><span><em>${r.w}</em>승 <em>${r.l}</em>패</span></li>`).join('')}</ul>` : '<p class="of-empty">같은 달에 맞붙으면 전적이 쌓여요.</p>'}</section>
        <section class="of-sec"><h4>결산 영수증</h4>${(M.settles || []).length ? `<div class="of-rcpts">${M.settles.slice().reverse().map((x, i) => `<button data-id="replay" data-k="${M.settles.length - 1 - i}"><b>${x.month || '?'}월</b><span>${esc(x.songs[0] ? '「' + x.songs[0].title + '」 ' + (x.songs[0].grade || '') : '발매 없음')}</span><small>다시 보기</small></button>`).join('')}</div>` : '<p class="of-empty">월말 결산이 오면 영수증이 쌓여요.</p>'}</section>
      </div>`;
    }
    // ---------- 멤버 ----------
    function teamHtml() {
      const st = st0();
      const joined = (M.joined.length ? M.joined : ['윤서하']).filter(n => MO[n]);
      const rest = MEM.filter(m => !joined.includes(m.name));
      const card = (n) => { const m = MO[n], s = (st.members || []).find(x => x.who === n) || {}; return `<article class="pc" style="--c:${m.color}">
          <div class="pc-holo"><div class="pc-in"><div class="pc-img">${avatar(n)}</div>${s.rank ? `<em class="pc-rank">${esc(s.rank)}</em>` : ''}<div class="pc-cap"><b>${esc(n)}</b><small>${esc(s.pos || m.pos)}</small></div></div></div>
          <div class="pc-meta">${s.cond ? `<span class="pc-cond" style="--cc:${condColor(s.cond)}"><i></i>${esc(s.cond)}</span>` : `<span class="pc-cond"><i></i>${m.age}세</span>`}<span class="pc-btns"><button data-id="fill" data-v="${esc(short(n))}와 면담한다.">면담</button><button data-id="center" data-k="${esc(n)}">센터</button></span></div>
          <p class="pc-line">${esc(m.line)}</p></article>`; };
      const back = (m) => `<article class="pc back"><div class="pc-holo"><div class="pc-in"><div class="pc-img"><span class="pc-q">${esc(data.groupEn || 'REMINA')}</span></div><div class="pc-cap"><small>아직 만나지 않았어요</small></div></div></div>
          <p class="pc-line">“${esc(m.rumor)}”</p><small class="pc-where">${ic('pin')}${esc(m.where)}</small></article>`;
      return `<div class="tm"><header class="tm-h"><h3>${esc(GROUP)}</h3><span>${joined.length}명 / 최대 ${MEM.length}명</span></header>
        <div class="tm-grid">${joined.map(card).join('')}${rest.map(back).join('')}</div></div>`;
    }

    function renderPanel() {
      const tab = R.tab === 'stage' ? R.sideTab : R.tab;
      R.sideTab = tab;
      const dot = (k) => (k === 'music' && R.newMusic) || (k === 'team' && R.newMember) ? '<em></em>' : '';
      $('#id-stabs').innerHTML = TABS.slice(1).map(([k, n, i]) => `<button data-id="tab" data-k="${k}" class="${tab === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${dot(k)}</button>`).join('');
      const p = $('#id-panel'); const keep = p.scrollTop;
      p.className = 'id-panel p-' + tab;
      p.innerHTML = tab === 'music' ? musicHtml() : tab === 'studio' ? studioHtml() : tab === 'office' ? officeHtml() : teamHtml();
      p.scrollTop = R.keepScroll ? keep : 0; R.keepScroll = false;
      idRoot.classList.toggle('sheet-on', R.tab !== 'stage');
      $('#id-tabs').innerHTML = TABS.map(([k, n, i]) => `<button data-id="tab" data-k="${k}" class="${R.tab === k ? 'on' : ''} t-${k}">${ic(i)}<span>${n}</span>${dot(k)}</button>`).join('');
    }

    // ---------- 플레이어 ----------
    function renderMini() {
      const m = $('#id-mini'); const P = R.play;
      if (!P) { m.hidden = true; idRoot.classList.remove('has-mini'); return; }
      const s = P.draft ? Object.assign({ ours: true }, draftPlan(R.draft || blankDraft()), { title: (R.draft && R.draft.title) || '제목 미정' }) : songOf(P.song);
      m.hidden = false; idRoot.classList.add('has-mini');
      m.innerHTML = `<button class="id-mbody" data-id="fullplayer">${cover(s, 'xs')}<span><b>${esc(s.title)}</b><small>${esc(s.ours ? GROUP + (P.kind === 'demo' ? ' · 가이드 데모' : '') : s.artist)}</small></span></button>
        <button class="id-mbtn" data-id="pp" aria-label="재생/정지">${ic(P.on ? 'pause' : 'play')}</button><button class="id-mbtn" data-id="pnext" aria-label="다음 곡">${ic('next')}</button><button class="id-mbtn x" data-id="pclose" aria-label="닫기">${ic('x')}</button>
        <i class="id-mprog"><s></s></i>`;
    }
    let progT = null;
    function tickProg() {
      clearInterval(progT);
      progT = setInterval(() => {
        const P = R.play; if (!P || !P.on) return;
        const f = P.kind === 'demo' ? demo.position() : (audio.duration ? audio.currentTime / audio.duration : 0);
        el.querySelectorAll('.id-mprog s, .pl-prog s').forEach(n => { n.style.width = (f * 100).toFixed(1) + '%'; });
      }, 250);
    }
    function playSong(title, artist) {
      if (R.play && R.play.song === title && !R.play.draft) { togglePlay(); return; }
      const s = songOf(title);
      if (artist && !s.artist) s.artist = artist;
      stopAll();
      const f = fileOf(s);
      if (f) { audio.src = f; audio.currentTime = 0; audio.play().catch(() => toast('재생하지 못했어요')); R.play = { song: title, kind: 'file', on: true }; }
      else if (s.ours) { demo.play(U.demoScore(Object.assign({}, s, M.plans[s.title] || {}, { chorus: (s.chorus && s.chorus.length) ? s.chorus : ((M.plans[s.title] || {}).chorus || []) }), data), (bar) => lyricStep(bar)); R.play = { song: title, kind: 'demo', on: true }; }
      else { toast('이 곡은 아직 음원이 없어요. 히리온이 곡을 올리면 들을 수 있어요'); return; }
      R.queue = U.buildChart(M, data, latestKey(), 100).filter(x => !x.filler && canPlay(songOf(x.title))).map(x => x.title);
      renderMini(); tickProg(); refreshPlayIcons();
      if (!$('#id-player').hidden) openPlayer();
    }
    function playDraft() {
      if (R.play && R.play.draft) { togglePlay(); return; }
      stopAll();
      const p = draftPlan(R.draft || blankDraft());
      demo.play(U.demoScore(Object.assign({ ours: true }, p, { title: p.title || '제목 미정' }), data), (bar) => lyricStep(bar));
      R.play = { draft: true, kind: 'demo', on: true };
      renderMini(); tickProg(); refreshPlayIcons();
    }
    function togglePlay() {
      const P = R.play; if (!P) return;
      if (P.on) { if (P.kind === 'demo') demo.stop(); else audio.pause(); P.on = false; }
      else { if (P.kind === 'demo') { if (P.draft) { R.play = null; playDraft(); return; } const t = P.song; R.play = null; playSong(t); return; } audio.play().catch(() => {}); P.on = true; }
      renderMini(); refreshPlayIcons(); if (!$('#id-player').hidden) openPlayer();
    }
    function stopAll() { demo.stop(); try { audio.pause(); } catch (e) { /* 없음 */ } R.play = null; clearInterval(progT); }
    function nextSong(d) { const q = R.queue || []; if (!q.length || !R.play) return; const i = q.indexOf(R.play.song); const n = q[(i + (d || 1) + q.length) % q.length]; if (n) { R.play = null; playSong(n); } }
    audio.addEventListener('ended', () => nextSong(1));
    function refreshPlayIcons() { if (R.tab === 'music' || R.sideTab === 'music' || R.tab === 'studio' || R.sideTab === 'studio') { R.keepScroll = true; renderPanel(); } }
    function lyricStep(bar) { const ls = el.querySelectorAll('.pl-lyric p'); if (!ls.length) return; const i = Math.floor(bar / 2) % ls.length; ls.forEach((n, k) => n.classList.toggle('on', k === i)); }
    function openPlayer() {
      const P = R.play; if (!P) return;
      const s = P.draft ? Object.assign({ ours: true }, draftPlan(R.draft || blankDraft()), { title: (R.draft && R.draft.title) || '제목 미정' }) : songOf(P.song);
      const ch = (s.chorus && s.chorus.length) ? s.chorus : ((M.plans[s.title] || {}).chorus || []);
      const box = $('#id-player');
      box.innerHTML = `<div class="pl" style="--rc:${(RO[s.artist] || {}).color || '#e5384f'}">
        <div class="pl-bg">${cover(s, 'bg')}</div>
        <header><button data-id="pl-close" aria-label="내리기">${ic('back')}</button><span>${P.kind === 'demo' ? '가이드 데모' : '레몬뮤직'}</span><i></i></header>
        <div class="pl-disc ${P.on ? 'spin' : ''}">${cover(s, 'lg')}<i class="pl-hole"></i></div>
        <div class="pl-meta"><b>${esc(s.title)}</b><span>${esc(s.ours ? GROUP : s.artist)}</span></div>
        <div class="pl-lyric">${ch.length ? ch.map((l, i) => `<p class="${i === 0 ? 'on' : ''}">${esc(l)}</p>`).join('') : '<p class="on">♪</p>'}</div>
        <i class="pl-prog"><s></s></i>
        <div class="pl-ctl"><button data-id="pprev" aria-label="이전">${ic('prev')}</button><button class="pp" data-id="pp" aria-label="재생/정지">${ic(P.on ? 'pause' : 'play')}</button><button data-id="pnext" aria-label="다음">${ic('next')}</button></div>
        ${P.kind === 'demo' ? '<p class="pl-note">앱이 기획서(장르·후렴)로 만든 가이드 반주예요. 실제 곡은 크랙 결산이 평가해요.</p>' : ''}
      </div>`;
      box.hidden = false;
    }

    // ---------- 행동 칩 ----------
    function renderSugg() {
      const st = st0(); const out = [];
      R.present.filter(n => MO[n] || roster.by[n]).slice(0, 2).forEach(n => out.push([`${short(n)}에게 말을 건다.`, `${short(n)}에게 말 걸기`, colorOf(n)]));
      const act = st.act || { n: 0, of: 4 };
      if (act.n >= act.of) out.push(['이번 달을 마무리하고 월말로 넘어간다.', '월말로', '#e5384f']);
      else { out.push(['이번 달은 알바로 돈을 번다.', '알바']); out.push(['이번 달은 연습에 집중한다.', '연습']); }
      if (st.wip && st.wip.title) out.push([`「${st.wip.title}」 제작을 진행한다.`, '곡 작업 진행']);
      out.push(['/현황', '현황']);
      $('#id-sugg').innerHTML = out.slice(0, 5).map(([v, l, c]) => `<button data-id="add" data-v="${esc(v)}" ${c ? `style="--c:${c}"` : ''} class="${c ? 'tint' : ''}">${esc(l)}</button>`).join('');
    }

    // ---------- 대사창 ----------
    let typeT = null;
    function typeTo(node, text, done) {
      clearInterval(typeT);
      const ms = SPEED[M.prefs.speed] == null ? 22 : SPEED[M.prefs.speed];
      if (!ms || !text) { node.textContent = text; R.typing = null; done && done(); return; }
      let i = 0; node.textContent = '';
      R.typing = { finish() { clearInterval(typeT); node.textContent = text; R.typing = null; done && done(); } };
      typeT = setInterval(() => { i += 1; node.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typeT); R.typing = null; done && done(); } }, ms);
    }
    function showBeat(i) {
      const d = $('#id-dlg'); const b = R.beats[i];
      if (!b) { d.className = 'id-dlg k-end'; d.innerHTML = `<div class="id-endq">사장님 차례 — 말이나 행동을 적어요.</div>`; afterBeats(); return; }
      if (b.bgSrc) setBg(b.bgSrc);
      setPortrait(b.face || '', b.who || b.faceWho);
      const last = i >= R.beats.length - 1;
      const who = b.kind === 'say' || b.kind === 'kakao' ? b.who : '';
      d.className = 'id-dlg k-' + b.kind + (last ? ' last' : '');
      d.style.setProperty('--nc', colorOf(who) || '#e5384f');
      d.innerHTML = `${who ? `<div class="id-name"><b>${esc(who)}</b>${MO[who] ? `<small>${esc(MO[who].pos)}</small>` : (RIV.find(r => r.rep === who) ? `<small>${esc(RIV.find(r => r.rep === who).group)}</small>` : '')}</div>` : ''}${b.act ? `<div class="id-act">${esc(b.act)}</div>` : ''}<div class="id-dline"></div>${R.beats.length > 1 ? `<span class="id-prog">${i + 1}/${R.beats.length}</span>` : ''}${last ? '<div class="id-endq" hidden>사장님 차례 — 아래에 적어요.</div>' : '<span class="id-next" aria-hidden="true"></span>'}`;
      const text = b.kind === 'say' ? `“${b.text}”` : b.text;
      typeTo(d.querySelector('.id-dline'), text, () => {
        if (last) { const q = d.querySelector('.id-endq'); if (q) q.hidden = false; afterBeats(); return; }
        if (K) K.autoNext(text, () => { if (R.i === i && !R.modal && !R.waiting && !K.isOpen() && $('#id-show').hidden) next(); });
      });
    }
    function next() { if (K) K.stopAuto(); if (R.typing) { R.typing.finish(); return; } if (R.waiting) return; if (R.i < R.beats.length - 1) { R.i++; showBeat(R.i); } }
    function assign(beats) {
      let place = '', hold = null; const lastFace = {};
      beats.forEach(b => {
        if (b.place) place = b.place;
        b.bgSrc = b.bg || (place ? IMG('배경_' + place) : '') || M.lastBg;
        b.face = '';
        if (b.portrait) { b.face = b.portrait; if (b.pinfo && b.pinfo.who) lastFace[b.pinfo.who] = b.portrait; }
        else if (b.kind === 'say' && b.known) b.face = lastFace[b.who] || faceOf(b.who);
        else if (!b.bg && hold) { b.face = hold.face; b.faceWho = hold.who; }
        if (b.bg && !b.portrait) hold = null; else if (b.face && (b.kind === 'say' || b.portrait)) hold = { face: b.face, who: b.kind === 'say' ? b.who : (b.pinfo && b.pinfo.who) };
      });
    }

    // ---------- 응답 처리 ----------
    let pendingFx = [];
    function handle(segs) {
      if (R.sm) R.sm.done = true;
      const P = U.parse(segs, roster, IDX);
      const ev = U.absorb(M, P, data, { sentPlan: R.sentPlan });
      R.sentPlan = null;
      const lab = U.monthLabel(U.monthKey(st0()));
      P.beats.forEach(b => { if (b.text) M.lines.push({ d: lab, who: b.kind === 'say' ? b.who : '', t: b.text, sys: b.kind === 'sys' }); });
      R.present = Array.from(new Set(P.beats.filter(b => b.kind === 'say' && b.known).map(b => b.who)));
      const plain = segs.filter(x => x.t === 'text').map(x => x.s).join('\n');
      if (K && plain.length > 300) K.checkParse(!!(P.status || P.settle), '상태창을 찾지 못함', plain);
      if (ev.settle || ev.released.length || ev.rivalNew.length || ev.chartin || ev.first) R.newMusic = true;
      if (ev.joined.length) R.newMember = true;
      if (ev.settle) R.chartKey = ev.settle.key;
      save();
      P.beats.forEach((b, k) => { if (!b.text && (b.bg || b.portrait)) { const nb = P.beats.slice(k + 1).find(x => x.text); if (nb) { nb.bg = nb.bg || b.bg; nb.place = nb.place || b.place; if (!nb.portrait && b.portrait) { nb.portrait = b.portrait; nb.pinfo = b.pinfo; } } } });
      R.beats = P.beats.filter(b => b.text);
      assign(R.beats);
      R.i = -1;
      renderHud(); R.keepScroll = true; renderPanel(); renderSugg();
      ev.cond.forEach(c => pop(`<i class="dot" style="--c:${colorOf(c.who)}"></i><b>${esc(c.who)}</b><span>${esc(c.from)} → <u style="color:${condColor(c.to)}">${esc(c.to)}</u></span>`, 'cond'));
      if (ev.rumor) pop(`<i class="dot rm"></i><b>루머 ${ev.rumor}단계</b><span>커뮤니티가 시끄러워요</span>`, 'big rumor');
      ev.rivalNew.forEach(s => pop(`${cover(s, 'xs')}<b>${esc(s.artist)}</b><span>신곡 「${esc(s.title)}」</span>`, 'rival'));
      ev.stage.forEach(s => pop(`<i class="dot st"></i><b>무대</b><span>${esc(s)}</span>`, 'stage'));
      if (ev.month && !ev.settle) pop(`<i class="dot mo"></i><b>${esc(U.monthLabel(ev.month.to))}</b><span>새 달이 시작됐어요</span>`, 'big month');
      // 연출 순서: 발매 → 결산 쇼 → 1위 → 합류, 그다음 장면
      pendingFx = [];
      ev.released.forEach(t => pendingFx.push(['release', t]));
      if (ev.settle) pendingFx.push(['settle', ev.settle]);
      if (ev.chartin && !ev.settle) pendingFx.push(['chartin', ev.chartin]);
      if (ev.first) pendingFx.push(['first', ev.first]);
      ev.joined.forEach(n => pendingFx.push(['join', n]));
      if (pendingFx.length && M.prefs.fx) runFx(); else startBeats();
    }
    function runFx() {
      const f = pendingFx.shift();
      if (!f) { startBeats(); return; }
      if (f[0] === 'settle') { openShow(f[1], runFx); return; }
      const box = $('#id-fx');
      let html = '';
      if (f[0] === 'release') { const s = songOf(f[1]); html = `<div class="fx-rel"><small>새 싱글 발매</small><div class="fx-sleeve"><div class="fx-cv">${cover(s, 'lg', true)}</div><i class="fx-case"></i></div><b>${esc(s.title)}</b><span>${esc(GROUP)}</span><button class="id-btn primary" data-id="fx-next">레몬뮤직에서 보기</button></div>`; }
      else if (f[0] === 'chartin') { html = `<div class="fx-chart"><small>레몬차트</small><b>${f[1].rank}<i>위</i></b><span>${f[1].title ? '「' + esc(f[1].title) + '」 ' : ''}차트 진입!</span><button class="id-btn primary" data-id="fx-next">확인</button></div>`; }
      else if (f[0] === 'first') { const s = f[1].title ? songOf(f[1].title) : ourSongs().slice(-1)[0] || { title: '' }; const ch = (s.chorus || []).slice(0, 4); html = `<div class="fx-first"><div class="fx-conf">${Array.from({ length: 28 }, (_, i) => `<i style="--i:${i};--x:${(i * 37) % 100}%;--c:${['#ffd23f', '#e5384f', '#2fbf71', '#4fb3f0', '#a98bf0'][i % 5]}"></i>`).join('')}</div><small>레몬차트</small><b>1<i>위</i></b><div class="fx-cv">${cover(s, 'lg', true)}</div><span>「${esc(s.title)}」</span><div class="fx-ch">${ch.map((l, i) => `<p style="--d:${i * 0.9 + 0.8}s">${esc(l)}</p>`).join('')}</div><button class="id-btn primary" data-id="fx-next">무대로</button></div>`; }
      else if (f[0] === 'join') { const m = MO[f[1]] || { name: f[1], color: '#e5384f', pos: '' }; html = `<div class="fx-join" style="--c:${m.color}"><small>새 멤버 합류</small><article class="pc big"><div class="pc-holo"><div class="pc-in"><div class="pc-img">${avatar(f[1])}</div><div class="pc-cap"><b>${esc(f[1])}</b><small>${esc(m.pos || '')}</small></div></div></div></article><p class="fx-line">${esc(m.line || '')}</p><button class="id-btn primary" data-id="fx-next">${esc(GROUP)}에 합류</button></div>`; }
      box.innerHTML = html; box.hidden = false;
    }
    function startBeats() { R.i = R.beats.length ? 0 : -1; showBeat(R.i); if (K && !R.coached && R.beats.length) { R.coached = true; setTimeout(() => { if (!R.modal && !K.isOpen() && $('#id-title').hidden && $('#id-show').hidden) K.coach(); }, 900); } }
    function afterBeats() { /* 장면 끝 */ }

    // ---------- 월말 결산 쇼: 영수증 → 차트 카운트다운 → 반응·예고 ----------
    let showT = [];
    function openShow(S, done) {
      showT.forEach(clearTimeout); showT = [];
      const box = $('#id-show');
      R.show = { S, step: 0, done };
      const rows = [].concat((S.incomeItems || []).map(x => ['+', x]), (S.expenseItems || []).map(x => ['-', x]));
      const net = (S.income || 0) + (S.expense || 0);
      box.innerHTML = `<div class="sh-wrap" data-id="show-next">
        <section class="sh-step s1 on"><div class="sh-receipt"><header><small>${esc(data.company || '')}</small><b>${S.month || ''}월 결산</b><i></i></header>
          <ul>${rows.map(([s, x], i) => `<li class="${s === '+' ? 'in' : 'out'}" style="--d:${i * 0.18 + 0.3}s"><span>${esc(x.replace(/\s*[-+]?\d[\d,.]*\s*(만|억)?\s*원?$/, ''))}</span><b>${s}${esc((x.match(/[\d,.]+\s*(?:억\s*[\d,.]*\s*)?만?원?$/) || [''])[0])}</b></li>`).join('')}</ul>
          <div class="sh-sum"><span>수입</span><b class="in">${esc(S.income != null ? '+' + U.fmtWon(S.income) : S.incomeText || '–')}</b></div>
          <div class="sh-sum"><span>지출</span><b class="out">${esc(S.expense != null ? U.fmtWon(S.expense) : S.expenseText || '–')}</b></div>
          <div class="sh-sum tot"><span>이달 합계</span><b class="${net >= 0 ? 'in' : 'out'}">${S.income != null || S.expense != null ? (net >= 0 ? '+' : '') + esc(U.fmtWon(net)) : '–'}</b></div>
          <footer>••• 차트 발표로 •••</footer></div></section>
        <section class="sh-step s2"><div class="sh-chart"><header>${lemonLogo()}<b>레몬차트</b><small>${S.month || ''}월 결산</small></header><ol id="sh-ol"></ol>${S.chartOut || !S.chart.length ? `<p class="sh-out">${esc(GROUP)}의 곡은 이번 달 차트에 오르지 못했어요.</p>` : ''}</div></section>
        <section class="sh-step s3"><div class="sh-cards">
          ${S.songs.map(x => `<div class="sh-card song">${cover(songOf(x.title), 'md')}<div><small>이번 달 곡 평가</small><b>「${esc(x.title)}」</b><span><em class="g">${esc(x.grade || '–')}</em>등급 · 화력 ${x.heat != null ? x.heat : '–'}</span></div></div>`).join('')}
          ${S.reactions.length ? `<div class="sh-card"><small>반응</small>${S.reactions.map(r => `<p>“${esc(r)}”</p>`).join('')}</div>` : ''}
          ${S.cond ? `<div class="sh-card"><small>컨디션</small><p>${esc(S.cond)}</p></div>` : ''}
          ${S.next ? `<div class="sh-card next"><small>다음 달 예고</small><p>${esc(S.next)}</p></div>` : ''}
          <button class="id-btn primary" data-id="show-close">다음 달로</button></div></section>
        <button class="sh-skip" data-id="show-close">건너뛰기</button>
      </div>`;
      box.hidden = false;
    }
    function showStep() {
      const sh = R.show; if (!sh) return;
      sh.step++;
      const box = $('#id-show');
      box.querySelectorAll('.sh-step').forEach((n, i) => n.classList.toggle('on', i === sh.step));
      if (sh.step === 1) {
        const ol = box.querySelector('#sh-ol');
        const list = sh.S.chart.slice().sort((a, b) => b.rank - a.rank);
        list.forEach((c, i) => showT.push(setTimeout(() => {
          const s = songOf(c.title); const li = document.createElement('li');
          li.className = (s.ours ? 'ours' : '') + (RO[s.artist] ? ' rival' : '');
          li.style.setProperty('--rc', (RO[s.artist] || {}).color || '#e5384f');
          li.innerHTML = `<b class="rk">${c.rank}</b>${cover(s, 'sm')}<span><b>${esc(c.title)}</b><small>${esc(s.ours ? GROUP : s.artist)}</small></span>${moveHtml(c.move)}`;
          ol.prepend(li);
        }, 350 + i * 650)));
      }
      if (sh.step >= 3) closeShow();
    }
    function closeShow() { showT.forEach(clearTimeout); showT = []; const box = $('#id-show'); box.hidden = true; box.innerHTML = ''; const d = R.show && R.show.done; R.show = null; if (d) d(); }

    // ---------- 입력칸 ----------
    function autosize() { const ta = $('#id-in'); ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; }
    function fill(text, add) {
      if (narrow() && R.tab !== 'stage') { R.tab = 'stage'; renderPanel(); }
      const ta = $('#id-in');
      ta.value = add && ta.value.trim() && !/^[/[]/.test(ta.value.trim()) ? ta.value.replace(/\s+$/, '') + ' ' + text : text;
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); autosize();
      ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
    }
    function insertAct() { const ta = $('#id-in'); const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value; const sel = v.slice(a, b), pre = v.slice(0, a), post = v.slice(b); const sp = pre && !/\s$/.test(pre) ? ' ' : ''; ta.value = pre + sp + '*' + sel + '*' + (post && !/^\s/.test(post) ? ' ' : '') + post; const pos = pre.length + sp.length + 1 + sel.length; ta.focus(); ta.setSelectionRange(pos, pos); autosize(); }
    function doSend() {
      const ta = $('#id-in'); const text = ta.value.trim();
      if (!text || R.waiting) return;
      if (R.mode !== 'play' || R.away || R.page !== 'chat') { toast(R.away ? '이 세이브의 대화로 돌아온 뒤에 보낼 수 있어요' : '대화 화면이 열린 뒤에 보낼 수 있어요'); return; }
      R.waiting = true; R.sentAt = Date.now();
      const plan = U.parsePlan(text); if (plan && plan.title) { R.sentPlan = plan; M.plans[plan.title] = plan; }
      if (K) K.stopAuto();
      M.lines.push({ d: U.monthLabel(U.monthKey(st0())), who: '사장', t: text, me: true });
      save(); o.send(text);
      ta.value = ''; autosize(); waitingUi(true);
    }
    const TIPS = Array.isArray(data.tips) && data.tips.length ? data.tips : ['위쪽 ⋯ 메뉴에서 언제든 크랙 원래 화면을 볼 수 있어요.'];
    let tipI = Math.floor(Math.random() * TIPS.length), tipT = null;
    function waitingUi(on, preview) {
      el.classList.toggle('id-wait', !!on); clearInterval(tipT); if (!on) return;
      const d = $('#id-dlg'); d.className = 'id-dlg k-wait';
      d.innerHTML = `<div class="id-typing"><span class="id-eq"><i></i><i></i><i></i><i></i></span><b>${R.sentPlan ? '기획서를 검토하는 중' : '이야기를 적는 중'}</b></div><div class="id-tip">${esc(TIPS[tipI % TIPS.length])}</div>${preview ? `<small class="id-stream">${esc(preview.slice(-140))}</small>` : ''}`;
      tipT = setInterval(() => { tipI++; const t = el.querySelector('.id-tip'); if (t) t.textContent = TIPS[tipI % TIPS.length]; else clearInterval(tipT); }, 5000);
    }
    const waitT = setInterval(() => { if (R.waiting && Date.now() - R.sentAt > 45000) banner('slow'); }, 5000);

    // ---------- 안내 띠 (기존 팩과 같은 흐름) ----------
    function banner(kind) {
      const b = $('#id-banner');
      if (!kind) { b.hidden = true; b.innerHTML = ''; b.className = 'id-banner'; return; }
      const row = (btns) => `<div class="id-brow">${btns}</div>`;
      const std = '<button class="id-fb" data-id="crack">크랙 화면 보기</button><button class="id-fb" data-id="title">처음 화면</button><button class="id-fb" data-id="diag">화면 진단 복사</button>';
      const spin = '<span class="id-eq"><i></i><i></i><i></i><i></i></span>';
      b.hidden = false; b.className = 'id-banner center';
      if (kind === 'other') b.innerHTML = `<div class="id-gate"><b>세이브의 대화가 열리지 않았어요</b><span>크랙에서 대화가 지워졌거나 로그인이 풀렸을 수 있어요.</span>${row('<button class="id-fb primary" data-id="back-save">다시 열기</button>' + std)}</div>`;
      else if (kind === 'mode') { const ms = (R.actions || []).filter(a => a.kind === 'mode'); const picked = R.sm && R.sm.picked; b.innerHTML = `<div class="id-gate"><b>시작 설정을 골라 주세요</b><span>${picked ? `「${esc(picked)}」를 골랐어요. 크랙이 시작하기를 기다리는 중이에요.` : '고른 것만 크랙에 한 번 눌러 줘요.'}</span><div class="id-modes">${ms.map(a => `<button class="id-mode ${picked === a.label ? 'on' : ''}" data-id="pick-mode" data-i="${a.id}" data-label="${esc(a.label)}">${esc(a.label)}</button>`).join('')}</div>${row('<button class="id-fb" data-id="crack-pick">크랙 화면에서 직접 고르기</button><button class="id-fb" data-id="title">처음 화면</button>')}</div>`; }
      else if (kind === 'new') { const acts = (R.actions || []).filter(a => a.kind === 'new'); const why = R.newFlow && R.newFlow.clicked ? '크랙에서 새 대화가 열리면 바로 시작해요.' : (R.page === 'detail' && !acts.length ? '크랙 작품 화면에서 「새로하기」 버튼을 찾지 못했어요. 크랙 화면 보기를 눌러 직접 「새로하기」를 누르면 바로 이어져요.' : '크랙 작품 화면을 여는 중이에요…'); b.innerHTML = `<div class="id-gate">${spin}<b>회사 열쇠를 받는 중이에요</b><span>${why}</span>${row(acts.map(a => `<button class="id-fb primary" data-id="click" data-i="${a.id}">${esc(a.label)}</button>`).join('') + '<button class="id-fb primary" data-id="crack-pick">크랙 화면에서 직접 고르기</button>' + std)}</div>`; }
      else if (kind === 'old') { const acts = (R.actions || []).filter(a => a.kind === 'new'); b.innerHTML = `<div class="id-gate"><b>크랙이 예전 대화를 열었어요</b><span>처음부터 하려면 새 대화가 필요해요.</span>${row(acts.map(a => `<button class="id-fb primary" data-id="click" data-i="${a.id}">${esc(a.label)}</button>`).join('') + `<button class="id-fb ${acts.length ? '' : 'primary'}" data-id="retry-new">작품 화면에서 새로하기</button>` + std)}</div>`; }
      else if (kind === 'away') b.innerHTML = `<div class="id-gate"><b>이 세이브의 대화가 아니에요</b><span>크랙 화면에서 다른 대화로 옮겨 갔어요. 이 대화는 읽지 않아요.</span>${row('<button class="id-fb primary" data-id="back-save">세이브 대화로 돌아가기</button>' + std)}</div>`;
      else if (kind === 'slow') { b.className = 'id-banner'; b.innerHTML = `<span>응답을 아직 못 읽었어요. 크랙에서 답이 왔는지 확인해 보세요.</span><button class="id-fb" data-id="crack">크랙 화면 보기</button><button class="id-fb" data-id="diag">화면 진단 복사</button><button class="id-fb" data-id="unwait">닫기</button>`; }
    }

    // ---------- 겹창 ----------
    function openModal(k) {
      R.modal = k; const box = $('#id-box'); box.className = 'id-box';
      const X = `<button class="id-x" data-id="mclose" aria-label="닫기">${ic('x')}</button>`;
      if (k === 'set') {
        const seg = (key, opts) => `<div class="id-seg">${opts.map(([v, l]) => `<button class="${String(M.prefs[key]) === String(v) ? 'on' : ''}" data-id="pref" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
        box.innerHTML = `${X}<h3>플레이팩 설정</h3><div class="id-setrow"><span>글자 속도</span>${seg('speed', [['slow', '느림'], ['normal', '보통'], ['fast', '빠름'], ['instant', '즉시']])}</div><div class="id-setrow"><span>화면 연출</span>${seg('fx', [[false, '끔'], [true, '켜짐']])}</div><div class="id-setrow"><span>레몬뮤직</span>${seg('theme', [['light', '밝게'], ['dark', '어둡게']])}</div>
          <p class="id-note">게임 화면은 크랙 응답을 읽어 그려요. 숫자는 크랙 상태창·결산 그대로예요.</p>
          <div class="id-btns"><button class="id-btn" data-id="title">처음 화면</button><button class="id-btn" data-id="crack">크랙 화면 보기</button><button class="id-btn" data-id="diag">화면 진단 복사</button><button class="id-btn danger" data-id="pack-off">플레이팩 끄기</button></div>`;
      }
      $('#id-modal').hidden = false;
    }
    function closeModal() { R.modal = null; $('#id-modal').hidden = true; $('#id-box').innerHTML = ''; }
    const curScene = () => { const b = R.beats[R.i] || R.beats[R.beats.length - 1]; const who = b && b.kind === 'say' ? b.who : ''; return { bg: R.bgKey || M.lastBg, face: (b && b.face) || '', who, text: b ? b.text : '', color: colorOf(who), place: '' }; };
    const menuExtra = () => [{ label: '레몬뮤직', fn: () => goTab('music') }, { label: '곡 작업실', fn: () => goTab('studio') }]
      .concat(K ? K.menu(curScene, () => M.lines, colorOf) : []).concat([{ label: '플레이팩 설정', fn: () => openModal('set') }]);
    function goTab(v) { R.tab = narrow() ? v : 'stage'; R.sideTab = v === 'stage' ? R.sideTab : v; if (v === 'music') R.newMusic = false; if (v === 'team') R.newMember = false; renderPanel(); }

    // ---------- 입력 ----------
    el.addEventListener('click', (e) => {
      if (e.target.id === 'id-modal') { closeModal(); return; }
      const t = e.target.closest('[data-id]');
      if (!t || !el.contains(t)) return;
      const k = t.dataset.id;
      switch (k) {
        case 'next': if (!e.target.closest('button')) next(); break;
        case 'send': doSend(); break;
        case 'act': insertAct(); break;
        case 'tab': { const v = t.dataset.k; if (t.closest('#id-stabs')) { R.sideTab = v; if (R.tab !== 'stage') R.tab = v; if (v === 'music') R.newMusic = false; if (v === 'team') R.newMember = false; renderPanel(); } else goTab(v); break; }
        case 'mtab': R.mtab = t.dataset.k; R.song = null; R.artist = null; renderPanel(); break;
        case 'msub': R.song = null; renderPanel(); break;
        case 'song': R.song = t.dataset.k; renderPanel(); break;
        case 'filler': toast('분위기를 위한 가상의 곡이에요'); break;
        case 'artist': R.song = null; R.mtab = 'artist'; R.artist = t.dataset.k; renderPanel(); break;
        case 'artist-back': R.artist = null; renderPanel(); break;
        case 'ck': if (t.dataset.k) { R.chartKey = t.dataset.k; renderPanel(); } break;
        case 'findme': { const li = el.querySelector('.lm-list li.ours'); if (li) li.scrollIntoView({ block: 'center', behavior: M.prefs.fx ? 'smooth' : 'auto' }); if (li) { li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash'); } break; }
        case 'lmtheme': M.prefs.theme = M.prefs.theme === 'dark' ? 'light' : 'dark'; idRoot.classList.toggle('lm-dark', M.prefs.theme === 'dark'); save(); R.keepScroll = true; renderPanel(); break;
        case 'playsong': playSong(t.dataset.k, t.dataset.a); break;
        case 'pp': togglePlay(); break;
        case 'pnext': nextSong(1); break;
        case 'pprev': nextSong(-1); break;
        case 'pclose': stopAll(); renderMini(); refreshPlayIcons(); $('#id-player').hidden = true; break;
        case 'fullplayer': openPlayer(); break;
        case 'pl-close': $('#id-player').hidden = true; break;
        case 'fill': fill(t.dataset.v); break;
        case 'add': if (t.dataset.v === '/현황') fill('/현황'); else fill(t.dataset.v, true); break;
        case 'center': R.draft = R.draft || blankDraft(); R.draft.center = t.dataset.k; goTab('studio'); break;
        // 작업실
        case 'st-set': { const d = R.draft; const f = t.dataset.f; d[f] = f === 'month' ? +t.dataset.v : t.dataset.v; R.keepScroll = true; renderPanel(); if (R.play && R.play.draft) { R.play = null; demo.stop(); playDraft(); } break; }
        case 'st-al': { const d = R.draft; const kk = t.dataset.k; d.alloc[kk] = clamp((d.alloc[kk] || 0) + (+t.dataset.d), 0, 6); R.keepScroll = true; renderPanel(); break; }
        case 'st-demo': playDraft(); break;
        case 'st-reset': R.draft = blankDraft(); renderPanel(); break;
        case 'st-fill': { const p = draftPlan(R.draft); fill(U.planText(p)); toast('기획서를 입력칸에 채웠어요. 보내기를 누르면 크랙이 검토해요'); break; }
        // 연출
        case 'fx-next': $('#id-fx').hidden = true; $('#id-fx').innerHTML = ''; runFx(); break;
        case 'show-next': if (!e.target.closest('button')) showStep(); break;
        case 'show-close': closeShow(); break;
        case 'replay': { const S = M.settles[+t.dataset.k]; if (S) openShow(S, null); break; }
        // 기타
        case 'more': if (o.menu) o.menu(menuExtra()); else openModal('set'); break;
        case 'mclose': closeModal(); break;
        case 'pref': { const v = t.dataset.v; M.prefs[t.dataset.key] = v === 'true' ? true : v === 'false' ? false : v; save(); idRoot.classList.toggle('nofx', !M.prefs.fx); idRoot.classList.toggle('lm-dark', M.prefs.theme === 'dark'); openModal('set'); break; }
        case 'title': closeModal(); showTitle(); break;
        case 'back-save': { const sv = curSave(); if (sv && sv.url) o.load(sv.url); break; }
        case 't-new': startNew(); break;
        case 't-cont': continueSave(t.dataset.k); break;
        case 't-saves': R.showSaves = !R.showSaves; renderTitle(); break;
        case 't-set': openModal('set'); break;
        case 't-del': { const id = t.dataset.k; if (R.delAsk === id) { saves = saves.filter(x => x.id !== id); putSaves(); try { localStorage.removeItem(memKey(id)); } catch (err) { /* 없음 */ } R.delAsk = null; toast('세이브를 지웠어요 (크랙 대화는 그대로 남아요)'); } else R.delAsk = id; renderTitle(); break; }
        case 'click': o.click(t.dataset.i); if (R.newFlow) { R.newFlow.clicked = true; R.newFlow.fromUrl = R.curUrl; banner('new'); } else banner(null); break;
        case 'crack': closeModal(); o.showCrack(true); break;
        case 'pick-mode': if (R.sm && !R.sm.picked) { R.sm.picked = t.dataset.label; o.click(t.dataset.i); banner('mode'); } break;
        case 'crack-pick': if (R.sm) R.sm.viaCrack = true; o.showCrack(true); break;
        case 'diag': o.diag(); break;
        case 'retry-new': if (R.newFlow) { R.newFlow = { clicked: false, fromUrl: '', at: Date.now() }; banner('new'); o.load(startUrl()); } break;
        case 'unwait': banner(null); R.waiting = false; waitingUi(false); showBeat(R.i); break;
        case 'pack-off': o.packOff(); break;
      }
    });
    el.addEventListener('input', (e) => {
      if (e.target.id === 'id-in') autosize();
      else if (e.target.id === 'st-title') { R.draft.title = e.target.value; refreshCover(); const b = el.querySelector('[data-id=st-fill]'); if (b) b.disabled = !(R.draft.title.trim() && ALLOC.reduce((a, k2) => a + (R.draft.alloc[k2] || 0), 0) === 10 && R.draft.chorus.some(x => x.trim())); }
      else if (e.target.dataset && e.target.dataset.ch != null) { R.draft.chorus[+e.target.dataset.ch] = e.target.value; const b = el.querySelector('[data-id=st-fill]'); if (b) b.disabled = !(R.draft.title.trim() && ALLOC.reduce((a, k2) => a + (R.draft.alloc[k2] || 0), 0) === 10 && R.draft.chorus.some(x => x.trim())); }
    });
    let cvT = null;
    const refreshCover = () => { clearTimeout(cvT); cvT = setTimeout(() => { const c = el.querySelector('.st-cv'); if (c && R.draft) c.innerHTML = cover(Object.assign(draftPlan(R.draft), { ours: true, title: R.draft.title.trim() || '제목 미정' }), 'md'); }, 200); };
    const onKey = (e) => {
      if (!el.isConnected || el.classList.contains('off') || document.querySelector('#layer .scrim') || (K && K.isOpen())) return;
      if (e.target.id === 'id-in' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); return; }
      if (/^(TEXTAREA|INPUT|SELECT|WEBVIEW)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { if (R.modal) closeModal(); else if (!$('#id-player').hidden) $('#id-player').hidden = true; else if (R.song) { R.song = null; renderPanel(); } }
      if (!$('#id-show').hidden && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); showStep(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && !R.modal && !e.target.closest('button') && $('#id-title').hidden) { e.preventDefault(); next(); }
    };
    document.addEventListener('keydown', onKey);
    const onBack = (e) => {
      if (!el.isConnected || el.closest('.off') || document.querySelector('#layer > *')) return;
      const done = () => e.preventDefault();
      if (R.modal) { closeModal(); return done(); }
      if (!$('#id-show').hidden) { closeShow(); return done(); }
      if (!$('#id-fx').hidden) { $('#id-fx').hidden = true; runFx(); return done(); }
      if (!$('#id-player').hidden) { $('#id-player').hidden = true; return done(); }
      if (R.song) { R.song = null; renderPanel(); return done(); }
      if (R.artist) { R.artist = null; renderPanel(); return done(); }
      if (R.tab !== 'stage') { R.tab = 'stage'; renderPanel(); return done(); }
      if (R.mode !== 'title' && $('#id-title').hidden) { showTitle(); return done(); }
    };
    document.addEventListener('crion-back', onBack);

    // ---------- 타이틀: 반지하 사무실 화이트보드 ----------
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.round(m / 60) + '시간 전' : Math.round(m / 1440) + '일 전'; };
    const sumText = (sv) => { const s = (sv && sv.sum) || {}; return s.m ? `${s.y || 1}년차 ${s.m}월 · 자금 ${U.fmtWon(s.money)}${s.best ? ' · 최고 ' + s.best + '위' : ''}` : '회사를 물려받은 날'; };
    function renderTitle() {
      const box = $('#id-title');
      const list = saves.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
      const cont = list.find(x => x.url);
      const hero = asset('assets/title.webp') || IMG('윤서하_통상');
      box.innerHTML = `<div class="tt ${hero ? '' : 'nohero'}">
        <div class="tt-word" aria-hidden="true">${esc(data.groupEn || 'REMINA')}</div>
        <div class="tt-top"><span>${esc(data.company || '반지하 엔터테인먼트')}</span><i></i></div>
        <h1 class="tt-h">다시,<br>무대 위로</h1>
        <p class="tt-sub">아버지가 남긴 건 빚뿐인 기획사와,<br>끝까지 떠나지 않은 리더 한 명.</p>
        <div class="tt-card"><i class="tt-tape"></i><div class="pc-holo"><div class="pc-in"><div class="pc-img">${hero ? `<img src="${esc(hero)}" alt="">` : `<span class="pc-q big">서하</span>`}</div><div class="pc-cap"><b>윤서하</b><small>레미나 리더</small></div></div></div></div>
        <div class="tt-menu">
          <button class="tt-go" data-id="t-new">회사 물려받기</button>
          ${cont ? `<button class="tt-cont" data-id="t-cont" data-k="${esc(cont.id)}"><b>이어하기</b><small>${esc(sumText(cont))}</small></button>` : ''}
          <div class="tt-links">${list.length ? `<button class="${R.showSaves ? 'on' : ''}" data-id="t-saves">세이브 ${list.length}개</button>` : ''}<button data-id="t-set">설정</button></div>
          <p class="tt-note">크랙 AI가 진행하는 아이돌 경영 이야기</p>
        </div>
        ${list.length ? `<div class="tt-drawer ${R.showSaves ? 'on' : ''}"><header><b>세이브</b><button class="id-x" data-id="t-saves" aria-label="닫기">${ic('x')}</button></header>${list.map(sv => `<div class="tt-save"><div><b>${esc(sumText(sv))}</b><span>${sv.url ? '마지막 ' + ago(sv.last || sv.created) : '대화 연결 전'}${sv.sum && sv.sum.songs ? ', 발매 ' + sv.sum.songs + '곡' : ''}</span></div>${sv.url ? `<button class="id-fb primary" data-id="t-cont" data-k="${esc(sv.id)}">이어하기</button>` : ''}<button class="id-fb ${R.delAsk === sv.id ? 'danger' : ''}" data-id="t-del" data-k="${esc(sv.id)}">${R.delAsk === sv.id ? '한 번 더' : '지우기'}</button></div>`).join('')}</div>` : ''}
      </div>`;
      box.hidden = false;
    }
    function resetScene() {
      R.beats = []; R.i = -1; R.lastKey = ''; R.waiting = false; R.away = false; R.song = null; R.artist = null; R.tab = 'stage'; R.present = []; R.draft = null; R.chartKey = '';
      R.bgKey = ''; el.querySelectorAll('.id-bgl').forEach(x => { x.style.backgroundImage = ''; x.classList.remove('on'); });
      if (M.lastBg) setBg(M.lastBg); else setBg(IMG('배경_반지하숙소'));
      setPortrait(''); stopAll(); renderMini();
      ['#id-show', '#id-fx', '#id-player'].forEach(s => { $(s).hidden = true; });
      closeModal(); renderHud(); renderPanel(); renderSugg();
      const d = $('#id-dlg'); d.className = 'id-dlg'; d.innerHTML = '';
    }
    const hideTitle = () => { $('#id-title').hidden = true; };
    function showTitle() { R.mode = 'title'; R.newFlow = null; R.delAsk = null; banner(null); waitingUi(false); renderTitle(); }
    function loading(msg) { const d = $('#id-dlg'); d.className = 'id-dlg k-wait'; d.innerHTML = `<div class="id-typing"><span class="id-eq"><i></i><i></i><i></i><i></i></span><b>${esc(msg)}</b></div>`; }
    function startUrl() { const d = o.detailUrl ? o.detailUrl() : ''; return (typeof d === 'string' && /^https:\/\/([a-z0-9-]+\.)*wrtn\.ai\//.test(d) && !/^https:\/\/share\./.test(d)) ? d : o.workUrl; }
    function startNew() {
      const id = 'sv' + Date.now().toString(36);
      saves.push({ id, url: '', created: Date.now(), last: Date.now(), playMs: 0 }); putSaves();
      useSave(id); save(); resetScene();
      R.mode = 'binding'; R.newFlow = { clicked: false, fromUrl: '', at: Date.now() };
      R.sm = { picked: '', confirmed: false, viaCrack: false, newLabel: '', done: false };
      hideTitle(); loading('회사 열쇠를 받는 중이에요'); banner('new');
      o.load(startUrl());
    }
    function continueSave(id) {
      const sv = saves.find(x => x.id === id); if (!sv || !sv.url) return;
      useSave(id); resetScene();
      R.mode = 'play'; R.boundUrl = normUrl(sv.url); R.newFlow = null; R.sm = null;
      hideTitle(); banner(null); loading('지난 대화를 불러오는 중이에요');
      o.load(sv.url);
      if (K) { const r = K.recapFromLines(M.lines, colorOf), st = st0(); K.recap(Object.assign(r, { title: '지난 경영 일지', when: st.month ? `${st.year || 1}년차 ${st.month}월` : '', place: data.company, bg: M.lastBg, rows: [['자금', st.money != null ? U.fmtWon(st.money) : '–'], st.best ? ['최고 순위', st.best + '위'] : null, ['발매한 곡', ourSongs().filter(s => s.released).length + '곡']].filter(Boolean) })); }
    }
    function startModeStep(st) {
      const sm = R.sm; if (!sm || sm.done) return false;
      if (R.mode === 'binding' && !(R.newFlow && R.newFlow.clicked)) return false;
      const acts = st.actions || [], modes = acts.filter(x => x.kind === 'mode');
      const modeBannerOn = !!$('#id-banner').querySelector('.id-modes');
      if (!sm.picked) {
        if (modes.length > 1 && !sm.viaCrack) { R.actions = acts; banner('mode'); return true; }
        if (modes.length === 1 && !sm.viaCrack) { sm.picked = modes[0].label; o.click(modes[0].id); return true; }
        if (modeBannerOn) banner(R.mode === 'binding' ? 'new' : null);
        return false;
      }
      if (!sm.confirmed) {
        const go2 = acts.find(x => x.kind === 'confirm') || (st.page !== 'chat' ? acts.find(x => x.kind === 'new' && x.label !== sm.newLabel && !x.hidden) : null);
        if (go2) { sm.confirmed = true; o.click(go2.id); banner(R.mode === 'binding' ? 'new' : null); if (R.mode === 'play') loading('이야기를 불러오는 중이에요'); return true; }
        if (modes.length > 1) { R.actions = acts; banner('mode'); return true; }
      }
      if (modeBannerOn) banner(R.mode === 'binding' ? 'new' : null);
      return false;
    }
    function bindNew(st) {
      const nf = R.newFlow; if (!nf) return;
      if (startModeStep(st)) return;
      const cf = (st.actions || []).find(x => x.kind === 'confirm');
      if (cf && st.page !== 'chat' && nf.clicked && !nf.confirmed && !(R.sm && (R.sm.picked || R.sm.viaCrack))) { nf.confirmed = true; o.click(cf.id); banner('new'); return; }
      const used = new Set(saves.filter(x => x.id !== saveId && x.url).map(x => normUrl(x.url)));
      if (st.page === 'detail') { const a = (st.actions || []).find(x => x.kind === 'new'); if (a && !nf.clicked) { nf.clicked = true; nf.newLabel = a.label; if (R.sm) R.sm.newLabel = a.label; nf.fromUrl = st.url || R.curUrl; o.click(a.id); } banner('new'); return; }
      if (st.page !== 'chat') { banner('new'); return; }
      const u = normUrl(st.url || R.curUrl);
      const noUser = st.users != null ? (st.users === 0 && st.msgs >= 1) : (st.msgs != null && st.msgs >= 0 && st.msgs <= 2);
      const fresh = !used.has(u) && ((nf.clicked && u !== normUrl(nf.fromUrl)) || noUser);
      if (fresh) { const sv = curSave(); if (sv) { sv.url = st.url || R.curUrl; sv.last = Date.now(); putSaves(); } R.mode = 'play'; R.boundUrl = u; R.newFlow = null; banner(null); loading('이야기를 불러오는 중이에요'); if (o.showPack) o.showPack(); o.rescan(); return; }
      const a = (st.actions || []).find(x => x.kind === 'new');
      if (a && !nf.clicked) { nf.clicked = true; nf.newLabel = a.label; if (R.sm) R.sm.newLabel = a.label; nf.fromUrl = st.url || R.curUrl; o.click(a.id); banner('new'); return; }
      if (nf.clicked && Date.now() - (nf.clickAt || (nf.clickAt = Date.now())) < 6000) { banner('new'); return; }
      const detail = o.detailUrl ? o.detailUrl() : '';
      if (detail && !nf.triedDetail && normUrl(detail) !== u) { nf.triedDetail = true; nf.clicked = false; o.load(detail); banner('new'); return; }
      banner('old');
    }
    const playT = setInterval(() => { const sv = curSave(); if (sv && R.mode === 'play' && !R.away && document.visibilityState === 'visible' && !el.closest('.off')) { sv.playMs = (sv.playMs || 0) + 30000; putSaves(); } }, 30000);

    setBg(IMG('배경_반지하숙소'));
    renderHud(); renderPanel(); renderSugg();
    showTitle();

    return {
      onIpc(ch, d) {
        if (ch === 'crion:url' && d) { R.curUrl = d.url || ''; if (R.mode === 'play' && d.chat && R.boundUrl) { const away = normUrl(d.url) !== R.boundUrl; if (away !== R.away) { R.away = away; banner(away ? 'away' : null); if (!away) o.rescan(); } } return; }
        if (ch === 'crion:reply' && (R.mode !== 'play' || R.away)) return;
        if (ch === 'crion:state' && d && R.mode === 'binding') { if (d.page) { R.page = d.page; R.actions = d.actions || []; } if (d.url) R.curUrl = d.url; bindNew(d); return; }
        if (ch === 'crion:state' && d && R.mode === 'title') return;
        if (ch === 'crion:reply' && d) {
          if (!d.done) { if (R.waiting || d.key !== R.lastKey) { R.waiting = true; R.sentAt = R.sentAt || Date.now(); waitingUi(true, (d.segs || []).filter(s => s.t === 'text' && !s.code).map(s => s.s).join(' ').trim()); } return; }
          if (d.key === R.lastKey && !R.waiting) return;
          R.lastKey = d.key; R.waiting = false; waitingUi(false); banner(null);
          handle(d.segs || []);
        } else if (ch === 'crion:state' && d) {
          if (d.page) { R.page = d.page; R.actions = d.actions || []; } else if (d.input) R.page = 'chat';
          if (R.mode === 'play' && !R.away && startModeStep(d)) return;
          if (d.page === 'chat' && d.url && R.boundUrl) { const away = normUrl(d.url) !== R.boundUrl; if (away !== R.away) { R.away = away; banner(away ? 'away' : null); if (!away) o.rescan(); } if (away) return; }
          if (R.page === 'detail' || R.page === 'other') banner('other'); else if ($('#id-banner').querySelector('.id-gate')) banner(null);
        } else if (ch === 'crion:sent' && d) { if (!d.ok) { R.waiting = false; waitingUi(false); showBeat(R.i); toast(d.why === 'no-input' ? '크랙 입력창을 찾지 못했어요. 크랙 화면을 확인해 주세요' : '보내지 못했어요'); } }
      },
      destroy() { if (K) K.destroy(); stopAll(); document.removeEventListener('keydown', onKey); document.removeEventListener('crion-back', onBack); clearInterval(waitT); clearInterval(playT); clearInterval(tipT); clearInterval(typeT); clearInterval(progT); showT.forEach(clearTimeout); save(); },
      demo(segs) { handle(segs); },
      kit: K, state: R, memory: M, saves: () => saves, playing: () => R.play && Object.assign({}, R.play)
    };
  }

  root.CrionIdolRun = { start };
})(typeof window !== 'undefined' ? window : globalThis);
