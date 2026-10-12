import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarPlus, Check } from 'lucide-react';
import { useData } from '../state/data';
import {
  STALL_SESSIONS,
  feelSummary,
  inRange,
  kneeSummary,
  loadSessions,
  mean,
  programStart,
  progressInWindow,
  treadmillSummary,
  weekRanges,
  weekStats,
  wellSummary,
} from '../lib/report';
import type { LoadStatus, WindowProgress } from '../lib/report';
import type { TreadmillRating } from '../types';
import { calendarLinkFor } from '../lib/calendar';
import { fmtDate, fmtLoad, fmtNum, fmtShort } from '../lib/util';
import { Empty, PageHeader, Stat } from '../components/ui';
import { BarChart, DeltaBars, LineChart, MeterRow, StackedBars } from '../components/charts';
import type { DeltaItem } from '../components/charts';

type Sel = number | 'todo';

const STATUS_LABEL: Record<LoadStatus, string> = {
  progresa: 'Sube',
  mantiene: 'Igual',
  baja: 'Baja',
  estancado: 'Estancado',
  pocos: 'Sin referencia',
};

const RATING: { id: TreadmillRating; label: string; color: string }[] = [
  { id: 'poco', label: 'Poco exigente', color: 'var(--c3)' },
  { id: 'bien', label: 'Bien', color: 'var(--accent)' },
  { id: 'mucho', label: 'Demasiado', color: 'var(--c2)' },
];

const f1 = (n: number | null) => fmtNum(n == null ? null : Math.round(n * 10) / 10);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function rangeText(from: number, to: number): string {
  const a = new Date(from);
  const b = new Date(to - 1);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** Comparación con la semana anterior en palabras, p. ej. « Baja 0,8 respecto a la semana 1 (4,2).» */
function versus(what: string, cur: number | null, prev: number | null, prevLabel: string): string {
  if (cur == null || prev == null || !prevLabel) return '';
  const d = cur - prev;
  const lead = what ? `${what}: ` : '';
  const cap = (t: string) => (what ? t : t.charAt(0).toUpperCase() + t.slice(1));
  if (Math.abs(d) < 0.25) return ` ${lead}${cap('prácticamente igual')} que en ${prevLabel} (${f1(prev)}).`;
  return ` ${lead}${cap(d > 0 ? 'sube' : 'baja')} ${f1(Math.abs(d))} respecto a ${prevLabel} (${f1(prev)}).`;
}

function Q({ n, title, answer, children }: { n: number; title: string; answer: ReactNode; children?: ReactNode }) {
  return (
    <section className="card q">
      <div className="q-head">
        <span className="q-n">{n}</span>
        <h2 className="h3">{title}</h2>
      </div>
      <p className="q-answer">{answer}</p>
      {children}
    </section>
  );
}

/** Cambio de cada ejercicio para la gráfica: en kg si cambió el peso; si no, en repeticiones. */
function deltaItem(p: WindowProgress): DeltaItem | null {
  if (p.status === 'pocos') return null;
  const { base, current } = p;
  let pct = 0;
  let text = '=';
  if (base.kg != null && current.kg != null && base.kg > 0 && Math.abs(current.kg - base.kg) > 1e-9) {
    pct = ((current.kg - base.kg) / base.kg) * 100;
    text = `${current.kg > base.kg ? '+' : '−'}${fmtNum(Math.abs(current.kg - base.kg))} kg`;
  } else if (base.reps != null && current.reps != null && base.reps > 0 && current.reps !== base.reps) {
    pct = ((current.reps - base.reps) / base.reps) * 100;
    text = `${current.reps > base.reps ? '+' : '−'}${Math.abs(current.reps - base.reps)} rep.`;
  }
  // El color sigue al estado (p. ej. un ejercicio puede subir respecto a la semana pasada y seguir sin superar su mejor marca).
  const tone = p.status === 'progresa' ? 'up' : p.status === 'baja' ? 'down' : p.status === 'estancado' ? 'stall' : 'flat';
  return { label: p.name, pct, text, tone };
}

export default function Report() {
  const { data } = useData();
  const location = useLocation();
  const savedId = (location.state as { saved?: string } | null)?.saved;
  const [now] = useState(Date.now);

  const start = programStart(data.config, data.entries, now);
  const weeks = useMemo(() => weekRanges(start, now), [start, now]);
  const currentWeek = weeks.find((w) => w.current);
  const [sel, setSel] = useState<Sel>(currentWeek ? currentWeek.n : 'todo');

  const week = sel === 'todo' ? null : weeks[sel - 1] ?? null;
  const from = week ? week.from : start;
  const to = week ? week.to : Math.max(weeks[weeks.length - 1].to, now + 1);
  const prevWeek = week && week.n > 1 ? weeks[week.n - 2] : null;
  const prevLabel = prevWeek ? `la semana ${prevWeek.n}` : '';

  const es = useMemo(() => inRange(data.entries, from, to), [data.entries, from, to]);
  const prevEs = useMemo(() => (prevWeek ? inRange(data.entries, prevWeek.from, prevWeek.to) : []), [data.entries, prevWeek]);
  const sessions = useMemo(() => loadSessions(data.entries, data.loads), [data.entries, data.loads]);
  const prog = useMemo(() => progressInWindow(sessions, from, to), [sessions, from, to]);
  const knee = useMemo(() => kneeSummary(es), [es]);
  const prevKnee = useMemo(() => kneeSummary(prevEs), [prevEs]);
  const well = useMemo(() => wellSummary(es, data.entries), [es, data.entries]);
  const prevWell = useMemo(() => wellSummary(prevEs, data.entries), [prevEs, data.entries]);
  const tm = useMemo(() => treadmillSummary(es), [es]);
  const feel = useMemo(() => feelSummary(es, data.config), [es, data.config]);
  const stats = useMemo(() => weekStats(data.entries, weeks), [data.entries, weeks]);
  const savedEntry = savedId ? data.entries.find((e) => e.id === savedId) : undefined;

  const tabs = (
    <div className="week-tabs" role="tablist" aria-label="Periodo del informe">
      {weeks.map((w) => (
        <button key={w.n} role="tab" aria-selected={sel === w.n} aria-label={`Semana ${w.n}`} title={rangeText(w.from, w.to)} disabled={w.future} className={`week-tab${sel === w.n ? ' on' : ''}${w.current ? ' now' : ''}`} onClick={() => setSel(w.n)}>
          <small>Sem.</small>
          <b>{w.n}</b>
        </button>
      ))}
      <button role="tab" aria-selected={sel === 'todo'} aria-label="Todo" className={`week-tab${sel === 'todo' ? ' on' : ''}`} onClick={() => setSel('todo')}>
        <small>Programa</small>
        <b>Todo</b>
      </button>
    </div>
  );

  const header = (
    <>
      <PageHeader title="Informe" sub={week ? `Semana ${week.n} · ${rangeText(week.from, week.to)}${week.current ? ' (esta semana)' : ''}` : `Todo el programa, desde el ${fmtDate(start)}`} />
      {savedEntry && (
        <section className="card saved-banner">
          <div className="saved-row">
            <span className="saved-check" aria-hidden="true">
              <Check size={18} strokeWidth={3} />
            </span>
            <b>Sesión de {savedEntry.dayName} guardada.</b>
          </div>
          <p className="card-sub">Mañana a esta hora toca el dolor a las 24 h. El aviso lleva el enlace directo a la pregunta.</p>
          <a className="btn block" href={calendarLinkFor(savedEntry)} target="_blank" rel="noreferrer">
            <CalendarPlus size={18} /> Añadir aviso a Google Calendar
          </a>
        </section>
      )}
      {tabs}
    </>
  );

  if (data.entries.length === 0 && sessions.length === 0) {
    return (
      <div className="page">
        {header}
        <Empty title="Aún no hay sesiones" text="El informe se rellena a medida que contestas el cuestionario después de entrenar." action={<Link className="btn primary" to="/nueva">Registrar sesión</Link>} />
      </div>
    );
  }

  const scope = week ? 'esta semana' : 'el programa';
  const noEntries = es.length === 0;
  const sessLabels = (xs: { at: number }[]) => xs.map((x) => fmtShort(x.at));
  const weekLabels = stats.map((s) => `S${s.n}`);

  // ---------------------------------------------------------------- 1. Cargas
  const by = (st: LoadStatus) => prog.filter((p) => p.status === st).map((p) => p.name);
  const deltas = prog
    .map(deltaItem)
    .filter((d): d is DeltaItem => d != null)
    .sort((a, b) => b.pct - a.pct);
  const loadAnswer =
    prog.length === 0 ? (
      `No hay cargas registradas en ${scope}. Se importan desde Nivel Bestia en el cuestionario.`
    ) : deltas.length === 0 ? (
      'Todos los ejercicios de este periodo son nuevos: hace falta otra sesión de cada uno para comparar.'
    ) : (
      <>
        {by('progresa').length ? <>Suben: <b>{list(by('progresa'))}</b>. </> : 'Ningún ejercicio sube. '}
        {by('estancado').length ? <>Estancados: <b>{list(by('estancado'))}</b>. </> : 'Ninguno estancado. '}
        {by('baja').length > 0 && <>Bajan: {list(by('baja'))}. </>}
        {by('mantiene').length > 0 && <>Igual que la vez anterior: {list(by('mantiene'))}.</>}
      </>
    );

  // ---------------------------------------------------------------- 2. Rodilla
  let kneeAnswer: string;
  if (knee.points.length === 0) {
    kneeAnswer = noEntries
      ? `Sin cuestionarios en ${scope}.`
      : data.config.days.some((d) => d.isLeg)
        ? `Todavía no hay sesiones de pierna en ${scope}.`
        : 'Ningún día de la rutina está marcado como pierna. Márcalo en Ajustes → Días de la rutina.';
  } else if (week) {
    kneeAnswer = `Media de las sesiones de pierna: ${f1(knee.avgSession)}/10 (durante ${f1(knee.avgDuring)}, a las 24 h ${f1(knee.avg24h)}).${versus('', knee.avgSession, prevKnee.avgSession, prevLabel)}`;
  } else {
    const ws = stats.filter((s) => s.knee != null);
    let evo = '';
    if (ws.length >= 2) {
      const d = ws[ws.length - 1].knee! - ws[0].knee!;
      evo = ` De la semana ${ws[0].n} (${f1(ws[0].knee)}) a la ${ws[ws.length - 1].n} (${f1(ws[ws.length - 1].knee)}) ${d <= -0.5 ? 'baja' : d >= 0.5 ? 'sube' : 'se mantiene'}.`;
    }
    kneeAnswer = `Media por sesión de pierna en todo el programa: ${f1(knee.avgSession)}/10.${evo}`;
  }

  // ---------------------------------------------------------------- 3. Bienestar
  const wellAnswer = noEntries
    ? `Sin cuestionarios en ${scope}.`
    : `Energía ${f1(well.avgEnergy)}/5, recuperación ${f1(well.avgRecovery)}/5 y sueño ${f1(well.avgSleepHours)} h con calidad ${f1(well.avgSleepQuality)}/5.` +
      (week ? versus('Energía', well.avgEnergy, prevWell.avgEnergy, prevLabel) + versus('Recuperación', well.avgRecovery, prevWell.avgRecovery, prevLabel) : '') +
      (well.lowSessions.length ? ` ${well.lowSessions.length} de ${well.points.length} sesiones con algún valor bajo (1 o 2).` : '');

  // ---------------------------------------------------------------- 4. Cinta
  const single = tm.sessions.length === 1 ? RATING.find((r) => r.id === tm.sessions[0].treadmill.rating) : undefined;
  const verdictText: Record<typeof tm.verdict, string> = {
    poco: 'La mayoría de las veces fue poco exigente.',
    bien: 'La mayoría de las veces se toleró bien.',
    mucho: 'La mayoría de las veces fue demasiado exigente.',
    mixto: 'Las valoraciones están repartidas; no hay una tendencia clara.',
    pocos: single ? `Una sola sesión de cinta, valorada como «${single.label.toLowerCase()}».` : 'Aún no hay suficientes valoraciones para concluir.',
  };
  const tmAnswer = tm.sessions.length
    ? `${verdictText[tm.verdict]} Media: ${f1(tm.avgMin)} min a ${f1(tm.avgSpeed)} km/h y ${f1(tm.avgIncline)} % de inclinación.`
    : `No hay sesiones con cinta en ${scope}.`;

  // ---------------------------------------------------------------- 5. Sensaciones
  const feelAnswer =
    feel.best && feel.worst ? (
      <>
        Más gustó <b>{feel.best.name}</b> ({f1(feel.best.avgFeel)}/5); menos, <b>{feel.worst.name}</b> ({f1(feel.worst.avgFeel)}/5).
      </>
    ) : noEntries ? (
      `Sin cuestionarios en ${scope}.`
    ) : (
      'Hacen falta al menos dos días distintos con notas diferentes para compararlos.'
    );

  return (
    <div className="page report">
      {header}

      <Q n={1} title="¿En qué ejercicios progresó la carga y en cuáles se estancó?" answer={loadAnswer}>
        {deltas.length > 0 && <DeltaBars items={deltas} label="Cambio de carga por ejercicio" />}
        {prog.length > 0 && (
          <details className="more">
            <summary>Detalle por ejercicio</summary>
            <ul className="list plain">
              {prog.map((p) => (
                <li key={p.name} className="load-row">
                  <div>
                    <b>{p.name}</b>
                    <div className="list-meta">
                      {p.status === 'pocos' ? (
                        fmtLoad(p.current.kg, p.current.reps)
                      ) : (
                        <>
                          {fmtLoad(p.base.kg, p.base.reps)} ({fmtShort(p.base.at)}) → {fmtLoad(p.current.kg, p.current.reps)} ({fmtShort(p.current.at)})
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`tag ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="method">
          {week ? 'Cada ejercicio se compara con la última vez que lo hiciste antes de esta semana. ' : 'Cada ejercicio se compara con la última vez antes de empezar el programa (o con la primera dentro de él). '}
          Cuenta la mejor serie: primero el peso y, con el mismo peso, las repeticiones. «Estancado» (naranja) = {STALL_SESSIONS} sesiones o más seguidas sin superar la mejor marca, aunque respecto a la vez anterior haya cambiado algo.
        </p>
      </Q>

      <Q n={2} title="¿Cómo evolucionó el dolor de rodilla?" answer={kneeAnswer}>
        {week && knee.points.length > 0 && (
          <BarChart
            label="Dolor de rodilla por sesión de pierna"
            labels={sessLabels(knee.points)}
            max={10}
            series={[
              { name: 'Durante', color: 'var(--c2)', values: knee.points.map((p) => p.during) },
              { name: 'A las 24 h', color: 'var(--c3)', values: knee.points.map((p) => p.h24) },
            ]}
          />
        )}
        {!week && stats.some((s) => s.knee != null) && (
          <LineChart
            label="Dolor de rodilla: media semanal de las sesiones de pierna"
            labels={weekLabels}
            min={0}
            max={10}
            series={[
              { name: 'Media', color: 'var(--accent)', values: stats.map((s) => s.knee) },
              { name: 'Durante', color: 'var(--c2)', values: stats.map((s) => s.kneeDuring), dashed: true },
              { name: 'A las 24 h', color: 'var(--c3)', values: stats.map((s) => s.knee24h), dashed: true },
            ]}
          />
        )}
        {knee.points.length > 0 && (
          <div className="stats">
            <Stat label="Durante" value={f1(knee.avgDuring)} />
            <Stat label="A las 24 h" value={f1(knee.avg24h)} />
            <Stat label="Días sin pierna" value={f1(knee.avgOther)} hint="para comparar" />
          </div>
        )}
        {knee.points.some((p) => p.during != null && p.h24 != null) && (
          <p className="note">
            {(() => {
              const both = knee.points.filter((p) => p.during != null && p.h24 != null).length;
              if (both === 1) return knee.worseNextDay ? 'En esta sesión dolió más a las 24 h que durante.' : 'En esta sesión no dolió más a las 24 h que durante.';
              return `En ${knee.worseNextDay} de ${both} sesiones dolió más a las 24 h que durante.`;
            })()}
          </p>
        )}
      </Q>

      <Q n={3} title="Energía, sueño y recuperación entre sesiones" answer={wellAnswer}>
        {week && well.points.length > 0 && (
          <>
            <LineChart
              label="Energía, recuperación y calidad del sueño por sesión"
              labels={sessLabels(well.points)}
              min={1}
              max={5}
              series={[
                { name: 'Energía', color: 'var(--accent)', values: well.points.map((p) => p.energy) },
                { name: 'Recuperación', color: 'var(--c2)', values: well.points.map((p) => p.recovery) },
                { name: 'Calidad del sueño', color: 'var(--c3)', values: well.points.map((p) => p.sleepQuality), dashed: true },
              ]}
            />
            <h3 className="chart-title">Horas de sueño la noche anterior</h3>
            <BarChart label="Horas de sueño por sesión" labels={sessLabels(well.points)} max={10} series={[{ name: 'Horas', color: 'var(--c3)', values: well.points.map((p) => p.sleepHours) }]} />
          </>
        )}
        {!week && stats.some((s) => s.sessions > 0) && (
          <>
            <LineChart
              label="Medias semanales de energía, recuperación y calidad del sueño"
              labels={weekLabels}
              min={1}
              max={5}
              series={[
                { name: 'Energía', color: 'var(--accent)', values: stats.map((s) => s.energy) },
                { name: 'Recuperación', color: 'var(--c2)', values: stats.map((s) => s.recovery) },
                { name: 'Calidad del sueño', color: 'var(--c3)', values: stats.map((s) => s.sleepQuality), dashed: true },
              ]}
            />
            <h3 className="chart-title">Horas de sueño (media semanal)</h3>
            <BarChart label="Horas de sueño por semana" labels={weekLabels} max={10} series={[{ name: 'Horas', color: 'var(--c3)', values: stats.map((s) => s.sleepHours) }]} />
          </>
        )}
        {(well.recoveryShortRest != null || well.recoveryLongRest != null) && (
          <div className="meters">
            <MeterRow label="Recuperación tras 0–1 días de descanso" value={well.recoveryShortRest} max={5} />
            <MeterRow label="Recuperación tras 2 o más días" value={well.recoveryLongRest} max={5} />
          </div>
        )}
      </Q>

      <Q n={4} title="¿La cinta se toleró bien o fue demasiado o poco exigente?" answer={tmAnswer}>
        {week && tm.sessions.length > 0 && (
          <>
            <h3 className="chart-title">Minutos de cinta por sesión, según exigencia</h3>
            <BarChart
              label="Minutos de cinta por sesión"
              labels={sessLabels(tm.sessions)}
              max={Math.max(30, ...tm.sessions.map((e) => e.treadmill.min ?? 0))}
              series={[{ name: 'Minutos', color: 'var(--muted)', values: tm.sessions.map((e) => e.treadmill.min) }]}
              colors={tm.sessions.map((e) => RATING.find((r) => r.id === e.treadmill.rating)?.color ?? 'var(--muted)')}
            />
            <div className="legend">
              {RATING.map((r) => (
                <span key={r.id}>
                  <i style={{ background: r.color }} />
                  {r.label}
                </span>
              ))}
            </div>
          </>
        )}
        {!week && stats.some((s) => s.treadmill.poco + s.treadmill.bien + s.treadmill.mucho > 0) && (
          <>
            <h3 className="chart-title">Valoraciones por semana</h3>
            <StackedBars label="Valoraciones de la cinta por semana" labels={weekLabels} stacks={RATING.map((r) => ({ name: r.label, color: r.color, values: stats.map((s) => s.treadmill[r.id]) }))} />
          </>
        )}
        {tm.knee24WithTreadmill != null && tm.knee24WithoutTreadmill != null && (
          <>
            <h3 className="chart-title">Dolor de rodilla a las 24 h, con y sin cinta</h3>
            <BarChart
              label="Dolor a las 24 h con y sin cinta"
              labels={['Con cinta', 'Sin cinta']}
              max={10}
              series={[{ name: 'Dolor', color: 'var(--c2)', values: [tm.knee24WithTreadmill, tm.knee24WithoutTreadmill] }]}
              colors={['var(--c2)', 'var(--muted)']}
              height={130}
            />
          </>
        )}
      </Q>

      <Q n={5} title="Sensaciones con cada día" answer={feelAnswer}>
        {feel.days.length > 0 && (
          <div className="meters">
            {feel.days.map((d) => (
              <MeterRow key={d.key} label={`${d.name}${d.sessions > 1 ? ` (${d.sessions})` : ''}`} value={d.avgFeel} max={5} />
            ))}
          </div>
        )}
        {feel.days.some((d) => d.notes.length) && (
          <ul className="list plain compact notes">
            {feel.days
              .flatMap((d) => d.notes.map((x) => ({ ...x, day: d.name })))
              .sort((a, b) => b.at - a.at)
              .slice(0, 6)
              .map((x) => (
                <li key={x.at}>
                  <span className="list-meta">
                    {fmtShort(x.at)} · {x.day}:
                  </span>{' '}
                  {x.text}
                </li>
              ))}
          </ul>
        )}
      </Q>

      {week && es.length > 0 && (
        <p className="hint center">
          {es.length} {es.length === 1 ? 'sesión registrada' : 'sesiones registradas'} esta semana · sensación media {f1(mean(es.map((e) => e.dayFeel)))}/5
        </p>
      )}
    </div>
  );
}
