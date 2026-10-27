// CRION 안드로이드 껍데기 → 화면 엔진 다리 (컴퓨터판 src/preload-host.js 와 같은 window.crion 을 만든다)
//  화면 엔진(src/renderer)은 컴퓨터판과 같은 파일. 엔진이 쓰는 <webview id="crack"> 는 여기서 흉내 낸다:
//   - 실제 크랙 화면은 안드로이드 쪽 별도 WebView. 이 글은 <webview> 자리의 위치·크기를 알려 주고, 그 자리에 크랙 화면을 겹친다
//   - 플레이팩 화면(#pk)이 덮고 있거나 겹창이 떠 있으면 크랙 화면을 게임 화면 '아래'로 보낸다 (크랙 화면은 계속 살아 있음)
//   - webview.send / loadURL / reload / goBack / canGoBack, 이벤트 did-start-loading · did-stop-loading · did-fail-load · dom-ready · ipc-message
(function () {
  'use strict';
  if (window.crion || window.top !== window) return;
  const host = window.CrionHost;   // 안드로이드 WebMessageListener 가 넣어 준 통로
  if (!host) return;
  let seq = 0;
  const pend = {};
  const subs = [];
  function call(op, arg) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pend[id] = { resolve, reject };
      host.postMessage(JSON.stringify({ id, op, arg: arg === undefined ? null : arg }));
    });
  }
  const post = (op, arg) => { try { host.postMessage(JSON.stringify({ id: 0, op, arg: arg === undefined ? null : arg })); } catch (e) { /* 없음 */ } };

  // ---------- <webview> 흉내 ----------
  let cur = null, canBack = false, lastRect = '';
  const P = HTMLUnknownElement.prototype;
  const isWv = (el) => el && el.tagName === 'WEBVIEW';
  P.send = function (ch, d) { if (isWv(this)) post('wv:send', { ch, d }); };
  P.loadURL = function (u) { if (isWv(this)) post('wv:load', { url: String(u || '') }); };
  P.reload = function () { if (isWv(this)) post('wv:reload'); };
  P.goBack = function () { if (isWv(this)) post('wv:back'); };
  P.canGoBack = function () { return isWv(this) ? canBack : false; };

  function coverOn(el) {
    // 크랙 화면을 덮어야 하는 것: 켜진 플레이팩 화면, 앱 겹창(모달·사용법), 크랙 여는 중 가림막
    const view = el.parentElement;
    if (view && view.querySelector('.pk:not(.off)')) return true;
    if (document.querySelector('#layer > *, #tut > *')) return true;
    const wait = view && view.querySelector('.pwait:not(.gone)');
    if (wait) return true;
    return false;
  }
  function measure() {
    if (cur && !cur.isConnected) { cur = null; post('wv:hide'); lastRect = ''; }
    if (!cur) { const el = document.querySelector('webview'); if (el) attach(el); }
    if (cur) {
      const r = cur.getBoundingClientRect();
      const st = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), over: !coverOn(cur), dpr: window.devicePixelRatio || 1 };
      const k = JSON.stringify(st);
      if (k !== lastRect) { lastRect = k; post('wv:rect', st); }
    }
  }
  function attach(el) {
    cur = el;
    lastRect = '';
    const src = el.getAttribute('src');
    if (src) post('wv:load', { url: src, first: true });
    measure();
  }
  const mo = new MutationObserver(() => measure());
  function boot() {
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    window.addEventListener('resize', measure);
    setInterval(measure, 400);
    measure();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // ---------- 안드로이드 → 엔진 ----------
  host.onmessage = (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.id && pend[m.id]) {
      const p = pend[m.id]; delete pend[m.id];
      if (m.error) p.reject(new Error(m.error)); else p.resolve(m.result);
      return;
    }
    const ev = m.ev;
    if (!ev) return;
    if (ev.type === 'update') { subs.forEach(fn => { try { fn(ev.data); } catch (err) { /* 무시 */ } }); return; }
    if (ev.type === 'back') {   // 안드로이드 뒤로 버튼: 플레이팩 안의 창(팩이 처리) → 앱 겹창 닫기 → 플레이 나가기 → 앱 닫기
      if (!document.dispatchEvent(new CustomEvent('crion-back', { cancelable: true }))) return;
      const x = document.querySelector('#layer [data-act=close-modal], #layer .close-x');
      if (x) { x.click(); return; }
      const leave = document.querySelector('[data-act=leave]');
      if (leave) { leave.click(); return; }
      post('app:finish');
      return;
    }
    if (ev.type === 'wv') {
      if (typeof ev.canGoBack === 'boolean') canBack = ev.canGoBack;
      if (!cur || !ev.name) return;
      const e2 = new Event(ev.name);
      if (ev.channel) e2.channel = ev.channel;
      if (ev.args) e2.args = ev.args;
      if (ev.errorCode != null) { e2.errorCode = ev.errorCode; e2.isMainFrame = true; e2.errorDescription = ev.errorDescription || ''; }
      if (ev.url) e2.url = ev.url;
      cur.dispatchEvent(e2);
    }
  };

  // ---------- window.crion (컴퓨터판 preload-host.js 와 같은 모양) ----------
  window.crion = {
    info: () => call('app:info'),
    engineReady: () => call('engine:ready'),
    getSettings: () => call('settings:get'),
    setSettings: (patch) => call('settings:set', patch || {}),
    getWorks: () => call('works:get'),
    syncWorks: () => Promise.resolve({ ok: false, error: '안드로이드판에서는 작가 프로필 읽기를 하지 않아요' }),
    checkUpdates: () => call('updates:check'),
    relaunch: () => call('app:relaunch'),
    openFolder: () => Promise.resolve(false),
    copy: (text) => call('clipboard:write', String(text == null ? '' : text)),
    openExternal: (url) => call('shell:open', String(url || '')),
    onUpdate: (fn) => { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; }
  };
  post('host:hello');
})();
