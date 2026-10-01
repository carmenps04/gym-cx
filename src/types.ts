// Modelo de datos. Los pesos se guardan siempre en kg; la unidad elegida solo afecta a la vista.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = lunes ... 6 = domingo

export interface StrengthItem {
  kind: 'strength';
  id: string;
  exerciseId: string;
  sets: number;
  reps: number;
}
export interface CardioItem {
  kind: 'cardio';
  id: string;
  cardioId: string;
  minutes: number;
  distanceKm?: number;
}
export type RoutineItem = StrengthItem | CardioItem;

export interface RoutineDay {
  id: string;
  name: string;
  weekdays: Weekday[];
  items: RoutineItem[];
}
export interface Routine {
  id: string;
  name: string;
  days: RoutineDay[];
  createdAt: number;
  updatedAt: number;
}

export interface LoggedSet {
  weight: number; // kg
  reps: number;
  done: boolean;
}
export interface StrengthEntry {
  kind: 'strength';
  itemId: string;
  exerciseId: string;
  sets: LoggedSet[];
}
export interface CardioEntry {
  kind: 'cardio';
  itemId: string;
  cardioId: string;
  minutes: number;
  distanceKm?: number;
  done: boolean;
}
export type SessionEntry = StrengthEntry | CardioEntry;

export interface Session {
  id: string;
  routineId: string;
  routineName: string;
  dayId: string;
  dayName: string;
  startedAt: number;
  endedAt: number;
  entries: SessionEntry[];
  updatedAt: number;
}

export type Goal = 'muscle' | 'fat' | 'strength' | 'health';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Profile {
  name: string;
  heightCm?: number;
  goal?: Goal;
  level?: Level;
  weeklyGoal: number;
}
export interface WeightEntry {
  date: string; // YYYY-MM-DD
  kg: number;
}
export interface Settings {
  units: 'kg' | 'lb';
  restSec: number;
  theme: 'system' | 'light' | 'dark';
  equipment: string[];
}
export interface Meta {
  profile: Profile;
  settings: Settings;
  weights: WeightEntry[];
  videos: Record<string, string>; // exerciseId -> URL de vídeo propia
  updatedAt: number;
}
export interface AppData {
  routines: Routine[];
  sessions: Session[];
  meta: Meta;
}

export interface Draft {
  routineId: string;
  dayId: string;
  startedAt: number;
  entries: SessionEntry[];
}
