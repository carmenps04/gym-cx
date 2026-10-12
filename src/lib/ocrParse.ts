// Convierte el texto leído de capturas de pantalla en cargas por ejercicio.
// No conoce el diseño exacto de Nivel Bestia: busca nombres de ejercicios conocidos y, debajo de cada uno,
// pares de números «kg × repeticiones». Por eso el resultado siempre se revisa antes de usarlo.
import { compareLoad, normName } from './report.ts';

export interface OcrSet {
  kg: number | null;
  reps: number;
}

export interface OcrExercise {
  /** Nombre conocido al que se ha asociado (o el texto leído si no se reconoce). */
  name: string;
  /** Texto tal como se leyó en la captura. */
  raw: string;
  /** true si coincide con un ejercicio conocido. */
  matched: boolean;
  sets: OcrSet[];
  best: OcrSet | null;
}

const MAX_KG = 400;
const MAX_REPS = 100;

/** Corrige confusiones típicas del lector dentro de números (O→0, l/I→1, coma decimal). */
function fixDigits(s: string): string {
  return s.replace(/(?<=\d)[oO](?=\d|\b)/g, '0').replace(/(?<=\d)[lI|](?=\d)/g, '1');
}

function num(s: string): number {
  return Number(s.replace(',', '.'));
}

function bigrams(s: string): string[] {
  const t = ` ${s} `;
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Parecido entre dos textos de 0 a 1 (coeficiente de Dice sobre pares de letras). */
export function similarity(a: string, b: string): number {
  const x = bigrams(normName(a));
  const y = bigrams(normName(b));
  if (!x.length || !y.length) return 0;
  const counts = new Map<string, number>();
  x.forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1));
  let hits = 0;
  y.forEach((g) => {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      hits++;
      counts.set(g, c - 1);
    }
  });
  return (2 * hits) / (x.length + y.length);
}

/** Mejor ejercicio conocido para una línea de texto, o null si ninguno se parece lo suficiente. */
export function matchName(line: string, known: string[]): string | null {
  const clean = line.replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (clean.replace(/\s/g, '').length < 4) return null;
  let best: string | null = null;
  let score = 0;
  for (const k of known) {
    const s = similarity(clean, k);
    if (s > score) {
      score = s;
      best = k;
    }
  }
  return score >= 0.72 ? best : null;
}

/** Series de una línea: «20 kg × 6», «20 × 6», «20 kg 6 reps», «6 reps 20 kg». */
export function setsInLine(line: string): OcrSet[] {
  const t = fixDigits(line).toLowerCase();
  const out: OcrSet[] = [];
  const push = (kg: number | null, reps: number) => {
    if (reps > 0 && reps <= MAX_REPS && (kg == null || (kg >= 0 && kg <= MAX_KG))) out.push({ kg: kg === 0 ? null : kg, reps });
  };
  let m: RegExpExecArray | null;
  const times = /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilos?)?\s*[x×*]\s*(\d{1,3})(?!\s*(?:kg|kilos?))/g;
  while ((m = times.exec(t))) push(num(m[1]), num(m[2]));
  if (out.length) return out;
  const kgReps = /(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilos?)\b[^\d]{0,14}?(\d{1,3})\s*(?:reps?|rep\.|repeticiones|r)\b/g;
  while ((m = kgReps.exec(t))) push(num(m[1]), num(m[2]));
  if (out.length) return out;
  const repsKg = /(\d{1,3})\s*(?:reps?|rep\.|repeticiones)\b[^\d]{0,14}?(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|kilos?)\b/g;
  while ((m = repsKg.exec(t))) push(num(m[2]), num(m[1]));
  if (out.length) return out;
  // Solo repeticiones (peso corporal): «12 reps».
  const onlyReps = /(?:^|\s)(\d{1,3})\s*(?:reps?|repeticiones)\b/g;
  while ((m = onlyReps.exec(t))) push(null, num(m[1]));
  return out;
}

/**
 * Recorre las líneas: cada nombre reconocido abre un ejercicio y las series que aparecen debajo
 * se le asignan hasta el siguiente nombre.
 */
export function parseOcrText(text: string, known: string[]): OcrExercise[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: OcrExercise[] = [];
  let current: OcrExercise | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sets = setsInLine(line);
    if (sets.length) {
      if (current) current.sets.push(...sets);
      continue;
    }
    let name = matchName(line, known);
    // Nombres largos que la app parte en dos líneas («EXTENSIÓN DE» / «CUÁDRICEPS»).
    if (!name && i + 1 < lines.length && !setsInLine(lines[i + 1]).length) {
      const joined = matchName(`${line} ${lines[i + 1]}`, known);
      if (joined) {
        name = joined;
        i++;
      }
    }
    if (name) {
      const existing = out.find((e) => normName(e.name) === normName(name));
      current = existing ?? { name, raw: line, matched: true, sets: [], best: null };
      if (!existing) out.push(current);
    }
  }
  for (const e of out) {
    e.best = e.sets.length ? e.sets.reduce((a, b) => (compareLoad(b, a) > 0 ? b : a)) : null;
  }
  return out;
}
