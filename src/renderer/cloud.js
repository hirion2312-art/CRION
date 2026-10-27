// 커뮤니티 · 신고함 서버(Supabase) 연결. 외부 라이브러리 없이 fetch로 REST만 쓴다.
//  - 팔로워: 가입 없이 '익명 로그인'으로 신고를 보낸다 (세션은 이 기기 localStorage)
//  - CRION 계정(이메일·비밀번호): 게시판 글·댓글·좋아요, 플레이 기록 동기화 (세션은 이 기기 localStorage, 로그아웃하면 지움)
//  - 히리온(관리자): 관리자 이메일·비밀번호로 로그인 → 신고함·게시판 관리 (세션은 메모리에만)
//  - url/anonKey 는 공개돼도 안전한 값. 권한은 서버(RLS, supabase/schema.sql)가 지킨다.
(function (root) {
  'use strict';
  const SKEY = 'crion.cloud.anon', UKEY = 'crion.cloud.user';
  const trim = (u) => String(u || '').replace(/\/+$/, '');
  const okCfg = (c) => !!(c && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(trim(c.url)) && String(c.anonKey || '').length > 20);

  function Cloud(cfg, opt) {
    opt = opt || {};
    this.cfg = okCfg(cfg) ? { url: trim(cfg.url), anonKey: String(cfg.anonKey).trim() } : null;
    this.f = opt.fetch || (root.fetch && root.fetch.bind(root));
    this.ls = opt.storage || null;
    this.now = opt.now || (() => Date.now());
    this.anon = null;   // 팔로워 익명 세션
    this.user = undefined; // CRION 계정 세션 {access, refresh, exp, uid, email} (undefined = 아직 안 읽음)
    this.profile = null;   // {nick, banned}
    this.admin = null;  // 관리자 세션 (메모리에만)
    this.adminEmail = '';
  }
  Cloud.prototype.enabled = function () { return !!this.cfg; };
  // 목록(catalog.json)에서 받은 주소·키를 적용. 바뀌면 예전 세션은 버린다
  Cloud.prototype.setConfig = function (cfg) {
    const n = okCfg(cfg) ? { url: trim(cfg.url), anonKey: String(cfg.anonKey).trim() } : null;
    if ((n && n.url) !== (this.cfg && this.cfg.url) && this.cfg) { this.anon = null; this.admin = null; this.user = null; this.profile = null; try { if (this.ls) { this.ls.removeItem(SKEY); this.ls.removeItem(UKEY); } } catch (e) { /* 무시 */ } }
    this.cfg = n;
  };

  // 새 방식 키(sb_publishable_…)는 토큰이 아니라서 Authorization 에 넣지 않는다 (옛 anon 키 eyJ… 는 넣어도 됨)
  Cloud.prototype._h = function (token, extra) {
    const h = { apikey: this.cfg.anonKey, 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    else if (/^eyJ/.test(this.cfg.anonKey)) h.Authorization = 'Bearer ' + this.cfg.anonKey;
    return Object.assign(h, extra || {});
  };
  Cloud.prototype._json = async function (res) {
    let j = null;
    try { j = await res.json(); } catch (e) { /* 빈 응답 */ }
    if (!res.ok) {
      let msg = (j && (j.message || j.msg || j.error_description || j.error)) || String(res.status);
      const code = j && j.code;
      if (code === '23505' && /nick/.test(msg)) msg = '이미 쓰는 닉네임이에요';
      else if (code === '42501' || /row-level security/i.test(msg)) msg = '이 기능은 CRION 계정으로 로그인해야 해요';
      else if (/Invalid login credentials/i.test(msg)) msg = '이메일이나 비밀번호가 맞지 않아요';
      else if (/already registered|already been registered|User already/i.test(msg)) msg = '이미 가입한 이메일이에요. 로그인해 주세요';
      else if (/Password should be at least/i.test(msg)) msg = '비밀번호는 8자 이상으로 해 주세요';
      else if (/Email not confirmed/i.test(msg)) msg = '이메일 확인이 아직이에요 (서버 설정에서 Confirm email 을 꺼 주세요)';
      else if (/Signups not allowed|signup.*disabled/i.test(msg)) msg = '지금은 새로 가입할 수 없어요';
      else if (/rate limit|too many/i.test(msg)) msg = '잠시 뒤에 다시 해 주세요';
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
    const acc = await this._account().catch(() => null);
    if (acc) return acc;
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

  // ---------- CRION 계정 ----------
  Cloud.prototype._loadUser = function () {
    if (this.user === undefined) { try { this.user = JSON.parse((this.ls && this.ls.getItem(UKEY)) || 'null'); } catch (e) { this.user = null; } }
    return this.user;
  };
  Cloud.prototype._storeUser = function (s) {
    this.user = s;
    try { if (this.ls) { if (s) this.ls.setItem(UKEY, JSON.stringify(s)); else this.ls.removeItem(UKEY); } } catch (e) { /* 저장 안 됨 */ }
  };
  // 계정 세션 (만료가 가까우면 갱신). 없으면 null
  Cloud.prototype._account = async function () {
    if (!this.cfg) return null;
    const u = this._loadUser();
    if (!u) return null;
    if (u.exp - this.now() > 60000) return u;
    try { const s = await this._refresh(u); s.email = u.email; this._storeUser(s); return s; }
    catch (e) { if (e && (e.status === 400 || e.status === 401)) { this._storeUser(null); this.profile = null; } throw new Error('로그인이 끝났어요. 다시 로그인해 주세요'); }
  };
  Cloud.prototype.accountUid = function () { const u = this._loadUser(); return (u && u.uid) || null; };
  Cloud.prototype.account = function () { const u = this._loadUser(); return u ? { uid: u.uid, email: u.email || '', nick: (this.profile && this.profile.nick) || '', banned: !!(this.profile && this.profile.banned) } : null; };
  Cloud.prototype.signUp = async function (email, password, nick) {
    if (!this.cfg) throw new Error('서버가 아직 준비되지 않았어요');
    email = String(email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('이메일 주소를 확인해 주세요');
    if (String(password || '').length < 8) throw new Error('비밀번호는 8자 이상으로 해 주세요');
    const n = String(nick || '').trim();
    if (n.length < 2 || n.length > 16) throw new Error('닉네임은 2~16자로 해 주세요');
    const j = await this._json(await this.f(this.cfg.url + '/auth/v1/signup', { method: 'POST', headers: this._h(), body: JSON.stringify({ email, password, data: { nick: n } }) }));
    if (!j.access_token) throw new Error('가입은 됐지만 바로 로그인이 안 돼요 (서버 설정에서 Confirm email 을 꺼 주세요)');
    const s = sess(j, this.now()); s.email = email;
    this._storeUser(s);
    try { await this.setNick(n); } catch (e) { return { ok: true, nickError: e.message }; }
    return { ok: true };
  };
  Cloud.prototype.signIn = async function (email, password) {
    if (!this.cfg) throw new Error('서버가 아직 준비되지 않았어요');
    email = String(email || '').trim();
    const j = await this._json(await this.f(this.cfg.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: this._h(), body: JSON.stringify({ email, password: String(password || '') }) }));
    const s = sess(j, this.now()); s.email = email;
    this._storeUser(s);
    await this.loadProfile().catch(() => null);
    return true;
  };
  Cloud.prototype.signOut = async function () {
    const u = this._loadUser();
    if (u && this.cfg) { try { await this.f(this.cfg.url + '/auth/v1/logout', { method: 'POST', headers: this._h(u.access) }); } catch (e) { /* 끊겨도 지움 */ } }
    this._storeUser(null); this.profile = null;
  };
  Cloud.prototype.resetPassword = async function (email, redirectTo) {
    if (!this.cfg) throw new Error('서버가 아직 준비되지 않았어요');
    const q = redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : '';
    await this._json(await this.f(this.cfg.url + '/auth/v1/recover' + q, { method: 'POST', headers: this._h(), body: JSON.stringify({ email: String(email || '').trim() }) }));
    return true;
  };
  Cloud.prototype.loadProfile = async function () {
    const u = await this._account();
    if (!u) { this.profile = null; return null; }
    const r = await this.rest('GET', `profiles?select=nick,banned&uid=eq.${u.uid}`, { as: 'account' });
    this.profile = (r && r[0]) || null;
    return this.profile;
  };
  Cloud.prototype.setNick = async function (nick) {
    const n = String(nick || '').trim();
    if (n.length < 2 || n.length > 16) throw new Error('닉네임은 2~16자로 해 주세요');
    const u = await this._account();
    if (!u) throw new Error('CRION 계정으로 로그인해 주세요');
    if (this.profile) await this.rest('PATCH', `profiles?uid=eq.${u.uid}`, { as: 'account', body: { nick: n }, prefer: 'return=minimal' });
    else {
      const have = await this.rest('GET', `profiles?select=nick&uid=eq.${u.uid}`, { as: 'account' });
      if (have && have.length) await this.rest('PATCH', `profiles?uid=eq.${u.uid}`, { as: 'account', body: { nick: n }, prefer: 'return=minimal' });
      else await this.rest('POST', 'profiles', { as: 'account', body: { nick: n }, prefer: 'return=minimal' });
    }
    this.profile = Object.assign({}, this.profile || { banned: false }, { nick: n });
    return true;
  };
  Cloud.prototype.deleteAccount = async function () {
    await this.rest('POST', 'rpc/delete_my_account', { as: 'account', body: {} });
    this._storeUser(null); this.profile = null;
    return true;
  };
  // 기록 동기화 (sync.js 가 쓴다)
  Cloud.prototype.syncPull = function (cursor) {
    let p = 'sync_items?select=key,val,deleted,updated_at&order=updated_at.asc&limit=500';
    if (cursor) p += '&updated_at=gt.' + encodeURIComponent(cursor);
    return this.rest('GET', p, { as: 'account' });
  };
  Cloud.prototype.syncPush = function (rows) {
    return this.rest('POST', 'sync_items?on_conflict=uid,key&select=key,updated_at', { as: 'account', body: rows, prefer: 'resolution=merge-duplicates,return=representation' });
  };
  // 서버 설계도가 최신인지 (관리 페이지·앱 진단용)
  Cloud.prototype.schemaVersion = async function () {
    try { return Number(await this.rest('POST', 'rpc/crion_schema_version', { body: {} })) || 1; } catch (e) { return 1; }
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
    else if (o.as === 'account') { const a = await this._account(); if (!a) throw new Error('CRION 계정으로 로그인해 주세요'); token = a.access; }
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
    let p = 'posts?select=id,created_at,uid,board,title,nick,work,is_admin,pinned,hidden,like_count,edited_at,comments(count)&order=pinned.desc,created_at.desc&limit=60';
    if (board === 'mine') { const id = this.accountUid() || this.myUid(); p += '&uid=eq.' + (id || '00000000-0000-0000-0000-000000000000'); }
    else if (board === 'hot') p = p.replace('order=pinned.desc,created_at.desc', 'order=like_count.desc,created_at.desc') + '&created_at=gt.' + encodeURIComponent(new Date(this.now() - 14 * 86400000).toISOString());
    else if (board && board !== 'all') p += '&board=eq.' + encodeURIComponent(board);
    return this.rest('GET', p, {});
  };
  Cloud.prototype.getPost = async function (id) {
    const n = Number(id);
    const [post, comments] = await Promise.all([
      this.rest('GET', `posts?select=*&id=eq.${n}`, this.accountUid() && !this.admin ? { as: 'account' } : {}),
      this.rest('GET', `comments?select=*&post_id=eq.${n}&order=created_at.asc&limit=200`, {})
    ]);
    return { post: (post || [])[0] || null, comments: comments || [] };
  };
  Cloud.prototype.addPost = function (f) {
    return this.rest('POST', 'posts', { as: this.admin ? 'admin' : 'account', prefer: 'return=representation', body: { board: f.board || 'free', title: clip(f.title, 80), body: clip(f.body, 3000), nick: clip(f.nick, 20), work: clip(f.work, 100) || null } });
  };
  Cloud.prototype.addComment = function (postId, f) {
    return this.rest('POST', 'comments', { as: this.admin ? 'admin' : 'account', prefer: 'return=minimal', body: { post_id: Number(postId), body: clip(f.body, 800), nick: clip(f.nick, 20) } });
  };
  Cloud.prototype.deletePost = function (id, asAdmin) { return this.rest('DELETE', 'posts?id=eq.' + Number(id), { as: asAdmin ? 'admin' : 'user', prefer: 'return=minimal' }); };
  Cloud.prototype.deleteComment = function (id, asAdmin) { return this.rest('DELETE', 'comments?id=eq.' + Number(id), { as: asAdmin ? 'admin' : 'user', prefer: 'return=minimal' }); };
  Cloud.prototype.memberMode = function () { return !!this.accountUid(); };
  Cloud.prototype.setPost = function (id, patch) {
    const p = {};
    if (patch.hidden !== undefined) p.hidden = !!patch.hidden;
    if (patch.pinned !== undefined) p.pinned = !!patch.pinned;
    return this.rest('PATCH', 'posts?id=eq.' + Number(id), { as: 'admin', body: p, prefer: 'return=minimal' });
  };
  Cloud.prototype.setComment = function (id, hidden) { return this.rest('PATCH', 'comments?id=eq.' + Number(id), { as: 'admin', body: { hidden: !!hidden }, prefer: 'return=minimal' }); };
  Cloud.prototype.myUid = function () { return this.accountUid() || (this.anon && this.anon.uid); };
  Cloud.prototype.editPost = function (id, f) {
    return this.rest('PATCH', 'posts?id=eq.' + Number(id), { as: 'account', prefer: 'return=minimal', body: { board: f.board || 'free', title: clip(f.title, 80), body: clip(f.body, 3000), work: clip(f.work, 100) || null } });
  };
  Cloud.prototype.likePost = function (id) { return this.rest('POST', 'post_likes', { as: this.admin ? 'admin' : 'account', prefer: 'return=minimal', body: { post_id: Number(id) } }); };
  Cloud.prototype.unlikePost = function (id) { return this.rest('DELETE', 'post_likes?post_id=eq.' + Number(id), { as: this.admin ? 'admin' : 'account', prefer: 'return=minimal' }); };
  Cloud.prototype.myLikes = async function (ids) {
    if (!this.accountUid() || !ids || !ids.length) return [];
    const r = await this.rest('GET', 'post_likes?select=post_id&post_id=in.(' + ids.map(Number).join(',') + ')', { as: 'account' });
    return (r || []).map(x => x.post_id);
  };
  Cloud.prototype.flagPost = function (kind, id, reason, title) {
    const t = kind === 'comment' ? 'comment:' + Number(id) : 'post:' + Number(id);
    return this.rest('POST', 'reports', { as: 'user', prefer: 'return=minimal', body: { kind: 'flag', title: clip('🚩 ' + (title || t), 120), body: clip(reason || '(사유 없음)', 4000), target: t } });
  };
  // 내 글에 달린 새 댓글 수 (since 이후, 내가 단 것 제외)
  Cloud.prototype.newReplies = async function (since) {
    const me = this.accountUid();
    if (!me) return 0;
    const mine = await this.rest('GET', `posts?select=id&uid=eq.${me}&order=created_at.desc&limit=50`, { as: 'account' });
    if (!mine || !mine.length) return 0;
    const r = await this.rest('GET', `comments?select=id&post_id=in.(${mine.map(x => x.id).join(',')})&uid=neq.${me}&created_at=gt.${encodeURIComponent(new Date(since || 0).toISOString())}&limit=99`, { as: 'account' });
    return (r || []).length;
  };
  Cloud.prototype.banUser = function (uid, on) { return this.rest('PATCH', 'profiles?uid=eq.' + encodeURIComponent(uid), { as: 'admin', body: { banned: !!on }, prefer: 'return=minimal' }); };

  const api = { Cloud, okCfg, UKEY, BOARDS: { free: '자유', tip: '공략', question: '질문' }, STATUS: { new: '새 글', doing: '확인 중', done: '처리 완료', hold: '보류' } };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionCloud = api;
})(typeof window !== 'undefined' ? window : globalThis);
