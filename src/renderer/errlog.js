// 앱 화면에서 난 오류를 최근 30개까지 모아 둔다 (오류 제보에 자동 첨부)
(function () {
  const list = window.__crionErrs = [];
  const push = (msg) => { list.push({ at: Date.now(), msg: String(msg || '').slice(0, 300) }); if (list.length > 30) list.shift(); };
  window.addEventListener('error', (e) => push((e.message || '오류') + (e.filename ? ` @${String(e.filename).split('/').pop()}:${e.lineno}` : '')));
  window.addEventListener('unhandledrejection', (e) => push('약속 실패: ' + ((e.reason && (e.reason.message || e.reason)) || '')));
})();
