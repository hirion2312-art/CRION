// 공용 응답 해석 시험: node test/reply.test.js
'use strict';
const assert = require('assert');
const R = require('../src/renderer/reply');

const t = [];
const test = (n, f) => t.push([n, f]);

const A = `*제단의 빛이 가라앉자 위카가 내 소매 끝을 꼭 쥐고 있었다.*

마가렛 교수가 명부를 넘기며 우리를 훑었다.
【마가렛|엄격】"위카, 화 속성. 해의 동으로 배정합니다."

"저, 저기… 해의 동이면 따뜻한 곳이에요?" 위카가 올려다본다.
레이먼드: "…괜찮아, 따뜻해."

💡 기숙사로 간다 / 학교를 구경한다 / 카일에게 인사한다
━━━━━━━━━━━━━━
📅 1학년 봄 1일차 오후 | 📍기숙사
🎓 신입생 | 🏠해의 동 | 💰3은 0동
🐾 위카 Lv 5 | ❤️165/165 | ✨XP 0/20
━━━━━━━━━━━━━━`;

test('구분선 사이 상태창을 본문에서 뺀다', () => {
  const r = R.parse(A);
  assert.ok(r.status);
  assert.strictEqual(r.status.rows.length, 3);
  assert.ok(!r.beats.some(b => /📅|❤️/.test(b.text)));
});
test('상태창 게이지 숫자', () => {
  const r = R.parse(A);
  const hp = r.status.rows[2].find(c => /❤️/.test(c.text));
  assert.deepStrictEqual([hp.cur, hp.max], [165, 165]);
});
test('💡 선택지', () => {
  assert.deepStrictEqual(R.parse(A).choices, ['기숙사로 간다', '학교를 구경한다', '카일에게 인사한다']);
});
test('대사 표기 여러 가지', () => {
  const b = R.parse(A).beats;
  const m = b.find(x => x.who === '마가렛');
  assert.ok(m && m.face === '엄격' && m.text.startsWith('위카'));
  assert.ok(b.find(x => x.who === '레이먼드' && x.text.includes('따뜻해')));
  assert.strictEqual(b[0].kind, 'narr');
  assert.ok(!b[0].text.includes('*'));
});
test('번호 선택지 (머리줄 포함)', () => {
  const r = R.parse('그녀가 나를 본다.\n\n어떻게 할까?\n1. 손을 잡는다\n2. 모른 척한다\n3) 도망친다');
  assert.deepStrictEqual(r.choices, ['손을 잡는다', '모른 척한다', '도망친다']);
  assert.strictEqual(r.beats.length, 1);
});
test('코드 상자로 온 상태창', () => {
  const r = R.parse([{ t: 'text', s: '비가 내린다.' }, { t: 'text', s: '[DAY 3] 체력: 40/100\n식량: 12 | 물: 5\n위치: 옥상', code: true }]);
  assert.ok(r.status && r.status.rows.length === 3);
  assert.strictEqual(r.beats.length, 1);
});
test('상태창 없는 평범한 응답', () => {
  const r = R.parse('그는 웃었다. 오늘은 날씨가 좋다.\n"같이 걸을래?"');
  assert.strictEqual(r.status, null);
  assert.strictEqual(r.choices.length, 0);
  assert.strictEqual(r.beats.length, 2);
});
test('{{img::}} 표식은 글에서 지운다', () => {
  const r = R.parse('{{img::위카::웃음}}\n위카가 웃었다.');
  assert.strictEqual(r.beats[0].text, '위카가 웃었다.');
});
test('그림은 자기 자리 바로 다음 장면에 붙는다', () => {
  const r = R.parse([{ t: 'text', s: '아침이다.\n' }, { t: 'img', src: 'a.png', w: 400, h: 700, alt: '세라' }, { t: 'text', s: '세라 "안녕!"\n카일 "왔어?"' }]);
  assert.ok(!r.beats[0].imgs);
  assert.strictEqual(r.beats[1].imgs[0].src, 'a.png');
});
test('다른 사람이 말하면 인물 그림이 내려간다', () => {
  const r = R.parse([{ t: 'img', src: 's.png', w: 400, h: 700, alt: '' }, { t: 'text', s: '세라 "안녕!"\n세라 "오늘 뭐 해?"\n카일 "나도 낄래."' }]);
  const f = R.stageFrames(r.beats);
  assert.strictEqual(f[0].person.src, 's.png');
  assert.strictEqual(f[1].person.src, 's.png');
  assert.strictEqual(f[2].person, null);
});
test('가로 그림은 배경으로 남는다', () => {
  const r = R.parse([{ t: 'img', src: 'bg.png', w: 1200, h: 700 }, { t: 'text', s: '숲이다.\n세라 "조용하네."\n카일 "그러게."' }]);
  const f = R.stageFrames(r.beats);
  assert.ok(f.every(x => x.scene && x.scene.src === 'bg.png'));
});
test('그림 이름이 다른 인물이면 그 사람 차례에 내린다', () => {
  const r = R.parse([{ t: 'text', s: '세라 "안녕!"' }, { t: 'img', src: 'k.png', w: 400, h: 800, alt: '카일_웃음' }, { t: 'text', s: '카일 "어."\n세라 "뭐야."' }]);
  const f = R.stageFrames(r.beats);
  assert.strictEqual(f[1].person.src, 'k.png');
  assert.strictEqual(f[2].person, null);
});
test('긴 서술은 문장 끝에서 나눈다', () => {
  const long = '가나다라마바사아자차카타파하. '.repeat(20);
  const r = R.parse(long);
  assert.ok(r.beats.length > 1 && r.beats.every(b => b.text.length <= 160));
});

test('세라 그림이 세라 대사 뒤에 와도 카일이 말할 땐 안 보인다', () => {
  const r = R.parse([{ t: 'text', s: '세라: "식량이 부족해요."\n' }, { t: 'img', src: 'https://x/a.png', w: 250, h: 410, alt: '세라' }, { t: 'text', s: '카일 "내가 볼게."\n세라 "조심해요."' }]);
  const f = R.stageFrames(r.beats);
  assert.strictEqual(f[0].person && f[0].person.alt, '세라');
  assert.strictEqual(f[1].person, null);
});
test('파일 이름으로도 인물을 안다', () => {
  const r = R.parse([{ t: 'img', src: 'https://x/%EC%84%B8%EB%9D%BC_smile.png', w: 300, h: 600 }, { t: 'text', s: '카일 "어."\n세라 "안녕."' }]);
  const f = R.stageFrames(r.beats);
  assert.strictEqual(f[0].person, null);
  assert.ok(f[1].person);
});

let fail = 0;
for (const [n, f] of t) {
  try { f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + e.message); }
}
console.log(fail ? `\n${fail}개 실패` : `\n응답 해석 시험 ${t.length}개 통과`);
process.exit(fail ? 1 : 0);
