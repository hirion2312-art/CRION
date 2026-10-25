# CRION 저장소 — 작업 규칙 (Claude 세션용)

히리온(크랙 크리에이터)의 팔로워용 데스크톱 앱. Electron. 사용자는 비개발자이니 결과는 쉬운 한국어로.

## 구조
- `src/main.js`, `src/preload-host.js` = 앱 본체(껍데기). 바꾸면 **새 설치 파일** 필요 → 먼저 히리온에게 알린다.
- `src/renderer/` = 화면 엔진. 바꾸고 `engine.json`의 `version`을 올려 push 하면 설치된 앱이 자동으로 받는다(다음 재시작에 적용).
  - `crack-preload.js` 크랙 페이지 안에서 응답 읽기·보내기
  - `crack-rules.js` 크랙 화면 선택자(인식이 틀리면 여기부터)
  - `catalog-extract.js` 작가 프로필에서 작품 목록 뽑기 (시험: `test/ui/run_profile.py`)
  - `catalog.js` 작품 목록 합치기: 프로필이 기본, 관리 페이지 값 덧입힘 (시험: `test/catalog.test.js`)
  - `reply.js` 응답 → 장면/상태창/선택지 해석 (시험: `test/reply.test.js`)
  - `app.js`, `app.css`, `index.html` 화면
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
- 작품별 전용 팩은 현재 중단(공용 화면만). 다시 시작하라는 말이 있기 전엔 만들지 않는다.
- 커밋 메시지는 한국어.
