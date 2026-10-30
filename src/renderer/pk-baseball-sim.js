// 3D 야구 — 규칙·물리 (화면 없이 계산만, node 시험 가능: test/baseball.test.js)
//  좌표: 홈 플레이트 = (0,0,0), 투수 쪽 = -z, 1루 = +x(포수 시점 오른쪽), 높이 = y(미터)
//  타구 방향 phi(도): 0 = 가운데, + = 우익수 쪽, ±45 = 파울 라인
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hyp = Math.hypot;
  let rnd = Math.random;
  const R = (a, b) => a + (b - a) * rnd();
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // ---- 구장 ----
  const BASE_D = 27.43;
  const BASES = [{ x: 0, z: 0 }, { x: 19.4, z: -19.4 }, { x: 0, z: -38.8 }, { x: -19.4, z: -19.4 }];   // 홈·1·2·3루
  const FENCE_H = 3.6;
  const fenceR = (phi) => 98 + 24 * Math.max(0, Math.cos(2 * clamp(phi, -45, 45) * D2R));
  const phiOf = (x, z) => Math.atan2(x, -z) / D2R;
  const ZONE = { x0: -0.25, x1: 0.25, y0: 0.48, y1: 1.07 };
  const inZone = (x, y) => x >= ZONE.x0 && x <= ZONE.x1 && y >= ZONE.y0 && y <= ZONE.y1;

  // ---- 구종 (acc = 공에 걸리는 가속도, 중력 포함 · 오른손 투수 기준) ----
  const PITCHES = {
    FB: { name: '직구', kmh: [144, 152], acc: [-1.2, -5.0, 0] },
    SL: { name: '슬라이더', kmh: [130, 138], acc: [5.5, -9.0, 0] },
    CU: { name: '커브', kmh: [114, 123], acc: [3.2, -17.5, 0] },
    CH: { name: '체인지업', kmh: [124, 132], acc: [-4.2, -11.0, 0] },
    FK: { name: '포크', kmh: [128, 136], acc: [0, -15.5, 0] }
  };
  const PITCH_KEYS = ['FB', 'SL', 'CU', 'CH', 'FK'];
  const RELEASE = { x: -0.55, y: 1.85, z: -16.9 };

  // 목표 지점(홈 플레이트 앞면 z=0)을 지나게 하는 투구 궤적. scale = 게임 속도(1 = 실제)
  function pitchPath(type, target, kmh, scale) {
    const P = PITCHES[type] || PITCHES.FB;
    const v = kmh / 3.6 * scale;
    const dist = hyp(target.x - RELEASE.x, target.y - RELEASE.y, RELEASE.z);
    const T = dist / v;
    const s2 = scale * scale;
    const A = { x: P.acc[0] * s2, y: P.acc[1] * s2, z: 0 };
    const V = { x: (target.x - RELEASE.x - 0.5 * A.x * T * T) / T, y: (target.y - RELEASE.y - 0.5 * A.y * T * T) / T, z: -RELEASE.z / T };
    const at = (t) => ({ x: RELEASE.x + V.x * t + 0.5 * A.x * t * t, y: RELEASE.y + V.y * t + 0.5 * A.y * t * t, z: RELEASE.z + V.z * t });
    return { type, kmh, T, at, plate: { x: target.x, y: target.y }, tCatch: T + 1.05 / V.z, strike: inZone(target.x, target.y) };
  }

  // ---- 타격 판정 ----
  //  dt = 방망이가 지나간 때 - 공이 온 때 (초, + = 늦음), dx·dy = 겨눈 곳 - 공 (미터, dy + = 공보다 위를 침)
  const DIFF = {
    easy: { scale: 0.72, win: 0.11, rad: 0.21, label: '쉬움' },
    normal: { scale: 0.85, win: 0.085, rad: 0.17, label: '보통' },
    hard: { scale: 1.0, win: 0.066, rad: 0.14, label: '어려움' }
  };
  function contact(dt, dx, dy, win, rad) {
    const d = hyp(dx, dy * 1.15);
    if (Math.abs(dt) > win || d > rad) return null;
    const qp = 1 - d / rad, qt = 1 - Math.abs(dt) / win;
    const q = clamp(0.55 * qp + 0.45 * qt, 0, 1);
    if (q < 0.08) return { tip: true, q, ev: R(60, 90), la: R(-20, 70), phi: (rnd() < 0.5 ? -1 : 1) * R(55, 95) };
    const ev = clamp(104 + 78 * Math.pow(q, 0.75) + R(-5, 5), 60, 184);
    const la = clamp(12 - (dy / rad) * 44 + R(-5, 5), -35, 80);
    const phi = clamp((dt / win) * 56 - (dx / rad) * 10 + R(-9, 9), -100, 100);
    return { q, ev, la, phi };
  }

  // ---- 타구 비행 (중력 + 공기 저항 + 회전 양력, 땅 튐·구름, 담장) ----
  const K_DRAG = 0.0061, K_LIFT = 0.0035, BALL_R = 0.037;
  function standR(phi) {   // 관중석 시작 거리 (공이 넘어가면 멈춤)
    const a = Math.abs(phi);
    if (a <= 45) return fenceR(phi) + 0.6;
    if (a <= 135) { const s = 98 * Math.cos((a - 45) * D2R); return Math.max(19, hyp(s, 14)); }
    return 19;
  }
  function flight(ev, la, phi, from) {
    const v0 = ev / 3.6;
    let p = { x: from ? from.x : 0, y: from ? from.y : 0.9, z: from ? from.z : 0 };
    let v = { x: v0 * Math.cos(la * D2R) * Math.sin(phi * D2R), y: v0 * Math.sin(la * D2R), z: -v0 * Math.cos(la * D2R) * Math.cos(phi * D2R) };
    const dt = 1 / 240, out = [{ t: 0, x: p.x, y: p.y, z: p.z }];
    const cl = la > 10 ? K_LIFT : la > 0 ? K_LIFT * 0.5 : -K_LIFT * 0.4;
    let t = 0, land = -1, rolling = false, hr = false, wall = false, stands = false, bounces = 0, proj = 0, n = 0, stop = false, ev1 = false;
    while (t < 14) {
      const s = hyp(v.x, v.y, v.z), vh = hyp(v.x, v.z) || 1e-6;
      if (!rolling) {
        const l = bounces ? 0 : cl;
        const nx = -v.y * (v.x / vh) / (s || 1), ny = vh / (s || 1), nz = -v.y * (v.z / vh) / (s || 1);
        v.x += (-K_DRAG * s * v.x + l * s * s * nx) * dt;
        v.y += (-9.81 - K_DRAG * s * v.y + l * s * s * ny) * dt;
        v.z += (-K_DRAG * s * v.z + l * s * s * nz) * dt;
      } else {
        const sp = vh, dec = 3.0 * dt;
        if (sp <= dec) { v.x = 0; v.z = 0; } else { v.x *= (sp - dec) / sp; v.z *= (sp - dec) / sp; }
      }
      const px = p.x, pz = p.z;
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt; t += dt;
      const r = hyp(p.x, p.z), ph = phiOf(p.x, p.z);
      // 담장 (페어 지역)
      if (Math.abs(ph) <= 45 && r >= fenceR(ph) && hyp(px, pz) < fenceR(ph)) {
        if (p.y > FENCE_H) { if (land < 0) hr = true; }
        else {
          wall = true;
          const rx = p.x / r, rz = p.z / r, vr = v.x * rx + v.z * rz;
          if (vr > 0) { v.x -= 1.4 * vr * rx; v.z -= 1.4 * vr * rz; v.y *= 0.6; }
          const back = fenceR(ph) - 0.3; p.x = rx * back; p.z = rz * back;
        }
      }
      // 관중석
      if (r >= standR(ph) && (Math.abs(ph) > 45 || r > fenceR(ph))) {
        const sh = Math.abs(ph) <= 45 ? FENCE_H + (r - fenceR(ph)) * 0.62 : 1.3 + (r - standR(ph)) * 0.62;
        if (p.y <= sh + 0.2) { stands = true; stop = true; }
      }
      // 땅
      if (p.y <= BALL_R && v.y < 0) {
        p.y = BALL_R;
        if (land < 0) ev1 = true;
        bounces++;
        const grass = r > 30 || r < 4 ? 0.46 : 0.36;
        v.y = -v.y * grass; v.x *= 0.72; v.z *= 0.72;
        if (Math.abs(v.y) < 0.9) { v.y = 0; rolling = true; }
      }
      if (rolling && hyp(v.x, v.z) < 0.25) stop = true;
      if (++n % 4 === 0 || stop || ev1) out.push({ t, x: p.x, y: p.y, z: p.z });
      if (ev1) { land = out.length - 1; ev1 = false; }
      if (stop) { if (land < 0) land = out.length - 1; break; }
    }
    if (out[out.length - 1].t !== t) out.push({ t, x: p.x, y: p.y, z: p.z });
    // 비거리: 첫 착지(또는 홈런이면 땅까지 그대로 날았을 때) 거리
    const L = land >= 0 ? out[Math.min(land, out.length - 1)] : out[out.length - 1];
    proj = hyp(L.x, L.z);
    if (hr) proj = carry(ev, la, phi, from);
    // 파울 판정: 1·3루를 지난 뒤 떨어지면 떨어진 곳, 아니면 내야를 벗어날 때(또는 멈춘 곳)
    let foul;
    if (land >= 0 && hyp(L.x, L.z) > 33) foul = Math.abs(phiOf(L.x, L.z)) > 45;
    else {
      const cross = out.find(q => hyp(q.x, q.z) >= 30) || out[out.length - 1];
      foul = Math.abs(phiOf(cross.x, cross.z)) > 45 || cross.z > 0.5;
    }
    if (hr) foul = false;
    return { pts: out, land: land >= 0 ? Math.min(land, out.length - 1) : out.length - 1, hr, wall, stands, foul, dist: proj, ev, la, phi, end: out[out.length - 1] };
  }
  function carry(ev, la, phi, from) {
    const v0 = ev / 3.6; let p = { x: 0, y: from ? from.y : 0.9, z: 0 };
    let v = { h: v0 * Math.cos(la * D2R), y: v0 * Math.sin(la * D2R) }, d = 0; const dt = 1 / 240;
    for (let i = 0; i < 4000 && (p.y > 0 || v.y > 0); i++) {
      const s = hyp(v.h, v.y);
      v.h += (-K_DRAG * s * v.h - K_LIFT * s * s * (v.y / s)) * dt;
      v.y += (-9.81 - K_DRAG * s * v.y + K_LIFT * s * s * (v.h / s)) * dt;
      d += v.h * dt; p.y += v.y * dt;
    }
    return d;
  }

  // ---- 수비 ----
  const FIELD = [
    { k: 'P', n: '투수', x: 0, z: -17.6, sp: 5.6, re: 0.4, inf: true },
    { k: 'C', n: '포수', x: 0, z: 1.3, sp: 5.4, re: 0.35, inf: true },
    { k: '1B', n: '1루수', x: 15.8, z: -23.2, sp: 6.0, re: 0.35, inf: true },
    { k: '2B', n: '2루수', x: 8.8, z: -33.8, sp: 6.4, re: 0.32, inf: true },
    { k: 'SS', n: '유격수', x: -8.8, z: -33.8, sp: 6.5, re: 0.32, inf: true },
    { k: '3B', n: '3루수', x: -15.8, z: -23.2, sp: 6.0, re: 0.35, inf: true },
    { k: 'LF', n: '좌익수', x: -31, z: -79, sp: 6.9, re: 0.6 },
    { k: 'CF', n: '중견수', x: 0, z: -94, sp: 7.2, re: 0.6 },
    { k: 'RF', n: '우익수', x: 31, z: -79, sp: 6.9, re: 0.6 }
  ];
  const need = (f, x, z, reach) => f.re + Math.max(0, hyp(f.x - x, f.z - z) - reach) / f.sp;
  const RUN = { first: 4.3, leg: 3.75 };   // 타자 1루까지, 베이스 하나 더

  // 타구 → 결과 (아웃·안타·홈런…). st = { bases:[1루,2루,3루], outs }
  function resolve(fl, st) {
    const pts = fl.pts, L = fl.land;
    const out = { fl, kind: '', label: '', fielder: -1, endT: pts[pts.length - 1].t, catchPt: null, throwTo: -1, throwT: 0, bases: 0, outs: 0 };
    // 1) 뜬공 잡기 (떨어지기 전, 손이 닿는 높이)
    let best = null;
    for (let i = 1; i < pts.length && i <= L; i++) {
      const q = pts[i];
      if (q.y > 2.6 || q.t < 0.3) continue;
      const r = hyp(q.x, q.z), ph = phiOf(q.x, q.z);
      if (r > standR(ph) - 0.5) continue;
      if (Math.abs(ph) <= 45 && r > fenceR(ph) - 0.2 && q.y > FENCE_H + 0.5) continue;
      for (let f = 0; f < FIELD.length; f++) {
        if (f === 1 && !(fl.la > 45 && r < 25)) continue;
        const nd = need(FIELD[f], q.x, q.z, q.y < 1.9 ? 1.0 : 0.6);
        if (nd <= q.t && (!best || nd < best.nd)) best = { f, t: q.t, q, nd };
      }
      if (best) break;
    }
    if (best) {
      const dist = hyp(best.q.x, best.q.z);
      out.fielder = best.f; out.endT = best.t; out.catchPt = best.q; out.outs = 1;
      out.kind = fl.foul ? 'FOUL_OUT' : fl.la > 50 && dist < 45 ? 'POP' : fl.la < 18 ? 'LINE' : 'FLY';
      out.label = (fl.foul ? '파울 플라이 아웃' : out.kind === 'POP' ? '내야 뜬공' : out.kind === 'LINE' ? '직선타 아웃' : '뜬공 아웃');
      out.catchDist = dist;
      // 희생플라이: 3루 주자, 2아웃 전, 외야 깊은 뜬공
      if (!fl.foul && st.bases[2] && st.outs < 2 && best.f >= 6 && dist > 62) { out.sac = true; out.label = '희생플라이'; out.throwTo = 0; out.throwT = 0.8 + hyp(best.q.x, best.q.z) / 28; }
      return out;
    }
    if (fl.foul) { out.kind = 'FOUL'; out.label = '파울'; out.endT = Math.min(out.endT, (pts[L] || pts[pts.length - 1]).t + 0.6); return out; }
    if (fl.hr) { out.kind = 'HR'; out.label = '홈런'; out.bases = 4; return out; }
    // 2) 땅볼·안타: 공을 먼저 잡는 수비수
    let get = null;
    const from = fl.la < 0 ? 1 : Math.max(1, L);
    for (let i = from; i < pts.length; i++) {
      const q = pts[i];
      if (q.y > 1.8) continue;
      for (let f = 0; f < FIELD.length; f++) {
        if (f === 1 && hyp(q.x, q.z) > 12) continue;
        const nd = need(FIELD[f], q.x, q.z, 0.9);
        if (nd <= q.t && (!get || nd < get.nd)) get = { f, t: q.t, q, nd };
      }
      if (get) break;
    }
    if (!get) {
      const e = pts[pts.length - 1];
      FIELD.forEach((F, f) => { const t = Math.max(e.t, need(F, e.x, e.z, 0.6)) + 0.3; if (!get || t < get.t) get = { f, t, q: e }; });
    }
    out.fielder = get.f; out.endT = get.t; out.catchPt = get.q;
    const F = FIELD[get.f], P = get.q;
    const landR = hyp(pts[L].x, pts[L].z);
    const grounder = fl.la < 10 || landR < 38;
    const thr = (b) => 0.45 + hyp(P.x - BASES[b].x, P.z - BASES[b].z) / 31;
    if (F.inf && grounder) {
      // 병살: 1루 주자, 2아웃 전 → 2루 먼저
      if (st.bases[0] && st.outs < 2 && get.f !== 1) {
        const t2 = get.t + thr(2), run2 = BASE_D / 7.2 + 0.35;
        if (t2 < run2) {
          const t1 = t2 + 0.65 + BASE_D / 31;
          if (t1 < RUN.first) { out.kind = 'DP'; out.label = '병살타'; out.outs = 2; out.throwTo = 2; out.throwT = t2 - get.t; out.relay = t1 - t2; return out; }
          out.kind = 'FC'; out.label = '땅볼 (선행 주자 아웃)'; out.outs = 1; out.throwTo = 2; out.throwT = t2 - get.t; out.bases = 1; return out;
        }
      }
      const self = get.f === 2 && hyp(P.x - BASES[1].x, P.z - BASES[1].z) < 9;
      const t1 = get.t + (self ? hyp(P.x - BASES[1].x, P.z - BASES[1].z) / 6.6 : thr(1));
      out.throwTo = 1; out.throwT = t1 - get.t;
      if (t1 < RUN.first) { out.kind = 'GROUND'; out.label = F.n + ' 땅볼 아웃'; out.outs = 1; return out; }
      out.kind = '1B'; out.label = '내야 안타'; out.bases = 1; out.infield = true; return out;
    }
    // 3) 외야(또는 내야를 빠져나간) 안타: 타자가 갈 수 있는 만큼
    const tb = (n) => RUN.first + RUN.leg * (n - 1);
    const tt = (n) => get.t + 0.8 + hyp(P.x - BASES[n % 4].x, P.z - BASES[n % 4].z) / (hyp(P.x, P.z) > 55 ? 24 : 30);
    let n = 1;
    while (n < 4 && tb(n + 1) + 0.35 < tt(n + 1)) n++;
    out.bases = n; out.kind = n === 4 ? 'IPHR' : ['', '1B', '2B', '3B'][n];
    out.label = n === 4 ? '그라운드 홈런' : ['', '안타', '2루타', '3루타'][n];
    out.throwTo = n % 4; out.throwT = tt(n) - get.t;
    out.deep = get.t;
    return out;
  }
  function direction(phi, dist) {
    const a = Math.abs(phi);
    if (dist < 40) return a < 12 ? '투수 앞' : phi < 0 ? (a > 28 ? '3루 쪽' : '유격수 쪽') : (a > 28 ? '1루 쪽' : '2루 쪽');
    if (a < 9) return '가운데';
    if (a < 26) return phi < 0 ? '좌중간' : '우중간';
    return phi < 0 ? '왼쪽' : '오른쪽';
  }

  // ---- 경기 상태 ----
  const TEAMS = [
    { id: 'CRION', name: 'CRION', color: '#fc5230', cap: '#1a1a1f', body: '#f3f1ee', pants: '#e6e2dc', players: ['강민준', '이도윤', '박서준', '최하준', '정우진', '윤지호', '한태양', '오시우', '임건우'], pitcher: '류현성' },
    { id: 'HIRION', name: 'HIRION', color: '#d8b25a', cap: '#152247', body: '#1d2b55', pants: '#cfd3dc', players: ['서도현', '김주원', '문예준', '배은찬', '송유찬', '조현수', '황민재', '남궁결', '신태오'], pitcher: '백승민' }
  ];
  function newGame(mode, innings) {
    return { mode, innings: innings || 3, inning: 1, half: 0, outs: 0, balls: 0, strikes: 0, bases: [null, null, null], score: [0, 0], line: [[0], []], hits: [0, 0], order: [0, 0], pitches: [0, 0], log: [], over: false, stat: { pa: 0, h: 0, hr: 0, k: 0, bb: 0, maxEv: 0, maxDist: 0, outs: 0, hrs: 0, ab: 0 } };
  }
  const batTeam = (g) => g.half;           // 0 초 = 원정(CRION, 사용자가 침) / 1 말 = 홈(HIRION)
  const batterName = (g) => TEAMS[batTeam(g)].players[g.order[batTeam(g)] % 9];
  const batterNo = (g) => g.order[batTeam(g)] % 9 + 1;

  // 주자 진루. adv = 각 주자(타자 포함)가 가는 베이스 수. 돌아온 주자 수(득점)와 경로를 돌려준다
  function moveRunners(g, batter, plan) {
    const paths = []; let runs = 0; const nb = [null, null, null];
    for (let b = 3; b >= 1; b--) {
      const who = g.bases[b - 1]; if (!who) continue;
      const to = plan.runner(b);
      if (to === null) { paths.push({ who, from: b, to: b, out: true }); continue; }
      paths.push({ who, from: b, to: Math.min(4, to) });
      if (to >= 4) runs++; else nb[to - 1] = who;
    }
    if (plan.batter !== null) { const to = plan.batter; paths.push({ who: batter, from: 0, to: Math.min(4, to) }); if (to >= 4) runs++; else nb[to - 1] = batter; }
    else paths.push({ who: batter, from: 0, to: 1, out: true });
    return { nb, runs, paths };
  }
  // 투구 하나의 결과를 경기에 반영. ev = {type:'ball'|'look'|'swing'|'foul'|'play', res}
  function applyPitch(g, ev) {
    const team = batTeam(g), batter = batterName(g);
    const r = { pa: false, text: '', call: '', runs: 0, paths: [], outsBefore: g.outs, basesBefore: g.bases.slice() };
    g.pitches[1 - team]++;
    if (ev.type === 'ball') { g.balls++; r.call = '볼'; if (g.balls >= 4) { r.pa = true; r.call = '볼넷'; r.kind = 'BB'; const m = moveRunners(g, batter, { batter: 1, runner: (b) => forced(g.bases, b) ? b + 1 : b }); finish(g, m, r); } }
    else if (ev.type === 'look' || ev.type === 'swing') {
      g.strikes++; r.call = ev.type === 'look' ? '스트라이크' : '헛스윙';
      if (g.strikes >= 3) { r.pa = true; r.call = ev.type === 'look' ? '루킹 삼진' : '헛스윙 삼진'; r.kind = 'K'; g.outs++; r.paths = [{ who: batter, from: 0, to: 0, out: true }]; }
    } else if (ev.type === 'foul') { if (g.strikes < 2) g.strikes++; r.call = '파울'; }
    else if (ev.type === 'play') {
      const o = ev.res; r.pa = true; r.kind = o.kind; r.call = o.label;
      if (o.kind === 'FOUL') { r.pa = false; if (g.strikes < 2) g.strikes++; }
      else if (o.kind === 'FOUL_OUT' || o.kind === 'POP' || o.kind === 'LINE' || o.kind === 'FLY') {
        g.outs++;
        const m = moveRunners(g, batter, { batter: null, runner: (b) => (o.sac && b === 3 && g.outs < 3) ? 4 : b });
        finish(g, m, r, true);
      } else if (o.kind === 'GROUND') {
        g.outs++;
        const m = moveRunners(g, batter, { batter: null, runner: (b) => g.outs < 3 ? (forced(g.bases, b) || b < 3 || r.outsBefore < 1 ? b + 1 : b) : b });
        finish(g, m, r, true);
      } else if (o.kind === 'DP') {
        g.outs += 2;
        const m = moveRunners(g, batter, { batter: null, runner: (b) => b === 1 ? null : g.outs < 3 ? b + 1 : b });
        finish(g, m, r, true);
      } else if (o.kind === 'FC') {
        g.outs++;
        const m = moveRunners(g, batter, { batter: 1, runner: (b) => b === 1 ? null : g.outs < 3 ? b + 1 : b });
        finish(g, m, r, true);
      } else {
        const n = o.bases;
        const of = o.fielder >= 6;
        const m = moveRunners(g, batter, { batter: n, runner: (b) => n >= 4 ? 4 : b + n + ((of && n === 1 && b === 2) || (of && n === 1 && b === 1 && o.deep > 4.6) || (n === 2 && b === 1 && o.deep > 5) ? 1 : 0) });
        g.hits[team]++;
        finish(g, m, r);
      }
    }
    if (r.pa) { g.balls = 0; g.strikes = 0; g.order[team]++; }
    if (g.outs >= 3) r.side = true;
    return r;
  }
  const forced = (bases, b) => { for (let i = 0; i < b; i++) if (!bases[i]) return false; return true; };
  function finish(g, m, r, outPlay) {
    if (outPlay && g.outs >= 3) { r.paths = m.paths; r.runs = 0; return; }
    g.bases = m.nb; r.paths = m.paths; r.runs = m.runs;
    if (m.runs) { g.score[batTeam(g)] += m.runs; const ln = g.line[batTeam(g)]; ln[g.inning - 1] = (ln[g.inning - 1] || 0) + m.runs; }
  }
  // 공수 교대 · 경기 끝
  function nextHalf(g) {
    g.outs = 0; g.balls = 0; g.strikes = 0; g.bases = [null, null, null];
    const N = g.innings;
    if (g.half === 0) {
      if (g.inning >= N && g.score[1] > g.score[0]) { g.over = true; return; }
      g.half = 1; g.line[1][g.inning - 1] = g.line[1][g.inning - 1] || 0;
    } else {
      if (g.inning >= N && g.score[0] !== g.score[1]) { g.over = true; return; }
      if (g.inning >= N + 3) { g.over = true; return; }
      g.half = 0; g.inning++; g.line[0][g.inning - 1] = 0;
    }
  }
  const walkOff = (g) => g.half === 1 && g.inning >= g.innings && g.score[1] > g.score[0];

  // ---- 컴퓨터 투수 · 타자 ----
  function aiPitch(g, derby) {
    if (derby) return { type: rnd() < 0.85 ? 'FB' : 'CH', target: { x: R(-0.18, 0.18), y: R(0.62, 0.98) }, kmh: R(118, 128) };
    const w = { FB: 44, SL: 20, CU: 12, CH: 13, FK: 11 };
    let s = rnd() * 100, type = 'FB';
    for (const k of PITCH_KEYS) { s -= w[k]; if (s < 0) { type = k; break; } }
    const ahead = g.strikes > g.balls, behind = g.balls >= 3 || g.balls > g.strikes + 1;
    let tx, ty;
    if (behind) { tx = R(-0.16, 0.16); ty = R(0.6, 0.95); }
    else if (ahead && rnd() < 0.55) { tx = (rnd() < 0.5 ? -1 : 1) * R(0.2, 0.36); ty = type === 'FK' || type === 'CU' ? R(0.25, 0.55) : R(0.4, 1.1); }
    else { tx = (rnd() < 0.5 ? -1 : 1) * R(0.05, 0.27); ty = R(0.5, 1.05); }
    tx += gauss() * 0.06; ty += gauss() * 0.06;
    const P = PITCHES[type];
    return { type, target: { x: tx, y: ty }, kmh: R(P.kmh[0], P.kmh[1]) };
  }
  // 사용자 투구 → 컴퓨터 타자 반응. 돌려줌: { swing, res(contact 결과 또는 null) }
  function aiBat(g, path, skill) {
    const x = path.plate.x, y = path.plate.y, zone = path.strike;
    const edge = zone ? Math.max(Math.abs(x) / 0.25, Math.abs(y - 0.775) / 0.3) : 1.2;
    let pSwing = zone ? 0.62 + 0.2 * (1 - edge) : 0.3 - Math.min(0.25, (Math.max(Math.abs(x) - 0.25, Math.abs(y - 0.775) - 0.3)) * 0.9);
    if (g.strikes >= 2) pSwing += zone ? 0.25 : 0.15;
    if (g.balls >= 3 && g.strikes < 2) pSwing -= 0.2;
    if (path.type !== 'FB') pSwing += zone ? -0.05 : 0.08;
    if (rnd() > clamp(pSwing, 0.03, 0.97)) return { swing: false };
    const brk = { FB: 0, SL: 0.35, CU: 0.45, CH: 0.4, FK: 0.5 }[path.type] || 0;
    const k = (1 + 0.55 * clamp(edge, 0, 1.6) + brk + (path.kmh - 140) / 70) * (skill || 1);
    const bias = path.type === 'CH' || path.type === 'FK' ? -0.03 : path.type === 'CU' ? -0.02 : path.kmh > 148 ? 0.015 : 0;
    const dt = bias + gauss() * 0.045 * k, dx = gauss() * 0.07 * k, dy = gauss() * 0.075 * k + (path.type === 'FK' || path.type === 'CU' ? 0.04 : 0);
    return { swing: true, res: contact(dt, dx, dy, DIFF.normal.win, DIFF.normal.rad) };
  }

  // ---- 결과 글 (나중에 플레이팩에서 크랙으로 보낼 때 쓰는 모양) ----
  const halfName = (g) => `${g.inning}회${g.half ? '말' : '초'}`;
  function playText(g, r, o, batter) {
    if (!o || !o.fl) return `${batter} ${r.call}`;
    const fl = o.fl, dir = direction(fl.phi, fl.dist);
    const stat = `${Math.round(fl.ev)}km/h·${Math.round(fl.la)}°${o.kind === 'HR' || fl.dist > 40 ? '·' + Math.round(fl.dist) + 'm' : ''}`;
    return `${batter} ${o.kind === 'HR' ? dir + ' 홈런' : o.kind === 'GROUND' || o.kind === 'DP' || o.kind === 'FC' ? o.label : dir + ' ' + o.label} (${stat})${r.runs ? ` · ${r.runs}점` : ''}`;
  }
  function summary(g) {
    const N = Math.max(g.innings, g.line[0].length, g.line[1].length);
    const row = (t) => TEAMS[t].name.padEnd(7) + Array.from({ length: N }, (_, i) => g.line[t][i] == null ? (t === 1 && g.over ? 'X' : '-') : g.line[t][i]).join(' ') + `  | ${g.score[t]}점 ${g.hits[t]}안타`;
    return [`[CRION 야구] ${TEAMS[0].name} ${g.score[0]} : ${g.score[1]} ${TEAMS[1].name} (${g.innings}이닝)`, row(0), row(1), '— 주요 장면'].concat(g.log.filter(l => l.big).slice(-8).map(l => '· ' + l.text)).join('\n');
  }

  root.CrionBaseballSim = {
    PITCHES, PITCH_KEYS, DIFF, ZONE, BASES, FIELD, TEAMS, FENCE_H, RELEASE, BALL_R,
    fenceR, standR, phiOf, inZone, pitchPath, contact, flight, resolve, direction,
    newGame, applyPitch, nextHalf, walkOff, batterName, batterNo, batTeam, aiPitch, aiBat, playText, summary, halfName,
    _seed(f) { rnd = f || Math.random; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CrionBaseballSim;
})(typeof window !== 'undefined' ? window : globalThis);
