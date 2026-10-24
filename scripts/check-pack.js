// 팩 점검: node scripts/check-pack.js [팩id]
// manifest가 가리키는 파일이 없거나(빠짐), 폴더에 있는데 쓰이지 않거나, 전체 용량이 큰지 알려 준다.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ids = process.argv[2] ? [process.argv[2]] : fs.readdirSync(path.join(ROOT, 'packs')).filter(d => fs.existsSync(path.join(ROOT, 'packs', d, 'manifest.json')));
let bad = 0;
const walk = (d, r = '') => fs.readdirSync(path.join(d, r), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d, r ? r + '/' + e.name : e.name) : [r ? r + '/' + e.name : e.name]);
for (const id of ids) {
  const dir = path.join(ROOT, 'packs', id);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const refs = new Set();
  (function scan(v, k) {
    if (typeof v === 'string') { if (/\.(png|jpe?g|webp|gif|svg|mp3|ogg|wav|m4a|mp4|webm)$/i.test(v) && k !== 'src_note') refs.add(v.replace(/^\.\//, '')); }
    else if (Array.isArray(v)) v.forEach(x => scan(x, k));
    else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) scan(x, kk);
  })(m);
  const have = new Set(fs.existsSync(dir) ? walk(dir).filter(f => f !== 'manifest.json' && !f.startsWith('.')) : []);
  const missing = [...refs].filter(f => !have.has(f));
  const unused = [...have].filter(f => !refs.has(f));
  let bytes = 0; for (const f of have) bytes += fs.statSync(path.join(dir, f)).size;
  console.log(`\n■ ${m.name} v${m.version}  (참조 ${refs.size}개 / 폴더 안 파일 ${have.size}개 / ${(bytes / 1048576).toFixed(1)}MB)`);
  console.log(missing.length ? `  빠진 파일 ${missing.length}개 (화면에선 자리표시로 나와요):\n   ` + missing.slice(0, 30).join('\n   ') + (missing.length > 30 ? `\n   … 외 ${missing.length - 30}개` : '') : '  빠진 파일 없음 ✔');
  if (unused.length) console.log(`  manifest에 없는 파일 ${unused.length}개:\n   ` + unused.slice(0, 15).join('\n   '));
  if (bytes > 400 * 1048576) console.log('  ⚠ 400MB 넘음: 이미지는 webp, 음악은 mp3 128k 로 줄이길 권해요.');
  if (missing.length) bad++;
}
process.exit(0);
