// 맥 설치 파일용: Apple 개발자 인증서가 없어도 '손상되었습니다' 창이 뜨지 않게 앱에 임시(ad-hoc) 서명을 한다.
// electron-builder 의 afterPack 단계(앱 폴더가 만들어진 직후, dmg 만들기 전)에서 실행된다.
const { execFileSync } = require('child_process');
const path = require('path');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
  console.log('ad-hoc 서명:', app);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
