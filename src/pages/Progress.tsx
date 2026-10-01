import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { BarChart, LineChart } from '../components/charts';
import { Empty, PageHeader, Segmented } from '../components/ui';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { cardioById, useExercises } from '../lib/catalog';
import { bestByExercise, exerciseSeries, sessionSetCount, sessionVolume, trainedDays, weekStreak, weeklyBuckets } from '../lib/stats';
import { addDays, fmtNum, formatMinutes, isoDate, kgToUnit, startOfWeek } from '../lib/util';

type Metric = 'peso' | '1rm';

export default function Progress() {
  const { data, deleteSession } = useData();
  const ui = useUi();
  const { byId } = useExercises();
  const { sessions, meta } = data;
  const units = meta.settings.units;
  const goal = meta.profile.weeklyGoal;
  const now = useMemo(() => new Date(), []);

  const buckets = useMemo(() => weeklyBuckets(sessions, 8, now), [sessions, now]);
  const thisWeek = buckets[buckets.length - 1].sessions;
  const streak = weekStreak(sessions, goal, now);
  const month = now.getMonth();
  const monthVolume = sessions.filter((s) => new Date(s.endedAt).getMonth() === month && new Date(s.endedAt).getFullYear() === now.getFullYear()).reduce((a, s) => a + sessionVolume(s), 0);

  const trained = useMemo(() => trainedDays(sessions), [sessions]);
  const first = addDays(startOfWeek(now), -7 * 11);
  const cells = Array.from({ length: 12 * 7 }, (_, i) => addDays(first, i));

  const bests = useMemo(() => bestByExercise(sessions).sort((a, b) => b.sessions - a.sessions || b.maxWeight - a.maxWeight), [sessions]);
  const [sel, setSel] = useState<string>('');
  const selected = sel && bests.some((b) => b.exerciseId === sel) ? sel : (bests[0]?.exerciseId ?? '');
  const [metric, setMetric] = useState<Metric>('peso');
  const series = useMemo(() => (selected ? exerciseSeries(sessions, selected) : []), [sessions, selected]);

  const weights = [...meta.weights].sort((a, b) => a.date.localeCompare(b.date));
  const sortedSessions = [...sessions].sort((a, b) => b.endedAt - a.endedAt);
  const nameOf = (id: string) => byId.get(id)?.n ?? '…';

  return (
    <>
      <PageHeader title="Progreso" />

      <section className="tiles">
        <div className="tile">
          <b>
            {thisWeek}
            <small> / {goal}</small>
          </b>
          <span>entrenos esta semana</span>
        </div>
        <div className="tile">
          <b>{streak}</b>
          <span>{streak === 1 ? 'semana seguida' : 'semanas seguidas'} cumpliendo el objetivo</span>
        </div>
        <div className="tile">
          <b>
            {fmtNum(kgToUnit(monthVolume, units))}
            <small> {units}</small>
          </b>
          <span>levantados este mes</span>
        </div>
        <div className="tile">
          <b>{sessions.length}</b>
          <span>entrenos en total</span>
        </div>
      </section>

      {sessions.length === 0 ? (
        <Empty title="Todavía no hay entrenamientos" text="Cuando termines tu primer entrenamiento verás aquí tu evolución, tus récords y tu historial." action={<Link className="btn primary" to="/entrenar">Ir a Entrenamiento</Link>} />
      ) : (
        <>
          <section className="card">
            <h2 className="h3">Últimas 12 semanas</h2>
            <div className="heat" role="img" aria-label={`${[...trained].filter((d) => d >= isoDate(first)).length} días entrenados en las últimas 12 semanas`}>
              {cells.map((d) => {
                const key = isoDate(d);
                return <i key={key} title={d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} className={`${trained.has(key) ? 'on' : ''}${d > now ? ' future' : ''}`} />;
              })}
            </div>
          </section>

          <section className="card">
            <h2 className="h3">Volumen semanal</h2>
            <p className="muted small">Peso total levantado (series × repeticiones × peso), en {units}.</p>
            <BarChart data={buckets.map((b) => ({ label: b.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' }), value: Math.round(kgToUnit(b.volume, units)) }))} />
          </section>

          {bests.length > 0 && (
            <section className="card">
              <h2 className="h3">Evolución por ejercicio</h2>
              <label className="field">
                <span>Ejercicio</span>
                <select className="input" value={selected} onChange={(e) => setSel(e.target.value)}>
                  {bests.map((b) => (
                    <option key={b.exerciseId} value={b.exerciseId}>
                      {nameOf(b.exerciseId)} ({b.sessions})
                    </option>
                  ))}
                </select>
              </label>
              <Segmented<Metric> label="Métrica" value={metric} onChange={setMetric} options={[{ id: 'peso', label: 'Peso máximo' }, { id: '1rm', label: '1RM estimado' }]} />
              <LineChart unit={units} points={series.map((s) => ({ x: s.date, y: kgToUnit(metric === 'peso' ? s.maxWeight : s.best1rm, units) }))} />
              {series.length === 1 && <p className="hint">Con un solo entrenamiento aún no hay evolución que mostrar.</p>}
              {metric === '1rm' && <p className="hint">El 1RM se estima con la fórmula de Epley y pierde precisión por encima de unas 12 repeticiones.</p>}
            </section>
          )}

          {bests.length > 0 && (
            <section className="card">
              <h2 className="h3">Mejores marcas</h2>
              <ul className="plain">
                {[...bests].sort((a, b) => b.maxWeight - a.maxWeight).slice(0, 8).map((b) => (
                  <li className="split" key={b.exerciseId}>
                    <span>{nameOf(b.exerciseId)}</span>
                    <b>{fmtNum(kgToUnit(b.maxWeight, units))} {units}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="card">
        <h2 className="h3">Peso corporal</h2>
        {weights.length >= 2 ? (
          <LineChart unit={units} points={weights.map((w) => ({ x: new Date(w.date + 'T12:00:00').getTime(), y: kgToUnit(w.kg, units) }))} />
        ) : (
          <p className="muted">Registra tu peso en <Link to="/perfil" className="link">Perfil</Link> al menos dos veces para ver la evolución.</p>
        )}
      </section>

      {sortedSessions.length > 0 && (
        <section className="card">
          <h2 className="h3">Historial</h2>
          <ul className="history">
            {sortedSessions.map((s) => (
              <li key={s.id}>
                <details>
                  <summary>
                    <span className="hist-main">
                      <b>{s.dayName}</b>
                      <small>{s.routineName}</small>
                    </span>
                    <span className="hist-meta">
                      <b>{new Date(s.endedAt).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
                      <small>
                        {formatMinutes((s.endedAt - s.startedAt) / 1000)}, {sessionSetCount(s)} series
                      </small>
                    </span>
                  </summary>
                  <ul className="hist-detail">
                    {s.entries.map((e) =>
                      e.kind === 'strength' ? (
                        <li key={e.itemId}>
                          <b>{nameOf(e.exerciseId)}</b>
                          <span>{e.sets.map((x) => `${fmtNum(kgToUnit(x.weight, units))} ${units} × ${x.reps}`).join(', ')}</span>
                        </li>
                      ) : (
                        <li key={e.itemId}>
                          <b>{cardioById(e.cardioId)?.name ?? 'Cardio'}</b>
                          <span>
                            {e.minutes} min{e.distanceKm ? `, ${fmtNum(e.distanceKm)} km` : ''}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                  <button
                    className="btn danger-text sm"
                    onClick={async () => {
                      if (await ui.confirm({ title: 'Eliminar entrenamiento', message: 'Se borrará del historial y de tus estadísticas.', confirmLabel: 'Eliminar', danger: true })) await deleteSession(s.id);
                    }}
                  >
                    <Trash2 size={14} /> Eliminar este entrenamiento
                  </button>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
