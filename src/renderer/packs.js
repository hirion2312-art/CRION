// 스토어: 플레이팩(작품 전용 플레이 화면) 목록 · 설치 상태
//  목록은 업데이트 서버 index.json 의 packs (scripts/make-registry.js 가 packs/<id>/manifest.json 으로 만든다)
//  설치 상태는 이 컴퓨터에만 저장 (crion.packs)
(function (root) {
  'use strict';
  const KEY = 'crion.packs';
  const isHttps = (u) => /^https:\/\//.test(String(u || ''));

  function cmpVer(a, b) {
    const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
    for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  }

  // index.json 의 팩 항목 → 화면에 쓰기 좋은 모양 (주소는 https 만)
  //  opt.dev = 개발자 로그인 중이면 index.devPacks(개발자 전용 팩)도 합친다 (devOnly 표시)
  function fromIndex(index, opt) {
    const main = (index && Array.isArray(index.packs)) ? index.packs : [];
    const dev = (opt && opt.dev && index && Array.isArray(index.devPacks)) ? index.devPacks.map(p => Object.assign({}, p, { devOnly: true })) : [];
    const seen = new Set();
    const list = main.concat(dev).filter(p => p && p.id && !seen.has(p.id) && seen.add(p.id));
    return list.filter(p => p && p.id && p.name && isHttps(p.base)).map(p => {
      const at = (f) => (f && !/^[a-z]+:/i.test(f) && !f.includes('..')) ? p.base + String(f).replace(/^\/+/, '') : (isHttps(f) ? f : '');
      return {
        id: String(p.id), name: String(p.name), version: String(p.version || '0.0.0'),
        summary: String(p.summary || ''), desc: String(p.desc || ''), author: String(p.author || '히리온'),
        tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 6) : [],
        workId: p.workId ? String(p.workId) : '', workUrl: p.workUrl ? String(p.workUrl) : '',
        cover: at(p.cover), coverVideo: at(p.coverVideo), previews: (Array.isArray(p.previews) ? p.previews : []).map(at).filter(Boolean).slice(0, 8),
        ui: at(p.ui), minEngine: p.minEngine || null, bytes: Number(p.bytes) || 0, updated: p.updated || '',
        workName: p.workName ? String(p.workName) : '', runner: p.runner ? String(p.runner) : '', adult: !!p.adult, devOnly: !!p.devOnly, standalone: !!p.standalone, soon: p.soon ? (typeof p.soon === 'string' ? p.soon : '준비 중') : '', soonNote: p.soonNote ? String(p.soonNote) : '',
        base: String(p.base), rev: String(p.rev || ''),
        files: (Array.isArray(p.files) ? p.files : []).filter(f => f && typeof f.path === 'string' && /^[0-9a-f]{64}$/.test(String(f.sha256 || '')) && !f.path.includes('..') && !/^[a-z]+:/i.test(f.path) && !f.path.startsWith('/'))
          .map(f => ({ path: f.path, sha256: f.sha256, size: Number(f.size) || 0 }))
      };
    });
  }

  const compatible = (pack, engineVersion) => !pack.minEngine || cmpVer(engineVersion, pack.minEngine) >= 0;

  function sameUrl(a, b) {
    try { const x = new URL(a), y = new URL(b); return (x.host + x.pathname).replace(/\/$/, '') === (y.host + y.pathname).replace(/\/$/, ''); } catch (e) { return false; }
  }
  // 이 작품용 팩 (작품 id 또는 주소로 연결)
  function forWork(packs, work) {
    if (!work) return null;
    const nm = (s) => String(s || '').replace(/\s+/g, '');
    return packs.find(p => (p.workId && p.workId === work.id) || (p.workUrl && work.url && sameUrl(p.workUrl, work.url))) ||
      packs.filter(p => p.workName && work.name && nm(work.name).includes(nm(p.workName))).sort((a, b) => nm(b.workName).length - nm(a.workName).length)[0] || null;
  }

  // 다른 팩(작품)의 크랙 주소가 이 팩의 '작품 화면 주소·세이브'로 잘못 기억된 것을 정리한다.
  //  (앞 작품 화면의 신호가 새 작품으로 섞이던 예전 버그가 남긴 잔여물 — 안전지대를 열면 소환수 아카데미 대화가 열리던 원인)
  //  작품마다 크랙 주소는 달라야 하므로, 이 팩의 주소가 다른 팩에도 있으면 이 팩 쪽을 지운다. 지운 개수를 돌려준다
  function cleanForeignUrls(storage, packId) {
    if (!storage || !packId) return 0;
    const norm = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, ''); } catch (e) { return String(u || ''); } };
    const mine = 'crion.pk.' + packId + '.';
    const keys = [];
    try { for (let i = 0; i < storage.length; i++) keys.push(storage.key(i)); } catch (e) { return 0; }
    const rd = (k) => { try { return JSON.parse(storage.getItem(k)); } catch (e) { return null; } };
    const foreign = new Set();
    const own = [];
    for (const k of keys) {
      const m = /^crion\.pk\.(.+?)\.(detail|saves)\.(.+)$/.exec(k || '');
      if (!m) continue;
      if (k.startsWith(mine)) { own.push([k, m[2]]); continue; }
      const v = rd(k);
      if (m[2] === 'detail' && typeof v === 'string' && v) foreign.add(norm(v));
      else if (m[2] === 'saves' && Array.isArray(v)) v.forEach(x => { if (x && x.url) foreign.add(norm(x.url)); });
    }
    let n = 0;
    for (const [k, kind] of own) {
      const v = rd(k);
      if (kind === 'detail') {
        if (typeof v === 'string' && v && foreign.has(norm(v))) { try { storage.removeItem(k); n++; } catch (e) { /* 안 지워짐 */ } }
      } else if (Array.isArray(v)) {
        let ch = 0;
        v.forEach(x => { if (x && x.url && foreign.has(norm(x.url))) { x.url = ''; ch++; } });   // 세이브는 남기고 잘못된 대화 연결만 끊는다 ('대화 연결 전' 표시)
        if (ch) { try { storage.setItem(k, JSON.stringify(v)); n += ch; } catch (e) { /* 안 저장됨 */ } }
      }
    }
    return n;
  }

  function Installed(storage) { this.s = storage || null; this.m = null; }
  Installed.prototype.all = function () {
    if (this.m) return this.m;
    try { this.m = JSON.parse((this.s && this.s.getItem(KEY)) || '{}') || {}; } catch (e) { this.m = {}; }
    return this.m;
  };
  Installed.prototype.save = function () { try { if (this.s) this.s.setItem(KEY, JSON.stringify(this.all())); } catch (e) { /* 저장 안 됨 */ } };
  Installed.prototype.has = function (id) { return !!this.all()[id]; };
  Installed.prototype.version = function (id) { const v = this.all()[id]; return v ? v.version : null; };
  Installed.prototype.install = function (pack, now) { const was = this.all()[pack.id]; this.all()[pack.id] = { version: pack.version, rev: pack.rev || '', at: now || Date.now(), on: was ? was.on !== false : true }; this.save(); };
  Installed.prototype.remove = function (id) { delete this.all()[id]; this.save(); };
  Installed.prototype.needsUpdate = function (pack) { const v = this.all()[pack.id]; if (!v) return false; return cmpVer(pack.version, v.version) > 0 || (!!pack.rev && !!v.rev && pack.rev !== v.rev); };
  Installed.prototype.isOn = function (id) { const v = this.all()[id]; return !!v && v.on !== false; };
  Installed.prototype.setOn = function (id, on) { const v = this.all()[id]; if (v) { v.on = !!on; this.save(); } };

  // 스토어 화면 거르기: 탭(all/installed/update) + 검색어
  function filter(packs, opt, inst) {
    const q = String((opt && opt.q) || '').trim().toLowerCase();
    const tab = (opt && opt.tab) || 'all';
    return packs.filter(p => {
      if (tab === 'installed' && !inst.has(p.id)) return false;
      if (tab === 'update' && !inst.needsUpdate(p)) return false;
      if (!q) return true;
      return [p.name, p.summary, p.desc, p.tags.join(' ')].join(' ').toLowerCase().includes(q);
    });
  }

  const api = { fromIndex, compatible, forWork, Installed, filter, cmpVer, cleanForeignUrls };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionPacks = api;
})(typeof window !== 'undefined' ? window : globalThis);
