import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { StatusBadge } from '../components/common';
import type { SObject, Task } from '../lib/types';

export default function MyTasks() {
  const { profile } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [objects, setObjects] = useState<Record<string, SObject>>({});

  useEffect(() => {
    if (!profile) return;

    Promise.all([
      supabase.from('tasks').select('*').eq('assignee_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('objects').select('*'),
    ]).then(([tasks, objects]) => {
      setTasks((tasks.data ?? []) as Task[]);
      setObjects(Object.fromEntries((objects.data ?? []).map((x) => [x.id, x as SObject])));
    });
  }, [profile]);

  return (
    <>
      <h1>Мои задачи</h1>
      {tasks.length === 0 && <p className="muted">Вам пока ничего не назначено.</p>}
      {tasks.map((task) => (
        <Link key={task.id} to={`/tasks/${task.id}`} className="card link">
          <strong>{task.title}</strong>
          <span className="muted">{objects[task.object_id]?.name}</span>
          <StatusBadge status={task.status} />
        </Link>
      ))}
    </>
  );
}
