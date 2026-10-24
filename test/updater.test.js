// 업데이트 도구 시험: 서명, 바뀐 파일만 받기, 위조·깨짐 거부, 실패 시 기존 유지
'use strict';
const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const U = require('../src/updater');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crion-up-'));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pub = publicKey.export({ type: 'spki', format: 'pem' });
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });

let site = {};   // 경로 → Buffer
const hits = [];
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  hits.push(p);
  if (site[p]) { res.writeHead(200); res.end(site[p]); } else { res.writeHead(404); res.end(); }
});
const fetchFn = (u) => fetch(u);
const mk = (files) => files.map(([p, c]) => ({ path: p, sha256: U.sha256(Buffer.from(c)), size: Buffer.byteLength(c) }));

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const t = [];
  const test = (n, f) => t.push([n, f]);

  test('서명이 맞으면 목록을 받는다', async () => {
    const body = Buffer.from(JSON.stringify({ packs: [] }));
    site['/index.json'] = body; site['/index.json.sig'] = Buffer.from(U.signBytes(body, priv));
    const r = await U.fetchIndex({ fetchFn, url: base + 'index.json', pubkey: pub });
    assert.strictEqual(r.verified, true);
  });
  test('목록이 바뀌었으면(위조) 거부한다', async () => {
    site['/index.json'] = Buffer.from(JSON.stringify({ packs: [{ id: 'evil' }] }));
    await assert.rejects(U.fetchIndex({ fetchFn, url: base + 'index.json', pubkey: pub }), /서명/);
  });
  test('서명 파일이 없으면 거부한다', async () => {
    delete site['/index.json.sig'];
    await assert.rejects(U.fetchIndex({ fetchFn, url: base + 'index.json', pubkey: pub }), /서명/);
  });
  test('열쇠를 안 쓰면(pubkey 없음) 서명 없이도 받는다', async () => {
    const r = await U.fetchIndex({ fetchFn, url: base + 'index.json', pubkey: '' });
    assert.strictEqual(r.verified, false);
  });

  const dest = path.join(tmp, 'packs', 'a');
  test('처음엔 전부 받는다', async () => {
    site['/p/manifest.json'] = Buffer.from('{"v":1}'); site['/p/assets/한글 이름.png'] = Buffer.from('IMG1'); site['/p/bgm.mp3'] = Buffer.from('MUS1');
    const entry = { base: base + 'p/', files: mk([['manifest.json', '{"v":1}'], ['assets/한글 이름.png', 'IMG1'], ['bgm.mp3', 'MUS1']]) };
    const r = await U.syncDir({ fetchFn, entry, destDir: dest, reuseDirs: [dest] });
    assert.deepStrictEqual([r.downloaded, r.reused], [3, 0]);
    assert.strictEqual(fs.readFileSync(path.join(dest, 'assets/한글 이름.png'), 'utf8'), 'IMG1');
  });
  test('다음엔 바뀐 파일만 받는다(나머지는 재사용)', async () => {
    site['/p/manifest.json'] = Buffer.from('{"v":2}');
    hits.length = 0;
    const entry = { base: base + 'p/', files: mk([['manifest.json', '{"v":2}'], ['assets/한글 이름.png', 'IMG1'], ['bgm.mp3', 'MUS1']]) };
    const r = await U.syncDir({ fetchFn, entry, destDir: dest, reuseDirs: [dest] });
    assert.deepStrictEqual([r.downloaded, r.reused], [1, 2]);
    assert.ok(!hits.some(h => h.includes('bgm') || h.includes('png')), '안 바뀐 파일은 요청도 안 해야 해요');
    assert.strictEqual(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'), '{"v":2}');
    assert.strictEqual(fs.readFileSync(path.join(dest + '.prev', 'manifest.json'), 'utf8'), '{"v":1}', '직전 버전 보관');
  });
  test('내용이 목록과 다르면 거부하고 기존 것을 그대로 둔다', async () => {
    site['/p/bgm.mp3'] = Buffer.from('TAMPERED');
    const entry = { base: base + 'p/', files: mk([['manifest.json', '{"v":3}'], ['bgm.mp3', 'MUS2']]) };
    site['/p/manifest.json'] = Buffer.from('{"v":3}');
    await assert.rejects(U.syncDir({ fetchFn, entry, destDir: dest, reuseDirs: [dest] }), /달라요/);
    assert.strictEqual(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'), '{"v":2}');
    assert.ok(!fs.readdirSync(path.dirname(dest)).some(n => n.includes('.tmp-')), '임시 폴더 정리');
  });
  test('받다가 404면 기존 것을 그대로 둔다', async () => {
    const entry = { base: base + 'p/', files: mk([['nope.bin', 'x']]) };
    await assert.rejects(U.syncDir({ fetchFn, entry, destDir: dest, reuseDirs: [] }), /실패/);
    assert.strictEqual(fs.readFileSync(path.join(dest, 'manifest.json'), 'utf8'), '{"v":2}');
  });
  test('위험한 경로(../)는 거부한다', async () => {
    const entry = { base: base + 'p/', files: [{ path: '../evil', sha256: 'a'.repeat(64), size: 1 }] };
    await assert.rejects(U.syncDir({ fetchFn, entry, destDir: dest, reuseDirs: [] }), /올바르지/);
  });
  test('버전 비교', () => {
    assert.strictEqual(U.cmpVer('0.10.0', '0.9.5'), 1);
    assert.strictEqual(U.cmpVer('1.0.0', '1.0.0'), 0);
    assert.strictEqual(U.cmpVer('0.2.0', '0.2.1'), -1);
  });

  let fail = 0;
  for (const [n, f] of t) {
    try { await f(); console.log('  ✔ ' + n); } catch (e) { fail++; console.log('  ✘ ' + n + '\n    ' + (e.message || e)); }
  }
  server.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fail ? `\n${fail}개 실패` : `\n업데이트 시험 ${t.length}개 통과`);
  process.exit(fail ? 1 : 0);
})();
