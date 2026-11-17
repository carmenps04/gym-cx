import { feelSummary, gainsInWindow, inRange, kneeSummary, mean, treadmillSummary } from './report.ts';
import type { Gain, GainSummary, LoadSession, WeekRange } from './report.ts';
import type { Config, Entry, TreadmillRating } from '../types.ts';
import { fmtNum, fmtShort } from './util.ts';
import { summarizeNotes } from './notes.ts';
import type { NotesSummary } from './notes.ts';

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
  /** «+10 kg», «=» o «—» (sin peso). */
  kg: string;
  /** «+1,5», «−2», «=» o «—». */
  reps: string;
}

export interface GainBlock {
  rows: GainRow[];
  /** Mensaje cuando no hay filas. */
  empty: string;
}

/** Diferencia con signo, redondeada a 0,1: «+10», «−2», «=»; «—» si falta un dato. */
export function signed(base: number | null, current: number | null): string {
  if (base == null || current == null) return '—';
  const d = Math.round((current - base) * 10) / 10;
  if (d === 0) return '=';
  return `${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d))}`;
}

/** Cuánto ha subido cada ejercicio en total: peso y repeticiones, de la marca de referencia a la última. */
export function gainRows(s: GainSummary): GainRow[] {
  return s.gains.map((g) => {
    const kg = signed(g.base.kg, g.current.kg);
    return { name: g.name, kg: kg === '—' || kg === '=' ? kg : `${kg} kg`, reps: signed(g.base.reps, g.current.reps) };
  });
}

function gainBlock(s: GainSummary, empty: string): GainBlock {
  return { rows: gainRows(s), empty };
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
  notes: NotesSummary;
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

const weekShort = (w: WeekRange, i: number) => (w.n >= 1 ? `S${w.n}` : `${i + 1}`);

export const COLORS = { green: '#4a7a2b', orange: '#d07a4f', blue: '#4f86c2' };

export function buildSummary({ config, entries, sessions, weeks, start, end, eyebrow, title, sub, totalTitle, totalSub }: SummaryInput): Summary {
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
  if (total.compared) {
    const top = total.gains[0];
    lines.push(`Cargas: suben ${total.gains.length} de ${total.compared} ejercicios${top ? `; la mayor subida, ${top.name} (${gainText(top)})` : ''}.`);
  }
  if (!lines.length) lines.push('Aún no hay datos en este periodo.');
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
  const feel = feelSummary(all, config);
  if (feel.best && feel.worst) lines.push(`Días: el que más gustó, ${feel.best.name} (${f1(feel.best.avgFeel)}/5); el que menos, ${feel.worst.name} (${f1(feel.worst.avgFeel)}/5).`);
  const tmAll = treadmillSummary(all);
  if (tmAll.sessions.length) {
    const v: Record<typeof tmAll.verdict, string> = { poco: 'casi siempre poco exigente', bien: 'casi siempre bien tolerada', mucho: 'casi siempre demasiado exigente', mixto: 'con valoraciones repartidas', pocos: 'sin valoraciones suficientes' };
    lines.push(`Cinta: ${v[tmAll.verdict]} (${f1(tmAll.avgMin)} min de media).`);
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
    head: ['Semana', 'Rodilla', 'Energía', 'Recup.', 'Sueño', 'Cinta', 'Suben'],
    rows: rows.map((r) => ({
      label: r.w.n >= 1 ? String(r.w.n) : '·',
      sub: rangeText(r.w.from, r.w.to),
      off: !r.hasData,
      cells: [
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
      cells: [f1(allKnee.avgSession), f1(energy), f1(recovery), sleepH == null ? '—' : `${f1(sleepH)} h`, treadmillCell(all), total.compared ? `${total.gains.length}/${total.compared}` : '—'],
    },
    tableNote:
      'Medias de la semana. Rodilla 0–10 (sesiones de pierna, media de durante y 24 h); energía y recuperación 1–5. Cinta: valoración más repetida (n.º de sesiones). Suben: ejercicios que mejoran / ejercicios que se pueden comparar.',
    charts,
    totalTitle,
    totalSub,
    totalGains: gainBlock(total, 'Ningún ejercicio supera todavía su marca de referencia.'),
    notes: summarizeNotes(
      all,
      [...config.days.flatMap((d) => d.exercises), ...sessions.flatMap((x) => x.exercises.map((e) => e.name))],
      (e) => config.days.find((d) => d.id === e.dayId)?.name ?? e.dayName,
    ),
    foot: `Cargas: se usa la carga media de cada sesión (media de las series); un ejercicio sube si sube el peso o, con el mismo peso, las repeticiones. Última sesión incluida: ${all.length ? fmtShort(all[all.length - 1].at) : '—'}.`,
  };
}
