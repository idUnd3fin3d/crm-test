import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { useProfiles } from '../lib/useProfiles';
import ObjectForm from '../components/ObjectForm';
import TaskForm from '../components/TaskForm';
import { ErrorText, StatusBadge } from '../components/common';
import type { SObject, Task } from '../lib/types';

export default function ObjectPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { profile } = useAuth();

  const profiles = useProfiles();
  const isManager = profile?.role === 'manager';

  const [obj, setObj] = useState<SObject | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<'view' | 'editObj' | 'newTask'>('view');

  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [o, t] = await Promise.all([
      supabase.from('objects').select('*').eq('id', id!).maybeSingle(),
      supabase.from('tasks').select('*').eq('object_id', id!).order('created_at', { ascending: false }),
    ]);
    setObj(o.data as SObject | null);
    setTasks((t.data ?? []) as Task[]);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    if (!confirm('Удалить объект?')) return;

    const { error } = await supabase.from('objects').delete().eq('id', id!);

    if (error) setErr(error.code === '23503' ? 'Нельзя удалить объект, у которого есть задачи' : error.message);
    else nav('/objects');
  };

  if (obj === undefined) return <p className="muted">Загрузка…</p>;
  if (obj === null) return <p>Объект не найден или нет доступа.</p>;

  return (
    <>
      <Link to="/objects">← Объекты</Link>
      {mode === 'editObj'
        ? <ObjectForm object={obj} onDone={() => { setMode('view'); load(); }} onCancel={() => setMode('view')} />
        : <>
            <h1>{obj.name}</h1>
            <p className="muted">{obj.address}</p>
            {isManager && (
              <div className="row">
                <button className="ghost" onClick={() => setMode('editObj')}>Редактировать</button>
                <button className="danger" onClick={remove}>Удалить</button>
              </div>
            )}
            <ErrorText text={err} />
          </>}

      <div className="row between"><h2>Задачи</h2>
        {isManager && mode === 'view' && <button onClick={() => setMode('newTask')}>Новая задача</button>}
      </div>
      {mode === 'newTask' && <TaskForm objectId={obj.id} onDone={() => { setMode('view'); load(); }} onCancel={() => setMode('view')} />}
      {tasks.length === 0 && <p className="muted">Задач пока нет.</p>}
      {tasks.map((t) => (
        <Link key={t.id} to={`/tasks/${t.id}`} className="card link">
          <strong>{t.title}</strong>
          <span className="muted">{profiles[t.assignee_id]?.full_name}</span>
          <StatusBadge status={t.status} />
        </Link>
      ))}
    </>
  );
}
