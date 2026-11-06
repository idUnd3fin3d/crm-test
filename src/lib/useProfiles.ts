import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

export function useProfiles() {
  const [map, setMap] = useState<Record<string, Profile>>({});

  useEffect(() => {
    supabase.from('profiles').select('*').then(({ data }) =>
      setMap(Object.fromEntries((data ?? []).map((p) => [p.id, p as Profile]))));
  }, []);
  
  return map;
}
