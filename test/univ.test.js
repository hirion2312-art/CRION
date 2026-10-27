// 리온대학교 x스학과 팩 해석 시험: node test/univ.test.js
'use strict';
const assert = require('assert');
const U = require('../src/renderer/pk-univ');
const data = require('../packs/hirion.rion-univ/data.json');
const R = new U.Roster(data);
const t = [];
const test = (n, f) => t.push([n, f]);
const img = (w, h, alt) => ({ t: 'img', src: `https://img.test/${w}x${h}/${Math.random().toString(36).slice(2, 7)}.png`, w, h, alt: alt || '' });
const txt = (s, code) => ({ t: 'text', s, code: !!code });

const PROLOGUE = [
  img(1200, 675),
  txt('⚠️시작 전 해당 사이트에 방문하여 입학시험을 진행해주세요.\n-\n- 캐릭터 생성과 더불어 해당 사이트에서 치르는 간단한 테스트를 통해 입학시 등급이 결정됩니다.\n\n\n이미지 클릭시에도 안 넘어가질시 아래 링크 클릭\nhttps://hirion2312-art.github.io/hyerong.live.net/exam/'),
  img(1920, 1080),
  txt('EPISODE. 1 | 입학\n=\n세계는 저출산으로 인류 존속의 위기를 맞았다.\n한국은 대학에서 X스에 관한 학문을 가르치도록 했고\n\\\n그리고 나는 오늘, 그 리온대학교 X스학과에 입학한다.\n나는 합격통지서를 쥐고 신체검사실 문 앞에 섰다.'),
  img(800, 1000),
  txt('양가희 검사관💬 "다음 신입생. 결과서를 제출하십시오."\n\\\n아래 형식 그대로 붙여넣어 제출하세요.\n[입학 검사 결과 | 리온대학교 X스학과]\n이름:\n나이:\n특기:\n취미:\n성격:\n등급:\n능력치:\n※ 아직 검사를 안 받았다면 검사소에서 먼저 받고 오세요.')
];
test('프롤로그: 입학 검사 신호 · 양식 줄은 장면에서 빠짐 · 양가희 얼굴', () => {
  const P = U.parse(PROLOGUE, R, data);
  assert.ok(P.needExam);
  assert.ok(!P.beats.some(b => /이름:|능력치:|붙여넣어|https:/.test(b.text || '')), JSON.stringify(P.beats.map(b => b.text)));
  const say = P.beats.find(b => b.kind === 'say');
  assert.strictEqual(say.who, '양가희'); assert.strictEqual(say.title, '검사관'); assert.strictEqual(say.text, '다음 신입생. 결과서를 제출하십시오.');
  assert.ok(say.portrait && P.faces['양가희'] === say.portrait);
  assert.ok(P.beats.find(b => b.kind === 'title' && b.ep === 1 && b.text === '입학'));
  assert.ok(P.beats.some(b => b.bg), '넓은 그림 = 배경');
});

const TURN = [
  img(1920, 1080, '배경_과방'),
  txt('과방 문을 열자 소파에 누운 선배가 손을 흔든다.'),
  img(768, 1152),
  txt('유소희 💬 "어~ 신입생? 과제 파트너 구해? 나 비싼데~"\n'),
  img(768, 1152),
  txt('강다인💬 "선배! 또 그런 소리 하시면… 아, 아니 그냥."'),
  txt('[가가오톡 | 박준호] 야 너 어디냐 ㅋㅋ 학식 ㄱ?\n[가가오톡 | 1학년 단톡방 | 이민지] 오늘 개총 7시 밤결임'),
  txt('뤼브리타임 | 자유게시판\n1. 유라 교수 과제 꿀팁 - 익명1\n파트너랑 호흡 점수가 절반임\nㄴ 익명2: ㄹㅇ 손수건 챙겨감\n\n2. "학식 계란후라이 기준이 뭐임" 진짜 궁금함\n익명3: 그때그때 기분이래 ㅋㅋ'),
  txt('📅 1학년 1학기 | 2주차 화요일 14:20 | 📍과방\n🎓 김신입 | 등급: B | 직전 학기 평점: -\n📚 X스학개론(과제 1/4, B) · 체력과 지구력(과제 0/4, -) · 연애심리(과제 1/4, A) · 커플 실습 세미나(과제 0/4, -) · 교양 요가(과제 0/4, -)\n💌 유소희 💜5.5 · 강다인 🧡12 · 차예은 🧡20.8\n📝 다음 일정: 19:00 개강총회 (밤결)', true)
];
test('일반 턴: 상태창 · 과목 · 호감도 · 대사 · 얼굴', () => {
  const P = U.parse(TURN, R, data);
  const st = P.status;
  assert.strictEqual(st.week, 2); assert.strictEqual(st.day, '화'); assert.strictEqual(st.time, '14:20'); assert.strictEqual(st.place, '과방');
  assert.strictEqual(st.grade, 'B'); assert.strictEqual(st.me, '김신입');
  assert.deepStrictEqual(st.courses.map(c => c.n), ['X스학개론', '체력과 지구력 트레이닝', '연애심리와 유혹 커뮤니케이션', '커플 실습 세미나', '교양 요가']);
  assert.deepStrictEqual(st.courses.map(c => c.recent), ['B', '', 'A', '', '']);
  assert.deepStrictEqual(st.aff, [{ n: '유소희', e: '💜', v: 5.5 }, { n: '강다인', e: '🧡', v: 12 }, { n: '차예은', e: '🧡', v: 20.8 }]);
  assert.strictEqual(st.next, '19:00 개강총회 (밤결)');
  const says = P.beats.filter(b => b.kind === 'say');
  assert.deepStrictEqual(says.map(b => b.who), ['유소희', '강다인']);
  assert.ok(says[0].portrait && says[1].portrait && says[0].portrait !== says[1].portrait);
  assert.strictEqual(P.bg.place, '과방');
  assert.ok(!P.beats.some(b => /📅|🎓|가가오톡|익명|뤼브리타임/.test(b.text || '')), '블록은 장면에서 빠짐: ' + P.beats.map(b => b.text).join(' / '));
});
test('가가오톡 줄 · 뤼브리타임 글·댓글', () => {
  const P = U.parse(TURN, R, data);
  assert.deepStrictEqual(P.kakao, [{ room: '박준호', who: '박준호', t: '야 너 어디냐 ㅋㅋ 학식 ㄱ?' }, { room: '1학년 단톡방', who: '이민지', t: '오늘 개총 7시 밤결임' }]);
  assert.strictEqual(P.riv.length, 2);
  assert.strictEqual(P.riv[0].title, '유라 교수 과제 꿀팁'); assert.strictEqual(P.riv[0].who, '익명1');
  assert.deepStrictEqual(P.riv[0].body, ['파트너랑 호흡 점수가 절반임']);
  assert.deepStrictEqual(P.riv[0].cmts, [{ who: '익명2', t: 'ㄹㅇ 손수건 챙겨감' }]);
  assert.strictEqual(P.riv[1].title, '학식 계란후라이 기준이 뭐임');
  assert.deepStrictEqual(P.riv[1].cmts, [{ who: '익명3', t: '그때그때 기분이래 ㅋㅋ' }]);
});
test('단톡방(GAGAOTALK 블록) · 핸드폰 블록(구형) 알림·호감도', () => {
  const P = U.parse([txt('GAGAOTALK 블록:\n[준호, 민지, 다인이 있는 단톡방]\n\n👤 박준호\n야 어디서 만나?\n👤 이민지\nㅁㄹ 피방 가실?\n👤 강다인\n좋다 ㅋㅋ ㄱㄱ\n\n핸드폰 블록:\n🕖 | 2026 3/2 AM 9:00\n📆 | 다음수업: X스학개론\n🔔 | 뤼브리타임 (3분전) "이제 종강 내놔라"\n💬 | 가가오톡 [1학년 단톡방] 야 너 어딘데\n📍| 리온대학교 강의실\n--------\n👤 [김신입] 1학년 1학기\n💯 예상 최종 학점 | 3.5\n💪 현재 신체등급 | B\n❤️ 호감도 |\n소희 | 💜10% - "무관심"\n예은 | 🧡20% - "우정"')], R, data);
  assert.deepStrictEqual(P.kakao.map(k => [k.room, k.who, k.t]), [['준호, 민지, 다인이 있는 단톡방', '박준호', '야 어디서 만나?'], ['준호, 민지, 다인이 있는 단톡방', '이민지', 'ㅁㄹ 피방 가실?'], ['준호, 민지, 다인이 있는 단톡방', '강다인', '좋다 ㅋㅋ ㄱㄱ']]);
  assert.strictEqual(P.phone.clock, '2026 3/2 AM 9:00'); assert.strictEqual(P.phone.nextClass, 'X스학개론'); assert.strictEqual(P.phone.place, '리온대학교 강의실');
  assert.deepStrictEqual(P.phone.notifs.map(n => [n.app, n.title]), [['riv', '이제 종강 내놔라'], ['kakao', '야 너 어딘데']]);
  assert.strictEqual(P.phone.grade, 'B');
  assert.deepStrictEqual(P.phone.aff, [{ n: '유소희', e: '💜', v: 10 }, { n: '차예은', e: '🧡', v: 20 }]);
  assert.strictEqual(P.beats.filter(b => b.text).length, 0, P.beats.map(b => b.text).join('/'));
});
test('1:1 가가오톡: 머리줄만 있는 [가가오톡 | 이름] · 내 말은 오른쪽 · 묘사 줄은 장면으로', () => {
  const P = U.parse([txt('[가가오톡 | 차예은]\n오티 끝나면 바로 연락해라\n김철수: 오티끝남\n차예은: ㅇㅋ 나도 방금 끝\n교수가 첫날이라고 봐줌 ㅋㅋ\n학식 ㄱ\n답장 속도가 거의 실시간이었다. 화면을 내려다보는 사이, 옆으로 누군가 노트를 품에 안고 지나가다 멈췄다.\n빨리 와라 줄 길어짐\n\n강다인 💬 "아까 회장님이 말한 거 다 적었어요?"')], R, data, { me: '김철수' });
  assert.deepStrictEqual(P.kakao.map(k => [k.room, k.who, k.t, !!k.me]), [['차예은', '차예은', '오티 끝나면 바로 연락해라', false], ['차예은', '김철수', '오티끝남', true], ['차예은', '차예은', 'ㅇㅋ 나도 방금 끝', false], ['차예은', '차예은', '교수가 첫날이라고 봐줌 ㅋㅋ', false], ['차예은', '차예은', '학식 ㄱ', false], ['차예은', '차예은', '빨리 와라 줄 길어짐', false]]);
  assert.ok(P.beats.some(b => b.kind === 'narr' && /답장 속도가/.test(b.text)), '묘사 줄은 장면으로');
  const M = U.blank(); M.kakao['차예은'] = [{ who: '김철수', t: '오티끝남', me: true, at: 1 }];
  U.absorb(M, P, data, 2);
  assert.strictEqual(M.kakao['차예은'].filter(x => x.me).length, 1, '내가 보낸 말은 한 번만');
});
test('수강신청 블록', () => {
  const P = U.parse([txt('WREVERYTIME 블록:\n[1학년 1학기 수강가능 수업]\n총 5개 과목 이수 가능 (교양 포함)\n\n(전공)\n1. X스학개론 - 시험 있음\n2. 커플 실습 세미나 - 실습위주\n(교양)\n3. 교양 요가'), txt('📅 1학년 1학기 | 1주차 월요일 10:00 | 📍대형강의실', true)], R, data);
  assert.ok(P.enroll && P.enroll.lines.includes('1. X스학개론 - 시험 있음'));
  assert.strictEqual(P.status.week, 1);
});
test('기록 합치기: 과제 평가 쌓기 · 평점 · 호감도 변화 · 앨범 · 알림', () => {
  const M = U.blank();
  const a = U.absorb(M, U.parse(TURN, R, data), data, 1000);
  assert.ok(a.affUp.length === 3 && a.affUp[0].first);
  assert.strictEqual(M.courses['X스학개론'].hist.join(), 'B');
  assert.strictEqual(U.gpa(M, data), 3.5);   // B 3.0, A 4.0 (같은 학점)
  const T2 = TURN.slice(0, -1).concat([txt('📅 1학년 1학기 | 3주차 월요일 11:00 | 📍X스학관 301\n📚 X스학개론(과제 2/4, A) · 연애심리(과제 1/4, A)\n💌 유소희 🧡51 · 강다인 🧡12', true)]);
  const b = U.absorb(M, U.parse(T2, R, data), data, 2000);
  assert.ok(b.weekChanged);
  assert.strictEqual(M.courses['X스학개론'].hist.join(), 'B,A');
  assert.strictEqual(U.courseLetter(M.courses['X스학개론']), 'B+');
  assert.ok(b.affUp.find(x => x.n === '유소희' && x.changed));
  assert.strictEqual(M.status.grade, 'B', '빠진 칸은 이전 값 유지');
  assert.ok(M.album.length >= 3);
  assert.strictEqual(M.kakao['박준호'].length, 2);
  assert.strictEqual(M.riv.length, 2, '같은 글은 한 번만');
});
test('입학 검사 결과 블록 읽기', () => {
  const r = U.parseExam('[입학 검사 결과 | 리온대학교 X스학과]\n이름: 김신입\n나이: 20세\n특기: 요리\n취미: 게임\n성격: 성실, 덤벙\n지원동기: 호기심이 생겨서\n자기소개: 잘 부탁드려요\n학번: 2026-12345\n등급: B (평범한 학생)\n능력치: 체력 62 / 이론 80 / 센스 70 / 멘탈 55 / 정직도 91\n유형: 이론형 (약점: 멘탈)\n담당관 코멘트: "평균입니다."');
  assert.strictEqual(r.name, '김신입'); assert.strictEqual(r.grade, 'B'); assert.strictEqual(r.stats.정직도, 91); assert.strictEqual(r.sid, '2026-12345');
});
test('주차 → 날짜', () => {
  const d = U.weekDate(8, '금', data);
  assert.strictEqual(d.getMonth() + 1 + '/' + d.getDate(), '4/24');
});

let fail = 0;
for (const [n, f] of t) { try { f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n    ')); } }
console.log(fail ? `\n${fail}개 실패` : `\n리온대 해석 ${t.length}/${t.length} 통과`);
process.exit(fail ? 1 : 0);
