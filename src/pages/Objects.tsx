import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import ObjectForm from '../components/ObjectForm';
import type { SObject } from '../lib/types';

export default function Objects() {
  const { profile } = useAuth();

  const [items, setItems] = useState<SObject[]>([]);

  const load = useCallback(() => {
    supabase.from('objects').select('*').order('name').then(({ data }) => setItems((data ?? []) as SObject[]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <h1>Объекты</h1>
      {profile?.role === 'manager' && <ObjectForm onDone={load} />}
      {items.length === 0 && <p className="muted">Объектов пока нет.</p>}
      {items.map((o) => (
        <Link key={o.id} to={`/objects/${o.id}`} className="card link">
          <strong>{o.name}</strong><span className="muted">{o.address}</span>
        </Link>
      ))}
    </>
  );
}
