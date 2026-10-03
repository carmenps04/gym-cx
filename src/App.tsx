import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Dumbbell, Settings as Gear, TrendingUp, User } from 'lucide-react';
import { useData } from './state/data';
import Train from './pages/Train';
import Progress from './pages/Progress';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import RoutineWizard from './pages/RoutineWizard';
import RoutineView from './pages/RoutineView';
import DayPicker from './pages/DayPicker';
import Picker from './pages/Picker';
import ExercisePage from './pages/ExercisePage';
import Session from './pages/Session';

function Tabs() {
  const items = [
    { to: '/progreso', label: 'Progreso', icon: TrendingUp },
    { to: '/entrenar', label: 'Entrenamiento', icon: Dumbbell },
    { to: '/perfil', label: 'Perfil', icon: User },
    { to: '/ajustes', label: 'Ajustes', icon: Gear },
  ];
  return (
    <nav className="tabs" aria-label="Secciones">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Shell() {
  return (
    <div className="app has-tabs">
      <main className="main">
        <Outlet />
      </main>
      <Tabs />
    </div>
  );
}

function Plain() {
  return (
    <div className="app">
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
    useEffect(() => {
     window.scrollTo(0, 0);
   }, [pathname]);
  return null;
}

export default function App() {
  const { data, ready } = useData();
  const theme = data.meta.settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  if (!ready) return <div className="splash" role="status">Cargando…</div>;

  return (
    <>
      <ScrollTop />
      <Routes>
        <Route element={<Shell />}>
          <Route path="/entrenar" element={<Train />} />
          <Route path="/progreso" element={<Progress />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/ajustes" element={<Settings />} />
        </Route>
        <Route element={<Plain />}>
          <Route path="/rutina/nueva" element={<RoutineWizard />} />
          <Route path="/rutina/:rid" element={<RoutineView />} />
          <Route path="/rutina/:rid/editar" element={<RoutineWizard />} />
          <Route path="/rutina/:rid/entrenar" element={<DayPicker />} />
          <Route path="/explorar" element={<Picker />} />
          <Route path="/ejercicio/:eid" element={<ExercisePage />} />
          <Route path="/sesion/:rid/:did" element={<Session />} />
        </Route>
        <Route path="*" element={<Navigate to="/entrenar" replace />} />
      </Routes>
    </>
  );
}
