// 브라우저에서 화면만 점검하기 위한 가짜 window.crion (Electron 없이)
(function () {
  const settings = { onboarded: true, volume: 60, textSpeed: 'fast', choiceSend: true, autoUpdate: true, workUrls: {}, recent: ['w1'], registryUrl: '' };
  const works = [
    { id: 'w1', name: '아포칼립스 안전지대의 관리자', genre: '좀비 생존 운영', url: 'https://crack.wrtn.ai/detail/a', thumb: 'img/t1.png', guide: '# 시작 팁\n- 첫날은 **식량**부터 확보하세요\n- 밤에는 바리케이드를 점검\n\n# 생존자\n세라는 의무실, 카일은 정찰 담당이에요.' },
    { id: 'w2', name: '마법소녀의 최종보스', genre: '샌드박스', url: 'https://crack.wrtn.ai/detail/b', thumb: 'img/t2.png' },
    { id: 'w3', name: '이종족 길드의 유일한 남자', genre: '판타지 모험', url: 'https://crack.wrtn.ai/detail/c', thumb: 'img/t3.png' },
    { id: 'w4', name: '크랙대학교', genre: '캠퍼스 로맨스 코미디', url: '', thumb: '' },
    { id: 'w5', name: '평가혜', genre: '캐릭터챗', url: 'https://crack.wrtn.ai/detail/e', thumb: '', auto: true }
  ];
  window.crion = {
    info: async () => ({ version: '0.3.0', engineVersion: '0.3.0', engineSource: 'bundled', crackOrigin: 'https://crack.wrtn.ai', platform: 'darwin', updatesEnabled: true, links: {} }),
    engineReady: async () => true,
    getSettings: async () => JSON.parse(JSON.stringify(settings)),
    setSettings: async (p) => { Object.assign(settings, p); return JSON.parse(JSON.stringify(settings)); },
    getWorks: async () => ({ works, creatorUrl: 'https://share.crack.wrtn.ai/le3go2', syncedAt: '2026-10-24T10:00:00Z' }),
    syncWorks: async () => ({ ok: true, count: 5, sample: [] }),
    checkUpdates: async () => ({}), relaunch: async () => {}, openFolder: async () => {},
    copy: async (t) => { window.__copied = t; }, openExternal: async () => {},
    onUpdate: () => () => {}
  };
  window.__sent = [];
  HTMLElement.prototype.send = function (ch, d) { window.__sent.push([ch, d]); }; // webview 흉내
})();
