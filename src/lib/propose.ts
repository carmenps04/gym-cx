import { searchExercises } from './search.ts';
import type { Ex } from './search.ts';

/**
 * Propone hasta `n` ejercicios de fuerza que trabajan `muscle` como músculo principal,
 * con el material indicado (vacío = cualquiera), sin repetir los de `exclude`.
 */
export function proposeExercises(list: Ex[], muscle: string, equipment: string[], exclude: Set<string>, n = 3, rand: () => number = Math.random): Ex[] {
  const pool = searchExercises(list, { text: '', muscles: [muscle], equipment, type: 'fuerza', includeSecondary: false }).filter((e) => !exclude.has(e.i));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
