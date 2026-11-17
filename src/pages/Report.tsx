import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarPlus, Check, FileDown, Trash2 } from 'lucide-react';
import { dateStamp, usePdfExport } from '../components/PdfExport';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import {
  feelSummary,
  gainsInWindow,
  inRange,
  kneeSummary,
  loadSessions,
  programStart,
  progressInWindow,
  treadmillSummary,
  weekRanges,
  weekStats,
  wellSummary,
} from '../lib/report';
import type { Entry, LoadDay, TreadmillRating } from '../types';
import { calendarLinkFor } from '../lib/calendar';
import { fmtDate, fmtNum, fmtShort } from '../lib/util';
import { Empty, PageHeader, Stat } from '../components/ui';
import { buildSummary, gainRows } from '../lib/summary';
import { summarizeNotes } from '../lib/notes';
import { BarChart, LineChart, MeterRow, PASTEL, StackedBars } from '../components/charts';

type Sel = number | 'todo';

const RATING: { id: TreadmillRating; label: string; color: string }[] = [
  { id: 'poco', label: 'Poco exigente', color: 'var(--p-poco)' },
  { id: 'bien', label: 'Bien', color: 'var(--p-bien)' },
  { id: 'mucho', label: 'Demasiado', color: 'var(--p-mucho)' },
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

/** «long»: la pregunta puede ocupar más de una página (lista de ejercicios); en el PDF se parte entre filas. */
function Q({ n, title, answer, children, long }: { n: number; title: string; answer: ReactNode; children?: ReactNode; long?: boolean }) {
  return (
    <section className={`card q${long ? ' q-long' : ''}`}>
      <div className="q-head">
        <span className="q-n">{n}</span>
        <h2 className="h3">{title}</h2>
      </div>
      <p className="q-answer">{answer}</p>
      {children}
    </section>
  );
}

/** Sesiones de la semana elegida, con opción de borrar una o la semana entera (p. ej. pruebas). */
function WeekData({ label, entries, loads }: { label: string; entries: Entry[]; loads: LoadDay[] }) {
  const { deleteEntry, deleteMany } = useData();
  const ui = useUi();
  if (entries.length === 0 && loads.length === 0) return null;

  const removeOne = async (e: Entry) => {
    const ok = await ui.confirm({ title: '¿Borrar esta sesión?', message: `${e.dayName}, ${fmtDate(e.at)}. Desaparece del informe; no se puede deshacer.`, confirmLabel: 'Borrar', danger: true });
    if (ok) {
      await deleteEntry(e.id);
      ui.toast('Sesión borrada.');
    }
  };

  const removeWeek = async () => {
    const ok = await ui.confirm({
      title: `¿Borrar los datos de la ${label}?`,
      message: `Se borran ${entries.length} ${entries.length === 1 ? 'sesión' : 'sesiones'} del cuestionario. No se puede deshacer.`,
      confirmLabel: 'Borrar semana',
      danger: true,
    });
    if (!ok) return;
    let dates: string[] = [];
    if (loads.length) {
      const alsoLoads = await ui.confirm({
        title: '¿Borrar también las cargas importadas?',
        message: `Esta semana hay ${loads.length} ${loads.length === 1 ? 'entrenamiento importado' : 'entrenamientos importados'} de Nivel Bestia. Si son reales, déjalos. Si los borras y vuelves a importar la copia, volverán.`,
        confirmLabel: 'Borrar también',
        cancelLabel: 'Dejarlas',
      });
      if (alsoLoads) dates = loads.map((l) => l.date);
    }
    await deleteMany(
      entries.map((e) => e.id),
      dates,
    );
    ui.toast('Datos de la semana borrados.');
  };

  return (
    <section className="card no-print">
      <h2 className="h3">Datos de esta semana</h2>
      {entries.length > 0 && (
        <ul className="list plain">
          {entries.map((e) => (
            <li key={e.id} className="week-row">
              <Link to={`/sesion/${e.id}`} className="week-row-main">
                <b>{e.dayName}</b> <span className="muted">· {fmtDate(e.at)}</span>
                <div className="list-meta">
                  Rodilla {e.kneeDuring ?? '—'} → {e.knee24h ?? '?'}
                  {e.treadmill.done && ' · cinta'}
                </div>
              </Link>
              <button className="icon-btn sm" aria-label={`Borrar la sesión de ${e.dayName} del ${fmtDate(e.at)}`} onClick={() => void removeOne(e)}>
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {loads.length > 0 && <p className="hint">{loads.length} {loads.length === 1 ? 'entrenamiento importado' : 'entrenamientos importados'} de Nivel Bestia esta semana.</p>}
      <button className="btn block danger-outline" onClick={() => void removeWeek()}>
        <Trash2 size={17} /> Borrar los datos de esta semana
      </button>
    </section>
  );
}

export default function Report() {
  const { data } = useData();
  const location = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const pdfx = usePdfExport();
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
  // Progreso acumulado: desde antes de empezar el programa hasta el final del periodo elegido.
  const total = useMemo(() => gainsInWindow(sessions, start, to), [sessions, start, to]);
  const notes = useMemo(
    () =>
      summarizeNotes(
        es,
        [...data.config.days.flatMap((d) => d.exercises), ...sessions.flatMap((x) => x.exercises.map((e) => e.name))],
        (e) => data.config.days.find((d) => d.id === e.dayId)?.name ?? e.dayName,
      ),
    [es, data.config.days, sessions],
  );
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
      <button role="tab" aria-selected={sel === 'todo'} aria-label="Todo" className={`week-tab all${sel === 'todo' ? ' on' : ''}`} onClick={() => setSel('todo')}>
        <small>Total</small>
        <b>Todo</b>
      </button>
    </div>
  );

  const periodText = week ? `Semana ${week.n} · ${rangeText(week.from, week.to)}` : `Todo el programa, desde el ${fmtDate(start)}`;

  // PDF: siempre es el resumen de todas las semanas (lib/summary + lib/summaryPdf), elija la pestaña que se elija.
  const exportPdf = () =>
    pdfx.run(
      () =>
        buildSummary({
          config: data.config,
          entries: data.entries,
          sessions,
          weeks,
          start,
          end,
          now,
          eyebrow: 'Diario gym · Informe',
          title: `Programa completo · semanas 1–${lastN}`,
          sub: `Del ${fmtDate(start)} al ${fmtDate(now)} · generado el ${fmtDate(now)}`,
          totalTitle: 'En qué ejercicios has progresado',
          totalSub: 'Cuánto ha subido en total cada ejercicio: de la marca de antes de empezar el programa (o la primera dentro de él) a la última. Solo los que suben.',
        }),
      `Informe gym - todas las semanas - ${dateStamp()}.pdf`,
    );
  const pdfDialog = pdfx.dialog;
  const pdfBusy = pdfx.busy;
  const end = Math.max(weeks[weeks.length - 1].to, now + 1);
  const lastN = weeks.filter((w) => !w.future).slice(-1)[0]?.n ?? 1;

  const header = (
    <>
      <PageHeader
        title="Informe"
        sub={`${periodText}${week?.current ? ' (esta semana)' : ''}`}
        right={
          <button type="button" className="btn sm pdf-btn" onClick={exportPdf} disabled={pdfBusy} aria-label="Exportar en PDF el resumen de todas las semanas">
            <FileDown size={17} /> {pdfBusy ? 'Creando…' : 'PDF'}
          </button>
        }
      />
      <div className="print-only print-head">
        <p className="print-app">Diario gym · Informe</p>
        <h1>{periodText}</h1>
        <p>
          Generado el {fmtDate(now)}
          {week ? '' : ` · semanas ${weeks[0].n}–${weeks.filter((w) => !w.future).slice(-1)[0]?.n ?? weeks[0].n}`}
        </p>
      </div>
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
      <div className="page" ref={pageRef}>
        {pdfDialog}
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
  const upTo = week ? `hasta el final de la semana ${week.n}` : 'hasta hoy';
  const stalled = prog.filter((p) => p.status === 'estancado').map((p) => p.name);
  const rows = gainRows(total);
  const loadAnswer =
    total.compared === 0 ? (
      prog.length === 0 ? `No hay cargas registradas en ${scope}. Se rellenan en el cuestionario, leyendo capturas o a mano.` : 'Hace falta otra sesión de cada ejercicio para poder comparar.'
    ) : (
      <>
        Desde que empezaste el programa {upTo}: suben <b>{rows.length}</b> de {total.compared} ejercicios.
        {stalled.length > 0 && <> Estancados: {list(stalled)}.</>}
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
    const trend =
      knee.trend === 'pocos'
        ? ''
        : knee.trend === 'baja'
          ? ` Tendencia a la baja: de ${f1(knee.trendFrom)} en las primeras sesiones a ${f1(knee.trendTo)} en las últimas.`
          : knee.trend === 'sube'
            ? ` Tendencia al alza: de ${f1(knee.trendFrom)} en las primeras sesiones a ${f1(knee.trendTo)} en las últimas.`
            : ` Estable: de ${f1(knee.trendFrom)} a ${f1(knee.trendTo)}.`;
    kneeAnswer = `Media por sesión de pierna: ${f1(knee.avgSession)} sobre 10.${trend}${evo}`;
  }

  // ---------------------------------------------------------------- 3. Bienestar
  const wellAnswer = noEntries
    ? `Sin cuestionarios en ${scope}.`
    : `Energía ${f1(well.avgEnergy)}/5, recuperación ${f1(well.avgRecovery)}/5 y sueño ${f1(well.avgSleepHours)} h con calidad ${f1(well.avgSleepQuality)}/5.` +
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
    ? `${verdictText[tm.verdict]} Media: ${f1(tm.avgMin)} min a ${f1(tm.avgSpeed)} km/h y ${f1(tm.avgIncline)} % de inclinación.`
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
    <div className="page report" ref={pageRef}>
      {pdfDialog}
      {header}

      <section className="card q notes-card">
        <div className="q-head">
          <h2 className="h3">Tus comentarios</h2>
        </div>
        {notes.sessions === 0 ? (
          <p className="card-sub">No hay comentarios en {scope}. Se escriben al final del cuestionario.</p>
        ) : (
          <>
            <p className="card-sub">Temas que se repiten en lo que escribes al final de cada sesión, con tus propias frases.</p>
            {notes.themes.map((t) => (
              <div key={t.label} className="note-theme">
                <h3>
                  {t.label} <span className="muted">· {t.sessions} sesiones</span>
                </h3>
                {t.also.length > 0 && <p className="hint">También: {t.also.join(', ').toLowerCase()}.</p>}
                <ul className="note-quotes">
                  {t.quotes.map((q, i) => (
                    <li key={i}>
                      «{q.text}» <span className="muted">({fmtShort(q.at)}, {q.day})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {notes.others.length > 0 && (
              <div className="note-theme">
                <h3 className="muted">{notes.themes.length ? 'Otros comentarios' : 'Comentarios'}</h3>
                <ul className="note-quotes">
                  {notes.others.map((q, i) => (
                    <li key={i}>
                      «{q.text}» <span className="muted">({fmtShort(q.at)}, {q.day})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <Q n={1} long title="¿En qué ejercicios has progresado?" answer={loadAnswer}>
        {rows.length > 0 && (
          <table className="gain-table">
            <thead>
              <tr>
                <th>Ejercicio</th>
                <th>Kg</th>
                <th>Reps</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className={r.kg.startsWith('+') ? 'up' : r.kg.startsWith('−') ? 'down' : ''}>{r.kg}</td>
                  <td className={r.reps.startsWith('+') ? 'up' : r.reps.startsWith('−') ? 'down' : ''}>{r.reps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 && <p className="method">Cuánto ha subido en total cada ejercicio, de la marca de antes de empezar el programa (o la primera) a la última. Con la carga media de cada sesión (media de las series).</p>}
      </Q>

      <Q n={2} title="¿Cómo evolucionó el dolor de rodilla?" answer={kneeAnswer}>
        {week && knee.points.length > 0 && (
          <BarChart
            label="Dolor de rodilla por sesión de pierna"
            labels={sessLabels(knee.points)}
            max={10}
            series={[
              { name: 'Durante', color: 'var(--p3)', values: knee.points.map((p) => p.during) },
              { name: 'A las 24 h', color: 'var(--p2)', values: knee.points.map((p) => p.h24) },
            ]}
          />
        )}
        {!week && knee.points.length > 0 && (
          <LineChart
            label="Dolor de rodilla por sesión de pierna"
            labels={sessLabels(knee.points)}
            min={0}
            max={10}
            series={[
              { name: 'Media de la sesión', color: 'var(--line-1)', values: knee.points.map((p) => p.mean) },
              { name: 'Durante', color: 'var(--c2)', values: knee.points.map((p) => p.during), dashed: true },
              { name: 'A las 24 h', color: 'var(--c3)', values: knee.points.map((p) => p.h24), dashed: true },
            ]}
          />
        )}
        {knee.points.length > 0 && (
          <div className="stats">
            <Stat label="Durante" value={f1(knee.avgDuring)} />
            <Stat label="A las 24 h" value={f1(knee.avg24h)} />
            <Stat label="Otros días" value={f1(knee.avgOther)} hint="sin pierna" />
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
        {knee.points.length > 0 && <p className="method">La media de cada sesión usa el dolor durante y a las 24 h; si falta uno, se usa el otro.</p>}
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
                { name: 'Energía', color: 'var(--line-1)', values: well.points.map((p) => p.energy) },
                { name: 'Recuperación', color: 'var(--c2)', values: well.points.map((p) => p.recovery) },
                { name: 'Calidad del sueño', color: 'var(--c3)', values: well.points.map((p) => p.sleepQuality), dashed: true },
              ]}
            />
            <h3 className="chart-title">Horas de sueño la noche anterior</h3>
            <BarChart label="Horas de sueño por sesión" labels={sessLabels(well.points)} max={10} series={[{ name: 'Horas', color: '', values: well.points.map((p) => p.sleepHours) }]} />
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
                { name: 'Energía', color: 'var(--line-1)', values: stats.map((s) => s.energy) },
                { name: 'Recuperación', color: 'var(--c2)', values: stats.map((s) => s.recovery) },
                { name: 'Calidad del sueño', color: 'var(--c3)', values: stats.map((s) => s.sleepQuality), dashed: true },
              ]}
            />
            <h3 className="chart-title">Horas de sueño (media semanal)</h3>
            <BarChart label="Horas de sueño por semana" labels={weekLabels} max={10} series={[{ name: 'Horas', color: '', values: stats.map((s) => s.sleepHours) }]} />
          </>
        )}
        {(well.recoveryShortRest != null || well.recoveryLongRest != null) && (
          <div className="meters">
            <h3 className="chart-title">Recuperación según los días de descanso previos</h3>
            <MeterRow label="0–1 días" value={well.recoveryShortRest} max={5} color="var(--p2)" />
            <MeterRow label="2 o más días" value={well.recoveryLongRest} max={5} color="var(--p1)" />
          </div>
        )}
        {well.lowSessions.length > 0 && (
          <ul className="list plain compact">
            {well.lowSessions
              .slice(-5)
              .reverse()
              .map((p) => (
                <li key={p.id}>
                  <Link to={`/sesion/${p.id}`}>
                    {fmtDate(p.at)} · {p.dayName}
                  </Link>
                  <div className="list-meta">
                    Energía {p.energy ?? '—'} · sueño {p.sleepQuality ?? '—'} · recuperación {p.recovery ?? '—'}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Q>

      <Q n={4} title="¿La cinta se toleró bien o fue demasiado o poco exigente?" answer={tmAnswer}>
        {tm.sessions.length > 0 && (
          <div className="stats">
            <Stat label="Poco exigente" value={String(tm.counts.poco)} />
            <Stat label="Bien" value={String(tm.counts.bien)} />
            <Stat label="Demasiado" value={String(tm.counts.mucho)} />
          </div>
        )}
        {week && tm.sessions.length > 0 && (
          <>
            <h3 className="chart-title">Minutos de cinta por sesión, según exigencia</h3>
            <BarChart
              label="Minutos de cinta por sesión"
              labels={sessLabels(tm.sessions)}
              max={Math.max(30, ...tm.sessions.map((e) => e.treadmill.min ?? 0))}
              series={[{ name: 'Minutos', color: '', values: tm.sessions.map((e) => e.treadmill.min) }]}
              colors={tm.sessions.map((e) => RATING.find((r) => r.id === e.treadmill.rating)?.color ?? 'var(--surface-2)')}
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
              series={[{ name: 'Dolor', color: '', values: [tm.knee24WithTreadmill, tm.knee24WithoutTreadmill] }]}
              colors={['var(--p3)', 'var(--p2)']}
              height={130}
            />
          </>
        )}
      </Q>

      <Q n={5} title="Sensaciones con cada día" answer={feelAnswer}>
        {feel.days.length > 0 && (
          <div className="meters">
            {feel.days.map((d, i) => (
              <MeterRow key={d.key} label={`${d.name}${d.sessions > 1 ? ` (${d.sessions})` : ''}`} value={d.avgFeel} max={5} color={PASTEL[Math.max(0, data.config.days.findIndex((c) => c.id === d.key) >= 0 ? data.config.days.findIndex((c) => c.id === d.key) : i) % PASTEL.length]} />
            ))}
          </div>
        )}
      </Q>

      {week && (
        <WeekData
          label={`semana ${week.n}`}
          entries={es}
          loads={data.loads.filter((l) => {
            const t = new Date(`${l.date}T12:00:00`).getTime();
            return t >= week.from && t < week.to;
          })}
        />
      )}

    </div>
  );
}
