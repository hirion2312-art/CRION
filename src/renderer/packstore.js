// 플레이팩 파일 받기 · 저장 (이 컴퓨터의 IndexedDB) — 앱 본체(껍데기)를 바꾸지 않고 화면 엔진 안에서 처리
//  - 받기: 업데이트 서버 index.json 의 팩 파일 목록(path·sha256·size)을 하나씩 받아 sha256 을 확인하고 저장
//  - 업데이트: 바뀐 파일만 다시 받고, 없어진 파일은 지운다
//  - 플레이: 저장된 파일을 blob 주소로 꺼내 쓴다. 저장이 안 되는 환경이면 서버 주소를 그대로 쓴다(온라인 재생)
(function (root) {
  'use strict';
  const DB = 'crion-packs', VER = 1;
  const safe = (p) => typeof p === 'string' && p && !p.startsWith('/') && !p.includes('..') && !/^[a-z]+:/i.test(p) && !p.includes('\\');

  // 받을 파일 계산 (시험 가능한 순수 함수)
  function plan(oldFiles, newFiles) {
    const old = new Map((oldFiles || []).map(f => [f.path, f.sha256]));
    const keep = new Set((newFiles || []).map(f => f.path));
    const get = (newFiles || []).filter(f => safe(f.path) && old.get(f.path) !== f.sha256);
    const drop = (oldFiles || []).map(f => f.path).filter(p => !keep.has(p));
    return { get, drop, bytes: get.reduce((a, f) => a + (Number(f.size) || 0), 0) };
  }

  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!root.indexedDB) { reject(new Error('no-idb')); return; }
      const r = root.indexedDB.open(DB, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('idb'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  function req(store, mode, fn) {
    return db().then(d => new Promise((resolve, reject) => {
      const tx = d.transaction(store, mode);
      const s = tx.objectStore(store);
      const out = fn(s);
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('abort'));
    }));
  }
  const getMeta = (id) => req('meta', 'readonly', s => s.get(id)).catch(() => null);

  async function sha256(buf) {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', json: 'application/json', mp3: 'audio/mpeg', ogg: 'audio/ogg', webm: 'video/webm', html: 'text/html', css: 'text/css', txt: 'text/plain', glb: 'model/gltf-binary' };
  const typeOf = (p) => TYPES[String(p).split('.').pop().toLowerCase()] || 'application/octet-stream';

  // pack = { id, version, rev, base, files:[{path, sha256, size}] }
  async function install(pack, onProgress, opt) {
    if (!pack || !pack.files || !pack.files.length) throw new Error('파일 목록이 없어요');
    const fetchFn = (opt && opt.fetch) || root.fetch.bind(root);
    const meta = await getMeta(pack.id);
    const p = plan(meta && meta.files, pack.files);
    let done = 0, n = 0;
    const total = p.bytes || 1;
    const report = () => { if (onProgress) onProgress({ done, total, files: n, count: p.get.length }); };
    report();
    const queue = p.get.slice();
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        let buf = null, err = null;
        for (let k = 0; k < 3 && !buf; k++) {
          try {
            const res = await fetchFn(pack.base + f.path.split('/').map(encodeURIComponent).join('/') + '?v=' + f.sha256.slice(0, 8), { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const b = await res.arrayBuffer();
            if (await sha256(b) !== f.sha256) throw new Error('파일이 깨졌어요: ' + f.path);
            buf = b;
          } catch (e) { err = e; }
        }
        if (!buf) throw err || new Error('받지 못했어요: ' + f.path);
        await req('files', 'readwrite', s => s.put(new Blob([buf], { type: typeOf(f.path) }), pack.id + '/' + f.path));
        done += Number(f.size) || buf.byteLength; n++;
        report();
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (p.drop.length) await req('files', 'readwrite', s => { p.drop.forEach(path => s.delete(pack.id + '/' + path)); });
    await req('meta', 'readwrite', s => s.put({ id: pack.id, version: pack.version, rev: pack.rev || '', base: pack.base, files: pack.files, at: Date.now() }, pack.id));
    return { got: p.get.length, dropped: p.drop.length, bytes: done };
  }

  async function remove(id) {
    const meta = await getMeta(id);
    if (meta) await req('files', 'readwrite', s => { (meta.files || []).forEach(f => s.delete(id + '/' + f.path)); });
    await req('meta', 'readwrite', s => s.delete(id)).catch(() => {});
  }

  // 저장된 팩이 서버 것과 같은지 (rev 비교)
  async function state(pack) {
    const meta = await getMeta(pack.id);
    if (!meta) return 'none';
    return meta.rev && pack.rev && meta.rev !== pack.rev ? 'old' : 'ok';
  }

  // 팩 파일 주소 모음: 저장돼 있으면 blob 주소, 아니면 서버 주소
  const opened = {};
  async function open(pack) {
    if (opened[pack.id] && opened[pack.id].rev === pack.rev) return opened[pack.id];
    if (opened[pack.id]) Object.values(opened[pack.id].urls).forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
    const files = pack.files || [];
    const urls = {};
    let local = 0;
    const meta = await getMeta(pack.id);
    const blobs = meta ? await db().then(d => new Promise((resolve) => {
      const out = {};
      const tx = d.transaction('files', 'readonly');
      const s = tx.objectStore('files');
      files.forEach(f => { const r = s.get(pack.id + '/' + f.path); r.onsuccess = () => { if (r.result) out[f.path] = r.result; }; });
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => resolve(out);
    })).catch(() => ({})) : {};
    for (const f of files) {
      if (!safe(f.path)) continue;
      if (blobs[f.path]) { urls[f.path] = URL.createObjectURL(blobs[f.path]); local++; }
      else urls[f.path] = pack.base + f.path.split('/').map(encodeURIComponent).join('/') + '?v=' + String(f.sha256 || '').slice(0, 8);
    }
    const o = {
      rev: pack.rev, urls, local, total: files.length,
      url: (p) => urls[p] || '',
      has: (p) => !!urls[p],
      text: async (p) => { if (blobs[p]) return blobs[p].text(); const r = await fetch(urls[p], { cache: 'no-store' }); return r.text(); },
      json: async (p) => JSON.parse(await o.text(p))
    };
    opened[pack.id] = o;
    return o;
  }

  const api = { plan, install, remove, state, open, safe };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionPackStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
