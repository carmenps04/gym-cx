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
