// 플레이팩 실행기 — 3D 야구 프로토타입 (runner: "baseball", 작품 연결 없이 CRION 안에서만: manifest standalone)
//  규칙·물리는 pk-baseball-sim.js (CrionBaseballSim). 3D는 three.js(vendor/three.min.js, 처음 켤 때 한 번 불러옴)
//  나중에 다른 플레이팩(경기 장면)에서 쓰도록 window.CrionBaseball.create(el, opt) 로도 연다
(function (root) {
  'use strict';
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const BASE = SRC.replace(/[^/]*$/, '');
  let threeP = null;
  const addScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });
  function loadThree() {
    if (root.THREE && root.THREE.GLTFLoader) return Promise.resolve(root.THREE);
    if (!threeP) threeP = (root.THREE ? Promise.resolve() : addScript(BASE + 'vendor/three.min.js'))
      .then(() => root.THREE.GLTFLoader ? null : addScript(BASE + 'vendor/three-gltf.js'))
      .then(() => root.THREE).catch((e) => { threeP = null; throw e; });
    return threeP;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const PREF_KEY = 'crion.bb.prefs';
  const DEF = () => ({ diff: 'normal', innings: 3, sound: true, zone: true, hq: !(root.matchMedia && root.matchMedia('(pointer: coarse)').matches) });
  const loadPrefs = () => { try { return Object.assign(DEF(), JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { return DEF(); } };
  const savePrefs = (p) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* 저장 못 해도 계속 */ } };

  const MODES = {
    game: { name: '빠른 경기', desc: '초엔 내가 치고, 말엔 내가 던져요', icon: '⚾' },
    bat: { name: '타격 연습', desc: '컴퓨터 투수의 공을 계속 쳐요', icon: '🏏' },
    pitch: { name: '투구 연습', desc: '구종·코스를 골라 타자를 잡아요', icon: '🎯' },
    derby: { name: '홈런 더비', desc: '아웃 10개 전에 홈런을 최대한', icon: '💥' }
  };

  // ---------- 소리 (WebAudio로 만든 짧은 소리) ----------
  function makeSound(on) {
    let ctx = null, crowd = null, crowdGain = null;
    const ok = () => { if (!on()) return null; try { if (!ctx) ctx = new (root.AudioContext || root.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { return null; } return ctx; };
    const noise = (c, dur) => { const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
    function burst(freq, q, dur, vol, type) {
      const c = ok(); if (!c) return;
      const s = c.createBufferSource(); s.buffer = noise(c, dur);
      const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start();
    }
    function thump(freq, dur, vol) {
      const c = ok(); if (!c) return;
      const o = c.createOscillator(); o.frequency.setValueAtTime(freq, c.currentTime); o.frequency.exponentialRampToValueAtTime(freq * 0.4, c.currentTime + dur);
      const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur);
    }
    return {
      crack(q) { burst(2600, 1.2, 0.09, 0.55 + 0.4 * q); thump(180, 0.12, 0.5 * q + 0.15); },
      mitt() { burst(1400, 1.6, 0.06, 0.5); thump(120, 0.08, 0.3); },
      whoosh() { burst(700, 0.7, 0.22, 0.12, 'lowpass'); },
      cheer(v) {
        const c = ok(); if (!c) return;
        if (!crowd) {
          crowd = c.createBufferSource(); crowd.buffer = noise(c, 3); crowd.loop = true;
          const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.4;
          crowdGain = c.createGain(); crowdGain.gain.value = 0.02;
          crowd.connect(f); f.connect(crowdGain); crowdGain.connect(c.destination); crowd.start();
        }
        const t = c.currentTime; crowdGain.gain.cancelScheduledValues(t); crowdGain.gain.setValueAtTime(crowdGain.gain.value, t);
        crowdGain.gain.linearRampToValueAtTime(0.02 + 0.16 * v, t + 0.3); crowdGain.gain.linearRampToValueAtTime(0.02, t + 2.8 + 2 * v);
      },
      stop() { try { if (crowd) crowd.stop(); if (ctx) ctx.close(); } catch (e) { /* 이미 닫힘 */ } crowd = null; ctx = null; }
    };
  }

  // ---------- 캔버스 그림(잔디·흙·하늘·전광판 글자) ----------
  function canvasTex(T, w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function speckle(g, w, h, n, cols, a) { for (let i = 0; i < n; i++) { g.globalAlpha = a * Math.random(); g.fillStyle = cols[i % cols.length]; const s = 1 + Math.random() * 2; g.fillRect(Math.random() * w, Math.random() * h, s, s); } g.globalAlpha = 1; }

  function create(el, opt) {
    opt = opt || {};
    const SIM = root.CrionBaseballSim;
    const prefs = loadPrefs();
    const snd = makeSound(() => prefs.sound);
    const wrap = document.createElement('div'); wrap.className = 'bb';
    wrap.innerHTML = `<div class="bb-stage"></div>
      <div class="bb-hud" hidden>
        <div class="bb-sb"></div>
        <div class="bb-tr"><button class="bb-ib" data-bb="pause" title="처음 화면">⏸</button><button class="bb-ib" data-bb="menu" title="메뉴">⋯</button></div>
        <div class="bb-pinfo"></div>
        <div class="bb-batter"></div>
        <div class="bb-call"></div>
        <div class="bb-stat"></div>
        <div class="bb-help"></div>
        <div class="bb-pbar"></div>
        <div class="bb-log"></div>
      </div>
      <div class="bb-title"></div>
      <div class="bb-modal" hidden></div>
      <div class="bb-load"><i></i><span>구장을 짓는 중…</span></div>`;
    el.appendChild(wrap);
    const $ = (s) => wrap.querySelector(s);
    const hud = $('.bb-hud'), titleEl = $('.bb-title'), modalEl = $('.bb-modal');
    let T, renderer, scene, cam, raf = 0, dead = false, clockLast = 0, now = 0;
    const W = {};        // 3D 물체
    let G = null;        // 경기 상태
    let mode = 'title';
    let phase = 'idle';  // idle | wait | pitch | play | after | p_select | p_aim | p_meter | over
    let P = null;        // 지금 투구 { path, t0, swingAt, contact, ... }
    let play = null;     // 지금 타구 연출
    let cursor = { x: 0, y: 0.78 }, aim = null, meter = null, pitchType = 'FB';
    let camGoal = null, camLook = null, camLookCur = null, orbit = 0;
    let dbgCam = false, lastShot = null, pendingNext = 0, toastT = 0, timeScale = 1, autoSwing = null, fps = 0, fpsN = 0, fpsT = 0;
    const isTouch = () => { try { return root.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
    const portrait = () => el.clientHeight > el.clientWidth * 1.05;
    const userBats = () => mode === 'bat' || mode === 'derby' || (mode === 'game' && G && G.half === 0);
    const D = () => SIM.DIFF[prefs.diff] || SIM.DIFF.normal;

    // ---------- 3D 구장 ----------
    function build() {
      T = root.THREE;
      renderer = new T.WebGLRenderer({ antialias: prefs.hq, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.capture });
      renderer.setPixelRatio(prefs.hq ? Math.min(2, root.devicePixelRatio || 1) : Math.min(1.25, root.devicePixelRatio || 1));
      renderer.outputEncoding = T.sRGBEncoding;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = !!prefs.hq; renderer.shadowMap.type = T.PCFSoftShadowMap;
      $('.bb-stage').appendChild(renderer.domElement);
      scene = new T.Scene();
      scene.fog = new T.Fog(0x0a0e1c, 160, 520);
      cam = new T.PerspectiveCamera(40, 1, 0.05, 3000);
      cam.position.set(0, 30, 60); camLookCur = new T.Vector3(0, 0, -40);

      // 하늘 · 별
      const sky = canvasTex(T, 4, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#03040b'); gr.addColorStop(0.45, '#0b1230'); gr.addColorStop(0.7, '#1d1d45'); gr.addColorStop(0.86, '#4a2c4f'); gr.addColorStop(1, '#2a1f2e'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const skyM = new T.Mesh(new T.SphereGeometry(1500, 32, 16), new T.MeshBasicMaterial({ map: sky, side: T.BackSide, fog: false, depthWrite: false }));
      scene.add(skyM);
      const sg = new T.BufferGeometry(), sp = [];
      for (let i = 0; i < 700; i++) { const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.3; sp.push(1400 * Math.cos(e) * Math.cos(a), 1400 * Math.sin(e), 1400 * Math.cos(e) * Math.sin(a)); }
      sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
      scene.add(new T.Points(sg, new T.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 })));

      // 빛 (조명탑 느낌)
      scene.add(new T.HemisphereLight(0xa9bbff, 0x1d2a14, 0.55));
      const sun = new T.DirectionalLight(0xfff1dc, 1.35); sun.position.set(-40, 90, 50); sun.target.position.set(0, 0, -45);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 10, far: 260 }); sun.shadow.bias = -0.0006;
      scene.add(sun, sun.target);
      const fill = new T.DirectionalLight(0xc8d6ff, 0.45); fill.position.set(60, 70, -140); scene.add(fill);

      // 땅 (구장 밖)
      const ground = new T.Mesh(new T.CircleGeometry(700, 48), new T.MeshLambertMaterial({ color: 0x0b0f0c }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);

      // 잔디: 줄무늬 깎은 무늬
      const grassTex = canvasTex(T, 512, 512, (g, w, h) => {
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#2f7a34' : '#3a8a3d'; g.fillRect(0, i * h / 8, w, h / 8); }
        speckle(g, w, h, 9000, ['#215c26', '#4c9c4a', '#2a6d2e'], 0.5);
      });
      grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping; grassTex.repeat.set(1 / 48, 1 / 48); grassTex.rotation = Math.PI / 4;
      const dirtTex = canvasTex(T, 256, 256, (g, w, h) => { g.fillStyle = '#9b6a42'; g.fillRect(0, 0, w, h); speckle(g, w, h, 6000, ['#7d5232', '#b5845a', '#8a5c38'], 0.6); });
      dirtTex.wrapS = dirtTex.wrapT = T.RepeatWrapping; dirtTex.repeat.set(1 / 6, 1 / 6);
      const grassM = new T.MeshLambertMaterial({ map: grassTex });
      const dirtM = new T.MeshLambertMaterial({ map: dirtTex });
      const flat = (shape, mat, y, rough) => { const m = new T.Mesh(new T.ShapeGeometry(shape, 48), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; scene.add(m); return m; };
      const toS = (x, z) => new T.Vector2(x, -z);   // 바닥 도형 좌표 (rotation -90° 하면 z가 된다)
      // 파울 지역까지 깔린 잔디
      const all = new T.Shape(); { const pts = []; for (let a = -180; a <= 180; a += 3) { const r = SIM.standR(a) + 0.5; pts.push(toS(r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180))); } all.setFromPoints(pts); }
      const darkGrass = new T.MeshLambertMaterial({ map: grassTex, color: 0xc9d9c6 });
      flat(all, darkGrass, 0);
      // 경고 트랙 (담장 앞 흙)
      const track = new T.Shape(), tp = [];
      for (let a = -45; a <= 45; a += 1.5) { const r = SIM.fenceR(a); tp.push(toS(r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180))); }
      for (let a = 45; a >= -45; a -= 1.5) { const r = SIM.fenceR(a) - 4.6; tp.push(toS(r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180))); }
      track.setFromPoints(tp); flat(track, new T.MeshLambertMaterial({ map: dirtTex, color: 0xb59a86 }), 0.01);
      // 내야 흙: 마운드 중심 원호 + 파울 라인
      const M = { x: 0, z: -18.44 }, ARC = 28.9;
      const dline = 13.04 + Math.sqrt(13.04 * 13.04 - (18.44 * 18.44 - ARC * ARC));
      const inf = new T.Shape(), ip = [toS(0, 3.2)];
      ip.push(toS(-(dline + 1) * 0.7071 - 1.2, -(dline + 1) * 0.7071 + 1.2));
      for (let a = -50; a <= 50; a += 2) { ip.push(toS(M.x + ARC * Math.sin(a * Math.PI / 180), M.z - ARC * Math.cos(a * Math.PI / 180))); }
      ip.push(toS((dline + 1) * 0.7071 + 1.2, -(dline + 1) * 0.7071 + 1.2));
      inf.setFromPoints(ip); flat(inf, dirtM, 0.02);
      // 내야 잔디 (베이스 사이)
      const C = { x: 0, z: -19.4 }, k = 0.86, dia = [SIM.BASES[0], SIM.BASES[1], SIM.BASES[2], SIM.BASES[3]].map(b => toS(C.x + k * (b.x - C.x), C.z + k * (b.z - C.z)));
      const ig = new T.Shape(); ig.setFromPoints(dia); flat(ig, grassM, 0.03);
      // 홈 주변 · 마운드
      const circ = (x, z, r, y, mat) => { const m = new T.Mesh(new T.CircleGeometry(r, 40), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
      circ(0, -0.6, 4.2, 0.04, dirtM);
      const mound = new T.Mesh(new T.CylinderGeometry(1.9, 2.75, 0.25, 40), dirtM); mound.position.set(0, 0.125, -18.44); mound.receiveShadow = true; scene.add(mound);
      const rubber = new T.Mesh(new T.BoxGeometry(0.61, 0.04, 0.15), new T.MeshLambertMaterial({ color: 0xffffff })); rubber.position.set(0, 0.27, -18.44); scene.add(rubber);
      // 흰 선
      const chalk = new T.MeshBasicMaterial({ color: 0xf2f2ee });
      const line = (x0, z0, x1, z1, wdt) => { const L = Math.hypot(x1 - x0, z1 - z0); const m = new T.Mesh(new T.PlaneGeometry(wdt || 0.08, L), chalk); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(x1 - x0, -(z1 - z0)); m.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2); scene.add(m); };
      line(0.3, -0.3, 98.4 * 0.7071, -98.4 * 0.7071); line(-0.3, -0.3, -98.4 * 0.7071, -98.4 * 0.7071);
      for (const sx of [-1, 1]) { const x0 = sx * 0.37, x1 = sx * 1.6; line(x0, 0.9, x1, 0.9, 0.06); line(x0, -0.9, x1, -0.9, 0.06); line(x0, 0.9, x0, -0.9, 0.06); line(x1, 0.9, x1, -0.9, 0.06); }
      // 베이스 · 홈 플레이트
      const white = new T.MeshLambertMaterial({ color: 0xffffff });
      for (let b = 1; b <= 3; b++) { const m = new T.Mesh(new T.BoxGeometry(0.38, 0.08, 0.38), white); m.position.set(SIM.BASES[b].x, 0.06, SIM.BASES[b].z); m.rotation.y = Math.PI / 4; m.castShadow = true; scene.add(m); }
      const hp = new T.Shape([toS(-0.216, 0), toS(0.216, 0), toS(0.216, 0.216), toS(0, 0.43), toS(-0.216, 0.216)]);
      const hpm = new T.Mesh(new T.ShapeGeometry(hp), white); hpm.rotation.x = -Math.PI / 2; hpm.position.y = 0.055; scene.add(hpm);

      // 담장 (광고 글자)
      const fenceTex = canvasTex(T, 1024, 64, (g, w, h) => { g.fillStyle = '#123326'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8b25a'; g.fillRect(0, 0, w, 5); g.font = '800 30px Pretendard, sans-serif'; g.textBaseline = 'middle'; ['CRION', 'HIRION GAMES', 'CRION BASEBALL', 'PLAY PACK'].forEach((t, i) => { g.fillStyle = i % 2 ? 'rgba(255,255,255,.55)' : 'rgba(252,82,48,.85)'; g.fillText(t, 30 + i * 256, h / 2 + 3); }); });
      fenceTex.wrapS = T.RepeatWrapping;
      const fpts = []; for (let a = -45; a <= 45; a += 1) { const r = SIM.fenceR(a); fpts.push({ x: r * Math.sin(a * Math.PI / 180), z: -r * Math.cos(a * Math.PI / 180) }); }
      const fence = new T.Mesh(wallGeom(fpts, 0, SIM.FENCE_H, 14), new T.MeshLambertMaterial({ map: fenceTex, side: T.DoubleSide })); fence.receiveShadow = true; scene.add(fence);
      const pole = new T.MeshLambertMaterial({ color: 0xf3c623, emissive: 0x3a2c00 });
      for (const s of [-1, 1]) { const m = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 20, 10), pole); m.position.set(s * 98 * 0.7071, 10, -98 * 0.7071); scene.add(m); }

      // 관중석 (계단 + 관중 색점)
      buildStands();
      // 조명탑
      const glowTex = canvasTex(T, 128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,250,235,1)'); r.addColorStop(0.2, 'rgba(255,240,210,.55)'); r.addColorStop(1, 'rgba(255,230,200,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
      const towerM = new T.MeshLambertMaterial({ color: 0x2b2f3a });
      const panelM = new T.MeshBasicMaterial({ color: 0xfff6e6 });
      [[-112, -130, 44], [112, -130, 44], [-104, -30, 40], [104, -30, 40], [-48, 32, 36], [48, 32, 36]].forEach(([x, z, h]) => {
        const g = new T.Group(); g.position.set(x, 0, z);
        const p = new T.Mesh(new T.BoxGeometry(1.2, h, 1.2), towerM); p.position.y = h / 2; g.add(p);
        const pn = new T.Mesh(new T.BoxGeometry(10, 5, 0.6), panelM); pn.position.y = h + 2; g.add(pn);
        const sp2 = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false })); sp2.scale.set(34, 34, 1); sp2.position.y = h + 2; g.add(sp2);
        g.lookAt(0, h, -40); scene.add(g); (W.towers = W.towers || []).push({ g, p, pn, h });
      });
      // 전광판
      W.sbCanvas = document.createElement('canvas'); W.sbCanvas.width = 1024; W.sbCanvas.height = 400;
      W.sbTex = new T.CanvasTexture(W.sbCanvas); W.sbTex.encoding = T.sRGBEncoding;
      const sb = new T.Mesh(new T.PlaneGeometry(34, 13.3), new T.MeshBasicMaterial({ map: W.sbTex, fog: false }));
      sb.position.set(0, 21, -152); scene.add(sb);
      const frame = new T.Mesh(new T.BoxGeometry(36, 15.3, 1), towerM); frame.position.set(0, 21, -152.7); scene.add(frame);
      const leg = new T.Mesh(new T.BoxGeometry(2, 14, 2), towerM); leg.position.set(0, 7, -152.7); scene.add(leg);

      // 선수들
      W.mats = {};
      W.fielders = SIM.FIELD.map((f, i) => { const p = makePlayer(1, i === 1 ? 'catcher' : i === 0 ? 'pitcher' : ''); p.g.position.set(f.x, 0, f.z); p.home = { x: f.x, z: f.z }; scene.add(p.g); return p; });
      W.fielders[0].g.position.y = 0.25;
      W.batter = makePlayer(0, 'batter'); W.batter.g.position.set(-0.78, 0, 0.12); scene.add(W.batter.g);
      W.runners = [0, 1, 2, 3].map(() => { const p = makePlayer(0, ''); p.g.visible = false; scene.add(p.g); return p; });
      W.ump = makePlayer(2, 'ump'); W.ump.g.position.set(-0.2, 0, 2.3); scene.add(W.ump.g);

      // 공 · 꼬리 · 그림자
      W.ball = new T.Mesh(new T.SphereGeometry(0.06, 16, 12), new T.MeshBasicMaterial({ color: 0xffffff }));
      W.ball.visible = false; scene.add(W.ball);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xfff8ec, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false })); glow.scale.set(0.55, 0.55, 1); W.ball.add(glow);
      W.trailN = 26; W.trailPos = new Float32Array(W.trailN * 3);
      const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(W.trailPos, 3));
      W.trail = new T.Line(tg, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })); W.trail.frustumCulled = false; W.trail.visible = false; scene.add(W.trail);
      W.shadow = new T.Mesh(new T.CircleGeometry(0.12, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
      W.shadow.rotation.x = -Math.PI / 2; W.shadow.visible = false; scene.add(W.shadow);
      W.throwBall = W.ball;

      // 스트라이크 존 · 겨냥 원
      const zone = SIM.ZONE;
      const zg = new T.BufferGeometry().setFromPoints([new T.Vector3(zone.x0, zone.y0, 0), new T.Vector3(zone.x1, zone.y0, 0), new T.Vector3(zone.x1, zone.y1, 0), new T.Vector3(zone.x0, zone.y1, 0), new T.Vector3(zone.x0, zone.y0, 0)]);
      W.zone = new T.Line(zg, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false }));
      W.zone.renderOrder = 5; scene.add(W.zone);
      const gridPts = []; for (let i = 1; i < 3; i++) { const x = lerp(zone.x0, zone.x1, i / 3), y = lerp(zone.y0, zone.y1, i / 3); gridPts.push(new T.Vector3(x, zone.y0, 0), new T.Vector3(x, zone.y1, 0), new T.Vector3(zone.x0, y, 0), new T.Vector3(zone.x1, y, 0)); }
      W.grid = new T.LineSegments(new T.BufferGeometry().setFromPoints(gridPts), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthTest: false })); W.grid.renderOrder = 5; scene.add(W.grid);
      W.pci = new T.Group();
      const ring = new T.Mesh(new T.RingGeometry(0.92, 1, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: T.DoubleSide, depthTest: false }));
      const dot = new T.Mesh(new T.CircleGeometry(0.12, 16), new T.MeshBasicMaterial({ color: 0xfc5230, transparent: true, opacity: 0.95, side: T.DoubleSide, depthTest: false }));
      const fillC = new T.Mesh(new T.CircleGeometry(0.92, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: T.DoubleSide, depthTest: false }));
      W.pci.add(fillC, ring, dot); W.pci.children.forEach(c => { c.renderOrder = 6; }); W.pciRing = ring;
      scene.add(W.pci);
      W.assist = new T.Mesh(new T.RingGeometry(0.03, 0.045, 32), new T.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0, side: T.DoubleSide, depthTest: false }));
      W.assist.renderOrder = 6; scene.add(W.assist);
      W.meter = new T.Mesh(new T.RingGeometry(0.94, 1, 48), new T.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.95, side: T.DoubleSide, depthTest: false }));
      W.meter.renderOrder = 7; W.meter.visible = false; scene.add(W.meter);
      W.raycaster = new T.Raycaster(); W.plane = new T.Plane(new T.Vector3(0, 0, 1), 0);
      if (opt.models) loadModels(opt.models).catch(e => console.error('모델', e));
      if (opt.pitcherSprite) Promise.resolve(opt.pitcherSprite).then(sp => { if (sp && !dead) buildSprite(sp); }).catch(e => console.error(e));
      teamColors();
      drawBoard();
    }
    // ---------- 3D 모델 (팩 assets/models/*.glb · Poly Pizza, 표기: ASSETS_LICENSES.txt) ----------
    //  사람(뼈대+동작 11개)으로 수비·타자·주자·포수·심판·덕아웃을 바꾸고, 모자·글러브·방망이·공·조명탑·광고판·벤치를 얹는다
    const humans = []; let BAT_SHIFT = 0.42;
    async function loadModels(M) {
      const L = new T.GLTFLoader();
      const get = (k) => M[k] ? L.loadAsync(M[k]).catch(e => { console.warn('모델 못 읽음', k, e); return null; }) : Promise.resolve(null);
      const [man, cap, glove, bat, ball, light, board, bench] = await Promise.all(['man', 'cap', 'glove', 'bat', 'ball', 'light', 'board', 'bench'].map(get));
      if (dead) return;
      const A = W.asset = { man, cap, glove, bat, ball, light, board, bench };
      if (man) {
        man.scene.updateMatrixWorld(true);
        const b = new T.Box3().setFromObject(man.scene);
        A.manScale = 1.85 / (b.max.y - b.min.y);
        A.clips = {}; man.animations.forEach(c => { A.clips[c.name.split('_').pop().toLowerCase()] = c; });
        W.fielders.forEach((f, i) => humanize(f, i === 1 ? 'catcher' : i === 0 ? 'pitcher' : 'fielder'));
        humanize(W.batter, 'batter'); W.runners.forEach(r => humanize(r, 'runner')); humanize(W.ump, 'ump');
        if (bench) dugouts();
        teamColors();
      }
      if (ball) {
        let m = null; ball.scene.traverse(o => { if (o.isMesh && !m) m = o; });
        if (m) { const g = m.geometry.clone(); g.computeBoundingSphere(); g.translate(-g.boundingSphere.center.x, -g.boundingSphere.center.y, -g.boundingSphere.center.z); g.scale(0.06 / g.boundingSphere.radius, 0.06 / g.boundingSphere.radius, 0.06 / g.boundingSphere.radius); W.ball.geometry.dispose(); W.ball.geometry = g; if (m.material.map) { m.material.map.encoding = T.sRGBEncoding; W.ball.material.map = m.material.map; W.ball.material.needsUpdate = true; } }
      }
      if (light && W.towers) {
        light.scene.updateMatrixWorld(true);
        const lb = new T.Box3().setFromObject(light.scene), lh = lb.max.y - lb.min.y;
        W.towers.forEach(t => {
          const o = light.scene.clone(); const k = (t.h + 4) / lh; o.scale.setScalar(k); o.position.y = -lb.min.y * k;
          o.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); if (/yellow/i.test(c.material.name)) { c.material.emissive = new T.Color(0xfff2d0); c.material.emissiveIntensity = 1; } } });
          t.p.visible = false; t.pn.visible = false; t.g.add(o);
        });
      }
      if (board) billboards(board);
    }
    function heightOf(o) { o.updateMatrixWorld(true); const b = new T.Box3().setFromObject(o); return b; }
    // 사람 하나 만들기
    function humanMats(team) {
      W.hmats = W.hmats || {};
      if (!W.hmats[team]) W.hmats[team] = {};
      return W.hmats[team];
    }
    function humanize(P, role) {
      const A = W.asset, Sk = T.SkeletonUtils;
      const rootO = Sk.clone(A.man.scene); rootO.scale.setScalar(A.manScale);
      const hm = humanMats(P.team);
      rootO.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.frustumCulled = false;
        const one = (m) => { const key = m.name || 'm'; if (!hm[key]) { hm[key] = m.clone(); hm[key].roughness = 0.8; } return hm[key]; };
        o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
      });
      const mixer = new T.AnimationMixer(rootO), acts = {};
      Object.entries(A.clips).forEach(([k, c]) => { acts[k] = mixer.clipAction(c); });
      const bone = (n) => { let b = null; rootO.traverse(o => { if (o.isBone && o.name === n) b = o; }); return b; };
      const h = { root: rootO, mixer, acts, cur: null, role, bones: { head: bone('Head'), palmR: bone('PalmR'), palmL: bone('PalmL') } };
      // 동작 바꾸기 (부드럽게 이어서)
      h.set = (name, o) => {
        o = o || {};
        const a = acts[name]; if (!a) return;
        if (h.cur === a && !o.restart) return;
        a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = o.speed == null ? 1 : o.speed;
        a.setLoop(o.once ? T.LoopOnce : T.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
        if (o.at != null) a.time = o.at;
        if (h.cur && h.cur !== a) { a.play(); h.cur.crossFadeTo(a, o.fade == null ? 0.18 : o.fade, false); } else a.play();
        h.cur = a;
      };
      h.hold = (name, at) => { h.set(name, { restart: true, fade: 0.1 }); const a = acts[name]; if (a) { a.time = at; a.timeScale = 0; } };
      // 소품: 기본 자세(가만히)에서 세상 좌표로 맞춘 뒤 뼈에 붙인다
      h.hold('idle', 0); mixer.update(0); rootO.updateMatrixWorld(true);
      const put = (src, boneO, size, pos, rot, mat, dir, shift) => {
        if (!src || !boneO) return null;
        const o = src.scene.clone(); const bb = heightOf(o), sz = bb.getSize(new T.Vector3());
        const k = size / Math.max(sz.x, sz.y, sz.z); o.scale.setScalar(k);
        const c = bb.getCenter(new T.Vector3()).multiplyScalar(k);
        const w = boneO.getWorldPosition(new T.Vector3()).add(new T.Vector3(...pos));
        const holder = new T.Group(); holder.position.copy(w); holder.rotation.set(...rot);
        if (dir) holder.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), new T.Vector3(...dir).normalize());
        o.position.copy(c).multiplyScalar(-1); if (shift) o.position.x += shift * size; holder.add(o);
        o.traverse(x => { if (x.isMesh) { x.castShadow = true; if (mat) x.material = mat; } });
        holder.updateMatrixWorld(true); boneO.attach(holder);
        return holder;
      };
      const A2 = W.asset;
      if (role !== 'ump') h.cap = put(A2.cap, h.bones.head, 0.3, [0, 0.27, 0.02], [0, 0, 0], W.mats['cap' + P.team]);
      if (role !== 'batter' && role !== 'runner' && role !== 'ump') h.glove = put(A2.glove, h.bones.palmL, 0.3, [0, -0.04, 0.03], [0, 0, 0]);
      if (role === 'batter') h.bat = put(A2.bat, h.bones.palmR, 0.86, [0, 0, 0], [0, 0, 0], W.mats.bat, [0, 0.75, 0.65], BAT_SHIFT);
      P.body.visible = false; P.g.add(rootO); P.human = h; humans.push(h);
      if (role === 'catcher') { h.hold('sitting', 3.2); rootO.rotation.y = 0; }
      else if (role === 'batter') h.hold('idle', 0.5);
      else h.set('idle', { at: Math.random() * 3 });
      return h;
    }
    function dugouts() {
      const A = W.asset; W.dugout = [[], []];
      [[-1, 0], [1, 1]].forEach(([sx, team]) => {
        const u = { x: sx * 0.7071, z: -0.7071 }, nrm = { x: sx * 0.7071, z: 0.7071 };
        const at = (s, o) => ({ x: u.x * s + nrm.x * o, z: u.z * s + nrm.z * o });
        const b = A.bench.scene.clone(); const bb = heightOf(b), sz = bb.getSize(new T.Vector3());
        const k = 7 / sz.x; b.scale.setScalar(k);
        const p0 = at(15, 11.5); b.position.set(p0.x, -bb.min.y * k, p0.z); b.rotation.y = Math.atan2(-nrm.x, -nrm.z) + Math.PI;
        b.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(b);
        for (let i = 0; i < 4; i++) {
          const P = makePlayer(3 + team, ''); const q = at(12.6 + i * 1.9, 11.9);
          P.g.position.set(q.x, 0, q.z); P.g.rotation.y = Math.atan2(-nrm.x, -nrm.z); scene.add(P.g);
          const h = humanize(P, 'bench'); h.hold('sitting', 3.2 + i * 0.2); W.dugout[team].push(h);
        }
      });
    }
    function billboards(board) {
      const ad = canvasTex(T, 1024, 512, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1a1030'); gr.addColorStop(1, '#3a0f12'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#fc5230'; g.font = '900 150px Pretendard, sans-serif'; g.fillText('CRION', 60, 230);
        g.fillStyle = '#fff'; g.font = '800 64px Pretendard, sans-serif'; g.fillText('PLAY PACK · BASEBALL', 64, 330);
        g.fillStyle = '#d8b25a'; g.font = '700 44px Pretendard, sans-serif'; g.fillText('HIRION GAMES', 64, 420);
      });
      [[-30, 1], [30, -1]].forEach(([phi]) => {
        const o = board.scene.clone(); const bb = heightOf(o), sz = bb.getSize(new T.Vector3());
        const k = 26 / sz.y; o.scale.setScalar(k);
        const r = SIM.fenceR(phi) + 26, a = phi * Math.PI / 180;
        o.position.set(r * Math.sin(a), -bb.min.y * k, -r * Math.cos(a)); o.lookAt(0, o.position.y, 0);
        let big = null, area = 0;
        o.traverse(c => { if (!c.isMesh) return; c.geometry.computeBoundingBox(); const s3 = c.geometry.boundingBox.getSize(new T.Vector3()); const ar = [s3.x * s3.y, s3.y * s3.z, s3.x * s3.z].sort((p, q) => q - p)[0]; if (ar > area) { area = ar; big = c; } });
        if (big) big.material = new T.MeshBasicMaterial({ map: ad, side: T.DoubleSide, fog: false });
        scene.add(o);
      });
    }
    // 매 프레임: 사람 동작
    function tickHumans(dt) {
      if (!humans.length) return;
      W.fielders.concat(W.runners).forEach(f => {
        const h = f.human; if (!h || h.busy > now) return;
        if (h.role === 'catcher' && !f.target) return;
        h.set(f.run ? 'run' : 'idle', f.run ? { speed: 1.25 } : null);
      });
      humans.forEach(h => { if (h.root.parent && h.root.parent.visible !== false) h.mixer.update(dt); });
    }
    function cheer() {
      if (!W.dugout) return;
      const side = mode === 'game' && G ? G.half : mode === 'pitch' ? 1 : 0;
      W.dugout[side].forEach((h, i) => { h.cheer = true; h.set(i % 2 ? 'jump' : 'clapping', { at: i * 0.2 }); });
    }
    function humanOnce(P, name, at, speed, dur) { const h = P && P.human; if (!h) return; h.set(name, { once: true, restart: true, at: at || 0, speed: speed || 1, fade: 0.08 }); h.busy = now + (dur || 0.9); }
    // 2D 투수 (그림 프레임 묶음 = 아틀라스). 정면 그림이라 '내가 칠 때'(투수를 앞에서 볼 때)만 쓴다
    const SPR_SPD = 1.15;
    function buildSprite(sp) {
      const m = sp.meta, tex = new T.TextureLoader().load(sp.url);
      tex.encoding = T.sRGBEncoding; tex.repeat.set(1 / m.cols, 1 / m.rows); tex.anisotropy = 4;
      const h = m.height / (m.bodyPx || 0.96), w = h * m.fw / m.fh;
      const geo = new T.PlaneGeometry(w, h); geo.translate(0, h / 2 - (1 - m.ground) * h, 0);
      const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, side: T.DoubleSide, color: 0xeeeef4 }));
      mesh.position.set(0, 0.25, -18.44); mesh.renderOrder = 2;
      const sh = new T.Mesh(new T.CircleGeometry(0.55, 24), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.45, 1); sh.position.set(0, 0.262, -18.44);
      scene.add(mesh, sh);
      W.spr = { mesh, sh, tex, m, ws: 0, rel: -1, frame: -1, windDur: (m.windup[1] - m.windup[0]) / (m.fps * SPR_SPD) };
      sprFrame(m.idle[0]);
    }
    function sprFrame(i) {
      const S = W.spr; if (!S || S.frame === i) return;
      S.frame = i; const c = i % S.m.cols, r = Math.floor(i / S.m.cols);
      S.tex.offset.set(c / S.m.cols, 1 - (r + 1) / S.m.rows);
    }
    function tickSprite() {
      const S = W.spr; if (!S) return false;
      const pf = W.fielders[0];
      const chasing = phase === 'play' && pf.target;
      const on = (mode === 'title' || userBats()) && !chasing;
      S.mesh.visible = S.sh.visible = on; pf.g.visible = !on;
      if (!on) return false;
      S.mesh.rotation.y = Math.atan2(cam.position.x - S.mesh.position.x, cam.position.z - S.mesh.position.z);
      const m = S.m, n = (a) => a[1] - a[0];
      if ((phase === 'pitch' || phase === 'play' || phase === 'after') && S.rel >= 0) sprFrame(m.follow[0] + Math.min(n(m.follow) - 1, Math.floor((now - S.rel) * m.fps)));
      else if (phase === 'wait' && S.ws && now >= S.ws) sprFrame(m.windup[0] + Math.min(n(m.windup) - 1, Math.floor((now - S.ws) * m.fps * SPR_SPD)));
      else { const k = Math.floor(now * 7) % (n(m.idle) * 2 - 2); sprFrame(m.idle[0] + (k < n(m.idle) ? k : n(m.idle) * 2 - 2 - k)); }
      return true;
    }
    function wallGeom(pts, y0, y1, uLen) {
      const pos = [], uv = [], idx = []; let acc = 0;
      pts.forEach((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); const yb = typeof y0 === 'function' ? y0(i) : y0, yt = typeof y1 === 'function' ? y1(i) : y1; pos.push(p.x, yb, p.z, p.x, yt, p.z); uv.push(acc / uLen, 0, acc / uLen, 1); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    function buildStands() {
      // 관중석 바깥선: 페어(담장 뒤) → 파울 라인 옆 → 홈 뒤. 오른쪽 절반을 만들고 왼쪽은 거울로
      const half = [];
      for (let a = 0; a <= 45; a += 1.5) { const r = SIM.fenceR(a) + 0.6, s = Math.sin(a * Math.PI / 180), c = Math.cos(a * Math.PI / 180); half.push({ x: r * s, z: -r * c, nx: s, nz: -c, h: SIM.FENCE_H }); }
      const u = { x: 0.7071, z: -0.7071 }, n = { x: 0.7071, z: 0.7071 };
      for (let sd = 94; sd >= 10; sd -= 4) half.push({ x: u.x * sd + n.x * 14, z: u.z * sd + n.z * 14, nx: n.x, nz: n.z, h: 1.3 });
      const last = half[half.length - 1], a0 = Math.atan2(last.x, -last.z) / Math.PI * 180;
      for (let a = a0 + 6; a < 180; a += 6) { const s = Math.sin(a * Math.PI / 180), c = Math.cos(a * Math.PI / 180), k = clamp((a - 120) / 30, 0, 1), r = lerp(19, 23, k); half.push({ x: r * s, z: -r * c, nx: s, nz: -c, h: lerp(1.6, 4.2, k) }); }
      half.push({ x: 0, z: 23, nx: 0, nz: 1, h: 4.2 });
      const ring = half.slice().reverse().map(p => ({ x: -p.x, z: p.z, nx: -p.nx, nz: p.nz, h: p.h })).concat(half.slice(1));
      const rows = 16, dep = 0.9, rise = 0.58;
      const pos = [], col = [], idx = [], rpos = [], ruv = [], ridx = [];
      const people = canvasTex(T, 1024, 128, (g, w, h) => {
        g.fillStyle = '#141a28'; g.fillRect(0, 0, w, h);
        const shirt = ['#e8e4dc', '#c0392b', '#1f4e9c', '#f1c40f', '#2c3e50', '#e67e22', '#d9dde5', '#8e44ad', '#16a085', '#fc5230', '#273c75', '#d8b25a', '#f5f5f5', '#9b2335'];
        for (let x = 0; x < w; x += 16) {
          if (Math.random() < 0.12) { g.fillStyle = '#26324a'; g.fillRect(x + 2, 70, 12, 50); continue; }
          const yo = Math.random() * 14, c = shirt[(Math.random() * shirt.length) | 0];
          g.fillStyle = c; g.fillRect(x + 1, 52 + yo, 14, 76 - yo);
          g.fillStyle = ['#e0b08a', '#c68f6a', '#f0c9a8', '#8d5b3e'][(Math.random() * 4) | 0]; g.beginPath(); g.arc(x + 8, 40 + yo, 6.5, 0, 7); g.fill();
          g.fillStyle = Math.random() < 0.5 ? '#1b1b1f' : '#5a3b22'; g.fillRect(x + 1.5, 32 + yo, 13, 5);
          if (Math.random() < 0.15) { g.fillStyle = c; g.fillRect(x + (Math.random() < 0.5 ? 0 : 12), 10 + yo, 4, 30); }
        }
      });
      people.wrapS = T.RepeatWrapping;
      const rquad = (a, b, c2, d, u0, u1) => { const i = rpos.length / 3; [a, b, c2, d].forEach(p => rpos.push(p[0], p[1], p[2])); ruv.push(u0, 0, u1, 0, u1, 1, u0, 1); ridx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
      const lens = [0]; for (let i = 1; i < ring.length; i++) lens.push(lens[i - 1] + Math.hypot(ring[i].x - ring[i - 1].x, ring[i].z - ring[i - 1].z));
      const conc = new T.Color('#3a3f4a');
      const quad = (a, b, c2, d, cl) => { const i = pos.length / 3; [a, b, c2, d].forEach(p => { pos.push(p[0], p[1], p[2]); col.push(cl.r, cl.g, cl.b); }); idx.push(i, i + 1, i + 2, i, i + 2, i + 3); };
      for (let k = 0; k < rows; k++) {
        for (let i = 0; i < ring.length - 1; i++) {
          const A = ring[i], B = ring[i + 1];
          const o0 = k * dep, o1 = o0 + dep, y0 = A.h + k * rise, y1 = y0 + rise;
          const pa = (p, o) => [p.x + p.nx * o, p.z + p.nz * o];
          const [ax0, az0] = pa(A, o0), [bx0, bz0] = pa(B, o0), [ax1, az1] = pa(A, o1), [bx1, bz1] = pa(B, o1);
          const yb0 = B.h + k * rise, yb1 = yb0 + rise;
          const off = k * 0.37;
          rquad([ax0, y0, az0], [bx0, yb0, bz0], [bx0, yb1, bz0], [ax0, y1, az0], lens[i] / 32 + off, lens[i + 1] / 32 + off);
          quad([ax0, y1, az0], [bx0, yb1, bz0], [bx1, yb1, bz1], [ax1, y1, az1], conc);
        }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); m.receiveShadow = true; scene.add(m);
      const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rpos, 3)); rg.setAttribute('uv', new T.Float32BufferAttribute(ruv, 2)); rg.setIndex(ridx); rg.computeVertexNormals();
      scene.add(new T.Mesh(rg, new T.MeshLambertMaterial({ map: people, side: T.DoubleSide, color: 0xa4a9b6 })));
      // 홈 뒤 그물벽
      const bs = []; for (let a = 125; a <= 235; a += 3) { const r = 18.4; bs.push({ x: r * Math.sin(a * Math.PI / 180), z: -r * Math.cos(a * Math.PI / 180) }); }
      const padTex = canvasTex(T, 512, 64, (g, w, h) => { g.fillStyle = '#0f1d33'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h); g.font = '800 22px Pretendard, sans-serif'; g.fillStyle = 'rgba(216,178,90,.7)'; g.fillText('CRION', 210, 40); });
      padTex.wrapS = T.RepeatWrapping;
      scene.add(new T.Mesh(wallGeom(bs, 0, 3.0, 12), new T.MeshLambertMaterial({ map: padTex, side: T.DoubleSide })));
      const net = new T.Mesh(wallGeom(bs, 3.0, 11, 3), new T.MeshBasicMaterial({ color: 0x0a0f1a, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false }));
      scene.add(net);
      // 맨 뒤 벽 · 앞 벽
      const back = ring.map(p => ({ x: p.x + p.nx * rows * dep, z: p.z + p.nz * rows * dep }));
      scene.add(new T.Mesh(wallGeom(back, (i) => ring[i].h + rows * rise, (i) => ring[i].h + rows * rise + 5, 10), new T.MeshLambertMaterial({ color: 0x161a24, side: T.DoubleSide })));
      const front = ring.filter(p => p.h < 3);
      scene.add(new T.Mesh(wallGeom(front, 0, (i) => front[i].h, 10), new T.MeshLambertMaterial({ color: 0x1b2f4a, side: T.DoubleSide })));
    }
    // 단순한 사람 모형 (team 0 = 원정 CRION, 1 = 홈 HIRION, 2 = 심판)
    function mat(key, color) { if (!W.mats[key]) W.mats[key] = new T.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.02 }); return W.mats[key]; }
    function makePlayer(team, role) {
      const g = new T.Group(), body = new T.Group(); g.add(body);
      const tm = (part) => ({ team, part });
      const skin = mat('skin', 0xd9a77e);
      const mk = (geo, m, x, y, z, tag) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; if (tag) o.userData.tag = tag; body.add(o); return o; };
      const legL = mk(new T.CapsuleGeometry(0.1, 0.62, 4, 8), mat('pants' + team, 0xffffff), -0.12, 0.45, 0, tm('pants'));
      const legR = mk(new T.CapsuleGeometry(0.1, 0.62, 4, 8), mat('pants' + team, 0xffffff), 0.12, 0.45, 0, tm('pants'));
      const torso = mk(new T.CapsuleGeometry(0.21, 0.42, 4, 10), mat('body' + team, 0xffffff), 0, 1.12, 0, tm('body'));
      const head = mk(new T.SphereGeometry(0.15, 14, 10), skin, 0, 1.6, 0);
      const cap = mk(new T.SphereGeometry(0.158, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('cap' + team, 0x222222), 0, 1.63, 0, tm('cap'));
      const brim = mk(new T.CylinderGeometry(0.12, 0.12, 0.02, 12, 1, false, -Math.PI / 2, Math.PI), mat('cap' + team, 0x222222), 0, 1.63, 0.1, tm('cap'));
      const armL = new T.Group(); armL.position.set(-0.27, 1.32, 0); body.add(armL);
      const armR = new T.Group(); armR.position.set(0.27, 1.32, 0); body.add(armR);
      const aL = new T.Mesh(new T.CapsuleGeometry(0.075, 0.46, 4, 8), mat('body' + team, 0xffffff)); aL.position.y = -0.27; aL.castShadow = true; aL.userData.tag = tm('body'); armL.add(aL);
      const aR = aL.clone(); armR.add(aR);
      const glove = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), mat('glove', 0x6b3d1f)); glove.position.y = -0.55; armL.add(glove);
      const P = { g, body, legL, legR, armL, armR, head, team, role, run: 0 };
      if (role === 'batter') {
        g.rotation.y = Math.PI / 2;   // 홈 플레이트(+x) 쪽을 본다
        P.bat = new T.Group(); P.bat.position.set(0.05, 1.18, 0.25); body.add(P.bat);
        const bm = new T.Mesh(new T.CylinderGeometry(0.035, 0.016, 0.86, 10), mat('bat', 0xc79a5b)); bm.position.y = 0.43; bm.castShadow = true; P.bat.add(bm);
        P.batMesh = bm; batPose(P, 0);
      }
      if (role === 'catcher') { body.position.y = -0.5; legL.rotation.x = -1.35; legR.rotation.x = -1.35; legL.position.set(-0.2, 0.75, 0.22); legR.position.set(0.2, 0.75, 0.22); armL.rotation.x = -1.1; g.rotation.y = Math.PI; P.crouch = true; }
      if (role === 'pitcher' || role === '') g.rotation.y = 0;
      if (role === 'ump') { body.scale.set(1, 0.85, 1); g.rotation.y = Math.PI; }
      return P;
    }
    // 스윙 자세: s 0 = 준비, 1 = 끝
    function batPose(P, s) {
      const e = ease(clamp(s, 0, 1));
      P.bat.rotation.set(0, 0, 0);
      P.bat.rotation.x = lerp(-0.5, 0.2, e);
      P.bat.rotation.z = lerp(0.55, 1.55, Math.min(1, e * 1.6));
      P.bat.rotation.y = lerp(-1.2, 3.6, e);
      P.body.rotation.y = lerp(0.1, -0.9, e);
    }
    function teamColors() {
      if (!W.mats) return;
      const bat = mode === 'pitch' ? 1 : mode === 'game' && G ? G.half : 0, fld = 1 - bat;
      const set = (team, side) => { const t = SIM.TEAMS[side]; if (W.mats['body' + team]) W.mats['body' + team].color.set(t.body); if (W.mats['pants' + team]) W.mats['pants' + team].color.set(t.pants); if (W.mats['cap' + team]) W.mats['cap' + team].color.set(t.cap); };
      set(0, bat); set(1, fld); set(3, 0); set(4, 1);
      if (W.mats.body2) { W.mats.body2.color.set('#20232b'); W.mats.pants2.color.set('#5a5f6b'); W.mats.cap2.color.set('#14161c'); }
      // 사람 모델 옷 색 (Shirt 몸통 · Shirt2 소매 · Pants · Socks · Shoes)
      const hc = (slot, t) => { const hm = W.hmats && W.hmats[slot]; if (!hm) return; const c = (k, v) => { if (hm[k]) hm[k].color.set(v); };
        if (t) { c('Shirt', t.body); c('Shirt2', t.body); c('Pants', t.pants); c('Socks', t.color); } else { c('Shirt', '#1d2028'); c('Shirt2', '#2a2e38'); c('Pants', '#4a4f5a'); c('Socks', '#111'); }
        c('Shoes', '#16161a'); };
      hc(0, SIM.TEAMS[bat]); hc(1, SIM.TEAMS[fld]); hc(2, null); hc(3, SIM.TEAMS[0]); hc(4, SIM.TEAMS[1]);
    }
    // 전광판 그림
    function drawBoard() {
      if (!W.sbCanvas) return;
      const g = W.sbCanvas.getContext('2d'), w = W.sbCanvas.width, h = W.sbCanvas.height;
      g.fillStyle = '#05070c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(216,178,90,.5)'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#fc5230'; g.font = '900 46px Pretendard, sans-serif'; g.textBaseline = 'middle'; g.fillText('CRION BASEBALL', 34, 52);
      g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 26px Pretendard, sans-serif'; g.textAlign = 'right'; g.fillText(G && mode === 'game' ? SIM.halfName(G) : MODES[mode] ? MODES[mode].name : 'PROTOTYPE', w - 34, 52); g.textAlign = 'left';
      if (G && mode === 'game') {
        const N = Math.max(G.innings, G.line[0].length);
        const cw = Math.min(64, 560 / N), x0 = 250;
        g.font = '700 26px Pretendard, sans-serif'; g.fillStyle = 'rgba(255,255,255,.45)';
        for (let i = 0; i < N; i++) g.fillText(String(i + 1), x0 + i * cw + cw / 2 - 8, 120);
        g.fillText('R', x0 + N * cw + 24, 120); g.fillText('H', x0 + N * cw + 84, 120);
        [0, 1].forEach(t => {
          const y = 180 + t * 72;
          g.fillStyle = SIM.TEAMS[t].color; g.fillRect(34, y - 26, 10, 52);
          g.fillStyle = '#fff'; g.font = '800 38px Pretendard, sans-serif'; g.fillText(SIM.TEAMS[t].name, 58, y);
          g.font = '700 34px Pretendard, sans-serif';
          for (let i = 0; i < N; i++) { const v = G.line[t][i]; g.fillStyle = v == null ? 'rgba(255,255,255,.2)' : '#ffd36b'; g.fillText(v == null ? '·' : String(v), x0 + i * cw + cw / 2 - 10, y); }
          g.fillStyle = '#fff'; g.font = '900 40px Pretendard, sans-serif'; g.fillText(String(G.score[t]), x0 + N * cw + 18, y);
          g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 34px Pretendard, sans-serif'; g.fillText(String(G.hits[t]), x0 + N * cw + 80, y);
        });
        const dots = (lab, n, max, x, c) => { g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '800 30px Pretendard, sans-serif'; g.fillText(lab, x, 345); for (let i = 0; i < max; i++) { g.beginPath(); g.arc(x + 44 + i * 34, 345, 11, 0, 7); g.fillStyle = i < n ? c : 'rgba(255,255,255,.14)'; g.fill(); } };
        dots('B', G.balls, 3, 40, '#5fd38a'); dots('S', G.strikes, 2, 230, '#ffd36b'); dots('O', G.outs, 2, 390, '#ff5a4a');
      } else if (G) {
        const s = G.stat;
        g.fillStyle = '#fff'; g.font = '800 40px Pretendard, sans-serif';
        const rows = mode === 'pitch' ? [['상대 타자', s.pa], ['삼진', s.k], ['볼넷', s.bb], ['맞은 안타', s.h]] : mode === 'derby' ? [['홈런', s.hrs], ['남은 아웃', Math.max(0, 10 - s.outs)], ['최고 비거리', Math.round(s.maxDist) + 'm'], ['최고 타구속도', Math.round(s.maxEv) + 'km/h']] : [['타석', s.pa], ['안타', s.h], ['홈런', s.hr], ['최고 타구속도', Math.round(s.maxEv) + 'km/h']];
        rows.forEach(([k, v], i) => { const x = 40 + (i % 2) * 480, y = 150 + Math.floor(i / 2) * 110; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 28px Pretendard, sans-serif'; g.fillText(k, x, y); g.fillStyle = '#ffd36b'; g.font = '900 52px Pretendard, sans-serif'; g.fillText(String(v), x, y + 50); });
      } else {
        g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '800 60px Pretendard, sans-serif'; g.fillText('PLAY BALL', 34, 200);
        g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '600 28px Pretendard, sans-serif'; g.fillText('3D 야구 프로토타입 · 개발자 버전', 34, 270);
      }
      W.sbTex.needsUpdate = true;
    }

    // ---------- 화면 크기 ----------
    function resize() {
      if (!renderer) return;
      const w = el.clientWidth || 800, h = el.clientHeight || 600;
      renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
      cam.aspect = w / h; cam.updateProjectionMatrix();
      wrap.classList.toggle('port', portrait());
      if (phase !== 'play') setCam(true);
    }
    const ro = root.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(el); else root.addEventListener('resize', resize);

    // ---------- 카메라 ----------
    function viewBat() { const pt = portrait(); return { fov: pt ? 50 : 30, pos: [0.3, pt ? 1.95 : 1.85, pt ? 6.6 : 5.6], look: [0, pt ? 0.75 : 1.0, -18.4] }; }
    function viewPitch() { const pt = portrait(); return { fov: pt ? 22 : 15, pos: [0.15, pt ? 4.1 : 3.05, pt ? -30 : -27.5], look: [0, pt ? 0.7 : 0.95, 0] }; }
    function setCam(snap) {
      let v;
      if (mode === 'title') v = null;
      else v = userBats() ? viewBat() : viewPitch();
      if (!v) return;
      camGoal = new T.Vector3(...v.pos); camLook = new T.Vector3(...v.look);
      cam.fov = v.fov; cam.updateProjectionMatrix();
      if (snap) { cam.position.copy(camGoal); camLookCur.copy(camLook); cam.lookAt(camLookCur); }
      const bat = userBats();
      W.zone.visible = !!(bat ? prefs.zone : true); W.grid.visible = !bat;
      W.pci.visible = bat && phase !== 'play'; W.fielders[1].g.visible = !bat || phase === 'play';
      W.ump.g.visible = !bat || phase === 'play';
      W.pci.scale.setScalar(D().rad);
    }

    // ---------- 입력 ----------
    function platePoint(ev) {
      const r = renderer.domElement.getBoundingClientRect();
      const m = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      W.raycaster.setFromCamera(m, cam);
      const hit = new T.Vector3();
      if (!W.raycaster.ray.intersectPlane(W.plane, hit)) return null;
      return { x: clamp(hit.x, -0.75, 0.75), y: clamp(hit.y, 0.1, 1.7) };
    }
    function onMove(ev) {
      if (!renderer || mode === 'title') return;
      const p = platePoint(ev); if (!p) return;
      if (userBats()) { if (phase !== 'play') cursor = p; }
      else if (phase === 'p_aim') cursor = p;
    }
    function onDown(ev) {
      if (!renderer || mode === 'title' || !modalEl.hidden) return;
      if (ev.button != null && ev.button !== 0) return;
      const p = platePoint(ev);
      if (phase === 'play' || phase === 'after') { skipPlay(); return; }
      if (userBats()) { if (p) cursor = p; swing(); return; }
      if (phase === 'p_aim' && p) { aim = { x: p.x, y: p.y }; cursor = p; phase = 'p_meter'; meter = { t: 0 }; help(); return; }
      if (phase === 'p_meter') { lockMeter(); return; }
    }
    function onKey(ev) {
      if (mode === 'title' || !modalEl.hidden) return;
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.code === 'Space') { ev.preventDefault(); if (phase === 'play' || phase === 'after') skipPlay(); else if (userBats()) swing(); else if (phase === 'p_meter') lockMeter(); return; }
      if (!userBats() && /^Digit[1-5]$/.test(ev.code)) { pickPitch(SIM.PITCH_KEYS[+ev.code.slice(5) - 1]); }
      if (ev.code === 'Escape') { ev.preventDefault(); openPause(); }
    }
    const cv = () => renderer && renderer.domElement;

    // ---------- 진행 ----------
    function startMode(m) {
      mode = m; G = SIM.newGame(m, prefs.innings);
      autoSwing = null; timeScale = timeScale || 1;
      if (m === 'pitch') G.half = 1;   // 투구 연습: 상대(HIRION) 타자를 상대한다
      titleEl.hidden = true; hud.hidden = false; modalEl.hidden = true;
      W.batter.g.visible = true; resetField(); teamColors(); drawBoard(); sb();
      setCam(true);
      logClear();
      say(m === 'game' ? `${G.innings}이닝 경기 · ${SIM.TEAMS[0].name} 공격부터` : MODES[m].name, 1800);
      nextPitch(2.8);
      snd.cheer(0.4);
    }
    function resetField() {
      W.fielders.forEach((f, i) => { f.g.position.set(f.home.x, i === 0 ? 0.25 : 0, f.home.z); f.g.rotation.y = i === 1 ? Math.PI : 0; f.target = null; f.run = 0; });
      W.ball.visible = false; W.trail.visible = false; W.shadow.visible = false; W.assist.material.opacity = 0;
      W.batter.g.position.set(-0.78, 0, 0.12); W.batter.g.rotation.y = Math.PI / 2; batPose(W.batter, 0); W.batter.g.visible = true;
      W.runners.forEach(r => { r.g.visible = false; r.path = null; r.run = 0; });
      if (W.batter.human) W.batter.human.hold('idle', 0.5);
      W.fielders.forEach((f, i) => { if (f.human) { f.human.busy = 0; if (i === 1) f.human.hold('sitting', 3.2); } });
      if (W.dugout) W.dugout.forEach(d => d.forEach((h, i) => { if (h.cheer) { h.cheer = false; h.hold('sitting', 3.2 + i * 0.2); } }));
      if (G) G.bases.forEach((who, i) => { if (who) { const r = W.runners[i]; r.g.visible = true; const b = SIM.BASES[i + 1]; r.g.position.set(b.x + (i === 0 ? -1.5 : i === 2 ? 1.5 : 0), 0, b.z + (i === 1 ? 1.5 : 0)); } });
    }
    function nextPitch(delay) {
      play = null; P = null; aim = null; meter = null;
      if (G && G.over) { endGame(); return; }
      resetField(); setCam(false);
      if (userBats()) {
        // 타자가 준비할 시간(2.4~3.2초, 쉬움은 +0.6) → 그다음 와인드업 → 공
        const ready = (delay == null ? 2.4 + Math.random() * 0.8 : delay) + (prefs.diff === 'easy' ? 0.6 : 0);
        const wind = W.spr ? W.spr.windDur : 0.9;
        phase = 'wait'; pendingNext = now + ready + wind;
        if (W.spr) { W.spr.ws = pendingNext - W.spr.windDur; W.spr.rel = -1; }
        W.fielders[0].wind = pendingNext - 0.9;
      } else { phase = 'p_aim'; if (!pitchType) pitchType = 'FB'; }
      sb(); help(); pbar();
    }
    function throwPitch(type, target, kmh) {
      const path = SIM.pitchPath(type, target, kmh, userBats() ? D().scale : 1);
      P = { path, t0: now, swung: false, contact: null, cAt: 0, done: false };
      if (W.spr) W.spr.rel = now;
      if (!userBats()) humanOnce(W.fielders[0], 'punch', 0.12, 1.3, 1);
      phase = 'pitch';
      W.ball.visible = true; W.trail.visible = true; trailReset(SIM.RELEASE);
      info(`${SIM.PITCHES[type].name} ${Math.round(kmh)}km/h`); help();
      snd.whoosh();
      if (!userBats()) {
        const ai = SIM.aiBat(G, path, mode === 'game' ? 1 : 1);
        P.ai = ai;
        if (ai.swing) { P.swung = true; P.swingAt = now + path.T - 0.14 + (ai.res ? 0 : (Math.random() - 0.5) * 0.12); if (ai.res) { P.contact = ai.res; P.cAt = now + path.T; } }
      }
    }
    function swing() {
      if (phase !== 'pitch' && phase !== 'wait') return;
      if (!P || P.swung) { if (phase === 'wait') bump(); return; }
      P.swung = true; P.swingAt = now;
      snd.whoosh();
      const tBat = now + 0.14 - P.t0;
      const dt = tBat - P.path.T;
      const c = SIM.contact(dt, cursor.x - P.path.plate.x, cursor.y - P.path.plate.y, D().win, D().rad);
      if (c) { P.contact = c; P.cAt = P.t0 + Math.min(P.path.tCatch - 0.01, Math.max(0.05, P.path.T + dt)); }
    }
    function bump() { const b = $('.bb-help'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); } }
    function pitchDone(kind) {
      P.done = true;
      let ev;
      if (kind === 'take') ev = { type: P.path.strike ? 'look' : 'ball' };
      else if (kind === 'miss') ev = { type: 'swing' };
      const r = SIM.applyPitch(G, ev);
      afterPitch(r, null);
    }
    function afterPitch(r, o) {
      const batter = lastBatter;
      if (mode !== 'game') stats(r, o);
      if (r.pa || r.call === '파울') {
        const text = SIM.playText(G, r, o, batter);
        if (r.pa) addLog(text, r);
      }
      call(r, o);
      phase = 'after';
      if (r.runs && mode === 'game') snd.cheer(0.8);
      drawBoard(); sb();
      const wait = r.pa ? 2.1 : 1.15;
      pendingNext = now + wait;
      if (mode === 'game') {
        if (SIM.walkOff(G)) { G.over = true; addLog('끝내기! ' + SIM.TEAMS[1].name + ' 승리', { big: true }); }
        else if (r.side) { pendingSide = true; }
      }
      if (mode === 'derby' && G.stat.outs >= 10) G.over = true;
      if (mode !== 'game' && r.pa) { G.outs = 0; G.bases = [null, null, null]; }
      if (mode === 'pitch' && r.side) { G.outs = 0; G.bases = [null, null, null]; }
      if (mode === 'bat' && r.side) { G.outs = 0; G.bases = [null, null, null]; }
    }
    let pendingSide = false, lastBatter = '';
    function stats(r, o) {
      const s = G.stat;
      if (o && o.fl) { s.maxEv = Math.max(s.maxEv, o.fl.ev); if (o.kind === 'HR' || o.fl.dist > s.maxDist) s.maxDist = Math.max(s.maxDist, o.fl.dist); }
      if (mode === 'derby') { if (o && o.kind === 'HR') s.hrs++; else if (P && P.swung && (!o || o.kind !== 'FOUL' || true)) s.outs++; return; }
      if (!r.pa) return;
      s.pa++;
      if (r.kind === 'K') s.k++; else if (r.kind === 'BB') s.bb++;
      else if (o && /^(1B|2B|3B|HR|IPHR)$/.test(o.kind)) { s.h++; if (o.kind === 'HR' || o.kind === 'IPHR') s.hr++; }
    }
    function sideChange() {
      pendingSide = false;
      const wasTop = G.half === 0;
      SIM.nextHalf(G);
      if (G.over) { endGame(); return; }
      teamColors(); drawBoard();
      say(`${SIM.halfName(G)} · ${userBats() ? '공격' : '수비'}`, 1700);
      if (wasTop) pitchType = 'FB';
      nextPitch(3.0);
    }

    // 타구 연출 시작
    function startPlay() {
      const c = P.contact;
      const from = P.path.at(P.cAt - P.t0);
      const fl = SIM.flight(c.ev, c.la, c.phi, { x: from.x, y: from.y, z: Math.min(0.2, from.z) });
      const o = SIM.resolve(fl, { bases: G.bases, outs: G.outs });
      snd.crack(c.q); if (!fl.foul) snd.cheer(o.kind === 'HR' ? 1 : c.q * 0.6);
      phase = 'play';
      play = { o, fl, t0: now, ballT: o.endT, throwFrom: o.catchPt, done: false, shown: false };
      // 수비수 달려가기
      const F = SIM.FIELD;
      W.fielders.forEach((f, i) => { f.target = null; });
      if (o.fielder >= 0) { const q = o.catchPt; W.fielders[o.fielder].target = { x: q.x, z: q.z }; W.fielders[o.fielder].speed = F[o.fielder].sp; }
      // 주변 수비수: 베이스 커버
      const cover = { 1: 2, 2: o.fielder === 4 ? 3 : 4, 3: 5 };
      Object.entries(cover).forEach(([b, fi]) => { if (fi !== o.fielder && W.fielders[fi]) { W.fielders[fi].target = { x: SIM.BASES[b].x, z: SIM.BASES[b].z }; W.fielders[fi].speed = 6; } });
      // 주자: 결과가 정해지면 함께 달린다 (결과는 applyPitch 뒤 경로로)
      lastBatter = SIM.batterName(G);
      const r = SIM.applyPitch(G, { type: 'play', res: o });
      play.r = r;
      W.pci.visible = false; W.zone.visible = false; W.grid.visible = false; W.fielders[1].g.visible = true; W.ump.g.visible = true;
      if (o.kind !== 'FOUL' && o.kind !== 'FOUL_OUT') runPaths(r.paths, o);
      W.batter.g.visible = o.kind === 'FOUL' || o.kind === 'FOUL_OUT';
      statCard(fl, o);
    }
    function runPaths(paths, o) {
      let slot = 0;
      paths.forEach(p => {
        if (p.from === p.to && !p.out) return;
        const r = W.runners[slot++]; if (!r) return;
        r.g.visible = true; r.path = p; r.t = 0; r.dist = 0;
        const pts = []; const last = p.out ? Math.min(4, p.from + 1) : p.to;
        for (let b = p.from; b <= last; b++) pts.push(SIM.BASES[b % 4]);
        r.pts = pts; r.out = p.out;
        const b0 = SIM.BASES[p.from % 4]; r.g.position.set(b0.x + (p.from === 0 ? -0.8 : 0), 0, b0.z);
        r.speed = o.kind === 'HR' ? 9.5 : 7.3;
      });
    }
    function skipPlay() {
      if (phase === 'play' && play) { play.t0 = now - 99; }
      else if (phase === 'after') pendingNext = Math.min(pendingNext, now + 0.05);
    }

    // ---------- 매 프레임 ----------
    function frame(ts) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      const t = ts / 1000, dt = Math.min(0.05, clockLast ? t - clockLast : 0.016) * timeScale; clockLast = t; now += dt;
      tick(dt);
      renderer.render(scene, cam);
      fpsN++; if (t - fpsT > 1) { fps = Math.round(fpsN / (t - fpsT)); fpsN = 0; fpsT = t; }
    }
    function tick(dt) {
      // 처음 화면: 천천히 도는 구장
      if (mode === 'title') {
        orbit += dt * 0.06;
        const r = 92, a = orbit;
        cam.position.set(Math.sin(a) * r * 0.75, 34 + Math.sin(a * 0.7) * 6, 30 + Math.cos(a) * r * 0.35);
        camLookCur.set(0, 4, -55); cam.lookAt(camLookCur); cam.fov = portrait() ? 62 : 46; cam.updateProjectionMatrix();
        tickSprite();
        animFielders(dt); tickHumans(dt);
        return;
      }
      // 투구 준비 → 던짐
      if (phase === 'wait' && now >= pendingNext) {
        const ap = SIM.aiPitch(G, mode === 'derby');
        throwPitch(ap.type, ap.target, ap.kmh);
      }
      if (phase === 'pitch' && P) {
        const tp = now - P.t0;
        if (autoSwing && !P.swung && tp >= P.path.T - 0.14 + autoSwing.dt) { cursor = { x: P.path.plate.x, y: P.path.plate.y + autoSwing.dy }; const a = autoSwing; autoSwing = null; swing(); if (a.keep) autoSwing = a; }
        if (P.contact && now >= P.cAt) { startPlay(); }
        else if (tp >= P.path.tCatch && !P.done) { W.ball.visible = false; snd.mitt(); lastBatter = SIM.batterName(G); pitchDone(P.swung ? 'miss' : 'take'); }
        else { const q = P.path.at(Math.min(tp, P.path.tCatch)); W.ball.position.set(q.x, q.y, q.z); trailPush(q); }
        // 쉬움: 공이 지나갈 곳 살짝
        if (prefs.diff === 'easy' && userBats() && P) { const k = clamp((tp / P.path.T - 0.45) / 0.35, 0, 1); W.assist.position.set(P.path.plate.x, P.path.plate.y, 0.01); W.assist.material.opacity = k * 0.8 * (tp < P.path.T ? 1 : 0); W.assist.scale.setScalar(1); }
      }
      // 스윙 그림
      if (P && P.swung && W.batter.bat) { const s = (now - P.swingAt) / 0.3; batPose(W.batter, clamp(s, 0, 1)); }
      if (P && P.swung && W.batter.human && !P.hSw && now >= P.swingAt) { P.hSw = true; humanOnce(W.batter, 'swordslash', 0.2, 1.8, 2); }
      // 겨냥 원
      if (userBats() && phase !== 'play') { W.pci.position.set(cursor.x, cursor.y, 0.02); }
      else if (!userBats()) {
        W.pci.visible = phase === 'p_aim' || phase === 'p_meter';
        W.pci.scale.setScalar(0.07);
        W.pci.position.set((aim || cursor).x, (aim || cursor).y, 0.02);
        if (phase === 'p_meter' && meter) { meter.t += dt; const r = meterR(); W.meter.visible = true; W.meter.scale.setScalar(r); W.meter.position.set(aim.x, aim.y, 0.03); W.meter.material.color.set(r < 0.06 ? 0x5fd38a : r < 0.14 ? 0xffd36b : 0xff6a4a); }
        else W.meter.visible = false;
      }
      // 투수 와인드업 (2D 투수 그림이 있으면 그것으로)
      tickSprite();
      const pit = W.fielders[0];
      if (phase === 'wait' && pit.wind && now > pit.wind) { const k = clamp((now - pit.wind) / 0.9, 0, 1); pit.armR.rotation.x = -Math.sin(k * Math.PI) * 2.6; pit.legL.rotation.x = -Math.sin(k * Math.PI) * 1.1; pit.body.rotation.x = Math.sin(k * Math.PI * 0.5) * 0.2; }
      else if (phase === 'pitch' && P && now - P.t0 < 0.4) { const k = (now - P.t0) / 0.4; pit.armR.rotation.x = lerp(1.6, 0, k); pit.body.rotation.x = lerp(0.35, 0, k); pit.legL.rotation.x = 0; }
      else if (phase !== 'play') { pit.armR.rotation.x *= 0.85; pit.body.rotation.x *= 0.85; pit.legL.rotation.x *= 0.85; }
      if ((phase === 'play' || phase === 'after') && play) tickPlay(dt);
      animFielders(dt); tickHumans(dt);
      if (phase === 'after' && now >= pendingNext) { if (pendingSide) sideChange(); else nextPitch(); }
      // 카메라 따라가기
      if (camGoal && !play && !dbgCam) { cam.position.lerp(camGoal, 1 - Math.pow(0.002, dt)); camLookCur.lerp(camLook, 1 - Math.pow(0.002, dt)); cam.lookAt(camLookCur); }
      if (toastT && now > toastT) { const c = $('.bb-call'); if (c) c.classList.remove('on'); toastT = 0; }
    }
    function tickPlay(dt) {
      const o = play.o, pts = play.fl.pts, tt = now - play.t0;
      let bp;
      if (tt <= play.ballT) {
        let i = 1; while (i < pts.length - 1 && pts[i].t < tt) i++;
        const a = pts[i - 1], b = pts[i], k = clamp((tt - a.t) / ((b.t - a.t) || 1), 0, 1);
        bp = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) };
      } else if (o.throwTo >= 0 && tt <= play.ballT + o.throwT + (o.relay || 0)) {
        if (!play.threw && o.fielder >= 0) { play.threw = true; humanOnce(W.fielders[o.fielder], 'punch', 0.12, 1.5, 0.8); }
        const fromP = o.catchPt;
        const leg1 = tt - play.ballT;
        if (leg1 <= o.throwT) { const to = SIM.BASES[o.throwTo]; const k = leg1 / o.throwT; const d = Math.hypot(to.x - fromP.x, to.z - fromP.z); bp = { x: lerp(fromP.x, to.x, k), y: lerp(1.6, 1.3, k) + Math.sin(k * Math.PI) * d * 0.06, z: lerp(fromP.z, to.z, k) }; }
        else { const fr = SIM.BASES[2], to = SIM.BASES[1], k = (leg1 - o.throwT) / o.relay; bp = { x: lerp(fr.x, to.x, k), y: 1.4 + Math.sin(k * Math.PI) * 1.4, z: lerp(fr.z, to.z, k) }; }
      } else {
        bp = o.throwTo >= 0 ? (o.relay ? SIM.BASES[1] : SIM.BASES[o.throwTo]) : o.catchPt || pts[pts.length - 1];
        bp = { x: bp.x, y: o.throwTo >= 0 ? 1.3 : (o.catchPt ? 1.2 : bp.y || 0.04), z: bp.z };
        if (!play.shown) { play.shown = true; afterPitch(play.r, o); }
        if (o.throwTo >= 0 && !play.threw && o.fielder >= 0) { play.threw = true; }
      }
      if (o.kind === 'HR' && tt > play.ballT && !play.shown) { play.shown = true; afterPitch(play.r, o); cheer(); }
      W.ball.visible = !(o.kind === 'HR' && tt > play.ballT + 0.5);
      W.ball.position.set(bp.x, bp.y, bp.z); trailPush(bp);
      W.shadow.visible = W.ball.visible; W.shadow.position.set(bp.x, 0.06, bp.z); W.shadow.scale.setScalar(1 + bp.y * 0.08); W.shadow.material.opacity = clamp(0.4 - bp.y * 0.01, 0.1, 0.4);
      // 주자
      W.runners.forEach(r => {
        if (!r.pts || !r.g.visible) return;
        r.dist += r.speed * dt;
        let d = r.dist, seg = 0;
        while (seg < r.pts.length - 1 && d > 27.43) { d -= 27.43; seg++; }
        if (seg >= r.pts.length - 1) { const e = r.pts[r.pts.length - 1]; r.g.position.set(e.x, 0, e.z); r.run = 0; if (r.out && tt > play.ballT + 1.2) r.g.visible = false; if (r.pts.length - 1 === 4 || (r.path && r.path.to >= 4)) r.g.visible = tt < play.ballT + 1.6; return; }
        const a = r.pts[seg], b = r.pts[seg + 1], k = clamp(d / 27.43, 0, 1);
        r.g.position.set(lerp(a.x, b.x, k), 0, lerp(a.z, b.z, k));
        r.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); r.run += dt * 12;
      });
      // 카메라: 공 쪽으로
      const look = new T.Vector3(bp.x, Math.max(0.5, bp.y * 0.85), bp.z);
      const dist = Math.hypot(bp.x, bp.z);
      const goal = new T.Vector3(bp.x * 0.32, Math.max(9, 8 + dist * 0.16 + bp.y * 0.3), 16 + bp.z * 0.22);
      if (o.kind === 'FOUL' || o.kind === 'FOUL_OUT') goal.set(bp.x * 0.25, 9 + bp.y * 0.3, 18 + Math.max(0, bp.z) * 0.6);
      cam.fov = lerp(cam.fov, portrait() ? 62 : 48, 0.08); cam.updateProjectionMatrix();
      cam.position.lerp(goal, 1 - Math.pow(0.05, dt)); camLookCur.lerp(look, 1 - Math.pow(0.0005, dt)); cam.lookAt(camLookCur);
    }
    function animFielders(dt) {
      W.fielders.forEach((f, i) => {
        if (f.target) {
          const dx = f.target.x - f.g.position.x, dz = f.target.z - f.g.position.z, d = Math.hypot(dx, dz);
          if (d > 0.3) { const s = Math.min(d, (f.speed || 6) * dt); f.g.position.x += dx / d * s; f.g.position.z += dz / d * s; f.g.rotation.y = Math.atan2(dx, dz); f.run += dt * 12; }
          else f.run = 0;
        }
        if (f.crouch && !f.target) return;
        const sw = Math.sin(f.run) * 0.7 * (f.run ? 1 : 0);
        f.legL.rotation.x = i === 0 && phase === 'wait' ? f.legL.rotation.x : sw; f.legR.rotation.x = -sw; f.armL.rotation.x = -sw * 0.8;
        if (i !== 0) f.armR.rotation.x = sw * 0.8;
      });
      W.runners.forEach(r => { const sw = Math.sin(r.run || 0) * 0.8; r.legL.rotation.x = sw; r.legR.rotation.x = -sw; r.armL.rotation.x = -sw; r.armR.rotation.x = sw; });
    }
    function trailReset(p) { for (let i = 0; i < W.trailN; i++) { W.trailPos[i * 3] = p.x; W.trailPos[i * 3 + 1] = p.y; W.trailPos[i * 3 + 2] = p.z; } W.trail.geometry.attributes.position.needsUpdate = true; }
    function trailPush(p) { W.trailPos.copyWithin(3, 0, (W.trailN - 1) * 3); W.trailPos[0] = p.x; W.trailPos[1] = p.y; W.trailPos[2] = p.z; W.trail.geometry.attributes.position.needsUpdate = true; }

    // ---------- 투구 (사용자) ----------
    function meterR() { const k = Math.abs(Math.sin(meter.t * Math.PI / 0.95)); return 0.025 + k * 0.3; }
    function lockMeter() {
      if (phase !== 'p_meter' || !meter) return;
      const r = meterR() * 0.85, a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const target = { x: aim.x + Math.cos(a) * d, y: aim.y + Math.sin(a) * d };
      const Pk = SIM.PITCHES[pitchType];
      const kmh = lerp(Pk.kmh[0], Pk.kmh[1], clamp(1 - meterR() / 0.3, 0, 1) * 0.6 + Math.random() * 0.4);
      lastBatter = SIM.batterName(G);
      W.meter.visible = false;
      W.fielders[0].wind = now - 0.01;
      meter = null;
      throwPitch(pitchType, target, kmh);
    }
    function pickPitch(k) { if (!SIM.PITCHES[k]) return; pitchType = k; pbar(); help(); }

    // ---------- 화면 글 ----------
    function sb() {
      const s = $('.bb-sb'); if (!s || !G) return;
      const base = (i) => `<i class="${G.bases[i] ? 'on' : ''}"></i>`;
      const dots = (n, m, c) => Array.from({ length: m }, (_, i) => `<b class="${i < n ? 'on ' + c : ''}"></b>`).join('');
      const cnt = `<div class="bb-cnt"><span>B</span>${dots(G.balls, 3, 'g')}<span>S</span>${dots(G.strikes, 2, 'y')}<span>O</span>${dots(G.outs, 2, 'r')}</div>`;
      if (mode === 'game') {
        s.innerHTML = `<div class="bb-teams">${[0, 1].map(t => `<div class="${G.half === t ? 'atbat' : ''}"><em style="--c:${SIM.TEAMS[t].color}"></em><b>${SIM.TEAMS[t].name}</b><strong>${G.score[t]}</strong></div>`).join('')}</div>
          <div class="bb-inn"><span>${G.half ? '▼' : '▲'}</span><b>${G.inning}</b></div><div class="bb-dia">${base(1)}${base(2)}${base(0)}</div>${cnt}`;
      } else {
        const st = G.stat;
        const chip = mode === 'derby' ? `<div class="bb-chip"><span>홈런</span><b>${st.hrs}</b></div><div class="bb-chip"><span>남은 아웃</span><b>${Math.max(0, 10 - st.outs)}</b></div>`
          : mode === 'pitch' ? `<div class="bb-chip"><span>삼진</span><b>${st.k}</b></div><div class="bb-chip"><span>안타</span><b>${st.h}</b></div>`
            : `<div class="bb-chip"><span>안타</span><b>${st.h}/${st.pa}</b></div><div class="bb-chip"><span>홈런</span><b>${st.hr}</b></div>`;
        s.innerHTML = `<div class="bb-mode">${MODES[mode].icon} ${MODES[mode].name}</div>${chip}${mode === 'derby' ? '' : cnt}`;
      }
      const bt = $('.bb-batter');
      if (bt) bt.innerHTML = mode === 'derby' ? '' : `<span>${SIM.batterNo(G)}번 타자</span><b>${esc(SIM.batterName(G))}</b><em>${esc(SIM.TEAMS[mode === 'pitch' ? 1 : mode === 'bat' ? 0 : G.half].name)}</em>`;
    }
    function help() {
      const h = $('.bb-help'); if (!h) return;
      const touch = isTouch();
      let t = '';
      if (phase === 'play' || phase === 'after') t = touch ? '톡 하면 건너뛰기' : '클릭하면 건너뛰기';
      else if (userBats()) t = touch ? '공이 지나갈 곳을 <b>제때 톡</b>' : '마우스로 원을 공에 맞추고 <b>클릭</b> 또는 <kbd>Space</kbd>';
      else if (phase === 'p_aim') t = `<b>${SIM.PITCHES[pitchType].name}</b> · 존에서 던질 곳을 ${touch ? '톡' : '클릭'}`;
      else if (phase === 'p_meter') t = `원이 <b>가장 작을 때</b> 한 번 더 ${touch ? '톡' : '클릭'}`;
      h.innerHTML = t;
    }
    function pbar() {
      const b = $('.bb-pbar'); if (!b) return;
      if (userBats() || mode === 'title') { b.innerHTML = ''; b.hidden = true; return; }
      b.hidden = false;
      b.innerHTML = SIM.PITCH_KEYS.map((k, i) => `<button data-bb="pt" data-k="${k}" class="${pitchType === k ? 'on' : ''}"><kbd>${i + 1}</kbd>${SIM.PITCHES[k].name}<small>${SIM.PITCHES[k].kmh[0]}~${SIM.PITCHES[k].kmh[1]}</small></button>`).join('');
    }
    function info(t) { const e = $('.bb-pinfo'); if (!e) return; e.textContent = t; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
    function say(t, ms) { const c = $('.bb-call'); if (!c) return; c.className = 'bb-call on'; c.innerHTML = `<b>${esc(t)}</b>`; toastT = now + (ms || 1400) / 1000; }
    function call(r, o) {
      const c = $('.bb-call'); if (!c) return;
      const big = o && (o.kind === 'HR' || o.kind === 'IPHR') ? 'hr' : o && /^(1B|2B|3B)$/.test(o.kind) ? 'hit' : r.kind === 'K' ? 'k' : (r.outs || (o && o.outs)) ? 'out' : '';
      const sub = r.runs ? `${r.runs}점!` : r.kind === 'K' || r.kind === 'BB' ? '' : o && o.sac ? '3루 주자 득점' : '';
      c.className = 'bb-call on ' + big;
      c.innerHTML = `<b>${esc(r.call)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
      toastT = now + (r.pa ? 2.0 : 1.0);
    }
    function statCard(fl, o) {
      const e = $('.bb-stat'); if (!e) return;
      if (o.kind === 'FOUL') { e.classList.remove('on'); return; }
      e.innerHTML = `<div><span>타구 속도</span><b>${Math.round(fl.ev)}<small>km/h</small></b></div><div><span>발사각</span><b>${Math.round(fl.la)}<small>°</small></b></div><div><span>비거리</span><b>${Math.round(fl.dist)}<small>m</small></b></div>`;
      e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
      clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 4200);
    }
    function logClear() { const l = $('.bb-log'); if (l) l.innerHTML = ''; }
    function addLog(text, r) {
      if (!G) return;
      const big = !!(r && (r.runs || r.big || /^(HR|IPHR|2B|3B)$/.test(r.kind || '')));
      const pre = mode === 'game' ? SIM.halfName(G).replace(/(\d+)회/, '$1회') + ' ' : '';
      G.log.push({ text: pre + text, big });
      const l = $('.bb-log'); if (!l) return;
      const d = document.createElement('p'); d.className = big ? 'big' : ''; d.textContent = pre + text; l.prepend(d);
      while (l.children.length > 4) l.lastChild.remove();
      if (opt.onPlay) try { opt.onPlay({ text: pre + text, game: G }); } catch (e) { /* 무시 */ }
    }

    // ---------- 처음 화면 · 설정 · 끝 ----------
    function titleHtml() {
      return `<div class="bb-tin">
        <div class="bb-logo"><small>CRION · PLAY PACK PROTOTYPE</small><h1>CRION<br><em>BASEBALL</em></h1><p>플레이팩 경기 장면에 쓸 3D 야구 · 개발자 버전</p></div>
        <div class="bb-modes">${Object.entries(MODES).map(([k, m]) => `<button data-bb="mode" data-m="${k}"><i>${m.icon}</i><b>${m.name}</b><span>${k === 'game' ? `${prefs.innings}이닝 · ` : ''}${m.desc}</span></button>`).join('')}</div>
        <div class="bb-opts">
          <div><span>난이도</span>${['easy', 'normal', 'hard'].map(k => `<button data-bb="diff" data-v="${k}" class="${prefs.diff === k ? 'on' : ''}">${SIM.DIFF[k].label}</button>`).join('')}</div>
          <div><span>경기 길이</span>${[1, 3, 5, 9].map(n => `<button data-bb="inn" data-v="${n}" class="${prefs.innings === n ? 'on' : ''}">${n}이닝</button>`).join('')}</div>
          <div><span>소리</span><button data-bb="snd" class="${prefs.sound ? 'on' : ''}">${prefs.sound ? '켜짐' : '꺼짐'}</button><span>존 표시</span><button data-bb="zone" class="${prefs.zone ? 'on' : ''}">${prefs.zone ? '켜짐' : '꺼짐'}</button><span>화질</span><button data-bb="hq" class="${prefs.hq ? 'on' : ''}">${prefs.hq ? '높음' : '낮음'}</button></div>
        </div>
        <details class="bb-how"><summary>조작 방법</summary>
          <p><b>칠 때</b> — 투수가 공을 던지면 노란 원(겨냥 원)을 공이 지나갈 곳에 두고 제때 누르세요. PC는 마우스로 원을 움직이고 클릭(또는 Space), 폰은 그곳을 톡. 원의 위를 맞히면 땅볼, 아래를 맞히면 뜬공. 빨리 치면 당겨 치고(왼쪽), 늦으면 밀어 쳐요(오른쪽).</p>
          <p><b>던질 때</b> — 아래에서 구종(1~5)을 고르고, 스트라이크 존의 던질 곳을 누른 뒤, 줄었다 커지는 원이 가장 작을 때 한 번 더. 원이 작을수록 정확하고 빨라요.</p>
          <p>⋯ 메뉴에서 언제든 처음 화면·결과 복사. 이 화면은 크랙에 아무것도 보내지 않아요.</p>
          <p class="bb-cred">3D 모델 (Poly Pizza): "Man"·"Glove"·"Bench" by Quaternius (CC0) · "Baseball"·"Baseball bat"·"Baseball cap"·"Billboard" by Poly by Google (CC BY) · "Light Post" by Zsky (CC BY). 2D 투수 그림: 히리온.</p>
        </details>
      </div>`;
    }
    function showTitle() {
      mode = 'title'; phase = 'idle'; G = null; P = null; play = null;
      hud.hidden = true; modalEl.hidden = true; titleEl.hidden = false; titleEl.innerHTML = titleHtml();
      if (W.ball) { resetField(); W.pci.visible = false; W.zone.visible = false; W.grid.visible = false; W.meter.visible = false; W.batter.g.visible = true; teamColors(); drawBoard(); }
    }
    function openPause() {
      if (mode === 'title') return;
      modalEl.hidden = false;
      modalEl.innerHTML = `<div class="bb-box"><h3>${esc(MODES[mode].name)} · 잠깐 멈춤</h3>
        <div class="bb-opts"><div><span>난이도</span>${['easy', 'normal', 'hard'].map(k => `<button data-bb="diff" data-v="${k}" class="${prefs.diff === k ? 'on' : ''}">${SIM.DIFF[k].label}</button>`).join('')}</div>
        <div><span>소리</span><button data-bb="snd" class="${prefs.sound ? 'on' : ''}">${prefs.sound ? '켜짐' : '꺼짐'}</button><span>존 표시</span><button data-bb="zone" class="${prefs.zone ? 'on' : ''}">${prefs.zone ? '켜짐' : '꺼짐'}</button><span>화질</span><button data-bb="hq" class="${prefs.hq ? 'on' : ''}">${prefs.hq ? '높음' : '낮음'}</button></div></div>
        <div class="bb-btns"><button data-bb="resume" class="pri">계속하기</button><button data-bb="copy">결과 복사</button><button data-bb="title">처음 화면</button></div></div>`;
    }
    function endGame() {
      phase = 'over'; drawBoard();
      const s = G.stat;
      let head, body;
      if (mode === 'game') {
        const win = G.score[0] > G.score[1] ? 0 : G.score[1] > G.score[0] ? 1 : -1;
        head = win < 0 ? '무승부' : win === 0 ? `${SIM.TEAMS[0].name} 승리!` : `${SIM.TEAMS[1].name} 승리`;
        const N = Math.max(G.innings, G.line[0].length, G.line[1].length);
        body = `<table class="bb-line"><tr><th></th>${Array.from({ length: N }, (_, i) => `<th>${i + 1}</th>`).join('')}<th>R</th><th>H</th></tr>${[0, 1].map(t => `<tr><td><em style="--c:${SIM.TEAMS[t].color}"></em>${SIM.TEAMS[t].name}</td>${Array.from({ length: N }, (_, i) => `<td>${G.line[t][i] == null ? 'X' : G.line[t][i]}</td>`).join('')}<td><b>${G.score[t]}</b></td><td>${G.hits[t]}</td></tr>`).join('')}</table>
          <ul class="bb-hl">${G.log.filter(l => l.big).slice(-5).map(l => `<li>${esc(l.text)}</li>`).join('') || '<li>큰 장면 없이 끝났어요</li>'}</ul>`;
      } else if (mode === 'derby') {
        head = `홈런 ${s.hrs}개!`; body = `<p class="bb-big">최고 비거리 <b>${Math.round(s.maxDist)}m</b> · 최고 타구속도 <b>${Math.round(s.maxEv)}km/h</b></p>`;
      } else { head = '끝'; body = ''; }
      modalEl.hidden = false;
      modalEl.innerHTML = `<div class="bb-box end"><small>경기 끝</small><h3>${esc(head)}</h3>${body}
        <div class="bb-btns"><button data-bb="again" class="pri">다시 하기</button><button data-bb="copy">결과 복사</button><button data-bb="title">처음 화면</button></div></div>`;
      if (opt.onEnd) try { opt.onEnd({ game: G, text: resultText() }); } catch (e) { /* 무시 */ }
    }
    function resultText() {
      if (!G) return '';
      if (mode === 'game') return SIM.summary(G);
      const s = G.stat;
      if (mode === 'derby') return `[CRION 야구 · 홈런 더비] 홈런 ${s.hrs}개 · 최고 비거리 ${Math.round(s.maxDist)}m · 최고 타구속도 ${Math.round(s.maxEv)}km/h`;
      if (mode === 'pitch') return `[CRION 야구 · 투구 연습] 상대 ${s.pa}명 · 삼진 ${s.k} · 볼넷 ${s.bb} · 맞은 안타 ${s.h}`;
      return `[CRION 야구 · 타격 연습] ${s.pa}타석 ${s.h}안타 (${s.hr}홈런) · 최고 타구속도 ${Math.round(s.maxEv)}km/h · 최장 ${Math.round(s.maxDist)}m`;
    }
    function copyResult() { const t = resultText(); if (!t) return; if (opt.copy) opt.copy(t); else try { navigator.clipboard.writeText(t); } catch (e) { /* 못 함 */ } }

    // ---------- 단추 ----------
    function onClick(ev) {
      const b = ev.target.closest('[data-bb]'); if (!b || !wrap.contains(b)) return;
      const k = b.dataset.bb;
      ev.stopPropagation();
      if (k === 'mode') startMode(b.dataset.m);
      else if (k === 'diff') { prefs.diff = b.dataset.v; savePrefs(prefs); rerenderOpts(); if (W.pci) W.pci.scale.setScalar(D().rad); }
      else if (k === 'inn') { prefs.innings = +b.dataset.v; savePrefs(prefs); rerenderOpts(); }
      else if (k === 'snd') { prefs.sound = !prefs.sound; savePrefs(prefs); if (!prefs.sound) snd.stop(); rerenderOpts(); }
      else if (k === 'hq') { prefs.hq = !prefs.hq; savePrefs(prefs); rerenderOpts(); if (renderer) { renderer.setPixelRatio(prefs.hq ? Math.min(2, root.devicePixelRatio || 1) : Math.min(1.25, root.devicePixelRatio || 1)); renderer.shadowMap.enabled = prefs.hq; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); resize(); } }
      else if (k === 'zone') { prefs.zone = !prefs.zone; savePrefs(prefs); rerenderOpts(); if (mode !== 'title') setCam(false); }
      else if (k === 'pt') pickPitch(b.dataset.k);
      else if (k === 'pause') openPause();
      else if (k === 'menu') openMenu();
      else if (k === 'resume') { modalEl.hidden = true; }
      else if (k === 'title') showTitle();
      else if (k === 'again') startMode(mode);
      else if (k === 'copy') copyResult();
    }
    function rerenderOpts() { if (mode === 'title') titleEl.innerHTML = titleHtml(); else openPause(); }
    function openMenu() {
      const items = [
        { label: '잠깐 멈춤 · 설정', fn: openPause },
        { label: '결과 복사', fn: copyResult },
        { label: '처음 화면 (모드 고르기)', fn: showTitle }
      ];
      if (opt.menu) opt.menu(items); else openPause();
    }

    // ---------- 시작 ----------
    wrap.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    const onVis = () => { clockLast = 0; };
    document.addEventListener('visibilitychange', onVis);
    titleEl.innerHTML = titleHtml();
    hud.hidden = true;
    const ready = loadThree().then(() => {
      if (dead) return;
      build();
      const c = cv();
      c.addEventListener('pointermove', onMove);
      c.addEventListener('pointerdown', onDown);
      c.style.touchAction = 'none';
      resize();
      $('.bb-load').remove();
      raf = requestAnimationFrame(frame);
      if (opt.mode) startMode(opt.mode);
    }).catch((e) => { const l = $('.bb-load'); if (l) l.innerHTML = '<span>3D 화면을 열지 못했어요. 앱을 다시 켜 주세요.</span>'; console.error(e); });

    const api = {
      el: wrap, ready, prefs,
      get state() { return { fps, mode, phase, G, P: P && { type: P.path.type, T: P.path.T, plate: P.path.plate, strike: P.path.strike, swung: P.swung, contact: !!P.contact }, play: play && { kind: play.o.kind, label: play.o.label, dist: play.fl.dist } }; },
      start: startMode, title: showTitle, result: resultText,
      // 시험·연출용: 다음 공을 바로 던지고, 완벽한 스윙을 한다
      debug: {
        pitchNow(type, target, kmh) { if (phase === 'wait') { const ap = SIM.aiPitch(G); throwPitch(type || ap.type, target || ap.target, kmh || ap.kmh); } },
        perfect(dy, dt) { if (!P) return false; cursor = { x: P.path.plate.x, y: P.path.plate.y + (dy || 0) }; const wait = P.path.T - 0.14 + (dt || 0) - (now - P.t0); return wait; },
        swingNow() { swing(); },
        auto(dy, dt, keep) { autoSwing = dy == null ? null : { dy: dy || 0, dt: dt || 0, keep: !!keep }; },
        speed(x) { timeScale = x || 1; },
        run(sec, until) { const h = 1 / 60; for (let i = 0; i < sec * 60; i++) { now += h; tick(h); if (until && until(api.state)) break; } return api.state; },
        cursor(x, y) { cursor = { x, y }; },
        skip: skipPlay,
        aim(x, y) { if (phase === 'p_aim') { aim = { x, y }; phase = 'p_meter'; meter = { t: 0.5 }; help(); } },
        lock: lockMeter,
        shot() { return renderer && renderer.domElement.toDataURL('image/webp', 0.9); },
        W() { return W; }, batShift(v) { BAT_SHIFT = v; }, T() { return T; }, cam() { return cam; },
        look(x, y, z, tx, ty, tz, fov) { dbgCam = true; cam.position.set(x, y, z); camLookCur.set(tx, ty, tz); cam.lookAt(camLookCur); if (fov) { cam.fov = fov; cam.updateProjectionMatrix(); } }
      },
      destroy() {
        dead = true; cancelAnimationFrame(raf);
        wrap.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
        if (ro) ro.disconnect(); else root.removeEventListener('resize', resize);
        snd.stop();
        if (renderer) { renderer.dispose(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); renderer.forceContextLoss && renderer.forceContextLoss(); }
        wrap.remove();
      }
    };
    return api;
  }

  root.CrionBaseball = { create, load: loadThree };
  // 플레이팩 실행기 (호스트 계약 o: el, pack, manifest, menu, toast, copy …)
  root.CrionBaseballRun = {
    start(o) {
      o.el.innerHTML = '';
      const spr = o.data && o.data.sprites && o.data.sprites.pitcher;
      const pitcherSprite = spr && o.files && o.files.has(spr.atlas) ? o.files.json(spr.meta).then(meta => ({ url: o.files.url(spr.atlas), meta })) : null;
      const MF = { man: 'character_man.glb', cap: 'cap_baseball.glb', glove: 'glove.glb', bat: 'bat_baseball.glb', ball: 'ball_baseball.glb', light: 'light_post.glb', board: 'billboard.glb', bench: 'bench.glb' };
      const models = o.files && o.files.has('assets/models/' + MF.man) ? Object.fromEntries(Object.entries(MF).filter(([, f]) => o.files.has('assets/models/' + f)).map(([k, f]) => [k, o.files.url('assets/models/' + f)])) : null;
      const bb = create(o.el, {
        pitcherSprite, models,
        menu: o.menu ? (items) => o.menu(items) : null,
        copy: (t) => { if (o.copy) o.copy(t); else try { navigator.clipboard.writeText(t); } catch (e) { /* 못 함 */ } }
      });
      return {
        onIpc() { /* 크랙 화면 없음 */ },
        destroy() { bb.destroy(); },
        get state() { return bb.state; },
        memory: {}, saves: [], bb
      };
    }
  };
})(window);
