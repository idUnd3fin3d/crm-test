-- =====================================================================
-- Сид-данные для демо
--
-- ПЕРЕД ЗАПУСКОМ создайте 4 пользователя в Supabase:
--   Authentication -> Users -> Add user -> Create new user
--   (галочка "Auto Confirm User" включена), пароли придумайте свои:
--     manager1@example.com   manager2@example.com
--     executor1@example.com  executor2@example.com
--
-- Запускать в SQL Editor один раз целиком (скрипт не идемпотентен).
-- Пароли в репозиторий не кладём.
-- =====================================================================

begin;

-- ---------- Профили ----------
insert into public.profiles (id, full_name, role)
select u.id, v.full_name, v.role::public.user_role
from auth.users u
join (values
  ('manager1@example.com',  'Анна Соколова (постановщик)',  'manager'),
  ('manager2@example.com',  'Игорь Фролов (постановщик)',   'manager'),
  ('executor1@example.com', 'Пётр Морозов (исполнитель)',   'executor'),
  ('executor2@example.com', 'Мария Крылова (исполнитель)',  'executor')
) as v(email, full_name, role) on v.email = u.email
on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role;

-- ---------- Объекты ----------
insert into public.objects (name, address) values
  ('ЖК «Северный»',        'г. Москва, ул. Ленина, 15'),
  ('Склад на Промышленной', 'г. Подольск, ул. Промышленная, 3'),
  ('Коттедж в Лесном',      'Московская обл., пос. Лесной, уч. 27');

-- ---------- Задачи (все создаются в статусе "Новая") ----------
insert into public.tasks (title, description, object_id, assignee_id, author_id)
select t.title, t.descr,
       (select id from public.objects where name = t.obj),
       (select id from auth.users where email = t.exec),
       (select id from auth.users where email = 'manager1@example.com')
from (values
  ('Залить фундамент секции А', 'Бетон B25, по проекту КЖ-3',          'ЖК «Северный»',         'executor1@example.com'),
  ('Проверить армирование',     'Сверить шаг арматуры с чертежами',    'ЖК «Северный»',         'executor1@example.com'),
  ('Заказать бетон',            'Согласовать поставщика и график',     'Склад на Промышленной', 'executor2@example.com'),
  ('Монтаж кровли',             'Профнастил, водосточная система',     'Склад на Промышленной', 'executor2@example.com'),
  ('Гидроизоляция подвала',     'Двухслойная обмазочная',              'Коттедж в Лесном',      'executor1@example.com'),
  ('Электрика 1 этажа',         'Прокладка кабеля, щиток',             'Коттедж в Лесном',      'executor2@example.com'),
  ('Разметка парковки',         'Краска, 24 места',                    'Склад на Промышленной', 'executor2@example.com')
) as t(title, descr, obj, exec);

-- ---------- Помощники: выполняем действия "от имени" пользователя ----------
-- Подставляем uid в настройки запроса, как это делает Supabase API.
-- Благодаря этому история заполняется реальной функцией и по тем же правилам.
create function pg_temp.as_user(p_email text) returns void
language plpgsql as $$
declare v uuid;
begin
  select id into v from auth.users where email = p_email;
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v)::text, true);
end $$;

create function pg_temp.move(p_email text, p_title text,
                             p_to public.task_status, p_comment text default null)
returns void language plpgsql as $$
begin
  perform pg_temp.as_user(p_email);
  perform public.change_task_status(
    (select id from public.tasks where title = p_title), p_to, p_comment);
end $$;

-- ---------- Продвигаем задачи по статусам ----------
-- «Залить фундамент секции А»: остаётся "Новая"

-- «Проверить армирование»: В работе
select pg_temp.move('executor1@example.com', 'Проверить армирование', 'in_progress');

-- «Заказать бетон»: На проверке
select pg_temp.move('executor2@example.com', 'Заказать бетон', 'in_progress');
select pg_temp.move('executor2@example.com', 'Заказать бетон', 'in_review', 'Поставщик согласован, график в приложении');

-- «Монтаж кровли»: Принята
select pg_temp.move('executor2@example.com', 'Монтаж кровли', 'in_progress');
select pg_temp.move('executor2@example.com', 'Монтаж кровли', 'in_review', 'Работы завершены');
select pg_temp.move('manager1@example.com',  'Монтаж кровли', 'accepted', 'Принято, замечаний нет');

-- «Гидроизоляция подвала»: На доработке
select pg_temp.move('executor1@example.com', 'Гидроизоляция подвала', 'in_progress');
select pg_temp.move('executor1@example.com', 'Гидроизоляция подвала', 'in_review');
select pg_temp.move('manager1@example.com',  'Гидроизоляция подвала', 'needs_rework', 'Второй слой нанесён неравномерно, переделать углы');

-- «Электрика 1 этажа»: остаётся "Новая"

-- «Разметка парковки»: В работе
select pg_temp.move('executor2@example.com', 'Разметка парковки', 'in_progress');

commit;
