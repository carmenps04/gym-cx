import type { LoggedSet, Session, StrengthEntry } from '../types.ts';
import { addDays, isoDate, startOfWeek } from './util.ts';

const doneSets = (sets: LoggedSet[]) => sets.filter((s) => s.done && s.reps > 0);

export function sessionVolume(s: Session): number {
  let v = 0;
  for (const e of s.entries) if (e.kind === 'strength') for (const st of doneSets(e.sets)) v += st.weight * st.reps;
  return v;
}
export function sessionSetCount(s: Session): number {
  let n = 0;
  for (const e of s.entries) if (e.kind === 'strength') n += doneSets(e.sets).length;
  return n;
}

/** Estimación de 1RM (Epley). Poco fiable por encima de ~12 repeticiones. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

function strengthEntries(s: Session, exerciseId: string): StrengthEntry[] {
  return s.entries.filter((e): e is StrengthEntry => e.kind === 'strength' && e.exerciseId === exerciseId);
}

/** Series de la última sesión (más reciente) en la que se hizo el ejercicio. */
export function lastSets(sessions: Session[], exerciseId: string): LoggedSet[] | null {
  const sorted = [...sessions].sort((a, b) => b.endedAt - a.endedAt);
  for (const s of sorted) {
    const sets = strengthEntries(s, exerciseId).flatMap((e) => doneSets(e.sets));
    if (sets.length) return sets;
  }
  return null;
}

export interface SeriesPoint {
  date: number;
  maxWeight: number;
  best1rm: number;
  volume: number;
}
export function exerciseSeries(sessions: Session[], exerciseId: string): SeriesPoint[] {
  const pts: SeriesPoint[] = [];
  for (const s of [...sessions].sort((a, b) => a.endedAt - b.endedAt)) {
    const sets = strengthEntries(s, exerciseId).flatMap((e) => doneSets(e.sets));
    if (!sets.length) continue;
    pts.push({
      date: s.endedAt,
      maxWeight: Math.max(...sets.map((x) => x.weight)),
      best1rm: Math.max(...sets.map((x) => e1rm(x.weight, x.reps))),
      volume: sets.reduce((a, x) => a + x.weight * x.reps, 0),
    });
  }
  return pts;
}

export interface Best {
  exerciseId: string;
  maxWeight: number;
  date: number;
  sessions: number;
}
export function bestByExercise(sessions: Session[]): Best[] {
  const map = new Map<string, Best>();
  for (const s of sessions) {
    const seen = new Set<string>();
    for (const e of s.entries) {
      if (e.kind !== 'strength') continue;
      const sets = doneSets(e.sets);
      if (!sets.length) continue;
      const w = Math.max(...sets.map((x) => x.weight));
      const cur = map.get(e.exerciseId);
      if (!seen.has(e.exerciseId)) {
        seen.add(e.exerciseId);
        if (cur) cur.sessions += 1;
      }
      if (!cur) map.set(e.exerciseId, { exerciseId: e.exerciseId, maxWeight: w, date: s.endedAt, sessions: 1 });
      else if (w > cur.maxWeight) {
        cur.maxWeight = w;
        cur.date = s.endedAt;
      }
    }
  }
  return [...map.values()];
}

/** Ejercicios cuyo peso máximo en `fresh` supera el de todas las demás sesiones (que deben existir). */
export function findRecords(previous: Session[], fresh: Session): { exerciseId: string; weight: number }[] {
  const prev = bestByExercise(previous);
  const out: { exerciseId: string; weight: number }[] = [];
  for (const e of fresh.entries) {
    if (e.kind !== 'strength') continue;
    const sets = doneSets(e.sets);
    if (!sets.length) continue;
    const w = Math.max(...sets.map((x) => x.weight));
    const before = prev.find((p) => p.exerciseId === e.exerciseId);
    if (before && w > before.maxWeight && w > 0 && !out.some((o) => o.exerciseId === e.exerciseId)) out.push({ exerciseId: e.exerciseId, weight: w });
  }
  return out;
}

export interface WeekBucket {
  start: Date;
  sessions: number;
  volume: number;
}
export function weeklyBuckets(sessions: Session[], weeks: number, now: Date): WeekBucket[] {
  const first = addDays(startOfWeek(now), -7 * (weeks - 1));
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({ start: addDays(first, 7 * i), sessions: 0, volume: 0 }));
  for (const s of sessions) {
    const t = new Date(s.endedAt);
    const idx = Math.floor((startOfWeek(t).getTime() - first.getTime()) / (7 * 86400000) + 0.01);
    if (idx >= 0 && idx < weeks) {
      buckets[idx].sessions += 1;
      buckets[idx].volume += sessionVolume(s);
    }
  }
  return buckets;
}

export function trainedDays(sessions: Session[]): Set<string> {
  return new Set(sessions.map((s) => isoDate(new Date(s.endedAt))));
}

/** Semanas consecutivas cumpliendo el objetivo semanal. La semana en curso no rompe la racha si aún no se cumple. */
export function weekStreak(sessions: Session[], weeklyGoal: number, now: Date): number {
  const goal = Math.max(1, weeklyGoal);
  const buckets = weeklyBuckets(sessions, 104, now);
  let streak = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    const met = buckets[i].sessions >= goal;
    if (met) streak++;
    else if (i !== buckets.length - 1) break;
  }
  return streak;
}
