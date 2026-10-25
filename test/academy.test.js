// 플레이팩 「소환수 아카데미」 응답 해석 시험: node test/academy.test.js
//  샘플 3턴 = 프로젝트 「게임제작」 크리온/소환수아카데미/04_확인표.md (평상·위기·선택지)
'use strict';
const assert = require('assert');
const A = require('../src/renderer/pk-academy');
const data = require('../packs/hirion.summoner-academy/data.json');
const { turns } = require('./fixtures/academy_turns.json');
const dex = new A.Dex(data);

const t = [];
const test = (n, f) => t.push([n, f]);

test('자료: 계열 26 + 전설 2, 도감 번호 1~80', () => {
  assert.strictEqual(data.lineages.length, 26);
  assert.strictEqual(dex.no('위카', 1), 1);
  assert.strictEqual(dex.no('위카', 3), 3);
  assert.strictEqual(dex.no('패치', 3), 78);
  assert.strictEqual(dex.no('솔라리아', 3), 79);
  assert.strictEqual(dex.find('템퍼').lin.base, '플린트');
  assert.strictEqual(dex.find('야생 월리').lin.el, '풍');
});

test('상성: 화→풍 ×1.5, 풍→화 ×0.5, 빛↔어둠 ×1.5, 무 ×1', () => {
  assert.strictEqual(dex.mult('화', '풍'), 1.5);
  assert.strictEqual(dex.mult('풍', '화'), 0.5);
  assert.strictEqual(dex.mult('빛', '어둠'), 1.5);
  assert.strictEqual(dex.mult('어둠', '빛'), 1.5);
  assert.strictEqual(dex.mult('무', '화'), 1);
});

test('샘플 1 (평상): 상태창·인물 표식·힌트·블록', () => {
  const r = A.parse(turns[0], dex);
  const s = r.status;
  assert.deepStrictEqual([s.year, s.season, s.day, s.time, s.place], [1, '봄', 1, '오후', '기숙사']);
  assert.strictEqual(s.dorm, '해의 동');
  assert.deepStrictEqual(s.money, { gold: 0, silver: 3, copper: 0, text: '3은 0동' });
  assert.deepStrictEqual(s.items, [{ name: '상처약', n: 2 }, { name: '계약석', n: 1 }]);
  const p = s.partners[0];
  assert.deepStrictEqual([p.nick, p.base, p.stage, p.lv, p.hp, p.hpMax, p.xp, p.xpMax, p.el, p.rarity], ['위카', '위카', 1, 5, 165, 165, 0, 20, '화', '일반']);
  assert.deepStrictEqual(p.stats, { atk: 55, def: 80, spa: 95, spd: 110, spe: 80 });
  assert.deepStrictEqual(p.skills.map(k => [k.name, k.kind, k.power, k.left, k.max]), [['촛불 점화', '특수', '40', 15, 15], ['촛농 붕대', '보조', '', 5, 5]]);
  assert.deepStrictEqual([s.contract.n, s.contract.max, s.dex.n, s.badges.n], [1, 6, 1, 0]);
  assert.deepStrictEqual(s.quests, []);
  assert.strictEqual(s.next.text, '저녁 신입생 환영회');
  assert.deepStrictEqual(r.hints, ['기숙사로 짐 풀러 간다', '위카에게 학교를 구경시켜 준다', '카일에게 인사한다']);
  assert.deepStrictEqual(r.block, { bg: '', bgm: 'partner', cg: '', fx: ['sparks'], sprites: '', choices: [] });
  const says = r.beats.filter(b => b.kind === 'say');
  assert.deepStrictEqual(says.map(b => [b.who, b.face || '']), [['마가렛', '기본'], ['위카', ''], ['레이먼드', '기본']]);
  assert.ok(says[0].text.startsWith('위카, 화 속성.'));
  assert.ok(!r.beats.some(b => /━|📅|💡|CRION/.test(b.text)), '상태창·힌트·블록은 장면에 안 섞인다');
  assert.deepStrictEqual(r.tokens, ['위카::기본평상시']);
});

test('샘플 2 (위기): 전투창·HP 30% 이하·포획 조건', () => {
  const r = A.parse(turns[1], dex);
  const b = r.battle;
  assert.ok(b, '전투창을 읽는다');
  assert.deepStrictEqual([b.ally.name, b.ally.lv, b.ally.hp, b.ally.hpMax, b.ally.base], ['위카', 14, 58, 210, '위카']);
  assert.deepStrictEqual([b.enemy.name, b.enemy.lv, b.enemy.hp, b.enemy.hpMax, b.enemy.base, b.enemy.el, b.enemy.wild], ['야생 월리', 15, 71, 215, '월리', '풍', true]);
  assert.deepStrictEqual(b.log, [{ act: '촛불 점화', dmg: 38, note: '효과가 굉장했다!' }, { act: '월리 회전 바람', dmg: 46, note: '' }]);
  assert.deepStrictEqual(b.pp, [{ name: '촛불 점화', left: 14, max: 15 }, { name: '촛농 붕대', left: 5, max: 5 }]);
  assert.strictEqual(b.mult, 1.5);
  assert.strictEqual(b.capture, null, '상대 HP 33% → 아직 포획 불가');
  const p = r.status.partners[0];
  assert.ok(p.hp / p.hpMax <= 0.3, '위기 조건');
  assert.deepStrictEqual(p.skills.map(k => [k.name, k.left, k.max]), [['촛불 점화', 14, 15], ['촛농 붕대', 5, 5]]);
  assert.strictEqual(r.status.next.d, 38);
  assert.deepStrictEqual(r.block.fx, ['heartbeat', 'vignette_red']);
  assert.ok(!r.beats.some(b => /⚔️|▶|💥/.test(b.text)), '전투창 줄은 대사창에 안 흐른다');
  assert.ok(r.beats.some(b => b.kind === 'say' && /할 수 있어요/.test(b.text)));
});

test('샘플 3 (선택지): 힌트 4개·인물 2명·bgm', () => {
  const r = A.parse(turns[2], dex);
  assert.deepStrictEqual(r.hints, ['브루노 옆에 앉는다', '카일에게 말을 건다', '위카에게 빵을 사 준다', '도서관으로 간다']);
  assert.deepStrictEqual(r.beats.filter(b => b.kind === 'say').map(b => [b.who, b.face]), [['브루노', '웃음'], ['세라', '기본']]);
  assert.strictEqual(r.block.bgm, 'daily');
  assert.strictEqual(r.status.place, '학생식당');
  assert.strictEqual(r.status.partners[0].hpMax, 175);
});

test('표식을 지워도 읽힌다 (폴백)', () => {
  for (const tx of turns) {
    const plain = A.stripMarks(tx);
    assert.ok(!/【|】/.test(plain), '표식이 남지 않는다');
    const r = A.parse(plain, dex);
    assert.ok(r.status && r.status.partners.length === 1, '상태창은 그대로 읽힌다');
    assert.ok(r.beats.length >= 4, '장면이 남는다');
    assert.ok(r.hints.length >= 3, '힌트가 남는다');
  }
  // 표식 없이 쓴 대사: 앞 서술의 화자를 이름으로 못 잡아도 대사로 보인다
  const r = A.parse(A.stripMarks(turns[0]), dex);
  assert.ok(r.beats.filter(b => b.kind === 'say').length >= 3);
});

test('프롤로그 형식: **마가렛 교수** "…" 와 이름 "대사"', () => {
  const r = A.parse('*줄이 한 명씩 줄어든다.*\n\n**마가렛 교수** "다음, {user}. 소환진 중앙에 손을 올리고."\n\n**레이먼드 교수** "…하암. 긴장할 거 없어."\n브루노 "한 판 붙자!"', dex);
  const says = r.beats.filter(b => b.kind === 'say');
  assert.deepStrictEqual(says.map(b => b.who), ['마가렛 교수', '레이먼드 교수', '브루노']);
  assert.strictEqual(dex.person('마가렛 교수').name, '마가렛');
});

test('도감·배지 코드 줄', () => {
  const r = A.parse('*빛이 걷혔다.*\n📖 도감 등록! 🔑AC·위카·1C\n🏅 배지 획득! 🔑BG·마가렛\n🔑AC-템퍼-2S', dex);
  assert.deepStrictEqual(r.codes.map(c => c.code), ['AC·위카·1C', 'AC·플린트·2S', 'BG·마가렛']);
  assert.strictEqual(r.codes[1].no, 5);
  assert.strictEqual(r.notices.length, 3);
  assert.ok(!r.beats.some(b => /🔑/.test(b.text)));
});

test('사건: 새 파트너·진화·레벨업', () => {
  const s1 = A.parseStatusLines(['🐾 위카(위카·기본) Lv 15 | ❤️210/210 | ✨XP 50/60'], dex);
  const s2 = A.parseStatusLines(['🐾 탤로윈(위카·1진화) Lv 16 | ❤️260/260 | ✨XP 0/64', '🐾 오토(오토·기본) Lv 9 | ❤️165/165 | ✨XP 0/36'], dex);
  const ev = A.events(s1, s2, [], dex);
  assert.deepStrictEqual(ev.map(e => e.type), ['evolve', 'new']);
  assert.strictEqual(ev[0].partner.formName, '탤로윈');
});

test('포획 추정: 일반 60%, HP 10% 이하 +20, 상한 95', () => {
  assert.strictEqual(dex.capture('일반', 0.25), 60);
  assert.strictEqual(dex.capture('일반', 0.05), 80);
  assert.strictEqual(dex.capture('희귀', 0.05, { ailment: true, hi: true }), 90);
  assert.strictEqual(dex.capture('영웅', 0.5), null);
});

test('3:3 배지전 전투창·[상태] 표기', () => {
  const r = A.parse('⚔️ 템퍼 Lv 24 ❤️120/300 [화상] vs 교수 몬타리온 Lv 30 ❤️400/420 [없음]\n▶ 담금질 → (공격+2) / 몬타리온 산왕의 일격 → 💥 -80\n담금질 4/5, 불씨 망치 13/15', dex);
  assert.strictEqual(r.battle.ally.ailment, '화상');
  assert.strictEqual(r.battle.ally.base, '플린트');
  assert.strictEqual(r.battle.enemy.base, '키도');
  assert.strictEqual(r.battle.enemy.stage, 3);
  assert.deepStrictEqual(r.battle.log[0], { act: '담금질', dmg: null, note: '공격+2' });
  assert.strictEqual(r.battle.mult, 1, '화 → 지 는 보통');
});

let fail = 0;
for (const [n, f] of t) {
  try { f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n    ')); }
}
console.log(`\n소환수 아카데미 해석 ${t.length - fail}/${t.length} 통과`);
if (fail) process.exit(1);
