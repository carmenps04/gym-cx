import { normalize } from './util.ts';

export interface Ex {
  i: string; // id
  n: string; // nombre en español
  e: string; // nombre original (inglés)
  p: string[]; // músculos principales
  s: string[]; // músculos secundarios
  q: string; // material
  l: string; // nivel
  c: string; // categoría
  t: string[]; // instrucciones (inglés)
  m: number; // nº de imágenes
}

export interface Query {
  text: string;
  muscles: string[];
  equipment: string[];
  type: string; // all | fuerza | estiramiento | pliometria | halterofilia
  includeSecondary: boolean;
}

export const emptyQuery: Query = { text: '', muscles: [], equipment: [], type: 'all', includeSecondary: false };

const TYPE_CATEGORIES: Record<string, string[]> = {
  fuerza: ['strength', 'powerlifting', 'strongman'],
  estiramiento: ['stretching'],
  pliometria: ['plyometrics'],
  halterofilia: ['olympic weightlifting'],
};

/**
 * Devuelve los ejercicios que cumplen TODAS las condiciones activas:
 * texto (todas las palabras, en nombre español o inglés) Y algún músculo seleccionado
 * Y algún material seleccionado Y el tipo elegido. Sin condiciones en un filtro = sin restricción.
 * El cardio del catálogo original se excluye: el cardio tiene su propia pestaña.
 */
export function searchExercises(list: Ex[], q: Query): Ex[] {
  const words = normalize(q.text).split(/\s+/).filter(Boolean);
  const cats = TYPE_CATEGORIES[q.type];
  const out: Ex[] = [];
  for (const ex of list) {
    if (ex.c === 'cardio') continue;
    if (cats && !cats.includes(ex.c)) continue;
    if (q.equipment.length && !q.equipment.includes(ex.q)) continue;
    if (q.muscles.length) {
      const hit = ex.p.some((m) => q.muscles.includes(m)) || (q.includeSecondary && ex.s.some((m) => q.muscles.includes(m)));
      if (!hit) continue;
    }
    if (words.length) {
      const hay = normalize(`${ex.n} ${ex.e}`);
      if (!words.every((w) => hay.includes(w))) continue;
    }
    out.push(ex);
  }
  if (words.length) {
    const first = words[0];
    const rank = (ex: Ex) => (normalize(ex.n).startsWith(first) ? 0 : 1);
    out.sort((a, b) => rank(a) - rank(b) || a.n.localeCompare(b.n, 'es'));
  } else {
    out.sort((a, b) => a.n.localeCompare(b.n, 'es'));
  }
  return out;
}
