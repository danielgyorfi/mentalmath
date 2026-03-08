-- ═══════════════════════════════════════════════════════════════════
-- MentalMath – Supabase Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com
-- ═══════════════════════════════════════════════════════════════════

-- ─── Extensions ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Enums ─────────────────────────────────────────────────────────
create type user_role        as enum ('student', 'teacher', 'admin');
create type age_group        as enum ('8-10', '11-13');
create type difficulty_level as enum ('easy', 'medium', 'hard');
create type answer_type      as enum ('typed', 'multiple_choice', 'both');

-- ─── profiles ──────────────────────────────────────────────────────
-- Extends auth.users with app-specific fields
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role    not null default 'student',
  full_name  text         not null,
  avatar_url text,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now()
);

-- ─── classes ───────────────────────────────────────────────────────
create table public.classes (
  id          uuid         primary key default uuid_generate_v4(),
  teacher_id  uuid         not null references public.profiles(id) on delete cascade,
  name        text         not null,
  join_code   text         not null unique default upper(substring(md5(random()::text) from 1 for 6)),
  created_at  timestamptz  not null default now()
);

-- ─── class_members ─────────────────────────────────────────────────
create table public.class_members (
  class_id    uuid         not null references public.classes(id) on delete cascade,
  student_id  uuid         not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz  not null default now(),
  primary key (class_id, student_id)
);

-- ─── exercise_templates ────────────────────────────────────────────
-- JSON templates that define how exercises are generated
create table public.exercise_templates (
  id               uuid          primary key default uuid_generate_v4(),
  teacher_id       uuid          not null references public.profiles(id) on delete cascade,
  title            text          not null,
  description      text,
  age_groups       age_group[]   not null default array['8-10']::age_group[],
  difficulty       difficulty_level not null default 'medium',
  answer_type      answer_type   not null default 'typed',
  -- The template string: "What is {a} × {b}?"
  question_template text         not null,
  -- JSON object: { "a": {"type":"integer","min":2,"max":12}, "name": {"type":"name"} }
  variables        jsonb         not null default '{}',
  -- Math expression string evaluated by mathjs: "a * b"
  answer_expression text         not null,
  -- Optional hints list
  hints            text[]        default array[]::text[],
  -- Subject tags for filtering
  subject_tags     text[]        not null default array[]::text[],
  -- Seconds per question (null = untimed)
  time_limit_secs  integer,
  -- Questions generated per session
  questions_count  integer       not null default 10,
  -- Whether visible to students
  is_published     boolean       not null default false,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

-- ─── class_exercises ───────────────────────────────────────────────
-- Which exercises are assigned to which class
create table public.class_exercises (
  class_id     uuid not null references public.classes(id) on delete cascade,
  template_id  uuid not null references public.exercise_templates(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  primary key  (class_id, template_id)
);

-- ─── exercise_sessions ─────────────────────────────────────────────
-- A student's attempt at one exercise template
create table public.exercise_sessions (
  id            uuid         primary key default uuid_generate_v4(),
  student_id    uuid         not null references public.profiles(id) on delete cascade,
  template_id   uuid         not null references public.exercise_templates(id) on delete cascade,
  -- Snapshot of generated questions at session start
  questions     jsonb        not null default '[]',
  -- Array of student answers: [ { question_index, answer, correct, time_ms } ]
  answers       jsonb        not null default '[]',
  score         integer,
  max_score     integer,
  completed_at  timestamptz,
  started_at    timestamptz  not null default now()
);

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at timestamps
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_templates_updated_at
  before update on public.exercise_templates
  for each row execute procedure public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles          enable row level security;
alter table public.classes           enable row level security;
alter table public.class_members     enable row level security;
alter table public.exercise_templates enable row level security;
alter table public.class_exercises   enable row level security;
alter table public.exercise_sessions enable row level security;

-- Profiles: users can read their own; teachers can read all their students
create policy "profiles: own read"    on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update"  on public.profiles for update using (auth.uid() = id);

-- Classes: teachers own their classes; students can see classes they're in
create policy "classes: teacher full" on public.classes for all
  using (teacher_id = auth.uid());

create policy "classes: student read" on public.classes for select
  using (exists (
    select 1 from public.class_members
    where class_id = id and student_id = auth.uid()
  ));

-- Class members: teachers manage; students can see own membership
create policy "class_members: teacher manage" on public.class_members for all
  using (exists (
    select 1 from public.classes
    where id = class_id and teacher_id = auth.uid()
  ));

create policy "class_members: student see own" on public.class_members for select
  using (student_id = auth.uid());

-- Students can join a class (insert their own row)
create policy "class_members: student join" on public.class_members for insert
  with check (student_id = auth.uid());

-- Exercise templates: teachers own; students can see published templates in their class
create policy "templates: teacher full" on public.exercise_templates for all
  using (teacher_id = auth.uid());

create policy "templates: student read published" on public.exercise_templates for select
  using (
    is_published = true
    and exists (
      select 1
      from public.class_exercises ce
      join public.class_members   cm on cm.class_id = ce.class_id
      where ce.template_id = id and cm.student_id = auth.uid()
    )
  );

-- Class exercises: teachers manage
create policy "class_exercises: teacher manage" on public.class_exercises for all
  using (exists (
    select 1 from public.classes
    where id = class_id and teacher_id = auth.uid()
  ));

create policy "class_exercises: student read" on public.class_exercises for select
  using (exists (
    select 1 from public.class_members
    where class_id = class_id and student_id = auth.uid()
  ));

-- Sessions: students own their sessions; teachers can read their students' sessions
create policy "sessions: student full" on public.exercise_sessions for all
  using (student_id = auth.uid());

create policy "sessions: teacher read" on public.exercise_sessions for select
  using (exists (
    select 1
    from public.exercise_templates t
    where t.id = template_id and t.teacher_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════

create index on public.classes           (teacher_id);
create index on public.class_members     (student_id);
create index on public.class_members     (class_id);
create index on public.exercise_templates (teacher_id);
create index on public.class_exercises   (class_id);
create index on public.exercise_sessions (student_id);
create index on public.exercise_sessions (template_id);
