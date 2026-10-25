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
