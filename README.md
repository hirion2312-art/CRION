# CRION — 히리온 작품 전용 크랙 클라이언트 (v0.2)

팔로워가 히리온 작품을 더 쉽고 빠르게 열고, 작품 전용 팩(음악·상태창 대시보드·장면 연출)을 한 번에 설치해 플레이하는 PC 앱입니다. Windows와 macOS를 함께 지원합니다.

## 지금 되는 것

- 첫 실행 → 크랙 로그인(앱 안 크랙 공식 화면, 로그인 상태 유지)
- 홈: 히리온 작품 목록, 새 팩 알림
- 작품 입장 시 전용 팩 설치 권유 → 원클릭 설치 → 지금 대화에 바로 적용
- 「아포칼립스 안전지대의 관리자」 팩
  - 응답 속 상태창을 읽어 오른쪽 **빌라 대시보드**로 표시 (식량·의료품·자재·방어력, 사기, 주민, 일과 등)
  - 이전 상태창과 비교한 **변화량** 표시 (예: 식량 −4, 방어력 +7)
  - **다음 큰 밤 카운트다운**(노말 10일·하드 5일 주기, 설정에서 선택)과 큰 밤 **경보 띠**
  - 시간대·큰 밤에 따라 **BGM 자동 전환**(2초 크로스페이드)
  - 채팅 속 상태창은 접고 "상태창 → CRION 대시보드" 칩으로 바꿈 (칩을 누르면 다시 펼쳐짐)
- 팩 켜기/끄기, 연출 강도, 음량, 난이도, 작품 주소 저장, 팩 삭제
- 팩 목록 주소(깃허브 페이지)를 넣으면 거기서 새 팩·업데이트를 받아 설치

> **v0.2 변경**: 게임 화면(소환수 아카데미) 추가, 자동 업데이트 체계 추가. 자세한 건 `docs/업데이트_가이드.md`.
> Electron 설치가 안 될 때(특히 맥): `npm install` 후 `npm run setup`.

## 1. 내 PC에서 바로 실행해 보기

1. [Node.js](https://nodejs.org) LTS 버전을 설치합니다.
2. 이 폴더에서 터미널(Windows는 PowerShell)을 열고:
   ```
   npm install
   npm start
   ```
3. 앱이 뜨면 「크랙 계정으로 계속하기」로 로그인 → 홈에서 작품 선택.

## 2. 설치 파일(.exe / .dmg) 만들기 — GitHub Actions

PC에 개발 도구가 없어도 깃허브가 대신 만들어 줍니다.

1. 깃허브에 새 저장소(비공개 가능)를 만들고 이 폴더 전체를 올립니다.
2. 저장소의 **Actions** 탭 → 「CRION 빌드」 → **Run workflow**.
3. 10분쯤 뒤 실행 기록 맨 아래 **Artifacts**에서 받습니다.
   - `CRION-Windows`: `CRION-Setup-0.1.0.exe`(설치용), `.zip`(설치 없이 실행)
   - `CRION-macOS`: Apple 실리콘용 `arm64.dmg`, 인텔용 `x64.dmg`
4. 팔로워에게 배포하려면 태그를 붙여 올리면(`v0.1.0`처럼) **Releases**에 자동으로 올라갑니다.

### 처음 실행할 때 경고가 뜨는 이유

코드 서명 인증서가 없어서 운영체제가 "알 수 없는 앱"으로 경고합니다.
- **Windows**: "Windows의 PC 보호" 창 → `추가 정보` → `실행`
- **macOS**: 앱을 오른쪽 클릭 → `열기` → `열기` (한 번만 하면 됨)

정식 배포 때 경고를 없애려면 Windows 코드 서명 인증서, Apple 개발자 계정(연 $99) 공증이 필요합니다.

## 3. 작품 주소 연결

`config/works.json`의 `url`이 비어 있으면 「플레이」가 크랙 첫 화면을 엽니다. 앱 안에서 해당 작품 채팅 화면까지 들어가면 상단에 **「지금 페이지를 작품 주소로 저장」** 버튼이 뜹니다. 누르면 다음부터 바로 열립니다. 배포판에 넣으려면 `config/works.json`의 `url`에 작품 주소를 직접 적어 두세요.

## 4. BGM을 Suno 곡으로 바꾸기

`packs/hirion.safehouse/bgm/` 안의 파일은 **임시 효과음(단순 화음)**입니다. 같은 이름으로 덮어쓰면 됩니다.

| 파일 | 장면 |
| --- | --- |
| morning.ogg | 아침 |
| day.ogg | 낮 |
| evening.ogg | 저녁 (식당) |
| night.ogg | 평범한 밤 |
| tense.ogg | 큰 밤 당일 낮까지 (긴장) |
| bignight.ogg | 큰 밤 |
| relief.ogg | 큰 밤을 넘긴 아침 (안도) |

mp3를 쓰려면 `manifest.json`의 `scenes` 안 `bgm` 값을 `bgm/morning.mp3`처럼 바꿉니다. 곡 이름은 같은 곳의 `title`을 고치면 됩니다.

## 5. 새 작품 팩 만들기

팩 하나 = `packs/<팩id>/` 폴더 하나. 코드 없이 `manifest.json`만으로 만듭니다.

- `status.detect`: 상태창이라고 판단할 글자 패턴(정규식)
- `status.fields`: 읽을 칸 목록 — `label`, `pattern`(숫자를 괄호로 잡기), `type`(number·ratio·text), `group`(tile=큰 숫자 칸, gauge=막대, row=목록, mini=작은 글자)
- `status.dayPattern`, `phasePattern`, `locPattern`: 날짜·시간대·장소
- `cycle`: 주기 이벤트(큰 밤 같은 것). 없으면 지우면 됨
- `sceneRules`: 위에서부터 처음 맞는 규칙의 장면을 고름 (`phase`, `cycleDay`, `prevScene`, `keywords`)
- `scenes`: 장면별 색·곡·경보 문구

그리고 `config/works.json`의 해당 작품 `pack`에 팩 id를 적습니다. 상태창 형식이 바뀌면 `test/parser.test.js`처럼 예시를 넣고 `npm test`로 확인하세요.

## 6. 팔로워 앱에 새 팩·업데이트 보내기 (선택)

```
node scripts/make-registry.js https://<깃허브아이디>.github.io/<저장소이름>/
```
생긴 `registry/` 폴더를 깃허브 페이지 저장소에 올리고, 앱 설정의 **팩 목록 주소**에 `https://.../index.json`을 넣습니다. 배포판에 기본값으로 넣으려면 `src/main.js`의 `DEFAULT_SETTINGS.registryUrl`에 적어 두세요.

## 알아 둘 점

- **크랙 화면 구조에 기대지 않습니다.** 상태창은 글자 패턴으로 찾기 때문에 크랙이 화면 디자인을 바꿔도 대부분 그대로 동작합니다. 본문과 상태창이 한 덩어리로 붙어 있으면 숨기지 않고 읽기만 합니다.
- 앱은 크랙 화면을 **보여 주는 방식만** 바꿉니다. 자동 입력·매크로·서버 요청 조작은 하지 않습니다. 그래도 배포 전에 크랙 이용약관을 확인하고, 가능하면 운영진에게 미리 알리는 것을 권합니다.
- 구글 로그인은 앱 안 브라우저를 막는 경우가 있습니다. 막히면 다른 로그인 방법을 쓰거나 알려 주세요.
- 로그인 정보는 크랙이 평소처럼 쿠키로 보관하며, CRION은 비밀번호를 받거나 저장하지 않습니다.

## 폴더 구조

```
src/main.js             앱 창, 크랙 웹뷰 보안, 팩 설치, 설정 저장
src/preload-crack.js    크랙 페이지 안: 상태창 찾기·숨기기·전달
src/preload-host.js     앱 화면에 필요한 기능만 연결
src/renderer/           앱 화면 (app.js, parser.js, audio.js, app.css)
packs/hirion.safehouse/ 안전지대 팩 (manifest.json, bgm/)
config/works.json       홈에 보이는 작품 목록
scripts/make-registry.js 팩 목록(깃허브 페이지용) 만들기
test/                   파서 점검(npm test), 화면 점검용 하네스
.github/workflows/      Windows·macOS 설치 파일 자동 빌드
```
