// 플레이팩 공통 키트 시험: node test/kit.test.js
'use strict';
const assert = require('assert');
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
global.window = global;
require('../src/renderer/pk-kit.js');
const Kit = global.CrionKit;
let ok = 0; const t = (n, f) => { try { f(); ok++; console.log('  ✔ ' + n); } catch (e) { console.log('  ✘ ' + n + '\n    ' + e.message); process.exitCode = 1; } };

t('해석 실패 기록: 최근 8개만 · 같은 글은 한 번 · 신고용 글은 3개·600자', () => {
  for (let i = 0; i < 12; i++) Kit.logFail('hirion.x', '상태창을 찾지 못함', '응답 ' + i + ' ' + 'ㄱ'.repeat(900));
  Kit.logFail('hirion.x', '상태창을 찾지 못함', '응답 11 ' + 'ㄱ'.repeat(900));
  assert.strictEqual(Kit.fails().length, 8);
  const txt = Kit.failsText(3);
  assert.ok(/^\[화면 해석 실패 기록\]/.test(txt));
  assert.strictEqual(txt.split('\n---\n').length, 3);
  assert.ok(txt.length < 3 * 700 + 200);
});
t('기본 읽기 설정', () => {
  const P = Kit.prefs();
  assert.strictEqual(P.size, 'm'); assert.strictEqual(P.auto, false);
});
t('지난 줄거리 재료: 마지막 묘사 · 내 마지막 말(명령 제외) · 최근 사람 5명', () => {
  global.document = { addEventListener() {}, removeEventListener() {} };
  const el = { style: { setProperty() {} }, querySelectorAll: () => [], contains: () => false, appendChild() {} };
  const K = Kit.create({ el, packId: 'p' });
  const lines = [{ who: '', t: '곰팡이 냄새가 코끝을 찔렀다. 낮은 천장.' }, { who: '세이렌', t: '폐하!' }, { who: '마왕', t: '여긴 어디지', me: true }, { who: '', t: '#간부_정례보고 …', me: true }, { who: '바르크', t: '보고합니다' }, { who: '', t: '조명이 꺼진 스튜디오에 정적이 내려앉았다.' }];
  const r = K.recapFromLines(lines, (n) => n === '세이렌' ? '#c' : '');
  assert.strictEqual(r.narr, '조명이 꺼진 스튜디오에 정적이 내려앉았다.');
  assert.strictEqual(r.mine, '여긴 어디지');
  assert.deepStrictEqual(r.people.map(p => p.name), ['바르크', '세이렌']);
  assert.strictEqual(r.people[1].color, '#c');
});
console.log(`\n공통 키트 ${ok}/3 통과`);
