import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { ErrorText } from './common';
import type { SObject } from '../lib/types';

interface Props {
  object?: SObject;
  onDone: () => void;
  onCancel?: () => void;
}

export default function ObjectForm({ object, onDone, onCancel }: Props) {
  const [name, setName] = useState(object?.name ?? '');
  const [address, setAddress] = useState(object?.address ?? '');
  const [err, setErr] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    setErr('');
    const { error } = object
      ? await supabase.from('objects').update({ name, address }).eq('id', object.id)
      : await supabase.from('objects').insert({ name, address });

    if (error) {
      setErr(error.message);
    } else {
      if (!object) {
        setName('');
        setAddress('');
      }

      onDone();
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <input required placeholder="Название" value={name} onChange={(e) => setName(e.target.value)} />
      <input required placeholder="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} />
      <ErrorText text={err} />
      <div className="row">
        <button type="submit">{object ? 'Сохранить' : 'Создать объект'}</button>
        {onCancel && <button type="button" className="ghost" onClick={onCancel}>Отмена</button>}
      </div>
    </form>
  );
}
