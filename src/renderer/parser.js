/*
 * CRION 팩 파서
 * 팩 manifest의 규칙대로 크랙 응답 속 상태창을 읽고, 장면을 정한다.
 * 브라우저(렌더러)와 Node(테스트) 양쪽에서 쓴다.
 */
(function (root) {
  'use strict';

  function compile(pattern) {
    if (!pattern) return null;
    try { return new RegExp(pattern, 'u'); } catch (e) { return null; }
  }

  // 상태창이 들어 있는 글인지
  function isStatus(manifest, text) {
    const re = compile(manifest.status && manifest.status.detect);
    return !!(re && text && re.test(text));
  }

  // 칸 하나를 글에서 읽는다 (number · ratio · text · list · blocks)
  function readField(f, text) {
    if (f.type === 'blocks') return readBlocks(f, text);
    const re = compile(f.pattern);
    if (!re) return undefined;
    const m = text.match(re);
    if (!m) return undefined;
    if (f.type === 'number') {
      const n = Number(m[1]);
      return Number.isNaN(n) ? undefined : n;
    }
    if (f.type === 'ratio') {
      const a = Number(m[1]), b = Number(m[2]);
      return Number.isNaN(a) ? undefined : { value: a, max: Number.isNaN(b) ? null : b };
    }
    if (f.type === 'list') {
      const sp = compile(f.split || '\\s*[,，]\\s*');
      const ip = compile(f.itemPattern);
      const parts = String(m[1]).trim().split(sp).map(x => x.trim()).filter(Boolean);
      return parts.map(x => {
        if (!ip) return x;
        const g = x.match(ip);
        if (!g) return { name: x };
        const o = Object.assign({}, g.groups || {});
        for (const k of Object.keys(o)) if (o[k] !== undefined && /^\d+$/.test(o[k])) o[k] = Number(o[k]);
        return o;
      });
    }
    return String(m[1]).trim();
  }

  // 같은 모양이 여러 번 나오는 묶음 (예: 소환수 최대 3마리)
  function readBlocks(f, text) {
    const start = compile(f.start), end = compile(f.end);
    if (!start) return [];
    const blocks = [];
    let cur = null;
    for (const line of String(text).split('\n')) {
      if (start.test(line)) { if (cur) blocks.push(cur); cur = [line]; continue; }
      if (cur && end && end.test(line)) { blocks.push(cur); cur = null; continue; }
      if (cur) cur.push(line);
    }
    if (cur) blocks.push(cur);
    const out = blocks.slice(0, f.max || 99).map(lines => {
      const t = lines.join('\n'), o = {};
      for (const sf of f.fields || []) {
        const v = readField(sf, t);
        if (v !== undefined) o[sf.key] = v;
      }
      return o;
    });
    return out;
  }

  // 상태창 글 → { fields: {key: value}, day, phase, loc }
  function parseStatus(manifest, text) {
    const st = manifest.status || {};
    const out = { fields: {}, day: null, phase: null, loc: null };
    if (!text) return out;
    for (const f of st.fields || []) {
      const v = readField(f, text);
      if (v !== undefined) out.fields[f.key] = v;
    }
    const dre = compile(st.dayPattern);
    if (dre) { const m = text.match(dre); if (m) out.day = Number(m[1]); }
    const pre = compile(st.phasePattern);
    if (pre) { const m = text.match(pre); if (m) out.phase = m[1]; }
    const lre = compile(st.locPattern);
    if (lre) { const m = text.match(lre); if (m) out.loc = String(m[1]).trim(); }
    return out;
  }

  // 숫자 칸의 변화량
  function diff(prev, cur) {
    const d = {};
    if (!prev || !cur) return d;
    for (const k of Object.keys(cur.fields)) {
      const a = prev.fields[k], b = cur.fields[k];
      const av = typeof a === 'object' && a ? a.value : a;
      const bv = typeof b === 'object' && b ? b.value : b;
      if (typeof av === 'number' && typeof bv === 'number' && av !== bv) d[k] = bv - av;
    }
    return d;
  }

  // 특별한 밤(예: 큰 밤) 날짜 규칙
  function cycleFor(manifest, options) {
    const c = manifest.cycle;
    if (!c) return null;
    const mode = (options && options.mode) || c.defaultMode || Object.keys(c.modes || {})[0];
    return (c.modes && c.modes[mode]) || null;
  }

  function isCycleDay(cycle, day) {
    if (!cycle || typeof day !== 'number') return false;
    if (day < cycle.start) return false;
    return (day - cycle.start) % cycle.every === 0;
  }

  // 다음 특별한 밤까지
  function countdown(manifest, options, status) {
    const c = manifest.cycle;
    const cycle = cycleFor(manifest, options);
    if (!c || !cycle || !status || typeof status.day !== 'number') return null;
    const day = status.day;
    const onNight = c.phase && status.phase === c.phase;
    if (isCycleDay(cycle, day)) {
      if (onNight) return { label: c.labels.now, hot: true, days: 0 };
      return { label: c.labels.today, hot: true, days: 0 };
    }
    let next = day + 1;
    while (!isCycleDay(cycle, next) && next < day + 400) next++;
    const left = next - day;
    if (left === 1) return { label: c.labels.tomorrow.replace('{day}', next), hot: false, days: 1 };
    return { label: c.labels.later.replace('{left}', left).replace('{day}', next), hot: false, days: left };
  }

  // 장면 결정: 규칙을 위에서부터 보고 처음 맞는 것
  function decideScene(manifest, options, status, narration, prevScene) {
    const cycle = cycleFor(manifest, options);
    const text = narration || '';
    for (const r of manifest.sceneRules || []) {
      const w = r.when || {};
      if (w.phase) {
        const list = Array.isArray(w.phase) ? w.phase : [w.phase];
        if (!status || list.indexOf(status.phase) === -1) continue;
      }
      if (w.cycleDay !== undefined) {
        const hit = !!(status && isCycleDay(cycle, status.day));
        if (hit !== !!w.cycleDay) continue;
      }
      if (w.prevScene) {
        const list = Array.isArray(w.prevScene) ? w.prevScene : [w.prevScene];
        if (list.indexOf(prevScene) === -1) continue;
      }
      if (w.keywords) {
        if (!w.keywords.some(k => text.indexOf(k) !== -1)) continue;
      }
      return r.scene;
    }
    return manifest.defaultScene || null;
  }

  const api = { isStatus, parseStatus, diff, countdown, decideScene, isCycleDay, cycleFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrionParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
