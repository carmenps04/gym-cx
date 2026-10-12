import type { Entry } from '../types';
import { DAY } from './report';
import { appBaseUrl, fmtDate, googleCalendarUrl } from './util';

/** Evento de Google Calendar para el día siguiente, con enlace directo a la pregunta de 24 h. */
export function calendarLinkFor(e: Entry): string {
  return googleCalendarUrl({
    title: 'Rodilla: dolor a las 24 h',
    start: e.at + DAY,
    minutes: 10,
    details: `Contesta el dolor de rodilla de la sesión de ${e.dayName} (${fmtDate(e.at)}).\n${appBaseUrl()}#/rodilla/${e.id}`,
  });
}
