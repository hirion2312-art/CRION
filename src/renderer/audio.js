// 장면 BGM: 두 개의 오디오를 번갈아 쓰며 부드럽게 넘긴다(크로스페이드)
(function (root) {
  'use strict';
  const FADE_MS = 2000;

  function Bgm() {
    this.a = new Audio();
    this.b = new Audio();
    [this.a, this.b].forEach(el => { el.loop = true; el.volume = 0; el.preload = 'auto'; });
    this.cur = this.a;
    this.src = null;
    this.level = 0.6;
    this.paused = false;
    this.fadeTimer = null;
    this.onError = null;
  }

  Bgm.prototype.setVolume = function (v) {
    this.level = Math.max(0, Math.min(1, v));
    if (!this.fadeTimer && !this.paused) this.cur.volume = this.level;
  };

  Bgm.prototype.play = function (src) {
    if (!src || src === this.src) return;
    this.src = src;
    const next = this.cur === this.a ? this.b : this.a;
    const prev = this.cur;
    next.src = src;
    next.currentTime = 0;
    next.volume = 0;
    next.onerror = () => { if (this.onError) this.onError(src); };
    this.cur = next;
    if (this.paused) return;
    next.play().catch(() => {});
    this.fade(prev, next);
  };

  Bgm.prototype.fade = function (from, to) {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const start = performance.now();
    const fromVol = from.volume;
    this.fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / FADE_MS);
      from.volume = fromVol * (1 - k);
      to.volume = this.level * k;
      if (k >= 1) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        from.pause();
      }
    }, 50);
  };

  Bgm.prototype.toggle = function () {
    this.paused = !this.paused;
    if (this.paused) { this.a.pause(); this.b.pause(); }
    else if (this.src) { this.cur.volume = this.level; this.cur.play().catch(() => {}); }
    return this.paused;
  };

  Bgm.prototype.stop = function () {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    this.fadeTimer = null;
    [this.a, this.b].forEach(el => { el.pause(); el.volume = 0; });
    this.src = null;
  };

  root.CrionBgm = Bgm;
})(window);
