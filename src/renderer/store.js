// 작품별 내 기록: 플레이 횟수·시간, 등장인물, 그림 앨범, 별표 대사, 단축 문장 (이 컴퓨터에만 저장)
(function (root) {
  'use strict';
  const KEY = 'crion.w.';
  const MAX_ALBUM = 150, MAX_QUOTES = 200, MAX_CHARS = 60;

  function blank() {
    return { turns: 0, opens: 0, playMs: 0, firstAt: 0, lastAt: 0, chars: {}, album: [], quotes: [], quick: null };
  }

  function WorkStore(storage) {
    this.s = storage || null;
    this.cache = {};
  }
  WorkStore.prototype.get = function (id) {
    if (this.cache[id]) return this.cache[id];
    let v = null;
    try { v = this.s ? JSON.parse(this.s.getItem(KEY + id) || 'null') : null; } catch (e) { v = null; }
    const rec = Object.assign(blank(), v || {});
    this.cache[id] = rec;
    return rec;
  };
  WorkStore.prototype.save = function (id) {
    try { if (this.s) this.s.setItem(KEY + id, JSON.stringify(this.get(id))); } catch (e) { /* 저장 공간 부족 등 */ }
  };

  // 응답 하나를 다 받았을 때: 턴 수, 말한 인물, 나온 그림을 모은다
  WorkStore.prototype.recordTurn = function (id, beats, frames, now) {
    const r = this.get(id);
    now = now || Date.now();
    r.turns += 1;
    if (!r.firstAt) r.firstAt = now;
    r.lastAt = now;
    (beats || []).forEach((b, i) => {
      if (b.kind === 'say' && b.who && b.who.length <= 12) {
        const c = r.chars[b.who] || { lines: 0, first: now };
        c.lines += 1;
        c.last = b.text.slice(0, 120);
        c.at = now;
        const f = frames && frames[i];
        if (f && f.person && f.person.src) c.img = f.person.src;
        r.chars[b.who] = c;
      }
      for (const im of b.imgs || []) {
        if (!im.src || r.album.some(a => a.src === im.src)) continue;
        r.album.push({ src: im.src, w: im.w || 0, h: im.h || 0, who: b.who || '', at: now });
      }
    });
    if (r.album.length > MAX_ALBUM) r.album = r.album.slice(-MAX_ALBUM);
    const names = Object.keys(r.chars);
    if (names.length > MAX_CHARS) {
      names.sort((a, b) => r.chars[a].lines - r.chars[b].lines).slice(0, names.length - MAX_CHARS).forEach(n => delete r.chars[n]);
    }
    this.save(id);
    return r;
  };

  // 작품을 열 때마다: 횟수와 마지막 플레이 시각
  WorkStore.prototype.recordOpen = function (id, now) {
    const r = this.get(id);
    now = now || Date.now();
    r.opens = (r.opens || 0) + 1;
    if (!r.firstAt) r.firstAt = now;
    r.lastAt = now;
    this.save(id);
    return r;
  };

  WorkStore.prototype.addTime = function (id, ms) {
    if (!(ms > 0) || ms > 30 * 60 * 1000) return;   // 자리 비운 시간은 빼려고 한 번에 30분까지만
    this.get(id).playMs += ms;
    this.save(id);
  };

  const quoteKey = (q) => (q.who || '') + '|' + q.text;
  WorkStore.prototype.hasQuote = function (id, q) { return this.get(id).quotes.some(x => quoteKey(x) === quoteKey(q)); };
  WorkStore.prototype.toggleQuote = function (id, q, now) {
    const r = this.get(id);
    const k = quoteKey(q);
    const i = r.quotes.findIndex(x => quoteKey(x) === k);
    if (i >= 0) r.quotes.splice(i, 1);
    else { r.quotes.push({ who: q.who || '', text: q.text, at: now || Date.now() }); if (r.quotes.length > MAX_QUOTES) r.quotes.shift(); }
    this.save(id);
    return i < 0;
  };

  WorkStore.prototype.setQuick = function (id, list) {
    this.get(id).quick = (list || []).map(s => String(s).trim()).filter(Boolean).slice(0, 8);
    this.save(id);
  };

  // 모든 작품 합계 (홈의 '내 기록')
  WorkStore.prototype.totals = function (ids) {
    let turns = 0, playMs = 0, played = 0, quotes = 0, album = 0, opens = 0;
    for (const id of ids) {
      const r = this.get(id);
      turns += r.turns; playMs += r.playMs; quotes += r.quotes.length; album += r.album.length; opens += r.opens || 0;
      if (r.turns || r.opens || r.playMs) played++;
    }
    return { turns, playMs, played, quotes, album, opens };
  };

  function fmtTime(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + '분';
    const h = Math.floor(m / 60);
    return h + '시간' + (m % 60 ? ' ' + (m % 60) + '분' : '');
  }
  function ago(t, now) {
    if (!t) return '';
    const s = Math.max(0, ((now || Date.now()) - t) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전';
    if (s < 86400 * 30) return Math.floor(s / 86400) + '일 전';
    return new Date(t).toLocaleDateString('ko-KR');
  }

  const api = { WorkStore, fmtTime, ago };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CrionStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
