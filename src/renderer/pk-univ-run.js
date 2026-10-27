// 플레이팩 실행기 — 「리온대학교 x스학과」 (runner: "univ")
//  크랙 AI가 그대로 진행. 크랙 응답·상태창·핸드폰 블록을 읽어 캠퍼스 무대 + 신입생 스마트폰(가가오톡·뤼브리타임·시간표·인연·학생증·캘린더·앨범·학식)으로 그린다.
//  - 계산은 하지 않는다. 숫자는 전부 크랙 상태창에서 읽은 것 (평점은 상태창의 과제 평가를 평균 낸 '예상')
//  - 보내기: 플레이어가 '보내기'를 한 번 누르면 한 번만. 폰·검사 버튼은 입력칸에 글만 채운다
//  - 세이브/새 대화 연결은 안전지대 팩(pk-safehouse-run.js)과 같은 방식
(function (root) {
  'use strict';
  const U = root.CrionUniv;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => u ? `url('${String(u).replace(/['"\\\n<>]/g, (c) => encodeURIComponent(c))}')` : 'none';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SPEED = { slow: 42, normal: 22, fast: 9, instant: 0 };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ICON = {
    kakao: '<path d="M12 4C7 4 3 7.2 3 11.1c0 2.5 1.6 4.7 4.1 6l-.9 3.3 3.8-2.5c.6.1 1.3.2 2 .2 5 0 9-3.2 9-7.1S17 4 12 4z"/>',
    riv: '<path d="M5 4h14v16l-7-4-7 4z"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M9 4.5v15M14.5 4.5v15"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7.3 4.5 4.5 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="11" r="2.3"/><path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 13.5h3"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    album: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/>',
    meal: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M16 21V3c-2 1.5-3 4-3 7h3"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', pin: '<path d="M12 21s6-5.6 6-10.2A6 6 0 0 0 6 10.8C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'
  };
  const ic = (k) => `<svg class="ic" viewBox="0 0 24 24">${ICON[k] || ''}</svg>`;
  const APPS = [
    ['kakao', '가가오톡', '#fee500', '#3b1e1e'], ['riv', '뤼브리타임', '#c62917', '#fff'], ['table', '시간표', '#12306b', '#e6c883'], ['heart', '인연', '#f3a1b9', '#fff'],
    ['id', '학생증', '#1d2a55', '#e6c883'], ['cal', '학사일정', '#2f7a63', '#fff'], ['album', '앨범', '#7b6ad8', '#fff'], ['meal', '학식', '#f08a4b', '#fff']
  ];

  function start(o) {
    const el = o.el;
    const files = o.files;
    const man = o.manifest || {};
    const data = o.data || {};
    const roster = new U.Roster(data);
    const RO = Object.fromEntries((data.roster || []).map(r => [r.name, r]));
    const res = (p) => !p ? '' : files.has(p) ? p : files.has('assets/' + p) ? 'assets/' + p : '';
    const url = (p) => { const r = res(p); return r ? files.url(r) : ''; };
    const BG = (k) => url(`assets/bg/${k}.webp`);
    const face = (n) => (M.face && M.face[n]) || (RO[n] && url(RO[n].face)) || '';
    const packFace = (n) => (RO[n] && url(RO[n].face)) || '';
    const { josa } = U;

    // ---------- 세이브 (안전지대 팩과 같은 방식) ----------
    const PK_ID = o.pack.id, WORK = (o.work && o.work.id) || 'work';
    const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } };
    const SAVES_KEY = `crion.pk.${PK_ID}.saves.${WORK}`, PREF_KEY = `crion.pk.${PK_ID}.prefs`;
    const memKey = (id) => `crion.pk.${PK_ID}.s.${id}`;
    const normUrl = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, ''); } catch (e) { return String(u || ''); } };
    let saves = lsGet(SAVES_KEY, []).filter(x => x && x.id);
    const putSaves = () => lsSet(SAVES_KEY, saves);
    const M = U.blank();
    M.prefs = Object.assign({ speed: 'normal', fx: true, lastExam: '' }, lsGet(PREF_KEY, {}));
    let saveId = null, saveT = null;
    const save = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        lsSet(PREF_KEY, M.prefs);
        if (!saveId) return;
        M.log = M.log.slice(-300); M.lines = M.lines.slice(-200);
        const { prefs, ...mem } = M;
        lsSet(memKey(saveId), mem);
        const sv = curSave();
        if (sv) { const st = M.status || {}; sv.sum = { week: st.week || 0, day: st.day || '', time: st.time || '', place: st.place || '', grade: st.grade || (M.exam && M.exam.grade) || '', me: me(), bg: M.lastBg || '' }; sv.last = Date.now(); putSaves(); }
      }, 300);
    };
    function useSave(id) {
      saveId = id;
      const mem = Object.assign(U.blank(), id ? lsGet(memKey(id), {}) : {});
      Object.keys(U.blank()).forEach(k => { M[k] = mem[k]; });
    }
    const curSave = () => saves.find(x => x.id === saveId) || null;
    const me = () => (M.exam && M.exam.name) || (M.status && M.status.me) || '신입생';

    const R = {
      mode: 'title', boundUrl: '', away: false, newFlow: null, curUrl: '', page: 'chat', actions: [], sm: null,
      beats: [], i: -1, typing: null, waiting: false, sentAt: 0, lastKey: '',
      phone: 'open', app: '', sub: null, modal: null, bgKey: '', enrollPick: [], kdraft: ''
    };

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="uv">
      <div class="uv-main">
        <div class="uv-stage" id="uv-stage">
          <div class="uv-bg"><i class="uv-bgl"></i><i class="uv-bgl"></i></div>
          <div class="uv-tint"></div><canvas class="uv-petals" aria-hidden="true"></canvas>
          <div class="uv-pt" id="uv-pt"><img alt=""></div>
          <div class="uv-hud" id="uv-hud"></div>
          <div class="uv-tr" id="uv-tr"></div>
          <div class="uv-pops" id="uv-pops"></div>
          <div class="uv-dlg" id="uv-dlg" data-uv="next"></div>
        </div>
        <aside class="uv-phone open" id="uv-phone"><button class="uv-ptab" data-uv="phone" aria-label="폰 열기/접기">${ic('phone')}<em id="uv-pbadge" hidden></em></button>
          <div class="uv-dev"><div class="uv-notch"></div><div class="uv-scr" id="uv-scr"></div></div></aside>
      </div>
      <footer class="uv-foot">
        <textarea id="uv-in" rows="1" placeholder="하고 싶은 말과 행동을 그대로 적어 보세요 (Enter 보내기 · Shift+Enter 줄바꿈)"></textarea>
        <button class="uv-fb" data-uv="regen" title="크랙에서 다시 생성">다시</button>
        <button class="uv-fb primary" data-uv="send">보내기</button>
      </footer>
      <div class="uv-layer" id="uv-title" hidden></div>
      <div class="uv-layer" id="uv-cine" hidden></div>
      <div class="uv-layer" id="uv-exam" hidden></div>
      <div class="uv-over" id="uv-modal" hidden><div class="uv-box" id="uv-box"></div></div>
      <div class="uv-banner" id="uv-banner" hidden></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const uvRoot = $('.uv');
    const narrow = () => { try { return root.matchMedia('(max-width: 760px)').matches; } catch (e) { return false; } };
    const portrait = () => { const m = $('.uv-main'); return !!m && m.clientHeight > m.clientWidth * 1.05; };
    if (narrow()) { $('#uv-in').placeholder = '하고 싶은 말과 행동을 적어 보세요'; R.phone = 'closed'; }
    [uvRoot, $('.uv-main'), $('#uv-stage')].forEach(n => n.addEventListener('scroll', () => { if (n.scrollTop || n.scrollLeft) { n.scrollTop = 0; n.scrollLeft = 0; } }));
    uvRoot.classList.toggle('nofx', !M.prefs.fx);
    const toast = (t) => o.toast(t);

    // ---------- 벚꽃 ----------
    function petals(canvas) {
      if (!canvas || !M.prefs.fx) return () => {};
      const x = canvas.getContext('2d');
      let W = 0, H = 0, raf = 0, alive = true;
      const ps = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), r: 2.5 + Math.random() * 4.5, vy: .25 + Math.random() * .7, vx: .2 + Math.random() * .5, a: Math.random() * 6, s: .01 + Math.random() * .03 }));
      const f = () => {
        if (!alive) return;
        if (!canvas.isConnected) { alive = false; return; }
        const w = canvas.clientWidth, h = canvas.clientHeight;
        if (w !== W || h !== H) { W = canvas.width = w; H = canvas.height = h; }
        x.clearRect(0, 0, W, H);
        if (!el.closest('.off') && document.visibilityState === 'visible') for (const p of ps) {
          p.y += p.vy / H * 1.6; p.x += (p.vx + Math.sin(p.a) * .5) / W * 1.6; p.a += p.s;
          if (p.y > 1.03 || p.x > 1.03) { p.y = -0.03; p.x = Math.random() - 0.1; }
          x.save(); x.translate(p.x * W, p.y * H); x.rotate(p.a); x.fillStyle = 'rgba(244,190,206,.78)'; x.beginPath(); x.ellipse(0, 0, p.r, p.r * .55, 0, 0, 7); x.fill(); x.restore();
        }
        raf = requestAnimationFrame(f);
      };
      raf = requestAnimationFrame(f);
      return () => { alive = false; cancelAnimationFrame(raf); };
    }
    const stopPetals = [petals($('.uv-petals'))];

    // ---------- 배경 · 인물 ----------
    let bgFlip = 0;
    function setBg(src) {
      if (!src || src === R.bgKey) return;
      R.bgKey = src;
      const ls = el.querySelectorAll('.uv-bgl');
      bgFlip = 1 - bgFlip;
      ls[bgFlip].style.backgroundImage = cssUrl(src);
      ls[bgFlip].classList.add('on'); ls[1 - bgFlip].classList.remove('on');
      M.lastBg = src;
    }
    function setPortrait(src, who) {
      const pt = $('#uv-pt'), im = pt.querySelector('img');
      if (!src) { pt.classList.remove('on'); return; }
      if (im.getAttribute('src') !== src) { pt.classList.remove('on'); void pt.offsetWidth; im.src = src; }
      pt.style.setProperty('--glow', (RO[who] && RO[who].color) || 'rgba(230,200,131,.6)');
      pt.classList.add('on');
    }
    function setTint() {
      const st = M.status || {};
      const t = String(st.time || '');
      const h = (t.match(/(\d{1,2})\s*:/) || [])[1];
      const night = /밤|새벽/.test(t) || (h != null && (+h >= 19 || +h < 5)) || /밤|술집|포차|밤결/.test(st.place || '');
      const dusk = /저녁|노을/.test(t) || (h != null && +h >= 17 && +h < 19);
      $('.uv-tint').className = 'uv-tint' + (night ? ' night' : dusk ? ' dusk' : '');
    }

    // ---------- HUD ----------
    const st0 = () => M.status || {};
    function dateText(st) {
      if (!st.week) return '';
      const d = U.weekDate(st.week, st.day || '월', data);
      return `${d.getMonth() + 1}월 ${d.getDate()}일${st.day ? ' ' + st.day + '요일' : ''}`;
    }
    function renderHud() {
      const st = st0();
      const grade = st.grade || (M.exam && M.exam.grade) || '';
      const g = U.gpa(M, data);
      $('#uv-hud').innerHTML = `<div class="uv-when"><b>${st.week ? st.week + '주차' : '입학'}</b><span>${esc([st.day ? st.day + '요일' : '', st.time || ''].filter(Boolean).join(' '))}</span></div>
        <div class="uv-loc">${ic('pin')}${esc(st.place || '리온대학교')}</div>
        <div class="uv-chips">${grade ? `<span class="uv-grade g-${grade}">${grade}급</span>` : ''}${g != null ? `<span class="uv-chip">평점 <b>${g.toFixed(2)}</b></span>` : ''}${st.next ? `<span class="uv-chip next">📝 ${esc(st.next)}</span>` : ''}</div>`;
      $('#uv-tr').innerHTML = `<button data-uv="lines">${ic('chat')}<span>지난 대사</span></button><button data-uv="set">${ic('gear')}<span>설정</span></button>`;
    }

    // ---------- 알림 뜨기 (가가오톡·호감도·과제) ----------
    function pop(html, cls) {
      if (!M.prefs.fx && cls !== 'big') return;
      const box = $('#uv-pops');
      const n = document.createElement('div');
      n.className = 'uv-pop ' + (cls || '');
      n.innerHTML = html;
      box.appendChild(n);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 500); }, cls === 'big' ? 4200 : 3200);
    }

    // ---------- 스마트폰 ----------
    const unreadKakao = () => Object.entries(M.kakao || {}).reduce((a, [room, ms]) => a + Math.max(0, ms.length - ((M.kakaoRead || {})[room] || 0)), 0);
    const unreadRiv = () => Math.max(0, (M.riv || []).length - (M.rivRead || 0));
    function badge() {
      const n = unreadKakao() + unreadRiv();
      const b = $('#uv-pbadge');
      b.hidden = !n || R.phone === 'open'; b.textContent = n > 99 ? '99+' : n;
    }
    function clockText() {
      const st = st0();
      const m = String(st.time || st.clock || '').match(/(\d{1,2})\s*:\s*(\d{2})/);
      if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
      const t = String(st.time || '');
      return /아침/.test(t) ? '08:30' : /점심/.test(t) ? '12:20' : /오후/.test(t) ? '15:00' : /저녁/.test(t) ? '18:40' : /밤/.test(t) ? '22:10' : /새벽/.test(t) ? '03:10' : '09:00';
    }
    function renderPhone() {
      const ph = $('#uv-phone');
      ph.className = 'uv-phone ' + R.phone + (R.app ? ' in-app' : '');
      badge();
      const scr = $('#uv-scr');
      const keep = {}; scr.querySelectorAll('[data-sk]').forEach(n => { keep[n.dataset.sk] = n.scrollTop; });
      scr.innerHTML = `<div class="uv-sbar"><span>${clockText()}</span><span class="uv-sic">리온 5G <i class="uv-bat"><b></b></i></span></div>${R.app ? appHtml() : homeHtml()}`;
      scr.querySelectorAll('[data-sk]').forEach(n => { if (keep[n.dataset.sk] != null) n.scrollTop = keep[n.dataset.sk]; else if (n.dataset.end) n.scrollTop = n.scrollHeight; });
    }
    function homeHtml() {
      const st = st0();
      const notes = (M.notifs || []).slice(0, 3);
      const k = unreadKakao(), r = unreadRiv();
      const affN = Object.keys(M.aff || {}).length;
      return `<div class="uv-home" data-sk="home">
        <div class="uv-lock"><div class="uv-ldate">${esc(dateText(st) || '2026년 3월 2일 월요일')}</div><div class="uv-ltime">${clockText()}</div>
          <div class="uv-lsub">${st.week ? `1학년 1학기 · ${st.week}주차` : '리온대학교 X스학과 신입생'}</div>
          ${st.next || st.nextClass ? `<div class="uv-lnext">📝 ${esc(st.next || ('다음 수업 ' + st.nextClass))}</div>` : ''}</div>
        ${notes.length ? `<div class="uv-notes">${notes.map(n => `<button class="uv-note" data-uv="app" data-k="${n.app === 'kakao' ? 'kakao' : 'riv'}"><i class="${n.app}">${ic(n.app === 'kakao' ? 'kakao' : 'riv')}</i><span><b>${n.app === 'kakao' ? '가가오톡' + (n.room ? ' · ' + esc(n.room) : '') : '뤼브리타임'}</b><em>${esc(n.title)}</em></span><small>${esc(n.ago || '')}</small></button>`).join('')}</div>` : ''}
        <div class="uv-apps">${APPS.map(([id, nm, bg, fg]) => `<button class="uv-appi" data-uv="app" data-k="${id}"><span class="uv-aico" style="background:${bg};color:${fg}">${ic(id)}${id === 'kakao' && k ? `<em>${k}</em>` : id === 'riv' && r ? `<em>${r}</em>` : id === 'heart' && affN ? `<em class="soft">${affN}</em>` : ''}</span>${nm}</button>`).join('')}</div>
        <div class="uv-dock"><button data-uv="fill-sc" data-k="가가오톡">${ic('kakao')}<span>가가오톡 불러오기</span></button><button data-uv="fill-sc" data-k="뤼브리타임">${ic('riv')}<span>뤼브리타임 불러오기</span></button></div>
      </div>`;
    }
    const appHead = (title, right, cls) => `<div class="uv-ahead ${cls || ''}"><button data-uv="${R.sub != null ? 'sub-back' : 'home'}" aria-label="뒤로">${ic('back')}</button><b>${title}</b>${right || '<span></span>'}</div>`;
    function appHtml() {
      switch (R.app) {
        case 'kakao': return kakaoHtml();
        case 'riv': return rivHtml();
        case 'table': return tableHtml();
        case 'heart': return heartHtml();
        case 'id': return idHtml();
        case 'cal': return calHtml();
        case 'album': return albumHtml();
        case 'meal': return mealHtml();
      }
      return homeHtml();
    }
    // ── 가가오톡
    function avatarOf(room, msgs) {
      const who = roster.resolve(room) || (msgs.find(m => m.who) || {}).who || '';
      const f = who ? face(who) : '';
      return f ? `<img src="${esc(f)}" alt="">` : `<span>${esc((room || '?').replace(/^\d+학년\s*/, '').slice(0, 1))}</span>`;
    }
    function kakaoHtml() {
      const rooms = Object.entries(M.kakao || {}).sort((a, b) => (b[1][b[1].length - 1] || {}).at - (a[1][a[1].length - 1] || {}).at);
      if (R.sub != null && M.kakao[R.sub]) {
        const room = R.sub, ms = M.kakao[room];
        M.kakaoRead[room] = ms.length; save();
        const group = /단톡|톡방|방$|,/.test(room);
        let lastWho = null;
        return `<div class="uv-app kakao">${appHead(esc(room), `<span class="uv-n">${group ? '단톡' : '1:1'}</span>`, 'kk')}
          <div class="uv-kmsgs" data-sk="k-${esc(room)}" data-end="1">${ms.map(m => {
            const mine = m.me;
            const showWho = !mine && m.who && m.who !== lastWho; lastWho = mine ? '__me' : m.who;
            const f = m.who ? face(m.who) : '';
            return `<div class="uv-km ${mine ? 'me' : ''}">${!mine ? `<i class="uv-kav">${showWho && f ? `<img src="${esc(f)}" alt="">` : ''}</i>` : ''}<div>${showWho ? `<b>${esc(m.who)}</b>` : ''}<p>${esc(m.t)}</p></div></div>`;
          }).join('')}</div>
          <div class="uv-kcomp"><input id="uv-kin" placeholder="답장할 말 (입력칸에 채워 줘요)" value="${esc(R.kdraft)}" autocomplete="off"><button data-uv="kfill" aria-label="채우기">${ic('send')}</button></div></div>`;
      }
      return `<div class="uv-app kakao">${appHead('가가오톡', `<button class="uv-hbtn" data-uv="fill-sc" data-k="가가오톡" title="가가오톡 불러오기">${ic('refresh')}</button>`, 'kk')}
        <div class="uv-list" data-sk="klist">${rooms.length ? rooms.map(([room, ms]) => { const last = ms[ms.length - 1] || {}; const un = ms.length - ((M.kakaoRead || {})[room] || 0); return `<button class="uv-krow" data-uv="kroom" data-k="${esc(room)}"><i class="uv-kav big">${avatarOf(room, ms)}</i><span><b>${esc(room)}</b><em>${esc((last.who && /단톡|방$|,/.test(room) ? last.who + ': ' : '') + (last.t || ''))}</em></span>${un > 0 ? `<small>${un}</small>` : ''}</button>`; }).join('')
          : '<div class="uv-empty">아직 온 메시지가 없어요.<br>위 ↻ 를 누르면 입력칸에 「가가오톡 호출」이 채워져요.</div>'}</div></div>`;
    }
    // ── 뤼브리타임
    function rivHtml() {
      const posts = M.riv || [];
      M.rivRead = posts.length; save();
      if (R.sub != null && posts[R.sub]) {
        const p = posts[R.sub];
        return `<div class="uv-app riv">${appHead('뤼브리타임', '', 'rv')}<div class="uv-rpost" data-sk="rp">
          <div class="uv-rmeta"><i>${esc((p.who || '익명').slice(0, 2))}</i><span><b>${esc(p.who || '익명')}</b><small>${esc(p.board || '자유게시판')}${p.w ? ' · ' + p.w + '주차' : ''}</small></span></div>
          <h4>${esc(p.title)}</h4>${p.body.map(b => `<p>${esc(b)}</p>`).join('')}${p.peek ? '<p class="uv-dim">(알림으로만 본 글이에요)</p>' : ''}
          <div class="uv-rc">💬 ${p.cmts.length}</div>${p.cmts.map(c => `<div class="uv-rcm"><b>${esc(c.who)}</b><span>${esc(c.t)}</span></div>`).join('')}</div></div>`;
      }
      return `<div class="uv-app riv">${appHead('<span class="uv-rlogo">뤼</span>뤼브리타임 <small>리온대 캠퍼스</small>', `<button class="uv-hbtn" data-uv="fill-sc" data-k="뤼브리타임" title="게시판 불러오기">${ic('refresh')}</button>`, 'rv')}
        <div class="uv-list" data-sk="rlist">${posts.length ? posts.map((p, i) => `<button class="uv-rrow" data-uv="rpost" data-k="${i}"><span class="uv-rb">${esc(p.board || '자유게시판')}</span><b>${esc(p.title)}</b>${p.body[0] ? `<em>${esc(p.body[0])}</em>` : ''}<small>${esc(p.who || '익명')} · ${p.w ? p.w + '주차' : '방금'}${p.cmts.length ? ` · 💬 ${p.cmts.length}` : ''}</small></button>`).join('')
          : '<div class="uv-empty">아직 읽은 글이 없어요.<br>위 ↻ 를 누르면 입력칸에 「뤼브리타임 호출」이 채워져요.</div>'}</div></div>`;
    }
    // ── 시간표 · 학점
    const enrolled = () => (M.enrolled && M.enrolled.length ? M.enrolled : Object.keys(M.courses || {}));
    const COURSE = (n) => (data.courses || []).find(c => c.n === n) || null;
    function tableHtml() {
      if (R.sub === 'enroll') return enrollHtml();
      const list = enrolled();
      const g = U.gpa(M, data);
      const days = ['월', '화', '수', '목', '금'];
      const slots = data.slots || {};
      const cell = (d, t) => list.map(n => COURSE(n)).filter(c => c && slots[c.slot] && slots[c.slot][0] === d && slots[c.slot][1] === t);
      const times = ['10:00', '13:00', '15:00'];
      const grid = list.length ? `<div class="uv-tt"><span></span>${days.map(d => `<b class="${st0().day === d ? 'on' : ''}">${d}</b>`).join('')}
        ${times.map(t => `<i>${t.slice(0, 2)}</i>${days.map(d => { const cs = cell(d, t); return `<div class="uv-tc">${cs.map(c => `<span class="${c.t === '교양' ? 'gy' : ''}">${esc(c.n.replace(/\(.*\)/, '').slice(0, 7))}</span>`).join('')}</div>`; }).join('')}`).join('')}</div>` : '';
      const rows = list.map(n => {
        const c = (M.courses || {})[n] || { done: 0, of: 4, hist: [] }, k = COURSE(n);
        const L = U.courseLetter(c);
        return `<div class="uv-crow"><div><b>${esc(n)}</b><small>${k ? esc(k.t + ' · ' + k.prof + ' · ' + k.room) : ''}</small></div>
          <div class="uv-dots">${Array.from({ length: c.of || 4 }, (_, i) => `<i class="${i < c.done ? 'on' : ''}">${esc(c.hist[i] || '')}</i>`).join('')}</div><em class="uv-let">${L || '-'}</em></div>`;
      }).join('');
      return `<div class="uv-app table">${appHead('시간표 · 학점', '', 'tb')}<div class="uv-list pad" data-sk="tt">
        <div class="uv-gpa"><div><small>예상 평점</small><b>${g != null ? g.toFixed(2) : '–'}</b><span>/ 4.5</span></div><div class="uv-gbar"><i style="width:${g != null ? clamp(g / 4.5 * 100, 0, 100) : 0}%"></i><u style="left:${4.2 / 4.5 * 100}%"></u></div><small>장학금 4.2 · 과제 평가를 평균 낸 값이에요</small></div>
        ${grid}${rows || '<div class="uv-empty">아직 수강신청 전이에요.</div>'}
        <button class="uv-btn ${list.length ? 'ghost' : 'primary'}" data-uv="enroll">${list.length ? '수강 정정 문장 만들기' : '수강신청 하기'}</button></div></div>`;
    }
    function enrollHtml() {
      const cs = data.courses || [];
      const pick = R.enrollPick;
      const maj = pick.filter(n => (COURSE(n) || {}).t === '전공'), lib = pick.filter(n => (COURSE(n) || {}).t === '교양');
      const ok = maj.length >= 1 && maj.length <= 4 && lib.length === 1;
      const ev = M.enroll && M.enroll.lines ? `<div class="uv-wrev"><b>WREVERYTIME</b>${M.enroll.lines.slice(0, 12).map(l => `<span>${esc(l)}</span>`).join('')}</div>` : '';
      return `<div class="uv-app table">${appHead('수강신청', `<span class="uv-n">${maj.length}/4 · ${lib.length}/1</span>`, 'tb')}<div class="uv-list pad" data-sk="en">
        <p class="uv-dim">전공 최대 4개 + 교양 1개 (학기당 5과목)</p>${ev}
        ${['전공', '교양'].map(t => `<h5>${t}</h5>${cs.filter(c => c.t === t).map(c => { const on = pick.includes(c.n); const sl = (data.slots || {})[c.slot] || []; return `<button class="uv-ecourse ${on ? 'on' : ''}" data-uv="epick" data-k="${esc(c.n)}"><span><b>${esc(c.n)}</b><small>${esc(c.prof)} · ${esc(sl.join(' ').replace(/ (\d)/, ' $1'))} · ${c.cr}학점</small></span><i>${on ? '✓' : '+'}</i></button>`; }).join('')}`).join('')}
        <div class="uv-sent">${ok ? esc(enrollSentence()) : '전공 1~4개와 교양 1개를 골라 주세요'}</div>
        <button class="uv-btn primary" data-uv="efill" ${ok ? '' : 'disabled'}>입력칸에 채우기</button></div></div>`;
    }
    function enrollSentence() {
      const maj = R.enrollPick.filter(n => (COURSE(n) || {}).t === '전공'), lib = R.enrollPick.filter(n => (COURSE(n) || {}).t === '교양');
      return `수강신청을 한다. 전공은 ${maj.join(', ')}, 교양은 ${lib.join(', ')}${josa(lib[0] || '', '으로', '로').slice(lib[0] ? lib[0].length : 0)} 신청한다.`;
    }
    // ── 인연 (호감도)
    function heartHtml() {
      const H = (data.roster || []).filter(r => r.heroine);
      if (R.sub != null) {
        const r = RO[R.sub]; if (!r) { R.sub = null; return heartHtml(); }
        const a = (M.aff || {})[r.name], f = face(r.name);
        const hist = (a && a.hist) || [];
        const pts = hist.map((h, i) => `${(i / Math.max(1, hist.length - 1)) * 100},${100 - clamp(h[1], 0, 100)}`).join(' ');
        return `<div class="uv-app heart">${appHead(esc(r.name), '', 'ht')}<div class="uv-list pad" data-sk="hd">
          <div class="uv-hcard" style="--c:${r.color || '#f3a1b9'}"><div class="uv-hph">${f ? `<img src="${esc(f)}" alt="">` : ''}</div>
            <div class="uv-hinfo"><b>${esc(r.name)}</b><small>${r.age}세 · ${esc(r.role)}</small>${a ? `<div class="uv-emo">${a.e} <span>${U.EMO[a.e] || ''}</span> <em>${a.v}</em></div><div class="uv-hbar"><i style="width:${clamp(a.v, 0, 100)}%"></i><u></u></div><small class="uv-dim">50을 넘긴 뒤 결정적인 일이 생기면 감정이 바뀌어요</small>` : '<div class="uv-emo">아직 만나지 않았어요</div>'}</div></div>
          <p class="uv-hline">${esc(r.line)}</p>
          ${hist.length > 1 ? `<svg class="uv-spark" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}"/></svg>` : ''}
          ${a ? `<div class="uv-row2"><button class="uv-btn" data-uv="pfill" data-k="talk" data-n="${esc(r.name)}">말 걸기</button><button class="uv-btn" data-uv="pfill" data-k="kakao" data-n="${esc(r.name)}">가가오톡 보내기</button></div>` : ''}</div></div>`;
      }
      const others = Object.keys(M.met || {}).filter(n => RO[n] && !RO[n].heroine);
      return `<div class="uv-app heart">${appHead('인연', `<span class="uv-n">${Object.keys(M.aff || {}).length}/${H.length}</span>`, 'ht')}<div class="uv-list pad" data-sk="hl">
        <div class="uv-hgrid">${H.map(r => { const a = (M.aff || {})[r.name], f = a || M.met[r.name] ? face(r.name) : ''; return `<button class="uv-hit ${a ? '' : 'unk'}" data-uv="hsel" data-k="${esc(r.name)}" style="--c:${r.color}"><span class="uv-hph">${f ? `<img src="${esc(f)}" alt="">` : '<i>?</i>'}</span><b>${a || M.met[r.name] ? esc(r.name) : '???'}</b>${a ? `<em>${a.e} ${a.v}</em><i class="uv-mini"><u style="width:${clamp(a.v, 0, 100)}%"></u></i>` : '<em class="uv-dim">—</em>'}</button>`; }).join('')}</div>
        ${others.length ? `<h5>만난 사람</h5><div class="uv-npcs">${others.map(n => `<span><i>${face(n) ? `<img src="${esc(face(n))}" alt="">` : ''}</i><b>${esc(n)}</b><small>${esc(RO[n].role)}</small></span>`).join('')}</div>` : ''}
        <p class="uv-dim">💜무관심 💙연민 🧡우정 💛가족 🖤비호감 💔적대 ❤️사랑 · 수치는 크랙 상태창 그대로예요</p></div></div>`;
    }
    // ── 학생증
    function idHtml() {
      const ex = M.exam, st = st0();
      const grade = st.grade || (ex && ex.grade) || '?';
      const stats = ex && ex.stats ? Object.entries(ex.stats).filter(([, v]) => v != null) : [];
      const gname = ((data.exam || {}).gradeName || {})[grade] || '';
      return `<div class="uv-app id">${appHead('모바일 학생증', '', 'idh')}<div class="uv-list pad" data-sk="id">
        <div class="uv-idc"><div class="uv-idt"><b>리온대학교</b><small>RION UNIVERSITY</small></div>
          <div class="uv-idb"><div class="uv-idph">${esc(me().slice(0, 1))}</div><div><b>${esc(me())}</b><span>X스학과 1학년</span><span>${esc((ex && ex.sid) || '학번 미발급')}</span></div><div class="uv-idg g-${grade}"><b>${grade}</b><small>GRADE</small></div></div>
          ${gname ? `<div class="uv-idn">${esc(gname)}${ex && ex.type ? ' · ' + esc(ex.type) : ''}</div>` : ''}</div>
        ${stats.length ? `<div class="uv-bars">${stats.map(([k, v]) => `<div><span>${k}</span><i><u style="width:${clamp(v, 0, 100)}%"></u></i><b>${v}</b></div>`).join('')}</div>` : ''}
        ${ex ? `<div class="uv-kv"><span>특기</span><b>${esc(ex.skill || '-')}</b><span>취미</span><b>${esc(ex.hobby || '-')}</b><span>성격</span><b>${esc(ex.traits || '-')}</b></div>${ex.cm ? `<p class="uv-cm">“${esc(ex.cm)}”<small>검사 담당관 양가희</small></p>` : ''}`
          : '<div class="uv-empty">아직 입학 검사 결과가 없어요.</div>'}
        <button class="uv-btn ${ex ? 'ghost' : 'primary'}" data-uv="exam">${ex ? '검사 결과서 다시 보기·재검사' : '입학 검사 받기'}</button></div></div>`;
    }
    // ── 학사일정
    function calHtml() {
      const wk = st0().week || 0;
      const ev = data.cal || [];
      const weeks = Array.from({ length: 16 }, (_, i) => i + 1);
      return `<div class="uv-app cal">${appHead('학사일정', `<span class="uv-n">${wk ? wk + '/16주' : ''}</span>`, 'cl')}<div class="uv-list pad" data-sk="cal">
        ${st0().next ? `<div class="uv-cnext">📝 ${esc(st0().next)}</div>` : ''}
        <div class="uv-weeks">${weeks.map(w => { const es = ev.filter(e => e[0] === w); const d = U.weekDate(w, '월', data); return `<div class="uv-wk ${w === wk ? 'on' : w < wk ? 'past' : ''}"><b>${w}주</b><small>${d.getMonth() + 1}/${d.getDate()}</small><span>${es.map(e => `<em class="k-${e[2]}">${esc(e[1])}</em>`).join('') || ''}</span></div>`; }).join('')}</div></div></div>`;
    }
    // ── 앨범
    function albumHtml() {
      const al = (M.album || []).slice().reverse();
      return `<div class="uv-app album">${appHead('앨범', `<span class="uv-n">${al.length}</span>`, 'al')}<div class="uv-list" data-sk="al">
        ${al.length ? `<div class="uv-agrid">${al.map((a, i) => `<button data-uv="aview" data-k="${al.length - 1 - i}" class="${a.kind === 'bg' ? 'wide' : ''}"><img src="${esc(a.src)}" alt="" loading="lazy">${a.who ? `<small>${esc(a.who)}</small>` : ''}</button>`).join('')}</div>` : '<div class="uv-empty">크랙 응답에 나온 그림이 여기에 모여요.</div>'}</div></div>`;
    }
    // ── 학식
    function mealHtml() {
      const d = ['월', '화', '수', '목', '금'].includes(st0().day) ? st0().day : '월';
      const m = (data.menu || {})[d] || [];
      return `<div class="uv-app meal">${appHead('제1학생식당', '', 'ml')}<div class="uv-list pad" data-sk="ml">
        <div class="uv-mday">${d}요일 메뉴 · 점심 11:30~14:00 · 저녁 17:00~18:30</div>
        ${m.map((x, i) => `<div class="uv-mrow"><span>${i < 2 ? '점심 ' + 'AB'[i] : '저녁'}</span><b>${esc(x[0])}</b><em>${x[1].toLocaleString()}원</em></div>`).join('')}
        <div class="uv-mrow"><span>상시</span><b>계란후라이 덮밥 <small>신메뉴</small></b><em>4,500원</em></div>
        <p class="uv-dim">인사를 잘하면 계란후라이를 하나 더… 그때그때 기분이래요.</p>
        <button class="uv-btn primary" data-uv="xfill" data-k="학생식당에 밥 먹으러 간다.">밥 먹으러 가기</button></div></div>`;
    }
    function openApp(k, sub) { R.app = k; R.sub = sub == null ? null : sub; if (R.phone !== 'open') R.phone = 'open'; renderPhone(); }

    // ---------- 대사창 ----------
    let typeT = null;
    function typeTo(node, text, done) {
      clearInterval(typeT);
      const ms = SPEED[M.prefs.speed] == null ? 22 : SPEED[M.prefs.speed];
      if (!ms || !text) { node.textContent = text; R.typing = null; done && done(); return; }
      let i = 0;
      node.textContent = '';
      R.typing = { finish() { clearInterval(typeT); node.textContent = text; R.typing = null; done && done(); } };
      typeT = setInterval(() => { i += 1; node.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typeT); R.typing = null; done && done(); } }, ms);
    }
    const endPhrase = () => `${josa(me(), '은', '는')} 어떻게 할까?`;
    function showBeat(i) {
      const d = $('#uv-dlg');
      const b = R.beats[i];
      if (!b) { d.className = 'uv-dlg k-end'; d.innerHTML = `<div class="uv-dline uv-endq">${esc(endPhrase())}</div>`; return; }
      if (b.bg) setBg(b.bg);
      if (b.kind === 'say') setPortrait(b.portrait || packFace(b.who), b.who);
      else if (b.portrait) setPortrait(b.portrait, '');
      else if (b.kind !== 'title') setPortrait('');
      const last = i >= R.beats.length - 1;
      if (b.kind === 'title') {
        d.className = 'uv-dlg k-title';
        d.innerHTML = `<div class="uv-ep"><small>EPISODE. ${b.ep}</small><b>${esc(b.text)}</b></div><span class="uv-next">${last ? '' : '탭해서 계속 ▼'}</span>`;
        R.typing = null; return;
      }
      const r = b.kind === 'say' ? RO[b.who] : null;
      d.className = 'uv-dlg k-' + b.kind;
      d.style.setProperty('--nc', (r && r.color) || '#e6c883');
      d.innerHTML = `${b.kind === 'say' ? `<div class="uv-name">${esc(b.who)}${b.title ? `<small>${esc(b.title)}</small>` : ''}</div>` : ''}
        ${b.act ? `<div class="uv-act">${esc(b.act)}</div>` : ''}<div class="uv-dline"></div>
        <span class="uv-next">${last ? '' : '탭해서 계속 ▼'}</span>${last ? `<div class="uv-endq" hidden>${esc(endPhrase())}</div>` : ''}`;
      const text = b.kind === 'say' ? `“${b.text}”` : b.kind === 'sys' ? `( ${b.text} )` : b.text;
      typeTo(d.querySelector('.uv-dline'), text, () => { if (last) { const q = d.querySelector('.uv-endq'); if (q) q.hidden = false; } });
    }
    function next() {
      if (R.typing) { R.typing.finish(); return; }
      if (R.waiting) return;
      if (R.i < R.beats.length - 1) { R.i++; showBeat(R.i); }
    }

    // ---------- 응답 처리 ----------
    function handle(segs) {
      if (R.sm) R.sm.done = true;
      const P = U.parse(segs, roster, data);
      const ev = U.absorb(M, P, data);
      P.beats.forEach(b => { if (b.text) M.lines.push({ w: (M.status && M.status.week) || 0, who: b.kind === 'say' ? b.who : '', t: b.text, sys: b.kind === 'sys' }); });
      save();
      R.beats = P.beats.filter(b => b.text || b.bg || b.portrait);
      R.i = -1;
      renderHud(); setTint(); renderPhone();
      notifyEvents(ev);
      if (!M.prologue) { M.prologue = true; save(); playCine(R.beats, ev.needExam); return; }
      if (ev.enroll) { R.enrollPick = R.enrollPick.length ? R.enrollPick : []; setTimeout(() => { openApp('table', 'enroll'); pop('📚 <b>수강신청 창이 열렸어요</b><span>폰에서 과목을 고르면 문장을 만들어 드려요</span>', 'big'); }, 400); }
      if (ev.needExam && !M.exam) setTimeout(() => askExam(), 300);
      startBeats();
    }
    function notifyEvents(ev) {
      (ev.affUp || []).forEach(a => {
        if (a.first) return;
        if (a.changed) pop(`<i class="big">${a.e}</i><b>${esc(a.n)}</b><span>마음이 「${esc(U.EMO[a.e] || '')}」(으)로 바뀌었어요</span>`, 'big');
        else { const d = Math.round((a.to - a.from) * 10) / 10; if (d) pop(`<i>${a.e}</i><b>${esc(a.n)}</b><span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${d}</span>`, 'aff'); }
      });
      (ev.graded || []).forEach(g => pop(`<i>📚</i><b>${esc(g.n)}</b><span>과제 ${g.k}/4 · <u class="gl">${esc(g.g)}</u></span>`, 'grade'));
      if (ev.newKakao) { const rooms = Object.entries(M.kakao); const [room, ms] = rooms.sort((a, b) => (b[1][b[1].length - 1] || {}).at - (a[1][a[1].length - 1] || {}).at)[0] || []; const last = ms && ms[ms.length - 1]; if (last) pop(`<i class="kk">${ic('kakao')}</i><b>${esc(room)}</b><span>${esc((last.who && last.who !== room ? last.who + ': ' : '') + last.t).slice(0, 60)}</span>`, 'kakao'); }
      if (ev.newRiv) pop(`<i class="rv">${ic('riv')}</i><b>뤼브리타임</b><span>새 글 ${ev.newRiv}개</span>`, 'riv');
    }
    function startBeats() { R.i = R.beats.length ? 0 : -1; showBeat(R.i); }

    // ---------- 프롤로그 (영화식) ----------
    function playCine(beats, needExam) {
      const pages = beats.filter(b => b.text);
      if (!pages.length) { afterCine(needExam); return; }
      R.cine = { pages, i: 0, needExam };
      const c = $('#uv-cine');
      c.hidden = false; c.classList.remove('out');
      c.innerHTML = `<div class="uv-cbg"><i></i></div><canvas class="uv-petals" aria-hidden="true"></canvas><div class="uv-cin"></div><span class="uv-chint">탭하여 계속 ▾</span><button class="uv-cskip" data-uv="cine-skip">건너뛰기 ›</button><div class="uv-cbar"></div>`;
      stopPetals.push(petals(c.querySelector('.uv-petals')));
      cineShow();
    }
    function cineShow() {
      const C = R.cine, p = C.pages[C.i], c = $('#uv-cine');
      let bg = null; for (let k = C.i; !bg && k >= 0; k--) bg = C.pages[k].bg;
      if (!bg) { const b0 = R.beats.find(b => b.bg); bg = b0 && b0.bg; }
      c.querySelector('.uv-cbg i').style.backgroundImage = cssUrl(bg || BG('gate'));
      if (bg) setBg(bg);
      const box = c.querySelector('.uv-cin');
      if (p.kind === 'title') { box.innerHTML = `<div class="uv-ctitle"><small>EPISODE. ${p.ep}</small><b>${esc(p.text)}</b></div>`; R.typing = null; c.querySelector('.uv-chint').style.opacity = 1; }
      else {
        box.innerHTML = `${p.kind === 'say' ? `<div class="uv-cwho">${(p.portrait || packFace(p.who)) ? `<img src="${esc(p.portrait || packFace(p.who))}" alt="">` : ''}<b>${esc(p.who)}</b></div>` : ''}<p class="uv-ctext"></p>`;
        c.querySelector('.uv-chint').style.opacity = 0;
        typeTo(box.querySelector('.uv-ctext'), p.kind === 'say' ? `“${p.text}”` : p.text, () => { const h = c.querySelector('.uv-chint'); if (h) h.style.opacity = 1; });
      }
      c.querySelector('.uv-cbar').style.width = ((C.i + 1) / C.pages.length * 100) + '%';
    }
    function cineNext() {
      if (R.typing) { R.typing.finish(); return; }
      if (!R.cine) return;
      if (R.cine.i < R.cine.pages.length - 1) { R.cine.i++; cineShow(); } else cineEnd();
    }
    function cineEnd() {
      if (!R.cine) return;
      const needExam = R.cine.needExam;
      R.cine = null; clearInterval(typeT); R.typing = null;
      const c = $('#uv-cine'); c.classList.add('out');
      setTimeout(() => { c.hidden = true; c.classList.remove('out'); c.innerHTML = ''; afterCine(needExam); }, M.prefs.fx ? 450 : 0);
    }
    function afterCine(needExam) {
      R.i = R.beats.length - 1;
      showBeat(R.i);
      if (R.typing) R.typing.finish();
      if (needExam && !M.exam) askExam();
    }

    // ---------- 입학 검사 (검사소 사이트를 앱 안으로 · 결과는 입력칸에 채운다) ----------
    function askExam() {
      openModal('exam-ask');
    }
    const X = { P: null, R: null, retries: 0, adv: null, hook: null, run: 0 };
    const EXD = data.exam || {};
    function exOpen() {
      closeModal();
      const ex = $('#uv-exam');
      ex.hidden = false;
      ex.innerHTML = `<div class="uv-xbg"><i></i><i></i></div><div class="uv-xshade"></div><canvas class="uv-petals" aria-hidden="true"></canvas>
        <div class="uv-xhud"><span>인적사항</span><span>신체</span><span>이론</span><span>상황</span><span>면접</span></div>
        <div class="uv-xsp"><img src="${esc(url('assets/gahee_stand.webp'))}" alt="검사 담당관 양가희"></div>
        <div class="uv-xui"></div><div class="uv-xch" hidden></div>
        <div class="uv-xdlg" hidden><div class="uv-xbox"><div class="uv-xdn"></div><div class="uv-xdt"></div><i class="uv-xcar">▼</i></div></div>
        <button class="uv-xclose" data-uv="ex-close" aria-label="검사 닫기">${ic('x')}</button>`;
      stopPetals.push(petals(ex.querySelector('.uv-petals')));
      X.run++;
      exMain(X.run).catch(e => { if (e && e.message !== 'stop') console.error(e); });
    }
    function exClose() { X.run++; X.adv = null; X.hook = null; const ex = $('#uv-exam'); ex.hidden = true; ex.innerHTML = ''; }
    const xq = (s) => $('#uv-exam').querySelector(s);
    let xFlip = false;
    function xbg(k) { const a = $('#uv-exam').querySelectorAll('.uv-xbg i'); if (!a.length) return; xFlip = !xFlip; const on = a[xFlip ? 0 : 1], off = a[xFlip ? 1 : 0]; on.style.backgroundImage = cssUrl(BG(k)); on.classList.add('on'); off.classList.remove('on'); }
    function xhud(i) { const s = [...$('#uv-exam').querySelectorAll('.uv-xhud span')]; xq('.uv-xhud').classList.toggle('on', i >= 0); s.forEach((e, k) => { e.className = k < i ? 'done' : k === i ? 'on' : ''; }); }
    function xmode(m) { const ex = $('#uv-exam'); ex.dataset.m = m; xq('.uv-xdlg').hidden = m !== 'talk'; xq('.uv-xsp').classList.toggle('show', m === 'talk'); }
    const alive = (run) => { if (run !== X.run || $('#uv-exam').hidden) throw new Error('stop'); };
    function xsay(run, w, text) {
      alive(run);
      return new Promise(res => {
        xq('.uv-xch').hidden = true; xmode('talk');
        const t = String(text).replace(/\{name\}/g, (X.P && X.P.name) || '신입생');
        const dn = xq('.uv-xdn'), dt = xq('.uv-xdt');
        dn.textContent = w; dn.hidden = !w || w === '해설';
        typeTo(dt, t, () => {});
        X.adv = () => { if (R.typing) { R.typing.finish(); return; } X.adv = null; res(); };
      });
    }
    function xpanel(html, cls) { xmode('panel'); xq('.uv-xch').hidden = true; X.adv = null; xq('.uv-xui').innerHTML = `<div class="uv-xpanel ${cls || ''}">${html}</div>`; }
    function xchoose(run, opts, sec) {
      alive(run);
      return new Promise(res => {
        const c = xq('.uv-xch'); X.adv = null; c.hidden = false;
        c.innerHTML = (sec ? '<div class="uv-xtm"><i></i></div>' : '') + opts.map((o, i) => `<button class="uv-xc" style="animation-delay:${i * 90}ms" data-i="${i}">${esc(o)}</button>`).join('');
        let timer = null, done = false;
        const end = (v) => { if (done) return; done = true; clearTimeout(timer); c.hidden = true; res(v); };
        c.querySelectorAll('.uv-xc').forEach(b => { b.onclick = (e) => { e.stopPropagation(); end(+b.dataset.i); }; });
        if (sec) { const bar = c.querySelector('.uv-xtm i'); bar.style.transition = `transform ${sec}s linear`; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; })); timer = setTimeout(() => end(-1), sec * 1000); }
      });
    }
    async function exMain(run) {
      X.P = { name: (M.exam && M.exam.name) || '', age: 0, skill: '', hobby: '', traits: [], why: '', intro: '', selfP: 3, selfK: 3 };
      X.R = {};
      xbg('gate'); xhud(-1);
      xpanel(`<div class="uv-xttl"><div class="uv-xkick">2026학년도 1학기 신입생</div><h1>리온대학교</h1><div class="uv-xen">X스학과 입학 검사소</div>
        <p>정문에서 시작해 신체, 이론, 상황 판단, 담당관 면접을 차례로 통과해요. 3~5분이 걸리고, 마지막 결과서는 <b>입력칸에 채워 드려요</b>.</p>
        <button class="uv-xbtn" data-x="go">검사 시작</button><button class="uv-xbtn gh" data-x="paste">이미 결과서가 있어요</button></div>`);
      xmode('title');
      const how = await new Promise(r => { xq('[data-x=go]').onclick = () => r('go'); xq('[data-x=paste]').onclick = () => r('paste'); });
      alive(run);
      if (how === 'paste') { exPaste(); return; }
      for (const [w, t] of EXD.intro || []) { if (w === '양가희' && /인적사항/.test(t)) xbg('assist'); await xsay(run, w, t); }
      await exForm(run);
      await xsay(run, '양가희', '접수 완료. {name} 학생, 기재 내용을 확인했습니다. 첫 검사는 신체검사입니다.');
      await exSession(run, false);
    }
    function exPaste() {
      xhud(-1);
      xpanel(`<div class="uv-xpaper"><div class="uv-xhd"><b>결과서 붙여 넣기</b><small>입학 검사소에서 받은 결과</small></div>
        <textarea id="uv-xpaste" class="uv-xta" placeholder="[입학 검사 결과 | 리온대학교 X스학과]\n이름: …">${esc(M.prefs.lastExam || '')}</textarea>
        <div class="uv-xerr" id="uv-xerr"></div><button class="uv-xbtn wide" data-x="pok">결과서 제출 (입력칸에 채우기)</button>
        <p class="uv-xnote">검사소 사이트에서 직접 받고 싶으면 <button class="uv-link" data-uv="open-exam-site">검사소 사이트 열기</button></p></div>`);
      xq('[data-x=pok]').onclick = () => {
        const t = xq('#uv-xpaste').value.trim();
        const r = U.parseExam(t);
        if (!r) { xq('#uv-xerr').textContent = '[입학 검사 결과 …] 로 시작하는 결과서 전체를 붙여 넣어 주세요.'; return; }
        submitExam(t);
      };
    }
    function exForm(run) {
      xhud(0);
      return new Promise(res => {
        const D = X.P;
        const opt = (a, cur) => a.map(w => `<option ${w === cur ? 'selected' : ''}>${esc(w)}</option>`).join('');
        xpanel(`<form class="uv-xpaper" id="uv-xfm" novalidate><div class="uv-xhd"><b>신체 X스 적격도 검사지</b><small>리온대학교 X스학과</small></div>
          <label class="uv-xf"><span>이름</span><input id="xf-name" maxlength="8" autocomplete="off" placeholder="최대 8자" value="${esc(D.name)}"></label>
          <div class="uv-x2"><label class="uv-xf"><span>나이 (만 19세 이상)</span><input id="xf-age" type="number" min="19" max="60" inputmode="numeric" placeholder="20"></label>
          <label class="uv-xf"><span>지원동기</span><select id="xf-why">${opt(EXD.whys || [], D.why)}</select></label></div>
          <div class="uv-x2"><label class="uv-xf"><span>특기</span><input id="xf-skill" maxlength="20" autocomplete="off" placeholder="예: 요리, 달리기"></label>
          <label class="uv-xf"><span>취미</span><input id="xf-hobby" maxlength="20" autocomplete="off" placeholder="예: 영화, 게임"></label></div>
          <div class="uv-xf"><span>성격 키워드 (최대 2개)</span><div class="uv-xchips" id="xf-trait">${(EXD.traits || []).map(t => `<button type="button" class="uv-xchip">${esc(t)}</button>`).join('')}</div></div>
          <label class="uv-xf"><span>한 줄 자기소개</span><input id="xf-intro" maxlength="60" placeholder="60자 이내" autocomplete="off"></label>
          <div class="uv-x2"><div class="uv-xf"><span>체력 자신감</span><div class="uv-xstars" data-k="selfP"></div></div><div class="uv-xf"><span>이론 자신감</span><div class="uv-xstars" data-k="selfK"></div></div></div>
          <p class="uv-xnote">자신감은 별 1~5개. 실제 결과와 차이가 크면 정직도에서 감점돼요.</p>
          <div class="uv-xerr" id="uv-xerr"></div><button class="uv-xbtn wide" type="submit">서류 제출</button></form>`);
        const sel = new Set(D.traits);
        $('#uv-exam').querySelectorAll('#xf-trait .uv-xchip').forEach(b => { b.onclick = () => { const t = b.textContent; if (sel.has(t)) { sel.delete(t); b.classList.remove('on'); } else { if (sel.size >= 2) { xq('#uv-xerr').textContent = '성격 키워드는 2개까지 고를 수 있어요.'; return; } sel.add(t); b.classList.add('on'); } }; });
        $('#uv-exam').querySelectorAll('.uv-xstars').forEach(st => { const k = st.dataset.k; const draw = () => { st.innerHTML = [1, 2, 3, 4, 5].map(i => `<button type="button" class="${i <= D[k] ? 'on' : ''}" data-v="${i}" aria-label="${i}점">★</button>`).join(''); st.querySelectorAll('button').forEach(b => { b.onclick = () => { D[k] = +b.dataset.v; draw(); }; }); }; draw(); });
        xq('#uv-xfm').onsubmit = (e) => {
          e.preventDefault();
          const n = xq('#xf-name').value.replace(/[<>&"'`]/g, '').trim(), a = +xq('#xf-age').value, er = xq('#uv-xerr');
          if (!n) { er.textContent = '이름을 적어 주세요.'; return; }
          if (!(a >= 19 && a <= 60)) { er.textContent = '나이는 만 19세 이상 60세 이하로 적어 주세요.'; return; }
          Object.assign(D, { name: n, age: a, why: xq('#xf-why').value, skill: xq('#xf-skill').value.trim(), hobby: xq('#xf-hobby').value.trim(), traits: [...sel], intro: xq('#xf-intro').value.trim() });
          alive(run); res();
        };
      });
    }
    function exTap(run) {
      alive(run);
      return new Promise(res => {
        xpanel(`<div class="uv-xkick">신체검사 1/2</div><h2>체력 테스트</h2><p class="uv-xsub">첫 탭부터 6초 동안 버튼을 최대한 빠르게 누르세요. 키보드는 스페이스바.</p>
          <button class="uv-xtap" id="uv-tapb" style="--p:0"><span id="uv-tapn">0</span><small>TAP</small></button><div class="uv-xsub" id="uv-tapt">탭하면 시작해요</div>`, 'center');
        let n = 0, t0 = 0, iv = null, over = false;
        const b = xq('#uv-tapb');
        const hit = () => { if (over) return; if (!t0) { t0 = performance.now(); iv = setInterval(tick, 40); } n++; xq('#uv-tapn').textContent = n; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
        const tick = () => { if (!b.isConnected) { clearInterval(iv); return; } const e = performance.now() - t0; b.style.setProperty('--p', Math.min(1, e / 6000)); xq('#uv-tapt').textContent = Math.max(0, 6 - e / 1000).toFixed(1) + '초'; if (e >= 6000) { over = true; clearInterval(iv); X.hook = null; b.disabled = true; xq('#uv-tapt').textContent = '종료, ' + n + '회'; setTimeout(() => res(n), 900); } };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
        X.hook = hit;
      });
    }
    async function exTiming(run) {
      const sp = [0.8, 1.05, 1.3], sc = [];
      for (let r = 0; r < 3; r++) {
        alive(run);
        const zl = 0.12 + Math.random() * 0.6, zw = 0.16, zc = zl + zw / 2;
        xpanel(`<div class="uv-xkick">신체검사 2/2 · ${r + 1}/3</div><h2>순발력 테스트</h2><p class="uv-xsub">움직이는 막대가 초록 구간 안에 있을 때 멈추세요.</p>
          <div class="uv-xtrack"><div class="uv-xzone" style="left:${zl * 100}%;width:${zw * 100}%"></div><div class="uv-xmk" id="uv-mk"></div></div><button class="uv-xbtn" id="uv-stop">STOP</button><div class="uv-xsub" id="uv-tr" style="margin-top:12px;min-height:24px"></div>`, 'center');
        const mk = xq('#uv-mk'), t0 = performance.now();
        let pos = 0, raf = 0, stopped = false;
        const f = () => { const t = ((performance.now() - t0) / 1000 * sp[r]) % 2; pos = t < 1 ? t : 2 - t; mk.style.left = `calc(${pos * 100}% - ${pos * 8}px)`; if (!stopped && mk.isConnected) raf = requestAnimationFrame(f); };
        f();
        const s = await new Promise(rs => { const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(raf); X.hook = null; const d = Math.abs(pos - zc); rs(d <= zw / 2 ? 100 - d / (zw / 2) * 25 : Math.max(0, 75 - (d - zw / 2) / 0.3 * 75)); }; xq('#uv-stop').onpointerdown = (e) => { e.preventDefault(); stop(); }; X.hook = stop; });
        sc.push(s);
        xq('#uv-tr').textContent = s >= 75 ? '명중! ' + Math.round(s) + '점' : s >= 40 ? '아쉬워요. ' + Math.round(s) + '점' : '빗나갔어요. ' + Math.round(s) + '점';
        await sleep(900);
      }
      return sc.reduce((a, b) => a + b, 0) / 3;
    }
    async function exQuiz(run, list, kick, scoreFn) {
      let total = 0;
      for (let i = 0; i < list.length; i++) {
        alive(run);
        const q = list[i];
        const opts = scoreFn.opts(q);
        xpanel(`<div class="uv-xpbar"><i style="width:${i / list.length * 100}%"></i></div><div class="uv-xkick">${kick} ${i + 1}/${list.length}</div><div class="uv-xq"><h3>${esc(q[0])}</h3>${opts.map((o, k) => `<button class="uv-xopt" data-k="${k}">${esc(o.t)}</button>`).join('')}</div>`);
        const k = await new Promise(r => $('#uv-exam').querySelectorAll('.uv-xopt').forEach(b => { b.onclick = () => r(+b.dataset.k); }));
        alive(run);
        total += opts[k].s;
        $('#uv-exam').querySelectorAll('.uv-xopt').forEach((b, j) => { b.disabled = true; if (scoreFn.show(opts[j], opts[k], j === k)) b.classList.add('ok'); if (j === k && !opts[k].right && scoreFn.mark) b.classList.add('no'); });
        await sleep(650);
      }
      return total;
    }
    async function exSession(run, retest) {
      if (retest) await xsay(run, '양가희', '재검사 신청이 승인되었습니다. 학과장 결재까지 완료되었으니 같은 순서로 다시 진행하겠습니다.');
      X.R = {};
      // 신체
      xhud(1); xbg('lab');
      await xsay(run, '양가희', '첫 검사는 신체검사입니다. 체력을 측정한 뒤 순발력을 확인하겠습니다.');
      const taps = await exTap(run);
      const tapScore = Math.max(15, Math.min(100, (taps - 12) / 28 * 100));
      const tm = await exTiming(run);
      X.R.phys = Math.round(tapScore * 0.6 + tm * 0.4);
      // 이론
      xhud(2); xbg('hall');
      await xsay(run, '양가희', '다음은 이론 기초검사입니다. 성관계 시의 기본 소양에서 다섯 문제가 출제됩니다.');
      const ok = await exQuiz(run, shuffle(EXD.theory || []).slice(0, 5), '이론 기초검사', {
        opts: (q) => shuffle([{ t: q[1], s: 1, right: true }].concat(q[2].map(t => ({ t, s: 0 })))),
        show: (o) => o.right, mark: true
      });
      X.R.know = ok / 5 * 100;
      // 상황
      xhud(3); xbg('assist');
      await xsay(run, '양가희', '이번에는 상황 판단입니다. 실제 상황이라고 생각하고 평소 행동에 가까운 답을 고르십시오.');
      const s = await exQuiz(run, shuffle(EXD.situation || []).slice(0, 5), '상황 판단', {
        opts: (q) => shuffle(q[1].map((t, k) => ({ t, s: q[2][k] }))),
        show: (o, picked, isPick) => isPick
      });
      X.R.sense = s / 10 * 100;
      // 면접
      xhud(4); xbg('lab');
      await xsay(run, '양가희', '마지막은 면접입니다. 질문마다 제한 시간은 8초이며, 시간이 지나면 무응답으로 기록합니다.');
      let ms = 0, to = 0;
      for (const q of EXD.interview || []) {
        await xsay(run, '양가희', q[0]);
        const ord = shuffle([0, 1, 2]);
        const k = await xchoose(run, ord.map(i => q[1][i]), 8);
        if (k < 0) { to++; await xsay(run, '양가희', '시간 초과. 무응답으로 기록합니다.'); continue; }
        ms += q[2][ord[k]];
      }
      X.R.mind = Math.max(0, ms / 6 * 100 - to * 5);
      // 채점
      xbg('board');
      await xsay(run, '양가희', '검사를 종료합니다. 수치를 확인하겠습니다.');
      exGrade();
      xpanel(`<div class="uv-xkick">채점 중</div><h2>${esc(X.P.name)}님의 검사 결과를 집계하고 있어요</h2><div class="uv-xbars">${[['체력', 'phys'], ['이론', 'know'], ['센스', 'sense'], ['멘탈', 'mind'], ['정직도', 'honest']].map(r => `<div><span>${r[0]}</span><i><u data-v="${X.R[r[1]]}"></u></i><b>${X.R[r[1]]}</b></div>`).join('')}</div>`, 'center');
      await sleep(80);
      $('#uv-exam').querySelectorAll('.uv-xbars u').forEach(u => { u.style.width = u.dataset.v + '%'; });
      await sleep(M.prefs.fx ? 2000 : 300);
      alive(run);
      exResult(run);
    }
    function exGrade() {
      const P = X.P, Rr = X.R;
      const d = (self, act) => self > act ? self - act : (act - self) * 0.4;
      const dev = (d(P.selfP * 20, Rr.phys) + d(P.selfK * 20, Rr.know)) / 2;
      Rr.honest = Math.max(10, Math.min(100, 100 - dev * 0.9));
      ['phys', 'know', 'sense', 'mind', 'honest'].forEach(k => { Rr[k] = Math.round(Rr[k]); });
      const total = Rr.phys * 0.2 + Rr.know * 0.25 + Rr.sense * 0.25 + Rr.mind * 0.15 + Rr.honest * 0.15;
      Rr.total = Math.round(total);
      Rr.g = total >= 88 ? 'S' : total >= 75 ? 'A' : total >= 60 ? 'B' : total >= 45 ? 'C' : 'D';
      const m = { phys: '체력', know: '이론', sense: '센스', mind: '멘탈' };
      const ks = Object.keys(m).sort((a, b) => Rr[b] - Rr[a]);
      Rr.type = m[ks[0]]; Rr.weak = m[ks[3]];
      Rr.cm = ((EXD.comment || {})[Rr.g] || '') + (Rr.honest < 55 ? ' 자가평가와 실측 사이의 차이는 감점 처리했습니다.' : '');
      if (!X.sid) X.sid = '2026-' + String(Math.floor(Math.random() * 90000) + 10000);
    }
    function exText() {
      const P = X.P, Rr = X.R, GN = EXD.gradeName || {};
      return ['[입학 검사 결과 | 리온대학교 X스학과]', `이름: ${P.name}`, `나이: ${P.age}세`, `특기: ${P.skill || '없음'}`, `취미: ${P.hobby || '없음'}`, `성격: ${P.traits.join(', ') || '없음'}`, `지원동기: ${P.why}`, `자기소개: ${P.intro || '없음'}`, `학번: ${X.sid}`, `등급: ${Rr.g} (${GN[Rr.g] || ''})`, `능력치: 체력 ${Rr.phys} / 이론 ${Rr.know} / 센스 ${Rr.sense} / 멘탈 ${Rr.mind} / 정직도 ${Rr.honest}`, `유형: ${Rr.type}형 (약점: ${Rr.weak})`, `담당관 코멘트: "${Rr.cm}"`].join('\n');
    }
    function exResult(run) {
      const P = X.P, Rr = X.R, GN = EXD.gradeName || {};
      xhud(-1); xmode('result'); xbg('board');
      const left = 1 - X.retries;
      xq('.uv-xui').innerHTML = `<div class="uv-xcert"><div class="uv-xsheet"><div class="uv-xtop"><b>리온대학교</b><small>RION UNIVERSITY</small></div>
        <h2>합격 통지서</h2><div class="uv-xids"><span>학번 <b>${esc(X.sid)}</b></span><span>모집단위 <b>X스학과</b></span></div><div class="uv-xpass">합격</div>
        <p class="uv-xbody"><strong>${esc(P.name)}</strong> (${P.age}세) 님은 2026학년도 X스학과 신입생 신체 X스 적격도 검사 결과 아래와 같이 합격하였으므로 이를 통지합니다.</p>
        <div class="uv-xgbox"><div class="uv-xgc"><b>${Rr.g}</b><small>GRADE</small></div><div><h3>${esc(GN[Rr.g] || '')}</h3><p>${Rr.type}형 · 약점 ${Rr.weak}<br>종합 ${Rr.total}점 / 100</p></div></div>
        <div class="uv-xbars light">${[['체력', 'phys'], ['이론', 'know'], ['센스', 'sense'], ['멘탈', 'mind'], ['정직도', 'honest']].map(r => `<div><span>${r[0]}</span><i><u data-v="${Rr[r[1]]}"></u></i><b>${Rr[r[1]]}</b></div>`).join('')}</div>
        <div class="uv-xcm">“${esc(Rr.cm)}”<small>검사 담당관 양가희 · 보건소장</small></div>
        <div class="uv-xsign">리온대학교 총장 남궁현<i class="uv-xstamp">직인</i></div></div>
        <div class="uv-xacts"><button class="uv-xbtn wide" data-x="submit">결과서 제출 (입력칸에 채우기)</button>
          <button class="uv-xbtn gh" data-x="re" ${left <= 0 ? 'disabled' : ''}>재검사 신청 (${Math.max(0, left)}회 남음)</button>
          <p class="uv-xnote">입력칸에 채운 뒤 <b>보내기</b>를 누르면 양가희 검사관이 등급을 배정해요.</p></div></div>`;
      setTimeout(() => $('#uv-exam').querySelectorAll('.uv-xbars u').forEach(u => { u.style.width = u.dataset.v + '%'; }), 300);
      xq('[data-x=submit]').onclick = () => submitExam(exText());
      xq('[data-x=re]').onclick = () => { if (X.retries >= 1) return; X.retries++; xq('.uv-xui').innerHTML = ''; exSession(run, true).catch(e => { if (e && e.message !== 'stop') console.error(e); }); };
    }
    function submitExam(text) {
      M.prefs.lastExam = text;
      const r = U.parseExam(text);
      if (r) M.exam = r;
      save(); exClose(); renderHud(); renderPhone();
      fill(text);
      toast('결과서를 입력칸에 채웠어요. 보내기를 눌러 제출하세요');
    }

    // ---------- 입력칸 ----------
    function autosize() { const ta = $('#uv-in'); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
    function fill(text) {
      const ta = $('#uv-in');
      ta.value = text; ta.focus(); ta.setSelectionRange(text.length, text.length); autosize();
      ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
      if (portrait() && R.phone === 'open') { R.phone = 'closed'; renderPhone(); }
    }
    function doSend() {
      const ta = $('#uv-in');
      const text = ta.value.trim();
      if (!text || R.waiting) return;
      if (R.mode !== 'play' || R.away || R.page !== 'chat') { toast(R.away ? '이 세이브의 대화로 돌아온 뒤에 보낼 수 있어요' : '대화 화면이 열린 뒤에 보낼 수 있어요'); return; }
      R.waiting = true; R.sentAt = Date.now();
      const ex = U.parseExam(text);
      if (ex) { M.exam = ex; M.prefs.lastExam = text; }
      M.lines.push({ w: (M.status && M.status.week) || 0, who: me(), t: text, me: true });
      const km = text.match(/^\(가가오톡으로 (.+?)에(?:게)? 답장\)\s*"?(.*?)"?$/);
      if (km && M.kakao[km[1]]) { M.kakao[km[1]].push({ who: me(), t: km[2], me: true, at: Date.now() }); M.kakaoRead[km[1]] = M.kakao[km[1]].length; }
      save();
      o.send(text);
      ta.value = ''; autosize();
      waitingUi(true);
    }

    // ---------- 응답 대기: 폰 '입력 중…' + 팁 ----------
    const TIPS = Array.isArray(data.tips) && data.tips.length ? data.tips : ['위쪽 「크랙 화면」 버튼으로 언제든 원래 크랙 화면을 볼 수 있어요.'];
    let tipI = Math.floor(Math.random() * TIPS.length), tipT = null;
    function waitingUi(on, preview) {
      el.classList.toggle('uv-wait', !!on);
      clearInterval(tipT);
      if (!on) return;
      const d = $('#uv-dlg');
      d.className = 'uv-dlg k-wait';
      d.innerHTML = `<div class="uv-typing"><span><i></i><i></i><i></i></span><b>이야기가 이어지는 중이에요</b></div><div class="uv-tip">🌸 ${esc(TIPS[tipI % TIPS.length])}</div>${preview ? `<small class="uv-stream">${esc(preview.slice(-140))}</small>` : ''}`;
      tipT = setInterval(() => { tipI++; const t = el.querySelector('.uv-tip'); if (t) t.textContent = '🌸 ' + TIPS[tipI % TIPS.length]; else clearInterval(tipT); }, 5000);
    }
    const waitT = setInterval(() => { if (R.waiting && Date.now() - R.sentAt > 45000) banner('slow'); }, 5000);

    // ---------- 안내 띠 (안전지대 팩과 같은 경우들) ----------
    function banner(kind) {
      const b = $('#uv-banner');
      if (!kind) { b.hidden = true; b.innerHTML = ''; b.className = 'uv-banner'; return; }
      const row = (btns) => `<div class="uv-brow">${btns}</div>`;
      const std = '<button class="uv-fb" data-uv="crack">크랙 화면 보기</button><button class="uv-fb" data-uv="title">처음 화면</button><button class="uv-fb" data-uv="diag">화면 진단 복사</button>';
      b.hidden = false; b.className = 'uv-banner center';
      if (kind === 'other') b.innerHTML = `<div class="uv-gate"><b>세이브의 대화가 열리지 않았어요</b><span>크랙에서 대화가 지워졌거나 로그인이 풀렸을 수 있어요.</span>${row('<button class="uv-fb primary" data-uv="back-save">다시 열기</button>' + std)}</div>`;
      else if (kind === 'mode') {
        const ms = (R.actions || []).filter(a => a.kind === 'mode');
        const picked = R.sm && R.sm.picked;
        b.innerHTML = `<div class="uv-gate"><b>시작 설정을 골라 주세요</b><span>${picked ? `「${esc(picked)}」를 골랐어요. 크랙이 시작하기를 기다리는 중이에요.` : '어떤 설정으로 시작할까요? 고른 것만 크랙에 한 번 눌러 줘요.'}</span>
          <div class="uv-modes">${ms.map(a => `<button class="uv-mode ${picked === a.label ? 'on' : ''}" data-uv="pick-mode" data-id="${a.id}" data-label="${esc(a.label)}">${esc(a.label)}</button>`).join('')}</div>
          ${row('<button class="uv-fb" data-uv="crack-pick">크랙 화면에서 직접 고르기</button><button class="uv-fb" data-uv="title">처음 화면</button><button class="uv-fb" data-uv="diag">화면 진단 복사</button>')}</div>`;
      } else if (kind === 'new') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        const why = R.newFlow && R.newFlow.clicked ? '크랙에서 새 대화가 열리면 바로 시작해요.'
          : (R.page === 'detail' && !acts.length ? '크랙 작품 화면에서 「새로하기」 버튼을 찾지 못했어요. 크랙 화면 보기를 눌러 직접 「새로하기」를 누르면 바로 이어져요.' : '크랙 작품 화면을 여는 중이에요…');
        b.innerHTML = `<div class="uv-gate"><span class="uv-dots3"><i></i><i></i><i></i></span><b>새 대화를 여는 중이에요</b><span>${why}</span>${row(acts.map(a => `<button class="uv-fb primary" data-uv="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + '<button class="uv-fb primary" data-uv="crack-pick">크랙 화면에서 직접 고르기</button>' + std)}</div>`;
      } else if (kind === 'old') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        b.innerHTML = `<div class="uv-gate"><b>크랙이 예전 대화를 열었어요</b><span>처음부터 하려면 새 대화가 필요해요. 「작품 화면에서 새로하기」를 누르면 CRION이 새 대화를 열어요. 예전 대화는 읽지 않아요.</span>${row(acts.map(a => `<button class="uv-fb primary" data-uv="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + `<button class="uv-fb ${acts.length ? '' : 'primary'}" data-uv="retry-new">작품 화면에서 새로하기</button>` + std)}</div>`;
      } else if (kind === 'away') b.innerHTML = `<div class="uv-gate"><b>이 세이브의 대화가 아니에요</b><span>크랙 화면에서 다른 대화로 옮겨 갔어요. 이 대화는 읽지 않아요.</span>${row('<button class="uv-fb primary" data-uv="back-save">세이브 대화로 돌아가기</button>' + std)}</div>`;
      else if (kind === 'slow') { b.className = 'uv-banner'; b.innerHTML = `<span>응답을 아직 못 읽었어요. 크랙에서 답이 왔는지 확인해 보세요.</span><button class="uv-fb" data-uv="crack">크랙 화면 보기</button><button class="uv-fb" data-uv="diag">화면 진단 복사</button><button class="uv-fb" data-uv="unwait">닫기</button>`; }
    }

    // ---------- 겹창 ----------
    function openModal(k, arg) {
      R.modal = k;
      const box = $('#uv-box');
      box.className = 'uv-box';
      if (k === 'lines') {
        const ls = M.lines.slice(-120);
        box.classList.add('wide');
        box.innerHTML = `<button class="uv-x" data-uv="mclose" aria-label="닫기">${ic('x')}</button><h3>지난 대사</h3><div class="uv-lines" data-sk="lines">${ls.length ? ls.map(l => `<p class="${l.me ? 'me' : l.sys ? 'sys' : ''}">${l.who ? `<b>${esc(l.who)}</b>` : ''}<span>${esc(l.t)}</span></p>`).join('') : '<p class="uv-dim">아직 없어요.</p>'}</div><div class="uv-btns"><button class="uv-btn primary" data-uv="mclose">닫기</button></div>`;
        setTimeout(() => { const n = box.querySelector('.uv-lines'); if (n) n.scrollTop = n.scrollHeight; }, 0);
      } else if (k === 'set') {
        const seg = (key, opts) => `<div class="uv-seg">${opts.map(([v, l]) => `<button class="${String(M.prefs[key]) === String(v) ? 'on' : ''}" data-uv="pref" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
        box.innerHTML = `<button class="uv-x" data-uv="mclose" aria-label="닫기">${ic('x')}</button><h3>설정</h3>
          <div class="uv-setrow"><span>글자 속도</span>${seg('speed', [['slow', '느림'], ['normal', '보통'], ['fast', '빠름'], ['instant', '즉시']])}</div>
          <div class="uv-setrow"><span>화면 연출</span>${seg('fx', [[false, '끔'], [true, '켜짐']])}</div>
          <div class="uv-setrow"><span>내 이름</span><span class="uv-dim">${esc(me())}</span></div>
          <p class="uv-dim">게임 화면은 크랙 응답을 읽어 그려요. 크랙 프롬프트·진행은 그대로예요. 호감도·학점 숫자는 크랙 상태창 그대로예요.</p>
          <div class="uv-btns left"><button class="uv-btn" data-uv="exam">입학 검사</button><button class="uv-btn" data-uv="title">처음 화면</button><button class="uv-btn" data-uv="crack">크랙 화면 보기</button><button class="uv-btn" data-uv="diag">화면 진단 복사</button><button class="uv-btn danger" data-uv="pack-off">플레이팩 끄기</button></div>
          <div class="uv-btns"><button class="uv-btn primary" data-uv="mclose">닫기</button></div>`;
      } else if (k === 'exam-ask') {
        box.innerHTML = `<div class="uv-askx"><img src="${esc(packFace('양가희'))}" alt=""><div><b>양가희 검사관</b><p>“결과서를 제출하십시오.”</p></div></div>
          <p>입학 검사를 받아야 내 캐릭터(이름·등급·능력치)가 정해져요. 검사는 앱 안에서 3~5분, 결과서는 입력칸에 채워 드려요.</p>
          <div class="uv-btns col"><button class="uv-btn primary" data-uv="exam">입학 검사 받기</button><button class="uv-btn" data-uv="exam-paste">결과서 붙여 넣기</button><button class="uv-btn ghost" data-uv="mclose">나중에</button></div>`;
      } else if (k === 'aview') {
        const a = (M.album || [])[arg];
        if (!a) return;
        box.classList.add('photo');
        box.innerHTML = `<button class="uv-x" data-uv="mclose" aria-label="닫기">${ic('x')}</button><img src="${esc(a.src)}" alt=""><div class="uv-dim">${esc([a.who, a.place, a.w ? a.w + '주차' : ''].filter(Boolean).join(' · '))}</div>`;
      }
      $('#uv-modal').hidden = false;
    }
    function closeModal() { R.modal = null; $('#uv-modal').hidden = true; $('#uv-box').innerHTML = ''; }

    // ---------- 입력 ----------
    el.addEventListener('click', (e) => {
      // 세로 화면: 열린 폰 밖을 누르면 폰만 접는다
      if (R.phone === 'open' && portrait() && !e.target.closest('#uv-phone') && !e.target.closest('.uv-foot') && !e.target.closest('#uv-modal') && !e.target.closest('.uv-layer:not([hidden])') && !e.target.closest('#uv-banner')) {
        e.stopPropagation(); e.preventDefault(); R.phone = 'closed'; renderPhone(); return;
      }
    }, true);
    el.addEventListener('click', (e) => {
      if (e.target.id === 'uv-modal') { closeModal(); return; }
      const ex = e.target.closest('#uv-exam');
      if (ex && !e.target.closest('button,input,select,textarea,label,.uv-xpaper,.uv-xsheet,.uv-xq')) { if (X.adv) X.adv(); return; }
      const t = e.target.closest('[data-uv]');
      if (!t || !el.contains(t)) { if (e.target.closest('#uv-cine') && !e.target.closest('button')) cineNext(); return; }
      const k = t.dataset.uv;
      switch (k) {
        case 'next': if (!e.target.closest('button')) next(); break;
        case 'send': doSend(); break;
        case 'regen': if (R.waiting) break; o.action('regen'); R.waiting = true; R.sentAt = Date.now(); waitingUi(true); break;
        case 'phone': R.phone = R.phone === 'open' ? 'closed' : 'open'; renderPhone(); break;
        case 'home': R.app = ''; R.sub = null; renderPhone(); break;
        case 'sub-back': R.sub = null; renderPhone(); break;
        case 'app': openApp(t.dataset.k); break;
        case 'kroom': R.sub = t.dataset.k; R.kdraft = ''; renderPhone(); break;
        case 'kfill': { const v = ((el.querySelector('#uv-kin') || {}).value || '').trim(); if (!v) { toast('보낼 말을 적어 주세요'); break; } R.kdraft = ''; fill(`(가가오톡으로 ${R.sub}에게 답장) "${v}"`); toast('입력칸에 채웠어요. 보내기는 직접 눌러 주세요'); break; }
        case 'rpost': R.sub = Number(t.dataset.k); renderPhone(); break;
        case 'hsel': R.sub = t.dataset.k; renderPhone(); break;
        case 'pfill': { const n = t.dataset.n; if (t.dataset.k === 'talk') fill(`${n}에게 다가가 말을 건다.`); else { const room = Object.keys(M.kakao).find(r => roster.resolve(r) === n) || n; R.app = 'kakao'; R.sub = room; if (!M.kakao[room]) M.kakao[room] = []; renderPhone(); } break; }
        case 'enroll': R.sub = 'enroll'; if (!R.enrollPick.length) R.enrollPick = enrolled().slice(); renderPhone(); break;
        case 'epick': { const n = t.dataset.k, c = COURSE(n); if (!c) break; if (R.enrollPick.includes(n)) R.enrollPick = R.enrollPick.filter(x => x !== n); else { const sameT = R.enrollPick.filter(x => (COURSE(x) || {}).t === c.t); if (c.t === '교양' && sameT.length) R.enrollPick = R.enrollPick.filter(x => (COURSE(x) || {}).t !== '교양'); else if (c.t === '전공' && sameT.length >= 4) { toast('전공은 4개까지예요'); break; } R.enrollPick.push(n); } renderPhone(); break; }
        case 'efill': fill(enrollSentence()); toast('입력칸에 채웠어요. 보내기는 직접 눌러 주세요'); break;
        case 'xfill': fill(t.dataset.k); break;
        case 'fill-sc': { const s = (data.shortcuts || {})[t.dataset.k]; if (s) { fill(s); toast(`「${t.dataset.k} 호출」을 채웠어요. 보내기를 누르면 크랙이 ${t.dataset.k} 화면을 넣어 줘요`); } break; }
        case 'aview': openModal('aview', Number(t.dataset.k)); break;
        case 'exam': exOpen(); break;
        case 'exam-paste': exOpen(); setTimeout(() => { const p = xq('[data-x=paste]'); if (p) p.click(); }, 30); break;
        case 'ex-close': exClose(); break;
        case 'open-exam-site': if (o.openExternal && data.examUrl) o.openExternal(data.examUrl); break;
        case 'lines': openModal('lines'); break;
        case 'set': openModal('set'); break;
        case 'mclose': closeModal(); break;
        case 'pref': { const v = t.dataset.v; M.prefs[t.dataset.key] = v === 'true' ? true : v === 'false' ? false : v; save(); uvRoot.classList.toggle('nofx', !M.prefs.fx); openModal('set'); break; }
        case 'cine-skip': cineEnd(); break;
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
        case 'unwait': banner(null); R.waiting = false; waitingUi(false); showBeat(R.i); break;
        case 'pack-off': o.packOff(); break;
      }
    });
    el.addEventListener('input', (e) => {
      if (e.target.id === 'uv-in') autosize();
      if (e.target.id === 'uv-kin') R.kdraft = e.target.value;
    });
    el.addEventListener('keydown', (e) => { if (e.target.id === 'uv-kin' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const b = el.querySelector('[data-uv=kfill]'); if (b) b.click(); } });
    const onKey = (e) => {
      if (!el.isConnected || el.classList.contains('off') || document.querySelector('#layer .scrim')) return;
      if (e.target.id === 'uv-in' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); return; }
      if (/^(TEXTAREA|INPUT|SELECT|WEBVIEW)$/.test(e.target.tagName)) return;
      if (!$('#uv-exam').hidden) { if (e.code === 'Space' && X.hook) { e.preventDefault(); X.hook(); return; } if ((e.key === ' ' || e.key === 'Enter') && X.adv && !e.target.closest('button')) { e.preventDefault(); X.adv(); } return; }
      if (e.key === 'Escape') { if (R.modal) closeModal(); else if (R.app) { R.app = ''; R.sub = null; renderPhone(); } }
      if ((e.key === ' ' || e.key === 'Enter') && !R.modal && !e.target.closest('button')) {
        e.preventDefault();
        if (R.cine) cineNext(); else if ($('#uv-title').hidden) next();
      }
    };
    document.addEventListener('keydown', onKey);
    const onBack = (e) => {
      if (!el.isConnected || el.closest('.off') || document.querySelector('#layer > *')) return;
      const done = () => e.preventDefault();
      if (R.modal) { closeModal(); return done(); }
      if (!$('#uv-exam').hidden) { exClose(); return done(); }
      if (R.cine) { cineEnd(); return done(); }
      if (R.sub != null && R.app) { R.sub = null; renderPhone(); return done(); }
      if (R.app) { R.app = ''; renderPhone(); return done(); }
      if (R.phone === 'open' && portrait()) { R.phone = 'closed'; renderPhone(); return done(); }
      if (R.mode !== 'title' && $('#uv-title').hidden) { showTitle(); return done(); }
    };
    document.addEventListener('crion-back', onBack);

    // ---------- 타이틀 (세이브 고르기) ----------
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.round(m / 60) + '시간 전' : Math.round(m / 1440) + '일 전'; };
    const fmtMs = (ms) => { const m = Math.round((ms || 0) / 60000); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
    const sumText = (sv) => { const s = (sv && sv.sum) || {}; return s.week ? `${s.week}주차${s.day ? ' ' + s.day + '요일' : ''}${s.place ? ' · ' + s.place : ''}` : '입학 당일'; };
    function renderTitle() {
      const box = $('#uv-title');
      const list = saves.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
      const cont = list.find(x => x.url);
      box.innerHTML = `<div class="uv-tbg" style="background-image:${cssUrl(BG('gate'))}"></div><canvas class="uv-petals" aria-hidden="true"></canvas><div class="uv-tvig"></div>
        <div class="uv-tcopy"><div class="uv-teye">2026학년도 1학기 · 크랙 플레이팩</div><h1>리온대학교</h1><div class="uv-ten">RION UNIVERSITY · X스학과</div><div class="uv-tsub">인구절벽이 도래한 시대, 이제 성에 관해서 배워야 한다</div></div>
        <div class="uv-tmenu">
          <button class="uv-pl" data-uv="t-new">입학하기 <small>처음부터</small></button>
          ${cont ? `<button class="uv-pl ghost" data-uv="t-cont" data-id="${esc(cont.id)}">이어하기<small>${esc(sumText(cont))}</small></button>` : ''}
          <button class="uv-pl ghost" data-uv="t-set">설정</button>
        </div>
        <div class="uv-saves"><h4>세이브 <em>${list.length}</em></h4>
          ${list.length ? list.map((sv, i) => `<div class="uv-save"><div class="uv-simg" style="background-image:${cssUrl((sv.sum && sv.sum.bg) || BG('cherry'))}"></div>
              <div class="uv-smeta"><b>${esc((sv.sum && sv.sum.me) || '신입생')} · ${esc(sumText(sv))}</b><span>${sv.sum && sv.sum.grade ? sv.sum.grade + '급 · ' : ''}${fmtMs(sv.playMs)} 플레이</span><em>세이브 ${list.length - i} · ${sv.url ? '마지막 ' + ago(sv.last || sv.created) : '대화 연결 전'}</em></div>
              <div class="uv-sbtns">${sv.url ? `<button class="uv-fb primary" data-uv="t-cont" data-id="${esc(sv.id)}">이어하기</button>` : ''}<button class="uv-fb ${R.delAsk === sv.id ? 'danger' : ''}" data-uv="t-del" data-id="${esc(sv.id)}">${R.delAsk === sv.id ? '한 번 더 누르면 삭제' : '지우기'}</button></div></div>`).join('')
            : '<p class="uv-dim">아직 세이브가 없어요. 입학하기는 늘 크랙의 <b>새 대화</b>로 시작해요.</p>'}</div>
        <div class="uv-tfoot">CRION 플레이팩 · 크랙 AI가 진행해요 · 19세 이상</div>`;
      box.hidden = false;
      stopPetals.push(petals(box.querySelector('.uv-petals')));
    }
    function resetScene() {
      R.beats = []; R.i = -1; R.lastKey = ''; R.waiting = false; R.away = false; R.cine = null; R.app = ''; R.sub = null; R.enrollPick = [];
      R.bgKey = ''; el.querySelectorAll('.uv-bgl').forEach(x => { x.style.backgroundImage = ''; x.classList.remove('on'); });
      setBg(M.lastBg || BG('gate'));
      setPortrait('');
      $('#uv-cine').hidden = true; exClose(); closeModal();
      renderHud(); setTint(); renderPhone();
      const d = $('#uv-dlg'); d.className = 'uv-dlg'; d.innerHTML = '';
    }
    const hideTitle = () => { $('#uv-title').hidden = true; };
    function showTitle() { R.mode = 'title'; R.newFlow = null; R.delAsk = null; banner(null); waitingUi(false); renderTitle(); }
    function loading(msg) { const d = $('#uv-dlg'); d.className = 'uv-dlg k-wait'; d.innerHTML = `<div class="uv-typing"><span><i></i><i></i><i></i></span><b>${esc(msg)}</b></div>`; }
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
      o.load(sv.url);
    }
    // 새로하기 뒤 크랙이 띄우는 '시작 설정' 고르기 창 (안전지대 팩과 같은 흐름)
    function startModeStep(st) {
      const sm = R.sm;
      if (!sm || sm.done) return false;
      if (R.mode === 'binding' && !(R.newFlow && R.newFlow.clicked)) return false;
      const acts = st.actions || [];
      const modes = acts.filter(x => x.kind === 'mode');
      const modeBannerOn = !!$('#uv-banner').querySelector('.uv-modes');
      if (!sm.picked) {
        if (modes.length > 1 && !sm.viaCrack) { R.actions = acts; banner('mode'); return true; }
        if (modes.length === 1 && !sm.viaCrack) { sm.picked = modes[0].label; o.click(modes[0].id); return true; }   // 시작 설정이 하나뿐(신입생으로 시작)이면 그걸로
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
        if (o.showPack) o.showPack();
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
    let rz = null;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { renderPhone(); }, 150); };
    root.addEventListener('resize', onResize);

    // 시작
    setBg(BG('gate'));
    renderHud(); renderPhone();
    showTitle();

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
          else if ($('#uv-banner').querySelector('.uv-gate')) banner(null);
        } else if (ch === 'crion:sent' && d) {
          if (!d.ok) { R.waiting = false; waitingUi(false); showBeat(R.i); toast(d.why === 'no-input' ? '크랙 입력창을 찾지 못했어요. 크랙 화면을 확인해 주세요' : '보내지 못했어요'); }
        }
      },
      destroy() { document.removeEventListener('keydown', onKey); document.removeEventListener('crion-back', onBack); root.removeEventListener('resize', onResize); clearInterval(waitT); clearInterval(playT); clearInterval(tipT); clearInterval(typeT); stopPetals.forEach(f => f()); X.run++; save(); },
      demo(segs) { handle(segs); },
      openApp, state: R, memory: M, saves: () => saves
    };
  }

  root.CrionUnivRun = { start };
})(window);
