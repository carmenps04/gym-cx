import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchExercises, emptyQuery } from '../src/lib/search.ts';
import type { Ex } from '../src/lib/search.ts';
import { e1rm, findRecords, lastSets, weeklyBuckets, weekStreak, sessionVolume } from '../src/lib/stats.ts';
import { startOfWeek, isoDate, kgToUnit, unitToKg, normalize } from '../src/lib/util.ts';
import type { Session } from '../src/types.ts';

const ex = (i: string, n: string, e: string, p: string[], q: string, c = 'strength', s: string[] = []): Ex => ({ i, n, e, p, s, q, l: 'beginner', c, t: [], m: 2 });
const list: Ex[] = [
  ex('a', 'Press de banca con barra', 'Barbell Bench Press', ['chest'], 'barbell', 'strength', ['triceps']),
  ex('b', 'Press de banca con mancuernas', 'Dumbbell Bench Press', ['chest'], 'dumbbell'),
  ex('c', 'Extensión de tríceps en polea', 'Triceps Pushdown', ['triceps'], 'cable'),
  ex('d', 'Flexiones', 'Pushups', ['chest'], 'body only'),
  ex('e', 'Estiramiento de pecho', 'Chest Stretch', ['chest'], 'body only', 'stretching'),
  ex('f', 'Ciclismo', 'Bicycling', ['quadriceps'], 'other', 'cardio'),
];

test('sin filtros devuelve todo menos cardio', () => {
  assert.deepEqual(searchExercises(list, emptyQuery).map((x) => x.i).sort(), ['a', 'b', 'c', 'd', 'e']);
});
test('músculo + material se combinan con AND', () => {
  const r = searchExercises(list, { ...emptyQuery, muscles: ['chest'], equipment: ['dumbbell'] });
  assert.deepEqual(r.map((x) => x.i), ['b']);
});
test('varios materiales se combinan con OR', () => {
  const r = searchExercises(list, { ...emptyQuery, muscles: ['chest'], equipment: ['dumbbell', 'barbell'] });
  assert.deepEqual(r.map((x) => x.i).sort(), ['a', 'b']);
});
test('texto ignora tildes y busca en español e inglés', () => {
  assert.deepEqual(searchExercises(list, { ...emptyQuery, text: 'triceps' }).map((x) => x.i).sort(), ['a', 'c'].filter((i) => i === 'c'));
  assert.deepEqual(searchExercises(list, { ...emptyQuery, text: 'bench dumbbell' }).map((x) => x.i), ['b']);
  assert.deepEqual(searchExercises(list, { ...emptyQuery, text: 'extension' }).map((x) => x.i), ['c']);
});
test('músculos secundarios solo si se pide', () => {
  assert.deepEqual(searchExercises(list, { ...emptyQuery, muscles: ['triceps'] }).map((x) => x.i), ['c']);
  assert.deepEqual(searchExercises(list, { ...emptyQuery, muscles: ['triceps'], includeSecondary: true }).map((x) => x.i).sort(), ['a', 'c']);
});
test('filtro por tipo', () => {
  assert.deepEqual(searchExercises(list, { ...emptyQuery, type: 'estiramiento' }).map((x) => x.i), ['e']);
});

const mkSession = (id: string, end: number, exerciseId: string, sets: [number, number, boolean][]): Session => ({
  id, routineId: 'r', routineName: 'R', dayId: 'd', dayName: 'D', startedAt: end - 3600000, endedAt: end, updatedAt: end,
  entries: [{ kind: 'strength', itemId: 'i', exerciseId, sets: sets.map(([weight, reps, done]) => ({ weight, reps, done })) }],
});

test('volumen solo cuenta series hechas', () => {
  const s = mkSession('1', 1, 'a', [[50, 10, true], [50, 10, false], [60, 5, true]]);
  assert.equal(sessionVolume(s), 800);
});
test('e1RM Epley', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.ok(Math.abs(e1rm(100, 10) - 133.33) < 0.01);
  assert.equal(e1rm(0, 10), 0);
});
test('récords: solo si hay marca previa y se supera', () => {
  const old = mkSession('1', 1000, 'a', [[80, 5, true]]);
  const better = mkSession('2', 2000, 'a', [[85, 5, true]]);
  const same = mkSession('3', 3000, 'a', [[80, 5, true]]);
  const first = mkSession('4', 4000, 'zzz', [[10, 5, true]]);
  assert.deepEqual(findRecords([old], better), [{ exerciseId: 'a', weight: 85 }]);
  assert.deepEqual(findRecords([old], same), []);
  assert.deepEqual(findRecords([old], first), []);
});
test('últimas series usan la sesión más reciente con series hechas', () => {
  const s1 = mkSession('1', 1000, 'a', [[70, 8, true]]);
  const s2 = mkSession('2', 2000, 'a', [[75, 8, false]]);
  assert.deepEqual(lastSets([s1, s2], 'a'), [{ weight: 70, reps: 8, done: true }]);
});
test('semanas empiezan en lunes', () => {
  assert.equal(isoDate(startOfWeek(new Date(2026, 9, 1))), '2026-09-28'); // jueves 1-oct-2026
  assert.equal(isoDate(startOfWeek(new Date(2026, 9, 4))), '2026-09-28'); // domingo
  assert.equal(isoDate(startOfWeek(new Date(2026, 9, 5))), '2026-10-05'); // lunes
});
test('buckets semanales y racha', () => {
  const now = new Date(2026, 9, 1, 12);
  const at = (y: number, m: number, d: number) => new Date(y, m, d, 10).getTime();
  const ss = [
    mkSession('a', at(2026, 8, 29), 'x', [[1, 1, true]]), // lunes 28? 29-sep (esta semana)
    mkSession('b', at(2026, 8, 30), 'x', [[1, 1, true]]),
    mkSession('c', at(2026, 8, 22), 'x', [[1, 1, true]]), // semana anterior
    mkSession('d', at(2026, 8, 23), 'x', [[1, 1, true]]),
  ];
  const b = weeklyBuckets(ss, 4, now);
  assert.equal(b.length, 4);
  assert.equal(b[3].sessions, 2);
  assert.equal(b[2].sessions, 2);
  assert.equal(weekStreak(ss, 2, now), 2);
  assert.equal(weekStreak(ss, 3, now), 0);
});
test('conversión de unidades', () => {
  assert.equal(kgToUnit(100, 'lb'), 220.5);
  assert.equal(unitToKg(220.5, 'lb'), 100.02);
  assert.equal(normalize('Tríceps ÁÉ'), 'triceps ae');
});

import { proposeExercises } from '../src/lib/propose.ts';
test('proposeExercises respeta músculo, material, exclusiones y límite', () => {
  const pool: Ex[] = [
    ex('p1', 'Press 1', 'P1', ['chest'], 'barbell'),
    ex('p2', 'Press 2', 'P2', ['chest'], 'dumbbell'),
    ex('p3', 'Press 3', 'P3', ['chest'], 'dumbbell'),
    ex('p4', 'Press 4', 'P4', ['chest'], 'dumbbell'),
    ex('t1', 'Tríceps 1', 'T1', ['triceps'], 'dumbbell'),
    ex('s1', 'Estiramiento', 'S1', ['chest'], 'dumbbell', 'stretching'),
  ];
  const fixed = () => 0.5;
  const all = proposeExercises(pool, 'chest', [], new Set(), 3, fixed);
  assert.equal(all.length, 3);
  assert.ok(all.every((e) => e.p.includes('chest') && e.c !== 'stretching'));
  const dumb = proposeExercises(pool, 'chest', ['dumbbell'], new Set(['p2']), 5, fixed).map((e) => e.i).sort();
  assert.deepEqual(dumb, ['p3', 'p4']);
  assert.deepEqual(proposeExercises(pool, 'chest', ['cable'], new Set(), 3, fixed), []);
});
