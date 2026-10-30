# CRION 저장소 — 작업 규칙 (Claude 세션용)

히리온(크랙 크리에이터)의 팔로워용 데스크톱 앱. Electron. 사용자는 비개발자이니 결과는 쉬운 한국어로.

## 구조
- `src/main.js`, `src/preload-host.js` = 앱 본체(껍데기). 바꾸면 **새 설치 파일** 필요 → 먼저 히리온에게 알린다.
- `src/renderer/` = 화면 엔진. 바꾸고 `engine.json`의 `version`을 올려 push 하면 설치된 앱이 자동으로 받는다(다음 재시작에 적용).
  - 0.4부터 플레이는 **크랙 화면 그대로**(webview). 응답을 읽어 다시 그리던 공용 게임 화면은 `archive/common-game-ui/`에 보관 — 플레이팩 만들 때 기반
  - `app.js`, `app.css`, `index.html` 화면: 왼쪽 메뉴(홈·스토어·커뮤니티·내 기록·설정), 시작 애니메이션, 첫 실행 사용법
  - **폰 공통 틀(0.10~)**: 폰 세로(≤760px)+플레이팩 화면이면 CRION 머리줄(.pbar)을 숨기고(`#app.pkv`), 팩 상태줄의 ⋯ 단추가 `o.menu(extra)`(나가기·크랙 화면·새로고침·신고 + 팩 항목)를 연다. 팩마다 아래 탭(`.uv-tabs`/`.sh-tabs`/`.ak-nav`), 입력 중엔 탭 숨김(`.typing`), 키보드 높이 `--kb`, 알림은 위쪽. PC 화면은 그대로. 폰 화면 시험: `run_univ.py`(360·390·430), `run_mobile.py`, `run_mobile_academy.py`
  - `crack-preload.js` 크랙 화면 안 도우미: 주소·대화 화면 여부 알림(이어하기용), 진단. **플레이팩이 켜진 작품에서만**(호스트가 `crion:config {play:true}`) 응답 읽기·보내기(사용자 한 번 누름 = 한 번). 시험 `test/ui/run_preload.py`
  - `packstore.js` 팩 파일 받기·IndexedDB 저장·blob 주소 / `packrun.js` 팩 실행기(runner `academy` = 소환수 아카데미 학생 수첩) / `pk-academy.js` 응답 해석(시험 `test/academy.test.js`) / `pk-academy.css`
  - `pk-safehouse-run.js` 팩 실행기(runner `safehouse` = 「아포칼립스 안전지대의 관리자」, 프로젝트 A 화면) / `pk-safehouse.js` 응답 해석(시험 `test/safehouse.test.js`) / `pk-safehouse.css`(`.sh` 아래로 가둠). 화면 시험 `python3 test/ui/run_safehouse.py`
  - `pk-univ-run.js` 팩 실행기(runner `univ` = 「리온대학교 x스학과」 캠퍼스 무대 + 신입생 폰 · 입학 검사소 이식) / `pk-univ.js` 응답 해석(상태창 📅🎓📚💌📝 · 핸드폰 블록 · 가가오톡 · 뤼브리타임 · WREVERYTIME, 시험 `test/univ.test.js`) / `pk-univ.css`(`.uv` 아래). 화면 시험 `python3 test/ui/run_univ.py`. 팩 `packs/hirion.rion-univ`(공개 · 성인, 작품 l02a94)
  - `pk-maou-run.js` 팩 실행기(runner `maou` = 「마법소녀의 최종보스」 반지하 어전: 장소·인물 무대, 프롤로그 연출(data.json `prologue.shots` card·img·cast·seal, 그림 `assets/pro/` = 히리온 웹툰 컷을 잘라 씀, 누르면 다음), 그림자 왕관(권능 보석 5)·회수 의식, 발각의 눈·위기 연출, D+n 카드, 탭 오성(표적 서류·관계 5단계·추이)·마왕군·작전(지금 할 일·진행·명령·단서·엔딩)·일지(하루 기록·본 그림), 행동 칩·*행동* 넣기. 글꼴 Hahmlet) / `pk-maou.js` 응답 해석(상태창 🕖💫🔮💰❣️💀⚠️🏛️🤝 · [단서n] · 그림 등록명 → 장소·인물·권능회수·엔딩, 시험 `test/maou.test.js`) / `pk-maou.css`(`.mq` 아래). 화면 시험 `python3 test/ui/run_maou.py`(크랙 그림은 썸네일 자리 그림으로 대신, 글꼴은 `HAHMLET_TTF`=Hahmlet 파일 경로). 팩 `packs/hirion.magical-boss`(공개 · 성인, 1.0.0 정식 출시 2026-10-30, 작품 magical, 자료 `materials/magical-girl-final-boss/`). 숨은 진실·사랑/흑화 열쇠는 팩에 넣지 않음
  - **팩 공통 키트(0.11~)** `pk-kit.js`/`pk-kit.css`(`window.CrionKit`, 창은 `.pkk` · 클래스는 `pkk-` 접두어로 가둠): 이어하기 때 지난 줄거리, 지난 대사 찾기, 장면 카드(이미지 저장·공유), 읽기 설정(글자 크기·자동 넘김 = 화면 대사만 넘김, 크랙 전송 없음), 첫 사용법 코치(`crion.kit.coach.<팩id>`), 해석 실패 기록(`crion.kit.fails`, 신고에 진단 켜면 3개 첨부). 네 실행기 모두 `K=CrionKit.create(...)`·반환에 `kit`. 시험 `test/kit.test.js`. UI 시험은 코치 키를 미리 넣어야 클릭이 안 막힘. `whatsnew.js` = 엔진 올라간 뒤 첫 실행 때 「이번에 바뀐 것」 창(버전 올릴 때 같이 고침)
  - **혼자 실행 팩(0.12~)**: manifest `standalone: true` → 스토어 '바로 플레이'(app.js `openSolo`), 크랙 화면(webview) 없이 `#pk`만, ⋯ 메뉴에 크랙 항목 없음(`S.play.solo`)
  - `pk-baseball-run.js`(runner `baseball` = 3D 야구 프로토타입, three.js `vendor/three.min.js` r149를 켤 때 한 번 불러옴, `window.CrionBaseball.create(el,opt)`로 다른 팩에서도 열 수 있게) / `pk-baseball-sim.js`(규칙·물리: 투구 궤적·타격 판정·타구 비행·수비 판정·주자·이닝·컴퓨터 투수/타자, 시험 `test/baseball.test.js`) / `pk-baseball.css`(`.bb` 아래). 화면 시험 `python3 test/ui/run_baseball.py`(시험 환경은 느려 `debug.run(초)`로 빨리 감기, `BB_COVER=1`이면 스토어 표지 다시 만듦). 팩 `packs/hirion.baseball-proto`(개발자 전용 · 혼자 실행). 2D 투수 그림(0.12.1~): data.json `sprites.pitcher` = 아틀라스 webp + json(idle·windup·follow 프레임 구간, 마지막 windup 프레임 = 공 놓는 순간), 내가 칠 때(정면)만 3D 투수 대신 보임. 만든 법: 히리온 캐릭터 그림 → Kling 영상 → isnet-anime로 배경 지움 → 288×512 프레임 묶음. 3D 모델(0.12.2~): 팩 `assets/models/*.glb`(Poly Pizza, 표기 `ASSETS_LICENSES.txt`·manifest desc·처음 화면 조작 방법) — 사람(Quaternius Man, 뼈대·동작 idle/run/swordslash=스윙/punch=송구/jump·clapping=환호/sitting=포수·덕아웃)으로 수비·타자·주자·심판·덕아웃, 모자·글러브·방망이는 뼈에 붙임, 공·조명탑·광고판·벤치. 불러오기 `vendor/three-gltf.js`(r149 GLTFLoader+SkeletonUtils 전역판). CSP connect-src에 blob: 필요. 투구 전 타자 준비 2.4~3.2초. 크랙에 아무것도 안 보냄 — 나중에 경기 장면 팩에 붙일 때 결과 글(`summary`/`playText`)을 '입력칸 채우기'로
  - `packs.js` 스토어 목록·설치 상태, 개발자 전용 팩(`index.devPacks`, manifest `devOnly`)은 개발자 로그인 때만 (시험: `test/packs.test.js`), `store.js` 내 기록 (시험: `test/store.test.js`)
  - 개발자 모드 메뉴 「통계」(app.js statsHtml, 관리자 로그인 필요, 서버 crion_stats · 설계도 v4) 시험 `python3 test/ui/run_stats.py`
  - `dev.js` 개발자 모드(설정 > 개발자 로그인, Ctrl+Shift+D): GitHub 열쇠를 비밀번호로 암호화해 그 컴퓨터에만 저장, 앱에서 작품 추가·수정·숨기기·삭제·순서 → `config/works.json`·`config/thumbs/`에 바로 커밋 (시험: `test/dev.test.js`, `test/ui/run_dev.py`)
  - `cloud.js` 서버(Supabase) 연결(익명 로그인·신고, 하루 한 번 사용 기록 ping · 관리자 통계 stats, CRION 계정 가입·로그인·닉네임, 게시판·좋아요·글 신고, 관리자 로그인) 시험 `test/cloud.test.js` / `sync.js` 계정 기록 동기화(crion.w.*·crion.pk.*·prefs·nick + 이어하기 주소, 칸 단위·합치기) 시험 `test/sync.test.js`. 서버 권한 시험 `python3 test/sql/schema_test.py`(로컬 Postgres). 서버 연결은 관리 페이지 '서버 연결' 카드, 비밀번호 바꾸기 `site/reset.html` / `board.js` 게시판·보낸 것·관리자 신고함 화면(시험 `test/ui/run_cloud.py`). 서버 설계도 `supabase/schema.sql`, 만드는 순서 `supabase/README.md`. 주소·키는 `config/app.json`의 `cloud`(비어 있으면 기능 꺼짐 → 디스코드 웹후크로만 전송)
  - `home.js` 홈 계산: '오늘의 추천작' 슬라이드(works.json `banners`, 없으면 추천+플레이팩 작품 자동) · 카테고리(`categories` + 작품 `cats`, 기본 '전체'(플레이팩 작품 위)·'플레이팩') (시험 `test/home.test.js`, 화면 `python3 test/ui/run_home.py`). 관리 페이지에서 슬라이드 사진·카테고리·끌어서 순서
  - `catalog-extract.js` 빈 결과만 돌려줌(작가 프로필 자동 수집 중단 — 남의 작품을 섞어 와서). 작품 목록은 관리 페이지만
- **플레이팩 제작 노하우·함정·절차 총정리: `docs/플레이팩_제작_노하우_인계서_2026-10-30.md`** (새 팩·디자인 작업 전에 먼저 읽기). 그림 재구성·프롤로그 컷 자르기 스크립트 `tools/maou/`
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
