// 플레이팩 공통 키트 (window.CrionKit) — 모든 팩 실행기가 같이 쓰는 편의 기능
//  B1 지난 줄거리 · B2 글자 크기·자동 넘김 · B3 장면 카드 저장/복사/공유 · B4 대사 찾기 · B5 팩별 첫 사용법 · B6 해석 실패 기록
//  화면은 팩 화면(el) 위에 겹치는 자체 창(.pkk). 팩마다 accent 색만 넘겨 받는다.
//  크랙에 아무것도 보내지 않는다(자동 넘김 = 팩 화면의 다음 대사로 넘어가기만).
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } };
  const PREF_KEY = 'crion.kit.prefs', FAIL_KEY = 'crion.kit.fails';
  const SIZES = [['s', '작게', 0.92], ['m', '보통', 1], ['l', '크게', 1.12], ['xl', '아주 크게', 1.26]];
  const prefs = () => Object.assign({ size: 'm', auto: false, autoSpeed: 'normal' }, lsGet(PREF_KEY, {}));
  const X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ---------- 해석 실패 기록 (B6) — 이 기기에만, 문제 신고 때 '화면 정보 첨부'를 켜면 같이 간다 ----------
  function logFail(pack, reason, text) {
    const list = lsGet(FAIL_KEY, []).filter(x => x && x.at);
    const t = String(text || '').replace(/\s+\n/g, '\n').slice(0, 1500);
    if (list.length && list[list.length - 1].t === t) return;
    list.push({ at: Date.now(), pack: String(pack || ''), why: String(reason || ''), t });
    lsSet(FAIL_KEY, list.slice(-8));
  }
  const fails = () => lsGet(FAIL_KEY, []);
  function failsText(max) {
    const list = fails().slice(-(max || 3));
    if (!list.length) return '';
    return '[화면 해석 실패 기록]\n' + list.map(f => `${new Date(f.at).toLocaleString()} · ${f.pack} · ${f.why}\n${f.t.slice(0, 600)}`).join('\n---\n');
  }

  function create(opt) {
    const o = Object.assign({ accent: '#c8a25a', packId: '', packName: '', fontTargets: [], coach: [], unit: null }, opt || {});
    const host = o.el;
    let layer = null;
    const P = prefs();
    function ensure() {
      if (layer && host.contains(layer)) return layer;
      layer = document.createElement('div');
      layer.className = 'pkk';
      layer.style.setProperty('--kk-accent', o.accent);
      layer.addEventListener('click', onClick);
      layer.addEventListener('input', onInput);
      host.appendChild(layer);
      return layer;
    }
    function show(html, cls) {
      const L = ensure();
      L.innerHTML = `<div class="pkk-scrim" data-kk="close"></div><div class="pkk-box ${cls || ''}" role="dialog">${html}</div>`;
      L.hidden = false;
      return L.querySelector('.pkk-box');
    }
    function close() { if (layer) { layer.hidden = true; layer.innerHTML = ''; } if (S.onClose) { const f = S.onClose; S.onClose = null; f(); } }
    const S = { onClose: null, log: null, card: null };
    const isOpen = () => !!(layer && !layer.hidden && layer.innerHTML);

    // ---------- 글자 크기 (B2) ----------
    function applyFont() {
      const z = (SIZES.find(s => s[0] === P.size) || SIZES[1])[2];
      host.style.setProperty('--kit-z', z);
      o.fontTargets.forEach(sel => host.querySelectorAll(sel).forEach(n => { n.style.zoom = z === 1 ? '' : z; }));
    }
    // 자동 넘김: 글자를 다 쓴 뒤 읽을 시간만큼 기다렸다가 팩 화면의 다음 대사로 (크랙에는 아무것도 안 보냄)
    let autoT = null;
    function autoNext(text, go) {
      clearTimeout(autoT);
      if (!P.auto || typeof go !== 'function') return;
      const per = { slow: 70, normal: 48, fast: 30 }[P.autoSpeed] || 48;
      autoT = setTimeout(go, 1300 + Math.min(String(text || '').length, 260) * per);
    }
    const stopAuto = () => clearTimeout(autoT);
    function settings() {
      const seg = (k, opts) => `<div class="pkk-seg">${opts.map(([v, l]) => `<button class="${String(P[k]) === String(v) ? 'on' : ''}" data-kk="pref" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
      show(`<button class="pkk-x" data-kk="close" aria-label="닫기">${X}</button><h3>읽기 설정</h3>
        <div class="pkk-row"><span>대사 글자 크기</span>${seg('size', SIZES.map(s => [s[0], s[1]]))}</div>
        <div class="pkk-row"><span>대사 자동 넘김</span>${seg('auto', [[false, '끔'], [true, '켜짐']])}</div>
        <div class="pkk-row"><span>넘기는 빠르기</span>${seg('autoSpeed', [['slow', '천천히'], ['normal', '보통'], ['fast', '빠르게']])}</div>
        <p class="pkk-note">자동 넘김은 이 화면의 대사만 넘겨요. 크랙에 보내는 건 언제나 직접 누른 한 번뿐이에요. 모든 플레이팩에 같이 적용돼요.</p>`, 'pkk-set');
    }

    // ---------- 지난 줄거리 (B1) ----------
    //  data = { title, when, place, rows:[[이름, 값]], people:[{name,color}], narr, mine, bg }
    function recap(data) {
      const d = data || {};
      if (!d.narr && !d.mine && !(d.people || []).length) return Promise.resolve();
      return new Promise(res => {
        const b = show(`${d.bg ? `<div class="pkk-rbg" style="background-image:url('${String(d.bg).replace(/['"\\\n<>]/g, encodeURIComponent)}')"></div>` : ''}
          <div class="pkk-rin"><small>지난 줄거리</small><h3>${esc(d.title || '이어서 하기')}</h3>
          ${d.when || d.place ? `<p class="pkk-when">${esc([d.when, d.place].filter(Boolean).join(' · '))}</p>` : ''}
          ${(d.rows || []).length ? `<dl class="pkk-rows">${d.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
          ${(d.people || []).length ? `<div class="pkk-people"><span>최근에 만난 사람</span>${d.people.map(p => `<b style="--c:${esc(p.color || o.accent)}">${esc(p.name)}</b>`).join('')}</div>` : ''}
          ${d.narr ? `<blockquote>${esc(d.narr)}</blockquote>` : ''}
          ${d.mine ? `<p class="pkk-mine"><span>내가 마지막으로 한 말</span>${esc(d.mine)}</p>` : ''}
          <button class="pkk-go" data-kk="close">이어서 하기</button></div>`, 'pkk-recap');
        b.classList.add('in');
        S.onClose = res;
      });
    }
    // M.lines 꼴([{who,t,me,sys, d|w}]) 에서 줄거리 재료 뽑기
    function recapFromLines(lines, colorOf) {
      const ls = (lines || []).slice(-60);
      const narr = ls.slice().reverse().find(l => !l.me && !l.who && !l.sys && String(l.t || '').length > 14);
      const mine = ls.slice().reverse().find(l => l.me && !/^[#/]/.test(String(l.t || '')));
      const seen = [];
      ls.slice().reverse().forEach(l => { if (l.who && !l.me && !seen.includes(l.who) && seen.length < 5) seen.push(l.who); });
      const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
      return { narr: narr ? cut(narr.t, 160) : '', mine: mine ? cut(mine.t, 90) : '', people: seen.map(n => ({ name: n, color: colorOf ? colorOf(n) : '' })) };
    }

    // ---------- 대사 찾기 (B4) ----------
    //  lines = [{who,t,me,sys, d|w}], unit(l) → 'D+3' 같은 묶음 이름
    function log(lines, colorOf) {
      S.log = { lines: (lines || []).slice(-400), q: '', who: '', colorOf };
      const b = show(`<button class="pkk-x" data-kk="close" aria-label="닫기">${X}</button><h3>지난 대사</h3>
        <input class="pkk-q" type="search" placeholder="낱말로 찾기 (예: 권능, 약속)" aria-label="대사 찾기">
        <div class="pkk-who"></div><div class="pkk-lines"></div>`, 'pkk-log');
      renderLog();
      const box = b.querySelector('.pkk-lines'); box.scrollTop = box.scrollHeight;
    }
    function renderLog() {
      const L = S.log; if (!L || !layer) return;
      const names = []; L.lines.forEach(l => { if (l.who && !l.me && !names.includes(l.who)) names.push(l.who); });
      const w = layer.querySelector('.pkk-who');
      if (w) w.innerHTML = [['', '전체']].concat(names.slice(0, 14).map(n => [n, n])).map(([v, l]) => `<button class="${L.who === v ? 'on' : ''}" data-kk="who" data-v="${esc(v)}" style="${v && L.colorOf ? '--c:' + esc(L.colorOf(v) || '') : ''}">${esc(l)}</button>`).join('');
      const q = L.q.trim();
      let last = null;
      const hl = (t) => { const s = esc(t); if (!q) return s; const k = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return s.replace(new RegExp(k, 'gi'), m => `<mark>${m}</mark>`); };
      const list = L.lines.filter(l => (!L.who || l.who === L.who) && (!q || String(l.t || '').toLowerCase().includes(q.toLowerCase()) || String(l.who || '').includes(q)));
      const box = layer.querySelector('.pkk-lines');
      if (!box) return;
      box.innerHTML = list.length ? list.map(l => {
        const u = o.unit ? o.unit(l) : '';
        const hd = u && u !== last ? `<h5>${esc(u)}</h5>` : ''; last = u || last;
        return hd + `<p class="${l.me ? 'me' : l.sys ? 'sys' : l.who ? 'say' : 'narr'}" style="${l.who && L.colorOf ? '--c:' + esc(L.colorOf(l.who) || '') : ''}">${l.who && !l.me ? `<b>${esc(l.who)}</b>` : ''}<span>${hl(l.t)}</span></p>`;
      }).join('') : `<p class="pkk-empty">${q ? '찾는 낱말이 들어간 대사가 없어요.' : '아직 대사가 없어요.'}</p>`;
    }

    // ---------- 장면 카드 (B3) ----------
    //  scene = { bg, face, who, text, color, place }
    const loadImg = (src) => new Promise(res => { if (!src) return res(null); const im = new Image(); if (!/^(blob|data):/.test(src)) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    function wrap(ctx, text, maxW) {
      const out = []; let line = '';
      for (const ch of String(text)) {
        if (ch === '\n') { out.push(line); line = ''; continue; }
        if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch.trim() ? ch : ''; } else line += ch;
      }
      if (line) out.push(line);
      return out;
    }
    async function drawCard(sc) {
      const W = 1080, H = 1350;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#0d0b12'; g.fillRect(0, 0, W, H);
      const [bg, face] = await Promise.all([loadImg(sc.bg), loadImg(sc.face)]);
      const cover = (im, x, y, w, h) => { const r = Math.max(w / im.width, h / im.height); const iw = im.width * r, ih = im.height * r; g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); };
      if (bg) { g.globalAlpha = face ? 0.55 : 0.9; cover(bg, 0, 0, W, H); g.globalAlpha = 1; }
      if (face) {
        const wide = face.width / face.height > 1.2;
        if (wide) cover(face, 0, 0, W, H * 0.78);
        else { const h = H * 0.86, w = h * face.width / face.height; g.drawImage(face, (W - w) / 2, H * 0.02, w, h); }
      }
      const gr = g.createLinearGradient(0, H * 0.48, 0, H); gr.addColorStop(0, 'rgba(10,8,14,0)'); gr.addColorStop(0.45, 'rgba(10,8,14,.88)'); gr.addColorStop(1, 'rgba(10,8,14,.98)');
      g.fillStyle = gr; g.fillRect(0, H * 0.48, W, H * 0.52);
      const fam = getComputedStyle(host).fontFamily || 'sans-serif';
      g.textBaseline = 'alphabetic';
      g.font = `500 44px ${fam}`;
      const body = sc.who ? `“${sc.text}”` : sc.text;
      let lines = wrap(g, body || '', W - 160);
      if (lines.length > 6) { lines = lines.slice(0, 6); lines[5] = lines[5].replace(/.?$/, '…'); }
      let y = H - 150 - (lines.length - 1) * 64;
      if (sc.who) {
        g.font = `800 40px ${fam}`; g.fillStyle = sc.color || o.accent; g.fillRect(80, y - 112, 6, 46);
        g.fillStyle = '#fff'; g.fillText(sc.who, 102, y - 74);
      }
      g.font = `500 44px ${fam}`; g.fillStyle = '#f2ece2';
      lines.forEach((l, i) => g.fillText(l, 80, y + i * 64));
      g.font = `600 26px ${fam}`; g.fillStyle = 'rgba(255,255,255,.55)';
      g.fillText(`CRION · ${o.packName || ''}${sc.place ? ' · ' + sc.place : ''}`, 80, H - 60);
      return c;
    }
    async function card(sc) {
      if (!sc || !(sc.text || sc.face || sc.bg)) { return false; }
      const b = show(`<button class="pkk-x" data-kk="close" aria-label="닫기">${X}</button><h3>장면 카드</h3><div class="pkk-cardwrap"><span class="pkk-spin"></span></div>
        <div class="pkk-btns"><button data-kk="save" class="pri">이미지 저장</button><button data-kk="copy">복사</button><button data-kk="share" hidden>공유</button></div><p class="pkk-note">커뮤니티나 SNS에 올릴 때는 다른 사람의 대화가 들어가지 않았는지 한 번 봐 주세요.</p>`, 'pkk-card');
      let cv;
      try { cv = await drawCard(sc); } catch (e) { cv = null; }
      if (!layer || !b.isConnected) return false;
      const wrapEl = b.querySelector('.pkk-cardwrap');
      if (!cv) { wrapEl.innerHTML = '<p class="pkk-empty">카드를 만들지 못했어요.</p>'; return false; }
      let blob = null;
      try { blob = await new Promise(r => cv.toBlob(r, 'image/png')); } catch (e) { blob = null; }
      if (!blob) { wrapEl.innerHTML = '<p class="pkk-empty">이 장면의 그림은 카드로 만들 수 없어요.</p>'; return false; }
      S.card = blob;
      const url = URL.createObjectURL(blob);
      wrapEl.innerHTML = `<img src="${url}" alt="장면 카드">`;
      try { if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'crion.png', { type: 'image/png' })] })) b.querySelector('[data-kk=share]').hidden = false; } catch (e) { /* 공유 없음 */ }
      return true;
    }
    async function cardAct(k) {
      const blob = S.card; if (!blob) return;
      const name = `crion-${(o.packName || 'scene').replace(/\s+/g, '')}-${new Date().toISOString().slice(0, 10)}.png`;
      if (k === 'save') { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('이미지를 저장했어요'); }
      else if (k === 'copy') { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('이미지를 복사했어요. 붙여넣기로 올릴 수 있어요'); } catch (e) { toast('복사가 안 되는 기기예요. 이미지 저장을 써 주세요'); } }
      else if (k === 'share') { try { await navigator.share({ files: [new File([blob], name, { type: 'image/png' })], title: o.packName }); } catch (e) { /* 취소 */ } }
    }
    const toast = (t) => { if (o.toast) o.toast(t); };

    // ---------- 첫 사용법 (B5) — 팩마다 한 번 ----------
    function coach(force) {
      const key = 'crion.kit.coach.' + o.packId;
      const steps = (o.coach || []).filter(s => host.querySelector(s.sel) && host.querySelector(s.sel).getClientRects().length);
      if (!steps.length || (!force && lsGet(key, 0))) return;
      lsSet(key, 1);
      let i = 0;
      const L = ensure();
      const draw = () => {
        const s = steps[i], n = host.querySelector(s.sel);
        if (!n) { L.hidden = true; L.innerHTML = ''; return; }
        const hr = host.getBoundingClientRect(), r = n.getBoundingClientRect();
        const x = r.left - hr.left - 6, y = r.top - hr.top - 6, w = r.width + 12, h = r.height + 12;
        const below = y + h + 150 < hr.height;
        const bx = Math.max(12, Math.min(x, hr.width - 300));
        L.hidden = false;
        L.innerHTML = `<div class="pkk-coach" data-kk="coach-next"><i class="pkk-hole" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></i>
          <div class="pkk-tip" style="left:${bx}px;${below ? `top:${y + h + 12}px` : `bottom:${hr.height - y + 12}px`}"><b>${esc(s.title || '')}</b><p>${esc(s.text)}</p>
          <div><span>${i + 1} / ${steps.length}</span><button data-kk="coach-skip">건너뛰기</button><button class="pri" data-kk="coach-next">${i < steps.length - 1 ? '다음' : '시작하기'}</button></div></div></div>`;
      };
      S.coach = { next() { i++; if (i >= steps.length) { L.hidden = true; L.innerHTML = ''; S.coach = null; } else draw(); }, skip() { L.hidden = true; L.innerHTML = ''; S.coach = null; } };
      draw();
    }

    function onClick(e) {
      const t = e.target.closest('[data-kk]');
      if (!t) return;
      const k = t.dataset.kk;
      if (k === 'close') { stopAuto(); close(); }
      else if (k === 'pref') { const v = t.dataset.v; P[t.dataset.k] = v === 'true' ? true : v === 'false' ? false : v; lsSet(PREF_KEY, P); applyFont(); settings(); if (o.onPrefs) o.onPrefs(P); }
      else if (k === 'who') { if (S.log) { S.log.who = t.dataset.v; renderLog(); } }
      else if (k === 'save' || k === 'copy' || k === 'share') cardAct(k);
      else if (k === 'coach-next') { e.stopPropagation(); if (S.coach) S.coach.next(); }
      else if (k === 'coach-skip') { e.stopPropagation(); if (S.coach) S.coach.skip(); }
    }
    function onInput(e) { if (e.target.classList.contains('pkk-q') && S.log) { S.log.q = e.target.value; renderLog(); } }
    const onKey = (e) => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);

    applyFont();
    return {
      prefs: P, applyFont, autoNext, stopAuto, settings, recap, recapFromLines, log, card, coach, close, isOpen,
      checkParse(ok, reason, text) { if (!ok) logFail(o.packId, reason, text); },
      // ⋯ 메뉴에 넣을 공통 항목
      menu(getScene, getLines, colorOf) {
        return [{ label: '지난 대사 찾기', fn: () => log(getLines(), colorOf) }, { label: '장면 카드 만들기', fn: () => { const sc = getScene && getScene(); card(sc).then(ok => { if (!ok && !(sc && (sc.text || sc.face))) { close(); toast('카드로 만들 장면이 아직 없어요'); } }); } }, { label: '읽기 설정 (글자 크기·자동 넘김)', fn: settings }, { label: '사용법 다시 보기', fn: () => coach(true) }];
      },
      destroy() { document.removeEventListener('keydown', onKey, true); stopAuto(); if (layer) layer.remove(); }
    };
  }

  root.CrionKit = { create, logFail, fails, failsText, prefs };
})(typeof window !== 'undefined' ? window : globalThis);
