export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace('.', ',');
}

export function fmtLoad(kg: number | null, reps: number | null): string {
  const r = reps != null ? `${reps} rep.` : '';
  if (kg == null) return r ? `Peso corporal × ${reps}` : '—';
  return r ? `${fmtNum(kg)} kg × ${reps}` : `${fmtNum(kg)} kg`;
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function fmtShort(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valor para <input type="datetime-local">. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fromLocalInput(s: string): number | null {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

function gcalStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

/** Enlace que abre Google Calendar con el evento ya rellenado. */
export function googleCalendarUrl(opts: { title: string; start: number; minutes: number; details: string }): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${gcalStamp(opts.start)}/${gcalStamp(opts.start + opts.minutes * 60_000)}`,
    details: opts.details,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Dirección de la app sin la parte de ruta (#/...). */
export function appBaseUrl(): string {
  return window.location.href.split('#')[0];
}

/** Lee un número escrito con coma o punto. Vacío → null. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
