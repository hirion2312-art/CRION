// 업데이트 서명 열쇠 만들기 (한 번만): node scripts/keygen.js
// keys/private.pem = 비밀(절대 공개 금지, 깃에 올리지 않음) / 공개 열쇠는 config/app.json 에 자동으로 넣어요.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const priv = path.join(ROOT, 'keys', 'private.pem');
if (fs.existsSync(priv)) { console.error('이미 keys/private.pem 이 있어요. 지우고 다시 만들면 이미 배포한 앱은 업데이트를 못 받아요.'); process.exit(1); }
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.mkdirSync(path.dirname(priv), { recursive: true });
fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const pub = publicKey.export({ type: 'spki', format: 'pem' });
const cfgPath = path.join(ROOT, 'config', 'app.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
cfg.pubkey = pub;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
console.log('만들었어요.\n- 비밀 열쇠: keys/private.pem (깃허브 Secrets 의 CRION_SIGN_KEY 에 내용 전체를 넣으세요)\n- 공개 열쇠: config/app.json 에 저장됨 (앱을 새로 빌드해 배포해야 적용돼요)');
