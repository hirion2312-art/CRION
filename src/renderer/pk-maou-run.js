// 플레이팩 실행기 — 「마법소녀의 최종보스」 (runner: "maou")
//  디자인: '반지하 어전' — 망명한 그림자 왕실이 반지하에서 여는 작전 회의. 낡은 금박·봉랍(봉인) vs 오성의 별빛
//  - 무대: 크랙이 고른 그림 그대로(주소 → 빌더 등록명). 묘사는 장소, 대사는 그 사람 그림을 화면 가득
//  - 왕관: 권능 5개 = 왕관의 보석 5개. 되찾은 방식(사랑·흑화·전투) 색으로 박힌다. 회수 순간은 의식(전체 화면)
//  - 발각의 눈: 정체 발각 위험이 오를수록 눈이 뜨인다. 위기면 무대 가장자리가 붉게
//  - 어전 패널: 오성(표적 서류·관계 단계·추이) · 마왕군 · 작전(지금 할 일·진행·명령·단서·엔딩) · 일지(하루 기록·본 그림)
//  - 입력 도우미: 지금 장면에 맞는 행동 칩, *행동* 넣기. 버튼은 입력칸에 글만 채운다 (보내기는 플레이어가 한 번)
//  - 계산은 하지 않는다. 숫자는 크랙 상태창 그대로. 숨은 진실·사랑/흑화 열쇠는 넣지 않았다
(function (root) {
  'use strict';
  const U = root.CrionMaou;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => u ? `url('${String(u).replace(/['"\\\n<>]/g, (c) => encodeURIComponent(c))}')` : 'none';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const SPEED = { slow: 42, normal: 22, fast: 9, instant: 0 };
  const josa = (w, a, b) => { const c = String(w || '').charCodeAt(String(w || '').length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };
  const won = (n) => n == null ? '–' : Number(n).toLocaleString('ko-KR') + '원';
  const ICON = {
    back: '<path d="M15 5l-7 7 7 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    stage: '<path d="M3 19h18"/><path d="M5 19V8.5L12 4l7 4.5V19"/><path d="M10 19v-5h4v5"/>',
    star: '<path d="M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.9l-5 2.8 1.2-5.6L4 9.3l5.6-.6z"/>',
    crown: '<path d="M3.5 18.5h17"/><path d="M4.5 16L3 7l5 4 4-6.5 4 6.5 5-4-1.5 9z"/>',
    map: '<path d="M9 4.5l6 2.5 5.5-2.5v14.5L15 21.5l-6-2.5-5.5 2.5V7z"/><path d="M9 4.5V19M15 7v14.5"/>',
    book: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h10.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    pin: '<path d="M12 21s6-5.6 6-10.2A6 6 0 0 0 6 10.8C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 5 16.2L4 13.5a1.5 1.5 0 0 1 2.6-1.4L8 14"/>',
    send: '<path d="M4 12l16-7-6 16-3-6.5z"/><path d="M11 14.5L20 5"/>'
  };
  const ic = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;
  const METHOD = { 사랑: { c: '#f08ab0', t: '사랑', d: '스스로 돌려줬다' }, 흑화: { c: '#9b6cff', t: '흑화', d: '마음이 무너졌다' }, 전투: { c: '#e2563f', t: '전투', d: '힘으로 제압했다' } };
  const riskLv = (v, l) => (v == null ? 'none' : /위기|발각/.test(l || '') || v >= 70 ? 'bad' : /위험|주의|경계|의심/.test(l || '') || v >= 35 ? 'warn' : 'ok');
  const STAGES = ['적대·경계', '무관심·거리두기', '호의·친근', '신뢰', '깊은 유대'];
  const stageIdx = (v) => v == null ? -1 : clamp(Math.floor(v / 20), 0, 4);

  // 왕관: 보석 다섯 = 권능 다섯
  function crownSvg(gems, big) {
    const xs = [22, 41, 60, 79, 98];
    return `<svg class="mq-crown${big ? ' big' : ''}" viewBox="0 0 120 70" aria-hidden="true">
      <defs><linearGradient id="mqG${big ? 'b' : 's'}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dc9e"/><stop offset=".55" stop-color="#c49a4e"/><stop offset="1" stop-color="#7d5a22"/></linearGradient></defs>
      <path class="cr-body" d="M8 58 L12 20 L33 38 L47 10 L60 30 L73 10 L87 38 L108 20 L112 58 Z" fill="url(#mqG${big ? 'b' : 's'})"/>
      <rect class="cr-band" x="8" y="48" width="104" height="14" rx="2" fill="url(#mqG${big ? 'b' : 's'})"/>
      <circle cx="12" cy="18" r="3.2" class="cr-tip"/><circle cx="47" cy="8" r="3.2" class="cr-tip"/><circle cx="73" cy="8" r="3.2" class="cr-tip"/><circle cx="108" cy="18" r="3.2" class="cr-tip"/>
      ${gems.map((g, i) => `<g class="cr-gem ${g.on ? 'on' : ''} ${g.fresh ? 'fresh' : ''}" style="${g.c ? '--gc:' + g.c : ''}"><circle cx="${xs[i]}" cy="55" r="5.6" class="cr-socket"/><circle cx="${xs[i]}" cy="55" r="4.2" class="cr-stone"/></g>`).join('')}
    </svg>`;
  }
  // 발각의 눈: 위험이 오를수록 눈꺼풀이 열린다
  function eyeSvg(v) {
    const o = v == null ? 0 : clamp(v / 100, 0, 1);
    const h = 1 + o * 9;
    return `<svg class="mq-eye" viewBox="0 0 40 24" aria-hidden="true"><path class="ey-lid" d="M3 12 Q20 ${12 - h * 1.6} 37 12 Q20 ${12 + h * 1.6} 3 12 Z"/>${o > .12 ? `<circle class="ey-iris" cx="20" cy="12" r="${2 + o * 3.4}"/><circle class="ey-pupil" cx="20" cy="12" r="${.8 + o * 1.2}"/>` : ''}<path class="ey-lash" d="M3 12 Q20 ${12 + h * 1.6} 37 12"/></svg>`;
  }
  // 관계 추이 선(호감도 · 균열)
  function spark(h, idx, cls) {
    const pts = (h || []).map(p => p[idx]).filter(v => v != null);
    if (pts.length < 2) return '';
    const W = 120, H = 28, n = pts.length;
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (n - 1) * W).toFixed(1)} ${(H - v / 100 * H).toFixed(1)}`).join(' ');
    return `<svg class="mq-spark ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  function start(o) {
    const el = o.el;
    const data = o.data || {};
    const roster = new U.Roster(data);
    const IDX = new U.ImgIndex(data);
    const IMG = (name) => IDX.url(name);
    const asset = (p) => { try { return o.files && o.files.has(p) ? o.files.url(p) : ''; } catch (e) { return ''; } };
    const OS = data.oseong || [], KB = data.kanbu || [];
    const RO = Object.fromEntries([].concat(OS, KB, data.extra || []).map(r => [r.name, r]));
    const HIDE = new Set(data.hideImgs || []);
    const POW = data.powers || [];
    const PLACE_IMG = (p) => IMG(p + '_장소');
    const PW = Object.entries(data.places || {}).flatMap(([k, ws]) => ws.map(w => [w.replace(/\s/g, ''), k])).sort((a, b) => b[0].length - a[0].length);
    const placeKeyOf = (t) => { const x = String(t || '').replace(/\s/g, ''); const hit = PW.find(([w]) => x.includes(w)); return hit ? hit[1] : ''; };

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
    const me = () => { const n = (st0().me || '').replace(/\{user\}/g, '').trim(); return n || '마왕'; };
    const save = () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        lsSet(PREF_KEY, M.prefs);
        if (!saveId) return;
        M.lines = M.lines.slice(-200);
        const { prefs, ...mem } = M;
        lsSet(memKey(saveId), mem);
        const sv = curSave();
        if (sv) { const st = st0(); sv.sum = { day: st.day || 0, place: st.place || '', power: (st.power && st.power.n) || 0, bg: M.lastBg || '' }; sv.last = Date.now(); putSaves(); }
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
      beats: [], i: -1, typing: null, waiting: false, sentAt: 0, lastKey: '',
      tab: 'stage', sideTab: 'oseong', sub: null, modal: null, bgKey: '', placeK: '허름한 반지하', faces: {}, present: [], freshGem: '', riteDone: {}
    };
    const SIDE_TABS = [['oseong', '오성', 'star'], ['kanbu', '마왕군', 'crown'], ['ops', '작전', 'map'], ['log', '일지', 'book']];
    const PHONE_TABS = [['stage', '무대', 'stage']].concat(SIDE_TABS);

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="mq">
      <div class="mq-main">
        <div class="mq-stage" id="mq-stage">
          <div class="mq-bg"><i class="mq-bgl"></i><i class="mq-bgl"></i></div><div class="mq-tint"></div>
          <div class="mq-pt" id="mq-pt"><img alt=""></div>
          <div class="mq-alarm" aria-hidden="true"></div>
          <div class="mq-hud" id="mq-hud"></div>
          <button data-mq="more" class="mq-more" aria-label="메뉴">${ic('more')}</button>
          <div class="mq-pops" id="mq-pops" aria-live="polite"></div>
          <div class="mq-daycard" id="mq-daycard" aria-hidden="true"></div>
          <div class="mq-dlg" id="mq-dlg" data-mq="next"></div>
        </div>
        <aside class="mq-side" id="mq-side">
          <nav class="mq-stabs" id="mq-stabs"></nav>
          <div class="mq-panel" id="mq-panel"></div>
        </aside>
      </div>
      <footer class="mq-foot">
        <div class="mq-sugg" id="mq-sugg"></div>
        <div class="mq-comp">
          <button class="mq-actbtn" data-mq="act" title="*행동* 넣기">${ic('hand')}<span>행동</span></button>
          <textarea id="mq-in" rows="1" placeholder="마왕의 말과 행동을 적어요 · *별표* 안은 행동 (Enter 보내기 · Shift+Enter 줄바꿈)"></textarea>
          <button class="mq-regen" data-mq="regen" title="크랙에서 이 응답을 다시 생성">다시</button>
          <button class="mq-send" data-mq="send" aria-label="보내기">${ic('send')}<span>보내기</span></button>
        </div>
      </footer>
      <nav class="mq-tabs" id="mq-tabs"></nav>
      <div class="mq-layer" id="mq-title" hidden></div>
      <div class="mq-layer" id="mq-cine" hidden></div>
      <div class="mq-layer" id="mq-rite" hidden></div>
      <div class="mq-layer" id="mq-end" hidden></div>
      <div class="mq-over" id="mq-modal" hidden><div class="mq-box" id="mq-box" role="dialog"></div></div>
      <div class="mq-banner" id="mq-banner" hidden></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const mqRoot = $('.mq');
    const narrow = () => { try { return root.matchMedia('(max-width: 760px)').matches; } catch (e) { return false; } };
    if (narrow()) $('#mq-in').placeholder = '말이나 *행동*을 적어요';
    [mqRoot, $('.mq-main'), $('#mq-stage')].forEach(n => n.addEventListener('scroll', () => { if (n.scrollTop || n.scrollLeft) { n.scrollTop = 0; n.scrollLeft = 0; } }));
    mqRoot.classList.toggle('nofx', !M.prefs.fx);
    mqRoot.addEventListener('focusin', (e) => { if (e.target.matches('textarea, input[type=text], input:not([type])')) mqRoot.classList.add('typing'); });
    mqRoot.addEventListener('focusout', () => { setTimeout(() => { const a = document.activeElement; if (!a || !mqRoot.contains(a) || !a.matches('textarea, input')) mqRoot.classList.remove('typing'); }, 60); });
    const toast = (t) => o.toast(t);
    // 공통 키트: 지난 줄거리 · 읽기 설정(글자 크기·자동 넘김) · 장면 카드 · 대사 찾기 · 첫 사용법 · 해석 실패 기록
    const K = root.CrionKit ? root.CrionKit.create({
      el, accent: '#c8a25a', packId: PK_ID, packName: data.title || '마법소녀의 최종보스', toast: o.toast,
      fontTargets: ['.mq-dlg'], unit: (l) => 'D+' + (l.d || 0),
      coach: [
        { sel: '#mq-dlg', title: '대사창', text: '누르면 다음 대사로 넘어가요. 글자가 써지는 중에 누르면 문장이 바로 다 보여요.' },
        { sel: '.mq-crownbtn', title: '그림자 왕관', text: '권능 다섯 개가 보석으로 박혀요. 사랑·흑화·전투, 되찾은 방식마다 색이 달라요. 누르면 권능 목록이에요.' },
        { sel: '.mq-risk', title: '발각의 눈', text: '정체가 드러날 위험만큼 눈이 뜨여요. 위기가 되면 화면 가장자리가 붉어져요.' },
        { sel: '#mq-sugg', title: '행동 칩', text: '지금 장면에 맞는 행동을 입력칸에 채워요. 보내기는 직접 눌러요.' },
        { sel: '#mq-stabs', title: '어전 패널', text: '오성 · 마왕군 · 작전(지금 할 일·단서·명령) · 일지를 여기서 봐요.' },
        { sel: '#mq-tabs', title: '아래 탭', text: '오성 · 마왕군 · 작전(지금 할 일·단서·명령) · 일지를 여기서 봐요.' },
        { sel: '.mq-more', title: '⋯ 메뉴', text: '지난 대사 찾기, 장면 카드 만들기, 글자 크기·자동 넘김, 크랙 원래 화면이 여기 있어요.' }
      ]
    }) : null;

    // ---------- 배경 · 인물 ----------
    let bgFlip = 0;
    function setBg(src) {
      if (!src || src === R.bgKey) return;
      R.bgKey = src;
      const ls = el.querySelectorAll('.mq-bgl');
      bgFlip = 1 - bgFlip;
      ls[bgFlip].style.backgroundImage = cssUrl(src);
      ls[bgFlip].classList.add('on'); ls[1 - bgFlip].classList.remove('on');
      M.lastBg = src;
    }
    function setPortrait(src, who) {
      const pt = $('#mq-pt'), im = pt.querySelector('img');
      if (!src) { pt.classList.remove('on'); return; }
      if (im.getAttribute('src') !== src) {
        pt.classList.remove('on'); void pt.offsetWidth;
        im.onload = () => { pt.classList.toggle('wide', im.naturalWidth / Math.max(1, im.naturalHeight) >= 1.2); };
        im.src = src;
      }
      pt.style.setProperty('--glow', (RO[who] && RO[who].color) || '#c8a25a');
      pt.classList.add('on');
    }
    function setMood() {
      const st = st0();
      const p = String(st.place || '') + ' ' + (R.placeK || '');
      $('.mq-tint').className = 'mq-tint' + (/반지하/.test(p) ? ' under' : /지하/.test(p) ? ' deep' : /협회/.test(p) ? ' cold' : /방송|스튜디오|로비/.test(p) ? ' studio' : '');
      $('#mq-stage').classList.toggle('alarm', riskLv(st.risk, st.riskLabel) === 'bad');
    }

    // ---------- 머리 (왕관 · 날 · 발각의 눈) ----------
    function gems() {
      const st = st0(), n = (st.power && st.power.n) || 0;
      let spare = Math.max(0, n - POW.filter(p => M.powers[p[1]]).length);
      return POW.map(([k, who]) => { const m = M.powers[who]; const on = !!m || (spare > 0 && (spare--, true)); return { on, c: m && METHOD[m] ? METHOD[m].c : '', fresh: R.freshGem === who, k, who, m }; });
    }
    function renderHud() {
      const st = st0();
      const lv = riskLv(st.risk, st.riskLabel);
      const mana = st.mana;
      $('#mq-hud').innerHTML = `
        <button class="mq-crownbtn" data-mq="powers" aria-label="권능 ${(st.power && st.power.n) || 0}/5">${crownSvg(gems())}<span>권능 <b>${(st.power && st.power.n) || 0}</b>/5</span></button>
        <div class="mq-when"><b>D+${st.day != null ? st.day : 0}</b><span>${ic('pin')}${esc(st.place || '허름한 반지하')}</span></div>
        ${st.day == null && !st.mana ? '' : `<div class="mq-meters">
          <span class="mq-mana" title="마력">${mana ? `<u><s style="width:${clamp(mana.n / Math.max(1, mana.of) * 100, 0, 100)}%"></s></u><em>마력 ${mana.n}<small>/${mana.of}</small></em>` : '<em>마력 –</em>'}</span>
          ${st.money != null || st.moneyText ? `<span class="mq-coin" title="자금 · 리제가 관리">${esc(st.money != null ? won(st.money) : st.moneyText)}</span>` : ''}
          <span class="mq-risk ${lv}" title="정체 발각 위험${st.riskLabel ? ' · ' + esc(st.riskLabel) : ''}">${eyeSvg(st.risk)}<em>${st.risk != null ? st.risk : '–'}${st.riskLabel ? `<small>${esc(st.riskLabel)}</small>` : ''}</em></span>
        </div>`}`;
    }

    // ---------- 알림 ----------
    function pop(html, cls) {
      if (!M.prefs.fx && !/big/.test(cls || '')) return;
      const box = $('#mq-pops');
      const n = document.createElement('div');
      n.className = 'mq-pop ' + (cls || '');
      n.innerHTML = html;
      box.appendChild(n);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 500); }, /big/.test(cls || '') ? 4800 : 3400);
    }
    function dayCard(d, place) {
      if (!M.prefs.fx) return;
      const c = $('#mq-daycard');
      c.innerHTML = `<b>D+${d}</b><span>${esc(place || '')}</span>`;
      c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    }
    function notifyEvents(ev) {
      if (ev.day) dayCard(ev.day.to, st0().place);
      (ev.affUp || []).forEach(a => {
        const d = Math.round((a.to - a.from) * 10) / 10;
        const c = (RO[a.n] || {}).color;
        if (a.stageChanged) pop(`<i class="dot" style="--c:${c}"></i><b>${esc(a.n)}</b><span>관계가 <u>${esc(a.stage)}</u>(으)로</span>`, 'big aff');
        else if (d) pop(`<i class="dot" style="--c:${c}"></i><b>${esc(a.n)}</b><span class="${d > 0 ? 'up' : 'dn'}">호감도 ${d > 0 ? '+' : ''}${d}</span>`, 'aff');
      });
      (ev.crackUp || []).forEach(c => { const d = Math.round((c.to - c.from) * 10) / 10; if (d) pop(`<i class="dot crk"></i><b>${esc(c.n)}</b><span class="crk">마음의 균열 ${d > 0 ? '+' : ''}${d}</span>`, 'crack'); });
      if (ev.risk) pop(`<i class="dot risk"></i><b>발각 위험 ${ev.risk.to}</b><span>${esc(ev.risk.label || '')}</span>`, 'risk ' + riskLv(ev.risk.to, ev.risk.label));
      if (ev.newClues) pop(`<i class="dot clue"></i><b>단서 ${ev.newClues}개</b><span>작전 탭에 적었어요</span>`, 'clue');
      if (ev.money && Math.abs(ev.money.to - ev.money.from) >= 1000) { const d = ev.money.to - ev.money.from; pop(`<i class="dot coin"></i><b>자금</b><span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${won(d)}</span>`, 'money'); }
      if (ev.power && !(ev.recovered || []).length) pop(`<i class="dot gold"></i><b>권능 ${ev.power.to}/5</b><span>잃었던 힘 하나가 돌아왔어요</span>`, 'big power');
    }

    // ---------- 어전 패널 ----------
    const portraitOf = (n) => IMG('기본상태_' + n);
    const seal = (who, big) => { const p = POW.find(x => x[1] === who) || []; const m = M.powers[who]; return `<span class="mq-seal ${m ? 'broken' : ''}${big ? ' big' : ''}" style="${m ? '--sc:' + (METHOD[m] || {}).c : ''}" title="${m ? esc(p[0]) + ' 회수 · ' + esc(m) : esc(p[0] || '') + ' 봉인 중'}"><b>${esc((p[0] || '?')[0])}</b></span>`; };
    const stageTrack = (v) => { const i = stageIdx(v); return `<span class="mq-track" title="${i >= 0 ? STAGES[i] : '잠김'}">${STAGES.map((s, k) => `<i class="${k < i ? 'past' : k === i ? 'now' : ''}"></i>`).join('')}${v != null ? `<em style="left:${clamp(v, 0, 100)}%"></em>` : ''}</span>`; };
    const fissure = (v) => v == null ? '' : `<span class="mq-fis" title="마음의 균열 ${v}"><s style="width:${clamp(v, 0, 100)}%"></s></span>`;
    function oseongHtml() {
      if (R.sub && OS.some(x => x.name === R.sub)) return personHtml(R.sub);
      const st = st0();
      return `<header class="mq-ph"><h3>오성</h3><p>마왕의 권능을 하나씩 봉인해 둔 다섯 마법소녀. 지금은 협회의 얼굴이자 방송국의 스타예요.</p></header>
        <div class="mq-dossiers">${OS.map(p => {
          const a = M.aff[p.name], c = M.crack[p.name], meth = M.powers[p.name], rel = M.rel[p.name];
          const near = R.present.includes(p.name);
          return `<button class="mq-dos ${meth ? 'won' : ''}" data-mq="who" data-k="${esc(p.name)}" style="--c:${p.color}">
            <span class="mq-dimg"><img src="${esc(portraitOf(p.name))}" alt="" loading="lazy">${near ? '<em class="mq-here">이 장면에 있음</em>' : ''}</span>
            <span class="mq-dmeta">
              <span class="mq-dname"><b>${esc(p.name)}</b><small>${p.age}세</small>${seal(p.name)}</span>
              <span class="mq-djob">${esc(p.job)}</span>
              ${a != null ? `<span class="mq-drow">${stageTrack(a)}<b class="mq-n">${a}</b></span><span class="mq-dstage">${esc(STAGES[stageIdx(a)])}${rel ? ` · <i>${esc(rel)}</i>` : ''}</span>` : `<span class="mq-dlock">${ic('lock')}호감도는 아직 잠겨 있어요${rel ? ` · ${esc(rel)}` : ''}</span>`}
              ${c != null ? `<span class="mq-drow">${fissure(c)}<b class="mq-n crk">${c}</b></span>` : ''}
            </span></button>`;
        }).join('')}</div>
        ${st.aff ? '' : '<p class="mq-foot-note">호감도와 균열은 크랙 상태창에서 잠금이 풀리면 여기에 그려져요.</p>'}`;
    }
    function personHtml(n) {
      const p = RO[n], a = M.aff[n], c = M.crack[n], meth = M.powers[n], h = (M.hist || {})[n];
      const pw = POW.find(x => x[1] === n) || [];
      const seen = Object.keys(M.seen || {}).filter(k => k.endsWith('_' + n) && !HIDE.has(k));
      const i = stageIdx(a);
      return `<header class="mq-ph row"><button class="mq-back" data-mq="sub-back" aria-label="뒤로">${ic('back')}</button><h3>${esc(n)}</h3><span class="mq-age">${p.age}세</span></header>
        <div class="mq-file" style="--c:${p.color}">
          <div class="mq-fimg"><img src="${esc(portraitOf(n))}" alt=""></div>
          <div class="mq-fbody">
            <p class="mq-fjob">${esc(p.job)}</p>
            <p class="mq-flook">${esc(p.look)}</p>
            <div class="mq-fpow">${seal(n, true)}<div><b>권능 「${esc(pw[0] || p.power)}」</b><span>${esc(pw[2] || '')}</span><em>${meth ? `<u style="color:${(METHOD[meth] || {}).c}">${esc(meth)}</u>으로 되찾음 — ${esc((METHOD[meth] || {}).d || '')}` : '아직 그녀 안에 봉인되어 있어요'}</em></div></div>
            <div class="mq-fstat"><span>관계</span>${a != null ? `<div>${stageTrack(a)}<p><b>${esc(STAGES[i])}</b> · 호감도 ${a}${M.rel[n] ? ' · ' + esc(M.rel[n]) : ''}</p>${spark(h, 1, 'aff')}</div>` : `<div class="mq-dlock">${ic('lock')}잠김</div>`}</div>
            <div class="mq-fstat"><span>균열</span>${c != null ? `<div>${fissure(c)}<p>마음의 균열 ${c}</p>${spark(h, 2, 'crk')}</div>` : `<div class="mq-dlock">${ic('lock')}잠김</div>`}</div>
            <div class="mq-fstat"><span>만나는 곳</span><div><p>${esc(p.route)}</p></div></div>
          </div>
        </div>
        <div class="mq-btns"><button class="mq-btn gold" data-mq="fill" data-v="${esc(josa(n, '을', '를'))} 찾아간다.">찾아가기</button><button class="mq-btn" data-mq="fill" data-v="${esc(n)}에게 말을 건다.">말 걸기</button><button class="mq-btn" data-mq="fill" data-v="노엘에게 ${esc(n)}의 오늘 일정을 묻는다.">노엘에게 일정 묻기</button></div>
        <h4 class="mq-h4">본 장면 <small>${seen.length}</small></h4>
        <div class="mq-grid">${seen.length ? seen.map(k => `<button data-mq="view" data-k="${esc(k)}"><img src="${esc(IMG(k))}" alt="" loading="lazy"><small>${esc(k.split('_').slice(0, -1).join(' ').replace(/\//g, '·'))}</small></button>`).join('') : '<p class="mq-empty-s">함께한 장면이 생기면 여기 모여요.</p>'}</div>`;
    }
    function kanbuHtml() {
      return `<header class="mq-ph"><h3>마왕군</h3><p>8년 동안 잠든 마왕에게 마력을 부어 넣느라 일반인만큼 약해진 다섯 충신. 지금은 알바로 왕실을 먹여 살려요.</p></header>
        <button class="mq-brief" data-mq="sc" data-k="/간부보고"><span>${ic('crown')}</span><b>어전 회의 열기</b><small>다섯 간부가 각자 맡은 일을 차례로 보고해요</small></button>
        <div class="mq-court">${KB.map(k => `<div class="mq-knight ${R.present.includes(k.name) ? 'here' : ''}" style="--c:${k.color}">
          <img src="${esc(IMG('기본상태_' + k.name))}" alt="" loading="lazy">
          <div class="mq-kt"><b>${esc(k.name)}</b><small>${esc(k.role)}</small></div>
          <p class="mq-kjob">${esc(k.job)}</p>
          <p class="mq-kpart">맡은 일 · ${esc(k.part)}${M.rel[k.name] ? ` <u>${esc(M.rel[k.name])}</u>` : ''}</p>
          <div class="mq-kbtn"><button data-mq="fill" data-v="${esc(k.name)}에게 말을 건다.">말 걸기</button><button data-mq="fill" data-v="${esc(k.name)}에게 ${esc(String(k.part).split(/[·,]/)[0].trim())}에 대해 묻는다.">${esc(String(k.part).split(/[·,]/)[0].trim())} 묻기</button></div>
        </div>`).join('')}</div>`;
    }
    // ---------- 작전: 지금 할 일 (보이는 것만으로 판단 — 숨은 진실은 쓰지 않는다) ----------
    const visited = (re) => Object.values(M.days || {}).some(d => (d.places || []).some(p => re.test(p))) || Object.keys(M.seen || {}).some(k => re.test(k)) || re.test(st0().place || '');
    function objective() {
      const st = st0(), n = (st.power && st.power.n) || 0, lv = riskLv(st.risk, st.riskLabel);
      if (lv === 'bad') return { urgent: true, t: '정체가 드러나기 직전이에요', d: '은신술로 몸을 숨기거나, 리제에게 서류를, 노엘에게 정보를 막아 달라고 해요. 위험이 100이 되면 위기 사건이 터져요.', acts: [['은신술로 기척을 숨긴다.', '은신술'], ['리제에게 서류 조작을 부탁한다.', '리제에게 서류 부탁'], ['노엘에게 협회 쪽 정보를 차단해 달라고 한다.', '노엘에게 정보 차단']] };
      if (!st.day && !M.turns) return { t: '반지하에서 눈을 뜨다', d: '8년 만에 깨어났어요. 간부들에게 그동안 무슨 일이 있었는지 물어보는 것부터 시작해요.', acts: [['세이렌에게 그동안 있었던 일을 묻는다.', '세이렌에게 묻기']] };
      if (!visited(/방송|스튜디오|예능|로비/)) return { t: '방송국에 잠입하기', d: '협회의 얼굴인 오성은 방송국에서 가장 많이 활동해요. 면접에서는 마왕의 재능을 직접 말해 보세요. 떨어져도 다른 직군으로 다시 도전할 수 있어요.', acts: [['방송국 채용 공고를 확인한다.', '채용 공고 확인'], ['리제에게 위장 서류를 준비해 달라고 한다.', '리제에게 위장 서류']] };
      if (n === 0) return { t: '오성과 접점 만들기', d: '직군마다 자주 마주치는 오성이 달라요. 한 사람과 천천히 관계를 쌓아 보세요.', routes: true, acts: [['/위장전환', '위장 신분 바꾸기', true]] };
      if (n < 3) return { t: `권능 되찾기 · ${n}/5`, d: '세 번째 권능을 되찾는 순간 이야기의 갈래가 크게 굳어져요. 어떤 방식으로 모을지 정해 두면 좋아요.', routes: true };
      if (n < 5) return { t: `남은 권능 · ${n}/5`, d: '권능 세 개를 되찾았어요. 이제 힘으로 제압하는 길(전투)도 열렸어요.', routes: true };
      return { t: '다섯 권능이 모였어요', d: '왕관이 완성됐어요. 협회와 마주할 때예요.', acts: [['/간부보고', '어전 회의', true]] };
    }
    function milestones() {
      const st = st0(), n = (st.power && st.power.n) || 0;
      return [['반지하에서 눈뜨다', M.turns > 0], ['방송국 잠입', visited(/방송|스튜디오|예능|로비/)], ['첫 권능', n >= 1], ['세 번째 권능 · 갈래가 굳어짐', n >= 3], ['다섯 권능 · 왕관 완성', n >= 5], ['엔딩', (M.endings || []).length > 0]];
    }
    function opsHtml() {
      const ob = objective();
      const st = st0();
      const scs = data.shortcuts || [];
      const ms = milestones();
      const cs = M.clues || [];
      const turns = M.turns || 0;
      return `<section class="mq-obj ${ob.urgent ? 'urgent' : ''}"><small>${ob.urgent ? '지금 급한 일' : '지금 할 일'}</small><h3>${esc(ob.t)}</h3><p>${esc(ob.d)}</p>
          ${ob.routes ? `<ul class="mq-routes">${OS.map(p => `<li style="--c:${p.color}"><b>${esc(p.name)}</b><span>${esc(p.route)}</span>${M.powers[p.name] ? `<em style="color:${(METHOD[M.powers[p.name]] || {}).c}">${esc(M.powers[p.name])}</em>` : ''}</li>`).join('')}</ul>` : ''}
          ${(ob.acts || []).length ? `<div class="mq-oacts">${ob.acts.map(([v, l, sc]) => `<button data-mq="${sc ? 'sc' : 'fill'}" ${sc ? `data-k="${esc(v)}"` : `data-v="${esc(v)}"`}>${esc(l)}</button>`).join('')}</div>` : ''}</section>
        <ol class="mq-path">${ms.map(([t, ok], i) => `<li class="${ok ? 'ok' : (i && ms[i - 1][1] ? 'next' : '')}"><i></i><span>${esc(t)}</span></li>`).join('')}</ol>
        <h4 class="mq-h4">명령 <small>입력칸에 채워요 · 보내기는 직접</small></h4>
        <div class="mq-cmds">${scs.map(s => `<button class="mq-cmd" data-mq="sc" data-k="${esc(s.key)}"><b>${esc(s.key)}</b><span>${esc(s.desc.replace(/^[^\p{L}\p{N}]+/u, ''))}</span></button>`).join('')}</div>
        <div class="mq-days"><span>시간 건너뛰기</span>${[1, 3, 7].map(d => `<button data-mq="skip" data-k="${d}">${d}일</button>`).join('')}</div>
        <h4 class="mq-h4">단서 노트 <small>${cs.length}개</small><button class="mq-link" data-mq="sc" data-k="/단서노트">크랙에서 정리 받기</button></h4>
        ${cs.length ? `<ol class="mq-clues">${cs.map(c => `<li><em>${c.n}</em><div><b>${esc(c.text)}</b>${c.when ? `<small>${esc(c.when)}</small>` : ''}</div></li>`).join('')}</ol>`
          : '<p class="mq-empty-s">직접 확인한 단서만 적혀요. 아직 모르는 진실은 미리 나오지 않아요.</p>'}
        ${st.assoc ? `<div class="mq-assoc"><b>협회 동향</b><span>${esc(st.assoc)}</span></div>` : ''}
        <h4 class="mq-h4">엔딩 <small>${turns}턴째 · ${data.endingFrom || 30}턴부터</small></h4>
        <div class="mq-ends">${(data.endings || []).map(e => { const got = (M.endings || []).includes(e.name); return `<div class="mq-end ${got ? 'got' : ''}"><em class="g-${esc(e.grade)}">${esc(e.grade)}</em><div><b>${got ? esc(e.name) : '아직 보지 못한 결말'}</b><span>${esc(e.hint)}</span></div>${got && IMG('엔딩_' + e.name) ? `<button data-mq="view" data-k="엔딩_${esc(e.name)}">보기</button>` : ''}</div>`; }).join('')}</div>`;
    }
    function logHtml() {
      const ds = Object.entries(M.days || {}).map(([d, v]) => [+d, v]).sort((a, b) => b[0] - a[0]);
      const all = Object.keys(data.imgs || {}).filter(k => !HIDE.has(k));
      const seenN = all.filter(k => M.seen[k]).length;
      return `<header class="mq-ph"><h3>마왕의 일지</h3><p>하루하루 다녀간 곳, 만난 사람, 달라진 것.</p></header>
        <button class="mq-albumbtn" data-mq="album"><b>본 그림</b><span>${seenN} / ${all.length}</span><i style="width:${all.length ? seenN / all.length * 100 : 0}%"></i></button>
        <button class="mq-albumbtn ghost" data-mq="lines"><b>지난 대사 전체</b><span>${M.lines.length}줄</span></button>
        ${ds.length ? `<div class="mq-days-log">${ds.map(([d, v]) => `<article class="mq-day"><header><b>D+${d}</b><span>${esc((v.places || []).join(' → '))}</span></header>
            ${v.first ? `<p class="mq-dq">${esc(v.first)}${v.first.length >= 90 ? '…' : ''}</p>` : ''}
            ${(v.met || []).length ? `<div class="mq-met">${v.met.map(n => `<span style="--c:${(RO[n] || {}).color || '#9d93a3'}">${esc(n)}</span>`).join('')}</div>` : ''}
            ${(v.notes || []).length ? `<ul>${v.notes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</div>`
          : '<p class="mq-empty-s">이야기가 시작되면 하루마다 한 장씩 쌓여요.</p>'}`;
    }
    function albumHtml() {
      const all = Object.keys(data.imgs || {}).filter(k => !HIDE.has(k));
      const groups = [['오성', OS.map(p => p.name), (k) => !/변신/.test(k)], ['변신한 오성', OS.map(p => p.name), (k) => /변신/.test(k)], ['마왕군 · 협회', KB.map(p => p.name).concat(['협회장']), () => true]];
      const sec = (title, names, f) => {
        const keys = all.filter(k => names.some(n => k.endsWith('_' + n)) && f(k));
        const got = keys.filter(k => M.seen[k]);
        return `<h4 class="mq-h4">${title} <small>${got.length}/${keys.length}</small></h4><div class="mq-grid">${got.map(k => `<button data-mq="view" data-k="${esc(k)}"><img src="${esc(IMG(k))}" alt="" loading="lazy"><small>${esc(k.replace(/_/g, ' ').replace(/\//g, '·'))}</small></button>`).join('')}${keys.length > got.length ? `<span class="mq-locked">${ic('lock')}<small>${keys.length - got.length}장 남음</small></span>` : ''}</div>`;
      };
      const places = all.filter(k => /_장소$/.test(k));
      return `<h3>본 그림</h3>${groups.map(([t, ns, f]) => sec(t, ns, f)).join('')}
        <h4 class="mq-h4">장소 <small>${places.filter(k => M.seen[k]).length}/${places.length}</small></h4><div class="mq-grid wide">${places.map(k => M.seen[k] ? `<button data-mq="view" data-k="${esc(k)}"><img src="${esc(IMG(k))}" alt="" loading="lazy"><small>${esc(k.replace(/_장소$/, ''))}</small></button>` : `<span class="mq-locked">${ic('lock')}</span>`).join('')}</div>`;
    }
    function renderPanel() {
      const tab = R.tab === 'stage' ? R.sideTab : R.tab;
      R.sideTab = tab;
      const dot = (k) => (k === 'ops' && (R.newClue || riskLv(st0().risk, st0().riskLabel) === 'bad')) || (k === 'log' && R.newDay) ? '<em></em>' : '';
      $('#mq-stabs').innerHTML = SIDE_TABS.map(([k, n, i]) => `<button data-mq="tab" data-k="${k}" class="${tab === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${dot(k)}</button>`).join('');
      const p = $('#mq-panel');
      const keep = p.scrollTop;
      p.innerHTML = tab === 'oseong' ? oseongHtml() : tab === 'kanbu' ? kanbuHtml() : tab === 'ops' ? opsHtml() : logHtml();
      p.scrollTop = R.keepScroll ? keep : 0; R.keepScroll = false;
      mqRoot.classList.toggle('sheet-on', R.tab !== 'stage');
      $('#mq-tabs').innerHTML = PHONE_TABS.map(([k, n, i]) => `<button data-mq="tab" data-k="${k}" class="${R.tab === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${dot(k)}</button>`).join('');
    }

    // ---------- 입력 도우미 (지금 장면에 맞는 행동) ----------
    function renderSugg() {
      const st = st0();
      const out = [];
      const ppl = R.present.filter(n => RO[n] && n !== '방송국 면접관').slice(0, 2);
      ppl.forEach(n => out.push([`${n}에게 말을 건다.`, `${n}에게 말 걸기`, (RO[n] || {}).color]));
      const lv = riskLv(st.risk, st.riskLabel);
      if (lv === 'bad' || lv === 'warn') out.push(['은신술로 기척을 숨긴다.', '은신술', '#e5484d']);
      if (/반지하/.test(st.place || R.placeK)) out.push(['/간부보고', '어전 회의', '', true]);
      out.push(['*주변을 천천히 둘러본다*', '주변 살피기']);
      if ((M.turns || 0) > 2) out.push(['/사칭금지', '사칭금지', '', true]);
      $('#mq-sugg').innerHTML = out.map(([v, l, c, sc]) => `<button data-mq="${sc ? 'sc' : 'add'}" ${sc ? `data-k="${esc(v)}"` : `data-v="${esc(v)}"`} ${c ? `style="--c:${c}"` : ''} class="${c ? 'tint' : ''}">${esc(l)}</button>`).join('');
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
      const d = $('#mq-dlg');
      const b = R.beats[i];
      if (R.briefPending && (i >= R.beats.length - 1)) { const bp = R.briefPending; R.briefPending = null; setTimeout(() => openModal('brief', bp), 400); }
      if (!b) { d.className = 'mq-dlg k-end'; d.innerHTML = `<div class="mq-endq">${esc(me())}의 차례 — 말이나 행동을 적어 보세요.</div>`; return; }
      if (b.bgSrc) setBg(b.bgSrc);
      setPortrait(b.face || '', b.who);
      if (b.rite && !R.riteDone[b.rite.who]) { R.riteDone[b.rite.who] = 1; openRite(b.rite, b.portrait); }
      const last = i >= R.beats.length - 1;
      const prog = R.beats.length > 1 ? `<span class="mq-prog">${i + 1}<i>/</i>${R.beats.length}</span>` : '';
      if (b.kind === 'title') {
        d.className = 'mq-dlg k-title';
        d.innerHTML = `<div class="mq-ep"><small>EP. ${esc(b.ep)}</small><b>${esc(b.text)}</b></div>${prog}`;
        R.typing = null; return;
      }
      const r = b.kind === 'say' ? RO[b.who] : null;
      d.className = 'mq-dlg k-' + b.kind + (last ? ' last' : '');
      d.style.setProperty('--nc', (r && r.color) || '#c8a25a');
      d.innerHTML = `${b.kind === 'say' ? `<div class="mq-name"><b>${esc(b.who)}</b>${r && r.role ? `<small>${esc(r.role)}</small>` : ''}</div>` : ''}
        ${b.act ? `<div class="mq-act">${esc(b.act)}</div>` : ''}<div class="mq-dline"></div>${prog}
        ${last ? `<div class="mq-endq" hidden>${esc(me())}의 차례 — 아래에 말이나 행동을 적어요.</div>` : '<span class="mq-next" aria-hidden="true"></span>'}`;
      const text = b.kind === 'say' ? `“${b.text}”` : b.kind === 'sys' ? b.text : b.text;
      typeTo(d.querySelector('.mq-dline'), text, () => {
        if (last) { const q = d.querySelector('.mq-endq'); if (q) q.hidden = false; return; }
        if (K) K.autoNext(text, () => { if (R.i === i && !R.modal && !R.cine && !R.waiting && !K.isOpen() && $('#mq-rite').hidden) next(); });
      });
    }
    function next() {
      if (K) K.stopAuto();
      if (R.typing) { R.typing.finish(); return; }
      if (R.waiting) return;
      if (R.i < R.beats.length - 1) { R.i++; showBeat(R.i); }
    }
    function assign(beats, st) {
      let place = placeKeyOf(st && st.place) || R.placeK;
      const lastFace = {};
      beats.forEach(b => {
        if (b.place) place = b.place;
        else if (b.kind !== 'say') { const k = placeKeyOf(b.text); if (k && b.text.length < 60) place = k; }
        b.bgSrc = b.bg || PLACE_IMG(place) || M.lastBg;
        b.face = '';
        if (b.portrait) { b.face = b.portrait; if (b.pinfo && b.pinfo.who) lastFace[b.pinfo.who] = b.portrait; }
        else if (b.kind === 'say' && b.known) b.face = lastFace[b.who] || R.faces[b.who] || IMG('기본상태_' + b.who);
        if (b.kind === 'say' && b.face) R.faces[b.who] = b.face;
        if (b.pinfo && b.pinfo.situ === '권능회수' && b.pinfo.method) b.rite = { who: b.pinfo.who, method: b.pinfo.method };
      });
      R.placeK = placeKeyOf(st && st.place) || place;
    }

    // ---------- 권능 회수 의식 ----------
    function openRite(r, src) {
      const p = POW.find(x => x[1] === r.who) || [];
      const m = METHOD[r.method] || { c: '#c8a25a', d: '' };
      R.freshGem = r.who; renderHud();
      const box = $('#mq-rite');
      box.style.setProperty('--rc', m.c);
      box.innerHTML = `<div class="mq-ritebg" style="background-image:${cssUrl(src || portraitOf(r.who))}"></div><div class="mq-riteveil"></div>
        <div class="mq-ritec">${crownSvg(gems(), true)}
          <small>권능 회수</small><h2>「${esc(p[0] || '')}」</h2>
          <p><b style="color:${(RO[r.who] || {}).color}">${esc(r.who)}</b> — <u>${esc(r.method)}</u>. ${esc(m.d)}</p>
          <span class="mq-ritedesc">${esc(p[2] || '')} 능력이 돌아왔어요.</span>
          <button class="mq-btn gold" data-mq="rite-close">왕관을 쓴다</button></div>`;
      box.hidden = false;
    }

    // ---------- 응답 처리 ----------
    function handle(segs) {
      if (R.sm) R.sm.done = true;
      const P = U.parse(segs, roster, IDX);
      const prevDay = st0().day;
      const ev = U.absorb(M, P, data);
      P.beats.forEach(b => { if (b.text) M.lines.push({ d: st0().day || 0, who: b.kind === 'say' ? b.who : '', t: b.text, sys: b.kind === 'sys' }); });
      if (ev.newClues) R.newClue = true;
      if (ev.day || prevDay == null) R.newDay = true;
      R.present = Array.from(new Set(P.beats.filter(b => b.kind === 'say' && b.known).map(b => b.who)));
      const plain = segs.filter(x => x.t === 'text').map(x => x.s).join('\n');
      if (K && plain.length > 300) K.checkParse(!!(P.status || P.prologue || P.phone || P.clues.length || R.expect), '상태창을 찾지 못함', plain);
      const expect = R.expect; R.expect = '';
      save();
      R.beats = P.beats.filter(b => b.text || b.kind === 'title');
      // 그림만 있는 마디(권능 회수 그림 등)의 정보는 다음 마디로 넘긴다
      P.beats.forEach((b, k) => { if (!b.text && b.kind !== 'title' && (b.bg || b.portrait)) { const nb = P.beats.slice(k + 1).find(x => x.text); if (nb) { nb.bg = nb.bg || b.bg; if (!nb.portrait && b.portrait) { nb.portrait = b.portrait; nb.pinfo = b.pinfo; } } } });
      assign(R.beats, M.status);
      // 권능 회수 그림이 장면 안에 없으면(상태창 숫자만 오른 경우) 마지막 마디에 의식을 붙인다
      (ev.recovered || []).forEach(r => { if (!R.beats.some(b => b.rite && b.rite.who === r.who) && R.beats.length) R.beats[R.beats.length - 1].rite = r; });
      R.i = -1;
      renderHud(); setMood(); R.keepScroll = true; renderPanel(); renderSugg();
      notifyEvents(ev);
      if (P.prologue && (P.webtoon.length || P.title)) { playCine(P); return; }
      // 단축어 결과를 화면으로 (A1): 스마트폰 · 위장 신분 고르기 · 간부 보고
      if (P.phone && P.phone.time) R.phoneTime = P.phone.time;
      if (P.phone) setTimeout(() => openModal('phone', P.phone.none ? { none: true } : { home: true, time: P.phone.time, batt: P.phone.batt }), 150);
      else if (expect === 'phone') setTimeout(() => openModal('phone', { content: R.beats.filter(b => b.kind !== 'say').map(b => b.text), says: R.beats.filter(b => b.kind === 'say'), time: R.phoneTime }), 150);
      else if (expect === 'disguise') {
        const items = []; R.beats.forEach(b => String(b.text || '').split(/\n/).forEach(l => { const m = l.match(/^\s*(\d{1,2})\s*[.)·:]\s*(.{2,})$/); if (m) items.push({ n: +m[1], t: m[2].trim() }); }));
        if (items.length) setTimeout(() => openModal('disguise', items), 150);
        else if (/위장\s*신분이\s*없/.test(plain)) toast('아직 위장 신분이 없어요. 방송국 면접 같은 길로 얻을 수 있어요');
      } else if (expect === 'brief') {
        const rep2 = {}; R.beats.filter(b => b.kind === 'say' && KB.some(k => k.name === b.who)).forEach(b => { (rep2[b.who] = rep2[b.who] || []).push(b.text); });
        if (Object.keys(rep2).length >= 2) R.briefPending = rep2;
      }
      if (ev.ending) showEnding(ev.ending);
      startBeats();
    }
    function startBeats() {
      R.i = R.beats.length ? 0 : -1; showBeat(R.i);
      if (K && !R.coached && R.beats.length) { R.coached = true; setTimeout(() => { if (!R.modal && !K.isOpen() && $('#mq-title').hidden) K.coach(); }, 900); }
    }
    // ---------- 프롤로그: 히리온 웹툰 컷을 잘라 다시 짠 장면 — 한 번 누를 때마다 다음 ----------
    //  장면 종류: card(글자 한 장) · img(그림 + 천천히 움직임 + 자막) · cast(다섯 소녀 몽타주) · seal(왕관이 다섯으로 갈라짐)
    let pro = null;
    const proSrc = (p) => asset(p) || '';
    function playCine(P) {
      const c = $('#mq-cine');
      const shots = ((data.prologue && data.prologue.shots) || []).filter(s => s.t !== 'img' || proSrc(s.src));
      if (!shots.length) { M.prologue = true; save(); startBeats(); return; }
      shots.forEach(s => [].concat(s.src || [], s.pics || []).forEach(p => { const im = new Image(); im.src = proSrc(p); }));
      c.innerHTML = `<div class="mq-pro" data-mq="pro-next">
          <div class="mq-pamb"></div>
          <div class="mq-pscene"></div>
          <i class="mq-pfx"></i>
          <div class="mq-pprog"><i style="width:0%"></i></div>
          <span class="mq-ptap" aria-hidden="true">눌러서 계속</span>
          <div class="mq-pend"><div>${crownSvg(gems(), true)}<small>${esc((data.prologue && data.prologue.ep) || 'EP. PROLOG')}</small><b>${esc((data.prologue && data.prologue.title) || '반지하의 마왕')}</b><p>8년의 잠에서 깨어난 왕.<br>권능 다섯 조각은 지금, 별이 된 소녀들의 손에 있다.</p><button class="mq-btn gold" data-mq="cine-end">눈을 뜬다</button></div></div>
        </div>
        <button class="mq-skip" data-mq="cine-end">건너뛰기</button>`;
      c.hidden = false; R.cine = true;
      pro = { shots, i: -1, typing: null, cur: null };
      M.prologue = true; save();
      proShow(0);
    }
    function proType(node, text, delay) {
      clearInterval(pro.tT); clearTimeout(pro.dT);
      const ms = SPEED[M.prefs.speed] == null ? 22 : SPEED[M.prefs.speed];
      node.textContent = '';
      if (!text) { pro.typing = null; return; }
      if (!ms || !M.prefs.fx) { node.textContent = text; pro.typing = null; return; }
      let k = 0;
      pro.typing = () => { clearInterval(pro.tT); clearTimeout(pro.dT); node.textContent = text; pro.typing = null; };
      pro.dT = setTimeout(() => { pro.tT = setInterval(() => { k++; node.textContent = text.slice(0, k); if (k >= text.length) { clearInterval(pro.tT); pro.typing = null; } }, Math.max(30, ms * 1.7)); }, delay || 0);
    }
    function proMove(im, s, first) {
      const f = s.from || { x: 50, y: 50, z: 1.12 }, t = s.to || { x: 50, y: 50, z: 1.02 };
      if (first) { im.style.transition = 'none'; im.style.objectPosition = `${f.x}% ${f.y}%`; im.style.transform = `scale(${f.z})`; void im.offsetWidth; }
      if (!M.prefs.fx) { im.style.transition = 'none'; im.style.objectPosition = `${t.x}% ${t.y}%`; im.style.transform = `scale(${t.z})`; return; }
      const d = s.dur || 8;
      im.style.transition = `object-position ${d}s cubic-bezier(.25,.1,.25,1), transform ${d}s cubic-bezier(.25,.1,.25,1)`;
      im.style.objectPosition = `${t.x}% ${t.y}%`; im.style.transform = `scale(${t.z})`;
    }
    function proShow(i) {
      const c = $('#mq-cine'); if (!pro || !c) return;
      const root = c.querySelector('.mq-pro');
      c.querySelector('.mq-pprog i').style.width = (Math.min(i, pro.shots.length) / pro.shots.length * 100) + '%';
      if (i >= pro.shots.length) { pro.i = i; root.classList.add('ended'); return; }
      pro.i = i;
      const s = pro.shots[i], prev = pro.cur;
      const scene = c.querySelector('.mq-pscene'), amb = c.querySelector('.mq-pamb');
      const same = s.t === 'img' && prev && prev.t === 'img' && prev.src === s.src;
      root.className = 'mq-pro t-' + s.t + (s.tone ? ' tone-' + s.tone : '') + (s.fx ? ' mqx-' + s.fx : '');
      if (same) {
        proMove(scene.querySelector('.mq-pframe img'), s, false);
      } else {
        [...scene.children].forEach(old => { if (old.classList.contains('out')) { old.remove(); return; } old.classList.add('out'); setTimeout(() => old.remove(), 650); });
        const n = document.createElement('div');
        n.className = 'mq-pcut';
        if (s.t === 'card') n.innerHTML = `<div class="mq-pcard ${esc(s.size || 'mid')}"><p></p></div>`;
        else if (s.t === 'img') n.innerHTML = `<div class="mq-pframe"><img alt=""></div><div class="mq-pcap"><p></p></div>`;
        else if (s.t === 'cast') n.innerHTML = `<div class="mq-pcast">${(s.pics || []).map((p, k) => `<span style="--k:${k}"><img src="${esc(proSrc(p))}" alt=""></span>`).join('')}</div><div class="mq-pcap"><p></p></div>`;
        else if (s.t === 'seal') n.innerHTML = `<div class="mq-pseal">${crownSvg(POW.map(() => ({ on: true })), true)}<div class="mq-pshards">${POW.map((p, k) => `<i style="--k:${k};--c:${(RO[p[1]] || {}).color || '#c8a25a'}"></i>`).join('')}</div></div><div class="mq-pcap"><p></p></div>`;
        scene.appendChild(n);
        if (s.t === 'img') { const im = n.querySelector('img'); im.src = proSrc(s.src); proMove(im, s, true); }
      }
      amb.style.backgroundImage = s.t === 'img' ? cssUrl(proSrc(s.src)) : '';
      if (s.sfx) { const x = document.createElement('b'); x.className = 'mq-psfx'; x.textContent = s.sfx; scene.lastElementChild.appendChild(x); }
      void root.offsetWidth; root.classList.add('go');
      const cut = scene.lastElementChild;
      const p = cut.querySelector('.mq-pcard p, .mq-pcap p');
      if (pro.i !== i) return;
      if (cut.querySelector('.mq-pcap')) cut.querySelector('.mq-pcap').classList.toggle('empty', !s.cap);
      proType(p, s.t === 'card' ? s.text : (s.cap || ''), s.t === 'card' ? 350 : s.t === 'img' && !same ? 700 : 500);
      pro.cur = s;
    }
    function proNext() {
      if (!pro) return;
      if (pro.typing) { pro.typing(); return; }
      if (pro.i < pro.shots.length) proShow(pro.i + 1);
    }
    function cineEnd() { if (pro) { clearInterval(pro.tT); clearTimeout(pro.dT); } pro = null; const c = $('#mq-cine'); c.hidden = true; c.innerHTML = ''; R.cine = false; startBeats(); }
    function showEnding(name) {
      const e = (data.endings || []).find(x => x.name === name) || { name, grade: '', hint: '' };
      const box = $('#mq-end');
      box.innerHTML = `<div class="mq-endbg" style="background-image:${cssUrl(IMG('엔딩_' + name))}"></div><div class="mq-endc"><em class="g-${esc(e.grade)}">${esc(e.grade)} 엔딩</em><b>${esc(name)}</b><span>${esc(e.hint)}</span><button class="mq-btn gold" data-mq="end-close">이야기로 돌아가기</button></div>`;
      box.hidden = false;
    }

    // ---------- 입력칸 ----------
    function autosize() { const ta = $('#mq-in'); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
    function fill(text, add) {
      if (narrow() && R.tab !== 'stage') { R.tab = 'stage'; renderPanel(); }   // 폰: 입력칸이 보이는 무대로 먼저
      const ta = $('#mq-in');
      ta.value = add && ta.value.trim() && !/^[/#]/.test(ta.value.trim()) ? ta.value.replace(/\s+$/, '') + ' ' + text : text;
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); autosize();
      ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
    }
    function insertAct() {
      const ta = $('#mq-in');
      const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
      const sel = v.slice(a, b);
      const pre = v.slice(0, a), post = v.slice(b);
      const sp = pre && !/\s$/.test(pre) ? ' ' : '';
      ta.value = pre + sp + '*' + sel + '*' + (post && !/^\s/.test(post) ? ' ' : '') + post;
      const pos = pre.length + sp.length + 1 + sel.length;
      ta.focus(); ta.setSelectionRange(pos, pos); autosize();
    }
    function fillShortcut(key, extra) {
      const s = (data.shortcuts || []).find(x => x.key === key);
      if (!s) return;
      fill(s.body + (extra ? '\n' + extra : ''));
      toast(`「${key.slice(1)}」 명령을 채웠어요. 보내기를 누르면 크랙이 처리해요`);
    }
    function doSend() {
      const ta = $('#mq-in');
      const text = ta.value.trim();
      if (!text || R.waiting) return;
      if (R.mode !== 'play' || R.away || R.page !== 'chat') { toast(R.away ? '이 세이브의 대화로 돌아온 뒤에 보낼 수 있어요' : '대화 화면이 열린 뒤에 보낼 수 있어요'); return; }
      R.waiting = true; R.sentAt = Date.now();
      R.expect = /^#스마트폰|^\/(스마트폰|정보|연락|가이드|진행요약)\b/.test(text) ? 'phone' : /^#위장신분_전환|^\/위장전환/.test(text) ? 'disguise' : /^#간부_정례보고|^\/간부보고/.test(text) ? 'brief' : '';
      if (K) K.stopAuto();
      if (!/^#/.test(text)) M.lines.push({ d: st0().day || 0, who: me(), t: text, me: true });
      save();
      o.send(text);
      ta.value = ''; autosize();
      waitingUi(true);
    }

    // ---------- 응답 대기 ----------
    const TIPS = Array.isArray(data.tips) && data.tips.length ? data.tips : ['위쪽 ⋯ 메뉴에서 언제든 크랙 원래 화면을 볼 수 있어요.'];
    let tipI = Math.floor(Math.random() * TIPS.length), tipT = null;
    function waitingUi(on, preview) {
      el.classList.toggle('mq-wait', !!on);
      clearInterval(tipT);
      if (!on) return;
      const d = $('#mq-dlg');
      d.className = 'mq-dlg k-wait';
      d.innerHTML = `<div class="mq-typing"><span class="mq-candle"><i></i></span><b>그림자가 움직이는 중</b></div><div class="mq-tip">${esc(TIPS[tipI % TIPS.length])}</div>${preview ? `<small class="mq-stream">${esc(preview.slice(-140))}</small>` : ''}`;
      tipT = setInterval(() => { tipI++; const t = el.querySelector('.mq-tip'); if (t) t.textContent = TIPS[tipI % TIPS.length]; else clearInterval(tipT); }, 5000);
    }
    const waitT = setInterval(() => { if (R.waiting && Date.now() - R.sentAt > 45000) banner('slow'); }, 5000);

    // ---------- 안내 띠 ----------
    function banner(kind) {
      const b = $('#mq-banner');
      if (!kind) { b.hidden = true; b.innerHTML = ''; b.className = 'mq-banner'; return; }
      const row = (btns) => `<div class="mq-brow">${btns}</div>`;
      const std = '<button class="mq-fb" data-mq="crack">크랙 화면 보기</button><button class="mq-fb" data-mq="title">처음 화면</button><button class="mq-fb" data-mq="diag">화면 진단 복사</button>';
      b.hidden = false; b.className = 'mq-banner center';
      if (kind === 'other') b.innerHTML = `<div class="mq-gate"><b>세이브의 대화가 열리지 않았어요</b><span>크랙에서 대화가 지워졌거나 로그인이 풀렸을 수 있어요.</span>${row('<button class="mq-fb primary" data-mq="back-save">다시 열기</button>' + std)}</div>`;
      else if (kind === 'mode') {
        const ms = (R.actions || []).filter(a => a.kind === 'mode');
        const picked = R.sm && R.sm.picked;
        b.innerHTML = `<div class="mq-gate"><b>시작 설정을 골라 주세요</b><span>${picked ? `「${esc(picked)}」를 골랐어요. 크랙이 시작하기를 기다리는 중이에요.` : '고른 것만 크랙에 한 번 눌러 줘요.'}</span>
          <div class="mq-modes">${ms.map(a => `<button class="mq-mode ${picked === a.label ? 'on' : ''}" data-mq="pick-mode" data-id="${a.id}" data-label="${esc(a.label)}">${esc(a.label)}</button>`).join('')}</div>
          ${row('<button class="mq-fb" data-mq="crack-pick">크랙 화면에서 직접 고르기</button><button class="mq-fb" data-mq="title">처음 화면</button>')}</div>`;
      } else if (kind === 'new') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        const why = R.newFlow && R.newFlow.clicked ? '크랙에서 새 대화가 열리면 바로 시작해요.'
          : (R.page === 'detail' && !acts.length ? '크랙 작품 화면에서 「새로하기」 버튼을 찾지 못했어요. 크랙 화면 보기를 눌러 직접 「새로하기」를 누르면 바로 이어져요.' : '크랙 작품 화면을 여는 중이에요…');
        b.innerHTML = `<div class="mq-gate"><span class="mq-candle"><i></i></span><b>새 대화를 여는 중이에요</b><span>${why}</span>${row(acts.map(a => `<button class="mq-fb primary" data-mq="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + '<button class="mq-fb primary" data-mq="crack-pick">크랙 화면에서 직접 고르기</button>' + std)}</div>`;
      } else if (kind === 'old') {
        const acts = (R.actions || []).filter(a => a.kind === 'new');
        b.innerHTML = `<div class="mq-gate"><b>크랙이 예전 대화를 열었어요</b><span>처음부터 하려면 새 대화가 필요해요. 「작품 화면에서 새로하기」를 누르면 CRION이 새 대화를 열어요.</span>${row(acts.map(a => `<button class="mq-fb primary" data-mq="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + `<button class="mq-fb ${acts.length ? '' : 'primary'}" data-mq="retry-new">작품 화면에서 새로하기</button>` + std)}</div>`;
      } else if (kind === 'away') b.innerHTML = `<div class="mq-gate"><b>이 세이브의 대화가 아니에요</b><span>크랙 화면에서 다른 대화로 옮겨 갔어요. 이 대화는 읽지 않아요.</span>${row('<button class="mq-fb primary" data-mq="back-save">세이브 대화로 돌아가기</button>' + std)}</div>`;
      else if (kind === 'slow') { b.className = 'mq-banner'; b.innerHTML = `<span>응답을 아직 못 읽었어요. 크랙에서 답이 왔는지 확인해 보세요.</span><button class="mq-fb" data-mq="crack">크랙 화면 보기</button><button class="mq-fb" data-mq="diag">화면 진단 복사</button><button class="mq-fb" data-mq="unwait">닫기</button>`; }
    }

    // ---------- 겹창 ----------
    function openModal(k, arg) {
      R.modal = k;
      const box = $('#mq-box');
      box.className = 'mq-box';
      const X = `<button class="mq-x" data-mq="mclose" aria-label="닫기">${ic('x')}</button>`;
      if (k === 'lines') {
        const ls = M.lines.slice(-150);
        box.classList.add('wide');
        let lastD = null;
        box.innerHTML = `${X}<h3>지난 대사</h3><div class="mq-lines">${ls.length ? ls.map(l => { const hd = l.d !== lastD ? `<h5>D+${l.d || 0}</h5>` : ''; lastD = l.d; return hd + `<p class="${l.me ? 'me' : l.sys ? 'sys' : l.who ? 'say' : ''}" style="${l.who && RO[l.who] ? '--c:' + RO[l.who].color : ''}">${l.who ? `<b>${esc(l.who)}</b>` : ''}<span>${esc(l.t)}</span></p>`; }).join('') : '<p class="mq-empty-s">아직 없어요.</p>'}</div>`;
        setTimeout(() => { const n = box.querySelector('.mq-lines'); if (n) n.scrollTop = n.scrollHeight; }, 0);
      } else if (k === 'album') {
        box.classList.add('wide'); box.innerHTML = X + albumHtml();
      } else if (k === 'set') {
        const seg = (key, opts) => `<div class="mq-seg">${opts.map(([v, l]) => `<button class="${String(M.prefs[key]) === String(v) ? 'on' : ''}" data-mq="pref" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
        box.innerHTML = `${X}<h3>플레이팩 설정</h3>
          <div class="mq-setrow"><span>글자 속도</span>${seg('speed', [['slow', '느림'], ['normal', '보통'], ['fast', '빠름'], ['instant', '즉시']])}</div>
          <div class="mq-setrow"><span>화면 연출</span>${seg('fx', [[false, '끔'], [true, '켜짐']])}</div>
          <p class="mq-note">게임 화면은 크랙 응답을 읽어 그려요. 크랙 프롬프트·진행은 그대로이고, 숫자는 크랙 상태창 그대로예요.</p>
          <div class="mq-btns left"><button class="mq-btn" data-mq="title">처음 화면</button><button class="mq-btn" data-mq="crack">크랙 화면 보기</button><button class="mq-btn" data-mq="diag">화면 진단 복사</button><button class="mq-btn danger" data-mq="pack-off">플레이팩 끄기</button></div>`;
      } else if (k === 'powers') {
        const st = st0();
        box.classList.add('crown');
        box.innerHTML = `${X}${crownSvg(gems(), true)}<h3>그림자 왕관 <small>권능 ${(st.power && st.power.n) || 0}/5 · 마력 ${st.mana ? st.mana.n + '/' + st.mana.of : '–'}</small></h3>
          <div class="mq-pws">${POW.map(([pk, who, desc]) => { const m = M.powers[who]; return `<div class="mq-pwr ${m ? 'on' : ''}" style="--c:${(RO[who] || {}).color}">${seal(who, true)}<div><b>${esc(pk)}</b><span>${esc(desc)}</span></div><em>${esc(who)}<br><u style="${m ? 'color:' + (METHOD[m] || {}).c : ''}">${m ? esc(m) + '으로 되찾음' : '봉인 중'}</u></em></div>`; }).join('')}</div>
          <div class="mq-ways">${Object.entries(METHOD).map(([k, v]) => `<span style="--c:${v.c}"><i></i><b>${k}</b>${esc(v.d)}${k === '전투' ? ' · 권능 3개를 되찾은 뒤부터' : ''}</span>`).join('')}</div>`;
      } else if (k === 'phone') {
        const a = arg || {};
        box.classList.add('phone');
        const bar = `<div class="mq-phbar"><b>${esc(a.time || R.phoneTime || '')}</b><span>📶 ${a.batt != null ? '🔋' + a.batt + '%' : ''}</span></div>`;
        const apps = [['🗺️', '정보', '/정보'], ['📞', '연락', '/연락'], ['🌐', '가이드', '/가이드'], ['✉️', '진행요약', '/진행요약']];
        box.innerHTML = `${X}<div class="mq-phone">${bar}${a.none ? `<div class="mq-phnone"><b>스마트폰이 아직 없어요</b><span>대리점에서 사거나 선물을 받으면 쓸 수 있어요.</span></div>`
          : a.home ? `<div class="mq-phhome"><small>마왕의 스마트폰</small><div class="mq-phapps">${apps.map(([i, n, c]) => `<button data-mq="fill" data-v="${c}"><i>${i}</i><span>${n}</span></button>`).join('')}</div><p>앱을 누르면 입력칸에 채워져요. 보내기를 누르면 크랙이 화면을 보여 줘요.</p></div>`
          : `<div class="mq-phcontent">${(a.content || []).map(t => `<p>${esc(t)}</p>`).join('')}${(a.says || []).map(b => `<p class="say"><b>${esc(b.who)}</b>${esc(b.text)}</p>`).join('')}</div><div class="mq-phnav"><button data-mq="sc" data-k="/스마트폰">홈 화면</button></div>`}</div>`;
      } else if (k === 'disguise') {
        box.innerHTML = `${X}<h3>위장 신분 <small>하나를 고르면 입력칸에 번호가 채워져요</small></h3><div class="mq-disg">${(arg || []).map(d => `<button data-mq="fill" data-v="${d.n}"><em>${d.n}</em><span>${esc(d.t)}</span></button>`).join('')}</div>`;
      } else if (k === 'brief') {
        box.classList.add('wide');
        box.innerHTML = `${X}<h3>어전 회의 기록 <small>간부들이 보고한 내용을 한 장에</small></h3><div class="mq-brief-l">${KB.filter(kk => (arg || {})[kk.name]).map(kk => `<div class="mq-brief-c" style="--c:${kk.color}"><img src="${esc(IMG('기본상태_' + kk.name))}" alt=""><div><b>${esc(kk.name)} <small>${esc(kk.role)} · ${esc(kk.part)}</small></b>${arg[kk.name].map(t => `<p>${esc(t)}</p>`).join('')}<button class="mq-link" data-mq="fill" data-v="${esc(kk.name)}에게 더 자세히 묻는다.">더 묻기</button></div></div>`).join('')}</div>`;
      } else if (k === 'view') {
        const src = IMG(String(arg)); if (!src) return;
        box.classList.add('photo');
        box.innerHTML = `${X}<img src="${esc(src)}" alt=""><p class="mq-note">${esc(String(arg).replace(/_/g, ' ').replace(/\//g, '·'))}</p>`;
      }
      $('#mq-modal').hidden = false;
    }
    function closeModal() { R.modal = null; $('#mq-modal').hidden = true; $('#mq-box').innerHTML = ''; }
    const curScene = () => { const b = R.beats[R.i] || R.beats[R.beats.length - 1]; const who = b && b.kind === 'say' ? b.who : ''; return { bg: R.bgKey || M.lastBg, face: (b && b.face) || '', who, text: b ? b.text : '', color: (RO[who] || {}).color, place: st0().place }; };
    const colorOf = (n) => (RO[n] || {}).color || '';
    const menuExtra = () => [{ label: '그림자 왕관 (권능)', fn: () => openModal('powers') }, { label: '본 그림', fn: () => openModal('album') }, { label: '스마트폰 (/스마트폰)', fn: () => fillShortcut('/스마트폰') }]
      .concat(K ? K.menu(curScene, () => M.lines, colorOf) : [{ label: '지난 대사', fn: () => openModal('lines') }]).concat([{ label: '플레이팩 설정', fn: () => openModal('set') }]);

    // ---------- 입력 ----------
    el.addEventListener('click', (e) => {
      if (e.target.id === 'mq-modal') { closeModal(); return; }
      const t = e.target.closest('[data-mq]');
      if (!t || !el.contains(t)) return;
      const k = t.dataset.mq;
      switch (k) {
        case 'next': if (!e.target.closest('button')) next(); break;
        case 'send': doSend(); break;
        case 'act': insertAct(); break;
        case 'regen': if (R.waiting) break; o.action('regen'); R.waiting = true; R.sentAt = Date.now(); waitingUi(true); break;
        case 'tab': { const v = t.dataset.k; R.sub = null; if (v === 'ops') R.newClue = false; if (v === 'log') R.newDay = false; if (t.closest('#mq-stabs')) { R.sideTab = v; if (R.tab !== 'stage') R.tab = v; } else { R.tab = v; if (v !== 'stage') R.sideTab = v; } renderPanel(); break; }
        case 'who': R.sub = t.dataset.k; renderPanel(); break;
        case 'sub-back': R.sub = null; renderPanel(); break;
        case 'fill': if (R.modal) closeModal(); fill(t.dataset.v); break;
        case 'add': fill(t.dataset.v, true); break;
        case 'sc': if (R.modal) closeModal(); fillShortcut(t.dataset.k); break;
        case 'skip': fillShortcut('/시간경과', `요청 기간: ${t.dataset.k}일`); break;
        case 'view': openModal('view', t.dataset.k); break;
        case 'album': openModal('album'); break;
        case 'powers': openModal('powers'); break;
        case 'more': if (o.menu) o.menu(menuExtra()); else openModal('set'); break;
        case 'lines': if (K) K.log(M.lines, colorOf); else openModal('lines'); break;
        case 'set': case 't-set': openModal('set'); break;
        case 't-saves': R.showSaves = !R.showSaves; renderTitle(); break;
        case 'mclose': closeModal(); break;
        case 'pref': { const v = t.dataset.v; M.prefs[t.dataset.key] = v === 'true' ? true : v === 'false' ? false : v; save(); mqRoot.classList.toggle('nofx', !M.prefs.fx); openModal('set'); break; }
        case 'cine-end': cineEnd(); break;
        case 'pro-next': if (!e.target.closest('button')) proNext(); break;
        case 'rite-close': { const b = $('#mq-rite'); b.hidden = true; b.innerHTML = ''; R.freshGem = ''; renderHud(); break; }
        case 'end-close': { const b = $('#mq-end'); b.hidden = true; b.innerHTML = ''; break; }
        case 'title': closeModal(); showTitle(); break;
        case 'back-save': { const sv = curSave(); if (sv && sv.url) o.load(sv.url); break; }
        case 't-new': startNew(); break;
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
    el.addEventListener('input', (e) => { if (e.target.id === 'mq-in') autosize(); });
    const onKey = (e) => {
      if (!el.isConnected || el.classList.contains('off') || document.querySelector('#layer .scrim') || (K && K.isOpen())) return;
      if (e.target.id === 'mq-in' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); return; }
      if (/^(TEXTAREA|INPUT|SELECT|WEBVIEW)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { if (R.modal) closeModal(); else if (R.sub) { R.sub = null; renderPanel(); } }
      if (R.cine && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') && !e.target.closest('button')) { e.preventDefault(); proNext(); return; }
      if ((e.key === ' ' || e.key === 'Enter') && !R.modal && !R.cine && $('#mq-rite').hidden && !e.target.closest('button')) { e.preventDefault(); if ($('#mq-title').hidden) next(); }
    };
    document.addEventListener('keydown', onKey);
    const onBack = (e) => {
      if (!el.isConnected || el.closest('.off') || document.querySelector('#layer > *')) return;
      const done = () => e.preventDefault();
      if (R.modal) { closeModal(); return done(); }
      if (!$('#mq-rite').hidden) { $('#mq-rite').hidden = true; R.freshGem = ''; renderHud(); return done(); }
      if (!$('#mq-end').hidden) { $('#mq-end').hidden = true; return done(); }
      if (R.cine) { cineEnd(); return done(); }
      if (R.sub) { R.sub = null; renderPanel(); return done(); }
      if (R.tab !== 'stage') { R.tab = 'stage'; renderPanel(); return done(); }
      if (R.mode !== 'title' && $('#mq-title').hidden) { showTitle(); return done(); }
    };
    document.addEventListener('crion-back', onBack);

    // ---------- 타이틀 ----------
    const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? m + '분 전' : m < 1440 ? Math.round(m / 60) + '시간 전' : Math.round(m / 1440) + '일 전'; };
    const fmtMs = (ms) => { const m = Math.round((ms || 0) / 60000); return m < 60 ? m + '분' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분'; };
    // 타이틀: 작품 그림을 화면 가득(폰은 위쪽 가득) + 아래 '어전 바닥' 띠. 금줄 위에 왕관 문장, 가운데 시작 버튼
    function renderTitle() {
      const box = $('#mq-title');
      const list = saves.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
      const cont = list.find(x => x.url);
      const hero = IMG('인물 외_타이틀');
      const saveRow = (sv) => `<div class="mq-save"><div class="mq-simg" style="background-image:${cssUrl((sv.sum && sv.sum.bg) || PLACE_IMG('허름한 반지하'))}"></div>
          <div class="mq-smeta"><b>${esc(sumText(sv))}</b><span>${fmtMs(sv.playMs)} 플레이 · ${sv.url ? '마지막 ' + ago(sv.last || sv.created) : '대화 연결 전'}</span></div>
          <div class="mq-sbtns">${sv.url ? `<button class="mq-fb primary" data-mq="t-cont" data-id="${esc(sv.id)}">이어하기</button>` : ''}<button class="mq-fb ${R.delAsk === sv.id ? 'danger' : ''}" data-mq="t-del" data-id="${esc(sv.id)}">${R.delAsk === sv.id ? '한 번 더 누르면 삭제' : '지우기'}</button></div></div>`;
      // 히리온 타이틀 그림: PC = 가로(왼쪽 흰 여백에 제목), 폰 = 세로(위에 제목, 아래 MADE BY). 버튼은 제목·글자를 가리지 않는 빈자리에
      const tpc = asset('assets/title_pc.webp') || hero, tm = asset('assets/title_m.webp') || hero;
      box.innerHTML = `<div class="mq-tstage">${tpc ? `<img class="pc" src="${esc(tpc)}" alt="마법소녀의 최종보스">` : ''}${tm ? `<img class="m" src="${esc(tm)}" alt="마법소녀의 최종보스">` : ''}</div>
        <p class="mq-ttag">8년의 잠에서 깨어난 왕.<br>권능 다섯 조각은 지금, 별이 된 소녀들의 손에 있다.</p>
        <div class="mq-tmenu">
          <button class="mq-tgo" data-mq="t-new"><b>마왕, 다시 일어나다</b><small>새 대화로 처음부터</small></button>
          ${cont ? `<button class="mq-tcont" data-mq="t-cont" data-id="${esc(cont.id)}"><b>이어하기</b><small>${esc(sumText(cont))}</small></button>` : ''}
          <div class="mq-tlinks">${list.length ? `<button class="${R.showSaves ? 'on' : ''}" data-mq="t-saves">세이브 ${list.length}</button>` : ''}<button data-mq="t-set">설정</button><span>19세 이상 · 크랙 AI가 진행해요</span></div>
        </div>
        ${list.length ? `<div class="mq-tdrawer ${R.showSaves ? 'on' : ''}"><header><b>세이브</b><button class="mq-x" data-mq="t-saves" aria-label="닫기">${ic('x')}</button></header>${list.map(saveRow).join('')}<p>크랙 대화는 지워지지 않고 그대로 남아요.</p></div>` : ''}`;
      box.hidden = false;
    }
    const sumText = (sv) => { const s = (sv && sv.sum) || {}; return s.day ? `D+${s.day}${s.place ? ' · ' + s.place : ''} · 권능 ${s.power || 0}/5` : '반지하에서 눈뜬 날'; };
    function resetScene() {
      R.beats = []; R.i = -1; R.lastKey = ''; R.waiting = false; R.away = false; R.cine = false; R.sub = null; R.tab = 'stage'; R.faces = {}; R.present = []; R.riteDone = {}; R.freshGem = '';
      Object.keys(M.powers || {}).forEach(w => { R.riteDone[w] = 1; });
      R.bgKey = ''; el.querySelectorAll('.mq-bgl').forEach(x => { x.style.backgroundImage = ''; x.classList.remove('on'); });
      R.placeK = placeKeyOf(st0().place) || '허름한 반지하'; setBg(M.lastBg || PLACE_IMG(R.placeK));
      setPortrait('');
      ['#mq-cine', '#mq-end', '#mq-rite'].forEach(s => { $(s).hidden = true; });
      closeModal();
      renderHud(); setMood(); renderPanel(); renderSugg();
      const d = $('#mq-dlg'); d.className = 'mq-dlg'; d.innerHTML = '';
    }
    const hideTitle = () => { $('#mq-title').hidden = true; };
    function showTitle() { R.mode = 'title'; R.newFlow = null; R.delAsk = null; banner(null); waitingUi(false); renderTitle(); }
    function loading(msg) { const d = $('#mq-dlg'); d.className = 'mq-dlg k-wait'; d.innerHTML = `<div class="mq-typing"><span class="mq-candle"><i></i></span><b>${esc(msg)}</b></div>`; }
    function startUrl() {
      const d = o.detailUrl ? o.detailUrl() : '';
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
      if (K) {
        const r = K.recapFromLines(M.lines, colorOf), st = st0();
        K.recap(Object.assign(r, { title: '마왕의 지난 이야기', when: st.day != null ? 'D+' + st.day : '', place: st.place || '', bg: M.lastBg,
          rows: [['권능', ((st.power && st.power.n) || 0) + ' / 5'], st.risk != null ? ['발각 위험', st.risk + (st.riskLabel ? ' · ' + st.riskLabel : '')] : null, (M.clues || []).length ? ['단서', M.clues.length + '개'] : null].filter(Boolean) }));
      }
    }
    function startModeStep(st) {
      const sm = R.sm;
      if (!sm || sm.done) return false;
      if (R.mode === 'binding' && !(R.newFlow && R.newFlow.clicked)) return false;
      const acts = st.actions || [];
      const modes = acts.filter(x => x.kind === 'mode');
      const modeBannerOn = !!$('#mq-banner').querySelector('.mq-modes');
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
    setBg(PLACE_IMG('허름한 반지하'));
    renderHud(); renderPanel(); renderSugg();
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
          else if ($('#mq-banner').querySelector('.mq-gate')) banner(null);
        } else if (ch === 'crion:sent' && d) {
          if (!d.ok) { R.waiting = false; waitingUi(false); showBeat(R.i); toast(d.why === 'no-input' ? '크랙 입력창을 찾지 못했어요. 크랙 화면을 확인해 주세요' : '보내지 못했어요'); }
        }
      },
      destroy() { if (K) K.destroy(); document.removeEventListener('keydown', onKey); document.removeEventListener('crion-back', onBack); clearInterval(waitT); clearInterval(playT); clearInterval(tipT); clearInterval(typeT); save(); },
      demo(segs) { handle(segs); },
      kit: K, state: R, memory: M, saves: () => saves,
      proState: () => pro && { i: pro.i, typing: !!pro.typing, n: pro.shots.length }
    };
  }

  root.CrionMaouRun = { start };
})(typeof window !== 'undefined' ? window : globalThis);
