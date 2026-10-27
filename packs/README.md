# 플레이팩 형식 (스토어에 올리는 작품 전용 화면)

`packs/<id>/` 폴더 하나 = 플레이팩 하나. main 에 올리면 자동으로 업데이트 서버에 실리고 앱 **스토어**에 나타난다.
첫 팩: `hirion.summoner-academy` (소환수 아카데미 · 학생 수첩, 화면 엔진 0.5.0~).

## manifest.json
```json
{
  "id": "safehouse",                       // 폴더 이름과 같게
  "name": "안전지대 관리실",
  "version": "1.0.0",
  "workId": "safehouse",                   // config/works.json 의 작품 id (또는 workUrl)
  "summary": "한 줄 소개 (카드에 보임)",
  "desc": "# 자세한 소개\n- 목록 가능",     // 간단한 표기(#, -, **굵게**)
  "author": "히리온",
  "tags": ["생존", "관리"],
  "cover": "cover.webp",                   // 16:9 대표 그림
  "previews": ["shot1.webp", "shot2.webp"],// 스크린샷 (최대 8장)
  "ui": "ui.html",                         // '화면 미리보기'로 띄울 페이지 (?preview=1 이 붙는다, 예시 장면만)
  "minEngine": "0.4.0"
}
```

추가 칸 (0.5~)
- `runner`: 팩을 그리는 화면 엔진 실행기 이름. 지금은 `"academy"` 하나 (`src/renderer/packrun.js` + `pk-academy.js`/`.css`).
  팩에는 **코드가 들어가지 않는다**(자료·그림·음악만). 실행 코드는 화면 엔진에 있다 → 새 종류 팩은 엔진에 실행기를 추가.
- `workName`: 작품 이름으로도 연결 (관리 페이지 작품 이름에 이 글자가 들어 있으면 연결). `workUrl`을 넣으면 목록에 없어도 플레이 가능.
- 나머지는 실행기가 읽는 설정: `theme`, `bgm`(id→파일), `bgmByLoc`(장소→bgm id), `bgAlias`, `bgDefault`, `cg`, `fxMap` 등. `data.json`은 작품 자료(도감·인물·배지).

## 받기 · 실행 방식 (화면 엔진 0.5.0)
- 스토어 '받기' → 업데이트 서버 index.json 의 파일 목록(path·sha256·size)대로 하나씩 받아 sha256 확인 후 **이 컴퓨터의 IndexedDB**에 저장 (`packstore.js`). 업데이트는 바뀐 파일만. 앱 본체 변경 없음.
- 플레이: 팩이 켜진 작품을 열면 크랙 화면(webview)은 뒤에 그대로 두고 그 위에 팩 화면을 그린다.
  크랙 화면 도우미(`crack-preload.js`)는 호스트가 `crion:config {play:true}`를 보낼 때만 응답을 읽고, 플레이어가 '보내기'를 누를 때 한 번만 보낸다.
  선택지·전투 버튼은 입력창에 글만 채운다. 위쪽 '크랙 화면' 버튼 또는 팩 끄기로 언제든 크랙 화면 그대로.
- 파일 경로는 팩 폴더 기준 상대경로. 그림은 `assets/`, 음악은 `assets/bgm/`. 받은 파일은 blob 주소로 쓴다(index.html CSP에 blob: 허용).
- 시험: `node test/academy.test.js`(응답 해석, 04_확인표 샘플 3턴), `python3 test/ui/run_pack.py`(받기→플레이→연출→모달 스크린샷), `python3 test/ui/run_preload.py`(가짜 크랙 화면 읽기·보내기).

## 팩 둘로 나눔 (엔진 0.7.0~)
- `hirion.summoner-academy` = 전연령 「소환수 아카데미」(그대로 유지).
- `hirion.summoner-academy-adult` = 「소환수 아카데미 · 성인판」(아카데미+ 전용, 별개 팩). manifest에 `"adult": true, "plus": true`.
- `plus: true` 일 때만 켜지는 화면: 과제 카드(📜 과제·의뢰, D-n), 막 표시(1막~6막), 전설 칸 「봉인된 페이지」(3학년 겨울 전). 포획 연출·▶ 행동 줄·알림 줄(🌀🌟🎯💫⬆️)·행동 힌트 한 줄은 글 형식을 읽는 것이라 두 팩 공통.
- 같은 작품 이름이 겹치면 **더 긴 `workName`** 팩이 우선(성인판 작품 이름 = 「소환수 아카데미 성인판」). 성인판 작품은 관리 페이지에 등록하고 19세 표시를 켜야 연결된다.
- 시험: `python3 test/ui/run_pack.py`(전연령) · `PACK=hirion.summoner-academy-adult python3 test/ui/run_pack.py`(성인판).

## 안전지대 팩 · 개발자 전용 공개 (엔진 0.8.0~)
- `hirion.safehouse` = 「아포칼립스 안전지대의 관리자」. `runner: "safehouse"` → `src/renderer/pk-safehouse-run.js`(화면) + `pk-safehouse.js`(응답 해석, 시험 `node test/safehouse.test.js`) + `pk-safehouse.css`(히리온 게임 「프로젝트 A」 디자인 이식, 모든 선택자 `.sh` 아래).
  - 크랙 AI가 그대로 진행. 팩은 상태창(📍…D일차, 🍚…, 🛠️일과, 🚶파견, 🚪대기, 🏢확장)·📦 변동 줄·`이름💬 행동 "대사"`·응답 그림을 읽어 로비·스마트폰·도면·인사 파일·지도·연구소·도감·일지로 그린다. 크랙 출력에 새 표식을 요구하지 않는다.
  - `data.json`: 명부(번호·이름·성별·나이만), 지역(권역·최소 인원·표준 일수·당일치기·지도 좌표), 일과 이름, 배급 방식, 팁. **능력·성격·진실·등급·기본치·교전·전리품은 넣지 않는다**(숨김 값).
  - 시험: `python3 test/ui/run_safehouse.py` → `test/out/sh_*.png`.
- `devOnly: true` (manifest) → `make-registry.js`가 `index.json`의 `packs`가 아니라 **`devPacks`**에 싣는다. 앱은 개발자 로그인 중일 때만 `devPacks`를 합쳐 보여 준다(스토어 카드에 '개발자 전용'). 옛 엔진(0.7.x)은 `packs`만 읽으므로 아예 안 보인다.
  - 공개할 때: manifest의 `devOnly` 줄을 지우고 `version`을 올려 push.
