// Un solo nombre por ejercicio de Nivel Bestia.
// Nivel Bestia muestra en sus capturas nombres distintos de los que usa esta app («Peso muerto convencional»
// frente a «Peso muerto»). Si alguno se coló en los días o en las sesiones, el mismo ejercicio aparecía dos
// veces y las cargas se repartían entre las dos copias. Aquí se unifican al leer los datos.
import type { AppData, DayDef, Entry, ExerciseLog, LoadDay } from '../types.ts';
import { NB_NAMES, NB_OLD_NAMES, nbCodeOf } from './nivelbestia.ts';
import { normName } from './report.ts';

/** Nombre único de cada código: el antiguo si tus datos lo usan (historial), si no el de NB_NAMES. */
function canonicalNames(d: AppData): Map<string, string> {
  const used = new Set<string>();
  d.config.days.forEach((x) => x.exercises.forEach((n) => used.add(normName(n))));
  d.entries.forEach((e) => e.exercises.forEach((x) => used.add(normName(x.name))));
  d.loads.forEach((l) => l.exercises.forEach((x) => used.add(normName(x.name))));
  const out = new Map<string, string>();
  for (const code of Object.keys(NB_NAMES)) {
    const old = NB_OLD_NAMES[code];
    out.set(code, old && used.has(normName(old)) ? old : NB_NAMES[code]);
  }
  return out;
}

const hasValue = (x: ExerciseLog) => x.kg != null || x.reps != null;

/** Renombra y, si dos filas acaban siendo el mismo ejercicio, se queda con la primera que tenga datos. */
function mergeLogs<T extends ExerciseLog>(xs: T[], rename: (n: string) => string): T[] {
  const out: T[] = [];
  for (const x of xs) {
    const y = { ...x, name: rename(x.name) };
    const i = out.findIndex((o) => normName(o.name) === normName(y.name));
    if (i < 0) out.push(y);
    else if (!hasValue(out[i]) && hasValue(y)) out[i] = y;
  }
  return out;
}

function dedupeNames(xs: string[], rename: (n: string) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of xs.map(rename)) {
    if (seen.has(normName(n))) continue;
    seen.add(normName(n));
    out.push(n);
  }
  return out;
}

const sameNames = (a: { name: string }[], b: { name: string }[]) => a.length === b.length && a.every((x, i) => x.name === b[i].name);

export interface Canonicalized {
  data: AppData;
  /** Qué ha cambiado, para guardarlo una sola vez. */
  changedDays: boolean;
  changedEntries: Entry[];
  changedLoads: LoadDay[];
}

export function canonicalize(d: AppData): Canonicalized {
  const names = canonicalNames(d);
  const rename = (n: string) => {
    const code = nbCodeOf(n);
    return code ? (names.get(code) as string) : n;
  };
  let changedDays = false;
  const days: DayDef[] = d.config.days.map((day) => {
    const exercises = dedupeNames(day.exercises, rename);
    if (exercises.length !== day.exercises.length || exercises.some((n, i) => n !== day.exercises[i])) {
      changedDays = true;
      return { ...day, exercises };
    }
    return day;
  });
  const changedEntries: Entry[] = [];
  const entries = d.entries.map((e) => {
    const exercises = mergeLogs(e.exercises, rename);
    if (sameNames(exercises, e.exercises)) return e;
    const ne = { ...e, exercises };
    changedEntries.push(ne);
    return ne;
  });
  const changedLoads: LoadDay[] = [];
  const loads = d.loads.map((l) => {
    const exercises = mergeLogs(l.exercises, rename);
    if (sameNames(exercises, l.exercises)) return l;
    const nl = { ...l, exercises };
    changedLoads.push(nl);
    return nl;
  });
  return { data: { ...d, config: changedDays ? { ...d.config, days } : d.config, entries, loads }, changedDays, changedEntries, changedLoads };
}
