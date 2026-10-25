// 플레이팩 실행기 — 「소환수 아카데미」 (runner: "academy")
//  크랙 화면(webview)은 뒤에 그대로 두고, 그 위에 '학생 수첩' 게임 화면을 그린다.
//  - 응답 읽기: crack-preload.js 가 보낸 crion:reply 조각 → pk-academy.js 로 해석
//  - 보내기: 플레이어가 '보내기'를 한 번 누르면 한 번만 보낸다. 선택지·전투 버튼은 입력창에 글을 채우기만 한다
//  - 팩을 끄거나 '크랙 화면'을 누르면 크랙 화면 그대로 보인다(폴백)
(function (root) {
  'use strict';
  const A = root.CrionAcademy;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssUrl = (u) => u ? `url('${String(u).replace(/['"\\\n<>]/g, (c) => encodeURIComponent(c))}')` : 'none';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pct = (a, b) => b ? clamp(Math.round(a / b * 100), 0, 100) : 0;
  const EL_ICON = { 화: '🔥', 수: '💧', 풍: '🍃', 지: '🪨', 빛: '✨', 어둠: '🌙', 무: '⚪' };
  const RAR_CLS = { 일반: 'r1', 희귀: 'r2', 영웅: 'r3', 전설: 'r4' };
  const FACE = { 웃음: '기쁨', 기쁨: '기쁨', 화남: '분노', 분노: '분노', 슬픔: '슬픔', 놀람: '당황', 부끄러움: '당황', 당황: '당황', 전투: '전투' };
  const TIMES = ['오전', '오후', '저녁', '밤'];
  const ITEM_ICON = { 상처약: '🧪', '고급 상처약': '💖', '해독·각성약': '🌿', 해독약: '🌿', 각성약: '🌿', 계약석: '🔷', '고급 계약석': '💠' };
  const SPEED = { slow: 42, normal: 24, fast: 10, instant: 0 };
  const CODEX_URL = 'https://hirion2312-art.github.io/hyerong.live.net/academy-codex/';

  function start(o) {
    const el = o.el;
    const files = o.files;
    const man = o.manifest || {};
    const data = o.data || {};
    const dex = new A.Dex(data);
    const theme = man.theme || {};
    const res = (p) => !p ? '' : files.has(p) ? p : files.has('assets/' + p) ? 'assets/' + p : '';
    const url = (p) => { const r = res(p); return r ? files.url(r) : ''; };
    const has = (p) => !!res(p);
    const KEY = 'crion.pk.' + o.pack.id;
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
    const M = Object.assign({ codex: {}, met: {}, badges: {}, placeImg: {}, log: [], status: null, prefs: {} }, load());
    M.prefs = Object.assign({ speed: 'normal', auto: false, vol: 55, music: true, fx: true }, M.prefs);
    let saveT = null;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { M.log = M.log.slice(-200); localStorage.setItem(KEY, JSON.stringify(M)); } catch (e) { /* 저장 안 됨 */ } }, 300); };

    const R = {
      status: M.status, battle: null, beats: [], i: -1, typing: null, waiting: false, sentAt: 0, page: 'chat', actions: [],
      hints: [], slots: [null, null, null], speaker: null, place: M.status && M.status.place, bgKey: '', cgTimer: null,
      overlays: [], overlayOn: false, crisis: false, lastKey: '', streaming: '', flip: {}, modal: null, partnerFace: {}
    };

    // ---------- 음악 ----------
    const bgm = root.CrionBgm ? new root.CrionBgm() : null;
    if (bgm) bgm.setVolume(M.prefs.vol / 100);
    let bgmId = '';
    function playBgm(id) {
      if (!bgm || !id || id === bgmId) return;
      const p = (man.bgm || {})[id];
      if (!p || !has(p)) return;
      bgmId = id;
      if (!M.prefs.music) return;
      bgm.play(url(p));
    }
    function placeBgm(place) {
      const map = man.bgmByLoc || {};
      for (const k of Object.keys(map)) if (place && place.replace(/\s/g, '').includes(k)) return map[k];
      return man.bgmDefault || 'academy';
    }

    // ---------- 뼈대 ----------
    el.innerHTML = `<div class="ak" style="--ak-accent:${esc(theme.accent || '#d9b25f')};--ak-bg:${esc(theme.bg || '#0e1432')};--ak-text:${esc(theme.text || '#f2e9d4')};--ak-sub:${esc(theme.textSub || '#a3abcc')}">
      <div class="ak-main">
        <section class="ak-stage" id="akStage">
          <div class="ak-bg"><i></i><i></i></div><div class="ak-tint"></div>
          <div class="ak-season"></div><div class="ak-fx"></div>
          <div class="ak-sprites"><div class="ak-sp" data-slot="0"></div><div class="ak-sp" data-slot="1"></div><div class="ak-sp" data-slot="2"></div></div>
          <div class="ak-place"><b></b><span></span></div>
          <div class="ak-battle" hidden></div>
          <div class="ak-cg" hidden><img alt=""></div>
          <div class="ak-dlg" data-ak="next">
            <div class="ak-name" hidden></div>
            <div class="ak-text"></div>
            <div class="ak-dlg-tools"><button data-ak="log" title="지난 대사">기록</button><button data-ak="auto" class="${M.prefs.auto ? 'on' : ''}" title="자동 진행">자동</button><button data-ak="skip" title="이번 응답 건너뛰기">넘기기</button></div>
            <i class="ak-next">▼</i>
          </div>
        </section>
        <aside class="ak-hud" id="akHud"></aside>
      </div>
      <footer class="ak-foot">
        <div class="ak-choices" id="akChoices"></div>
        <div class="ak-input">
          <textarea id="akIn" rows="1" placeholder="행동이나 대사를 적어 보세요 (Enter 보내기 · Shift+Enter 줄바꿈)"></textarea>
          <button class="ak-btn" data-ak="regen" title="크랙에서 다시 생성">다시</button>
          <button class="ak-btn primary" data-ak="send">보내기</button>
        </div>
        <div class="ak-time" id="akTime"></div>
      </footer>
      <div class="ak-banner" id="akBanner" hidden></div>
      <div class="ak-layer" id="akLayer"></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const stage = $('#akStage');

    // ---------- 배경 ----------
    let bgFlip = 0;
    function setBg(src) {
      if (!src || src === R.bgKey) return;
      R.bgKey = src;
      const layers = stage.querySelectorAll('.ak-bg i');
      const next = layers[bgFlip = 1 - bgFlip];
      const prev = layers[1 - bgFlip];
      next.style.backgroundImage = cssUrl(src);
      next.classList.add('on'); prev.classList.remove('on');
    }
    function bgFor(st, block) {
      const place = (st && st.place) || '';
      const key = place.replace(/\s/g, '').replace(/^에테르나/, '');
      const time = (st && st.time) || '';
      const tsuf = { 아침: '_아침', 오전: '', 오후: '', 점심: '', 저녁: '_저녁', 밤: '_밤', 새벽: '_밤' }[time] || '';
      const cand = [];
      if (block && block.bg) cand.push(`bg/${block.bg}.webp`);
      const alias = (man.bgAlias || {});
      const names = [key].concat(Object.keys(alias).filter(k => key.includes(k)).map(k => alias[k]));
      for (const n of names) { if (R.crisis) cand.push(`bg/${n}_위기.webp`); if (tsuf) cand.push(`bg/${n}${tsuf}.webp`); cand.push(`bg/${n}.webp`); }
      for (const c of cand) if (has(c)) return url(c);
      for (const n of names) if (M.placeImg[n]) return M.placeImg[n];
      return url(man.bgDefault || 'bg/hero.webp');
    }
    function tint(st) {
      const t = (st && st.time) || '';
      stage.dataset.time = { 오전: 'day', 아침: 'morning', 점심: 'day', 오후: 'noon', 저녁: 'dusk', 밤: 'night', 새벽: 'night' }[t] || 'day';
      stage.dataset.place = st && /흑일/.test(st.place + ' ' + (st.next && st.next.text || '')) && /흑일/.test(st.place || '') ? 'black' : '';
      const se = stage.querySelector('.ak-season');
      const season = st && st.season;
      se.className = 'ak-season ' + (M.prefs.fx ? ({ 봄: 'petals', 겨울: 'snow' }[season] || '') : '');
    }

    // ---------- 효과 ----------
    function fx(list) {
      if (!M.prefs.fx) return;
      const box = stage.querySelector('.ak-fx');
      for (const f of list || []) {
        if (!/^[a-z_]+$/.test(f)) continue;
        const i = document.createElement('i');
        i.className = 'fx-' + f;
        box.appendChild(i);
        if (f === 'shake' || f === 'glitch') { stage.classList.remove('shake', 'glitch'); void stage.offsetWidth; stage.classList.add(f); setTimeout(() => stage.classList.remove(f), 700); }
        setTimeout(() => i.remove(), { flash: 900, sparks: 2600, shake: 700, glitch: 900 }[f] || 6000);
      }
    }
    function setCrisis(on) {
      R.crisis = !!on;
      stage.classList.toggle('crisis', R.crisis && M.prefs.fx);
    }

    // ---------- 입화 (말하는 사람) ----------
    function speakerOf(who) {
      if (!who) return null;
      const p = dex.person(who);
      if (p) { M.met[p.name] = 1; return { key: 'P:' + p.name, name: who, img: has(p.img) ? url(p.img) : '', person: p }; }
      const st = R.status;
      const part = st && st.partners && st.partners.find(x => x.nick === who || x.base === who || x.formName === who);
      const f = part ? { lin: dex.lineage(part.base), stage: part.stage } : dex.find(who);
      if (f && f.lin) {
        const situ = R.partnerFace[f.lin.base] || (R.battle && !R.battle.over ? '전투' : '평상시');
        return { key: 'S:' + f.lin.base, name: who, img: summonImg(f.lin.base, f.stage, situ), summon: f.lin };
      }
      return { key: 'N:' + who, name: who, img: '' };
    }
    function summonImg(base, stage, situ) {
      const tries = [dex.imgKey(base, stage, situ || '평상시'), dex.imgKey(base, stage, '평상시')];
      for (const t of tries) if (has(t)) return url(t);
      return '';
    }
    function showSpeaker(sp) {
      const prev = R.speaker;
      R.speaker = sp;
      if (sp && sp.img) {
        let at = R.slots.findIndex(s => s && s.key === sp.key);
        if (at < 0) {
          at = R.slots.findIndex(s => !s);
          if (at < 0) at = R.slots.findIndex(s => s && (!prev || s.key !== prev.key));
          if (at < 0) at = 1;
          R.slots[at] = sp;
        } else R.slots[at] = sp;
      }
      stage.querySelectorAll('.ak-sp').forEach((box, i) => {
        const s = R.slots[i];
        if (!s) { box.innerHTML = ''; box.className = 'ak-sp'; return; }
        const want = `<div class="ak-card ${s.summon ? 'sm ' + (RAR_CLS[s.summon.rarity] || '') : ''}"><img src="${esc(s.img)}" alt=""><b>${esc(s.name)}</b></div>`;
        if (box.dataset.k !== s.key + s.img) { box.innerHTML = want; box.dataset.k = s.key + s.img; }
        box.className = 'ak-sp on' + (sp && s.key === sp.key ? ' talk' : (sp ? ' dim' : ''));
      });
    }
    function clearSprites() { R.slots = [null, null, null]; showSpeaker(null); }

    // ---------- 대사창 ----------
    function typeOut(text, done) {
      const box = stage.querySelector('.ak-text');
      clearInterval(R.typing && R.typing.t);
      const ms = SPEED[M.prefs.speed] == null ? 24 : SPEED[M.prefs.speed];
      if (!ms) { box.textContent = text; R.typing = null; done && done(); return; }
      let n = 0;
      box.textContent = '';
      R.typing = { text, done, t: setInterval(() => {
        n += 2;
        box.textContent = text.slice(0, n);
        if (n >= text.length) finishType();
      }, ms) };
    }
    function finishType() {
      if (!R.typing) return false;
      clearInterval(R.typing.t);
      stage.querySelector('.ak-text').textContent = R.typing.text;
      const d = R.typing.done; R.typing = null;
      if (d) d();
      return true;
    }
    let autoT = null;
    function showBeat(i) {
      R.i = i;
      const b = R.beats[i];
      const dlg = stage.querySelector('.ak-dlg');
      const nm = stage.querySelector('.ak-name');
      if (!b) { endBeats(); return; }
      if (b.kind === 'say') {
        const sp = speakerOf(b.who);
        if (sp && sp.summon && b.face && FACE[b.face]) { R.partnerFace[sp.summon.base] = FACE[b.face]; const s2 = speakerOf(b.who); showSpeaker(s2); } else showSpeaker(sp);
        nm.hidden = !b.who; nm.textContent = b.who || '';
        dlg.classList.add('say'); dlg.classList.remove('narr');
      } else {
        showSpeaker(null);
        nm.hidden = true;
        dlg.classList.remove('say'); dlg.classList.add('narr');
      }
      for (const im of b.imgs || []) if (im.src) noteImg(im);
      dlg.classList.remove('end');
      const text = (b.kind === 'say' ? '“' + b.text + '”' : b.text).replace(/\{user\}/g, (R.status && R.status.student) || '나');
      typeOut(text, () => {
        dlg.classList.add('ready');
        clearTimeout(autoT);
        if (M.prefs.auto) autoT = setTimeout(() => next(), 1200 + text.length * 25);
      });
      dlg.classList.remove('ready');
    }
    function next() {
      if (R.overlayOn) return;
      if (finishType()) return;
      clearTimeout(autoT);
      if (R.i < R.beats.length - 1) showBeat(R.i + 1);
      else endBeats();
    }
    function endBeats() {
      stage.querySelector('.ak-dlg').classList.add('end', 'ready');
      showSpeaker(R.speaker);
      renderChoices();
      flushOverlays('end');
    }
    function noteImg(im) {
      // 장소가 바뀐 응답의 첫 그림 = 그 장소 배경으로 기억 (메인 프롬프트: 장소 전환 시 배경 그림)
      if (R.placeChanged && R.place && !M.placeImg[R.place.replace(/\s/g, '')] && im.w >= im.h) {
        M.placeImg[R.place.replace(/\s/g, '')] = im.src; R.placeChanged = false;
        setBg(bgFor(R.status, null)); save();
      }
    }

    // ---------- HUD (학생 수첩) ----------
    const gauge = (cur, max, cls) => `<div class="ak-gauge ${cls || ''}"><i style="width:${pct(cur, max)}%"></i><span>${cur == null ? '-' : cur}/${max == null ? '-' : max}</span></div>`;
    function partnerCard(p, i) {
      const lin = dex.lineage(p.base);
      const battleSitu = R.battle && !R.battle.over && R.battle.ally && (R.battle.ally.base === p.base) ? '전투' : '';
      const situ = battleSitu || R.partnerFace[p.base] || (p.hpMax && p.hp / p.hpMax <= 0.3 ? '슬픔' : '평상시');
      const img = summonImg(p.base, p.stage || 1, situ);
      const low = p.hpMax && p.hp / p.hpMax <= 0.3;
      const statMax = 200;
      const st = p.stats || {};
      const flipped = R.flip[p.base + i];
      return `<button class="ak-pc ${RAR_CLS[p.rarity] || 'r1'} ${flipped ? 'flip' : ''} ${low ? 'low' : ''}" data-ak="flip" data-k="${esc(p.base + i)}" style="--el:${esc((theme.elements || {})[p.el] || '#c9ced9')}">
        <div class="ak-pc-in">
          <div class="ak-pc-front">
            <div class="ak-pc-img" style="background-image:${cssUrl(img)}"></div>
            <div class="ak-pc-meta"><b>${esc(p.nick)}</b><span>${p.formName && p.formName !== p.nick ? esc(p.formName) + ' · ' : ''}${esc(p.stageName || '')}</span>
              <em class="lv">Lv ${p.lv || '-'}</em></div>
            <div class="ak-pc-tags"><i class="el">${EL_ICON[p.el] || ''}${esc(p.el || '')}</i>${p.rarity ? `<i>${esc(p.rarity)}</i>` : ''}${p.ailment ? `<i class="bad">${esc(p.ailment)}</i>` : ''}</div>
            ${gauge(p.hp, p.hpMax, 'hp')}${gauge(p.xp, p.xpMax, 'xp')}
          </div>
          <div class="ak-pc-back">
            <div class="ak-stats">${[['공격', st.atk], ['방어', st.def], ['특공', st.spa], ['특방', st.spd], ['속도', st.spe]].map(([k, v]) => `<div><span>${k}</span><i><b style="width:${pct(v || 0, statMax)}%"></b></i><em>${v == null ? '-' : v}</em></div>`).join('')}</div>
            <div class="ak-skills">${(p.skills || []).map(s => `<div class="${s.left === 0 ? 'out' : ''}"><i>${esc(s.icon)}</i><b>${esc(s.name)}</b><span>${s.power ? esc(s.power) + ' · ' : ''}${s.left}/${s.max}</span>${s.eff ? `<small>${esc(s.eff)}</small>` : ''}</div>`).join('') || '<p>기술 정보 없음</p>'}</div>
            ${lin && lin.quote ? `<q>${esc(lin.quote)}</q>` : ''}
          </div>
        </div></button>`;
    }
    function renderHud() {
      const st = R.status || {};
      const box = $('#akHud');
      const dorm = st.dorm || '';
      const dormIc = /해/.test(dorm) ? '☀️' : /달/.test(dorm) ? '🌙' : /별/.test(dorm) ? '⭐' : '🏫';
      const money = st.money || {};
      const nBadges = Object.keys(M.badges).length;
      const badgeN = Math.max(nBadges, (st.badges && st.badges.n) || 0);
      const codexN = Object.keys(M.codex).length;
      const dexN = (st.dex && st.dex.n) || codexN;
      const items = st.items || [];
      box.innerHTML = `
        <div class="ak-id">
          <div class="ak-id-ic">${dormIc}</div>
          <div><span>에테르나 아카데미 학생증</span><b>${esc(st.student && !/\{user\}/.test(st.student) ? st.student : '신입생')}</b><em>${esc(st.year ? st.year + '학년' : '1학년')} · ${esc(dorm || '기숙사 배정 전')}</em></div>
          <div class="ak-money"><b>${money.gold ? money.gold + '<small>금</small> ' : ''}${money.silver == null ? '-' : money.silver}<small>은</small></b><span>${money.copper == null ? '-' : money.copper}<small>동</small></span></div>
        </div>
        <div class="ak-partners">${(st.partners || []).length ? st.partners.map(partnerCard).join('') : '<div class="ak-empty">아직 파트너가 없어요.<br>소환의 제단에서 첫 파트너를 만나 보세요.</div>'}</div>
        <div class="ak-row3">
          <button data-ak="m-dex"><div class="ak-ring" style="--p:${pct(dexN, 80)}"><b>${dexN}</b></div><span>도감 /80</span></button>
          <button data-ak="m-badge"><div class="ak-bdots">${Array.from({ length: 7 }, (_, i) => `<i class="${i < badgeN ? 'on' : ''}"></i>`).join('')}</div><span>배지 ${badgeN}/7</span></button>
          <button data-ak="m-bag"><b class="ak-big">${st.contract ? st.contract.n + '<small>/' + st.contract.max + '</small>' : '-'}</b><span>계약</span></button>
        </div>
        <div class="ak-items">${items.length ? items.map(it => `<i title="${esc(it.name)}">${ITEM_ICON[it.name] || '🎁'}<b>${esc(it.name)}</b>${it.n > 1 ? `<em>×${it.n}</em>` : ''}</i>`).join('') : '<span class="ak-muted">주머니가 비어 있어요</span>'}</div>
        <div class="ak-notes">
          <div class="ak-note"><b>📜 의뢰</b><span>${st.quests && st.quests.length ? st.quests.map(esc).join('<br>') : '진행 중인 의뢰 없음'}</span></div>
          <div class="ak-note"><b>🗓️ 다음 일정</b><span>${st.next ? esc(st.next.text || '-') + (st.next.d != null ? ` <em class="dday">D-${st.next.d}</em>` : '') : '-'}</span></div>
        </div>
        <nav class="ak-menu">
          <button data-ak="m-dex">📖<span>도감</span></button><button data-ak="m-people">👥<span>인물</span></button><button data-ak="m-map">🗺️<span>지도</span></button>
          <button data-ak="m-bag">🎒<span>주머니</span></button><button data-ak="m-badge">🏅<span>배지</span></button><button data-ak="m-set">⚙️<span>설정</span></button>
        </nav>`;
      // 시간표 띠
      const tb = $('#akTime');
      const t = st.time === '아침' ? '오전' : st.time === '점심' ? '오후' : st.time === '새벽' ? '밤' : st.time;
      tb.innerHTML = `${TIMES.map(x => `<i class="${x === t ? 'on' : ''}">${{ 오전: '☀', 오후: '◐', 저녁: '☾', 밤: '✦' }[x]} ${x}</i>`).join('')}
        <b>${st.year ? esc(st.year + '학년 ' + (st.season || '') + ' ' + st.day + '일차') : esc(st.dateText || '에테르나 아카데미')}</b>
        <span class="ak-season-tag">${{ 봄: '🌸 봄', 여름: '🌿 여름', 가을: '🍁 가을', 겨울: '❄️ 겨울' }[st.season] || ''}</span>`;
      const pl = stage.querySelector('.ak-place');
      pl.querySelector('b').textContent = st.place || '에테르나';
      pl.querySelector('span').textContent = st.time || '';
    }

    // ---------- 선택지 · 전투 버튼 ----------
    function fill(text) {
      const ta = $('#akIn');
      ta.value = text;
      ta.focus();
      ta.setSelectionRange(text.length, text.length);
      autosize();
      el.querySelectorAll('.ak-choices button').forEach(b => b.classList.toggle('picked', b.dataset.fill === text));
    }
    function battleActions() {
      const b = R.battle;
      if (!b || b.over || !b.ally) return '';
      const st = R.status || {};
      const me = (st.partners || []).find(p => p.base === b.ally.base) || (st.partners || [])[0] || {};
      const nick = me.nick || b.ally.name;
      const skills = (me.skills || []).map(s => {
        const pp = (b.pp || []).find(x => x.name === s.name);
        return Object.assign({}, s, pp ? { left: pp.left, max: pp.max } : {});
      });
      const eff = b.enemy && b.enemy.el && me.el ? dex.mult(me.el, b.enemy.el) : 1;
      const items = st.items || [];
      const hasItem = (n) => items.some(x => x.name === n && x.n > 0);
      const others = (st.partners || []).filter(p => p.base !== me.base && p.hp > 0);
      const btn = (text, label, sub, cls, dis) => `<button class="ak-act ${cls || ''}" data-ak="fill" data-fill="${esc(text)}" ${dis ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`;
      let h = skills.map(s => btn(`${nick}, ${s.name}!`, `<i>${esc(s.icon)}</i>${esc(s.name)}`, `${s.power ? '위력 ' + esc(s.power) + ' · ' : ''}${s.left}/${s.max}${s.kind !== '보조' && eff > 1 ? ' · 효과 굉장' : s.kind !== '보조' && eff < 1 ? ' · 효과 별로' : ''}`, 'skill ' + (s.kind !== '보조' && eff > 1 ? 'good' : s.kind !== '보조' && eff < 1 ? 'weak' : ''), s.left === 0)).join('');
      h += btn(`${nick}, 방어해!`, '🛡️ 방어', '받는 피해 절반');
      for (const p of others) h += btn(`${p.nick}(으)로 교체한다`, '🔁 ' + esc(p.nick), '교체 · 행동 1회');
      if (hasItem('상처약')) h += btn(`${nick}에게 상처약을 쓴다`, '🧪 상처약', 'HP 30%');
      if (hasItem('고급 상처약')) h += btn(`${nick}에게 고급 상처약을 쓴다`, '💖 고급 상처약', 'HP 전회복');
      if (b.enemy && b.enemy.wild && (hasItem('계약석') || hasItem('고급 계약석'))) {
        const hi = hasItem('고급 계약석') && !hasItem('계약석');
        const rate = b.enemy.rarity ? dex.capture(b.enemy.rarity, b.enemy.hpMax ? b.enemy.hp / b.enemy.hpMax : 1, { ailment: !!b.enemy.ailment, hi }) : null;
        h += btn(hi ? '고급 계약석을 던진다' : '계약석을 던진다', '🔷 계약석', rate == null ? '상대 HP 30% 이하에서' : `성공 약 ${rate}%`, 'cap', rate == null);
      }
      if (b.enemy && b.enemy.wild) h += btn('도망친다', '🏃 도망', '성공 50%');
      return `<div class="ak-acts">${h}</div>`;
    }
    function renderChoices() {
      const box = $('#akChoices');
      const acts = battleActions();
      const hints = R.hints || [];
      box.innerHTML = acts + (hints.length ? `<div class="ak-hints">${hints.map(hn => `<button data-ak="fill" data-fill="${esc(hn)}"><i>💡</i>${esc(hn)}</button>`).join('')}</div>` : '');
      box.classList.toggle('has', !!(acts || hints.length));
    }

    // ---------- 전투 패널 ----------
    function sideHtml(s, cls) {
      if (!s) return '';
      const img = s.base ? summonImg(s.base, s.stage || 1, '전투') : '';
      const low = s.hpMax && s.hp / s.hpMax <= 0.3;
      return `<div class="ak-bs ${cls} ${RAR_CLS[s.rarity] || ''} ${low ? 'low' : ''} ${s.hp <= 0 ? 'down' : ''}" style="--el:${esc((theme.elements || {})[s.el] || '#c9ced9')}">
        <div class="ak-bs-img" style="background-image:${cssUrl(img)}">${img ? '' : '<span>?</span>'}</div>
        <div class="ak-bs-meta"><b>${esc(s.formName && !s.name.includes(s.formName) ? s.name : s.name)}</b><em>Lv ${s.lv}</em>${s.el ? `<i>${EL_ICON[s.el] || ''}${esc(s.el)}</i>` : ''}${s.rarity ? `<i>${esc(s.rarity)}</i>` : ''}${s.ailment ? `<i class="bad">${esc(s.ailment)}</i>` : ''}</div>
        ${gauge(s.hp, s.hpMax, 'hp big')}
      </div>`;
    }
    function renderBattle(fresh) {
      const box = stage.querySelector('.ak-battle');
      const b = R.battle;
      stage.classList.toggle('in-battle', !!b);
      if (!b) { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      const multTag = b.mult > 1 ? '<span class="good">상성 유리 ×1.5</span>' : b.mult < 1 ? '<span class="weak">상성 불리 ×0.5</span>' : '<span>상성 보통</span>';
      box.innerHTML = `<div class="ak-bt-row">${sideHtml(b.ally, 'ally')}<div class="ak-vs"><b>VS</b>${multTag}${b.enemy && b.enemy.wild ? '<em>야생</em>' : ''}</div>${sideHtml(b.enemy, 'foe')}</div>
        <div class="ak-blog">${(b.log || []).map(x => `<div><b>${esc(x.act)}</b>${x.dmg != null ? `<em>-${x.dmg}</em>` : ''}${x.note ? `<span class="${/굉장/.test(x.note) ? 'good' : /별로/.test(x.note) ? 'weak' : ''}">${esc(x.note)}</span>` : ''}</div>`).join('')}</div>
        ${b.over ? `<div class="ak-bover">${b.enemy && b.enemy.hp <= 0 ? '승리!' : '쓰러졌다…'}</div>` : ''}`;
      if (fresh) {
        (b.log || []).forEach((x, i) => {
          if (x.dmg == null) return;
          const f = document.createElement('div');
          f.className = 'ak-dmg ' + (i === 0 ? 'to-foe' : 'to-ally');
          f.textContent = '-' + x.dmg;
          box.appendChild(f);
          setTimeout(() => f.remove(), 1600);
        });
        if ((b.log || []).some(x => /굉장/.test(x.note))) fx(['flash', 'shake']);
        else if ((b.log || []).some(x => x.dmg)) fx(['shake']);
        if ((b.log || []).some(x => /별로/.test(x.note))) fx(['dim']);
      }
    }

    // ---------- 도감 기록 ----------
    function markCodex(base, stage, mode, code) {
      const no = dex.no(base, stage);
      if (!no) return false;
      const cur = M.codex[no];
      if (cur && (cur.m === 'C' || mode === 'S')) return false;
      M.codex[no] = { m: mode, base, stage, code: code || `AC·${base}·${stage}${mode}`, at: Date.now() };
      return true;
    }

    // ---------- 연출 겹창 (소환 · 진화 · 배지) ----------
    function queue(ov, when) { R.overlays.push(Object.assign({ when: when || 'start' }, ov)); }
    function flushOverlays(when) {
      if (R.overlayOn) return;
      const k = R.overlays.findIndex(x => x.when === when);
      if (k < 0) return;
      const ov = R.overlays.splice(k, 1)[0];
      R.overlayOn = true;
      const lay = $('#akLayer');
      lay.innerHTML = `<div class="ak-ov ${esc(ov.cls || '')}" data-ak="ov-close">${ov.html}</div>`;
      if (ov.fx) fx(ov.fx);
      if (ov.bgm) playBgm(ov.bgm);
    }
    function closeOverlay() {
      $('#akLayer').innerHTML = '';
      R.overlayOn = false;
      if (R.overlays.some(x => x.when === 'start')) return flushOverlays('start');
      if (R.i < 0 && R.beats.length) showBeat(0);
      else if (R.i >= R.beats.length - 1) flushOverlays('end');
    }
    function summonOverlay(p, well, code, how) {
      const lin = dex.lineage(p.base) || {};
      const img = summonImg(p.base, p.stage || 1, '기쁨') || summonImg(p.base, p.stage || 1, '평상시');
      const ring = well ? ({ 일반: 'silver', 희귀: 'blue', 영웅: 'gold' }[lin.rarity] || 'silver') : 'seven';
      return { cls: 'summon ring-' + ring, fx: ['flash'], html: `
        <div class="ak-circle"><i></i><i></i><i></i></div>
        <div class="ak-reveal ${RAR_CLS[lin.rarity] || ''}" style="--el:${esc((theme.elements || {})[lin.el] || '#fff')}">
          <span class="ak-rv-top">${well ? '별의 우물에서 누군가 나타났다!' : how === 'join' ? '새로운 동료가 생겼다!' : '소환진 너머에서 누군가 나타났다!'}</span>
          <div class="ak-rv-img" style="background-image:${cssUrl(img)}"></div>
          <b>${esc(p.formName || p.nick)}</b>
          <em>${EL_ICON[lin.el] || ''} ${esc(lin.el || '')} · ${esc(lin.rarity || '')} · ${esc(lin.species || '')} ${esc(lin.sex || '')}</em>
          ${lin.quote ? `<q>${esc(lin.quote)}</q>` : ''}
          <div class="ak-rv-btns">${code ? `<button class="ak-btn" data-ak="copy" data-text="${esc(code)}">🔑 ${esc(code)} 복사</button>` : ''}<button class="ak-btn primary" data-ak="ov-close">함께하기</button></div>
        </div>` };
    }
    function evolveOverlay(p, from) {
      const lin = dex.lineage(p.base) || {};
      const a = summonImg(p.base, from.stage || 1, '평상시');
      const b = summonImg(p.base, p.stage, '기쁨') || summonImg(p.base, p.stage, '평상시');
      const fromName = (lin.names || [])[(from.stage || 1) - 1] || from.nick;
      return { cls: 'evolve', fx: ['flash', 'sparks'], bgm: (man.bgm || {}).evolve ? 'evolve' : '', html: `
        <div class="ak-evo"><div class="ak-evo-a" style="background-image:${cssUrl(a)}"></div><div class="ak-evo-glow"></div><div class="ak-evo-b ${RAR_CLS[lin.rarity] || ''}" style="background-image:${cssUrl(b)}"></div></div>
        <div class="ak-evo-t"><span>빛 속에서 모습이 바뀐다…</span><b>${esc(fromName)} → ${esc(p.formName)}</b><em>${p.stage === 3 ? '최종 진화' : '1차 진화'} · Lv ${p.lv}</em>
        <button class="ak-btn primary" data-ak="ov-close">계속</button></div>` };
    }
    function badgeOverlay(prof) {
      const b = (data.badges || []).find(x => x.prof === prof || (prof === '학장' && x.id === 'master'));
      if (!b) return null;
      return { cls: 'badge', fx: ['sparks', 'flash'], html: `
        <div class="ak-badge-rv"><div class="ak-badge-img" style="background-image:${cssUrl(url(b.img))}"></div>
        <span>${esc(b.prof)} 교수에게 인정받았다!</span><b>🏅 ${esc(b.badge)} ${b.id === 'master' ? '' : '배지'}</b>
        <button class="ak-btn" data-ak="copy" data-text="BG·${esc(b.prof === '오스왈드' ? '학장' : b.prof)}">🔑 BG·${esc(b.prof === '오스왈드' ? '학장' : b.prof)} 복사</button>
        <button class="ak-btn primary" data-ak="ov-close">확인</button></div>` };
    }

    // ---------- 응답 처리 ----------
    function handle(segs) {
      const names = ((R.status && R.status.partners) || []).map(p => p.nick);
      const r = A.parse(segs, dex, { names });
      const prev = R.status;
      if (r.status) {
        const ev = A.events(prev, r.status, r.codes, dex);
        R.placeChanged = !!(r.status.place && (!prev || prev.place !== r.status.place));
        if (R.placeChanged) clearSprites();
        R.status = r.status; M.status = r.status; R.place = r.status.place;
        for (const p of r.status.partners) markCodex(p.base, p.stage || 1, 'C');
        const wellish = /우물/.test((r.status.place || '') + ' ' + segs.map(s => s.s || '').join(' ').slice(0, 400));
        for (const e of ev) {
          const code = (r.codes.find(c => c.kind === 'dex' && c.base === e.partner?.base) || {}).code;
          if (e.type === 'new') queue(summonOverlay(e.partner, wellish, code, prev && prev.partners && prev.partners.length ? 'join' : 'first'));
          if (e.type === 'evolve') queue(evolveOverlay(e.partner, e.from));
          if (e.type === 'level') o.toast(`${e.partner.nick} 레벨 업! Lv ${e.from.lv} → ${e.partner.lv}`);
        }
        if (!prev && r.status.partners.length && r.codes.some(c => c.kind === 'dex' && c.mode === 'C')) {
          const p = r.status.partners[0];
          queue(summonOverlay(p, wellish, (r.codes.find(c => c.base === p.base) || {}).code));
        }
      }
      for (const c of r.codes) {
        if (c.kind === 'dex') { if (markCodex(c.base, c.stage, c.mode, c.code)) o.toast(`📖 도감 ${c.mode === 'C' ? '등록' : '목격'}: ${((dex.lineage(c.base) || {}).names || [])[c.stage - 1] || c.base}`, 3200); }
        if (c.kind === 'badge') {
          const k = c.prof === '학장' ? '오스왈드' : c.prof;
          if (!M.badges[k]) { M.badges[k] = Date.now(); const ov = badgeOverlay(k); if (ov) queue(ov, 'end'); }
        }
      }
      // 인물: 글에 이름이 나온 사람은 '만난 사람'
      const all = segs.map(s => s.s || '').join('\n');
      for (const p of data.people || []) if (all.includes(p.name)) M.met[p.name] = 1;
      // 전투
      R.battle = r.battle || null;
      if (R.battle && R.battle.enemy && R.battle.enemy.base && markCodex(R.battle.enemy.base, R.battle.enemy.stage || 1, 'S')) o.toast(`📖 도감 목격: ${R.battle.enemy.formName || R.battle.enemy.base}`, 2600);
      const ally = R.battle && R.battle.ally;
      const sp = R.status && R.status.partners && R.status.partners[0];
      setCrisis((ally && ally.hpMax && ally.hp / ally.hpMax <= 0.3 && ally.hp > 0) || (sp && sp.hpMax && sp.hp / sp.hpMax <= 0.3 && !R.battle));
      // 배경·음악·효과
      tint(R.status);
      setBg(bgFor(R.status, r.block));
      const blk = r.block || {};
      if (blk.bgm) playBgm(blk.bgm);
      else if (R.battle && !R.battle.over) playBgm((man.bgm || {}).wild_battle && R.battle.enemy && R.battle.enemy.wild ? 'wild_battle' : (man.battleBgm || 'rival'));
      else playBgm(placeBgm(R.place));
      const f = (blk.fx || []).slice();
      if (R.crisis && !f.includes('heartbeat')) f.push('heartbeat');
      if (R.status && /흑일/.test(R.status.place || '')) f.push('vignette_dark');
      fx(f);
      if (blk.cg && (man.cg || {})[blk.cg]) showCg(url(man.cg[blk.cg]));
      renderBattle(true);
      // 장면
      R.hints = r.hints;
      R.beats = r.beats.filter(b => b.text);
      if (!R.beats.length) R.beats = [{ kind: 'narr', text: '…' }];
      M.log = M.log.concat(R.beats.map(b => ({ who: b.who || '', t: b.text }))).slice(-200);
      R.i = -1;
      $('#akChoices').innerHTML = '';
      renderHud();
      save();
      if (R.overlays.some(x => x.when === 'start')) flushOverlays('start');
      else showBeat(0);
    }
    function showCg(src) {
      const c = stage.querySelector('.ak-cg');
      c.querySelector('img').src = src;
      c.hidden = false;
      clearTimeout(R.cgTimer);
      R.cgTimer = setTimeout(() => { c.hidden = true; }, 6500);
    }

    // ---------- 보내기 ----------
    function autosize() { const ta = $('#akIn'); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
    function doSend() {
      const ta = $('#akIn');
      const text = ta.value.trim();
      if (!text || R.waiting) return;
      if (R.page !== 'chat') { o.toast('대화 화면이 열린 뒤에 보낼 수 있어요'); return; }
      R.waiting = true; R.sentAt = Date.now();
      M.log.push({ who: '나', t: text, me: true });
      o.send(text);
      ta.value = ''; autosize();
      waitingUi(true);
    }
    function waitingUi(on, preview) {
      el.classList.toggle('ak-wait', !!on);
      if (on) {
        const box = stage.querySelector('.ak-text');
        stage.querySelector('.ak-name').hidden = true;
        stage.querySelector('.ak-dlg').classList.remove('ready', 'end');
        box.innerHTML = `<span class="ak-quill">✒️ 이야기를 쓰는 중이에요<i>.</i><i>.</i><i>.</i></span>${preview ? `<small class="ak-stream">${esc(preview.slice(-140))}</small>` : ''}`;
        $('#akChoices').innerHTML = '';
      }
    }
    let waitT = setInterval(() => {
      if (R.waiting && Date.now() - R.sentAt > 45000) banner('slow');
    }, 5000);

    // ---------- 안내 띠 ----------
    function banner(kind) {
      const b = $('#akBanner');
      if (!kind) { b.hidden = true; b.innerHTML = ''; b.className = 'ak-banner'; return; }
      if (kind === 'detail') {
        b.hidden = false;
        b.className = 'ak-banner center';
        b.innerHTML = `<div class="ak-gate"><b>작품 소개 화면이에요</b><span>대화를 열면 학생 수첩 화면으로 플레이해요.</span>
          <div class="row">${(R.actions || []).map(a => `<button class="ak-btn ${a.kind === 'continue' ? 'primary' : ''}" data-ak="click" data-id="${a.id}">${esc(a.label)}</button>`).join('')}<button class="ak-btn" data-ak="crack">크랙 화면 보기</button></div></div>`;
      } else if (kind === 'other') {
        b.hidden = false; b.className = 'ak-banner center';
        b.innerHTML = `<div class="ak-gate"><b>대화 화면이 아니에요</b><span>크랙 화면에서 작품의 대화를 열어 주세요. (로그인·작품 페이지 등)</span><div class="row"><button class="ak-btn primary" data-ak="crack">크랙 화면 보기</button></div></div>`;
      } else if (kind === 'slow') {
        b.hidden = false; b.className = 'ak-banner';
        b.innerHTML = `<span>응답을 아직 못 읽었어요. 크랙에서 답이 왔는지 확인해 보세요.</span><button class="ak-btn" data-ak="crack">크랙 화면 보기</button><button class="ak-btn" data-ak="diag">화면 진단 복사</button><button class="ak-btn" data-ak="unwait">닫기</button>`;
      }
    }

    // ---------- 모달 ----------
    function modal(title, body, cls) {
      R.modal = title;
      $('#akLayer').innerHTML = `<div class="ak-scrim" data-ak="m-close"><div class="ak-modal ${cls || ''}"><header><h3>${title}</h3><button data-ak="m-close" class="ak-x">✕</button></header><div class="ak-mbody">${body}</div></div></div>`;
    }
    let dexTab = '전체', dexSel = 0;
    function codexHtml() {
      const all = (data.lineages || []).concat(data.legends || []);
      const tabs = ['전체'].concat(data.elements || []).concat(['전설']);
      const cells = [];
      for (const l of all) {
        if (dexTab !== '전체' && !(dexTab === '전설' ? l.legend : (!l.legend && l.el === dexTab))) continue;
        const n = l.legend ? 1 : 3;
        for (let s = 1; s <= n; s++) {
          const no = dex.no(l.base, l.legend ? 3 : s);
          const m = M.codex[no];
          const img = summonImg(l.base, l.legend ? 3 : s, '평상시');
          cells.push(`<button class="ak-dc ${m ? (m.m === 'C' ? 'c' : 's') : 'u'} ${RAR_CLS[l.rarity]} ${dexSel === no ? 'sel' : ''}" data-ak="dex-sel" data-no="${no}" style="--el:${esc((theme.elements || {})[l.el] || '#ccc')}">
            <span class="no">No.${String(no).padStart(2, '0')}</span>
            <div class="im" style="background-image:${m ? cssUrl(img) : 'none'}">${m ? '' : '?'}</div>
            <b>${m ? esc((l.names || [])[l.legend ? 0 : s - 1]) : '???'}</b></button>`);
        }
      }
      const got = Object.values(M.codex).filter(x => x.m === 'C').length, seen = Object.values(M.codex).filter(x => x.m === 'S').length;
      return `<div class="ak-dex">
        <div class="ak-dex-top"><div class="ak-ring big" style="--p:${pct(got + seen, 80)}"><b>${got + seen}</b><small>/80</small></div>
          <div><b>에테르나 도감</b><span>확인 ${got} · 목격 ${seen} · 300년 동안 아무도 완성하지 못한 도감</span>
          <div class="row"><button class="ak-btn" data-ak="dex-copyall">🔑 코드 모두 복사</button><button class="ak-btn" data-ak="open" data-url="${CODEX_URL}">도감 사이트 열기</button></div></div></div>
        <nav class="ak-tabs">${tabs.map(t => `<button class="${t === dexTab ? 'on' : ''}" data-ak="dex-tab" data-v="${esc(t)}">${EL_ICON[t] || ''}${esc(t)}</button>`).join('')}</nav>
        <div class="ak-dex-body"><div class="ak-dgrid">${cells.join('')}</div><div class="ak-ddetail">${dexDetail(dexSel)}</div></div></div>`;
    }
    function dexDetail(no) {
      if (!no) return '<p class="ak-muted">칸을 누르면 자세히 볼 수 있어요.<br>계약·진화로 확인하면 모든 정보가, 목격만 하면 이름만 열려요.</p>';
      const all = (data.lineages || []).concat(data.legends || []);
      const l = all.find(x => x.legend ? x.no === no : no >= x.no && no < x.no + 3);
      if (!l) return '';
      const s = l.legend ? 3 : no - l.no + 1;
      const m = M.codex[no];
      if (!m) return `<div class="ak-dd u"><span class="no">No.${String(no).padStart(2, '0')}</span><b>???</b><p>아직 만나지 못한 소환수예요.${l.legend ? '' : ` 속성: ${EL_ICON[l.el]} ${esc(l.el)}`}</p>${hab(l) ? `<p class="hab">📍 ${esc(hab(l))}</p>` : ''}</div>`;
      const full = m.m === 'C';
      const st = l.stats || [];
      const mult = [1, 1.2, 1.4][s - 1];
      const stages = (l.names || []).map((n, i) => {
        const k = dex.no(l.base, l.legend ? 3 : i + 1);
        const mm = M.codex[k];
        return `<div class="${mm ? '' : 'u'} ${i + 1 === s ? 'on' : ''}"><i style="background-image:${mm ? cssUrl(summonImg(l.base, l.legend ? 3 : i + 1, '평상시')) : 'none'}"></i><span>${mm ? esc(n) : '???'}</span></div>`;
      }).join('<em>→</em>');
      return `<div class="ak-dd ${full ? '' : 's'}">
        <div class="ak-dd-img ${RAR_CLS[l.rarity]}" style="background-image:${cssUrl(summonImg(l.base, s, '평상시'))};--el:${esc((theme.elements || {})[l.el] || '#ccc')}"></div>
        <span class="no">No.${String(no).padStart(2, '0')} · ${full ? '확인' : '목격'}</span>
        <b>${esc((l.names || [])[l.legend ? 0 : s - 1])}</b>
        <div class="tags"><i>${EL_ICON[l.el]} ${esc(l.el)}</i><i>${esc(l.rarity)}</i>${full && l.role ? `<i>${esc(l.role)}</i>` : ''}${full && l.species ? `<i>${esc(l.species)} ${esc(l.sex || '')}</i>` : ''}</div>
        ${l.legend ? '' : `<div class="ak-evochain">${stages}</div>`}
        ${full ? `${l.desc ? `<p>${esc(l.desc)}</p>` : ''}${l.quote ? `<q>${esc(l.quote)}</q>` : ''}
          ${st.length ? `<h5>기본 능력치 ${s > 1 ? `(× ${mult} ${s === 2 ? '1진화' : '최종'})` : ''}</h5><div class="ak-stats">${['HP', '공격', '방어', '특공', '특방', '속도'].map((k, i) => { const v = Math.floor(st[i] * mult); return `<div><span>${k}</span><i><b style="width:${pct(v, 180)}%"></b></i><em>${v}</em></div>`; }).join('')}</div>` : ''}
          ${l.skills ? `<h5>고유기</h5><div class="ak-dskills">${[1, 2, 3].filter(k => k <= s).map(k => (l.skills[k] || []).map(x => `<div><i>${{ 물리: '⚔️', 특수: '💫', 보조: '✨' }[x.kind]}</i><b>${esc(x.name)}</b><span>${x.power ? '위력 ' + esc(x.power) + ' · ' : ''}${x.pp}회${x.eff ? ' · ' + esc(x.eff) : ''}</span><em>${['', '기본', '1진화', '최종'][k]}</em></div>`).join('')).join('')}</div>` : ''}`
        : '<p class="ak-muted">목격만 했어요. 계약하거나 진화시키면 자세한 정보가 열려요.</p>'}
        ${hab(l) ? `<p class="hab">📍 서식지: ${esc(hab(l))}</p>` : ''}
        <button class="ak-btn" data-ak="copy" data-text="${esc(m.code)}">🔑 ${esc(m.code)} 복사</button>
      </div>`;
    }
    function hab(l) {
      const t = String(data.regions || '');
      for (const seg of t.split(/\.\s*/)) { const m = /^\s*([^:]+?)\(([^)]+)\)\s*:\s*(.+)$/.exec(seg); if (m && m[3].split(/\s*,\s*/).includes(l.base)) return m[1].trim(); }
      return '';
    }
    function peopleHtml() {
      const groups = ['동기', '선배', '교수'];
      return groups.map(g => `<h4 class="ak-h4">${g}</h4><div class="ak-pgrid">${(data.people || []).filter(p => p.group === g).map(p => {
        const met = !!M.met[p.name];
        return `<div class="ak-pp ${met ? '' : 'u'}"><div class="im" style="background-image:${cssUrl(has(p.img) ? url(p.img) : '')}"></div><b>${met ? esc(p.full) : '???'}</b><span>${met ? esc(p.role) : '아직 만나지 않았어요'}</span>${met && p.quote ? `<q>${esc(p.quote)}</q>` : ''}</div>`;
      }).join('')}</div>`).join('') + '<p class="ak-muted">호감도는 숫자로 보이지 않아요. 대사의 온도로 느껴 보세요.</p>';
    }
    const PINS = [['소환의 제단', 50, 42, '소환의제단'], ['대투기장', 66, 56, '대투기장'], ['의뢰 게시판', 40, 58, '의뢰게시판'], ['기술 공방', 33, 46, '기술공방'], ['별의 우물', 58, 30, '별의우물'], ['도감 회랑', 46, 30, '도감회랑'], ['명예의 전당', 54, 22, '명예의전당'], ['보건실', 61, 44, '보건실'], ['시가지 상점가', 42, 68, '시가지']];
    const REG = [['잿불 화구', 18, 30, '화'], ['천년 서고 폐허', 22, 62, '화·어둠'], ['청람 호수·서리숲', 80, 70, '수'], ['풍차 고원·구름 절벽', 82, 26, '풍'], ['수정 협곡·버섯숲', 16, 80, '지'], ['유리 성당 언덕', 70, 14, '빛'], ['황혼 묘원', 86, 50, '어둠'], ['심연의 균열(금지)', 50, 6, '금지'], ['빛의 성역(금지)', 30, 10, '금지']];
    function mapHtml() {
      const here = ((R.status && R.status.place) || '').replace(/\s/g, '');
      return `<div class="ak-map"><div class="ak-island">
        ${PINS.map(([n, x, y, k]) => `<div class="pin ${here.includes(k) || here.includes(n.replace(/\s/g, '')) ? 'here' : ''}" style="left:${x}%;top:${y}%"><i>📍</i><span>${esc(n)}</span></div>`).join('')}
        ${REG.map(([n, x, y, e]) => `<div class="reg ${e === '금지' ? 'ban' : ''}" style="left:${x}%;top:${y}%"><b>${esc(n)}</b><span>${esc(e)}</span></div>`).join('')}
        <div class="spire"></div></div>
        <div class="ak-map-side"><h5>현재 위치</h5><p><b>📍 ${esc((R.status && R.status.place) || '알 수 없음')}</b></p>
        <h5>서식지와 야생 레벨</h5><p class="ak-small">${esc(String(data.regions || '').replace(/^서식지\(기본체 기준\)\.\s*/, '')).replace(/\.\s/g, '.<br>')}</p></div></div>`;
    }
    function bagHtml() {
      const st = R.status || {};
      const items = st.items || [];
      const m = st.money || {};
      return `<div class="ak-bag"><div class="ak-bag-money"><div><b>${m.gold || 0}</b><span>금</span></div><div><b>${m.silver == null ? '-' : m.silver}</b><span>은</span></div><div><b>${m.copper == null ? '-' : m.copper}</b><span>동</span></div><p class="ak-muted">1은 = 100동 · 1금 = 100은</p></div>
        <h5>가진 것</h5><div class="ak-bag-grid">${items.length ? items.map(it => `<div><i>${ITEM_ICON[it.name] || '🎁'}</i><b>${esc(it.name)}</b><em>×${it.n}</em></div>`).join('') : '<p class="ak-muted">비어 있어요</p>'}</div>
        <h5>시가지 상점가 가격표</h5><div class="ak-shop">${(data.shop || []).map(s => `<button data-ak="fill" data-fill="${esc(s.name)}을(를) 산다"><i>${ITEM_ICON[s.name] || '🎁'}</i><b>${esc(s.name)}</b><span>${esc(s.eff)}</span><em>${esc(s.price)}</em></button>`).join('')}
          <button data-ak="fill" data-fill="별의 우물에서 소환한다 (20은)"><i>⛲</i><b>별의 우물</b><span>일반 70 · 희귀 25 · 영웅 5%</span><em>20은</em></button></div>
        <p class="ak-muted">가격표를 누르면 입력창에 채워져요. 보내기는 직접 눌러 주세요.</p></div>`;
    }
    function badgeHtml() {
      const n = (R.status && R.status.badges && R.status.badges.n) || 0;
      return `<p class="ak-muted">교수 7명의 배지전에서 이기면 배지를 받아요. 3개면 졸업, 7개면 학장 인정전(마스터 졸업).${n ? ` 상태창 기준 ${n}개.` : ''}</p>
        <div class="ak-badges">${(data.badges || []).map(b => {
          const got = !!M.badges[b.prof];
          return `<div class="ak-bd ${got ? 'got' : ''}"><div class="im" style="background-image:${cssUrl(url(b.img))}"></div>
          <b>${esc(b.badge)}${b.id === 'master' ? '' : ' 배지'}</b><span>${esc(b.prof)}${b.el ? ' · ' + EL_ICON[b.el] + esc(b.el) : ''}</span>
          <small>${esc(b.rule)}</small><small>팀: ${esc((b.team || []).join(' · '))}</small>${got ? '<em>획득</em>' : '<em class="lock">🔒</em>'}</div>`;
        }).join('')}</div>`;
    }
    function logHtml() {
      return `<div class="ak-log">${M.log.slice(-120).map(x => `<p class="${x.me ? 'me' : x.who ? 'say' : ''}">${x.who ? `<b>${esc(x.who)}</b>` : ''}${esc(x.t)}</p>`).join('') || '<p class="ak-muted">아직 기록이 없어요</p>'}</div>`;
    }
    function setHtml() {
      const sel = (k, opts) => `<div class="ak-seg">${opts.map(([v, l]) => `<button class="${String(M.prefs[k]) === String(v) ? 'on' : ''}" data-ak="pref" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
      return `<div class="ak-set">
        <label>글자 속도</label>${sel('speed', [['slow', '느리게'], ['normal', '보통'], ['fast', '빠르게'], ['instant', '바로']])}
        <label>자동 진행</label>${sel('auto', [['false', '끄기'], ['true', '켜기']])}
        <label>배경 음악</label>${sel('music', [['true', '켜기'], ['false', '끄기']])}
        <label>음량 <b id="akVolV">${M.prefs.vol}</b></label><input type="range" min="0" max="100" value="${M.prefs.vol}" id="akVol">
        <label>화면 효과 (흔들림·번쩍임·계절)</label>${sel('fx', [['true', '켜기'], ['false', '끄기']])}
        <hr><button class="ak-btn" data-ak="crack">크랙 화면 잠깐 보기</button> <button class="ak-btn" data-ak="pack-off">이 작품 플레이팩 끄기</button> <button class="ak-btn" data-ak="diag">화면 진단 복사</button>
        <p class="ak-muted">플레이팩을 꺼도 지우지 않아요. 스토어에서 다시 켤 수 있어요. 도감·인물 기록은 이 컴퓨터에만 저장돼요.</p></div>`;
    }
    function openModal(k) {
      if (k === 'm-dex') modal('📖 도감', codexHtml(), 'wide');
      else if (k === 'm-people') modal('👥 인물록', peopleHtml(), 'wide');
      else if (k === 'm-map') modal('🗺️ 에테르나 섬', mapHtml(), 'wide');
      else if (k === 'm-bag') modal('🎒 주머니', bagHtml());
      else if (k === 'm-badge') modal('🏅 배지 회랑', badgeHtml(), 'wide');
      else if (k === 'log') modal('📜 지난 대사', logHtml());
      else if (k === 'm-set') modal('⚙️ 플레이팩 설정', setHtml());
      if (k === 'log') { const lg = el.querySelector('.ak-log'); if (lg) lg.scrollTop = 1e9; }
    }

    // ---------- 입력 ----------
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-ak]');
      if (!t || !el.contains(t)) return;
      const k = t.dataset.ak;
      if ((k === 'm-close' || k === 'ov-close') && t !== e.target && t.classList.contains('ak-scrim') ) return;
      if (k === 'ov-close' && t.classList.contains('ak-ov') && e.target !== t) return;
      switch (k) {
        case 'next': if (!e.target.closest('.ak-dlg-tools')) next(); break;
        case 'skip': clearTimeout(autoT); finishType(); R.i = R.beats.length - 1; showBeat(R.i); break;
        case 'auto': M.prefs.auto = !M.prefs.auto; t.classList.toggle('on', M.prefs.auto); save(); if (M.prefs.auto && !R.typing) next(); break;
        case 'send': doSend(); break;
        case 'regen': o.action('regen'); R.waiting = true; R.sentAt = Date.now(); waitingUi(true); break;
        case 'fill': fill(t.dataset.fill); if (R.modal) $('#akLayer').innerHTML = ''; R.modal = null; break;
        case 'flip': R.flip[t.dataset.k] = !R.flip[t.dataset.k]; t.classList.toggle('flip'); break;
        case 'click': o.click(t.dataset.id); banner(null); break;
        case 'crack': o.showCrack(true); break;
        case 'diag': o.diag(); break;
        case 'unwait': banner(null); R.waiting = false; waitingUi(false); break;
        case 'copy': o.copy(t.dataset.text); break;
        case 'open': o.openExternal(t.dataset.url); break;
        case 'pack-off': o.packOff(); break;
        case 'ov-close': closeOverlay(); break;
        case 'm-close': $('#akLayer').innerHTML = ''; R.modal = null; break;
        case 'dex-tab': dexTab = t.dataset.v; openModal('m-dex'); break;
        case 'dex-sel': dexSel = Number(t.dataset.no); openModal('m-dex'); break;
        case 'dex-copyall': { const codes = Object.values(M.codex).map(x => x.code); if (codes.length) o.copy(codes.join(' ')); else o.toast('아직 등록한 칸이 없어요'); break; }
        case 'pref': {
          const v = t.dataset.v; M.prefs[t.dataset.k] = v === 'true' ? true : v === 'false' ? false : v; save();
          if (t.dataset.k === 'music' && bgm) { if (M.prefs.music) { const id = bgmId; bgmId = ''; playBgm(id || placeBgm(R.place)); } else { bgm.stop(); } }
          if (t.dataset.k === 'fx') { tint(R.status); setCrisis(R.crisis); }
          if (t.dataset.k === 'auto') { const ab = el.querySelector('[data-ak=auto]'); if (ab) ab.classList.toggle('on', M.prefs.auto); }
          openModal('m-set'); break;
        }
        default: if (/^m-/.test(k) || k === 'log') openModal(k);
      }
    });
    el.addEventListener('input', (e) => {
      if (e.target.id === 'akIn') autosize();
      if (e.target.id === 'akVol') { M.prefs.vol = Number(e.target.value); const v = el.querySelector('#akVolV'); if (v) v.textContent = M.prefs.vol; if (bgm) bgm.setVolume(M.prefs.vol / 100); save(); }
    });
    const onKey = (e) => {
      if (!el.isConnected || el.classList.contains('off') || document.querySelector('#layer .scrim')) return;
      if (e.target.id === 'akIn' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); return; }
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'WEBVIEW') return;
      if (e.key === 'Escape') { if (R.overlayOn) closeOverlay(); else if (R.modal) { $('#akLayer').innerHTML = ''; R.modal = null; } }
      if ((e.key === ' ' || e.key === 'Enter') && !R.modal && !e.target.closest('button')) { e.preventDefault(); next(); }
    };
    document.addEventListener('keydown', onKey);

    // ---------- 처음 화면 ----------
    tint(R.status);
    setBg(bgFor(R.status, null));
    renderHud();
    playBgm(R.status ? placeBgm(R.place) : (man.bgmTitle || 'title'));
    stage.querySelector('.ak-text').innerHTML = R.status ? '<span class="ak-muted">지난 대화를 불러오는 중이에요…</span>' : '<span class="ak-muted">크랙 대화가 열리면 이야기가 여기에 흘러요.</span>';

    return {
      onIpc(ch, d) {
        if (ch === 'crion:reply' && d) {
          if (!d.done) { if (R.waiting || d.key !== R.lastKey) { R.waiting = true; R.sentAt = R.sentAt || Date.now(); waitingUi(true, (d.segs || []).filter(s => s.t === 'text').map(s => s.s).join(' ').trim()); } return; }
          if (d.key === R.lastKey && !R.waiting) return;
          R.lastKey = d.key;
          R.waiting = false; waitingUi(false); banner(null);
          handle(d.segs || []);
        } else if (ch === 'crion:state' && d) {
          if (d.page) { R.page = d.page; R.actions = d.actions || []; }
          else if (d.input) R.page = 'chat';
          if (R.page === 'detail' && R.actions.length) banner('detail');
          else if (R.page === 'other') banner('other');
          else if ($('#akBanner').querySelector('.ak-gate')) banner(null);
        } else if (ch === 'crion:sent' && d) {
          if (!d.ok) { R.waiting = false; waitingUi(false); o.toast(d.why === 'no-input' ? '크랙 입력창을 찾지 못했어요. 크랙 화면을 확인해 주세요' : '보내지 못했어요'); }
        }
      },
      destroy() { document.removeEventListener('keydown', onKey); clearInterval(waitT); clearTimeout(autoT); clearInterval(R.typing && R.typing.t); if (bgm) bgm.stop(); save(); },
      demo(segsList) { handle(segsList); },
      state: R, memory: M
    };
  }

  root.CrionPackRun = { start };
})(window);
