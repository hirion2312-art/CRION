// 서버 연결(익명 로그인·신고·게시판·관리자) 시험: node test/cloud.test.js
'use strict';
const assert = require('assert');
const { Cloud, okCfg } = require('../src/renderer/cloud');

const CFG = { url: 'https://abcd1234.supabase.co/', anonKey: 'x'.repeat(40) };
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, _m: m }; };
const t = [];
const test = (n, f) => t.push([n, f]);
const R = (body, status) => ({ ok: (status || 200) < 400, status: status || 200, json: async () => body });

function fake(handler) {
  const calls = [];
  const f = async (url, o) => { const c = { url, method: (o && o.method) || 'GET', h: (o && o.headers) || {}, body: o && o.body ? JSON.parse(o.body) : undefined }; calls.push(c); return handler(c); };
  return { f, calls };
}
const tok = (n) => ({ access_token: 'A' + n, refresh_token: 'R' + n, expires_in: 3600, user: { id: 'u' + n } });

test('주소 검사', () => {
  assert.ok(okCfg(CFG));
  assert.ok(!okCfg({ url: 'https://evil.com', anonKey: 'x'.repeat(40) }));
  assert.ok(!okCfg({ url: CFG.url, anonKey: '' }));
  assert.ok(!new Cloud({}).enabled());
});
test('익명 로그인 → 저장 → 재사용 → 만료 전 갱신', async () => {
  let n = 0; let now = 1_000_000;
  const s = fake(c => c.url.endsWith('/auth/v1/signup') ? R(tok(++n)) : c.url.includes('refresh_token') ? R(tok(++n)) : R([]));
  const ls = mem();
  const c = new Cloud(CFG, { fetch: s.f, storage: ls, now: () => now });
  await c.ensureUser(); await c.ensureUser();
  assert.strictEqual(s.calls.length, 1, '두 번째는 저장된 세션 재사용');
  const c2 = new Cloud(CFG, { fetch: s.f, storage: ls, now: () => now });
  await c2.ensureUser();
  assert.strictEqual(s.calls.length, 1, '다시 켜도 같은 세션');
  now += 3600 * 1000 - 30000;
  const u = await c2.ensureUser();
  assert.ok(s.calls[1].url.includes('refresh_token'));
  assert.strictEqual(u.access, 'A2');
});
test('사용 통계: 하루 한 번만 · 실패는 조용히 · 관리자 통계', async () => {
  const s = fake(c => c.url.endsWith('/auth/v1/signup') ? R(tok(1)) : c.url.endsWith('rpc/crion_ping') ? R(null, 204) : c.url.endsWith('rpc/crion_stats') ? R({ days: [], total: { today: 3 } }) : R([]));
  const ls = mem();
  const c = new Cloud(CFG, { fetch: s.f, storage: ls });
  assert.strictEqual(await c.ping('win', '2026-10-28'), true);
  assert.strictEqual(await c.ping('win', '2026-10-28'), false, '같은 날 두 번째는 안 보냄');
  const pings = s.calls.filter(x => x.url.endsWith('rpc/crion_ping'));
  assert.strictEqual(pings.length, 1); assert.deepStrictEqual(pings[0].body, { p_plat: 'win' });
  assert.strictEqual(await c.ping('win', '2026-10-29'), true, '다음 날은 다시');
  const bad = new Cloud(CFG, { fetch: fake(c => c.url.endsWith('/auth/v1/signup') ? R(tok(2)) : R({ message: 'not found' }, 404)).f, storage: mem() });
  assert.strictEqual(await bad.ping('mac', '2026-10-28'), false, '옛 설계도면 조용히 실패');
  await assert.rejects(() => c.stats(30), /관리자 로그인/);
});
test('익명 로그인이 꺼져 있으면 안내', async () => {
  const s = fake(() => R({ user: { id: 'x' } }));
  await assert.rejects(new Cloud(CFG, { fetch: s.f, storage: mem() }).ensureUser(), /익명 로그인/);
});
test('신고 보내기: 내용을 자르고 앱 정보를 붙인다', async () => {
  const s = fake(c => c.url.endsWith('/signup') ? R(tok(1)) : R(null, 201));
  const c = new Cloud(CFG, { fetch: s.f, storage: mem() });
  await c.submitReport('bug', { title: '', body: 'ㄱ'.repeat(9000), nick: '팬' }, { app: '0.3.1', engine: '0.5.10', os: 'win32' }, 'diag');
  const post = s.calls.find(x => x.url.endsWith('/rest/v1/reports'));
  assert.strictEqual(post.method, 'POST');
  assert.strictEqual(post.h.Authorization, 'Bearer A1');
  assert.strictEqual(post.body.body.length, 4000);
  assert.strictEqual(post.body.title.length, 120);
  assert.ok(post.body.app.includes('엔진 0.5.10'));
  assert.strictEqual(post.body.diag, 'diag');
});
test('관리자 로그인: 틀린 비밀번호 / 관리자 아님 / 성공', async () => {
  let mode = 'bad';
  const s = fake(c => {
    if (c.url.includes('grant_type=password')) return mode === 'bad' ? R({ msg: 'Invalid login' }, 400) : R(tok(9));
    if (c.url.includes('/rest/v1/admins')) return R(mode === 'nonadmin' ? [] : [{ uid: 'u9' }]);
    return R([]);
  });
  const c = new Cloud(CFG, { fetch: s.f, storage: mem() });
  await assert.rejects(c.adminLogin('a@b.c', 'x'), /맞지 않아요/);
  mode = 'nonadmin';
  await assert.rejects(c.adminLogin('a@b.c', 'x'), /관리자로 등록/);
  assert.ok(!c.isAdmin());
  mode = 'ok';
  await c.adminLogin('a@b.c', 'x');
  assert.ok(c.isAdmin());
  await c.listReports({ status: 'new', kind: 'bug' });
  const q = s.calls[s.calls.length - 1];
  assert.ok(q.url.includes('status=eq.new') && q.url.includes('kind=eq.bug'));
  assert.strictEqual(q.h.Authorization, 'Bearer A9');
  await c.updateReport(5, { status: 'done', reply: '고쳤어요' });
  const p = s.calls[s.calls.length - 1];
  assert.strictEqual(p.method, 'PATCH'); assert.ok(p.url.endsWith('reports?id=eq.5')); assert.strictEqual(p.body.reply, '고쳤어요');
});
test('관리자 아니면 관리 함수는 실패', async () => {
  const c = new Cloud(CFG, { fetch: fake(() => R([])).f, storage: mem() });
  await assert.rejects(c.listReports(), /관리자 로그인/);
});
test('게시판: 목록은 공개, 글쓰기는 CRION 계정', async () => {
  const s = fake(c => c.url.includes('grant_type=password') ? R(tok(2)) : c.url.includes('/profiles') ? R([{ nick: '팬1', banned: false }]) : c.method === 'GET' ? R([{ id: 1 }]) : R([{ id: 7 }], 201));
  const c = new Cloud(CFG, { fetch: s.f, storage: mem() });
  await c.listPosts('tip');
  const l = s.calls[0];
  assert.ok(l.url.includes('board=eq.tip') && l.url.includes('comments(count)') && l.url.includes('like_count'));
  assert.strictEqual(l.h.apikey, CFG.anonKey, '읽기는 공개 키');
  assert.strictEqual(l.h.Authorization, undefined, '새 방식 키(sb_publishable)는 Authorization 에 안 넣음');
  const old = fake(() => R([]));
  await new Cloud({ url: CFG.url, anonKey: 'eyJ' + 'a'.repeat(40) }, { fetch: old.f, storage: mem() }).listPosts('all');
  assert.strictEqual(old.calls[0].h.Authorization, 'Bearer eyJ' + 'a'.repeat(40), '옛 anon 키(eyJ…)는 넣음');
  await assert.rejects(c.addPost({ board: 'free', title: '안녕', body: '내용' }), /CRION 계정/);
  await c.signIn('fan@example.com', 'password1');
  assert.strictEqual(c.account().nick, '팬1');
  await c.addPost({ board: 'free', title: '안녕', body: '내용', nick: '팬1' });
  const w = s.calls.find(x => x.method === 'POST' && x.url.endsWith('/posts'));
  assert.strictEqual(w.h.Authorization, 'Bearer A2');
  const g = await c.getPost(7);
  assert.ok(g.post && Array.isArray(g.comments));
  await c.likePost(7);
  assert.ok(s.calls.find(x => x.method === 'POST' && x.url.endsWith('/post_likes') && x.body.post_id === 7));
  await c.listPosts('mine');
  assert.ok(s.calls[s.calls.length - 1].url.includes('uid=eq.u2'), '내 글 = 계정 uid');
});
test('가입: 세션 저장 + 닉네임 만들기, 다시 켜도 로그인 유지, 로그아웃', async () => {
  const s = fake(c => c.url.endsWith('/auth/v1/signup') ? R(tok(5)) : c.url.includes('/profiles') && c.method === 'GET' ? R([]) : R(null, 201));
  const ls = mem();
  const c = new Cloud(CFG, { fetch: s.f, storage: ls });
  await assert.rejects(c.signUp('a@b.co', 'password1', '하루'), /소문자/, '아이디에 이메일 모양 안 됨');
  await assert.rejects(c.signUp('ab', 'password1', '하루'), /4~20자/);
  await assert.rejects(c.signUp('haru_01', 'short', '닉네임'), /8자/);
  const r = await c.signUp('Haru_01', 'password1', '하루');
  assert.ok(r.ok && !r.nickError);
  const su = s.calls.find(x => x.url.endsWith('/signup'));
  assert.strictEqual(su.body.email, 'haru_01@' + Cloud.ID_DOMAIN, '서버에는 메일이 갈 수 없는 주소로');
  assert.strictEqual(c.account().login, 'haru_01'); assert.ok(c.account().isId);
  const pr = s.calls.find(x => x.method === 'POST' && x.url.endsWith('/profiles'));
  assert.strictEqual(pr.body.nick, '하루'); assert.strictEqual(pr.h.Authorization, 'Bearer A5');
  const c2 = new Cloud(CFG, { fetch: s.f, storage: ls });
  assert.strictEqual(c2.accountUid(), 'u5', '다시 켜도 계정 유지');
  assert.strictEqual((await c2.ensureUser()).uid, 'u5', '계정이 있으면 신고도 계정으로');
  await c2.signOut();
  assert.strictEqual(c2.accountUid(), null);
  assert.ok(s.calls.find(x => x.url.endsWith('/auth/v1/logout')));
});
test('가입했는데 이메일 확인이 켜져 있으면 안내 / 서버 오류 문구 한국어로', async () => {
  const s = fake(c => c.url.endsWith('/signup') ? R({ id: 'x', email: 'a@b.co' }) : R({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_nick"' }, 409));
  const c = new Cloud(CFG, { fetch: s.f, storage: mem() });
  await assert.rejects(c.signUp('haru_01', 'password1', '하루'), /Confirm email/);
  const s2 = fake(() => R({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400));
  await assert.rejects(new Cloud(CFG, { fetch: s2.f, storage: mem() }).signIn('a@b.co', 'x'), /맞지 않아요/);
});
test('중복 확인 · 비밀번호 바꾸기 · 관리자 임시 비밀번호', async () => {
  const s = fake(c => c.url.includes('crion_id_available') ? R(c.body.p_id !== 'taken') : c.url.includes('crion_nick_available') ? R(false) : c.url.includes('grant_type=password') ? R(tok(4)) : c.url.includes('crion_admin_set_password') ? R(c.body.p_id === 'haru_01') : c.url.includes('/admins') ? R([{ uid: 'u4' }]) : R([]));
  const c = new Cloud(CFG, { fetch: s.f, storage: mem() });
  assert.strictEqual(await c.idAvailable('taken'), false);
  assert.strictEqual(await c.idAvailable('fresh'), true);
  await assert.rejects(c.idAvailable('한글'), /소문자/);
  assert.strictEqual(await c.nickAvailable('하루'), false);
  await c.signIn('haru_01', 'password1');
  await c.changePassword('newpassword');
  const pu = s.calls[s.calls.length - 1];
  assert.ok(pu.method === 'PUT' && pu.url.endsWith('/auth/v1/user') && pu.body.password === 'newpassword' && pu.h.Authorization === 'Bearer A4');
  await c.adminLogin('boss@b.co', 'pw');
  assert.ok(await c.adminSetPassword('haru_01', 'temp12345'));
  await assert.rejects(c.adminSetPassword('nobody', 'temp12345'), /없어요/);
});
test('기록 동기화 주소: 커서 이후만 받기 · 덮어쓰기로 올리기', async () => {
  const s = fake(c => c.url.includes('grant_type=password') ? R(tok(3)) : c.url.includes('/profiles') ? R([]) : R([]));
  const c = new Cloud(CFG, { fetch: s.f, storage: mem() });
  await assert.rejects(c.syncPull(''), /로그인/);
  await c.signIn('haru_01', 'password1');
  assert.strictEqual(s.calls[0].body.email, 'haru_01@' + Cloud.ID_DOMAIN, '아이디로 로그인');
  await c.signIn('boss@b.co', 'password1');
  assert.strictEqual(s.calls[s.calls.length - 2 >= 0 ? s.calls.findIndex(x => x.body && x.body.email === 'boss@b.co') : 0].body.email, 'boss@b.co', '관리자는 이메일 그대로');
  assert.ok(!c.account().isId);
  await c.syncPull('2026-10-27T10:00:00.123456+00:00');
  const g = s.calls[s.calls.length - 1];
  assert.ok(g.url.includes('sync_items?') && g.url.includes('updated_at=gt.2026-10-27T10%3A00%3A00.123456%2B00%3A00') && g.url.includes('order=updated_at.asc'));
  await c.syncPush([{ key: 'crion.w.a', val: { raw: '{}' }, deleted: false }]);
  const p = s.calls[s.calls.length - 1];
  assert.ok(p.url.includes('sync_items?on_conflict=uid,key') && /merge-duplicates/.test(p.h.Prefer) && /representation/.test(p.h.Prefer) && p.h.Authorization === 'Bearer A3');
});

(async () => {
  let ok = 0;
  for (const [n, f] of t) { try { await f(); console.log('  ✔ ' + n); ok++; } catch (e) { console.log('  ✘ ' + n + '\n    ' + e.message); process.exitCode = 1; } }
  console.log(`서버 연결 ${ok}/${t.length} 통과`);
})();
