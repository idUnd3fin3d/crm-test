import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { useProfiles } from '../lib/useProfiles';
import TaskForm from '../components/TaskForm';
import { ErrorText, StatusBadge } from '../components/common';
import { availableActions, fmt, STATUS_LABEL, type HistoryRow, type SObject, type Status, type Task, type Transition } from '../lib/types';

export default function TaskPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const profiles = useProfiles();

  const [task, setTask] = useState<Task | null | undefined>(undefined);
  const [obj, setObj] = useState<SObject | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [rules, setRules] = useState<Transition[]>([]);

  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data: t } = await supabase.from('tasks').select('*').eq('id', id!).maybeSingle();

    setTask(t as Task | null);

    if (!t) return;

    const [objects, taskStatusHistory, taskTransitions] = await Promise.all([
      supabase.from('objects').select('*').eq('id', t.object_id).maybeSingle(),
      supabase.from('task_status_history').select('*').eq('task_id', t.id).order('created_at'),
      supabase.from('task_transitions').select('*'),
    ]);

    setObj(objects.data as SObject | null);
    setHistory((taskStatusHistory.data ?? []) as HistoryRow[]);
    setRules((taskTransitions.data ?? []) as Transition[]);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (task === undefined || !profile) return <p className="muted">Загрузка…</p>;
  if (task === null) return <p>Задача не найдена или нет доступа.</p>;

  const actions = availableActions(rules, task, profile);
  const isManager = profile.role === 'manager';

  const act = async (to: Status, required: boolean) => {
    setErr('');

    if (required && !comment.trim()) {
      setErr('Укажите комментарий');
      return;
    }

    const { error } = await supabase.rpc('change_task_status', {
      p_task_id: task.id,
      p_new_status: to,
      p_comment: comment.trim() || null,
    });

    if (error) {
      setErr(error.message);
    } else {
      setComment('');
      load();
    }
  };

  const remove = async () => {
    if (!confirm('Удалить задачу вместе с историей?')) return;

    const { error } = await supabase.from('tasks').delete().eq('id', task.id);

    if (error) setErr(error.message);
    else navigate(`/objects/${task.object_id}`);
  };

  return (
    <>
      <Link to={`/objects/${task.object_id}`}>← {obj?.name ?? 'Объект'}</Link>
      {editing
        ? <TaskForm objectId={task.object_id} task={task} onDone={() => { setEditing(false); load(); }} onCancel={() => setEditing(false)} />
        : <>
            <h1>{task.title}</h1>
            <p><StatusBadge status={task.status} /></p>
            <p>{task.description || <span className="muted">Без описания</span>}</p>
            <p className="muted">
              Исполнитель: {profiles[task.assignee_id]?.full_name} · Автор: {profiles[task.author_id]?.full_name} · Создана: {fmt(task.created_at)}
            </p>
          </>}

      {actions.length > 0 && (
        <div className="card">
          <textarea rows={2} placeholder="Комментарий (обязателен при возврате на доработку)"
            value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="row">
            {actions.map((a) => (
              <button key={a.to} className={a.to === 'needs_rework' ? 'danger' : ''} onClick={() => act(a.to, a.commentRequired)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <ErrorText text={err} />

      {isManager && !editing && (
        <div className="row">
          {task.status !== 'accepted' && <button className="ghost" onClick={() => setEditing(true)}>Редактировать</button>}
          <button className="danger" onClick={remove}>Удалить</button>
        </div>
      )}

      <h2>История</h2>
      {history.map((h) => (
        <div key={h.id} className="card">
          <strong>{h.from_status ? `${STATUS_LABEL[h.from_status]} → ${STATUS_LABEL[h.to_status]}` : `Создана (${STATUS_LABEL[h.to_status]})`}</strong>
          <span className="muted">{profiles[h.changed_by]?.full_name} · {fmt(h.created_at)}</span>
          {h.comment && <span>{h.comment}</span>}
        </div>
      ))}
    </>
  );
}
