import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth';
import { ErrorText } from '../components/common';

export default function Login() {
  const { session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [err, setErr] = useState('');

  if (session) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr('Неверный email или пароль');
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Вход</h1>
      <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" required placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
      <ErrorText text={err} />
      <button type="submit">Войти</button>
    </form>
  );
}
