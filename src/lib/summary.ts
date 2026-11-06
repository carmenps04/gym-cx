import { feelSummary, gainsInWindow, inRange, kneeSummary, mean, treadmillSummary } from './report';
import type { Gain, GainSummary, LoadSession, WeekRange } from './report';
import type { Config, Entry, TreadmillRating } from '../types';
import { fmtLoad, fmtNum, fmtShort } from './util';

/**
 * Contenido del informe resumido (programa completo o periodo del dietista), sin maquetar.
 * summaryPdf.ts lo dibuja en el PDF.
 */

export const f1 = (n: number | null) => fmtNum(n == null ? null : Math.round(n * 10) / 10);
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TM_SHORT: Record<TreadmillRating, string> = { poco: 'Poco', bien: 'Bien', mucho: 'Demasiado' };

export function rangeText(from: number, to: number): string {
  const a = new Date(from);
  const b = new Date(to - 1);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** «+2,5 kg» o «+2 rep.»; con el mismo peso cuentan las repeticiones. */
export function gainText(g: Gain): string {
  const { base, current } = g;
  if (base.kg != null && current.kg != null && Math.abs(current.kg - base.kg) > 1e-9) return `+${fmtNum(current.kg - base.kg)} kg`;
  if (base.reps != null && current.reps != null && current.reps !== base.reps) return `+${fmtNum(Math.round((current.reps - base.reps) * 10) / 10)} rep.`;
  return 'Mejora';
}

function treadmillCell(es: Entry[]): string {
  const tm = treadmillSummary(es);
  if (tm.sessions.length === 0) return '—';
  if (tm.verdict === 'poco' || tm.verdict === 'bien' || tm.verdict === 'mucho') return `${TM_SHORT[tm.verdict]} (${tm.sessions.length})`;
  if (tm.verdict === 'mixto') return `Mixto (${tm.sessions.length})`;
  const r = tm.sessions[0].treadmill.rating;
  return r ? `${TM_SHORT[r]} (1)` : `${tm.sessions.length} ses.`;
}

export interface GainRow {
  name: string;
  before: string;
  now: string;
  delta: string;
}

export interface GainBlock {
  rows: GainRow[];
  /** Mensaje cuando no hay filas. */
  empty: string;
  /** «Resto: 3 igual · 1 baja.» o ''. */
  rest: string;
}

function gainBlock(s: GainSummary, empty: string): GainBlock {
  const parts: string[] = [];
  if (s.same) parts.push(`${s.same} igual`);
  if (s.down) parts.push(`${s.down} ${s.down === 1 ? 'baja' : 'bajan'}`);
  if (s.fresh) parts.push(`${s.fresh} sin referencia`);
  return {
    rows: s.gains.map((g) => ({ name: g.name, before: fmtLoad(g.base.kg, g.base.reps), now: fmtLoad(g.current.kg, g.current.reps), delta: gainText(g) })),
    empty,
    rest: parts.length ? `Resto: ${parts.join(' · ')}.` : '',
  };
}

export interface TableRow {
  label: string;
  sub: string;
  cells: string[];
  /** Semana sin datos (se pinta en gris). */
  off: boolean;
}

export interface Series {
  name: string;
  color: string;
  dashed?: boolean;
  values: (number | null)[];
}

export interface Chart {
  title: string;
  min: number;
  max: number;
  labels: string[];
  series: Series[];
}

export interface WeekBlock {
  title: string;
  current: boolean;
  gains: GainBlock;
  best: string;
}

export interface Summary {
  eyebrow: string;
  title: string;
  sub: string;
  lines: string[];
  head: string[];
  rows: TableRow[];
  total: TableRow;
  tableNote: string;
  charts: Chart[];
  totalTitle: string;
  totalSub: string;
  totalGains: GainBlock;
  weeks: WeekBlock[];
  foot: string;
}

export interface SummaryInput {
  config: Config;
  entries: Entry[];
  sessions: LoadSession[];
  weeks: WeekRange[];
  start: number;
  end: number;
  now: number;
  eyebrow: string;
  title: string;
  sub: string;
  totalTitle: string;
  totalSub: string;
}

/** «Semana 3 · 2–8 nov» si es del programa; si no, por fechas. */
function weekLabel(w: WeekRange): string {
  return w.n >= 1 ? `Semana ${w.n} · ${rangeText(w.from, w.to)}` : `Semana del ${rangeText(w.from, w.to)}`;
}
const weekShort = (w: WeekRange, i: number) => (w.n >= 1 ? `S${w.n}` : `${i + 1}`);

export const COLORS = { green: '#4a7a2b', orange: '#d07a4f', blue: '#4f86c2' };

export function buildSummary({ config, entries, sessions, weeks, start, end, now, eyebrow, title, sub, totalTitle, totalSub }: SummaryInput): Summary {
  const past = weeks.filter((w) => !w.future);
  const rows = past.map((w) => {
    const es = inRange(entries, w.from, w.to);
    const loads = inRange(sessions, w.from, w.to);
    return {
      w,
      es,
      hasData: es.length > 0 || loads.length > 0,
      knee: kneeSummary(es).avgSession,
      energy: mean(es.map((e) => e.energy)),
      recovery: mean(es.map((e) => e.recovery)),
      sleepH: mean(es.map((e) => e.sleepHours)),
      sleepQ: mean(es.map((e) => e.sleepQuality)),
      tm: treadmillCell(es),
      best: feelSummary(es, config).best,
      gains: gainsInWindow(sessions, w.from, w.to),
    };
  });
  const all = inRange(entries, start, end);
  const allKnee = kneeSummary(all);
  const total = gainsInWindow(sessions, start, end);
  const chartRows = rows.filter((r) => r.es.length > 0);
  const sleepH = mean(all.map((e) => e.sleepHours));
  const sleepQ = mean(all.map((e) => e.sleepQuality));
  const energy = mean(all.map((e) => e.energy));
  const recovery = mean(all.map((e) => e.recovery));

  // ---------------------------------------------------------------- Resumen en frases
  const lines: string[] = [];
  const legN = all.filter((e) => e.isLeg).length;
  // Sesiones por semana según los días transcurridos (la semana en curso no cuenta como entera).
  const elapsedDays = (Math.min(end, now + 1) - start) / (24 * 3600_000);
  const perWeek = elapsedDays >= 7 ? `, ${f1(all.length / (elapsedDays / 7))} por semana de media` : '';
  lines.push(
    all.length
      ? `${all.length} ${all.length === 1 ? 'sesión registrada' : 'sesiones registradas'}${legN ? ` (${legN} de pierna)` : ''}${perWeek}.`
      : 'Aún no hay sesiones registradas en este periodo.',
  );
  if (total.compared) {
    const top = total.gains[0];
    lines.push(
      `Cargas: suben ${total.gains.length} de ${total.compared} ejercicios${top ? `; la mayor subida, ${top.name} (${gainText(top)})` : ''}.${total.down ? ` ${total.down} ${total.down === 1 ? 'baja' : 'bajan'}.` : ''}`,
    );
  }
  const kneeWeeks = rows.filter((r) => r.knee != null);
  if (allKnee.avgSession != null) {
    const first = kneeWeeks[0];
    const last = kneeWeeks[kneeWeeks.length - 1];
    const evo =
      kneeWeeks.length >= 2 ? `; de ${f1(first.knee)} la primera semana a ${f1(last.knee)} la última (${last.knee! - first.knee! <= -0.5 ? 'mejora' : last.knee! - first.knee! >= 0.5 ? 'empeora' : 'estable'})` : '';
    lines.push(`Rodilla: dolor medio ${f1(allKnee.avgSession)}/10 en las sesiones de pierna${evo}.`);
  }
  if (all.length && (sleepH != null || energy != null || recovery != null)) {
    lines.push(
      `Descanso: ${sleepH != null ? `${f1(sleepH)} h de sueño${sleepQ != null ? ` (calidad ${f1(sleepQ)}/5)` : ''}` : 'sin datos de sueño'}; energía ${f1(energy)}/5 y recuperación ${f1(recovery)}/5.`,
    );
  }
  const tmAll = treadmillSummary(all);
  if (tmAll.sessions.length) {
    const v: Record<typeof tmAll.verdict, string> = { poco: 'casi siempre poco exigente', bien: 'casi siempre bien tolerada', mucho: 'casi siempre demasiado exigente', mixto: 'con valoraciones repartidas', pocos: 'sin valoraciones suficientes' };
    lines.push(`Cinta: ${tmAll.sessions.length} ${tmAll.sessions.length === 1 ? 'sesión' : 'sesiones'}, ${v[tmAll.verdict]} (${f1(tmAll.avgMin)} min de media).`);
  }

  // ---------------------------------------------------------------- Gráficas
  const charts: Chart[] = [];
  if (chartRows.length >= 2) {
    const labels = chartRows.map((r, i) => weekShort(r.w, i));
    charts.push({
      title: 'Energía, recuperación y calidad del sueño (media semanal, 1–5)',
      min: 1,
      max: 5,
      labels,
      series: [
        { name: 'Energía', color: COLORS.green, values: chartRows.map((r) => r.energy) },
        { name: 'Recuperación', color: COLORS.orange, values: chartRows.map((r) => r.recovery) },
        { name: 'Calidad del sueño', color: COLORS.blue, dashed: true, values: chartRows.map((r) => r.sleepQ) },
      ],
    });
    if (chartRows.some((r) => r.knee != null)) {
      charts.push({ title: 'Dolor de rodilla (media semanal, 0–10)', min: 0, max: 10, labels, series: [{ name: 'Rodilla', color: COLORS.orange, values: chartRows.map((r) => r.knee) }] });
    }
  }

  return {
    eyebrow,
    title,
    sub,
    lines,
    head: ['Semana', 'Ses.', 'Rodilla', 'Energía', 'Recup.', 'Sueño', 'Cinta', 'Suben'],
    rows: rows.map((r) => ({
      label: r.w.n >= 1 ? String(r.w.n) : '·',
      sub: rangeText(r.w.from, r.w.to),
      off: !r.hasData,
      cells: [
        String(r.es.length || '—'),
        f1(r.knee),
        f1(r.energy),
        f1(r.recovery),
        r.sleepH == null ? '—' : `${f1(r.sleepH)} h`,
        r.tm,
        r.gains.compared ? `${r.gains.gains.length}/${r.gains.compared}` : '—',
      ],
    })),
    total: {
      label: 'Total',
      sub: '',
      off: false,
      cells: [String(all.length), f1(allKnee.avgSession), f1(energy), f1(recovery), sleepH == null ? '—' : `${f1(sleepH)} h`, treadmillCell(all), total.compared ? `${total.gains.length}/${total.compared}` : '—'],
    },
    tableNote:
      'Medias de la semana. Rodilla 0–10 (sesiones de pierna, media de durante y 24 h); energía y recuperación 1–5. Cinta: valoración más repetida (n.º de sesiones). Suben: ejercicios que mejoran / ejercicios que se pueden comparar.',
    charts,
    totalTitle,
    totalSub,
    totalGains: gainBlock(total, 'Ningún ejercicio supera todavía su marca de referencia.'),
    weeks: rows
      .filter((r) => r.hasData)
      .map((r) => ({
        title: weekLabel(r.w),
        current: r.w.current,
        gains:
          r.gains.compared === 0 && r.gains.fresh > 0
            ? { rows: [], rest: '', empty: `Primeras marcas de ${r.gains.fresh} ${r.gains.fresh === 1 ? 'ejercicio' : 'ejercicios'}: sirven de referencia para las semanas siguientes.` }
            : gainBlock(r.gains, r.gains.compared ? 'Ningún ejercicio sube respecto a la vez anterior.' : 'Sin cargas registradas esta semana.'),
        best: r.best ? `Día que más gustó: ${r.best.name} (${f1(r.best.avgFeel)}/5).` : '',
      })),
    foot: `En cada semana, cada ejercicio se compara con la última vez que se hizo antes de esa semana. Se usa la carga media de la sesión (media de las series): primero el peso y, con el mismo peso, las repeticiones. Última sesión incluida: ${all.length ? fmtShort(all[all.length - 1].at) : '—'}.`,
  };
}
