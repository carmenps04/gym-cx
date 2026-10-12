// Gráficas SVG sencillas, sin librerías: todas usan los colores del tema (claro/oscuro).

export interface Series {
  name: string;
  /** Variable CSS del color, p. ej. 'var(--accent)'. */
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

const W = 340;
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','));

function Legend({ series }: { series: { name: string; color: string; dashed?: boolean }[] }) {
  if (series.length < 2) return null;
  return (
    <figcaption className="legend">
      {series.map((s) => (
        <span key={s.name}>
          <i style={s.dashed ? { borderColor: s.color } : { background: s.color }} className={s.dashed ? 'dashed' : ''} />
          {s.name}
        </span>
      ))}
    </figcaption>
  );
}

function ticksFor(min: number, max: number): number[] {
  const span = max - min;
  const step = span > 10 ? Math.ceil(span / 5 / 5) * 5 : span > 5 ? 2 : 1;
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

/** Etiquetas del eje X: se saltan algunas si no caben. */
function XLabels({ labels, x, y }: { labels: string[]; x: (i: number) => number; y: number }) {
  const every = Math.max(1, Math.ceil(labels.length / 7));
  return (
    <>
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text key={i} x={x(i)} y={y} className="tick" textAnchor="middle">
            {l}
          </text>
        ) : null,
      )}
    </>
  );
}

/** Líneas con escala fija (0–10 o 1–5). Los huecos (null) cortan la línea. */
export function LineChart({ labels, series, min, max, height = 170, label }: { labels: string[]; series: Series[]; min: number; max: number; height?: number; label: string }) {
  const H = height;
  const L = 24, R = 10, T = 10, B = 22;
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + ((max - v) * (H - T - B)) / (max - min);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticksFor(min, max).map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 3.5} className="tick" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <XLabels labels={labels} x={x} y={H - 6} />
        {series.map((s) => {
          const segs: string[] = [];
          let cur = '';
          s.values.forEach((v, i) => {
            if (v == null) {
              if (cur) segs.push(cur);
              cur = '';
            } else cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          });
          if (cur) segs.push(cur);
          return (
            <g key={s.name}>
              {segs.map((d, k) => (
                <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {s.values.map((v, i) => (v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3.2} fill={s.color} />))}
            </g>
          );
        })}
      </svg>
      <Legend series={series} />
    </figure>
  );
}

/** Barras verticales agrupadas. Con una sola serie, «colors» permite colorear cada barra. */
export function BarChart({ labels, series, max, height = 170, label, unit = '', colors }: { labels: string[]; series: Series[]; max: number; height?: number; label: string; unit?: string; colors?: string[] }) {
  const H = height;
  const L = 24, R = 6, T = 14, B = 22;
  const n = labels.length;
  const band = (W - L - R) / Math.max(1, n);
  const gap = Math.min(10, band * 0.25);
  const bw = Math.min(26, (band - gap) / series.length);
  const y = (v: number) => T + ((max - v) * (H - T - B)) / max;
  const cx = (i: number) => L + band * i + band / 2;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticksFor(0, max).map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 3.5} className="tick" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <XLabels labels={labels} x={cx} y={H - 6} />
        {series.map((s, k) =>
          s.values.map((v, i) => {
            if (v == null) return null;
            const x0 = cx(i) - (bw * series.length) / 2 + k * bw;
            const h = Math.max(1.5, y(0) - y(Math.min(v, max)));
            const fill = colors && series.length === 1 ? colors[i] : s.color;
            return (
              <g key={`${k}-${i}`}>
                <rect x={x0 + 1} y={y(0) - h} width={bw - 2} height={h} rx={3} fill={fill} />
                {n * series.length <= 14 && (
                  <text x={x0 + bw / 2} y={y(0) - h - 3} className="bar-val" textAnchor="middle">
                    {fmt(v)}
                    {unit}
                  </text>
                )}
              </g>
            );
          }),
        )}
      </svg>
      <Legend series={series} />
    </figure>
  );
}

/** Barras apiladas por categoría (p. ej. valoraciones de la cinta por semana). */
export function StackedBars({ labels, stacks, height = 150, label }: { labels: string[]; stacks: Series[]; height?: number; label: string }) {
  const H = height;
  const L = 24, R = 6, T = 10, B = 22;
  const n = labels.length;
  const totals = labels.map((_, i) => stacks.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const band = (W - L - R) / Math.max(1, n);
  const bw = Math.min(30, band * 0.6);
  const y = (v: number) => T + ((max - v) * (H - T - B)) / max;
  const cx = (i: number) => L + band * i + band / 2;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticksFor(0, max).map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
            <text x={L - 6} y={y(t) + 3.5} className="tick" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        <XLabels labels={labels} x={cx} y={H - 6} />
        {labels.map((_, i) => {
          let acc = 0;
          return (
            <g key={i}>
              {stacks.map((s) => {
                const v = s.values[i] ?? 0;
                if (!v) return null;
                const top = y(acc + v);
                const h = y(acc) - top;
                acc += v;
                return <rect key={s.name} x={cx(i) - bw / 2} y={top} width={bw} height={Math.max(0, h - 1)} rx={2} fill={s.color} />;
              })}
            </g>
          );
        })}
      </svg>
      <Legend series={stacks} />
    </figure>
  );
}

export interface DeltaItem {
  label: string;
  /** Cambio en % (positivo = mejora). */
  pct: number;
  text: string;
  tone: 'up' | 'down' | 'flat' | 'stall';
}

/** Barras horizontales centradas en cero: cambio de carga por ejercicio. */
export function DeltaBars({ items, label }: { items: DeltaItem[]; label: string }) {
  const maxAbs = Math.max(10, ...items.map((i) => Math.abs(i.pct)));
  return (
    <figure className="chart delta" role="img" aria-label={label}>
      {items.map((it) => {
        const w = (Math.abs(it.pct) / maxAbs) * 50;
        return (
          <div key={it.label} className="delta-row">
            <span className="delta-label">{it.label}</span>
            <span className="delta-track">
              <span className="delta-zero" />
              {it.pct !== 0 && <span className={`delta-bar ${it.tone}`} style={it.pct > 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />}
              {it.pct === 0 && <span className={`delta-dot ${it.tone}`} />}
            </span>
            <span className={`delta-text ${it.tone}`}>{it.text}</span>
          </div>
        );
      })}
    </figure>
  );
}

/** Barra horizontal 0–max para comparar medias. */
export function MeterRow({ label, value, max, suffix = '' }: { label: string; value: number | null; max: number; suffix?: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter-row">
      <span className="meter-label">{label}</span>
      <span className="meter">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="meter-value">{value == null ? '—' : `${value.toFixed(1).replace('.', ',')}${suffix}`}</span>
    </div>
  );
}
