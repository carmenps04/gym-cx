import type { Treadmill, TreadmillSegment } from '../types';

export const EMPTY_SEGMENT: TreadmillSegment = { min: null, speed: null, incline: null };

const filled = (s: TreadmillSegment) => s.min != null || s.speed != null || s.incline != null;

/** Tramos de una sesión. Las sesiones guardadas antes de existir los tramos se leen como uno solo. */
export function segmentsOf(t: Treadmill): TreadmillSegment[] {
  if (t.segments?.length) return t.segments.map((s) => ({ ...s }));
  return [{ min: t.min, speed: t.speed, incline: t.incline }];
}

/**
 * Media de un valor ponderada por los minutos de cada tramo.
 * Si ningún tramo con ese valor tiene minutos, media simple.
 */
function weighted(segs: TreadmillSegment[], key: 'speed' | 'incline'): number | null {
  const withVal = segs.filter((s) => s[key] != null);
  if (!withVal.length) return null;
  const timed = withVal.filter((s) => s.min != null && s.min > 0);
  const raw = timed.length
    ? timed.reduce((a, s) => a + (s[key] as number) * (s.min as number), 0) / timed.reduce((a, s) => a + (s.min as number), 0)
    : withVal.reduce((a, s) => a + (s[key] as number), 0) / withVal.length;
  return Math.round(raw * 100) / 100;
}

/** Minutos totales y medias ponderadas de una lista de tramos. */
export function summarizeSegments(segs: TreadmillSegment[]): Pick<Treadmill, 'min' | 'speed' | 'incline'> {
  const mins = segs.filter((s) => s.min != null);
  return {
    min: mins.length ? Math.round(mins.reduce((a, s) => a + (s.min as number), 0) * 100) / 100 : null,
    speed: weighted(segs, 'speed'),
    incline: weighted(segs, 'incline'),
  };
}

/** Deja la cinta lista para guardar: quita tramos vacíos y recalcula el resumen. */
export function finalizeTreadmill(t: Treadmill): Treadmill {
  const segments = (t.segments ?? segmentsOf(t)).filter(filled);
  return { ...t, ...summarizeSegments(segments), segments };
}

/** «3 min a 5 km/h, 4 %» para cada tramo, separados por «; ». */
export function segmentsText(t: Treadmill): string {
  const n = (v: number) => String(v).replace('.', ',');
  return segmentsOf(t)
    .filter(filled)
    .map((s) => {
      const parts = [s.min != null ? `${n(s.min)} min` : '', s.speed != null ? `${n(s.speed)} km/h` : '', s.incline != null ? `${n(s.incline)} %` : ''].filter(Boolean);
      return parts.join(' · ');
    })
    .join('; ');
}
