// Decide a qué ejercicio de la sesión va cada carga leída de las capturas.
// El nombre de la captura (Nivel Bestia) casi nunca coincide letra a letra con el de tus días de rutina
// («Press de banca con barra» frente a «Press banca»), así que se compara por palabras y por equivalencias
// conocidas de Nivel Bestia, y cada ejercicio de la sesión recibe como mucho una carga.
import { normName } from './report.ts';
import { NB_NAMES, NB_OLD_NAMES } from './nivelbestia.ts';
import { similarity } from './ocrParse.ts';

const STOP = new Set(['de', 'del', 'en', 'con', 'a', 'al', 'la', 'el', 'las', 'los', 'y', 'una', 'un', 'por', 'para']);

/** Palabras con significado, en singular aproximado («laterales» → «lateral», «hombros» → «hombro»). */
function tokens(s: string): string[] {
  return normName(s)
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 5 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/** Código de Nivel Bestia de un nombre (actual o antiguo), para tratar como iguales sus variantes. */
function nbCode(name: string): string | null {
  const k = normName(name);
  for (const [code, n] of Object.entries(NB_NAMES)) if (normName(n) === k) return code;
  for (const [code, n] of Object.entries(NB_OLD_NAMES)) if (normName(n) === k) return code;
  return null;
}

/** Parecido de 0 a 1 entre el nombre leído y el de la sesión. */
export function nameScore(a: string, b: string): number {
  if (normName(a) === normName(b)) return 1;
  const ca = nbCode(a);
  if (ca && ca === nbCode(b)) return 0.99;
  const x = tokens(a);
  const y = new Set(tokens(b));
  if (!x.length || !y.size) return 0;
  const common = new Set(x.filter((w) => y.has(w))).size;
  const byWords = common === 0 ? 0 : 0.5 * (common / Math.max(new Set(x).size, y.size)) + 0.5 * (common / Math.min(new Set(x).size, y.size));
  return Math.max(byWords, similarity(a, b));
}

const MIN_SCORE = 0.6;

/**
 * Para cada nombre leído, el índice del ejercicio de la sesión al que va (o null si es nuevo).
 * Se asignan primero las parejas más claras, y ningún ejercicio de la sesión se usa dos veces.
 */
export function assignTargets(read: string[], targets: string[]): (number | null)[] {
  const pairs: { r: number; t: number; s: number }[] = [];
  read.forEach((a, r) =>
    targets.forEach((b, t) => {
      const s = nameScore(a, b);
      if (s >= MIN_SCORE) pairs.push({ r, t, s });
    }),
  );
  pairs.sort((p, q) => q.s - p.s);
  const out: (number | null)[] = read.map(() => null);
  const used = new Set<number>();
  for (const p of pairs) {
    if (out[p.r] != null || used.has(p.t)) continue;
    out[p.r] = p.t;
    used.add(p.t);
  }
  return out;
}
