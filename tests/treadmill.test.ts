import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalizeTreadmill, segmentsOf, segmentsText, summarizeSegments } from '../src/lib/treadmill.ts';
import type { Treadmill } from '../src/types.ts';

test('varios tramos: minutos totales y medias ponderadas por tiempo', () => {
  const s = summarizeSegments([
    { min: 3, speed: 5, incline: 4 },
    { min: 10, speed: 4, incline: 3 },
    { min: 5, speed: 3, incline: 2 },
  ]);
  assert.equal(s.min, 18);
  assert.equal(s.speed, 3.89); // (15 + 40 + 15) / 18
  assert.equal(s.incline, 2.89); // (12 + 30 + 10) / 18
});

test('sesión antigua sin tramos se lee como un solo tramo', () => {
  const old: Treadmill = { done: true, min: 20, speed: 5, incline: 6, rating: 'bien' };
  assert.deepEqual(segmentsOf(old), [{ min: 20, speed: 5, incline: 6 }]);
  assert.deepEqual(finalizeTreadmill(old), { ...old, segments: [{ min: 20, speed: 5, incline: 6 }] });
});

test('al guardar se quitan los tramos vacíos y se recalcula el resumen', () => {
  const t = finalizeTreadmill({ done: true, min: null, speed: null, incline: null, rating: null, segments: [{ min: 10, speed: 4, incline: null }, { min: null, speed: null, incline: null }] });
  assert.equal(t.segments?.length, 1);
  assert.equal(t.min, 10);
  assert.equal(t.speed, 4);
  assert.equal(t.incline, null);
});

test('sin minutos, media simple', () => {
  assert.equal(summarizeSegments([{ min: null, speed: 4, incline: null }, { min: null, speed: 5, incline: null }]).speed, 4.5);
});

test('texto de tramos para el CSV', () => {
  const t: Treadmill = { done: true, min: 13, speed: null, incline: null, rating: null, segments: [{ min: 3, speed: 5.5, incline: 4 }, { min: 10, speed: 4, incline: null }] };
  assert.equal(segmentsText(t), '3 min · 5,5 km/h · 4 %; 10 min · 4 km/h');
});
