// Convierte el texto leído de capturas de pantalla en cargas por ejercicio.
// No conoce el diseño exacto de Nivel Bestia: busca nombres de ejercicios conocidos y, debajo de cada uno,
// pares de números «kg × repeticiones». Por eso el resultado siempre se revisa antes de usarlo.
import { normName } from './report.ts';

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
  /** Media de las series: kg medio (de las series con peso) y repeticiones medias. */
  avg: { kg: number | null; reps: number } | null;
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
      current = existing ?? { name, raw: line, matched: true, sets: [], avg: null };
      if (!existing) out.push(current);
    }
  }
  for (const e of out) e.avg = averageSets(e.sets);
  return out;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Carga media del ejercicio: media de los kg de las series con peso (redondeada a 0,1 kg) y media de
 * repeticiones (a 0,1). Sin series con peso → peso corporal (kg null).
 */
export function averageSets(sets: OcrSet[]): { kg: number | null; reps: number } | null {
  if (!sets.length) return null;
  const withKg = sets.filter((x) => x.kg != null);
  const kg = withKg.length ? round1(withKg.reduce((a, x) => a + (x.kg as number), 0) / withKg.length) : null;
  const reps = round1(sets.reduce((a, x) => a + x.reps, 0) / sets.length);
  return { kg, reps };
}

// ------------------------------------------------------------------ Pantalla «Corrige tu ejercicio» de Nivel Bestia
//
// Cada captura tiene un solo ejercicio:
//   Corrige tu ejercicio
//   <Nombre del ejercicio>
//   Serie  Kg [por mano|por lado] (opcional)  Repeticiones
//   1  4  11
//   2  4  12
//   …
//   Quitar última serie  Añadir serie
// Todo lo demás (cabecera, XP, menú inferior) se ignora.

export interface NbScreen {
  name: string;
  /** «por mano» o «por lado» si la columna de kg lo indica. */
  kgNote: string | null;
  sets: OcrSet[];
}

const TITLE_RE = /corrige\s+tu\s+ejercicio/i;
const HEADER_RE = /repeticion/i;
const END_RE = /quitar|a[ñn]adir\s+serie|cancelar|guardar/i;

/** Fila «1 4 11», «2 12.5 11» o «3 12» (sin kg). Devuelve null si no es una fila de serie. */
export function nbRow(line: string): OcrSet | null {
  const t = fixDigits(line).replace(/[|[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
  let m = /^(\d{1,2})\s+(\d{1,3}(?:[.,]\d{1,2})?)\s+(\d{1,3})$/.exec(t);
  if (m) {
    const kg = num(m[2]);
    const reps = num(m[3]);
    if (reps > 0 && reps <= MAX_REPS && kg <= MAX_KG) return { kg: kg > 0 ? kg : null, reps };
    return null;
  }
  m = /^(\d{1,2})\s+(\d{1,3})$/.exec(t);
  if (m) {
    const reps = num(m[2]);
    if (reps > 0 && reps <= MAX_REPS) return { kg: null, reps };
  }
  return null;
}

export function parseNbScreen(text: string): NbScreen | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const t = lines.findIndex((l) => TITLE_RE.test(l));
  if (t < 0) return null;
  const h = lines.findIndex((l, i) => i > t && HEADER_RE.test(l));
  if (h < 0) return null;
  // El nombre son las líneas entre el título y la cabecera de la tabla (normalmente una; dos si es largo).
  const name = lines
    .slice(t + 1, h)
    .join(' ')
    .replace(/[^\p{L}\p{N}\s().,'/-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return null;
  const note = /por\s+mano/i.test(lines[h]) ? 'por mano' : /por\s+lado/i.test(lines[h]) ? 'por lado' : null;
  const sets: OcrSet[] = [];
  for (let i = h + 1; i < lines.length && !END_RE.test(lines[i]); i++) {
    const r = nbRow(lines[i]);
    if (r) sets.push(r);
  }
  return { name, kgNote: note, sets };
}

/**
 * Lee varias capturas: las de la pantalla «Corrige tu ejercicio» con el lector específico y el resto con
 * el general. «resolve» traduce el nombre de la pantalla al que ya usa la app (historial y días).
 */
export function parseScreenshots(texts: string[], known: string[], resolve: (screenName: string) => string): OcrExercise[] {
  const out: OcrExercise[] = [];
  const add = (e: OcrExercise) => {
    const same = out.find((x) => normName(x.name) === normName(e.name));
    if (same) same.sets.push(...e.sets);
    else out.push(e);
  };
  for (const text of texts) {
    const nb = parseNbScreen(text);
    if (nb) add({ name: resolve(nb.name), raw: nb.name + (nb.kgNote ? ` (kg ${nb.kgNote})` : ''), matched: true, sets: nb.sets, avg: null });
    else parseOcrText(text, known).forEach(add);
  }
  for (const e of out) e.avg = averageSets(e.sets);
  return out;
}
