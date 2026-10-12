import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronRight, ClipboardCheck } from 'lucide-react';
import { useData } from '../state/data';
import { useAuth } from '../state/auth';
import { H24_OPEN_AFTER, pending24h, sortByDate, suggestDay } from '../lib/report';
import { fmtDate, fmtTime } from '../lib/util';
import { calendarLinkFor } from '../lib/calendar';
import { NbImportButton } from '../components/NbImport';

export default function Home() {
  const { data, mode } = useData();
  const auth = useAuth();
  const now = Date.now();
  const { due, waiting } = pending24h(data.entries, now);
  const recent = sortByDate(data.entries).reverse().slice(0, 8);
  const next = suggestDay(data.config, data.entries);
  const noDays = data.config.days.length === 0;

  return (
    <div className="page">
      <header className="home-header">
        <h1>Diario de sesiones</h1>
        <p className="muted">{fmtDate(now)}</p>
      </header>

      {auth.enabled && mode === 'local' && (
        <Link to="/ajustes" className="banner">
          <span>
            <b>Inicia sesión para no perder datos.</b> Sin cuenta, todo se guarda solo en este navegador y Safari puede borrarlo.
          </span>
          <ChevronRight size={18} />
        </Link>
      )}

      {due.map((e) => (
        <Link key={e.id} to={`/rodilla/${e.id}`} className="card due">
          <div>
            <span className="eyebrow">Pendiente</span>
            <h2 className="h3">¿Qué tal la rodilla hoy?</h2>
            <p className="card-sub">
              Dolor a las 24 h de {e.dayName} ({fmtDate(e.at)})
            </p>
          </div>
          <ChevronRight size={20} />
        </Link>
      ))}

      {noDays ? (
        <section className="card hero">
          <h2>Primer paso</h2>
          <p>
            Trae tu rutina y tus cargas de Nivel Bestia: allí, <b>Ajustes → Guardar copia</b>; aquí, importa el archivo que se descarga.
          </p>
          <NbImportButton />
          <Link className="btn block ghost" to="/ajustes/dias">
            Prefiero apuntar los días a mano
          </Link>
        </section>
      ) : (
        <section className="card hero">
          <h2>¿Has terminado de entrenar?</h2>
          {next && <p>Toca {next.name}. Si has hecho otro día, lo cambias dentro.</p>}
          <Link className="btn primary block big" to="/nueva">
            <ClipboardCheck size={20} /> Registrar sesión
          </Link>
        </section>
      )}

      {waiting.map((e) => (
        <div key={e.id} className="card waiting">
          <p>
            La pregunta de 24 h de <b>{e.dayName}</b> se abre mañana a partir de las {fmtTime(e.at + H24_OPEN_AFTER)}.
          </p>
          <a className="link-btn" href={calendarLinkFor(e)} target="_blank" rel="noreferrer">
            <CalendarPlus size={16} /> Aviso en Google Calendar
          </a>
        </div>
      ))}

      {recent.length > 0 && (
        <section className="list-section">
          <h2 className="h3 section-title">Últimas sesiones</h2>
          <ul className="list">
            {recent.map((e) => (
              <li key={e.id}>
                <Link to={`/sesion/${e.id}`} className="list-item">
                  <div>
                    <b>{e.dayName}</b>
                    <span className="muted"> · {fmtDate(e.at)}</span>
                    <div className="list-meta">
                      Rodilla {e.kneeDuring ?? '—'} → {e.knee24h ?? '?'}
                      {e.treadmill.done && ' · cinta'}
                      {e.dayFeel != null && ` · sensación ${e.dayFeel}/5`}
                    </div>
                  </div>
                  <ChevronRight size={18} className="muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
