// Lectura de la copia que descarga Nivel Bestia («Guardar copia»).
// Formato observado en la copia del 12/10/2026 (version 1). No es un formato documentado:
// si la app cambia, aquí es donde hay que adaptarlo.
import type { DayDef, LoadDay } from '../types.ts';
import { compareLoad } from './report.ts';

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
 * Nombres en español para los códigos que usa Nivel Bestia. Los ha escrito Claude a partir del código:
 * pueden no coincidir palabra por palabra con lo que muestra la app.
 */
export const NB_NAMES: Record<string, string> = {
  'abduccion-cadera': 'Abducción de cadera',
  'arnold-press': 'Press Arnold',
  'cable-rope-hammer-curl': 'Curl martillo en polea con cuerda',
  'curl-femoral-sentado': 'Curl femoral sentado',
  'curl-predicador': 'Curl predicador',
  'decline-machine-chest-press': 'Press de pecho declinado en máquina',
  'dumbbell-decline-skullcrusher': 'Press francés declinado con mancuernas',
  'dumbbell-standing-single-arm-hammer-curl': 'Curl martillo a una mano',
  'dumbbell-wrist-extension': 'Extensión de muñeca con mancuerna',
  'elevacion-lateral-polea': 'Elevación lateral en polea',
  'extension-cuadriceps': 'Extensión de cuádriceps',
  'extension-polea': 'Extensión de tríceps en polea',
  'gemelo-prensa': 'Gemelo en prensa',
  'gemelo-sentado': 'Gemelo sentado',
  'jalon-neutro': 'Jalón agarre neutro',
  'jalon-pecho': 'Jalón al pecho',
  'machine-face-pulls': 'Face pull en máquina',
  'machine-hip-adduction': 'Aducción de cadera en máquina',
  'machine-hip-thrust': 'Hip thrust en máquina',
  'machine-horizontal-leg-press': 'Prensa horizontal',
  'machine-neutral-row': 'Remo agarre neutro en máquina',
  'machine-pec-fly': 'Aperturas en máquina',
  'machine-preacher-curl': 'Curl predicador en máquina',
  'machine-pulldown': 'Jalón en máquina',
  'machine-tricep-extension': 'Extensión de tríceps en máquina',
  'pallof-press': 'Press Pallof',
  'peso-muerto': 'Peso muerto',
  'peso-muerto-rumano': 'Peso muerto rumano',
  plancha: 'Plancha',
  'prensa-piernas': 'Prensa de piernas',
  'press-banca': 'Press banca',
  'press-inclinado': 'Press inclinado',
  'press-maquina-pecho': 'Press de pecho en máquina',
  'remo-barra': 'Remo con barra',
  'remo-mancuerna': 'Remo con mancuerna',
  'remo-polea-baja': 'Remo en polea baja',
  'smith-machine-bench-press': 'Press banca en multipower',
  'smith-machine-front-squat': 'Sentadilla frontal en multipower',
  'smith-machine-seated-overhead-press': 'Press militar sentado en multipower',
  'wide-grip-lat-pulldown': 'Jalón agarre ancho',
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
      const best = valid.reduce((a, b) => (compareLoad(b, a) > 0 ? b : a));
      exercises.push({ id, name: nbName(id), kg: best.kg, reps: best.reps, sets: valid.length });
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
