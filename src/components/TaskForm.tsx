import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { useProfiles } from '../lib/useProfiles';
import { ErrorText } from './common';
import type { Task } from '../lib/types';

interface Props {
  objectId: string;
  task?: Task;
  onDone: () => void;
  onCancel: () => void;
}

export default function TaskForm({ objectId, task, onDone, onCancel }: Props) {
  const { profile } = useAuth();
  const profiles = useProfiles();
  const executors = Object.values(profiles).filter((p) => p.role === 'executor');

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [assignee, setAssignee] = useState(task?.assignee_id ?? '');
  const [err, setErr] = useState('');

  // Исполнителя можно менять только в «Новая» и «На доработке» (так же проверяет база)
  const locked = !!task && !['new', 'needs_rework'].includes(task.status);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    setErr('');
    const { error } = task
      ? await supabase.from('tasks').update({
        title,
        description,
        assignee_id: assignee,
      }).eq('id', task.id)
      : await supabase.from('tasks').insert({
          title,
          description,
          object_id: objectId,
          assignee_id: assignee,
          author_id: profile!.id,
        });

    if (error) setErr(error.message);
    else onDone();
  };

  return (
    <form className="card" onSubmit={submit}>
      <input required placeholder="Название задачи" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea placeholder="Описание" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      <select required value={assignee} disabled={locked} onChange={(e) => setAssignee(e.target.value)}>
        <option value="">Исполнитель…</option>
        {executors.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
      </select>
      <ErrorText text={err} />
      <div className="row">
        <button type="submit">{task ? 'Сохранить' : 'Создать задачу'}</button>
        <button type="button" className="ghost" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
