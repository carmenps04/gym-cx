import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import type { DayDef } from '../types';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { normName } from '../lib/report';
import { uid } from '../lib/util';
import { PageHeader } from '../components/ui';

function DayCard({ day, index, total, onChange, onMove, onRemove }: { day: DayDef; index: number; total: number; onChange: (d: DayDef) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const [text, setText] = useState('');
  const add = () => {
    // Se pueden pegar varios ejercicios a la vez, uno por línea o separados por comas.
    const names = text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((n, i, arr) => arr.findIndex((m) => normName(m) === normName(n)) === i)
      .filter((n) => !day.exercises.some((e) => normName(e) === normName(n)));
    if (names.length) onChange({ ...day, exercises: [...day.exercises, ...names] });
    setText('');
  };
  const moveEx = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= day.exercises.length) return;
    const ex = [...day.exercises];
    [ex[i], ex[j]] = [ex[j], ex[i]];
    onChange({ ...day, exercises: ex });
  };

  return (
    <section className="card day-card">
      <div className="day-top">
        <span className="q-n">{index + 1}</span>
        <input className="day-name" value={day.name} placeholder="Nombre del día" aria-label="Nombre del día" onChange={(e) => onChange({ ...day, name: e.target.value })} />
        <button className="icon-btn sm" aria-label="Subir día" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp size={16} />
        </button>
        <button className="icon-btn sm" aria-label="Bajar día" disabled={index === total - 1} onClick={() => onMove(1)}>
          <ArrowDown size={16} />
        </button>
        <button className="icon-btn sm" aria-label="Borrar día" onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </div>
      <label className="switch-row">
        <input type="checkbox" checked={day.isLeg} onChange={(e) => onChange({ ...day, isLeg: e.target.checked })} />
        <span>Es día de pierna (cuenta para la media de rodilla)</span>
      </label>
      <ul className="ex-edit">
        {day.exercises.map((name, i) => (
          <li key={name}>
            <span>{name}</span>
            <button className="icon-btn xs" aria-label={`Subir ${name}`} disabled={i === 0} onClick={() => moveEx(i, -1)}>
              <ArrowUp size={14} />
            </button>
            <button className="icon-btn xs" aria-label={`Quitar ${name}`} onClick={() => onChange({ ...day, exercises: day.exercises.filter((_, j) => j !== i) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="add-row">
        <textarea rows={1} value={text} placeholder="Añadir ejercicio" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            add();
          }
        }} />
        <button className="btn" onClick={add} aria-label="Añadir">
          <Plus size={18} />
        </button>
      </div>
      {day.exercises.length === 0 && <p className="hint">Puedes pegar varios a la vez, uno por línea o separados por comas.</p>}
    </section>
  );
}

export default function DaysEditor() {
  const { data, saveConfig } = useData();
  const ui = useUi();
  const nav = useNavigate();
  const [days, setDays] = useState<DayDef[]>(() =>
    data.config.days.length ? data.config.days.map((d) => ({ ...d, exercises: [...d.exercises] })) : [{ id: uid(), name: 'Día 1', isLeg: false, exercises: [] }],
  );

  const update = (i: number, d: DayDef) => setDays((ds) => ds.map((x, j) => (j === i ? d : x)));
  const move = (i: number, dir: -1 | 1) =>
    setDays((ds) => {
      const out = [...ds];
      [out[i], out[i + dir]] = [out[i + dir], out[i]];
      return out;
    });
  const remove = async (i: number) => {
    const used = data.entries.some((e) => e.dayId === days[i].id);
    if (used) {
      const ok = await ui.confirm({
        title: `¿Borrar «${days[i].name}»?`,
        message: 'Las sesiones ya registradas de este día se conservan con su nombre.',
        confirmLabel: 'Borrar',
        danger: true,
      });
      if (!ok) return;
    }
    setDays((ds) => ds.filter((_, j) => j !== i));
  };

  const save = async () => {
    const clean = days.map((d) => ({ ...d, name: d.name.trim() }));
    if (clean.some((d) => !d.name)) {
      ui.toast('Pon nombre a todos los días.');
      return;
    }
    await saveConfig({ ...data.config, days: clean });
    ui.toast('Días guardados.');
    nav(-1);
  };

  return (
    <div className="page form-page">
      <PageHeader title="Días de la rutina" sub="En el mismo orden que en Nivel Bestia. La app propone el siguiente día después del último registrado." back="/ajustes" />
      {days.map((d, i) => (
        <DayCard key={d.id} day={d} index={i} total={days.length} onChange={(x) => update(i, x)} onMove={(dir) => move(i, dir)} onRemove={() => void remove(i)} />
      ))}
      <button className="btn block dashed" onClick={() => setDays((ds) => [...ds, { id: uid(), name: `Día ${ds.length + 1}`, isLeg: false, exercises: [] }])}>
        <Plus size={18} /> Añadir día
      </button>
      <div className="save-bar">
        <button className="btn primary block" onClick={save}>
          Guardar
        </button>
      </div>
    </div>
  );
}
