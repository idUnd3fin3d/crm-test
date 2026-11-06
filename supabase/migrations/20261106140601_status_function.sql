-- =====================================================================
-- Миграция 3: смена статусов на стороне базы
--
-- Единственный способ изменить статус задачи - вызвать функцию
-- change_task_status (через supabase.rpc). Она работает с правами
-- владельца (security definer), поэтому может писать в status и в историю,
-- хотя у пользователей на это прав нет. Все проверки - внутри функции.
-- =====================================================================

create function public.change_task_status(
  p_task_id    uuid,
  p_new_status public.task_status,
  p_comment    text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_role    public.user_role;
  v_task    public.tasks;
  v_rule    public.task_transitions;
  v_from    public.task_status;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  -- 1. Кто вызывает
  if v_uid is null then
    raise exception 'Требуется авторизация' using errcode = '28000';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'Профиль пользователя не найден' using errcode = '42501';
  end if;

  -- 2. Блокируем строку задачи: две одновременные смены не пройдут обе.
  select * into v_task from public.tasks where id = p_task_id for update;

  -- Чужая задача для исполнителя выглядит как несуществующая.
  if not found
     or (v_role = 'executor' and v_task.assignee_id is distinct from v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  -- 3. Допустим ли такой переход вообще
  select * into v_rule
  from public.task_transitions
  where from_status = v_task.status and to_status = p_new_status;

  if not found then
    raise exception 'Переход % -> % запрещён', v_task.status, p_new_status
      using errcode = '42501';
  end if;

  -- 4. Может ли этот пользователь его сделать
  if v_rule.actor = 'assignee' and v_task.assignee_id is distinct from v_uid then
    raise exception 'Этот переход может сделать только назначенный исполнитель'
      using errcode = '42501';
  end if;

  if v_rule.actor = 'manager' and v_role <> 'manager' then
    raise exception 'Этот переход может сделать только постановщик'
      using errcode = '42501';
  end if;

  -- 5. Обязательный комментарий
  if v_rule.comment_required and v_comment is null then
    raise exception 'Для этого перехода нужен комментарий'
      using errcode = '23514';
  end if;

  -- 6. Меняем статус и пишем историю в одной транзакции
  v_from := v_task.status;

  update public.tasks
  set status = p_new_status
  where id = p_task_id
  returning * into v_task;

  insert into public.task_status_history
    (task_id, changed_by, from_status, to_status, comment)
  values
    (p_task_id, v_uid, v_from, p_new_status, v_comment);

  return v_task;
end;
$$;

revoke execute on function public.change_task_status(uuid, public.task_status, text)
  from public, anon;
grant  execute on function public.change_task_status(uuid, public.task_status, text)
  to authenticated;

-- ---------- Первая запись истории при создании задачи ----------
create function public.log_task_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_status_history
    (task_id, changed_by, from_status, to_status, comment)
  values
    (new.id, new.author_id, null, new.status, null);
  return new;
end;
$$;

revoke execute on function public.log_task_created() from public, anon, authenticated;

create trigger tasks_log_created_trg
  after insert on public.tasks
  for each row execute function public.log_task_created();
