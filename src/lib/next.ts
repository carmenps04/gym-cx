import type { Routine, RoutineDay, Session } from '../types.ts';

export interface NextWorkout {
  routine: Routine;
  day: RoutineDay;
  /** Posición del día dentro de la rutina (1 = primer día). */
  number: number;
  total: number;
}

/**
 * Qué toca entrenar a continuación: el día que sigue al último entrenado de la rutina más reciente.
 * Tras el último día vuelve al primero. Si todavía no se ha entrenado ninguna rutina devuelve null.
 */
export function nextWorkout(routines: Routine[], sessions: Session[]): NextWorkout | null {
  const usable = routines.filter((r) => r.days.some((d) => d.items.length > 0));
  const byId = new Map(usable.map((r) => [r.id, r]));
  const last = sessions
    .filter((s) => byId.has(s.routineId))
    .sort((a, b) => b.endedAt - a.endedAt)[0];
  if (!last) return null;
  const routine = byId.get(last.routineId);
  if (!routine) return null;
  const days = routine.days.filter((d) => d.items.length > 0);
  const idx = days.findIndex((d) => d.id === last.dayId);
  const k = idx >= 0 ? (idx + 1) % days.length : 0;
  const day = days[k];
  if (!day) return null;
  return { routine, day, number: k + 1, total: days.length };
}
