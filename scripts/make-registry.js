// 업데이트 목록(registry) 만들기
//   node scripts/make-registry.js https://<아이디>.github.io/<저장소>/        (서명 없이)
//   CRION_SIGN_KEY="$(cat keys/private.pem)" node scripts/make-registry.js <주소>   (서명 포함)
// 결과: registry/ 폴더 (index.json, index.json.sig, engine/<버전>/..., packs/<id>/...)
// 이 폴더를 그대로 GitHub Pages 등에 올리면 앱이 알아서 받아 간다.
'use strict';
const fs = require('fs');
const path = require('path');
const U = require('../src/updater');

const base = process.argv[2];
if (!base || !/^https:\/\/.+\/$/.test(base)) {
  console.error('사용법: node scripts/make-registry.js https://<아이디>.github.io/<저장소>/   (끝에 / 포함)');
  process.exit(1);
}
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'registry');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function listFiles(dir, rel = '') {
  let out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out = out.concat(listFiles(dir, r));
    else out.push(r);
  }
  return out.sort();
}
function describe(dir) {
  const files = listFiles(dir).map(p => {
    const buf = fs.readFileSync(path.join(dir, p));
    return { path: p, sha256: U.sha256(buf), size: buf.length };
  });
  const rev = U.sha256(Buffer.from(files.map(f => f.path + f.sha256).join('\n'))).slice(0, 12);
  return { files, rev, bytes: files.reduce((a, f) => a + f.size, 0) };
}
function copyAll(srcDir, destDir, files) {
  for (const f of files) {
    const dest = path.join(destDir, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(srcDir, f.path), dest);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 화면 엔진
const engDir = path.join(ROOT, 'src', 'renderer');
const eng = JSON.parse(fs.readFileSync(path.join(engDir, 'engine.json'), 'utf8'));
const ed = describe(engDir);
copyAll(engDir, path.join(OUT, 'engine', eng.version), ed.files);
const engine = { version: eng.version, apiLevel: eng.apiLevel, minShell: eng.minShell, rev: ed.rev, bytes: ed.bytes, base: `${base}engine/${eng.version}/`, files: ed.files };
console.log(`화면 엔진 v${eng.version} (파일 ${ed.files.length}개, ${(ed.bytes / 1024).toFixed(0)}KB)`);

// 팩
const packs = [];
const SRC = path.join(ROOT, 'packs');
for (const id of fs.readdirSync(SRC)) {
  const dir = path.join(SRC, id);
  const mp = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mp)) continue;
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  if (m.id !== id) { console.error(`건너뜀: 폴더 이름(${id})과 manifest id(${m.id})가 달라요`); continue; }
  const d = describe(dir);
  copyAll(dir, path.join(OUT, 'packs', id), d.files);
  packs.push({ id, name: m.name, version: m.version, minEngine: m.minEngine || null, rev: d.rev, bytes: d.bytes, base: `${base}packs/${id}/`, files: d.files });
  console.log(`팩 ${m.name} v${m.version} (파일 ${d.files.length}개, ${(d.bytes / 1048576).toFixed(1)}MB, rev ${d.rev})`);
}

// 소개 겸 다운로드 페이지
const siteDir = path.join(ROOT, 'site');
if (fs.existsSync(siteDir)) for (const f of fs.readdirSync(siteDir)) fs.copyFileSync(path.join(siteDir, f), path.join(OUT, f));

// 작품 목록 (앱 업데이트 없이 목록·썸네일을 고칠 수 있게)
const works = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'works.json'), 'utf8'));
delete works._설명;
const thumbDir = path.join(ROOT, 'config', 'thumbs');
if (fs.existsSync(thumbDir)) {
  for (const f of fs.readdirSync(thumbDir)) {
    fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true });
    fs.copyFileSync(path.join(thumbDir, f), path.join(OUT, 'thumbs', f));
  }
  for (const w of works.works || []) {
    if (!w.thumb || /^https?:/.test(w.thumb)) continue;
    const name = w.thumb.replace(/^.*\//, '');
    const file = path.join(thumbDir, name);
    const v = fs.existsSync(file) ? U.sha256(fs.readFileSync(file)).slice(0, 8) : '0';
    w.thumb = base + 'thumbs/' + encodeURIComponent(name) + '?v=' + v;   // 같은 이름으로 바꿔 올려도 새 그림이 보이게
  }
}
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(Object.assign({ updated: new Date().toISOString() }, works), null, 2));
console.log(`작품 목록 ${(works.works || []).length}개 → catalog.json`);

const bytes = Buffer.from(JSON.stringify({ updated: new Date().toISOString(), app: pkg.version, engine, packs }, null, 2));
fs.writeFileSync(path.join(OUT, 'index.json'), bytes);
if (process.env.CRION_SIGN_KEY) {
  fs.writeFileSync(path.join(OUT, 'index.json.sig'), U.signBytes(bytes, process.env.CRION_SIGN_KEY));
  console.log('서명 완료: index.json.sig');
} else {
  console.log('※ 서명 없음 (CRION_SIGN_KEY 없음). config/app.json 에 pubkey를 넣었다면 앱이 이 목록을 거부해요.');
}
console.log(`\n완료: registry/index.json → 앱 설정의 목록 주소: ${base}index.json`);
