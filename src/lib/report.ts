// Lógica pura del informe: sin React ni Firebase, para poder probarla con tests.
import type { Config, DayDef, Entry, ExerciseLog, LoadDay, TreadmillRating } from '../types.ts';

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export function normName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

export function mean(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function sortByDate<T extends { at: number }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.at - b.at);
}

/** weeks = null → todo el historial. */
export function inPeriod<T extends { at: number }>(entries: T[], weeks: number | null, now: number): T[] {
  const sorted = sortByDate(entries);
  if (weeks == null) return sorted;
  const from = now - weeks * 7 * DAY;
  return sorted.filter((e) => e.at >= from);
}

// ------------------------------------------------------------------ 1. Cargas

/** Cargas de una sesión, vengan de Nivel Bestia o escritas a mano. */
export interface LoadSession {
  at: number;
  exercises: ExerciseLog[];
  source: 'nivel-bestia' | 'manual';
}

const pad2 = (n: number) => String(n).padStart(2, '0');
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Une las dos fuentes. Si un día tiene datos importados de Nivel Bestia, mandan esos y se ignoran
 * las cargas escritas a mano ese mismo día (para no contar dos veces).
 */
export function loadSessions(entries: Entry[], loads: LoadDay[]): LoadSession[] {
  const imported = new Set(loads.map((l) => l.date));
  return sortByDate([
    ...loads.map((l): LoadSession => ({ at: l.at, exercises: l.exercises, source: 'nivel-bestia' })),
    ...entries
      .filter((e) => !imported.has(localDate(e.at)) && e.exercises.length > 0)
      .map((e): LoadSession => ({ at: e.at, exercises: e.exercises, source: 'manual' })),
  ]);
}

export type LoadStatus = 'progresa' | 'estancado' | 'mantiene' | 'baja' | 'pocos';

export interface LoadRecord {
  at: number;
  kg: number | null;
  reps: number | null;
}

export interface ExerciseProgress {
  name: string;
  status: LoadStatus;
  records: LoadRecord[];
  first: LoadRecord;
  last: LoadRecord;
  best: LoadRecord;
  /** Sesiones registradas después de la mejor marca. */
  sinceBest: number;
}

/** Sesiones seguidas sin superar la mejor marca a partir de las cuales se considera estancado. */
export const STALL_SESSIONS = 2;

function hasValue(x: ExerciseLog | LoadRecord): boolean {
  return x.kg != null || x.reps != null;
}

/** >0 si a es mejor que b: primero manda el peso; con el mismo peso, las repeticiones. */
export function compareLoad(a: Pick<LoadRecord, 'kg' | 'reps'>, b: Pick<LoadRecord, 'kg' | 'reps'>): number {
  const ka = a.kg ?? 0;
  const kb = b.kg ?? 0;
  if (Math.abs(ka - kb) > 1e-9) return ka - kb;
  return (a.reps ?? 0) - (b.reps ?? 0);
}

export function exerciseProgress(entries: { at: number; exercises: ExerciseLog[] }[]): ExerciseProgress[] {
  const groups = new Map<string, { name: string; records: LoadRecord[] }>();
  for (const e of sortByDate(entries)) {
    for (const x of e.exercises) {
      if (!x.name.trim() || !hasValue(x)) continue;
      const key = normName(x.name);
      const g = groups.get(key) ?? { name: x.name.trim(), records: [] };
      g.name = x.name.trim(); // se queda con la forma más reciente del nombre
      g.records.push({ at: e.at, kg: x.kg, reps: x.reps });
      groups.set(key, g);
    }
  }

  const out: ExerciseProgress[] = [];
  for (const { name, records } of groups.values()) {
    let bestIdx = 0;
    records.forEach((r, i) => {
      if (compareLoad(r, records[bestIdx]) > 0) bestIdx = i;
    });
    const n = records.length;
    const last = records[n - 1];
    const sinceBest = n - 1 - bestIdx;
    let status: LoadStatus;
    if (n < 2) status = 'pocos';
    else if (bestIdx === n - 1 && bestIdx > 0) status = 'progresa';
    else if (sinceBest >= STALL_SESSIONS) status = 'estancado';
    else if (compareLoad(last, records[n - 2]) < 0) status = 'baja';
    else status = 'mantiene';
    out.push({ name, status, records, first: records[0], last, best: records[bestIdx], sinceBest });
  }
  const order: Record<LoadStatus, number> = { progresa: 0, mantiene: 1, baja: 2, estancado: 3, pocos: 4 };
  return out.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, 'es'));
}

/** Última vez que se anotó ese ejercicio antes del día indicado (para orientar la sesión nueva). */
export function lastLog(sessions: { at: number; exercises: ExerciseLog[] }[], name: string, beforeDate?: string): LoadRecord | null {
  const key = normName(name);
  for (const e of sortByDate(sessions).reverse()) {
    if (beforeDate && localDate(e.at) >= beforeDate) continue;
    const x = e.exercises.find((y) => normName(y.name) === key && hasValue(y));
    if (x) return { at: e.at, kg: x.kg, reps: x.reps };
  }
  return null;
}

// ------------------------------------------------------------------ 2. Rodilla

export interface KneePoint {
  id: string;
  at: number;
  during: number | null;
  h24: number | null;
  /** Media de la sesión con los valores disponibles (durante y 24 h). */
  mean: number | null;
}

export type Trend = 'baja' | 'sube' | 'estable' | 'pocos';

export interface KneeSummary {
  points: KneePoint[];
  avgDuring: number | null;
  avg24h: number | null;
  avgSession: number | null;
  /** Media de las sesiones que no son de pierna, para comparar. */
  avgOther: number | null;
  trend: Trend;
  /** Media de las primeras y de las últimas sesiones con las que se calcula la tendencia. */
  trendFrom: number | null;
  trendTo: number | null;
  /** Sesiones de pierna cuyo dolor a 24 h es mayor que el de durante. */
  worseNextDay: number;
}

/** Diferencia mínima (en puntos de 0 a 10) para hablar de subida o bajada. */
export const TREND_THRESHOLD = 1;

function sessionMean(e: Entry): number | null {
  return mean([e.kneeDuring, e.knee24h]);
}

export function trendOf(values: number[]): { trend: Trend; from: number | null; to: number | null } {
  if (values.length < 4) return { trend: 'pocos', from: null, to: null };
  const k = Math.min(3, Math.floor(values.length / 2));
  const from = mean(values.slice(0, k))!;
  const to = mean(values.slice(-k))!;
  const d = to - from;
  return { trend: d <= -TREND_THRESHOLD ? 'baja' : d >= TREND_THRESHOLD ? 'sube' : 'estable', from, to };
}

export function kneeSummary(entries: Entry[]): KneeSummary {
  const sorted = sortByDate(entries);
  const leg = sorted.filter((e) => e.isLeg);
  const points = leg.map((e) => ({ id: e.id, at: e.at, during: e.kneeDuring, h24: e.knee24h, mean: sessionMean(e) }));
  const t = trendOf(points.map((p) => p.mean).filter((m): m is number => m != null));
  return {
    points,
    avgDuring: mean(leg.map((e) => e.kneeDuring)),
    avg24h: mean(leg.map((e) => e.knee24h)),
    avgSession: mean(points.map((p) => p.mean)),
    avgOther: mean(sorted.filter((e) => !e.isLeg).map(sessionMean)),
    trend: t.trend,
    trendFrom: t.from,
    trendTo: t.to,
    worseNextDay: leg.filter((e) => e.kneeDuring != null && e.knee24h != null && e.knee24h > e.kneeDuring).length,
  };
}

// ------------------------------------------------------------------ 3. Energía, sueño y recuperación

export interface WellPoint {
  id: string;
  at: number;
  dayName: string;
  energy: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  recovery: number | null;
  /** Días completos de descanso desde la sesión anterior (null en la primera). */
  restDays: number | null;
}

export interface WellSummary {
  points: WellPoint[];
  avgEnergy: number | null;
  avgSleepHours: number | null;
  avgSleepQuality: number | null;
  avgRecovery: number | null;
  /** Sesiones con energía, sueño o recuperación en 1 o 2. */
  lowSessions: WellPoint[];
  /** Recuperación media según el descanso previo: «1 día o menos» frente a «2 días o más». */
  recoveryShortRest: number | null;
  recoveryLongRest: number | null;
}

function calendarDayDiff(a: number, b: number): number {
  const da = new Date(a);
  const db = new Date(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / DAY);
}

/** history: todas las sesiones (para saber el descanso previo aunque la anterior quede fuera del periodo). */
export function wellSummary(entries: Entry[], history: Entry[] = entries): WellSummary {
  const all = sortByDate(history);
  const points: WellPoint[] = sortByDate(entries).map((e) => {
    const idx = all.findIndex((x) => x.id === e.id);
    const prev = idx > 0 ? all[idx - 1] : null;
    return {
      id: e.id,
      at: e.at,
      dayName: e.dayName,
      energy: e.energy,
      sleepHours: e.sleepHours,
      sleepQuality: e.sleepQuality,
      recovery: e.recovery,
      restDays: prev ? Math.max(0, calendarDayDiff(prev.at, e.at) - 1) : null,
    };
  });
  const low = (v: number | null) => v != null && v <= 2;
  return {
    points,
    avgEnergy: mean(points.map((p) => p.energy)),
    avgSleepHours: mean(points.map((p) => p.sleepHours)),
    avgSleepQuality: mean(points.map((p) => p.sleepQuality)),
    avgRecovery: mean(points.map((p) => p.recovery)),
    lowSessions: points.filter((p) => low(p.energy) || low(p.sleepQuality) || low(p.recovery)),
    recoveryShortRest: mean(points.filter((p) => p.restDays != null && p.restDays <= 1).map((p) => p.recovery)),
    recoveryLongRest: mean(points.filter((p) => p.restDays != null && p.restDays >= 2).map((p) => p.recovery)),
  };
}

// ------------------------------------------------------------------ 4. Cinta

export type TreadmillVerdict = TreadmillRating | 'mixto' | 'pocos';

export interface TreadmillSummary {
  sessions: Entry[];
  counts: Record<TreadmillRating, number>;
  verdict: TreadmillVerdict;
  avgMin: number | null;
  avgSpeed: number | null;
  avgIncline: number | null;
  /** Dolor de rodilla a 24 h en sesiones con cinta y sin cinta. */
  knee24WithTreadmill: number | null;
  knee24WithoutTreadmill: number | null;
}

export function treadmillSummary(entries: Entry[]): TreadmillSummary {
  const sorted = sortByDate(entries);
  const sessions = sorted.filter((e) => e.treadmill.done);
  const counts: Record<TreadmillRating, number> = { poco: 0, bien: 0, mucho: 0 };
  sessions.forEach((e) => {
    if (e.treadmill.rating) counts[e.treadmill.rating]++;
  });
  const rated = counts.poco + counts.bien + counts.mucho;
  let verdict: TreadmillVerdict = 'pocos';
  if (rated >= 2) {
    const ranked = (Object.entries(counts) as [TreadmillRating, number][]).sort((a, b) => b[1] - a[1]);
    verdict = ranked[0][1] > ranked[1][1] ? ranked[0][0] : 'mixto';
  }
  return {
    sessions,
    counts,
    verdict,
    avgMin: mean(sessions.map((e) => e.treadmill.min)),
    avgSpeed: mean(sessions.map((e) => e.treadmill.speed)),
    avgIncline: mean(sessions.map((e) => e.treadmill.incline)),
    knee24WithTreadmill: mean(sessions.map((e) => e.knee24h)),
    knee24WithoutTreadmill: mean(sorted.filter((e) => !e.treadmill.done).map((e) => e.knee24h)),
  };
}

// ------------------------------------------------------------------ 5. Sensaciones por día

export interface DayFeel {
  key: string;
  name: string;
  sessions: number;
  avgFeel: number | null;
  notes: { at: number; text: string }[];
}

export interface FeelSummary {
  days: DayFeel[];
  best: DayFeel | null;
  worst: DayFeel | null;
}

export function feelSummary(entries: Entry[], config: Config): FeelSummary {
  const map = new Map<string, DayFeel & { feels: (number | null)[] }>();
  for (const e of sortByDate(entries)) {
    const key = e.dayId || normName(e.dayName);
    const current = config.days.find((d) => d.id === e.dayId)?.name ?? e.dayName;
    const g = map.get(key) ?? { key, name: current, sessions: 0, avgFeel: null, notes: [], feels: [] };
    g.sessions++;
    g.feels.push(e.dayFeel);
    if (e.note.trim()) g.notes.push({ at: e.at, text: e.note.trim() });
    map.set(key, g);
  }
  const days: DayFeel[] = [...map.values()].map(({ feels, ...d }) => ({ ...d, avgFeel: mean(feels), notes: d.notes.reverse() }));
  // Orden de la configuración; los días borrados, al final.
  const pos = (k: string) => {
    const i = config.days.findIndex((d) => d.id === k);
    return i < 0 ? 999 : i;
  };
  days.sort((a, b) => pos(a.key) - pos(b.key));
  const rated = days.filter((d) => d.avgFeel != null).sort((a, b) => b.avgFeel! - a.avgFeel!);
  const distinct = rated.length >= 2 && rated[0].avgFeel !== rated[rated.length - 1].avgFeel;
  return { days, best: distinct ? rated[0] : null, worst: distinct ? rated[rated.length - 1] : null };
}

// ------------------------------------------------------------------ Utilidades de la app

/** Día que toca: el siguiente al de la última sesión, en el orden de la configuración. */
export function suggestDay(config: Config, entries: Entry[]): DayDef | null {
  if (config.days.length === 0) return null;
  const last = sortByDate(entries).pop();
  if (!last) return config.days[0];
  const i = config.days.findIndex((d) => d.id === last.dayId);
  if (i < 0) return config.days[0];
  return config.days[(i + 1) % config.days.length];
}

/** Horas que deben pasar para que se pueda contestar el dolor «a las 24 h». */
export const H24_OPEN_AFTER = 20 * HOUR;
/** Pasado este tiempo deja de recordarse (el dato ya no sería fiable). */
export const H24_EXPIRE_AFTER = 3 * DAY;

export function pending24h(entries: Entry[], now: number): { due: Entry[]; waiting: Entry[] } {
  const open = sortByDate(entries).filter((e) => e.knee24h == null && now - e.at < H24_EXPIRE_AFTER);
  return {
    due: open.filter((e) => now - e.at >= H24_OPEN_AFTER),
    waiting: open.filter((e) => now - e.at < H24_OPEN_AFTER),
  };
}

// ------------------------------------------------------------------ Semanas del programa

export const PROGRAM_WEEKS = 6;

export function mondayOf(ms: number): number {
  const d = new Date(ms);
  const back = (d.getDay() + 6) % 7; // lunes = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
}

function parseLocalDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
}

/** Inicio del programa: el configurado o el lunes de la semana del primer cuestionario (o de hoy). */
export function programStart(config: Config, entries: Entry[], now: number): number {
  const set = config.programStart ? parseLocalDate(config.programStart) : null;
  if (set != null) return mondayOf(set);
  const first = sortByDate(entries)[0];
  return mondayOf(first ? first.at : now);
}

export interface WeekRange {
  n: number;
  from: number;
  to: number;
  future: boolean;
  current: boolean;
}

function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** Semanas 1…6 (y las que haga falta si el programa se alarga). */
export function weekRanges(start: number, now: number): WeekRange[] {
  const out: WeekRange[] = [];
  for (let n = 1; ; n++) {
    const from = addDays(start, (n - 1) * 7);
    const to = addDays(start, n * 7);
    if (n > PROGRAM_WEEKS && from > now) break;
    out.push({ n, from, to, future: from > now, current: now >= from && now < to });
  }
  return out;
}

export function inRange<T extends { at: number }>(xs: T[], from: number, to: number): T[] {
  return sortByDate(xs).filter((x) => x.at >= from && x.at < to);
}

export interface WindowProgress extends ExerciseProgress {
  /** Referencia: última marca antes del periodo (o la primera dentro, si no hay anterior). */
  base: LoadRecord;
  /** Última marca dentro del periodo. */
  current: LoadRecord;
  /** Cambio de peso respecto a la referencia (kg); null si no hay referencia anterior. */
  deltaKg: number | null;
  deltaReps: number | null;
  /** true si la referencia es de antes del periodo. */
  hasBase: boolean;
}

/**
 * Progreso de cada ejercicio hecho en [from, to). El estado se calcula con todo el historial hasta «to»,
 * así una semana puede marcar «estancado» si arrastra semanas sin superar la mejor marca.
 */
export function progressInWindow(sessions: { at: number; exercises: ExerciseLog[] }[], from: number, to: number): WindowProgress[] {
  const upTo = sessions.filter((s) => s.at < to);
  const out: WindowProgress[] = [];
  for (const p of exerciseProgress(upTo)) {
    const inside = p.records.filter((r) => r.at >= from);
    if (inside.length === 0) continue;
    const before = p.records.filter((r) => r.at < from);
    const hasBase = before.length > 0;
    const base = hasBase ? before[before.length - 1] : inside[0];
    const current = inside[inside.length - 1];
    const comparable = hasBase || inside.length > 1;
    // Con un único registro en total no hay nada con qué comparar.
    const status: LoadStatus = comparable ? p.status : 'pocos';
    out.push({
      ...p,
      status,
      base,
      current,
      hasBase,
      deltaKg: comparable && base.kg != null && current.kg != null ? current.kg - base.kg : null,
      deltaReps: comparable && base.reps != null && current.reps != null ? current.reps - base.reps : null,
    });
  }
  return out;
}

export interface WeekStat {
  n: number;
  knee: number | null;
  kneeDuring: number | null;
  knee24h: number | null;
  energy: number | null;
  recovery: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  sessions: number;
  treadmill: Record<TreadmillRating, number>;
  treadmillMin: number | null;
}

/** Medias por semana para las gráficas de «Todo». */
export function weekStats(entries: Entry[], weeks: WeekRange[]): WeekStat[] {
  return weeks
    .filter((w) => !w.future)
    .map((w) => {
      const es = inRange(entries, w.from, w.to);
      const leg = es.filter((e) => e.isLeg);
      const tm = es.filter((e) => e.treadmill.done);
      const counts: Record<TreadmillRating, number> = { poco: 0, bien: 0, mucho: 0 };
      tm.forEach((e) => {
        if (e.treadmill.rating) counts[e.treadmill.rating]++;
      });
      return {
        n: w.n,
        knee: mean(leg.map(sessionMean)),
        kneeDuring: mean(leg.map((e) => e.kneeDuring)),
        knee24h: mean(leg.map((e) => e.knee24h)),
        energy: mean(es.map((e) => e.energy)),
        recovery: mean(es.map((e) => e.recovery)),
        sleepQuality: mean(es.map((e) => e.sleepQuality)),
        sleepHours: mean(es.map((e) => e.sleepHours)),
        sessions: es.length,
        treadmill: counts,
        treadmillMin: mean(tm.map((e) => e.treadmill.min)),
      };
    });
}

// ------------------------------------------------------------------ Resumen para el PDF

export interface Gain {
  name: string;
  base: LoadRecord;
  current: LoadRecord;
  /** Cambio de peso (kg) o, si el peso es el mismo, de repeticiones. */
  deltaKg: number | null;
  deltaReps: number | null;
  /** Porcentaje de mejora, para ordenar de más a menos. */
  pct: number;
}

export interface GainSummary {
  /** Solo los ejercicios que mejoran respecto a la referencia, de más a menos mejora. */
  gains: Gain[];
  /** Ejercicios con referencia para comparar. */
  compared: number;
  same: number;
  down: number;
  /** Ejercicios hechos por primera vez (sin referencia). */
  fresh: number;
}

/**
 * Ejercicios que mejoran en [from, to): la última marca del periodo frente a la última antes del periodo
 * (o la primera dentro, si es el primer periodo en que aparece). Mismo criterio que el resto del informe:
 * primero el peso y, con el mismo peso, las repeticiones.
 */
export function gainsInWindow(sessions: { at: number; exercises: ExerciseLog[] }[], from: number, to: number): GainSummary {
  const out: GainSummary = { gains: [], compared: 0, same: 0, down: 0, fresh: 0 };
  for (const p of progressInWindow(sessions, from, to)) {
    const comparable = p.hasBase || p.records.filter((r) => r.at >= from).length > 1;
    if (!comparable) {
      out.fresh++;
      continue;
    }
    out.compared++;
    const c = compareLoad(p.current, p.base);
    if (c < 0) out.down++;
    else if (c === 0) out.same++;
    else {
      const { base, current } = p;
      const kgUp = base.kg != null && current.kg != null && Math.abs(current.kg - base.kg) > 1e-9;
      const pct = kgUp
        ? base.kg! > 0
          ? ((current.kg! - base.kg!) / base.kg!) * 100
          : 100
        : base.reps != null && current.reps != null && base.reps > 0
          ? ((current.reps - base.reps) / base.reps) * 100
          : 0;
      out.gains.push({ name: p.name, base, current, deltaKg: p.deltaKg, deltaReps: p.deltaReps, pct });
    }
  }
  out.gains.sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name, 'es'));
  return out;
}

// ------------------------------------------------------------------ Cita con el dietista

/** Periodo del informe para el dietista: del día «from» a las 00:00 al final del día de la cita. */
export function dietitianPeriod(a: { date: string; from: string }): { from: number; to: number } | null {
  const from = parseLocalDate(a.from);
  const date = parseLocalDate(a.date);
  if (from == null || date == null) return null;
  return { from: Math.min(from, date), to: addDays(date, 1) };
}

/** Días naturales que faltan para la cita (0 = hoy, negativo = ya pasó). */
export function daysUntil(date: string, now: number): number | null {
  const d = parseLocalDate(date);
  return d == null ? null : calendarDayDiff(now, d);
}

/**
 * Semanas (de lunes a domingo) que tocan el periodo, recortadas a él. «n» es la semana del programa
 * (puede ser 0 o negativa si el periodo empieza antes que el programa).
 */
export function periodWeeks(programStartMs: number, from: number, to: number, now: number): WeekRange[] {
  const out: WeekRange[] = [];
  for (let ws = mondayOf(from); ws < to; ws = addDays(ws, 7)) {
    const a = Math.max(ws, from);
    const b = Math.min(addDays(ws, 7), to);
    const n = Math.round((ws - programStartMs) / (7 * DAY)) + 1;
    out.push({ n, from: a, to: b, future: a > now, current: now >= a && now < b });
  }
  return out;
}
