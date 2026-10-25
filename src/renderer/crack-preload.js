// 크랙 화면(webview) 안에서 도는 작은 도우미 — 0.4부터는 크랙 화면을 그대로 쓴다.
//  - 응답을 읽거나 대신 보내지 않는다 (예전 공용 게임 화면은 archive/common-game-ui 에 보관)
//  - 하는 일: 지금 주소와 '대화 화면인지'만 CRION에 알려 준다 → 이어하기 주소 기억용
//  - 문제 신고용 화면 진단(주소·제목·입력창 수)
'use strict';
const { ipcRenderer } = require('electron');

// 댓글·검색 칸이 아닌, 화면 아래쪽에 있는 대화 입력창이 있으면 대화 화면으로 본다
const NOT_CHAT = /댓글|comment|검색|search|리뷰|review|답글|reply/i;
function chatInput() {
  const vh = window.innerHeight || 800;
  const list = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
  return list.find(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 200 || r.height < 16) return false;
    if (r.top < vh * 0.45) return false;
    const label = [el.getAttribute('placeholder'), el.getAttribute('aria-label'), el.name, el.id].join(' ');
    return !NOT_CHAT.test(label);
  }) || null;
}

let last = '';
function report() {
  const url = location.href;
  const chat = !!chatInput();
  const key = url + '|' + chat;
  if (key === last) return;
  last = key;
  ipcRenderer.sendToHost('crion:url', { url, chat, title: document.title });
}

window.addEventListener('DOMContentLoaded', () => {
  report();
  setInterval(report, 1500);
});

ipcRenderer.on('crion:diag', () => {
  const inputs = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]')).map(el => {
    const r = el.getBoundingClientRect();
    return `${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.top)} "${(el.getAttribute('placeholder') || '').slice(0, 30)}"`;
  });
  ipcRenderer.sendToHost('crion:diag', {
    url: location.href, title: document.title, chat: !!chatInput(),
    size: `${window.innerWidth}x${window.innerHeight}`, inputs
  });
});
