import { fmtNum } from '../lib/util';

export function BarChart({ data, unit, height = 150 }: { data: { label: string; value: number }[]; unit?: string; height?: number }) {
  const w = 320;
  const pad = { t: 18, b: 22, l: 4, r: 4 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (w - pad.l - pad.r) / data.length;
  const ih = height - pad.t - pad.b;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Gráfico de barras">
      {data.map((d, i) => {
        const h = (d.value / max) * ih;
        const x = pad.l + i * bw + bw * 0.16;
        const last = i === data.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={pad.t + ih - h} width={bw * 0.68} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={3} className={last ? 'bar bar-now' : 'bar'} />
            {d.value > 0 && (
              <text x={x + bw * 0.34} y={pad.t + ih - h - 4} textAnchor="middle" className="chart-val">
                {fmtNum(d.value)}
              </text>
            )}
            <text x={x + bw * 0.34} y={height - 6} textAnchor="middle" className="chart-lbl">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={pad.l} x2={w - pad.r} y1={pad.t + ih} y2={pad.t + ih} className="chart-axis" />
      {unit && (
        <text x={w - pad.r} y={10} textAnchor="end" className="chart-lbl">
          {unit}
        </text>
      )}
    </svg>
  );
}

export function LineChart({ points, unit, height = 170 }: { points: { x: number; y: number }[]; unit?: string; height?: number }) {
  const w = 320;
  const pad = { t: 16, b: 24, l: 34, r: 12 };
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const span = maxY - minY;
  minY -= span * 0.1;
  maxY += span * 0.1;
  const X = (x: number) => pad.l + (maxX === minX ? (w - pad.l - pad.r) / 2 : ((x - minX) / (maxX - minX)) * (w - pad.l - pad.r));
  const Y = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const fmtDate = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const ticks = [minY + (maxY - minY) * 0.1, (minY + maxY) / 2, maxY - (maxY - minY) * 0.1];
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Gráfico de evolución">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} className="chart-grid" />
          <text x={pad.l - 6} y={Y(t) + 3} textAnchor="end" className="chart-lbl">
            {fmtNum(t)}
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={path} className="line" fill="none" />}
      {points.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={i === points.length - 1 ? 5 : 3.5} className={i === points.length - 1 ? 'dot dot-now' : 'dot'} />
      ))}
      <text x={pad.l} y={height - 6} className="chart-lbl">
        {fmtDate(minX)}
      </text>
      {maxX !== minX && (
        <text x={w - pad.r} y={height - 6} textAnchor="end" className="chart-lbl">
          {fmtDate(maxX)}
        </text>
      )}
      {unit && (
        <text x={pad.l} y={9} className="chart-lbl">
          {unit}
        </text>
      )}
    </svg>
  );
}
