import type { Draft, Routine, RoutineDay, RoutineItem, Weekday } from '../types';
import { uid } from './util';

export const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function newDay(n: number): RoutineDay {
  return { id: uid(), name: `Día ${n}`, weekdays: [], items: [] };
}
export function newRoutine(n: number): Routine {
  const now = Date.now();
  return { id: uid(), name: `Rutina ${n}`, days: [newDay(1)], createdAt: now, updatedAt: now };
}
export function exerciseCount(r: Routine): number {
  return r.days.reduce((a, d) => a + d.items.length, 0);
}
export function weekdaysLabel(d: RoutineDay): string {
  if (!d.weekdays.length) return 'Sin día fijo';
  return [...d.weekdays].sort().map((w) => WEEKDAY_NAMES[w].slice(0, 3)).join(', ');
}
export function toggleWeekday(list: Weekday[], w: Weekday): Weekday[] {
  return list.includes(w) ? list.filter((x) => x !== w) : ([...list, w].sort() as Weekday[]);
}
export function cloneItem(i: RoutineItem): RoutineItem {
  return { ...i, id: uid() };
}

// ---- Borrador del entrenamiento en curso (solo en este dispositivo)
const DRAFT_KEY = 'gym.draft.v1';
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(d: Draft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
}
export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}
