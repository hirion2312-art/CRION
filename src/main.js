// CRION 메인 프로세스(껍데기): 창, 크랙 웹뷰 보안, 팩 설치·업데이트, 화면 엔진 교체, 설정 저장
// 이 파일과 preload-host.js는 거의 바뀌지 않는다. 자주 바뀌는 화면 코드는 '엔진'(src/renderer)이라
// 업데이트로 받아 교체한다. 팩(작품별 내용)도 따로 업데이트된다.
'use strict';

const { app, BrowserWindow, ipcMain, session, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { pathToFileURL } = require('url');
const U = require('./updater');

const API_LEVEL = 2; // 껍데기가 화면 엔진에 열어 주는 기능 묶음의 버전
const CRACK_ORIGIN = 'https://crack.wrtn.ai';
const ALLOWED_HOSTS = [
  'crack.wrtn.ai', 'wrtn.ai', 'www.wrtn.ai', 'auth.wrtn.ai',
  'accounts.google.com', 'kauth.kakao.com', 'accounts.kakao.com', 'logins.daum.net',
  'appleid.apple.com', 'nid.naver.com', 'www.facebook.com', 'm.facebook.com'
];
const isAllowedHost = (h) => ALLOWED_HOSTS.some(a => h === a || h.endsWith('.' + a));
const hostOf = (u) => { try { return new URL(u).hostname; } catch (e) { return ''; } };

const ROOT = path.join(__dirname, '..');
const BUNDLED_PACKS = path.join(ROOT, 'packs');
const BUNDLED_ENGINE = path.join(__dirname, 'renderer');
const WORKS_FILE = path.join(ROOT, 'config', 'works.json');
const APP_CONFIG_FILE = path.join(ROOT, 'config', 'app.json');

let userPacks, userEngines, settingsFile, win;
let engine = null; // { dir, version, source }
const appConfig = readJson(APP_CONFIG_FILE, {});

protocol.registerSchemesAsPrivileged([
  { scheme: 'crionpack', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

// ---------- 설정 ----------
const DEFAULT_SETTINGS = {
  onboarded: false,
  volume: 60,
  intensity: 'mid',
  textSpeed: 'normal',
  autoUpdate: true,
  packEnabled: {},
  packOptions: {},
  workUrls: {},
  registryUrl: '',
  engineBad: []
};
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function loadSettings() { return Object.assign({}, DEFAULT_SETTINGS, readJson(settingsFile, {})); }
function saveSettings(s) { fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2)); return s; }
const registryUrl = () => loadSettings().registryUrl || appConfig.registryUrl || '';

// ---------- 화면 엔진 ----------
function readEngine(dir, source) {
  const meta = readJson(path.join(dir, 'engine.json'), null);
  if (!meta || !meta.version || !fs.existsSync(path.join(dir, 'index.html'))) return null;
  return { dir, version: meta.version, apiLevel: meta.apiLevel || 1, minShell: meta.minShell || '0.0.0', source };
}

// 앱에 들어 있는 엔진과, 업데이트로 받아 둔 엔진 중 쓸 수 있는 가장 새 것을 고른다
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

// ---------- 팩 ----------
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const safeRel = U.safeRel;

function listFiles(dir, base = dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

function readManifestDir(dir) {
  const m = readJson(path.join(dir, 'manifest.json'), null);
  return m && SAFE_ID.test(m.id || '') ? m : null;
}

function installedPacks() {
  if (!fs.existsSync(userPacks)) return [];
  return fs.readdirSync(userPacks)
    .map((name) => {
      const dir = path.join(userPacks, name);
      const m = readManifestDir(dir);
      if (!m || m.id !== name) return null; // .prev · .tmp 폴더는 건너뜀
      const meta = readJson(path.join(dir, '.crion-install.json'), {});
      return Object.assign({}, m, { _rev: meta.rev || null, _source: meta.source || null });
    })
    .filter(Boolean);
}

function bundledPacks() {
  if (!fs.existsSync(BUNDLED_PACKS)) return [];
  return fs.readdirSync(BUNDLED_PACKS)
    .map(id => readManifestDir(path.join(BUNDLED_PACKS, id)))
    .filter(Boolean)
    .map(m => ({ id: m.id, name: m.name, version: m.version, source: 'bundled' }));
}

let indexCache = { at: 0, url: '', data: null };
async function loadIndex(force) {
  const url = registryUrl();
  if (!url || !/^https:\/\//.test(url)) return null;
  if (!force && indexCache.data && indexCache.url === url && Date.now() - indexCache.at < 60000) return indexCache.data;
  const r = await U.fetchIndex({ fetchFn: net.fetch.bind(net), url, pubkey: appConfig.pubkey || '' });
  indexCache = { at: Date.now(), url, data: r.index };
  return r.index;
}

async function registryPacks() {
  try {
    const idx = await loadIndex(false);
    if (!idx) return [];
    return (idx.packs || [])
      .filter(p => SAFE_ID.test(p.id || '') && /^https:\/\//.test(p.base || '') && Array.isArray(p.files))
      .map(p => ({ id: p.id, name: p.name, version: p.version, rev: p.rev || null, bytes: p.bytes || 0, minEngine: p.minEngine || null, source: 'registry' }));
  } catch (e) { return []; }
}

function writeInstallMeta(dir, meta) {
  try { fs.writeFileSync(path.join(dir, '.crion-install.json'), JSON.stringify(Object.assign({ at: new Date().toISOString() }, meta))); } catch (e) { /* 기록 실패는 무시 */ }
}

function engineOk(minEngine) {
  return !minEngine || U.cmpVer(engine.version, minEngine) >= 0;
}

async function installPack(id, sender) {
  if (!SAFE_ID.test(id)) throw new Error('팩 이름이 올바르지 않아요.');
  const send = (d) => { if (sender && !sender.isDestroyed()) sender.send('packs:progress', Object.assign({ id }, d)); };
  const final = path.join(userPacks, id);

  let entry = null;
  try { const idx = await loadIndex(true); entry = idx && (idx.packs || []).find(p => p.id === id); } catch (e) { /* 목록을 못 받으면 앱 안 팩으로 */ }

  if (entry) {
    if (!engineOk(entry.minEngine)) throw new Error('이 팩은 더 새로운 화면 엔진(' + entry.minEngine + ')이 필요해요. 업데이트를 받은 뒤 앱을 다시 시작해 주세요.');
    const r = await U.syncDir({
      fetchFn: net.fetch.bind(net), entry, destDir: final, reuseDirs: [final],
      onProgress: (p) => send({ done: p.done, total: p.total, file: p.file, bytesDone: p.bytesDone, bytesTotal: p.bytesTotal })
    });
    const m = readManifestDir(final);
    if (!m || m.id !== id) { U.rmrf(final); throw new Error('팩 정보(manifest)가 올바르지 않아요.'); }
    writeInstallMeta(final, { version: m.version, rev: entry.rev || null, source: 'registry' });
    send({ done: r.files, total: r.files, file: '' });
    return m;
  }

  const bundledDir = path.join(BUNDLED_PACKS, id);
  if (!fs.existsSync(bundledDir)) throw new Error('팩을 찾지 못했어요.');
  const tmp = path.join(userPacks, '.' + id + '-' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  try {
    const files = listFiles(bundledDir);
    for (let i = 0; i < files.length; i++) {
      if (i % 8 === 0) send({ done: i, total: files.length, file: files[i] });
      const dest = path.join(tmp, files[i]);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(bundledDir, files[i]), dest);
      if (files.length < 30) await new Promise(r => setTimeout(r, 40));
    }
    send({ done: files.length, total: files.length, file: '' });
    const m = readManifestDir(tmp);
    if (!m || m.id !== id) throw new Error('팩 정보(manifest)가 올바르지 않아요.');
    U.rmrf(final);
    fs.renameSync(tmp, final);
    writeInstallMeta(final, { version: m.version, rev: null, source: 'bundled' });
    return m;
  } catch (e) {
    U.rmrf(tmp);
    throw e;
  }
}

// ---------- 업데이트 ----------
function emit(ev) { if (win && !win.isDestroyed()) win.webContents.send('updates:event', ev); }

let checking = false;
async function checkUpdates(manual) {
  const result = { skipped: null, engine: null, packs: [], error: null };
  if (checking) { result.skipped = 'busy'; return result; }
  const url = registryUrl();
  if (!url) { result.skipped = 'no-registry'; return result; }
  checking = true;
  try {
    const idx = await loadIndex(true);
    const s = loadSettings();
    const auto = s.autoUpdate !== false || manual;

    // 1) 화면 엔진
    const e = idx.engine;
    if (e && /^\d+\.\d+\.\d+$/.test(String(e.version)) && U.cmpVer(e.version, engine.version) > 0 && !(s.engineBad || []).includes(e.version)) {
      if (U.cmpVer(app.getVersion(), e.minShell || '0') < 0 || (e.apiLevel || API_LEVEL) !== API_LEVEL) {
        result.engine = { state: 'shell-old', version: e.version, minShell: e.minShell };
        emit({ type: 'shell-old', version: e.version, minShell: e.minShell, url: appConfig.downloadUrl || '' });
      } else if (auto) {
        const dest = path.join(userEngines, String(e.version));
        if (!fs.existsSync(path.join(dest, 'engine.json'))) {
          await U.syncDir({ fetchFn: net.fetch.bind(net), entry: e, destDir: dest, reuseDirs: [engine.dir] });
          pruneEngines(2);
        }
        result.engine = { state: 'ready', version: e.version };
        emit({ type: 'engine-ready', version: e.version });
      } else {
        result.engine = { state: 'available', version: e.version };
      }
    }

    // 2) 설치된 팩
    for (const p of installedPacks()) {
      const entry = (idx.packs || []).find(x => x.id === p.id);
      if (!entry) continue;
      const newer = U.cmpVer(entry.version, p.version) > 0 || (entry.rev && entry.rev !== p._rev && p._source === 'registry') || (entry.rev && p._source !== 'registry');
      if (!newer) continue;
      if (!engineOk(entry.minEngine)) { result.packs.push({ id: p.id, state: 'needs-engine', minEngine: entry.minEngine }); emit({ type: 'needs-restart', id: p.id }); continue; }
      if (!auto) { result.packs.push({ id: p.id, state: 'available', version: entry.version }); emit({ type: 'pack-available', id: p.id, version: entry.version }); continue; }
      try {
        const m = await installPack(p.id, win && win.webContents);
        result.packs.push({ id: p.id, state: 'updated', version: m.version });
        emit({ type: 'pack-updated', id: p.id, version: m.version, name: m.name });
      } catch (err) {
        result.packs.push({ id: p.id, state: 'error', error: String(err.message || err) });
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

// ---------- 파일 내보내기 (Range 지원: 음악·영상 되감기용) ----------
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};
function serveFile(req, file) {
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m) {
    let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]);
    let end = m[1] === '' || m[2] === '' ? size - 1 : Number(m[2]);
    end = Math.min(end, size - 1);
    if (!(start >= 0) || start > end) return new Response('range', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), {
      status: 206,
      headers: { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1) }
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), {
    status: 200, headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(size) }
  });
}

// ---------- 창 ----------
let readyTimer = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    title: 'CRION',
    backgroundColor: '#f7f8fa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload-host.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true
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
    if (!String(params.src || '').startsWith(CRACK_ORIGIN)) { event.preventDefault(); return; }
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
  userPacks = path.join(app.getPath('userData'), 'packs');
  userEngines = path.join(app.getPath('userData'), 'engines');
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  fs.mkdirSync(userPacks, { recursive: true });
  fs.mkdirSync(userEngines, { recursive: true });
  engine = pickEngine();

  const crack = session.fromPartition('persist:crack');
  crack.setUserAgent(crack.getUserAgent().replace(/\s?Electron\/\S+/, '').replace(/\s?crion\/\S+/i, ''));
  crack.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write' || permission === 'notifications'));

  protocol.handle('crionpack', (req) => {
    try {
      const u = new URL(req.url);
      const id = u.hostname;
      const rel = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
      if (!SAFE_ID.test(id) || !safeRel(rel)) return new Response('bad path', { status: 400 });
      const base = path.join(userPacks, id);
      const file = path.join(base, rel);
      if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('not found', { status: 404 });
      return serveFile(req, file);
    } catch (e) { return new Response('error', { status: 500 }); }
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    engineVersion: engine.version,
    engineSource: engine.source,
    apiLevel: API_LEVEL,
    crackOrigin: CRACK_ORIGIN,
    platform: process.platform,
    registryUrl: registryUrl(),
    updatesEnabled: !!registryUrl()
  }));
  ipcMain.handle('engine:ready', () => { if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; } return true; });
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (_e, patch) => {
    const s = loadSettings();
    for (const k of Object.keys(patch || {})) if (k in DEFAULT_SETTINGS && k !== 'engineBad') s[k] = patch[k];
    return saveSettings(s);
  });
  ipcMain.handle('works:get', () => readJson(WORKS_FILE, { works: [] }).works || []);
  ipcMain.handle('packs:list', async () => ({
    installed: installedPacks(),
    available: bundledPacks().concat(await registryPacks())
  }));
  ipcMain.handle('packs:install', async (e, id) => {
    try { return { ok: true, manifest: await installPack(String(id), e.sender) }; }
    catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('packs:uninstall', (_e, id) => {
    if (!SAFE_ID.test(String(id))) return { ok: false };
    U.rmrf(path.join(userPacks, String(id)));
    U.rmrf(path.join(userPacks, String(id) + '.prev'));
    return { ok: true };
  });
  ipcMain.handle('updates:check', () => checkUpdates(true));
  ipcMain.handle('app:relaunch', () => { app.relaunch(); app.exit(0); });
  ipcMain.handle('app:openFolder', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('shell:open', (_e, url) => {
    if (/^https:\/\//.test(String(url))) shell.openExternal(String(url));
  });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

  // 시작 3초 뒤 한 번, 이후 30분마다 업데이트 확인
  setTimeout(() => checkUpdates(false), 3000);
  setInterval(() => checkUpdates(false), 30 * 60 * 1000);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
