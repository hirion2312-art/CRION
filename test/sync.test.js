// 플레이 기록 동기화 시험: node test/sync.test.js  (기기 두 대 + 가짜 서버)
'use strict';
const assert = require('assert');
const { Sync, merge } = require('../src/renderer/sync');
const t = [];
const test = (n, f) => t.push([n, f]);

function storage(init) {
  const m = Object.assign({}, init || {});
  return {
    get length() { return Object.keys(m).length; },
    key: (i) => Object.keys(m)[i] || null,
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
    _m: m
  };
}
// 서버: 계정별 칸, 쓸 때마다 시각이 1씩 오른다 (서버 시각)
function server() {
  let clock = 0;
  const rows = {};
  const iso = (n) => new Date(Date.UTC(2026, 9, 27) + n).toISOString().replace('Z', '000+00:00');
  return {
    rows,
    cloudFor(uid) {
      return {
        accountUid: () => uid,
        syncPull: async (cursor) => Object.values(rows[uid] || {}).filter(r => !cursor || r.updated_at > cursor).sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1)).map(r => Object.assign({}, r)),
        syncPush: async (list) => { rows[uid] = rows[uid] || {}; return list.map(r => { rows[uid][r.key] = { key: r.key, val: r.val, deleted: r.deleted, updated_at: iso(++clock) }; return { key: r.key, updated_at: rows[uid][r.key].updated_at }; }); }
      };
    }
  };
}
function device(srv, uid, init, settings) {
  const ls = storage(init);
  const st = Object.assign({ workUrls: {}, recent: [] }, settings || {});
  let now = 1000;
  const s = new Sync({ storage: ls, cloud: srv.cloudFor(uid), getSettings: () => st, setSettings: async (p) => Object.assign(st, p), device: 'test', now: () => (now += 10) });
  return { ls, st, s, cloud: (u) => { s.o.cloud = srv.cloudFor(u); } };
}
const rec = (o) => JSON.stringify(Object.assign({ turns: 0, opens: 0, playMs: 0, firstAt: 0, lastAt: 0, chars: {}, album: [], quotes: [], quick: null }, o));

test('컴퓨터에서 한 기록이 폰에 그대로', async () => {
  const srv = server();
  const pc = device(srv, 'u1', { 'crion.w.aca': rec({ turns: 3 }), 'crion.pk.hirion.safehouse.saves.safehouse': '[{"id":"s1","created":1,"last":5}]', 'crion.tut4': '1' }, { workUrls: { aca: 'https://crack.wrtn.ai/u/1/c/9' }, recent: ['aca'] });
  const r1 = await pc.s.run();
  assert.strictEqual(r1.pushed, 3, '기록 2칸 + 이어하기(가상 칸) 1칸');
  assert.ok(!srv.rows.u1['crion.tut4'], '사용법 본 여부 같은 기기 전용 값은 안 올림');
  const ph = device(srv, 'u1', {});
  const r2 = await ph.s.run();
  assert.strictEqual(r2.pulled + r2.merged, 3);
  assert.strictEqual(JSON.parse(ph.ls.getItem('crion.w.aca')).turns, 3);
  assert.strictEqual(ph.st.workUrls.aca, 'https://crack.wrtn.ai/u/1/c/9', '이어하기 주소도 옴');
  const r3 = await ph.s.run();
  assert.strictEqual(r3.pushed + r3.pulled, 0, '바뀐 게 없으면 오가는 것 없음');
});
test('한쪽에서 더 하면 다른 쪽이 받는다 · 지운 것도 지워짐', async () => {
  const srv = server();
  const pc = device(srv, 'u1', { 'crion.w.aca': rec({ turns: 3 }), 'crion.nick': '하루' });
  const ph = device(srv, 'u1', {});
  await pc.s.run(); await ph.s.run();
  pc.ls.setItem('crion.w.aca', rec({ turns: 9 }));
  pc.ls.removeItem('crion.nick');
  await pc.s.run();
  await ph.s.run();
  assert.strictEqual(JSON.parse(ph.ls.getItem('crion.w.aca')).turns, 9);
  assert.strictEqual(ph.ls.getItem('crion.nick'), null);
});
test('양쪽에서 따로 플레이하면 합친다 (큰 값·그림 합집합·세이브 합치기)', async () => {
  const srv = server();
  const pc = device(srv, 'u1', { 'crion.w.aca': rec({ turns: 2 }) });
  const ph = device(srv, 'u1', {});
  await pc.s.run(); await ph.s.run();
  pc.ls.setItem('crion.w.aca', rec({ turns: 7, album: [{ src: 'a.png' }], lastAt: 50 }));
  pc.ls.setItem('crion.pk.p.saves.w', '[{"id":"s1","created":1,"last":10}]');
  ph.ls.setItem('crion.w.aca', rec({ turns: 4, album: [{ src: 'b.png' }], lastAt: 80 }));
  ph.ls.setItem('crion.pk.p.saves.w', '[{"id":"s2","created":2,"last":20}]');
  await pc.s.run();
  const r = await ph.s.run();
  assert.ok(r.merged >= 2);
  const m = JSON.parse(ph.ls.getItem('crion.w.aca'));
  assert.strictEqual(m.turns, 7); assert.strictEqual(m.lastAt, 80);
  assert.deepStrictEqual(m.album.map(x => x.src).sort(), ['a.png', 'b.png']);
  assert.deepStrictEqual(JSON.parse(ph.ls.getItem('crion.pk.p.saves.w')).map(x => x.id), ['s1', 's2']);
  await pc.s.run();
  assert.deepStrictEqual(JSON.parse(pc.ls.getItem('crion.w.aca')).album.map(x => x.src).sort(), ['a.png', 'b.png'], '합친 결과가 다시 컴퓨터로');
});
test('처음 연결하는 기기에 이미 기록이 있으면 서버 것과 합친다', async () => {
  const srv = server();
  const pc = device(srv, 'u1', { 'crion.w.aca': rec({ turns: 10, quotes: [{ text: '안녕' }] }) }, { workUrls: { aca: 'pc-url' }, recent: ['aca'] });
  await pc.s.run();
  const ph = device(srv, 'u1', { 'crion.w.aca': rec({ turns: 1, quotes: [{ text: '반가워' }] }), 'crion.w.uni': rec({ turns: 2 }) }, { workUrls: { uni: 'ph-url' }, recent: ['uni'] });
  await ph.s.run();
  const m = JSON.parse(ph.ls.getItem('crion.w.aca'));
  assert.strictEqual(m.turns, 10); assert.strictEqual(m.quotes.length, 2);
  assert.ok(ph.ls.getItem('crion.w.uni'), '폰에만 있던 작품도 남음');
  assert.deepStrictEqual(Object.keys(ph.st.workUrls).sort(), ['aca', 'uni']);
  await pc.s.run();
  assert.ok(pc.ls.getItem('crion.w.uni'), '폰 기록이 컴퓨터로');
});
test('플레이 중에는 받기를 미루고, 다른 계정으로 바꾸면 처음부터', async () => {
  const srv = server();
  const pc = device(srv, 'u1', { 'crion.w.aca': rec({ turns: 1 }) });
  const ph = device(srv, 'u1', {});
  await pc.s.run();
  const r = await ph.s.run({ pull: false });
  assert.strictEqual(r.pulled, 0); assert.strictEqual(ph.ls.getItem('crion.w.aca'), null);
  await ph.s.run();
  assert.ok(ph.ls.getItem('crion.w.aca'));
  ph.cloud('u2');
  const r2 = await ph.s.run();
  assert.ok(r2.pushed >= 1 && srv.rows.u2['crion.w.aca'], '새 계정에는 이 기기 기록을 올린다');
});
test('너무 큰 칸은 건너뛰고, 로그인 안 했으면 아무것도 안 함', async () => {
  const srv = server();
  const pc = device(srv, 'u1', { 'crion.w.big': 'x'.repeat(300000), 'crion.w.ok': rec({}) });
  const r = await pc.s.run();
  assert.strictEqual(r.skipped, 1); assert.ok(!srv.rows.u1['crion.w.big']);
  const none = device(srv, null, { 'crion.w.ok': rec({}) });
  assert.strictEqual(await none.s.run(), null);
});
test('합치기 규칙', () => {
  assert.strictEqual(merge('crion.prefs', '{"a":1}', '{"a":2,"b":3}'), '{"a":1,"b":3}', '같은 항목은 이 기기, 없는 항목은 서버에서');
  assert.strictEqual(merge('crion.prefs', null, '{"a":2}'), '{"a":2}');
  assert.strictEqual(merge('crion.prefs', '{"a":1}', null), '{"a":1}');
  const dex = merge('crion.pk.p.s.s1', '{"codex":{"1":{"m":"C"}},"day":3}', '{"codex":{"2":{"m":"S"}},"day":2}');
  assert.deepStrictEqual(JSON.parse(dex), { codex: { 1: { m: 'C' }, 2: { m: 'S' } }, day: 3 }, '도감은 양쪽 발견을 다 남김');
});

(async () => {
  let fail = 0;
  for (const [n, f] of t) { try { await f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n    ')); } }
  console.log(fail ? `\n${fail}개 실패` : `\n기록 동기화 시험 ${t.length}개 통과`);
  process.exit(fail ? 1 : 0);
})();
