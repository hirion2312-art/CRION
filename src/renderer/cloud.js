// 커뮤니티 · 신고함 서버(Supabase) 연결. 외부 라이브러리 없이 fetch로 REST만 쓴다.
//  - 팔로워: 가입 없이 '익명 로그인'으로 글·신고를 보낸다 (세션은 이 컴퓨터 localStorage)
//  - 히리온(관리자): 관리자 이메일·비밀번호로 로그인 → 신고함·게시판 관리 (세션은 메모리에만)
//  - url/anonKey 는 공개돼도 안전한 값. 권한은 서버(RLS, supabase/schema.sql)가 지킨다.
(function (root) {
  'use strict';
  const SKEY = 'crion.cloud.anon';
  const trim = (u) => String(u || '').replace(/\/+$/, '');
  const okCfg = (c) => !!(c && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(trim(c.url)) && String(c.anonKey || '').length > 20);

  function Cloud(cfg, opt) {
    opt = opt || {};
    this.cfg = okCfg(cfg) ? { url: trim(cfg.url), anonKey: String(cfg.anonKey).trim() } : null;
    this.f = opt.fetch || (root.fetch && root.fetch.bind(root));
    this.ls = opt.storage || null;
    this.now = opt.now || (() => Date.now());
    this.anon = null;   // 팔로워 세션
    this.admin = null;  // 관리자 세션 (메모리에만)
    this.adminEmail = '';
  }
  Cloud.prototype.enabled = function () { return !!this.cfg; };
  // 목록(catalog.json)에서 받은 주소·키를 적용. 바뀌면 예전 세션은 버린다
  Cloud.prototype.setConfig = function (cfg) {
    const n = okCfg(cfg) ? { url: trim(cfg.url), anonKey: String(cfg.anonKey).trim() } : null;
    if ((n && n.url) !== (this.cfg && this.cfg.url)) { this.anon = null; this.admin = null; try { if (this.ls) this.ls.removeItem(SKEY); } catch (e) { /* 무시 */ } }
    this.cfg = n;
  };

  Cloud.prototype._h = function (token, extra) {
    return Object.assign({ apikey: this.cfg.anonKey, Authorization: 'Bearer ' + (token || this.cfg.anonKey), 'Content-Type': 'application/json' }, extra || {});
  };
  Cloud.prototype._json = async function (res) {
    let j = null;
    try { j = await res.json(); } catch (e) { /* 빈 응답 */ }
    if (!res.ok) {
      const msg = (j && (j.message || j.msg || j.error_description || j.error)) || String(res.status);
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return j;
  };
  Cloud.prototype._store = function (s) {
    this.anon = s;
    try { if (this.ls) this.ls.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* 저장 안 됨 */ }
  };
  const sess = (j, now) => ({ access: j.access_token, refresh: j.refresh_token, exp: (j.expires_at ? j.expires_at * 1000 : now + (j.expires_in || 3600) * 1000), uid: j.user && j.user.id });

  Cloud.prototype._refresh = async function (s) {
    const j = await this._json(await this.f(this.cfg.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: this._h(), body: JSON.stringify({ refresh_token: s.refresh }) }));
    return sess(j, this.now());
  };
  // 익명 세션 확보 (없으면 만들고, 만료가 가까우면 갱신)
  Cloud.prototype.ensureUser = async function () {
    if (!this.cfg) throw new Error('서버가 아직 준비되지 않았어요');
    if (!this.anon) { try { this.anon = JSON.parse((this.ls && this.ls.getItem(SKEY)) || 'null'); } catch (e) { this.anon = null; } }
    if (this.anon && this.anon.exp - this.now() > 60000) return this.anon;
    if (this.anon && this.anon.refresh) {
      try { const s = await this._refresh(this.anon); this._store(s); return s; } catch (e) { /* 새로 만든다 */ }
    }
    const j = await this._json(await this.f(this.cfg.url + '/auth/v1/signup', { method: 'POST', headers: this._h(), body: JSON.stringify({ data: {} }) }));
    if (!j.access_token) throw new Error('서버에서 익명 로그인이 꺼져 있어요 (Allow anonymous sign-ins)');
    const s = sess(j, this.now());
    this._store(s);
    return s;
  };

  // 관리자 로그인: 이메일·비밀번호 + admins 표에 있어야 통과
  Cloud.prototype.adminLogin = async function (email, password) {
    if (!this.cfg) throw new Error('서버가 아직 준비되지 않았어요');
    let j;
    try {
      j = await this._json(await this.f(this.cfg.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: this._h(), body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') }) }));
    } catch (e) { throw new Error(e.status === 400 ? '이메일이나 비밀번호가 맞지 않아요' : e.message); }
    const s = sess(j, this.now());
    const rows = await this._json(await this.f(this.cfg.url + '/rest/v1/admins?select=uid', { headers: this._h(s.access) }));
    if (!Array.isArray(rows) || !rows.length) throw new Error('이 계정은 관리자로 등록되지 않았어요 (supabase/README.md 6번)');
    this.admin = s; this.adminEmail = String(email).trim();
    return true;
  };
  Cloud.prototype.adminLogout = function () { this.admin = null; };
  Cloud.prototype.isAdmin = function () { return !!this.admin; };
  Cloud.prototype._adminToken = async function () {
    if (!this.admin) throw new Error('관리자 로그인이 필요해요');
    if (this.admin.exp - this.now() < 60000) {
      try { this.admin = await this._refresh(this.admin); } catch (e) { this.admin = null; throw new Error('관리자 로그인이 끝났어요. 다시 로그인해 주세요'); }
    }
    return this.admin.access;
  };

  // REST. as: 'anon'(읽기 전용 공개) | 'user'(팔로워 익명) | 'admin'
  Cloud.prototype.rest = async function (method, path, o) {
    o = o || {};
    if (!this.cfg) throw new Error('서버가 아직 준비되지 않았어요');
    let token;
    if (o.as === 'admin') token = await this._adminToken();
    else if (o.as === 'user') token = (await this.ensureUser()).access;
    else token = this.admin ? await this._adminToken().catch(() => null) : null;  // 읽기: 관리자면 숨긴 글도 보임
    const headers = this._h(token, o.prefer ? { Prefer: o.prefer } : null);
    const res = await this.f(this.cfg.url + '/rest/v1/' + path, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
    return this._json(res);
  };

  // ---------- 신고 ----------
  const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
  Cloud.prototype.submitReport = async function (kind, f, ctx, diagText) {
    const row = {
      kind, title: clip(f.title || f.body, 120) || '(제목 없음)', body: clip(f.body, 4000) || '(내용 없음)',
      steps: clip(f.steps, 1500) || null, work: clip(f.work, 200) || null, nick: clip(f.nick, 30) || null,
      app: ctx ? clip(`앱 ${ctx.app || '-'} · 엔진 ${ctx.engine || '-'} · ${ctx.os || '-'}`, 200) : null,
      diag: diagText ? clip(diagText, 12000) : null
    };
    await this.rest('POST', 'reports', { as: 'user', body: row, prefer: 'return=minimal' });
    return true;
  };
  Cloud.prototype.myReports = async function () {
    const s = await this.ensureUser();
    return this.rest('GET', `reports?select=id,created_at,kind,title,status,reply&uid=eq.${s.uid}&order=created_at.desc&limit=30`, { as: 'user' });
  };
  Cloud.prototype.listReports = function (q) {
    q = q || {};
    let p = 'reports?select=*&order=created_at.desc&limit=100';
    if (q.status && q.status !== 'all') p += '&status=eq.' + encodeURIComponent(q.status);
    if (q.kind && q.kind !== 'all') p += '&kind=eq.' + encodeURIComponent(q.kind);
    return this.rest('GET', p, { as: 'admin' });
  };
  Cloud.prototype.countNewReports = async function () {
    const r = await this.rest('GET', 'reports?select=id&status=eq.new&limit=100', { as: 'admin' });
    return Array.isArray(r) ? r.length : 0;
  };
  Cloud.prototype.updateReport = function (id, patch) {
    const p = {};
    if (patch.status) p.status = patch.status;
    if (patch.reply !== undefined) p.reply = clip(patch.reply, 1000) || null;
    p.updated_at = new Date(this.now()).toISOString();
    return this.rest('PATCH', 'reports?id=eq.' + Number(id), { as: 'admin', body: p, prefer: 'return=minimal' });
  };
  Cloud.prototype.deleteReport = function (id) { return this.rest('DELETE', 'reports?id=eq.' + Number(id), { as: 'admin', prefer: 'return=minimal' }); };

  // ---------- 게시판 ----------
  Cloud.prototype.listPosts = function (board) {
    let p = 'posts?select=id,created_at,board,title,nick,work,is_admin,pinned,hidden,comments(count)&order=pinned.desc,created_at.desc&limit=60';
    if (board && board !== 'all') p += '&board=eq.' + encodeURIComponent(board);
    return this.rest('GET', p, {});
  };
  Cloud.prototype.getPost = async function (id) {
    const n = Number(id);
    const [post, comments] = await Promise.all([
      this.rest('GET', `posts?select=*&id=eq.${n}`, {}),
      this.rest('GET', `comments?select=*&post_id=eq.${n}&order=created_at.asc&limit=200`, {})
    ]);
    return { post: (post || [])[0] || null, comments: comments || [] };
  };
  Cloud.prototype.addPost = function (f) {
    return this.rest('POST', 'posts', { as: 'user', prefer: 'return=representation', body: { board: f.board || 'free', title: clip(f.title, 80), body: clip(f.body, 3000), nick: clip(f.nick, 20), work: clip(f.work, 100) || null } });
  };
  Cloud.prototype.addComment = function (postId, f) {
    return this.rest('POST', 'comments', { as: this.admin ? 'admin' : 'user', prefer: 'return=minimal', body: { post_id: Number(postId), body: clip(f.body, 800), nick: clip(f.nick, 20) } });
  };
  Cloud.prototype.deletePost = function (id, asAdmin) { return this.rest('DELETE', 'posts?id=eq.' + Number(id), { as: asAdmin ? 'admin' : 'user', prefer: 'return=minimal' }); };
  Cloud.prototype.deleteComment = function (id, asAdmin) { return this.rest('DELETE', 'comments?id=eq.' + Number(id), { as: asAdmin ? 'admin' : 'user', prefer: 'return=minimal' }); };
  Cloud.prototype.setPost = function (id, patch) {
    const p = {};
    if (patch.hidden !== undefined) p.hidden = !!patch.hidden;
    if (patch.pinned !== undefined) p.pinned = !!patch.pinned;
    return this.rest('PATCH', 'posts?id=eq.' + Number(id), { as: 'admin', body: p, prefer: 'return=minimal' });
  };
  Cloud.prototype.setComment = function (id, hidden) { return this.rest('PATCH', 'comments?id=eq.' + Number(id), { as: 'admin', body: { hidden: !!hidden }, prefer: 'return=minimal' }); };
  Cloud.prototype.myUid = function () { return this.anon && this.anon.uid; };

  const api = { Cloud, okCfg, BOARDS: { free: '자유', tip: '공략', question: '질문' }, STATUS: { new: '새 글', doing: '확인 중', done: '처리 완료', hold: '보류' } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionCloud = api;
})(typeof window !== 'undefined' ? window : globalThis);
