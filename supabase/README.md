# CRION 서버(Supabase) 준비 — 히리온용 순서

신고함과 게시판은 무료 Supabase 서버에 저장돼요. 한 번만 하면 돼요.

1. https://supabase.com 에서 **Start your project** → GitHub 계정으로 가입.
2. **New project** → 이름 `crion`, 비밀번호 아무거나(메모해 두기), Region은 **Northeast Asia (Seoul)** → Create.
3. 왼쪽 **Authentication → Sign In / Providers**(또는 Settings) 에서 **Allow anonymous sign-ins** 를 **켜기** (팔로워가 가입 없이 글을 쓰게 하는 설정).
4. 왼쪽 **Authentication → Users → Add user → Create new user** 로 **관리자용 이메일·비밀번호** 계정을 만들기 (Auto Confirm User 체크).
5. 왼쪽 **SQL Editor → New query** 에 `supabase/schema.sql` 전체를 붙여넣고 **Run**.
6. 같은 SQL Editor에서 아래를 실행해 방금 만든 계정을 관리자로 지정 (이메일을 본인 것으로):
   ```sql
   insert into public.admins (uid) select id from auth.users where email = '관리자이메일@example.com';
   ```
7. 왼쪽 **Project Settings → API** 에서 두 가지를 Claude에게 알려 주세요 (둘 다 공개돼도 안전한 값이에요):
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public** 키 (`eyJ...` 로 시작)
   ※ **service_role** 키는 절대 알려 주면 안 돼요.

앱은 관리자 계정의 이메일·비밀번호로 앱 안 **신고함**에 로그인해서 신고·건의·게시판을 관리해요.
