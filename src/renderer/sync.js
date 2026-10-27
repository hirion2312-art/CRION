// 플레이 기록 동기화: CRION 계정으로 로그인하면 컴퓨터·폰 어디서 켜도 같은 기록
//  - 대상: 내 기록(crion.w.*), 플레이팩 세이브·도감·인물(crion.pk.*), 화면 취향(crion.prefs), 닉네임(crion.nick),
//          이어하기 주소·최근 플레이(앱 설정의 workUrls·recent → 'settings:play')
//  - 칸(키) 하나 = 서버 한 줄. 바뀐 칸만 올리고, 서버에서 바뀐 칸만 받는다 (서버 시각 기준 커서)
//  - 양쪽이 동시에 바꾼 칸만 합친다: 내 기록은 큰 값·합집합, 세이브는 id 별로 최근 것, 나머지는 나중에 바뀐 쪽
//  - 플레이 중에는 받기만 미루고(화면이 쓰는 값과 부딪히지 않게) 올리기는 한다
(function (root) {
  'use strict';
  const STATE = 'crion.sync.state';
  const VIRTUAL = 'settings:play';
  const SYNCED = /^crion\.(w\.|pk\.|prefs$|nick$)/;
  const MAX_RAW = 280000;

  function hash(s) {
    let h = 5381;
    s = String(s);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ':' + s.length;
  }
  const parse = (raw) => { try { return JSON.parse(raw); } catch (e) { return undefined; } };
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  // ---------- 합치기 (양쪽이 동시에 바뀐 칸) ----------
  function mergeRecord(a, b) {          // 내 기록 한 작품: 셈은 큰 쪽, 모음은 합집합
    const o = Object.assign({}, b, a);
    for (const k of ['turns', 'opens', 'playMs', 'lastAt']) o[k] = Math.max(a[k] || 0, b[k] || 0);
    o.firstAt = Math.min(a.firstAt || Infinity, b.firstAt || Infinity); if (!isFinite(o.firstAt)) o.firstAt = 0;
    o.chars = Object.assign({}, b.chars || {});
    for (const [n, c] of Object.entries(a.chars || {})) { const d = o.chars[n]; o.chars[n] = !d || (c.lines || 0) >= (d.lines || 0) ? c : d; }
    const uni = (x, y, keyOf, cap) => { const seen = new Set(); const out = []; for (const it of (x || []).concat(y || [])) { const k = keyOf(it); if (seen.has(k)) continue; seen.add(k); out.push(it); } return out.slice(-cap); };
    o.album = uni(b.album, a.album, (it) => (it && (it.src || it.url)) || JSON.stringify(it), 150);
    o.quotes = uni(b.quotes, a.quotes, (it) => (it && (it.text || it.t)) || JSON.stringify(it), 200);
    o.quick = a.quick || b.quick || null;
    return o;
  }
  function mergeSaves(a, b) {           // 세이브 목록: id 별로 더 최근(last) 것
    const m = new Map();
    for (const s of (b || []).concat(a || [])) {
      if (!s || !s.id) continue;
      const p = m.get(s.id);
      if (!p || (s.last || s.created || 0) >= (p.last || p.created || 0)) m.set(s.id, s);
    }
    return Array.from(m.values()).sort((x, y) => (x.created || 0) - (y.created || 0));
  }
  function mergePlay(a, b) {            // 이어하기 주소·최근 플레이: 합치고 이 기기 쪽 우선
    return {
      workUrls: Object.assign({}, (b && b.workUrls) || {}, (a && a.workUrls) || {}),
      recent: Array.from(new Set([].concat((a && a.recent) || [], (b && b.recent) || []))).slice(0, 8)
    };
  }
  // 그 밖의 칸(도감·인물 기억, 설정 등): 둘 다 남기고, 같은 항목은 이 기기 값
  function deepMerge(b, a) {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.concat(b).every(x => isObj(x) && x.id != null)) return mergeSaves(a, b);
      return a;
    }
    if (!isObj(a) || !isObj(b)) return a === undefined ? b : a;
    const o = Object.assign({}, b);
    for (const [k, v] of Object.entries(a)) o[k] = k in b ? deepMerge(b[k], v) : v;
    return o;
  }
  // 양쪽이 동시에 바꾼 칸. local·server 는 원문 문자열(없으면 null = 지움)
  function merge(key, local, server) {
    if (server == null) return local;       // 저쪽이 지웠고 이쪽이 고쳤으면 살린다
    if (local == null) return server;       // 이쪽이 지웠어도 저쪽이 새로 고쳤으면 살린다
    const a = parse(local), b = parse(server);
    if (a === undefined || b === undefined) return local;
    if (key === VIRTUAL && isObj(a) && isObj(b)) return JSON.stringify(mergePlay(a, b));
    if (/^crion\.w\./.test(key) && isObj(a) && isObj(b)) return JSON.stringify(mergeRecord(a, b));
    if (/^crion\.pk\..*\.saves\./.test(key) && Array.isArray(a) && Array.isArray(b)) return JSON.stringify(mergeSaves(a, b));
    return JSON.stringify(deepMerge(b, a));
  }

  // ---------- 동기화기 ----------
  // o: { storage, cloud(accountUid·syncPull·syncPush), getSettings(), setSettings(patch), device, now }
  function Sync(o) {
    this.o = o;
    this.ls = o.storage;
    this.now = o.now || (() => Date.now());
    this.busy = false; this.lastAt = 0; this.err = ''; this.lastResult = null;
  }
  Sync.prototype._state = function (uid) {
    let s = null;
    try { s = JSON.parse(this.ls.getItem(STATE) || 'null'); } catch (e) { s = null; }
    if (!s || s.uid !== uid) s = { uid, cursor: '', hashes: {}, seen: {} };
    if (!s.seen) s.seen = {};
    return s;
  };
  Sync.prototype._saveState = function (s) { try { this.ls.setItem(STATE, JSON.stringify(s)); } catch (e) { /* 저장 안 됨 */ } };
  Sync.prototype.forget = function () { try { this.ls.removeItem(STATE); } catch (e) { /* 없음 */ } this.lastAt = 0; this.lastResult = null; };
  Sync.prototype._readAll = function () {
    const out = {};
    for (let i = 0; i < this.ls.length; i++) {
      const k = this.ls.key(i);
      if (k && SYNCED.test(k)) out[k] = this.ls.getItem(k);
    }
    const st = (this.o.getSettings && this.o.getSettings()) || {};
    out[VIRTUAL] = JSON.stringify({ workUrls: st.workUrls || {}, recent: st.recent || [] });
    return out;
  };
  Sync.prototype._write = async function (key, raw) {
    if (key === VIRTUAL) {
      const v = parse(raw) || {};
      if (this.o.setSettings) await this.o.setSettings({ workUrls: v.workUrls || {}, recent: v.recent || [] });
      return;
    }
    try { if (raw == null) this.ls.removeItem(key); else this.ls.setItem(key, raw); } catch (e) { /* 저장 공간 부족 */ }
  };

  // opt.pull === false 면 받기는 건너뛴다 (플레이 중)
  Sync.prototype.run = async function (opt) {
    opt = opt || {};
    const cloud = this.o.cloud;
    const uid = cloud && cloud.accountUid && cloud.accountUid();
    if (!uid) return null;
    if (this.busy) return null;
    this.busy = true; this.err = '';
    const res = { pulled: 0, pushed: 0, merged: 0, skipped: 0, keys: [] };
    try {
      const st = this._state(uid);
      const local = this._readAll();
      const dirty = new Set();
      for (const [k, raw] of Object.entries(local)) {
        if (st.hashes[k] !== hash(raw)) dirty.add(k);
      }
      for (const k of Object.keys(st.hashes)) {
        if (!(k in local) && st.hashes[k] !== 'DEL') { dirty.add(k); local[k] = null; }
      }
      // 받기
      if (opt.pull !== false) {
        let cursor = st.cursor;
        for (let page = 0; page < 20; page++) {
          const rows = await cloud.syncPull(cursor);
          if (!rows || !rows.length) break;
          for (const row of rows) {
            const k = row.key;
            if (!cursor || row.updated_at > cursor) cursor = row.updated_at;
            if (st.seen[k] && row.updated_at <= st.seen[k]) continue;   // 이미 아는 값 (내가 올린 것 포함)
            st.seen[k] = row.updated_at;
            const srv = row.deleted || !row.val || typeof row.val.raw !== 'string' ? null : row.val.raw;
            const cur = k in local ? local[k] : null;
            if (!dirty.has(k)) {
              if (cur !== srv) { await this._write(k, srv); res.pulled++; res.keys.push(k); }
              local[k] = srv;
              st.hashes[k] = srv == null ? 'DEL' : hash(srv);
            } else {
              const m = merge(k, cur, srv);
              if (m !== cur) { await this._write(k, m); res.keys.push(k); }
              local[k] = m;
              res.merged++;
              if (m === srv) { dirty.delete(k); st.hashes[k] = srv == null ? 'DEL' : hash(srv); }
            }
          }
          if (rows.length < 500) break;
        }
        st.cursor = cursor;
      }
      // 올리기
      const up = [];
      for (const k of dirty) {
        const raw = local[k];
        if (raw != null && raw.length > MAX_RAW) { res.skipped++; continue; }
        up.push({ key: k, val: raw == null ? null : { raw }, deleted: raw == null, device: String(this.o.device || '').slice(0, 60) });
      }
      for (let i = 0; i < up.length; i += 100) {
        const part = up.slice(i, i + 100);
        const back = await cloud.syncPush(part);
        const at = new Map((Array.isArray(back) ? back : []).map(x => [x.key, x.updated_at]));
        for (const r of part) { st.hashes[r.key] = r.deleted ? 'DEL' : hash(r.val.raw); if (at.get(r.key)) st.seen[r.key] = at.get(r.key); }
        res.pushed += part.length;
      }
      this._saveState(st);
      this.lastAt = this.now(); this.lastResult = res;
      return res;
    } catch (e) {
      this.err = (e && e.message) || '동기화하지 못했어요';
      throw e;
    } finally { this.busy = false; }
  };

  const api = { Sync, merge, mergeRecord, mergeSaves, mergePlay, hash, SYNCED, VIRTUAL };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
