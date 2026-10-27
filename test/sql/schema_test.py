# 서버 설계도(supabase/schema.sql) 권한 시험 — 로컬 Postgres + Supabase 흉내(supabase_stub.sql)
#   python3 test/sql/schema_test.py   (PGHOST·PGPORT 로 접속, 기본: /home/pgt/sock:5544, 사용자 postgres)
#   매번 crion_test DB 를 새로 만든다. 실제 Supabase 와 같은 규칙(RLS·트리거)을 역할을 바꿔 가며 확인.
import json, os, subprocess, sys, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HOST = os.environ.get('PGHOST', '/home/pgt/sock')
PORT = os.environ.get('PGPORT', '5544')
DB = 'crion_test'
fails = []


def psql(sql, db=DB, ok=True):
    r = subprocess.run(['psql', '-h', HOST, '-p', PORT, '-U', 'postgres', '-d', db, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                       capture_output=True, text=True)
    if ok and r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r


def run_file(path):
    r = subprocess.run(['psql', '-h', HOST, '-p', PORT, '-U', 'postgres', '-d', DB, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip())


def as_user(uid, sql, anon=False, role='authenticated'):
    """uid 로 로그인한 요청 1개 (트랜잭션). (성공여부, 출력 또는 오류)"""
    claims = json.dumps({'sub': uid, 'is_anonymous': anon, 'role': role}) if uid else '{}'
    full = f"begin; set local role {role}; select set_config('request.jwt.claims', '{claims}', true) \\g /dev/null\n{sql};\ncommit;"
    r = subprocess.run(['psql', '-h', HOST, '-p', PORT, '-U', 'postgres', '-d', DB, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
                       input=full, capture_output=True, text=True)
    return r.returncode == 0, (r.stdout.strip() if r.returncode == 0 else r.stderr.strip())


def check(name, cond, info=''):
    print(('  ✔ ' if cond else '  ✘ ') + name + ('' if cond else f'  ← {info}'))
    if not cond:
        fails.append(name)


def one(sql):
    return psql(sql).stdout.strip()


def main():
    psql(f'drop database if exists {DB}', db='postgres')
    psql(f'create database {DB}', db='postgres')
    run_file(os.path.join(ROOT, 'test/sql/supabase_stub.sql'))
    ADM, A, B, C = (str(uuid.uuid4()) for _ in range(4))
    psql(f"insert into auth.users (id, email, created_at) values ('{ADM}', 'hirion@example.com', now() - interval '1 hour')")
    psql(f"insert into auth.users (id, is_anonymous, created_at) values ('{C}', true, now() - interval '2 hour')")   # 익명은 관리자가 되면 안 됨
    run_file(os.path.join(ROOT, 'supabase/schema.sql'))
    run_file(os.path.join(ROOT, 'supabase/schema.sql'))   # 두 번 실행해도 됨
    psql(f"insert into auth.users (id, email) values ('{A}', 'a@example.com'), ('{B}', 'b@example.com')")
    run_file(os.path.join(ROOT, 'supabase/schema.sql'))   # 회원이 생긴 뒤 다시 실행해도 관리자는 그대로
    check('관리자 자동 지정 = 이메일로 만든 첫 계정 하나', one('select string_agg(uid::text, \',\') from public.admins') == ADM)
    check('설계도 버전 2', as_user(None, 'select public.crion_schema_version()', role='anon')[1] == '2')

    # 익명
    ok, _ = as_user(C, "insert into public.reports (kind, title, body) values ('bug', '안 돼요', '내용')", anon=True)
    check('익명: 신고 보내기 됨', ok)
    ok, err = as_user(C, "insert into public.posts (title, body, nick) values ('제목', '내용', '익명')", anon=True)
    check('익명: 게시글은 못 씀', not ok, err)
    ok, err = as_user(C, "insert into public.sync_items (key, val) values ('crion.w.x', '{}')", anon=True)
    check('익명: 기록 동기화 못 함', not ok, err)
    ok, err = as_user(C, "insert into public.profiles (nick) values ('익명닉')", anon=True)
    check('익명: 닉네임 못 만듦', not ok, err)

    # 회원 A·B
    ok, err = as_user(A, "insert into public.posts (title, body, nick) values ('제목', '내용', '아무개')")
    check('닉네임 없는 계정은 글 못 씀', not ok, err)
    ok, err = as_user(A, "insert into public.profiles (nick, banned) values ('Alice', true)")
    check('닉네임 만들기', ok, err)
    check('스스로 banned 못 켬', one(f"select banned from public.profiles where uid = '{A}'") == 'f')
    ok, err = as_user(B, "insert into public.profiles (nick) values ('alice')")
    check('닉네임 중복(대소문자 무시) 막힘', not ok, err)
    ok, err = as_user(B, "insert into public.profiles (uid, nick) values ('%s', 'Bobby')" % A)
    check('남의 uid 로 닉네임 못 만듦', not ok or one(f"select count(*) from public.profiles where nick = 'Bobby' and uid = '{A}'") == '0', err)
    as_user(B, "delete from public.profiles where nick = 'Bobby'")
    psql("delete from public.profiles where nick = 'Bobby'")
    ok, err = as_user(B, "insert into public.profiles (nick) values ('Bob')")
    check('B 닉네임', ok, err)

    ok, out = as_user(A, "insert into public.posts (title, body, nick, is_admin, pinned) values ('첫 글', '안녕', '사칭', true, false) returning id, nick, is_admin")
    pid, pnick, padm = (out.split('|') + ['', '', ''])[:3] if ok else ('', '', '')
    check('글쓰기 · 닉네임은 계정 닉네임으로 · 관리자 표시 사칭 불가', ok and pnick == 'Alice' and padm == 'f', out)
    ok, err = as_user(A, f"insert into public.posts (title, body, nick, pinned) values ('고정', '시도', 'x', true)")
    check('스스로 고정 글 못 씀', not ok, err)
    ok, out = as_user(A, f"update public.posts set title = '고친 제목', pinned = true, like_count = 99 where id = {pid} returning title, pinned, like_count, edited_at is not null")
    check('본인 글 고치기: 제목만 바뀌고 고정·좋아요 수는 그대로', ok and out == '고친 제목|f|0|t', out)
    ok, out = as_user(B, f"update public.posts set title = '남의 글' where id = {pid} returning id")
    check('남의 글은 못 고침', ok and out == '', out)
    ok, out = as_user(B, f"insert into public.comments (post_id, body, nick) values ({pid}, '댓글', '사칭') returning nick")
    check('댓글 · 닉네임 고정', ok and out == 'Bob', out)

    ok, err = as_user(B, f"insert into public.post_likes (post_id) values ({pid})")
    check('좋아요', ok, err)
    check('좋아요 수 서버가 셈 = 1', one(f'select like_count from public.posts where id = {pid}') == '1')
    ok, err = as_user(B, f"insert into public.post_likes (post_id) values ({pid})")
    check('같은 글 두 번 좋아요 안 됨', not ok, err)
    ok, err = as_user(B, f"delete from public.post_likes where post_id = {pid}")
    check('좋아요 취소 → 0', ok and one(f'select like_count from public.posts where id = {pid}') == '0', err)
    ok, err = as_user(C, f"insert into public.post_likes (post_id) values ({pid})", anon=True)
    check('익명은 좋아요 못 함', not ok, err)

    ok, err = as_user(B, f"insert into public.reports (kind, title, body, target) values ('flag', '광고 글', '신고합니다', 'post:{pid}')")
    check('글 신고(flag) 보내기', ok, err)
    ok, out = as_user(A, "select count(*) from public.reports")
    check('남의 신고는 못 읽음', ok and out == '0', out)

    # 관리자
    ok, out = as_user(ADM, f"update public.posts set hidden = true where id = {pid} returning hidden")
    check('관리자: 숨기기', ok and out == 't', out)
    ok, out = as_user(B, f"select count(*) from public.posts where id = {pid}")
    check('숨긴 글은 남에게 안 보임', ok and out == '0', out)
    ok, out = as_user(A, f"select count(*) from public.posts where id = {pid}")
    check('숨긴 글도 쓴 사람에겐 보임', ok and out == '1', out)
    ok, out = as_user(None, f"select count(*) from public.posts", role='anon')
    check('로그인 안 해도 글 목록 읽기(숨김 제외)', ok and out == '0', out)
    ok, out = as_user(ADM, "insert into public.posts (title, body, nick) values ('공지', '내용', '') returning nick, is_admin")
    check('관리자 글: 이름 히리온 · 관리자 표시', ok and out == '히리온|t', out)
    ok, out = as_user(ADM, "select count(*) from public.reports")
    check('관리자: 신고 전부 읽음', ok and out == '2', out)

    # 기록 동기화
    ok, out = as_user(A, "insert into public.sync_items (key, val, device) values ('crion.w.abc', '{\"turns\":3}', 'pc') on conflict (uid, key) do update set val = excluded.val returning updated_at")
    t1 = out
    ok2, out2 = as_user(A, "insert into public.sync_items (key, val, device) values ('crion.w.abc', '{\"turns\":5}', 'phone') on conflict (uid, key) do update set val = excluded.val, device = excluded.device returning updated_at, val->>'turns'")
    check('동기화: 올리기·덮어쓰기(서버 시각)', ok and ok2 and out2.split('|')[1] == '5' and out2.split('|')[0] > t1, out + ' / ' + out2)
    ok, out = as_user(B, "select count(*) from public.sync_items")
    check('동기화: 남의 기록은 안 보임', ok and out == '0', out)
    ok, out = as_user(B, f"insert into public.sync_items (uid, key, val) values ('{A}', 'crion.w.hack', '{{}}') returning uid")
    check('동기화: 남의 칸에 못 씀 (uid 는 서버가 본인으로)', (not ok) or out == B, out)
    big = 'x' * 310000
    ok, err = as_user(A, f"insert into public.sync_items (key, val) values ('crion.big', to_jsonb('{big}'::text))")
    check('동기화: 너무 큰 값(300KB 초과) 막힘', not ok, err[:80])

    # 도배
    errs = [as_user(B, f"insert into public.posts (title, body, nick) values ('글{i}', '내용', 'x')")[0] for i in range(6)]
    check('도배 막기: 10분에 5개까지', errs == [True] * 5 + [False], str(errs))

    # 글쓰기 막기
    ok, err = as_user(ADM, f"update public.profiles set banned = true where uid = '{A}'")
    ok2, err2 = as_user(A, "insert into public.posts (title, body, nick) values ('막힌 뒤', '내용', 'x')")
    check('관리자가 글쓰기 막으면 못 씀', ok and not ok2, err2)
    ok, out = as_user(A, f"update public.profiles set banned = false, nick = 'Alice2' where uid = '{A}' returning banned, nick")
    check('막힌 사람이 스스로 풀 수 없음 (닉네임은 바뀜)', ok and out == 't|Alice2', out)

    # 계정 지우기
    ok, err = as_user(B, "select public.delete_my_account()")
    check('계정 지우기', ok, err)
    check('지운 계정: 로그인 정보·동기화·닉네임 사라짐, 글은 탈퇴한 사용자로', one(f"select count(*) from auth.users where id = '{B}'") == '0'
          and one(f"select count(*) from public.profiles where uid = '{B}'") == '0'
          and one(f"select distinct nick from public.posts where uid = '{B}'") == '탈퇴한 사용자')

    print(f'\n서버 설계도 시험 {"실패 " + str(len(fails)) + "개" if fails else "전부 통과"}')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
