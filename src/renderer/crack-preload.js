// 크랙 페이지 안에서 도는 스크립트 (화면 엔진과 함께 자동 업데이트됨)
// 하는 일: 최신 응답 읽기(쓰는 중에도), 그림 위치 기록, CRION 입력창에서 보낸 글을 크랙에 넣고 보내기
// 크랙 화면 구조를 모르는 상태에서도 돌도록 '모양'으로 찾는다. 틀리면 호스트가 rules로 선택자를 알려 준다.
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

const send = (ch, data) => { try { ipcRenderer.sendToHost(ch, data); } catch (e) { /* 호스트 없음 */ } };
const visible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
const q = (sel, root) => { try { return sel ? (root || document).querySelector(sel) : null; } catch (e) { return null; } };
const qa = (sel, root) => { try { return sel ? [...(root || document).querySelectorAll(sel)] : []; } catch (e) { return []; } };

ipcRenderer.on('crion:config', (_e, c) => {
  rules = (c && c.rules) || {};
  active = !!(c && c.play);
  lastSig = ''; lastKey = ''; doneSent = false;
  schedule(60);
});

// ---------- 입력창 ----------
function findInput() {
  const own = q(rules.inputSel);
  if (own && visible(own)) return own;
  const cands = qa('textarea, [contenteditable="true"], [role="textbox"], input[type="text"]')
    .filter((e) => visible(e) && !e.disabled && !e.readOnly);
  if (!cands.length) return null;
  // 화면 아래쪽에 있는 것이 채팅 입력창
  return cands.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
}

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
  const text = String((msg && msg.text) || '');
  const fillOnly = !!(msg && msg.fillOnly);
  const el = findInput();
  if (!el) { send('crion:sent', { ok: false, why: 'no-input' }); return; }
  setInput(el, text);
  if (fillOnly) { send('crion:sent', { ok: true, how: 'fill' }); return; }
  setTimeout(() => {
    const btn = findSendButton(el);
    lastSent = text.trim();
    doneSent = false;
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
  const re = ACTION_WORD[name];
  if (!re) return;
  const own = name === 'regen' ? q(rules.regenSel) : null;
  const btn = own || qa('button, [role="button"]').reverse().find(b => re.test((b.getAttribute('aria-label') || '') + ' ' + (b.title || '') + ' ' + (b.innerText || '').slice(0, 20)));
  if (btn) { btn.click(); doneSent = false; schedule(400); }
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
  if (!cands.length) return document.scrollingElement && document.body;
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
      if ((n.naturalWidth || r.width) < 48) return;          // 아이콘·이모지 그림은 뺀다
      flush();
      segs.push({ t: 'img', src, w: n.naturalWidth || Math.round(r.width), h: n.naturalHeight || Math.round(r.height), alt: (n.alt || n.title || '').slice(0, 80) });
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

const keyOf = (el) => {
  if (!el.dataset.crionId) el.dataset.crionId = String(++idSeq);
  return el.dataset.crionId;
};

function latest() {
  const input = findInput();
  const list = findList(input);
  if (!list) return null;
  const msgs = messages(list);
  if (!msgs.length) return { input: !!input, msgs: 0 };
  const last = msgs[msgs.length - 1];
  const text = (last.innerText || '').trim();
  const mine = !!lastSent && text.replace(/\s+/g, ' ') === lastSent.replace(/\s+/g, ' ');
  return { input: !!input, msgs: msgs.length, el: last, text, mine, all: msgs };
}

function scan() {
  timer = null;
  if (!active) return;
  const L = latest();
  if (!L) return;
  if (!L.el || L.mine) { send('crion:state', { input: L.input, msgs: L.msgs, waiting: !!L.mine }); return; }
  const key = keyOf(L.el);
  const segs = segments(L.el);
  const sig = key + '|' + L.text.length + '|' + segs.filter(s => s.t === 'img').length;
  if (sig === lastSig && doneSent && key === lastKey) return;
  const changed = sig !== lastSig;
  lastSig = sig;
  if (key !== lastKey) { lastKey = key; doneSent = false; }
  if (changed) {
    send('crion:reply', { key, segs, done: false, input: L.input, url: location.href });
    clearTimeout(stableTimer);
    stableTimer = setTimeout(() => {           // 1.6초 동안 그대로면 다 쓴 것
      const again = latest();
      if (again && again.el === L.el && (again.el.innerText || '').trim() === L.text) {
        doneSent = true;
        send('crion:reply', { key, segs: segments(L.el), done: true, input: again.input, url: location.href });
      }
    }, 1600);
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
  send('crion:diag', {
    url: location.href.replace(/[?#].*$/, ''),
    input: desc(input),
    send: desc(btn),
    list: desc(list),
    messages: msgs.length,
    lastTwo: msgs.slice(-2).map(m => outline(m, 0)).join('\n---\n').slice(0, 6000),
    segs: msgs.length ? segments(msgs[msgs.length - 1]).slice(0, 30) : []
  });
});

function start() {
  observer = new MutationObserver(() => { if (active) schedule(150); });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  lastUrl = location.href;
  send('crion:url', { url: lastUrl, title: document.title });
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSig = ''; lastKey = ''; doneSent = false;
      send('crion:url', { url: lastUrl, title: document.title });
      schedule(400);
    }
    if (active && !timer) {
      const has = !!findInput();
      if (has !== lastHas) { lastHas = has; send('crion:state', { input: has, poll: true }); }
    }
  }, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
