// 온리펜슬 해석기 시험: node test/pencil.test.js
const assert = require('assert');
const U = require('../src/renderer/pk-pencil.js');
const data = require('../packs/hirion.onlypencil/data.json');
const roster = new U.Roster(data), idx = new U.ImgIndex(data);
let n = 0;
const t = (name, f) => { f(); n++; console.log('ok', name); };

// 빌더 '전개 예시' 원문 그대로
const EX = `{{img::배경::대학교}}
*1교시가 끝난 계단식 강의실. 창으로 든 햇살이 뒷줄 금발 끝에 걸려 반짝인다.*
{{img::박아린::분노}}
박아린💬 "야 찐따 ㅋㅋ 너 아직 살아 있었냐? 존나 반갑네."
*친구들이 낄낄대는 사이, 노트 귀퉁이에 적힌 낙서 한 줄이 잉크처럼 번져 스민다. 그 순간 아린의 혀끝이 꼬인다.*
박아린💬 "뭐, 뭘 봐… 씨, 왜 혀가…"
*"미쳤나 봐. 왜 하필 쟤 앞에서."*
━━━━━━━━━━
📅 1일차 낮 | 📍 대학교
👤 주인공 | 🎚 NORMAL
🖊 잉크 65% | ⏳ 아린 말 더듬기 (3턴)
💗 박아린 -50 (냉소)
📜 주문 -35%
━━━━━━━━━━`;

t('전개 예시 원문', () => {
  const P = U.parse(EX, roster, idx);
  const s = P.status;
  assert.strictEqual(s.day, 1); assert.strictEqual(s.time, '낮'); assert.strictEqual(s.place, '대학교');
  assert.strictEqual(s.me, '주인공'); assert.strictEqual(s.mode, 'NORMAL');
  assert.strictEqual(s.ink, 65); assert.deepStrictEqual(s.effects, [{ t: '아린 말 더듬기', left: 3 }]);
  assert.strictEqual(s.hearts['박아린'], -50); assert.strictEqual(s.zones['박아린'], '냉소');
  assert.strictEqual(s.spent, 35);
  const says = P.beats.filter(b => b.kind === 'say');
  assert.strictEqual(says.length, 2); assert.strictEqual(says[0].who, '박아린');
  assert.ok(says[0].text.startsWith('야 찐따'));
  assert.ok(P.beats.some(b => b.kind === 'think' && /미쳤나 봐/.test(b.text)), '속마음');
  assert.ok(!P.beats.some(b => /📅|━/.test(b.text || '')), '상태창은 장면에서 빠짐');
  // 그림 태그가 글 속에 남아 있으면 등록명으로
  assert.strictEqual(P.beats[0].place, '대학교');
  assert.strictEqual(says[0].pinfo.who, '박아린'); assert.strictEqual(says[0].pinfo.situ, '분노');
});

t('크랙 화면에서 읽은 꼴(별표 없음, 그림은 img 조각)', () => {
  const segs = [{ t: 'img', src: 'https://cdn.example/a.webp', w: 1344, h: 768 }, { t: 'text', s: '1교시가 끝난 계단식 강의실.\n' },
    { t: 'img', src: 'https://cdn.example/b.webp', w: 768, h: 1024 }, { t: 'text', s: '박아린💬 "야 찐따 ㅋㅋ"\n"미쳤나 봐."\n' },
    { t: 'text', s: '━━━━━━━━━━\n📅 3일차 저녁 | 📍 편의점\n👤 이도윤 | 🎚 HARD\n🖊 잉크 40% | ⏳ 없음\n💗 박아린 -42 (냉소) / 한채아 +36 (우호) / 김하영 4 (우호)\n📜 없음\n━━━━━━━━━━', code: true }];
  const P = U.parse(segs, roster, idx);
  assert.strictEqual(P.status.mode, 'HARD'); assert.strictEqual(P.status.me, '이도윤');
  assert.deepStrictEqual(P.status.effects, []);
  assert.deepStrictEqual(P.status.hearts, { 박아린: -42, 한채아: 36, 김하영: 4 });
  assert.strictEqual(P.status.spent, undefined);
  assert.ok(P.beats[0].bg, '가로 그림 = 배경');
  const say = P.beats.find(b => b.kind === 'say');
  assert.strictEqual(say.portrait, 'https://cdn.example/b.webp', '세로 그림 = 다음 화자');
  assert.ok(P.beats.some(b => b.kind === 'think'));
});

t('GOD · 해금 · 함락 · 효과 여럿 · 리필', () => {
  const st = U.parseStatus(['📅 12일차 심야 | 📍 자취방', '👤 주인공 | 🎚 GOD', '🖊 잉크 ∞ | ⏳ 채아 꼬리 (영구), 시간 정지 (1턴)', '💗 박아린🔓 +62 (신뢰) / 한채아 +100 (함락) / 김하영 55 (신뢰) / 윤세라 +12 (우호)', '📜 주문 -0% / 리필 +40%'], roster);
  assert.strictEqual(st.ink, Infinity); assert.strictEqual(st.mode, 'GOD'); assert.strictEqual(st.time, '심야');
  assert.strictEqual(st.effects.length, 2); assert.strictEqual(st.effects[0].left, Infinity); assert.strictEqual(st.effects[1].left, 1);
  assert.ok(st.unlock['박아린']); assert.strictEqual(st.hearts['박아린'], 62); assert.strictEqual(st.hearts['한채아'], 100); assert.strictEqual(st.hearts['윤세라'], 12);
  assert.strictEqual(st.refill, 40);
  const st2 = U.parseStatus(['📅 20일차 아침 | 📍 대학교', '🖊 소멸 | ⏳ 없음'], roster);
  assert.strictEqual(st2.gone, true); assert.strictEqual(st2.ink, null);
});

t('주문 · 카톡 · 통화 · 에피소드 · 주인공 등록', () => {
  const P = U.parse(`**EPISODE. 1 | 적으면 이루어진다**
*자취방 책상 앞. 장난삼아 연습장 귀퉁이에 적어 본다.*
:(사과 하나):
*글자가 잉크처럼 번져 종이 속으로 스며든다.*
[카톡] 한채아: 선배! 오늘 저녁 근무 맞죠? ㅎㅎ
[카톡] 하영: 확인했어요.
📞 박아린
**첫 메시지로 아래 양식을 보내면 주인공이 확정됩니다. 비워 두면 기본값(23세 평범한 대학생)으로 시작합니다.**
\`\`\`
[온리펜슬 | 주인공 등록]
이름:
외형:
성격:
\`\`\``, roster, idx);
  assert.ok(P.beats.some(b => b.kind === 'title' && b.ep === '1'));
  assert.deepStrictEqual(P.spells, ['사과 하나']);
  assert.strictEqual(P.kakao.length, 2); assert.strictEqual(P.kakao[1].who, '김하영');
  assert.ok(P.beats.some(b => b.kind === 'call' && b.who === '박아린'));
  assert.ok(P.reg && P.prologue);
  assert.ok(!P.beats.some(b => /주인공 등록|이름:/.test(b.text || '')));
});

t('기억 합치기: 만남·구간 변화·주문 장부·해금', () => {
  const M = U.blank();
  U.absorb(M, U.parse(EX, roster, idx), { sent: ['아린이 3턴간 내 앞에서 말을 더듬는다'] });
  assert.deepStrictEqual(M.met, ['박아린']);
  assert.strictEqual(M.spells.length, 1); assert.strictEqual(M.spells[0].cost, 35);
  assert.strictEqual(M.days['1'].spells, 1);
  const ev = U.absorb(M, U.parse('박아린💬 "…그때 내가 좀 심했다고. 됐냐?"\n📅 9일차 밤 | 📍 술집\n👤 주인공 | 🎚 NORMAL\n🖊 잉크 80% | ⏳ 없음\n💗 박아린🔓 +51 (신뢰) / 한채아 +40 (우호)\n📜 없음', roster, idx), {});
  assert.deepStrictEqual(ev.unlocked, ['박아린']);
  assert.ok(ev.heart.find(h => h.n === '박아린' && h.zoneChanged && h.zone === '신뢰'));
  assert.ok(ev.met.includes('한채아'));
  assert.strictEqual(ev.day.to, 9);
  assert.ok(ev.effectsEnd.length === 1);
  assert.strictEqual(M.spells.length, 1, '주문 없는 턴은 장부에 안 쌓임');
});

t('잉크 예상(빌더 노트 사례)', () => {
  const E = (s, o) => U.estimate(s, Object.assign({ roster }, o));
  assert.strictEqual(E('사과 하나').cost, 10);
  assert.strictEqual(E('아린이 3턴간 내 앞에서 말을 더듬는다').tier, 'body');
  assert.strictEqual(E('3턴간 시간이 멈춘다').cost, 50);
  assert.strictEqual(E('10턴간 남의 속마음이 들린다').cost, 40);
  const m = E('채아가 5턴간 나를 좋아하게 된다'); assert.strictEqual(m.tier, 'mind'); assert.strictEqual(m.cost, 75);
  assert.ok(E('하영이 영원히 나를 사랑한다').warn.some(w => w.k === 'mind5'));
  assert.ok(E('아린의 호감도가 100이 된다').warn.some(w => w.k === 'meta'));
  const two = E('아린과 채아가 3턴간 말을 더듬는다'); assert.deepStrictEqual(two.targets.sort(), ['박아린', '한채아'].sort()); assert.strictEqual(two.cost, 40);
  assert.strictEqual(E('아린이 3턴간 내 앞에서 말을 더듬는다', { mode: 'HARD' }).cost, 45);
  assert.strictEqual(E('아린이 3턴간 내 앞에서 말을 더듬는다', { mode: 'GOD' }).cost, 0);
  assert.ok(E('3턴간 시간이 멈춘다', { ink: 20 }).warn.some(w => w.k === 'short'));
  assert.strictEqual(E('강아지 한 마리가 나타난다').tier, 'life');
});

console.log(`pencil ${n}/${n} 통과`);
