import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarPlus, Check, Eye, FileDown, Share, Trash2, X } from 'lucide-react';
import { buildReportPdf, canShareFile } from '../lib/pdf';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
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
import type { Entry, LoadDay, TreadmillRating } from '../types';
import { calendarLinkFor } from '../lib/calendar';
import { fmtDate, fmtLoad, fmtNum, fmtShort } from '../lib/util';
import { Empty, PageHeader, Stat } from '../components/ui';
import { BarChart, DeltaBars, LineChart, MeterRow, PASTEL, StackedBars } from '../components/charts';
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
    text = `${current.reps > base.reps ? '+' : '−'}${fmtNum(Math.round(Math.abs(current.reps - base.reps) * 10) / 10)} rep.`;
  }
  // El color sigue al estado (p. ej. un ejercicio puede subir respecto a la semana pasada y seguir sin superar su mejor marca).
  const tone = p.status === 'progresa' ? 'up' : p.status === 'baja' ? 'down' : p.status === 'estancado' ? 'stall' : 'flat';
  return { label: p.name, pct, text, tone };
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
  const ui = useUi();
  const location = useLocation();
  const pageRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdf, setPdf] = useState<{ file: File; url: string; pages: string[] } | null>(null);
  const [pdfView, setPdfView] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(false);
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url);
    },
    [pdf],
  );
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
      <button role="tab" aria-selected={sel === 'todo'} aria-label="Todo" className={`week-tab all${sel === 'todo' ? ' on' : ''}`} onClick={() => setSel('todo')}>
        <small>Total</small>
        <b>Todo</b>
      </button>
    </div>
  );

  const periodText = week ? `Semana ${week.n} · ${rangeText(week.from, week.to)}` : `Todo el programa, desde el ${fmtDate(start)}`;

  // PDF: se genera en la propia app (window.print() no funciona en el iPhone con la app abierta como app).
  // Al terminar se muestra una ventana con «Guardar» (hoja Compartir de iOS) y «Ver» (vista previa):
  // tiene que ser un toque nuevo, porque iOS no deja abrirla al final de una tarea larga.
  const exportPdf = async () => {
    if (!pageRef.current || pdfBusy) return;
    setPdfBusy(true);
    try {
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const name = `Informe gym - ${week ? `semana ${week.n}` : 'programa completo'} - ${stamp}.pdf`;
      const { blob, pages } = await buildReportPdf(pageRef.current);
      setPdfView(false);
      setPdfZoom(false);
      setPdf({ file: new File([blob], name, { type: 'application/pdf' }), url: URL.createObjectURL(blob), pages });
    } catch {
      ui.toast('No se pudo generar el PDF. Inténtalo otra vez.');
    } finally {
      setPdfBusy(false);
    }
  };

  const closePdf = () => {
    setPdf(null);
    setPdfView(false);
    setPdfZoom(false);
  };

  // «Guardar» abre la hoja Compartir de iOS: Guardar en Archivos, WhatsApp, Mail, Drive…
  // Donde no existe (algunos navegadores de ordenador) se descarga el archivo.
  const saveButton = (cls: string, autoFocus = false) =>
    pdf &&
    (canShareFile(pdf.file) ? (
      <button className={cls} onClick={() => sharePdf(pdf.file)} autoFocus={autoFocus}>
        <Share size={17} /> Guardar
      </button>
    ) : (
      <a className={cls} href={pdf.url} download={pdf.file.name}>
        <Share size={17} /> Guardar
      </a>
    ));

  const sharePdf = (file: File) => {
    navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') }).catch((e: unknown) => {
      if ((e as { name?: string })?.name !== 'AbortError') ui.toast('No se pudo abrir Guardar. Inténtalo otra vez.');
    });
  };

  const pdfDialog =
    pdf &&
    (pdfView ? (
      <div className="pdf-viewer" role="dialog" aria-modal="true" aria-label={`Vista previa: ${pdf.file.name}`}>
        <div className="pdf-viewer-bar">
          <button className="icon-btn" aria-label="Cerrar la vista previa" onClick={() => setPdfView(false)}>
            <X size={20} />
          </button>
          <span className="pdf-viewer-title">
            {pdf.pages.length} {pdf.pages.length === 1 ? 'página' : 'páginas'}
          </span>
          {saveButton('btn sm primary')}
        </div>
        <div className={`pdf-viewer-pages${pdfZoom ? ' zoom' : ''}`}>
          {pdf.pages.map((src, i) => (
            <img key={i} src={src} alt={`Página ${i + 1} de ${pdf.pages.length}`} onClick={() => setPdfZoom((z) => !z)} />
          ))}
          <p className="pdf-viewer-hint">Toca una página para {pdfZoom ? 'verla entera' : 'ampliarla'}.</p>
        </div>
      </div>
    ) : (
      <div className="overlay" onClick={closePdf}>
        <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="pdf-title" onClick={(e) => e.stopPropagation()}>
          <h2 id="pdf-title">PDF listo</h2>
          <p>{pdf.file.name}</p>
          <div className="dialog-actions pdf-actions">
            {saveButton('btn primary', true)}
            <button className="btn" onClick={() => setPdfView(true)}>
              <Eye size={17} /> Ver
            </button>
            <button className="btn ghost" onClick={closePdf}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    ));

  const header = (
    <>
      <PageHeader
        title="Informe"
        sub={`${periodText}${week?.current ? ' (esta semana)' : ''}`}
        right={
          <button type="button" className="btn sm pdf-btn" onClick={exportPdf} disabled={pdfBusy} aria-label="Exportar el informe en PDF">
            <FileDown size={17} /> {pdfBusy ? 'Creando…' : 'PDF'}
          </button>
        }
      />
      <div className="print-only print-head">
        <p className="print-app">Diario gym · Informe</p>
        <h1>{periodText}</h1>
        <p>
          Generado el {fmtDate(now)} · {es.length} {es.length === 1 ? 'sesión' : 'sesiones'} con cuestionario
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
  const by = (st: LoadStatus) => prog.filter((p) => p.status === st).map((p) => p.name);
  const deltas = prog
    .map(deltaItem)
    .filter((d): d is DeltaItem => d != null)
    .sort((a, b) => b.pct - a.pct);
  const loadAnswer =
    prog.length === 0 ? (
      `No hay cargas registradas en ${scope}. Se rellenan en el cuestionario, leyendo capturas o a mano.`
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

      <Q n={1} long title="¿En qué ejercicios progresó la carga y en cuáles se estancó?" answer={loadAnswer}>
        {deltas.length > 0 && <DeltaBars items={deltas} label="Cambio de carga por ejercicio" />}
        {prog.length > 0 && (
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
        )}
        {prog.length > 0 && (
        <p className="method">
          {week ? 'Cada ejercicio se compara con la última vez que lo hiciste antes de esta semana. ' : 'Cada ejercicio se compara con la última vez antes de empezar el programa (o con la primera dentro de él). '}
          Se usa la carga media de cada sesión (media de las series): primero el peso y, con el mismo peso, las repeticiones. «Estancado» (naranja) = {STALL_SESSIONS} sesiones o más seguidas sin superar la mejor marca, aunque respecto a la vez anterior haya cambiado algo.
        </p>
        )}
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

      {week && es.length > 0 && (
        <p className="hint center">
          {es.length} {es.length === 1 ? 'sesión registrada' : 'sesiones registradas'} esta semana · sensación media {f1(mean(es.map((e) => e.dayFeel)))}/5
        </p>
      )}
    </div>
  );
}
