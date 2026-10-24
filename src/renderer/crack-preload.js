// 크랙 페이지 안에서 도는 스크립트 (화면 엔진과 함께 업데이트됨)
// 크랙 화면 구조(클래스 이름)에 기대지 않고, 팩이 알려 준 글자 패턴으로 상태창을 찾는다.
'use strict';
const { ipcRenderer } = require('electron');

let cfg = null;          // { detect, anchor, hide, chipText }
let re = null;
let observer = null;
let timer = null;
let pending = null;
let lastSent = null;
let lastKey = null;
let lastUrl = '';
const revealed = new WeakSet(); // 플레이어가 칩을 눌러 다시 펼친 상태창

const send = (ch, data) => { try { ipcRenderer.sendToHost(ch, data); } catch (e) { /* 호스트 없음 */ } };

ipcRenderer.on('crion:config', (_e, c) => {
  cfg = c && c.detect ? c : null;
  try { re = cfg ? new RegExp(cfg.detect, 'u') : null; } catch (e) { re = null; cfg = null; }
  lastSent = null;
  lastKey = null;
  pending = null;
  applyStyle();
  schedule(50);
});

function applyStyle() {
  let st = document.getElementById('crion-style');
  if (!st) {
    if (!document.head) return;
    st = document.createElement('style');
    st.id = 'crion-style';
    document.head.appendChild(st);
  }
  st.textContent = cfg && cfg.hide
    ? '[data-crion-status]{display:none!important}' +
      '[data-crion-chip]{display:inline-flex;align-items:center;gap:6px;margin:6px 0;padding:4px 10px;border-radius:8px;' +
      'background:rgba(127,127,127,.12);font:600 12px/1.4 system-ui,sans-serif;opacity:.85;cursor:pointer;user-select:none}'
    : '[data-crion-chip]{display:none!important}';
}

function inOurs(el) { return !!(el && el.closest && el.closest('[data-crion-chip]')); }

// 글자 패턴으로 상태창 요소 찾기 (가장 안쪽 요소)
function findStatusEls() {
  if (!cfg || !re || !document.body) return [];
  const anchor = cfg.anchor || '';
  const found = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.indexOf(anchor) !== -1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
  });
  let node;
  while ((node = walker.nextNode())) {
    let el = node.parentElement;
    for (let i = 0; el && i < 8; i++, el = el.parentElement) {
      if (inOurs(el)) break;
      if (re.test(el.innerText || el.textContent || '')) {
        // 상태창만 감싼 겉 상자(예: 코드 블록)까지 함께 잡는다
        const own = (el.innerText || '').trim();
        for (let j = 0; j < 4; j++) {
          const p = el.parentElement;
          if (!p || p === document.body || (p.innerText || '').trim() !== own) break;
          el = p;
        }
        found.push(el);
        break;
      }
    }
  }
  // 겹치면 안쪽만 남기기
  const uniq = [...new Set(found)].filter(a => !found.some(b => b !== a && a.contains(b)));
  uniq.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return uniq;
}


// 상태창이 들어 있는 말풍선(한 응답 전체)
function bubbleOf(el) {
  const raw = el.textContent || '';
  let cur = el.parentElement;
  for (let i = 0; cur && cur !== document.body && i < 4; i++) {
    const t = cur.textContent || '';
    if (t.length > raw.length + 8) return cur;
    cur = cur.parentElement;
  }
  return null;
}

// 응답 글과 그림을 읽는다 (상태창을 숨기기 전에 호출)
function collect(bubble) {
  if (!bubble) return { reply: '', imgs: [] };
  const reply = (bubble.innerText || bubble.textContent || '').replace(/\r/g, '').trim();
  const imgs = [];
  bubble.querySelectorAll('img').forEach((im) => {
    if (inOurs(im)) return;
    const src = im.currentSrc || im.src || '';
    if (!/^https?:|^data:image/.test(src)) return;
    imgs.push({ src, w: im.naturalWidth || im.width || 0, h: im.naturalHeight || im.height || 0, alt: (im.alt || '').slice(0, 80) });
  });
  return { reply, imgs: imgs.slice(0, 12) };
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h);
}

// 【CRION】…【/CRION】 표식 덩어리는 채팅에서도 접어 둔다 (한 덩어리일 때만)
function hideCtrl(bubble) {
  if (!bubble || !cfg || !cfg.hide) return;
  bubble.querySelectorAll('p, div, pre, code, span').forEach((el) => {
    if (el.hasAttribute('data-crion-status') || inOurs(el)) return;
    const t = (el.textContent || '').trim();
    if (!/^【CRION】[\s\S]*【\/CRION】$/.test(t)) return;
    if ([...el.children].some(c => /^【CRION】[\s\S]*【\/CRION】$/.test((c.textContent || '').trim()))) return;
    el.setAttribute('data-crion-status', '1');
  });
}

// 선택지 글을 크랙 입력창에 채운다 (전송은 플레이어가 직접)
function findInput() {
  const cands = [...document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')]
    .filter((e) => e.offsetParent !== null && !e.disabled && !e.readOnly);
  return cands.length ? cands[cands.length - 1] : null;
}
ipcRenderer.on('crion:fill', (_e, text) => {
  const el = findInput();
  if (!el) { send('crion:filled', { ok: false }); return; }
  el.focus();
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, String(text));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, String(text));
  }
  send('crion:filled', { ok: true });
});

// 크랙 화면 구조 진단 (붙여넣어 보내 주면 인식 규칙을 맞출 수 있음)
function outline(el, depth) {
  if (!el || depth > 4) return '';
  const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(' ').slice(0, 30);
  let s = '  '.repeat(depth) + el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ` [${(el.textContent || '').length}]` + (own ? ' "' + own + '"' : '') + '\n';
  if (el.tagName === 'IMG') s += '  '.repeat(depth + 1) + `img ${(el.currentSrc || el.src || '').replace(/\?.*$/, '').slice(0, 120)} alt="${(el.alt || '').slice(0, 40)}" ${el.naturalWidth}x${el.naturalHeight}\n`;
  for (const c of [...el.children].slice(0, 12)) s += outline(c, depth + 1);
  return s;
}
ipcRenderer.on('crion:diag', () => {
  const els = findStatusEls();
  const last = els[els.length - 1];
  const bubble = last ? bubbleOf(last) : null;
  const lines = bubble ? (bubble.innerText || '').split('\n').map(l => l.slice(0, 36)) : [];
  send('crion:diag', {
    url: location.href.replace(/[?#].*$/, ''),
    statusFound: els.length,
    config: cfg ? { hide: cfg.hide, anchor: cfg.anchor } : null,
    input: (() => { const i = findInput(); return i ? i.tagName.toLowerCase() : null; })(),
    outline: bubble ? outline(bubble, 0) : (last ? outline(last, 0) : ''),
    lines: lines.slice(0, 60)
  });
});

// 상태창 주변 본문(장면 키워드 판단용)
function narrationAround(el, statusText) {
  // 숨긴 상태창도 포함해서 세도록 textContent 사용, 같은 말풍선 안에서만 찾는다
  const raw = el.textContent || '';
  let cur = el.parentElement;
  for (let i = 0; cur && cur !== document.body && i < 4; i++) {
    const t = cur.textContent || '';
    if (t.length > raw.length + 8) return t.replace(raw, '').slice(-1500);
    cur = cur.parentElement;
  }
  return '';
}

// 본문과 상태창이 한 덩어리면 숨기지 않는다 (줄의 80% 이상이 상태창 줄일 때만 숨김)
function mostlyStatus(el) {
  if (!cfg.lineHint) return true;
  let hint;
  try { hint = new RegExp(cfg.lineHint, 'u'); } catch (e) { return true; }
  const text = el.innerText || el.textContent || '';   // 아직 보일 때 판단해야 줄바꿈(<br>)이 살아 있음
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length <= 1) return text.length < 400;
  const hits = lines.filter(l => hint.test(l)).length;
  return hits / lines.length >= 0.8;
}

const decided = new WeakMap(); // 요소마다 숨길지 한 번만 정한다 (숨긴 뒤엔 글자 모양이 달라져서)

function decorate(els) {
  for (const el of els) {
    let ok = decided.get(el);
    if (ok === undefined) { ok = mostlyStatus(el); decided.set(el, ok); }
    if (cfg.hide && ok) {
      if (!revealed.has(el) && !el.hasAttribute('data-crion-status')) el.setAttribute('data-crion-status', '1');
      const prev = el.previousElementSibling;
      if (!(prev && prev.hasAttribute && prev.hasAttribute('data-crion-chip'))) {
        const chip = document.createElement('span');
        chip.setAttribute('data-crion-chip', '1');
        chip.title = '눌러서 원래 상태창 보기';
        chip.textContent = cfg.chipText || '상태창 → CRION 대시보드';
        chip.addEventListener('click', () => {
          if (revealed.has(el)) { revealed.delete(el); el.setAttribute('data-crion-status', '1'); }
          else { revealed.add(el); el.removeAttribute('data-crion-status'); }
          if (observer) observer.takeRecords();
        });
        el.parentElement && el.parentElement.insertBefore(chip, el);
      }
    } else if (el.hasAttribute('data-crion-status')) {
      el.removeAttribute('data-crion-status');
    }
  }
  if (observer) observer.takeRecords(); // 내가 바꾼 건 무시
}

// 숨기기 전에 읽어 둔 글(줄바꿈 포함)을 기억해서, 숨긴 뒤에도 같은 글로 본다
const textOf = new WeakMap();
function statusText(el) {
  if (!el.hasAttribute('data-crion-status')) textOf.set(el, (el.innerText || el.textContent || '').trim());
  return textOf.get(el) || (el.textContent || '').trim();
}

function scan() {
  timer = null;
  if (!cfg) return;
  const els = findStatusEls();
  if (!els.length) return;
  const last = els[els.length - 1];
  const text = statusText(last);
  const bubble = cfg.reply ? bubbleOf(last) : null;
  // 응답이 아직 써지는 중이면 기다렸다가 (상태창·본문이 함께 그대로일 때) 보낸다
  const sig = text + '\u0001' + (bubble ? (bubble.textContent || '').length : 0);
  if (sig !== pending) { decorate(els.slice(0, -1)); pending = sig; schedule(900); return; }
  const info = collect(bubble);              // 숨기기 전에 읽는다
  decorate(els);
  hideCtrl(bubble);
  const key = els.length + '|' + hash(bubble ? info.reply : text);
  if (key === lastKey) return;
  lastKey = key;
  lastSent = text;
  send('crion:status', {
    text, narration: narrationAround(last, text), count: els.length, url: location.href,
    reply: info.reply, imgs: info.imgs, key
  });
}

function schedule(ms) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(scan, ms);
}

function start() {
  applyStyle();
  observer = new MutationObserver(() => schedule(700));
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  lastUrl = location.href;
  send('crion:ready', { url: lastUrl });
  send('crion:url', { url: lastUrl, title: document.title });
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSent = null;
      lastKey = null;
      pending = null;
      send('crion:url', { url: lastUrl, title: document.title });
      schedule(400);
    }
  }, 800);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
