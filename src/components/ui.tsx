import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, X, Check } from 'lucide-react';
import { imageUrl, useExercise } from '../lib/catalog';
import { MuscleFigure, thumbSpec } from './MuscleFigure';
import { clamp } from '../lib/util';

export function Chip({ active, onClick, children, count }: { active?: boolean; onClick?: () => void; children: ReactNode; count?: number }) {
  return (
    <button type="button" className={`chip${active ? ' on' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, label, suffix }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; label: string; suffix?: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Reducir ${label}`} onClick={() => onChange(clamp(value - step, min, max))} disabled={value <= min}>
        <Minus size={16} />
      </button>
      <span className="stepper-val" aria-live="polite">
        {value}
        {suffix && <small>{suffix}</small>}
      </span>
      <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(clamp(value + step, min, max))} disabled={value >= max}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/** Campo numérico que no pierde lo que se está escribiendo ("7." o vacío). */
export function NumInput({ value, onChange, label, className, step = 'any' }: { value: number; onChange: (n: number) => void; label: string; className?: string; step?: string }) {
  const [text, setText] = useState(value ? String(value) : '');
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value ? String(value) : '');
  }, [value]);
  return (
    <input
      className={`num ${className ?? ''}`}
      type="number"
      inputMode="decimal"
      step={step}
      min={0}
      aria-label={label}
      placeholder="0"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(value ? String(value) : '');
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value.replace(',', '.'));
        onChange(Number.isFinite(n) && n >= 0 ? n : 0);
      }}
    />
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, back, right }: { title: string; sub?: string; back?: boolean | string | (() => void); right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="page-head">
      {back && (
        <button className="icon-btn" aria-label="Volver" onClick={() => (typeof back === 'function' ? back() : typeof back === 'string' ? nav(back) : nav(-1))}>
          <ChevronLeft size={22} />
        </button>
      )}
      <div className="page-head-text">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div className="page-head-right">{right}</div>}
    </header>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

/** Miniatura: foto del ejercicio con el músculo trabajado en rojo en la esquina (solo si hay espacio). */
export function Thumb({ exerciseId, size = 56 }: { exerciseId?: string; size?: number; alt?: string }) {
  const ex = useExercise(exerciseId);
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (!ex) return <div className="thumb thumb-empty" style={style} aria-hidden="true" />;
  const { view, crop } = thumbSpec(ex.p);
  const photo = ex.m > 0 && !failed;
  return (
    <div className="thumb" style={style} aria-hidden="true">
      {photo ? (
        <>
          <img src={imageUrl(ex.i, 0)} alt="" loading="lazy" onError={() => setFailed(true)} />
          {size >= 56 && (
            <span className="thumb-fig">
              <MuscleFigure primary={ex.p} secondary={ex.s} view={view} />
            </span>
          )}
        </>
      ) : (
        <MuscleFigure primary={ex.p} secondary={ex.s} view={view} crop={crop} />
      )}
    </div>
  );
}

/** Disco de pesa: cada serie es una. Al completarla se rellena. */
export function Plate({ n, done, onClick, label }: { n: number; done: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" className={`plate${done ? ' done' : ''}`} aria-pressed={done} aria-label={label} onClick={onClick}>
      {done ? <Check size={20} strokeWidth={3} /> : <span>{n}</span>}
    </button>
  );
}
