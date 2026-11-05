-- =====================================================================
-- CONCORD – Supabase schema, security (RLS), triggers and seed data
-- Run ONCE in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Safe to re-run: tables use IF NOT EXISTS, policies are rebuilt each run.
-- =====================================================================

-- ---------- 1. SETTINGS (editable in the app: Settings → App settings) ----------
create table if not exists app_settings (
  key text primary key,
  value text not null,
  label text,
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value, label) values
  ('timezone', 'Asia/Manila', 'Timezone (IANA name)'),
  ('auto_d_date_days', '7', 'Auto D-date: days after creation when none is set'),
  ('unresolved_review_days', '7', 'Unresolved: days of analysis before second review'),
  ('gather_prompt_days_before', '2', 'Gathering prompt: days before the D-date'),
  ('impl_check_days_after', '7', 'Implementation check: days after Agreed/Approved'),
  ('tpl_gather', E'Good day [Staff Name],\n\nJust checking in on [Topic], specifically: [Checklist Item].\nAre we on track with this? Is there anything I can help with?', 'Telegram template: gathering check'),
  ('tpl_impl', E'Good day [Staff Name],\n\nFollowing up on [Topic], specifically: [Checklist Item].\nIt has been a week since this was agreed/approved. Has it been implemented or resolved? Is there anything I can help with?', 'Telegram template: implementation check')
on conflict (key) do nothing;

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- 2. PEOPLE ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role text not null default 'staff' check (role in ('admin','head','staff')),
  account_status text not null default 'pending' check (account_status in ('pending','accepted','blocked')),
  elevated boolean not null default false,          -- Department Heads: ON = head permissions, OFF = staff permissions
  department_id uuid references departments(id) on delete set null,
  telegram_username text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Role/access table: one row per capability, Yes/No per role.
create table if not exists permission_matrix (
  capability text primary key,
  label text not null,
  sort int not null default 0,
  role_admin boolean not null default true check (role_admin),  -- Admin can never be locked out
  role_head boolean not null default false,
  role_staff boolean not null default false
);
insert into permission_matrix (capability, label, sort, role_admin, role_head, role_staff) values
  ('create_discussion', 'Create discussions', 10, true, true, true),
  ('add_participants',  'Add or remove participants on a discussion', 20, true, false, false),
  ('add_checklist',     'Add checklist items (staff: only on topics they belong to)', 30, true, true, true),
  ('set_d_date',        'Set or change the D-date', 40, true, true, false),
  ('change_status',     'Change status / move to Old', 50, true, true, false),
  ('edit_after_decision','Edit a discussion after Agreed/Approved', 60, true, true, false),
  ('create_followup',   'Add follow-up items', 70, true, true, true),
  ('create_poll',       'Create polls', 80, true, true, true),
  ('manage_polls',      'Close or delete polls', 90, true, true, false),
  ('open_settings',     'Open the Settings page', 100, true, false, false),
  ('view_prompts',      'See Telegram prompts', 110, true, false, false),
  ('view_audit',        'See the audit log', 120, true, false, false)
on conflict (capability) do nothing;

-- ---------- 3. DISCUSSIONS ----------
create table if not exists discussions (
  id uuid primary key default gen_random_uuid(),
  seq integer generated always as identity,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  status text not null default 'gathering' check (status in ('gathering','agreed','approved','resolved','unresolved')),
  d_date date,
  d_date_auto boolean not null default false,
  creator_id uuid not null references profiles(id),
  department_id uuid references departments(id) on delete set null,
  decision_type text check (decision_type in ('agreed','approved')),
  decision_at timestamptz,
  resolved_at timestamptz,
  review_on date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists discussion_participants (
  discussion_id uuid not null references discussions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (discussion_id, user_id)
);
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references discussions(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  is_complete boolean not null default false,
  remarks text,
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists auto_add_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  keyword text,                                   -- null = every topic
  is_exception boolean not null default false,    -- true = do NOT auto-add when title contains keyword
  created_at timestamptz not null default now()
);

-- ---------- 4. FOLLOW-UPS, NOTES ----------
create table if not exists follow_up_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  due_date date not null,
  creator_id uuid not null references profiles(id),
  owner_id uuid references profiles(id) on delete set null,
  linked_discussion_id uuid references discussions(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid references discussions(id) on delete cascade,
  follow_up_id uuid references follow_up_items(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  check ((discussion_id is not null)::int + (follow_up_id is not null)::int = 1)
);

-- ---------- 5. POLLS ----------
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(trim(question)) > 0),
  creator_id uuid not null references profiles(id),
  linked_discussion_id uuid references discussions(id) on delete set null,
  audience_all boolean not null default true,
  status text not null default 'open' check (status in ('open','closed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists poll_recipients (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (poll_id, user_id)
);
create table if not exists poll_responses (
  poll_id uuid not null references polls(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  response text not null check (response in ('Yes','Some','No')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- ---------- 6. LOGS, KEEP-ALIVE ----------
create table if not exists activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text,
  entity_type text not null,
  entity_id text,
  parent_id uuid,              -- the discussion this change belongs to (for history view)
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_parent_idx on activity_logs (parent_id);
create index if not exists activity_logs_created_idx on activity_logs (created_at desc);
create table if not exists login_events (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete cascade,
  username text,
  user_agent text,
  created_at timestamptz not null default now()
);
create table if not exists heartbeat (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- FUNCTIONS
-- =====================================================================
create or replace function app_setting(k text) returns text
language sql stable security definer set search_path = public as $$
  select value from app_settings where key = k
$$;

create or replace function today_local() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce(app_setting('timezone'), 'Asia/Manila'))::date
$$;

-- Effective role: admin | head (only when elevated) | staff | null (not accepted)
create or replace function eff_role() returns text
language sql stable security definer set search_path = public as $$
  select case
    when p.account_status <> 'accepted' then null
    when p.role = 'admin' then 'admin'
    when p.role = 'head' and p.elevated then 'head'
    else 'staff' end
  from profiles p where p.id = auth.uid()
$$;

create or replace function is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select account_status = 'accepted' from profiles where id = auth.uid()), false)
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(eff_role() = 'admin', false)
$$;

create or replace function has_cap(cap text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare r text := eff_role(); v boolean;
begin
  if r is null then return false; end if;
  if r = 'admin' then return true; end if;
  select case r when 'head' then role_head else role_staff end into v
    from permission_matrix where capability = cap;
  return coalesce(v, false);
end $$;

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Keep-alive endpoint called every 5 days by GitHub Actions
create or replace function ping() returns timestamptz
language plpgsql security definer set search_path = public as $$
begin
  insert into heartbeat default values;
  delete from heartbeat where created_at < now() - interval '30 days';
  return now();
end $$;

-- Called by the app after each sign-in (visible to Admin in Settings → Logins)
create or replace function record_login(ua text) returns void
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  if auth.uid() is null then return; end if;
  select username into uname from profiles where id = auth.uid();
  insert into login_events (user_id, username, user_agent) values (auth.uid(), uname, left(ua, 300));
  update profiles set last_login_at = now() where id = auth.uid();
end $$;

-- New sign-up → profile. The FIRST account ever created becomes the Admin.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text; first_user boolean;
begin
  uname := lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  select not exists (select 1 from profiles where role = 'admin') into first_user;
  insert into profiles (id, username, display_name, role, account_status)
  values (new.id, uname, coalesce(new.raw_user_meta_data ->> 'display_name', uname),
          case when first_user then 'admin' else 'staff' end,
          case when first_user then 'accepted' else 'pending' end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Only Admin may change roles / approval / elevation (SQL editor is exempt: auth.uid() is null there)
create or replace function guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if not is_admin() then
    if new.id <> old.id or new.username <> old.username or new.role <> old.role
       or new.account_status <> old.account_status or new.elevated <> old.elevated
       or new.department_id is distinct from old.department_id then
      raise exception 'Only an Admin can change these fields';
    end if;
  elsif old.id = auth.uid() and (new.role <> 'admin' or new.account_status <> 'accepted') then
    raise exception 'You cannot demote or block yourself';
  end if;
  return new;
end $$;

-- Discussions: defaults on insert
create or replace function discussions_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.creator_id := auth.uid(); end if;
  new.status := 'gathering';
  new.decision_type := null; new.decision_at := null; new.resolved_at := null;
  new.review_on := null; new.deleted_at := null;
  if new.d_date is null or (auth.uid() is not null and not has_cap('set_d_date')) then
    new.d_date := today_local() + coalesce(app_setting('auto_d_date_days')::int, 7);
    new.d_date_auto := true;
  end if;
  return new;
end $$;

-- Creator + auto-add rules become participants
create or replace function discussions_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into discussion_participants (discussion_id, user_id) values (new.id, new.creator_id)
    on conflict do nothing;
  insert into discussion_participants (discussion_id, user_id)
  select new.id, p.id from profiles p
  where p.account_status = 'accepted'
    and exists (select 1 from auto_add_rules r
                where r.user_id = p.id and not r.is_exception
                  and (r.keyword is null or new.title ilike '%' || r.keyword || '%'))
    and not exists (select 1 from auto_add_rules x
                where x.user_id = p.id and x.is_exception and x.keyword is not null
                  and new.title ilike '%' || x.keyword || '%')
  on conflict do nothing;
  return new;
end $$;

-- Status flow + who may change what
create or replace function discussions_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null then return new; end if;
  if new.creator_id <> old.creator_id then raise exception 'Owner cannot be changed'; end if;
  if new.d_date is distinct from old.d_date then
    if not has_cap('set_d_date') then raise exception 'You cannot change the D-date'; end if;
    new.d_date_auto := false;
  end if;
  if new.status <> old.status then
    if not has_cap('change_status') then raise exception 'You cannot change the status'; end if;
    ok := case old.status
      when 'gathering'  then new.status in ('agreed','approved','resolved','unresolved')
      when 'agreed'     then new.status in ('resolved','unresolved')
      when 'approved'   then new.status in ('resolved','unresolved')
      when 'resolved'   then new.status in ('unresolved')
      when 'unresolved' then new.status in ('gathering','agreed','approved','resolved')
      else false end;
    if not ok then raise exception 'Status cannot move from % to %', old.status, new.status; end if;
    new.review_on := null;
    if new.status in ('agreed','approved') then
      new.decision_type := new.status; new.decision_at := now(); new.resolved_at := null;
    elsif new.status = 'resolved' then
      new.resolved_at := now();
    elsif new.status = 'unresolved' then
      new.resolved_at := null;
      new.review_on := today_local() + coalesce(app_setting('unresolved_review_days')::int, 7);
    elsif new.status = 'gathering' then
      new.decision_type := null; new.decision_at := null; new.resolved_at := null;
    end if;
  end if;
  if (new.title is distinct from old.title or new.description is distinct from old.description
      or new.department_id is distinct from old.department_id)
     and old.status in ('agreed','approved') and not has_cap('edit_after_decision') then
    raise exception 'Editing after a decision needs Admin or an elevated Head';
  end if;
  if new.deleted_at is distinct from old.deleted_at and not has_cap('change_status') then
    raise exception 'You cannot move this discussion to Old';
  end if;
  return new;
end $$;

create or replace function checklist_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
    new.updated_by := auth.uid();
    if tg_op = 'UPDATE' and eff_role() = 'staff' and new.title <> old.title then
      raise exception 'Only Admin or a Head can rename checklist items';
    end if;
  end if;
  return new;
end $$;

create or replace function creator_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.creator_id := auth.uid(); end if;
  return new;
end $$;

-- Generic audit trigger
create or replace function log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb; nm text; pid uuid;
begin
  rec := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at' - 'last_login_at') = (to_jsonb(old) - 'updated_at' - 'last_login_at') then
    return null;
  end if;
  select display_name into nm from profiles where id = auth.uid();
  pid := nullif(coalesce(rec ->> 'discussion_id', case when tg_table_name = 'discussions' then rec ->> 'id' end), '')::uuid;
  insert into activity_logs (actor_id, actor_name, entity_type, entity_id, parent_id, action, before_data, after_data)
  values (auth.uid(), coalesce(nm, 'system'), tg_argv[0],
          coalesce(rec ->> 'id', concat_ws(':', rec ->> 'poll_id', rec ->> 'discussion_id', rec ->> 'user_id', rec ->> 'capability', rec ->> 'key')),
          pid, lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;

-- =====================================================================
-- TRIGGERS
-- =====================================================================
drop trigger if exists t_touch on profiles;           create trigger t_touch before update on profiles for each row execute function touch_updated_at();
drop trigger if exists t_touch on discussions;        create trigger t_touch before update on discussions for each row execute function touch_updated_at();
drop trigger if exists t_touch on checklist_items;    create trigger t_touch before update on checklist_items for each row execute function touch_updated_at();
drop trigger if exists t_touch on follow_up_items;    create trigger t_touch before update on follow_up_items for each row execute function touch_updated_at();
drop trigger if exists t_touch on polls;              create trigger t_touch before update on polls for each row execute function touch_updated_at();
drop trigger if exists t_touch on poll_responses;     create trigger t_touch before update on poll_responses for each row execute function touch_updated_at();
drop trigger if exists t_touch on app_settings;       create trigger t_touch before update on app_settings for each row execute function touch_updated_at();

drop trigger if exists t_guard on profiles;           create trigger t_guard before update on profiles for each row execute function guard_profile_update();
drop trigger if exists t_before_insert on discussions; create trigger t_before_insert before insert on discussions for each row execute function discussions_before_insert();
drop trigger if exists t_after_insert on discussions;  create trigger t_after_insert after insert on discussions for each row execute function discussions_after_insert();
drop trigger if exists t_guard on discussions;         create trigger t_guard before update on discussions for each row execute function discussions_guard();
drop trigger if exists t_guard on checklist_items;     create trigger t_guard before insert or update on checklist_items for each row execute function checklist_guard();
drop trigger if exists t_stamp on follow_up_items;     create trigger t_stamp before insert on follow_up_items for each row execute function creator_stamp();
drop trigger if exists t_stamp on polls;               create trigger t_stamp before insert on polls for each row execute function creator_stamp();

drop trigger if exists t_log on discussions;              create trigger t_log after insert or update or delete on discussions for each row execute function log_activity('discussion');
drop trigger if exists t_log on checklist_items;          create trigger t_log after insert or update or delete on checklist_items for each row execute function log_activity('checklist_item');
drop trigger if exists t_log on discussion_participants;  create trigger t_log after insert or update or delete on discussion_participants for each row execute function log_activity('participant');
drop trigger if exists t_log on follow_up_items;          create trigger t_log after insert or update or delete on follow_up_items for each row execute function log_activity('follow_up');
drop trigger if exists t_log on polls;                    create trigger t_log after insert or update or delete on polls for each row execute function log_activity('poll');
drop trigger if exists t_log on poll_responses;           create trigger t_log after insert or update or delete on poll_responses for each row execute function log_activity('poll_response');
drop trigger if exists t_log on profiles;                 create trigger t_log after insert or update or delete on profiles for each row execute function log_activity('profile');
drop trigger if exists t_log on permission_matrix;        create trigger t_log after insert or update or delete on permission_matrix for each row execute function log_activity('permission');
drop trigger if exists t_log on app_settings;             create trigger t_log after insert or update or delete on app_settings for each row execute function log_activity('setting');
drop trigger if exists t_log on auto_add_rules;           create trigger t_log after insert or update or delete on auto_add_rules for each row execute function log_activity('auto_add_rule');

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table app_settings enable row level security;
alter table departments enable row level security;
alter table profiles enable row level security;
alter table permission_matrix enable row level security;
alter table discussions enable row level security;
alter table discussion_participants enable row level security;
alter table checklist_items enable row level security;
alter table auto_add_rules enable row level security;
alter table follow_up_items enable row level security;
alter table notes enable row level security;
alter table polls enable row level security;
alter table poll_recipients enable row level security;
alter table poll_responses enable row level security;
alter table activity_logs enable row level security;
alter table login_events enable row level security;
alter table heartbeat enable row level security;

-- rebuild every policy on each run
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- settings, departments, matrix: everyone approved reads, Admin writes
create policy settings_read on app_settings for select to authenticated using (is_active());
create policy settings_write on app_settings for all to authenticated using (is_admin()) with check (is_admin());
create policy dept_read on departments for select to authenticated using (is_active());
create policy dept_write on departments for all to authenticated using (is_admin()) with check (is_admin());
create policy matrix_read on permission_matrix for select to authenticated using (is_active());
create policy matrix_write on permission_matrix for update to authenticated using (is_admin()) with check (is_admin());

-- profiles: own row always (so a pending user can see "waiting"), all rows once approved
create policy profiles_read on profiles for select to authenticated using (id = auth.uid() or is_active());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- discussions
create policy disc_read on discussions for select to authenticated using (is_active());
create policy disc_insert on discussions for insert to authenticated
  with check (is_active() and has_cap('create_discussion'));
create policy disc_update on discussions for update to authenticated
  using (is_active() and (creator_id = auth.uid() or eff_role() in ('admin','head')))
  with check (is_active());
create policy part_read on discussion_participants for select to authenticated using (is_active());
create policy part_insert on discussion_participants for insert to authenticated
  with check (is_active() and has_cap('add_participants'));
create policy part_delete on discussion_participants for delete to authenticated
  using (is_active() and has_cap('add_participants'));

-- checklist: Admin/Head anywhere; staff only on topics they belong to (creator, added by Admin, or auto-added)
create policy check_read on checklist_items for select to authenticated using (is_active());
create policy check_insert on checklist_items for insert to authenticated
  with check (is_active() and has_cap('add_checklist') and (
    eff_role() in ('admin','head') or exists (
      select 1 from discussion_participants dp
      where dp.discussion_id = checklist_items.discussion_id and dp.user_id = auth.uid())));
create policy check_update on checklist_items for update to authenticated
  using (is_active() and (
    eff_role() in ('admin','head') or exists (
      select 1 from discussion_participants dp
      where dp.discussion_id = checklist_items.discussion_id and dp.user_id = auth.uid())))
  with check (is_active());
create policy check_delete on checklist_items for delete to authenticated
  using (is_active() and eff_role() in ('admin','head') and has_cap('add_checklist'));

create policy rules_all on auto_add_rules for all to authenticated using (is_admin()) with check (is_admin());

-- follow-ups & notes
create policy fu_read on follow_up_items for select to authenticated using (is_active());
create policy fu_insert on follow_up_items for insert to authenticated
  with check (is_active() and has_cap('create_followup'));
create policy fu_update on follow_up_items for update to authenticated
  using (is_active() and (creator_id = auth.uid() or eff_role() in ('admin','head')))
  with check (is_active());
create policy notes_read on notes for select to authenticated using (is_active());
create policy notes_insert on notes for insert to authenticated
  with check (is_active() and author_id = auth.uid());

-- polls
create policy poll_read on polls for select to authenticated using (is_active());
create policy poll_insert on polls for insert to authenticated
  with check (is_active() and has_cap('create_poll'));
create policy poll_update on polls for update to authenticated
  using (is_active() and has_cap('manage_polls')) with check (is_active());
create policy prec_read on poll_recipients for select to authenticated using (is_active());
create policy prec_insert on poll_recipients for insert to authenticated
  with check (is_active() and (has_cap('manage_polls') or exists (
    select 1 from polls p where p.id = poll_recipients.poll_id and p.creator_id = auth.uid())));
create policy presp_read on poll_responses for select to authenticated using (is_active());
create policy presp_insert on poll_responses for insert to authenticated
  with check (user_id = auth.uid() and is_active() and exists (
    select 1 from polls p where p.id = poll_responses.poll_id and p.status = 'open' and p.deleted_at is null
      and (p.audience_all or exists (select 1 from poll_recipients r where r.poll_id = p.id and r.user_id = auth.uid()))));
create policy presp_update on poll_responses for update to authenticated
  using (user_id = auth.uid() and is_active() and exists (
    select 1 from polls p where p.id = poll_responses.poll_id and p.status = 'open' and p.deleted_at is null))
  with check (user_id = auth.uid());

-- logs: Admin (view_audit) sees everything; everyone approved sees discussion history
create policy log_read on activity_logs for select to authenticated
  using (is_active() and (has_cap('view_audit') or entity_type in ('discussion','checklist_item','participant')));
create policy login_read on login_events for select to authenticated using (is_admin());

-- =====================================================================
-- GRANTS (explicit, so it works whatever the project's default privileges are)
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
grant execute on function ping() to anon, authenticated;

-- Done. Now: Authentication → Providers → Email → turn OFF "Confirm email".
-- Then open the app and create your account FIRST: it becomes the Admin.
