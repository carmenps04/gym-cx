import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchName, parseOcrText, setsInLine, similarity } from '../src/lib/ocrParse.ts';

const known = ['Prensa de piernas', 'Extensión de cuádriceps', 'Curl femoral sentado', 'Hip thrust en máquina', 'Press banca', 'Plancha'];

test('series en distintos formatos', () => {
  assert.deepEqual(setsInLine('20 kg × 6'), [{ kg: 20, reps: 6 }]);
  assert.deepEqual(setsInLine('Serie 2   22,5 kg x 8'), [{ kg: 22.5, reps: 8 }]);
  assert.deepEqual(setsInLine('100kg 12 reps'), [{ kg: 100, reps: 12 }]);
  assert.deepEqual(setsInLine('12 reps · 40 kg'), [{ kg: 40, reps: 12 }]);
  assert.deepEqual(setsInLine('45 reps'), [{ kg: null, reps: 45 }]);
  assert.deepEqual(setsInLine('3O kg x 1O'), [{ kg: 30, reps: 10 }]); // O leída en vez de 0
  assert.deepEqual(setsInLine('COMPLETAR EJERCICIO'), []);
  assert.deepEqual(setsInLine('999 kg x 5'), []); // fuera de rango
});

test('nombres con errores de lectura se asocian al ejercicio conocido', () => {
  assert.equal(matchName('Extension de cuadriceps', known), 'Extensión de cuádriceps');
  assert.equal(matchName('PRENSA DE PlERNAS', known), 'Prensa de piernas');
  assert.equal(matchName('+ AÑADIR SERIE', known), null);
  assert.ok(similarity('Curl femoral sentado', 'Curl femoral sentad0') > 0.8);
});

test('texto completo: cada serie va al ejercicio de arriba y se queda la mejor', () => {
  const text = `
    9:41
    Día 3
    Prensa de piernas
    1   100 kg x 12
    2   110 kg x 10
    3   110 kg x 12
    + AÑADIR SERIE
    Extension de cuadriceps
    30 kg x 12
    30 kg x 11
    Plancha
    45 reps
  `;
  const r = parseOcrText(text, known);
  assert.deepEqual(
    r.map((e) => [e.name, e.best?.kg ?? null, e.best?.reps, e.sets.length]),
    [
      ['Prensa de piernas', 110, 12, 3],
      ['Extensión de cuádriceps', 30, 12, 2],
      ['Plancha', null, 45, 1],
    ],
  );
});

test('el mismo ejercicio en dos capturas se une', () => {
  const r = parseOcrText('Press banca\n20 kg x 6\n\nPress banca\n22,5 kg x 5', known);
  assert.equal(r.length, 1);
  assert.equal(r[0].sets.length, 2);
  assert.equal(r[0].best?.kg, 22.5);
});

test('nombre partido en dos líneas', () => {
  const r = parseOcrText('PRENSA DE PIERNAS\n1 100 KG 12 REPS\nEXTENSIÓN DE\nCUADRICEPS\nSERIE PESO REPS\n1 30 KG 12 REPS\n2 32.5 KG 10 REPS', known);
  assert.deepEqual(r.map((e) => [e.name, e.sets.length, e.best?.kg]), [['Prensa de piernas', 1, 100], ['Extensión de cuádriceps', 2, 32.5]]);
});
