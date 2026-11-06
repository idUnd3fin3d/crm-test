-- =====================================================================
-- Миграция 2: права доступа (GRANT + RLS)
--
-- Два слоя защиты:
--  1) GRANT - какие операции и по каким колонкам вообще разрешены роли;
--  2) RLS   - какие строки видны и доступны.
-- Supabase по умолчанию выдаёт ролям anon/authenticated все права на таблицы,
-- поэтому сначала всё отзываем, потом выдаём только нужное.
-- =====================================================================

-- ---------- Вспомогательная функция ----------
-- security definer, чтобы читать profiles без рекурсии политик.
-- search_path = '' защищает от подмены объектов (все имена - с схемой).
create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

revoke execute on function public.is_manager() from public, anon;
grant  execute on function public.is_manager() to authenticated;

-- ---------- Включаем RLS везде ----------
alter table public.profiles            enable row level security;
alter table public.objects             enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_status_history enable row level security;
alter table public.task_transitions    enable row level security;

-- ---------- Права на уровне колонок ----------
revoke all on public.profiles, public.objects, public.tasks,
              public.task_status_history, public.task_transitions
  from anon, authenticated;

-- Только чтение: профили, история, правила переходов.
grant select on public.profiles            to authenticated;
grant select on public.task_status_history to authenticated;
grant select on public.task_transitions    to authenticated;

-- Объекты: менять можно только name и address.
grant select, delete          on public.objects to authenticated;
grant insert (name, address)  on public.objects to authenticated;
grant update (name, address)  on public.objects to authenticated;

-- Задачи: колонку status напрямую не может писать никто
-- (она меняется только функцией change_task_status).
-- author_id задаётся при создании, потом не меняется.
grant select, delete on public.tasks to authenticated;
grant insert (title, description, object_id, assignee_id, author_id)
  on public.tasks to authenticated;
grant update (title, description, object_id, assignee_id)
  on public.tasks to authenticated;

-- =====================================================================
-- Политики (строки)
-- =====================================================================

-- ---------- profiles ----------
-- Видят все авторизованные (нужны имена автора/исполнителя).
-- Политик на INSERT/UPDATE/DELETE нет, прав тоже нет -> роль не поменять.
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

-- ---------- task_transitions ----------
create policy transitions_select on public.task_transitions
  for select to authenticated
  using (true);

-- ---------- objects ----------
-- Постановщик видит всё; исполнитель - только объекты со своими задачами.
create policy objects_select on public.objects
  for select to authenticated
  using (
    public.is_manager()
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id
        and t.assignee_id = (select auth.uid())
    )
  );

create policy objects_insert on public.objects
  for insert to authenticated
  with check (public.is_manager());

create policy objects_update on public.objects
  for update to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy objects_delete on public.objects
  for delete to authenticated
  using (public.is_manager());

-- ---------- tasks ----------
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    public.is_manager()
    or assignee_id = (select auth.uid())
  );

-- Создать может только постановщик, автором - только себя, статус - только 'new'.
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    public.is_manager()
    and author_id = (select auth.uid())
    and status = 'new'
  );

create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_manager())
  with check (public.is_manager());

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.is_manager());

-- ---------- task_status_history ----------
-- Читать можно историю тех задач, которые пользователь видит
-- (подзапрос к tasks сам проходит через RLS tasks).
-- INSERT/UPDATE/DELETE: ни прав, ни политик. Пишет только функция
-- change_task_status и триггер создания задачи (миграция 3).
create policy history_select on public.task_status_history
  for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_status_history.task_id)
  );
