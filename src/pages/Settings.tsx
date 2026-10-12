import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Copy } from 'lucide-react';
import { authMessage, useAuth } from '../state/auth';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { download, isBackup, loadsCsv, sessionsCsv } from '../lib/export';
import { appBaseUrl, fmtDate } from '../lib/util';
import { NbImportButton } from '../components/NbImport';
import { localDate, programStart } from '../lib/report';
import { Card, PageHeader, Segmented } from '../components/ui';

export type Theme = 'light' | 'dark';
const THEME_KEY = 'diario.theme';

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === 'light') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
}

function Account() {
  const auth = useAuth();
  const ui = useUi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      ui.toast(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!auth.enabled) {
    return (
      <Card title="Cuenta">
        <p className="card-sub">Esta versión no tiene la nube configurada; los datos se guardan solo en este navegador.</p>
      </Card>
    );
  }
  if (auth.user) {
    return (
      <Card title="Cuenta">
        <p className="card-sub">
          Sesión iniciada como <b>{auth.user.email ?? auth.user.name}</b>. Los datos se sincronizan entre tus dispositivos.
        </p>
        <button className="btn block" onClick={() => run(auth.signOut)} disabled={busy}>
          Cerrar sesión
        </button>
      </Card>
    );
  }
  return (
    <Card title="Cuenta" sub="Usa la misma cuenta que en la versión anterior de la app.">
      <button className="btn block" onClick={() => run(auth.signInGoogle)} disabled={busy}>
        Continuar con Google
      </button>
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => (creating ? auth.signUpEmail(email, password) : auth.signInEmail(email, password)));
        }}
      >
        <input type="email" autoComplete="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn primary block" type="submit" disabled={busy}>
          {creating ? 'Crear cuenta' : 'Iniciar sesión'}
        </button>
      </form>
      <div className="auth-links">
        <button className="link-btn" onClick={() => setCreating((c) => !c)}>
          {creating ? 'Ya tengo cuenta' : 'Crear cuenta con correo'}
        </button>
        {!creating && (
          <button
            className="link-btn"
            onClick={() =>
              run(async () => {
                await auth.resetPassword(email);
                ui.toast('Te he enviado un correo para cambiar la contraseña.');
              })
            }
          >
            He olvidado la contraseña
          </button>
        )}
      </div>
    </Card>
  );
}

export default function Settings() {
  const { data, mode, syncError, replaceAll, saveConfig } = useData();
  const ui = useUi();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = appBaseUrl();

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* sin almacenamiento: el tema dura hasta cerrar */
    }
  }, [theme]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      ui.toast('Enlace copiado.');
    } catch {
      ui.toast('No se pudo copiar; mantén pulsado el enlace para copiarlo.');
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  const restore = async (file: File) => {
    try {
      const j = JSON.parse(await file.text());
      if (!isBackup(j)) {
        ui.toast('Ese archivo no es una copia de esta app.');
        return;
      }
      const ok = await ui.confirm({
        title: '¿Restaurar la copia?',
        message: `Se sustituirán tus ${data.entries.length} sesiones actuales por las ${j.entries.length} de la copia.`,
        confirmLabel: 'Restaurar',
        danger: true,
      });
      if (!ok) return;
      await replaceAll({ ...j, loads: j.loads ?? [] });
      ui.toast('Copia restaurada.');
    } catch {
      ui.toast('No se pudo leer el archivo.');
    }
  };

  return (
    <div className="page">
      <PageHeader title="Ajustes" />

      <Account />
      {syncError && mode === 'cloud' && <p className="hint warn">Problema al sincronizar: {syncError}</p>}

      <Card
        title="Nivel Bestia"
        sub={
          data.config.nbImportedAt
            ? `Última importación: ${fmtDate(data.config.nbImportedAt)}${data.config.nbBackupAt ? ` (copia del ${fmtDate(new Date(data.config.nbBackupAt).getTime())})` : ''}. ${data.loads.length} entrenamientos guardados.`
            : 'Trae las cargas de todos tus entrenamientos y los días de tu rutina desde la copia de Nivel Bestia (Ajustes → Guardar copia).'
        }
      >
        <NbImportButton label={data.config.nbImportedAt ? 'Importar copia nueva' : 'Importar de Nivel Bestia'} />
        <p className="hint">Solo se leen las series y la rutina. El resto de la copia (peso corporal, fecha de nacimiento, puntos…) no se guarda.</p>
      </Card>

      <Link to="/ajustes/dias" className="card row-link">
        <div>
          <h2 className="h3">Días de la rutina</h2>
          <p className="card-sub">
            {data.config.days.length ? `${data.config.days.length} días: ${data.config.days.map((d) => d.name).join(', ')}` : 'Sin configurar'}
          </p>
        </div>
        <ChevronRight size={20} />
      </Link>

      <Card title="Programa de 6 semanas" sub="La semana 1 empieza el lunes de la fecha que elijas. Si no eliges ninguna, se toma la semana del primer cuestionario.">
        <label className="field">
          <span className="field-label">Inicio del programa</span>
          <input
            type="date"
            value={localDate(programStart(data.config, data.entries, Date.now()))}
            onChange={(e) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) void saveConfig({ ...data.config, programStart: e.target.value });
            }}
          />
        </label>
      </Card>

      <Card title="Abrir con el Botón de Acción" sub="Para que al terminar en Nivel Bestia baste con pulsar el botón lateral del iPhone.">
        <div className="copy-row">
          <code>{url}</code>
          <button className="icon-btn" onClick={copy} aria-label="Copiar enlace">
            <Copy size={18} />
          </button>
        </div>
        <ol className="steps">
          <li>Copia el enlace de arriba.</li>
          <li>
            Abre <b>Atajos</b> → <b>+</b> → <b>Añadir acción</b> → busca <b>Abrir URL</b>. Pega el enlace en la acción.
          </li>
          <li>Pon de nombre al atajo «Diario gym» y guárdalo.</li>
          <li>
            Ve a <b>Ajustes</b> del iPhone → <b>Botón de Acción</b> → desliza hasta <b>Atajo</b> → elige «Diario gym».
          </li>
        </ol>
        <p className="hint">Si ya usas el Botón de Acción para otra cosa, puedes añadir el atajo a la pantalla de inicio desde el propio atajo (Compartir → Añadir a pantalla de inicio).</p>
      </Card>

      <Card title="Datos" sub="CSV con «;» y coma decimal: se abre directo en Excel en español y en R con read.csv2.">
        <div className="btn-grid">
          <button className="btn" disabled={!data.entries.length} onClick={() => download(`sesiones-${stamp}.csv`, sessionsCsv(data.entries), 'text/csv;charset=utf-8')}>
            Sesiones (CSV)
          </button>
          <button className="btn" disabled={!data.entries.length} onClick={() => download(`cargas-${stamp}.csv`, loadsCsv(data.entries), 'text/csv;charset=utf-8')}>
            Cargas (CSV)
          </button>
          <button className="btn" onClick={() => download(`diario-copia-${stamp}.json`, JSON.stringify(data, null, 1), 'application/json')}>
            Guardar copia
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Restaurar copia
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void restore(f);
          }}
        />
      </Card>

      <Card title="Apariencia">
        <Segmented<Theme>
          label="Tema"
          options={[
            { id: 'light', label: 'Claro' },
            { id: 'dark', label: 'Oscuro' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </Card>
    </div>
  );
}
