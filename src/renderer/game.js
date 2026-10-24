/*
 * CRION 게임 화면 (규격 v2): 무대 · 입화 · 대사창 · 선택지 · HUD · 연출 · 모달
 * 팩 manifest의 theme / assets / hud / fxMap 대로 그리고, 이미지가 없으면 CSS 대체 화면으로 보여준다.
 */
(function (root) {
  'use strict';
  const Play = root.CrionPlay;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FONT = {
    'Black Han Sans': '"Black Han Sans","Apple SD Gothic Neo","Malgun Gothic",sans-serif',
    'Noto Sans KR': '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif',
    'Noto Serif KR': '"Noto Serif KR","AppleMyungjo","Batang",serif',
    'Gowun Batang': '"Gowun Batang","AppleMyungjo","Noto Serif KR","Batang",serif',
    'Nanum Myeongjo': '"Nanum Myeongjo","AppleMyungjo","Batang",serif',
    'Nanum Pen Script': '"Nanum Pen Script","Apple SD Gothic Neo",cursive'
  };
  const PHASES = ['오전', '오후', '저녁', '밤'];
  const PHASE_ICON = { 오전: '🌅', 오후: '☀️', 저녁: '🌇', 밤: '🌙', 새벽: '🌌' };
  const SPEED = { slow: 46, normal: 28, fast: 12, instant: 0 };
  const DORM_ICON = { 해: ['dorm_sun', '☀️'], 달: ['dorm_moon', '🌙'], 별: ['dorm_star', '⭐'] };
  const FRAME_VARS = { dialogue: '--fr-dialogue', hud: '--fr-hud', button: '--fr-button', nameplate: '--fr-nameplate', cardCommon: '--fr-card' };

  const probeCache = new Map();
  function probe(src) {
    if (!probeCache.has(src)) {
      probeCache.set(src, new Promise((res) => {
        const im = new Image();
        im.onload = () => res(true);
        im.onerror = () => res(false);
        im.src = src;
      }));
    }
    return probeCache.get(src);
  }

  function mount(el, opts) {
    let pack = opts.pack;
    const settings = () => opts.settings();
    const audio = opts.audio;
    const url = (rel) => (root.__crionAssetUrl ? root.__crionAssetUrl(pack, rel) : `crionpack://${pack.id}/${String(rel).split('/').map(encodeURIComponent).join('/')}`);
    const A = () => pack.assets || {};
    const fontOf = (n) => FONT[n] || FONT['Noto Sans KR'];

    // ---------- 상태 ----------
    const S = {
      st: null, prevSt: null, delta: {}, ctrl: null, fx: [], bg: null, bgKey: null, bgm: null,
      beats: [], idx: -1, cast: [], notices: [], battle: null, choices: [], hasReply: false,
      portraits: {}, bgFallback: null, codes: [], typing: null, typed: true, modal: null,
      flip: {}, lastPortrait: null, bgmMissing: false, speaker: null, cg: null
    };

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="gm" data-phase="">
      <div class="gm-main">
        <div class="gm-stage" id="gmStage">
          <div class="gm-bg" id="gmBgA"></div><div class="gm-bg" id="gmBgB"></div>
          <div class="gm-shade"></div>
          <div class="gm-fx" id="gmFx"></div>
          <div class="gm-sprites" id="gmSprites"></div>
          <div class="gm-top">
            <div class="gm-place" id="gmPlace"><i>🔖</i><span>대기 중</span></div>
            <div class="gm-tools" id="gmTools"></div>
          </div>
          <div class="gm-notice" id="gmNotice"></div>
          <div class="gm-empty" id="gmEmpty"><b>대화를 이어 가면 여기서 장면이 펼쳐져요</b><span>채팅에서 응답이 오면 자동으로 읽어 와요.</span><button class="gm-btn" data-g="chat">채팅 열기</button></div>
          <div class="gm-bottom">
            <div class="gm-choices" id="gmChoices"></div>
            <div class="gm-dlg" id="gmDlg">
              <div class="gm-name" id="gmName"></div>
              <div class="gm-text" id="gmText"></div>
              <div class="gm-next" id="gmNext">▼</div>
            </div>
          </div>
          <div class="gm-cg" id="gmCg"></div>
        </div>
        <div class="gm-time" id="gmTime"></div>
      </div>
      <aside class="gm-hud" id="gmHud"></aside>
      <div class="gm-modal-bg" id="gmModal"></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const stage = $('#gmStage'), fxEl = $('#gmFx'), spritesEl = $('#gmSprites'), textEl = $('#gmText'), nameEl = $('#gmName');
    const root_ = $('.gm');

    // ---------- 테마 ----------
    function applyTheme() {
      const th = pack.theme || {};
      const set = (k, v) => v && root_.style.setProperty(k, v);
      set('--gm-accent', th.accent); set('--gm-bg', th.bg); set('--gm-text', th.text); set('--gm-sub', th.textSub);
      root_.style.setProperty('--gm-title', fontOf(th.fontTitle));
      root_.style.setProperty('--gm-body', fontOf(th.fontBody));
      root_.style.setProperty('--gm-dlg', fontOf(th.fontDialogue || th.fontBody));
      const fr = th.frames || {};
      Object.keys(FRAME_VARS).forEach((k) => {
        if (!fr[k]) return;
        probe(url(fr[k])).then((ok) => { if (ok) root_.style.setProperty(FRAME_VARS[k], `url("${url(fr[k])}")`); });
      });
    }

    // ---------- 그림 조각 ----------
    function iconHtml(id, fb, cls) {
      const rel = (A().icons || {})[id];
      if (!rel) return `<span class="gm-ic ${cls || ''}">${esc(fb || '')}</span>`;
      return `<span class="gm-ic ${cls || ''}"><img src="${esc(url(rel))}" alt="" data-fb="${esc(fb || '')}"></span>`;
    }
    el.addEventListener('error', (e) => {
      const t = e.target;
      if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fb !== undefined) {
        const s = document.createElement('span');
        s.textContent = t.dataset.fb;
        t.replaceWith(s);
      } else if (t && t.tagName === 'IMG' && t.dataset && t.dataset.hide) {
        t.style.display = 'none';
      }
    }, true);

    // ---------- 무대 ----------
    let bgFlip = false;
    async function setBackground(key) {
      const a = $('#gmBgA'), b = $('#gmBgB');
      let src = null, kind = 'none';
      if (key && (A().bg || {})[key]) {
        const u = url(A().bg[key]);
        if (await probe(u)) { src = u; kind = 'pack'; }
      }
      if (!src && S.bgFallback) { src = S.bgFallback; kind = 'crack'; }
      const sig = kind + '|' + (src || '');
      if (sig === S.bgSig) return;
      S.bgSig = sig;
      const next = bgFlip ? a : b, prev = bgFlip ? b : a;
      bgFlip = !bgFlip;
      next.style.backgroundImage = src ? `url("${src}")` : '';
      next.classList.toggle('empty', !src);
      next.classList.add('show');
      prev.classList.remove('show');
      next.style.animation = 'none'; void next.offsetWidth; next.style.animation = '';
    }

    function setPlace() {
      const loc = S.st && S.st.loc;
      $('#gmPlace').innerHTML = `<i>🔖</i><span>${esc(loc || '대기 중')}</span>`;
      root_.dataset.phase = (S.st && S.st.phase) || '';
      const empty = $('#gmEmpty');
      empty.style.display = S.hasReply ? 'none' : '';
    }

    // ---------- 입화 ----------
    function renderSprites() {
      const names = S.cast.slice(-3);
      const lay = Play.layout(names);
      spritesEl.innerHTML = lay.map((c) => {
        const face = (S.faces || {})[c.who];
        const pf = Play.pickFace(pack, c.who, face);
        const speaking = S.speaker === c.who;
        const art = pf
          ? `<img src="${esc(url(pf.src))}" alt="${esc(c.who)}" data-hide="1">`
          : '';
        return `<div class="gm-sp pos-${c.pos} ${speaking ? 'on' : 'dim'}" data-who="${esc(c.who)}">${art}<div class="gm-ph"><b>${esc(c.who)}</b></div></div>`;
      }).join('');
      // 그림이 불러와지면 자리표시 숨김
      spritesEl.querySelectorAll('.gm-sp img').forEach((im) => {
        const done = () => { const ph = im.parentElement.querySelector('.gm-ph'); if (ph) ph.style.display = 'none'; };
        if (im.complete && im.naturalWidth) done(); else im.addEventListener('load', done);
      });
    }

    // ---------- 대사창 ----------
    function stopTyping() { if (S.typing) { clearInterval(S.typing); S.typing = null; } }
    function onTyped() {
      S.typed = true;
      $('#gmNext').style.visibility = S.idx >= S.beats.length - 1 ? 'hidden' : 'visible';
      if (S.idx >= S.beats.length - 1) renderChoices();
    }
    function showText(text, cls) {
      stopTyping();
      const dlg = $('#gmDlg');
      dlg.classList.toggle('nar', cls === 'nar');
      dlg.classList.toggle('say', cls === 'say');
      const per = SPEED[settings().textSpeed || 'normal'];
      const chars = [...text];
      S.typed = false;
      $('#gmNext').style.visibility = 'hidden';
      if (!per) { textEl.textContent = text; onTyped(); return; }
      let i = 0;
      textEl.textContent = '';
      S.typing = setInterval(() => {
        i += 1;
        textEl.textContent = chars.slice(0, i).join('');
        if (i >= chars.length) { stopTyping(); onTyped(); }
      }, per);
    }
    function finishTyping() {
      const b = S.beats[S.idx];
      if (!b) return;
      stopTyping();
      textEl.textContent = b.text || '';
      onTyped();
    }

    function applyScene(p) {
      if (!p) return;
      if (p.bg) { S.bgKey = p.bg; setBackground(p.bg); }
      if (p.bgm) playBgm(p.bgm);
      if (p.fx) runFx(p.fx.split(/[,\s]+/).filter(Boolean));
      if (p.cg) showCg(p.cg);
    }

    function showBeat(i) {
      S.idx = i;
      const b = S.beats[i];
      if (!b) { showEnd(); return; }
      if (b.t === 'scene') { applyScene(b.props); showBeat(i + 1); return; }
      if (b.t === 'who') {
        S.speaker = b.who;
        if (S.cast.indexOf(b.who) === -1) S.cast.push(b.who);
        (S.faces = S.faces || {})[b.who] = b.face;
        renderSprites(); showBeat(i + 1); return;
      }
      $('#gmChoices').classList.remove('show');
      if (b.t === 'say') {
        S.speaker = b.who;
        if (S.cast.indexOf(b.who) === -1) S.cast.push(b.who);
        (S.faces = S.faces || {})[b.who] = b.face;
        nameEl.textContent = b.who;
        nameEl.style.display = '';
        renderSprites();
        showText(b.text, 'say');
      } else {
        S.speaker = null;
        nameEl.style.display = 'none';
        renderSprites();
        showText(b.text, 'nar');
      }
    }

    function advance() {
      if (S.modal || S.cg) return;
      if (!S.beats.length) return;
      if (!S.typed) { finishTyping(); return; }
      if (S.idx >= S.beats.length - 1) return;
      showBeat(S.idx + 1);
    }

    function showEnd() {
      S.idx = S.beats.length - 1;
      stopTyping();
      onTyped();
    }

    function renderChoices() {
      const box = $('#gmChoices');
      const list = S.choices.length ? S.choices : [];
      box.innerHTML = list.map((c, i) => `<button class="gm-choice" data-g="choice" data-i="${i}"><span>${i + 1}</span>${esc(c)}</button>`).join('') +
        `<button class="gm-choice free" data-g="chat"><span>✏️</span>직접 입력하기</button>`;
      box.classList.add('show');
    }

    // ---------- 음악 ----------
    function playBgm(id) {
      const rel = (A().bgm || {})[id];
      if (!rel) return;
      S.bgm = id;
      S.bgmMissing = false;
      audio.play(url(rel));
    }

    // ---------- 연출 ----------
    const timers = [];
    function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }
    function particles(kind, n) {
      const wrap = document.createElement('div');
      wrap.className = 'gm-ptl ' + kind;
      for (let i = 0; i < n; i++) {
        const p = document.createElement('i');
        p.style.left = (Math.random() * 100) + '%';
        p.style.animationDelay = (-Math.random() * 8) + 's';
        p.style.animationDuration = (kind === 'rain' ? 0.7 + Math.random() * 0.5 : 6 + Math.random() * 7) + 's';
        p.style.setProperty('--s', (0.6 + Math.random() * 0.9).toFixed(2));
        p.style.setProperty('--dx', ((Math.random() - 0.5) * 120).toFixed(0) + 'px');
        wrap.appendChild(p);
      }
      return wrap;
    }

    function runFx(list) {
      const inten = settings().intensity || 'mid';
      // 지속 효과를 비우고 새로 건다
      fxEl.innerHTML = '';
      ['fx-vignette_red', 'fx-vignette_dark', 'fx-heartbeat', 'fx-dim', 'fx-fog', 'fx-glitch'].forEach(c => stage.classList.remove(c));
      const set = new Set(list.filter(x => Play.FX_ALL.indexOf(x) !== -1));
      const season = S.st && S.st.fields && S.st.fields.season;
      const sf = (pack.seasonFx || {})[season];
      if (!set.size && sf && inten !== 'low') set.add(sf + ':soft');
      const mult = inten === 'high' ? 1.6 : 1;
      set.forEach((f) => {
        const soft = f.endsWith(':soft');
        const id = soft ? f.slice(0, -5) : f;
        if (inten === 'low' && ['shake', 'flash', 'glitch', 'heartbeat'].indexOf(id) !== -1) return;
        if (['vignette_red', 'vignette_dark', 'heartbeat', 'dim', 'fog', 'glitch'].indexOf(id) !== -1) stage.classList.add('fx-' + id);
        if (id === 'fog') fxEl.appendChild(Object.assign(document.createElement('div'), { className: 'gm-fog' }));
        if (id === 'petals') fxEl.appendChild(particles('petals', Math.round((soft ? 10 : 22) * mult)));
        if (id === 'snow') fxEl.appendChild(particles('snow', Math.round((soft ? 22 : 46) * mult)));
        if (id === 'rain') fxEl.appendChild(particles('rain', Math.round(60 * mult)));
        if (id === 'sparks') { const p = particles('sparks', Math.round(18 * mult)); fxEl.appendChild(p); later(() => p.remove(), 6500); }
        if (id === 'flash') { const f2 = document.createElement('div'); f2.className = 'gm-flash'; fxEl.appendChild(f2); later(() => f2.remove(), 1300); }
        if (id === 'shake') { stage.classList.remove('fx-shake'); void stage.offsetWidth; stage.classList.add('fx-shake'); later(() => stage.classList.remove('fx-shake'), 700); }
      });
      S.fx = Array.from(set);
    }

    async function showCg(id) {
      const rel = (A().cg || {})[id];
      if (!rel) return;
      const u = url(rel);
      if (!(await probe(u))) return;
      S.cg = id;
      const box = $('#gmCg');
      box.innerHTML = `<img src="${esc(u)}" alt=""><span>클릭하면 닫혀요</span>`;
      box.classList.add('show');
    }
    function closeCg() { S.cg = null; $('#gmCg').classList.remove('show'); }

    // ---------- 알림 (도감 등록 · 배지 획득) ----------
    function renderNotices() {
      const box = $('#gmNotice');
      box.innerHTML = S.notices.map((n, i) => `<div class="gm-note"><b>${esc(n.title)}</b>${n.code ? `<code>${esc(n.code)}</code><button data-g="copy" data-i="${i}">코드 복사</button>` : ''}<button class="x" data-g="note-x" data-i="${i}" aria-label="닫기">×</button></div>`).join('');
    }

    // ---------- HUD ----------
    const hasHud = (k) => !(pack.hud || []).length || (pack.hud || []).some(h => h.key === k);
    const pct = (r) => (r && r.max ? Math.max(0, Math.min(100, r.value / r.max * 100)) : 0);
    const dlt = (k) => (S.delta[k] ? `<em class="${S.delta[k] > 0 ? 'up' : 'dn'}">${S.delta[k] > 0 ? '+' : ''}${S.delta[k]}</em>` : '');

    function partnerCard(p, i) {
      const flipped = !!S.flip[i];
      const ratio = pct(p.hp);
      const hpCls = ratio <= 30 ? 'low' : ratio <= 60 ? 'mid' : '';
      const sprite = S.portraits[p.name] || (i === 0 ? S.lastPortrait : null);
      const ail = p.ailment && !/^(없음|-|—)$/.test(p.ailment) ? `<span class="gm-ail">${esc(p.ailment)}</span>` : '';
      const face = `<div class="gm-pc-face">
          <div class="gm-pic">${sprite ? `<img src="${esc(sprite)}" alt="" data-hide="1">` : ''}<b>${esc((p.name || '?').slice(0, 1))}</b></div>
          <div class="gm-pc-info">
            <div class="gm-pc-name"><b>${esc(p.name || '')}</b><span>Lv ${p.lv != null ? p.lv : '?'}${p.stage ? ' · ' + esc(p.stage) : ''}</span></div>
            ${p.hp ? `<div class="gm-bar hp ${hpCls}"><i style="width:${ratio}%"></i><span>♥ ${p.hp.value}<small>/${p.hp.max}</small></span></div>` : ''}
            ${p.xp ? `<div class="gm-bar xp"><i style="width:${pct(p.xp)}%"></i><span>XP ${p.xp.value}<small>/${p.xp.max}</small></span></div>` : ''}
            ${ail ? `<div class="gm-ails">${ail}</div>` : ''}
          </div></div>`;
      const stats = [['공', p.atk], ['방', p.def], ['특공', p.spa], ['특방', p.spd], ['속', p.spe]]
        .filter(x => x[1] != null).map(x => `<span><small>${x[0]}</small><b>${x[1]}</b></span>`).join('');
      const skills = (p.skills || []).slice(0, 4).map((s) => {
        const empty = s.left === 0 ? ' empty' : '';
        return `<div class="gm-skill${empty}"><span class="n">${esc(s.icon || '')} ${esc(s.name)}</span><span class="p">${s.pow != null ? s.pow : ''}</span><span class="c">${s.left != null ? s.left + (s.max != null ? '/' + s.max : '') : ''}</span>${s.fx ? `<span class="e">${esc(s.fx)}</span>` : ''}</div>`;
      }).join('');
      const back = `<div class="gm-pc-back"><div class="gm-stats">${stats}</div>${skills ? `<div class="gm-skills">${skills}</div>` : ''}</div>`;
      return `<div class="gm-pcard ${flipped ? 'flip' : ''}" data-g="flip" data-i="${i}">${flipped ? back : face}<em class="gm-flip">↻</em></div>`;
    }

    function battlePanel(b) {
      const side = (u, cls) => `<div class="gm-bside ${cls}"><b>${esc(u.name)}</b><small>Lv ${u.lv}${u.st && u.st !== '없음' ? ' · ' + esc(u.st) : ''}</small>
        <div class="gm-bar hp ${pct({ value: u.hp, max: u.max }) <= 30 ? 'low' : ''}"><i style="width:${pct({ value: u.hp, max: u.max })}%"></i><span>♥ ${u.hp}<small>/${u.max}</small></span></div></div>`;
      const log = (b.log || []).filter(l => !/^\S[^,]*?\s\d+\s*\/\s*\d+/.test(l)).slice(-3).map(l => `<li>${esc(l)}</li>`).join('');
      return `<section class="hc battle"><h4>⚔️ 전투</h4><div class="gm-bwrap">${side(b.a, 'ally')}<div class="vs">VS</div>${side(b.b, 'foe')}</div>${log ? `<ul class="gm-blog">${log}</ul>` : ''}</section>`;
    }

    function ringSvg(r, label) {
      const p = r && r.max ? r.value / r.max : 0;
      const c = 2 * Math.PI * 17;
      return `<svg viewBox="0 0 44 44" class="gm-ring"><circle cx="22" cy="22" r="17" class="bg"/><circle cx="22" cy="22" r="17" class="fg" style="stroke-dasharray:${(c * p).toFixed(1)} ${c.toFixed(1)}"/><text x="22" y="26" text-anchor="middle">${r ? r.value : '-'}</text></svg>`;
    }

    function renderHud() {
      const h = $('#gmHud');
      const st = S.st;
      if (!st) {
        h.innerHTML = `<section class="hc wait"><h4>학생 수첩</h4><p>상태창을 기다리는 중이에요.<br>대화를 이어 가면 학생증과 파트너 카드가 채워져요.</p></section>`;
        return;
      }
      const f = st.fields || {};
      const dormKey = f.dorm ? String(f.dorm).slice(0, 1) : '';
      const di = DORM_ICON[dormKey] || ['dorm_sun', '🎓'];
      const th = pack.theme || {};
      let html = '';

      if (hasHud('student')) {
        html += `<section class="hc id"><div class="id-top"><span>${esc(pack.name || '')}</span><em>학생증</em></div>
          <div class="id-body"><div class="id-ph">${iconHtml(di[0], di[1])}</div>
          <div class="id-info"><b>${esc(f.student && !/^\{.*\}$/.test(f.student) ? f.student : '신입생')}</b>
          <span>${f.grade != null ? f.grade + '학년' : ''}${f.season ? ' · ' + esc(f.season) : ''}${f.dorm ? ' · ' + esc(f.dorm) : ''}</span></div></div>
          <div class="id-money">
            ${f.gold != null ? `<div>${iconHtml('gold', '🥇')}<b>${f.gold}</b>${dlt('gold')}</div>` : ''}
            ${f.silver != null ? `<div>${iconHtml('silver', '🥈')}<b>${f.silver}</b>${dlt('silver')}</div>` : ''}
            ${f.copper != null ? `<div>${iconHtml('copper', '🥉')}<b>${f.copper}</b>${dlt('copper')}</div>` : ''}
          </div></section>`;
      }

      if (S.battle && S.battle.a && S.battle.b) html += battlePanel(S.battle);
      if (hasHud('partner')) {
        const ps = f.partner || [];
        html += `<section class="hc partners"><h4>파트너 <small>${ps.length ? '눌러서 뒤집기' : ''}</small></h4>${ps.length ? ps.map(partnerCard).join('') : '<p class="mute">동행 중인 소환수가 없어요.</p>'}</section>`;
      }

      const row = [];
      if (hasHud('contract') && f.contract) row.push(`<div class="gm-mini">${iconHtml('stone', '📦')}<small>계약</small><b>${f.contract.value}<i>/${f.contract.max}</i></b></div>`);
      if (hasHud('dex') && f.dex) row.push(`<div class="gm-mini ring" data-g="modal" data-m="dex">${ringSvg(f.dex)}<small>도감 /${f.dex.max}</small></div>`);
      if (hasHud('badges') && f.badges) row.push(`<div class="gm-mini" data-g="modal" data-m="badges">${iconHtml('badge_master', '🏅')}<small>배지</small><b>${f.badges.value}<i>/${f.badges.max}</i></b></div>`);
      if (row.length) html += `<section class="hc minis">${row.join('')}</section>`;

      const info = [];
      if (hasHud('quest') && f.quest != null) info.push(`<div class="gm-info">${iconHtml('act_quest', '📜')}<span><small>의뢰</small><b>${esc(f.quest)}</b></span></div>`);
      if (hasHud('schedule') && f.schedule != null) {
        const d = f.scheduleD;
        info.push(`<div class="gm-info">${d != null ? `<span class="gm-dd ${d <= 3 ? 'hot' : ''}">D-${d}</span>` : '<span class="gm-dd">🗓️</span>'}<span><small>다음 일정</small><b>${esc(String(f.schedule).replace(/\s*D\s*-\s*\d+\s*$/, ''))}</b></span></div>`);
      }
      if (info.length) html += `<section class="hc infos">${info.join('')}</section>`;

      h.innerHTML = html + (S.bgmMissing ? '<p class="gm-foot">♪ 음악 파일을 찾지 못했어요</p>' : '');
    }

    // ---------- 시간표 띠 ----------
    function renderTime() {
      const st = S.st;
      const ph = st && st.phase;
      const f = (st && st.fields) || {};
      const cells = PHASES.map(p => `<div class="gm-cell ${ph === p ? 'on' : ''}"><i>${PHASE_ICON[p]}</i><span>${p}</span></div>`).join('');
      const when = st ? `${f.grade != null ? f.grade + '학년 ' : ''}${f.season || ''}${st.day != null ? ' ' + st.day + '일차' : ''}` : '';
      $('#gmTime').innerHTML = `<div class="gm-cells">${cells}</div><div class="gm-when">${esc(when)}</div>`;
    }

    // ---------- 도구 단추 · 모달 ----------
    function renderTools() {
      const items = (S.st && S.st.fields && S.st.fields.items) || [];
      const mapOk = !!(A().map || {}).island;
      $('#gmTools').innerHTML =
        `<button class="gm-ibtn" data-g="modal" data-m="pouch" title="주머니">🎒<span>주머니</span></button>` +
        `<button class="gm-ibtn" data-g="modal" data-m="dex" title="도감">📖<span>도감</span></button>` +
        `<button class="gm-ibtn" data-g="modal" data-m="badges" title="배지">🏅<span>배지</span></button>` +
        (mapOk ? `<button class="gm-ibtn" data-g="modal" data-m="map" title="지도">🗺️<span>지도</span></button>` : '') +
        `<button class="gm-ibtn" data-g="bgm" title="음악">${audio.paused ? '🔇' : '♪'}<span>음악</span></button>` +
        `<button class="gm-ibtn chat" data-g="chat" title="채팅 보기">💬<span>채팅</span></button>`;
      void items;
    }

    function openModal(kind) {
      S.modal = kind;
      const f = (S.st && S.st.fields) || {};
      let body = '';
      if (kind === 'pouch') {
        const items = f.items || [];
        const icon = (n) => /상처약|포션/.test(n) ? ['potion', '🧪'] : /해독/.test(n) ? ['antidote', '💊'] : /계약석/.test(n) ? ['stone', '💎'] : [null, '🎁'];
        body = `<h3>주머니</h3>${items.length ? `<div class="gm-grid">${items.map((it) => { const ic = icon(it.name || String(it)); return `<div class="gm-slot">${ic[0] ? iconHtml(ic[0], ic[1]) : `<span class="gm-ic">${ic[1]}</span>`}<b>${esc(it.name || it)}</b><em>×${it.n || 1}</em></div>`; }).join('')}</div>` : '<p class="mute">비어 있어요.</p>'}
          <div class="gm-purse">${f.gold != null ? `${iconHtml('gold', '🥇')}<b>${f.gold}</b>` : ''}${f.silver != null ? `${iconHtml('silver', '🥈')}<b>${f.silver}</b>` : ''}${f.copper != null ? `${iconHtml('copper', '🥉')}<b>${f.copper}</b>` : ''}</div>`;
      } else if (kind === 'dex') {
        const d = f.dex;
        body = `<h3>도감</h3><div class="gm-dexbig">${ringSvg(d)}<div><b>${d ? d.value : 0} / ${d ? d.max : 80}</b><span>등록한 소환수</span></div></div>` +
          (S.codes.length ? `<h5>받은 코드</h5><ul class="gm-codes">${S.codes.map((c, i) => `<li><span>${esc(c.title)}</span><code>${esc(c.code)}</code><button data-g="copy-code" data-i="${i}">복사</button></li>`).join('')}</ul>` : '<p class="mute">아직 받은 코드가 없어요. 도감을 등록하면 여기 모여요.</p>');
      } else if (kind === 'badges') {
        const b = f.badges || { value: 0, max: 7 };
        const ids = ['ember', 'drop', 'feather', 'stone', 'dawn', 'dusk', 'fist'];
        const slots = ids.map((id, i) => `<div class="gm-bslot ${i < b.value ? 'on' : ''}">${iconHtml('badge_' + id, '◇')}</div>`).join('') +
          `<div class="gm-bslot master ${b.value >= b.max ? 'on' : ''}">${iconHtml('badge_master', '✦')}</div>`;
        body = `<h3>배지 회랑</h3><div class="gm-badges">${slots}</div><p class="mute">${b.value} / ${b.max}개 획득${b.value >= b.max ? ' · 마스터 인장이 열렸어요' : ''}</p>`;
      } else if (kind === 'map') {
        body = `<h3>에테르나 섬</h3><div class="gm-map"><img src="${esc(url((A().map || {}).island))}" alt="" data-hide="1"></div><p class="mute">현재 위치: ${esc((S.st && S.st.loc) || '알 수 없음')}</p>`;
      }
      const mb = $('#gmModal');
      mb.innerHTML = `<div class="gm-modal" role="dialog" aria-modal="true">${body}<button class="gm-btn close" data-g="modal-x">닫기</button></div>`;
      mb.classList.add('show');
    }
    function closeModal() { S.modal = null; $('#gmModal').classList.remove('show'); }

    // ---------- 응답 받기 ----------
    function onReply(d) {
      const prev = S.st;
      S.prevSt = prev;
      S.st = d.parsed || S.st;
      S.delta = d.delta || {};
      S.hasReply = true;

      const sp = Play.splitReply(pack, d.reply || '', d.text || '');
      const built = Play.buildBeats(pack, sp.narr);
      S.ctrl = sp.ctrl;
      S.battle = built.battle;
      S.beats = built.beats.length ? built.beats : [{ t: 'nar', text: '…' }];
      S.choices = (sp.ctrl.choices && sp.ctrl.choices.length ? sp.ctrl.choices : built.hint).slice(0, 4);

      // 크랙이 보여 준 그림 → 무대 대체 배경 · 파트너 그림
      S.bgFallback = null;
      (d.imgs || []).forEach((im) => {
        const wide = im.w && im.h && im.w / im.h >= 1.25;
        if (wide) S.bgFallback = im.src;
        else {
          const owner = ((S.st && S.st.fields && S.st.fields.partner) || []).find(p => p.name && (im.alt || '').indexOf(p.name) !== -1);
          if (owner) S.portraits[owner.name] = im.src; else S.lastPortrait = im.src;
        }
      });

      // 알림 · 코드
      S.notices = built.notices;
      built.notices.forEach(n => { if (n.code && !S.codes.some(c => c.code === n.code)) S.codes.push({ title: n.title, code: n.code }); });

      S.cast = [];
      S.faces = {};
      S.speaker = null;
      const fx = Play.deriveFx(pack, S.st, sp.ctrl);
      S.bgKey = Play.resolveBg(pack, S.st, fx, sp.ctrl.bg);
      closeCg();
      setPlace();
      setBackground(S.bgKey);
      const bgmId = Play.resolveBgm(pack, sp.ctrl, S.st, S.bgm);
      if (bgmId) playBgm(bgmId);
      runFx(fx);
      if (sp.ctrl.cg) showCg(sp.ctrl.cg);
      renderNotices();
      renderHud();
      renderTime();
      renderTools();
      $('#gmChoices').classList.remove('show');
      showBeat(0);
    }

    // ---------- 입력 ----------
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-g]');
      if (!t) {
        if (S.cg) { closeCg(); return; }
        if (e.target.closest('#gmDlg') || e.target.closest('.gm-sprites') || e.target.id === 'gmStage') { advance(); }
        return;
      }
      const g = t.dataset.g;
      if (g === 'choice') { const c = S.choices[Number(t.dataset.i)]; if (c) opts.fill(c); }
      else if (g === 'chat') opts.openChat();
      else if (g === 'flip') { const i = Number(t.dataset.i); S.flip[i] = !S.flip[i]; renderHud(); }
      else if (g === 'modal') openModal(t.dataset.m);
      else if (g === 'modal-x') closeModal();
      else if (g === 'bgm') { audio.toggle(); renderTools(); }
      else if (g === 'copy') { const n = S.notices[Number(t.dataset.i)]; if (n && n.code) opts.copy(n.code); }
      else if (g === 'copy-code') { const c = S.codes[Number(t.dataset.i)]; if (c) opts.copy(c.code); }
      else if (g === 'note-x') { S.notices.splice(Number(t.dataset.i), 1); renderNotices(); }
    });
    $('#gmModal').addEventListener('click', (e) => { if (e.target.id === 'gmModal') closeModal(); });
    $('#gmCg').addEventListener('click', closeCg);

    function onKey(e) {
      if (!document.body.contains(el)) return;
      if (/INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'Escape') { if (S.cg) closeCg(); else if (S.modal) closeModal(); return; }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); advance(); }
      else if (/^[1-4]$/.test(e.key) && $('#gmChoices').classList.contains('show')) { const c = S.choices[Number(e.key) - 1]; if (c) opts.fill(c); }
    }
    document.addEventListener('keydown', onKey);

    audio.onError = () => { S.bgmMissing = true; renderHud(); };

    // 처음 그리기
    applyTheme();
    setPlace();
    renderHud();
    renderTime();
    renderTools();
    runFx([]);
    $('#gmDlg').classList.add('nar');
    nameEl.style.display = 'none';
    textEl.textContent = '';
    setBackground(null);

    return {
      onReply,
      setPack(m) { pack = m; applyTheme(); renderHud(); renderTime(); renderTools(); },
      refreshTools: renderTools,
      destroy() { document.removeEventListener('keydown', onKey); stopTyping(); timers.forEach(clearTimeout); },
      state: S
    };
  }

  root.CrionGame = { mount };
})(window);
