import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessDay, nbName, parseNb } from '../src/lib/nivelbestia.ts';
import { exerciseProgress, lastLog, loadSessions } from '../src/lib/report.ts';
import type { Entry } from '../src/types.ts';

// Copia mínima con la misma forma que la de Nivel Bestia (sin datos personales).
const backup = {
  app: 'nivel-bestia',
  version: 1,
  guardado: '2026-10-12T17:37:00.379Z',
  estado: {
    dias: {
      '2026-09-28': {
        hora: 7,
        ejercicios: {
          'prensa-piernas': [{ peso: 60, reps: 12 }, { peso: 60, reps: 12 }],
          'extension-cuadriceps': [{ peso: 25, reps: 12 }, { peso: 25, reps: 11 }],
          plancha: [{ peso: 0, reps: 45 }],
          vacio: [{ peso: 0, reps: 0 }],
        },
      },
      '2026-10-06': {
        hora: 7,
        ejercicios: {
          'prensa-piernas': [{ peso: 100, reps: 12 }],
          'extension-cuadriceps': [{ peso: 30, reps: 11 }, { peso: 30, reps: 12 }, { peso: 25, reps: 15 }],
        },
      },
      basura: { ejercicios: {} },
    },
    rutinas: {
      routine: {
        name: 'R_PRUEBA',
        days: [
          { id: 'a', name: 'Día 1', steps: [{ exerciseId: 'press-banca' }, { exerciseId: 'extension-polea' }] },
          { id: 'b', name: 'Día 3', steps: [{ exerciseId: 'prensa-piernas' }, { exerciseId: 'extension-cuadriceps' }, { exerciseId: 'machine-hip-thrust' }] },
          { id: 'c', name: 'Día 4', steps: [{ exerciseId: 'peso-muerto' }, { exerciseId: 'gemelo-sentado' }, { exerciseId: 'press-banca' }, { exerciseId: 'plancha' }, { exerciseId: 'remo-polea-baja' }] },
        ],
      },
    },
  },
};

test('lee días, carga media y número de series', () => {
  const r = parseNb(backup, 1);
  assert.equal(r.loads.length, 2);
  const d1 = r.loads[0];
  assert.equal(d1.date, '2026-09-28');
  assert.deepEqual(
    d1.exercises.map((x) => [x.name, x.kg, x.reps, x.sets]),
    [
      ['Prensa de piernas', 60, 12, 2],
      ['Extensión de cuádriceps', 25, 11.5, 2],
      ['Plancha', null, 45, 1],
    ],
  );
  // Media de 30×11, 30×12 y 25×15 → 28,3 kg y 12,7 reps
  assert.deepEqual([r.loads[1].exercises[1].kg, r.loads[1].exercises[1].reps], [28.3, 12.7]);
});

test('lee la rutina y marca como pierna solo los días con mayoría de ejercicios de pierna', () => {
  const r = parseNb(backup);
  assert.equal(r.routineName, 'R_PRUEBA');
  assert.deepEqual(r.days.map((d) => [d.name, d.isLeg]), [['Día 1', false], ['Día 3', true], ['Día 4', false]]);
  assert.deepEqual(r.days[1].exercises, ['Prensa de piernas', 'Extensión de cuádriceps', 'Hip thrust en máquina']);
});

test('rechaza archivos que no son de Nivel Bestia', () => {
  assert.throws(() => parseNb({ entries: [] }));
  assert.throws(() => parseNb(null));
});

test('código desconocido → nombre legible', () => {
  assert.equal(nbName('cable-crossover-bajo'), 'Cable crossover bajo');
});

test('día probable según los ejercicios hechos', () => {
  const r = parseNb(backup);
  assert.equal(guessDay(r.days, ['Prensa de piernas', 'Extensión de cuádriceps'])?.id, 'b');
  assert.equal(guessDay(r.days, ['Press banca']), null); // un solo ejercicio en común no basta
});

test('las cargas importadas mandan sobre las escritas a mano el mismo día', () => {
  const r = parseNb(backup);
  const manual = (date: string, kg: number): Entry =>
    ({ id: date, at: new Date(`${date}T19:00:00`).getTime(), exercises: [{ name: 'Prensa de piernas', kg, reps: 12 }] }) as unknown as Entry;
  const s = loadSessions([manual('2026-10-06', 999), manual('2026-10-09', 110)], r.loads);
  assert.deepEqual(s.map((x) => x.source), ['nivel-bestia', 'nivel-bestia', 'manual']);
  const prensa = exerciseProgress(s).find((p) => p.name === 'Prensa de piernas')!;
  assert.deepEqual(prensa.records.map((x) => x.kg), [60, 100, 110]);
  assert.equal(prensa.status, 'progresa');
  assert.equal(lastLog(s, 'prensa de piernas', '2026-10-09')?.kg, 100);
});
