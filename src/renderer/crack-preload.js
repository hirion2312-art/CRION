// 크랙 화면(webview) 안에서 도는 도우미 (화면 엔진과 함께 자동 업데이트됨)
//  - 평소(플레이팩 없음): 지금 주소와 '대화 화면인지'만 CRION에 알린다 (이어하기용). 읽기·보내기 없음
//  - 플레이팩 켜짐(호스트가 crion:config {play:true}를 보낼 때만): 최신 응답 읽기(쓰는 중에도), 그림 위치,
//    플레이어가 CRION에서 '보내기'를 한 번 누르면 크랙 입력창에 넣고 한 번 보낸다 (자동 반복 없음)
//  크랙 화면 구조를 모르는 상태에서도 돌도록 '모양'으로 찾는다. 틀리면 호스트가 rules로 선택자를 알려 준다.
//  (기반: archive/common-game-ui/renderer/crack-preload.js)
'use strict';
const { ipcRenderer } = require('electron');

let rules = {};          // { listSel, msgSel, inputSel, sendSel, regenSel } — 화면 엔진이 고쳐서 내려줄 수 있음
let active = false;
let observer = null;
let timer = null;
let stableTimer = null;
let lastSig = '';
let lastKey = '';
let lastSent = '';
let doneSent = false;
let idSeq = 0;
let lastUrl = '';
let lastHas = null;
let learned = null;      // 첫 응답에서 배운 '응답 상자' 모양 { tag, cls, ptag, pcls }
let startModes = [];     // 플레이팩이 알려 준 크랙 '시작 설정' 이름 (예: 기본모드·하드모드) — 새로하기 뒤 고르는 창의 버튼
let watch = null;        // 보낸 직후: 그때 화면에 있던 글자 목록 → 새로 생긴 글자만 응답으로 본다

const send = (ch, data) => { try { ipcRenderer.sendToHost(ch, data); } catch (e) { /* 호스트 없음 */ } };
const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
const q = (sel, root) => { try { return sel ? (root || document).querySelector(sel) : null; } catch (e) { return null; } };
const qa = (sel, root) => { try { return sel ? [...(root || document).querySelectorAll(sel)] : []; } catch (e) { return []; } };

ipcRenderer.on('crion:config', (_e, c) => {
  rules = (c && c.rules) || {};
  learned = (c && c.learned && c.learned.tag) ? c.learned : null;
  active = !!(c && c.play);
  startModes = Array.isArray(c && c.modes) ? c.modes.map(x => String(x).replace(/\s+/g, '')).filter(Boolean).slice(0, 12) : [];
  lastSig = ''; lastKey = ''; doneSent = false; lastHas = null;
  schedule(60);
});

// ---------- 입력창 ----------
// 채팅 입력창이 아닌 칸(댓글·리뷰·검색 등)은 절대 쓰지 않는다
const NOT_CHAT = /댓글|답글|코멘트|comment|reply|리뷰|후기|review|검색|search|신고|report|닉네임|이메일|비밀번호|password|email/i;
function attrsOf(e) {
  return [e.getAttribute('placeholder'), e.getAttribute('aria-label'), e.getAttribute('name'), e.id,
    typeof e.className === 'string' ? e.className : '', e.getAttribute('data-placeholder')].filter(Boolean).join(' ');
}
function nearCommentArea(e) {
  // 가까운 조상 안에 '댓글'이라는 제목·버튼이 있으면 댓글 칸으로 본다
  for (let a = e.parentElement, i = 0; a && i < 4; a = a.parentElement, i++) {
    const heads = a.querySelectorAll('h1,h2,h3,h4,h5,h6,button,[role="button"],span,p,label');
    for (const h of heads) {
      if (h.contains(e)) continue;
      const t = (h.innerText || '').trim();
      if (t.length <= 12 && /^(댓글|답글|코멘트|리뷰|후기|등록|작성)/.test(t)) return true;
    }
  }
  return false;
}
function isChatInput(e) {
  if (!e || !visible(e) || e.disabled || e.readOnly) return false;
  if (NOT_CHAT.test(attrsOf(e))) return false;
  const r = e.getBoundingClientRect();
  if (r.bottom < window.innerHeight * 0.55) return false;   // 채팅 입력창은 화면 아래쪽에 붙어 있다
  if (nearCommentArea(e)) return false;
  return true;
}
function findInput() {
  const own = q(rules.inputSel);
  if (own && visible(own)) return own;
  const cands = qa('textarea, [contenteditable="true"], [role="textbox"], input[type="text"]').filter(isChatInput);
  if (!cands.length) return null;
  // 화면 아래쪽에 있는 것이 채팅 입력창
  return cands.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
}

// 작품 소개 페이지의 '대화 시작 / 이어하기' 버튼 찾기
const START_WORDS = [
  ['continue', /^(이어서\s*(대화|하기|플레이)?|이어하기|대화\s*이어(가기|하기)|계속\s*(하기|대화|플레이)|최근\s*대화)/],
  ['new', /^(새\s*(대화|채팅)(\s*시작)?|대화\s*시작(하기)?|채팅\s*시작(하기)?|시작하기|플레이(하기)?|대화하기|채팅하기|처음부터)/]
];
// '새 대화' 계열 (크랙 실제 표기: 작품 화면의 '새로하기' — 누르면 확인 없이 바로 새 대화가 열림. 그 밖에 새로 대화하기 · 새 대화 · 처음부터) — 작품 화면·대화 화면 모두
const NEW_STRONG = /^[+＋]?\s*(새로\s*하기|새로운?\s*(대화|채팅)(\s*(시작|하기))?(하기)?|새로\s*(대화|채팅|시작)(하기)?|새\s*(대화|채팅)(\s*(시작|하기))?|처음부터(\s*(시작|하기))?|대화\s*새로\s*(시작|하기)|다시\s*시작(하기)?)$/;
const CONFIRM = /^(확인|시작|시작하기|대화\s*시작(하기)?|새로\s*시작(하기)?|네|예|계속|선택|선택\s*완료|완료|이걸로\s*시작(하기)?|이\s*설정으로\s*시작(하기)?)$/;
const DIALOG = '[role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="dialog" i], [class*="popup" i]';
const labelOf = (b) => ((b.innerText || b.textContent || b.getAttribute('aria-label') || b.title || '') + '').trim().replace(/\s+/g, ' ');
// 떠 있는 창 안인지: 모달 표시가 있거나 조상 중 화면 고정(position fixed) 상자가 있으면
function inOverlay(el) {
  if (!el) return false;
  if (el.closest(DIALOG)) return true;
  for (let c = el; c && c !== document.body; c = c.parentElement) { try { if (getComputedStyle(c).position === 'fixed') return true; } catch (e) { return false; } }
  return false;
}
const CLICKABLE = 'button, a[href], [role="button"], [role="radio"], [role="option"], [role="menuitem"], [role="tab"], label, li';
function modeTargets(onChat) {
  if (!startModes.length) return [];
  const found = {};   // 이름 → [{el, over}] — 작품 화면에 같은 이름이 있어도 떠 있는 창 안의 것을 고른다
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = (n.nodeValue || '').replace(/\s+/g, '');
    if (!t || t.length > 40) continue;
    const m = startModes.find(x => t === x || t.startsWith(x));
    if (!m) continue;
    const el = n.parentElement;
    if (!el || !visible(el) || el.closest('script, style, textarea, [contenteditable="true"]')) continue;
    const over = inOverlay(el);
    if (onChat && !over) continue;
    let c = el, hit = null;
    for (let i = 0; i < 6 && c && c !== document.body; i++, c = c.parentElement) {
      if (c.matches(CLICKABLE)) { hit = c; break; }
      try { if (getComputedStyle(c).cursor === 'pointer') { hit = c; break; } } catch (e) { break; }
    }
    (found[m] = found[m] || []).push({ el: hit || el, over });
  }
  const anyOver = Object.values(found).some(l => l.some(x => x.over));
  const out = [];
  for (const m of startModes) {
    const l = found[m];
    if (!l) continue;
    const pick = l.find(x => x.over) || (anyOver ? null : l[0]);
    if (pick) out.push({ el: pick.el, label: m });
  }
  return out;
}
let actionEls = [];
function pageActions(onChat) {
  actionEls = [];
  const out = [];
  const seen = new Set();
  const add = (b, kind, label, hidden) => { if (seen.has(b)) return; seen.add(b); out.push({ id: actionEls.length, kind, label, hidden: !!hidden }); actionEls.push(b); };
  const cands = qa('button, a[href], [role="button"], [role="menuitem"], [role="option"], [role="radio"], [role="tab"], label, li, [tabindex]');
  for (const b of cands) {
    if (b.disabled || b.getAttribute('aria-disabled') === 'true') continue;
    if (b.matches('li, label, [tabindex]') && !b.matches('button, a, [role]') && b.querySelector('button, a[href], [role="button"], [role="radio"]')) continue;
    const t = labelOf(b);
    if (!t) continue;
    const vis = visible(b);
    if (t.length > 18) continue;
    if (NEW_STRONG.test(t)) { add(b, 'new', t, !vis); continue; }
    if (!vis) continue;
    if (CONFIRM.test(t) && inOverlay(b)) { add(b, 'confirm', t); continue; }
    if (onChat) continue;
    for (const [kind, re] of START_WORDS) {
      if (re.test(t)) { add(b, kind, t); break; }
    }
  }
  // 새로하기 뒤 '시작 설정'(팩이 알려 준 이름, 예: 기본모드·하드모드)을 고르는 버튼 — 글자로 찾아 눌리는 조상을 쓴다
  //  대화 화면에선 떠 있는 창(모달·고정 위치) 안의 것만 (머리줄에 남은 '기본모드' 글자 등은 아님)
  for (const m of modeTargets(onChat)) add(m.el, 'mode', m.label);
  // 바깥 상자와 안쪽 버튼이 같은 글이면 안쪽만
  const keep = out.filter((a) => !out.some(o => o !== a && o.label === a.label && actionEls[a.id].contains(actionEls[o.id])));
  const rank = { new: 0, mode: 1, confirm: 2, continue: 3 };
  return keep.sort((a, b) => (rank[a.kind] - rank[b.kind]) || (a.hidden - b.hidden)).slice(0, 8);
}
// ---------- 크랙 실제 대화 화면 구조 (2026-10-25 실제 화면에서 확인) ----------
// 말 하나 = [data-message-group-id] 상자. 목록이 flex-col-reverse 라 문서 순서가 '새 것 → 옛 것'
// 크랙 응답: 말풍선(.wrtn-markdown 의 부모)이 rounded-none / 내 말: rounded-lg, 줄에 border-y
const GROUP = '[data-message-group-id]';
function crackGroups() {
  if (rules.msgSel) return null;
  const gs = qa(GROUP).filter(g => !g.closest('nav, aside, a[href]') && !gs_nested(g));
  if (!gs.length) return null;
  const p = gs[0].parentElement;
  let rev = false;
  try { rev = !!p && getComputedStyle(p).flexDirection === 'column-reverse'; } catch (e) { rev = false; }
  return rev ? gs.reverse() : gs;     // 옛 것 → 새 것
}
function gs_nested(g) { const up = g.parentElement && g.parentElement.closest(GROUP); return !!up; }
function isUserGroup(g) {
  const md = g.querySelector('.wrtn-markdown');
  const bub = md && md.parentElement;
  const c = bub && typeof bub.className === 'string' ? bub.className : '';
  if (/\brounded-none\b/.test(c)) return false;
  if (/\brounded-lg\b/.test(c)) return true;
  return !!g.querySelector('.border-y');
}
function groupText(g) { const md = g.querySelector('.wrtn-markdown'); return ((md || g).innerText || '').trim(); }
let msgCount = { url: '', n: -1, at: 0 };
function chatMsgs(input) {
  const gs = crackGroups();
  if (gs) return gs.length;
  // 대화 칸의 메시지 수 (새 대화인지 판단용) — 주소가 바뀌었거나 5초가 지났을 때만 다시 센다
  if (msgCount.url === location.href && Date.now() - msgCount.at < 5000) return msgCount.n;
  let n = -1;
  try { n = (learned ? bySig(learned) : columnMessages(input)).length; } catch (e) { n = -1; }
  msgCount = { url: location.href, n, at: Date.now() };
  return n;
}
function pageKind() {
  const inp = findInput();
  if (inp) { const gs = crackGroups(); return { page: 'chat', actions: pageActions(true), msgs: chatMsgs(inp), users: gs ? gs.filter(isUserGroup).length : null }; }
  const actions = pageActions();
  return { page: actions.length ? 'detail' : 'other', actions };
}
// 플레이어가 CRION에서 누른 '이어하기/새로 시작'을 크랙 버튼에 그대로 전달 (한 번 누름 = 한 번)
ipcRenderer.on('crion:click', (_e, id) => {
  if (!active) return;
  pageActions(!!findInput());
  const b = actionEls[Number(id)];
  if (b) pressOrClick(b);
  send('crion:clicked', { ok: !!b });
});

// 크랙의 '새로하기 ⌄'처럼 아래로 펼쳐지는 단추는 손가락/마우스를 '누르는 순간'(pointerdown)에 열린다 — click() 만으로는 안 열림
function pressEl(b) {
  const r = b.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  try { b.dispatchEvent(new PointerEvent('pointerdown', o)); } catch (e) { /* 옛 브라우저 */ }
  b.dispatchEvent(new MouseEvent('mousedown', o));
  o.buttons = 0;
  try { b.dispatchEvent(new PointerEvent('pointerup', o)); } catch (e) { /* 옛 브라우저 */ }
  b.dispatchEvent(new MouseEvent('mouseup', o));
}
// 사람이 한 번 누를 때와 같은 순서(누름 → 뗌 → 클릭)로 한 번. 누르는 순간 열리는 메뉴도, 클릭으로 열리는 단추도 한 번에 된다
function pressOrClick(b) { pressEl(b); b.click(); }
function setInput(el, text) {
  el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(text));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, String(text));
  }
}

const SEND_WORD = /전송|보내|send|submit/i;
function findSendButton(input) {
  const own = q(rules.sendSel);
  if (own && visible(own)) return own;
  let box = input;
  for (let i = 0; box && i < 6; i++, box = box.parentElement) {
    const btns = qa('button, [role="button"]', box).filter(b => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
    if (!btns.length) continue;
    const named = btns.find(b => SEND_WORD.test((b.getAttribute('aria-label') || '') + ' ' + (b.title || '') + ' ' + (b.innerText || '')) || b.type === 'submit');
    if (named) return named;
    // 입력창보다 뒤(오른쪽)에 있는 마지막 버튼
    const after = btns.filter(b => input.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (after.length) return after[after.length - 1];
  }
  return null;
}

// 플레이어가 CRION에서 '보내기'를 한 번 누를 때마다 한 번만 보낸다 (자동 반복 없음)
ipcRenderer.on('crion:send', (_e, msg) => {
  if (!active) { send('crion:sent', { ok: false, why: 'off' }); return; }
  const text = String((msg && msg.text) || '');
  const fillOnly = !!(msg && msg.fillOnly);
  const el = findInput();
  if (!el) { send('crion:sent', { ok: false, why: 'no-input' }); return; }   // 채팅 화면이 아니면 보내지 않는다
  setInput(el, text);
  if (fillOnly) { send('crion:sent', { ok: true, how: 'fill' }); return; }
  setTimeout(() => {
    const btn = findSendButton(el);
    lastSent = text.trim();
    doneSent = false;
    startWatch();
    if (btn) { btn.click(); send('crion:sent', { ok: true, how: 'button' }); }
    else {
      const ev = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', ev));
      el.dispatchEvent(new KeyboardEvent('keypress', ev));
      el.dispatchEvent(new KeyboardEvent('keyup', ev));
      send('crion:sent', { ok: true, how: 'enter' });
    }
    schedule(300);
  }, 120);
});

const ACTION_WORD = { regen: /재생성|다시\s*생성|다시\s*쓰기|regenerat|retry/i, stop: /중지|멈추|stop/i };
ipcRenderer.on('crion:action', (_e, name) => {
  if (!active) return;
  const re = ACTION_WORD[name];
  if (!re) return;
  const own = name === 'regen' ? q(rules.regenSel) : null;
  const btn = own || qa('button, [role="button"]').reverse().find(b => re.test((b.getAttribute('aria-label') || '') + ' ' + (b.title || '') + ' ' + (b.innerText || '').slice(0, 20)));
  if (btn) { if (name === 'regen') startWatch(); btn.click(); doneSent = false; schedule(400); }
  send('crion:acted', { name, ok: !!btn });
});

// ---------- 응답 읽기 ----------
function scrollables() {
  const out = [];
  const all = document.body ? document.body.getElementsByTagName('*') : [];
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.scrollHeight <= el.clientHeight + 40 || el.clientHeight < 200) continue;
    const oy = getComputedStyle(el).overflowY;
    if (oy === 'auto' || oy === 'scroll') out.push(el);
  }
  return out;
}

function findList(input) {
  const own = q(rules.listSel);
  if (own) return own;
  const cands = scrollables().filter(el => !(input && el.contains(input)));
  if (!cands.length) return null;
  return cands.sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];
}

// 목록 안 메시지 하나하나
function messages(list) {
  if (rules.msgSel) return qa(rules.msgSel, list);
  let el = list;
  for (let i = 0; i < 8; i++) {
    const kids = [...el.children].filter(c => visible(c) && ((c.innerText || '').trim() || c.querySelector('img')));
    if (kids.length === 1) { el = kids[0]; continue; }
    return kids;
  }
  return [...el.children];
}

const SKIP = /^(BUTTON|SVG|svg|STYLE|SCRIPT|TEXTAREA|INPUT|SELECT|NOSCRIPT)$/;
const BLOCK = /^(P|DIV|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|SECTION|ARTICLE|TABLE|TR|HR|FIGURE)$/;

// 메시지 → [{t:'text', s, code}, {t:'img', ...}] 순서 그대로
function segments(root) {
  const segs = [];
  let buf = '', code = false;
  const flush = () => { if (buf) { segs.push({ t: 'text', s: buf, code }); buf = ''; } };
  const nl = () => { if (buf && !buf.endsWith('\n')) buf += '\n'; };
  (function walk(n, inCode) {
    if (n.nodeType === 3) {
      if (inCode !== code) { flush(); code = inCode; }
      buf += n.nodeValue;
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    if (SKIP.test(tag) || n.getAttribute('aria-hidden') === 'true' || n.getAttribute('role') === 'button') return;
    if (tag === 'BR') { buf += '\n'; return; }
    if (tag === 'IMG') {
      const src = n.currentSrc || n.src || '';
      if (!/^https?:|^data:image/.test(src)) return;
      const r = n.getBoundingClientRect();
      const nat = n.naturalWidth || 0;
      const aw = Number(n.getAttribute('width')) || 0, ah = Number(n.getAttribute('height')) || 0;
      if (nat > 0 && nat < 48) return;                                    // 아이콘·이모지 그림은 뺀다
      if (!nat && Math.max(r.width, aw) > 0 && Math.max(r.width, aw) < 32) return;
      flush();
      segs.push({ t: 'img', src, w: nat || aw || Math.round(r.width), h: n.naturalHeight || ah || Math.round(r.height), alt: (n.alt || n.title || '').slice(0, 80) });
      return;
    }
    if (getComputedStyle(n).display === 'none') return;
    const block = BLOCK.test(tag);
    if (block) nl();
    const c = inCode || tag === 'PRE' || (tag === 'CODE' && n.parentElement && n.parentElement.tagName === 'PRE');
    for (const ch of n.childNodes) walk(ch, c);
    if (block) nl();
  })(root, false);
  flush();
  return segs.map(s => s.t === 'text' ? Object.assign(s, { s: s.s.replace(/\n{3,}/g, '\n\n') }) : s);
}


// ---------- 새로 생긴 글자로 응답 찾기 ----------
function snapshot() {
  const seen = new WeakSet();
  if (!document.body) return seen;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) if (n.nodeType === 3 || n.tagName === 'IMG') seen.add(n);
  return seen;
}
function startWatch() { watch = { seen: snapshot(), key: 'w' + Date.now() }; lastSig = ''; }

// 대화 칸: 입력창과 같은 세로 줄에 있는 것만 대화다. 왼쪽 세션 목록·오른쪽 패널은 버린다
function columnOf() {
  const inp = findInput();
  if (!inp) return null;
  let a = inp.getBoundingClientRect();
  // 입력창을 감싼 상자 중 너무 넓지 않은 것(대화 칸 너비)을 기준으로
  for (let e = inp.parentElement, i = 0; e && i < 6; e = e.parentElement, i++) {
    const r = e.getBoundingClientRect();
    if (r.width > window.innerWidth * 0.85) break;
    if (r.width >= a.width) a = r;
  }
  const pad = Math.max(40, a.width * 0.12);
  return { left: a.left - pad, right: a.right + pad };
}
function inColumn(el, col) {
  if (!col || !el || !el.getBoundingClientRect) return true;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return true;            // 아직 그려지지 않은 것은 판단 보류
  const cx = r.left + r.width / 2;
  return cx >= col.left && cx <= col.right && r.left >= col.left - 20;
}

const UI_BOX = 'a[href], li a, button, nav, header, footer, aside, [role="button"], [role="navigation"], [role="menu"], [role="dialog"], [role="tooltip"], textarea, input, select';
function scrollBox(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    const oy = getComputedStyle(e).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 20) return e;
  }
  return document.body;
}
function lca(nodes) {
  if (!nodes.length) return null;
  let a = nodes[0].nodeType === 3 ? nodes[0].parentElement : nodes[0];
  for (const n of nodes.slice(1)) { while (a && !a.contains(n)) a = a.parentElement; }
  return a;
}
// 보낸 뒤 새로 생긴 글자·그림을 모아 그 공통 조상을 응답 상자로 본다
function newRoot() {
  if (!watch || !document.body) return null;
  const input = findInput();
  const col = columnOf();
  const echo = lastSent ? lastSent.replace(/\s+/g, ' ') : '';
  const fresh = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (watch.seen.has(n)) continue;
    const isImg = n.nodeType === 1 && n.tagName === 'IMG';
    if (n.nodeType === 1 && !isImg) continue;
    if (!isImg && !(n.nodeValue || '').trim()) continue;
    const host = isImg ? n : n.parentElement;
    if (!host || host.closest(UI_BOX) || (input && input.contains(host))) continue;
    if (!visible(host)) continue;
    if (!inColumn(host, col)) continue;                 // 왼쪽 세션 목록 등 대화 칸 밖
    // 내가 보낸 말이 화면에 찍힌 것(에코)은 뺀다
    const box = host.closest('p, div, li, span') || host;
    if (echo && (box.innerText || '').replace(/\s+/g, ' ').trim() === echo) continue;
    fresh.push(n);
  }
  if (!fresh.length) return null;
  // 글자가 가장 많이 생긴 스크롤 상자 안의 것만 (옆 목록 미리보기 등 제외)
  const groups = new Map();
  for (const f of fresh) {
    const sb = scrollBox(f.nodeType === 3 ? f.parentElement : f);
    const g = groups.get(sb) || { n: 0, items: [] };
    g.n += f.nodeType === 3 ? f.nodeValue.trim().length : 40;
    g.items.push(f);
    groups.set(sb, g);
  }
  const best = [...groups.values()].sort((a, b) => b.n - a.n)[0];
  if (best.n < 2) return null;
  let root = lca(best.items);
  if (!root || root === document.body || root === document.documentElement) return null;
  if (input && root.contains(input)) return null;
  if (!inColumn(root, col)) return null;
  return root;
}

// 배운 모양
const clsOf = (el) => (typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : []).slice(0, 12);
function sigOf(el) {
  const p = el.parentElement;
  return { tag: el.tagName, cls: clsOf(el), ptag: p ? p.tagName : '', pcls: p ? clsOf(p) : [] };
}
function overlap(a, b) {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const s = new Set(a);
  return b.filter(x => s.has(x)).length / Math.max(a.length, b.length);
}
function bySig(sig) {
  const els = [...document.getElementsByTagName(sig.tag)].filter((e) =>
    overlap(clsOf(e), sig.cls) >= 0.6 && e.parentElement && e.parentElement.tagName === sig.ptag &&
    overlap(clsOf(e.parentElement), sig.pcls) >= 0.5 && visible(e) && (e.innerText || '').trim());
  const col = columnOf();
  return els.filter(e => !els.some(o => o !== e && o.contains(e)) && inColumn(e, col) && !e.closest('a[href], nav, aside'));
}

// 크랙 응답의 열쇠: 상자의 data-message-group-id. 다 쓴 뒤 id가 바뀌어도 글이 같으면 같은 응답으로 본다
let crackLast = { id: '', key: '', text: '' };
function crackKey(g, text) {
  const id = g.getAttribute('data-message-group-id') || '';
  if (id === crackLast.id) { crackLast.text = text; return crackLast.key; }
  if (crackLast.key && text && text === crackLast.text) { crackLast.id = id; return crackLast.key; }
  crackLast = { id, key: 'g' + id, text };
  return crackLast.key;
}
const keyOf = (el) => {
  if (!el.dataset.crionId) el.dataset.crionId = String(++idSeq);
  return el.dataset.crionId;
};

// 대화 칸(입력창과 같은 세로 줄)의 스크롤 상자에서 메시지 상자들을 찾는다 — 프롤로그·지난 대화 읽기용
function columnMessages(input) {
  const col = columnOf();
  if (!col) return [];
  const boxes = scrollables().filter(el => !el.contains(input) && inColumn(el, col) && !el.closest('nav, aside, header, footer'));
  let list = boxes.sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];
  if (!list) {
    // 스크롤 상자가 없으면: 입력창 위쪽 형제 중 글이 가장 많은 것
    for (let e = input.parentElement, i = 0; e && i < 6 && !list; e = e.parentElement, i++) {
      const sib = [...e.parentElement ? e.parentElement.children : []].filter(x => x !== e && !x.contains(input) && inColumn(x, col) && (x.innerText || '').length > 40);
      if (sib.length) list = sib.sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];
    }
  }
  if (!list) return [];
  return messages(list).filter(m => inColumn(m, col) && !m.closest('nav, aside, header, footer') && (m.innerText || '').trim().length >= 10);
}

// 지금 보여 줄 응답: ① 보낸 직후면 새로 생긴 글자 ② 크랙 규칙 ③ 배운 모양. 셋 다 없으면 아무것도 안 읽는다
// (예전처럼 페이지 전체 글자를 응답으로 오해하지 않도록)
function latest() {
  const input = findInput();
  if (!input) return { input: false, msgs: 0, how: 'no-chat' };   // 채팅 화면이 아니면 아무것도 읽지 않는다
  const gs = crackGroups();
  if (gs) {
    watch = null;
    const ai = gs.filter(g => !isUserGroup(g));
    const lastG = gs[gs.length - 1];
    if (isUserGroup(lastG)) return { input: true, msgs: gs.length, mine: true, waiting: !!lastSent, how: 'crack' };   // 내 말이 마지막 = 응답 기다리는 중
    const el = lastG.querySelector('.wrtn-markdown') || lastG;
    const text = (el.innerText || '').trim();
    return { input: true, msgs: gs.length, el, text, mine: false, key: crackKey(lastG, text), all: ai.map(g => g.querySelector('.wrtn-markdown') || g), how: 'crack' };
  }
  if (watch) {
    const root = newRoot();
    if (root) return { input: !!input, msgs: 1, el: root, text: (root.innerText || '').trim(), mine: false, key: watch.key, how: 'new' };
    return { input: !!input, msgs: 0, waiting: !!lastSent, how: 'new' };
  }
  let msgs = [];
  let how = 'none';
  if (rules.msgSel) { msgs = qa(rules.msgSel).filter(visible); how = 'rules'; }
  else if (learned) { msgs = bySig(learned); how = 'learned'; }
  // 아직 모양을 모르거나(첫 플레이) 배운 모양에 안 맞는 글(프롤로그 등): 대화 칸 안의 마지막 글 상자를 읽는다
  if (!msgs.length) { msgs = columnMessages(input); if (msgs.length) how = 'column'; }
  if (!msgs.length) return { input: !!input, msgs: 0, how, unknown: how === 'none' };
  const last = msgs[msgs.length - 1];
  const text = (last.innerText || '').trim();
  const mine = !!lastSent && text.replace(/\s+/g, ' ') === lastSent.replace(/\s+/g, ' ');
  return { input: !!input, msgs: msgs.length, el: last, text, mine, all: msgs, how };
}

function scan() {
  timer = null;
  if (!active) return;
  const L = latest();
  if (!L) return;
  if (!L.el || L.mine) { send('crion:state', { input: L.input, msgs: L.msgs, waiting: !!(L.mine || L.waiting), unknown: !!L.unknown }); return; }
  const key = L.key || keyOf(L.el);
  const segs = segments(L.el);
  const sig = key + '|' + L.text.length + '|' + segs.filter(s => s.t === 'img').length;
  if (sig === lastSig && doneSent && key === lastKey) return;
  const changed = sig !== lastSig;
  lastSig = sig;
  if (key !== lastKey) { lastKey = key; doneSent = false; }
  if (changed) {
    send('crion:reply', { key, segs, done: false, input: L.input, url: location.href });
    clearTimeout(stableTimer);
    stableTimer = setTimeout(() => {           // 2초 동안 그대로면 다 쓴 것
      const again = latest();
      if (again && again.el && again.text === L.text) {
        doneSent = true;
        const el = again.el;
        if (L.how === 'new') {
          // 응답 상자 모양을 배워 두고(다음에 열 때 바로 읽기), 같은 응답으로 이어지게 표시
          el.dataset.crionId = key;
          if (inColumn(el, columnOf()) && !el.closest('a[href], nav, aside')) {
            learned = sigOf(el);
            send('crion:learned', learned);
          }
          watch = null;
        }
        send('crion:reply', { key, segs: segments(el), done: true, input: again.input, url: location.href });
      }
    }, 2000);
  }
}

// 지난 대화 전체 (로그용, 요청할 때만)
ipcRenderer.on('crion:history', () => {
  const L = latest();
  const items = L && L.all ? L.all.slice(-60).map(m => ({ key: keyOf(m), text: (m.innerText || '').trim().slice(0, 4000) })) : [];
  send('crion:history', { items });
});

function schedule(ms) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(scan, ms);
}

// ---------- 진단 ----------
function outline(el, depth) {
  if (!el || depth > 5) return '';
  const cls = (typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const attrs = ['role', 'aria-label', 'data-testid'].map(a => el.getAttribute && el.getAttribute(a) ? `${a}="${el.getAttribute(a).slice(0, 24)}"` : '').filter(Boolean).join(' ');
  const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(' ').slice(0, 24);
  let s = '  '.repeat(depth) + el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (attrs ? ' ' + attrs : '') + ` [${(el.innerText || '').length}]` + (own ? ` "${own}"` : '') + '\n';
  if (el.tagName === 'IMG') s += '  '.repeat(depth + 1) + `img ${(el.currentSrc || el.src || '').replace(/\?.*$/, '').slice(-60)} alt="${(el.alt || '').slice(0, 30)}" ${el.naturalWidth}x${el.naturalHeight}\n`;
  for (const c of [...el.children].slice(0, 8)) s += outline(c, depth + 1);
  return s;
}
ipcRenderer.on('crion:diag', () => {
  const input = findInput();
  const list = findList(input);
  const msgs = list ? messages(list) : [];
  const btn = input ? findSendButton(input) : null;
  const desc = (el) => el ? el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (el.getAttribute('aria-label') ? `[aria-label="${el.getAttribute('aria-label')}"]` : '') : null;
  const inputs = qa('textarea, [contenteditable="true"]').map(el => {
    const r = el.getBoundingClientRect();
    return `${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.top)} "${(el.getAttribute('placeholder') || '').slice(0, 30)}"`;
  });
  send('crion:diag', {
    title: document.title, chat: !!input, size: `${window.innerWidth}x${window.innerHeight}`, inputs, play: active,
    actions: pageActions(!!input).map(x => `${x.kind}:${x.label}${x.hidden ? '(숨김)' : ''}`),
    buttons: [...new Set(qa('button, a[href], [role="button"], [role="menuitem"]').map(b => labelOf(b) + (visible(b) ? '' : '(숨김)')).filter(t => t && t.length <= 24))].slice(0, 80),
    url: location.href.replace(/[?#].*$/, ''),
    input: desc(input),
    send: desc(btn),
    list: desc(list),
    messages: msgs.length,
    crack: (() => { const gs = crackGroups(); return gs ? { groups: gs.length, users: gs.filter(isUserGroup).length, last: groupText(gs[gs.length - 1]).slice(0, 80) } : null; })(),
    learned,
    watching: !!watch,
    lastTwo: msgs.slice(-2).map(m => outline(m, 0)).join('\n---\n').slice(0, 6000),
    segs: msgs.length ? segments(msgs[msgs.length - 1]).slice(0, 30) : []
  });
});

function start() {
  observer = new MutationObserver(() => { if (active) schedule(150); });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  lastUrl = location.href;
  let lastChat = !!findInput();
  send('crion:url', { url: lastUrl, title: document.title, chat: lastChat });
  setInterval(() => {
    const chat = !!findInput();
    if (location.href !== lastUrl || chat !== lastChat) {
      const moved = location.href !== lastUrl;
      lastUrl = location.href; lastChat = chat;
      send('crion:url', { url: lastUrl, title: document.title, chat });
      if (moved) { lastSig = ''; lastKey = ''; doneSent = false; watch = null; schedule(400); }
    }
    if (active) {
      const k = pageKind();
      const sig = k.page + '|' + k.actions.map(a => a.label).join(',') + '|' + location.href + '|' + (k.msgs == null ? '' : k.msgs) + '|' + (k.users == null ? '' : k.users);
      if (sig !== lastHas) { lastHas = sig; send('crion:state', { input: k.page === 'chat', page: k.page, actions: k.actions, msgs: k.msgs, users: k.users, url: location.href, poll: true }); }
    }
  }, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
