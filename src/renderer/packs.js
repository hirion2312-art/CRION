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
  function fromIndex(index) {
    const list = (index && Array.isArray(index.packs)) ? index.packs : [];
    return list.filter(p => p && p.id && p.name && isHttps(p.base)).map(p => {
      const at = (f) => (f && !/^[a-z]+:/i.test(f) && !f.includes('..')) ? p.base + String(f).replace(/^\/+/, '') : (isHttps(f) ? f : '');
      return {
        id: String(p.id), name: String(p.name), version: String(p.version || '0.0.0'),
        summary: String(p.summary || ''), desc: String(p.desc || ''), author: String(p.author || '히리온'),
        tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 6) : [],
        workId: p.workId ? String(p.workId) : '', workUrl: p.workUrl ? String(p.workUrl) : '',
        cover: at(p.cover), previews: (Array.isArray(p.previews) ? p.previews : []).map(at).filter(Boolean).slice(0, 8),
        ui: at(p.ui), minEngine: p.minEngine || null, bytes: Number(p.bytes) || 0, updated: p.updated || '',
        workName: p.workName ? String(p.workName) : '', runner: p.runner ? String(p.runner) : '',
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
      packs.find(p => p.workName && work.name && nm(work.name).includes(nm(p.workName))) || null;
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

  const api = { fromIndex, compatible, forWork, Installed, filter, cmpVer };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionPacks = api;
})(typeof window !== 'undefined' ? window : globalThis);
