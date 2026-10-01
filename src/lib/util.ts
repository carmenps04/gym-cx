export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Minúsculas y sin tildes, para comparar textos. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha local en formato YYYY-MM-DD. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lunes (00:00 local) de la semana de `d`. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const idx = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - idx);
  return x;
}

/** Índice de día con lunes = 0. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatMinutes(totalSec: number): string {
  const m = Math.round(totalSec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
}

const LB = 2.2046226218;
export function kgToUnit(kg: number, units: 'kg' | 'lb'): number {
  const v = units === 'kg' ? kg : kg * LB;
  return Math.round(v * 10) / 10;
}
export function unitToKg(v: number, units: 'kg' | 'lb'): number {
  const kg = units === 'kg' ? v : v / LB;
  return Math.round(kg * 100) / 100;
}
export function fmtNum(n: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
