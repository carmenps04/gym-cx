/** Un día de la rutina (p. ej. «Día 1 · Pierna»), con los ejercicios que se anotan ese día. */
export interface DayDef {
  id: string;
  name: string;
  /** Cuenta para la media de dolor de rodilla por sesión de pierna. */
  isLeg: boolean;
  exercises: string[];
}

export interface Config {
  days: DayDef[];
  updatedAt: number;
  /** Última importación de la copia de Nivel Bestia (ms) y fecha de esa copia. */
  nbImportedAt?: number;
  nbBackupAt?: string;
  /** Lunes en que empieza el programa de 6 semanas (AAAA-MM-DD). Si falta, el de la primera sesión. */
  programStart?: string;
}

/** Mejor serie del ejercicio en la sesión. kg null = peso corporal. */
export interface ExerciseLog {
  name: string;
  kg: number | null;
  reps: number | null;
}

export type TreadmillRating = 'poco' | 'bien' | 'mucho';

/** Un tramo de cinta (p. ej. 5 min a 5 km/h y 2 %, luego 10 min a 5,5 km/h y 8 %). */
export interface TreadmillSegment {
  min: number | null;
  speed: number | null;
  incline: number | null;
}

/**
 * Cinta de la sesión. min es el total de los tramos; speed e incline, la media ponderada por minutos
 * (así el informe compara sesiones aunque tengan un número distinto de tramos).
 */
export interface Treadmill {
  done: boolean;
  min: number | null;
  speed: number | null;
  incline: number | null;
  rating: TreadmillRating | null;
  /** Tramos registrados. Las sesiones antiguas no lo tienen (un solo registro). */
  segments?: TreadmillSegment[];
}

/** Escalas de 1 a 5 (1 = muy mal, 5 = muy bien). */
export type Scale5 = 1 | 2 | 3 | 4 | 5;

export interface Entry {
  id: string;
  /** Momento en que terminó la sesión (ms). */
  at: number;
  dayId: string;
  /** Copia del nombre y del tipo del día en ese momento, por si luego se renombra o se borra. */
  dayName: string;
  isLeg: boolean;
  kneeDuring: number | null;
  knee24h: number | null;
  exercises: ExerciseLog[];
  treadmill: Treadmill;
  energy: Scale5 | null;
  sleepHours: number | null;
  sleepQuality: Scale5 | null;
  recovery: Scale5 | null;
  dayFeel: Scale5 | null;
  note: string;
  updatedAt: number;
}

/** Cargas de un día importadas de la copia de Nivel Bestia (mejor serie de cada ejercicio). */
export interface LoadDay {
  /** Fecha local AAAA-MM-DD, tal como la guarda Nivel Bestia. */
  date: string;
  at: number;
  exercises: (ExerciseLog & { id: string; sets: number })[];
  importedAt: number;
}

export interface AppData {
  entries: Entry[];
  config: Config;
  loads: LoadDay[];
}
