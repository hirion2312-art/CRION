// 「크랙 프로야구 : 6팀 리그」 리그 엔진 — 숫자는 CRION이 정답 (기획안 v0.1.2)
//  타석 확률 시뮬 + 투구 단위 로그 · 주루 · 투수 운용 · 일정/순위/기록 · 승리확률 · 드라마 점수 · ⚾경기로그/⚾중간로그/⚾장면 코드 · 【CRION】 해석
//  화면은 pk-league-run.js. 노드에서도 돈다(test/league.test.js)
(function (root, factory) { const L = factory(); if (typeof module === 'object' && module.exports) module.exports = L; else root.CrionLeague = L; })(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ---------- 난수 (세이브에 상태를 넣어 같은 결과가 나오게) ----------
  function RNG(seed) {
    let s = seed >>> 0;
    const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.get = () => s; f.set = (v) => { s = v >>> 0; };
    f.pick = (a) => a[Math.floor(f() * a.length)];
    f.w = (pairs) => { let t = 0; for (const p of pairs) t += p[1]; let r = f() * t; for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };
    f.n = (m, sd) => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return f;
  }

  const POSKO = { P: '투수', C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', UT: '내외야', DH: '지명' };
  const FIELD = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const COND = ['최악', '나쁨', '보통', '좋음', '절정'];
  const CONDV = [-5, -2.5, 0, 2.5, 5];
  const PT = { 직구: { d: 0, fast: 1 }, 투심: { d: -3, fast: 1 }, 커터: { d: -6, fast: 0 }, 슬라이더: { d: -12 }, 커브: { d: -24 }, 체인지업: { d: -15 }, 포크: { d: -10 } };
  const ZONES = ['몸쪽 높게', '높게', '바깥 높게', '몸쪽', '한가운데', '바깥쪽', '몸쪽 낮게', '낮게', '바깥 낮게', '높게 빠짐', '낮게 떨어짐', '바깥 빠짐', '몸쪽 빠짐'];
  const RES = { B: '볼', S: '헛', L: '루킹', F: '파울', X: '' };
  const OUTS = ['무사', '1사', '2사'];
  const half2 = (h) => h ? '말' : '초';
  // 득점 기대값(주자 상태 × 아웃) — 승리확률 계산용
  const CAL = { k: 8, bb: 14, hr: 10, hit: 20 };
  const RE = [[0.48, 0.86, 1.10, 1.44, 1.35, 1.78, 1.96, 2.29], [0.25, 0.51, 0.66, 0.88, 0.95, 1.13, 1.35, 1.54], [0.10, 0.22, 0.32, 0.43, 0.35, 0.48, 0.57, 0.75]];

  // ---------- 데이터 준비 ----------
  function index(data) {
    const P = {}, T = {};
    for (const t of data.teams || []) T[t.id] = t;
    for (const p of data.players || []) P[p.id] = p;
    return { data, P, T, teams: data.teams || [], traits: data.traits || {} };
  }
  const tr = (p, k) => { if (!p || !p.traits) return null; const t = p.traits.find(x => x[0] === k); return t ? (t.length > 1 ? t[1] : true) : null; };
  const roster = (X, L, tid) => Object.values(X.P).filter(p => p.team === tid).concat(L && L.me && L.me.team === tid ? [L.me] : []);
  const pl = (X, L, id) => (L && L.me && id === L.me.id) ? L.me : X.P[id];

  // ---------- 일정 (원형 순환: 5라운드 × 2) ----------
  function makeSchedule(ids, rng, series) {
    const t = ids.slice(); for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    const n = t.length, rounds = [];
    let arr = t.slice();
    for (let r = 0; r < n - 1; r++) {
      const m = [];
      for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; m.push((r + i) % 2 ? { home: a, away: b } : { home: b, away: a }); }
      rounds.push(m);
      arr = [arr[0]].concat([arr[n - 1]], arr.slice(1, n - 1));
    }
    const out = rounds.concat(rounds.map(m => m.map(x => ({ home: x.away, away: x.home }))));
    return out.slice(0, series || out.length);
  }

  // ---------- 새 리그 ----------
  function newLeague(X, opt) {
    opt = opt || {};
    const seed = opt.seed != null ? opt.seed : Math.floor(Math.random() * 1e9);
    const rng = RNG(seed);
    const S = X.data.season || {};
    const L = {
      v: 1, seed, rs: 0, mode: opt.mode || 'manager', my: opt.team || 'SEO', made: Date.now(),
      prefs: Object.assign({ limit: 1000, preset: 'std', speed: 'hl' }, opt.prefs || {}),
      seriesN: S.series || 10, gpp: S.games || 3, month: S.startMonth || 4,
      schedule: makeSchedule(X.teams.map(t => t.id), rng, S.series || 10),
      games: [], cur: 0, stats: {}, h2h: {}, cond: {}, fat: {}, inj: {}, rel: {}, arcs: {}, logs: {}, sent: {}, narrated: {}, news: [], post: null, champion: null, me: null, career: null, rot: {}
    };
    let no = 0;
    L.schedule.forEach((ms, si) => { for (let g = 0; g < L.gpp; g++) for (const m of ms) L.games.push({ no: ++no, si, gi: g, day: si * 4 + g, home: m.home, away: m.away, st: 'pre' }); });
    for (const p of X.data.players) { L.cond[p.id] = 2; L.rel[p.id] = 50; }
    if (L.mode === 'career' && opt.me) { L.me = makeMe(opt.me, L.my); L.cond.ME = 2; L.rel.ME = 50; L.career = { stage: 0, exp: {}, starts: 0, goals: {}, plan: null, log: [] }; }
    L.rs = rng.get();
    return L;
  }
  // 커리어 선수 만들기 (고졸/대졸/육성)
  function makeMe(m, team) {
    const base = { 고졸: [44, 88], 대졸: [50, 72], 육성: [40, 94] }[m.from] || [46, 80];
    const b = base[0];
    const me = { id: 'ME', name: m.name || '신인', team, pos: m.pos || 'SS', num: m.num || 99, age: m.from === '대졸' ? 23 : 20, throws: m.throws || 'R', bats: m.bats || 'R', gender: m.gender || 'M', named: true, me: true, label: '신인', quote: '', emo: [], traits: [['potential', base[1]], ['rookie']], from: m.from || '고졸' };
    me.b = { con: b + 4, pow: b, eye: b, spd: b + 6, defn: b + 4, arm: b + 2 };
    if (me.pos === 'P') { me.p = { velo: b + 8, ctrl: b, brk: b + 2, stam: 50, cool: b, hold: 50 }; me.pitches = ['직구', '슬라이더', '체인지업']; me.role = 'RP'; me.b = { con: 30, pow: 30, eye: 30, spd: 40, defn: 50, arm: 70 }; }
    return me;
  }

  // ---------- 지금 시즌 위치 ----------
  const nextGame = (L) => L.games.find(g => g.st !== 'done' && (g.home === L.my || g.away === L.my));
  const seriesOf = (L, si) => L.games.filter(g => g.si === si);
  function weekLabel(L, si) { const w = si + 1; const m = L.month + Math.floor((w - 1) / 4); return `${m}월 ${((w - 1) % 4) + 1}주차`; }
  function standings(X, L, upto) {
    const rows = {};
    for (const t of X.teams) rows[t.id] = { id: t.id, w: 0, l: 0, d: 0, rs: 0, ra: 0, streak: 0, last: [], h2h: {} };
    for (const g of L.games) {
      if (g.st !== 'done' || (upto != null && g.no > upto)) continue;
      const [a, h] = g.score, A = rows[g.away], H = rows[g.home];
      A.rs += a; A.ra += h; H.rs += h; H.ra += a;
      const res = a === h ? ['d', 'd'] : a > h ? ['w', 'l'] : ['l', 'w'];
      [[A, res[0], g.home], [H, res[1], g.away]].forEach(([r, x, opp]) => {
        r[x]++; r.last.push(x);
        r.h2h[opp] = r.h2h[opp] || { w: 0, l: 0 }; if (x === 'w') r.h2h[opp].w++; if (x === 'l') r.h2h[opp].l++;
        r.streak = x === 'd' ? 0 : (r.streak && Math.sign(r.streak) === (x === 'w' ? 1 : -1)) ? r.streak + (x === 'w' ? 1 : -1) : (x === 'w' ? 1 : -1);
      });
    }
    const arr = Object.values(rows).map(r => Object.assign(r, { pct: (r.w + r.l) ? r.w / (r.w + r.l) : 0 }));
    arr.sort((a, b) => b.pct - a.pct || ((b.h2h[a.id] || {}).l || 0) - ((b.h2h[a.id] || {}).w || 0) || (b.rs - b.ra) - (a.rs - a.ra));
    const top = arr[0];
    arr.forEach((r, i) => { r.rank = i + 1; r.gb = top ? ((top.w - r.w) + (r.l - top.l)) / 2 : 0; });
    return arr;
  }
  const rankOf = (X, L, tid, upto) => (standings(X, L, upto).find(r => r.id === tid) || {}).rank;

  // ---------- 기록 ----------
  const BAT0 = () => ({ g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, k: 0, sb: 0, cs: 0, sh: 0, sf: 0, gdp: 0, e: 0, rab: 0, rh: 0, s2ab: 0, s2h: 0, ph: 0, phh: 0, wo: 0 });
  const PIT0 = () => ({ g: 0, gs: 0, w: 0, l: 0, sv: 0, outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, bf: 0, np: 0, bs: 0 });
  function st(L, id, kind, post) { const k = post ? 'post' : 'reg'; L.stats[k] = L.stats[k] || {}; const s = L.stats[k][id] = L.stats[k][id] || {}; if (!s[kind]) s[kind] = kind === 'bat' ? BAT0() : PIT0(); return s[kind]; }
  const statOf = (L, id, kind, post) => (((L.stats[post ? 'post' : 'reg'] || {})[id] || {})[kind]) || (kind === 'bat' ? BAT0() : PIT0());
  const avg = (b) => b.ab ? b.h / b.ab : 0;
  const fmt3 = (x) => x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, '');
  const era = (p) => p.outs ? p.er * 27 / p.outs : 0;
  const ipStr = (outs) => `${Math.floor(outs / 3)}${outs % 3 ? ' ' + (outs % 3) + '/3' : ''}`;
  function leaders(X, L, cat, n, post) {
    const pool = (L.stats[post ? 'post' : 'reg']) || {};
    const gp = Math.max(1, L.games.filter(g => g.st === 'done' && !g.post).length / 3);
    const rows = [];
    for (const id in pool) {
      const p = pl(X, L, id); if (!p) continue; const b = pool[id].bat, q = pool[id].pit;
      let v = null;
      if (cat === 'avg' && b && b.pa >= gp * 2.5) v = avg(b);
      else if (cat === 'hr' && b) v = b.hr; else if (cat === 'rbi' && b) v = b.rbi; else if (cat === 'sb' && b) v = b.sb; else if (cat === 'h' && b) v = b.h;
      else if (cat === 'era' && q && q.outs >= gp * 2.4) v = era(q); else if (cat === 'k' && q) v = q.k; else if (cat === 'w' && q) v = q.w; else if (cat === 'sv' && q) v = q.sv;
      if (v != null && (v > 0 || cat === 'era')) rows.push({ id, name: p.name, team: p.team, v });
    }
    rows.sort((a, b) => cat === 'era' ? a.v - b.v : b.v - a.v);
    return rows.slice(0, n || 5);
  }

  // ---------- 승리확률 (홈 기준) ----------
  function normCdf(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
  const baseCode = (b) => (b[0] ? 1 : 0) + (b[1] ? 2 : 0) + (b[2] ? 4 : 0);
  function winProb(G) {
    const diff = G.score[1] - G.score[0];
    if (G.over) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
    const inn = G.inn, half = G.half, mu = 0.5, sd2 = 0.95;
    let remH = Math.max(0, (G.maxInn || 9) - inn) + (half === 0 ? 1 : 0), remA = Math.max(0, (G.maxInn || 9) - inn);
    let m = diff, v = 0;
    const re = G.outs < 3 ? RE[G.outs][baseCode(G.bases)] : 0;
    if (half === 0) { m -= re; v += re * 1.7; } else { remH = Math.max(0, remH - 1); m += re; v += re * 1.7; }
    if (half === 1 && inn >= (G.maxInn || 9) && diff > 0) return 1;
    m += mu * (remH - remA); v += sd2 * (remH + remA);
    if (v < 0.05) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
    return clamp(normCdf((m + 0.15) / Math.sqrt(v)), 0.005, 0.995);
  }

  // ---------- 선수 능력 (특성·컨디션·피로 포함) ----------
  function batSkill(X, L, G, p, ctx) {
    const b = Object.assign({}, p.b);
    const cv = CONDV[L.cond[p.id] != null ? L.cond[p.id] : 2];
    for (const k of ['con', 'pow', 'eye']) b[k] += cv;
    if (ctx.home) { b.con += 2; b.pow += 2; b.eye += 1; }
    const risp = ctx.bases[1] || ctx.bases[2];
    const late = ctx.inn >= 7 && Math.abs(ctx.diff) <= 2;
    let kAdd = 0; const notes = [];
    const v = (k) => tr(p, k);
    if (risp && v('clutch')) { const c = (v('clutch') - 50) / 4; b.con += c; b.pow += c; notes.push('clutch'); }
    if (v('clutch2s') && ctx.s2) { b.con += 10; b.pow += 10; notes.push('clutch2s'); }
    if (v('greedy') && L.cond[p.id] === 4) { b.pow += 5; kAdd += 0.04; notes.push('greedy'); }
    if (v('bigGame') && G.post && !(L.arcs[p.id] >= 3)) { b.con -= 8; notes.push('bigGame'); }
    if (v('smallStage') && G.post) b.con -= 4;
    if (v('calmBig') && G.post) { b.con += 6; notes.push('calmBig'); }
    if (v('rookie') && late) { b.con -= 5; notes.push('rookie'); }
    if (v('slowStart') && G.si < 3 && !G.post) { const c = (50 - v('slowStart')) / 2.5; b.con -= c; b.pow -= c; notes.push('slowStart'); }
    if (v('vsLHP') && ctx.pThrows === 'L') { const c = (v('vsLHP') - 50) / 2; b.con += c; }
    if (v('mood') && ctx.lastK) { b.con -= 6; notes.push('mood'); }
    if (v('pinch') && ctx.pinch) { b.con += (v('pinch') - 50) / 3; b.eye += 4; notes.push('pinch'); }
    if (v('breakWeak')) kAdd += 0.02;
    if (v('freeSwing')) b.eye -= 6;
    if (v('firstPitch')) { b.eye -= 4; kAdd += 0.015; }
    if (v('clutch') && risp && v('clutch') >= 85) notes.push('clutch');
    return { b, kAdd, notes: [...new Set(notes)] };
  }
  function pitSkill(X, L, G, p, ctx) {
    const q = Object.assign({}, p.p);
    const cv = CONDV[L.cond[p.id] != null ? L.cond[p.id] : 2];
    q.velo += cv * 0.6; q.ctrl += cv * 0.6; q.brk += cv * 0.6;
    const pc = G.pc[p.id] || 0, lim = limitOf(p);
    const notes = [];
    if (pc > lim) { const o = pc - lim; q.velo -= o * 0.35; q.brk -= o * 0.3; q.ctrl -= o * 0.35; }
    if (tr(p, 'limit90') && pc >= 90) { q.ctrl -= 15; notes.push('limit90'); }
    const on = ctx.bases.some(Boolean);
    if (tr(p, 'stretch') && on) { q.ctrl -= 10; notes.push('stretch'); }
    if (tr(p, 'rhythm') && on) { q.ctrl -= 5; }
    if (tr(p, 'lateFade') && G.si >= 6 && !G.post) { q.velo -= 6; q.brk -= 4; notes.push('lateFade'); }
    if (tr(p, 'vsLHB') && ctx.bats === 'L') { const c = (50 - tr(p, 'vsLHB')) / 2 + 8; q.velo -= c / 2; q.brk -= c / 2; notes.push('vsLHB'); }
    if ((ctx.bases[1] || ctx.bases[2]) && q.cool) { const c = (q.cool - 50) / 6; q.velo += c / 2; q.ctrl += c; }
    const cat = G.catcher && G.catcher[ctx.fside];
    const lead = cat && tr(pl(X, L, cat), 'lead'); if (lead) q.ctrl += (lead - 60) / 10;
    // 하루 피로 (어제 많이 던졌으면)
    const f = L.fat[p.id]; if (f && G.day - f.day === 1 && f.pc > 25) { q.velo -= 4; q.ctrl -= 3; }
    q.stuff = q.velo * 0.6 + q.brk * 0.4;
    return { q, notes };
  }
  const limitOf = (p) => p.role === 'SP' || p.role == null ? Math.round(52 + (p.p.stam || 50) * 0.62) : Math.round(18 + (p.p.stam || 40) * 0.5);

  // ---------- 경기 만들기 ----------
  function pickStarter(X, L, tid, day) {
    const ps = roster(X, L, tid).filter(p => p.pos === 'P' && p.role === 'SP' && !(L.inj[p.id] > day));
    ps.sort((a, b) => (b.p.velo * 0.5 + b.p.ctrl * 0.3 + b.p.brk * 0.2) - (a.p.velo * 0.5 + a.p.ctrl * 0.3 + a.p.brk * 0.2));
    const rested = ps.filter(p => { const f = L.fat[p.id]; return !f || day - f.day >= 4; });
    return (rested[0] || ps.sort((a, b) => ((L.fat[a.id] || {}).day || -9) - ((L.fat[b.id] || {}).day || -9))[0] || ps[0]).id;
  }
  const ovr = (p) => p.b ? (p.b.con * 1.2 + p.b.pow + p.b.eye * 0.6 + p.b.spd * 0.5 + p.b.defn * 0.9 + p.b.arm * 0.4) / 4.6 : 0;
  function autoLineup(X, L, tid, day, rng) {
    const all = roster(X, L, tid);
    const field = all.filter(p => p.pos !== 'P');
    const out = [];
    for (const pos of FIELD.slice(1)) {
      let st = field.find(p => p.pos === pos && p.named !== false && !p.me && !(L.inj[p.id] > day));
      if (L.me && L.me.team === tid && L.me.pos === pos && L.me.pos !== 'P' && !(L.inj.ME > day)) {
        // 주전 경쟁: 신인 능력 + 컨디션 + 신뢰가 주전에 가까우면 기회
        const meO = ovr(L.me) + CONDV[L.cond.ME] + (L.rel.ME - 50) / 10, stO = st ? ovr(st) + CONDV[L.cond[st.id]] : 0;
        if (!st || meO >= stO - 3 || (meO >= stO - 10 && rng() < 0.18)) st = L.me;
      }
      if (!st) st = field.find(p => !out.some(o => o.id === p.id) && !(L.inj[p.id] > day) && (p.pos === 'UT' || true));
      out.push({ id: st.id, pos });
    }
    // 타순: 프로필 타순, 빈자리는 능력순
    const ord = (p) => p.me ? 6.5 : (p.order || 6);
    out.sort((a, b) => ord(pl(X, L, a.id)) - ord(pl(X, L, b.id)));
    out.push({ id: null, pos: 'P' });
    return out.slice(0, 9);
  }
  function newGame(X, L, gm, opt) {
    opt = opt || {};
    const rng = RNG(L.rs); const r = () => { const v = rng(); return v; };
    const day = gm.day;
    const lineup = [autoLineup(X, L, gm.away, day, r), autoLineup(X, L, gm.home, day, r)];
    if (opt.lineup && L.my) { const side = gm.home === L.my ? 1 : 0; if (opt.lineup.length === 9) lineup[side] = opt.lineup.map(x => Object.assign({}, x)); }
    const sp = [opt.sp && gm.away === L.my ? opt.sp : pickStarter(X, L, gm.away, day), opt.sp && gm.home === L.my ? opt.sp : pickStarter(X, L, gm.home, day)];
    lineup.forEach((lu, s) => { const i = lu.findIndex(x => x.pos === 'P'); lu[i].id = sp[s]; });
    L.rs = rng.get();
    const G = {
      no: gm.no, si: gm.si, gi: gm.gi, day, post: gm.post || null, home: gm.home, away: gm.away, teams: [gm.away, gm.home],
      inn: 1, half: 0, outs: 0, bases: [null, null, null], score: [0, 0], line: [[], []], hits: [0, 0], errs: [0, 0], bo: [0, 0], lineup, pitcher: sp.slice(), pc: {}, used: [[sp[0]], [sp[1]]],
      pstat: {}, bstat: {}, log: [], wp: [0.5], over: false, maxInn: 9, lastK: {}, catcher: [lineup[0].find(x => x.pos === 'C').id, lineup[1].find(x => x.pos === 'C').id],
      lead: null, wl: null, saveCand: null, phUsed: [0, 0], pinch: {}, ev: [], mgr: [], shift: [false, false], visit: null, warm: [null, null], keep: [false, false], lapse: {}
    };
    // 그날 집중력이 흐트러진 선수(집중력 기복)
    for (const s of [0, 1]) for (const x of lineup[s]) { const p = pl(X, L, x.id); if (p && tr(p, 'lapse') && rng() < 0.15) G.lapse[p.id] = 1; }
    for (const s of [0, 1]) { pst(G, sp[s]).gs = 1; }
    L.rs = rng.get();
    return G;
  }
  const pst = (G, id) => G.pstat[id] = G.pstat[id] || { outs: 0, h: 0, r: 0, er: 0, bb: 0, k: 0, hr: 0, bf: 0, np: 0, gs: 0 };
  const bst = (G, id) => G.bstat[id] = G.bstat[id] || { pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, r: 0, rbi: 0, bb: 0, k: 0, sb: 0, cs: 0, e: 0 };
  const bside = (G) => G.half;           // 공격 팀 0=원정 1=홈
  const fside = (G) => 1 - G.half;
  const batterId = (G) => { const s = bside(G); return G.lineup[s][G.bo[s] % 9].id; };
  const fielder = (G, pos) => { const x = G.lineup[fside(G)].find(y => y.pos === pos); return x && x.id; };
  function ctxOf(X, L, G) {
    const s = bside(G), bat = pl(X, L, batterId(G)), pit = pl(X, L, G.pitcher[fside(G)]);
    const diff = G.score[s] - G.score[1 - s];
    return { s, bat, pit, home: s === 1, bases: G.bases.slice(), inn: G.inn, outs: G.outs, diff, pThrows: pit.throws, bats: bat.bats === 'S' ? (pit.throws === 'L' ? 'R' : 'L') : bat.bats, fside: fside(G), lastK: G.lastK[bat.id], pinch: !!G.pinch[bat.id] };
  }

  // ---------- 결정 순간 ----------
  // 득점권 + 7회 이후 2점 차 이내, 또는 투수 위기(한계 투구 수 근처 + 주자) → 감독에게 묻는다
  function decisionAt(X, L, G) {
    if (G.over || !L.my) return null;
    const my = G.teams.indexOf(L.my); if (my < 0) return null;
    const s = bside(G), diff = G.score[s] - G.score[1 - s];
    const risp = G.bases[1] || G.bases[2];
    const close = G.inn >= 7 && Math.abs(diff) <= 2;
    if (s === my && risp && close) return { side: 'off', why: `${G.inn}회 득점권 · ${Math.abs(diff) ? (diff > 0 ? diff + '점 앞섬' : -diff + '점 뒤짐') : '동점'}` };
    if (s !== my) {
      const p = pl(X, L, G.pitcher[my]), pc = G.pc[p.id] || 0;
      if (G.bases.some(Boolean) && pc >= limitOf(p) - 6 && !G.keep[my]) return { side: 'def', why: `${p.name} ${pc}구 · 주자 있음` };
      if (risp && close) return { side: 'def', why: `${G.inn}회 위기 · ${Math.abs(diff) ? (diff > 0 ? '상대 ' + diff + '점 뒤짐' : '상대 ' + -diff + '점 앞섬') : '동점'}` };
    }
    return null;
  }
  // 감독 작전 목록 (화면 단추)
  function orderOptions(X, L, G, side) {
    const my = G.teams.indexOf(L.my), o = [];
    if (side === 'off') {
      o.push({ k: 'free', label: '강공 · 선수들에게 맡긴다' });
      if (G.outs < 2 && (G.bases[0] || G.bases[1]) && !G.bases[2]) o.push({ k: 'bunt', label: '희생번트' });
      if (G.bases[0] && !G.bases[1]) o.push({ k: 'steal', label: `도루 · ${pl(X, L, G.bases[0].id).name}` });
      if (G.bases[1] && !G.bases[2] && G.outs < 2) o.push({ k: 'steal3', label: `3루 도루 · ${pl(X, L, G.bases[1].id).name}` });
      if (G.bases[0] && G.outs < 2) o.push({ k: 'hitrun', label: '히트앤런' });
      const bench = benchOf(X, L, G, my);
      for (const b of bench.slice(0, 3)) o.push({ k: 'ph', id: b.id, label: `대타 · ${b.name}` });
      if (G.bases.some(Boolean)) { const r = bench.filter(b => b.b.spd >= 60)[0]; if (r) o.push({ k: 'pr', id: r.id, label: `대주자 · ${r.name}` }); }
    } else {
      o.push({ k: 'free', label: '정면승부' });
      if (!G.bases[0] || !(G.bases[0] && G.bases[1] && G.bases[2])) if (!(G.bases[0] && G.bases[1] && G.bases[2])) o.push({ k: 'ibb', label: '고의4구' });
      o.push({ k: 'visit', label: '마운드 방문 (한 타자 집중)' });
      o.push({ k: 'shift', label: G.shift[my] ? '수비 시프트 풀기' : '수비 시프트' });
      o.push({ k: 'keep', label: '한 타자만 더 맡긴다' });
      for (const p of bullpenOf(X, L, G, my).slice(0, 4)) o.push({ k: 'pc', id: p.id, label: `투수 교체 · ${p.name}${p.role === 'CL' ? ' (마무리)' : ''}${L.fat[p.id] && G.day - L.fat[p.id].day <= 1 ? ' · 어제 등판' : ''}` });
    }
    return o;
  }
  function benchOf(X, L, G, s) {
    const inGame = new Set(G.lineup[s].map(x => x.id).concat(G.used[s]));
    for (const id of Object.keys(G.pinch)) inGame.add(id);
    return roster(X, L, G.teams[s]).filter(p => p.pos !== 'P' && !inGame.has(p.id) && !(L.inj[p.id] > G.day) && !(G.subbed || {})[p.id]);
  }
  function bullpenOf(X, L, G, s) {
    const used = new Set(G.used[s]);
    const ps = roster(X, L, G.teams[s]).filter(p => p.pos === 'P' && !used.has(p.id) && p.role !== 'SP' && !(L.inj[p.id] > G.day));
    const tired = (p) => { const f = L.fat[p.id]; if (!f) return 0; const d = G.day - f.day; return d === 0 ? 3 : d === 1 ? (f.pc > 25 || f.b2b ? 2 : 1) : 0; };
    return ps.sort((a, b) => tired(a) - tired(b) || (b.p.velo + b.p.brk) - (a.p.velo + a.p.brk));
  }

  // ---------- 작전 적용 (타석 전) ----------
  function applyOrder(X, L, G, ord, rng) {
    if (!ord || ord.k === 'free') return null;
    const s = bside(G), my = G.teams.indexOf(L.my);
    const note = { k: ord.k, by: ord.by || 'mgr' };
    if (ord.k === 'pc') { changePitcher(X, L, G, fside(G), ord.id); note.label = `투수 교체 → ${pl(X, L, ord.id).name}`; G.mgr.push(note); return note; }
    if (ord.k === 'ph') {
      const old = batterId(G); const i = G.bo[s] % 9; const slot = G.lineup[s][i];
      G.pinch[ord.id] = old; G.used[s].push(old); (G.subbed = G.subbed || {})[old] = 1;
      slot.id = ord.id; if (slot.pos === 'P') slot.pos = 'P*';
      L.rel[old] = clamp((L.rel[old] || 50) - 3, 0, 100);
      note.label = `대타 ${pl(X, L, ord.id).name} (← ${pl(X, L, old).name})`; G.mgr.push(note); G.phUsed[s]++; return note;
    }
    if (ord.k === 'pr') {
      const bi = G.bases[2] ? 2 : G.bases[1] ? 1 : 0; const old = G.bases[bi].id;
      const slot = G.lineup[s].find(x => x.id === old); if (slot) slot.id = ord.id;
      G.bases[bi] = Object.assign({}, G.bases[bi], { id: ord.id }); (G.subbed = G.subbed || {})[old] = 1; G.used[s].push(old);
      note.label = `대주자 ${pl(X, L, ord.id).name} (← ${pl(X, L, old).name})`; G.mgr.push(note); return note;
    }
    if (ord.k === 'shift') { G.shift[my] = !G.shift[my]; note.label = G.shift[my] ? '수비 시프트' : '시프트 해제'; G.mgr.push(note); return null; }
    if (ord.k === 'keep') { G.keep[my] = true; note.label = '한 타자 더'; G.mgr.push(note); return note; }
    if (ord.k === 'visit') { G.visit = { id: G.pitcher[fside(G)], n: 1 }; note.label = '마운드 방문'; G.mgr.push(note); return note; }
    // 번트·도루·히트앤런·고의4구 = 이번 타석 작전
    const p = pl(X, L, ord.k.startsWith('steal') ? (G.bases[ord.k === 'steal3' ? 1 : 0] || {}).id : batterId(G));
    if (p && (L.rel[p.id] || 50) <= 30 && ord.by !== 'ai' && rng() < 0.15 && ord.k !== 'ibb') { note.ignored = true; note.label = `${p.name} 사인 무시`; G.mgr.push(note); return note; }
    note.label = { bunt: '희생번트', steal: '도루', steal3: '3루 도루', hitrun: '히트앤런', ibb: '고의4구' }[ord.k] || ord.k;
    G.mgr.push(note);
    return note;
  }
  function changePitcher(X, L, G, side, id) {
    const old = G.pitcher[side];
    G.pitcher[side] = id; G.used[side].push(id); G.keep[side] = false;
    const slot = G.lineup[side].find(x => x.id === old && (x.pos === 'P' || x.pos === 'P*'));
    if (slot) { slot.id = id; slot.pos = 'P'; }
    else { const ps = G.lineup[side].find(x => x.pos === 'P*'); if (ps) { /* 대타가 들어간 자리 → 투수가 다음 타석 */ } }
    pst(G, id);
    G.warm[side] = null;
    G.ev.push({ k: 'pchange', side, from: old, to: id, inn: G.inn, half: G.half });
  }
  // 컴퓨터 감독 (투수 교체·대타·도루)
  function aiManage(X, L, G, rng, opts) {
    opts = opts || {};
    const out = [];
    for (const side of [0, 1]) {
      if (opts.skip === side) continue;
      if (side !== fside(G)) continue;
      const p = pl(X, L, G.pitcher[side]), pc = G.pc[p.id] || 0, lim = limitOf(p), ps = G.pstat[p.id] || {};
      const lead = G.score[side] - G.score[1 - side];
      let pull = false;
      if (G.keep[side]) pull = false;
      else if (p.role === 'SP' || p.role == null) {
        pull = pc >= lim + 6 || ps.r >= 6 || (ps.r >= 4 && G.inn >= 5 && pc >= lim - 25) || (pc >= lim - 4 && G.bases.some(Boolean) && G.inn >= 6);
        if (G.inn >= 9 && Math.abs(lead) <= 3 && lead > 0 && G.outs === 0 && !G.bases.some(Boolean) && (G.pstat[p.id] || {}).outs >= 24 && pc < lim) pull = false;
        else if (G.inn >= 9 && lead > 0 && lead <= 3 && G.outs === 0 && !G.bases.some(Boolean)) pull = true;
      } else {
        const outs = ps.outs || 0;
        pull = pc >= lim || (outs >= 3 && G.outs === 0 && !G.bases.some(Boolean)) || (ps.r >= 3);
        if (p.role === 'CL' && outs < 3 && pc < lim + 10 && ps.r < 3) pull = false;
      }
      if (G.inn > (G.maxInn || 9) + 2) pull = pull && pc >= lim + 15;
      if (!pull) { if (pc >= lim - 12 && !G.warm[side]) { const b = bullpenOf(X, L, G, side)[0]; if (b) G.warm[side] = b.id; } continue; }
      const pen = bullpenOf(X, L, G, side); if (!pen.length) continue;
      let pick = pen[0];
      const cl = pen.find(x => x.role === 'CL');
      if (cl && G.inn >= 9 && lead > 0 && lead <= 3) pick = cl;
      else if (cl && pick.id === cl.id && pen.length > 1 && !(G.inn >= 8 && lead > 0 && lead <= 3)) pick = pen[1];
      changePitcher(X, L, G, side, pick.id); out.push({ k: 'pc', side, id: pick.id });
    }
    // 투수 자리 대타 (7회 이후 지고 있을 때 한 번)
    const s = bside(G);
    if (opts.skip !== s) {
      const slot = G.lineup[s][G.bo[s] % 9];
      const diff = G.score[s] - G.score[1 - s];
      if (slot.pos === 'P' && G.inn >= 7 && diff <= 0 && diff >= -4 && G.phUsed[s] < 1) {
        const ph = benchOf(X, L, G, s)[0];
        if (ph && pl(X, L, slot.id).role !== 'CL') { applyOrder(X, L, G, { k: 'ph', id: ph.id, by: 'ai' }, rng); out.push({ k: 'ph', side: s }); }
      }
    }
    return out;
  }
  // 컴퓨터 도루 시도 (타석 전)
  function aiSteal(X, L, G, rng, s) {
    if (G.bases[0] && !G.bases[1] && G.outs < 2) {
      const r = pl(X, L, G.bases[0].id); const sp = r.b.spd + (tr(r, 'runFirst') ? 8 : 0);
      if (sp >= 72 && rng() < 0.07 + (sp - 72) / 150) return { k: 'steal', by: 'ai' };
    }
    return null;
  }
  function doSteal(X, L, G, rng, which) {
    const bi = which === 'steal3' ? 1 : 0; const run = G.bases[bi]; if (!run) return null;
    const r = pl(X, L, run.id), cat = pl(X, L, G.catcher[fside(G)]), pit = pl(X, L, G.pitcher[fside(G)]);
    let p = 0.66 + (r.b.spd - 60) * 0.008 - (cat.b.arm - 60) * 0.005 - ((pit.p.hold || 50) - 50) * 0.003 - (which === 'steal3' ? 0.06 : 0);
    if (tr(pit, 'rhythm')) p -= 0.06;
    const pickoff = tr(r, 'runFirst') && rng() < 0.05;
    const t = (1.85 + (75 - cat.b.arm) * 0.006 + rng() * 0.12).toFixed(1);
    const ok = !pickoff && rng() < clamp(p, 0.2, 0.95);
    const e = { k: pickoff ? 'PO' : ok ? 'SB' : 'CS', run: run.id, from: bi + 1, cat: cat.id, time: t };
    if (ok) { G.bases[bi + 1] = run; G.bases[bi] = null; st(L, run.id, 'bat', G.post).sb++; bst(G, run.id).sb++; }
    else { G.bases[bi] = null; G.outs++; st(L, run.id, 'bat', G.post).cs++; bst(G, run.id).cs++; pst(G, pit.id).outs++; }
    return e;
  }

  // ---------- 한 타석 확률 ----------
  function paRates(X, L, G, ctx, ord) {
    const B = batSkill(X, L, G, ctx.bat, ctx), Q = pitSkill(X, L, G, ctx.pit, ctx);
    const b = B.b, q = Q.q;
    if (G.visit && G.visit.id === ctx.pit.id) { q.ctrl += 6; q.velo += 2; }
    const park = (X.T[G.home].park || 1);
    // 보정 기준: 투수 구위가 타자보다 평균적으로 높게 잡혀 있어 CAL 만큼 타자 쪽으로 맞춘다 (시즌 시뮬로 튜닝: tools/league/season.js)
    let K = 0.20 + (q.stuff - b.con - CAL.k) * 0.0026 + B.kAdd;
    let BB = 0.08 + (b.eye - q.ctrl + CAL.bb) * 0.0013;
    let HR = 0.025 * clamp(1 + (b.pow - q.stuff + CAL.hr) / 42, 0.08, 2.6) * park;
    const hm = clamp(1 + (b.con - q.stuff + CAL.hit) / 110, 0.55, 1.5);
    let S1 = 0.152 * hm, D2 = 0.044 * hm * clamp(1 + (b.pow - 50) / 90, 0.5, 1.7), T3 = 0.005 * clamp(1 + (b.spd - 50) / 25, 0.2, 3);
    if (tr(ctx.pit, 'grounder')) { HR *= b.pow >= 80 ? 1.25 : 0.7; K -= 0.02; }
    if (ord && ord.k === 'hitrun') { K -= 0.03; S1 *= 1.08; }
    if (ctx.pinch && !tr(ctx.bat, 'pinch')) K += 0.02;
    K = clamp(K, 0.05, 0.42); BB = clamp(BB, 0.02, 0.18);
    const notes = B.notes.concat(Q.notes);
    return { K, BB, HR, S1, D2, T3, b, q, notes };
  }
  // 투구 순서 만들기 (결과와 맞는 볼카운트 경로)
  const IP_CNT = [[[0, 0], 16], [[0, 1], 10], [[1, 0], 8], [[1, 1], 10], [[0, 2], 7], [[2, 0], 3], [[1, 2], 12], [[2, 1], 6], [[2, 2], 12], [[3, 0], 1], [[3, 1], 4], [[3, 2], 9]];
  function pickType(rng, p, b, s, fastFirst) {
    const ps = p.pitches || ['직구', '슬라이더'];
    const fast = ps.filter(x => PT[x] && PT[x].fast), slow = ps.filter(x => !(PT[x] && PT[x].fast));
    let pf = 0.55; if (b === 3 || (b >= 2 && s === 0)) pf = 0.8; if (s === 2) pf = 0.38; if (fastFirst) pf = 0.65;
    if (!slow.length) return fast[0]; if (!fast.length) return rng.pick(slow);
    return rng() < pf ? rng.pick(fast) : rng.pick(slow);
  }
  function kmhOf(rng, X, p, type, G) {
    const t = X.T[p.team] || {}; const w = (p.gender || t.gender) === 'W';
    const base = w ? 124 + (p.p.velo - 50) * 0.32 : 138 + (p.p.velo - 50) * 0.4;
    const pc = G.pc[p.id] || 0, lim = limitOf(p);
    return Math.round(base + (PT[type] ? PT[type].d : 0) + rng.n(0, 1.3) - (pc > lim ? (pc - lim) * 0.12 : 0));
  }
  function genPitches(rng, X, G, ctx, out, R) {
    const fp = tr(ctx.bat, 'firstPitch');
    let pre;
    if (out === 'K') pre = [rng.w([[0, 25], [1, 32], [2, 28], [3, 15]]), 2];
    else if (out === 'BB') pre = [3, rng.w([[0, 30], [1, 35], [2, 35]])];
    else if (out === 'IBB') pre = [3, 0];
    else if (out === 'BUNT') pre = [rng.w([[0, 60], [1, 30], [2, 10]]), rng.w([[0, 70], [1, 30]])];
    else pre = fp && rng() < 0.45 ? [0, rng() < 0.6 ? 0 : 1] : rng.w(IP_CNT);
    let seq = []; for (let i = 0; i < pre[0]; i++) seq.push('B'); for (let i = 0; i < pre[1]; i++) seq.push('s');
    for (let i = seq.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [seq[i], seq[j]] = [seq[j], seq[i]]; }
    if (pre[1] === 2 && out !== 'IBB') { let f = 0; while (rng() < 0.42 && f < 6) f++; const at = seq.lastIndexOf('s') + 1; for (let i = 0; i < f; i++) seq.splice(at, 0, 'F'); }
    const fin = out === 'K' ? (rng() < 0.62 ? 'S' : 'L') : (out === 'BB' || out === 'IBB') ? 'B' : 'X';
    seq.push(fin);
    const res = []; let b = 0, s = 0;
    for (let i = 0; i < seq.length; i++) {
      let r = seq[i]; if (r === 's') r = rng.w([['S', 32], ['L', 36], ['F', 32]]);
      const t = out === 'IBB' ? '직구' : pickType(rng, ctx.pit, b, s, i === 0 && fp);
      let z;
      if (out === 'IBB') z = 11;
      else if (r === 'B') z = 9 + (PT[t] && !PT[t].fast ? rng.w([[1, 50], [2, 30], [0, 10], [3, 10]]) : rng.w([[0, 35], [2, 30], [3, 25], [1, 10]]));
      else if (r === 'X' && (out === 'HR' || out === '2B') && rng() < 0.45) z = 4;
      else { const edge = clamp((R.q.ctrl - 40) / 60, 0.2, 0.9); z = rng() < edge ? rng.pick([0, 2, 3, 5, 6, 8, 1, 7]) : rng.pick([1, 3, 4, 5, 7]); if (PT[t] && !PT[t].fast && rng() < 0.5) z = rng.pick([6, 7, 8]); }
      if (r === 'S' && PT[t] && !PT[t].fast && rng() < 0.35) z = 10;
      res.push([t, kmhOf(rng, X, ctx.pit, t, G), z, r]);
      if (r === 'B') b++; else if (r === 'S' || r === 'L') s++; else if (r === 'F' && s < 2) s++;
    }
    return res;
  }

  // ---------- 타구 방향·수비 ----------
  function battedBall(rng, ctx, out) {
    const L = ctx.bats === 'L';
    const dir = rng.w([['pull', 42], ['mid', 33], ['oppo', 25]]);
    const side = dir === 'mid' ? 'mid' : ((dir === 'pull') !== L ? 'left' : 'right');
    let type;
    if (out === 'HR') type = 'fly'; else if (out === '3B') type = 'line'; else if (out === '2B') type = rng() < 0.6 ? 'line' : 'fly';
    else if (out === '1B') type = rng.w([['ground', 55], ['line', 40], ['fly', 5]]);
    else type = rng.w([['ground', 46], ['fly', 34], ['line', 14], ['pop', 6]]);
    let pos;
    if (type === 'ground' || type === 'pop') pos = side === 'left' ? rng.pick(['3B', 'SS']) : side === 'right' ? rng.pick(['2B', '1B']) : rng.w([['SS', 4], ['2B', 4], ['P', 2]]);
    else if (type === 'line' && rng() < 0.4 && out !== '2B' && out !== '3B') pos = side === 'left' ? rng.pick(['3B', 'SS']) : side === 'right' ? rng.pick(['2B', '1B']) : 'SS';
    else pos = side === 'left' ? 'LF' : side === 'right' ? 'RF' : 'CF';
    if (type === 'pop' && rng() < 0.3) pos = 'C';
    const ev = Math.round(out === 'HR' ? 160 + rng() * 25 : type === 'line' ? 145 + rng() * 25 : type === 'ground' ? 115 + rng() * 40 : type === 'pop' ? 90 + rng() * 20 : 120 + rng() * 40);
    return { dir: side, type, pos, ev };
  }
  function hitText(out, bb) {
    const lr = bb.dir === 'left' ? '좌' : bb.dir === 'right' ? '우' : '중';
    if (out === 'HR') return `${lr}월 홈런`;
    if (out === '3B') return `${bb.dir === 'right' ? '우중간' : bb.dir === 'left' ? '좌중간' : '중견수 키 넘기는'} 3루타`;
    if (out === '2B') return `${bb.dir === 'mid' ? '중견수 키 넘기는' : (bb.type === 'line' && Math.random() < 0.5 ? lr + '선상' : lr + '중간')} 2루타`;
    if (out === '1B') return /B$|SS|P/.test(bb.pos) && bb.type === 'ground' ? (bb.inf ? '내야 안타' : `${lr}전 안타`) : `${lr}전 안타`;
    return '';
  }

  // ---------- 타석 계획 (결과 + 투구 순서) ----------
  function planPA(X, L, G, ord, rng) {
    const ctx = ctxOf(X, L, G);
    const R = paRates(X, L, G, ctx, ord);
    let out;
    if (ord && ord.k === 'ibb' && !ord.ignored) out = 'IBB';
    else if (ord && ord.k === 'bunt' && !ord.ignored) out = 'BUNT';
    else {
      const r = rng();
      const cut = [['K', R.K], ['BB', R.BB], ['HR', R.HR], ['3B', R.T3], ['2B', R.D2], ['1B', R.S1]];
      let acc = 0; out = 'OUT';
      for (const [k, v] of cut) { acc += v; if (r < acc) { out = k; break; } }
    }
    const pa = { bat: ctx.bat.id, pit: ctx.pit.id, inn: G.inn, half: G.half, outs: G.outs, bases: G.bases.map(x => x && x.id), score: G.score.slice(), pc0: G.pc[ctx.pit.id] || 0, notes: R.notes, ord: ord || null };
    pa.pitches = genPitches(rng, X, G, ctx, out === 'BUNT' ? 'BUNT' : out, R);
    pa.raw = out;
    return { pa, ctx, R };
  }
  // 공 하나하나의 결과가 정해진 타석을 경기에 반영 (자동 시뮬 · 직접 플레이 공통)
  function resolvePA(X, L, G, pa, rng, R) {
    const ctx = ctxOf(X, L, G);
    R = R || paRates(X, L, G, ctx, pa.ord);
    const fs = fside(G), bs = bside(G);
    const pitId = pa.pit, batId = pa.bat, bat = ctx.bat, pit = ctx.pit;
    let out = pa.raw;
    let bb = null, desc = '', rbi = 0, runs = [], outsAdd = 0, err = null, tags = [], conv = null;
    const before = { score: G.score.slice(), wp: winProb(G), bases: G.bases.slice(), outs: G.outs };
    const defOf = (pos) => { const id = fielder(G, pos); const p = id && pl(X, L, id); if (!p) return 50; let d = p.b.defn; if (G.lapse[p.id] && /F$/.test(pos)) d -= 22; if (tr(p, 'lateFocus') && G.inn >= 7) d -= 10; if (tr(p, 'hothead') && G.lastK[p.id]) d += 10; return d; };
    const runnerSpd = (r) => r ? pl(X, L, r.id).b.spd + (tr(pl(X, L, r.id), 'smart') ? 8 : 0) : 50;
    const scoreRun = (r, earned) => { if (!r) return; runs.push({ id: r.id, pit: r.pit, er: earned !== false && !r.une }); };
    const B = G.bases;
    const newB = [null, null, null];
    const bRunner = { id: batId, pit: pitId };
    if (out === 'IBB' || out === 'BB') {
      desc = out === 'IBB' ? '고의4구' : '볼넷';
      if (B[0]) { if (B[1]) { if (B[2]) scoreRun(B[2]); newB[2] = B[1]; } else { newB[2] = B[2]; } newB[1] = B[0]; } else { newB[1] = B[1]; newB[2] = B[2]; }
      newB[0] = bRunner;
      if (B[0] && B[1] && B[2]) rbi = 1;
    } else if (out === 'K') {
      desc = pa.pitches[pa.pitches.length - 1][3] === 'L' ? '루킹 삼진' : '헛스윙 삼진'; outsAdd = 1; newB[0] = B[0]; newB[1] = B[1]; newB[2] = B[2];
      if (pa.ord && pa.ord.k === 'hitrun' && B[0] && !B[1]) { if (rng() < 0.5) { newB[0] = null; outsAdd = 2; desc += ' · 주자 2루에서 잡힘 (삼진 병살)'; } else { newB[1] = B[0]; newB[0] = null; desc += ' · 주자 2루 세이프'; } }
    } else if (out === 'BUNT') {
      const sk = (tr(bat, 'bunt') || 50); const ok = rng() < clamp(0.62 + (sk - 50) * 0.008 + (L.rel[batId] >= 70 ? 0.05 : 0), 0.35, 0.96);
      bb = { dir: 'mid', type: 'ground', pos: rng.pick(['P', '1B', '3B', 'C']), ev: 60 };
      if (ok) {
        desc = '희생번트 성공'; outsAdd = 1;
        if (B[2]) { if (G.outs < 2 && rng() < 0.6) { scoreRun(B[2]); rbi = 1; desc = '스퀴즈 번트 성공'; } else newB[2] = B[2]; }
        if (B[1]) newB[2] = B[1];
        newB[1] = B[0];
        if (bat.b.spd >= 85 && rng() < 0.12) { newB[0] = bRunner; outsAdd = 0; desc = '번트 안타'; out = '1B'; }
        else st(L, batId, 'bat', G.post).sh++;
      } else {
        desc = '번트 실패 · 선행 주자 아웃'; outsAdd = 1; newB[0] = bRunner; newB[2] = B[2];
        newB[1] = B[1] ? B[0] : null;
      }
    } else {
      bb = battedBall(rng, ctx, out);
      // 수비: 안타 → 아웃(호수비), 아웃 → 안타(빈틈)
      const d = defOf(bb.pos);
      if (out === '1B' || out === '2B') {
        let p = Math.max(0, (d - 50) * 0.003);
        if (G.shift[fs] && bb.type === 'ground' && bat.b.pow >= 80 && ((bb.dir === 'right') === (ctx.bats === 'L'))) p += 0.12;
        if (rng() < p) { conv = { from: out, pos: bb.pos, id: fielder(G, bb.pos) }; out = 'OUT'; tags.push('호수비'); }
      } else if (out === 'OUT' && d < 50 && rng() < (50 - d) * 0.003 && bb.type !== 'pop') { out = '1B'; }
      if (out === '1B' && bb.type === 'ground' && /B$|SS|P/.test(bb.pos)) { if (rng() < 0.12 + (bat.b.spd - 50) * 0.004) bb.inf = true; else bb.pos = bb.dir === 'left' ? 'LF' : bb.dir === 'right' ? 'RF' : 'CF'; }
      if (out === 'OUT') {
        const fid = fielder(G, bb.pos), fp = fid && pl(X, L, fid);
        const eP = 0.011 + (55 - d) * 0.0005 + (fp && tr(fp, 'wildThrow') ? 0.006 : 0) + (fp && tr(fp, 'hothead') && G.lastK[fp.id] ? 0.006 : 0);
        if (bb.type !== 'pop' && rng() < clamp(eP, 0.002, 0.05)) {
          err = { id: fid, pos: bb.pos }; out = 'E'; desc = `${POSKO[bb.pos]} 실책`;
          if (B[2]) scoreRun(B[2], false); newB[2] = B[1]; newB[1] = B[0]; newB[0] = Object.assign({ une: 1 }, bRunner);
          G.errs[fs]++; st(L, fid, 'bat', G.post).e++; tags.push('실책');
        }
      }
      if (out === 'HR') {
        for (const r of B) scoreRun(r); scoreRun(bRunner); rbi = runs.length;
        desc = `${hitText('HR', bb)}${rbi === 4 ? ' (만루 홈런)' : rbi === 3 ? ' (스리런)' : rbi === 2 ? ' (투런)' : ' (솔로)'}`;
      } else if (out === '3B') {
        for (const r of B) scoreRun(r); newB[2] = bRunner; rbi = runs.length; desc = hitText('3B', bb);
      } else if (out === '2B') {
        if (B[2]) scoreRun(B[2]); if (B[1]) scoreRun(B[1]);
        if (B[0]) { const pr = 0.4 + (runnerSpd(B[0]) - 50) * 0.007 + (G.outs === 2 ? 0.15 : 0); if (rng() < pr) scoreRun(B[0]); else newB[2] = B[0]; }
        newB[1] = bRunner; rbi = runs.filter(r => !r.une).length; desc = hitText('2B', bb);
      } else if (out === '1B') {
        if (B[2]) scoreRun(B[2]);
        if (B[1]) { const pr = bb.inf ? 0 : 0.55 + (runnerSpd(B[1]) - 50) * 0.008 + (G.outs === 2 ? 0.2 : 0) - (bb.pos === 'RF' || bb.pos === 'LF' ? (defOf(bb.pos) - 60) * 0.002 : 0); if (rng() < pr) scoreRun(B[1]); else newB[2] = B[1]; }
        if (B[0]) { const pr = bb.inf ? 0 : (pa.ord && pa.ord.k === 'hitrun' ? 0.75 : 0.25 + (runnerSpd(B[0]) - 50) * 0.006 + (bb.dir === 'right' ? 0.12 : 0)); if (!newB[2] && rng() < pr) newB[2] = B[0]; else newB[1] = B[0]; }
        newB[0] = bRunner; rbi = runs.length; desc = hitText('1B', bb);
      } else if (out === 'OUT') {
        outsAdd = 1;
        const P = POSKO[bb.pos];
        newB[0] = B[0]; newB[1] = B[1]; newB[2] = B[2];
        if (bb.type === 'ground') {
          desc = `${P} 땅볼`;
          if (B[0] && G.outs < 2 && !(pa.ord && pa.ord.k === 'hitrun')) {
            const pdp = 0.3 + (50 - bat.b.spd) * 0.006 + (defOf(bb.pos) - 60) * 0.003 + (tr(bat, 'inside') ? 0.06 : 0);
            if (rng() < clamp(pdp, 0.12, 0.8)) {
              outsAdd = 2; desc = `${P} 땅볼 병살`; newB[0] = null; newB[1] = null; newB[2] = B[1] || (G.outs === 0 ? null : B[2]);
              if (B[2] && G.outs === 0) scoreRun(B[2]);
              st(L, batId, 'bat', G.post).gdp++; tags.push('병살');
            } else {
              desc = `${P} 땅볼 · 선행 주자 아웃`; newB[0] = bRunner; newB[1] = null; newB[2] = B[1] || null;
              if (B[2]) { if (B[1] || (G.outs < 2 && rng() < 0.5)) { scoreRun(B[2]); rbi = 1; } else newB[2] = B[2]; }
            }
          } else {
            if (B[2] && G.outs < 2 && rng() < 0.55) { scoreRun(B[2]); rbi = 1; newB[2] = null; desc = `${P} 땅볼 · 3루 주자 홈인`; }
            if (B[1] && !newB[2] && rng() < 0.6) { newB[2] = B[1]; newB[1] = null; }
            if (B[0] && !newB[1]) { newB[1] = B[0]; newB[0] = null; }
            if (pa.ord && pa.ord.k === 'hitrun' && B[0]) { newB[1] = B[0]; newB[0] = null; desc = `${P} 땅볼 · 히트앤런으로 주자 진루`; }
          }
        } else if (bb.type === 'fly') {
          desc = `${P} 뜬공`;
          if (B[2] && G.outs < 2 && /F$/.test(bb.pos)) { const pr = 0.55 + (runnerSpd(B[2]) - 50) * 0.006 - (pl(X, L, fielder(G, bb.pos)).b.arm - 60) * 0.005; if (rng() < pr) { scoreRun(B[2]); rbi = 1; newB[2] = null; desc = `${P} 희생플라이`; st(L, batId, 'bat', G.post).sf++; tags.push('희생플라이'); } }
          if (B[1] && !newB[2] && G.outs < 2 && bb.pos !== 'LF' && rng() < 0.35) { newB[2] = B[1]; newB[1] = null; }
        } else if (bb.type === 'line') desc = `${P} 직선타`;
        else desc = `${P} 플라이`;
        if (conv) desc = `${P} ${conv.from === '2B' ? '다이빙 캐치' : '호수비'}로 ${bb.type === 'ground' ? '땅볼' : '뜬공'} 아웃`;
      }
    }
    // 반영
    const outsBefore = G.outs;
    G.outs += outsAdd;
    const inningOver = G.outs >= 3;
    if (inningOver) runs = runs.filter((r, i) => !(outsAdd >= 1 && /병살|땅볼/.test(desc) && G.outs >= 3) || out === 'HR');
    if (!inningOver) G.bases = newB;
    // 득점
    for (const r of runs) {
      G.score[bs]++; G.line[bs][G.inn - 1] = (G.line[bs][G.inn - 1] || 0) + 1;
      st(L, r.id, 'bat', G.post).r++; bst(G, r.id).r++;
      const rp = r.pit || pitId; pst(G, rp).r++; if (r.er) pst(G, rp).er++;
      const ps = st(L, rp, 'pit', G.post); ps.r++; if (r.er) ps.er++;
    }
    if (out === 'E') rbi = 0;
    // 기록
    const isAB = !['BB', 'IBB'].includes(out) && !(out === 'BUNT' && /성공/.test(desc)) && !/희생플라이/.test(desc);
    const sb = st(L, batId, 'bat', G.post), gb = bst(G, batId), sp = st(L, pitId, 'pit', G.post), gp = pst(G, pitId);
    const hit = ['1B', '2B', '3B', 'HR'].includes(out);
    sb.pa++; gb.pa++; sp.bf++; gp.bf++;
    const np = pa.pitches.length; sp.np += np; gp.np += np; G.pc[pitId] = (G.pc[pitId] || 0) + np;
    if (isAB) { sb.ab++; gb.ab++; }
    if (hit) { sb.h++; gb.h++; sp.h++; gp.h++; G.hits[bs]++; if (out === '2B') { sb.d++; gb.d++; } if (out === '3B') { sb.t++; gb.t++; } if (out === 'HR') { sb.hr++; gb.hr++; sp.hr++; gp.hr++; } }
    if (out === 'BB' || out === 'IBB') { sb.bb++; gb.bb++; sp.bb++; gp.bb++; }
    if (out === 'K') { sb.k++; gb.k++; sp.k++; gp.k++; }
    sb.rbi += rbi; gb.rbi += rbi;
    if (isAB && (before.bases[1] || before.bases[2])) { sb.rab++; if (hit) sb.rh++; }
    const s2 = pa.pitches.slice(0, -1).filter(x => x[3] !== 'B').length >= 2;
    if (isAB && s2) { sb.s2ab++; if (hit) sb.s2h++; }
    if (G.pinch[batId] && !pa.phDone) { sb.ph++; if (hit) sb.phh++; }
    sp.outs += outsAdd; gp.outs += outsAdd;
    // 맞대결
    const hk = pitId + '|' + batId; const h2 = L.h2h[hk] = L.h2h[hk] || [0, 0, 0, 0]; const h2b = h2.slice();
    if (isAB) { h2[0]++; if (hit) h2[1]++; if (out === 'HR') h2[2]++; if (out === 'K') h2[3]++; }
    G.lastK[batId] = out === 'K'; if (err) G.lastK[err.id] = true;
    if (G.visit && G.visit.id === pitId) G.visit = null;
    if (G.keep[fs] && !inningOver) G.keep[fs] = false;
    // 이닝 끝/경기 끝
    G.bo[bs]++;
    let walkoff = false;
    if (G.half === 1 && G.inn >= G.maxInn && G.score[1] > G.score[0]) { walkoff = true; G.over = true; }
    if (inningOver) endHalf(G);
    const after = { score: G.score.slice(), wp: winProb(G) };
    // 태그
    const sgn = (x) => Math.sign(x[bs] - x[1 - bs]);
    if (sgn(before.score) < 0 && sgn(after.score) > 0) tags.push('역전');
    else if (sgn(before.score) < 0 && sgn(after.score) === 0) tags.push('동점');
    else if (sgn(before.score) === 0 && sgn(after.score) > 0 && G.inn >= 6) tags.push('결승타');
    if (walkoff) tags.push('끝내기');
    if (before.bases.every(Boolean)) tags.push('만루');
    if (out === 'HR') tags.push('홈런');
    if (np >= 8) tags.push('긴 승부');
    if (out === 'K' && (before.bases[1] || before.bases[2]) && G.inn >= 7) tags.push('위기 탈출');
    if (hit && sb.h === 1 && !G.post) tags.push('시즌 첫 안타');
    if (out === 'HR' && [1, 5, 10, 15, 20].includes(sb.hr)) tags.push(`시즌 ${sb.hr}호`);
    if (out === 'HR' && gb.hr >= 2) tags.push('멀티홈런');
    if (hit && h2b[0] >= 4 && h2b[1] <= 1) tags.push('설욕');
    if (pa.ord && !pa.ord.ignored && pa.ord.by !== 'ai') tags.push('감독 작전');
    if (pa.user) tags.push('직접 플레이');
    const rec = Object.assign(pa, {
      i: G.log.length, res: out, desc, bb, rbi, runs: runs.map(r => r.id), outsAfter: inningOver ? 3 : G.outs, err,
      scoreAfter: after.score, wpb: before.wp, wpa: after.wp, tags, conv, h2h: h2b, np, ph: G.pinch[batId] ? 1 : undefined
    });
    // 승패 후보 (리드가 바뀐 순간의 투수)
    if (sgn(before.score) <= 0 && sgn(after.score) > 0) G.lead = { side: bs, w: G.pitcher[bs], l: pitId, at: G.log.length };
    else if (sgn(before.score) > 0 && sgn(after.score) <= 0) G.lead = sgn(after.score) === 0 ? null : G.lead;
    if (sgn(before.score) > 0 && sgn(after.score) < 0) G.lead = null;
    if (sgn(after.score) === 0) G.lead = null;
    // 드라마 점수
    const swing = Math.abs((bs === 1 ? after.wp - before.wp : before.wp - after.wp));
    rec.dwp = Math.round(swing * 100);
    rec.drama = Math.round(swing * 100 + tagScore(tags) + (rec.notes && rec.notes.length ? 3 : 0));
    G.log.push(rec);
    G.wp.push(after.wp);
    return rec;
  }
  const TAGPTS = { 끝내기: 40, 역전: 32, 동점: 24, 결승타: 18, 만루: 20, 홈런: 6, '긴 승부': 10, 호수비: 12, 실책: 10, '위기 탈출': 14, '시즌 첫 안타': 15, 멀티홈런: 18, 설욕: 15, '감독 작전': 20, '직접 플레이': 20, 병살: 6, 희생플라이: 4 };
  function tagScore(tags) { let s = 0; for (const t of tags) s += TAGPTS[t] || (/^시즌 \d+호/.test(t) ? 18 : /아크/.test(t) ? 25 : /노히터|탈삼진/.test(t) ? 20 : 0); return s; }

  function endHalf(G) {
    const bs = G.half;
    G.line[bs][G.inn - 1] = G.line[bs][G.inn - 1] || 0;
    G.outs = 0; G.bases = [null, null, null];
    if (G.half === 0) {
      if (G.inn >= G.maxInn && G.score[1] > G.score[0]) { G.over = true; G.line[1][G.inn - 1] = 'X'; return; }
      G.half = 1;
    } else {
      if (G.inn >= G.maxInn && G.score[0] !== G.score[1]) { G.over = true; return; }
      if (G.inn >= 12 && !G.post) { G.over = true; return; }
      if (G.inn >= G.maxInn && G.score[0] === G.score[1]) G.maxInn = G.inn + 1;
      G.inn++; G.half = 0;
    }
    G.ev.push({ k: 'half', inn: G.inn, half: G.half, at: G.log.length });
  }

  // ---------- 타석 하나 진행 (자동) ----------
  // opts.ord = 내 작전, opts.manual = 내 팀은 컴퓨터가 교체하지 않음
  function stepPA(X, L, G, opts) {
    opts = opts || {};
    if (G.over) return null;
    const rng = RNG(L.rs);
    const my = G.teams.indexOf(L.my);
    const skip = opts.manual && my >= 0 ? my : -1;
    aiManage(X, L, G, rng, { skip });
    const pre = [];
    let ord = opts.ord ? Object.assign({}, opts.ord) : null;
    if (ord) { const n = applyOrder(X, L, G, ord, rng); if (n && n.ignored) ord = Object.assign(ord, { ignored: true }); if (['pc', 'ph', 'pr', 'shift', 'keep', 'visit'].includes(ord.k)) ord = ord.k === 'ph' ? Object.assign({}, ord) : null; }
    if (!ord && bside(G) !== skip) { const a = aiSteal(X, L, G, rng, bside(G)); if (a) ord = a; }
    if (ord && (ord.k === 'steal' || ord.k === 'steal3') && !ord.ignored) {
      const e = doSteal(X, L, G, rng, ord.k); if (e) pre.push(e);
      if (G.outs >= 3) { const rec = { pre, half: G.half, inn: G.inn, i: G.log.length, res: 'CS3', desc: '도루 실패로 이닝 종료', bat: batterId(G), pit: G.pitcher[fside(G)], pitches: [], tags: ['감독 작전'], score: G.score.slice(), scoreAfter: G.score.slice(), outs: 2, bases: [], wpb: G.wp[G.wp.length - 1], ord, drama: 20, dwp: 0, np: 0 }; endHalf(G); rec.wpa = winProb(G); G.log.push(rec); G.wp.push(rec.wpa); L.rs = rng.get(); return rec; }
      ord = Object.assign({}, ord, { done: true });
    }
    const { pa, R } = planPA(X, L, G, ord && !ord.done ? ord : (ord && ord.done ? null : null), rng);
    if (ord) pa.ord = ord;
    pa.pre = pre;
    const rec = resolvePA(X, L, G, pa, rng, R);
    L.rs = rng.get();
    if (G.over) finishGame(X, L, G);
    return rec;
  }
  function simToEnd(X, L, G, opts) { let n = 0; while (!G.over && n < 400) { stepPA(X, L, G, opts); n++; } return G; }

  // ---------- 경기 끝: 승패·세이브·피로·컨디션 ----------
  function finishGame(X, L, G) {
    if (G.done) return; G.done = true;
    const gm = G.post ? G.postRef : L.games.find(g => g.no === G.no);
    const [a, h] = G.score;
    const win = a > h ? 0 : h > a ? 1 : -1;
    let W = null, Lp = null, SV = null;
    if (win >= 0) {
      const lead = G.lead && G.lead.side === win ? G.lead : null;
      W = lead ? lead.w : G.pitcher[win]; Lp = lead ? lead.l : G.pitcher[1 - win];
      const sp = G.used[win][0];
      if (W === sp && (G.pstat[sp] || {}).outs < 15) { const rel = G.used[win].slice(1).sort((x, y) => (G.pstat[y].outs || 0) - (G.pstat[x].outs || 0))[0]; if (rel) W = rel; }
      const fin = G.pitcher[win];
      if (fin !== W && G.used[win].length > 1) { const lg = G.score[win] - G.score[1 - win]; if (lg <= 3 || (G.pstat[fin] || {}).outs >= 9) SV = fin; }
    }
    G.res = { W, L: Lp, SV };
    for (const s of [0, 1]) for (const id of G.used[s]) {
      const ps = st(L, id, 'pit', G.post); ps.g++; if (G.pstat[id] && G.pstat[id].gs) ps.gs++;
      if (id === W) ps.w++; if (id === Lp) ps.l++; if (id === SV) ps.sv++;
      const f = L.fat[id]; L.fat[id] = { day: G.day, pc: G.pc[id] || 0, b2b: !!(f && G.day - f.day === 1) };
    }
    for (const s of [0, 1]) for (const x of G.lineup[s]) if (x.id) st(L, x.id, 'bat', G.post).g++;
    for (const id of Object.keys(G.pinch)) st(L, id, 'bat', G.post).g++;
    if (gm) {
      gm.st = 'done'; gm.score = [a, h]; gm.line = G.line.map(r => r.slice()); gm.hits = G.hits.slice(); gm.errs = G.errs.slice(); gm.res = G.res;
      const mine = G.teams.includes(L.my);
      gm.box = boxOf(X, L, G).map(s => ({ bat: s.bat.map(b => ({ id: b.id, ab: b.ab, h: b.h, hr: b.hr, rbi: b.rbi, bb: b.bb, k: b.k })), pit: s.pit.map(q => ({ id: q.id, outs: q.outs, h: q.h, r: q.r, bb: q.bb, k: q.k, np: q.np })) }));
      gm.hl = highlights(X, L, G, mine ? 5 : 2).map(r => slimPA(r)); gm.inn = G.inn;
      if (mine) gm.wp = G.wp.map(x => Math.round(x * 100));
    }
    // 내 팀 경기 = 투구 단위 로그 전체 보관
    if (G.teams.includes(L.my)) L.logs[G.no] = packLog(G);
    // 끝내기·부진에 따른 컨디션·신뢰
    const last = G.log[G.log.length - 1];
    if (last && last.tags.includes('끝내기')) { L.cond[last.bat] = clamp((L.cond[last.bat] || 2) + 1, 0, 4); L.rel[last.bat] = clamp((L.rel[last.bat] || 50) + 4, 0, 100); }
    // 부상 (낮은 확률 · 부상 위험·몸 던지는 수비)
    const rng = RNG(L.rs);
    for (const s of [0, 1]) for (const x of G.lineup[s]) {
      const p = pl(X, L, x.id); if (!p || p.pos === 'P') continue;
      let pr = 0.0025; const inj = tr(p, 'injury'); if (inj) pr *= 1 + (50 - inj) / 12; if (tr(p, 'dive')) pr *= 1.6;
      if (rng() < pr) { const n = 2 + Math.floor(rng() * 6); L.inj[p.id] = G.day + n; L.news.unshift({ k: 'inj', id: p.id, day: G.day, n, text: `${p.name} 부상 · ${n}일 이탈` }); G.injured = (G.injured || []).concat(p.id); }
    }
    L.rs = rng.get();
    if (!G.post) arcCheck(X, L, G);
    else postAfter(X, L, G);
  }
  function boxOf(X, L, G) {
    return [0, 1].map(s => ({
      bat: G.lineup[s].map(x => x.id).concat(Object.keys(G.pinch).filter(id => pl(X, L, id).team === G.teams[s] && !G.lineup[s].some(y => y.id === id))).filter((v, i, a) => v && a.indexOf(v) === i).map(id => Object.assign({ id }, G.bstat[id] || {})).filter(r => r.pa),
      pit: G.used[s].map(id => Object.assign({ id }, G.pstat[id] || {}, { np: G.pc[id] || 0 }))
    }));
  }
  // 저장용 압축 로그
  const ZI = (z) => z;
  function slimPA(r) { return { i: r.i, inn: r.inn, half: r.half, outs: r.outs, bases: r.bases, score: r.score, bat: r.bat, pit: r.pit, pc0: r.pc0, p: (r.pitches || []).map(x => x.slice()), res: r.res, desc: r.desc, rbi: r.rbi, sa: r.scoreAfter, tags: r.tags && r.tags.length ? r.tags : undefined, d: r.drama, w: [Math.round((r.wpb || 0) * 100), Math.round((r.wpa || 0) * 100)], pre: r.pre && r.pre.length ? r.pre : undefined, ord: r.ord ? { k: r.ord.k, label: r.ord.label, by: r.ord.by, ignored: r.ord.ignored } : undefined, notes: r.notes && r.notes.length ? r.notes : undefined, h2h: r.h2h && r.h2h[0] >= 3 ? r.h2h : undefined, user: r.user || undefined, bb: r.bb ? { pos: r.bb.pos, type: r.bb.type, ev: r.bb.ev, dir: r.bb.dir } : undefined }; }
  function packLog(G) { return { teams: G.teams, pa: G.log.map(slimPA), mgr: G.mgr.length ? G.mgr : undefined }; }

  // ---------- 명장면 ----------
  function highlights(X, L, G, n, skip) {
    const log = (G.log || G.pa || []).filter(r => r.res);
    const sk = new Set(skip || []);
    return log.filter(r => !sk.has(r.i)).slice().sort((a, b) => (b.drama || b.d || 0) - (a.drama || a.d || 0)).slice(0, n || 3).sort((a, b) => a.i - b.i);
  }

  // ---------- 개인 아크 (CRION이 조건을 보고 [이벤트]로 낸다) ----------
  //  data.arcs: [{who, stage, when:{k,...}, tag, note}]  — 없으면 기본 표
  const ARC_DEFAULT = [
    { who: '차도현', stage: 1, when: { k: 'lastOut' }, note: '또 마지막 아웃 — 2년 전 장면이 겹친다' },
    { who: '차도현', stage: 2, when: { k: 'clutch' }, note: '마지막 장면을 되갚는 한 방' },
    { who: '차도현', stage: 3, when: { k: 'champ' }, note: '우승 — 마지막 아웃을 직접 잡다' },
    { who: '백승호', stage: 1, when: { k: 'pc', n: 90, bad: true }, note: '90구의 벽 · 라커 혼잣말' },
    { who: '백승호', stage: 2, when: { k: 'cg' }, note: '9회까지 혼자 던진 날' },
    { who: '서태우', stage: 1, when: { k: 'clutch' }, note: '트레이드 반대 여론' },
    { who: '서태우', stage: 2, when: { k: 'walkoff' }, note: '끝내기 — 이 팀에 남는 이유' },
    { who: '한이준', stage: 1, when: { k: 'post' }, note: '큰 경기 공포' },
    { who: '한이준', stage: 2, when: { k: 'postHit' }, note: '큰 경기 첫 활약 — 각성' },
    { who: '도경태', stage: 1, when: { k: 'hrLead' }, note: '홈런 1위 — 인터뷰에서 처음 안다' },
    { who: '노태경', stage: 1, when: { k: 'series', n: 5 }, note: '은퇴 고민' },
    { who: '노태경', stage: 2, when: { k: 'post' }, note: '우승 반지 하나면' },
    { who: '김동혁', stage: 1, when: { k: 'series', n: 7 }, note: '시즌 후반 · 마지막 전성기' },
    { who: '정다인', stage: 1, when: { k: 'error' }, note: '뜨거워진 다음 타석' },
    { who: '강서윤', stage: 1, when: { k: 'kgame', n: 10 }, note: '두 자릿수 탈삼진' },
    { who: '신예린', stage: 1, when: { k: 'sbLead' }, note: '도루 1위 — 겁 없는 막내' }
  ];
  function arcCheck(X, L, G) {
    const arcs = (X.data.arcs && X.data.arcs.length ? X.data.arcs : ARC_DEFAULT);
    const byName = {}; for (const p of X.data.players) byName[p.name] = p;
    const fired = [];
    const hrL = leaders(X, L, 'hr', 1)[0], sbL = leaders(X, L, 'sb', 1)[0];
    for (const a of arcs) {
      const p = byName[a.who]; if (!p || !G.teams.includes(p.team)) continue;
      const cur = L.arcs[p.id] || 0; if (cur >= a.stage || cur !== a.stage - 1) continue;
      const w = a.when, mine = G.log.filter(r => r.bat === p.id || r.pit === p.id);
      let ok = false;
      if (w.k === 'lastOut') { const l = G.log[G.log.length - 1]; const side = G.teams.indexOf(p.team); ok = l && l.bat === p.id && G.score[side] < G.score[1 - side] && Math.abs(G.score[0] - G.score[1]) <= 2; }
      else if (w.k === 'clutch') ok = mine.some(r => r.bat === p.id && r.inn >= 7 && (r.tags.includes('역전') || r.tags.includes('동점') || r.tags.includes('결승타')));
      else if (w.k === 'walkoff') ok = mine.some(r => r.bat === p.id && r.tags.includes('끝내기'));
      else if (w.k === 'pc') ok = (G.pc[p.id] || 0) >= w.n && (!w.bad || (G.pstat[p.id] || {}).r >= 2);
      else if (w.k === 'cg') ok = (G.pstat[p.id] || {}).outs >= 27;
      else if (w.k === 'hrLead') ok = hrL && hrL.id === p.id && hrL.v >= 3 && mine.some(r => r.res === 'HR');
      else if (w.k === 'sbLead') ok = sbL && sbL.id === p.id && sbL.v >= 4;
      else if (w.k === 'series') ok = G.si >= w.n - 1 && G.gi === 0;
      else if (w.k === 'error') ok = G.log.some(r => r.err && r.err.id === p.id);
      else if (w.k === 'kgame') ok = (G.pstat[p.id] || {}).k >= w.n;
      if (ok) { L.arcs[p.id] = a.stage; fired.push({ id: p.id, name: p.name, stage: a.stage, note: a.note }); }
    }
    G.arcs = fired;
    const gm = L.games.find(g => g.no === G.no); if (gm) gm.arcs = fired;
    return fired;
  }
  // 포스트시즌 아크 (post/postHit/champ)
  function postArcs(X, L, G, champ) {
    const arcs = (X.data.arcs && X.data.arcs.length ? X.data.arcs : ARC_DEFAULT);
    const byName = {}; for (const p of X.data.players) byName[p.name] = p;
    const fired = [];
    for (const a of arcs) {
      const p = byName[a.who]; if (!p || !G.teams.includes(p.team)) continue;
      const cur = L.arcs[p.id] || 0; if (cur !== a.stage - 1) continue;
      let ok = false;
      if (a.when.k === 'post') ok = true;
      else if (a.when.k === 'postHit') ok = G.log.some(r => r.bat === p.id && ['1B', '2B', '3B', 'HR'].includes(r.res) && (r.dwp >= 8 || r.rbi > 0));
      else if (a.when.k === 'champ') ok = champ === p.team;
      else if (a.when.k === 'clutch') ok = G.log.some(r => r.bat === p.id && r.inn >= 7 && (r.tags.includes('역전') || r.tags.includes('동점') || r.tags.includes('결승타')));
      if (ok) { L.arcs[p.id] = a.stage; fired.push({ id: p.id, name: p.name, stage: a.stage, note: a.note }); }
    }
    G.arcs = (G.arcs || []).concat(fired);
    return fired;
  }

  // ---------- 시리즈·시즌 진행 ----------
  // 내 경기 전까지 다른 경기 모두 자동 진행
  function simOthersUntil(X, L, no) {
    for (const g of L.games) { if (g.no >= no) break; if (g.st === 'done') continue; if (g.home === L.my || g.away === L.my) continue; const G = newGame(X, L, g); simToEnd(X, L, G); }
  }
  function simGameNo(X, L, no) { const g = L.games.find(x => x.no === no); if (!g || g.st === 'done') return null; const G = newGame(X, L, g); simToEnd(X, L, G); return G; }
  // 시리즈가 끝나면 컨디션 변동
  function afterSeries(X, L, si) {
    const rng = RNG(L.rs);
    for (const id of Object.keys(L.cond)) { const r = rng(); const c = L.cond[id]; L.cond[id] = clamp(c + (r < 0.22 ? 1 : r < 0.44 ? -1 : 0) + (c > 2 && rng() < 0.2 ? -1 : 0) + (c < 2 && rng() < 0.2 ? 1 : 0), 0, 4); }
    // 커리어 훈련 배분 반영
    if (L.career && L.career.plan) trainApply(X, L, L.career.plan, rng);
    L.rs = rng.get();
  }
  // 정규시즌 끝 → 포스트시즌
  function regDone(L) { return L.games.every(g => g.st === 'done'); }
  function startPost(X, L) {
    if (L.post) return L.post;
    const s = standings(X, L);
    L.post = { seeds: s.slice(0, 3).map(r => r.id), po: { a: s[1].id, b: s[2].id, w: [0, 0], games: [] }, ks: null, done: false };
    addPostGame(L, 'po');
    return L.post;
  }
  function addPostGame(L, round) {
    const R = L.post[round]; const n = R.games.length;
    const hi = round === 'po' ? R.a : R.a, lo = R.b;
    const homeHi = round === 'po' ? n !== 1 : [0, 1, 4].includes(n);
    const day = 60 + (round === 'ks' ? 10 : 0) + n;
    const g = { no: 1000 + (round === 'ks' ? 100 : 0) + n + 1, post: round, round, gn: n + 1, si: 99, gi: n, day, home: homeHi ? hi : lo, away: homeHi ? lo : hi, st: 'pre' };
    R.games.push(g); return g;
  }
  function postAfter(X, L, G) {
    const R = L.post[G.post]; const g = R.games.find(x => x.no === G.no);
    if (!g) return;
    const winT = G.score[0] > G.score[1] ? G.teams[0] : G.score[1] > G.score[0] ? G.teams[1] : null;
    if (winT === R.a) R.w[0]++; else if (winT === R.b) R.w[1]++;
    const need = G.post === 'po' ? 2 : 3;
    let champ = null;
    if (R.w[0] >= need || R.w[1] >= need) {
      R.winner = R.w[0] >= need ? R.a : R.b;
      if (G.post === 'po') { L.post.ks = { a: L.post.seeds[0], b: R.winner, w: [0, 0], games: [] }; addPostGame(L, 'ks'); }
      else { L.post.done = true; L.champion = R.winner; champ = R.winner; }
    } else addPostGame(L, G.post);
    postArcs(X, L, G, champ);
    g.arcs = G.arcs;
  }
  const nextPostGame = (L) => { if (!L.post || L.post.done) return null; const R = L.post.ks || L.post.po; return R.games.find(g => g.st !== 'done') || null; };
  function newPostGame(X, L, g, opt) { const G = newGame(X, L, g, opt); G.post = g.post; G.postRef = g; G.maxInn = 9; return G; }

  // ---------- 커리어: 훈련 배분 ----------
  const TRAIN = { con: '컨택', pow: '파워', eye: '선구안', spd: '주루', defn: '수비', arm: '송구', velo: '구위', ctrl: '제구', brk: '변화구', stam: '체력' };
  function trainApply(X, L, plan, rng) {
    const me = L.me; if (!me) return;
    const pot = tr(me, 'potential') || 70;
    const f = clamp(pot / 75, 0.6, 1.4);
    const out = [];
    const t = plan.train || 0, rest = plan.rest || 0, soc = plan.social || 0;
    if (t) { const k = plan.focus || (me.pos === 'P' ? 'ctrl' : 'con'); const box = me.pos === 'P' && ['velo', 'ctrl', 'brk', 'stam'].includes(k) ? me.p : me.b; const g = +(t * 0.9 * f * (0.7 + rng() * 0.6)).toFixed(1); box[k] = clamp(+(box[k] + g).toFixed(1), 20, 99); out.push(`${TRAIN[k]} +${g}`); if (t >= 3 && rng() < 0.35) L.cond.ME = clamp(L.cond.ME - 1, 0, 4); }
    if (rest) { if (rng() < 0.3 * rest) L.cond.ME = clamp(L.cond.ME + 1, 0, 4); out.push('컨디션 회복'); }
    if (soc) { const mate = plan.mate; if (mate) L.rel[mate] = clamp((L.rel[mate] || 50) + 3 * soc, 0, 100); L.rel.ME = clamp((L.rel.ME || 50) + soc, 0, 100); out.push('교류'); }
    L.career.log.unshift({ si: plan.si, out }); L.career.plan = null;
    return out;
  }
  const LADDER = [
    { k: 'reg', label: '1군 등록', test: () => true },
    { k: 'debut', label: '첫 출장', test: (s) => s.pa >= 1 || s.pit.g >= 1 },
    { k: 'hit', label: '첫 안타', test: (s) => s.h >= 1 || s.pit.k >= 1, pl: '첫 탈삼진' },
    { k: 'starter', label: '주전 (선발 10경기)', test: (s, L) => L.career.starts >= 10 },
    { k: 'hr', label: '첫 홈런', test: (s) => s.hr >= 1 || s.pit.w >= 1, pl: '첫 승' },
    { k: 'best', label: '신인왕 레이스 1위', test: (s, L, X) => rookieRank(X, L) === 1 },
    { k: 'champ', label: '우승', test: (s, L) => L.champion && L.champion === L.my }
  ];
  function rookieRank(X, L) {
    const me = L.me; if (!me) return 0;
    const val = (id, p) => { const b = statOf(L, id, 'bat'), q = statOf(L, id, 'pit'); return p.pos === 'P' ? q.outs / 3 * (4.5 - era(q)) / 4 + q.k / 4 : (b.h + b.hr * 2 + b.sb + b.rbi * 0.7 + b.bb * 0.5) - b.ab * 0.24; };
    const pool = X.data.players.filter(p => p.age <= 22 || tr(p, 'rookie')).concat([me]);
    const arr = pool.map(p => ({ id: p.id, v: val(p.id, p) })).sort((a, b) => b.v - a.v);
    return arr.findIndex(x => x.id === 'ME') + 1;
  }
  function ladderState(X, L) {
    if (!L.me) return [];
    const b = statOf(L, 'ME', 'bat'), q = statOf(L, 'ME', 'pit');
    const s = Object.assign({}, b, { pit: q });
    return LADDER.map(x => ({ k: x.k, label: L.me.pos === 'P' && x.pl ? x.pl : x.label, ok: !!L.career.goals[x.k] || (x.test(s, L, X) && (L.career.goals[x.k] = true)) }));
  }

  // ---------- 코드: CRION → 크랙 ----------
  const tn = (X, id) => (X.T[id] || {}).city || id;
  const nm = (X, L, id) => (pl(X, L, id) || {}).name || '?';
  const basesTxt = (b) => { const on = [0, 1, 2].filter(i => b[i]); if (!on.length) return ''; if (on.length === 3) return '만루'; return on.map(i => i + 1).join('·') + '루'; };
  const lineStr = (row, upTo) => { const a = []; const n = upTo != null ? upTo : row.length; for (let i = 0; i < n; i++) { const v = row[i]; a.push(v == null ? '-' : v === 'X' ? 'X' : v >= 10 ? `(${v})` : String(v)); } let s = ''; a.forEach((v, i) => { s += v; if (i % 3 === 2 && i < a.length - 1) s += ' '; }); return s; };
  function pitchTxt(p) { const [t, kmh, z, r] = p; const fast = PT[t] && PT[t].fast; return `${t}${fast ? kmh : ''} ${ZONES[z] || ''}${RES[r] ? ' ' + RES[r] : ''}`.replace(/\s+/g, ' ').trim(); }
  const seqTxt = (r) => { const a = (r.p || r.pitches || []).map(pitchTxt); if (r.res === 'K' && a.length) a[a.length - 1] = a[a.length - 1].replace(/ (헛|루킹)$/, ''); return a.join(' → '); };
  function paLine(X, L, r, myT, opt) {
    opt = opt || {};
    const my = r.teams ? r.teams.indexOf(myT) : -1;
    const sc = r.score || [0, 0];
    const us = opt.side != null ? opt.side : 0;
    const bsT = basesTxt(r.bases || []);
    const head = `${r.inn}회${half2(r.half)} ${OUTS[r.outs] || ''}${bsT ? ' ' + bsT : ''} ${sc[us]}-${sc[1 - us]}`;
    const seq = (r.p || r.pitches || []).map(pitchTxt);
    if (r.res === 'K' && seq.length) seq[seq.length - 1] = seq[seq.length - 1].replace(/ (헛|루킹)$/, '');
    let body = opt.short && seq.length > 4 ? seq.slice(0, 2).concat(['…'], seq.slice(-2)) : seq;
    const res = `${r.desc}${r.rbi && !/홈런/.test(r.desc) ? ` ${r.rbi}타점` : ''}${(r.tags || []).includes('끝내기') ? ' 끝내기' : ''}`;
    const pre = (r.pre || []).map(e => `${nm(X, L, e.run)} ${e.k === 'SB' ? `도루 성공(${nm(X, L, e.cat)} 송구 ${e.time}초)` : e.k === 'CS' ? `도루 실패(${nm(X, L, e.cat)} 송구 ${e.time}초)` : '견제사'}`);
    const ord = r.ord && r.ord.by !== 'ai' ? `${r.user ? '' : '감독 지시: '}${r.ord.label || r.ord.k}${r.ord.ignored ? '(사인 무시)' : ''}` : '';
    const parts = [head, `${nm(X, L, r.pit)}(${r.pc0 + (r.p || r.pitches || []).length}구) vs ${nm(X, L, r.bat)}`];
    const flow = [].concat(ord ? [ord] : [], pre, body.length ? [body.join(' → ') + ' → ' + res] : [res]);
    parts.push(flow.join(' → '));
    const extra = [];
    if (r.user) extra.push('직접 플레이');
    if (r.ph) extra.push(`대타 ${nm(X, L, r.bat)}`);
    for (const n of (r.notes || [])) { const t = TRAITNOTE[n]; if (t) extra.push(t(X, L, r)); }
    if (r.h2h && r.h2h[0] >= 3) extra.push(`맞대결 시즌 ${r.h2h[0]}타수${r.h2h[1]}안타`);
    if (opt.arc) extra.push(opt.arc);
    if (extra.length && !opt.noExtra) parts.push(extra.slice(0, 3).join(' · '));
    return parts.join(' | ');
  }
  const TRAITNOTE = {
    limit90: (X, L, r) => `${nm(X, L, r.pit)} 90구 이후 제구 흔들림`,
    clutch2s: (X, L, r) => { const s = statOf(L, r.bat, 'bat'); return `${nm(X, L, r.bat)} 2S 이후 시즌 타율 ${s.s2ab ? fmt3(s.s2h / s.s2ab) : '-'}`; },
    clutch: (X, L, r) => { const s = statOf(L, r.bat, 'bat'); return `${nm(X, L, r.bat)} 득점권 타율 ${s.rab ? fmt3(s.rh / s.rab) : '-'}`; },
    stretch: (X, L, r) => `${nm(X, L, r.pit)} 세트포지션에서 흔들림`,
    greedy: (X, L, r) => `${nm(X, L, r.bat)} 장타 욕심 나는 날`,
    bigGame: (X, L, r) => `${nm(X, L, r.bat)} 큰 경기 부담`,
    rookie: (X, L, r) => `${nm(X, L, r.bat)} 경험 부족`,
    lateFade: (X, L, r) => `${nm(X, L, r.pit)} 시즌 후반 피로`,
    vsLHB: (X, L, r) => `${nm(X, L, r.pit)} 좌타자에게 약함`,
    mood: (X, L, r) => `${nm(X, L, r.bat)} 직전 타석 삼진 뒤`,
    pinch: (X, L, r) => `대타 ${nm(X, L, r.bat)}`,
    slowStart: (X, L, r) => `${nm(X, L, r.bat)} 시즌 초반 슬럼프`,
    calmBig: (X, L, r) => `${nm(X, L, r.bat)} 큰 경기일수록 침착`
  };
  function flowTxt(X, L, log, my) {
    // 내 팀 기준 리드 변화 (같은 반 이닝 안의 변화는 하나로 묶음)
    const out = []; let prev = 0, scored = false;
    const halves = [];
    for (const r of log) { if (!r.sa) continue; const k = r.inn * 2 + r.half; const h = halves[halves.length - 1]; if (h && h.k === k) { h.end = r.sa; h.last = r; } else halves.push({ k, inn: r.inn, half: r.half, end: r.sa, last: r }); }
    for (const h of halves) {
      const d = h.end[my] - h.end[1 - my], s = Math.sign(d), ps = Math.sign(prev), w = `${h.inn}회${half2(h.half)}`;
      if (d === prev) continue;
      if (!scored) { out.push(d > 0 ? `${w} 선취점` : d < 0 ? `${w} 선취점 내줌` : `${w} 동점`); }
      else if ((h.last.tags || []).includes('끝내기')) out.push(`${w} 끝내기`);
      else if (s === ps) out.push(Math.abs(d) > Math.abs(prev) ? (s > 0 ? `${w} 달아남` : `${w} 점수 차 벌어짐`) : (s > 0 ? `${w} 추격 허용` : `${w} 추격`));
      else if (s === 0) out.push(`${w} 동점`);
      else if (s > 0) out.push(`${w} ${ps < 0 ? '역전' : '리드'}`);
      else out.push(`${w} ${ps > 0 ? '역전 허용' : '리드 내줌'}`);
      scored = true; prev = d;
    }
    // 같은 방향으로 달아난 것은 하나만
    const o2 = out.filter((x, i) => !(i < out.length - 1 && x.split(' ').slice(1).join(' ') === out[i + 1].split(' ').slice(1).join(' ') && /달아남|벌어짐|추격/.test(x)));
    return o2.length > 5 ? [o2[0], '…'].concat(o2.slice(-3)).join(' → ') : o2.join(' → ');
  }
  // 받침 따라 조사 (로/으로)
  const ro = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0) - 0xac00; if (c < 0 || c > 11171) return '로'; const j = c % 28; return j === 0 || j === 8 ? '로' : '으로'; };
  function contextTxt(X, L, gm, my) {
    const opp = gm.home === my ? gm.away : gm.home;
    const s = [];
    const prev = L.games.filter(g => g.st === 'done' && g.si < gm.si && !g.post && ((g.home === my && g.away === opp) || (g.away === my && g.home === opp)));
    if (prev.length) { const w = prev.filter(g => (g.home === my ? g.score[1] > g.score[0] : g.score[0] > g.score[1])).length; s.push(`${tn(X, opp)} 상대 시즌 ${w}승${prev.length - w}패`); if (prev.length >= 3 && w === 0) s.push('지난 3연전 스윕패 설욕'); }
    const nextS = L.schedule[gm.si + 1]; if (nextS && gm.gi === L.gpp - 1) { const m = nextS.find(x => x.home === my || x.away === my); if (m) { const o = m.home === my ? m.away : m.home; s.push(`다음 시리즈 vs ${tn(X, o)}(${rankOf(X, L, o)}위)`); } }
    return s.join(' · ');
  }
  function eventsOf(X, L, G, log) {
    const ev = [];
    for (const a of (G.arcs || [])) ev.push(`${a.name}_아크${a.stage}(${a.note})`);
    const last = log[log.length - 1];
    if (last && (last.tags || []).includes('끝내기')) ev.push(`${nm(X, L, last.bat)}_끝내기 세리머니`);
    const worst = Object.keys(G.pstat || {}).filter(id => G.pstat[id].er >= 4).sort((a, b) => (pl(X, L, b).named ? 1 : 0) - (pl(X, L, a).named ? 1 : 0) || G.pstat[b].er - G.pstat[a].er)[0];
    if (worst) ev.push(`${nm(X, L, worst)}_자책(라커 혼잣말)`);
    for (const r of log) if (r.err && Math.abs((r.sa || [0, 0])[0] - (r.sa || [0, 0])[1]) <= 2) { ev.push(`${nm(X, L, r.err.id)}_실책 자책`); break; }
    for (const id of (G.injured || [])) ev.push(`${nm(X, L, id)}_부상`);
    for (const m of (G.mgr || [])) if (m.ignored) ev.push(`${(m.label || '').split(' ')[0]}_작전 무시(감독과 갈등)`);
    return [...new Set(ev)].slice(0, 5);
  }
  function statusLine(X, L, gm) {
    const myRow = standings(X, L).find(r => r.id === L.my) || {};
    const g = gm || nextGame(L);
    let where = '';
    if (g) { const opp = g.home === L.my ? g.away : g.home; where = `${g.post ? (g.post === 'ks' ? '한국시리즈' : '플레이오프') + ` ${g.gn}차전` : `${weekLabel(L, g.si)} · 시리즈 ${g.si + 1}/${L.seriesN}`} · vs ${tn(X, opp)}(${g.home === L.my ? '홈' : '원정'})`; }
    else where = L.champion ? `시즌 종료 · 우승 ${tn(X, L.champion)}` : '정규시즌 종료';
    const mode = L.mode === 'career' && L.me ? `커리어(${tn(X, L.my)}·${POSKO[L.me.pos]} ${L.me.name})` : `감독(${tn(X, L.my)})`;
    return `📅 ${where} | 🏆 ${myRow.rank || '-'}위 ${myRow.w || 0}승${myRow.l || 0}패${myRow.d ? myRow.d + '무' : ''} | 모드: ${mode}`;
  }
  function trimTo(lines, limit, shrink) {
    let t = lines.filter(Boolean).join('\n');
    let guard = 0;
    while (limit && t.length > limit && guard++ < 20) { const ok = shrink(); if (!ok) break; t = lines.filter(Boolean).join('\n'); }
    return t;
  }
  // 경기 후 ⚾경기로그 (kind: std | short)
  function gameCode(X, L, G, kind) {
    const gm = G.post ? G.postRef : L.games.find(g => g.no === G.no) || {};
    const my = G.teams.indexOf(L.my) >= 0 ? G.teams.indexOf(L.my) : 1, op = 1 - my;
    const log = G.log.map(r => Object.assign({ teams: G.teams, p: r.pitches, sa: r.scoreAfter }, r));
    const [ms, os] = [G.score[my], G.score[op]];
    const tags = [];
    const last = log[log.length - 1];
    if (last && last.tags.includes('끝내기')) tags.push('끝내기');
    tags.push(my === 1 ? '홈' : '원정');
    const before = gm.no ? rankOf(X, L, L.my, gm.no - 1) : null, after = rankOf(X, L, L.my);
    const row = standings(X, L).find(r => r.id === L.my) || {};
    const ser = G.post ? L.post[G.post] : null;
    const serGames = G.post ? null : L.games.filter(g => g.si === G.si && (g.home === L.my || g.away === L.my) && g.st === 'done');
    const sw = serGames ? serGames.filter(g => (g.home === L.my ? g.score[1] > g.score[0] : g.score[0] > g.score[1])).length : 0;
    const sl = serGames ? serGames.filter(g => (g.home === L.my ? g.score[1] < g.score[0] : g.score[0] < g.score[1])).length : 0;
    const sd = serGames ? serGames.filter(g => g.score[0] === g.score[1]).length : 0;
    const head = `⚾경기로그 #${G.post ? (G.post === 'ks' ? '한국시리즈' : '플레이오프') + G.postRef.gn + '차전' : G.no} ${tn(X, G.teams[my])} ${ms}-${os} ${tn(X, G.teams[op])} (${tags.join('·')})` +
      (G.post ? ` | 시리즈 ${ser.a === L.my ? ser.w[0] : ser.w[1]}승${ser.a === L.my ? ser.w[1] : ser.w[0]}패` : ` | 시리즈 ${sw}승${sl}패${sd ? sd + '무' : ''} | 순위 ${before && before !== after ? `${before}위→${after}위` : `${after}위`}${Math.abs(row.streak) >= 3 ? ` | ${Math.abs(row.streak)}${row.streak > 0 ? '연승' : '연패'}` : ''}`);
    const line = `[라인] ${tn(X, G.teams[0])} ${lineStr(G.line[0])} / ${tn(X, G.teams[1])} ${lineStr(G.line[1])}`;
    const flow = flowTxt(X, L, log, my);
    const narrated = new Set((L.narrated[G.no] || []));
    let nHL = kind === 'short' ? 1 : 3;
    let shortSeq = false;
    const hlLines = () => {
      const pick = highlights(X, L, { log }, nHL + narrated.size, []).filter(r => !narrated.has(r.i)).slice(0, nHL);
      const told = log.filter(r => narrated.has(r.i)).slice(0, 2);
      const arr = pick.map((r, i) => `[명장면${i + 1}] ${paLine(X, L, r, L.my, { side: my, short: shortSeq, arc: arcNote(G, r) })}`);
      if (told.length) arr.push(`[서술됨] ${told.map(r => `${r.inn}회${half2(r.half)} ${nm(X, L, r.bat)} ${r.desc}`).join(' / ')}`);
      return arr;
    };
    const box = boxOf(X, L, G);
    const mvp = [];
    const bs = box[my].bat.slice().sort((a, b) => ((b.h || 0) * 2 + (b.rbi || 0) * 2 + (b.hr || 0) * 3 + (b.sb || 0)) - ((a.h || 0) * 2 + (a.rbi || 0) * 2 + (a.hr || 0) * 3 + (a.sb || 0)));
    for (const b of bs.slice(0, 2)) if (b.h || b.rbi || b.sb) mvp.push(`${nm(X, L, b.id)} ${b.ab}타수${b.h}안타${b.hr ? ` ${b.hr}홈런` : ''}${b.rbi ? ` ${b.rbi}타점` : ''}${b.sb ? ` ${b.sb}도루` : ''}`);
    const sp = box[my].pit[0]; if (sp) mvp.push(`${nm(X, L, sp.id)} ${ipStr(sp.outs)}이닝 ${sp.r}실점 ${sp.np}구${sp.k >= 6 ? ` ${sp.k}K` : ''}`);
    const rec = [];
    for (const r of log) for (const t of r.tags) if (/^시즌 \d+호|시즌 첫 안타|멀티홈런/.test(t)) rec.push(`${nm(X, L, r.bat)} ${t}${/호$/.test(t) ? ' 홈런' : ''}`);
    if (G.res) { const res = G.res; for (const [k, id] of [['승', res.W], ['패', res.L], ['세이브', res.SV]]) if (id && pl(X, L, id).team === L.my) { const s = statOf(L, id, 'pit', G.post); rec.push(`${nm(X, L, id)} 시즌 ${k === '승' ? s.w + '승' : k === '패' ? s.l + '패' : s.sv + '세이브'}`); } }
    const ctx = G.post ? '' : contextTxt(X, L, gm, L.my);
    const evs = eventsOf(X, L, G, log);
    const topHL = highlights(X, L, { log }, 1).filter(r => !narrated.has(r.i))[0];
    let lines;
    const build = () => {
      lines = [head, line, flow ? `[흐름] ${flow}` : '', ...hlLines(), kind === 'short' ? '' : (mvp.length ? `[수훈] ${mvp.join(' · ')}` : ''), kind === 'short' ? '' : (rec.length ? `[기록] ${[...new Set(rec)].slice(0, 4).join(' · ')}` : ''), kind === 'short' ? '' : (ctx ? `[맥락] ${ctx}` : ''), evs.length ? `[이벤트] ${evs.join(' · ')}` : '', kind === 'short' ? '' : `[연출] 중계+덕아웃${topHL ? ` / 명장면${Math.max(1, highlights(X, L, { log }, nHL + narrated.size).filter(r => !narrated.has(r.i)).slice(0, nHL).findIndex(r => r.i === topHL.i) + 1)}: 한 구씩` : ''}`, `[상태] ${statusLine(X, L)}`];
      return lines;
    };
    build();
    const limit = L.prefs.limit;
    let t = lines.filter(Boolean).join('\n');
    let guard = 0;
    while (limit && t.length > limit && guard++ < 8) {
      if (!shortSeq) shortSeq = true; else if (nHL > 1) nHL--; else break;
      build(); t = lines.filter(Boolean).join('\n');
    }
    if (limit && t.length > limit) t = t.slice(0, limit - 1) + '…';
    return t;
  }
  function arcNote(G, r) { const a = (G.arcs || []).find(x => x.id === r.bat || x.id === r.pit); return a ? `${a.name} 아크${a.stage}` : ''; }
  // 멈춘 시점 ⚾중간로그
  function midCode(X, L, G, req) {
    const my = G.teams.indexOf(L.my) >= 0 ? G.teams.indexOf(L.my) : 1, op = 1 - my;
    const from = L.sent[G.no] || 0;
    const log = G.log.slice(from).map(r => Object.assign({ teams: G.teams, p: r.pitches, sa: r.scoreAfter }, r));
    const where = G.outs === 0 && !G.bases.some(Boolean) && G.log.length && G.log[G.log.length - 1].outsAfter === 3 ? `${G.half ? G.inn : G.inn - 1}회${G.half ? '초' : '말'} 종료` : `${G.inn}회${half2(G.half)} ${OUTS[G.outs]}${basesTxt(G.bases) ? ' ' + basesTxt(G.bases) : ''}`;
    const head = `⚾중간로그 #${G.post ? (G.post === 'ks' ? '한국시리즈' : '플레이오프') + G.postRef.gn + '차전' : G.no} ${where} · ${tn(X, G.teams[my])} ${G.score[my]}-${G.score[op]} ${tn(X, G.teams[op])} | 지금 멈춤`;
    const upto = G.inn;
    const line = `[라인] ${tn(X, G.teams[0])} ${lineStr(G.line[0], G.line[0].length)} / ${tn(X, G.teams[1])} ${lineStr(G.line[1], G.line[1].length)}`;
    // 새로 생긴 로그: 드라마 큰 타석은 공 하나씩, 나머지는 짧게, 삼자범퇴 이닝은 묶음
    const parts = [];
    let fullN = 2;
    const mk = () => {
      parts.length = 0;
      const big = new Set(log.slice().sort((a, b) => b.drama - a.drama).slice(0, fullN).filter(r => r.drama >= 12).map(r => r.i));
      const halves = {};
      for (const r of log) { const k = r.inn + '회' + (r.half ? '말' : '초'); (halves[k] = halves[k] || []).push(r); }
      for (const k of Object.keys(halves)) {
        const rs = halves[k];
        const quiet = rs.every(r => !['1B', '2B', '3B', 'HR', 'BB', 'IBB', 'E'].includes(r.res) && !(r.runs || []).length);
        if (quiet && rs.length <= 4 && !rs.some(r => big.has(r.i)) && rs[rs.length - 1].outsAfter === 3) { parts.push(`${k} 삼자범퇴`); continue; }
        for (const r of rs) {
          if (big.has(r.i)) parts.push(`${r.inn}회${half2(r.half)} ${OUTS[r.outs]}${basesTxt(r.bases) ? ' ' + basesTxt(r.bases) : ''} ${nm(X, L, r.pit)}(${r.pc0 + r.pitches.length}구) vs ${nm(X, L, r.bat)}: ${(r.pre || []).length ? paLine(X, L, r, L.my, { side: my, noExtra: true }).split(' | ')[2] : seqTxt(r) + ' → ' + r.desc + (r.rbi && !/홈런/.test(r.desc) ? ` ${r.rbi}타점` : '')}`);
          else if ((r.runs || []).length || ['HR', '2B', '3B'].includes(r.res) || r.tags.length) parts.push(`${nm(X, L, r.bat)} ${r.pitches.length === 1 ? '초구 ' : ''}${r.desc}${r.rbi && !/홈런/.test(r.desc) ? ` ${r.rbi}타점` : ''}`);
          else if (r.outsAfter === 3) parts.push(`${nm(X, L, r.bat)} ${r.desc}${ro(r.desc)} 이닝 종료${r.pit ? `(${nm(X, L, r.pit)} ${r.pc0 + r.pitches.length}구)` : ''}`);
        }
      }
      return parts;
    };
    mk();
    const curP = pl(X, L, G.pitcher[fside(G)]);
    const warm = G.warm[fside(G)] && pl(X, L, G.warm[fside(G)]);
    const cur = `[현재] ${G.outs === 0 && !G.bases.some(Boolean) ? `${G.inn}회${half2(G.half)} 시작 전` : `${G.inn}회${half2(G.half)} ${OUTS[G.outs]}${basesTxt(G.bases) ? ' ' + basesTxt(G.bases) : ''}`} · ${curP.name} ${G.pc[curP.id] || 0}구${warm ? ` · 불펜 몸 푸는 중: ${warm.name}` : ''}`;
    const nb = (s, n) => { const a = []; for (let i = 0; i < n; i++) { const x = G.lineup[s][(G.bo[s] + i) % 9]; a.push(`${((G.bo[s] + i) % 9) + 1}번 ${nm(X, L, x.id)}`); } return a.join('·'); };
    const nxt = `[다음] ${tn(X, G.teams[bside(G)])} ${nb(bside(G), 3)}${G.half === 0 ? ` / ${tn(X, G.teams[1])} ${G.inn}회말 ${nb(1, 3)}` : ''}`;
    const mood = moodTxt(X, L, G, my);
    let t;
    const build = () => [head, line, parts.length ? `[지난 전송 이후] ${parts.join(' / ')}` : '[지난 전송 이후] 새 플레이 없음', cur, nxt, mood ? `[분위기] ${mood}` : '', `[상태] ${statusLine(X, L, G.post ? G.postRef : L.games.find(g => g.no === G.no))}`, `[요청] ${req || ''}`].filter(Boolean).join('\n');
    t = build();
    let guard = 0;
    while (L.prefs.limit && t.length > L.prefs.limit && guard++ < 4) { if (fullN > 0) { fullN--; mk(); } else if (parts.length > 4) parts.splice(0, parts.length - 4, '(앞부분 생략)'); else break; t = build(); }
    return t;
  }
  // 분위기 태그 (표정 4종 중에서 고른다)
  function moodTxt(X, L, G, my) {
    const out = [];
    const d = G.score[my] - G.score[1 - my];
    const team = roster(X, L, G.teams[my]).filter(p => p.named && p.emo && p.emo.length);
    const rng = RNG((G.no * 7919 + G.log.length) >>> 0);
    const withEmo = (list) => team.filter(p => list.some(e => (p.emo || []).includes(e)));
    if (d < 0) out.push('덕아웃 침묵');
    else if (d > 0) out.push('덕아웃 들뜸');
    else out.push('덕아웃 긴장');
    const lastHalf = G.log.filter(r => r.inn === (G.half ? G.inn : G.inn - 1) || r.inn === G.inn);
    const myP = pl(X, L, G.pitcher[my]);
    const runsOff = lastHalf.filter(r => r.half !== my && (r.runs || []).length).length;
    if (runsOff && myP && myP.emo && myP.emo.includes('짜증')) out.push(`${myP.name} 글러브 내리침(짜증)`);
    else if (myP && (G.pc[myP.id] || 0) >= limitOf(myP) - 10 && myP.emo.includes('지침')) out.push(`${myP.name} 숨 고르기(지침)`);
    const cap = team.find(p => p.pos === 'C');
    if (cap && d <= 0) out.push(`${cap.name} 마운드 쪽 응시(${cap.emo.includes('진지') ? '진지' : cap.emo[0]})`);
    if (d > 0) { const f = withEmo(['폭소', '미소']); if (f.length) { const p = rng.pick(f); out.push(`${p.name} 덕아웃 난간(${p.emo.includes('폭소') ? '폭소' : '미소'})`); } }
    return out.slice(0, 3).join(' · ');
  }
  // 한 장면 길게 ⚾장면
  function sceneCode(X, L, logRef, r, req) {
    const my = logRef.teams.indexOf(L.my) >= 0 ? logRef.teams.indexOf(L.my) : 1;
    const R = Object.assign({ teams: logRef.teams }, r);
    const p = R.p || R.pitches || [];
    let b = 0, s = 0;
    const seq = p.map((x, i) => { const t = `${i + 1}구 ${pitchTxt(x)} (${b}-${s})`; if (x[3] === 'B') b++; else if (x[3] === 'S' || x[3] === 'L' || (x[3] === 'F' && s < 2)) s++; return t; });
    const lines = [
      `⚾장면 #${logRef.no || ''} ${R.inn}회${half2(R.half)} ${OUTS[R.outs]}${basesTxt(R.bases || []) ? ' ' + basesTxt(R.bases) : ''} · ${tn(X, logRef.teams[my])} ${R.score[my]}-${R.score[1 - my]} ${tn(X, logRef.teams[1 - my])}`,
      `[대결] ${nm(X, L, R.pit)}(${R.pc0 ? R.pc0 + '구 던진 뒤' : '방금 등판'}) vs ${nm(X, L, R.bat)}${R.h2h && R.h2h[0] ? ` · 맞대결 ${R.h2h[0]}타수${R.h2h[1]}안타` : ''}`,
      (R.bases || []).some(Boolean) ? `[주자] ${(R.bases || []).map((id, i) => id ? `${i + 1}루 ${nm(X, L, id)}` : '').filter(Boolean).join(' · ')}` : '',
      R.pre && R.pre.length ? `[주루] ${R.pre.map(e => `${nm(X, L, e.run)} ${e.k === 'SB' ? '도루 성공' : e.k === 'CS' ? '도루 실패' : '견제사'} (송구 ${e.time}초)`).join(' · ')}` : '',
      R.ord && R.ord.by !== 'ai' ? `[작전] ${R.ord.label || R.ord.k}${R.ord.ignored ? ' — 사인 무시' : ''}` : '',
      `[투구] ${seq.join(' / ')}`,
      `[결과] ${R.desc}${R.rbi && !/홈런/.test(R.desc) ? ` ${R.rbi}타점` : ''}${R.bb ? ` · 타구 ${R.bb.ev}km/h` : ''} → ${R.sa ? `${R.sa[my]}-${R.sa[1 - my]}` : ''}${R.w ? ` · 승리확률 ${my === 1 ? R.w[0] : 100 - R.w[0]}%→${my === 1 ? R.w[1] : 100 - R.w[1]}%` : ''}`,
      (R.notes || []).length ? `[특성] ${(R.notes || []).map(n => TRAITNOTE[n] ? TRAITNOTE[n](X, L, R) : '').filter(Boolean).join(' · ')}` : '',
      `[벤치] ${(R.tags || []).length ? R.tags.join(' · ') : '숨죽임'}`,
      `[요청] ${req || ''}`
    ];
    return lines.filter(Boolean).join('\n');
  }

  // ---------- 크랙 → CRION ----------
  //  【CRION】 scene=pregame bg=dugout sprites=차도현|진지 choices=정면승부,번트작전 order=투수교체:무명불펜A hint=번트 【/CRION】
  function parseReply(text, X) {
    const out = { block: null, scene: null, orders: [], hints: [], choices: [], sprites: [], bg: null, status: null, lines: [] };
    if (!text) return out;
    const m = text.match(/【\s*CRION\s*】([\s\S]*?)(?:【\s*\/\s*CRION\s*】|$)/);
    if (m) {
      out.block = m[1].trim();
      const toks = out.block.match(/([a-z]+)\s*=\s*("[^"]*"|[^\s]+)/g) || [];
      for (const t of toks) {
        const i = t.indexOf('='); const k = t.slice(0, i).trim(); const v = t.slice(i + 1).trim().replace(/^"|"$/g, '');
        if (k === 'scene') out.scene = v;
        else if (k === 'bg') out.bg = v;
        else if (k === 'bgm') out.bgm = v;
        else if (k === 'choices') out.choices = v.split(/[,，]/).map(s => s.trim()).filter(Boolean);
        else if (k === 'sprites') out.sprites = v.split(/[,，]/).map(s => { const [n, e] = s.split('|'); return { name: (n || '').trim(), emo: (e || '통상').trim() }; });
        else if (k === 'order') out.orders.push(...v.split(/[,，]/).map(s => parseOrder(s, X)).filter(Boolean));
        else if (k === 'hint') out.hints.push(...v.split(/[,，]/).map(s => parseOrder(s, X) || { raw: s }).filter(Boolean));
      }
    }
    const sl = text.match(/📅[^\n]*/); if (sl) out.status = sl[0].trim();
    const re = /【([^|】\n]+)\|([^】\n]+)】\s*"?([^\n"]*)"?/g; let mm;
    while ((mm = re.exec(text))) if (mm[1].trim() !== 'CRION') out.lines.push({ name: mm[1].trim(), emo: mm[2].trim(), text: mm[3].trim() });
    return out;
  }
  const ORDK = { 투수교체: 'pc', 교체: 'pc', 대타: 'ph', 대주자: 'pr', 번트: 'bunt', 희생번트: 'bunt', 도루: 'steal', 고의4구: 'ibb', 고의사구: 'ibb', 정면승부: 'free', 시프트: 'shift', 히트앤런: 'hitrun', 마운드방문: 'visit', 한타자더: 'keep', 계속: 'keep' };
  function parseOrder(s, X) {
    s = String(s || '').trim(); if (!s) return null;
    const [a, b] = s.split(/[:：]/);
    const key = (a || '').replace(/\s+/g, '');
    const k = ORDK[key] || Object.keys(ORDK).find(x => key.includes(x)) && ORDK[Object.keys(ORDK).find(x => key.includes(x))];
    if (!k) return { raw: s };
    const o = { k, raw: s };
    if (b && X) { const who = b.trim().replace(/\s+/g, ''); const p = Object.values(X.P).find(q => q.name === who) || Object.values(X.P).find(q => who.includes(q.name) || q.name.includes(who)); if (p) o.id = p.id; o.who = b.trim(); }
    return o;
  }
  // 크랙이 말한 작전을 지금 경기에서 쓸 수 있게 맞춤 (확인 팝업 전에)
  function resolveOrder(X, L, G, o) {
    if (!o || !o.k) return null;
    const my = G.teams.indexOf(L.my);
    if (o.k === 'pc') {
      const pen = bullpenOf(X, L, G, my);
      let p = o.id && pen.find(x => x.id === o.id);
      if (!p && o.who && /불펜|마무리|무명/.test(o.who)) p = /마무리/.test(o.who) ? pen.find(x => x.role === 'CL') : pen[0];
      if (!p) p = pen[0];
      return p ? { k: 'pc', id: p.id, label: `투수 교체 → ${p.name}` } : null;
    }
    if (o.k === 'ph' || o.k === 'pr') { const bench = benchOf(X, L, G, my); const p = (o.id && bench.find(x => x.id === o.id)) || bench[0]; return p ? { k: o.k, id: p.id, label: `${o.k === 'ph' ? '대타' : '대주자'} ${p.name}` } : null; }
    return { k: o.k, label: { bunt: '희생번트', steal: '도루', ibb: '고의4구', free: '정면승부', shift: '수비 시프트', hitrun: '히트앤런', visit: '마운드 방문', keep: '한 타자 더' }[o.k] || o.k };
  }

  // ---------- 직접 플레이: 투구 하나씩 ----------
  //  화면이 노림·타이밍(타격) 또는 구종·코스·게이지(투구)를 받아 결과를 정하고, 타석이 끝나면 resolvePA로 넘긴다
  function aiPitch(X, L, G, cnt, rng) {
    const ctx = ctxOf(X, L, G); const R = paRates(X, L, G, ctx);
    const t = pickType(rng, ctx.pit, cnt.b, cnt.s, false);
    const ctrl = R.q.ctrl;
    const want = cnt.b === 3 ? rng.pick([1, 3, 4, 5, 7]) : cnt.s === 2 ? rng.pick([6, 7, 8, 10, 11, 0, 2]) : rng.pick([0, 1, 2, 3, 5, 6, 7, 8, 4]);
    const miss = rng() > clamp((ctrl - 20) / 85, 0.3, 0.95);
    let z = want;
    if (miss) z = want >= 9 ? rng.pick([7, 8, 6]) : rng() < 0.5 ? 4 : rng.pick([9, 10, 11, 12]);
    return { t, kmh: kmhOf(rng, X, ctx.pit, t, G), z, R, ctx };
  }
  const inZone = (z) => z < 9;
  // 타격: guess = 노린 칸(0~8) 또는 null, timing = -1..1 (0이 완벽), swing = bool
  function swingResult(X, L, G, pitch, input, cnt, rng) {
    const { R } = pitch; const b = R.b, q = R.q;
    if (!input.swing) return { r: inZone(pitch.z) ? 'L' : 'B' };
    const e = Math.abs(input.timing);
    const guessHit = input.guess != null && input.guess === pitch.z;
    const guessNear = input.guess != null && !guessHit && inZone(pitch.z) && Math.abs((input.guess % 3) - (pitch.z % 3)) + Math.abs(Math.floor(input.guess / 3) - Math.floor(pitch.z / 3)) === 1;
    const brk = PT[pitch.t] && !PT[pitch.t].fast;
    let contact = 0.92 - e * 0.9 + (b.con - q.stuff) * 0.004 - (brk ? 0.08 : 0) + (guessHit ? 0.12 : guessNear ? 0.04 : 0) - (inZone(pitch.z) ? 0 : 0.28);
    if (rng() > clamp(contact, 0.05, 0.97)) return { r: 'S' };
    let quality = 1 - e * 1.4 + (guessHit ? 0.25 : 0) + (b.pow - 50) / 160 - (inZone(pitch.z) ? 0 : 0.35) + (pitch.z === 4 ? 0.12 : 0) + rng.n(0, 0.18);
    if (quality < 0.15 || (cnt.s < 3 && rng() < 0.32 - quality * 0.25)) return { r: 'F' };
    // 인플레이 → 결과
    const hrP = clamp((quality - 0.75) * 0.45 * (b.pow / 60), 0, 0.5) * (X.T[G.home].park || 1);
    const hitP = clamp(0.24 + (quality - 0.5) * 0.35 + (b.con - q.stuff) * 0.002, 0.08, 0.7);
    const r = rng();
    let out;
    if (r < hrP) out = 'HR'; else if (r < hrP + hitP * 0.22) out = '2B'; else if (r < hrP + hitP * 0.24) out = '3B'; else if (r < hrP + hitP) out = '1B'; else out = 'OUT';
    return { r: 'X', out };
  }
  // 투구: pick = 노린 칸(0~12), acc = 0..1 (게이지 정확도), type
  function pitchResult(X, L, G, input, cnt, rng) {
    const ctx = ctxOf(X, L, G); const R = paRates(X, L, G, ctx); const b = R.b, q = R.q;
    const acc = clamp(input.acc, 0, 1);
    let z = input.pick;
    const off = rng() > acc * clamp(q.ctrl / 70, 0.6, 1.3);
    if (off) { z = input.pick >= 9 ? rng.pick([6, 7, 8, 4]) : rng() < 0.45 ? 4 : rng.pick([9, 10, 11, 12, 1, 3, 5, 7]); }
    const t = input.type, kmh = kmhOf(rng, X, ctx.pit, t, G) + (acc > 0.9 ? 1 : 0);
    const brk = PT[t] && !PT[t].fast;
    const zin = inZone(z);
    // 타자 판단
    const eye = b.eye;
    let swingP = zin ? 0.68 + (cnt.s === 2 ? 0.18 : 0) - (cnt.b === 3 ? 0.05 : 0) : 0.3 - (eye - 50) * 0.006 + (cnt.s === 2 ? 0.12 : 0) + (brk ? 0.08 : 0);
    if (tr(ctx.bat, 'firstPitch') && cnt.b + cnt.s === 0) swingP += 0.25;
    if (rng() > clamp(swingP, 0.05, 0.95)) return { t, kmh, z, r: zin ? 'L' : 'B', R };
    const edge = [0, 2, 6, 8].includes(z) ? 0.1 : z === 4 ? -0.18 : 0;
    let contact = 0.8 + (b.con - q.stuff) * 0.005 - (brk ? 0.08 : 0) - (zin ? 0 : 0.3) - edge - (acc - 0.6) * 0.15;
    if (rng() > clamp(contact, 0.08, 0.95)) return { t, kmh, z, r: 'S', R };
    const quality = 0.55 + (b.pow - q.stuff) / 150 - edge * 1.6 - (zin ? 0 : 0.3) + rng.n(0, 0.22);
    if (quality < 0.2 || rng() < 0.33) return { t, kmh, z, r: 'F', R };
    const hrP = clamp((quality - 0.72) * 0.4 * (b.pow / 60), 0, 0.45) * (X.T[G.home].park || 1);
    const hitP = clamp(0.22 + (quality - 0.5) * 0.3, 0.06, 0.6);
    const rr = rng(); let out;
    if (rr < hrP) out = 'HR'; else if (rr < hrP + hitP * 0.22) out = '2B'; else if (rr < hrP + hitP * 0.24) out = '3B'; else if (rr < hrP + hitP) out = '1B'; else out = 'OUT';
    return { t, kmh, z, r: 'X', out, R };
  }
  // 직접 플레이 타석 마무리: 투구 목록 + 결과로 resolvePA
  function finishUserPA(X, L, G, pitches, out, ord) {
    const rng = RNG(L.rs);
    const ctx = ctxOf(X, L, G);
    const pa = { bat: ctx.bat.id, pit: ctx.pit.id, inn: G.inn, half: G.half, outs: G.outs, bases: G.bases.map(x => x && x.id), score: G.score.slice(), pc0: G.pc[ctx.pit.id] || 0, notes: [], ord: ord || null, pitches, raw: out, user: true, pre: [] };
    const rec = resolvePA(X, L, G, pa, rng);
    L.rs = rng.get();
    if (G.over) finishGame(X, L, G);
    return rec;
  }

  // ---------- 세이브 크기 줄이기 ----------
  function saveObj(L) { return JSON.parse(JSON.stringify(L)); }

  return {
    RNG, index, newLeague, makeSchedule, standings, rankOf, leaders, statOf, avg, era, fmt3, ipStr, weekLabel, nextGame, seriesOf, simOthersUntil, simGameNo, afterSeries,
    newGame, stepPA, simToEnd, finishGame, decisionAt, orderOptions, benchOf, bullpenOf, limitOf, winProb, highlights, ovr, roster, pl, tr,
    gameCode, midCode, sceneCode, statusLine, parseReply, parseOrder, resolveOrder, paLine, pitchTxt, lineStr, basesTxt,
    regDone, startPost, nextPostGame, newPostGame, aiPitch, swingResult, pitchResult, finishUserPA, inZone, trainApply, ladderState, rookieRank, makeMe, saveObj,
    POSKO, FIELD, COND, ZONES, PT, OUTS, TRAIN, half2, ctxOf, batterId, bside, fside, ARC_DEFAULT
  };
});
