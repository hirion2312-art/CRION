// CRION 메인 프로세스(껍데기): 창, 크랙 웹뷰 보안, 작품 목록, 화면 엔진 업데이트, 설정 저장
// 자주 바뀌는 화면 코드(src/renderer = '화면 엔진')는 업데이트로 받아 교체한다. 이 파일은 거의 안 바뀐다.
'use strict';

const { app, BrowserWindow, ipcMain, session, shell, net, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const U = require('./updater');

const API_LEVEL = 3; // 껍데기가 화면 엔진에 열어 주는 기능 묶음의 버전
const CRACK_ORIGIN = 'https://crack.wrtn.ai';
const isCrackHost = (h) => h === 'wrtn.ai' || h.endsWith('.wrtn.ai');
const ALLOWED_HOSTS = [
  'wrtn.ai', 'accounts.google.com', 'kauth.kakao.com', 'accounts.kakao.com', 'logins.daum.net',
  'appleid.apple.com', 'nid.naver.com', 'www.facebook.com', 'm.facebook.com'
];
const isAllowedHost = (h) => ALLOWED_HOSTS.some(a => h === a || h.endsWith('.' + a));
const hostOf = (u) => { try { return new URL(u).hostname; } catch (e) { return ''; } };

const ROOT = path.join(__dirname, '..');
const BUNDLED_ENGINE = path.join(__dirname, 'renderer');
const WORKS_FILE = path.join(ROOT, 'config', 'works.json');
const APP_CONFIG_FILE = path.join(ROOT, 'config', 'app.json');

let userEngines, settingsFile, catalogFile, win;
let engine = null; // { dir, version, source }
const appConfig = readJson(APP_CONFIG_FILE, {});

// ---------- 설정 ----------
const DEFAULT_SETTINGS = {
  onboarded: false,
  volume: 60,
  textSpeed: 'normal',
  choiceSend: true,
  autoUpdate: true,
  workUrls: {},       // 작품별 '이어하기' 주소 (마지막으로 플레이한 대화방)
  recent: [],         // 최근 플레이한 작품 id
  registryUrl: '',
  engineBad: []
};
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function loadSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(settingsFile, {})); }
function saveSettings(s) { fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2)); return s; }
const registryUrl = () => loadSettings().registryUrl || appConfig.registryUrl || '';
const registryBase = () => { const u = registryUrl(); return u ? u.replace(/[^/]*$/, '') : ''; };

// ---------- 화면 엔진 ----------
function readEngine(dir, source) {
  const meta = readJson(path.join(dir, 'engine.json'), null);
  if (!meta || !meta.version || !fs.existsSync(path.join(dir, 'index.html'))) return null;
  return { dir, version: meta.version, apiLevel: meta.apiLevel || 1, minShell: meta.minShell || '0.0.0', source };
}

function pickEngine() {
  const bad = loadSettings().engineBad || [];
  let best = readEngine(BUNDLED_ENGINE, 'bundled');
  if (fs.existsSync(userEngines)) {
    for (const name of fs.readdirSync(userEngines)) {
      if (name.includes('.tmp-') || name.endsWith('.prev')) continue;
      const e = readEngine(path.join(userEngines, name), 'update');
      if (!e || bad.includes(e.version)) continue;
      if (e.apiLevel !== API_LEVEL || U.cmpVer(app.getVersion(), e.minShell) < 0) continue;
      if (!best || U.cmpVer(e.version, best.version) > 0) best = e;
    }
  }
  return best;
}

function pruneEngines(keep) {
  if (!fs.existsSync(userEngines)) return;
  const names = fs.readdirSync(userEngines).filter(n => !n.includes('.tmp-') && !n.endsWith('.prev'))
    .sort((a, b) => U.cmpVer(b, a));
  names.slice(keep).forEach(n => U.rmrf(path.join(userEngines, n)));
  fs.readdirSync(userEngines).filter(n => n.includes('.tmp-') || n.endsWith('.prev')).forEach(n => U.rmrf(path.join(userEngines, n)));
}

// ---------- 작품 목록 ----------
// 세 곳을 합친다: ① 앱에 든 목록(config/works.json) ② 업데이트 서버의 catalog.json ③ 작가 프로필에서 읽어 온 목록
const normUrl = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, ''); } catch (e) { return String(u || ''); } };
let remoteCatalog = null;
async function loadRemoteCatalog() {
  const base = registryBase();
  if (!base) return null;
  try {
    const res = await net.fetch(base + 'catalog.json', { cache: 'no-store' });
    if (!res.ok) return null;
    remoteCatalog = await res.json();
    fs.writeFileSync(path.join(app.getPath('userData'), 'catalog-remote.json'), JSON.stringify(remoteCatalog));
  } catch (e) { /* 오프라인이면 지난번 것 */ }
  return remoteCatalog;
}

function mergeWorks() {
  const bundled = readJson(WORKS_FILE, { works: [] });
  const remote = remoteCatalog || readJson(path.join(app.getPath('userData'), 'catalog-remote.json'), null);
  const synced = readJson(catalogFile, { works: [] });
  const base = (remote && remote.works && remote.works.length) ? remote : bundled;
  const hidden = new Set([].concat(bundled.hidden || [], (remote && remote.hidden) || []).map(normUrl));
  const list = [];
  const byUrl = new Map();
  for (const w of base.works || []) {
    const item = Object.assign({}, w);
    list.push(item);
    if (w.url) byUrl.set(normUrl(w.url), item);
  }
  // 프로필에서 읽은 작품: 썸네일·제목을 채우고, 목록에 없던 새 작품은 뒤에 붙인다
  for (const s of synced.works || []) {
    const k = normUrl(s.url);
    if (hidden.has(k)) continue;
    const hit = byUrl.get(k) || list.find(w => w.name && s.title && (s.title.includes(w.name) || w.name.includes(s.title)));
    if (hit) {
      if (!hit.thumb && s.thumb) hit.thumb = s.thumb;
      if (!hit.url) hit.url = s.url;
    } else {
      const item = { id: 'w' + Buffer.from(k).toString('base64url').slice(-10), name: s.title || '이름 없는 작품', url: s.url, thumb: s.thumb, genre: '', auto: true };
      list.push(item);
      byUrl.set(k, item);
    }
  }
  return { works: list, syncedAt: synced.at || null, creatorUrl: (remote && remote.creatorUrl) || bundled.creatorUrl || appConfig.creatorUrl || '' };
}

let syncing = null;
function syncCatalog() {
  if (syncing) return syncing;
  const url = mergeWorks().creatorUrl;
  if (!url) return Promise.resolve({ ok: false, error: '작가 프로필 주소가 없어요' });
  syncing = new Promise((resolve) => {
    const w = new BrowserWindow({
      show: false, width: 1280, height: 900,
      webPreferences: { partition: 'persist:crack', contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    let done = false;
    const finish = (r) => { if (done) return; done = true; try { w.destroy(); } catch (e) { /* 이미 닫힘 */ } syncing = null; resolve(r); };
    const timeout = setTimeout(() => finish({ ok: false, error: '시간 초과' }), 45000);
    w.webContents.on('did-finish-load', async () => {
      try {
        await new Promise(r => setTimeout(r, 2500));
        const script = fs.readFileSync(path.join(engine.dir, 'catalog-extract.js'), 'utf8');
        const r = await w.webContents.executeJavaScript(script, true);
        clearTimeout(timeout);
        const works = (r && r.works) || [];
        if (works.length) fs.writeFileSync(catalogFile, JSON.stringify({ at: new Date().toISOString(), page: r.page, works }, null, 2));
        finish({ ok: works.length > 0, count: works.length, page: r && r.page, title: r && r.title, sample: works.slice(0, 40) });
      } catch (e) { clearTimeout(timeout); finish({ ok: false, error: String(e.message || e) }); }
    });
    w.webContents.on('did-fail-load', (_e, code, desc) => { clearTimeout(timeout); finish({ ok: false, error: desc || String(code) }); });
    w.loadURL(url);
  });
  return syncing;
}

// ---------- 업데이트 (화면 엔진 + 작품 목록) ----------
function emit(ev) { if (win && !win.isDestroyed()) win.webContents.send('updates:event', ev); }

let indexCache = { at: 0, url: '', data: null };
async function loadIndex(force) {
  const url = registryUrl();
  if (!url || !/^https:\/\//.test(url)) return null;
  if (!force && indexCache.data && indexCache.url === url && Date.now() - indexCache.at < 60000) return indexCache.data;
  const r = await U.fetchIndex({ fetchFn: net.fetch.bind(net), url, pubkey: appConfig.pubkey || '' });
  indexCache = { at: Date.now(), url, data: r.index };
  return r.index;
}

let checking = false;
async function checkUpdates(manual) {
  const result = { skipped: null, engine: null, error: null };
  if (checking) { result.skipped = 'busy'; return result; }
  if (!registryUrl()) { result.skipped = 'no-registry'; return result; }
  checking = true;
  try {
    const before = JSON.stringify(remoteCatalog && remoteCatalog.works);
    await loadRemoteCatalog();
    if (JSON.stringify(remoteCatalog && remoteCatalog.works) !== before) emit({ type: 'catalog' });
    const idx = await loadIndex(true);
    const s = loadSettings();
    const auto = s.autoUpdate !== false || manual;
    const e = idx && idx.engine;
    if (e && /^\d+\.\d+\.\d+$/.test(String(e.version)) && U.cmpVer(e.version, engine.version) > 0 && !(s.engineBad || []).includes(e.version)) {
      if (U.cmpVer(app.getVersion(), e.minShell || '0') < 0 || (e.apiLevel || API_LEVEL) !== API_LEVEL) {
        result.engine = { state: 'shell-old', version: e.version };
        emit({ type: 'shell-old', version: e.version, url: appConfig.downloadUrl || '' });
      } else if (auto) {
        const dest = path.join(userEngines, String(e.version));
        if (!fs.existsSync(path.join(dest, 'engine.json'))) {
          await U.syncDir({ fetchFn: net.fetch.bind(net), entry: e, destDir: dest, reuseDirs: [engine.dir] });
          pruneEngines(2);
        }
        result.engine = { state: 'ready', version: e.version };
        emit({ type: 'engine-ready', version: e.version });
      }
    }
  } catch (err) {
    result.error = String(err.message || err);
    if (manual) emit({ type: 'error', message: result.error });
  } finally {
    checking = false;
  }
  return result;
}

// ---------- 창 ----------
let readyTimer = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 1000, minHeight: 640,
    title: 'CRION',
    backgroundColor: '#f6f7f9',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-host.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: true
    }
  });
  win.loadFile(path.join(engine.dir, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  // 받아 온 엔진이 화면을 못 띄우면 그 버전을 막고 앱 안 엔진으로 되돌린다
  if (engine.source === 'update') {
    readyTimer = setTimeout(() => {
      const s = loadSettings();
      s.engineBad = (s.engineBad || []).concat(engine.version);
      saveSettings(s);
      app.relaunch();
      app.exit(0);
    }, 25000);
  }
}

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isCrackHost(hostOf(params.src || ''))) { event.preventDefault(); return; }
    delete webPreferences.preloadURL;
    webPreferences.preload = path.join(engine.dir, 'crack-preload.js');
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegration = false;
    webPreferences.sandbox = true;
  });

  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (isAllowedHost(hostOf(url))) {
        return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true } };
      }
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (e, url) => {
      if (!/^https:\/\//.test(url)) e.preventDefault();
    });
  }
});

app.whenReady().then(() => {
  userEngines = path.join(app.getPath('userData'), 'engines');
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  catalogFile = path.join(app.getPath('userData'), 'catalog-profile.json');
  fs.mkdirSync(userEngines, { recursive: true });
  engine = pickEngine();

  const crack = session.fromPartition('persist:crack');
  crack.setUserAgent(crack.getUserAgent().replace(/\s?Electron\/\S+/, '').replace(/\s?crion\/\S+/i, ''));
  crack.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write' || permission === 'notifications'));

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    engineVersion: engine.version,
    engineSource: engine.source,
    apiLevel: API_LEVEL,
    crackOrigin: CRACK_ORIGIN,
    platform: process.platform,
    registryUrl: registryUrl(),
    updatesEnabled: !!registryUrl(),
    links: appConfig.links || {}
  }));
  ipcMain.handle('engine:ready', () => { if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; } return true; });
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_e, patch) => {
    const s = loadSettings();
    for (const k of Object.keys(patch || {})) if (k in DEFAULT_SETTINGS && k !== 'engineBad') s[k] = patch[k];
    return saveSettings(s);
  });
  ipcMain.handle('works:get', () => mergeWorks());
  ipcMain.handle('works:sync', () => syncCatalog());
  ipcMain.handle('updates:check', () => checkUpdates(true));
  ipcMain.handle('app:relaunch', () => { app.relaunch(); app.exit(0); });
  ipcMain.handle('app:openFolder', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text || '')); return true; });
  ipcMain.handle('shell:open', (_e, url) => {
    if (/^https:\/\//.test(String(url))) shell.openExternal(String(url));
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

  // 시작 3초 뒤 한 번, 이후 30분마다 업데이트 확인. 작품 목록은 하루 한 번 프로필에서 다시 읽는다
  setTimeout(() => checkUpdates(false), 3000);
  setInterval(() => checkUpdates(false), 30 * 60 * 1000);
  setTimeout(() => {
    const at = readJson(catalogFile, {}).at;
    if (!at || Date.now() - Date.parse(at) > 24 * 3600 * 1000) syncCatalog().then(r => { if (r.ok) emit({ type: 'catalog' }); });
  }, 6000);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
