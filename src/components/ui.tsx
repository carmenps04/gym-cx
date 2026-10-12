import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { parseNum } from '../lib/util';

const toText = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function PageHeader({ title, sub, back, right }: { title: string; sub?: string; back?: string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <button className="icon-btn" aria-label="Volver" onClick={() => nav(back)}>
          <ChevronLeft size={24} />
        </button>
      )}
      <div className="page-title">
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Card({ title, sub, children, className = '' }: { title?: string; sub?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h2 className="h3">{title}</h2>}
      {sub && <p className="card-sub">{sub}</p>}
      {children}
    </section>
  );
}

/** Escala de dolor 0–10: verde → rojo. */
export function PainScale({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="pain" role="radiogroup" aria-label={label}>
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            className={`pain-btn${value === i ? ' on' : ''}`}
            style={{ ['--h' as string]: String(Math.round(95 - i * 9.5)) }}
            onClick={() => onChange(value === i ? null : i)}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="pain-legend muted">
        <span>Sin dolor</span>
        <span>Máximo</span>
      </div>
    </div>
  );
}

/** Escala de 1 a 5 con etiquetas en los extremos. */
export function Scale5({ value, onChange, label, low, high }: { value: number | null; onChange: (v: 1 | 2 | 3 | 4 | 5 | null) => void; label: string; low: string; high: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="scale5" role="radiogroup" aria-label={label}>
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} className={`scale-btn${value === n ? ' on' : ''}`} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="pain-legend muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Campo numérico que acepta coma decimal y deja el campo vacío como null. */
export function NumField({ value, onChange, label, suffix, placeholder, small }: { value: number | null; onChange: (v: number | null) => void; label: string; suffix?: string; placeholder?: string; small?: boolean }) {
  const [text, setText] = useState(value == null ? '' : toText(value));
  useEffect(() => {
    // Sincroniza si el valor cambia desde fuera (p. ej. al rellenar con la carga anterior).
    if (parseNum(text) !== value) setText(value == null ? '' : toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <label className={`num${small ? ' small' : ''}`}>
      <span className="num-label">{label}</span>
      <span className="num-box">
        <input
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d.,]/g, '');
            setText(t);
            onChange(parseNum(t));
          }}
        />
        {suffix && <span className="num-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2 className="h3">{title}</h2>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
