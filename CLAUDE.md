# CRION 저장소 — 작업 규칙 (Claude 세션용)

히리온(크랙 크리에이터)의 팔로워용 데스크톱 앱. Electron. 사용자는 비개발자이니 결과는 쉬운 한국어로.

## 구조
- `src/main.js`, `src/preload-host.js` = 앱 본체(껍데기). 바꾸면 **새 설치 파일** 필요 → 먼저 히리온에게 알린다.
- `src/renderer/` = 화면 엔진. 바꾸고 `engine.json`의 `version`을 올려 push 하면 설치된 앱이 자동으로 받는다(다음 재시작에 적용).
  - 0.4부터 플레이는 **크랙 화면 그대로**(webview). 응답을 읽어 다시 그리던 공용 게임 화면은 `archive/common-game-ui/`에 보관 — 플레이팩 만들 때 기반
  - `app.js`, `app.css`, `index.html` 화면: 왼쪽 메뉴(홈·스토어·커뮤니티·내 기록·설정), 시작 애니메이션, 첫 실행 사용법
  - `crack-preload.js` 크랙 화면 안 도우미: 주소·대화 화면 여부 알림(이어하기용), 진단. **플레이팩이 켜진 작품에서만**(호스트가 `crion:config {play:true}`) 응답 읽기·보내기(사용자 한 번 누름 = 한 번). 시험 `test/ui/run_preload.py`
  - `packstore.js` 팩 파일 받기·IndexedDB 저장·blob 주소 / `packrun.js` 팩 실행기(runner `academy` = 소환수 아카데미 학생 수첩) / `pk-academy.js` 응답 해석(시험 `test/academy.test.js`) / `pk-academy.css`
  - `pk-safehouse-run.js` 팩 실행기(runner `safehouse` = 「아포칼립스 안전지대의 관리자」, 프로젝트 A 화면) / `pk-safehouse.js` 응답 해석(시험 `test/safehouse.test.js`) / `pk-safehouse.css`(`.sh` 아래로 가둠). 화면 시험 `python3 test/ui/run_safehouse.py`
  - `pk-univ-run.js` 팩 실행기(runner `univ` = 「리온대학교 x스학과」 캠퍼스 무대 + 신입생 폰 · 입학 검사소 이식) / `pk-univ.js` 응답 해석(상태창 📅🎓📚💌📝 · 핸드폰 블록 · 가가오톡 · 뤼브리타임 · WREVERYTIME, 시험 `test/univ.test.js`) / `pk-univ.css`(`.uv` 아래). 화면 시험 `python3 test/ui/run_univ.py`. 팩 `packs/hirion.rion-univ`(개발자 전용 · 성인, 작품 l02a94)
  - `packs.js` 스토어 목록·설치 상태, 개발자 전용 팩(`index.devPacks`, manifest `devOnly`)은 개발자 로그인 때만 (시험: `test/packs.test.js`), `store.js` 내 기록 (시험: `test/store.test.js`)
  - `dev.js` 개발자 모드(설정 > 개발자 로그인, Ctrl+Shift+D): GitHub 열쇠를 비밀번호로 암호화해 그 컴퓨터에만 저장, 앱에서 작품 추가·수정·숨기기·삭제·순서 → `config/works.json`·`config/thumbs/`에 바로 커밋 (시험: `test/dev.test.js`, `test/ui/run_dev.py`)
  - `cloud.js` 서버(Supabase) 연결(익명 로그인·신고, CRION 계정 가입·로그인·닉네임, 게시판·좋아요·글 신고, 관리자 로그인) 시험 `test/cloud.test.js` / `sync.js` 계정 기록 동기화(crion.w.*·crion.pk.*·prefs·nick + 이어하기 주소, 칸 단위·합치기) 시험 `test/sync.test.js`. 서버 권한 시험 `python3 test/sql/schema_test.py`(로컬 Postgres). 서버 연결은 관리 페이지 '서버 연결' 카드, 비밀번호 바꾸기 `site/reset.html` / `board.js` 게시판·보낸 것·관리자 신고함 화면(시험 `test/ui/run_cloud.py`). 서버 설계도 `supabase/schema.sql`, 만드는 순서 `supabase/README.md`. 주소·키는 `config/app.json`의 `cloud`(비어 있으면 기능 꺼짐 → 디스코드 웹후크로만 전송)
  - `home.js` 홈 계산: '오늘의 추천작' 슬라이드(works.json `banners`, 없으면 추천+플레이팩 작품 자동) · 카테고리(`categories` + 작품 `cats`, 기본 '전체'(플레이팩 작품 위)·'플레이팩') (시험 `test/home.test.js`, 화면 `python3 test/ui/run_home.py`). 관리 페이지에서 슬라이드 사진·카테고리·끌어서 순서
  - `catalog-extract.js` 빈 결과만 돌려줌(작가 프로필 자동 수집 중단 — 남의 작품을 섞어 와서). 작품 목록은 관리 페이지만
- `packs/<id>/` 플레이팩 (형식: `packs/README.md`). 첫 팩 `hirion.summoner-academy` (화면 시험: `python3 test/ui/run_pack.py`). 두 번째 `hirion.safehouse`(「아포칼립스 안전지대의 관리자」, 전체 공개)
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
- 플레이팩은 스토어로 배포한다. 첫 팩은 「소환수 아카데미」(히리온이 요청함) — 제작 가이드: `docs/소환수아카데미_플레이팩_제작_가이드.md`. 다른 팩은 히리온이 만들라고 하기 전엔 만들지 않는다. CRION 계정은 크랙 계정과 별개(아이디+비밀번호, 서버엔 `아이디@id.hirion2312-art.github.io`로 저장 — 이메일 안 받음. 관리자만 이메일. 개인정보 처리방침 `site/privacy.html`, 바꾸면 앱 안내 문구 `PRIV_SHORT`도 같이). service_role 키는 절대 받지도 쓰지도 않는다.
- 커밋 메시지는 한국어.
- 작업할 때는 **크랙 프롬프트 ↔ 크리온 팩** 두 쪽의 상호작용·호환을 같이 본다: 프롬프트가 내는 글 형식(상태창·전투창·이름💬·이모지 트리거)을 크리온이 읽고, 크리온이 보내는 글(입학 결과·선택지)을 프롬프트가 받는다. 한쪽만 바꾸지 않는다. 크랙만으로 읽어도 자연스러워야 한다.
- 지금 만드는 것은 「소환수 아카데미+」(크리온 플레이팩 전용 강화판). 입학 등록·첫 소환은 팩 안(`pk-academy-reg.js`)에서 진행.
