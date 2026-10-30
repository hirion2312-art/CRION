// 플레이팩 실행기 — 「마법소녀의 최종보스」 (runner: "maou")
//  크랙 AI가 그대로 진행. 크랙 응답·상태창·그림을 읽어 '마왕의 작전실'로 그린다.
//  - 무대: 크랙이 고른 그림 그대로(주소 → 빌더 등록명으로 장소·인물·표정을 알아냄). 묘사는 장소, 대사는 그 사람 그림을 화면 가득
//  - 프롤로그: 타이틀 + 웹툰 6컷을 세로로 읽는 화면
//  - 작전실(옆 패널 / 폰은 아래 탭): 오성 · 마왕군 · 단서 · 명령(단축어·엔딩) · 기억(본 그림)
//  - 계산은 하지 않는다. 숫자는 전부 크랙 상태창 그대로. 숨은 진실·사랑/흑화 열쇠는 팩에 넣지 않았다 (크랙이 말한 것만)
//  - 보내기: 플레이어가 '보내기'를 한 번 누르면 한 번만. 버튼은 입력칸에 글만 채운다
//  - 세이브/새 대화 연결은 리온대 팩(pk-univ-run.js)과 같은 방식
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
    stage: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>', star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>', clue: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l6 6"/>', cmd: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l3 3-3 3"/>',
    album: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8.5"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    pin: '<path d="M12 21s6-5.6 6-10.2A6 6 0 0 0 6 10.8C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>', eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'
  };
  const ic = (k) => `<svg class="ic" viewBox="0 0 24 24">${ICON[k] || ''}</svg>`;
  const METHOD = { 사랑: { c: '#ff8fb3', t: '사랑' }, 흑화: { c: '#a56bff', t: '흑화' }, 전투: { c: '#ff6b5a', t: '전투' } };
  const RISK_C = (v, l) => /위기|위험|발각/.test(l || '') || v >= 80 ? 'bad' : /주의|경계|의심/.test(l || '') || v >= 40 ? 'warn' : 'ok';

  function start(o) {
    const el = o.el;
    const data = o.data || {};
    const roster = new U.Roster(data);
    const IDX = new U.ImgIndex(data);
    const IMG = (name) => IDX.url(name);
    const OS = data.oseong || [], KB = data.kanbu || [];
    const RO = Object.fromEntries([].concat(OS, KB, data.extra || []).map(r => [r.name, r]));
    const HIDE = new Set(data.hideImgs || []);
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
      tab: 'stage', sub: null, modal: null, bgKey: '', placeK: '허름한 반지하'
    };
    const SIDE_TABS = [['oseong', '오성', 'star'], ['kanbu', '마왕군', 'crown'], ['clue', '단서', 'clue'], ['cmd', '명령', 'cmd'], ['album', '기억', 'album']];
    const PHONE_TABS = [['stage', '무대', 'stage'], ['oseong', '오성', 'star'], ['kanbu', '마왕군', 'crown'], ['clue', '단서', 'clue'], ['cmd', '명령', 'cmd']];

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="mq">
      <div class="mq-main">
        <div class="mq-stage" id="mq-stage">
          <div class="mq-bg"><i class="mq-bgl"></i><i class="mq-bgl"></i></div><div class="mq-tint"></div><div class="mq-stars" aria-hidden="true"></div>
          <div class="mq-pt" id="mq-pt"><img alt=""></div>
          <div class="mq-hud" id="mq-hud"></div>
          <div class="mq-tr"><button data-mq="more" class="mq-more" aria-label="메뉴">${ic('more')}</button></div>
          <div class="mq-pops" id="mq-pops"></div>
          <div class="mq-dlg" id="mq-dlg" data-mq="next"></div>
        </div>
        <aside class="mq-side" id="mq-side"><nav class="mq-stabs" id="mq-stabs"></nav><div class="mq-panel" id="mq-panel" data-sk="panel"></div></aside>
      </div>
      <footer class="mq-foot">
        <textarea id="mq-in" rows="1" placeholder="마왕의 말과 행동을 그대로 적어 보세요 (Enter 보내기 · Shift+Enter 줄바꿈)"></textarea>
        <button class="mq-fb" data-mq="regen" title="크랙에서 다시 생성">다시</button>
        <button class="mq-fb primary" data-mq="send">보내기</button>
      </footer>
      <nav class="mq-tabs" id="mq-tabs"></nav>
      <div class="mq-layer" id="mq-title" hidden></div>
      <div class="mq-layer" id="mq-cine" hidden></div>
      <div class="mq-layer" id="mq-end" hidden></div>
      <div class="mq-over" id="mq-modal" hidden><div class="mq-box" id="mq-box"></div></div>
      <div class="mq-banner" id="mq-banner" hidden></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const mqRoot = $('.mq');
    const narrow = () => { try { return root.matchMedia('(max-width: 760px)').matches; } catch (e) { return false; } };
    if (narrow()) $('#mq-in').placeholder = '말이나 행동을 적어요';
    [mqRoot, $('.mq-main'), $('#mq-stage')].forEach(n => n.addEventListener('scroll', () => { if (n.scrollTop || n.scrollLeft) { n.scrollTop = 0; n.scrollLeft = 0; } }));
    mqRoot.classList.toggle('nofx', !M.prefs.fx);
    mqRoot.addEventListener('focusin', (e) => { if (e.target.matches('textarea, input[type=text], input:not([type])')) mqRoot.classList.add('typing'); });
    mqRoot.addEventListener('focusout', () => { setTimeout(() => { const a = document.activeElement; if (!a || !mqRoot.contains(a) || !a.matches('textarea, input')) mqRoot.classList.remove('typing'); }, 60); });
    const toast = (t) => o.toast(t);
    // 별 반짝임 (CSS 점 몇 개)
    $('.mq-stars').innerHTML = Array.from({ length: 22 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 70}%;animation-delay:${(i % 7) * .6}s"></i>`).join('');

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
      pt.style.setProperty('--glow', (RO[who] && RO[who].color) || '#9fb7ff');
      pt.classList.add('on');
    }
    function setTint() {
      const p = String((st0().place) || '') + ' ' + (R.placeK || '');
      $('.mq-tint').className = 'mq-tint' + (/지하|반지하/.test(p) ? ' under' : /협회/.test(p) ? ' cold' : '');
    }

    // ---------- HUD ----------
    function powerOrbs() {
      const st = st0(), n = (st.power && st.power.n) || 0, P = data.powers || [];
      const got = P.filter(p => M.powers[p[1]]).length;
      let spare = Math.max(0, n - got);   // 상태창 숫자는 늘었는데 누가 돌려줬는지 모를 때: 앞에서부터 채움
      return P.map(([k, who]) => {
        const meth = M.powers[who];
        const on = !!meth || (spare > 0 && (spare--, true));
        return `<i class="mq-orb ${on ? 'on' : ''}" style="${meth && METHOD[meth] ? '--oc:' + METHOD[meth].c : ''}" title="${esc(k)} · ${esc(who)}${meth ? ' · ' + meth + '으로 회수' : on ? ' · 회수' : ' · 봉인 중'}"><b>${esc(k[0])}</b></i>`;
      }).join('');
    }
    function renderHud() {
      const st = st0();
      const risk = st.risk;
      $('#mq-hud').innerHTML = `<div class="mq-when"><b>${st.day != null ? 'D+' + st.day : 'D+0'}</b><span>${ic('pin')}${esc(st.place || '허름한 반지하')}</span></div>
        <button class="mq-orbs" data-mq="powers" aria-label="권능">${powerOrbs()}<em>${(st.power && st.power.n) || 0}/${(st.power && st.power.of) || 5}</em></button>
        <div class="mq-chips">
          ${st.mana ? `<span class="mq-chip mana" title="마력"><i>🔮</i><u><s style="width:${clamp(st.mana.n / Math.max(1, st.mana.of) * 100, 0, 100)}%"></s></u>${st.mana.n}/${st.mana.of}</span>` : ''}
          ${st.money != null || st.moneyText ? `<span class="mq-chip" title="자금 (리제 관리)"><i>💰</i>${esc(st.money != null ? won(st.money) : st.moneyText)}</span>` : ''}
          ${risk != null ? `<span class="mq-chip risk ${RISK_C(risk, st.riskLabel)}" title="정체 발각 위험"><i>⚠️</i>발각 ${risk}${st.riskLabel ? ' · ' + esc(st.riskLabel) : ''}</span>` : ''}
        </div>`;
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
      setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 500); }, /big/.test(cls || '') ? 4600 : 3200);
    }
    function notifyEvents(ev) {
      if (ev.day) pop(`<i>🕖</i><b>D+${ev.day.to}</b><span>${ev.day.to - ev.day.from}일이 지났어요</span>`, 'day');
      (ev.recovered || []).forEach(r => { const m = METHOD[r.method] || {}; pop(`<i class="big">✦</i><b>권능 회수 · ${esc((data.powers.find(p => p[1] === r.who) || [])[0] || '')}</b><span>${esc(r.who)} — <u style="color:${m.c || '#fff'}">${esc(r.method)}</u>으로 되찾았어요</span>`, 'big power'); });
      if (ev.power && !(ev.recovered || []).length) pop(`<i class="big">✦</i><b>권능 ${ev.power.to}/5</b><span>잃었던 힘 하나가 돌아왔어요</span>`, 'big power');
      (ev.affUp || []).forEach(a => {
        const d = Math.round((a.to - a.from) * 10) / 10;
        if (a.stageChanged) pop(`<i class="big">❣️</i><b>${esc(a.n)}</b><span>관계가 「${esc(a.stage)}」(으)로 바뀌었어요 · ${a.to}</span>`, 'big aff');
        else if (d) pop(`<i>❣️</i><b>${esc(a.n)}</b><span class="${d > 0 ? 'up' : 'dn'}">호감도 ${d > 0 ? '+' : ''}${d}</span>`, 'aff');
      });
      (ev.crackUp || []).forEach(c => { const d = Math.round((c.to - c.from) * 10) / 10; if (d) pop(`<i>💀</i><b>${esc(c.n)}</b><span class="${d > 0 ? 'crk' : 'dn'}">마음의 균열 ${d > 0 ? '+' : ''}${d}</span>`, 'crack'); });
      if (ev.risk) pop(`<i>⚠️</i><b>정체 발각 위험 ${ev.risk.to}</b><span>${esc(ev.risk.label || '')}</span>`, 'risk ' + RISK_C(ev.risk.to, ev.risk.label));
      if (ev.newClues) pop(`<i>🔍</i><b>단서 노트</b><span>새 단서 ${ev.newClues}개를 적었어요</span>`, 'clue');
      if (ev.money && Math.abs(ev.money.to - ev.money.from) >= 1000) { const d = ev.money.to - ev.money.from; pop(`<i>💰</i><b>자금</b><span class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${won(d)}</span>`, 'money'); }
    }

    // ---------- 작전실 (옆 패널 / 폰 아래 탭) ----------
    const portraitOf = (n) => IMG('기본상태_' + n);
    const bar = (v, cls) => v == null ? `<span class="mq-lock">${ic('lock')}잠김</span>` : `<span class="mq-bar ${cls || ''}"><s style="width:${clamp(v, 0, 100)}%"></s></span><b class="mq-n">${v}</b>`;
    function oseongHtml() {
      if (R.sub && RO[R.sub] && OS.some(x => x.name === R.sub)) return personHtml(R.sub);
      const st = st0();
      return `<div class="mq-ph"><h3>오성 <small>권능을 나눠 가진 다섯 마법소녀</small></h3></div>
        <div class="mq-cards">${OS.map(p => {
          const a = M.aff[p.name], c = M.crack[p.name], meth = M.powers[p.name], rel = M.rel[p.name];
          return `<button class="mq-card" data-mq="who" data-k="${esc(p.name)}" style="--c:${p.color}">
            <span class="mq-cimg"><img src="${esc(portraitOf(p.name))}" alt="" loading="lazy">${meth ? `<em class="mq-meth" style="--m:${(METHOD[meth] || {}).c}">${esc(meth)}</em>` : ''}</span>
            <span class="mq-cmeta"><b>${esc(p.name)} <small>${p.age}</small></b><span class="mq-pw">권능 「${esc(p.power)}」 ${meth ? '· 회수' : '· 봉인 중'}</span>
              <span class="mq-stat"><i>❣️</i>${bar(a, 'aff')}</span><span class="mq-stat"><i>💀</i>${bar(c, 'crk')}</span>
              ${a != null ? `<span class="mq-stage-l">${esc(U.stageOf(a))}${rel ? ' · ' + esc(rel) : ''}</span>` : rel ? `<span class="mq-stage-l">${esc(rel)}</span>` : ''}</span></button>`;
        }).join('')}</div>
        <p class="mq-note">${st.aff ? '숫자는 크랙 상태창 그대로예요.' : '호감도·균열도는 아직 크랙 상태창에서 「잠김」이에요. 풀리면 여기에 나와요.'}</p>`;
    }
    function personHtml(n) {
      const p = RO[n], a = M.aff[n], c = M.crack[n], meth = M.powers[n];
      const seen = Object.keys(M.seen || {}).filter(k => k.endsWith('_' + n) && !HIDE.has(k));
      return `<div class="mq-ph"><button class="mq-back" data-mq="sub-back">${ic('back')}</button><h3>${esc(n)} <small>${p.age}세 · ${esc(p.job)}</small></h3></div>
        <div class="mq-person" style="--c:${p.color}"><img src="${esc(portraitOf(n))}" alt="">
          <div class="mq-pinfo"><p>${esc(p.look)}</p>
            <div class="mq-kv"><span>권능</span><b>${esc(p.power)} — ${esc((data.powers.find(x => x[1] === n) || [])[2] || '')}</b>
              <span>상태</span><b>${meth ? `<u style="color:${(METHOD[meth] || {}).c}">${esc(meth)}</u>으로 회수` : '봉인 중'}</b>
              <span>호감도</span><b class="mq-kvb">${bar(a, 'aff')}</b><span>관계</span><b>${a != null ? esc(U.stageOf(a)) : '–'}${M.rel[n] ? ' · ' + esc(M.rel[n]) : ''}</b>
              <span>균열</span><b class="mq-kvb">${bar(c, 'crk')}</b><span>만나는 곳</span><b>${esc(p.route)}</b></div>
          </div></div>
        <div class="mq-btns"><button class="mq-btn primary" data-mq="fill" data-v="${esc(josa(n, '을', '를'))} 찾아간다.">찾아가기</button><button class="mq-btn" data-mq="fill" data-v="${esc(n)}에게 말을 건다.">말 걸기</button></div>
        <h4 class="mq-h4">본 장면 <small>${seen.length}</small></h4>
        <div class="mq-grid">${seen.length ? seen.map(k => `<button data-mq="view" data-k="${esc(k)}"><img src="${esc(IMG(k))}" alt="" loading="lazy"><small>${esc(k.split('_').slice(0, -1).join(' ').replace(/\//g, '·'))}</small></button>`).join('') : '<p class="mq-note">아직 본 장면이 없어요.</p>'}</div>`;
    }
    function kanbuHtml() {
      return `<div class="mq-ph"><h3>마왕군 5간부 <small>8년간 마왕을 지킨 충신들</small></h3><button class="mq-btn sm" data-mq="sc" data-k="/간부보고">간부 보고 듣기</button></div>
        <div class="mq-klist">${KB.map(k => `<div class="mq-kcard" style="--c:${k.color}"><img src="${esc(IMG('기본상태_' + k.name))}" alt="" loading="lazy">
          <div><b>${esc(k.name)} <small>${esc(k.role)}</small></b><span>${esc(k.job)}</span><span class="mq-dim">${esc(k.look)}</span><span class="mq-part">담당 · ${esc(k.part)}${M.rel[k.name] ? ` <u>${esc(M.rel[k.name])}</u>` : ''}</span></div>
          <button class="mq-btn sm" data-mq="fill" data-v="${esc(k.name)}에게 말을 건다.">말 걸기</button></div>`).join('')}</div>`;
    }
    function clueHtml() {
      const cs = M.clues || [];
      return `<div class="mq-ph"><h3>단서 노트 <small>${cs.length}개</small></h3><button class="mq-btn sm" data-mq="sc" data-k="/단서노트">크랙에서 정리 받기</button></div>
        ${cs.length ? `<ol class="mq-clues">${cs.map(c => `<li><em>단서 ${c.n}</em><b>${esc(c.text)}</b>${c.when ? `<small>${esc(c.when)}</small>` : ''}</li>`).join('')}</ol>`
          : '<div class="mq-empty"><b>아직 적힌 단서가 없어요</b><span>「크랙에서 정리 받기」를 누르면 지금까지 직접 확인한 단서만 정리해 줘요. 아직 모르는 진실은 미리 나오지 않아요.</span></div>'}
        ${(st0().assoc) ? `<div class="mq-assoc"><b>🏛️ 협회 동향</b><span>${esc(st0().assoc)}</span></div>` : ''}`;
    }
    function cmdHtml() {
      const scs = data.shortcuts || [];
      const icn = { '/사칭금지': '🤦', '/스마트폰': '📱', '/단서노트': '🔍', '/간부보고': '👑', '/위장전환': '🎭', '/시간경과': '⏳' };
      const turns = M.turns || 0;
      return `<div class="mq-ph"><h3>명령 <small>크랙 단축어를 입력칸에 채워요</small></h3></div>
        <div class="mq-cmds">${scs.map(s => `<button class="mq-cmd" data-mq="sc" data-k="${esc(s.key)}"><i>${icn[s.key] || '✦'}</i><b>${esc(s.key.slice(1))}</b><span>${esc(s.desc.replace(/^[^\p{L}\p{N}]+/u, ''))}</span></button>`).join('')}</div>
        <div class="mq-days"><span>⏳ 시간 건너뛰기</span>${[1, 3, 7].map(d => `<button class="mq-btn sm" data-mq="skip" data-k="${d}">${d}일</button>`).join('')}</div>
        <h4 class="mq-h4">엔딩 <small>${turns}턴째 · ${data.endingFrom || 30}턴부터 볼 수 있어요</small></h4>
        <div class="mq-ends">${(data.endings || []).map(e => { const got = (M.endings || []).includes(e.name); return `<div class="mq-end ${got ? 'got' : ''}"><em class="g-${esc(e.grade)}">${esc(e.grade)}</em><b>${got ? esc(e.name) : '???'}</b><span>${esc(e.hint)}</span>${got && IMG('엔딩_' + e.name) ? `<button data-mq="view" data-k="엔딩_${esc(e.name)}">보기</button>` : ''}</div>`; }).join('')}</div>`;
    }
    function albumHtml() {
      const groups = [['오성', OS.map(p => p.name), (k) => !/변신/.test(k)], ['변신', OS.map(p => p.name), (k) => /변신/.test(k)], ['마왕군', KB.map(p => p.name).concat(['협회장']), () => true]];
      const all = Object.keys(data.imgs || {}).filter(k => !HIDE.has(k));
      const seenN = all.filter(k => M.seen[k]).length;
      const sec = (title, names, f) => {
        const keys = all.filter(k => names.some(n => k.endsWith('_' + n)) && f(k));
        const got = keys.filter(k => M.seen[k]);
        return `<h4 class="mq-h4">${title} <small>${got.length}/${keys.length}</small></h4><div class="mq-grid">${keys.map(k => M.seen[k] ? `<button data-mq="view" data-k="${esc(k)}"><img src="${esc(IMG(k))}" alt="" loading="lazy"><small>${esc(k.replace(/_/g, ' ').replace(/\//g, '·'))}</small></button>` : `<span class="mq-locked">${ic('lock')}</span>`).join('')}</div>`;
      };
      const places = all.filter(k => /_장소$/.test(k));
      return `<div class="mq-ph"><h3>기억 <small>본 그림 ${seenN}/${all.length}</small></h3></div>
        ${groups.map(([t, ns, f]) => sec(t, ns, f)).join('')}
        <h4 class="mq-h4">장소 <small>${places.filter(k => M.seen[k]).length}/${places.length}</small></h4><div class="mq-grid wide">${places.map(k => M.seen[k] ? `<button data-mq="view" data-k="${esc(k)}"><img src="${esc(IMG(k))}" alt="" loading="lazy"><small>${esc(k.replace(/_장소$/, ''))}</small></button>` : `<span class="mq-locked">${ic('lock')}</span>`).join('')}</div>`;
    }
    function renderPanel() {
      const tab = R.tab === 'stage' ? (R.sideTab || 'oseong') : R.tab;
      R.sideTab = tab;
      $('#mq-stabs').innerHTML = SIDE_TABS.map(([k, n, i]) => `<button data-mq="tab" data-k="${k}" class="${tab === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${k === 'clue' && R.newClue ? '<em></em>' : ''}</button>`).join('');
      const p = $('#mq-panel');
      const keep = p.scrollTop;
      p.innerHTML = tab === 'oseong' ? oseongHtml() : tab === 'kanbu' ? kanbuHtml() : tab === 'clue' ? clueHtml() : tab === 'cmd' ? cmdHtml() : albumHtml();
      p.scrollTop = R.keepScroll ? keep : 0; R.keepScroll = false;
      mqRoot.classList.toggle('sheet-on', R.tab !== 'stage');
      $('#mq-tabs').innerHTML = PHONE_TABS.map(([k, n, i]) => `<button data-mq="tab" data-k="${k}" class="${R.tab === k ? 'on' : ''}">${ic(i)}<span>${n}</span>${k === 'clue' && R.newClue ? '<em></em>' : ''}</button>`).join('');
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
    const endPhrase = () => '마왕은 어떻게 할까?';
    function showBeat(i) {
      const d = $('#mq-dlg');
      const b = R.beats[i];
      if (!b) { d.className = 'mq-dlg k-end'; d.innerHTML = `<div class="mq-dline mq-endq">${esc(endPhrase())}</div>`; return; }
      if (b.bgSrc) setBg(b.bgSrc);
      setPortrait(b.face || '', b.who);
      const last = i >= R.beats.length - 1;
      if (b.kind === 'title') {
        d.className = 'mq-dlg k-title';
        d.innerHTML = `<div class="mq-ep"><small>EP. ${esc(b.ep)}</small><b>${esc(b.text)}</b></div><span class="mq-next">${last ? '' : '탭해서 계속 ▼'}</span>`;
        R.typing = null; return;
      }
      const r = b.kind === 'say' ? RO[b.who] : null;
      d.className = 'mq-dlg k-' + b.kind;
      d.style.setProperty('--nc', (r && r.color) || '#c9b8ff');
      d.innerHTML = `${b.kind === 'say' ? `<div class="mq-name">${esc(b.who)}${r && r.role ? `<small>${esc(r.role)}</small>` : ''}</div>` : ''}
        ${b.act ? `<div class="mq-act">${esc(b.act)}</div>` : ''}<div class="mq-dline"></div>
        <span class="mq-next">${last ? '' : '탭해서 계속 ▼'}</span>${last ? `<div class="mq-endq" hidden>${esc(endPhrase())}</div>` : ''}`;
      const text = b.kind === 'say' ? `“${b.text}”` : b.kind === 'sys' ? `( ${b.text} )` : b.text;
      typeTo(d.querySelector('.mq-dline'), text, () => { if (last) { const q = d.querySelector('.mq-endq'); if (q) q.hidden = false; } });
    }
    function next() {
      if (R.typing) { R.typing.finish(); return; }
      if (R.waiting) return;
      if (R.i < R.beats.length - 1) { R.i++; showBeat(R.i); }
    }
    // 장면마다 그림 한 장: 묘사 = 장소, 대사 = 그 사람 (크랙이 고른 그림 그대로, 없으면 전에 본 그 사람 그림)
    function assign(beats, st) {
      let place = placeKeyOf(st && st.place) || R.placeK;
      let lastFace = {};
      beats.forEach(b => {
        if (b.place) place = b.place;
        else if (b.kind !== 'say') { const k = placeKeyOf(b.text); if (k && b.text.length < 60) place = k; }
        b.bgSrc = b.bg || PLACE_IMG(place) || M.lastBg;
        b.face = '';
        if (b.portrait) { b.face = b.portrait; if (b.pinfo && b.pinfo.who) lastFace[b.pinfo.who] = b.portrait; }
        else if (b.kind === 'say' && b.known) b.face = lastFace[b.who] || R.faces[b.who] || IMG('기본상태_' + b.who);
        if (b.kind === 'say' && b.face) R.faces[b.who] = b.face;
      });
      R.placeK = placeKeyOf(st && st.place) || place;
    }

    // ---------- 응답 처리 ----------
    function handle(segs) {
      if (R.sm) R.sm.done = true;
      const P = U.parse(segs, roster, IDX);
      const ev = U.absorb(M, P, data);
      P.beats.forEach(b => { if (b.text) M.lines.push({ d: st0().day || 0, who: b.kind === 'say' ? b.who : '', t: b.text, sys: b.kind === 'sys' }); });
      if (ev.newClues) R.newClue = true;
      save();
      R.beats = P.beats.filter(b => b.text || b.kind === 'title');
      assign(R.beats, M.status);
      R.i = -1;
      renderHud(); setTint(); R.keepScroll = true; renderPanel();
      notifyEvents(ev);
      if (P.prologue && (P.webtoon.length || P.title)) { playCine(P); return; }
      if (ev.ending) { showEnding(ev.ending); }
      startBeats();
    }
    function startBeats() { R.i = R.beats.length ? 0 : -1; showBeat(R.i); }
    // 프롤로그: 타이틀 + 웹툰 컷을 세로로 이어 읽기 → 이야기
    function playCine(P) {
      const c = $('#mq-cine');
      const pics = [].concat(P.title ? [P.title] : [], P.webtoon || []);
      c.innerHTML = `<div class="mq-webtoon" data-sk="cine">${pics.map((x, i) => `<img src="${esc(x.src)}" alt="${i ? '프롤로그 ' + i : '타이틀'}" ${i > 1 ? 'loading="lazy"' : ''}>`).join('')}
          <div class="mq-wend"><small>EP.PROLOG</small><b>반지하의 마왕</b><button class="mq-btn primary" data-mq="cine-end">이야기 시작</button></div></div>
        <button class="mq-skip" data-mq="cine-end">건너뛰기 ›</button>`;
      c.hidden = false; R.cine = true;
      M.prologue = true; save();
    }
    function cineEnd() { const c = $('#mq-cine'); c.hidden = true; c.innerHTML = ''; R.cine = false; startBeats(); }
    function showEnding(name) {
      const e = (data.endings || []).find(x => x.name === name) || { name, grade: '', hint: '' };
      const box = $('#mq-end');
      box.innerHTML = `<div class="mq-endbg" style="background-image:${cssUrl(IMG('엔딩_' + name))}"></div><div class="mq-endc"><em class="g-${esc(e.grade)}">${esc(e.grade)} ENDING</em><b>${esc(name)}</b><span>${esc(e.hint)}</span><button class="mq-btn primary" data-mq="end-close">이야기로 돌아가기</button></div>`;
      box.hidden = false;
    }

    // ---------- 입력칸 ----------
    function autosize() { const ta = $('#mq-in'); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
    function fill(text) {
      const ta = $('#mq-in');
      ta.value = text; ta.focus(); ta.setSelectionRange(text.length, text.length); autosize();
      ta.classList.remove('flash'); void ta.offsetWidth; ta.classList.add('flash');
      if (narrow() && R.tab !== 'stage') { R.tab = 'stage'; renderPanel(); }
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
      d.innerHTML = `<div class="mq-typing"><span><i></i><i></i><i></i></span><b>그림자가 움직이는 중…</b></div><div class="mq-tip">✦ ${esc(TIPS[tipI % TIPS.length])}</div>${preview ? `<small class="mq-stream">${esc(preview.slice(-140))}</small>` : ''}`;
      tipT = setInterval(() => { tipI++; const t = el.querySelector('.mq-tip'); if (t) t.textContent = '✦ ' + TIPS[tipI % TIPS.length]; else clearInterval(tipT); }, 5000);
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
        b.innerHTML = `<div class="mq-gate"><span class="mq-dots3"><i></i><i></i><i></i></span><b>새 대화를 여는 중이에요</b><span>${why}</span>${row(acts.map(a => `<button class="mq-fb primary" data-mq="click" data-id="${a.id}">${esc(a.label)}</button>`).join('') + '<button class="mq-fb primary" data-mq="crack-pick">크랙 화면에서 직접 고르기</button>' + std)}</div>`;
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
        const ls = M.lines.slice(-120);
        box.classList.add('wide');
        box.innerHTML = `${X}<h3>지난 대사</h3><div class="mq-lines">${ls.length ? ls.map(l => `<p class="${l.me ? 'me' : l.sys ? 'sys' : ''}">${l.who ? `<b>${esc(l.who)}</b>` : ''}<span>${esc(l.t)}</span></p>`).join('') : '<p class="mq-dim">아직 없어요.</p>'}</div>`;
        setTimeout(() => { const n = box.querySelector('.mq-lines'); if (n) n.scrollTop = n.scrollHeight; }, 0);
      } else if (k === 'set') {
        const seg = (key, opts) => `<div class="mq-seg">${opts.map(([v, l]) => `<button class="${String(M.prefs[key]) === String(v) ? 'on' : ''}" data-mq="pref" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
        box.innerHTML = `${X}<h3>설정</h3>
          <div class="mq-setrow"><span>글자 속도</span>${seg('speed', [['slow', '느림'], ['normal', '보통'], ['fast', '빠름'], ['instant', '즉시']])}</div>
          <div class="mq-setrow"><span>화면 연출</span>${seg('fx', [[false, '끔'], [true, '켜짐']])}</div>
          <p class="mq-dim">게임 화면은 크랙 응답을 읽어 그려요. 크랙 프롬프트·진행은 그대로예요. 숫자는 크랙 상태창 그대로예요.</p>
          <div class="mq-btns left"><button class="mq-btn" data-mq="title">처음 화면</button><button class="mq-btn" data-mq="crack">크랙 화면 보기</button><button class="mq-btn" data-mq="diag">화면 진단 복사</button><button class="mq-btn danger" data-mq="pack-off">플레이팩 끄기</button></div>`;
      } else if (k === 'powers') {
        const st = st0();
        box.innerHTML = `${X}<h3>권능 <small>${(st.power && st.power.n) || 0}/5 · 🔮 마력 ${st.mana ? st.mana.n + '/' + st.mana.of : '–'}</small></h3>
          <div class="mq-pws">${(data.powers || []).map(([pk, who, desc]) => { const m = M.powers[who]; return `<div class="mq-pwr ${m ? 'on' : ''}" style="--c:${(RO[who] || {}).color}"><i>${esc(pk[0])}</i><div><b>${esc(pk)} <small>${esc(who)}</small></b><span>${esc(desc)}</span></div><em style="${m ? 'color:' + (METHOD[m] || {}).c : ''}">${m ? esc(m) + '으로 회수' : '봉인 중'}</em></div>`; }).join('')}</div>
          <p class="mq-dim">되찾는 방법: 사랑(스스로 돌려줌) · 흑화(마음이 무너짐) · 전투(권능 3개를 되찾은 뒤부터). 누가 어떤 방식으로 돌려줬는지는 크랙의 회수 장면 그림으로 알아봐요.</p>`;
      } else if (k === 'view') {
        const src = IMG(String(arg)); if (!src) return;
        box.classList.add('photo');
        box.innerHTML = `${X}<img src="${esc(src)}" alt=""><div class="mq-dim">${esc(String(arg).replace(/_/g, ' ').replace(/\//g, '·'))}</div>`;
      }
      $('#mq-modal').hidden = false;
    }
    function closeModal() { R.modal = null; $('#mq-modal').hidden = true; $('#mq-box').innerHTML = ''; }
    const menuExtra = () => [{ label: '권능', fn: () => openModal('powers') }, { label: '기억 (본 그림)', fn: () => { R.tab = narrow() ? 'album' : R.tab; R.sideTab = 'album'; renderPanel(); } }, { label: '지난 대사', fn: () => openModal('lines') }, { label: '플레이팩 설정', fn: () => openModal('set') }];

    // ---------- 입력 ----------
    el.addEventListener('click', (e) => {
      if (e.target.id === 'mq-modal') { closeModal(); return; }
      const t = e.target.closest('[data-mq]');
      if (!t || !el.contains(t)) return;
      const k = t.dataset.mq;
      switch (k) {
        case 'next': if (!e.target.closest('button')) next(); break;
        case 'send': doSend(); break;
        case 'regen': if (R.waiting) break; o.action('regen'); R.waiting = true; R.sentAt = Date.now(); waitingUi(true); break;
        case 'tab': { const v = t.dataset.k; R.sub = null; if (v === 'clue') R.newClue = false; if (t.closest('#mq-stabs')) { R.sideTab = v; if (R.tab !== 'stage') R.tab = v; } else R.tab = v; renderPanel(); break; }
        case 'who': R.sub = t.dataset.k; renderPanel(); break;
        case 'sub-back': R.sub = null; renderPanel(); break;
        case 'fill': fill(t.dataset.v); break;
        case 'sc': fillShortcut(t.dataset.k); break;
        case 'skip': fillShortcut('/시간경과', `요청 기간: ${t.dataset.k}일`); break;
        case 'view': openModal('view', t.dataset.k); break;
        case 'powers': openModal('powers'); break;
        case 'more': if (o.menu) o.menu(menuExtra()); else openModal('set'); break;
        case 'lines': openModal('lines'); break;
        case 'set': case 't-set': openModal('set'); break;
        case 'mclose': closeModal(); break;
        case 'pref': { const v = t.dataset.v; M.prefs[t.dataset.key] = v === 'true' ? true : v === 'false' ? false : v; save(); mqRoot.classList.toggle('nofx', !M.prefs.fx); openModal('set'); break; }
        case 'cine-end': cineEnd(); break;
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
      if (!el.isConnected || el.classList.contains('off') || document.querySelector('#layer .scrim')) return;
      if (e.target.id === 'mq-in' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); return; }
      if (/^(TEXTAREA|INPUT|SELECT|WEBVIEW)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { if (R.modal) closeModal(); else if (R.sub) { R.sub = null; renderPanel(); } }
      if ((e.key === ' ' || e.key === 'Enter') && !R.modal && !R.cine && !e.target.closest('button')) { e.preventDefault(); if ($('#mq-title').hidden) next(); }
    };
    document.addEventListener('keydown', onKey);
    const onBack = (e) => {
      if (!el.isConnected || el.closest('.off') || document.querySelector('#layer > *')) return;
      const done = () => e.preventDefault();
      if (R.modal) { closeModal(); return done(); }
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
    const sumText = (sv) => { const s = (sv && sv.sum) || {}; return s.day ? `D+${s.day}${s.place ? ' · ' + s.place : ''} · 권능 ${s.power || 0}/5` : '반지하에서 눈뜬 날'; };
    function renderTitle() {
      const box = $('#mq-title');
      const list = saves.slice().sort((a, b) => (b.last || 0) - (a.last || 0));
      const cont = list.find(x => x.url);
      const hero = IMG('인물 외_타이틀');   // 작품 타이틀 그림(제목 글씨가 들어 있음) → 그대로 크게
      box.innerHTML = `<div class="mq-tbg ${hero ? 'blur' : ''}" style="background-image:${cssUrl(hero || PLACE_IMG('도심'))}"></div><div class="mq-tvig"></div>
        ${hero ? `<div class="mq-thero"><img src="${esc(hero)}" alt="마법소녀의 최종보스"></div>` : ''}
        <div class="mq-tcopy ${hero ? 'small' : ''}"><div class="mq-teye">크랙 플레이팩 · 다크 판타지 복수극</div>${hero ? '' : '<h1><span>마법소녀의</span>최종보스</h1>'}<div class="mq-tsub">전쟁 후, 마법소녀는 어른이 되었고 마왕은 다시 깨어난다</div></div>
        <div class="mq-tmenu">
          <button class="mq-pl" data-mq="t-new">마왕, 다시 일어나다 <small>처음부터</small></button>
          ${cont ? `<button class="mq-pl ghost" data-mq="t-cont" data-id="${esc(cont.id)}">이어하기<small>${esc(sumText(cont))}</small></button>` : ''}
          <button class="mq-pl ghost" data-mq="t-set">설정</button>
        </div>
        <div class="mq-saves"><h4>세이브 <em>${list.length}</em></h4>
          ${list.length ? list.map((sv, i) => `<div class="mq-save"><div class="mq-simg" style="background-image:${cssUrl((sv.sum && sv.sum.bg) || PLACE_IMG('허름한 반지하'))}"></div>
              <div class="mq-smeta"><b>${esc(sumText(sv))}</b><span>${fmtMs(sv.playMs)} 플레이</span><em>세이브 ${list.length - i} · ${sv.url ? '마지막 ' + ago(sv.last || sv.created) : '대화 연결 전'}</em></div>
              <div class="mq-sbtns">${sv.url ? `<button class="mq-fb primary" data-mq="t-cont" data-id="${esc(sv.id)}">이어하기</button>` : ''}<button class="mq-fb ${R.delAsk === sv.id ? 'danger' : ''}" data-mq="t-del" data-id="${esc(sv.id)}">${R.delAsk === sv.id ? '한 번 더 누르면 삭제' : '지우기'}</button></div></div>`).join('')
            : '<p class="mq-dim">아직 세이브가 없어요. 처음부터는 늘 크랙의 <b>새 대화</b>로 시작해요.</p>'}</div>
        <div class="mq-tfoot">CRION 플레이팩 · 크랙 AI가 진행해요 · 19세 이상 · MADE BY 히리온</div>`;
      box.hidden = false;
    }
    function resetScene() {
      R.beats = []; R.i = -1; R.lastKey = ''; R.waiting = false; R.away = false; R.cine = false; R.sub = null; R.tab = 'stage'; R.faces = {};
      R.bgKey = ''; el.querySelectorAll('.mq-bgl').forEach(x => { x.style.backgroundImage = ''; x.classList.remove('on'); });
      R.placeK = placeKeyOf(st0().place) || '허름한 반지하'; setBg(M.lastBg || PLACE_IMG(R.placeK));
      setPortrait('');
      $('#mq-cine').hidden = true; $('#mq-end').hidden = true; closeModal();
      renderHud(); setTint(); renderPanel();
      const d = $('#mq-dlg'); d.className = 'mq-dlg'; d.innerHTML = '';
    }
    const hideTitle = () => { $('#mq-title').hidden = true; };
    function showTitle() { R.mode = 'title'; R.newFlow = null; R.delAsk = null; banner(null); waitingUi(false); renderTitle(); }
    function loading(msg) { const d = $('#mq-dlg'); d.className = 'mq-dlg k-wait'; d.innerHTML = `<div class="mq-typing"><span><i></i><i></i><i></i></span><b>${esc(msg)}</b></div>`; }
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
        if (modes.length === 1 && !sm.viaCrack) { sm.picked = modes[0].label; o.click(modes[0].id); return true; }   // 시작 설정이 하나뿐(마왕, 다시 일어나다)이면 그걸로
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
    R.faces = {};
    setBg(PLACE_IMG('허름한 반지하'));
    renderHud(); renderPanel();
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
      destroy() { document.removeEventListener('keydown', onKey); document.removeEventListener('crion-back', onBack); clearInterval(waitT); clearInterval(playT); clearInterval(tipT); clearInterval(typeT); save(); },
      demo(segs) { handle(segs); },
      state: R, memory: M, saves: () => saves
    };
  }

  root.CrionMaouRun = { start };
})(typeof window !== 'undefined' ? window : globalThis);
