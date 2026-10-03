import { muscleLabel } from '../lib/catalog';

export type FigureView = 'front' | 'back';

/*
 * Figura humana esquemática (frente y espalda) con los grupos musculares como zonas.
 * Las formas están dibujadas solo para la mitad derecha (x ≥ 50) y se reflejan para la izquierda.
 * Los ids de músculo son los del catálogo: chest, lats, middle back, lower back, traps, shoulders,
 * biceps, triceps, forearms, abdominals, quadriceps, hamstrings, glutes, calves, adductors, abductors, neck.
 */

const BODY_HALF = [
  'M50 30 C58 30 67 32 73 37 L70 56 C68 66 64 78 63 90 C63 98 66 102 66 108 L50 113 Z', // torso
  'M71 37 C78 35 85 41 85 52 C85 62 84 70 82 79 L72 78 C71 67 70 57 69 47 Z', // brazo
  'M72 78 L82 79 C85 92 87 103 86 115 L77 116 C74 104 73 91 72 78 Z', // antebrazo
  'M77 116 L86 115 C88 121 87 127 83 130 C79 129 77 123 77 116 Z', // mano
  'M50 108 L66 105 C70 120 69 135 66 149 L54 149 C53 135 51 120 50 108 Z', // muslo
  'M54 149 L66 149 C67 162 65 175 63 188 L55 188 C55 175 54 162 54 149 Z', // pierna
  'M55 188 L63 188 C66 192 67 195 66 197 L54 197 C53 193 54 190 55 188 Z', // pie
];

const SHOULDER = 'M70 38 C78 35 86 42 85 53 C84 58 81 60 78 59 C73 56 70 48 70 38 Z';
const FOREARM = 'M72 79 L82 80 C85 92 86 103 85.5 114 L77.5 115 C74.5 104 73 92 72 79 Z';

const FRONT: Record<string, string[]> = {
  neck: ['M50 22 L54.5 22 L56 31 L50 31 Z'],
  traps: ['M50 30 C57 30 66 32 72 37 L69 41 C63 37 56 35 50 34 Z'],
  shoulders: [SHOULDER],
  chest: ['M50 38 C57 36 65 38 70 42 C71 50 67 58 60 60 C55 61 51.5 58.5 50 56 Z'],
  biceps: ['M72.5 58 C77 56 83 59 83 66 L82 77 L74 77 C72 71 71.5 64 72.5 58 Z'],
  forearms: [FOREARM],
  abdominals: [
    'M50.5 60 L57 60 C57.5 63 57.5 66 57 68.5 L50.5 68.5 Z',
    'M50.5 70.5 L57.5 70.5 L57.5 78.5 L50.5 78.5 Z',
    'M50.5 80.5 L57 80.5 C57.5 84 57 87 56.5 89 L50.5 89 Z',
    'M50.5 91 L56 91 C56 95 54 99 50.5 102 Z',
    'M59 61 C63 65 65 75 64 88 L62 96 C60 88 59.5 74 59 61 Z',
  ],
  quadriceps: ['M56 111 C61 107 66 109 68 114 C69.5 126 67.5 138 64 148 L57 148 C55.5 136 55.5 122 56 111 Z'],
  adductors: ['M50.5 112 C53 113 55 115 55.5 119 C55.8 128 55.8 138 55 147 L52 145 C51 135 50.5 123 50.5 112 Z'],
  abductors: ['M65 100 C68.5 102 70 108 69 115 L67 117 C64.5 111 64 105 65 100 Z'],
  calves: ['M55 151 L65 151 C66 161 65 171 62.5 181 L58 181 C56 171 55 161 55 151 Z'],
};

const BACK: Record<string, string[]> = {
  neck: ['M50 22 L54.5 22 L56 29 L50 29 Z'],
  traps: ['M50 27 C57 29 66 33 72 37 C69 43 61 48 50 53 Z'],
  shoulders: [SHOULDER],
  'middle back': ['M50 54 C59 50 65 48 67 51 C65 58 60 64 56 70 L50 72 Z'],
  lats: ['M69 52 C71 62 67 76 62 90 L57 82 C57 75 58 68 62 62 C66 59 68 56 69 52 Z'],
  'lower back': ['M50 74 C54 74 58 77 59 81 C59.5 88 58 94 55 99 L50 101 Z'],
  triceps: ['M72 55 C78 53 84 57 84 65 L82.5 78 L73.5 78 C72 70 71.5 62 72 55 Z'],
  forearms: [FOREARM],
  glutes: ['M50 101 C58 99 66 101 68 109 C68 117 62 122 56 121 C52 121 50.5 119 50 117 Z'],
  hamstrings: ['M51 123 C57 123 63 122 67 120 C69 131 67 141 64 149 L54 149 C52.5 139 51.5 131 51 123 Z'],
  adductors: ['M50.5 123 L52.5 125 C52.5 133 53 141 54 148 L50.5 146 Z'],
  abductors: ['M65 99 C69 101 70.5 107 69.5 113 L67 112 C64.5 108 64 103 65 99 Z'],
  calves: ['M55 151 C59 150 64 150 65 152 C67 161 65 171 61 179 C59.5 181 58 181 57 179 C54 171 53 161 55 151 Z'],
};

const BACK_FIRST = new Set(['lats', 'middle back', 'lower back', 'glutes', 'hamstrings', 'triceps', 'traps', 'calves']);
const LOWER = new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors']);

/** Vista y recorte más útiles para una miniatura según el músculo principal. */
export function thumbSpec(primary: string[]): { view: FigureView; crop: string } {
  const first = primary[0] ?? '';
  const crop = first === 'neck' ? '15 6 70 70' : LOWER.has(first) ? '5 92 90 90' : '5 22 90 90';
  return { view: BACK_FIRST.has(first) ? 'back' : 'front', crop };
}

interface Props {
  primary: string[];
  secondary?: string[];
  view: FigureView;
  /** viewBox recortado (por defecto la figura entera). */
  crop?: string;
  label?: string;
}

export function MuscleFigure({ primary, secondary = [], view, crop, label }: Props) {
  const shapes = view === 'front' ? FRONT : BACK;
  const level = (id: string) => (primary.includes(id) ? 2 : secondary.includes(id) ? 1 : 0);
  const ids = Object.keys(shapes).sort((a, b) => level(a) - level(b)); // lo resaltado se dibuja encima
  const cls = ['m', 'm warm', 'm hot'];

  const half = (
    <>
      {BODY_HALF.map((d, i) => (
        <path key={`b${i}`} d={d} className="body" />
      ))}
      {ids.map((id) =>
        (shapes[id] ?? []).map((d, i) => <path key={`${id}${i}`} d={d} className={cls[level(id)]} />),
      )}
    </>
  );

  return (
    <svg className="fig" viewBox={crop ?? '0 0 100 200'} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} preserveAspectRatio="xMidYMid meet">
      <ellipse cx="50" cy="13" rx="8.5" ry="10.5" className="body" />
      {half}
      <g transform="translate(100 0) scale(-1 1)">{half}</g>
    </svg>
  );
}

/** Texto accesible: «Pecho (principal), Tríceps (apoyo)». */
export function figureLabel(primary: string[], secondary: string[]): string {
  const p = primary.map((m) => `${muscleLabel(m)} (principal)`);
  const s = secondary.map((m) => `${muscleLabel(m)} (apoyo)`);
  return `Músculos trabajados: ${[...p, ...s].join(', ') || 'ninguno indicado'}`;
}
