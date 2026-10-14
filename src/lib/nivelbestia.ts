// Lectura de la copia que descarga Nivel Bestia («Guardar copia»).
// Formato observado en la copia del 12/10/2026 (version 1). No es un formato documentado:
// si la app cambia, aquí es donde hay que adaptarlo.
import type { DayDef, LoadDay } from '../types.ts';
import { normName } from './report.ts';

interface NbSet {
  peso?: number;
  reps?: number;
}
interface NbDay {
  ejercicios?: Record<string, NbSet[]>;
}
interface NbStep {
  exerciseId: string;
}
interface NbRoutineDay {
  id: string;
  name: string;
  steps?: NbStep[];
}
interface NbBackup {
  app: string;
  version?: number;
  guardado?: string;
  estado?: {
    dias?: Record<string, NbDay>;
    rutinas?: { routine?: { name?: string; days?: NbRoutineDay[] } | null };
  };
}

/**
 * Nombres en español para los códigos que usa Nivel Bestia. Siete están comprobados con capturas de la app
 * (pantalla «Corrige tu ejercicio»): los de NB_OLD_NAMES y la elevación lateral; el resto se dedujeron del código.
 */
export const NB_NAMES: Record<string, string> = {
  'abduccion-cadera': 'Abducción de cadera',
  'arnold-press': 'Press Arnold',
  'cable-rope-hammer-curl': 'Curl martillo en polea con cuerda',
  'curl-femoral-sentado': 'Curl femoral sentado',
  'curl-predicador': 'Curl predicador',
  'decline-machine-chest-press': 'Press de pecho declinado en máquina',
  'dumbbell-decline-skullcrusher': 'Press francés declinado',
  'dumbbell-standing-single-arm-hammer-curl': 'Curl martillo a una mano',
  'dumbbell-wrist-extension': 'Extensión de muñeca con mancuerna',
  'elevacion-lateral-polea': 'Elevación lateral en polea',
  'extension-cuadriceps': 'Extensión de cuádriceps',
  'extension-polea': 'Extensión en polea con cuerda',
  'gemelo-prensa': 'Gemelo en prensa',
  'gemelo-sentado': 'Gemelo sentado',
  'jalon-neutro': 'Jalón agarre neutro',
  'jalon-pecho': 'Jalón al pecho',
  'machine-face-pulls': 'Face pull en máquina',
  'machine-hip-adduction': 'Aducción de cadera en máquina',
  'machine-hip-thrust': 'Hip thrust en máquina',
  'machine-horizontal-leg-press': 'Prensa horizontal',
  'machine-neutral-row': 'Remo agarre neutro en máquina',
  'machine-pec-fly': 'Contractor de pecho',
  'machine-preacher-curl': 'Curl predicador en máquina',
  'machine-pulldown': 'Jalón en máquina',
  'machine-tricep-extension': 'Extensión de tríceps en máquina',
  'pallof-press': 'Press Pallof',
  'peso-muerto': 'Peso muerto',
  'peso-muerto-rumano': 'Peso muerto rumano',
  plancha: 'Plancha',
  'prensa-piernas': 'Prensa de piernas',
  'press-banca': 'Press de banca con barra',
  'press-inclinado': 'Press inclinado con mancuernas',
  'press-maquina-pecho': 'Press de pecho en máquina',
  'remo-barra': 'Remo con barra',
  'remo-mancuerna': 'Remo con mancuerna',
  'remo-polea-baja': 'Remo en polea baja',
  'smith-machine-bench-press': 'Press banca en multipower',
  'smith-machine-front-squat': 'Sentadilla frontal en multipower',
  'smith-machine-seated-overhead-press': 'Press de hombros sentado en Smith',
  'wide-grip-lat-pulldown': 'Jalón agarre ancho',
};

/** Nombres que usó esta app antes de comprobarlos con capturas reales (los datos guardados pueden llevarlos). */
export const NB_OLD_NAMES: Record<string, string> = {
  'dumbbell-decline-skullcrusher': 'Press francés declinado con mancuernas',
  'extension-polea': 'Extensión de tríceps en polea',
  'machine-pec-fly': 'Aperturas en máquina',
  'press-banca': 'Press banca',
  'press-inclinado': 'Press inclinado',
  'smith-machine-seated-overhead-press': 'Press militar sentado en multipower',
};

/** Nombre legible: el del diccionario o, si es un ejercicio nuevo, el código con espacios. */
export function nbName(id: string): string {
  if (NB_NAMES[id]) return NB_NAMES[id];
  const s = id.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LEG_HINTS = ['prensa', 'sentadilla', 'squat', 'femoral', 'cuadriceps', 'hip-thrust', 'rumano', 'abduccion', 'adduction', 'abduction', 'gemelo', 'calf', 'leg-', 'zancada', 'lunge', 'gluteo', 'glute', 'hack', 'step-up'];
export function isLegExercise(id: string): boolean {
  return LEG_HINTS.some((h) => id.includes(h));
}

export function isNbBackup(x: unknown): x is NbBackup {
  const b = x as NbBackup | null;
  return Boolean(b && b.app === 'nivel-bestia' && b.estado && typeof b.estado === 'object');
}

export interface NbImport {
  backupAt: string | null;
  routineName: string | null;
  days: DayDef[];
  loads: LoadDay[];
}

function dateToMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  // La copia trae un campo «hora» cuyo significado no está claro; se usa mediodía de ese día.
  return new Date(y, m - 1, d, 12).getTime();
}

export function parseNb(raw: unknown, now = Date.now()): NbImport {
  if (!isNbBackup(raw)) throw new Error('No es una copia de Nivel Bestia.');
  const estado = raw.estado!;

  const loads: LoadDay[] = [];
  for (const [date, day] of Object.entries(estado.dias ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const exercises: LoadDay['exercises'] = [];
    for (const [id, sets] of Object.entries(day?.ejercicios ?? {})) {
      const valid = (Array.isArray(sets) ? sets : [])
        .map((s) => ({ kg: typeof s?.peso === 'number' && s.peso > 0 ? s.peso : null, reps: typeof s?.reps === 'number' && s.reps > 0 ? s.reps : null }))
        .filter((s) => s.kg != null || s.reps != null);
      if (!valid.length) continue;
      // Media de las series (misma regla que la lectura de capturas).
      const withKg = valid.filter((x) => x.kg != null);
      const withReps = valid.filter((x) => x.reps != null);
      const r1 = (n: number) => Math.round(n * 10) / 10;
      const kg = withKg.length ? r1(withKg.reduce((t, x) => t + (x.kg as number), 0) / withKg.length) : null;
      const reps = withReps.length ? r1(withReps.reduce((t, x) => t + (x.reps as number), 0) / withReps.length) : null;
      exercises.push({ id, name: nbName(id), kg, reps, sets: valid.length });
    }
    if (exercises.length) loads.push({ date, at: dateToMs(date), exercises, importedAt: now });
  }
  loads.sort((a, b) => a.at - b.at);

  const routine = estado.rutinas?.routine ?? null;
  const days: DayDef[] = (routine?.days ?? [])
    .filter((d) => d && d.id)
    .map((d) => {
      const ids = (d.steps ?? []).map((s) => s.exerciseId).filter(Boolean);
      const legShare = ids.length ? ids.filter(isLegExercise).length / ids.length : 0;
      return { id: d.id, name: d.name || 'Día', isLeg: legShare >= 0.5, exercises: [...new Set(ids.map(nbName))] };
    });

  return { backupAt: raw.guardado ?? null, routineName: routine?.name ?? null, days, loads };
}

/** Día de la rutina que más se parece a lo que se entrenó (al menos 2 ejercicios en común). */
export function guessDay(days: DayDef[], names: string[]): DayDef | null {
  const done = new Set(names.map((n) => n.toLowerCase()));
  let best: DayDef | null = null;
  let score = 1;
  for (const d of days) {
    const s = d.exercises.filter((n) => done.has(n.toLowerCase())).length;
    if (s > score) {
      best = d;
      score = s;
    }
  }
  return best;
}

/**
 * Traduce el nombre que muestra Nivel Bestia al que ya usa esta app para ese ejercicio, para que el
 * historial no se parta en dos (p. ej. «Contractor de pecho» → «Aperturas en máquina» si así se guardó antes).
 */
export function resolveNbName(screenName: string, known: string[]): string {
  const key = normName(screenName);
  const has = (n: string) => known.find((k) => normName(k) === normName(n));
  const code = Object.keys(NB_NAMES).find((c) => normName(NB_NAMES[c]) === key);
  // Primero el nombre antiguo, si los días o el historial lo usan; si no, el de Nivel Bestia.
  if (code && NB_OLD_NAMES[code] && has(NB_OLD_NAMES[code])) return has(NB_OLD_NAMES[code])!;
  const direct = has(screenName);
  if (direct) return direct;
  if (code) return NB_NAMES[code];
  return screenName.charAt(0).toUpperCase() + screenName.slice(1);
}
