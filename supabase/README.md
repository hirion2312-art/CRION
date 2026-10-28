# CRION 서버 만들기 (Supabase, 무료, 10분)

서버는 Supabase가 대신 돌려요. 히리온 컴퓨터를 켜 둘 필요 없어요.
열리는 것: **CRION 계정**(아이디+비밀번호, 중복 확인 · 관리자만 이메일) · **컴퓨터·폰 기록 자동 동기화** · **게시판**(좋아요·고치기·신고) · **관리자 신고함**·글쓰기 막기.

가장 쉬운 길: **관리 페이지(site/admin.html) → "서버 연결" 카드**에 아래 순서와 버튼이 다 있어요. 마지막 "연결 점검"이 빠진 것을 알려 줘요.

1. https://supabase.com/dashboard/new (GitHub로 가입) → 이름 `crion`, Region **Northeast Asia (Seoul)**, DB 비밀번호 아무거나(메모) → Create
2. **Authentication → Sign In / Providers**: *Allow anonymous sign-ins* 켜기, *Email* 안의 *Confirm email* 끄기 → Save
3. **Authentication → URL Configuration**: Site URL·Redirect URLs 에 `https://hirion2312-art.github.io/CRION/reset.html`
4. **Authentication → Users → Add user → Create new user**: 히리온 관리자 이메일·비밀번호, *Auto Confirm User* 체크
5. **SQL Editor → New query** 에 `schema.sql` 전체를 붙여넣고 **Run** (4번 계정이 자동으로 관리자). 설계도가 바뀌면 다시 Run 만 하면 됨(여러 번 해도 안전)
6. **Project Settings → API Keys** 의 *Publishable key*(또는 Legacy *anon public*) + **Project URL** → 관리 페이지 칸에 붙여 넣기 → **연결 점검 → 저장하고 배포**

⚠️ *secret / service_role* 키는 어디에도 넣지 않아요 (관리 페이지가 막아요). Publishable/anon 키는 공개돼도 괜찮게 설계도(RLS)가 지켜요.

## 규칙 요약 (schema.sql)
- 익명(가입 없음): 신고 보내기만. 글·댓글·좋아요·동기화는 계정 + 닉네임
- 닉네임은 계정에 하나(2~16자, 중복 불가). 글에 적히는 이름은 서버가 계정 닉네임으로 고정
- 도배 막기 10분 5개, 관리자는 숨기기·고정·글쓰기 막기, 막힌 사람은 스스로 못 풂
- 동기화: 계정별 칸(키) 하나 = 한 줄, 300KB·3000칸 상한, 본인만 읽고 씀
- 계정 지우기: 로그인 정보·기록·닉네임 삭제, 쓴 글은 "탈퇴한 사용자"
- 시험: `python3 test/sql/schema_test.py` (로컬 Postgres + `test/sql/supabase_stub.sql`)

## 설계도 업데이트
설계도(schema.sql)가 바뀌면 관리 페이지 → 서버 연결 → **설계도 복사** → SQL Editor 에 붙여넣고 **Run** 한 번. 기존 글·계정은 그대로예요. 지금 버전: v4 (사용 통계 추가 — 개발자 모드 「사용자 통계」)
