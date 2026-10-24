// CRION 업데이트 도구: 팩·화면 엔진을 안전하게 받아 바꿔 끼운다. (Electron 없이도 테스트 가능)
//  - 목록(index.json)은 서명(ed25519)으로 위조를 막는다.
//  - 파일마다 sha256을 확인한다. 바뀐 파일만 내려받고, 같은 파일은 기존 것을 재사용한다.
//  - 새 폴더를 다 받은 뒤에 한 번에 교체한다. 실패하면 기존 것이 그대로 남는다. 직전 버전은 .prev로 보관.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function cmpVer(a, b) {
  const pa = String(a || '0').split(/[.-]/).map(x => parseInt(x, 10) || 0);
  const pb = String(b || '0').split(/[.-]/).map(x => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  }
  return 0;
}

const safeRel = (p) => typeof p === 'string' && p.length > 0 && !p.includes('..') && !path.isAbsolute(p) && !p.includes('\\') && !p.startsWith('.');

function verifySig(bytes, sigB64, pubPem) {
  try {
    return crypto.verify(null, bytes, crypto.createPublicKey(pubPem), Buffer.from(String(sigB64).trim(), 'base64'));
  } catch (e) { return false; }
}

function signBytes(bytes, privPem) {
  return crypto.sign(null, bytes, crypto.createPrivateKey(privPem)).toString('base64');
}

// 목록 받기. pubkey가 있으면 서명이 맞아야만 믿는다.
async function fetchIndex({ fetchFn, url, pubkey }) {
  const res = await fetchFn(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('팩 목록을 받지 못했어요 (' + res.status + ')');
  const bytes = Buffer.from(await res.arrayBuffer());
  let verified = false;
  if (pubkey) {
    const sres = await fetchFn(url + '.sig', { cache: 'no-store' });
    if (!sres.ok) throw new Error('목록 서명이 없어요');
    verified = verifySig(bytes, await sres.text(), pubkey);
    if (!verified) throw new Error('목록 서명이 맞지 않아요. 받지 않았어요.');
  }
  const index = JSON.parse(bytes.toString('utf8'));
  return { index, verified };
}

function hashFile(file) {
  try { return sha256(fs.readFileSync(file)); } catch (e) { return null; }
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

async function pool(items, n, fn) {
  let i = 0;
  const run = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
}

/**
 * files 목록대로 destDir를 새로 만든다.
 * entry = { base, files: [{path, sha256, size}] }
 * reuseDirs = 같은 파일이 있으면 복사해서 재사용할 폴더들 (기존 설치본 등)
 */
async function syncDir({ fetchFn, entry, destDir, reuseDirs, onProgress, concurrency }) {
  const files = entry.files || [];
  if (!files.every(f => safeRel(f.path) && /^[0-9a-f]{64}$/.test(f.sha256 || ''))) throw new Error('목록의 파일 정보가 올바르지 않아요');
  const tmp = destDir + '.tmp-' + Date.now();
  rmrf(tmp);
  fs.mkdirSync(tmp, { recursive: true });
  const total = files.reduce((a, f) => a + (f.size || 0), 0);
  let doneFiles = 0, doneBytes = 0, reused = 0, downloaded = 0;
  const tick = (file) => { doneFiles++; if (onProgress) onProgress({ done: doneFiles, total: files.length, bytesDone: doneBytes, bytesTotal: total, file }); };
  try {
    await pool(files, concurrency || 4, async (f) => {
      const dest = path.join(tmp, f.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      for (const dir of reuseDirs || []) {
        const src = path.join(dir, f.path);
        if (fs.existsSync(src) && hashFile(src) === f.sha256) {
          fs.copyFileSync(src, dest);
          reused++; doneBytes += f.size || 0; tick(f.path);
          return;
        }
      }
      const res = await fetchFn(new URL(f.path.split('/').map(encodeURIComponent).join('/'), entry.base).href, { cache: 'no-store' });
      if (!res.ok) throw new Error(f.path + ' 받기 실패 (' + res.status + ')');
      const buf = Buffer.from(await res.arrayBuffer());
      if (sha256(buf) !== f.sha256) throw new Error(f.path + ' 내용이 목록과 달라요 (받다가 깨졌거나 바뀌었어요)');
      fs.writeFileSync(dest, buf);
      downloaded++; doneBytes += buf.length; tick(f.path);
    });
    // 교체: 기존 → .prev, 새것 → 제자리
    const prev = destDir + '.prev';
    let moved = false;
    if (fs.existsSync(destDir)) { rmrf(prev); fs.renameSync(destDir, prev); moved = true; }
    try { fs.renameSync(tmp, destDir); }
    catch (e) { if (moved) fs.renameSync(prev, destDir); throw e; }
    return { reused, downloaded, files: files.length };
  } catch (e) {
    rmrf(tmp);
    throw e;
  }
}

module.exports = { sha256, cmpVer, safeRel, verifySig, signBytes, fetchIndex, syncDir, hashFile, rmrf };
