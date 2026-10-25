-- CRION 커뮤니티 · 신고함 데이터베이스 (Supabase)
-- 사용법: Supabase 프로젝트 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
-- 여러 번 실행해도 괜찮아요.

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

-- ───────── 신고·건의·공략 제보 ─────────
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  uid uuid not null default auth.uid(),
  kind text not null check (kind in ('bug','idea','tip')),
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
create index if not exists posts_list on public.posts (pinned desc, created_at desc);
create index if not exists comments_post on public.comments (post_id, created_at);
alter table public.posts enable row level security;
alter table public.comments enable row level security;

-- ───────── 도배 막기: 같은 사람이 10분에 5번까지 ─────────
create or replace function public.crion_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.is_admin() then
    if tg_table_name <> 'reports' then new.is_admin := true; end if;
    return new;
  end if;
  execute format('select count(*) from public.%I where uid = $1 and created_at > now() - interval ''10 minutes''', tg_table_name)
    into n using new.uid;
  if n >= 5 then raise exception '잠시 뒤에 다시 보내 주세요 (10분에 5번까지)'; end if;
  if tg_table_name <> 'reports' then new.is_admin := false; end if;
  return new;
end $$;

drop trigger if exists t_throttle_reports on public.reports;
create trigger t_throttle_reports before insert on public.reports for each row execute function public.crion_throttle();
drop trigger if exists t_throttle_posts on public.posts;
create trigger t_throttle_posts before insert on public.posts for each row execute function public.crion_throttle();
drop trigger if exists t_throttle_comments on public.comments;
create trigger t_throttle_comments before insert on public.comments for each row execute function public.crion_throttle();

-- ───────── 권한 ─────────
-- 신고: 보내는 것은 누구나(익명 로그인 포함), 읽기·고치기·지우기는 관리자. 보낸 사람은 자기 것만 읽음(처리 상태·답변 확인용).
drop policy if exists reports_ins on public.reports;
create policy reports_ins on public.reports for insert to authenticated
  with check (uid = auth.uid() and status = 'new' and reply is null);
drop policy if exists reports_sel on public.reports;
create policy reports_sel on public.reports for select to authenticated using (uid = auth.uid() or public.is_admin());
drop policy if exists reports_upd on public.reports;
create policy reports_upd on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists reports_del on public.reports;
create policy reports_del on public.reports for delete to authenticated using (public.is_admin());

-- 게시글·댓글: 누구나 읽기(숨김 제외), 쓰기는 로그인한 사람(익명 포함), 고치기는 관리자, 지우기는 본인 또는 관리자
drop policy if exists posts_sel on public.posts;
create policy posts_sel on public.posts for select to anon, authenticated using (hidden = false or public.is_admin());
drop policy if exists posts_ins on public.posts;
create policy posts_ins on public.posts for insert to authenticated
  with check (uid = auth.uid() and pinned = false and hidden = false);
drop policy if exists posts_upd on public.posts;
create policy posts_upd on public.posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists posts_del on public.posts;
create policy posts_del on public.posts for delete to authenticated using (uid = auth.uid() or public.is_admin());

drop policy if exists comments_sel on public.comments;
create policy comments_sel on public.comments for select to anon, authenticated using (hidden = false or public.is_admin());
drop policy if exists comments_ins on public.comments;
create policy comments_ins on public.comments for insert to authenticated
  with check (uid = auth.uid() and hidden = false);
drop policy if exists comments_upd on public.comments;
create policy comments_upd on public.comments for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists comments_del on public.comments;
create policy comments_del on public.comments for delete to authenticated using (uid = auth.uid() or public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.posts, public.comments to anon;
grant select, insert, update, delete on public.reports, public.posts, public.comments to authenticated;
grant select on public.admins to authenticated;
