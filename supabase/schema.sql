-- CRION 서버 설계도 (Supabase) — v2: 계정 · 기록 동기화 · 커뮤니티 · 신고함
-- 사용법: Supabase 프로젝트 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 괜찮아요 (이미 있는 표·글은 그대로 두고 빠진 것만 만들어요).
-- 순서: 관리자 계정(이메일)을 먼저 만들고 이 파일을 실행하면, 그 계정이 자동으로 관리자가 돼요.

-- ───────── 관리자 ─────────
create table if not exists public.admins (
  uid uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where uid = auth.uid())
$$;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (uid = auth.uid());

-- 처음 실행할 때: 관리자가 아무도 없으면, 이메일로 만든 첫 계정을 관리자로 지정
insert into public.admins (uid)
select id from auth.users
where coalesce(is_anonymous, false) = false and email is not null
  and not exists (select 1 from public.admins)
order by created_at
limit 1
on conflict do nothing;

-- ───────── CRION 계정 (닉네임) ─────────
-- 익명(가입 없이)으로는 신고·건의만. 게시판 글·댓글·좋아요·기록 동기화는 CRION 계정(이메일)으로.
create table if not exists public.profiles (
  uid uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nick text not null check (char_length(nick) between 2 and 16 and nick !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  banned boolean not null default false
);
create unique index if not exists profiles_nick on public.profiles (lower(nick));
alter table public.profiles enable row level security;

create or replace function public.is_anon_user() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;
-- 글을 쓸 수 있는 회원: 이메일 계정 + 닉네임 있음 + 글쓰기 막힘 아님
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not public.is_anon_user()
     and exists (select 1 from public.profiles where uid = auth.uid() and banned = false)
$$;
-- 동기화만 쓰는 계정 확인 (닉네임 없어도 됨)
create or replace function public.is_account() returns boolean
language sql stable as $$
  select auth.uid() is not null and not public.is_anon_user()
$$;

-- 닉네임을 바꿀 때 막힘(banned)은 본인이 못 고친다
create or replace function public.crion_profile_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then new.banned := false; new.uid := auth.uid();
    else new.banned := old.banned; new.uid := old.uid; new.created_at := old.created_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_profile_guard on public.profiles;
create trigger t_profile_guard before insert or update on public.profiles for each row execute function public.crion_profile_guard();

drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select to anon, authenticated using (true);
drop policy if exists profiles_ins on public.profiles;
create policy profiles_ins on public.profiles for insert to authenticated with check (uid = auth.uid() and public.is_account());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update to authenticated
  using (uid = auth.uid() or public.is_admin()) with check (uid = auth.uid() or public.is_admin());

-- 계정 지우기 (본인만). 동기화 기록·닉네임도 함께 지워지고, 쓴 글은 '탈퇴한 사용자'로 남는다
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null or public.is_anon_user() then raise exception '로그인이 필요해요'; end if;
  perform set_config('crion.sys', '1', true);   -- 글 가드를 이 안에서만 통과
  update public.posts set nick = '탈퇴한 사용자' where uid = auth.uid();
  update public.comments set nick = '탈퇴한 사용자' where uid = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- ───────── 플레이 기록 동기화 (컴퓨터·폰 어디서 켜도 같은 기록) ─────────
create table if not exists public.sync_items (
  uid uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  val jsonb,
  deleted boolean not null default false,
  device text check (char_length(device) <= 60),
  updated_at timestamptz not null default now(),
  primary key (uid, key),
  constraint sync_val_size check (val is null or octet_length(val::text) <= 300000)
);
create index if not exists sync_items_cursor on public.sync_items (uid, updated_at);
alter table public.sync_items enable row level security;

-- 시각은 서버가 찍는다 (기기 시계가 틀려도 순서가 맞게), 한 사람 최대 3000칸
create or replace function public.crion_sync_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  new.updated_at := clock_timestamp();
  new.uid := auth.uid();
  if tg_op = 'INSERT' then
    select count(*) into n from public.sync_items where uid = new.uid;
    if n >= 3000 then raise exception '기록이 너무 많아요 (3000칸)'; end if;
  end if;
  return new;
end $$;
drop trigger if exists t_sync_stamp on public.sync_items;
create trigger t_sync_stamp before insert or update on public.sync_items for each row execute function public.crion_sync_stamp();

drop policy if exists sync_sel on public.sync_items;
create policy sync_sel on public.sync_items for select to authenticated using (uid = auth.uid() and public.is_account());
drop policy if exists sync_ins on public.sync_items;
create policy sync_ins on public.sync_items for insert to authenticated with check (uid = auth.uid() and public.is_account());
drop policy if exists sync_upd on public.sync_items;
create policy sync_upd on public.sync_items for update to authenticated using (uid = auth.uid() and public.is_account()) with check (uid = auth.uid());
drop policy if exists sync_del on public.sync_items;
create policy sync_del on public.sync_items for delete to authenticated using (uid = auth.uid());

-- ───────── 신고·건의·공략 제보 (+ 게시글 신고) ─────────
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  uid uuid not null default auth.uid(),
  kind text not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 4000),
  steps text check (char_length(steps) <= 1500),
  work text check (char_length(work) <= 200),
  nick text check (char_length(nick) <= 30),
  app text check (char_length(app) <= 200),
  diag text check (char_length(diag) <= 12000),
  status text not null default 'new' check (status in ('new','doing','done','hold')),
  reply text check (char_length(reply) <= 1000),
  updated_at timestamptz
);
alter table public.reports add column if not exists target text check (char_length(target) <= 60);
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('bug','idea','tip','flag'));
alter table public.reports enable row level security;

-- ───────── 게시판 ─────────
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  uid uuid not null default auth.uid(),
  board text not null default 'free' check (board in ('free','tip','question')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 3000),
  nick text not null check (char_length(nick) between 1 and 20),
  work text check (char_length(work) <= 100),
  is_admin boolean not null default false,
  pinned boolean not null default false,
  hidden boolean not null default false
);
alter table public.posts add column if not exists edited_at timestamptz;
alter table public.posts add column if not exists like_count int not null default 0;
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  uid uuid not null default auth.uid(),
  body text not null check (char_length(body) between 1 and 800),
  nick text not null check (char_length(nick) between 1 and 20),
  is_admin boolean not null default false,
  hidden boolean not null default false
);
create table if not exists public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  uid uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, uid)
);
create index if not exists posts_list on public.posts (pinned desc, created_at desc);
create index if not exists posts_uid on public.posts (uid, created_at desc);
create index if not exists comments_post on public.comments (post_id, created_at);
create index if not exists likes_uid on public.post_likes (uid);
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;

-- ───────── 도배 막기(10분에 5번) · 닉네임은 계정 닉네임으로 · 관리자 표시 ─────────
create or replace function public.crion_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; pn text;
begin
  if public.is_admin() then
    if tg_table_name <> 'reports' then
      new.is_admin := true;
      select nick into pn from public.profiles where uid = auth.uid();
      new.nick := coalesce(pn, nullif(new.nick, ''), '히리온');
    end if;
    return new;
  end if;
  execute format('select count(*) from public.%I where uid = $1 and created_at > now() - interval ''10 minutes''', tg_table_name)
    into n using new.uid;
  if n >= 5 then raise exception '잠시 뒤에 다시 보내 주세요 (10분에 5번까지)'; end if;
  if tg_table_name <> 'reports' then
    new.is_admin := false;
    select nick into pn from public.profiles where uid = new.uid;
    if pn is not null then new.nick := pn; end if;
  end if;
  return new;
end $$;

drop trigger if exists t_throttle_reports on public.reports;
create trigger t_throttle_reports before insert on public.reports for each row execute function public.crion_throttle();
drop trigger if exists t_throttle_posts on public.posts;
create trigger t_throttle_posts before insert on public.posts for each row execute function public.crion_throttle();
drop trigger if exists t_throttle_comments on public.comments;
create trigger t_throttle_comments before insert on public.comments for each row execute function public.crion_throttle();

-- 글 고치기: 본인은 제목·내용·게시판·작품만 (고정·숨김·좋아요 수는 못 건드림). 함수는 아래 좋아요 부분에 있음

-- 좋아요 수는 서버가 센다
create or replace function public.crion_like_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.posts set like_count = like_count + 1 where id = new.post_id;
  else update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id; end if;
  return null;
end $$;
-- like_count 갱신은 위 가드를 거치지 않게 (트리거 안의 update 는 관리자 권한이 아니므로 가드가 값을 되돌림 → 깊이로 구분)
create or replace function public.crion_post_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or pg_trigger_depth() > 1 or current_setting('crion.sys', true) = '1' then return new; end if;
  new.uid := old.uid; new.created_at := old.created_at; new.nick := old.nick; new.is_admin := old.is_admin;
  new.pinned := old.pinned; new.hidden := old.hidden; new.like_count := old.like_count;
  new.edited_at := now();
  return new;
end $$;
drop trigger if exists t_post_guard on public.posts;
create trigger t_post_guard before update on public.posts for each row execute function public.crion_post_guard();
drop trigger if exists t_like_count on public.post_likes;
create trigger t_like_count after insert or delete on public.post_likes for each row execute function public.crion_like_count();

-- ───────── 권한 ─────────
-- 신고: 보내는 것은 누구나(익명 포함), 읽기·고치기·지우기는 관리자. 보낸 사람은 자기 것만 읽음(처리 상태·답변 확인용).
drop policy if exists reports_ins on public.reports;
create policy reports_ins on public.reports for insert to authenticated
  with check (uid = auth.uid() and status = 'new' and reply is null);
drop policy if exists reports_sel on public.reports;
create policy reports_sel on public.reports for select to authenticated using (uid = auth.uid() or public.is_admin());
drop policy if exists reports_upd on public.reports;
create policy reports_upd on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists reports_del on public.reports;
create policy reports_del on public.reports for delete to authenticated using (public.is_admin());

-- 게시글·댓글: 누구나 읽기(숨김 제외), 쓰기는 CRION 계정(닉네임 있음), 고치기는 본인(내용만)·관리자, 지우기는 본인·관리자
drop policy if exists posts_sel on public.posts;
create policy posts_sel on public.posts for select to anon, authenticated using (hidden = false or public.is_admin() or uid = auth.uid());
drop policy if exists posts_ins on public.posts;
create policy posts_ins on public.posts for insert to authenticated
  with check (uid = auth.uid() and pinned = false and hidden = false and (public.is_member() or public.is_admin()));
drop policy if exists posts_upd on public.posts;
create policy posts_upd on public.posts for update to authenticated
  using ((uid = auth.uid() and public.is_member()) or public.is_admin()) with check (uid = auth.uid() or public.is_admin());
drop policy if exists posts_del on public.posts;
create policy posts_del on public.posts for delete to authenticated using (uid = auth.uid() or public.is_admin());

drop policy if exists comments_sel on public.comments;
create policy comments_sel on public.comments for select to anon, authenticated using (hidden = false or public.is_admin() or uid = auth.uid());
drop policy if exists comments_ins on public.comments;
create policy comments_ins on public.comments for insert to authenticated
  with check (uid = auth.uid() and hidden = false and (public.is_member() or public.is_admin()));
drop policy if exists comments_upd on public.comments;
create policy comments_upd on public.comments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists comments_del on public.comments;
create policy comments_del on public.comments for delete to authenticated using (uid = auth.uid() or public.is_admin());

drop policy if exists likes_sel on public.post_likes;
create policy likes_sel on public.post_likes for select to authenticated using (uid = auth.uid());
drop policy if exists likes_ins on public.post_likes;
create policy likes_ins on public.post_likes for insert to authenticated with check (uid = auth.uid() and (public.is_member() or public.is_admin()));
drop policy if exists likes_del on public.post_likes;
create policy likes_del on public.post_likes for delete to authenticated using (uid = auth.uid());

-- 관리 페이지가 "설계도가 최신인지" 확인하는 표시
create or replace function public.crion_schema_version() returns int language sql immutable as $$ select 2 $$;

grant usage on schema public to anon, authenticated;
grant select on public.posts, public.comments, public.profiles to anon;
grant select, insert, update, delete on public.reports, public.posts, public.comments, public.profiles, public.sync_items, public.post_likes to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.crion_schema_version() to anon, authenticated;
