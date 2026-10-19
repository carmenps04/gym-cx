import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gainsInWindow } from '../src/lib/report.ts';

const day = (m: number, d: number) => new Date(2026, m - 1, d, 19).getTime();
const s = (at: number, xs: [string, number | null, number | null][]) => ({ at, exercises: xs.map(([name, kg, reps]) => ({ name, kg, reps })) });

const sessions = [
  s(day(10, 1), [['Prensa', 60, 12], ['Remo', 30, 10], ['Curl', 10, 12], ['Jalón', 40, 10]]),
  s(day(10, 13), [['Prensa', 65, 12], ['Remo', 30, 12], ['Curl', 10, 12], ['Jalón', 35, 10], ['Hip thrust', 50, 10]]),
];

test('solo aparecen los ejercicios que suben, de más a menos', () => {
  const r = gainsInWindow(sessions, day(10, 12) - 19 * 3600_000, day(10, 19));
  assert.deepEqual(r.gains.map((g) => g.name), ['Remo', 'Prensa']); // +20 % reps, +8,3 % kg
  assert.equal(r.compared, 4);
  assert.equal(r.same, 1);
  assert.equal(r.down, 1);
  assert.equal(r.fresh, 1);
  const prensa = r.gains.find((g) => g.name === 'Prensa')!;
  assert.equal(prensa.base.kg, 60);
  assert.equal(prensa.current.kg, 65);
});

test('sin cargas en el periodo no hay nada que comparar', () => {
  const r = gainsInWindow(sessions, day(11, 1), day(11, 8));
  assert.equal(r.gains.length, 0);
  assert.equal(r.compared, 0);
});

import { daysUntil, dietitianPeriod, periodWeeks } from '../src/lib/report.ts';

test('periodo del dietista: desde el día que se añade hasta el final del día de la cita', () => {
  const p = dietitianPeriod({ from: '2026-10-19', date: '2026-11-04' })!;
  assert.equal(p.from, new Date(2026, 9, 19).getTime());
  assert.equal(p.to, new Date(2026, 10, 5).getTime());
  assert.equal(daysUntil('2026-11-04', day(10, 19)), 16);
  assert.equal(daysUntil('2026-10-19', day(10, 19)), 0);
});

test('semanas del periodo recortadas y numeradas como en el programa', () => {
  const start = new Date(2026, 8, 28).getTime(); // lunes 28 sep = semana 1
  const p = dietitianPeriod({ from: '2026-10-15', date: '2026-10-28' })!;
  const w = periodWeeks(start, p.from, p.to, day(10, 19));
  assert.deepEqual(w.map((x) => x.n), [3, 4, 5]);
  assert.equal(w[0].from, p.from); // empieza el jueves 15, no el lunes
  assert.equal(w[2].to, p.to);
  assert.deepEqual(w.map((x) => [x.current, x.future]), [[false, false], [true, false], [false, true]]);
});
