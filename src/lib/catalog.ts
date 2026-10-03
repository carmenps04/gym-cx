import { useEffect, useState } from 'react';
import type { Ex } from './search.ts';

export type { Ex };

export const MUSCLES: { id: string; label: string }[] = [
  { id: 'chest', label: 'Pecho' },
  { id: 'lats', label: 'Dorsales' },
  { id: 'middle back', label: 'Espalda media' },
  { id: 'lower back', label: 'Zona lumbar' },
  { id: 'traps', label: 'Trapecio' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'forearms', label: 'Antebrazos' },
  { id: 'abdominals', label: 'Abdomen' },
  { id: 'quadriceps', label: 'Cuádriceps' },
  { id: 'hamstrings', label: 'Isquiotibiales' },
  { id: 'glutes', label: 'Glúteos' },
  { id: 'calves', label: 'Gemelos' },
  { id: 'adductors', label: 'Aductores' },
  { id: 'abductors', label: 'Abductores' },
  { id: 'neck', label: 'Cuello' },
];

export const EQUIPMENT: { id: string; label: string }[] = [
  { id: 'body only', label: 'Peso corporal' },
  { id: 'dumbbell', label: 'Mancuernas' },
  { id: 'barbell', label: 'Barra' },
  { id: 'e-z curl bar', label: 'Barra Z' },
  { id: 'cable', label: 'Polea' },
  { id: 'machine', label: 'Máquina' },
  { id: 'kettlebells', label: 'Kettlebell' },
  { id: 'bands', label: 'Bandas elásticas' },
  { id: 'medicine ball', label: 'Balón medicinal' },
  { id: 'exercise ball', label: 'Fitball' },
  { id: 'foam roll', label: 'Rodillo' },
  { id: 'other', label: 'Otros' },
];

export const TYPES = [
  { id: 'all', label: 'Todos los tipos' },
  { id: 'fuerza', label: 'Fuerza' },
  { id: 'estiramiento', label: 'Estiramientos' },
  { id: 'pliometria', label: 'Pliométricos' },
  { id: 'halterofilia', label: 'Halterofilia' },
];

export const LEVEL_LABEL: Record<string, string> = { beginner: 'Principiante', intermediate: 'Intermedio', expert: 'Avanzado', advanced: 'Avanzado' };

const muscleMap = new Map(MUSCLES.map((m) => [m.id, m.label]));
const equipMap = new Map(EQUIPMENT.map((m) => [m.id, m.label]));
export const muscleLabel = (id: string) => muscleMap.get(id) ?? id;
export const equipLabel = (id: string) => equipMap.get(id) ?? id;

// ---------- Carga perezosa del catálogo ----------
let promise: Promise<Ex[]> | null = null;
let byIdCache: Map<string, Ex> | null = null;
export function loadExercises(): Promise<Ex[]> {
  if (!promise) {
    promise = import('../data/exercises.json').then((m) => {
      const list = m.default as unknown as Ex[];
      byIdCache = new Map(list.map((e) => [e.i, e]));
      return list;
    });
  }
  return promise;
}

/** Un ejercicio del catálogo por id; se resuelve al instante si el catálogo ya está cargado. */
export function useExercise(id?: string): Ex | undefined {
  const [ex, setEx] = useState<Ex | undefined>(() => (id && byIdCache ? byIdCache.get(id) : undefined));
  useEffect(() => {
    if (!id) {
      setEx(undefined);
      return undefined;
    }
    if (byIdCache) {
      setEx(byIdCache.get(id));
      return undefined;
    }
    let alive = true;
    loadExercises().then(() => {
      if (alive && byIdCache) setEx(byIdCache.get(id));
    });
    return () => {
      alive = false;
    };
  }, [id]);
  return ex;
}

export function useExercises(): { list: Ex[]; byId: Map<string, Ex>; loading: boolean } {
  const [state, setState] = useState<{ list: Ex[]; byId: Map<string, Ex> } | null>(null);
  useEffect(() => {
    let alive = true;
    loadExercises().then((list) => {
      if (alive) setState({ list, byId: new Map(list.map((e) => [e.i, e])) });
    });
    return () => {
      alive = false;
    };
  }, []);
  return { list: state?.list ?? [], byId: state?.byId ?? new Map(), loading: !state };
}

// Imágenes del catálogo (free-exercise-db, dominio público) servidas por jsDelivr.
const IMG_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
export function imageUrl(exerciseId: string, frame = 0): string {
  return `${IMG_BASE}${encodeURIComponent(exerciseId)}/${frame}.jpg`;
}

// ---------- Cardio ----------
export interface CardioDef {
  id: string;
  name: string;
  refId?: string; // id del catálogo para imagen e instrucciones
  distance: boolean;
  defaultMinutes: number;
  hint: string;
}
export const CARDIO: CardioDef[] = [
  { id: 'cinta-correr', name: 'Cinta de correr', refId: 'Running_Treadmill', distance: true, defaultMinutes: 20, hint: 'Velocidad e inclinación se ajustan en la máquina.' },
  { id: 'cinta-caminar', name: 'Caminar en cinta', refId: 'Walking_Treadmill', distance: true, defaultMinutes: 30, hint: 'Con inclinación del 5 al 10 % sube la intensidad.' },
  { id: 'bici-estatica', name: 'Bicicleta estática', refId: 'Bicycling_Stationary', distance: true, defaultMinutes: 20, hint: 'Ajusta el sillín a la altura de la cadera.' },
  { id: 'bici-reclinada', name: 'Bicicleta reclinada', refId: 'Recumbent_Bike', distance: true, defaultMinutes: 20, hint: 'Apoya la zona lumbar contra el respaldo.' },
  { id: 'eliptica', name: 'Elíptica', refId: 'Elliptical_Trainer', distance: true, defaultMinutes: 20, hint: 'Mantén la espalda recta y no te apoyes en los agarres.' },
  { id: 'remo', name: 'Máquina de remo', refId: 'Rowing_Stationary', distance: true, defaultMinutes: 15, hint: 'Empuja con las piernas, luego espalda y por último brazos.' },
  { id: 'escaladora', name: 'Escaladora', refId: 'Stairmaster', distance: false, defaultMinutes: 15, hint: 'Evita apoyar todo el peso en las barras.' },
  { id: 'comba', name: 'Comba', refId: 'Rope_Jumping', distance: false, defaultMinutes: 10, hint: 'Saltos pequeños, muñecas relajadas.' },
  { id: 'natacion', name: 'Natación', distance: true, defaultMinutes: 30, hint: 'Alterna estilos para repartir la carga.' },
];
export const cardioById = (id: string) => CARDIO.find((c) => c.id === id);

// ---------- Vídeo e instrucciones ----------
export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`cómo hacer ${name} técnica correcta`)}`;
}
export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/);
        if (m) id = m[2];
      }
    }
    return id && /^[\w-]{6,15}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function translateUrl(text: string): string {
  return `https://translate.google.com/?sl=en&tl=es&op=translate&text=${encodeURIComponent(text.slice(0, 1800))}`;
}
