# CRION 저장소 — 작업 규칙 (Claude 세션용)

히리온(크랙 크리에이터)의 팔로워용 데스크톱 앱. Electron. 사용자는 비개발자이니 결과는 쉬운 한국어로.

## 구조
- `src/main.js`, `src/preload-host.js` = 앱 본체(껍데기). 바꾸면 **새 설치 파일** 필요 → 먼저 히리온에게 알린다.
- `src/renderer/` = 화면 엔진. 바꾸고 `engine.json`의 `version`을 올려 push 하면 설치된 앱이 자동으로 받는다(다음 재시작에 적용).
  - 0.4부터 플레이는 **크랙 화면 그대로**(webview). 응답을 읽어 다시 그리던 공용 게임 화면은 `archive/common-game-ui/`에 보관 — 플레이팩 만들 때 기반
  - `app.js`, `app.css`, `index.html` 화면: 왼쪽 메뉴(홈·스토어·커뮤니티·내 기록·설정), 시작 애니메이션, 첫 실행 사용법
  - `crack-preload.js` 크랙 화면 안 도우미: 주소·대화 화면 여부만 알림(이어하기용), 진단. 읽기·보내기 없음
  - `packs.js` 스토어 목록·설치 상태 (시험: `test/packs.test.js`), `store.js` 내 기록 (시험: `test/store.test.js`)
  - `dev.js` 개발자 모드(설정 > 개발자 로그인, Ctrl+Shift+D): GitHub 열쇠를 비밀번호로 암호화해 그 컴퓨터에만 저장, 앱에서 작품 추가·수정·숨기기·삭제·순서 → `config/works.json`·`config/thumbs/`에 바로 커밋 (시험: `test/dev.test.js`, `test/ui/run_dev.py`)
  - `catalog-extract.js` 빈 결과만 돌려줌(작가 프로필 자동 수집 중단 — 남의 작품을 섞어 와서). 작품 목록은 관리 페이지만
- `packs/<id>/` 플레이팩 (형식: `packs/README.md`). 지금은 없음 → 스토어 "첫 플레이팩 준비 중"
- `config/works.json` 작품 목록·공지 (히리온은 관리 페이지 `site/admin.html`로 고친다)
- `site/` 다운로드 페이지·관리 페이지
- `.github/workflows/registry.yml` main push 시 서버(GitHub Pages) 배포
- `.github/workflows/build.yml` `package.json` version 이 바뀌면 설치 파일 빌드 → Releases

## 반영 절차
1. `src/renderer`만 고친다. 본체를 고쳐야 하면 멈추고 히리온에게 말한다.
2. `src/renderer/engine.json` version +1 (본체 변경이 필요한 엔진이면 `minShell`도 올리고 `package.json` version도 올린다).
3. `npm test` 통과, 화면 변경이면 `python3 test/ui/run.py`로 `test/out` 스크린샷 확인.
4. main 에 push. Actions "업데이트 배포"가 초록인지 확인.
5. 히리온에게: 무엇이 바뀌었는지 한두 줄 + "앱 재시작하면 적용".

## 원칙
- `config/works.json`·`config/thumbs/`는 히리온이 관리 페이지로 고친다. 세션은 작업 전 `git pull` 하고, 이 둘은 덮어쓰지 않는다(바꿀 일이 있으면 최신 파일을 받아 그 위에 고친다).
- 크랙에 자동 반복 전송 금지. 사용자가 누른 한 번 = 전송 한 번.
- 플레이팩은 스토어로 배포한다. 히리온이 만들라고 하기 전엔 팩을 만들지 않는다(스토어는 비워 둔다). 회원가입(계정)은 나중에.
- 커밋 메시지는 한국어.
