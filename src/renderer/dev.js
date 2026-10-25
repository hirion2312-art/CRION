// 개발자(히리온) 전용: 비밀번호로 잠근 GitHub 열쇠 + 작품 목록 고치기
//  - 비밀번호는 어디에도 저장하지 않는다. GitHub 열쇠(토큰)를 비밀번호로 암호화해 이 컴퓨터에만 둔다(AES-GCM, PBKDF2).
//  - 실제로 고칠 수 있는 힘은 GitHub 열쇠에 있다 → 열쇠가 없는 다른 사람은 비밀번호 창을 봐도 아무것도 못 한다.
//  - 고친 내용은 저장소 config/works.json 에 올라가고, 1~2분 뒤 업데이트 서버를 거쳐 모든 사람 앱에 반영된다.
(function (root) {
  'use strict';
  const KEY = 'crion.dev.vault';
  const OWNER = 'hirion2312-art', REPO = 'CRION', BRANCH = 'main';
  const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
  const ITER = 210000;
  const C = () => (root.crypto && root.crypto.subtle) ? root.crypto : require('crypto').webcrypto;
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = (u8) => { let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function keyFrom(password, salt) {
    const c = C();
    const base = await c.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
    return c.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  function Vault(storage) { this.s = storage || null; }
  Vault.prototype.exists = function () { try { return !!(this.s && this.s.getItem(KEY)); } catch (e) { return false; } };
  Vault.prototype.save = async function (token, password) {
    if (!token || String(password || '').length < 4) throw new Error('비밀번호는 4자 이상');
    const c = C();
    const salt = c.getRandomValues(new Uint8Array(16)), iv = c.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), te.encode(token)));
    this.s.setItem(KEY, JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
  };
  // 비밀번호가 틀리면 Error('wrong')
  Vault.prototype.open = async function (password) {
    const v = JSON.parse(this.s.getItem(KEY) || 'null');
    if (!v) throw new Error('none');
    try {
      const pt = await C().subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, await keyFrom(password, unb64(v.salt)), unb64(v.ct));
      return td.decode(pt);
    } catch (e) { throw new Error('wrong'); }
  };
  Vault.prototype.clear = function () { try { this.s.removeItem(KEY); } catch (e) { /* 무시 */ } };

  // ---------- GitHub ----------
  const enc = (str) => b64(te.encode(str));
  const dec = (s) => td.decode(unb64(String(s).replace(/\n/g, '')));
  function Repo(token, fetchFn) { this.t = token; this.f = fetchFn || root.fetch.bind(root); }
  Repo.prototype.gh = async function (path, opts) {
    const res = await this.f(API + path, Object.assign({}, opts, {
      headers: { Authorization: 'Bearer ' + this.t, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    }));
    if (!res.ok) {
      let msg = String(res.status);
      try { msg += ' ' + (await res.json()).message; } catch (e) { /* 무시 */ }
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  };
  // 열쇠 확인: 저장소를 고칠 권한이 있어야 한다
  Repo.prototype.check = async function () {
    const r = await this.gh('');
    if (!r.permissions || !r.permissions.push) throw new Error('nopush');
    return r.full_name;
  };
  Repo.prototype.get = async function (p) {
    const r = await this.gh('/contents/' + encodeURI(p) + '?ref=' + BRANCH + '&t=' + Date.now());
    return { text: dec(r.content), sha: r.sha };
  };
  Repo.prototype.put = async function (p, contentB64, message, sha) {
    const body = { message, content: contentB64, branch: BRANCH };
    if (sha) body.sha = sha;
    return this.gh('/contents/' + encodeURI(p), { method: 'PUT', body: JSON.stringify(body) });
  };
  Repo.prototype.shaOf = async function (p) { try { return (await this.gh('/contents/' + encodeURI(p) + '?ref=' + BRANCH)).sha; } catch (e) { return null; } };
  Repo.prototype.loadWorks = async function () {
    const f = await this.get('config/works.json');
    const data = JSON.parse(f.text);
    data.works = Array.isArray(data.works) ? data.works : [];
    data.hidden = Array.isArray(data.hidden) ? data.hidden : [];
    return { data, sha: f.sha };
  };
  Repo.prototype.saveWorks = async function (data, sha, message) {
    const r = await this.put('config/works.json', enc(JSON.stringify(data, null, 2) + '\n'), message, sha);
    return r.content.sha;
  };
  Repo.prototype.lastDeploy = async function () {
    const r = await this.gh('/actions/runs?per_page=5&branch=' + BRANCH);
    const run = (r.workflow_runs || []).find(x => /업데이트 배포|registry/i.test(x.name + x.path));
    return run ? { status: run.status, conclusion: run.conclusion, at: run.created_at } : null;
  };

  // ---------- 목록 고치기 (순수 함수 · 시험 가능) ----------
  const isCrackUrl = (u) => /^https:\/\/([a-z0-9-]+\.)*wrtn\.ai\/\S+$/i.test(String(u || '').trim());
  function newId(name, taken) {
    const base = 'w' + Date.now().toString(36);
    let id = base, n = 1;
    while (taken.has(id)) id = base + (n++);
    return id;
  }
  // w: {name, url, genre, desc, guide, featured}  → 검사 후 맨 앞(또는 원래 자리)에 넣는다
  function upsert(data, w) {
    const name = String(w.name || '').trim();
    const url = String(w.url || '').trim();
    if (!name) throw new Error('작품 이름을 적어 주세요');
    if (url && !isCrackUrl(url)) throw new Error('크랙 작품 주소(https://…wrtn.ai/…)를 넣어 주세요');
    const dup = data.works.find(x => x.id !== w.id && url && x.url && x.url.replace(/\/$/, '') === url.replace(/\/$/, ''));
    if (dup) throw new Error(`이미 「${dup.name}」에 같은 주소가 있어요`);
    const clean = { name, url, genre: String(w.genre || '').trim() };
    for (const k of ['desc', 'guide']) { const v = String(w[k] || '').replace(/\s+$/, ''); if (v) clean[k] = v; }
    if (w.adult) clean.adult = true;
    let item = w.id && data.works.find(x => x.id === w.id);
    if (item) {
      Object.assign(item, clean);
      if (!clean.desc) delete item.desc;
      if (!clean.guide) delete item.guide;
      if (!clean.adult) delete item.adult;
    } else {
      item = Object.assign({ id: newId(name, new Set(data.works.map(x => x.id))) }, clean, { thumb: '' });
      data.works.unshift(item);
    }
    if (w.thumb !== undefined) item.thumb = w.thumb;
    if (w.featured) { data.works.forEach(x => { delete x.featured; }); item.featured = true; } else delete item.featured;
    return item;
  }
  function remove(data, id) {
    const i = data.works.findIndex(x => x.id === id);
    if (i < 0) return null;
    const [w] = data.works.splice(i, 1);
    if (w.url) data.hidden = data.hidden.filter(u => u !== w.url);
    return w;
  }
  function move(data, id, d) {
    const i = data.works.findIndex(x => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= data.works.length) return false;
    [data.works[i], data.works[j]] = [data.works[j], data.works[i]];
    return true;
  }
  function toggleHide(data, id) {
    const w = data.works.find(x => x.id === id);
    if (!w || !w.url) throw new Error('주소가 있는 작품만 숨길 수 있어요');
    const on = data.hidden.includes(w.url);
    data.hidden = on ? data.hidden.filter(u => u !== w.url) : data.hidden.concat(w.url);
    return !on;
  }

  const api = { Vault, Repo, upsert, remove, move, toggleHide, isCrackUrl, enc, dec };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionDev = api;
})(typeof window !== 'undefined' ? window : globalThis);
