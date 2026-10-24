// 게임 화면 규격 v2 점검: node test/play.test.js
// 소환수 아카데미 세션이 만든 샘플 3턴(04_확인표)으로 읽기 규칙을 확인한다.
const assert = require('assert');
const P = require('../src/renderer/parser.js');
const G = require('../src/renderer/play.js');
const M = require('../packs/hirion.summoner-academy/manifest.json');

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

const S1 = `📅 1학년 봄 1일차 오후 | 📍기숙사
🎓 {user} | 🏠해의 동 | 💰3은 0동 | 🎒상처약×2, 계약석×1
🐾 위카(위카·기본) Lv 5 | ❤️165/165 | ✨XP 0/20
 공55 방80 특공95 특방110 속80 | 없음
 기술: 촛불 점화(💫40|15 화상10%) 촛농 붕대(✨|5 HP 25% 회복)
📦 계약 1/6 | 📖 도감 1/80 | 🏅 배지 0/7
📜 의뢰: 없음 | 🗓️ 다음 일정: 저녁 신입생 환영회`;

const S2 = `📅 1학년 여름 13일차 오후 | 📍야생지대
🎓 {user} | 🏠해의 동 | 💰4은 20동 | 🎒상처약×1, 계약석×1
🐾 위카(위카·기본) Lv 14 | ❤️58/210 | ✨XP 12/56
 공73 방98 특공113 특방128 속98 | 없음
 기술: 촛불 점화(💫40|14/15 화상10%) 촛농 붕대(✨|5/5 HP 25% 회복)
📦 계약 2/6 | 📖 도감 3/80 | 🏅 배지 0/7
📜 의뢰: 야외합숙 포획 실습 | 🗓️ 다음 일정: 가을 에테르나 컵 D-38`;

const S3 = `📅 1학년 봄 9일차 오후 | 📍학생식당
🎓 {user} | 🏠해의 동 | 💰3은 0동 | 🎒상처약×2, 계약석×1
🐾 위카(위카·기본) Lv 7 | ❤️175/175 | ✨XP 8/28
 공59 방84 특공99 특방114 속84 | 없음
 기술: 촛불 점화(💫40|15/15 화상10%) 촛농 붕대(✨|5/5 HP 25% 회복)
📦 계약 1/6 | 📖 도감 1/80 | 🏅 배지 0/7
📜 의뢰: 없음 | 🗓️ 다음 일정: 신입생 친선전 D-16`;

const R1 = `*제단의 빛이 가라앉자 위카가 내 소매 끝을 꼭 쥐고 있었다.*

마가렛 교수가 명부를 넘기며 안경알 너머로 우리를 훑었다.
【마가렛|기본】"위카, 화 속성. 해의 동으로 배정합니다. 기숙사 규칙은 벽에 붙어 있으니 읽어 두십시오."

"저, 저기… 해의 동이면 따뜻한 곳이에요?" 위카가 올려다본다. {{img::위카::기본평상시}}

뒤에서 누군가 하품을 삼켰다.
【레이먼드|기본】"…괜찮아, 따뜻해. 난로가 너무 세서 문제지."

💡 기숙사로 짐 풀러 간다 / 위카에게 학교를 구경시켜 준다 / 카일에게 인사한다
━━━━━━━━━━━━━━
${S1}
━━━━━━━━━━━━━━
【CRION】
bgm=partner
fx=sparks
【/CRION】`;

const R2 = `*풍차 날개가 비명처럼 돌아간다. 폭주한 월리의 날개바퀴가 만든 돌풍이 풀밭을 갈아엎고 있었다.*

⚔️ 위카 Lv 14 ❤️58/210 [없음] vs 야생 월리 Lv 15 ❤️71/215 [없음]
▶ 촛불 점화 → 💥 -38 (효과가 굉장했다!) / 월리 회전 바람 → 💥 -46
촛불 점화 14/15, 촛농 붕대 5/5

위카가 비틀거리며 일어났다. 머리 위 불꽃이 바람에 꺼질 듯 가늘어진다.
"괘, 괜찮아요… 아직, 할 수 있어요…!"

💡 촛농 붕대로 회복한다 / 방어를 지시한다 / 촛불 점화로 밀어붙인다
━━━━━━━━━━━━━━
${S2}
━━━━━━━━━━━━━━
【CRION】
fx=heartbeat,vignette_red
【/CRION】`;

t('상태창 감지', () => {
  assert.ok(P.isStatus(M, S1));
  assert.ok(P.isStatus(M, S2));
  assert.ok(!P.isStatus(M, '식당 창문에 김이 서렸다. 📅 달력이 보인다.'));
});

t('샘플1 읽기: 날짜·장소·돈·주머니', () => {
  const r = P.parseStatus(M, S1);
  assert.strictEqual(r.day, 1);
  assert.strictEqual(r.phase, '오후');
  assert.strictEqual(r.loc, '기숙사');
  assert.strictEqual(r.fields.grade, 1);
  assert.strictEqual(r.fields.season, '봄');
  assert.strictEqual(r.fields.dorm, '해의 동');
  assert.strictEqual(r.fields.silver, 3);
  assert.strictEqual(r.fields.copper, 0);
  assert.strictEqual(r.fields.gold, undefined);
  assert.deepStrictEqual(r.fields.items.map(i => [i.name, i.n]), [['상처약', 2], ['계약석', 1]]);
  assert.deepStrictEqual(r.fields.contract, { value: 1, max: 6 });
  assert.deepStrictEqual(r.fields.dex, { value: 1, max: 80 });
  assert.deepStrictEqual(r.fields.badges, { value: 0, max: 7 });
  assert.strictEqual(r.fields.quest, '없음');
  assert.strictEqual(r.fields.schedule, '저녁 신입생 환영회');
});

t('샘플1 읽기: 파트너 카드', () => {
  const p = P.parseStatus(M, S1).fields.partner;
  assert.strictEqual(p.length, 1);
  const a = p[0];
  assert.strictEqual(a.name, '위카');
  assert.strictEqual(a.species, '위카');
  assert.strictEqual(a.stage, '기본');
  assert.strictEqual(a.lv, 5);
  assert.deepStrictEqual(a.hp, { value: 165, max: 165 });
  assert.deepStrictEqual(a.xp, { value: 0, max: 20 });
  assert.deepStrictEqual([a.atk, a.def, a.spa, a.spd, a.spe], [55, 80, 95, 110, 80]);
  assert.strictEqual(a.ailment, '없음');
  assert.strictEqual(a.skills.length, 2);
  assert.deepStrictEqual([a.skills[0].name, a.skills[0].icon, a.skills[0].pow, a.skills[0].left, a.skills[0].max], ['촛불 점화', '💫', 40, 15, undefined]);
  assert.strictEqual(a.skills[0].fx, '화상10%');
  assert.deepStrictEqual([a.skills[1].name, a.skills[1].icon, a.skills[1].pow, a.skills[1].left], ['촛농 붕대', '✨', undefined, 5]);
  assert.strictEqual(a.skills[1].fx, 'HP 25% 회복');
});

t('샘플2 읽기: 전투 중 남은 횟수/최대, 일정 D-n', () => {
  const r = P.parseStatus(M, S2);
  assert.strictEqual(r.loc, '야생지대');
  assert.strictEqual(r.fields.season, '여름');
  assert.strictEqual(r.fields.silver, 4);
  assert.strictEqual(r.fields.copper, 20);
  assert.strictEqual(r.fields.scheduleD, 38);
  const s = r.fields.partner[0].skills[0];
  assert.deepStrictEqual([s.left, s.max], [14, 15]);
});

t('소환수 3마리 읽기', () => {
  const three = S1.replace('📦', `🐾 미르(미르·기본) Lv 3 | ❤️90/100 | ✨XP 1/10
 공40 방40 특공40 특방40 속40 | 독
 기술: 박치기(⚔️30|10 없음)
🐾 노아(노아·기본) Lv 2 | ❤️50/60 | ✨XP 0/8
 공30 방30 특공30 특방30 속30 | 없음
 기술: 할퀴기(⚔️20|12 없음)
📦`);
  const p = P.parseStatus(M, three).fields.partner;
  assert.deepStrictEqual(p.map(x => x.name), ['위카', '미르', '노아']);
  assert.strictEqual(p[1].ailment, '독');
});

t('제어 블록 읽기', () => {
  const c = G.parseCtrl(R1);
  assert.ok(c.found);
  assert.strictEqual(c.bgm, 'partner');
  assert.deepStrictEqual(c.fx, ['sparks']);
  const c2 = G.parseCtrl('본문\n【CRION】\n- bgm=daily\n**fx=shake, flash**\ncg=summon\nchoices=가|나|다\nsprites=L:sera.smile,R:mina.worry\nhud.food=82\nfoo=1\n【/CRION】');
  assert.strictEqual(c2.bgm, 'daily');
  assert.deepStrictEqual(c2.fx, ['shake', 'flash']);
  assert.strictEqual(c2.cg, 'summon');
  assert.deepStrictEqual(c2.choices, ['가', '나', '다']);
  assert.deepStrictEqual(c2.sprites, [{ pos: 'L', who: 'sera', face: 'smile' }, { pos: 'R', who: 'mina', face: 'worry' }]);
  assert.strictEqual(c2.hud.food, '82');
  assert.ok(!G.parseCtrl('블록 없음').found);
});

t('응답 나누기: 상태창·표식은 본문에서 빠진다', () => {
  const { narr, ctrl } = G.splitReply(M, R1, S1);
  assert.ok(!/📅|CRION|━/.test(narr));
  assert.ok(/💡/.test(narr));
  assert.strictEqual(ctrl.bgm, 'partner');
});

t('샘플1 장면 조각', () => {
  const { narr } = G.splitReply(M, R1, S1);
  const b = G.buildBeats(M, narr);
  const says = b.beats.filter(x => x.t === 'say');
  assert.deepStrictEqual(says.map(x => [x.who, x.face]), [['마가렛', '기본'], ['레이먼드', '기본']]);
  assert.ok(says[0].text.startsWith('위카, 화 속성'));
  assert.ok(!says[0].text.startsWith('"'));
  assert.deepStrictEqual(b.hint, ['기숙사로 짐 풀러 간다', '위카에게 학교를 구경시켜 준다', '카일에게 인사한다']);
  assert.deepStrictEqual(b.imgs, [{ kind: '위카', name: '기본평상시' }]);
  assert.ok(b.beats.some(x => x.t === 'nar' && /소매/.test(x.text)));
  assert.ok(!b.beats.some(x => /\{\{img/.test(x.text || '')));
});

t('샘플2 전투창은 본문이 아니라 전투 패널로', () => {
  const { narr } = G.splitReply(M, R2, S2);
  const b = G.buildBeats(M, narr);
  assert.ok(b.battle);
  assert.deepStrictEqual([b.battle.a.name, b.battle.a.lv, b.battle.a.hp, b.battle.a.max], ['위카', 14, 58, 210]);
  assert.deepStrictEqual([b.battle.b.name, b.battle.b.hp, b.battle.b.max], ['야생 월리', 71, 215]);
  assert.ok(b.battle.log.some(l => /촛불 점화 → /.test(l)));
  assert.ok(!b.beats.some(x => /⚔|▶|14\/15/.test(x.text || '')));
  assert.ok(b.beats.some(x => /비틀거리며/.test(x.text || '')));
});

t('배경 고르기: 장소 · 시간대 · 위기 변형', () => {
  const st = (loc, phase) => ({ loc, phase });
  assert.strictEqual(G.resolveBg(M, st('기숙사', '오후'), []), '기숙사');
  assert.strictEqual(G.resolveBg(M, st('기숙사', '오전'), []), '기숙사_아침');
  assert.strictEqual(G.resolveBg(M, st('기숙사', '밤'), []), '기숙사_밤');
  assert.strictEqual(G.resolveBg(M, st('학생식당', '저녁'), []), '학생식당_저녁');
  assert.strictEqual(G.resolveBg(M, st('소환의 제단', '오전'), []), '소환의제단');
  assert.strictEqual(G.resolveBg(M, st('야생지대', '오후'), ['heartbeat', 'vignette_red']), '야생지대_위기');
  assert.strictEqual(G.resolveBg(M, st('야생지대 · 풍차 고원', '오후'), []), '야생지대');
  assert.strictEqual(G.resolveBg(M, st('어딘가', '오후'), []), null);
  assert.strictEqual(G.resolveBg(M, st('기숙사', '오후'), [], '별의우물'), '별의우물');
});

t('효과: 블록 우선, 없으면 HP 30% 이하에서 자동 위기', () => {
  const low = P.parseStatus(M, S2), ok = P.parseStatus(M, S3);
  assert.deepStrictEqual(G.deriveFx(M, low, { fx: ['flash'] }), ['flash']);
  assert.deepStrictEqual(G.deriveFx(M, low, { fx: [] }), ['vignette_red', 'heartbeat']);
  assert.deepStrictEqual(G.deriveFx(M, ok, { fx: [] }), []);
});

t('음악: 블록 → 유지 → 장소 기본 → 같은 필드 곡 번갈아', () => {
  assert.strictEqual(G.resolveBgm(M, { bgm: 'daily' }, { loc: '기숙사' }, null), 'daily');
  assert.strictEqual(G.resolveBgm(M, { bgm: null }, { loc: '기숙사' }, 'rival'), 'rival');
  assert.strictEqual(G.resolveBgm(M, { bgm: null }, { loc: '야생지대' }, null), 'field');
  assert.strictEqual(G.resolveBgm(M, { bgm: 'field' }, { loc: '야생지대' }, 'field'), 'field2');
  assert.strictEqual(G.resolveBgm(M, { bgm: 'nope' }, { loc: '' }, null), 'academy');
});

t('입화 고르기: 표정이 없으면 기본으로', () => {
  assert.strictEqual(G.pickFace(M, '마가렛', '엄격').face, '엄격');
  assert.strictEqual(G.pickFace(M, '마가렛', '없는표정').face, '기본');
  assert.strictEqual(G.pickFace(M, '모르는사람', '기본'), null);
  assert.deepStrictEqual(G.layout(['a', 'b']).map(x => x.pos), ['L', 'R']);
});

t('긴 글은 문장 끝에서 나눈다', () => {
  const long = '가나다라마바사. '.repeat(40);
  const parts = G.chunk(long, 150);
  assert.ok(parts.length > 1 && parts.every(x => x.length <= 200));
});

t('도감·배지 알림과 코드 줄', () => {
  const b = G.buildBeats(M, '글.\n📖 도감 등록!\n🔑 AC-1234-ABCD\n다음 글.');
  assert.strictEqual(b.notices.length, 1);
  assert.strictEqual(b.notices[0].code, 'AC-1234-ABCD');
  assert.ok(b.beats.every(x => !/🔑/.test(x.text || '')));
});

console.log(`\n${n}개 모두 통과`);
