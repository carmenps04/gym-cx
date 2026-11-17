import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeNotes, sentences } from '../src/lib/notes.ts';
import { gainRows, signed } from '../src/lib/summary.ts';

const entry = (id: string, day: number, dayName: string, note: string) => ({ id, at: new Date(2026, 10, day, 19).getTime(), dayName, note }) as never;

test('frases de un comentario', () => {
  assert.deepEqual(sentences('Bien. Me cuesta el rumano; se escapa la barra\n- La cinta, fácil'), ['Bien.', 'Me cuesta el rumano;', 'se escapa la barra', 'La cinta, fácil']);
});

test('los comentarios se agrupan por los temas que se repiten, sin repetir frases', () => {
  const es = [
    entry('1', 3, 'Pierna', 'Me cuesta bastante el peso rumano porque se me escapa la barra, me sudan las manos. La cinta bien.'),
    entry('2', 5, 'Torso', 'Siento que el entrenamiento se focaliza mucho en los tríceps y en ejercicios de hombro. Como ya traigo los tríceps cansados no puedo hacer bien el press.'),
    entry('3', 10, 'Pierna', 'Otra vez el rumano: la barra se resbala.'),
    entry('4', 12, 'Torso', 'Los tríceps muy cansados al final, no tengo fuerza.'),
    entry('5', 14, 'Espalda', 'Me ha gustado mucho la sesión de hoy.'),
    entry('6', 15, 'Espalda', ''),
  ];
  const r = summarizeNotes(es, ['Peso muerto rumano', 'Peso muerto', 'Jalón al pecho', 'Press Arnold']);
  assert.equal(r.sessions, 5);
  assert.deepEqual(r.themes.map((t) => [t.label, t.sessions]), [['Tríceps', 2], ['Peso muerto rumano', 2]]);
  // El agarre sale en las mismas frases que el rumano: se menciona ahí, no como tema aparte.
  assert.ok(r.themes[1].also.includes('Agarre (se escapa la barra, sudor en las manos)'));
  assert.equal(r.themes[1].quotes[0].text, 'Otra vez el rumano: la barra se resbala.'); // la más reciente primero
  const shown = [...r.themes.flatMap((t) => t.quotes), ...r.others].map((q) => q.text);
  assert.equal(new Set(shown).size, shown.length);
  assert.deepEqual(r.others.map((q) => q.text), ['Me ha gustado mucho la sesión de hoy.', 'La cinta bien.']);
});

test('«pecho» suelto no se confunde con «Jalón al pecho»', () => {
  const es = [entry('1', 3, 'A', 'Me molesta el pecho.'), entry('2', 4, 'A', 'Otra vez el pecho cargado.')];
  const r = summarizeNotes(es, ['Jalón al pecho', 'Jalón agarre neutro']);
  assert.ok(!r.themes.some((t) => t.label === 'Jalón al pecho'));
});

test('progreso total: kg y repeticiones con signo', () => {
  assert.equal(signed(30, 40), '+10');
  assert.equal(signed(10, 9.5), '−0,5');
  assert.equal(signed(12, 12), '=');
  assert.equal(signed(null, 12), '—');
  const rows = gainRows({
    gains: [
      { name: 'Jalón al pecho', base: { at: 1, kg: 30, reps: 10 }, current: { at: 2, kg: 40, reps: 9.5 }, deltaKg: 10, deltaReps: null, pct: 33 },
      { name: 'Plancha', base: { at: 1, kg: null, reps: 45 }, current: { at: 2, kg: null, reps: 60 }, deltaKg: null, deltaReps: 15, pct: 33 },
    ],
    compared: 2,
    same: 0,
    down: 0,
    fresh: 0,
  } as never);
  assert.deepEqual(rows, [
    { name: 'Jalón al pecho', kg: '+10 kg', reps: '−0,5', pct: 33 },
    { name: 'Plancha', kg: '—', reps: '+15', pct: 33 },
  ]);
});

test('lo negado no cuenta: «rodilla sin dolor» es rodilla, no dolor', async () => {
  const { affirms } = await import('../src/lib/notes.ts');
  const dolor = /dolor|duel[ea]|dolia|molest/;
  assert.equal(affirms(dolor, 'rodilla sin dolor'), false);
  assert.equal(affirms(dolor, 'hoy no me duele nada'), false);
  assert.equal(affirms(dolor, 'no he tenido nada de dolor'), false);
  assert.equal(affirms(dolor, 'sin dolor en la rodilla pero me molesta el hombro'), true);
  assert.equal(affirms(dolor, 'no se por que pero al final me duele'), true);
  const es = [entry('1', 3, 'Pierna', 'Rodilla sin dolor.'), entry('2', 10, 'Pierna', 'La rodilla, sin molestias.')];
  const r = summarizeNotes(es, []);
  assert.deepEqual(r.themes.map((t) => [t.label, t.also]), [['Rodilla', []]]);
});

test('«no tengo fuerza» sigue contando como cansancio y «no me ha gustado» no va a lo que va bien', () => {
  const es = [entry('1', 3, 'A', 'No tengo fuerza en los brazos.'), entry('2', 4, 'A', 'Estoy sin fuerza.'), entry('3', 5, 'A', 'No me ha gustado.'), entry('4', 6, 'A', 'Tampoco me ha gustado.')];
  const r = summarizeNotes(es, []);
  assert.deepEqual(r.themes.map((t) => t.label), ['Cansancio o falta de fuerza']);
});
