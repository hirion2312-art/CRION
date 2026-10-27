// 「아포칼립스 안전지대의 관리자」 응답 해석 시험: node test/safehouse.test.js
//  샘플 3턴 = 인수인계 문서 부록 G (크랙 화면에서 마크다운이 렌더링된 뒤의 글 모양)
'use strict';
const assert = require('assert');
const path = require('path');
const SH = require('../src/renderer/pk-safehouse.js');
const data = require(path.join(__dirname, '..', 'packs', 'hirion.safehouse', 'data.json'));
const roster = new SH.Roster(data);

const segs = (scene, status, pre) => [].concat(pre || [], [{ t: 'text', s: scene }], status ? [{ t: 'text', s: status, code: true }] : []);

const T1 = segs(`철문 너머로 두 사람의 그림자가 보였다. 하나는 편의점 조끼를 입은 마른 여자, 하나는 큰 배낭을 멘 여자였다.
계단 아래에서 무언가 질질 끌리는 소리가 올라왔다.
김소담💬 철문을 두드리던 손을 멈춘다 "저기요! 안에 사람 있죠? 문 좀 열어 주세요!"
이나래💬 숨을 몰아쉬며 뒤를 돌아본다 "아래에서… 뭔가 따라와요."`, `📍1층 철문 · D1 아침
🍚식량 7 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 30
👥주민 0/3 | 😊사기 60
🛠️일과: 없음
🚶파견: 없음 | 🚪대기: 김소담(1일째), 이나래(1일째)
🏢확장 1단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0`);

const T2 = segs(`밤새 계단 아래가 시끄러웠다. 아침 햇빛 아래, 철문 경첩 하나가 휘어 있었다.
소담💬 팔에 감은 붕대를 내려다본다 "괜찮아요. 긁힌 거예요, 그냥."
📦 🍚식량 −2 · 🛡️방어력 −1 · 🩹소담 부상`, `📍식당 · D2 🌅아침
🍚식량 5 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 29
👥주민 2/3 | 😊사기 58
🛠️일과: 미정
🚶파견: 없음 | 🚪대기: 없음
🏢확장 1단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0`);

const T3 = segs(`청운동 골목 끝, 셔터가 반쯤 내려간 편의점 앞에 두 사람이 섰다.
조현우💬 지름길을 가리키며 씩 웃는다 "여기 골목으로 가면 오 분이면 돌아와요. 진짜로."`, `📍청운24시 편의점 · D3 ☀️낮
🍚식량 9 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 29
👥주민 4/10 | 😊사기 61
🛠️일과: 이나래(휴식), 김소담(의무) / 조현우(파견)
🚶파견: 조현우·최하은→청운24시 편의점(귀환 D3) | 🚪대기: 없음
🏢확장 2단계 | ⛽연료 0 💎희귀 0 🧪연구재료 0 | 🔬연구 Lv 0`, [{ t: 'img', src: 'https://example/편의점.webp', w: 1920, h: 1072 }]);

let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log('  ✔', name); };

t('명부·별칭: 성 뺀 이름, 1글자 이름은 별칭 안 씀', () => {
  assert.strictEqual(roster.resolve('소담'), '김소담');
  assert.strictEqual(roster.resolve('김소담'), '김소담');
  assert.strictEqual(roster.resolve('설'), '');
  assert.strictEqual(roster.resolve('한설'), '한설');
  assert.strictEqual(roster.resolve('황보미'), '황보미');
});

const M = SH.blank();
t('샘플 1: 평상 턴 (첫 방문자, 대기 2명)', () => {
  const P = SH.parse(T1, roster);
  const s = P.status;
  assert.strictEqual(s.place, '1층 철문'); assert.strictEqual(s.day, 1); assert.strictEqual(s.time, '아침');
  assert.deepStrictEqual([s.food, s.med, s.mat, s.def, s.ppl, s.cap, s.morale], [7, 2, 5, 30, 0, 3, 60]);
  assert.deepStrictEqual([s.fuel, s.rare, s.rmat, s.rlv, s.exp], [0, 0, 0, 0, 1]);
  assert.deepStrictEqual(s.wait, [{ name: '김소담', days: 1 }, { name: '이나래', days: 1 }]);
  assert.deepStrictEqual(s.chores, []); assert.deepStrictEqual(s.dispatch, []);
  assert.deepStrictEqual(P.beats.map(b => b.kind), ['narr', 'narr', 'say', 'say']);
  const b = P.beats[2];
  assert.strictEqual(b.who, '김소담'); assert.strictEqual(b.act, '철문을 두드리던 손을 멈춘다'); assert.strictEqual(b.text, '저기요! 안에 사람 있죠? 문 좀 열어 주세요!');
  assert.ok(!P.beats.some(x => /📍|식량/.test(x.text)), '상태창 줄은 장면에서 빠진다');
  const ev = SH.absorb(M, P, data);
  assert.strictEqual(ev.dayChanged, false);
  assert.strictEqual(M.people['김소담'].st, 'wait'); assert.strictEqual(M.people['이나래'].st, 'wait');
});

t('샘플 2: 날짜 바뀜 → 아침점호, 📦 변동, 성 뺀 이름', () => {
  const P = SH.parse(T2, roster);
  assert.strictEqual(P.status.day, 2); assert.strictEqual(P.status.time, '아침'); assert.strictEqual(P.status.place, '식당');
  assert.deepStrictEqual(P.delta.map(d => d.kind === 'res' ? [d.key, d.n] : [d.name, d.ev]), [['food', -2], ['def', -1], ['김소담', '부상']]);
  const say = P.beats.find(b => b.kind === 'say');
  assert.strictEqual(say.who, '김소담'); assert.strictEqual(say.raw, '소담');
  assert.ok(!P.beats.some(b => /📦/.test(b.text)));
  const ev = SH.absorb(M, P, data);
  assert.strictEqual(ev.dayChanged, true); assert.strictEqual(ev.prevDay, 1);
  assert.strictEqual(ev.lines.length, 3);
  assert.deepStrictEqual(ev.joined.sort(), ['김소담', '이나래']);   // 대기에서 사라지고 주민 0→2
  assert.strictEqual(M.people['김소담'].st, 'res'); assert.strictEqual(M.people['김소담'].hurt, '부상');
});

t('샘플 3: 일과·파견 줄, 그림 조각', () => {
  const P = SH.parse(T3, roster);
  const s = P.status;
  assert.strictEqual(s.time, '낮'); assert.strictEqual(s.exp, 2); assert.strictEqual(s.cap, 10); assert.strictEqual(s.ppl, 4);
  assert.deepStrictEqual(s.chores, [{ name: '이나래', job: '휴식' }, { name: '김소담', job: '의무' }, { name: '조현우', job: '파견' }]);
  assert.deepStrictEqual(s.dispatch, [{ party: ['조현우', '최하은'], dest: '청운24시 편의점', ret: 3 }]);
  assert.strictEqual(P.beats[0].img.src, 'https://example/편의점.webp');
  assert.strictEqual(P.beats[0].img.kind, 'place');
  SH.absorb(M, P, data);
  assert.strictEqual(M.people['최하은'].st, 'res'); assert.strictEqual(M.people['조현우'].st, 'res');
  assert.ok(M.regions['청운24시 편의점'] && M.regions['청운24시 편의점'].went === 1);
  assert.ok(M.log.some(l => /출발/.test(l.t)));
});

t('표식 없는 응답: 장면은 나오고 상태는 그대로', () => {
  const before = M.status;
  const P = SH.parse('*빗소리가 창을 두드린다.*\n\n**정미소💬** *국자를 든다* "밥 먹어요!"', roster);
  assert.strictEqual(P.status, null);
  assert.deepStrictEqual(P.beats.map(b => b.kind), ['narr', 'say']);
  assert.strictEqual(P.beats[0].text, '빗소리가 창을 두드린다.');
  assert.strictEqual(P.beats[1].who, '정미소'); assert.strictEqual(P.beats[1].act, '국자를 든다');
  SH.absorb(M, P, data);
  assert.strictEqual(M.status, before);
});

t('원문 마크다운 상태창(코드 표시 없음)·괄호 답·{{img}} 글자', () => {
  const P = SH.parse('{{img::빌라::기본}}\n*쾅. 쾅. 쾅.*\n(그건 할 수 없어요)\n```\n📍2층 빈 호실 · D1 아침\n🍚식량 7 | 🩹의료품 2 | 🧱자재 5 | 🛡️방어력 30\n👥주민 0/3 | 😊사기 60\n```', roster);
  assert.strictEqual(P.status.place, '2층 빈 호실');
  assert.deepStrictEqual(P.beats.map(b => [b.kind, b.text]), [['narr', '쾅. 쾅. 쾅.'], ['sys', '그건 할 수 없어요']]);
});

t('사진 배우기: 인물형 그림 + 다음 대사 화자 / alt 이름', () => {
  const P = SH.parse([{ t: 'img', src: 'https://x/a.webp', w: 1536, h: 912 }, { t: 'text', s: '조현우💬 "왔어요."' }, { t: 'img', src: 'https://x/b.webp', w: 1536, h: 912, alt: '정미소_기본' }, { t: 'text', s: '부엌이 조용하다.' }], roster);
  assert.deepStrictEqual(P.faces, { 조현우: 'https://x/a.webp', 정미소: 'https://x/b.webp' });
});

t('능력치 배우기 · 시설 완공 · 갓모드', () => {
  const P = SH.parse('면접이 끝났다. 표재훈은 탐10/전8/스12 정도로 보였다.\n연구실 공사가 끝나 문을 열었다.\n```\n👁️\n📍옥상 · D5 🌙밤\n🍚식량 3 | 🩹의료품 1 | 🧱자재 2 | 🛡️방어력 25\n```', roster);
  assert.deepStrictEqual(P.stats['표재훈'], { E: 10, C: 8, S: 12 });
  assert.deepStrictEqual(P.built, ['연구실']);
  assert.ok(P.status.god); assert.strictEqual(P.status.time, '밤');
  assert.ok(P.mood.night);
});

t('조사 받침', () => {
  assert.strictEqual(SH.josa('김소담', '을', '를'), '김소담을');
  assert.strictEqual(SH.josa('이나래', '을', '를'), '이나래를');
  assert.strictEqual(SH.josa('류성철', '은', '는'), '류성철은');
  assert.strictEqual(SH.joinNames(['김소담', '이나래', '조현우']), '김소담, 이나래, 조현우');
});

t('장면 음악: 타이틀·시간대·그림·장소·바깥·사망·입주·점호', () => {
  const man = require(path.join(__dirname, '..', 'packs', 'hirion.safehouse', 'manifest.json'));
  const regions = data.regions.map(r => r.n);
  const P = (o) => SH.pickBgm(man, Object.assign({ regions }, o));
  assert.strictEqual(P({ screen: 'title' }), 'title');
  assert.strictEqual(P({ status: { time: '아침', place: '2층 빈 호실', day: 1 } }), 'morning');
  assert.strictEqual(P({ status: { time: '낮', place: '1층 철문', day: 3 } }), 'day');
  assert.strictEqual(P({ status: { time: '밤', place: '4층 집주인방', day: 3 } }), 'night');
  assert.strictEqual(P({ status: { time: '낮', place: '식당', day: 3 } }), 'evening');
  assert.strictEqual(P({ status: { time: '낮', place: '청운24시 편의점', day: 3 } }), 'night', '바깥 파견 동행');
  assert.strictEqual(P({ status: { time: '낮', place: '식당', day: 11 }, imgs: [{ src: 'https://x/a.webp', alt: '빌라웨이브' }] }), 'night', '웨이브 그림');
  assert.strictEqual(P({ status: { time: '아침', place: '식당', day: 12 }, imgs: [{ src: 'https://x/%EB%B9%8C%EB%9D%BC%ED%95%A8%EB%9D%BD.webp' }] }), 'title', '함락 (그림 주소 이름)');
  assert.strictEqual(P({ status: { time: '낮', place: '로비', day: 5 }, delta: [{ kind: 'ev', name: '김소담', ev: '사망' }] }), 'title', '사망');
  assert.strictEqual(P({ status: { time: '낮', place: '로비', day: 5 }, joined: ['김소담'] }), 'evening', '입주');
  assert.strictEqual(P({ screen: 'rollcall', status: { time: '아침', day: 6 } }), 'morning');
  assert.strictEqual(P({ status: { time: '저녁', place: '옥상', day: 100 } }), 'title', 'D100 엔딩');
  assert.strictEqual(P({ status: { time: '밤', place: '옥상', day: 8 }, imgs: [{ src: 'x', alt: '옥상밤' }] }), 'night');
  assert.strictEqual(P({}), 'day');
});

console.log(`안전지대 해석 ${ok}/${ok} 통과`);
