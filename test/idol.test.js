// 반지하 엔터테인먼트 해석기 시험: node test/idol.test.js
const assert = require('assert');
const U = require('../src/renderer/pk-idol.js');
const data = require('../packs/hirion.basement-ent/data.json');
const roster = new U.Roster(data), idx = new U.ImgIndex(data);
let n = 0;
const t = (name, f) => { f(); n++; console.log('ok', name); };

const ST = `━━━━━━━━━━━━━━
📅 1년차 3월 · 행동 2/4 | 🔥 유행: 발라드 · 이별
💰 자금 120만 | 🧾 부채 3,000만 (상환 D-1달)
🏠 반지하 | 🏢 무명 | ⚠️ 루머 0/3
💗 코어 12 · 라이트 340 | ▶️ 구독 85 | 📈 최고 -
👥 윤서하 [리더·보컬 B] 보통 / 한소율 [작곡 C] 좋음
🎵 진행 곡: 「첫 줄」 제작 1/2달 · 5월 발매
⚔️ 라이벌: 진세린 0승 1패
🤝 약속: 서하에게 다음 센터 / 소율 작곡 크레딧
━━━━━━━━━━━━━━`;

t('상태창', () => {
  const P = U.parse(`{{img::배경::반지하숙소}}\n*곰팡이 냄새가 나는 반지하.*\n{{img::윤서하::통상}}\n윤서하💬 "사장님. 이번 달은 뭐부터 해요?"\n${ST}`, roster, idx);
  const s = P.status;
  assert.strictEqual(s.year, 1); assert.strictEqual(s.month, 3); assert.deepStrictEqual(s.act, { n: 2, of: 4 });
  assert.deepStrictEqual(s.trend, { genre: '발라드', theme: '이별' });
  assert.strictEqual(s.money, 1200000); assert.strictEqual(s.debt, 30000000); assert.strictEqual(s.payIn, 1);
  assert.strictEqual(s.house, '반지하'); assert.strictEqual(s.grade, '무명'); assert.deepStrictEqual(s.rumor, { n: 0, of: 3 });
  assert.strictEqual(s.core, '12'); assert.strictEqual(s.subs, '85'); assert.strictEqual(s.best, undefined);
  assert.strictEqual(s.members.length, 2); assert.strictEqual(s.members[0].who, '윤서하'); assert.strictEqual(s.members[0].rank, 'B'); assert.strictEqual(s.members[1].cond, '좋음');
  assert.strictEqual(s.wip.title, '첫 줄'); assert.deepStrictEqual(s.wip.prog, { n: 1, of: 2 }); assert.strictEqual(s.wip.rel, 5);
  assert.deepStrictEqual(s.rivals['진세린'], { w: 0, l: 1 });
  assert.strictEqual(s.promises.length, 2);
  assert.strictEqual(P.beats[1].kind, 'say'); assert.strictEqual(P.beats[1].pinfo.situ, '통상');
  assert.ok(!P.beats.some(b => /📅|💰/.test(b.text || '')));
});

t('월말 결산 · 알림', () => {
  const P = U.parse(`🎵 발매! 「첫 줄」\n📈 차트 진입! 87위\n🎧 신곡 공개: VELA 「Starlight」\n━━ 📊 5월 결산 ━━\n💵 수입 +80만 (알바 60 · 유튜브 20)\n💸 지출 -150만 (월세 50 · 상환 100)\n🎵 「첫 줄」 B등급 · 화력 42\n📈 레몬차트 「첫 줄」 87위 (NEW) | LUCÉ 「Mirror」 12위 (▼2) · VELA 「Starlight」 3위 (NEW)\n💬 반응: 후렴이 귀에 붙는다 / 가사가 입에 안 붙는다\n💪 컨디션: 윤서하 보통→지침\n🔜 다음 달: 대학축제 섭외 시작\n━━━━━━━━━━`, roster, idx);
  assert.deepStrictEqual(P.alerts.map(a => a.k), ['release', 'chartin', 'rivalnew']);
  const S = P.settle;
  assert.strictEqual(S.month, 5); assert.strictEqual(S.income, 800000); assert.strictEqual(S.expense, -1500000);
  assert.deepStrictEqual(S.incomeItems, ['알바 60', '유튜브 20']);
  assert.deepStrictEqual(S.songs[0], { title: '첫 줄', grade: 'B', heat: 42 });
  assert.strictEqual(S.chart.length, 3); assert.strictEqual(S.chart[0].move, 'new'); assert.strictEqual(S.chart[1].artist, 'LUCÉ'); assert.strictEqual(S.chart[1].move, -2);
  assert.strictEqual(S.reactions.length, 2); assert.ok(/지침/.test(S.cond)); assert.ok(/축제/.test(S.next));
  assert.strictEqual(P.beats.length, 0, '결산·알림은 장면에서 빠짐');
});

t('기획서 왕복 · 기억 합치기 · 가상 차트', () => {
  const plan = { title: '첫 줄', genre: '발라드', theme: '이별', alloc: { 멜로디: 3, 가사: 3, 퍼포: 1, 비주얼: 1, 홍보: 2 }, lyric: '공동(서하)', chorus: ['너의 첫 줄을 아직 외워', '끝줄은 우리가 쓸게'], comp: '외주 C', center: '윤서하', channel: '음원', month: 5 };
  const txt = U.planText(plan);
  const back = U.parsePlan(txt);
  assert.deepStrictEqual(back, plan);
  const M = U.blank();
  U.absorb(M, U.parse(ST, roster, idx), data, { sentPlan: plan });
  assert.ok(M.songs['첫 줄'].ours); assert.strictEqual(M.songs['첫 줄'].wip.rel, 5);
  const ev = U.absorb(M, U.parse(`🎵 발매! 「첫 줄」\n━━ 📊 5월 결산 ━━\n🎵 「첫 줄」 B등급 · 화력 42\n📈 레몬차트 「첫 줄」 87위 (NEW) | LUCÉ 「Mirror」 12위\n━━━━━━━━━━\n📅 1년차 6월 · 행동 0/4 | 🔥 유행: 댄스 · 여름\n💰 자금 50만 | 🧾 부채 2,900만 (상환 D-0달)\n🤝 합류! 한소율`, roster, idx), data);
  const s = M.songs['첫 줄'];
  assert.strictEqual(s.grade, 'B'); assert.strictEqual(s.best, 87); assert.deepStrictEqual(s.chorus, plan.chorus); assert.strictEqual(s.genre, '발라드');
  assert.ok(M.songs['Mirror'].rival); assert.strictEqual(M.songs['Mirror'].artist, 'LUCÉ');
  assert.deepStrictEqual(ev.released, ['첫 줄']); assert.ok(ev.month); assert.ok(ev.settle);
  const key = M.chartOrder[M.chartOrder.length - 1];
  const ch = U.buildChart(M, data, key);
  assert.strictEqual(ch.length, 100); assert.strictEqual(ch[86].title, '첫 줄'); assert.ok(ch[86].ours); assert.strictEqual(ch[11].title, 'Mirror');
  assert.ok(ch[0].filler && ch[0].title);
  assert.ok(/<svg/.test(U.coverSvg(s, data)) && /REMINA/.test(U.coverSvg(s, data)));
  const sc = U.demoScore(s, data); assert.strictEqual(sc.bpm, 72); assert.ok(sc.melody.length > 10); assert.ok(sc.minor);
  assert.deepStrictEqual(U.demoScore(s, data), sc, '같은 곡은 같은 데모');
});

t('돈 표기', () => {
  assert.strictEqual(U.won('3억 2,000만'), 320000000); assert.strictEqual(U.won('-50만'), -500000); assert.strictEqual(U.won('8,000원'), 8000);
  assert.strictEqual(U.fmtWon(320000000), '3억 2,000만'); assert.strictEqual(U.fmtWon(1200000), '120만');
});

console.log(`idol ${n}/${n} 통과`);
