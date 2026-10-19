import { forwardRef } from 'react';
import { feelSummary, gainsInWindow, inRange, kneeSummary, mean, treadmillSummary } from '../lib/report';
import type { Gain, GainSummary, LoadSession, WeekRange } from '../lib/report';
import type { Config, Entry, TreadmillRating } from '../types';
import { fmtLoad, fmtNum, fmtShort } from '../lib/util';
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
  /** Rótulo superior, título y línea bajo el título. */
  eyebrow: string;
  title: string;
  sub: string;
  /** Texto de la sección de cargas del periodo completo. */
  totalTitle: string;
  totalSub: string;
}

/** «Semana 3» si es del programa; si no, por fechas. */
function weekLabel(w: WeekRange): string {
  return w.n >= 1 ? `Semana ${w.n}` : `Semana del ${rangeText(w.from, w.to)}`;
}
const weekShort = (w: WeekRange, i: number) => (w.n >= 1 ? `S${w.n}` : `${i + 1}`);

export const PdfSummary = forwardRef<HTMLDivElement, Props>(function PdfSummary({ config, entries, sessions, weeks, start, end, now, eyebrow, title, sub, totalTitle, totalSub }, ref) {
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

  // ---------------------------------------------------------------- Resumen en frases (lo primero que se lee)
  const lines: string[] = [];
  const legN = all.filter((e) => e.isLeg).length;
  // Sesiones por semana según los días transcurridos (la semana en curso no cuenta como entera).
  const elapsedDays = (Math.min(end, now + 1) - start) / (24 * 3600_000);
  const perWeek = elapsedDays >= 7 ? `, ${f1(all.length / (elapsedDays / 7))} por semana de media` : '';
  lines.push(
    all.length
      ? `${all.length} ${all.length === 1 ? 'sesión registrada' : 'sesiones registradas'}${legN ? ` (${legN} de pierna)` : ''}${perWeek}.`
      : 'Aún no hay sesiones registradas en este periodo.',
  );
  if (total.compared) {
    const top = total.gains[0];
    lines.push(
      `Cargas: suben ${total.gains.length} de ${total.compared} ejercicios${top ? `; la mayor subida, ${top.name} (${gainText(top)})` : ''}.${total.down ? ` ${total.down} ${total.down === 1 ? 'baja' : 'bajan'}.` : ''}`,
    );
  }
  const kneeWeeks = rows.filter((r) => r.knee != null);
  if (allKnee.avgSession != null) {
    const first = kneeWeeks[0];
    const last = kneeWeeks[kneeWeeks.length - 1];
    const evo =
      kneeWeeks.length >= 2 ? `; de ${f1(first.knee)} la primera semana a ${f1(last.knee)} la última (${last.knee! - first.knee! <= -0.5 ? 'mejora' : last.knee! - first.knee! >= 0.5 ? 'empeora' : 'estable'})` : '';
    lines.push(`Rodilla: dolor medio ${f1(allKnee.avgSession)}/10 en las sesiones de pierna${evo}.`);
  }
  const sleepH = mean(all.map((e) => e.sleepHours));
  const sleepQ = mean(all.map((e) => e.sleepQuality));
  const energy = mean(all.map((e) => e.energy));
  const recovery = mean(all.map((e) => e.recovery));
  if (all.length && (sleepH != null || energy != null || recovery != null)) {
    lines.push(
      `Descanso: ${sleepH != null ? `${f1(sleepH)} h de sueño${sleepQ != null ? ` (calidad ${f1(sleepQ)}/5)` : ''}` : 'sin datos de sueño'}; energía ${f1(energy)}/5 y recuperación ${f1(recovery)}/5.`,
    );
  }
  const tmAll = treadmillSummary(all);
  if (tmAll.sessions.length) {
    const v: Record<typeof tmAll.verdict, string> = { poco: 'casi siempre poco exigente', bien: 'casi siempre bien tolerada', mucho: 'casi siempre demasiado exigente', mixto: 'con valoraciones repartidas', pocos: 'sin valoraciones suficientes' };
    lines.push(`Cinta: ${tmAll.sessions.length} ${tmAll.sessions.length === 1 ? 'sesión' : 'sesiones'}, ${v[tmAll.verdict]} (${f1(tmAll.avgMin)} min de media).`);
  }

  return (
    <div className="page report pdf-sum" ref={ref}>
      <div className="print-head">
        <p className="print-app">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>

      <section className="card">
        <h2 className="h3">En resumen</h2>
        <ul className="sum-lines">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

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
              <tr key={r.w.from} className={r.hasData ? '' : 'sum-off'}>
                <td>
                  <b>{r.w.n >= 1 ? r.w.n : '·'}</b>
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
            labels={chartRows.map((r, i) => weekShort(r.w, i))}
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
              <LineChart label="Media semanal del dolor de rodilla" labels={chartRows.map((r, i) => weekShort(r.w, i))} min={0} max={10} height={120} series={[{ name: 'Rodilla', color: 'var(--c2)', values: chartRows.map((r) => r.knee) }]} />
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="h3">{totalTitle}</h2>
        <p className="card-sub">{totalSub}</p>
        <GainList s={total} empty="Ningún ejercicio supera todavía su marca de referencia." />
      </section>

      {withData.map((r) => (
        <section key={r.w.from} className="card sum-week">
          <div className="sum-week-head">
            <h2 className="h3">
              {weekLabel(r.w)}
              {r.w.n >= 1 && <span className="muted"> · {rangeText(r.w.from, r.w.to)}</span>}
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
