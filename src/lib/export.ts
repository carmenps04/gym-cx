import type { AppData, Entry } from '../types';
import { sortByDate } from './report';
import { segmentsText } from './treadmill';

const pad = (n: number) => String(n).padStart(2, '0');

function cell(v: string | number | boolean | null | undefined): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return String(v).replace('.', ',');
  const s = v.replace(/\r?\n/g, ' ');
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  // BOM para que Excel reconozca UTF-8; «;» y coma decimal (Excel en español, read.csv2 en R).
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

function dateParts(ms: number): [string, string] {
  const d = new Date(ms);
  return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`];
}

export function sessionsCsv(entries: Entry[]): string {
  return csv(
    ['fecha', 'hora', 'dia', 'pierna', 'rodilla_durante', 'rodilla_24h', 'cinta', 'cinta_min', 'cinta_kmh', 'cinta_inclinacion', 'cinta_exigencia', 'cinta_tramos', 'energia', 'sueno_horas', 'sueno_calidad', 'recuperacion', 'sensacion_dia', 'comentario'],
    sortByDate(entries).map((e) => [
      ...dateParts(e.at),
      e.dayName,
      e.isLeg,
      e.kneeDuring,
      e.knee24h,
      e.treadmill.done,
      e.treadmill.min,
      e.treadmill.speed,
      e.treadmill.incline,
      e.treadmill.rating,
      e.treadmill.done ? segmentsText(e.treadmill) : '',
      e.energy,
      e.sleepHours,
      e.sleepQuality,
      e.recovery,
      e.dayFeel,
      e.note,
    ]),
  );
}

export function loadsCsv(entries: Entry[]): string {
  return csv(
    ['fecha', 'hora', 'dia', 'ejercicio', 'kg', 'repeticiones'],
    sortByDate(entries).flatMap((e) => e.exercises.map((x) => [...dateParts(e.at), e.dayName, x.name, x.kg, x.reps])),
  );
}

export function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function isBackup(x: unknown): x is AppData {
  const d = x as Partial<AppData> | null;
  return Boolean(d && Array.isArray(d.entries) && d.config && Array.isArray(d.config.days));
}
