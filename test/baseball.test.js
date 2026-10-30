// 3D 야구 규칙·물리 시험: node test/baseball.test.js
'use strict';
const assert = require('assert');
const S = require('../src/renderer/pk-baseball-sim.js');
let ok = 0; const t = (n, f) => { try { f(); ok++; console.log('  ✔ ' + n); } catch (e) { console.log('  ✘ ' + n + '\n    ' + e.message); process.exitCode = 1; } };
const empty = () => ({ bases: [null, null, null], outs: 0 });
t('투구: 목표 지점(z=0)을 지난다 · 존 판정', () => {
  for (const k of S.PITCH_KEYS) { const p = S.pitchPath(k, { x: 0.1, y: 0.7 }, 140, 0.85); const q = p.at(p.T); assert.ok(Math.abs(q.x - 0.1) < 1e-6 && Math.abs(q.y - 0.7) < 1e-6 && Math.abs(q.z) < 1e-6, k); assert.ok(p.strike); }
  assert.ok(!S.pitchPath('FB', { x: 0.4, y: 0.7 }, 150, 1).strike);
});
t('타격: 겨냥·타이밍이 틀리면 헛스윙, 맞으면 공이 위를 맞을수록 땅볼', () => {
  const D = S.DIFF.normal;
  assert.strictEqual(S.contact(0.2, 0, 0, D.win, D.rad), null);
  assert.strictEqual(S.contact(0, 0.3, 0, D.win, D.rad), null);
  let up = 0, down = 0; for (let i = 0; i < 200; i++) { up += S.contact(0, 0, 0.1, D.win, D.rad).la; down += S.contact(0, 0, -0.1, D.win, D.rad).la; }
  assert.ok(up / 200 < 0 && down / 200 > 25);
});
t('타구 물리: 160km/h·28° ≈ 115~130m, 가운데 강한 타구는 홈런', () => {
  S._seed(() => 0.5);
  const f = S.flight(160, 28, 0); assert.ok(!f.foul);
  const d = Math.hypot(f.pts[f.land].x, f.pts[f.land].z); assert.ok(d > 105 && d < 135, d);
  assert.strictEqual(S.resolve(S.flight(178, 30, 0), empty()).kind, 'HR');
  assert.ok(S.flight(140, 30, -62).foul);
  S._seed();
});
t('수비: 약한 땅볼은 내야 아웃, 3루 주자 + 깊은 뜬공 = 희생플라이', () => {
  assert.strictEqual(S.resolve(S.flight(105, -8, -15), empty()).kind, 'GROUND');
  let sac = false;
  for (const phi of [-20, -10, 0, 10, 20]) { const r = S.resolve(S.flight(150, 30, phi), { bases: [null, null, 'x'], outs: 0 }); if (r.sac) sac = true; }
  assert.ok(sac);
});
t('경기: 볼넷 밀어내기 · 삼진 · 3아웃 공수 교대 · 끝내기', () => {
  const g = S.newGame('game', 1);
  g.bases = ['a', 'b', 'c'];
  for (let i = 0; i < 4; i++) S.applyPitch(g, { type: 'ball' });
  assert.deepStrictEqual(g.score, [1, 0]); assert.ok(g.bases.every(Boolean));
  let r; for (let k = 0; k < 3; k++) for (let i = 0; i < 3; i++) r = S.applyPitch(g, { type: 'look' });
  assert.ok(r.side); S.nextHalf(g); assert.strictEqual(g.half, 1); assert.deepStrictEqual(g.bases, [null, null, null]);
  r = S.applyPitch(g, { type: 'play', res: { kind: 'HR', label: '홈런', bases: 4, fielder: -1 } });
  assert.strictEqual(g.score[1], 1); assert.ok(!S.walkOff(g));
  r = S.applyPitch(g, { type: 'play', res: { kind: 'HR', label: '홈런', bases: 4, fielder: -1 } });
  assert.ok(S.walkOff(g));
  assert.ok(/CRION 1 : 2 HIRION/.test(S.summary(g)));
});
t('투구 연습 컴퓨터 타자: 한가운데 직구엔 자주 휘두르고, 먼 볼엔 덜', () => {
  const g = S.newGame('pitch'); let a = 0, b = 0;
  for (let i = 0; i < 1000; i++) { if (S.aiBat(g, S.pitchPath('FB', { x: 0, y: 0.78 }, 148, 1)).swing) a++; if (S.aiBat(g, S.pitchPath('FB', { x: 0.6, y: 1.5 }, 148, 1)).swing) b++; }
  assert.ok(a > 600 && b < 200, a + '/' + b);
});
console.log(`\n3D 야구 ${ok}/6 통과`);
