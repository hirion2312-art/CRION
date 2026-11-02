// 6팀 리그 엔진 시험: node test/league.test.js
const assert = require('assert');
const C = require('../src/renderer/pk-league.js');
const data = require('../packs/hirion.baseball-proto/data.json');
const X = C.index(data);
let n = 0;
const t = (name, f) => { f(); n++; console.log('ok', name); };

t('데이터: 6팀 · 선수 90명 · 팀마다 9포지션+투수 4명', () => {
  assert.strictEqual(X.teams.length, 6);
  assert.strictEqual(data.players.length, 90);
  for (const tm of X.teams) {
    const ps = data.players.filter(p => p.team === tm.id);
    for (const pos of C.FIELD) assert.ok(ps.some(p => p.pos === pos && p.named), tm.id + pos);
    assert.strictEqual(ps.filter(p => p.pos === 'P').length, 6);
    assert.ok(ps.filter(p => p.named).every(p => p.emo.length === 4), '감정 4종');
  }
  assert.strictEqual(X.P.SEO02.name, '백승호'); assert.ok(C.tr(X.P.SEO02, 'limit90'));
});

t('일정: 팀당 30경기 · 10시리즈 · 같은 상대 6경기', () => {
  const L = C.newLeague(X, { seed: 1, team: 'SEO' });
  assert.strictEqual(L.games.length, 90);
  for (const tm of X.teams) {
    const g = L.games.filter(x => x.home === tm.id || x.away === tm.id);
    assert.strictEqual(g.length, 30);
    for (const o of X.teams) if (o.id !== tm.id) assert.strictEqual(g.filter(x => x.home === o.id || x.away === o.id).length, 6);
  }
});

t('시즌 시뮬: 기록이 야구답다 (타율 .240~.300, 팀당 3.5~6점)', () => {
  let h = 0, ab = 0, r = 0, g = 0;
  for (let s = 0; s < 3; s++) {
    const L = C.newLeague(X, { seed: 40 + s }); L.my = null;
    for (const gm of L.games) { const G = C.newGame(X, L, gm); C.simToEnd(X, L, G); r += G.score[0] + G.score[1]; g++; assert.ok(G.over && gm.st === 'done'); }
    for (const id in L.stats.reg) { const b = L.stats.reg[id].bat; if (b) { h += b.h; ab += b.ab; } }
    const st = C.standings(X, L); assert.strictEqual(st.reduce((a, x) => a + x.w + x.l + x.d, 0), 180);
  }
  const avg = h / ab, rpg = r / g / 2;
  assert.ok(avg > 0.24 && avg < 0.3, 'AVG ' + avg); assert.ok(rpg > 3.5 && rpg < 6, 'R/G ' + rpg);
});

t('같은 씨앗 = 같은 경기 (세이브 재현)', () => {
  const run = () => { const L = C.newLeague(X, { seed: 9, team: 'BUS' }); const gm = C.nextGame(L); C.simOthersUntil(X, L, gm.no); const G = C.newGame(X, L, gm); C.simToEnd(X, L, G); return G.score.join('-') + G.log.length; };
  assert.strictEqual(run(), run());
});

t('투구 로그 · 명장면 · ⚾경기로그 · ⚾중간로그 · ⚾장면', () => {
  const L = C.newLeague(X, { seed: 7, team: 'SEO' });
  const gm = C.nextGame(L); C.simOthersUntil(X, L, gm.no);
  const G = C.newGame(X, L, gm);
  for (let i = 0; i < 30 && !G.over; i++) C.stepPA(X, L, G);
  const mid = C.midCode(X, L, G, '노태경이 마운드에 가는 장면');
  assert.ok(mid.startsWith('⚾중간로그 #'), mid); assert.ok(/\[라인\]/.test(mid) && /\[현재\]/.test(mid) && /\[요청\] 노태경/.test(mid) && /\[상태\] 📅/.test(mid));
  assert.ok(mid.length <= L.prefs.limit, '글자 한도 ' + mid.length);
  L.sent[G.no] = G.log.length;
  C.simToEnd(X, L, G);
  const code = C.gameCode(X, L, G, 'std');
  assert.ok(code.startsWith('⚾경기로그 #'), code); assert.ok(/\[명장면1\]/.test(code) && /\[라인\] /.test(code) && /vs/.test(code));
  assert.ok(code.length <= 1000, 'std ' + code.length);
  L.prefs.limit = 420; const shortC = C.gameCode(X, L, G, 'std'); assert.ok(shortC.length <= 420, '줄여도 한도 ' + shortC.length);
  const s = C.gameCode(X, L, G, 'short'); assert.ok(s.split('[명장면').length === 2);
  const h = C.highlights(X, L, G, 1)[0];
  const sc = C.sceneCode(X, L, { teams: G.teams, no: G.no }, Object.assign({ sa: h.scoreAfter, p: h.pitches }, h));
  assert.ok(/^⚾장면/.test(sc) && /\[투구\] 1구/.test(sc));
  // 투구 순서는 결과와 맞는다: 삼진 = 마지막 공 스트라이크, 볼넷 = 볼 4개
  for (const r of G.log) {
    if (!r.pitches.length) continue;
    const last = r.pitches[r.pitches.length - 1][3];
    if (r.res === 'K') assert.ok(['S', 'L'].includes(last));
    if (r.res === 'BB') assert.strictEqual(r.pitches.filter(p => p[3] === 'B').length, 4);
    if (['1B', '2B', '3B', 'HR', 'OUT', 'E'].includes(r.res)) assert.strictEqual(last, 'X');
  }
  assert.ok(L.logs[G.no] && L.logs[G.no].pa.length === G.log.length, '내 경기 로그 보관');
});

t('결정 순간 · 작전(번트/고의4구/투수교체) · 크랙 order 해석', () => {
  const L = C.newLeague(X, { seed: 3, team: 'DGU' });
  const gm = C.nextGame(L); C.simOthersUntil(X, L, gm.no);
  const G = C.newGame(X, L, gm);
  const my = G.teams.indexOf('DGU');
  G.inn = 8; G.half = my; G.bases = [{ id: G.lineup[my][0].id }, { id: G.lineup[my][1].id }, null]; G.outs = 0;
  const d = C.decisionAt(X, L, G); assert.ok(d && d.side === 'off', JSON.stringify(d));
  const opts = C.orderOptions(X, L, G, 'off'); assert.ok(opts.some(o => o.k === 'bunt') && opts.some(o => o.k === 'ph'));
  const r = C.stepPA(X, L, G, { ord: { k: 'bunt' }, manual: true }); assert.ok(/번트/.test(r.desc), r.desc);
  const R = C.parseReply('…\n【CRION】 scene=paused order=투수교체:마무리 hint=번트 choices=정면승부,번트작전 【/CRION】', X);
  assert.strictEqual(R.scene, 'paused'); assert.strictEqual(R.orders[0].k, 'pc'); assert.deepStrictEqual(R.choices, ['정면승부', '번트작전']);
  G.half = 1 - my; G.bases = [null, { id: G.lineup[1 - my][0].id }, null];
  const ro = C.resolveOrder(X, L, G, R.orders[0]); assert.strictEqual(ro.k, 'pc'); assert.strictEqual(X.P[ro.id].role, 'CL');
  const r2 = C.stepPA(X, L, G, { ord: ro, manual: true }); assert.strictEqual(G.pitcher[my], ro.id); assert.ok(r2);
  const r3 = C.stepPA(X, L, G, { ord: { k: 'ibb' }, manual: true }); if (!r3.ord.ignored) assert.strictEqual(r3.res, 'IBB');
});

t('직접 플레이: 투구 하나씩 → 타석 반영', () => {
  const L = C.newLeague(X, { seed: 5, team: 'INC' });
  const gm = C.nextGame(L); C.simOthersUntil(X, L, gm.no);
  const G = C.newGame(X, L, gm);
  const rng = C.RNG(11);
  const ps = []; const cnt = { b: 0, s: 0 }; let out = null;
  for (let i = 0; i < 20 && !out; i++) {
    const p = C.aiPitch(X, L, G, cnt, rng);
    const r = C.swingResult(X, L, G, p, { swing: true, timing: 0.05, guess: p.z }, cnt, rng);
    ps.push([p.t, p.kmh, p.z, r.r]);
    if (r.r === 'X') out = r.out; else if (r.r === 'B') { if (++cnt.b === 4) out = 'BB'; } else if (r.r === 'F') { if (cnt.s < 2) cnt.s++; } else if (++cnt.s === 3) out = 'K';
  }
  const rec = C.finishUserPA(X, L, G, ps, out || 'OUT');
  assert.ok(rec.user && rec.tags.includes('직접 플레이'));
  assert.strictEqual(G.log.length, 1);
  const pr = C.pitchResult(X, L, G, { pick: 4, acc: 0.9, type: X.P[G.pitcher[1 - G.half]].pitches[0] }, { b: 0, s: 0 }, rng);
  assert.ok(['B', 'S', 'L', 'F', 'X'].includes(pr.r));
});

t('포스트시즌: 2위 vs 3위 → 1위와 한국시리즈 → 우승', () => {
  const L = C.newLeague(X, { seed: 21, team: 'GWJ' });
  for (const gm of L.games) { if (gm.st === 'done') continue; const G = C.newGame(X, L, gm); C.simToEnd(X, L, G); if (gm.si !== (L.games[gm.no] || {}).si) C.afterSeries(X, L, gm.si); }
  assert.ok(C.regDone(L));
  const P = C.startPost(X, L); assert.strictEqual(P.seeds.length, 3);
  let guard = 0, g;
  while ((g = C.nextPostGame(L)) && guard++ < 10) { const G = C.newPostGame(X, L, g); C.simToEnd(X, L, G); }
  assert.ok(L.champion && L.post.done, '우승팀'); assert.ok(L.post.ks.games.length >= 3 && L.post.ks.games.length <= 5);
  assert.ok(C.statusLine(X, L).includes('우승'));
});

t('커리어: 신인 입단 · 주전 경쟁 · 훈련 · 목표 사다리', () => {
  const L = C.newLeague(X, { seed: 2, team: 'SEO', mode: 'career', me: { name: '한결', pos: 'SS', from: '고졸', bats: 'L' } });
  assert.ok(L.me && L.me.team === 'SEO' && C.roster(X, L, 'SEO').some(p => p.id === 'ME'));
  L.career.plan = { si: 0, train: 2, rest: 1, social: 0, focus: 'con' };
  const before = L.me.b.con; C.afterSeries(X, L, 0); assert.ok(L.me.b.con > before);
  const lad = C.ladderState(X, L); assert.strictEqual(lad[0].ok, true); assert.ok(lad.length >= 6);
  assert.ok(C.statusLine(X, L).includes('커리어(서울·유격수 한결)'));
});

console.log(`league ${n}/${n} 통과`);
