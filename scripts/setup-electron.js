// 맥/윈도우에서 Electron 설치가 반쯤 되다 만 경우를 고친다: npm run setup
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');
const dir = path.join(__dirname, '..', 'node_modules', 'electron');
if (!fs.existsSync(dir)) { console.error('먼저 npm install 을 해 주세요.'); process.exit(1); }
const dist = path.join(dir, 'dist');
const plat = process.platform;
const exe = plat === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : plat === 'win32' ? 'electron.exe' : 'electron';
const okNow = () => fs.existsSync(path.join(dist, exe)) && fs.existsSync(path.join(dir, 'path.txt')) &&
  (plat !== 'darwin' || fs.existsSync(path.join(dist, 'Electron.app/Contents/Frameworks/Electron Framework.framework/Electron Framework')));
if (okNow()) { console.log('Electron 정상입니다.'); process.exit(0); }
console.log('Electron 설치를 다시 시도합니다…');
spawnSync(process.execPath, [path.join(dir, 'install.js')], { stdio: 'inherit' });
if (okNow()) { console.log('고쳤어요.'); process.exit(0); }
if (plat === 'darwin') {
  const cache = path.join(os.homedir(), 'Library', 'Caches', 'electron');
  const zips = [];
  (function walk(d) { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/^electron-v.*-darwin-.*\.zip$/.test(e.name)) zips.push(p); } } catch (e) {} })(cache);
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const zip = zips.filter(z => z.includes('darwin-' + arch)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (zip) {
    console.log('받아 둔 파일로 직접 풀어요: ' + zip);
    fs.rmSync(dist, { recursive: true, force: true });
    fs.mkdirSync(dist, { recursive: true });
    execFileSync('ditto', ['-xk', zip, dist], { stdio: 'inherit' });
    fs.writeFileSync(path.join(dir, 'path.txt'), exe);
  }
}
if (okNow()) { console.log('고쳤어요. 이제 npm start'); process.exit(0); }
console.error('아직 안 고쳐졌어요. 이 화면 전체를 복사해서 알려 주세요.');
process.exit(1);
