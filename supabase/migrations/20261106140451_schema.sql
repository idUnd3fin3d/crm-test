-- =====================================================================
-- Миграция 1: схема данных
-- Таблицы, enum-типы, индексы и триггеры целостности.
-- Права доступа (RLS и GRANT) - в миграции 2, смена статусов - в миграции 3.
-- =====================================================================

-- ---------- Типы ----------
create type public.user_role as enum ('manager', 'executor');

create type public.task_status as enum (
  'new',           -- Новая
  'in_progress',   -- В работе
  'in_review',     -- На проверке
  'accepted',      -- Принята
  'needs_rework'   -- На доработке
);

-- ---------- Профили ----------
-- Роль хранится здесь, а не в user_metadata: метаданные пользователь
-- может поменять сам, эту таблицу - нет (см. миграцию 2).
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) > 0),
  role       public.user_role not null,
  created_at timestamptz not null default now()
);

-- ---------- Объекты (стройки) ----------
create table public.objects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  address    text not null check (length(btrim(address)) > 0),
  created_at timestamptz not null default now()
);

-- ---------- Задачи ----------
-- Допущение: исполнитель обязателен (assignee_id NOT NULL), иначе задачу
-- в статусе "Новая" никто не сможет взять в работу.
-- on delete restrict: нельзя удалить объект, у которого есть задачи,
-- и нельзя удалить пользователя, на котором висят задачи.
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) > 0),
  description text not null default '',
  object_id   uuid not null references public.objects (id)  on delete restrict,
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  status      public.task_status not null default 'new',
  author_id   uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_object_idx   on public.tasks (object_id);

-- ---------- Допустимые переходы статусов (таблица правил) ----------
-- actor: 'assignee' - только назначенный исполнитель, 'manager' - постановщик.
create table public.task_transitions (
  from_status      public.task_status not null,
  to_status        public.task_status not null,
  actor            text not null check (actor in ('assignee', 'manager')),
  comment_required boolean not null default false,
  primary key (from_status, to_status)
);

insert into public.task_transitions (from_status, to_status, actor, comment_required) values
  ('new',          'in_progress',  'assignee', false),
  ('in_progress',  'in_review',    'assignee', false),
  ('in_review',    'accepted',     'manager',  false),
  ('in_review',    'needs_rework', 'manager',  true),
  ('needs_rework', 'in_progress',  'assignee', false);

-- ---------- История статусов ----------
-- from_status = null у первой записи (создание задачи).
-- clock_timestamp(), а не now(): время каждой записи уникально
-- даже внутри одной транзакции (важно для сида).
create table public.task_status_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  changed_by  uuid not null references public.profiles (id) on delete restrict,
  from_status public.task_status,
  to_status   public.task_status not null,
  comment     text,
  created_at  timestamptz not null default clock_timestamp()
);

create index task_history_task_idx on public.task_status_history (task_id, created_at);

-- =====================================================================
-- Триггеры целостности
-- =====================================================================

-- Правила для задач:
--  1) исполнителем может быть только пользователь с ролью executor;
--  2) принятую задачу нельзя редактировать;
--  3) исполнителя можно менять только в статусах "Новая" и "На доработке".
create function public.tasks_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id then
    if not exists (
      select 1 from public.profiles
      where id = new.assignee_id and role = 'executor'
    ) then
      raise exception 'Исполнителем может быть только пользователь с ролью executor'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'accepted'
       and (new.title, new.description, new.object_id, new.assignee_id)
           is distinct from
           (old.title, old.description, old.object_id, old.assignee_id) then
      raise exception 'Принятую задачу нельзя редактировать'
        using errcode = '23514';
    end if;

    if new.assignee_id is distinct from old.assignee_id
       and old.status not in ('new', 'needs_rework') then
      raise exception 'Менять исполнителя можно только в статусах "Новая" и "На доработке"'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_guard_trg
  before insert or update on public.tasks
  for each row execute function public.tasks_guard();

-- История только дополняется: UPDATE, TRUNCATE и прямой DELETE запрещены.
-- Исключение - каскадное удаление вместе с задачей (там триггер вызывается
-- изнутри другого триггера, глубина > 1).
create function public.history_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'История статусов неизменяема' using errcode = '42501';
end;
$$;

create trigger history_no_change_trg
  before update or delete on public.task_status_history
  for each row execute function public.history_append_only();

create trigger history_no_truncate_trg
  before truncate on public.task_status_history
  for each statement execute function public.history_append_only();
