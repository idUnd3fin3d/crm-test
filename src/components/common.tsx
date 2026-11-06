import { STATUS_LABEL, type Status } from '../lib/types';

export const StatusBadge = ({ status }: { status: Status }) => (
  <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
);
export const ErrorText = ({ text }: { text: string }) => (text ? <p className="error">{text}</p> : null);
