/*
 * CRION 게임 화면 규격 v2 — 순수 계산부 (브라우저·Node 공용)
 * 응답 글 → 장면 조각(beats), 제어 블록, 배경·효과 선택
 */
(function (root) {
  'use strict';

  const CTRL_RE = /【CRION】([\s\S]*?)【\/CRION】/g;
  const IMG_TOKEN = /\{\{img::([^:}]*)::([^}]*)\}\}/g;
  const norm = (s) => String(s == null ? '' : s).replace(/[\s_·\-]/g, '');
  const compile = (p) => { if (!p) return null; try { return new RegExp(p, 'u'); } catch (e) { return null; } };
  const splitList = (v, sep) => String(v || '').split(sep).map(x => x.trim()).filter(Boolean);

  const FX_ALL = ['shake', 'flash', 'vignette_red', 'vignette_dark', 'fog', 'rain', 'snow', 'petals', 'sparks', 'dim', 'heartbeat', 'glitch'];

  // ---------- 제어 블록 ----------
  function parseCtrl(text) {
    const out = { found: false, bgm: null, bg: null, fx: [], cg: null, sfx: null, sprites: [], choices: [], hud: {} };
    let m, last = null;
    CTRL_RE.lastIndex = 0;
    while ((m = CTRL_RE.exec(String(text || '')))) last = m[1];
    CTRL_RE.lastIndex = 0;
    if (last == null) return out;
    out.found = true;
    for (const raw of last.split(/\n+/)) {
      const line = raw.replace(/^[\s\-*•>]+/, '').replace(/\*\*/g, '').trim();
      const i = line.indexOf('=');
      if (i < 1) continue;
      const k = line.slice(0, i).trim().toLowerCase();
      const v = line.slice(i + 1).trim();
      if (!v) continue;
      if (k === 'bgm') out.bgm = v;
      else if (k === 'bg') out.bg = v;
      else if (k === 'cg') out.cg = v;
      else if (k === 'sfx') out.sfx = v;
      else if (k === 'fx') out.fx = splitList(v, /[,，\s]+/).filter(x => FX_ALL.indexOf(x) !== -1);
      else if (k === 'sprites') out.sprites = splitList(v, /\s*,\s*/).map(x => {
        const g = x.match(/^([LCR])\s*:\s*([^.]+)\.?(.*)$/i);
        return g ? { pos: g[1].toUpperCase(), who: g[2].trim(), face: g[3].trim() } : null;
      }).filter(Boolean);
      else if (k === 'choices') out.choices = splitList(v, /\s*\|\s*/).slice(0, 4);
      else if (k.indexOf('hud.') === 0) out.hud[k.slice(4)] = v;
    }
    return out;
  }

  // ---------- 응답 나누기 ----------
  function splitReply(manifest, reply, statusText) {
    reply = String(reply || '');
    const anchor = manifest.status && manifest.status.anchor;
    let cut = -1;
    if (statusText) {
      const first = String(statusText).split('\n')[0].trim();
      if (first) cut = reply.indexOf(first);
    }
    if (cut < 0 && anchor) cut = reply.indexOf(anchor);
    let narr = cut >= 0 ? reply.slice(0, cut) : reply;
    narr = narr.replace(CTRL_RE, '').replace(/[\s━─=\-]{4,}\s*$/, '');
    CTRL_RE.lastIndex = 0;
    return { narr: narr.trim(), ctrl: parseCtrl(reply) };
  }

  // 긴 글을 문장 끝에서 잘라 한 장면에 담기 좋은 길이로
  function chunk(text, max) {
    max = max || 150;
    const out = [];
    let rest = text.trim();
    while (rest.length > max) {
      let cut = -1;
      const re = /[.!?。…~]["”」』)]?\s+|[.!?。]["”」』)]?$/g;
      let m;
      while ((m = re.exec(rest))) {
        const end = m.index + m[0].length;
        if (end > max + 40) break;
        if (end >= 40) cut = end;
        if (end >= max) break;
      }
      if (cut < 0) cut = rest.lastIndexOf(' ', max) > 30 ? rest.lastIndexOf(' ', max) : max;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
  }

  const stripQuote = (t) => t.replace(/^["“「『]\s*/, '').replace(/\s*["”」』]$/, '');

  // ---------- 장면 조각 만들기 ----------
  function buildBeats(manifest, narr) {
    const cast = new Set(Object.keys((manifest.assets && manifest.assets.sprites) || {}));
    (manifest.cast || []).forEach(n => cast.add(n));
    const bcfg = manifest.battle || {};
    const battleRe = compile(bcfg.pattern);
    const logRe = compile(bcfg.logPattern || '^▶');
    const skip = (bcfg.skipLines || []).map(compile).filter(Boolean);
    const noticeRe = compile(manifest.noticePattern || '^(📖\\s*도감 등록|🏅\\s*배지 획득)');
    const codeRe = compile(manifest.codePattern || '🔑\\s*(.+)$');

    const beats = [], imgs = [], notices = [], hint = [];
    let battle = null, buf = [];
    const pushNar = (t) => chunk(t).forEach(x => beats.push({ t: 'nar', text: x }));
    const flush = () => { if (buf.length) { pushNar(buf.join(' ')); buf = []; } };

    for (const raw of String(narr || '').split('\n')) {
      let line = raw.trim();
      if (!line) { flush(); continue; }
      line = line.replace(IMG_TOKEN, (m, a, b) => { imgs.push({ kind: a.trim(), name: b.trim() }); return ''; }).trim();
      if (!line) continue;

      if (/^💡/.test(line)) {
        flush();
        splitList(line.replace(/^💡\s*/, ''), /\s*\/\s*|\s*｜\s*/).forEach(x => hint.push(x));
        continue;
      }
      if (battleRe) {
        const bm = line.match(battleRe);
        if (bm && bm.groups) {
          flush();
          const g = bm.groups;
          battle = battle || { log: [] };
          battle.a = { name: g.aName, lv: Number(g.aLv), hp: Number(g.aHp), max: Number(g.aMax), st: g.aSt };
          battle.b = { name: g.bName, lv: Number(g.bLv), hp: Number(g.bHp), max: Number(g.bMax), st: g.bSt };
          continue;
        }
      }
      if (logRe && logRe.test(line)) { flush(); battle = battle || { log: [] }; battle.log.push(line.replace(/^▶\s*/, '')); continue; }
      if (skip.some(r => r.test(line))) { if (battle) battle.log.push(line); continue; }

      const code = line.match(codeRe);
      if (code && /🔑/.test(line)) {
        flush();
        if (notices.length) notices[notices.length - 1].code = code[1].trim();
        else notices.push({ title: '코드', code: code[1].trim() });
        continue;
      }
      if (noticeRe && noticeRe.test(line)) {
        flush();
        notices.push({ title: line.replace(/\s*[!！]\s*$/, ''), code: null });
        continue;
      }

      const sc = line.match(/^【장면\|(.+)】$/);
      if (sc) {
        flush();
        const props = {};
        sc[1].split('|').forEach(kv => { const i = kv.indexOf('='); if (i > 0) props[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
        beats.push({ t: 'scene', props });
        continue;
      }
      const say = line.match(/^【([^|】]+?)(?:\|([^】]*))?】\s*(.*)$/);
      if (say) {
        flush();
        const text = stripQuote(say[3] || '');
        if (text) chunk(text, 140).forEach(x => beats.push({ t: 'say', who: say[1].trim(), face: (say[2] || '').trim(), text: x }));
        else beats.push({ t: 'who', who: say[1].trim(), face: (say[2] || '').trim() });
        continue;
      }
      const nq = line.match(/^([가-힣A-Za-z0-9·]{1,10})\s+["“「](.+?)["”」]?\s*$/);
      if (nq && cast.has(nq[1])) {
        flush();
        chunk(nq[2], 140).forEach(x => beats.push({ t: 'say', who: nq[1], face: '', text: x }));
        continue;
      }
      buf.push(line);
    }
    flush();
    return { beats, imgs, notices, hint, battle };
  }

  // ---------- 무대: 배경 고르기 ----------
  function isCrisis(fx) {
    return fx.indexOf('vignette_red') !== -1 || fx.indexOf('heartbeat') !== -1 ||
      (fx.indexOf('vignette_dark') !== -1 && fx.indexOf('shake') !== -1) || fx.indexOf('glitch') !== -1;
  }

  function resolveBg(manifest, st, fx, forced) {
    const bgs = (manifest.assets && manifest.assets.bg) || {};
    const byNorm = {};
    Object.keys(bgs).forEach(k => { byNorm[norm(k)] = k; });
    if (forced && bgs[forced]) return forced;
    const locRaw = st && st.loc;
    if (!locRaw) return null;
    const alias = (manifest.bgAlias || {})[locRaw];
    const loc = norm(alias || locRaw);
    let base = byNorm[loc] || null;
    if (!base) {
      const bases = Object.keys(bgs).filter(k => k.indexOf('_') === -1).sort((a, b) => b.length - a.length);
      const hit = bases.find(k => loc.indexOf(norm(k)) !== -1);
      if (hit) base = hit;
    }
    if (!base) return null;
    const tries = [];
    if (isCrisis(fx || [])) tries.push(base + '_위기');
    const suffix = (manifest.bgTime || {})[st.phase];
    if (suffix) tries.push(base + '_' + suffix);
    tries.push(base);
    for (const t of tries) if (byNorm[norm(t)]) return byNorm[norm(t)];
    return null;
  }

  // 효과: 블록의 fx가 있으면 그것, 없으면 HP 30% 이하일 때 자동 위기 연출
  function lowHp(st, ratio) {
    const ps = (st && st.fields && st.fields.partner) || [];
    return ps.some(p => p.hp && p.hp.max && p.hp.value / p.hp.max <= (ratio || 0.3));
  }
  function deriveFx(manifest, st, ctrl) {
    if (ctrl && ctrl.fx && ctrl.fx.length) return ctrl.fx.slice();
    if (lowHp(st)) return ((manifest.fxMap || {}).crisis || ['vignette_red', 'heartbeat']).slice();
    return [];
  }

  // 배경 음악: 제어 블록 → 같은 곳 반복 시 번갈아 → 장소별 기본
  function resolveBgm(manifest, ctrl, st, prev) {
    const set = (manifest.assets && manifest.assets.bgm) || {};
    let id = ctrl && ctrl.bgm && set[ctrl.bgm] ? ctrl.bgm : null;
    if (!id && prev && set[prev]) id = prev;               // 안 쓴 줄은 유지
    if (!id && st && st.loc && manifest.bgmByLoc) {          // 처음엔 장소별 기본곡
      const loc = norm(st.loc);
      const k = Object.keys(manifest.bgmByLoc).find(x => loc.indexOf(norm(x)) !== -1);
      if (k && set[manifest.bgmByLoc[k]]) id = manifest.bgmByLoc[k];
    }
    if (!id) id = set[(manifest.stage || {}).bgmDefault] ? manifest.stage.bgmDefault : null;
    const alt = manifest.bgmAlt && manifest.bgmAlt[id];
    if (alt && prev && alt.indexOf(prev) !== -1 && ctrl && ctrl.bgm === prev) {
      const next = alt[(alt.indexOf(prev) + 1) % alt.length];
      if (set[next]) id = next;
    }
    return id;
  }

  // 자리 배치: 1명=C, 2명=L·R, 3명=L·C·R
  function layout(names) {
    const n = names.length;
    const pos = n === 1 ? ['C'] : n === 2 ? ['L', 'R'] : ['L', 'C', 'R'];
    return names.map((who, i) => ({ who, pos: pos[i] }));
  }

  // 표정 id 고르기 (없으면 기본 → 아무거나)
  function pickFace(manifest, who, face) {
    const sp = ((manifest.assets && manifest.assets.sprites) || {})[who];
    if (!sp) return null;
    const want = [face, '기본'].filter(Boolean).concat(Object.keys(sp));
    for (const f of want) if (sp[f]) return { face: f, src: sp[f] };
    return null;
  }

  const api = { parseCtrl, splitReply, buildBeats, chunk, resolveBg, resolveBgm, deriveFx, isCrisis, lowHp, layout, pickFace, norm, FX_ALL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrionPlay = api;
})(typeof window !== 'undefined' ? window : globalThis);
