import { forwardRef } from 'react';
import { feelSummary, gainsInWindow, inRange, kneeSummary, mean, treadmillSummary } from '../lib/report';
import type { Gain, GainSummary, LoadSession, WeekRange } from '../lib/report';
import type { Config, Entry, TreadmillRating } from '../types';
import { fmtDate, fmtLoad, fmtNum, fmtShort } from '../lib/util';
import { LineChart } from './charts';

/**
 * Informe resumido de todo el programa, solo para el PDF (no se ve en pantalla).
 * Una tabla con todas las semanas y, de los ejercicios, solo los que suben y cuánto.
 */

const f1 = (n: number | null) => fmtNum(n == null ? null : Math.round(n * 10) / 10);
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TM_SHORT: Record<TreadmillRating, string> = { poco: 'Poco', bien: 'Bien', mucho: 'Demasiado' };

export function rangeText(from: number, to: number): string {
  const a = new Date(from);
  const b = new Date(to - 1);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** «+2,5 kg» o «+2 rep.»; con el mismo peso cuentan las repeticiones. */
function gainText(g: Gain): string {
  const { base, current } = g;
  if (base.kg != null && current.kg != null && Math.abs(current.kg - base.kg) > 1e-9) return `+${fmtNum(current.kg - base.kg)} kg`;
  if (base.reps != null && current.reps != null && current.reps !== base.reps) return `+${fmtNum(Math.round((current.reps - base.reps) * 10) / 10)} rep.`;
  return 'Mejora';
}

function treadmillCell(es: Entry[]): string {
  const tm = treadmillSummary(es);
  if (tm.sessions.length === 0) return '—';
  if (tm.verdict === 'poco' || tm.verdict === 'bien' || tm.verdict === 'mucho') return `${TM_SHORT[tm.verdict]} (${tm.sessions.length})`;
  if (tm.verdict === 'mixto') return `Mixto (${tm.sessions.length})`;
  const r = tm.sessions[0].treadmill.rating;
  return r ? `${TM_SHORT[r]} (1)` : `${tm.sessions.length} ses.`;
}

/** Resto de ejercicios en una línea, sin listarlos. */
function restLine(s: GainSummary): string {
  const parts: string[] = [];
  if (s.same) parts.push(`${s.same} igual`);
  if (s.down) parts.push(`${s.down} ${s.down === 1 ? 'baja' : 'bajan'}`);
  if (s.fresh) parts.push(`${s.fresh} sin referencia`);
  return parts.length ? `Resto: ${parts.join(' · ')}.` : '';
}

function GainList({ s, empty }: { s: GainSummary; empty: string }) {
  return (
    <>
      {s.gains.length === 0 ? (
        <p className="sum-empty">{empty}</p>
      ) : (
        <ul className="list plain sum-gains">
          {s.gains.map((g) => (
            <li key={g.name}>
              <span className="sum-gain-name">{g.name}</span>
              <span className="sum-gain-load">
                {fmtLoad(g.base.kg, g.base.reps)} → {fmtLoad(g.current.kg, g.current.reps)}
              </span>
              <b className="sum-gain-delta">{gainText(g)}</b>
            </li>
          ))}
        </ul>
      )}
      {restLine(s) && <p className="sum-rest">{restLine(s)}</p>}
    </>
  );
}

interface Props {
  config: Config;
  entries: Entry[];
  sessions: LoadSession[];
  weeks: WeekRange[];
  start: number;
  end: number;
  now: number;
}

export const PdfSummary = forwardRef<HTMLDivElement, Props>(function PdfSummary({ config, entries, sessions, weeks, start, end, now }, ref) {
  const past = weeks.filter((w) => !w.future);
  const rows = past.map((w) => {
    const es = inRange(entries, w.from, w.to);
    const loads = inRange(sessions, w.from, w.to);
    const knee = kneeSummary(es);
    const feel = feelSummary(es, config);
    return {
      w,
      es,
      hasData: es.length > 0 || loads.length > 0,
      knee: knee.avgSession,
      energy: mean(es.map((e) => e.energy)),
      recovery: mean(es.map((e) => e.recovery)),
      sleepH: mean(es.map((e) => e.sleepHours)),
      sleepQ: mean(es.map((e) => e.sleepQuality)),
      tm: treadmillCell(es),
      best: feel.best,
      gains: gainsInWindow(sessions, w.from, w.to),
    };
  });
  const all = inRange(entries, start, end);
  const allKnee = kneeSummary(all);
  const total = gainsInWindow(sessions, start, end);
  const withData = rows.filter((r) => r.hasData);
  const chartRows = rows.filter((r) => r.es.length > 0);
  const lastN = past.length ? past[past.length - 1].n : 1;

  return (
    <div className="page report pdf-sum" ref={ref}>
      <div className="print-head">
        <p className="print-app">Diario gym · Informe</p>
        <h1>Programa completo · semanas 1–{lastN}</h1>
        <p>
          Del {fmtDate(start)} al {fmtDate(Math.min(now, end - 1))} · {all.length} {all.length === 1 ? 'sesión' : 'sesiones'} con cuestionario · generado el {fmtDate(now)}
        </p>
      </div>

      <section className="card">
        <h2 className="h3">Resumen por semana</h2>
        <table className="sum-table">
          <thead>
            <tr>
              <th>Sem.</th>
              <th>Ses.</th>
              <th>Rodilla</th>
              <th>Energía</th>
              <th>Recup.</th>
              <th>Sueño</th>
              <th>Cinta</th>
              <th>Suben</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.w.n} className={r.hasData ? '' : 'sum-off'}>
                <td>
                  <b>{r.w.n}</b>
                  <small>{rangeText(r.w.from, r.w.to)}</small>
                </td>
                <td>{r.es.length || '—'}</td>
                <td>{f1(r.knee)}</td>
                <td>{f1(r.energy)}</td>
                <td>{f1(r.recovery)}</td>
                <td>
                  {r.sleepH == null ? '—' : `${f1(r.sleepH)} h`}
                  {r.sleepQ != null && <small>calidad {f1(r.sleepQ)}</small>}
                </td>
                <td>{r.tm}</td>
                <td>{r.gains.compared ? `${r.gains.gains.length}/${r.gains.compared}` : '—'}</td>
              </tr>
            ))}
            <tr className="sum-total">
              <td>
                <b>Total</b>
              </td>
              <td>{all.length}</td>
              <td>{f1(allKnee.avgSession)}</td>
              <td>{f1(mean(all.map((e) => e.energy)))}</td>
              <td>{f1(mean(all.map((e) => e.recovery)))}</td>
              <td>{(() => {
                const h = mean(all.map((e) => e.sleepHours));
                return h == null ? '—' : `${f1(h)} h`;
              })()}</td>
              <td>{treadmillCell(all)}</td>
              <td>{total.compared ? `${total.gains.length}/${total.compared}` : '—'}</td>
            </tr>
          </tbody>
        </table>
        <p className="method">
          Medias de la semana. Rodilla 0–10 (sesiones de pierna, media de durante y 24 h); energía, recuperación y calidad del sueño 1–5. Cinta: valoración más repetida (n.º de sesiones). Suben: ejercicios que mejoran / ejercicios que se pueden comparar.
        </p>
      </section>

      {chartRows.length >= 2 && (
        <section className="card">
          <h2 className="h3">Evolución semanal</h2>
          <LineChart
            label="Medias semanales de energía, recuperación y calidad del sueño"
            labels={chartRows.map((r) => `S${r.w.n}`)}
            min={1}
            max={5}
            height={140}
            series={[
              { name: 'Energía', color: 'var(--line-1)', values: chartRows.map((r) => r.energy) },
              { name: 'Recuperación', color: 'var(--c2)', values: chartRows.map((r) => r.recovery) },
              { name: 'Calidad del sueño', color: 'var(--c3)', values: chartRows.map((r) => r.sleepQ), dashed: true },
            ]}
          />
          {chartRows.some((r) => r.knee != null) && (
            <>
              <h3 className="chart-title">Dolor de rodilla (media semanal, 0–10)</h3>
              <LineChart label="Media semanal del dolor de rodilla" labels={chartRows.map((r) => `S${r.w.n}`)} min={0} max={10} height={120} series={[{ name: 'Rodilla', color: 'var(--c2)', values: chartRows.map((r) => r.knee) }]} />
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="h3">Progreso de cargas en todo el programa</h2>
        <p className="card-sub">Última marca frente a la de antes de empezar el programa (o la primera dentro de él). Solo los ejercicios que suben.</p>
        <GainList s={total} empty="Ningún ejercicio supera todavía su marca de referencia." />
      </section>

      {withData.map((r) => (
        <section key={r.w.n} className="card sum-week">
          <div className="sum-week-head">
            <h2 className="h3">
              Semana {r.w.n} <span className="muted">· {rangeText(r.w.from, r.w.to)}</span>
            </h2>
            {r.w.current && <span className="tag">En curso</span>}
          </div>
          {r.gains.compared === 0 && r.gains.fresh > 0 ? (
            <p className="sum-empty">
              Primeras marcas de {r.gains.fresh} {r.gains.fresh === 1 ? 'ejercicio' : 'ejercicios'}: sirven de referencia para las semanas siguientes.
            </p>
          ) : (
            <GainList s={r.gains} empty={r.gains.compared ? 'Ningún ejercicio sube respecto a la vez anterior.' : 'Sin cargas registradas esta semana.'} />
          )}
          {r.best && (
            <p className="sum-rest">
              Día que más gustó: {r.best.name} ({f1(r.best.avgFeel)}/5).
            </p>
          )}
        </section>
      ))}

      <p className="method sum-foot">
        En cada semana, cada ejercicio se compara con la última vez que se hizo antes de esa semana. Se usa la carga media de la sesión (media de las series): primero el peso y, con el mismo peso, las repeticiones. Última sesión incluida: {all.length ? fmtShort(all[all.length - 1].at) : '—'}.
      </p>
    </div>
  );
});
