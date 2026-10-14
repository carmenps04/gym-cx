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
    r.map((e) => [e.name, e.avg?.kg ?? null, e.avg?.reps, e.sets.length]),
    [
      ['Prensa de piernas', 106.7, 11.3, 3], // (100+110+110)/3 kg, (12+10+12)/3 reps
      ['Extensión de cuádriceps', 30, 11.5, 2],
      ['Plancha', null, 45, 1],
    ],
  );
});

test('el mismo ejercicio en dos capturas se une', () => {
  const r = parseOcrText('Press banca\n20 kg x 6\n\nPress banca\n22,5 kg x 5', known);
  assert.equal(r.length, 1);
  assert.equal(r[0].sets.length, 2);
  assert.equal(r[0].avg?.kg, 21.3); // (20+22,5)/2 = 21,25 → 21,3
});

test('nombre partido en dos líneas', () => {
  const r = parseOcrText('PRENSA DE PIERNAS\n1 100 KG 12 REPS\nEXTENSIÓN DE\nCUADRICEPS\nSERIE PESO REPS\n1 30 KG 12 REPS\n2 32.5 KG 10 REPS', known);
  assert.deepEqual(r.map((e) => [e.name, e.sets.length, e.avg?.kg]), [['Prensa de piernas', 1, 100], ['Extensión de cuádriceps', 2, 31.3]]);
});

// Texto tal como lo devuelve el lector con una captura real de «Corrige tu ejercicio» (12/10/2026).
const nbScreenText = `8:176 al) 56 E
Carmen o
O), Veterana : Nivel 8 a o» 5 !
Y 7299 Aa 270 /450 XP
€ Volver
Corrige tu ejercicio
Press francés declinado
Serie Kg por mano (opcional) Repeticiones
1 4 11
2 4 12
3 4 10
Quitar última serie Añadir serie
E mn 1
PLUS LOGROS ENTRENAR TIENDA PERFIL`;

test('pantalla de Nivel Bestia: solo nombre y series, ignorando el resto', async () => {
  const { parseNbScreen } = await import('../src/lib/ocrParse.ts');
  const r = parseNbScreen(nbScreenText)!;
  assert.equal(r.name, 'Press francés declinado');
  assert.equal(r.kgNote, 'por mano');
  assert.deepEqual(r.sets, [{ kg: 4, reps: 11 }, { kg: 4, reps: 12 }, { kg: 4, reps: 10 }]);
});

test('filas con decimales, sin kg y basura', async () => {
  const { nbRow } = await import('../src/lib/ocrParse.ts');
  assert.deepEqual(nbRow('2 12.5 11'), { kg: 12.5, reps: 11 });
  assert.deepEqual(nbRow('| 3 | 2,5 | 13 |'), { kg: 2.5, reps: 13 });
  assert.deepEqual(nbRow('4 45'), { kg: null, reps: 45 });
  assert.equal(nbRow('Y 7299 Aa 270 /450 XP'), null);
  assert.equal(nbRow('8:16 6 al) 56 E'), null);
});

test('varias capturas → media por ejercicio y nombres de la app', async () => {
  const { parseScreenshots } = await import('../src/lib/ocrParse.ts');
  const { resolveNbName } = await import('../src/lib/nivelbestia.ts');
  const screen = (name: string, rows: string) => `Corrige tu ejercicio\n${name}\nSerie Kg (opcional) Repeticiones\n${rows}\nQuitar última serie Añadir serie`;
  const knownOld = ['Aperturas en máquina', 'Press banca'];
  const r = parseScreenshots(
    [nbScreenText, screen('Press de banca con barra', '1 25 8\n2 20 8\n3 20 8\n4 20 8'), screen('Contractor de pecho', '1 5 15\n2 5 15\n3 5 15'), screen('Remo raro nuevo', '1 30 10')],
    knownOld,
    (n) => resolveNbName(n, knownOld),
  );
  assert.deepEqual(
    r.map((e) => [e.name, e.avg?.kg, e.avg?.reps]),
    [
      ['Press francés declinado', 4, 11],
      ['Press banca', 21.3, 8], // nombre antiguo ya guardado; (25+20+20+20)/4 = 21,25
      ['Aperturas en máquina', 5, 15],
      ['Remo raro nuevo', 30, 10],
    ],
  );
});
