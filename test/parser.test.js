// 팩 파서 점검: node test/parser.test.js
const assert = require('assert');
const P = require('../src/renderer/parser.js');
const M = require('../packs/hirion.safehouse/manifest.json');

const s10 = `📍식당 · D10 저녁
🍚식량 14 | 🩹의료품 2 | 🧱자재 9 | 🛡️방어력 34
👥주민 4/5 | 😊사기 61
🛠️일과: 방어보강 1 · 창고 1
🚶파견: 없음 | 🚪대기: 없음
🏢확장 2단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0`;

const s11m = s10.replace('D10 저녁', 'D11 아침').replace('식량 14', '식량 10').replace('사기 61', '사기 57');
const s11n = s11m.replace('D11 아침', 'D11 밤').replace('자재 9', '자재 4').replace('방어력 34', '방어력 41');
const s12 = s11n.replace('D11 밤', 'D12 아침');
const s16n = s10.replace('D10 저녁', 'D16 밤');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('상태창 감지', () => {
  assert.ok(P.isStatus(M, s10));
  assert.ok(!P.isStatus(M, '식당 창문에 김이 서렸다.'));
});

t('칸 읽기', () => {
  const r = P.parseStatus(M, s10);
  assert.strictEqual(r.day, 10);
  assert.strictEqual(r.phase, '저녁');
  assert.strictEqual(r.loc, '식당');
  assert.strictEqual(r.fields.food, 14);
  assert.strictEqual(r.fields.def, 34);
  assert.deepStrictEqual(r.fields.pop, { value: 4, max: 5 });
  assert.strictEqual(r.fields.mor, 61);
  assert.strictEqual(r.fields.job, '방어보강 1 · 창고 1');
  assert.strictEqual(r.fields.away, '없음');
  assert.strictEqual(r.fields.wait, '없음');
  assert.strictEqual(r.fields.expand, 2);
  assert.strictEqual(r.fields.research, 0);
});

t('변화량', () => {
  const d = P.diff(P.parseStatus(M, s10), P.parseStatus(M, s11n));
  assert.deepStrictEqual(d, { food: -4, mat: -5, def: 7, mor: -4 });
});

t('장면 결정 (노말)', () => {
  const o = { mode: 'normal' };
  assert.strictEqual(P.decideScene(M, o, P.parseStatus(M, s10), '', null), 'evening');
  assert.strictEqual(P.decideScene(M, o, P.parseStatus(M, s11m), '', 'evening'), 'tense');
  assert.strictEqual(P.decideScene(M, o, P.parseStatus(M, s11n), '', 'tense'), 'bignight');
  assert.strictEqual(P.decideScene(M, o, P.parseStatus(M, s12), '', 'bignight'), 'relief');
  assert.strictEqual(P.decideScene(M, o, P.parseStatus(M, s12), '', 'morning'), 'morning');
  assert.strictEqual(P.decideScene(M, o, P.parseStatus(M, s16n), '', null), 'night');
});

t('장면 결정 (하드: 16일 밤도 큰 밤)', () => {
  assert.strictEqual(P.decideScene(M, { mode: 'hard' }, P.parseStatus(M, s16n), '', null), 'bignight');
});

t('카운트다운', () => {
  const o = { mode: 'normal' };
  assert.strictEqual(P.countdown(M, o, P.parseStatus(M, s10)).label, '내일 밤 (D11)');
  assert.strictEqual(P.countdown(M, o, P.parseStatus(M, s11m)).label, '오늘 밤');
  assert.strictEqual(P.countdown(M, o, P.parseStatus(M, s11n)).label, '지금 진행 중');
  assert.strictEqual(P.countdown(M, o, P.parseStatus(M, s12)).label, 'D-9 (D21)');
  assert.strictEqual(P.countdown(M, { mode: 'hard' }, P.parseStatus(M, s12)).label, 'D-4 (D16)');
});

t('이모지 없이 써도 읽힘', () => {
  const plain = '식당 · D3 낮\n식량 7 | 의료품 2 | 자재 5 | 방어력 30\n주민 2/3 | 사기 60';
  const r = P.parseStatus(M, plain);
  assert.ok(P.isStatus(M, plain));
  assert.strictEqual(r.day, 3);
  assert.strictEqual(r.phase, '낮');
  assert.strictEqual(r.fields.food, 7);
});

console.log(`\n${n}개 모두 통과`);
