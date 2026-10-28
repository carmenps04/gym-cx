import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignTargets } from '../src/lib/ocrMatch.ts';

const read = ['Press francés declinado', 'Elevación lateral en polea', 'Extensión en polea con cuerda', 'Contractor de pecho', 'Press de hombros sentado en Smith', 'Press inclinado con mancuernas', 'Press de banca con barra'];

test('cada carga va a su ejercicio aunque el nombre del día sea distinto', () => {
  const day = ['Press francés', 'Elevaciones laterales en polea', 'Extensión tríceps con cuerda', 'Contractor pecho', 'Press hombro Smith', 'Press inclinado mancuernas', 'Press banca barra'];
  assert.deepEqual(assignTargets(read, day), [0, 1, 2, 3, 4, 5, 6]);
});

test('nombres antiguos de Nivel Bestia', () => {
  const day = ['Press banca', 'Aperturas en máquina', 'Press militar sentado en multipower', 'Press inclinado', 'Extensión de tríceps en polea', 'Press francés declinado con mancuernas', 'Elevación lateral en polea'];
  assert.deepEqual(assignTargets(read, day), [5, 6, 4, 1, 2, 3, 0]);
});

test('sin parecido se añade como nuevo y un ejercicio no recibe dos cargas', () => {
  assert.deepEqual(assignTargets(['Prensa de piernas', 'Curl femoral sentado'], ['Curl femoral tumbado', 'Hip thrust']), [null, 0]);
  assert.deepEqual(assignTargets(['Press banca', 'Press de banca con barra'], ['Press banca']), [0, null]);
});
