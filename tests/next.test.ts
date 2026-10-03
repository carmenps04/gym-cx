import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextWorkout } from '../src/lib/next.ts';
import type { Routine, Session } from '../src/types.ts';

const item = (id: string) => ({ kind: 'strength' as const, id, exerciseId: 'x', sets: 3, reps: 10 });
const routine = (id: string, dayIds: string[]): Routine => ({
  id,
  name: `Rutina ${id}`,
  createdAt: 0,
  updatedAt: 0,
  days: dayIds.map((d, i) => ({ id: d, name: `Día ${i + 1}`, weekdays: [], items: [item(`${d}-1`)] })),
});
const session = (routineId: string, dayId: string, endedAt: number): Session => ({
  id: `${routineId}-${dayId}-${endedAt}`,
  routineId,
  routineName: routineId,
  dayId,
  dayName: dayId,
  startedAt: endedAt - 1,
  endedAt,
  entries: [],
  updatedAt: endedAt,
});

test('sin sesiones no hay siguiente entrenamiento', () => {
  assert.equal(nextWorkout([routine('r', ['a', 'b'])], []), null);
});
test('tras entrenar el día 1 toca el día 2', () => {
  const n = nextWorkout([routine('r', ['a', 'b', 'c'])], [session('r', 'a', 100)]);
  assert.equal(n?.day.id, 'b');
  assert.equal(n?.number, 2);
  assert.equal(n?.total, 3);
});
test('tras el último día vuelve al primero', () => {
  assert.equal(nextWorkout([routine('r', ['a', 'b'])], [session('r', 'b', 100)])?.day.id, 'a');
});
test('usa la rutina entrenada más recientemente', () => {
  const rs = [routine('r1', ['a', 'b']), routine('r2', ['c', 'd'])];
  const n = nextWorkout(rs, [session('r1', 'a', 100), session('r2', 'c', 200)]);
  assert.equal(n?.routine.id, 'r2');
  assert.equal(n?.day.id, 'd');
});
test('ignora sesiones de rutinas eliminadas', () => {
  assert.equal(nextWorkout([routine('r', ['a', 'b'])], [session('borrada', 'z', 100)]), null);
});
test('si el último día entrenado ya no existe empieza por el primero', () => {
  assert.equal(nextWorkout([routine('r', ['a', 'b'])], [session('r', 'viejo', 100)])?.day.id, 'a');
});
