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

/** Un tramo de cinta: p. ej. 10 min a 4 km/h con un 3 % de inclinación. */
export interface TreadmillSegment {
  min: number | null;
  speed: number | null;
  incline: number | null;
}

export interface Treadmill {
  done: boolean;
  /** Resumen de los tramos: minutos totales y velocidad e inclinación medias ponderadas por tiempo. */
  min: number | null;
  speed: number | null;
  incline: number | null;
  rating: TreadmillRating | null;
  /** Tramos tal como se apuntaron. Las sesiones antiguas no lo tienen (equivalen a un solo tramo). */
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
