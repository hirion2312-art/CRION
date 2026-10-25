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
test('게시판: 목록·글쓰기·댓글', async () => {
  const s = fake(c => c.url.endsWith('/signup') ? R(tok(2)) : c.method === 'GET' ? R([{ id: 1 }]) : R([{ id: 7 }], 201));
  const c = new Cloud(CFG, { fetch: s.f, storage: mem() });
  await c.listPosts('tip');
  const l = s.calls[0];
  assert.ok(l.url.includes('board=eq.tip') && l.url.includes('comments(count)'));
  assert.strictEqual(l.h.Authorization, 'Bearer ' + CFG.anonKey, '읽기는 공개 키');
  await c.addPost({ board: 'free', title: '안녕', body: '내용', nick: '팬1' });
  const w = s.calls.find(x => x.method === 'POST' && x.url.endsWith('/posts'));
  assert.strictEqual(w.h.Authorization, 'Bearer A2');
  assert.strictEqual(w.body.nick, '팬1');
  const g = await c.getPost(7);
  assert.ok(g.post && Array.isArray(g.comments));
});

(async () => {
  let ok = 0;
  for (const [n, f] of t) { try { await f(); console.log('  ✔ ' + n); ok++; } catch (e) { console.log('  ✘ ' + n + '\n    ' + e.message); process.exitCode = 1; } }
  console.log(`서버 연결 ${ok}/${t.length} 통과`);
})();
