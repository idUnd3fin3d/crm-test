export type Role = 'manager' | 'executor';
export type Status = 'new' | 'in_progress' | 'in_review' | 'accepted' | 'needs_rework';

export const STATUS_LABEL: Record<Status, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  in_review: 'На проверке',
  accepted: 'Принята',
  needs_rework: 'На доработке',
};

export interface Profile {
  id: string;
  full_name: string;
  role: Role
}
export interface SObject {
  id: string;
  name: string;
  address: string
}
export interface Task {
  id: string;
  title: string;
  description: string;
  object_id: string;
  assignee_id: string;
  status: Status;
  author_id: string;
  created_at: string;
}
export interface HistoryRow {
  id: number;
  task_id: string;
  changed_by: string;
  from_status: Status | null;
  to_status: Status;
  comment: string | null;
  created_at: string;
}
export interface Transition {
  from_status: Status;
  to_status: Status;
  actor: 'assignee' | 'manager';
  comment_required: boolean;
}

const ACTION_LABEL: Record<Status, string> = {
  new: '',
  in_progress: 'Взять в работу',
  in_review: 'Отправить на проверку',
  accepted: 'Принять',
  needs_rework: 'Вернуть на доработку',
};

// Какие кнопки показать. Правила берутся из таблицы task_transitions в базе;
// это только подсказка для интерфейса, настоящая проверка делает база.
export function availableActions(rules: Transition[], task: Task, me: Profile) {
  return rules
    .filter((r) => r.from_status === task.status)
    .filter((r) => (r.actor === 'manager' ? me.role === 'manager' : task.assignee_id === me.id))
    .map((r) => ({ to: r.to_status, label: ACTION_LABEL[r.to_status], commentRequired: r.comment_required }));
}

export const fmt = (d: string) => new Date(d).toLocaleString('ru-RU');
