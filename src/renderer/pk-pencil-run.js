// 플레이팩 실행기 — 「온리펜슬」 (runner: "pencil") · 모바일 우선
//  디자인: '자정의 연습장' — 밤 책상 위 연습장. 대사창은 줄 노트 종이, 주문은 손글씨, 잉크는 구릿빛 연필 한 자루
//  - 연필 게이지: 잉크 %만큼 연필이 길다. 쓰면 깎여 짧아지고, 충전되면 다시 길어진다. GOD = ∞ 금빛, 소멸 = 회색 평범한 연필
//  - 펜슬 노트: 주문을 적으면 잉크가 얼마나 들지 '예상'(빌더 규칙 그대로), 대상·지속 칩, 주문 사전, 최근 주문 → 입력칸에 :(주문): 채우기
//  - 주문 연출: 손글씨가 써지고 잉크처럼 번져 스민다(📜 주문 -n%). 충전 +40% 은 연필이 다시 자란다
//  - 마음: 만난 사람의 호감 -100~+100 (적대·냉소·우호·신뢰·함락), 아린의 +50 벽과 🔓, 추이 · 폰: [카톡] 대화방 · 노트: 효과·주문 장부 · 일지: 하루 기록
//  - 버튼은 입력칸에 글만 채운다(보내기는 플레이어가 한 번). 숫자는 크랙 상태창 그대로 — 잉크 예상은 참고용
(function (root) {
  'use strict';
  const U = root.CrionPencil;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => u ? `url('${String(u).replace(/['"\\\n<>]/g, (c) => encodeURIComponent(c))}')` : 'none';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SPEED = { slow: 42, normal: 22, fast: 9, instant: 0 };
  const josa = (w, a, b) => { const c = String(w || '').charCodeAt(String(w || '').length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };
  const ICON = {
    back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    stage: '<path d="M4 5.5h16v11H4z"/><path d="M9 20h6M12 16.5V20"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    phone: '<rect x="6.5" y="3" width="11" height="18" rx="2.4"/><path d="M10.5 18h3"/>',
    note: '<path d="M6 3.5h9.5L19 7v13.5H6z"/><path d="M9 9h7M9 12.5h7M9 16h4"/>',
    book: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/>',
    pen: '<path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z"/><path d="M13.5 7l3.5 3.5"/>',
    pin: '<path d="M12 21s6-5.6 6-10.2A6 6 0 0 0 6 10.8C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/>',
    send: '<path d="M4 12l16-7-6 16-3-6.5z"/><path d="M11 14.5L20 5"/>',
    chat: '<path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5H4.5z"/>',
    hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 5 16.2L4 13.5a1.5 1.5 0 0 1 2.6-1.4L8 14"/>'
  };
  const ic = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const ZC = { 적대: '#a33b55', 냉소: '#7b8499', 우호: '#ef8fb1', 신뢰: '#ff4f86', 함락: '#ffcf5a' };
  const MODE = { NORMAL: { t: 'NORMAL', c: '#d4884f' }, GOD: { t: 'GOD', c: '#ffd36a' }, HARD: { t: 'HARD', c: '#e2465f' } };

  // 연필 한 자루 = 잉크. 길이가 곧 잔량 (ghost = 이번 주문으로 깎일 부분)
  function pencilSvg(ink, opt) {
    opt = opt || {};
    const god = ink === Infinity, gone = opt.gone;
    const v = god ? 100 : gone ? 100 : clamp(ink == null ? 100 : ink, 0, 100);
    const L = 34 + 214 * v / 100;          // 몸통 길이
    const x0 = 30, x1 = x0 + L;            // 몸통 끝 = 깎인 시작
    const g = !god && !gone && opt.ghost ? clamp(opt.ghost, 0, v) : 0;
    const gx = x0 + 34 + 214 * (v - g) / 100;
    const uid = 'p' + Math.random().toString(36).slice(2, 7);
    return `<svg class="op-pencil${god ? ' god' : ''}${gone ? ' gone' : ''}${!god && !gone && v <= 20 ? ' low' : ''}" viewBox="0 0 320 30" preserveAspectRatio="xMinYMid meet" aria-hidden="true">
      <defs><linearGradient id="${uid}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gone ? '#c9c4bb' : god ? '#fff1b8' : '#f2b27c'}"/><stop offset=".45" stop-color="${gone ? '#a39e95' : god ? '#e7b84a' : '#c9783f'}"/><stop offset="1" stop-color="${gone ? '#77736b' : god ? '#a87a1c' : '#7d4220'}"/></linearGradient>
      <linearGradient id="${uid}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e3c8"/><stop offset="1" stop-color="#c9a77f"/></linearGradient>
      <linearGradient id="${uid}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf2"/><stop offset=".5" stop-color="#9aa3ad"/><stop offset="1" stop-color="#5d646d"/></linearGradient></defs>
      <rect x="2" y="6" width="18" height="18" rx="5" fill="${gone ? '#b8a9a9' : '#e98b97'}"/>
      <rect x="18" y="5" width="13" height="20" rx="1.5" fill="url(#${uid}m)"/><path d="M21 5v20M25 5v20M28 5v20" stroke="#5d646d" stroke-width=".7" opacity=".6"/>
      <rect class="op-pbody" x="${x0}" y="5" width="${L}" height="20" fill="url(#${uid}b)"/>
      <path d="M${x0} 11.7h${L}M${x0} 18.3h${L}" stroke="#000" stroke-opacity=".16" stroke-width=".8"/>
      ${L > 90 ? `<text x="${x0 + 12}" y="18.6" class="op-pname">ONLY PENCIL</text>` : ''}
      ${g ? `<rect class="op-pghost" x="${gx}" y="5" width="${x1 - gx}" height="20"/>` : ''}
      <path d="M${x1} 5 L${x1 + 30} 15 L${x1} 25 Z" fill="url(#${uid}w)"/><path d="M${x1 + 19} 11.3 L${x1 + 30} 15 L${x1 + 19} 18.7 Z" fill="${god ? '#ffcf5a' : gone ? '#6b6b6b' : '#2b2f3a'}"/>
      ${god ? `<circle class="op-pspark" cx="${x1 + 30}" cy="15" r="3.4"/>` : ''}
    </svg>`;
  }
  // 호감 막대: -100 ~ +100, 0 눈금, 구간색, 아린 +50 벽
  function heartBar(v, cap, open) {
    const pos = v == null ? 50 : clamp((v + 100) / 2, 0, 100);
    const z = U.zoneOf(v);
    return `<span class="op-hbar" title="${v == null ? '' : v + ' · ' + z}"><i class="op-hzero"></i>${cap && !open ? `<i class="op-hcap" style="left:${(cap + 100) / 2}%"></i>` : ''}<b style="left:${pos}%;--zc:${ZC[z] || '#ef8fb1'}"></b></span>`;
  }
  function spark(h) {
    const pts = (h || []).map(p => p[1]).filter(v => v != null);
    if (pts.length < 2) return '';
    const W = 120, H = 26, n = pts.length;
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (n - 1) * W).toFixed(1)} ${(H - (v + 100) / 200 * H).toFixed(1)}`).join(' ');
    return `<svg class="op-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="z" d="M0 ${H / 2}H${W}"/><path d="${d}"/></svg>`;
  }

  function start(o) {
    const el = o.el;
    const data = o.data || {};
    const roster = new U.Roster(data);
    const IDX = new U.ImgIndex(data);
    const IMG = (name) => IDX.url(name);
    const asset = (p) => { try { return o.files && o.files.has(p) ? o.files.url(p) : ''; } catch (e) { return ''; } };
    const PEOPLE = data.people || [];
    const RO = Object.fromEntries(PEOPLE.map(r => [r.name, r]));
    const PLACES = data.places || {};
    const PW = Object.entries(PLACES).flatMap(([k, v]) => [k].concat(v.k || []).map(w => [w.replace(/\s/g, ''), k])).sort((a, b) => b[0].length - a[0].length);
    const placeKeyOf = (t) => { const x = String(t || '').replace(/\s/g, ''); const hit = PW.find(([w]) => x.includes(w)); return hit ? hit[1] : ''; };
    const PLACE_IMG = (k) => IMG('배경_' + k);
    const short = (n) => (RO[n] && RO[n].key) || n;
    const colorOf = (n) => (RO[n] || {}).color || '';

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
    M.prefs = Object.assign({ speed: 'normal', fx: true }, lsGet(PREF_KEY, {}));
    let saveId = null, saveT = null;
    const st0 = () => M.status || {};
    const modeOf = () => st0().mode || (curSave() && curSave().mode) || 'NORMAL';
    const me = () => { const n = String(st0().me || '').replace(/\{user\}/g, '').trim(); return n && n !== '주인공' ? n : '나'; };
    const save = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        lsSet(PREF_KEY, M.prefs);
        if (!saveId) return;
        M.lines = M.lines.slice(-200);
        const { prefs, ...mem } = M;
        lsSet(memKey(saveId), mem);
        const sv = curSave();
        if (sv) { const st = st0(); sv.sum = { day: st.day || 0, time: st.time || '', place: st.place || '', ink: st.ink === Infinity ? '∞' : st.gone ? '소멸' : st.ink, bg: M.lastBg || '', me: me() }; if (st.mode) sv.mode = st.mode; sv.last = Date.now(); putSaves(); }
      }, 300);
    };
    function useSave(id) {
      saveId = id;
      const mem = Object.assign(U.blank(), id ? lsGet(memKey(id), {}) : {});
      Object.keys(U.blank()).forEach(k => { M[k] = mem[k]; });
    }
    const curSave = () => saves.find(x => x.id === saveId) || null;

    const R = {
      mode: 'title', boundUrl: '', away: false, newFlow: null, curUrl: '', page: 'chat', actions: [], sm: null,
      beats: [], i: -1, typing: null, waiting: false, sentAt: 0, lastKey: '', sent: [],
      tab: 'stage', sideTab: 'heart', sub: null, chat: null, modal: null, bgKey: '', placeK: '자취방', present: [], noteText: '', regPending: false
    };
    const SIDE_TABS = [['heart', '마음', 'heart'], ['phone', '폰', 'phone'], ['note', '노트', 'note'], ['log', '일지', 'book']];
    const PHONE_TABS = [['stage', '무대', 'stage']].concat(SIDE_TABS);

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="op">
      <div class="op-main">
        <div class="op-stage" id="op-stage">
          <div class="op-bg"><i class="op-bgl"></i><i class="op-bgl"></i><span class="op-bgname" id="op-bgname"></span></div><div class="op-sky"></div>
          <div class="op-pt" id="op-pt"><img alt=""></div>
          <header class="op-hud" id="op-hud"></header>
          <div class="op-fxs" id="op-fxs"></div>
          <div class="op-pops" id="op-pops" aria-live="polite"></div>
          <div class="op-daycard" id="op-daycard" aria-hidden="true"></div>
          <div class="op-dlg" id="op-dlg" data-op="next"></div>
        </div>
        <aside class="op-side" id="op-side">
          <nav class="op-stabs" id="op-stabs"></nav>
          <div class="op-panel" id="op-panel"></div>
        </aside>
      </div>
      <footer class="op-foot">
        <div class="op-sugg" id="op-sugg"></div>
        <div class="op-est" id="op-est" hidden></div>
        <div class="op-comp">
          <button class="op-penbtn" data-op="pen" aria-label="펜슬 노트 — 주문 쓰기">${ic('pen')}<span>주문</span></button>
          <textarea id="op-in" rows="1" placeholder="말이나 *행동*, 주문은 :(이렇게): (Enter 보내기 · Shift+Enter 줄바꿈)"></textarea>
          <button class="op-actbtn" data-op="act" title="*행동* 넣기">${ic('hand')}</button>
          <button class="op-send" data-op="send" aria-label="보내기">${ic('send')}</button>
        </div>
      </footer>
      <nav class="op-tabs" id="op-tabs"></nav>
      <div class="op-layer" id="op-title" hidden></div>
      <div class="op-layer op-sheetwrap" id="op-note" hidden></div>
      <div class="op-layer op-sheetwrap" id="op-reg" hidden></div>
      <div class="op-layer" id="op-cast" hidden></div>
      <div class="op-over" id="op-modal" hidden><div class="op-box" id="op-box" role="dialog"></div></div>
      <div class="op-banner" id="op-banner" hidden></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const opRoot = $('.op');
    const narrow = () => { try { return root.matchMedia('(max-width: 760px)').matches; } catch (e) { return false; } };
    if (narrow()) $('#op-in').placeholder = '말, *행동*, 주문 :( ):';
    [opRoot, $('.op-main'), $('#op-stage')].forEach(n => n.addEventListener('scroll', () => { if (n.scrollTop || n.scrollLeft) { n.scrollTop = 0; n.scrollLeft = 0; } }));
    opRoot.classList.toggle('nofx', !M.prefs.fx);
    opRoot.addEventListener('focusin', (e) => { if (e.target.id === 'op-in') opRoot.classList.add('typing'); });
    opRoot.addEventListener('focusout', () => { setTimeout(() => { const a = document.activeElement; if (!a || a.id !== 'op-in') opRoot.classList.remove('typing'); }, 60); });
    const toast = (t) => o.toast(t);
    const K = root.CrionKit ? root.CrionKit.create({
      el, accent: '#d4884f', packId: PK_ID, packName: data.title || '온리펜슬', toast: o.toast,
      fontTargets: ['.op-dlg'], unit: (l) => (l.d || 0) + '일차',
      coach: [
        { sel: '#op-hud .op-inkbtn', title: '온리펜슬', text: '연필 길이가 남은 잉크예요. 주문을 쓰면 깎여서 짧아지고, 충전되면 다시 길어져요.' },
        { sel: '.op-penbtn', title: '주문 쓰기', text: '펜슬 노트를 열어요. 주문을 적으면 잉크가 얼마나 들지 미리 보여 주고, :(주문): 형태로 입력칸에 넣어 줘요.' },
        { sel: '#op-dlg', title: '대사창', text: '누르면 다음 대사로 넘어가요. 손글씨는 속마음이에요.' },
        { sel: '#op-sugg', title: '행동 칩', text: '지금 시간·장소에 맞는 행동을 입력칸에 채워요. 보내기는 직접 눌러요.' },
        { sel: '#op-tabs', title: '아래 탭', text: '마음(호감) · 폰(카톡) · 노트(효과·주문 장부) · 일지를 여기서 봐요.' },
        { sel: '#op-stabs', title: '옆 패널', text: '마음(호감) · 폰(카톡) · 노트(효과·주문 장부) · 일지를 여기서 봐요.' }
      ]
    }) : null;

    // ---------- 배경 · 인물 ----------
    let bgFlip = 0;
    function setBg(src) {
      if (!src || src === R.bgKey) return;
      R.bgKey = src;
      const ls = el.querySelectorAll('.op-bgl');
      bgFlip = 1 - bgFlip;
      ls[bgFlip].style.backgroundImage = cssUrl(src);
      ls[bgFlip].classList.add('on'); ls[1 - bgFlip].classList.remove('on');
      M.lastBg = src;
      $('#op-bgname').textContent = '';
    }
    function setPlaceName(k) { if (!R.bgKey) $('#op-bgname').textContent = k || ''; }
    function setPortrait(src, who) {
      const pt = $('#op-pt'), im = pt.querySelector('img');
      if (!src) { pt.classList.remove('on'); return; }
      if (im.getAttribute('src') !== src) {
        pt.classList.remove('on'); void pt.offsetWidth;
        im.onload = () => { pt.classList.toggle('wide', im.naturalWidth / Math.max(1, im.naturalHeight) >= 1.2); };
        im.src = src;
      }
      pt.style.setProperty('--glow', colorOf(who) || '#d4884f');
      pt.classList.add('on');
    }
    function setSky() {
      const st = st0();
      $('.op-sky').className = 'op-sky t-' + ({ 아침: 'am', 낮: 'day', 저녁: 'eve', 밤: 'night', 심야: 'late' }[st.time] || 'day');
    }

    // ---------- 머리 (날 · 시간 · 장소 · 연필 · 효과) ----------
    function renderHud(ghost) {
      const st = st0();
      const md = MODE[modeOf()] || MODE.NORMAL;
      const ti = U.TIMES.indexOf(st.time);
      const inkTxt = st.gone ? '소멸' : st.ink === Infinity ? '∞' : st.ink == null ? (modeOf() === 'GOD' ? '∞' : '100') : st.ink;
      const ink = st.gone ? null : st.ink === undefined ? (modeOf() === 'GOD' ? Infinity : 100) : st.ink;
      $('#op-hud').innerHTML = `
        <div class="op-hrow">
          <div class="op-when"><b>${st.day != null ? st.day : 1}<small>일차</small></b><span class="op-times" title="${esc(st.time || '')}">${U.TIMES.map((t, i) => `<i class="${i === ti ? 'on' : i < ti ? 'past' : ''}"></i>`).join('')}<em>${esc(st.time || '아침')}</em></span></div>
          <div class="op-where">${ic('pin')}<span>${esc(st.place || '자취방')}</span></div>
          <span class="op-mode" style="--mc:${md.c}">${md.t}</span>
          <button data-op="more" class="op-more" aria-label="메뉴">${ic('more')}</button>
        </div>
        <button class="op-inkbtn" data-op="pen" aria-label="잉크 ${esc(inkTxt)}">${pencilSvg(ink, { gone: st.gone, ghost })}<span class="op-inkv ${st.gone ? 'gone' : ''}">${st.gone ? '평범한 연필' : esc(inkTxt) + (inkTxt === '∞' ? '' : '<small>%</small>')}</span></button>`;
      const fx = st.effects || [];
      $('#op-fxs').innerHTML = fx.slice(0, 4).map(e => `<span class="op-fxtag ${e.left === Infinity ? 'perm' : e.left != null && e.left <= 1 ? 'end' : ''}"><b>${esc(e.t)}</b><em>${e.left === Infinity ? '영구' : e.left != null ? e.left + '턴' : ''}</em></span>`).join('') + (fx.length > 4 ? `<span class="op-fxtag more">+${fx.length - 4}</span>` : '');
    }

    // ---------- 알림 ----------
    function pop(html, cls) {
      if (!M.prefs.fx && !/big/.test(cls || '')) return;
      const box = $('#op-pops');
      const n = document.createElement('div');
      n.className = 'op-pop ' + (cls || '');
      n.innerHTML = html;
      box.appendChild(n);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 500); }, /big/.test(cls || '') ? 4600 : 3200);
    }
    function dayCard(d, time) {
      if (!M.prefs.fx) return;
      const c = $('#op-daycard');
      c.innerHTML = `<b>${d}<small>일차</small></b><span>${esc(time || '아침')}</span>`;
      c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    }
    function notifyEvents(ev) {
      if (ev.day) dayCard(ev.day.to, st0().time);
      ev.met.forEach(n => { if (RO[n]) pop(`<i class="dot" style="--c:${colorOf(n)}"></i><b>${esc(n)}</b><span>마음 탭에 적었어요</span>`, 'met'); });
      ev.heart.forEach(a => {
        const d = a.to - a.from;
        if (a.zoneChanged) pop(`<i class="dot" style="--c:${colorOf(a.n)}"></i><b>${esc(a.n)}</b><span>마음이 <u style="color:${ZC[a.zone]}">${esc(a.zone)}</u>(으)로</span>`, 'big heart');
        else if (d) pop(`<i class="dot" style="--c:${colorOf(a.n)}"></i><b>${esc(a.n)}</b><span class="${d > 0 ? 'up' : 'dn'}">💗 ${d > 0 ? '+' : ''}${d}</span>`, 'heart');
      });
      ev.unlocked.forEach(n => pop(`${ic('unlock')}<b>${esc(n)}</b><span>마음의 벽이 열렸어요 — 이제 +100까지</span>`, 'big unlock'));
      ev.effectsEnd.forEach(e => pop(`<i class="dot fx"></i><b>${esc(e.t)}</b><span>효과가 풀렸어요</span>`, 'fxend'));
      if (ev.refill) { pop(`<i class="dot ink"></i><b>잉크 충전</b><span class="up">+${ev.refill}%</span>`, 'big refill'); refillFx(); }
      if (ev.fizzle) pop(`<i class="dot fx"></i><b>불발</b><span>글자가 스며들지 않았어요</span>`, 'big fizzle');
      if (ev.gone) pop(`<i class="dot fx"></i><b>온리펜슬</b><span>평범한 연필이 됐어요</span>`, 'big gone');
      ev.kakao.forEach(k => { if (R.tab !== 'phone') pop(`${ic('chat')}<b>${esc(k.who)}</b><span>${esc(k.text.slice(0, 28))}</span>`, 'kakao'); R.newChat = true; });
    }
    function refillFx() {
      if (!M.prefs.fx) return;
      const b = $('#op-hud .op-inkbtn'); if (!b) return;
      b.classList.remove('refill'); void b.offsetWidth; b.classList.add('refill');
    }

    // ---------- 패널: 마음 ----------
    const faceOf = (n) => M.faces[n] || IMG(n + '_통상') || '';
    const mono = (n) => `<span class="op-mono" style="--c:${colorOf(n) || '#d4884f'}">${esc(short(n).slice(0, 1))}</span>`;
    const avatar = (n, cls) => { const f = faceOf(n); return f ? `<img class="${cls || ''}" src="${esc(f)}" alt="" loading="lazy">` : mono(n); };
    function heartHtml() {
      if (R.sub && RO[R.sub]) return personHtml(R.sub);
      const met = PEOPLE.filter(p => M.met.includes(p.name) || M.hearts[p.name] != null);
      const unmetMain = PEOPLE.filter(p => p.main && !met.includes(p));
      const unmetSub = PEOPLE.filter(p => !p.main && !met.includes(p));
      const card = (p) => {
        const v = M.hearts[p.name], z = M.zones[p.name] || U.zoneOf(v), open = !!M.unlock[p.name];
        return `<button class="op-pcard ${v >= 100 ? 'fall' : ''}" data-op="who" data-k="${esc(p.name)}" style="--c:${p.color}">
          <span class="op-pimg">${avatar(p.name)}${R.present.includes(p.name) ? '<em class="op-here">지금 여기</em>' : ''}</span>
          <span class="op-pmeta">
            <span class="op-pname"><b>${esc(p.name)}</b><small>${p.age}</small>${p.cap ? `<i class="op-lockic ${open ? 'open' : ''}" title="${open ? '벽이 열림' : '+' + p.cap + '에서 막힘'}">${ic(open ? 'unlock' : 'lock')}</i>` : ''}</span>
            <span class="op-prole">${esc(p.role)}</span>
            ${v != null ? `<span class="op-prow">${heartBar(v, p.cap, open)}<b class="op-hv" style="color:${ZC[z] || ''}">${v > 0 ? '+' : ''}${v}</b></span><span class="op-pz"><u style="color:${ZC[z] || ''}">${esc(z)}</u>${spark((M.hist || {})[p.name])}</span>` : '<span class="op-pz none">아직 마음을 몰라요</span>'}
          </span></button>`;
      };
      return `<header class="op-ph"><h3>마음</h3><p>호감은 말보다 행동으로 움직여요. -100 적대 · 냉소 · 우호 · 신뢰 · +100 함락.</p></header>
        <div class="op-plist">${met.map(card).join('')}
        ${unmetMain.map(p => `<div class="op-pcard soon" style="--c:${p.color}"><span class="op-pimg">${mono(p.name)}</span><span class="op-pmeta"><span class="op-pname"><b>${esc(p.name)}</b><small>${p.age}</small></span><span class="op-prole">${esc(p.role)}</span><span class="op-pz none">${ic('pin')}${esc(p.where)}</span></span></div>`).join('')}</div>
        ${unmetSub.length ? `<h4 class="op-h4">아직 만나지 않은 사람 <small>${unmetSub.length}명</small></h4><div class="op-ghosts">${unmetSub.map(p => `<span class="op-ghost"><i>?</i><small>${esc(p.where.split(' ')[0])}</small></span>`).join('')}</div>` : ''}`;
    }
    function personHtml(n) {
      const p = RO[n], v = M.hearts[n], z = M.zones[n] || U.zoneOf(v), open = !!M.unlock[n];
      const seen = Object.keys(M.seen || {}).filter(k => k.startsWith(n + '_') && !(IDX.info(k) || {}).adult);
      const chats = (M.chats[n] || []).length;
      return `<header class="op-ph row"><button class="op-back" data-op="sub-back" aria-label="뒤로">${ic('back')}</button><h3>${esc(n)}</h3><span class="op-age">${p.age}세</span></header>
        <div class="op-file" style="--c:${p.color}">
          <div class="op-fimg">${avatar(n)}</div>
          <div class="op-fbody">
            <p class="op-frole">${esc(p.role)}</p>
            <p class="op-flook">${esc(p.look)}</p>
            <p class="op-fvibe">${esc(p.vibe)}</p>
            <blockquote class="op-fline">${esc(p.line)}</blockquote>
          </div>
        </div>
        <div class="op-fstat"><span>마음</span>${v != null ? `<div>${heartBar(v, p.cap, open)}<p><b style="color:${ZC[z] || ''}">${esc(z)}</b> · ${v > 0 ? '+' : ''}${v}${p.cap ? (open ? ' · 🔓 벽이 열림' : ` · +${p.cap}에서 막혀요`) : ''}</p>${spark((M.hist || {})[n])}</div>` : '<div><p>아직 몰라요. 만나면 상태창에 나타나요.</p></div>'}</div>
        ${p.note ? `<div class="op-fstat"><span>알아 둘 것</span><div><p>${esc(p.note)}</p></div></div>` : ''}
        <div class="op-fstat"><span>만나는 곳</span><div><p>${esc(p.where)}</p></div></div>
        <div class="op-btns"><button class="op-btn ink" data-op="fill" data-v="${esc(josa(short(n), '을', '를'))} 찾아간다.">찾아가기</button><button class="op-btn" data-op="fill" data-v="${esc(short(n))}에게 말을 건다.">말 걸기</button>${chats ? `<button class="op-btn" data-op="chat" data-k="${esc(n)}">카톡 ${chats}</button>` : ''}<button class="op-btn" data-op="spell-to" data-k="${esc(n)}">${ic('pen')}주문 대상</button></div>
        ${seen.length ? `<h4 class="op-h4">본 얼굴 <small>${seen.length}</small></h4><div class="op-grid">${seen.map(k => `<button data-op="view" data-k="${esc(k)}"><img src="${esc(IMG(k) || '')}" alt="" loading="lazy"><small>${esc(k.split('_').slice(1).join(' '))}</small></button>`).join('')}</div>` : ''}`;
    }
    // ---------- 패널: 폰 (카톡) ----------
    function phoneHtml() {
      const rooms = Object.entries(M.chats || {}).map(([n, list]) => [n, list]).sort((a, b) => (b[1].length && a[1].length ? 0 : b[1].length - a[1].length));
      if (R.chat && M.chats[R.chat]) {
        const n = R.chat, list = M.chats[n];
        let lastD = null;
        return `<div class="op-kroom">
          <header class="op-khead"><button class="op-back" data-op="chat-back" aria-label="뒤로">${ic('back')}</button>${avatar(n, 'op-kav')}<b>${esc(n)}</b></header>
          <div class="op-kmsgs">${list.map(m => { const hd = m.d !== lastD ? `<h5>${m.d || 0}일차${m.time ? ' ' + esc(m.time) : ''}</h5>` : ''; lastD = m.d; return hd + `<p class="${m.me ? 'me' : ''}"><span>${esc(m.t)}</span></p>`; }).join('')}</div>
          <button class="op-kreply" data-op="fill" data-v="*${esc(short(n))}에게 카톡을 보낸다* ">${ic('chat')} 답장 쓰기 <small>입력칸에 채워요</small></button></div>`;
      }
      return `<header class="op-ph"><h3>폰</h3><p>크랙에 온 [카톡]을 사람별로 모아요. 번호를 교환해야 연락이 와요.</p></header>
        ${rooms.length ? `<div class="op-klist">${rooms.map(([n, list]) => { const last = list[list.length - 1] || {}; return `<button class="op-krow" data-op="chat" data-k="${esc(n)}" style="--c:${colorOf(n) || '#9aa'}">${avatar(n, 'op-kav')}<span><b>${esc(n)}</b><small>${esc(last.t || '')}</small></span><em>${list.length}</em></button>`; }).join('')}</div>`
          : `<div class="op-empty"><i>${ic('phone')}</i><b>아직 온 연락이 없어요</b><span>번호를 교환하면 여기로 와요.</span></div>`}`;
    }
    // ---------- 패널: 노트 (규칙 · 효과 · 주문 장부) ----------
    function noteHtml() {
      const st = st0(), sp = M.spells || [];
      const used = sp.reduce((a, s) => a + (s.cost || 0), 0);
      const fx = st.effects || [];
      const T = U.TIERS;
      return `<header class="op-ph"><h3>펜슬 노트</h3><p>적으면 이루어진다. 판정은 관대하게, 애매하면 내 쪽으로.</p></header>
        <button class="op-bigpen" data-op="pen">${pencilSvg(st.gone ? null : st.ink === undefined ? (modeOf() === 'GOD' ? Infinity : 100) : st.ink, { gone: st.gone })}<b>주문 쓰기</b><small>잉크 예상 · 대상 · 지속 · 주문 사전</small></button>
        <h4 class="op-h4">걸려 있는 효과 <small>${fx.length}</small></h4>
        ${fx.length ? `<ul class="op-fxlist">${fx.map(e => `<li><b>${esc(e.t)}</b><em>${e.left === Infinity ? '영구' : e.left != null ? e.left + '턴 남음' : ''}</em></li>`).join('')}</ul>` : '<p class="op-empty-s">지금 걸려 있는 효과가 없어요.</p>'}
        <h4 class="op-h4">잉크 규칙 <small>${esc(modeOf())}</small></h4>
        <div class="op-rules">${Object.entries(T).map(([k, v]) => `<div style="--c:${v.c}"><b>${esc(v.t)}</b><span>${v.lo === v.hi ? v.lo + '% · 100%일 때만' : v.lo + '~' + v.hi + '%'}${k === 'mind' ? ' · 최대 5턴' : ''}</span></div>`).join('')}
          <p>대상 1명 추가마다 +10% · 지속시간을 안 적으면 영구 · 상대를 절정시키면 +40%(같은 사람은 한 장면 1회) · ${modeOf() === 'HARD' ? 'HARD: 소모 1.5배' : modeOf() === 'GOD' ? 'GOD: 잉크 ∞, 제한 없음' : '잔량이 모자라면 약하게·짧게만'}</p>
          <p class="warn">정체를 직접 밝히거나 연필을 넘기면 평범한 연필이 돼요.</p></div>
        <h4 class="op-h4">주문 장부 <small>${sp.length}번 · 잉크 ${used}% · 충전 ${M.refills || 0}번</small></h4>
        ${sp.length ? `<ol class="op-ledger">${sp.slice().reverse().slice(0, 40).map(s => `<li><span class="op-lq">:( ${esc(s.t)} ):</span><em class="${s.fizzle ? 'fz' : ''}">${s.fizzle ? '불발' : s.cost != null ? (s.mode === 'GOD' ? '∞' : '−' + s.cost + '%') : '?'}</em><small>${s.d || 0}일차 ${esc(s.time || '')}</small><button class="op-link" data-op="reuse" data-v="${esc(s.t)}">다시</button></li>`).join('')}</ol>` : '<p class="op-empty-s">주문을 쓰면 실제로 든 잉크가 여기 쌓여요. 다음 주문의 감을 잡는 데 써요.</p>'}`;
    }
    // ---------- 패널: 일지 ----------
    function logHtml() {
      const ds = Object.entries(M.days || {}).map(([d, v]) => [+d, v]).sort((a, b) => b[0] - a[0]);
      const seen = Object.keys(M.seen || {});
      return `<header class="op-ph"><h3>일지</h3><p>하루마다 다녀간 곳, 만난 사람, 쓴 주문.</p></header>
        <div class="op-lbtns"><button class="op-albumbtn" data-op="album"><b>본 그림</b><span>${seen.length}장</span></button><button class="op-albumbtn" data-op="lines"><b>지난 대사</b><span>${M.lines.length}줄</span></button></div>
        ${ds.length ? `<div class="op-days">${ds.map(([d, v]) => `<article class="op-day"><header><b>${d}<small>일차</small></b><span>${esc((v.places || []).join(' → '))}</span></header>
            ${v.first ? `<p class="op-dq">${esc(v.first)}${v.first.length >= 90 ? '…' : ''}</p>` : ''}
            ${(v.met || []).length ? `<div class="op-met">${v.met.map(n => `<span style="--c:${colorOf(n) || '#9aa'}">${esc(n)}</span>`).join('')}</div>` : ''}
            ${v.spells ? `<p class="op-dsp">${ic('pen')} 주문 ${v.spells}번 · 잉크 ${v.ink}%</p>` : ''}
            ${(v.notes || []).length ? `<ul>${v.notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</div>`
          : '<p class="op-empty-s">이야기가 시작되면 하루마다 한 장씩 쌓여요.</p>'}`;
    }
    function albumHtml() {
      const all = Object.keys(M.seen || {});
      const byWho = {};
      all.forEach(k => { const i = IDX.info(k) || {}; const g = i.kind === 'person' ? i.who : i.kind === 'place' ? '장소' : '온리펜슬'; (byWho[g] = byWho[g] || []).push(k); });
      const order = PEOPLE.map(p => p.name).concat(['장소', '온리펜슬']).filter(g => byWho[g]);
      return `<h3>본 그림</h3>${order.length ? order.map(g => `<h4 class="op-h4">${esc(g)} <small>${byWho[g].length}</small></h4><div class="op-grid">${byWho[g].map(k => `<button data-op="view" data-k="${esc(k)}"><img src="${esc(IMG(k))}" alt="" loading="lazy"><small>${esc(k.split('_').slice(1).join(' '))}</small></button>`).join('')}</div>`).join('') : '<p class="op-empty-s">빌더 그림 목록이 팩에 들어오면, 본 그림이 여기 모여요.</p>'}`;
    }
    function renderPanel() {
      const tab = R.tab === 'stage' ? R.sideTab : R.tab;
      R.sideTab = tab;
      const dot = (k) => (k === 'phone' && R.newChat) || (k === 'log' && R.newDay) || (k === 'heart' && R.newMet) ? '<em></em>' : '';
      $('#op-stabs').innerHTML = SIDE_TABS.map(([k, n, i]) => `<button data-op="tab" data-k="${k}" class="${tab === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${dot(k)}</button>`).join('');
      const p = $('#op-panel');
      const keep = p.scrollTop;
      p.innerHTML = tab === 'heart' ? heartHtml() : tab === 'phone' ? phoneHtml() : tab === 'note' ? noteHtml() : logHtml();
      p.scrollTop = R.keepScroll ? keep : 0; R.keepScroll = false;
      if (tab === 'phone' && R.chat) { const m = p.querySelector('.op-kmsgs'); if (m) m.scrollTop = m.scrollHeight; }
      opRoot.classList.toggle('sheet-on', R.tab !== 'stage');
      $('#op-tabs').innerHTML = PHONE_TABS.map(([k, n, i]) => `<button data-op="tab" data-k="${k}" class="${R.tab === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${dot(k)}</button>`).join('');
    }

    // ---------- 행동 칩 (시간 · 장소 · 지금 있는 사람) ----------
    function renderSugg() {
      const st = st0();
      const out = [];
      R.present.filter(n => RO[n]).slice(0, 2).forEach(n => out.push([`${short(n)}에게 말을 건다.`, `${short(n)}에게 말 걸기`, colorOf(n)]));
      const pk = placeKeyOf(st.place) || R.placeK, t = st.time || '아침';
      const go = (k) => { const p = PLACES[k]; if (p && p.go && pk !== k) out.push([p.go, p.go.replace(/[.。]$/, ''), '']); };
      if (t === '아침') { if (pk === '자취방') out.push(['일어나서 씻고 등교 준비를 한다.', '등교 준비']); go('대학교'); }
      else if (t === '낮') { if (pk === '대학교' || pk === '강의실') out.push(['수업을 듣는다.', '수업 듣기']); go('대학교'); }
      else if (t === '저녁') go('편의점');
      else if (t === '밤') { if (pk === '편의점') out.push(['마감 정리를 한다.', '마감 정리']); go('자취방'); }
      else if (t === '심야') { if (pk === '자취방') out.push(['잠자리에 든다.', '잠자리에 들기']); else go('자취방'); }
      out.push(['*주변을 둘러본다*', '주변 살피기']);
      $('#op-sugg').innerHTML = out.slice(0, 4).map(([v, l, c]) => `<button data-op="add" data-v="${esc(v)}" ${c ? `style="--c:${c}"` : ''} class="${c ? 'tint' : ''}">${esc(l)}</button>`).join('');
    }

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
    function showBeat(i) {
      const d = $('#op-dlg');
      const b = R.beats[i];
      if (!b) { d.className = 'op-dlg k-end'; d.innerHTML = `<div class="op-endq">${esc(me())}의 차례 — 말이나 행동, 주문을 적어 보세요.</div>`; maybeReg(); return; }
      if (b.bgSrc) setBg(b.bgSrc);
      setPlaceName(b.placeK);
      setPortrait(b.face || '', b.who || b.faceWho);
      const last = i >= R.beats.length - 1;
      const prog = R.beats.length > 1 ? `<span class="op-prog">${i + 1}<i>/</i>${R.beats.length}</span>` : '';
      if (b.kind === 'spell' && !b.cast) { b.cast = true; castFx(b.text, b.cost, () => { if (R.i === i) showBeat(i); }); return; }
      if (b.kind === 'title') {
        d.className = 'op-dlg k-title';
        d.innerHTML = `<div class="op-ep"><small>EPISODE. ${esc(b.ep)}</small><b>${esc(b.text)}</b></div>${prog}`;
        R.typing = null; if (last) maybeReg(); return;
      }
      const r = (b.kind === 'say' || b.kind === 'kakao' || b.kind === 'call') ? RO[b.who] : null;
      d.className = 'op-dlg k-' + b.kind + (last ? ' last' : '');
      d.style.setProperty('--nc', (r && r.color) || '#d4884f');
      const head = b.kind === 'say' ? `<div class="op-name"><b>${esc(b.who)}</b>${r ? `<small>${esc(r.role.split('·')[0].trim())}</small>` : ''}</div>`
        : b.kind === 'kakao' ? `<div class="op-name kk">${ic('chat')}<b>${esc(b.who)}</b><small>${esc(b.app || '카톡')}</small></div>`
        : b.kind === 'call' ? `<div class="op-name kk">${ic('phone')}<b>${esc(b.who)}</b><small>전화</small></div>`
        : b.kind === 'think' ? `<div class="op-name th"><b>속마음</b></div>` : '';
      d.innerHTML = `${head}${b.act ? `<div class="op-act">${esc(b.act)}</div>` : ''}<div class="op-dline"></div>${prog}
        ${last ? `<div class="op-endq" hidden>${esc(me())}의 차례 — 아래에 적어요.</div>` : '<span class="op-next" aria-hidden="true"></span>'}`;
      const text = b.kind === 'say' ? `“${b.text}”` : b.kind === 'spell' ? `:( ${b.text} ):` : b.text;
      typeTo(d.querySelector('.op-dline'), text, () => {
        if (last) { const q = d.querySelector('.op-endq'); if (q) q.hidden = false; maybeReg(); return; }
        if (K) K.autoNext(text, () => { if (R.i === i && !R.modal && !R.casting && !R.waiting && !K.isOpen() && $('#op-note').hidden && $('#op-reg').hidden) next(); });
      });
    }
    function next() {
      if (K) K.stopAuto();
      if (R.casting) { skipCast(); return; }
      if (R.typing) { R.typing.finish(); return; }
      if (R.waiting) return;
      if (R.i < R.beats.length - 1) { R.i++; showBeat(R.i); }
    }
    function assign(beats, st) {
      let place = placeKeyOf(st && st.place) || R.placeK;
      const lastFace = {};
      let hold = null;
      beats.forEach(b => {
        if (b.place) place = placeKeyOf(b.place) || b.place;
        b.placeK = place;
        b.bgSrc = b.bg || PLACE_IMG(place) || M.lastBg;
        b.face = '';
        if (b.portrait) { b.face = b.portrait; if (b.pinfo && b.pinfo.who) lastFace[b.pinfo.who] = b.portrait; }
        else if (b.kind === 'say' && b.known) b.face = lastFace[b.who] || M.faces[b.who] || IMG(b.who + '_통상');
        else if (b.kind !== 'say' && !b.bg && hold) { b.face = hold.face; b.faceWho = hold.who; }
        if (b.kind === 'say' && b.face && b.known && !(b.pinfo && b.pinfo.adult)) M.faces[b.who] = b.face;
        if (b.bg && !b.portrait) hold = null;
        else if (b.face && (b.kind === 'say' || b.portrait)) hold = { face: b.face, who: b.kind === 'say' ? b.who : (b.pinfo && b.pinfo.who) };
      });
      R.placeK = placeKeyOf(st && st.place) || place;
    }

    // ---------- 주문 연출: 손글씨 → 잉크로 번져 스민다 ----------
    let castT = [];
    function castFx(text, cost, done) {
      const god = modeOf() === 'GOD';
      if (!M.prefs.fx) { if (cost != null) pop(`<i class="dot ink"></i><b>주문</b><span class="dn">${god ? '∞' : '−' + cost + '%'}</span>`, 'spent'); done && done(); return; }
      const c = $('#op-cast');
      R.casting = { done };
      c.innerHTML = `<div class="op-cast ${god ? 'god' : ''}" data-op="cast-skip">
          <div class="op-cpaper"><span class="op-cq">:(</span><b class="op-cw">${esc(text)}</b><span class="op-cq">):</span></div>
          <div class="op-blots">${Array.from({ length: 9 }, (_, k) => `<i style="--k:${k};--x:${(k * 37 + 11) % 100}%;--y:${(k * 53 + 23) % 100}%"></i>`).join('')}</div>
          ${cost != null ? `<em class="op-ccost">${god ? '∞' : '−' + cost + '%'}</em>` : ''}
          <small class="op-ctap">적으면 이루어진다</small></div>`;
      c.hidden = false;
      const root2 = c.querySelector('.op-cast');
      const w = c.querySelector('.op-cw');
      const chars = Array.from(String(text));
      w.textContent = '';
      const step = Math.max(28, Math.min(70, 1300 / Math.max(1, chars.length)));
      chars.forEach((ch, k) => castT.push(setTimeout(() => { w.textContent += ch; }, 250 + k * step)));
      void root2.offsetWidth; root2.classList.add('write');
      const dur = 250 + chars.length * step;
      castT.push(setTimeout(() => root2.classList.add('bleed'), dur + 250));
      castT.push(setTimeout(() => { renderHud(); }, dur + 500));
      castT.push(setTimeout(endCast, dur + 1700));
    }
    function endCast() { castT.forEach(clearTimeout); castT = []; const c = $('#op-cast'); c.hidden = true; c.innerHTML = ''; const cs = R.casting; R.casting = null; if (cs && cs.done) cs.done(); }
    function skipCast() { endCast(); }

    // ---------- 응답 처리 ----------
    function handle(segs) {
      if (R.sm) R.sm.done = true;
      const P = U.parse(segs, roster, IDX);
      const prevDay = st0().day;
      const ev = U.absorb(M, P, { sent: R.sent });
      R.sent = [];
      P.beats.forEach(b => { if (b.text) M.lines.push({ d: st0().day || 0, who: b.kind === 'say' || b.kind === 'kakao' ? b.who : '', t: b.kind === 'spell' ? `:( ${b.text} ):` : b.text, sys: b.kind === 'sys' }); });
      if (ev.day || prevDay == null) R.newDay = true;
      if (ev.met.length) R.newMet = true;
      R.present = Array.from(new Set(P.beats.filter(b => b.kind === 'say' && b.known).map(b => b.who)));
      const plain = segs.filter(x => x.t === 'text').map(x => x.s).join('\n');
      if (K && plain.length > 300) K.checkParse(!!(P.status || P.reg), '상태창을 찾지 못함', plain);
      if (P.reg) { R.regPending = true; M.prologue = true; }
      save();
      // 그림만 있는 마디는 다음 마디로
      P.beats.forEach((b, k) => { if (!b.text && b.kind !== 'title' && (b.bg || b.portrait)) { const nb = P.beats.slice(k + 1).find(x => x.text); if (nb) { nb.bg = nb.bg || b.bg; nb.place = nb.place || b.place; if (!nb.portrait && b.portrait) { nb.portrait = b.portrait; nb.pinfo = b.pinfo; } } } });
      R.beats = P.beats.filter(b => b.text || b.kind === 'title');
      assign(R.beats, M.status);
      // 이번 턴 잉크 소모는 장면 속 첫 주문에 붙인다(없으면 첫 마디 앞에서 연출)
      const spellB = R.beats.find(b => b.kind === 'spell');
      if (ev.spent != null && spellB) spellB.cost = ev.spent;
      R.i = -1;
      renderHud(); setSky(); R.keepScroll = true; renderPanel(); renderSugg();
      notifyEvents(ev);
      if (ev.spent != null && !spellB && (R.lastSent || '').trim()) { const sp = (R.lastSent.match(/:\(\s*([\s\S]*?)\s*\):/) || [])[1]; if (sp) { castFx(sp, ev.spent, startBeats); return; } }
      startBeats();
    }
    function startBeats() {
      R.i = R.beats.length ? 0 : -1; showBeat(R.i);
      if (K && !R.coached && R.beats.length) { R.coached = true; setTimeout(() => { if (!R.modal && !K.isOpen() && $('#op-title').hidden && $('#op-reg').hidden) K.coach(); }, 900); }
    }

    // ---------- 주인공 등록 (프롤로그 양식 → 입력칸) ----------
    function maybeReg() { if (R.regPending && !M.regDone) { R.regPending = false; setTimeout(openReg, 500); } }
    const REG_LOOK = ['평범한 키에 마른 체형, 앞머리가 눈을 살짝 가림', '덩치가 크고 순해 보이는 인상', '안경을 쓴 단정한 얼굴', '피곤해 보이는 눈매, 후드티'];
    const REG_MIND = ['소심하지만 속으로는 할 말 다 함', '능글맞고 장난을 좋아함', '무뚝뚝하지만 책임감 있음', '조용히 계산적'];
    function openReg() {
      const box = $('#op-reg');
      const v = R.reg || { name: '', look: '', mind: '' };
      box.innerHTML = `<div class="op-sheet reg"><div class="op-grab"></div>
          <header><small>[온리펜슬 | 주인공 등록]</small><h3>새 주인의 이름을 적어요</h3><p>첫 메시지로 보내면 주인공이 정해져요. 비워 두면 23세 평범한 대학생으로 시작해요.</p></header>
          <label class="op-field"><span>이름</span><input id="op-rname" maxlength="12" value="${esc(v.name)}" placeholder="예) 이도윤"></label>
          <label class="op-field"><span>외형</span><input id="op-rlook" maxlength="80" value="${esc(v.look)}" placeholder="키·체형·머리·인상"></label>
          <div class="op-chips">${REG_LOOK.map(t => `<button data-op="reg-chip" data-f="op-rlook" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <label class="op-field"><span>성격</span><input id="op-rmind" maxlength="80" value="${esc(v.mind)}" placeholder="말투·성향"></label>
          <div class="op-chips">${REG_MIND.map(t => `<button data-op="reg-chip" data-f="op-rmind" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <p class="op-note-s">나이는 23세로 고정이에요(박아린과 동갑). 양식에 없는 설정은 크랙이 지어내지 않아요.</p>
          <div class="op-sbtns"><button class="op-btn" data-op="reg-blank">비워 두고 시작</button><button class="op-btn ink" data-op="reg-fill">입력칸에 넣기</button></div>
          <button class="op-x" data-op="reg-close" aria-label="닫기">${ic('x')}</button></div>`;
      box.hidden = false;
    }
    function regText(blank) {
      const g = (id) => blank ? '' : String(($('#' + id) || {}).value || '').trim();
      return `[온리펜슬 | 주인공 등록]\n이름: ${g('op-rname')}\n외형: ${g('op-rlook')}\n성격: ${g('op-rmind')}`;
    }

    // ---------- 펜슬 노트 (주문 쓰기 · 잉크 예상) ----------
    const inkNow = () => { const st = st0(); return st.gone ? 0 : st.ink === undefined ? (modeOf() === 'GOD' ? Infinity : 100) : st.ink; };
    function estHtml(e, compact) {
      if (!e || !e.text) return '';
      const T = U.TIERS[e.tier] || {};
      const god = e.god, ink = inkNow();
      const left = god || ink === Infinity ? '∞' : Math.max(0, ink - e.cost) + '%';
      if (compact) return `<span class="op-etier" style="--c:${T.c}">${esc(T.t)}</span><b>${god ? '잉크 ∞' : '예상 −' + e.cost + '%'}</b><small>→ ${left}</small>${e.warn.length ? `<em title="${esc(e.warn.map(w => w.t).join(' / '))}">⚠ ${esc(e.warn[0].t)}</em>` : ''}`;
      return `<div class="op-ecard">
          <div class="op-etiers">${Object.entries(U.TIERS).map(([k, v]) => `<span class="${k === e.tier ? 'on' : ''}" style="--c:${v.c}"><b>${esc(v.t)}</b><small>${v.lo === v.hi ? v.lo : v.lo + '~' + v.hi}%</small></span>`).join('')}</div>
          <div class="op-ecost"><b>${god ? '∞' : '−' + e.cost + '%'}</b><span>${god ? 'GOD 모드 — 잉크가 줄지 않아요' : `예상 · 남는 잉크 <u>${left}</u>`}</span></div>
          <div class="op-emeta">${e.targets.length ? `<span>대상 ${e.targets.map(n => `<i style="--c:${colorOf(n)}">${esc(short(n))}</i>`).join('')}${e.targets.length > 1 ? ` · +${(e.targets.length - 1) * 10}%` : ''}</span>` : '<span>대상 없음 · 나나 사물</span>'}<span>${e.turns ? e.turns + '턴' : e.forever ? '지속 안 적음 → 영구' : ''}</span></div>
          ${e.warn.length ? `<ul class="op-ewarn">${e.warn.map(w => `<li>${esc(w.t)}</li>`).join('')}</ul>` : ''}
          <p class="op-enote">빌더 규칙으로 계산한 예상이에요. 실제 판정은 크랙이 해요(성립하면 관대하게).</p></div>`;
    }
    function openNote(prefill) {
      if (prefill != null) R.noteText = prefill;
      const box = $('#op-note');
      const met = PEOPLE.filter(p => M.met.includes(p.name));
      const recent = Array.from(new Set((M.spells || []).slice().reverse().map(s => s.t))).slice(0, 6);
      box.innerHTML = `<div class="op-sheet note"><div class="op-grab"></div>
          <header class="op-nhead"><div><small>ONLY PENCIL</small><h3>펜슬 노트</h3></div><div class="op-ngauge" id="op-ngauge"></div><button class="op-x" data-op="note-close" aria-label="닫기">${ic('x')}</button></header>
          <div class="op-paper"><span class="op-pq l">:(</span><textarea id="op-spell" rows="2" maxlength="160" placeholder="여기에 적으면 이루어진다…">${esc(R.noteText)}</textarea><span class="op-pq r">):</span></div>
          <div class="op-nrow"><span>대상</span><div class="op-chips">${met.length ? met.map(p => `<button data-op="n-who" data-k="${esc(p.name)}" style="--c:${p.color}">${esc(p.key || p.name)}</button>`).join('') : '<small>아직 만난 사람이 없어요</small>'}<button data-op="n-ins" data-v="내가 ">나</button></div></div>
          <div class="op-nrow"><span>지속</span><div class="op-chips">${['1턴', '3턴', '5턴', '10턴'].map(t => `<button data-op="n-turn" data-v="${t}">${t}간</button>`).join('')}<button data-op="n-turn" data-v="">영구</button></div></div>
          <div id="op-nest"></div>
          <details class="op-book" ${recent.length ? '' : 'open'}><summary>주문 사전 <small>빌더 판정 사례</small></summary><div class="op-bk">${(data.spellbook || []).map(s => `<button data-op="n-load" data-v="${esc(s.t)}" style="--c:${(U.TIERS[s.g] || {}).c}"><span>${esc(s.t)}</span><em>${s.c}%</em></button>`).join('')}</div></details>
          ${recent.length ? `<details class="op-book" open><summary>최근 주문 <small>${recent.length}</small></summary><div class="op-bk">${recent.map(t => { const s = M.spells.slice().reverse().find(x => x.t === t); return `<button data-op="n-load" data-v="${esc(t)}"><span>${esc(t)}</span><em>${s && s.cost != null ? '−' + s.cost + '%' : ''}</em></button>`; }).join('')}</div></details>` : ''}
          <div class="op-sbtns"><button class="op-btn" data-op="note-clear">지우기</button><button class="op-btn ink" data-op="note-fill">${ic('pen')} 입력칸에 넣기</button></div>
          <p class="op-note-s">넣은 뒤 행동이나 대사를 덧붙여 보내도 돼요. 보내기는 아래에서 직접.</p></div>`;
      box.hidden = false;
      noteUpdate();
      const ta = $('#op-spell'); if (ta && !narrow()) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
    function noteUpdate() {
      const ta = $('#op-spell'); if (!ta) return;
      R.noteText = ta.value;
      const e = U.estimate(ta.value, { mode: modeOf(), ink: inkNow(), roster });
      $('#op-nest').innerHTML = ta.value.trim() ? estHtml(e) : '<p class="op-empty-s">하고 싶은 일을 그대로 적어요. 예) 아린이 3턴간 내 앞에서 말을 더듬는다</p>';
      const st = st0();
      $('#op-ngauge').innerHTML = pencilSvg(st.gone ? null : inkNow(), { gone: st.gone, ghost: ta.value.trim() ? e.cost : 0 }) + `<b>${st.gone ? '소멸' : inkNow() === Infinity ? '∞' : inkNow() + '%'}</b>`;
    }
    function noteInsert(t, front) {
      const ta = $('#op-spell'); if (!ta) return;
      if (front) ta.value = t + ta.value.replace(/^\s*\d+\s*턴간\s*/, '');
      else { const a = ta.selectionStart, b = ta.selectionEnd; ta.value = ta.value.slice(0, a) + t + ta.value.slice(b); const p = a + t.length; ta.focus(); ta.setSelectionRange(p, p); }
      noteUpdate();
    }
    function closeNote() { const b = $('#op-note'); b.hidden = true; b.innerHTML = ''; renderHud(); }
    // 입력칸에 :( ): 가 있으면 바로 위에 예상 한 줄
    function liveEst() {
      const v = $('#op-in').value;
      const m = v.match(/:\(\s*([\s\S]*?)\s*(\):|$)/);
      const box = $('#op-est');
      if (!m || !m[1].trim()) { box.hidden = true; box.innerHTML = ''; renderHud(); return; }
      const e = U.estimate(m[1], { mode: modeOf(), ink: inkNow(), roster });
      box.innerHTML = estHtml(e, true); box.hidden = false;
      renderHud(e.cost);
    }

    // ---------- 입력칸 ----------
    function autosize() { const ta = $('#op-in'); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
    function fill(text, add) {
      if (narrow() && R.tab !== 'stage') { R.tab = 'stage'; renderPanel(); }
      const ta = $('#op-in');
      ta.value = add && ta.value.trim() ? ta.value.replace(/\s+$/, '') + (/\n$/.test(text) ? '' : ' ') + text : text;
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); autosize(); liveEst();
      ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
    }
    function insertAct() {
      const ta = $('#op-in');
      const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
      const sel = v.slice(a, b), pre = v.slice(0, a), post = v.slice(b);
      const sp = pre && !/\s$/.test(pre) ? ' ' : '';
      ta.value = pre + sp + '*' + sel + '*' + (post && !/^\s/.test(post) ? ' ' : '') + post;
      const pos = pre.length + sp.length + 1 + sel.length;
      ta.focus(); ta.setSelectionRange(pos, pos); autosize();
    }
    function doSend() {
      const ta = $('#op-in');
      const text = ta.value.trim();
      if (!text || R.waiting) return;
      if (R.mode !== 'play' || R.away || R.page !== 'chat') { toast(R.away ? '이 세이브의 대화로 돌아온 뒤에 보낼 수 있어요' : '대화 화면이 열린 뒤에 보낼 수 있어요'); return; }
      R.waiting = true; R.sentAt = Date.now();
      R.sent = [...text.matchAll(/:\(\s*([\s\S]*?)\s*\):/g)].map(m => m[1].trim()).filter(Boolean);
      R.lastSent = text;
      if (/^\[\s*온리펜슬\s*[|｜]\s*주인공\s*등록/.test(text)) { M.regDone = true; R.regPending = false; }
      if (K) K.stopAuto();
      M.lines.push({ d: st0().day || 0, who: me(), t: text, me: true });
      save();
      o.send(text);
      ta.value = ''; autosize(); liveEst();
      waitingUi(true);
    }

    // ---------- 응답 대기 ----------
    const TIPS = Array.isArray(data.tips) && data.tips.length ? data.tips : ['위쪽 ⋯ 메뉴에서 언제든 크랙 원래 화면을 볼 수 있어요.'];
    let tipI = Math.floor(Math.random() * TIPS.length), tipT = null;
    function waitingUi(on, preview) {
      el.classList.toggle('op-wait', !!on);
      clearInterval(tipT);
      if (!on) return;
      const d = $('#op-dlg');
      d.className = 'op-dlg k-wait';
      d.innerHTML = `<div class="op-typing"><span class="op-scribble"><i></i><i></i><i></i></span><b>${R.sent.length ? '글자가 종이에 스미는 중' : '이야기를 적는 중'}</b></div><div class="op-tip">${esc(TIPS[tipI % TIPS.length])}</div>${preview ? `<small class="op-stream">${esc(preview.slice(-140))}</small>` : ''}`;
      tipT = setInterval(() => { tipI++; const t = el.querySelector('.op-tip'); if (t) t.textContent = TIPS[tipI % TIPS.length]; else clearInterval(tipT); }, 5000);
    }
    const waitT = setInterval(() => { if (R.waiting && Date.now() - R.sentAt > 45000) banner('slow'); }, 5000);

    // ---------- 안내 띠 ----------
    function banner(kind) {
      const b = $('#op-banner');
      if (!kind) { b.hidden = true; b.innerHTML = ''; b.className = 'op-banner'; return; }
      const row = (btns) => `<div class="op-brow">${btns}</div>`;
      const std = '<button class="op-fb" data-op="crack">크랙 화면 보기</button><button class="op-fb" data-op="title">처음 화면</button><button class="op-fb" data-op="diag">화면 진단 복사</button>';
      b.hidden = false; b.className = 'op-banner center';
      const spin = '<span class="op-scribble"><i></i><i></i><i></i></span>';
      if (kind === 'other') b.innerHTML = `<div class="op-gate"><b>세이브의 대화가 열리지 않았어요</b><span>크랙에서 대화가 지워졌거나 로그인이 풀렸을 수 있어요.</span>${row('<button class="op-fb primary" data-op="back-save">다시 열기</button>' + std)}</div>`;
      else if (kind === 'mode') {
        const ms = (R.actions || []).filter(a => a.kind === 'mode');
        const picked = R.sm && R.sm.picked;
        b.innerHTML = `<div class="op-gate"><b>시작 모드를 골라 주세요</b><span>${picked ? `「${esc(picked)}」를 골랐어요. 크랙이 시작하기를 기다리는 중이에요.` : '고른 것만 크랙에 한 번 눌러 줘요.'}</span>
          <div class="op-modes">${ms.map(a => `<button class="op-mode ${picked === a.label ? 'on' : ''}" data-op="pick-mode" data-id="${a.id}" data-label="${esc(a.label)}">${esc(a.label)}</button>`).join('')}</div>
          ${row('<button class="op-fb" data-op="crack-pick">크랙 화면에서 직접 고르기</button><button class="op-fb" data-op="title">처음 화면</button>')}</div>`;
      } else if (kind === 'new') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        const why = R.newFlow && R.newFlow.clicked ? '크랙에서 새 대화가 열리면 바로 시작해요.'
          : (R.page === 'detail' && !acts.length ? '크랙 작품 화면에서 「새로하기」 버튼을 찾지 못했어요. 크랙 화면 보기를 눌러 직접 「새로하기」를 누르면 바로 이어져요.' : '크랙 작품 화면을 여는 중이에요…');
        b.innerHTML = `<div class="op-gate">${spin}<b>새 연습장을 펴는 중이에요</b><span>${why}</span>${row(acts.map(a => `<button class="op-fb primary" data-op="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + '<button class="op-fb primary" data-op="crack-pick">크랙 화면에서 직접 고르기</button>' + std)}</div>`;
      } else if (kind === 'old') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        b.innerHTML = `<div class="op-gate"><b>크랙이 예전 대화를 열었어요</b><span>처음부터 하려면 새 대화가 필요해요. 「작품 화면에서 새로하기」를 누르면 CRION이 새 대화를 열어요.</span>${row(acts.map(a => `<button class="op-fb primary" data-op="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + `<button class="op-fb ${acts.length ? '' : 'primary'}" data-op="retry-new">작품 화면에서 새로하기</button>` + std)}</div>`;
      } else if (kind === 'away') b.innerHTML = `<div class="op-gate"><b>이 세이브의 대화가 아니에요</b><span>크랙 화면에서 다른 대화로 옮겨 갔어요. 이 대화는 읽지 않아요.</span>${row('<button class="op-fb primary" data-op="back-save">세이브 대화로 돌아가기</button>' + std)}</div>`;
      else if (kind === 'slow') { b.className = 'op-banner'; b.innerHTML = `<span>응답을 아직 못 읽었어요. 크랙에서 답이 왔는지 확인해 보세요.</span><button class="op-fb" data-op="crack">크랙 화면 보기</button><button class="op-fb" data-op="diag">화면 진단 복사</button><button class="op-fb" data-op="unwait">닫기</button>`; }
    }

    // ---------- 겹창 ----------
    function openModal(k, arg) {
      R.modal = k;
      const box = $('#op-box');
      box.className = 'op-box';
      const X = `<button class="op-x" data-op="mclose" aria-label="닫기">${ic('x')}</button>`;
      if (k === 'lines') {
        const ls = M.lines.slice(-150);
        box.classList.add('wide');
        let lastD = null;
        box.innerHTML = `${X}<h3>지난 대사</h3><div class="op-lines">${ls.length ? ls.map(l => { const hd = l.d !== lastD ? `<h5>${l.d || 0}일차</h5>` : ''; lastD = l.d; return hd + `<p class="${l.me ? 'me' : l.sys ? 'sys' : l.who ? 'say' : ''}" style="${l.who && RO[l.who] ? '--c:' + RO[l.who].color : ''}">${l.who ? `<b>${esc(l.who)}</b>` : ''}<span>${esc(l.t)}</span></p>`; }).join('') : '<p class="op-empty-s">아직 없어요.</p>'}</div>`;
        setTimeout(() => { const n = box.querySelector('.op-lines'); if (n) n.scrollTop = n.scrollHeight; }, 0);
      } else if (k === 'album') {
        box.classList.add('wide'); box.innerHTML = X + albumHtml();
      } else if (k === 'set') {
        const seg = (key, opts) => `<div class="op-seg">${opts.map(([v, l]) => `<button class="${String(M.prefs[key]) === String(v) ? 'on' : ''}" data-op="pref" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
        box.innerHTML = `${X}<h3>플레이팩 설정</h3>
          <div class="op-setrow"><span>글자 속도</span>${seg('speed', [['slow', '느림'], ['normal', '보통'], ['fast', '빠름'], ['instant', '즉시']])}</div>
          <div class="op-setrow"><span>화면 연출</span>${seg('fx', [[false, '끔'], [true, '켜짐']])}</div>
          <p class="op-note-s">게임 화면은 크랙 응답을 읽어 그려요. 숫자는 크랙 상태창 그대로이고, 잉크 예상은 참고용이에요.</p>
          <div class="op-btns left"><button class="op-btn" data-op="reg-open">주인공 등록 양식</button><button class="op-btn" data-op="title">처음 화면</button><button class="op-btn" data-op="crack">크랙 화면 보기</button><button class="op-btn" data-op="diag">화면 진단 복사</button><button class="op-btn danger" data-op="pack-off">플레이팩 끄기</button></div>`;
      } else if (k === 'view') {
        const src = IMG(String(arg)); if (!src) return;
        box.classList.add('photo');
        box.innerHTML = `${X}<img src="${esc(src)}" alt=""><p class="op-note-s">${esc(String(arg).replace(/_/g, ' '))}</p>`;
      }
      $('#op-modal').hidden = false;
    }
    function closeModal() { R.modal = null; $('#op-modal').hidden = true; $('#op-box').innerHTML = ''; }
    const curScene = () => { const b = R.beats[R.i] || R.beats[R.beats.length - 1]; const who = b && b.kind === 'say' ? b.who : ''; return { bg: R.bgKey || M.lastBg, face: (b && b.face) || '', who, text: b ? b.text : '', color: colorOf(who), place: st0().place }; };
    const menuExtra = () => [{ label: '펜슬 노트 (주문 쓰기)', fn: () => openNote() }, { label: '주인공 등록 양식', fn: () => openReg() }, { label: '본 그림', fn: () => openModal('album') }]
      .concat(K ? K.menu(curScene, () => M.lines, colorOf) : [{ label: '지난 대사', fn: () => openModal('lines') }]).concat([{ label: '플레이팩 설정', fn: () => openModal('set') }]);

    // ---------- 입력 ----------
    el.addEventListener('click', (e) => {
      if (e.target.id === 'op-modal') { closeModal(); return; }
      if (e.target.id === 'op-note') { closeNote(); return; }
      if (e.target.id === 'op-reg') { $('#op-reg').hidden = true; return; }
      const t = e.target.closest('[data-op]');
      if (!t || !el.contains(t)) return;
      const k = t.dataset.op;
      switch (k) {
        case 'next': if (!e.target.closest('button')) next(); break;
        case 'send': doSend(); break;
        case 'act': insertAct(); break;
        case 'pen': openNote(); break;
        case 'tab': { const v = t.dataset.k; R.sub = null; if (v === 'phone') R.newChat = false; if (v === 'log') R.newDay = false; if (v === 'heart') R.newMet = false; if (t.closest('#op-stabs')) { R.sideTab = v; if (R.tab !== 'stage') R.tab = v; } else { R.tab = v; if (v !== 'stage') R.sideTab = v; } renderPanel(); break; }
        case 'who': R.sub = t.dataset.k; renderPanel(); break;
        case 'sub-back': R.sub = null; renderPanel(); break;
        case 'chat': R.chat = t.dataset.k; R.sub = null; if (narrow()) R.tab = 'phone'; R.sideTab = 'phone'; R.newChat = false; renderPanel(); break;
        case 'chat-back': R.chat = null; renderPanel(); break;
        case 'fill': if (R.modal) closeModal(); fill(t.dataset.v); break;
        case 'add': fill(t.dataset.v, true); break;
        case 'spell-to': { const n = t.dataset.k; openNote(josa(short(n), '이', '가') + ' '); break; }
        case 'reuse': openNote(t.dataset.v); break;
        case 'view': openModal('view', t.dataset.k); break;
        case 'album': openModal('album'); break;
        case 'more': if (o.menu) o.menu(menuExtra()); else openModal('set'); break;
        case 'lines': if (K) K.log(M.lines, colorOf); else openModal('lines'); break;
        case 'set': case 't-set': openModal('set'); break;
        case 't-saves': R.showSaves = !R.showSaves; renderTitle(); break;
        case 'mclose': closeModal(); break;
        case 'pref': { const v = t.dataset.v; M.prefs[t.dataset.key] = v === 'true' ? true : v === 'false' ? false : v; save(); opRoot.classList.toggle('nofx', !M.prefs.fx); openModal('set'); break; }
        // 펜슬 노트
        case 'note-close': closeNote(); break;
        case 'note-clear': { const ta = $('#op-spell'); if (ta) { ta.value = ''; noteUpdate(); ta.focus(); } break; }
        case 'note-fill': { const v = String(($('#op-spell') || {}).value || '').trim(); if (!v) { toast('주문을 먼저 적어요'); break; } R.noteText = ''; closeNote(); fill(`:(${v}):`, true); break; }
        case 'n-who': { const n = t.dataset.k; noteInsert(josa(short(n), '이', '가') + ' '); break; }
        case 'n-ins': noteInsert(t.dataset.v); break;
        case 'n-turn': { const v = t.dataset.v; const ta = $('#op-spell'); if (!ta) break; let s = ta.value.replace(/\s*\d+\s*턴간\s*/, ' ').replace(/\s*영구히?\s*/, ' ').trim(); if (v) { const m = s.match(/^(\S+[이가은는])\s+/); s = m ? `${m[1]} ${v}간 ${s.slice(m[0].length)}` : `${v}간 ${s}`; } else s = s + (s ? ' (영구)' : ''); ta.value = s.trim(); noteUpdate(); break; }
        case 'n-load': { const ta = $('#op-spell'); if (ta) { ta.value = t.dataset.v; noteUpdate(); } break; }
        // 주인공 등록
        case 'reg-chip': { const f = $('#' + t.dataset.f); if (f) f.value = t.dataset.v; break; }
        case 'reg-fill': R.reg = { name: $('#op-rname').value, look: $('#op-rlook').value, mind: $('#op-rmind').value }; $('#op-reg').hidden = true; fill(regText(false)); toast('주인공 등록 양식을 채웠어요. 보내기를 누르면 시작해요'); break;
        case 'reg-blank': $('#op-reg').hidden = true; fill(regText(true)); break;
        case 'reg-close': $('#op-reg').hidden = true; break;
        case 'reg-open': closeModal(); openReg(); break;
        case 'cast-skip': skipCast(); break;
        // 타이틀 · 연결
        case 'title': closeModal(); showTitle(); break;
        case 'back-save': { const sv = curSave(); if (sv && sv.url) o.load(sv.url); break; }
        case 't-new': startNew(t.dataset.mode || ''); break;
        case 't-cont': continueSave(t.dataset.id); break;
        case 't-del': { const id = t.dataset.id; if (R.delAsk === id) { saves = saves.filter(x => x.id !== id); putSaves(); try { localStorage.removeItem(memKey(id)); } catch (err) { /* 없음 */ } R.delAsk = null; toast('세이브를 지웠어요 (크랙 대화는 그대로 남아요)'); } else R.delAsk = id; renderTitle(); break; }
        case 'click': o.click(t.dataset.id); if (R.newFlow) { R.newFlow.clicked = true; R.newFlow.fromUrl = R.curUrl; banner('new'); } else banner(null); break;
        case 'crack': closeModal(); o.showCrack(true); break;
        case 'pick-mode': if (R.sm && !R.sm.picked) { R.sm.picked = t.dataset.label; o.click(t.dataset.id); banner('mode'); } break;
        case 'crack-pick': if (R.sm) R.sm.viaCrack = true; o.showCrack(true); break;
        case 'diag': o.diag(); break;
        case 'retry-new': if (R.newFlow) { R.newFlow = { clicked: false, fromUrl: '', at: Date.now() }; banner('new'); o.load(startUrl()); } break;
        case 'unwait': banner(null); R.waiting = false; waitingUi(false); showBeat(R.i); break;
        case 'pack-off': o.packOff(); break;
      }
    });
    el.addEventListener('input', (e) => { if (e.target.id === 'op-in') { autosize(); liveEst(); } else if (e.target.id === 'op-spell') noteUpdate(); });
    const onKey = (e) => {
      if (!el.isConnected || el.classList.contains('off') || document.querySelector('#layer .scrim') || (K && K.isOpen())) return;
      if (e.target.id === 'op-in' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); return; }
      if (e.target.id === 'op-spell' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const b = el.querySelector('[data-op=note-fill]'); if (b) b.click(); return; }
      if (/^(TEXTAREA|INPUT|SELECT|WEBVIEW)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { if (R.modal) closeModal(); else if (!$('#op-note').hidden) closeNote(); else if (!$('#op-reg').hidden) $('#op-reg').hidden = true; else if (R.sub) { R.sub = null; renderPanel(); } }
      if ((e.key === ' ' || e.key === 'Enter') && !R.modal && $('#op-note').hidden && $('#op-reg').hidden && !e.target.closest('button')) { e.preventDefault(); if ($('#op-title').hidden) next(); }
    };
    document.addEventListener('keydown', onKey);
    const onBack = (e) => {
      if (!el.isConnected || el.closest('.off') || document.querySelector('#layer > *')) return;
      const done = () => e.preventDefault();
      if (R.casting) { skipCast(); return done(); }
      if (R.modal) { closeModal(); return done(); }
      if (!$('#op-note').hidden) { closeNote(); return done(); }
      if (!$('#op-reg').hidden) { $('#op-reg').hidden = true; return done(); }
      if (R.chat) { R.chat = null; renderPanel(); return done(); }
      if (R.sub) { R.sub = null; renderPanel(); return done(); }
      if (R.tab !== 'stage') { R.tab = 'stage'; renderPanel(); return done(); }
      if (R.mode !== 'title' && $('#op-title').hidden) { showTitle(); return done(); }
    };
    document.addEventListener('crion-back', onBack);

    // ---------- 타이틀 ----------
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.round(m / 60) + '시간 전' : Math.round(m / 1440) + '일 전'; };
    const fmtMs = (ms) => { const m = Math.round((ms || 0) / 60000); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
    const sumText = (sv) => { const s = (sv && sv.sum) || {}; return s.day ? `${s.day}일차 ${s.time || ''}${s.place ? ' · ' + s.place : ''} · 잉크 ${s.ink != null ? s.ink + (s.ink === '∞' || s.ink === '소멸' ? '' : '%') : '–'}` : '개강 전날 밤'; };
    function renderTitle() {
      const box = $('#op-title');
      const list = saves.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
      const cont = list.find(x => x.url);
      const MD = data.modes || {};
      const saveRow = (sv) => `<div class="op-save"><div class="op-simg" style="background-image:${cssUrl((sv.sum && sv.sum.bg) || '')}"></div>
          <div class="op-smeta"><b>${esc(sumText(sv))}</b><span><i class="op-smode" style="--mc:${(MODE[sv.mode] || MODE.NORMAL).c}">${esc(sv.mode || 'NORMAL')}</i>${fmtMs(sv.playMs)} 플레이 · ${sv.url ? '마지막 ' + ago(sv.last || sv.created) : '대화 연결 전'}</span></div>
          <div class="op-sbtns2">${sv.url ? `<button class="op-fb primary" data-op="t-cont" data-id="${esc(sv.id)}">이어하기</button>` : ''}<button class="op-fb ${R.delAsk === sv.id ? 'danger' : ''}" data-op="t-del" data-id="${esc(sv.id)}">${R.delAsk === sv.id ? '한 번 더 누르면 삭제' : '지우기'}</button></div></div>`;
      const tpc = asset('assets/title_pc.webp'), tm = asset('assets/title_m.webp');
      box.innerHTML = `<div class="op-tstage">${tpc ? `<img class="pc" src="${esc(tpc)}" alt="온리펜슬">` : ''}${tm ? `<img class="m" src="${esc(tm)}" alt="온리펜슬">` : ''}</div>
        <div class="op-tside">
          <div class="op-tpen">${pencilSvg(100)}</div>
          <p class="op-ttag"><b>적으면 이루어진다.</b><span>폐업한 문구점 박스 맨 아래, 구릿빛 연필 한 자루.</span></p>
          ${cont ? `<button class="op-tcont" data-op="t-cont" data-id="${esc(cont.id)}"><b>이어하기</b><small>${esc(sumText(cont))}</small></button>` : ''}
          <div class="op-tmodes">${['NORMAL', 'GOD', 'HARD'].map(k => `<button class="op-tmode m-${k.toLowerCase()}" data-op="t-new" data-mode="${esc((MD[k] || {}).label || k)}" style="--mc:${MODE[k].c}"><i>${k}</i><b>${esc((MD[k] || {}).label || k)}</b><small>${esc((MD[k] || {}).d || '')}</small></button>`).join('')}</div>
          <div class="op-tlinks">${list.length ? `<button class="${R.showSaves ? 'on' : ''}" data-op="t-saves">세이브 ${list.length}</button>` : ''}<button data-op="t-set">설정</button><span>19세 이상 · 크랙 AI가 진행해요</span></div>
        </div>
        ${list.length ? `<div class="op-tdrawer ${R.showSaves ? 'on' : ''}"><header><b>세이브</b><button class="op-x" data-op="t-saves" aria-label="닫기">${ic('x')}</button></header>${list.map(saveRow).join('')}<p>크랙 대화는 지워지지 않고 그대로 남아요.</p></div>` : ''}`;
      box.hidden = false;
    }
    function resetScene() {
      R.beats = []; R.i = -1; R.lastKey = ''; R.waiting = false; R.away = false; R.sub = null; R.chat = null; R.tab = 'stage'; R.present = []; R.regPending = false;
      R.bgKey = ''; el.querySelectorAll('.op-bgl').forEach(x => { x.style.backgroundImage = ''; x.classList.remove('on'); });
      R.placeK = placeKeyOf(st0().place) || '자취방';
      if (M.lastBg) setBg(M.lastBg); else setPlaceName(R.placeK);
      setPortrait('');
      ['#op-note', '#op-reg', '#op-cast'].forEach(s => { $(s).hidden = true; });
      closeModal();
      renderHud(); setSky(); renderPanel(); renderSugg();
      const d = $('#op-dlg'); d.className = 'op-dlg'; d.innerHTML = '';
    }
    const hideTitle = () => { $('#op-title').hidden = true; };
    function showTitle() { R.mode = 'title'; R.newFlow = null; R.delAsk = null; banner(null); waitingUi(false); renderTitle(); }
    function loading(msg) { const d = $('#op-dlg'); d.className = 'op-dlg k-wait'; d.innerHTML = `<div class="op-typing"><span class="op-scribble"><i></i><i></i><i></i></span><b>${esc(msg)}</b></div>`; }
    function startUrl() {
      const d = o.detailUrl ? o.detailUrl() : '';
      return (typeof d === 'string' && /^https:\/\/([a-z0-9-]+\.)*wrtn\.ai\//.test(d) && !/^https:\/\/share\./.test(d)) ? d : o.workUrl;
    }
    function startNew(want) {
      const id = 'sv' + Date.now().toString(36);
      const mk = Object.entries(data.modes || {}).find(([, v]) => v.label === want);
      saves.push({ id, url: '', created: Date.now(), last: Date.now(), playMs: 0, mode: mk ? mk[0] : 'NORMAL' });
      putSaves();
      useSave(id); save();
      resetScene();
      R.mode = 'binding'; R.newFlow = { clicked: false, fromUrl: '', at: Date.now() };
      R.sm = { want: want || '', picked: '', confirmed: false, viaCrack: false, newLabel: '', done: false };
      hideTitle(); loading('새 연습장을 펴는 중이에요'); banner('new');
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
      if (K) {
        const r = K.recapFromLines(M.lines, colorOf), st = st0();
        const top = Object.entries(M.hearts || {}).sort((a, b) => b[1] - a[1])[0];
        K.recap(Object.assign(r, { title: '지난 연습장', when: st.day != null ? st.day + '일차 ' + (st.time || '') : '', place: st.place || '', bg: M.lastBg,
          rows: [['잉크', st.gone ? '소멸' : st.ink === Infinity ? '∞' : (st.ink != null ? st.ink + '%' : '–')], (M.spells || []).length ? ['쓴 주문', M.spells.length + '번'] : null, top ? ['가장 가까운 사람', `${top[0]} ${top[1] > 0 ? '+' : ''}${top[1]}`] : null].filter(Boolean) }));
      }
    }
    function startModeStep(st) {
      const sm = R.sm;
      if (!sm || sm.done) return false;
      if (R.mode === 'binding' && !(R.newFlow && R.newFlow.clicked)) return false;
      const acts = st.actions || [];
      const modes = acts.filter(x => x.kind === 'mode');
      const modeBannerOn = !!$('#op-banner').querySelector('.op-modes');
      if (!sm.picked) {
        // 타이틀에서 고른 모드가 있으면 그 이름을 한 번 누른다
        const want = sm.want && !sm.viaCrack ? modes.find(x => x.label.replace(/\s/g, '').includes(sm.want.replace(/\s/g, '')) || sm.want.replace(/\s/g, '').includes(x.label.replace(/\s/g, ''))) : null;
        if (want) { sm.picked = want.label; o.click(want.id); return true; }
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
      const nf = R.newFlow;
      if (!nf) return;
      if (startModeStep(st)) return;
      const cf = (st.actions || []).find(x => x.kind === 'confirm');
      if (cf && st.page !== 'chat' && nf.clicked && !nf.confirmed && !(R.sm && (R.sm.picked || R.sm.viaCrack))) { nf.confirmed = true; o.click(cf.id); banner('new'); return; }
      const used = new Set(saves.filter(x => x.id !== saveId && x.url).map(x => normUrl(x.url)));
      if (st.page === 'detail') {
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
      const detail = o.detailUrl ? o.detailUrl() : '';
      if (detail && !nf.triedDetail && normUrl(detail) !== u) { nf.triedDetail = true; nf.clicked = false; o.load(detail); banner('new'); return; }
      banner('old');
    }
    const playT = setInterval(() => { const sv = curSave(); if (sv && R.mode === 'play' && !R.away && document.visibilityState === 'visible' && !el.closest('.off')) { sv.playMs = (sv.playMs || 0) + 30000; putSaves(); } }, 30000);

    // 시작
    setPlaceName('자취방');
    renderHud(); setSky(); renderPanel(); renderSugg();
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
          else if ($('#op-banner').querySelector('.op-gate')) banner(null);
        } else if (ch === 'crion:sent' && d) {
          if (!d.ok) { R.waiting = false; waitingUi(false); showBeat(R.i); toast(d.why === 'no-input' ? '크랙 입력창을 찾지 못했어요. 크랙 화면을 확인해 주세요' : '보내지 못했어요'); }
        }
      },
      destroy() { if (K) K.destroy(); document.removeEventListener('keydown', onKey); document.removeEventListener('crion-back', onBack); clearInterval(waitT); clearInterval(playT); clearInterval(tipT); clearInterval(typeT); castT.forEach(clearTimeout); save(); },
      demo(segs) { handle(segs); },
      kit: K, state: R, memory: M, saves: () => saves,
      openNote, openReg
    };
  }

  root.CrionPencilRun = { start };
})(typeof window !== 'undefined' ? window : globalThis);
