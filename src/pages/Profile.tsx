import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { NumInput, PageHeader, Segmented, Stepper } from '../components/ui';
import { useData } from '../state/data';
import { authMessage, useAuth } from '../state/auth';
import { useUi } from '../state/ui';
import type { Goal, Level } from '../types';
import { fmtNum, isoDate, kgToUnit, unitToKg } from '../lib/util';

const GOALS: { id: Goal; label: string }[] = [
  { id: 'muscle', label: 'Ganar músculo' },
  { id: 'fat', label: 'Perder grasa' },
  { id: 'strength', label: 'Ganar fuerza' },
  { id: 'health', label: 'Salud general' },
];
const LEVELS: { id: Level; label: string }[] = [
  { id: 'beginner', label: 'Principiante' },
  { id: 'intermediate', label: 'Intermedio' },
  { id: 'advanced', label: 'Avanzado' },
];

function Account() {
  const auth = useAuth();
  const ui = useUi();
  const { mode, syncError } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!auth.enabled) {
    return (
      <section className="card">
        <h2 className="h3">Cuenta</h2>
        <p className="muted">Estás en modo local: tus datos se guardan solo en este navegador. Para sincronizarlos entre dispositivos hay que conectar Firebase (los pasos están en el README).</p>
      </section>
    );
  }
  if (auth.user) {
    return (
      <section className="card">
        <h2 className="h3">Cuenta</h2>
        <p>
          Sesión iniciada como <b>{auth.user.email ?? auth.user.name}</b>.
        </p>
        <p className="muted">{mode === 'cloud' ? 'Tus rutinas y entrenamientos se sincronizan con la nube.' : 'Conectando…'}</p>
        {syncError && <p className="error" role="alert">Error de sincronización: {syncError}</p>}
        <button className="btn block" onClick={() => run(auth.signOut)} disabled={busy}>
          Cerrar sesión
        </button>
      </section>
    );
  }
  return (
    <section className="card">
      <h2 className="h3">Cuenta</h2>
      <p className="muted">Sin cuenta, tus datos se quedan en este dispositivo. Con cuenta se guardan en la nube y los tienes en cualquier móvil u ordenador.</p>
      <button className="btn block" onClick={() => run(auth.signInGoogle)} disabled={busy}>
        Continuar con Google
      </button>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => (creating ? auth.signUpEmail(email, password) : auth.signInEmail(email, password)));
        }}
      >
        <label className="field">
          <span>Correo electrónico</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input className="input" type="password" autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block" type="submit" disabled={busy}>
          {creating ? 'Crear cuenta' : 'Iniciar sesión'}
        </button>
      </form>
      <div className="row between">
        <button className="link" onClick={() => setCreating((c) => !c)}>
          {creating ? 'Ya tengo cuenta' : 'Crear una cuenta'}
        </button>
        {!creating && (
          <button
            className="link"
            onClick={() =>
              email.trim()
                ? run(async () => {
                    await auth.resetPassword(email);
                    ui.toast('Te hemos enviado un correo para restablecer la contraseña.');
                  })
                : setError('Escribe tu correo para recuperar la contraseña.')
            }
          >
            Olvidé mi contraseña
          </button>
        )}
      </div>
    </section>
  );
}

export default function Profile() {
  const { data, updateMeta } = useData();
  const { profile, settings, weights } = data.meta;
  const units = settings.units;
  const [name, setName] = useState(profile.name);
  const [height, setHeight] = useState(profile.heightCm ?? 0);
  const [weightInput, setWeightInput] = useState(0);

  useEffect(() => setName(profile.name), [profile.name]);
  useEffect(() => setHeight(profile.heightCm ?? 0), [profile.heightCm]);

  const patchProfile = (patch: Partial<typeof profile>) => updateMeta((m) => ({ ...m, profile: { ...m.profile, ...patch } }));
  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));

  const addWeight = async () => {
    if (weightInput <= 0) return;
    const date = isoDate(new Date());
    const kg = unitToKg(weightInput, units);
    await updateMeta((m) => ({ ...m, weights: [...m.weights.filter((w) => w.date !== date), { date, kg }] }));
    setWeightInput(0);
  };

  return (
    <>
      <PageHeader title="Perfil" />
      <div className="avatar" aria-hidden="true">
        {(profile.name.trim()[0] ?? '?').toUpperCase()}
      </div>

      <section className="card">
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name !== profile.name && patchProfile({ name: name.trim() })} />
        </label>
        <label className="field">
          <span>Altura (cm)</span>
          <NumInput label="Altura en centímetros" className="input" value={height} onChange={setHeight} step="1" />
        </label>
        <div className="row">
          <button className="btn" onClick={() => height !== (profile.heightCm ?? 0) && patchProfile({ heightCm: height > 0 ? Math.round(height) : undefined })}>
            Guardar altura
          </button>
        </div>
        <label className="field">
          <span>Objetivo</span>
          <select className="input" value={profile.goal ?? ''} onChange={(e) => patchProfile({ goal: (e.target.value || undefined) as Goal | undefined })}>
            <option value="">Sin definir</option>
            {GOALS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field-label">Nivel</div>
        <Segmented<Level | 'none'> label="Nivel" value={profile.level ?? 'none'} onChange={(v) => patchProfile({ level: v === 'none' ? undefined : v })} options={[{ id: 'none', label: 'Sin definir' }, ...LEVELS]} />
        <div className="split gap-top">
          <span>Entrenos por semana (objetivo)</span>
          <Stepper label="entrenos por semana" value={profile.weeklyGoal} min={1} max={7} onChange={(n) => patchProfile({ weeklyGoal: n })} />
        </div>
      </section>

      <section className="card">
        <h2 className="h3">Peso corporal</h2>
        <div className="row">
          <div className="input-suffix grow">
            <NumInput label={`Peso de hoy en ${units}`} className="input" value={weightInput} onChange={setWeightInput} />
            <span>{units}</span>
          </div>
          <button className="btn primary" onClick={addWeight} disabled={weightInput <= 0}>
            Registrar hoy
          </button>
        </div>
        {sorted.length > 0 && (
          <ul className="plain">
            {sorted.slice(0, 6).map((w) => (
              <li className="split" key={w.date}>
                <span>{new Date(w.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span className="row">
                  <b>
                    {fmtNum(kgToUnit(w.kg, units))} {units}
                  </b>
                  <button className="icon-btn sm" aria-label="Eliminar registro" onClick={() => updateMeta((m) => ({ ...m, weights: m.weights.filter((x) => x.date !== w.date) }))}>
                    <Trash2 size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Account />
    </>
  );
}
