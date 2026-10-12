import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mondayOf, programStart, progressInWindow, weekRanges, weekStats } from '../src/lib/report.ts';
import type { Config, Entry } from '../src/types.ts';

const day = (y: number, m: number, d: number, h = 19) => new Date(y, m - 1, d, h).getTime();
const cfg = (programStart?: string): Config => ({ days: [], updatedAt: 0, programStart });

function entry(at: number, p: Partial<Entry> = {}): Entry {
  return {
    id: String(at), at, dayId: 'd', dayName: 'D', isLeg: true, kneeDuring: null, knee24h: null, exercises: [],
    treadmill: { done: false, min: null, speed: null, incline: null, rating: null },
    energy: null, sleepHours: null, sleepQuality: null, recovery: null, dayFeel: null, note: '', updatedAt: 0, ...p,
  };
}

test('lunes de la semana', () => {
  assert.equal(mondayOf(day(2026, 10, 15)), day(2026, 10, 12, 0)); // jueves → lunes 12
  assert.equal(mondayOf(day(2026, 10, 18)), day(2026, 10, 12, 0)); // domingo → lunes 12
  assert.equal(mondayOf(day(2026, 10, 12, 8)), day(2026, 10, 12, 0));
});

test('inicio del programa: configurado, primera sesión o hoy', () => {
  const now = day(2026, 10, 20);
  assert.equal(programStart(cfg('2026-10-14'), [], now), day(2026, 10, 12, 0));
  assert.equal(programStart(cfg(), [entry(day(2026, 10, 7))], now), day(2026, 10, 5, 0));
  assert.equal(programStart(cfg(), [], now), day(2026, 10, 19, 0));
});

test('semanas 1-6 siempre; la 7 solo si ya ha empezado', () => {
  const start = day(2026, 10, 12, 0);
  const w = weekRanges(start, day(2026, 10, 20));
  assert.equal(w.length, 6);
  assert.deepEqual(w.map((x) => [x.n, x.current, x.future]).slice(0, 3), [[1, false, false], [2, true, false], [3, false, true]]);
  assert.equal(weekRanges(start, day(2026, 11, 24)).length, 7);
});

test('progreso por semana compara con la última vez anterior a la semana', () => {
  const s = [
    { at: day(2026, 10, 1), exercises: [{ name: 'Prensa', kg: 60, reps: 12 }] }, // antes del programa
    { at: day(2026, 10, 13), exercises: [{ name: 'Prensa', kg: 60, reps: 12 }, { name: 'Nuevo', kg: 10, reps: 10 }] }, // semana 1
    { at: day(2026, 10, 20), exercises: [{ name: 'Prensa', kg: 70, reps: 10 }] }, // semana 2
    { at: day(2026, 10, 27), exercises: [{ name: 'Prensa', kg: 70, reps: 10 }] }, // semana 3
    { at: day(2026, 11, 3), exercises: [{ name: 'Prensa', kg: 70, reps: 9 }] }, // semana 4
  ];
  const w = weekRanges(day(2026, 10, 12, 0), day(2026, 11, 5));
  const at = (n: number) => progressInWindow(s, w[n - 1].from, w[n - 1].to);
  const p1 = at(1);
  assert.deepEqual(p1.map((x) => [x.name, x.status]), [['Prensa', 'mantiene'], ['Nuevo', 'pocos']]);
  assert.equal(at(2)[0].status, 'progresa');
  assert.equal(at(2)[0].deltaKg, 10);
  assert.equal(at(3)[0].status, 'mantiene');
  assert.equal(at(4)[0].status, 'estancado');
  // «Todo» el programa: de 60 (antes de empezar) a 70
  const all = progressInWindow(s, w[0].from, w[w.length - 1].to);
  assert.equal(all.find((x) => x.name === 'Prensa')!.deltaKg, 10);
});

test('medias semanales', () => {
  const start = day(2026, 10, 12, 0);
  const w = weekRanges(start, day(2026, 10, 21));
  const es = [
    entry(day(2026, 10, 13), { kneeDuring: 4, knee24h: 6, energy: 3, treadmill: { done: true, min: 20, speed: 5, incline: 5, rating: 'mucho' } }),
    entry(day(2026, 10, 15), { isLeg: false, kneeDuring: 1, knee24h: 1, energy: 5 }),
    entry(day(2026, 10, 20), { kneeDuring: 2, knee24h: 2, energy: 4 }),
  ];
  const st = weekStats(es, w);
  assert.equal(st.length, 2); // las semanas futuras no se incluyen
  assert.equal(st[0].knee, 5); // solo la sesión de pierna
  assert.equal(st[0].energy, 4);
  assert.equal(st[0].treadmill.mucho, 1);
  assert.equal(st[1].knee, 2);
});
