import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { BarChart3, Home as HomeIcon, Settings as Gear } from 'lucide-react';
import { useData } from './state/data';
import { localDate } from './lib/report';
import Home from './pages/Home';
import EntryForm from './pages/EntryForm';
import Knee24 from './pages/Knee24';
import Report from './pages/Report';
import Settings, { applyTheme, readTheme } from './pages/Settings';
import DaysEditor from './pages/DaysEditor';

function Tabs() {
  const items = [
    { to: '/inicio', label: 'Inicio', icon: HomeIcon },
    { to: '/informe', label: 'Informe', icon: BarChart3 },
    { to: '/ajustes', label: 'Ajustes', icon: Gear },
  ];
  return (
    <nav className="tabs" aria-label="Secciones">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
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

/** Una instancia nueva del formulario por sesión, para no arrastrar el borrador de otra. */
function EditEntry() {
  const { id } = useParams();
  return <EntryForm key={id} />;
}

/**
 * Al abrir la app: si no hay sesión registrada hoy, directamente el cuestionario; si ya la hay, el informe.
 * La primera vez (sin días de rutina) va a la pantalla de bienvenida.
 */
function Start() {
  const { data } = useData();
  if (data.config.days.length === 0) return <Navigate to="/inicio" replace />;
  const today = localDate(Date.now());
  const done = data.entries.some((e) => localDate(e.at) === today);
  return <Navigate to={done ? '/informe' : '/nueva'} replace />;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const { ready } = useData();

  useEffect(() => {
    applyTheme(readTheme());
  }, []);

  if (!ready) return <div className="splash" role="status">Cargando…</div>;

  return (
    <>
      <ScrollTop />
      <Routes>
        <Route element={<Shell />}>
          <Route path="/inicio" element={<Home />} />
          <Route path="/informe" element={<Report />} />
          <Route path="/ajustes" element={<Settings />} />
        </Route>
        <Route element={<Plain />}>
          <Route path="/nueva" element={<EntryForm />} />
          <Route path="/sesion/:id" element={<EditEntry />} />
          <Route path="/rodilla/:id" element={<Knee24 />} />
          <Route path="/ajustes/dias" element={<DaysEditor />} />
        </Route>
        <Route path="/" element={<Start />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
