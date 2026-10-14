import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY,
  HOUR,
  exerciseProgress,
  feelSummary,
  kneeSummary,
  lastLog,
  pending24h,
  suggestDay,
  treadmillSummary,
  wellSummary,
} from '../src/lib/report.ts';
import type { Config, Entry, ExerciseLog } from '../src/types.ts';

const T0 = new Date(2026, 9, 1, 19, 0).getTime();
let n = 0;
function entry(dayOffset: number, p: Partial<Entry> = {}): Entry {
  return {
    id: `e${n++}`,
    at: T0 + dayOffset * DAY,
    dayId: 'd1',
    dayName: 'Pierna',
    isLeg: true,
    kneeDuring: null,
    knee24h: null,
    exercises: [],
    treadmill: { done: false, min: null, speed: null, incline: null, rating: null },
    energy: null,
    sleepHours: null,
    sleepQuality: null,
    recovery: null,
    dayFeel: null,
    note: '',
    updatedAt: 0,
    ...p,
  };
}
const ex = (name: string, kg: number | null, reps: number | null): ExerciseLog => ({ name, kg, reps });
const status = (es: Entry[], name: string) => exerciseProgress(es).find((p) => p.name === name)?.status;

test('carga: sube de peso → progresa', () => {
  const es = [entry(0, { exercises: [ex('Sentadilla', 40, 8)] }), entry(3, { exercises: [ex('Sentadilla', 42.5, 6)] })];
  assert.equal(status(es, 'Sentadilla'), 'progresa');
});

test('carga: mismo peso y más repeticiones también es progreso', () => {
  const es = [entry(0, { exercises: [ex('Prensa', 100, 8)] }), entry(3, { exercises: [ex('Prensa', 100, 10)] })];
  assert.equal(status(es, 'Prensa'), 'progresa');
});

test('carga: dos sesiones seguidas sin superar la mejor marca → estancado', () => {
  const es = [
    entry(0, { exercises: [ex('Hip thrust', 60, 10)] }),
    entry(3, { exercises: [ex('Hip thrust', 60, 10)] }),
    entry(6, { exercises: [ex('Hip thrust', 60, 9)] }),
  ];
  assert.equal(status(es, 'Hip thrust'), 'estancado');
});

test('carga: una sesión igual → mantiene; una peor → baja', () => {
  assert.equal(status([entry(0, { exercises: [ex('A', 20, 10)] }), entry(2, { exercises: [ex('A', 20, 10)] })], 'A'), 'mantiene');
  assert.equal(status([entry(0, { exercises: [ex('B', 20, 10)] }), entry(2, { exercises: [ex('B', 17.5, 10)] })], 'B'), 'baja');
});

test('carga: nombres con distinta mayúscula o tilde cuentan como el mismo ejercicio', () => {
  const es = [entry(0, { exercises: [ex('Extensión cuádriceps', 30, 12)] }), entry(3, { exercises: [ex('extension cuadriceps ', 35, 12)] })];
  const p = exerciseProgress(es);
  assert.equal(p.length, 1);
  assert.equal(p[0].status, 'progresa');
});

test('carga: un solo registro → pocos datos; filas vacías se ignoran', () => {
  const es = [entry(0, { exercises: [ex('C', 10, 10), ex('D', null, null)] })];
  const p = exerciseProgress(es);
  assert.deepEqual(p.map((x) => [x.name, x.status]), [['C', 'pocos']]);
});

test('lastLog devuelve la última carga anotada', () => {
  const es = [entry(0, { exercises: [ex('Sentadilla', 40, 8)] }), entry(3, { exercises: [ex('Sentadilla', 45, 6)] }), entry(5, { exercises: [ex('Otro', 1, 1)] })];
  assert.equal(lastLog(es, 'sentadilla')?.kg, 45);
  assert.equal(lastLog(es, 'Nada'), null);
});

test('rodilla: media por sesión de pierna y tendencia a la baja', () => {
  const es = [
    entry(0, { kneeDuring: 6, knee24h: 7 }),
    entry(3, { kneeDuring: 5, knee24h: 6 }),
    entry(7, { kneeDuring: 4, knee24h: 4 }),
    entry(10, { kneeDuring: 3, knee24h: 2 }),
    entry(12, { isLeg: false, kneeDuring: 1, knee24h: 1 }),
  ];
  const k = kneeSummary(es);
  assert.equal(k.points.length, 4);
  assert.equal(k.points[0].mean, 6.5);
  assert.equal(k.avgDuring, 4.5);
  assert.equal(k.avgOther, 1);
  assert.equal(k.trend, 'baja');
  assert.equal(k.worseNextDay, 2);
});

test('rodilla: sesión sin dato a 24 h usa solo el de durante', () => {
  const k = kneeSummary([entry(0, { kneeDuring: 4 })]);
  assert.equal(k.points[0].mean, 4);
  assert.equal(k.trend, 'pocos');
});

test('bienestar: descanso entre sesiones y recuperación según descanso', () => {
  const es = [
    entry(0, { recovery: 3 }),
    entry(1, { recovery: 2, energy: 2 }),
    entry(4, { recovery: 5 }),
  ];
  const w = wellSummary(es);
  assert.deepEqual(w.points.map((p) => p.restDays), [null, 0, 2]);
  assert.equal(w.recoveryShortRest, 2);
  assert.equal(w.recoveryLongRest, 5);
  assert.equal(w.lowSessions.length, 1);
});

test('cinta: veredicto por mayoría y empate como mixto', () => {
  const tm = (rating: 'poco' | 'bien' | 'mucho') => ({ done: true, min: 15, speed: 5, incline: 6, rating });
  const a = treadmillSummary([entry(0, { treadmill: tm('mucho'), knee24h: 6 }), entry(2, { treadmill: tm('mucho'), knee24h: 4 }), entry(4, { treadmill: tm('bien') }), entry(5, { knee24h: 2 })]);
  assert.equal(a.verdict, 'mucho');
  assert.equal(a.knee24WithTreadmill, 5);
  assert.equal(a.knee24WithoutTreadmill, 2);
  const b = treadmillSummary([entry(0, { treadmill: tm('poco') }), entry(2, { treadmill: tm('bien') })]);
  assert.equal(b.verdict, 'mixto');
});

const config: Config = {
  days: [
    { id: 'd1', name: 'Pierna', isLeg: true, exercises: [] },
    { id: 'd2', name: 'Torso', isLeg: false, exercises: [] },
    { id: 'd3', name: 'Glúteo', isLeg: true, exercises: [] },
  ],
  updatedAt: 0,
};

test('sensaciones: mejor y peor día', () => {
  const es = [
    entry(0, { dayFeel: 4 }),
    entry(1, { dayId: 'd2', dayName: 'Torso', dayFeel: 2, note: 'Pesado' }),
    entry(3, { dayFeel: 5 }),
    entry(4, { dayId: 'd2', dayName: 'Torso', dayFeel: 3 }),
  ];
  const f = feelSummary(es, config);
  assert.equal(f.best?.name, 'Pierna');
  assert.equal(f.best?.avgFeel, 4.5);
  assert.equal(f.worst?.name, 'Torso');
  assert.equal(f.days[1].notes[0].text, 'Pesado');
});

test('día sugerido: el siguiente al último, dando la vuelta', () => {
  assert.equal(suggestDay(config, [])?.id, 'd1');
  assert.equal(suggestDay(config, [entry(0, { dayId: 'd2' })])?.id, 'd3');
  assert.equal(suggestDay(config, [entry(0, { dayId: 'd3' })])?.id, 'd1');
});

test('pendientes de 24 h: se abren a las 20 h y caducan a los 3 días', () => {
  const e = entry(0);
  assert.equal(pending24h([e], e.at + 10 * HOUR).waiting.length, 1);
  assert.equal(pending24h([e], e.at + 21 * HOUR).due.length, 1);
  assert.equal(pending24h([e], e.at + 4 * DAY).due.length, 0);
  assert.equal(pending24h([{ ...e, knee24h: 3 }], e.at + 21 * HOUR).due.length, 0);
});

