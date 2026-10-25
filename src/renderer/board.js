// 게시판 · 보낸 것(처리 상태) · 관리자 신고함 화면. app.js 가 create(...)로 불러 쓴다.
(function (root) {
  'use strict';
  const BOARDS = { free: '자유', tip: '공략', question: '질문' };
  const STATUS = { new: '새 글', doing: '확인 중', done: '처리 완료', hold: '보류' };
  const KINDS = { bug: '🐞 오류 신고', idea: '💡 건의', tip: '📘 공략 제보' };

  function create(d) {
    const { S, cloud, esc, ago, modal, closeModal, toast, render, lsGet, lsSet, I } = d;
    const B = {
      cat: 'all', list: null, loading: false, err: '', post: null, comments: [], pbusy: false,
      my: null, myLoading: false, myErr: '',
      inbox: null, ibusy: false, ierr: '', st: 'all', kd: 'all', tab: 'reports', newCount: 0, loginErr: '', loggingIn: false
    };
    const nick = () => lsGet('crion.nick') || '';
    const errMsg = (e) => (e && e.message) || '문제가 생겼어요';
    const when = (iso) => ago(new Date(iso).getTime());
    const pre = (s) => esc(s).replace(/\n/g, '<br>');
    const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const isMine = (row) => !!(row && cloud.myUid() && row.uid === cloud.myUid());

    // ---------- 게시판 ----------
    async function loadList() {
      B.loading = true; B.err = '';
      try { B.list = await cloud.listPosts(B.cat); } catch (e) { B.err = errMsg(e); B.list = []; }
      B.loading = false; render();
    }
    async function openPost(id) {
      B.post = { id: Number(id), loading: true }; B.comments = []; render();
      try { const r = await cloud.getPost(id); B.post = r.post || { id: Number(id), gone: true }; B.comments = r.comments; }
      catch (e) { B.post = { id: Number(id), gone: true }; toast(errMsg(e)); }
      render();
    }
    function boardHtml() {
      if (!cloud.enabled()) return '<div class="empty"><b>게시판이 곧 열려요</b><span>팔로워끼리 공략과 이야기를 나누는 곳이에요. 서버 준비가 끝나면 자동으로 열려요.</span></div>';
      if (B.post) return postHtml();
      if (B.list === null && !B.loading) loadList();
      const cats = [['all', '전체']].concat(Object.entries(BOARDS));
      const rows = (B.list || []).map(p => `<button class="bd-row ${p.hidden ? 'hid' : ''}" data-act="board-open" data-id="${p.id}">
          <div class="bd-t">${p.pinned ? '<i class="bd-pin">고정</i>' : ''}<i class="bd-cat">${esc(BOARDS[p.board] || '')}</i><b>${esc(p.title)}</b>${p.hidden ? '<i class="bd-pin">숨김</i>' : ''}</div>
          <div class="bd-m">${p.is_admin ? '<i class="bd-adm">히리온</i>' : ''}${esc(p.nick)}${p.work ? ' · ' + esc(p.work) : ''} · ${when(p.created_at)} · 댓글 ${((p.comments && p.comments[0] && p.comments[0].count) || 0)}</div></button>`).join('');
      return `<div class="bd-bar"><div class="seg">${cats.map(([k, l]) => `<button class="${B.cat === k ? 'on' : ''}" data-act="board-cat" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="row"><button class="btn sm" data-act="board-refresh">${I.reload}새로고침</button><button class="btn primary sm" data-act="board-write">${I.plus}글쓰기</button></div></div>
        ${B.err ? `<div class="bd-err">${esc(B.err)}</div>` : ''}
        ${B.loading ? '<div class="empty"><span class="spin"></span></div>' : rows ? `<div class="bd-list">${rows}</div>` : '<div class="empty"><b>아직 글이 없어요</b><span>첫 글을 남겨 보세요.</span></div>'}`;
    }
    function postHtml() {
      const p = B.post;
      const back = `<button class="link" data-act="board-back">← 목록으로</button>`;
      if (p.loading) return `${back}<div class="empty"><span class="spin"></span></div>`;
      if (p.gone) return `${back}<div class="empty"><b>글을 찾을 수 없어요</b><span>지워졌거나 숨겨진 글이에요.</span></div>`;
      const adm = cloud.isAdmin();
      const mine = isMine(p);
      const cm = B.comments.map(c => `<div class="bd-cm ${c.hidden ? 'hid' : ''}"><div class="bd-m">${c.is_admin ? '<i class="bd-adm">히리온</i>' : ''}<b>${esc(c.nick)}</b> · ${when(c.created_at)}${c.hidden ? ' · 숨김' : ''}
          ${adm ? `<button class="link" data-act="comment-hide" data-id="${c.id}" data-v="${c.hidden ? 'false' : 'true'}">${c.hidden ? '보이기' : '숨기기'}</button>` : ''}
          ${(adm || isMine(c)) ? `<button class="link danger" data-act="comment-del" data-id="${c.id}">삭제</button>` : ''}</div><p>${pre(c.body)}</p></div>`).join('');
      return `${back}<article class="bd-post">
        <div class="bd-t"><i class="bd-cat">${esc(BOARDS[p.board] || '')}</i>${p.pinned ? '<i class="bd-pin">고정</i>' : ''}${p.hidden ? '<i class="bd-pin">숨김</i>' : ''}</div>
        <h3>${esc(p.title)}</h3>
        <div class="bd-m">${p.is_admin ? '<i class="bd-adm">히리온</i>' : ''}${esc(p.nick)}${p.work ? ' · ' + esc(p.work) : ''} · ${when(p.created_at)}</div>
        <p class="bd-body">${pre(p.body)}</p>
        <div class="row">${(adm || mine) ? `<button class="btn sm danger" data-act="post-del" data-id="${p.id}">${I.trash}삭제</button>` : ''}
          ${adm ? `<button class="btn sm" data-act="post-pin" data-id="${p.id}" data-v="${p.pinned ? 'false' : 'true'}">${p.pinned ? '고정 풀기' : '맨 위 고정'}</button><button class="btn sm" data-act="post-hide" data-id="${p.id}" data-v="${p.hidden ? 'false' : 'true'}">${p.hidden ? '보이기' : '숨기기'}</button>` : ''}</div>
      </article>
      <h4 class="bd-h">댓글 ${B.comments.length}</h4>
      <div class="bd-cms">${cm || '<div class="muted">아직 댓글이 없어요</div>'}</div>
      <div class="bd-cform"><input id="cmNick" class="field" maxlength="20" placeholder="닉네임" value="${esc(nick())}"><textarea id="cmBody" class="field" rows="3" maxlength="800" placeholder="댓글을 적어 주세요"></textarea>
        <button class="btn primary" data-act="comment-send" data-id="${p.id}" ${B.pbusy ? 'disabled' : ''}>댓글 남기기</button></div>`;
    }
    function writeModal() {
      modal(`<header><h3>글쓰기</h3><button class="icon-btn" data-act="close-modal">${I.x}</button></header>
        <div class="body"><div class="form">
          <label class="f"><span>게시판</span><select id="wBoard" class="field">${Object.entries(BOARDS).map(([k, l]) => `<option value="${k}" ${k === (B.cat === 'all' ? 'free' : B.cat) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="f"><span>제목</span><input id="wTitle" class="field" maxlength="80"></label>
          <label class="f"><span>내용</span><textarea id="wBody" class="field" rows="7" maxlength="3000"></textarea></label>
          <label class="f"><span>작품 (선택)</span><input id="wWork" class="field" maxlength="100" placeholder="어떤 작품 이야기인가요?"></label>
          <label class="f"><span>닉네임</span><input id="wNick" class="field" maxlength="20" value="${esc(nick())}"></label>
          <div class="form-foot"><span class="muted">가입 없이 올려요. 운영 규칙에 어긋나는 글은 숨겨질 수 있어요.</span><button class="btn primary" data-act="board-post">올리기</button></div>
        </div></div>`);
    }
    async function submitPost() {
      const f = { board: val('wBoard'), title: val('wTitle'), body: val('wBody'), work: val('wWork'), nick: val('wNick') };
      if (!f.title || !f.body) return toast('제목과 내용을 적어 주세요');
      if (!f.nick) return toast('닉네임을 적어 주세요');
      lsSet('crion.nick', f.nick);
      const btn = document.querySelector('[data-act=board-post]'); if (btn) { btn.disabled = true; btn.textContent = '올리는 중…'; }
      try {
        const r = await cloud.addPost(f);
        closeModal(); toast('올렸어요');
        B.cat = f.board; B.list = null;
        if (r && r[0]) await openPost(r[0].id); else render();
      } catch (e) { toast(errMsg(e)); if (btn) { btn.disabled = false; btn.textContent = '올리기'; } }
    }
    async function sendComment(id) {
      const f = { body: val('cmBody'), nick: val('cmNick') };
      if (!f.body) return toast('댓글을 적어 주세요');
      if (!f.nick) return toast('닉네임을 적어 주세요');
      lsSet('crion.nick', f.nick);
      B.pbusy = true; render();
      try { await cloud.addComment(id, f); const r = await cloud.getPost(id); B.post = r.post || B.post; B.comments = r.comments; B.list = null; }
      catch (e) { toast(errMsg(e)); }
      B.pbusy = false; render();
    }
    async function postOp(fn, after) {
      try { await fn(); if (after) await after(); } catch (e) { toast(errMsg(e)); }
      B.list = null; render();
    }

    // ---------- 보낸 것 (내 신고의 처리 상태) ----------
    async function loadMy() {
      if (!cloud.enabled()) return;
      B.myLoading = true; B.myErr = '';
      try { B.my = await cloud.myReports(); } catch (e) { B.myErr = errMsg(e); B.my = []; }
      B.myLoading = false; render();
    }
    function myHtml(localHist) {
      if (!cloud.enabled()) return null;
      if (B.my === null && !B.myLoading) loadMy();
      if (B.myLoading && B.my === null) return '<div class="empty"><span class="spin"></span></div>';
      if (B.myErr) return `<div class="bd-err">${esc(B.myErr)}</div>`;
      if (!B.my.length) return '<div class="empty"><b>아직 보낸 것이 없어요</b></div>';
      return `<div class="hist">${B.my.map(r => `<div class="my-r"><b>${esc(KINDS[r.kind] || '')}</b><span>${esc(r.title)}</span>
        <small><i class="st st-${r.status}">${STATUS[r.status] || ''}</i> ${when(r.created_at)}</small>
        ${r.reply ? `<p class="my-reply"><b>히리온의 답변</b>${pre(r.reply)}</p>` : ''}</div>`).join('')}</div>`;
    }

    // ---------- 관리자 신고함 ----------
    async function loadInbox() {
      B.ibusy = true; B.ierr = '';
      try {
        B.inbox = await cloud.listReports({ status: B.st, kind: B.kd });
        B.newCount = await cloud.countNewReports();
      } catch (e) { B.ierr = errMsg(e); B.inbox = B.inbox || []; if (/로그인/.test(B.ierr)) cloud.adminLogout(); }
      B.ibusy = false; render();
    }
    async function login() {
      const email = val('adEmail'); B.email = email; const pw = (document.getElementById('adPw') || {}).value || '';
      if (!email || !pw) { B.loginErr = '이메일과 비밀번호를 넣어 주세요'; return render(); }
      B.loggingIn = true; B.loginErr = ''; render();
      try { await cloud.adminLogin(email, pw); lsSet('crion.cloud.email', email); B.inbox = null; await loadInbox(); B.loggingIn = false; return; }
      catch (e) { B.loginErr = errMsg(e); }
      B.loggingIn = false; render();
    }
    function inboxHtml() {
      const head = (right) => `<main class="page"><div class="page-in narrow">
        <header class="page-h"><div><h1>신고함</h1><p>오류 신고·건의·공략 제보와 게시판을 여기서 관리해요.</p></div><div class="page-h-r">${right || ''}</div></header>`;
      if (!cloud.enabled()) {
        return head() + `<div class="empty"><b>서버가 아직 연결되지 않았어요</b><span>저장소의 <code>supabase/README.md</code> 순서대로 서버를 만들고 주소·키를 Claude에게 알려 주면 연결돼요.</span></div></div></main>`;
      }
      if (!cloud.isAdmin()) {
        return head() + `<div class="ad-login form"><b>관리자 로그인</b><span class="muted">Supabase에 만든 관리자 이메일·비밀번호예요. (비밀번호는 저장하지 않아요)</span>
          <label class="f"><span>이메일</span><input id="adEmail" class="field" type="email" autocomplete="off" value="${esc(B.email || lsGet('crion.cloud.email') || '')}"></label>
          <label class="f"><span>비밀번호</span><input id="adPw" class="field" type="password" autocomplete="off"></label>
          ${B.loginErr ? `<div class="err">${esc(B.loginErr)}</div>` : ''}
          <button class="btn primary" data-act="inbox-login" ${B.loggingIn ? 'disabled' : ''}>${B.loggingIn ? '확인 중…' : '로그인'}</button></div></div></main>`;
      }
      if (B.inbox === null && !B.ibusy) loadInbox();
      const seg = (key, items, cur) => `<div class="seg">${items.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="inbox-filter" data-k="${key}" data-v="${k}">${l}</button>`).join('')}</div>`;
      const right = `<button class="btn" data-act="inbox-refresh">${I.reload}새로고침</button><button class="btn" data-act="inbox-logout">로그아웃</button>`;
      let body;
      if (B.tab === 'posts') {
        if (B.list === null && !B.loading) loadList();
        body = boardHtml();
      } else {
        const cards = (B.inbox || []).map(r => `<article class="rp st-b-${r.status}">
          <div class="rp-h"><b>${esc(KINDS[r.kind] || r.kind)}</b><i class="st st-${r.status}">${STATUS[r.status] || ''}</i><span>${when(r.created_at)}</span></div>
          <h4>${esc(r.title)}</h4><p>${pre(r.body)}</p>
          ${r.steps ? `<p class="rp-s"><b>어떻게 하다가</b> ${pre(r.steps)}</p>` : ''}
          <div class="rp-m">${r.work ? `작품 ${esc(r.work)} · ` : ''}${r.nick ? `보낸 사람 ${esc(r.nick)} · ` : ''}${esc(r.app || '')}</div>
          ${r.diag ? `<details><summary>화면 진단</summary><pre>${esc(r.diag)}</pre><button class="btn sm" data-act="rep-copy" data-id="${r.id}">진단 복사</button></details>` : ''}
          <div class="rp-act">${Object.entries(STATUS).map(([k, l]) => `<button class="btn sm ${r.status === k ? 'primary' : ''}" data-act="rep-status" data-id="${r.id}" data-v="${k}">${l}</button>`).join('')}
            <button class="btn sm danger" data-act="rep-del" data-id="${r.id}">${I.trash}삭제</button></div>
          <div class="rp-rep"><textarea id="rep-${r.id}" class="field" rows="2" maxlength="1000" placeholder="보낸 사람에게 보일 답변 (선택)">${esc(r.reply || '')}</textarea><button class="btn sm" data-act="rep-save" data-id="${r.id}">답변 저장</button></div></article>`).join('');
        body = `<div class="bd-bar">${seg('st', [['all', '전체'], ['new', '새 글'], ['doing', '확인 중'], ['done', '처리 완료'], ['hold', '보류']], B.st)}
          ${seg('kd', [['all', '모든 종류'], ['bug', '오류'], ['idea', '건의'], ['tip', '공략']], B.kd)}</div>
          ${B.ierr ? `<div class="bd-err">${esc(B.ierr)}</div>` : ''}
          ${B.ibusy && !(B.inbox || []).length ? '<div class="empty"><span class="spin"></span></div>' : cards ? `<div class="rp-list">${cards}</div>` : '<div class="empty"><b>해당하는 글이 없어요</b></div>'}`;
      }
      return head(right) + `<nav class="tabs"><button class="${B.tab === 'reports' ? 'on' : ''}" data-act="inbox-tab" data-v="reports">신고·건의${B.newCount ? ` <em class="cnt">${B.newCount}</em>` : ''}</button><button class="${B.tab === 'posts' ? 'on' : ''}" data-act="inbox-tab" data-v="posts">게시판 관리</button></nav><div class="tab-body">${body}</div></div></main>`;
    }

    // ---------- 클릭 처리 (처리했으면 true) ----------
    function act(name, el) {
      const id = el && el.dataset ? el.dataset.id : null;
      const v = el && el.dataset ? el.dataset.v : null;
      switch (name) {
        case 'board-cat': B.cat = v; B.list = null; render(); return true;
        case 'board-refresh': B.list = null; render(); return true;
        case 'board-open': openPost(id); return true;
        case 'board-back': B.post = null; B.list = null; render(); return true;
        case 'board-write': writeModal(); return true;
        case 'board-post': submitPost(); return true;
        case 'comment-send': sendComment(id); return true;
        case 'post-del': modal(`<header><h3>글 삭제</h3></header><div class="body"><p>이 글과 댓글이 모두 지워져요.</p><div class="row"><button class="btn" data-act="close-modal">취소</button><button class="btn danger" data-act="post-del-ok" data-id="${esc(id)}">삭제</button></div></div>`); return true;
        case 'post-del-ok': closeModal(); postOp(() => cloud.deletePost(id, cloud.isAdmin() && !isMine(B.post))).then(() => { B.post = null; render(); }); return true;
        case 'post-hide': postOp(() => cloud.setPost(id, { hidden: v === 'true' }), () => openPost(id)); return true;
        case 'post-pin': postOp(() => cloud.setPost(id, { pinned: v === 'true' }), () => openPost(id)); return true;
        case 'comment-del': postOp(() => cloud.deleteComment(id, cloud.isAdmin() && !(B.comments.find(c => String(c.id) === id) && isMine(B.comments.find(c => String(c.id) === id)))), async () => { const r = await cloud.getPost(B.post.id); B.comments = r.comments; }); return true;
        case 'comment-hide': postOp(() => cloud.setComment(id, v === 'true'), async () => { const r = await cloud.getPost(B.post.id); B.comments = r.comments; }); return true;
        case 'my-reload': B.my = null; render(); return true;
        case 'inbox-login': login(); return true;
        case 'inbox-logout': cloud.adminLogout(); B.inbox = null; B.newCount = 0; B.post = null; B.list = null; B.my = null; render(); return true;
        case 'inbox-refresh': B.inbox = null; B.list = null; render(); return true;
        case 'inbox-tab': B.tab = v; B.post = null; render(); return true;
        case 'inbox-filter': B[el.dataset.k] = v; B.inbox = null; render(); return true;
        case 'rep-status': { const r = (B.inbox || []).find(x => String(x.id) === id); if (r) r.status = v; render(); cloud.updateReport(id, { status: v }).then(() => cloud.countNewReports()).then(n => { B.newCount = n; render(); }).catch(e => { toast(errMsg(e)); B.inbox = null; render(); }); return true; }
        case 'rep-save': { const txt = val('rep-' + id); cloud.updateReport(id, { reply: txt }).then(() => { const r = (B.inbox || []).find(x => String(x.id) === id); if (r) r.reply = txt; toast('답변을 저장했어요'); }).catch(e => toast(errMsg(e))); return true; }
        case 'rep-copy': { const r = (B.inbox || []).find(x => String(x.id) === id); if (r && d.copy) d.copy(r.diag, '진단을 복사했어요'); return true; }
        case 'rep-del': modal(`<header><h3>삭제할까요?</h3></header><div class="body"><p>이 글은 복구할 수 없어요.</p><div class="row"><button class="btn" data-act="close-modal">취소</button><button class="btn danger" data-act="rep-del-ok" data-id="${esc(id)}">삭제</button></div></div>`); return true;
        case 'rep-del-ok': closeModal(); cloud.deleteReport(id).then(() => { B.inbox = (B.inbox || []).filter(x => String(x.id) !== id); render(); }).catch(e => toast(errMsg(e))); return true;
        default: return false;
      }
    }
    return { boardHtml, myHtml, inboxHtml, act, state: B, newCount: () => B.newCount, resetMy: () => { B.my = null; }, reset: () => { B.post = null; B.list = null; }, refreshNew: () => (cloud.isAdmin() ? cloud.countNewReports().then(n => { B.newCount = n; }).catch(() => {}) : Promise.resolve()) };
  }

  root.CrionBoard = { create, BOARDS, STATUS };
})(typeof window !== 'undefined' ? window : globalThis);
