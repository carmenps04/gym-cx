// Resumen de los comentarios de cada sesión («¿Qué te ha parecido?»).
// No es un resumen redactado: agrupa las frases por los temas que se repiten (un ejercicio, una zona del
// cuerpo, el cansancio, el agarre…) y muestra las frases tal como se escribieron, de la más reciente a la
// más antigua. Así no se inventa nada que no se haya dicho.
import type { Entry } from '../types.ts';
import { normName } from './report.ts';

export interface NoteQuote {
  at: number;
  day: string;
  text: string;
}

export interface NoteTheme {
  label: string;
  /** Sesiones distintas en las que sale el tema. */
  sessions: number;
  /** Frases (las más recientes primero) que no se han mostrado ya en un tema anterior. */
  quotes: NoteQuote[];
  /** Otros temas que salen en las mismas frases («también: hombros, falta de fuerza»). */
  also: string[];
}

export interface NotesSummary {
  /** Sesiones con algún comentario. */
  sessions: number;
  /** Temas que salen en dos sesiones o más, de más a menos repetido. */
  themes: NoteTheme[];
  /** Comentarios sueltos (temas de una sola sesión o sin tema), los más recientes primero. */
  others: NoteQuote[];
}

/** Temas generales. Se buscan en el texto sin tildes y en minúsculas. */
const THEMES: { label: string; re: RegExp }[] = [
  { label: 'Agarre (se escapa la barra, sudor en las manos)', re: /se (me |le )?(escapa|resbala)|resbal|sud(or|an|o|ando)\b|manos? (mojad|humed)|agarr(ar|o|e bien|e mal)\b|correas|magnesio|calleras/ },
  { label: 'Cansancio o falta de fuerza', re: /cansad|cansanc|fatig|agotad|reventad|sin fuerza|no (tengo|tenia|tuve|me queda\w*) fuerza|(poca|nada de|menos) fuerza|sin energia|floj[oa]|no pod(ia|ido) mas/ },
  { label: 'Dolor o molestias', re: /dolor|duel[ea]|dolia|molest|pinchaz|tiron|sobrecarg|lesion/ },
  { label: 'Rodilla', re: /rodill/ },
  { label: 'Tríceps', re: /tricep/ },
  { label: 'Hombros', re: /hombro/ },
  { label: 'Espalda y lumbar', re: /espalda|lumbar/ },
  { label: 'Bíceps', re: /bicep/ },
  { label: 'Glúteos', re: /glute/ },
  { label: 'Piernas', re: /pierna|cuadricep|femoral|isquio|gemelo/ },
  { label: 'Cómo está planteada la rutina', re: /focaliz|centra(da)? mucho|se centra|demasiad[oa]s? ejercicio|muchos ejercicios|mucho volumen|muy larg|se (me )?hace larg|repetitiv|desequilibr|orden de los ejercicios/ },
  { label: 'Técnica', re: /tecnica|postura|no se (si lo hago|hacer)|lo hago mal|mala ejecucion|ejecucion/ },
  { label: 'Ajuste de cargas', re: /subir (el |de )?peso|subo (el )?peso|mas peso|menos peso|bajar (el )?peso|muy pesad|demasiado pesad|muy ligero|muy facil|me quedo corta/ },
  { label: 'Sueño y descanso', re: /dorm|sueno|descans/ },
  { label: 'Cinta', re: /cinta|cardio/ },
  { label: 'Lo que va bien', re: /me ha gustado|me gusto|genial|muy bien|me (he )?sentido (muy )?bien|disfrut|mejor que|motivad|con ganas/ },
];

/** Palabras que niegan lo que viene detrás: «sin dolor», «no me duele», «no he tenido nada de dolor». */
const NEGATORS = new Set(['sin', 'no', 'ni', 'nada', 'ningun', 'ninguna', 'ninguno', 'cero', 'tampoco', 'nunca']);

/**
 * El tema sale de verdad en la frase: al menos una mención que no está negada por alguna de las tres
 * palabras anteriores. «Rodilla sin dolor» habla de la rodilla, pero no cuenta como dolor.
 */
export function affirms(re: RegExp, text: string): boolean {
  const g = new RegExp(re.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    const before = text.slice(0, m.index).trim().split(/\s+/).slice(-3);
    if (!before.some((w) => NEGATORS.has(w))) return true;
    if (m[0].length === 0) g.lastIndex++;
  }
  return false;
}

/** Palabras que no identifican un ejercicio por sí solas. */
const GENERIC = new Set(['de', 'del', 'en', 'con', 'a', 'al', 'la', 'el', 'las', 'los', 'y', 'una', 'un', 'por', 'para', 'maquina', 'polea', 'mancuerna', 'barra', 'agarre', 'mano', 'cuerda', 'sentado', 'tumbado', 'smith', 'multipower', 'neutro', 'ancho', 'z', 'press']);
/** Zonas del cuerpo: no bastan para reconocer un ejercicio («me duele el pecho» no es «Jalón al pecho»). */
const BODY = new Set(['pecho', 'hombro', 'espalda', 'gemelo', 'cuadricep', 'femoral', 'tricep', 'bicep', 'gluteo', 'cadera', 'muneca', 'pierna', 'brazo']);

const plain = (s: string) => normName(s).replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
const stem = (w: string) => (w.length > 5 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const words = (s: string) => plain(s).split(' ').filter(Boolean).map(stem);

/** Frases de un comentario. */
export function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((s) => s.trim().replace(/^[-•·*]\s*/, ''))
    .filter((s) => s.replace(/[^\p{L}]/gu, '').length >= 3);
}

interface ExerciseKey {
  name: string;
  all: string[];
  unique: string[];
}

function exerciseKeys(names: string[]): ExerciseKey[] {
  const seen = new Set<string>();
  const list = names.filter((n) => {
    const k = normName(n);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const keys = list.map((name) => ({ name, all: [...new Set(words(name).filter((w) => !GENERIC.has(w)))] }));
  const count = new Map<string, number>();
  keys.forEach((k) => k.all.forEach((w) => count.set(w, (count.get(w) ?? 0) + 1)));
  return keys
    .filter((k) => k.all.length > 0)
    .map((k) => ({ ...k, unique: k.all.filter((w) => count.get(w) === 1 && w.length >= 5 && !BODY.has(w)) }));
}

/** El ejercicio se nombra si salen todas sus palabras clave o una que solo tiene él («rumano»). */
function mentions(k: ExerciseKey, ws: Set<string>): boolean {
  return k.all.every((w) => ws.has(w)) || k.unique.some((w) => ws.has(w));
}

const MAX_QUOTE = 200;
const short = (s: string) => (s.length > MAX_QUOTE ? `${s.slice(0, MAX_QUOTE - 1).replace(/\s+\S*$/, '')}…` : s);

export function summarizeNotes(entries: Entry[], exerciseNames: string[], dayName: (e: Entry) => string = (e) => e.dayName): NotesSummary {
  const keys = exerciseKeys(exerciseNames);
  const withNotes = entries.filter((e) => e.note && e.note.trim());
  // tema → sesiones y frases
  const found = new Map<string, { label: string; ids: Set<string>; quotes: NoteQuote[] }>();
  const all: { q: NoteQuote; labels: string[] }[] = [];
  for (const e of withNotes) {
    for (const s of sentences(e.note)) {
      const t = plain(s);
      const ws = new Set(words(s));
      const labels = [...keys.filter((k) => mentions(k, ws)).map((k) => k.name), ...THEMES.filter((th) => affirms(th.re, t)).map((th) => th.label)];
      const q: NoteQuote = { at: e.at, day: dayName(e), text: short(s) };
      all.push({ q, labels });
      for (const label of labels) {
        const g = found.get(label) ?? { label, ids: new Set<string>(), quotes: [] };
        g.ids.add(e.id);
        g.quotes.push(q);
        found.set(label, g);
      }
    }
  }
  const recentFirst = (a: NoteQuote, b: NoteQuote) => b.at - a.at;
  const ranked = [...found.values()]
    .filter((g) => g.ids.size >= 2)
    .sort((a, b) => b.ids.size - a.ids.size || Math.max(...b.quotes.map((q) => q.at)) - Math.max(...a.quotes.map((q) => q.at)));

  // Cada frase se muestra una sola vez, en el tema más repetido en el que sale.
  const shown = new Set<NoteQuote>();
  const themes: NoteTheme[] = [];
  for (const g of ranked) {
    const rest = g.quotes.filter((q) => !shown.has(q)).sort(recentFirst);
    if (rest.length === 0) {
      // Todas sus frases ya están en otro tema: se menciona allí.
      const host = themes.find((t) => g.quotes.some((q) => t.quotes.includes(q)));
      if (host && !host.also.includes(g.label)) host.also.push(g.label);
      continue;
    }
    const quotes = rest.slice(0, 3);
    quotes.forEach((q) => shown.add(q));
    // Si quedaban más frases suyas sin mostrar, no se vuelven a ofrecer en otro tema.
    rest.forEach((q) => shown.add(q));
    themes.push({ label: g.label, sessions: g.ids.size, quotes, also: [] });
  }
  // Etiquetas «también» de los temas que se repiten y comparten frases con uno ya mostrado.
  for (const t of themes) {
    const labelsHere = new Set(all.filter((x) => t.quotes.includes(x.q)).flatMap((x) => x.labels));
    for (const l of labelsHere) {
      if (l !== t.label && !t.also.includes(l) && ranked.some((g) => g.label === l)) t.also.push(l);
    }
  }
  const others = all
    .map((x) => x.q)
    .filter((q) => !shown.has(q))
    .sort(recentFirst)
    .slice(0, 5);
  return { sessions: withNotes.length, themes: themes.slice(0, 6), others };
}
