// 「마법소녀의 최종보스」 응답 해석 시험: node test/maou.test.js
'use strict';
const assert = require('assert');
const U = require('../src/renderer/pk-maou');
const data = require('../packs/hirion.magical-boss/data.json');
const roster = new U.Roster(data), idx = new U.ImgIndex(data);
const IMG = (name, w, h) => ({ t: 'img', src: data.imgs[name], w: w || 960, h: h || 1280, alt: '' });
const t = [];
const test = (n, f) => t.push([n, f]);

// 프롤로그 (시작 설정 원문 + 크랙 화면에서 읽은 모양: * · ** 가 사라짐)
const PROLOGUE = [IMG('인물 외_타이틀', 1280, 720), { t: 'text', s: 'EP.PROLOG | 반지하의 마왕\n-\n' },
  ...[1, 2, 3, 4, 5, 6].map(n => IMG('인물 외_프롤로그 웹툰 ' + n, 1080, 1600)), IMG('허름한 반지하_장소', 1280, 720),
  { t: 'text', s: '곰팡이 냄새가 코끝을 찔렀다. 낮은 천장에서는 빗물이 새어 들어와 양은 대야에 톡, 톡 떨어지고 있었다.\n\n몸을 일으키려 하자 삐걱, 낡은 침상이 앓는 소리를 냈다.\n' },
  IMG('당황_세이렌'), { t: 'text', s: '설거지를 하던 중 {user}이/가 내는 기척에 뒤를 돌아보고는 화들짝 놀라 달려온다\n\n세이렌💬 폐...폐하!!! 일어나셨습니까!! 몸은 좀 괜찮으십니까?\n' }];
// 전개 예시 1 (원문 그대로 + 상태창 코드 상자)
const EX1 = [IMG('방송국로비_장소', 1280, 720), { t: 'text', s: '*상황묘사*\n' }, { t: 'text', s: '**방송국 면접관💬** *책상을 두들기며* 반갑습니다 그.. 흐음, 이름이 특이하군요 {user}? 그래서 저희 방송국에 지원 하신 이유가 뭡니까?\n' },
  { t: 'text', code: true, s: '🕖 D+1 | 🏚️ 방송국 예능국\n👤 {user} 상태 | 하급마족 (쇠약)\n💫 권능 0/5 | 🔮 마력 15/50\n💰 자금 0원\n\n❣️ 호감도 (잠김)\n💀 균열도 (잠김)\n⚠️ 정체발각위험 0 (안전)\n🏛️ 협회 동향 (잠김)\n\n🤝 관계 | 세이렌: 충성\n' }];
// 잠김이 풀린 뒤 (형식은 원문에 없음 → 여러 꼴을 읽는지)
const LATER = [IMG('스튜디오_장소', 1280, 720), { t: 'text', s: '조명이 꺼진 스튜디오에 정적이 내려앉았다.\n' }, IMG('부끄러움/사랑_서하린'),
  { t: 'text', s: '서하린💬 오늘도... 고마워요. 정말로.\n' }, IMG('권능회수_사랑_변신_서하린'), { t: 'text', s: '빛이 흩어지며 따뜻한 무언가가 가슴으로 스며든다.\n' },
  { t: 'text', code: true, s: '🕖 D+14 | 🏚️ 방송국 스튜디오\n👤 마왕 상태 | 하급마족 (회복 중)\n💫 권능 1/5 | 🔮 마력 23/50\n💰 자금 1,250,000원\n\n❣️ 호감도 | 서하린 82 · 한세라 31 · 윤채아 44 · 백설아 30 · 오하나 52\n💀 균열도 | 서하린 5 / 한세라 12\n⚠️ 정체발각위험 37 (주의)\n🏛️ 협회 동향 | 정기 마력 검진 일정 공지\n\n🤝 관계 | 세이렌: 충성, 서하린: 사랑\n' },
  { t: 'text', s: '[단서1] D+3 - 야생 마족은 모두 굶주려 있었다\n[단서2] D+9 - 협회 폐기물 차량이 지하로 들어간다\n' }];

test('프롤로그: 타이틀·웹툰 6장·반지하 배경·세이렌 대사', () => {
  const P = U.parse(PROLOGUE, roster, idx);
  assert.ok(P.prologue && P.title && P.webtoon.length === 6);
  assert.strictEqual(P.webtoon[0].n, 1);
  const say = P.beats.find(b => b.kind === 'say');
  assert.strictEqual(say.who, '세이렌'); assert.ok(say.known);
  assert.strictEqual(say.pinfo.situ, '당황');
  assert.ok(P.beats.some(b => b.place === '허름한 반지하'));
  assert.ok(P.beats.some(b => b.kind === 'title' && b.text === '반지하의 마왕'));
});
test('상태창(잠김): D+1 · 장소 · 권능 · 마력 · 자금 · 발각 위험 · 관계', () => {
  const P = U.parse(EX1, roster, idx);
  const s = P.status;
  assert.strictEqual(s.day, 1); assert.strictEqual(s.place, '방송국 예능국');
  assert.strictEqual(s.race, '하급마족'); assert.strictEqual(s.cond, '쇠약');
  assert.deepStrictEqual(s.power, { n: 0, of: 5 }); assert.deepStrictEqual(s.mana, { n: 15, of: 50 });
  assert.strictEqual(s.money, 0); assert.strictEqual(s.risk, 0); assert.strictEqual(s.riskLabel, '안전');
  assert.strictEqual(s.aff, null); assert.strictEqual(s.crack, null); assert.strictEqual(s.assoc, null);
  assert.strictEqual(s.rel['세이렌'], '충성');
  assert.ok(!P.beats.some(b => /🕖|권능/.test(b.text)), '상태창은 장면에서 빠짐');
  const say = P.beats.find(b => b.kind === 'say');
  assert.strictEqual(say.who, '방송국 면접관'); assert.strictEqual(say.act, '책상을 두들기며');
  assert.ok(/반갑습니다/.test(say.text) && !/책상/.test(say.text));
});
test('잠김 해제 뒤: 호감도·균열도 이름별 · 자금 · 권능 회수 그림 · 단서', () => {
  const P = U.parse(LATER, roster, idx);
  const s = P.status;
  assert.deepStrictEqual(s.aff, { 서하린: 82, 한세라: 31, 윤채아: 44, 백설아: 30, 오하나: 52 });
  assert.deepStrictEqual(s.crack, { 서하린: 5, 한세라: 12 });
  assert.strictEqual(s.money, 1250000); assert.strictEqual(s.risk, 37); assert.strictEqual(s.riskLabel, '주의');
  assert.strictEqual(s.assoc, '정기 마력 검진 일정 공지');
  assert.strictEqual(s.rel['서하린'], '사랑');
  assert.deepStrictEqual(P.recovered, [{ who: '서하린', method: '사랑' }]);
  assert.strictEqual(P.clues.length, 2); assert.strictEqual(P.clues[1].when, 'D+9');
  const say = P.beats.find(b => b.kind === 'say'); assert.strictEqual(say.pinfo.situ, '부끄러움·사랑');
});
test('기억에 합치기: 변화 알림 · 회수 방식 · 단서 쌓기 · 잠김 동안 값 유지', () => {
  const M = U.blank();
  U.absorb(M, U.parse(EX1, roster, idx), data);
  const P2 = U.parse(LATER, roster, idx);
  const ev = U.absorb(M, P2, data);
  assert.strictEqual(M.powers['서하린'], '사랑');
  assert.strictEqual(ev.recovered.length, 1);
  assert.deepStrictEqual(ev.power, { from: 0, to: 1 });
  assert.strictEqual(ev.newClues, 2);
  assert.ok(ev.risk && ev.risk.label === '주의');
  const ev3 = U.absorb(M, U.parse(EX1, roster, idx), data);   // 다시 잠김으로 와도 지난 값은 둔다
  assert.strictEqual(M.aff['서하린'], 82);
  assert.strictEqual(U.stageOf(82), '깊은 유대'); assert.strictEqual(U.stageOf(30), '무관심·거리두기');
  assert.strictEqual(ev3.recovered.length, 0);
});
test('그림 이름 풀기: 변신·장소·엔딩', () => {
  assert.deepStrictEqual(U.ImgIndex.info('기본상태_변신_백설아'), { name: '기본상태_변신_백설아', kind: 'person', who: '백설아', situ: '기본상태', form: '변신', method: '' });
  assert.strictEqual(U.ImgIndex.info('협회지하_장소').place, '협회지하');
  assert.strictEqual(U.ImgIndex.info('엔딩_그림자 왕국의 진실').ending, '그림자 왕국의 진실');
  assert.strictEqual(idx.lookup('https://x/_next/image?url=' + encodeURIComponent(data.imgs['기쁨_리제']) + '&w=640').who, '리제');
});
test('오답노트·스마트폰 화면은 장면에서 뺀다', () => {
  const P = U.parse([{ t: 'text', s: '세라💬 뭐야.\n' }, { t: 'text', code: true, s: '[오답노트]\n-점검: 사칭 없음\n-수정: 없음\n-계획: 진행\n' },
    { t: 'text', s: '14:20                 📶 🔋82%\n🗺️          📞           🌐         ✉️\n정보        연락        가이드     진행요약\n----------------------------------\n이용하실 기능을 / 후 입력해주세요\n' }], roster, idx);
  assert.strictEqual(P.beats.length, 1); assert.strictEqual(P.beats[0].who, '한세라');
  assert.ok(P.phone && !P.phone.none);
});

(async () => {
  let ok = 0;
  for (const [n, f] of t) { try { await f(); ok++; console.log('  ✔ ' + n); } catch (e) { console.log('  ✘ ' + n + '\n    ' + (e && e.stack || e).split('\n').slice(0, 3).join('\n    ')); } }
  console.log(`\n마법소녀 해석 ${ok}/${t.length} 통과`);
  if (ok !== t.length) process.exit(1);
})();
