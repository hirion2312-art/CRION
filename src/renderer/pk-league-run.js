// 플레이팩 실행기 — 「크랙 프로야구 : 6팀 리그」 (runner: "league", 모바일 우선)
//  숫자(경기·기록)는 CrionLeague(pk-league.js)가 정답. 이 파일은 화면: 타이틀·클럽하우스·경기 중계·리그·선수단·이야기(크랙 코드)·커리어
//  크랙 작품이 아직 없어서 지금은 혼자 실행(standalone) — 크랙에 보낼 글은 '복사', 크랙 답은 '붙여넣기'로 주고받는다
(function (root) {
  'use strict';
  const C = root.CrionLeague;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const IC = {
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
    table: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/>',
    team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-4 3-6 6-6s5.5 2 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c2.6.2 4.6 2 5 5.8"/>',
    talk: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    play: '<path d="M7 4l13 8-13 8z"/>', pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z"/>', ff: '<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z"/>',
    next: '<path d="M5 4l11 8-11 8zM18 4h2v16h-2z"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    bat: '<path d="M4 20l3-3"/><path d="M6.5 16.5L18 5a2.1 2.1 0 013 3L9.5 19.5z"/>', ball: '<circle cx="12" cy="12" r="8"/><path d="M7 6c2 3 2 9 0 12M17 6c-2 3-2 9 0 12"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 5l-7 7 7 7"/>', chev: '<path d="M9 5l7 7-7 7"/>', check: '<path d="M5 12l5 5 9-10"/>',
    sign: '<path d="M12 3v18M5 8h14M7 14h10"/>', clip: '<path d="M8 4h8v3H8z"/><rect x="5" y="5" width="14" height="16" rx="2"/>', up: '<path d="M6 15l6-6 6 6"/>', dn: '<path d="M6 9l6 6 6-6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'
  };
  const ic = (k, c) => `<svg class="ic ${c || ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[k] || ''}</svg>`;
  const PRESET = { imm: { name: '몰입', desc: '이닝마다 · 득점마다 멈춤' }, std: { name: '표준', desc: '역전·동점·결정 순간에 멈춤' }, fast: { name: '빠름', desc: '경기 끝날 때만' }, man: { name: '수동', desc: '내가 누를 때만' } };
  const SPEED = { res: '결과만', hl: '하이라이트', all: '전 타석' };
  const RESTXT = { K: '삼진', BB: '볼넷', IBB: '고의4구', HR: '홈런', '3B': '3루타', '2B': '2루타', '1B': '안타', E: '실책', OUT: '아웃', BUNT: '번트', CS3: '도루 실패' };

  function start(o) {
    const data = o.data || {};
    const X = C.index(data);
    const PK_ID = (o.pack && o.pack.id) || (o.manifest && o.manifest.id) || 'hirion.baseball-proto';
    const solo = !!(o.manifest && o.manifest.standalone) || !(o.work && o.work.url);
    const KEY = 'crion.pk.' + PK_ID + '.';
    const ls = { get: (k, d) => { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(KEY + k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del: (k) => { try { localStorage.removeItem(KEY + k); } catch (e) { /* 없음 */ } } };
    const prefs = Object.assign({ preset: 'std', speed: 'hl', limit: 1000 }, ls.get('prefs', {}));
    o.el.innerHTML = '';
    const el = document.createElement('div'); el.className = 'lg'; o.el.appendChild(el);
    const R = { view: 'home', L: null, G: null, sid: null, auto: false, busy: false, timer: 0, sheet: null, dp: null, pendingOrd: null, stopAsk: null, dpNext: null, sub: {}, pasted: null, tickN: 0 };
    let dead = false;
    const T = (id) => X.T[id] || { city: id, color: '#333', color2: '#999' };
    const P = (id) => C.pl(X, R.L, id) || { name: '?', b: {}, emo: [] };
    const myT = () => T(R.L ? R.L.my : 'SEO');

    // ---------- 그림 조각 ----------
    function badge(tid, cls) {
      const t = T(tid);
      return `<svg class="lg-badge ${cls || ''}" viewBox="0 0 40 46" aria-label="${esc(t.city)}"><path d="M20 1.5L38 7.5V22c0 12-8 19.5-18 22.5C10 41.5 2 34 2 22V7.5z" fill="${t.color}"/><path d="M2 30.5L38 18.5V24L2 36z" fill="${t.color2}" opacity=".95"/><text x="20" y="26" text-anchor="middle" font-size="17" fill="#fff" class="lg-bt">${esc(t.city[0])}</text></svg>`;
    }
    function silo(p, cls) {
      const t = T(p.team), w = (p.gender || t.gender) === 'W';
      return `<svg class="lg-silo ${cls || ''}" viewBox="0 0 120 140" aria-hidden="true">
        <rect width="120" height="140" fill="${t.color}" opacity=".12"/>
        ${w ? `<path d="M76 38c14 6 16 30 6 44-3-12-6-24-6-44z" fill="#2a2430"/>` : ''}
        <path d="M14 140c2-34 20-50 46-50s44 16 46 50z" fill="${t.color}"/>
        <path d="M44 92l16 18 16-18" fill="none" stroke="${t.color2}" stroke-width="4"/>
        <circle cx="60" cy="52" r="21" fill="#e9d6c8"/>
        <path d="M38 48c0-16 10-24 22-24s22 8 22 24z" fill="${t.color}"/><path d="M60 42h30a4 4 0 010 8H60z" fill="${t.color}"/>
        <text x="60" y="130" text-anchor="middle" class="lg-sn" fill="#fff">${esc(p.num == null ? '' : p.num)}</text></svg>`;
    }
    const posKo = (k) => C.POSKO[k] || k;
    const condDot = (id) => { const c = R.L.cond[id] != null ? R.L.cond[id] : 2; return `<i class="lg-cd c${c}" title="${C.COND[c]}"></i>`; };
    const rate = (v) => { v = Math.round(v); return `<b class="lg-rt ${v >= 80 ? 'a' : v >= 65 ? 'b' : v >= 50 ? 'c' : 'd'}">${v}</b>`; };
    const avgS = (b) => b.ab ? C.fmt3(b.h / b.ab) : '-';
    const eraS = (q) => q.outs ? C.era(q).toFixed(2) : '-';
    function toast(t, ms) { const e = el.querySelector('.lg-toast'); if (!e) return; e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), ms || 2200); }

    // ---------- 세이브 ----------
    const saves = () => ls.get('saves', []);
    let saveT = 0;
    function save(now) {
      if (!R.L || !R.sid) return;
      const go = () => {
        R.L.live = R.G && !R.G.over ? R.G : null;
        const ok = ls.set('s.' + R.sid, R.L);
        const row = standRow();
        const list = saves().filter(s => s.id !== R.sid);
        list.unshift({ id: R.sid, team: R.L.my, mode: R.L.mode, me: R.L.me ? R.L.me.name : '', at: Date.now(), label: `${myT().city} ${myT().nick} · ${statusShort()}`, rec: row ? `${row.w}승 ${row.l}패` : '' });
        for (const d of list.slice(2)) ls.del('s.' + d.id);   // 한 시즌 ≈ 1MB — 두 칸만 둔다
        ls.set('saves', list.slice(0, 2));
        if (!ok) toast('저장 공간이 부족해요. 오래된 시즌을 지워 주세요', 3500);
      };
      clearTimeout(saveT); if (now) go(); else saveT = setTimeout(go, 400);
    }
    function load(sid) {
      const L = ls.get('s.' + sid, null); if (!L) { toast('세이브를 열지 못했어요'); return false; }
      R.L = L; R.sid = sid; R.G = L.live || null; delete L.live;
      prefs.limit = L.prefs.limit || prefs.limit; L.prefs.limit = prefs.limit;
      return true;
    }
    const standRow = () => R.L ? C.standings(X, R.L).find(r => r.id === R.L.my) : null;
    function statusShort() {
      const L = R.L; if (!L) return '';
      if (L.champion) return `시즌 종료 · 우승 ${T(L.champion).city}`;
      const g = curGame(); if (!g) return '정규시즌 종료';
      return g.post ? `${g.post === 'ks' ? '한국시리즈' : '플레이오프'} ${g.gn}차전` : `${C.weekLabel(L, g.si)} · 시리즈 ${g.si + 1}/${L.seriesN}`;
    }
    const curGame = () => { const L = R.L; if (!L) return null; const g = C.nextGame(L); if (g) return g; if (!C.regDone(L)) return null; const pg = C.nextPostGame(L); return pg && (pg.home === L.my || pg.away === L.my) ? pg : null; };

    // ---------- 뼈대 ----------
    function shell() {
      el.innerHTML = `
        <header class="lg-top"></header>
        <main class="lg-main" id="lg-main"></main>
        <nav class="lg-tabs" id="lg-tabs"></nav>
        <section class="lg-game" id="lg-game" hidden></section>
        <section class="lg-dp" id="lg-dp" hidden></section>
        <div class="lg-sheet" id="lg-sheet" hidden></div>
        <div class="lg-title" id="lg-title" hidden></div>
        <div class="lg-toast" role="status"></div>`;
    }
    shell();
    const $ = (s) => el.querySelector(s);
    function paintTeam() { const t = myT(); el.style.setProperty('--tc', t.color); el.style.setProperty('--tc2', t.color2); }
    const TABS = () => [['home', '클럽하우스', 'home'], ['league', '리그', 'table'], ['team', '선수단', 'team'], ['story', '이야기', 'talk']].concat(R.L && R.L.mode === 'career' ? [['career', '커리어', 'star']] : []);
    function render() {
      if (dead) return;
      if (!R.L) { renderTitle(); return; }
      $('#lg-title').hidden = true;
      paintTeam();
      const row = standRow() || {};
      const out = (R.L.outbox || []).filter(x => !x.done).length;
      $('.lg-top').innerHTML = `${badge(R.L.my, 'sm')}<div class="lg-tt"><b>${esc(myT().city)} ${esc(myT().nick)}</b><span>${esc(statusShort())}</span></div>
        <span class="lg-rec"><b>${row.rank || '-'}</b>위 <i>${row.w || 0}-${row.l || 0}${row.d ? '-' + row.d : ''}</i></span>
        <nav class="lg-ptabs">${TABS().map(([k, n]) => `<button data-a="tab" data-k="${k}" class="${R.view === k ? 'on' : ''}">${n}${k === 'story' && out ? `<em>${out}</em>` : ''}</button>`).join('')}</nav>
        <button class="lg-ib" data-a="menu" aria-label="메뉴">${ic('more')}</button>`;
      $('#lg-tabs').innerHTML = TABS().map(([k, n, i]) => `<button data-a="tab" data-k="${k}" class="${R.view === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${k === 'story' && out ? '<em></em>' : ''}</button>`).join('');
      const m = $('#lg-main');
      m.innerHTML = R.view === 'league' ? leagueHtml() : R.view === 'team' ? teamHtml() : R.view === 'story' ? storyHtml() : R.view === 'career' ? careerHtml() : R.view === 'gamelog' ? gameLogHtml() : homeHtml();
      m.scrollTop = R.sub.scroll || 0; R.sub.scroll = 0;
    }

    // ---------- 타이틀 ----------
    function renderTitle(step) {
      const t = $('#lg-title'); t.hidden = false;
      el.style.setProperty('--tc', '#e11d48'); el.style.setProperty('--tc2', '#111827');
      step = step || R.sub.tstep || 'menu'; R.sub.tstep = step;
      const sv = saves();
      if (step === 'menu') {
        t.innerHTML = `<div class="tt-bg">${X.teams.map((x, i) => `<i style="--c:${x.color};--d:${i}"></i>`).join('')}</div>
          <div class="tt-in">
            <p class="tt-live"><i></i>LIVE · 2026 시즌</p>
            <h1 class="tt-h"><span>크랙</span><span>프로야구</span></h1>
            <p class="tt-sub">6팀 리그 · 30경기 · 가을야구</p>
            <div class="tt-teams">${X.teams.map(x => badge(x.id)).join('')}</div>
            <p class="tt-desc">경기는 CRION이 진짜 야구처럼 돌리고,<br>덕아웃·라커룸·인터뷰의 이야기는 크랙이 써요.</p>
            <div class="tt-menu">
              <button class="lg-btn primary big" data-a="t-new">새 시즌 시작</button>
              ${sv.map(s => `<button class="tt-save" data-a="t-load" data-id="${esc(s.id)}">${badge(s.team, 'sm')}<span><b>${esc(s.label)}</b><small>${s.mode === 'career' ? `커리어 · ${esc(s.me)}` : '감독'} · ${esc(s.rec || '')} · ${new Date(s.at).toLocaleDateString()}</small></span><i data-a="t-del" data-id="${esc(s.id)}" title="지우기">${ic('x')}</i></button>`).join('')}
              <button class="lg-btn ghost" data-a="t-3d">${ic('bat')}3D 연습장 (타격·투구·홈런 더비)</button>
            </div>
          </div>`;
      } else if (step === 'mode') {
        t.innerHTML = `<div class="tt-step"><button class="lg-ib" data-a="t-back">${ic('back')}</button><h2>어떻게 시즌을 보낼까요?</h2>
          <button class="tt-mode" data-a="t-mode" data-k="manager"><b>감독</b><span>6팀 중 하나를 맡아 라인업·작전·투수 교체를 지휘해요. 원하면 아무 타석이나 직접 치고 던져요.</span></button>
          <button class="tt-mode" data-a="t-mode" data-k="career"><b>커리어</b><span>원하는 포지션의 신인으로 입단해요. 벤치에서 시작해 주전 경쟁 — 내 타석·내 투구만 직접 해요.</span></button></div>`;
      } else if (step === 'team') {
        t.innerHTML = `<div class="tt-step"><button class="lg-ib" data-a="t-back">${ic('back')}</button><h2>${R.sub.mode === 'career' ? '입단할 팀' : '부임할 팀'}</h2>
          <div class="tt-tlist">${X.teams.map(x => { const ace = data.players.find(p => p.team === x.id && p.pos === 'P' && p.named); return `<button class="tt-tm" data-a="t-team" data-k="${x.id}" style="--c:${x.color};--c2:${x.color2}">${badge(x.id)}<span><b>${esc(x.city)} ${esc(x.nick)}</b><small>${x.gender === 'W' ? '여자팀' : '남자팀'} · ${esc(x.style)} · 에이스 ${esc(ace ? ace.name : '')}</small><em>${esc(x.concept)}</em></span></button>`; }).join('')}</div></div>`;
      } else if (step === 'me') {
        const m = R.sub.me = R.sub.me || { name: '', pos: 'SS', from: '고졸', bats: 'R', throws: 'R' };
        const tm = T(R.sub.team);
        t.innerHTML = `<div class="tt-step"><button class="lg-ib" data-a="t-back">${ic('back')}</button><h2>${esc(tm.city)} ${esc(tm.nick)} 10번째 선수</h2>
          <label class="tt-f"><span>이름</span><input id="tt-name" maxlength="8" value="${esc(m.name)}" placeholder="이름"></label>
          <div class="tt-f"><span>포지션</span><div class="lg-seg">${['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map(k => `<button data-a="t-me" data-f="pos" data-v="${k}" class="${m.pos === k ? 'on' : ''}">${posKo(k)}</button>`).join('')}</div></div>
          <p class="tt-rival">${(() => { const r = data.players.find(p => p.team === R.sub.team && p.pos === m.pos && p.named); return r ? `주전 경쟁 상대: <b>${esc(r.name)}</b> — 「${esc(r.label)}」` : ''; })()}</p>
          <div class="tt-f"><span>투타</span><div class="lg-seg">${[['R', 'R', '우투우타'], ['R', 'L', '우투좌타'], ['L', 'L', '좌투좌타'], ['R', 'S', '우투양타']].map(([a, b, n]) => `<button data-a="t-me" data-f="hand" data-v="${a}${b}" class="${m.throws + m.bats === a + b ? 'on' : ''}">${n}</button>`).join('')}</div></div>
          <div class="tt-f"><span>출신</span><div class="lg-seg">${[['고졸', '잠재력 높음'], ['대졸', '바로 쓸 만함'], ['육성', '바닥부터 · 잠재력 최고']].map(([k, d]) => `<button data-a="t-me" data-f="from" data-v="${k}" class="${m.from === k ? 'on' : ''}">${k}<small>${d}</small></button>`).join('')}</div></div>
          <button class="lg-btn primary big" data-a="t-go">입단하기</button></div>`;
      }
    }
    function newSeason() {
      const sid = 'v' + Date.now().toString(36);
      const me = R.sub.mode === 'career' ? Object.assign({}, R.sub.me, { gender: T(R.sub.team).gender }) : null;
      R.L = C.newLeague(X, { team: R.sub.team, mode: R.sub.mode, me, prefs: { limit: prefs.limit } });
      R.L.outbox = []; R.L.hints = [];
      R.sid = sid; R.G = null; R.view = 'home'; R.sub = {};
      const g = curGame(); if (g) C.simOthersUntil(X, R.L, g.no);
      pushNews(`${myT().city} ${myT().nick} ${R.L.mode === 'career' ? `신인 ${R.L.me.name} 입단` : '새 감독 부임'}`);
      queueCode('series', seriesTitle(), seriesCode());
      save(true); render();
    }
    function pushNews(text) { R.L.news.unshift({ k: 'note', day: (curGame() || {}).day || 0, text }); R.L.news = R.L.news.slice(0, 40); }

    // ---------- 크랙에 보낼 글 (우체통) ----------
    function queueCode(k, title, text, extra) {
      let box = R.L.outbox = R.L.outbox || [];
      if (k === 'series') box = R.L.outbox = box.filter(x => !(x.k === 'series' && !x.done && !x.mate));
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      box.unshift(Object.assign({ id, k, title, text, at: Date.now(), done: false }, extra || {}));
      R.L.outbox = box.slice(0, 30);
      return box[0];
    }
    function seriesTitle() { const g = curGame(); if (!g) return '시즌'; const opp = g.home === R.L.my ? g.away : g.home; return g.post ? `${g.post === 'ks' ? '한국시리즈' : '플레이오프'} vs ${T(opp).city}` : `시리즈 ${g.si + 1} 예고 · vs ${T(opp).city}`; }
    // 시리즈 예고 (크랙이 시리즈 전 장면을 쓰게)
    function seriesCode() {
      const L = R.L, g = curGame(); if (!g) return C.statusLine(X, L);
      const opp = g.home === L.my ? g.away : g.home;
      const st = C.standings(X, L), me = st.find(r => r.id === L.my), op = st.find(r => r.id === opp);
      const games = g.post ? [g] : L.games.filter(x => x.si === g.si && (x.home === L.my || x.away === L.my));
      const lines = [`⚾시리즈예고 ${g.post ? (g.post === 'ks' ? '한국시리즈' : '플레이오프') : `#${g.si + 1}`} vs ${T(opp).city} ${T(opp).nick}(${g.home === L.my ? '홈' : '원정'})`,
        `[순위] ${T(L.my).city} ${me.rank}위 ${me.w}승${me.l}패 / ${T(opp).city} ${op.rank}위 ${op.w}승${op.l}패`,
        `[상대] ${T(opp).concept} · 에이스 ${(data.players.find(p => p.team === opp && p.pos === 'P' && p.named) || {}).name || ''}`];
      const form = C.roster(X, L, L.my).filter(p => p.named && L.cond[p.id] != null && (L.cond[p.id] >= 4 || L.cond[p.id] <= 0)).map(p => `${p.name} ${C.COND[L.cond[p.id]]}`);
      if (form.length) lines.push(`[컨디션] ${form.slice(0, 4).join(' · ')}`);
      const inj = Object.keys(L.inj).filter(id => L.inj[id] > g.day && P(id).team === L.my).map(id => `${P(id).name}(${L.inj[id] - g.day}일)`);
      if (inj.length) lines.push(`[부상] ${inj.join(' · ')}`);
      const news = L.news.filter(n => n.k === 'arc' || n.k === 'inj').slice(0, 2).map(n => n.text);
      if (news.length) lines.push(`[최근] ${news.join(' · ')}`);
      lines.push(`[상태] ${C.statusLine(X, L, games[0])}`);
      lines.push('[요청] 시리즈 전 장면(덕아웃·훈련·이동) → 끝에 【CRION】 scene=pregame');
      return lines.join('\n');
    }
    function deliver(item) {
      if (!item) return;
      if (solo || !o.send) { if (o.copy) o.copy(item.text); else { try { navigator.clipboard.writeText(item.text); } catch (e) { /* 못 함 */ } toast('복사했어요 — 크랙 대화창에 붙여 넣어 보내 주세요', 2600); } }
      else { o.send(item.text); toast('크랙으로 보냈어요'); }
      item.done = true; save();
    }

    // ---------- 클럽하우스 ----------
    function homeHtml() {
      const L = R.L, g = curGame();
      let next = '';
      if (R.G && !R.G.over) next = `<section class="lg-next live"><p class="lg-k"><i class="lg-live"></i>경기 중</p><div class="lg-vs">${badge(R.G.away)}<b>${R.G.score[0]}</b><span>${R.G.inn}회${C.half2(R.G.half)}</span><b>${R.G.score[1]}</b>${badge(R.G.home)}</div><button class="lg-btn primary big" data-a="resume">경기로 돌아가기</button></section>`;
      else if (g) {
        const opp = g.home === L.my ? g.away : g.home, o2 = T(opp);
        const sp = [C.pl(X, L, probableSP(L.my, g.day)), C.pl(X, L, probableSP(opp, g.day))];
        const ser = g.post ? L.post[g.post] : null;
        const sg = g.post ? null : L.games.filter(x => x.si === g.si && (x.home === L.my || x.away === L.my));
        next = `<section class="lg-next" style="--oc:${o2.color}">
          <p class="lg-k">${g.post ? `${g.post === 'ks' ? '한국시리즈' : '플레이오프'} ${g.gn}차전 · ${ser.a === L.my ? ser.w[0] : ser.w[1]}승 ${ser.a === L.my ? ser.w[1] : ser.w[0]}패` : `${C.weekLabel(L, g.si)} · 시리즈 ${g.si + 1}/${L.seriesN} · ${g.gi + 1}차전`}</p>
          <div class="lg-vs">${badge(g.away)}<div><b>${esc(T(g.away).city)}</b><small>원정</small></div><span>VS</span><div><b>${esc(T(g.home).city)}</b><small>홈</small></div>${badge(g.home)}</div>
          ${sg ? `<div class="lg-sdots">${sg.map(x => x.st === 'done' ? `<i class="${(x.home === L.my ? x.score[1] > x.score[0] : x.score[0] > x.score[1]) ? 'w' : (x.score[0] === x.score[1] ? 'd' : 'l')}">${x.home === L.my ? x.score[1] + '-' + x.score[0] : x.score[0] + '-' + x.score[1]}</i>` : `<i class="${x.no === g.no ? 'now' : ''}">${x.gi + 1}</i>`).join('')}</div>` : ''}
          <div class="lg-sps">${sp.map((p, i) => p ? `<div><small>${i ? esc(o2.city) : esc(myT().city)} 선발</small><b>${esc(p.name)}</b><span>${eraS(C.statOf(L, p.id, 'pit'))} · ${C.statOf(L, p.id, 'pit').w}승</span></div>` : '').join('<i>vs</i>')}</div>
          <div class="lg-row"><button class="lg-btn primary big" data-a="pregame">경기 준비</button><button class="lg-btn ghost" data-a="quick" title="결과만 보고 넘기기">${ic('ff')}결과만</button></div>
        </section>`;
      } else if (C.regDone(L) && !L.post) next = `<section class="lg-next"><p class="lg-k">정규시즌 끝</p><h3>${standRow().rank <= 3 ? '가을야구 진출!' : '가을야구 탈락'}</h3><button class="lg-btn primary big" data-a="post">포스트시즌으로</button></section>`;
      else if (L.post && !L.post.done) next = `<section class="lg-next"><p class="lg-k">포스트시즌</p><h3>${esc(postTxt())}</h3><button class="lg-btn primary big" data-a="post-sim">남은 경기 보기</button></section>`;
      else if (L.champion) next = `<section class="lg-next champ" style="--oc:${T(L.champion).color}"><p class="lg-k">시즌 종료</p>${badge(L.champion, 'xl')}<h3>${esc(T(L.champion).city)} ${esc(T(L.champion).nick)} 우승</h3><p>${L.champion === L.my ? '우승 반지를 끼었어요.' : '다음 시즌을 기약해요.'}</p></section>`;
      const box = (L.outbox || []).filter(x => !x.done);
      const outCard = box.length ? `<section class="lg-card lg-out"><header><b>크랙에 보낼 글</b><span>${box.length}개</span></header>${box.slice(0, 2).map(x => `<div class="lg-ob"><span><b>${esc(x.title)}</b><small>${esc(x.text.split('\n')[0])}</small></span><button class="lg-btn sm primary" data-a="deliver" data-id="${x.id}">${solo ? ic('copy') + '복사' : '보내기'}</button></div>`).join('')}<button class="lg-link" data-a="tab" data-k="story">이야기 탭에서 보기 ${ic('chev')}</button></section>` : '';
      const st = C.standings(X, L);
      const mini = `<section class="lg-card"><header><b>순위</b><button class="lg-link" data-a="tab" data-k="league">전체 ${ic('chev')}</button></header><ol class="lg-mst">${st.map(r => `<li class="${r.id === L.my ? 'me' : ''}"><em>${r.rank}</em>${badge(r.id, 'xs')}<b>${esc(T(r.id).city)}</b><span>${r.w}-${r.l}${r.d ? '-' + r.d : ''}</span><small>${r.gb ? r.gb : '-'}</small></li>`).join('')}</ol></section>`;
      const team = C.roster(X, L, L.my).filter(p => p.named);
      const cond = `<section class="lg-card"><header><b>오늘 컨디션</b><span class="lg-legend">${C.COND.map((c, i) => `<i class="lg-cd c${i}"></i>${c}`).join(' ')}</span></header><div class="lg-conds">${team.map(p => `<span class="${L.inj[p.id] > ((g || {}).day || 0) ? 'inj' : ''}">${condDot(p.id)}${esc(p.name)}<small>${posKo(p.pos)}</small></span>`).join('')}</div></section>`;
      const news = `<section class="lg-card"><header><b>소식</b></header><ul class="lg-news">${L.news.slice(0, 6).map(n => `<li class="k-${n.k}">${esc(n.text)}</li>`).join('') || '<li>아직 소식이 없어요</li>'}</ul></section>`;
      const recent = L.games.filter(x => x.st === 'done' && (x.home === L.my || x.away === L.my)).slice(-5).reverse();
      const rc = recent.length ? `<section class="lg-card"><header><b>최근 경기</b></header><ul class="lg-recent">${recent.map(x => { const me = x.home === L.my ? 1 : 0; const w = x.score[me] > x.score[1 - me] ? 'w' : x.score[me] < x.score[1 - me] ? 'l' : 'd'; return `<li><button data-a="glog" data-no="${x.no}"><i class="${w}">${w === 'w' ? '승' : w === 'l' ? '패' : '무'}</i><span>vs ${esc(T(me ? x.away : x.home).city)}</span><b>${x.score[me]}-${x.score[1 - me]}</b>${ic('chev')}</button></li>`; }).join('')}</ul></section>` : '';
      return `<div class="lg-home">${next}${outCard}<div class="lg-grid">${mini}${cond}${rc}${news}</div></div>`;
    }
    function postTxt() { const P2 = R.L.post; if (!P2) return ''; const r = P2.ks || P2.po; return `${P2.ks ? '한국시리즈' : '플레이오프'} ${T(r.a).city} ${r.w[0]} : ${r.w[1]} ${T(r.b).city}`; }
    function probableSP(tid, day) { const ps = C.roster(X, R.L, tid).filter(p => p.pos === 'P' && p.role === 'SP' && !(R.L.inj[p.id] > day)); ps.sort((a, b) => (b.p.velo * 0.5 + b.p.ctrl * 0.3 + b.p.brk * 0.2) - (a.p.velo * 0.5 + a.p.ctrl * 0.3 + a.p.brk * 0.2)); const ok = ps.filter(p => { const f = R.L.fat[p.id]; return !f || day - f.day >= 4; }); return (ok[0] || ps[0] || {}).id; }

    // ---------- 리그 ----------
    function leagueHtml() {
      const L = R.L, k = R.sub.lk || 'st';
      const tabs = `<div class="lg-seg wide">${[['st', '순위'], ['sch', '일정'], ['lead', '개인 기록']].map(([a, b]) => `<button data-a="lk" data-k="${a}" class="${k === a ? 'on' : ''}">${b}</button>`).join('')}</div>`;
      let body = '';
      if (k === 'st') {
        const st = C.standings(X, L);
        body = `<table class="lg-tbl"><thead><tr><th>순위</th><th class="l">팀</th><th>승</th><th>패</th><th>무</th><th>승률</th><th>차</th><th>득/실</th><th>연속</th></tr></thead><tbody>${st.map(r => `<tr class="${r.id === L.my ? 'me' : ''}${r.rank === 3 ? ' cut' : ''}"><td>${r.rank}</td><td class="l">${badge(r.id, 'xs')}${esc(T(r.id).city)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.d}</td><td>${C.fmt3(r.pct)}</td><td>${r.gb || '-'}</td><td>${r.rs}/${r.ra}</td><td>${r.streak ? (r.streak > 0 ? r.streak + '승' : -r.streak + '패') : '-'}</td></tr>`).join('')}</tbody></table><p class="lg-note">3위까지 가을야구 — 2위 vs 3위 플레이오프(3전 2선승) → 1위와 한국시리즈(5전 3선승)</p>
          ${L.post ? `<section class="lg-card"><header><b>포스트시즌</b></header><p>${esc(postTxt())}${L.champion ? ` · 우승 ${esc(T(L.champion).city)}` : ''}</p></section>` : ''}`;
      } else if (k === 'sch') {
        body = L.schedule.map((ms, si) => `<section class="lg-card lg-ser"><header><b>${C.weekLabel(L, si)}</b><span>시리즈 ${si + 1}</span></header>${ms.map(m => { const gs = L.games.filter(x => x.si === si && x.home === m.home && x.away === m.away); return `<div class="lg-sm ${m.home === L.my || m.away === L.my ? 'me' : ''}">${badge(m.away, 'xs')}<b>${esc(T(m.away).city)}</b><span>@</span>${badge(m.home, 'xs')}<b>${esc(T(m.home).city)}</b><em>${gs.map(x => x.st === 'done' ? `<button data-a="glog" data-no="${x.no}" ${L.logs[x.no] || x.box ? '' : 'disabled'}>${x.score[0]}-${x.score[1]}</button>` : '<i>·</i>').join('')}</em></div>`; }).join('')}</section>`).join('');
      } else {
        const cats = [['avg', '타율', (v) => C.fmt3(v)], ['hr', '홈런'], ['rbi', '타점'], ['sb', '도루'], ['era', '평균자책', (v) => v.toFixed(2)], ['k', '탈삼진'], ['w', '승'], ['sv', '세이브']];
        body = `<div class="lg-leads">${cats.map(([c, n, f]) => { const ls2 = C.leaders(X, L, c, 5); return `<section class="lg-card"><header><b>${n}</b></header><ol>${ls2.map((r, i) => `<li class="${P(r.id).team === L.my ? 'me' : ''}"><em>${i + 1}</em><button data-a="pl" data-id="${r.id}">${esc(r.name)}</button><small>${esc(T(r.team).city)}</small><b>${f ? f(r.v) : r.v}</b></li>`).join('') || '<li class="lg-empty">아직 기록이 없어요</li>'}</ol></section>`; }).join('')}</div>`;
      }
      return `<div class="lg-pad">${tabs}${body}</div>`;
    }

    // ---------- 선수단 ----------
    function teamHtml() {
      const L = R.L, tid = R.sub.tt || L.my;
      const ps = C.roster(X, L, tid);
      const g = curGame();
      const pick = `<div class="lg-tpick">${X.teams.map(t => `<button data-a="tt" data-k="${t.id}" class="${tid === t.id ? 'on' : ''}">${badge(t.id, 'xs')}${esc(t.city)}</button>`).join('')}</div>`;
      const card = (p) => {
        const s = p.pos === 'P' ? C.statOf(L, p.id, 'pit') : C.statOf(L, p.id, 'bat');
        const line = p.pos === 'P' ? `${s.g}경기 ${s.w}승${s.l}패${s.sv ? ' ' + s.sv + 'S' : ''} · ${eraS(s)}` : `${avgS(s)} · ${s.hr}홈런 ${s.rbi}타점${s.sb ? ' ' + s.sb + '도루' : ''}`;
        const r = p.pos === 'P' ? [['구위', p.p.velo], ['제구', p.p.ctrl], ['변화', p.p.brk]] : [['컨택', p.b.con], ['파워', p.b.pow], ['주루', p.b.spd], ['수비', p.b.defn]];
        return `<button class="lg-pc ${p.named ? '' : 'nn'} ${p.me ? 'me' : ''} ${L.inj[p.id] > ((g || {}).day || 0) ? 'inj' : ''}" data-a="pl" data-id="${p.id}">${silo(p)}<span class="lg-pci"><small>${p.num} · ${posKo(p.pos)}${p.role && p.pos === 'P' ? ` · ${{ SP: '선발', RP: '불펜', CL: '마무리' }[p.role]}` : ''}</small><b>${esc(p.name)}${condDot(p.id)}</b><em>${line}</em><span class="lg-rts">${r.map(([n, v]) => `<i>${n}${rate(v)}</i>`).join('')}</span></span></button>`;
      };
      const field = ps.filter(p => p.pos !== 'P'), pit = ps.filter(p => p.pos === 'P');
      const t = T(tid);
      return `<div class="lg-pad">${pick}<section class="lg-thero" style="--oc:${t.color};--oc2:${t.color2}">${badge(tid, 'xl')}<div><b>${esc(t.city)} ${esc(t.nick)}</b><span>${esc(t.concept)}</span><small>목표 · ${esc(t.goal)}</small></div></section>
        <h4 class="lg-h4">야수</h4><div class="lg-pcs">${field.map(card).join('')}</div><h4 class="lg-h4">투수</h4><div class="lg-pcs">${pit.map(card).join('')}</div></div>`;
    }
    function playerSheet(id) {
      const L = R.L, p = P(id), b = C.statOf(L, id, 'bat'), q = C.statOf(L, id, 'pit');
      const traits = (p.traits || []).map(x => { const d = (data.traits || {})[x[0]] || {}; return `<li><b>${esc(d.name || x[0])}${x[1] != null && x[1] !== true ? ` ${x[1]}` : ''}</b><span>${esc(d.desc || '')}</span></li>`; }).join('');
      const bars = (arr) => arr.map(([n, v]) => `<div class="lg-bar"><span>${n}</span><u><s style="width:${clamp(v, 0, 100)}%"></s></u>${rate(v)}</div>`).join('');
      const rb = [['컨택', p.b.con], ['파워', p.b.pow], ['선구안', p.b.eye], ['주루', p.b.spd], ['수비', p.b.defn], ['송구', p.b.arm]];
      const rp = p.p ? [['구위', p.p.velo], ['제구', p.p.ctrl], ['변화구', p.p.brk], ['체력', p.p.stam], ['위기관리', p.p.cool], ['견제', p.p.hold]] : [];
      openSheet(`<div class="lg-ps" style="--oc:${T(p.team).color}">
        <header>${silo(p, 'big')}<div><small>${esc(T(p.team).city)} · ${p.num} · ${posKo(p.pos)} · ${p.throws === 'L' ? '좌투' : '우투'}${p.bats === 'L' ? '좌타' : p.bats === 'S' ? '양타' : '우타'}${p.age ? ' · ' + p.age + '세' : ''}</small><h3>${esc(p.name)}</h3>${p.label ? `<p>「${esc(p.label)}」</p>` : ''}${p.quote ? `<q>${esc(p.quote)}</q>` : ''}<span class="lg-cond">${condDot(id)} 컨디션 ${C.COND[L.cond[id] != null ? L.cond[id] : 2]}</span></div></header>
        ${p.pos === 'P' ? `<div class="lg-sl">${[['경기', q.g], ['승', q.w], ['패', q.l], ['세이브', q.sv], ['이닝', C.ipStr(q.outs)], ['평균자책', eraS(q)], ['탈삼진', q.k]].map(([a, v]) => `<div><small>${a}</small><b>${v}</b></div>`).join('')}</div>${bars(rp)}<p class="lg-note">구종 · ${esc((p.pitches || []).join(' · '))}</p>` :
          `<div class="lg-sl">${[['타율', avgS(b)], ['안타', b.h], ['홈런', b.hr], ['타점', b.rbi], ['도루', b.sb], ['볼넷', b.bb], ['득점권', b.rab ? C.fmt3(b.rh / b.rab) : '-']].map(([a, v]) => `<div><small>${a}</small><b>${v}</b></div>`).join('')}</div>${bars(rb)}`}
        ${traits ? `<h4 class="lg-h4">특성</h4><ul class="lg-traits">${traits}</ul>` : ''}
        ${p.str ? `<p class="lg-note">강점 · ${esc(p.str)}<br>약점 · ${esc(p.weak)}</p>` : ''}
        ${p.emo && p.emo.length ? `<p class="lg-note">표정 · ${p.emo.map(esc).join(' · ')}</p>` : ''}
      </div>`, 'tall');
    }

    // ---------- 이야기 (크랙과 주고받기) ----------
    function storyHtml() {
      const L = R.L, box = L.outbox || [];
      const pasted = R.pasted;
      const hints = (L.hints || []).filter(h => h.no === (R.G ? R.G.no : -1));
      return `<div class="lg-pad lg-story">
        <section class="lg-card lg-how"><b>크랙과 이렇게 주고받아요</b><ol><li>CRION이 경기 기록을 글로 만들어요 (⚾경기로그 · ⚾중간로그 · ⚾장면)</li><li>${solo ? '복사해서 크랙 대화창에 붙여 넣고 보내요' : '보내기를 누르면 크랙으로 가요'}</li><li>크랙 답을 아래에 붙여 넣으면 작전 지시·선택지를 읽어요</li></ol></section>
        <section class="lg-card"><header><b>크랙 답 붙여넣기</b></header>
          <textarea id="lg-paste" rows="4" placeholder="크랙 답 전체를 붙여 넣어 주세요 (끝의 【CRION】 블록까지)"></textarea>
          <div class="lg-row"><button class="lg-btn primary" data-a="paste">읽기</button></div>
          ${pasted ? pastedHtml(pasted) : ''}
          ${hints.length ? `<p class="lg-note">추천 작전: ${hints.map(h => esc(h.label)).join(' · ')}</p>` : ''}
        </section>
        <h4 class="lg-h4">보낼 글 · 보낸 글</h4>
        <div class="lg-outs">${box.map(x => `<details class="lg-od ${x.done ? 'done' : ''}" ${x === box[0] ? 'open' : ''}><summary><i class="k-${x.k}">${{ game: '경기로그', mid: '중간로그', scene: '장면', series: '시리즈', short: '경기로그' }[x.k] || x.k}</i><b>${esc(x.title)}</b><small>${x.done ? '보냄' : '대기'} · ${x.text.length}자</small></summary><pre>${esc(x.text)}</pre><div class="lg-row"><button class="lg-btn sm ${x.done ? 'ghost' : 'primary'}" data-a="deliver" data-id="${x.id}">${solo ? ic('copy') + '복사' : '보내기'}</button><button class="lg-btn sm ghost" data-a="ob-del" data-id="${x.id}">지우기</button></div></details>`).join('') || '<p class="lg-empty">아직 만든 글이 없어요. 경기를 하면 생겨요.</p>'}</div>
      </div>`;
    }
    function pastedHtml(p) {
      return `<div class="lg-pasted">
        ${p.lines.length ? `<ul class="lg-say">${p.lines.slice(0, 6).map(l => `<li><b>${esc(l.name)}</b><i>${esc(l.emo)}</i><span>${esc(l.text)}</span></li>`).join('')}</ul>` : ''}
        ${p.scene ? `<p class="lg-note">장면 표식: <b>${esc(p.scene)}</b>${p.scene === 'pregame' ? ' → 경기 준비 화면을 열 수 있어요' : p.scene === 'resume' ? ' → 경기 재개 단추가 반짝여요' : ''}</p>` : ''}
        ${p.scene === 'pregame' && curGame() && !R.G ? '<button class="lg-btn primary" data-a="pregame">경기 준비 열기</button>' : ''}
        ${p.choices.length ? `<div class="lg-chips">${p.choices.map(c => `<button data-a="choice" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
        ${p.orders.length ? `<p class="lg-note">작전 지시 ${p.orders.length}개 — 경기 화면에서 확인 후 반영해요</p>` : ''}
        ${!p.block ? '<p class="lg-note">【CRION】 블록이 없어요. 장면만 읽었어요.</p>' : ''}
      </div>`;
    }

    // ---------- 커리어 ----------
    function careerHtml() {
      const L = R.L, me = L.me; if (!me) return '';
      const lad = C.ladderState(X, L);
      const b = C.statOf(L, 'ME', 'bat'), q = C.statOf(L, 'ME', 'pit');
      const rival = data.players.find(p => p.team === me.team && p.pos === me.pos && p.named);
      const plan = R.sub.plan = R.sub.plan || L.career.plan || { train: 2, rest: 1, social: 0, focus: me.pos === 'P' ? 'ctrl' : 'con', mate: rival ? rival.id : null };
      const left = 3 - plan.train - plan.rest - plan.social;
      const g = curGame();
      const focusKeys = me.pos === 'P' ? ['velo', 'ctrl', 'brk', 'stam'] : ['con', 'pow', 'eye', 'spd', 'defn', 'arm'];
      const mates = C.roster(X, L, me.team).filter(p => p.named && !p.me);
      const rr = C.rookieRank(X, L);
      return `<div class="lg-pad lg-car">
        <section class="lg-mecard">${silo(me, 'big')}<div><small>${esc(T(me.team).city)} · ${me.num} · ${posKo(me.pos)} · ${esc(me.from)}</small><h3>${esc(me.name)}</h3><p>${me.pos === 'P' ? `${q.g}경기 ${q.w}승 · 평균자책 ${eraS(q)} · ${q.k}K` : `타율 ${avgS(b)} · ${b.h}안타 ${b.hr}홈런 ${b.rbi}타점`}</p><span>선발 출장 ${L.career.starts}번 · 신인왕 레이스 ${rr}위</span></div></section>
        ${rival ? `<section class="lg-card lg-rival"><header><b>주전 경쟁</b></header><div>${silo(rival)}<span><b>${esc(rival.name)}</b><small>「${esc(rival.label)}」</small><em>${rival.pos === 'P' ? '' : `${avgS(C.statOf(L, rival.id, 'bat'))} · ${C.statOf(L, rival.id, 'bat').hr}홈런`}</em></span><i>종합 ${Math.round(C.ovr(rival))} vs 나 ${Math.round(C.ovr(me))}</i></div></section>` : ''}
        <section class="lg-card"><header><b>목표 사다리</b></header><ol class="lg-ladder">${lad.map(x => `<li class="${x.ok ? 'ok' : ''}">${x.ok ? ic('check') : '<i></i>'}<span>${esc(x.label)}</span></li>`).join('')}</ol></section>
        <section class="lg-card"><header><b>이번 주 일정</b><span>${g ? C.weekLabel(L, g.si || 0) : ''} · 남은 칸 ${left}</span></header>
          ${[['train', '훈련', '능력치 경험치'], ['rest', '휴식', '컨디션 회복'], ['social', '교류', '동료와 시간 (크랙 장면)']].map(([k, n, d]) => `<div class="lg-alloc"><span><b>${n}</b><small>${d}</small></span><button data-a="al" data-k="${k}" data-d="-1">−</button><i>${'●'.repeat(plan[k])}${'○'.repeat(Math.max(0, 3 - plan[k]))}</i><button data-a="al" data-k="${k}" data-d="1" ${left <= 0 ? 'disabled' : ''}>+</button></div>`).join('')}
          ${plan.train ? `<div class="lg-chips">${focusKeys.map(k => `<button data-a="al-f" data-v="${k}" class="${plan.focus === k ? 'on' : ''}">${C.TRAIN[k]}</button>`).join('')}</div>` : ''}
          ${plan.social ? `<div class="lg-chips">${mates.map(p => `<button data-a="al-m" data-v="${p.id}" class="${plan.mate === p.id ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</div>` : ''}
          <button class="lg-btn primary" data-a="al-ok">${L.career.plan ? '일정 바꾸기' : '이번 주 일정 정하기'}</button>
          ${L.career.log.length ? `<ul class="lg-news">${L.career.log.slice(0, 4).map(x => `<li>${esc(C.weekLabel(L, x.si || 0))} · ${esc(x.out.join(' · '))}</li>`).join('')}</ul>` : ''}
        </section></div>`;
    }

    // ---------- 경기 기록 보기 ----------
    function gameLogHtml() {
      const L = R.L, no = R.sub.no; const gm = L.games.find(g => g.no === no) || ((L.post && [].concat(L.post.po.games, (L.post.ks || {}).games || []).find(g => g.no === no)) || null);
      if (!gm) return '<p class="lg-empty">경기를 찾지 못했어요</p>';
      const lg = L.logs[no];
      const my = gm.home === L.my ? 1 : 0;
      const k = R.sub.gk || 'hl';
      const line = lineScore(gm.line, gm.score, gm.hits, gm.errs, [gm.away, gm.home], gm.inn);
      let body = '';
      if (k === 'hl') body = (gm.hl || []).map(r => hlCard(r, gm, true)).join('') || '<p class="lg-empty">명장면이 없어요</p>';
      else if (k === 'box') body = boxHtml(gm);
      else if (k === 'pbp' && lg) body = `<ol class="lg-pbp">${lg.pa.map(r => `<li class="${(r.tags || []).length ? 'hot' : ''}"><small>${r.inn}회${C.half2(r.half)}</small><span><b>${esc(P(r.bat).name)}</b> ${esc(r.desc)}${r.rbi && !/홈런/.test(r.desc) ? ` ${r.rbi}타점` : ''}<i>${r.p.map(C.pitchTxt).map(esc).join(' · ')}</i></span><button data-a="scene" data-no="${no}" data-i="${r.i}" title="이 장면 다시 이야기하기">${ic('talk')}</button></li>`).join('')}</ol>`;
      return `<div class="lg-pad"><button class="lg-link" data-a="tab" data-k="${R.sub.back || 'home'}">${ic('back')} 돌아가기</button>
        <section class="lg-card"><header><b>${gm.post ? (gm.post === 'ks' ? '한국시리즈' : '플레이오프') + ' ' + gm.gn + '차전' : `#${gm.no} · ${C.weekLabel(L, gm.si)}`}</b><span>${esc(T(gm.away).city)} ${gm.score[0]} : ${gm.score[1]} ${esc(T(gm.home).city)}</span></header>${line}${gm.wp ? wpSvg(gm.wp, my) : ''}
          ${gm.res ? `<p class="lg-note">승 ${esc(P(gm.res.W).name || '-')} · 패 ${esc(P(gm.res.L).name || '-')}${gm.res.SV ? ` · 세이브 ${esc(P(gm.res.SV).name)}` : ''}</p>` : ''}</section>
        <div class="lg-seg wide">${[['hl', '명장면'], ['box', '박스스코어'], ['pbp', '문자중계']].filter(x => x[0] !== 'pbp' || lg).map(([a, b]) => `<button data-a="gk" data-k="${a}" class="${k === a ? 'on' : ''}">${b}</button>`).join('')}</div>
        ${body}${lg && gm.home !== undefined && (gm.home === L.my || gm.away === L.my) ? `<button class="lg-btn ghost" data-a="mkcode" data-no="${no}">${ic('talk')}⚾경기로그 다시 만들기</button>` : ''}</div>`;
    }
    function lineScore(line, score, hits, errs, teams, inn) {
      const n = Math.max(9, line[0].length, line[1].length);
      const cell = (v) => v == null ? '' : v;
      return `<div class="lg-ls"><table><thead><tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('')}<th class="r">R</th><th>H</th><th>E</th></tr></thead><tbody>${[0, 1].map(s => `<tr><td class="l">${badge(teams[s], 'xs')}${esc(T(teams[s]).city)}</td>${Array.from({ length: n }, (_, i) => `<td>${cell(line[s][i])}</td>`).join('')}<td class="r">${score[s]}</td><td>${(hits || [])[s] || 0}</td><td>${(errs || [])[s] || 0}</td></tr>`).join('')}</tbody></table></div>`;
    }
    function wpSvg(wp, my) {
      const w = 300, h = 70, n = wp.length - 1 || 1;
      const pts = wp.map((v, i) => `${(i / n * w).toFixed(1)},${(h - (my === 1 ? v : 100 - v) / 100 * h).toFixed(1)}`).join(' ');
      return `<figure class="lg-wp"><figcaption>${esc(myT().city)} 승리확률</figcaption><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" class="mid"/><polyline points="${pts}"/></svg></figure>`;
    }
    function boxHtml(gm) {
      if (!gm.box) return '<p class="lg-empty">박스스코어가 없어요</p>';
      return [0, 1].map(s => `<section class="lg-card"><header>${badge([gm.away, gm.home][s], 'xs')}<b>${esc(T([gm.away, gm.home][s]).city)}</b></header>
        <table class="lg-tbl sm"><thead><tr><th class="l">타자</th><th>타수</th><th>안타</th><th>홈런</th><th>타점</th><th>볼넷</th><th>삼진</th></tr></thead><tbody>${gm.box[s].bat.map(b => `<tr><td class="l">${esc(P(b.id).name)}</td><td>${b.ab || 0}</td><td>${b.h || 0}</td><td>${b.hr || 0}</td><td>${b.rbi || 0}</td><td>${b.bb || 0}</td><td>${b.k || 0}</td></tr>`).join('')}</tbody></table>
        <table class="lg-tbl sm"><thead><tr><th class="l">투수</th><th>이닝</th><th>피안타</th><th>실점</th><th>볼넷</th><th>삼진</th><th>투구</th></tr></thead><tbody>${gm.box[s].pit.map(p => `<tr><td class="l">${esc(P(p.id).name)}</td><td>${C.ipStr(p.outs || 0)}</td><td>${p.h || 0}</td><td>${p.r || 0}</td><td>${p.bb || 0}</td><td>${p.k || 0}</td><td>${p.np || 0}</td></tr>`).join('')}</tbody></table></section>`).join('');
    }
    function hlCard(r, gm, canTell) {
      const my = gm.home === R.L.my ? 1 : 0;
      return `<article class="lg-hl"><header><small>${r.inn}회${C.half2(r.half)} · ${C.OUTS[r.outs] || ''}${C.basesTxt(r.bases || []) ? ' ' + C.basesTxt(r.bases) : ''}</small>${(r.tags || []).slice(0, 3).map(t => `<i>${esc(t)}</i>`).join('')}</header>
        <p><b>${esc(P(r.pit).name)}</b> vs <b>${esc(P(r.bat).name)}</b> — ${esc(r.desc)}${r.rbi && !/홈런/.test(r.desc) ? ` ${r.rbi}타점` : ''}</p>
        <div class="lg-pseq">${(r.p || []).map((x, i) => `<span class="r-${x[3]}">${i + 1}<b>${esc(x[0])}${C.PT[x[0]] && C.PT[x[0]].fast ? x[1] : ''}</b></span>`).join('')}</div>
        ${canTell && R.L.logs[gm.no] ? `<button class="lg-btn sm ghost" data-a="scene" data-no="${gm.no}" data-i="${r.i}">${ic('talk')}이 장면 다시 이야기하기</button>` : ''}</article>`;
    }

    // ---------- 시트(아래에서 올라오는 창) ----------
    function openSheet(html, cls, onClose) {
      const s = $('#lg-sheet'); s.hidden = false; s.className = 'lg-sheet ' + (cls || '');
      s.innerHTML = `<div class="lg-scrim" data-a="sheet-x"></div><div class="lg-sbox" role="dialog"><button class="lg-ib lg-sx" data-a="sheet-x" aria-label="닫기">${ic('x')}</button>${html}</div>`;
      R.sheet = { onClose };
    }
    function closeSheet() { const s = $('#lg-sheet'); s.hidden = true; s.innerHTML = ''; const f = R.sheet && R.sheet.onClose; R.sheet = null; if (f) f(); }

    // ---------- 경기 준비 ----------
    function pregame() {
      const L = R.L, g = curGame(); if (!g) return;
      const side = g.home === L.my ? 1 : 0;
      if (!R.sub.lu || R.sub.luNo !== g.no) {
        const tmp = C.newGame(X, JSON.parse(JSON.stringify(L)), g);   // 미리보기용 (실제 상태는 건드리지 않음)
        R.sub.lu = tmp.lineup[side].map(x => Object.assign({}, x)); R.sub.luNo = g.no; R.sub.sp = tmp.pitcher[side]; R.sub.sel = null;
      }
      const lu = R.sub.lu;
      const bench = C.roster(X, L, L.my).filter(p => p.pos !== 'P' && !lu.some(x => x.id === p.id) && !(L.inj[p.id] > g.day));
      const sps = C.roster(X, L, L.my).filter(p => p.pos === 'P' && p.role === 'SP');
      const opp = g.home === L.my ? g.away : g.home;
      const career = L.mode === 'career';
      openSheet(`<div class="lg-pre"><h3>경기 준비 <small>vs ${esc(T(opp).city)} ${esc(T(opp).nick)}</small></h3>
        ${career ? `<p class="lg-note">${lu.some(x => x.id === 'ME') ? `<b>오늘 선발 출장!</b> ${esc(L.me.name)} — ${lu.findIndex(x => x.id === 'ME') + 1}번 타자` : `오늘은 벤치에서 시작해요. 대타·대수비로 기회가 올 수 있어요.`}</p>` : '<p class="lg-note">두 선수를 차례로 누르면 타순이 바뀌어요. 선수를 누르고 아래 벤치를 누르면 교체.</p>'}
        <ol class="lg-lu">${lu.map((x, i) => { const p = P(x.id); return `<li class="${R.sub.sel === i ? 'sel' : ''}"><button data-a="lu" data-i="${i}" ${career ? 'disabled' : ''}><em>${i + 1}</em><b>${esc(p.name)}${condDot(x.id)}</b><small>${posKo(x.pos)}</small><span>${x.pos === 'P' ? eraS(C.statOf(L, x.id, 'pit')) : avgS(C.statOf(L, x.id, 'bat'))}</span></button></li>`; }).join('')}</ol>
        ${!career && bench.length ? `<p class="lg-k">벤치</p><div class="lg-chips">${bench.map(p => `<button data-a="lu-b" data-id="${p.id}">${esc(p.name)} <small>${posKo(p.pos)}</small></button>`).join('')}</div>` : ''}
        ${!career ? `<p class="lg-k">선발 투수</p><div class="lg-chips">${sps.map(p => { const f = L.fat[p.id]; const rest = f ? g.day - f.day : 9; return `<button data-a="lu-sp" data-id="${p.id}" class="${R.sub.sp === p.id ? 'on' : ''} ${rest < 4 ? 'warn' : ''}">${esc(p.name)} <small>${rest < 4 ? `휴식 ${rest}일` : eraS(C.statOf(L, p.id, 'pit'))}</small></button>`; }).join('')}</div>` : ''}
        <p class="lg-k">이야기 멈춤</p><div class="lg-seg">${Object.entries(PRESET).map(([k, v]) => `<button data-a="preset" data-k="${k}" class="${prefs.preset === k ? 'on' : ''}">${v.name}<small>${v.desc}</small></button>`).join('')}</div>
        <p class="lg-k">경기 보기</p><div class="lg-seg">${Object.entries(SPEED).map(([k, v]) => `<button data-a="speed" data-k="${k}" class="${prefs.speed === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <button class="lg-btn primary big" data-a="playball">${ic('play')}플레이볼</button></div>`, 'tall');
    }
    function playBall() {
      const L = R.L, g = curGame(); if (!g) return;
      closeSheet();
      const opt = L.mode === 'career' ? {} : { lineup: R.sub.lu, sp: R.sub.sp };
      R.G = g.post ? C.newPostGame(X, L, g, opt) : C.newGame(X, L, g, opt);
      if (L.mode === 'career') { const my = R.G.teams.indexOf(L.my); if (R.G.lineup[my].some(x => x.id === 'ME')) L.career.starts++; }
      R.tickN = 0; R.sub.lu = null;
      openGame(); save();
      setAuto(prefs.speed !== 'all' ? true : false);
      if (prefs.speed === 'all') { setAuto(true); }
    }

    // ---------- 경기 화면 ----------
    function openGame() {
      const G = R.G; const g = $('#lg-game'); g.hidden = false; el.classList.add('in-game');
      g.innerHTML = `
        <div class="gm-bug" id="gm-bug"></div>
        <div class="gm-wp" id="gm-wp"><i></i><span></span></div>
        <div class="gm-stage" id="gm-stage">
          <div class="gm-card pit" id="gm-pit"></div>
          <div class="gm-mid"><div class="gm-zone" id="gm-zone"></div><p class="gm-last" id="gm-last"></p></div>
          <div class="gm-card bat" id="gm-bat"></div>
          <div class="gm-call" id="gm-call"></div>
        </div>
        <div class="gm-stop" id="gm-stop" hidden></div>
        <ol class="gm-tick" id="gm-tick"></ol>
        <div class="gm-ctl" id="gm-ctl"></div>`;
      paintGame(); paintTicker(true);
    }
    function closeGame() { $('#lg-game').hidden = true; el.classList.remove('in-game'); setAuto(false); }
    function paintGame(cnt) {
      const G = R.G; if (!G) return;
      const my = G.teams.indexOf(R.L.my);
      cnt = cnt || { b: 0, s: 0 };
      const team = (s) => `<div class="gm-tm ${G.half === s && !G.over ? 'atbat' : ''}" style="--c:${T(G.teams[s]).color};--c2:${T(G.teams[s]).color2}">${badge(G.teams[s], 'sm')}<b>${esc(T(G.teams[s]).city)}</b><em>${G.score[s]}</em></div>`;
      const dots = (n, of, cls) => Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on ' + cls : ''}"></i>`).join('');
      $('#gm-bug').innerHTML = `${team(0)}${team(1)}
        <div class="gm-inn">${G.over ? '<b>종료</b>' : `<span>${G.half ? '▼' : '▲'}</span><b>${G.inn}</b>`}</div>
        <div class="gm-cnt"><span><small>B</small>${dots(cnt.b, 3, 'b')}</span><span><small>S</small>${dots(cnt.s, 2, 's')}</span><span><small>O</small>${dots(G.outs, 2, 'o')}</span></div>
        <svg class="gm-dia" viewBox="0 0 60 44"><rect x="23" y="2" width="14" height="14" transform="rotate(45 30 9)" class="${G.bases[1] ? 'on' : ''}"/><rect x="40" y="16" width="14" height="14" transform="rotate(45 47 23)" class="${G.bases[0] ? 'on' : ''}"/><rect x="6" y="16" width="14" height="14" transform="rotate(45 13 23)" class="${G.bases[2] ? 'on' : ''}"/></svg>`;
      const wp = G.wp[G.wp.length - 1], mine = my === 1 ? wp : 1 - wp;
      $('#gm-wp').innerHTML = `<i style="width:${Math.round(mine * 100)}%"></i><span>${esc(myT().city)} 승리확률 ${Math.round(mine * 100)}%</span>`;
      if (!G.over) {
        const ctx = C.ctxOf(X, R.L, G);
        const pit = ctx.pit, bat = ctx.bat, gp = G.pstat[pit.id] || {}, gb = G.bstat[bat.id] || {};
        const bs = C.statOf(R.L, bat.id, 'bat', G.post), ps = C.statOf(R.L, pit.id, 'pit', G.post);
        $('#gm-pit').innerHTML = `${silo(pit)}<div><small>투수 · ${pit.throws === 'L' ? '좌' : '우'}</small><b>${esc(pit.name)}</b><span>${G.pc[pit.id] || 0}구 · ${C.ipStr(gp.outs || 0)}이닝 ${gp.k || 0}K</span><em>시즌 ${eraS(ps)}</em></div>`;
        $('#gm-bat').innerHTML = `${silo(bat)}<div><small>${(G.bo[G.half] % 9) + 1}번 · ${posKo(G.lineup[G.half][G.bo[G.half] % 9].pos.replace('*', ''))}</small><b>${esc(bat.name)}</b><span>오늘 ${gb.ab || 0}타수 ${gb.h || 0}안타</span><em>시즌 ${avgS(bs)} · ${bs.hr}홈런</em></div>`;
      } else { $('#gm-pit').innerHTML = ''; $('#gm-bat').innerHTML = ''; }
      paintCtl();
    }
    function paintZone(pitches, bats) {
      const z = $('#gm-zone'); if (!z) return;
      const pos = (k, i) => {
        let x, y;
        if (k < 9) { x = (k % 3 + 0.5) / 3; y = (Math.floor(k / 3) + 0.5) / 3; } else { x = k === 11 ? 1.22 : k === 12 ? -0.22 : 0.5; y = k === 9 ? -0.2 : k === 10 ? 1.2 : 0.55; }
        const j = ((i * 37) % 11 - 5) / 60, jj = ((i * 53) % 13 - 6) / 70;
        if (bats === 'L') x = 1 - x;
        return [x + j, y + jj];
      };
      z.innerHTML = `<div class="gm-zbox">${Array.from({ length: 9 }, () => '<i></i>').join('')}</div>${(pitches || []).map((p, i) => { const [x, y] = pos(p[2], i); return `<b class="pd r-${p[3]} ${i === pitches.length - 1 ? 'last' : ''}" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%">${i + 1}</b>`; }).join('')}`;
    }
    function call(text, cls) { const c = $('#gm-call'); if (!c) return; c.className = 'gm-call on ' + (cls || ''); c.innerHTML = `<b>${esc(text)}</b>`; clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('on'), 1300); }
    function paintCtl() {
      const G = R.G, c = $('#gm-ctl'); if (!c) return;
      if (G.over) { c.innerHTML = `<button class="lg-btn primary big" data-a="g-end">경기 결과 보기</button>`; return; }
      const career = R.L.mode === 'career';
      const my = G.teams.indexOf(R.L.my), meBat = G.half === my;
      c.innerHTML = `
        <button class="gm-b ${R.auto ? 'on' : ''}" data-a="g-auto">${ic(R.auto ? 'pause' : 'play')}<span>${R.auto ? '자동 멈춤' : '자동 진행'}</span></button>
        <button class="gm-b" data-a="g-step" ${R.auto ? 'disabled' : ''}>${ic('next')}<span>다음 타석</span></button>
        <button class="gm-b story ${R.sub.resumeHint ? 'pulse' : ''}" data-a="g-stop">${ic('talk')}<span>멈추고 이야기</span></button>
        <button class="gm-b" data-a="g-ff">${ic('ff')}<span>끝까지</span></button>
        ${career ? '' : `<button class="gm-b" data-a="g-ord">${ic('sign')}<span>작전</span></button>`}
        ${career ? '' : `<button class="gm-b dp" data-a="g-dp">${ic(meBat ? 'bat' : 'ball')}<span>${meBat ? '내가 친다' : '내가 던진다'}</span></button>`}
        <button class="gm-b" data-a="g-more">${ic('more')}<span>더보기</span></button>`;
    }
    function tickLine(r) {
      const G = R.G; const my = G.teams.indexOf(R.L.my);
      const t = (r.tags || []).filter(x => !['감독 작전'].includes(x));
      const scoring = (r.runs || []).length;
      const pre = (r.pre || []).map(e => `${P(e.run).name} ${e.k === 'SB' ? '도루 성공' : e.k === 'CS' ? '도루 실패' : '견제사'}`).join(' · ');
      return `<li class="tk ${scoring ? 'run' : ''} ${r.half === my ? 'us' : 'them'} ${r.drama >= 25 ? 'big' : ''}"><small>${r.inn}회${C.half2(r.half)}</small><span>${pre ? `<u>${esc(pre)}</u>` : ''}${r.ord && r.ord.by !== 'ai' ? `<u>${esc(r.ord.label || '')}${r.ord.ignored ? ' (사인 무시)' : ''}</u>` : ''}<b>${esc(P(r.bat).name)}</b> ${esc(r.desc)}${r.rbi && !/홈런/.test(r.desc) ? ` <em>${r.rbi}타점</em>` : ''}${scoring ? ` <em>${r.scoreAfter[0]}:${r.scoreAfter[1]}</em>` : ''}${t.length ? `<i>${t.slice(0, 2).map(esc).join(' · ')}</i>` : ''}<small class="seq">${(r.pitches || []).map(C.pitchTxt).map(esc).join(' · ')}</small></span></li>`;
    }
    function paintTicker(all) {
      const G = R.G, t = $('#gm-tick'); if (!t || !G) return;
      if (all) { t.innerHTML = G.log.slice(-30).reverse().map(tickLine).join(''); R.tickN = G.log.length; return; }
      const add = G.log.slice(R.tickN).reverse().map(tickLine).join('');
      if (add) t.insertAdjacentHTML('afterbegin', add);
      while (t.children.length > 40) t.lastChild.remove();
      for (const ev of G.ev.slice(R.sub.evN || 0)) if (ev.k === 'pchange') t.insertAdjacentHTML('afterbegin', `<li class="tk sys"><span>투수 교체 · ${esc(T(G.teams[ev.side]).city)} ${esc(P(ev.from).name)} → <b>${esc(P(ev.to).name)}</b></span></li>`);
      R.sub.evN = G.ev.length;
      R.tickN = G.log.length;
    }
    function setAuto(on) { R.auto = !!on; clearTimeout(R.timer); paintCtl(); if (R.auto) loop(); }
    const wait = (ms) => new Promise(res => { R.timer = setTimeout(res, ms); });
    // 한 타석 진행 + 연출
    async function loop() {
      if (R.busy || dead) return;
      R.busy = true;
      try {
        while (R.G && !R.G.over && !dead) {
          const stop = await oneStep();
          if (stop || !R.auto) break;
        }
      } finally { R.busy = false; }
      if (R.G && R.G.over) { setAuto(false); paintGame(); afterGame(); }
    }
    // 반환: true = 멈춤
    async function oneStep() {
      const G = R.G, L = R.L;
      const my = G.teams.indexOf(L.my);
      // 1) 결정 순간 (빠름 프리셋이면 코치가 알아서)
      if (!R.pendingOrd && prefs.preset !== 'fast' && L.mode !== 'career') {
        const d = C.decisionAt(X, L, G);
        const key = `${G.inn}${G.half}${G.outs}${G.bo[G.half]}`;
        if (d && R.sub.decKey !== key) { R.sub.decKey = key; setAuto(false); decisionSheet(d); return true; }
      }
      // 2) 직접 플레이 (커리어 = 내 타석·내 투구)
      const ctx = C.ctxOf(X, L, G);
      if (L.mode === 'career' && !R.sub.meAuto && (ctx.bat.id === 'ME' || ctx.pit.id === 'ME')) { setAuto(false); openDP(ctx.bat.id === 'ME' ? 'bat' : 'pit'); return true; }
      if (R.dpNext) { const k = R.dpNext; R.dpNext = null; if ((k === 'bat') === (G.half === my)) { setAuto(false); openDP(k); return true; } }
      const ord = R.pendingOrd; R.pendingOrd = null;
      const prevLen = G.log.length;
      const rec = C.stepPA(X, L, G, { ord });
      if (!rec) return true;
      await showPA(rec);
      save();
      // 3) 이야기 자동 멈춤
      const why = autoStopWhy(rec, prevLen);
      if (why && !G.over) { setAuto(false); showStop(why); return true; }
      return false;
    }
    function autoStopWhy(rec) {
      const p = prefs.preset; const t = rec.tags || [];
      if (p === 'fast' || p === 'man') return null;
      if (t.includes('역전')) return '역전!'; if (t.includes('동점')) return '동점!';
      if (p === 'imm') { if ((rec.runs || []).length) return '득점'; if (rec.outsAfter === 3) return `${rec.inn}회${C.half2(rec.half)} 종료`; }
      return null;
    }
    async function showPA(rec) {
      const G = R.G, sp = prefs.speed;
      const big = rec.drama >= 18 || (rec.runs || []).length || (rec.tags || []).length;
      const animate = sp === 'all' || (sp === 'hl' && big);
      const ctxBats = (P(rec.bat).bats === 'S' ? (P(rec.pit).throws === 'L' ? 'R' : 'L') : P(rec.bat).bats);
      if (animate && rec.pitches && rec.pitches.length) {
        // 타석 시작 상태로 그린 뒤 공 하나씩
        const saveState = { bases: G.bases, outs: G.outs, score: G.score.slice() };
        let b = 0, s = 0;
        for (let i = 0; i < rec.pitches.length; i++) {
          const p = rec.pitches[i];
          paintZone(rec.pitches.slice(0, i + 1), ctxBats);
          $('#gm-last').innerHTML = `<b>${i + 1}구</b> ${esc(p[0])} ${C.PT[p[0]] && C.PT[p[0]].fast ? p[1] + 'km' : ''} · ${esc(C.ZONES[p[2]] || '')} · <i class="r-${p[3]}">${{ B: '볼', S: '헛스윙', L: '루킹', F: '파울', X: '타격!' }[p[3]]}</i>`;
          if (p[3] === 'B') b++; else if (p[3] === 'S' || p[3] === 'L' || (p[3] === 'F' && s < 2)) s++;
          if (i < rec.pitches.length - 1) { const bug = $('#gm-bug .gm-cnt'); if (bug) bug.innerHTML = `<span><small>B</small>${[0, 1, 2].map(k => `<i class="${k < b ? 'on b' : ''}"></i>`).join('')}</span><span><small>S</small>${[0, 1].map(k => `<i class="${k < s ? 'on s' : ''}"></i>`).join('')}</span><span><small>O</small>${[0, 1].map(k => `<i class="${k < rec.outs ? 'on o' : ''}"></i>`).join('')}</span>`; }
          await wait(sp === 'all' ? 520 : 380);
          if (dead || !R.G) return;
        }
        void saveState;
      } else { paintZone(rec.pitches || [], ctxBats); $('#gm-last').textContent = rec.pitches && rec.pitches.length ? `${rec.pitches.length}구 승부` : ''; }
      const t = rec.tags || [];
      const big2 = t.includes('끝내기') ? ['끝내기!', 'gold'] : rec.res === 'HR' ? ['홈런!', 'gold'] : t.includes('역전') ? ['역전!', 'red'] : t.includes('동점') ? ['동점!', 'red'] : t.includes('호수비') ? ['호수비!', ''] : null;
      call(big2 ? big2[0] : (RESTXT[rec.res] || rec.desc), big2 ? big2[1] : (rec.res === 'K' ? 'k' : ''));
      paintGame(); paintTicker();
      if (animate || sp === 'all') await wait(big2 ? 1100 : 650);
      else await wait(sp === 'res' ? 25 : 140);
    }
    function showStop(why) {
      const s = $('#gm-stop'); s.hidden = false;
      s.innerHTML = `<b>${esc(why)}</b><span>여기서 멈췄어요</span><button class="lg-btn sm primary" data-a="g-stop">${ic('talk')}이야기 듣기</button><button class="lg-btn sm ghost" data-a="g-go">${ic('play')}계속</button>`;
    }
    function hideStop() { const s = $('#gm-stop'); if (s) { s.hidden = true; s.innerHTML = ''; } }

    // 결정 순간 시트
    function decisionSheet(d, manualOpen) {
      const G = R.G, L = R.L;
      const opts = C.orderOptions(X, L, G, d ? d.side : (G.half === G.teams.indexOf(L.my) ? 'off' : 'def'));
      const hints = (L.hints || []).filter(h => h.no === G.no).map(h => h.k);
      const ctx = C.ctxOf(X, L, G);
      openSheet(`<div class="lg-dec"><p class="lg-k">${d ? '결정 순간' : '작전'}</p><h3>${d ? esc(d.why) : `${G.inn}회${C.half2(G.half)} ${C.OUTS[G.outs]}`}</h3>
        <p class="lg-note">${esc(ctx.pit.name)}(${G.pc[ctx.pit.id] || 0}구) vs ${esc(ctx.bat.name)} · ${C.basesTxt(G.bases) || '주자 없음'}</p>
        <div class="lg-opts">${opts.map((x, i) => `<button data-a="ord" data-i="${i}" class="${hints.includes(x.k) ? 'hint' : ''}">${esc(x.label)}${hints.includes(x.k) ? '<em>크랙 추천</em>' : ''}</button>`).join('')}</div></div>`, '', () => { if (!R.sub.ordChosen && !manualOpen) { R.pendingOrd = { k: 'free' }; } R.sub.ordChosen = false; if (!manualOpen) setAuto(true); });
      R.sub.opts = opts;
    }
    function chooseOrder(i) {
      const x = R.sub.opts[i]; if (!x) return;
      R.sub.ordChosen = true;
      const G = R.G, L = R.L;
      if (['pc', 'ph', 'pr', 'shift', 'keep', 'visit'].includes(x.k)) { C.stepPA && null; R.pendingOrd = null; const rng = C.RNG(L.rs); applyNow(x, rng); L.rs = rng.get(); }
      else R.pendingOrd = { k: x.k, label: x.label };
      closeSheet(); paintGame(); paintTicker();
    }
    function applyNow(x) {
      // 교체·시프트 같은 즉시 작전은 엔진의 applyOrder를 타석 전에 부르는 stepPA 경로로 넘긴다
      R.pendingOrd = Object.assign({}, x);
      if (x.k === 'pc' || x.k === 'ph' || x.k === 'pr') toast(x.label);
    }

    // 멈추고 이야기 (⚾중간로그)
    function stopSheet() {
      const G = R.G; setAuto(false); hideStop();
      const req = R.sub.req || '';
      const text = C.midCode(X, R.L, G, req);
      openSheet(`<div class="lg-mid"><p class="lg-k">경기 멈춤</p><h3>${G.inn}회${C.half2(G.half)} · ${esc(T(G.teams[0]).city)} ${G.score[0]} : ${G.score[1]} ${esc(T(G.teams[1]).city)}</h3>
        <p class="lg-note">지금까지 경기를 크랙에 보내면 현장을 서술해 줘요. 다음 결과는 아직 정해지지 않았어요. 크랙과 몇 번이든 이야기한 뒤 재개를 누르세요.</p>
        <label class="lg-req"><span>[요청] 보고 싶은 장면 (비워 두면 크랙이 알아서)</span><input id="lg-req" value="${esc(req)}" placeholder="예) 노태경이 백승호한테 가는 장면"></label>
        <pre id="lg-midpre">${esc(text)}</pre><p class="lg-note">${text.length}자 / 한도 ${prefs.limit || '없음'}</p>
        <div class="lg-row"><button class="lg-btn primary big" data-a="mid-send">${solo ? ic('copy') + '복사하기' : '크랙으로 보내기'}</button></div>
        <div class="lg-row"><button class="lg-btn ghost" data-a="paste-open">${ic('clip')}크랙 답 붙여넣기</button><button class="lg-btn ghost" data-a="sheet-x">${ic('play')}재개</button></div></div>`, 'tall');
    }
    // 크랙 답 붙여넣기 (경기 중) → order= 확인 팝업
    function pasteSheet() {
      openSheet(`<div class="lg-mid"><p class="lg-k">크랙 답</p><textarea id="lg-paste" rows="6" placeholder="크랙 답을 붙여 넣어 주세요"></textarea><div class="lg-row"><button class="lg-btn primary" data-a="paste">읽기</button></div><div id="lg-pres"></div></div>`, 'tall');
    }
    function readPaste(text) {
      const p = C.parseReply(text, X);
      R.pasted = p;
      const G = R.G;
      if (G && !G.over) {
        for (const h of p.hints) { const r = C.resolveOrder(X, R.L, G, h); if (r) (R.L.hints = R.L.hints || []).push(Object.assign({ no: G.no }, r)); }
        R.sub.resumeHint = p.scene === 'resume';
        R.sub.orderQ = p.orders.map(x => C.resolveOrder(X, R.L, G, x)).filter(Boolean);
      }
      save();
      return p;
    }
    function confirmOrders() {
      const q = R.sub.orderQ || []; if (!q.length) return false;
      const x = q[0];
      openSheet(`<div class="lg-dec"><p class="lg-k">크랙 장면 속 작전 지시</p><h3>${esc(x.label)}</h3><p class="lg-note">대화에서 나온 지시를 경기에 반영할까요? 잘못 읽었으면 무시하세요.</p>
        <div class="lg-row"><button class="lg-btn primary" data-a="oq-ok">반영</button><button class="lg-btn ghost" data-a="oq-no">무시</button></div></div>`);
      return true;
    }

    // 경기 끝
    function afterGame() {
      const G = R.G, L = R.L; if (!G || R.sub.endShown === G.no) return;
      R.sub.endShown = G.no;
      const my = G.teams.indexOf(L.my);
      const win = G.score[my] > G.score[1 - my], tie = G.score[0] === G.score[1];
      const code = C.gameCode(X, L, G, prefs.speed === 'res' ? 'short' : 'std');
      const item = queueCode('game', `${G.post ? (G.post === 'ks' ? '한국시리즈 ' : '플레이오프 ') + G.postRef.gn + '차전' : '#' + G.no} vs ${T(G.teams[1 - my]).city} ${G.score[my]}-${G.score[1 - my]}`, code, { no: G.no });
      const gm = G.post ? G.postRef : L.games.find(x => x.no === G.no);
      const hl = C.highlights(X, L, G, 3).map(r => Object.assign({ p: r.pitches }, r));
      if (G.arcs && G.arcs.length) for (const a of G.arcs) { L.news.unshift({ k: 'arc', text: `${a.name} — ${a.note}` }); }
      const box = C.statOf; void box;
      const mvp = mvpOf(G, my);
      pushNews(`${win ? '승리' : tie ? '무승부' : '패배'} vs ${T(G.teams[1 - my]).city} ${G.score[my]}-${G.score[1 - my]}`);
      save(true);
      openSheet(`<div class="lg-end ${win ? 'win' : tie ? '' : 'lose'}"><p class="lg-k">경기 종료</p><h3>${win ? '승리' : tie ? '무승부' : '패배'}</h3>
        <div class="lg-vs big">${badge(G.teams[0])}<b>${G.score[0]}</b><span>:</span><b>${G.score[1]}</b>${badge(G.teams[1])}</div>
        ${lineScore(G.line, G.score, G.hits, G.errs, G.teams, G.inn)}
        ${mvp ? `<section class="lg-mvp">${silo(P(mvp.id), 'big')}<div><small>오늘의 수훈</small><b>${esc(P(mvp.id).name)}</b><span>${esc(mvp.line)}</span></div></section>` : ''}
        <h4 class="lg-h4">명장면</h4>${hl.map(r => hlCard(r, gm || { no: G.no, home: G.home }, true)).join('')}
        <section class="lg-card lg-out"><header><b>⚾경기로그</b><span>${code.length}자</span></header><pre>${esc(code)}</pre>
          <div class="lg-row"><button class="lg-btn primary" data-a="deliver" data-id="${item.id}">${solo ? ic('copy') + '복사' : '크랙으로 보내기'}</button><button class="lg-btn ghost" data-a="regen" data-id="${item.id}" data-k="short">짧게</button><button class="lg-btn ghost" data-a="regen" data-id="${item.id}" data-k="std">표준</button></div></section>
        <button class="lg-btn primary big" data-a="g-next">클럽하우스로</button></div>`, 'tall end', () => {});
    }
    function mvpOf(G, my) {
      let best = null;
      for (const id of Object.keys(G.bstat)) { if (P(id).team !== G.teams[my]) continue; const b = G.bstat[id]; const v = b.h * 2 + b.hr * 3 + b.rbi * 2 + b.sb + b.bb * 0.5; if (!best || v > best.v) best = { id, v, line: `${b.ab}타수 ${b.h}안타${b.hr ? ` ${b.hr}홈런` : ''}${b.rbi ? ` ${b.rbi}타점` : ''}` }; }
      for (const id of G.used[my]) { const q = G.pstat[id]; const v = q.outs / 3 * 1.6 + q.k * 0.8 - q.er * 2.5; if (!best || v > best.v) best = { id, v, line: `${C.ipStr(q.outs)}이닝 ${q.k}탈삼진 ${q.er}자책` }; }
      return best && best.v > 2 ? best : null;
    }
    function nextAfterGame() {
      const L = R.L, G = R.G;
      closeSheet(); closeGame();
      if (G && !G.post) {
        const gm = L.games.find(x => x.no === G.no);
        const rest = L.games.filter(x => x.si === gm.si && x.st !== 'done');
        if (!rest.some(x => x.home === L.my || x.away === L.my)) {
          for (const x of rest) C.simGameNo(X, L, x.no);
          C.afterSeries(X, L, gm.si);
          const nx = curGame(); if (nx) { C.simOthersUntil(X, L, nx.no); queueCode('series', seriesTitle(), seriesCode()); }
          else if (C.regDone(L)) pushNews('정규시즌 끝 — 포스트시즌으로');
        } else { const nx = curGame(); if (nx) C.simOthersUntil(X, L, nx.no); }
      } else if (G && G.post) { simPostOthers(); const nx = curGame(); if (nx) queueCode('series', seriesTitle(), seriesCode()); }
      R.G = null; R.view = 'home'; save(true); render();
    }
    // 내 경기가 아닌 포스트시즌 경기는 자동
    function simPostOthers() {
      const L = R.L; let g, guard = 0;
      while ((g = C.nextPostGame(L)) && !(g.home === L.my || g.away === L.my) && guard++ < 12) { const G = C.newPostGame(X, L, g); C.simToEnd(X, L, G); }
      if (L.post && L.post.done) pushNews(`${T(L.champion).city} ${T(L.champion).nick} 우승!`);
    }
    // 결과만 (내 경기도 자동)
    function quickGame() {
      const L = R.L, g = curGame(); if (!g) return;
      R.G = g.post ? C.newPostGame(X, L, g) : C.newGame(X, L, g);
      C.simToEnd(X, L, R.G);
      R.sub.endShown = null; openGame(); paintGame(); paintTicker(true); afterGame();
    }

    // ---------- 직접 플레이 ----------
    function openDP(kind) {
      const G = R.G, L = R.L;
      const ctx = C.ctxOf(X, L, G);
      R.dp = { kind, cnt: { b: 0, s: 0 }, ps: [], guess: null, type: (ctx.pit.pitches || ['직구'])[0], pick: null, phase: kind === 'bat' ? 'guess' : 'type', ord: R.pendingOrd };
      R.pendingOrd = null;
      const d = $('#lg-dp'); d.hidden = false;
      paintDP();
    }
    function paintDP(msg) {
      const G = R.G, L = R.L, D = R.dp, d = $('#lg-dp'); if (!D) return;
      const ctx = C.ctxOf(X, L, G);
      const me = D.kind === 'bat' ? ctx.bat : ctx.pit, op = D.kind === 'bat' ? ctx.pit : ctx.bat;
      const zone = (cls, clickable) => `<div class="dp-zone ${cls}">${Array.from({ length: 13 }, (_, k) => `<button class="z z${k} ${(D.kind === 'bat' ? D.guess : D.pick) === k ? 'on' : ''}" data-a="${clickable}" data-z="${k}" ${k >= 9 && D.kind === 'bat' ? 'tabindex="-1"' : ''} aria-label="${esc(C.ZONES[k])}"></button>`).join('')}${D.ps.map((p, i) => `<b class="pd r-${p[3]}" data-z="${p[2]}" style="--i:${i}">${i + 1}</b>`).join('')}<i class="ball" id="dp-ball"></i></div>`;
      const cnt = `<div class="dp-cnt"><span>B ${'●'.repeat(D.cnt.b)}${'○'.repeat(3 - D.cnt.b)}</span><span>S ${'●'.repeat(D.cnt.s)}${'○'.repeat(2 - D.cnt.s)}</span><span>O ${'●'.repeat(G.outs)}${'○'.repeat(2 - G.outs)}</span></div>`;
      let ctl = '';
      if (D.kind === 'bat') {
        ctl = D.phase === 'guess' ? `<p class="dp-tip">노릴 코스를 누르거나 <button class="lg-link" data-a="dp-all">전체 대기</button> — 그다음 투구!</p><button class="lg-btn primary big" data-a="dp-throw">투구 시작</button>`
          : D.phase === 'swing' ? `<div class="dp-bar" id="dp-bar"><i class="sweet"></i><b id="dp-mk"></b></div><button class="lg-btn primary big dp-swing" data-a="dp-swing">스윙!</button><p class="dp-tip">공이 존에 닿는 순간(초록 칸)에 누르세요. 안 누르면 지켜봐요.</p>`
          : `<button class="lg-btn primary big" data-a="dp-next">다음 공</button>`;
      } else {
        const ps = ctx.pit.pitches || ['직구'];
        ctl = D.phase === 'type' || D.phase === 'aim' ? `<div class="lg-chips">${ps.map(t => `<button data-a="dp-type" data-v="${esc(t)}" class="${D.type === t ? 'on' : ''}">${esc(t)}</button>`).join('')}</div><p class="dp-tip">${D.pick == null ? '던질 곳을 누르세요 (바깥 네 칸 = 유인구)' : `${esc(C.ZONES[D.pick])} · 게이지를 멈추세요`}</p>${D.pick != null ? '<div class="dp-gauge" id="dp-g"><i></i><b id="dp-gk"></b></div><button class="lg-btn primary big" data-a="dp-lock">던지기!</button>' : ''}`
          : `<button class="lg-btn primary big" data-a="dp-next">다음 공</button>`;
      }
      d.innerHTML = `<div class="dp-top"><span>${badge(me.team, 'xs')}<b>${esc(me.name)}</b> ${D.kind === 'bat' ? '타석' : '마운드'}</span><button class="lg-btn sm ghost" data-a="dp-auto">자동으로</button></div>
        <div class="dp-vs"><span>${silo(op)}<b>${esc(op.name)}</b><small>${D.kind === 'bat' ? `${G.pc[op.id] || 0}구 · ${(op.pitches || []).join('·')}` : `${avgS(C.statOf(L, op.id, 'bat'))} · ${C.statOf(L, op.id, 'bat').hr}홈런`}</small></span>${cnt}</div>
        ${zone(D.kind === 'bat' && ctx.bats === 'L' ? 'lh' : D.kind !== 'bat' && ctx.bats === 'L' ? 'lh' : '', D.kind === 'bat' ? 'dp-guess' : 'dp-pick')}
        <p class="dp-msg" id="dp-msg">${msg || ''}</p>
        <div class="dp-ctl">${ctl}</div>`;
      if (D.kind === 'pit' && D.pick != null && (D.phase === 'aim')) runGauge();
    }
    // 타격: 투구 → 공이 날아오는 동안 타이밍 바
    function dpThrow() {
      const D = R.dp, G = R.G, L = R.L;
      const rng = C.RNG(L.rs);
      D.pitch = C.aiPitch(X, L, G, D.cnt, rng); L.rs = rng.get();
      D.phase = 'swing'; paintDP(`${D.pitch.t} …`);
      const dur = clamp(1500 * 132 / D.pitch.kmh, 900, 1700);
      D.t0 = performance.now(); D.dur = dur; D.swung = null;
      const mk = () => {
        if (!R.dp || R.dp.phase !== 'swing') return;
        const t = (performance.now() - D.t0) / D.dur;
        const m = $('#dp-mk'); if (m) m.style.left = (clamp(t, 0, 1.15) / 1.15 * 100) + '%';
        const b = $('#dp-ball'); if (b) { b.style.setProperty('--t', clamp(t / 0.8, 0, 1)); b.className = 'ball on'; b.dataset.z = D.pitch.z; }
        if (t >= 1.15) { dpResolveSwing(null); return; }
        requestAnimationFrame(mk);
      };
      requestAnimationFrame(mk);
    }
    function dpResolveSwing(when) {
      const D = R.dp; if (!D || D.phase !== 'swing') return;
      D.phase = 'res';
      const G = R.G, L = R.L, rng = C.RNG(L.rs);
      const timing = when == null ? 0 : clamp(((when - D.t0) / D.dur - 0.8) / 0.22, -1, 1);
      const r = C.swingResult(X, L, G, D.pitch, { swing: when != null, timing, guess: D.guess }, D.cnt, rng); L.rs = rng.get();
      D.ps.push([D.pitch.t, D.pitch.kmh, D.pitch.z, r.r]);
      dpCount(r, when == null ? '' : timing < -0.25 ? ' (빨랐어요)' : timing > 0.25 ? ' (늦었어요)' : ' (타이밍 좋음)');
    }
    function dpCount(r, extra) {
      const D = R.dp;
      let out = null, msg = '';
      const p = D.ps[D.ps.length - 1];
      const head = `${p[0]} ${C.PT[p[0]] && C.PT[p[0]].fast ? p[1] + 'km ' : ''}${C.ZONES[p[2]]} · `;
      if (r.r === 'X') { out = r.out; msg = head + '타격!' + (extra || ''); }
      else if (r.r === 'B') { D.cnt.b++; msg = head + '볼'; if (D.cnt.b >= 4) out = 'BB'; }
      else if (r.r === 'F') { if (D.cnt.s < 2) D.cnt.s++; msg = head + '파울' + (extra || ''); }
      else { D.cnt.s++; msg = head + (r.r === 'L' ? '스트라이크 (루킹)' : '헛스윙') + (extra || ''); if (D.cnt.s >= 3) out = 'K'; }
      if (out) { dpFinish(out, msg); return; }
      D.phase = 'res'; paintDP(msg);
    }
    function dpFinish(out, msg) {
      const D = R.dp, G = R.G, L = R.L;
      const rec = C.finishUserPA(X, L, G, D.ps, out, D.ord);
      $('#dp-msg').textContent = msg;
      R.dp = null;
      setTimeout(() => {
        $('#lg-dp').hidden = true;
        call(rec.res === 'HR' ? '홈런!' : RESTXT[rec.res] || rec.desc, rec.res === 'HR' ? 'gold' : '');
        paintGame(); paintTicker(); save();
        if (G.over) { paintGame(); afterGame(); }
        else if (R.L.mode === 'career') setAuto(true);
      }, 700);
    }
    let gaugeRaf = 0;
    function runGauge() {
      cancelAnimationFrame(gaugeRaf);
      const D = R.dp, G = R.G, L = R.L;
      const pit = C.ctxOf(X, L, G).pit;
      const sp = 0.9 + (100 - pit.p.ctrl) / 60;   // 제구가 낮으면 빨리 움직인다
      D.g0 = performance.now();
      const f = () => { if (!R.dp || R.dp.phase !== 'aim') return; const t = (performance.now() - D.g0) / 1000 * sp; D.gv = Math.abs(((t % 2) + 2) % 2 - 1); const k = $('#dp-gk'); if (k) k.style.left = (D.gv * 100) + '%'; gaugeRaf = requestAnimationFrame(f); };
      gaugeRaf = requestAnimationFrame(f);
    }
    function dpLock() {
      const D = R.dp; if (!D || D.phase !== 'aim') return;
      cancelAnimationFrame(gaugeRaf);
      const acc = 1 - Math.abs((D.gv || 0) - 0.5) * 2;
      const G = R.G, L = R.L, rng = C.RNG(L.rs);
      const r = C.pitchResult(X, L, G, { pick: D.pick, acc, type: D.type }, D.cnt, rng); L.rs = rng.get();
      D.ps.push([r.t, r.kmh, r.z, r.r]); D.phase = 'res';
      dpCount(r, acc > 0.85 ? ' (완벽한 제구)' : acc < 0.4 ? ' (손에서 빠짐)' : '');
    }
    function dpAuto() {
      // 이 타석은 컴퓨터에게 (지금까지 던진 공은 버리고 새로)
      $('#lg-dp').hidden = true; const ord = R.dp && R.dp.ord; R.dp = null;
      if (R.L.mode === 'career') R.sub.meAutoOnce = true;
      const rec = C.stepPA(X, R.L, R.G, { ord }); if (rec) { paintGame(); paintTicker(); }
      if (R.G.over) afterGame(); else if (R.L.mode === 'career') setAuto(true);
    }

    // ---------- 단추 ----------
    function onClick(ev) {
      const b = ev.target.closest('[data-a]'); if (!b || !el.contains(b)) return;
      const a = b.dataset.a, L = R.L;
      if (b.disabled) return;
      switch (a) {
        case 'tab': R.view = b.dataset.k; render(); break;
        case 'menu': openMenu(); break;
        case 't-new': if (saves().length >= 2) toast('시즌은 두 개까지 저장돼요 — 새로 시작하면 가장 오래된 시즌이 지워져요', 3200); renderTitle('mode'); break;
        case 't-back': renderTitle(R.sub.tstep === 'me' ? 'team' : R.sub.tstep === 'team' ? 'mode' : 'menu'); break;
        case 't-mode': R.sub.mode = b.dataset.k; renderTitle('team'); break;
        case 't-team': R.sub.team = b.dataset.k; if (R.sub.mode === 'career') renderTitle('me'); else newSeason(); break;
        case 't-me': { const m = R.sub.me; const n = $('#tt-name'); if (n) m.name = n.value.trim(); const f = b.dataset.f, v = b.dataset.v; if (f === 'hand') { m.throws = v[0]; m.bats = v[1]; } else m[f] = v; renderTitle('me'); break; }
        case 't-go': { const n = $('#tt-name'); R.sub.me.name = (n && n.value.trim()) || '신인'; newSeason(); break; }
        case 't-load': if (ev.target.closest('[data-a=t-del]')) break; if (load(b.dataset.id)) { R.view = 'home'; render(); if (R.G && !R.G.over) toast('진행 중인 경기가 있어요 — 경기로 돌아가기'); } break;
        case 't-del': { ev.stopPropagation(); const id = b.dataset.id; if (R.sub.delAsk === id) { ls.del('s.' + id); ls.set('saves', saves().filter(s => s.id !== id)); R.sub.delAsk = null; toast('시즌을 지웠어요'); } else { R.sub.delAsk = id; toast('한 번 더 누르면 지워져요'); } renderTitle('menu'); break; }
        case 't-3d': open3D(); break;
        case 'pregame': if (R.G && !R.G.over) { openGame(); break; } pregame(); break;
        case 'resume': openGame(); break;
        case 'quick': quickGame(); break;
        case 'post': C.startPost(X, L); simPostOthers(); queueCode('series', seriesTitle(), seriesCode()); save(true); render(); break;
        case 'post-sim': simPostOthers(); save(true); render(); break;
        case 'lu': { const i = +b.dataset.i; if (R.sub.sel == null) R.sub.sel = i; else { const lu = R.sub.lu; [lu[i], lu[R.sub.sel]] = [lu[R.sub.sel], lu[i]]; R.sub.sel = null; } pregame(); break; }
        case 'lu-b': { if (R.sub.sel == null) { toast('먼저 바꿀 선수를 누르세요'); break; } const slot = R.sub.lu[R.sub.sel]; if (slot.pos === 'P') { toast('투수 자리는 선발 투수에서 골라요'); break; } slot.id = b.dataset.id; R.sub.sel = null; pregame(); break; }
        case 'lu-sp': R.sub.sp = b.dataset.id; { const i = R.sub.lu.findIndex(x => x.pos === 'P'); if (i >= 0) R.sub.lu[i].id = b.dataset.id; } pregame(); break;
        case 'preset': prefs.preset = b.dataset.k; ls.set('prefs', prefs); if (R.G) closeSheet(); else pregame(); if (R.G && R.sub.inSettings) settingsSheet(); break;
        case 'speed': prefs.speed = b.dataset.k; ls.set('prefs', prefs); if (R.G) { closeSheet(); if (R.sub.inSettings) settingsSheet(); } else pregame(); break;
        case 'limit': prefs.limit = +b.dataset.k; ls.set('prefs', prefs); if (L) L.prefs.limit = prefs.limit; settingsSheet(); break;
        case 'playball': playBall(); break;
        case 'sheet-x': if (b.classList.contains('lg-scrim') && R.sheet && $('#lg-sheet').classList.contains('end')) break; closeSheet(); break;
        case 'g-auto': hideStop(); setAuto(!R.auto); break;
        case 'g-go': hideStop(); setAuto(true); break;
        case 'g-step': hideStop(); if (!R.busy) { R.busy = true; oneStep().then(() => { R.busy = false; if (R.G.over) { paintGame(); afterGame(); } }); } break;
        case 'g-stop': stopSheet(); break;
        case 'g-ff': { hideStop(); setAuto(false); const G = R.G; let n = 0; while (!G.over && n++ < 400) { const rng = C.RNG(L.rs); void rng; C.stepPA(X, L, G, {}); } paintGame(); paintTicker(true); afterGame(); break; }
        case 'g-ord': setAuto(false); decisionSheet(null, true); break;
        case 'ord': chooseOrder(+b.dataset.i); break;
        case 'g-dp': { setAuto(false); const my = R.G.teams.indexOf(L.my); openDP(R.G.half === my ? 'bat' : 'pit'); break; }
        case 'g-more': gameMore(); break;
        case 'g-end': afterGame(); if (!R.sheet) { R.sub.endShown = null; afterGame(); } break;
        case 'g-next': nextAfterGame(); break;
        case 'mid-send': { const req = ($('#lg-req') || {}).value || ''; R.sub.req = req; const text = C.midCode(X, L, R.G, req); const it = queueCode('mid', `중간로그 ${R.G.inn}회${C.half2(R.G.half)}`, text, { no: R.G.no }); L.sent[R.G.no] = R.G.log.length; deliver(it); R.sub.req = ''; break; }
        case 'paste-open': pasteSheet(); break;
        case 'paste': { const ta = $('#lg-paste'); const v = ta && ta.value.trim(); if (!v) { toast('크랙 답을 붙여 넣어 주세요'); break; } const p = readPaste(v); if (R.G && !R.G.over && R.sub.orderQ && R.sub.orderQ.length) { confirmOrders(); break; } if ($('#lg-pres')) { $('#lg-pres').innerHTML = pastedHtml(p); } else render(); if (R.G && !R.G.over) paintCtl(); toast(p.block ? '크랙 답을 읽었어요' : '【CRION】 블록 없이 장면만 읽었어요'); break; }
        case 'oq-ok': { const x = R.sub.orderQ.shift(); R.pendingOrd = x; toast(`반영: ${x.label}`); closeSheet(); if (!confirmOrders()) paintCtl(); break; }
        case 'oq-no': R.sub.orderQ.shift(); closeSheet(); confirmOrders(); break;
        case 'choice': { const v = b.dataset.v; if (solo && o.copy) o.copy(v); else if (o.send) o.send(v); toast(solo ? '선택지를 복사했어요' : '보냈어요'); break; }
        case 'deliver': { const it = (L.outbox || []).find(x => x.id === b.dataset.id); deliver(it); if (R.view === 'story' || R.view === 'home') { if (!R.sheet) render(); } break; }
        case 'ob-del': L.outbox = (L.outbox || []).filter(x => x.id !== b.dataset.id); save(); render(); break;
        case 'regen': { const it = (L.outbox || []).find(x => x.id === b.dataset.id); if (it && R.G) { it.text = C.gameCode(X, L, R.G, b.dataset.k); it.done = false; const pre = $('#lg-sheet pre'); if (pre) pre.textContent = it.text; save(); } break; }
        case 'mkcode': { const no = +b.dataset.no; toast('경기 화면에서 만든 로그는 이야기 탭에 있어요'); R.view = 'story'; render(); void no; break; }
        case 'scene': { const no = +b.dataset.no, i = +b.dataset.i; const lg = L.logs[no]; if (!lg) break; const r = lg.pa.find(x => x.i === i) || lg.pa[i]; const text = C.sceneCode(X, L, { teams: lg.teams, no }, r, ''); const it = queueCode('scene', `장면 #${no} ${r.inn}회${C.half2(r.half)} ${P(r.bat).name}`, text, { no }); (L.narrated[no] = L.narrated[no] || []).push(r.i); openSheet(`<div class="lg-mid"><p class="lg-k">이 장면 다시 이야기하기</p><pre>${esc(text)}</pre><div class="lg-row"><button class="lg-btn primary big" data-a="deliver" data-id="${it.id}">${solo ? ic('copy') + '복사' : '크랙으로 보내기'}</button></div></div>`, 'tall'); save(); break; }
        case 'glog': R.sub.no = +b.dataset.no; R.sub.back = R.view === 'gamelog' ? 'home' : R.view; R.view = 'gamelog'; render(); break;
        case 'gk': R.sub.gk = b.dataset.k; render(); break;
        case 'lk': R.sub.lk = b.dataset.k; render(); break;
        case 'tt': R.sub.tt = b.dataset.k; render(); break;
        case 'pl': playerSheet(b.dataset.id); break;
        case 'al': { const pl = R.sub.plan; const k = b.dataset.k, d = +b.dataset.d; const used = pl.train + pl.rest + pl.social; if (d > 0 && used >= 3) break; pl[k] = clamp(pl[k] + d, 0, 3); render(); break; }
        case 'al-f': R.sub.plan.focus = b.dataset.v; render(); break;
        case 'al-m': R.sub.plan.mate = b.dataset.v; render(); break;
        case 'al-ok': { const g = curGame(); L.career.plan = Object.assign({ si: g ? g.si : 0 }, R.sub.plan); toast('이번 주 일정을 정했어요 — 시리즈가 끝나면 반영돼요'); if (R.sub.plan.social) { const m = P(R.sub.plan.mate); queueCode('scene', `교류 · ${m.name}`, `⚾교류 ${L.me.name} × ${m.name} | ${C.weekLabel(L, g ? g.si : 0)}\n[장소] 실내 연습장 또는 숙소\n[상태] ${C.statusLine(X, L)}\n[요청] 두 사람이 시간을 보내는 장면`); } save(); render(); break; }
        case 'dp-guess': if (R.dp.phase === 'guess') { const z = +b.dataset.z; if (z < 9) { R.dp.guess = R.dp.guess === z ? null : z; paintDP(); } } else if (R.dp.phase === 'swing') dpResolveSwing(performance.now()); break;
        case 'dp-all': R.dp.guess = null; paintDP('전체 대기'); break;
        case 'dp-throw': dpThrow(); break;
        case 'dp-swing': dpResolveSwing(performance.now()); break;
        case 'dp-next': if (R.dp.kind === 'bat') { R.dp.phase = 'guess'; paintDP(); } else { R.dp.phase = 'type'; R.dp.pick = null; paintDP(); } break;
        case 'dp-type': R.dp.type = b.dataset.v; paintDP(); break;
        case 'dp-pick': if (R.dp.phase === 'type' || R.dp.phase === 'aim') { R.dp.pick = +b.dataset.z; R.dp.phase = 'aim'; paintDP(); } break;
        case 'dp-lock': dpLock(); break;
        case 'dp-auto': dpAuto(); break;
        case 'set': settingsSheet(); break;
      }
    }
    function gameMore() {
      const G = R.G;
      const no = G.no;
      openSheet(`<div class="lg-mid"><p class="lg-k">경기 메뉴</p>
        ${lineScore(G.line, G.score, G.hits, G.errs, G.teams, G.inn)}
        <div class="lg-opts">
          <button data-a="paste-open">${ic('clip')}크랙 답 붙여넣기 (작전 지시 읽기)</button>
          <button data-a="set">${ic('gear')}이야기 멈춤 · 보기 속도 · 글자 한도</button>
          ${G.log.length ? `<button data-a="scene" data-no="${no}" data-i="${G.log[G.log.length - 1].i}">${ic('talk')}방금 장면 다시 이야기하기</button>` : ''}
        </div></div>`);
      // 진행 중 경기 장면 보기용 로그
      R.L.logs[no] = R.L.logs[no] || { teams: G.teams, pa: [] };
      R.L.logs[no].pa = G.log.map(r => Object.assign({ p: r.pitches, sa: r.scoreAfter, w: [Math.round((r.wpb || 0) * 100), Math.round((r.wpa || 0) * 100)] }, r));
    }
    function settingsSheet() {
      R.sub.inSettings = true;
      openSheet(`<div class="lg-mid"><p class="lg-k">설정</p>
        <p class="lg-k">이야기 멈춤 (경기 중 자동으로 멈추는 곳)</p><div class="lg-seg">${Object.entries(PRESET).map(([k, v]) => `<button data-a="preset" data-k="${k}" class="${prefs.preset === k ? 'on' : ''}">${v.name}<small>${v.desc}</small></button>`).join('')}</div>
        <p class="lg-k">경기 보기</p><div class="lg-seg">${Object.entries(SPEED).map(([k, v]) => `<button data-a="speed" data-k="${k}" class="${prefs.speed === k ? 'on' : ''}">${v}</button>`).join('')}</div>
        <p class="lg-k">크랙에 보낼 글 길이 한도 (입력창 한도에 맞춰 명장면부터 줄여요)</p><div class="lg-seg">${[500, 800, 1000, 1500, 2000, 0].map(k => `<button data-a="limit" data-k="${k}" class="${prefs.limit === k ? 'on' : ''}">${k ? k + '자' : '없음'}</button>`).join('')}</div></div>`, '', () => { R.sub.inSettings = false; });
    }
    function openMenu() {
      const items = [
        { label: '설정 (멈춤·속도·글자 한도)', fn: settingsSheet },
        { label: '처음 화면 (시즌 고르기)', fn: () => { save(true); closeGame(); R.L = null; R.G = null; R.sub = {}; render(); } },
        { label: '3D 연습장', fn: open3D }
      ];
      if (o.menu) o.menu(items); else settingsSheet();
    }
    // 예전 3D 프로토타입 (타격·투구·홈런 더비) — CrionBaseball
    let bb3 = null;
    function open3D() {
      if (!root.CrionBaseball) { toast('3D 화면을 열 수 없어요'); return; }
      const box = document.createElement('div'); box.className = 'lg-3d';
      box.innerHTML = `<button class="lg-ib lg-3dx" aria-label="닫기">${ic('x')}</button>`;
      el.appendChild(box);
      const spr = data.sprites && data.sprites.pitcher;
      const pitcherSprite = spr && o.files && o.files.has(spr.atlas) ? o.files.json(spr.meta).then(meta => ({ url: o.files.url(spr.atlas), meta })) : null;
      const MF = { man: 'character_man.glb', cap: 'cap_baseball.glb', glove: 'glove.glb', bat: 'bat_baseball.glb', ball: 'ball_baseball.glb', light: 'light_post.glb', board: 'billboard.glb', bench: 'bench.glb' };
      const models = o.files && o.files.has('assets/models/' + MF.man) ? Object.fromEntries(Object.entries(MF).filter(([, f]) => o.files.has('assets/models/' + f)).map(([k, f]) => [k, o.files.url('assets/models/' + f)])) : null;
      bb3 = root.CrionBaseball.create(box, { pitcherSprite, models, copy: (t) => o.copy && o.copy(t) });
      box.querySelector('.lg-3dx').addEventListener('click', () => { if (bb3) bb3.destroy(); bb3 = null; box.remove(); });
    }

    el.addEventListener('click', onClick);
    const onKey = (e) => {
      if (R.dp && R.dp.phase === 'swing' && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); dpResolveSwing(performance.now()); }
      else if (R.dp && R.dp.phase === 'aim' && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); dpLock(); }
    };
    document.addEventListener('keydown', onKey);
    // 시작: 마지막 세이브가 있으면 타이틀(이어하기)
    render();

    return {
      onIpc() { /* 크랙 화면 없음 (혼자 실행). 크랙 작품이 열리면 여기서 crion:reply 를 readPaste 로 */ },
      destroy() { dead = true; clearTimeout(R.timer); cancelAnimationFrame(gaugeRaf); save(true); el.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); if (bb3) bb3.destroy(); el.remove(); },
      get state() { return R; },
      // 시험용
      debug: { X, C, R, render, openGame, paintGame, playBall, pregame, nextAfterGame, readPaste, quickGame, openDP, dpThrow, dpResolveSwing, dpLock, afterGame, stopSheet, setAuto, oneStep, showPA: (r) => showPA(r) },
      memory: {}, saves: () => saves()
    };
  }
  root.CrionLeagueRun = { start };
})(window);
