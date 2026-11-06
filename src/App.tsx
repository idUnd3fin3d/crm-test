import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Objects from './pages/Objects';
import ObjectPage from './pages/ObjectPage';
import TaskPage from './pages/TaskPage';
import MyTasks from './pages/MyTasks';

function Layout() {
  const { session, profile, loading } = useAuth();

  if (loading) return <p className="muted">Загрузка…</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <p>Профиль не найден. Обратитесь к администратору.</p>;

  return (
    <>
      <nav>
        <Link to="/objects">Объекты</Link>
        {profile.role === 'executor' && <Link to="/my-tasks">Мои задачи</Link>}
        <span className="spacer" />
        <span className="muted">{profile.full_name}</span>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Выйти</button>
      </nav>
      <main><Outlet /></main>
    </>
  );
}

function Home() {
  const { profile } = useAuth();
  
  return <Navigate to={profile?.role === 'executor' ? '/my-tasks' : '/objects'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="/objects" element={<Objects />} />
            <Route path="/objects/:id" element={<ObjectPage />} />
            <Route path="/tasks/:id" element={<TaskPage />} />
            <Route path="/my-tasks" element={<MyTasks />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
