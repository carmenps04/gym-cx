import { useMemo, useRef, useState } from 'react';
import { CalendarHeart, FileDown } from 'lucide-react';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { daysUntil, dietitianPeriod, gainsInWindow, inRange, loadSessions, localDate, periodWeeks, programStart } from '../lib/report';
import { fmtDate } from '../lib/util';
import { PdfSummary } from './PdfSummary';
import { usePdfExport } from './PdfExport';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const asMs = (s: string) => new Date(`${s}T12:00:00`).getTime();

function countdown(d: number): string {
  if (d === 0) return 'Es hoy';
  if (d === 1) return 'Mañana';
  if (d > 1) return `Faltan ${d} días`;
  return d === -1 ? 'Fue ayer' : `Fue hace ${-d} días`;
}

/**
 * Cita con el dietista en la pantalla de inicio. El informe para el dietista va desde el día en que se
 * añade la cita (se puede cambiar) hasta el día de la cita, y se exporta en PDF con el mismo resumen
 * que el informe general.
 */
export function DietitianCard() {
  const { data, saveConfig } = useData();
  const ui = useUi();
  const appt = data.config.dietitian ?? null;
  const [now] = useState(Date.now);
  const today = localDate(now);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [from, setFrom] = useState(today);
  const pdfRef = useRef<HTMLDivElement>(null);
  const pdfx = usePdfExport();

  const period = appt ? dietitianPeriod(appt) : null;
  const sessions = useMemo(() => loadSessions(data.entries, data.loads), [data.entries, data.loads]);

  const openForm = (next: boolean) => {
    // «Cambiar» parte de la cita actual; «Añadir» (o la próxima cita) empieza el informe hoy.
    setDate(appt && !next ? appt.date : '');
    setFrom(appt && !next ? appt.from : today);
    setEditing(true);
  };

  const save = async () => {
    if (!DATE_RE.test(date) || !DATE_RE.test(from)) {
      ui.toast('Elige el día de la cita.');
      return;
    }
    if (from > date) {
      ui.toast('El informe tiene que empezar antes de la cita.');
      return;
    }
    await saveConfig({ ...data.config, dietitian: { date, from } });
    setEditing(false);
    ui.toast('Cita guardada.');
  };

  const remove = async () => {
    const ok = await ui.confirm({ title: '¿Quitar la cita?', message: 'Los datos del diario no se borran; solo deja de prepararse este informe.', confirmLabel: 'Quitar', danger: true });
    if (ok) await saveConfig({ ...data.config, dietitian: null });
  };

  if (editing || !appt || !period) {
    return (
      <section className="card diet">
        <span className="eyebrow">Dietista</span>
        {!editing ? (
          <>
            <p className="card-sub diet-sub">Añade la fecha de la próxima cita y se irá preparando un informe desde hoy hasta ese día: cargas, rodilla, descanso y cinta.</p>
            <button className="btn block" onClick={() => openForm(true)}>
              <CalendarHeart size={18} /> Añadir cita dietista
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Día de la cita</span>
              <input type="date" value={date} min={from} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">El informe empieza el</span>
              <input type="date" value={from} max={date || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <div className="diet-actions">
              <button className="btn primary" onClick={() => void save()}>
                Guardar
              </button>
              <button className="btn ghost" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  const left = daysUntil(appt.date, now) ?? 0;
  const dataTo = Math.min(period.to, now + 1);
  const es = inRange(data.entries, period.from, period.to);
  const gains = gainsInWindow(sessions, period.from, period.to);
  const start = programStart(data.config, data.entries, now);
  const weeks = periodWeeks(start, period.from, period.to, now);
  const fromText = fmtDate(asMs(appt.from));
  const dateText = fmtDate(asMs(appt.date));

  const exportPdf = () => pdfx.run(pdfRef.current, `Informe para el dietista - cita ${appt.date}.pdf`);

  return (
    <section className={`card diet${left < 0 ? ' past' : ''}`}>
      {pdfx.dialog}
      <div className="diet-head">
        <div>
          <span className="eyebrow">Cita con el dietista</span>
          <h2 className="h3">{dateText}</h2>
        </div>
        <span className={`tag${left >= 0 && left <= 3 ? ' progresa' : ''}`}>{countdown(left)}</span>
      </div>
      <p className="card-sub diet-sub">
        Informe desde el {fromText}: {es.length} {es.length === 1 ? 'sesión' : 'sesiones'}
        {gains.compared > 0 && `, suben ${gains.gains.length} de ${gains.compared} ejercicios`}.
      </p>
      <button className="btn primary block" onClick={() => void exportPdf()} disabled={pdfx.busy}>
        <FileDown size={18} /> {pdfx.busy ? 'Creando…' : 'Informe para el dietista (PDF)'}
      </button>
      <div className="diet-actions">
        {left < 0 ? (
          <button className="btn" onClick={() => openForm(true)}>
            Próxima cita
          </button>
        ) : (
          <button className="btn" onClick={() => openForm(false)}>
            Cambiar
          </button>
        )}
        <button className="btn ghost" onClick={() => void remove()}>
          Quitar cita
        </button>
      </div>

      <div hidden>
        <PdfSummary
          ref={pdfRef}
          config={data.config}
          entries={data.entries}
          sessions={sessions}
          weeks={weeks}
          start={period.from}
          end={period.to}
          now={now}
          eyebrow="Diario gym · Informe para el dietista"
          title={`Del ${fromText} al ${dateText}`}
          sub={`Cita el ${dateText} · datos hasta el ${fmtDate(dataTo - 1)} · ${es.length} ${es.length === 1 ? 'sesión' : 'sesiones'} con cuestionario · generado el ${fmtDate(now)}`}
          totalTitle={`Progreso de cargas desde el ${fromText}`}
          totalSub={`Última marca frente a la última vez antes del ${fromText} (o la primera dentro del periodo). Solo los ejercicios que suben.`}
        />
      </div>
    </section>
  );
}
