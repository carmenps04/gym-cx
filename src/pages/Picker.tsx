import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Chip, Empty, PageHeader, Segmented, Sheet, Stepper, Thumb } from '../components/ui';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { CARDIO, EQUIPMENT, MUSCLES, TYPES, cardioById, equipLabel, muscleLabel, useExercises } from '../lib/catalog';
import type { CardioDef } from '../lib/catalog';
import { emptyQuery, searchExercises } from '../lib/search';
import type { Ex, Query } from '../lib/search';
import { uid } from '../lib/util';
import type { RoutineItem } from '../types';

type Tab = 'fuerza' | 'cardio';
const PAGE = 30;

// El estado de búsqueda se conserva al abrir un ejercicio y volver.
interface Saved {
  tab: Tab;
  query: Query;
  executed: Query | null;
}
const KEY = 'gym.search.v1';
function loadSaved(): Saved {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return { tab: 'fuerza', query: emptyQuery, executed: null, ...(JSON.parse(raw) as Partial<Saved>) };
  } catch {
    /* ignora */
  }
  return { tab: 'fuerza', query: emptyQuery, executed: null };
}

export default function Picker() {
  const { rid, did } = useParams();
  const nav = useNavigate();
  const ui = useUi();
  const { data, saveRoutine } = useData();
  const { list, loading } = useExercises();

  const routine = rid ? data.routines.find((r) => r.id === rid) : undefined;
  const day = routine?.days.find((d) => d.id === did);
  const adding = Boolean(rid && did);

  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [open, setOpen] = useState(() => saved.executed === null);
  const [shown, setShown] = useState(PAGE);
  const [target, setTarget] = useState<Ex | CardioDef | null>(null);
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [minutes, setMinutes] = useState(20);
  const [km, setKm] = useState(0);
  const [added, setAdded] = useState(0);

  const persist = (next: Saved) => {
    setSaved(next);
    sessionStorage.setItem(KEY, JSON.stringify(next));
  };
  const { tab, query, executed } = saved;
  const setQuery = (patch: Partial<Query>) => persist({ ...saved, query: { ...query, ...patch } });
  const toggle = (field: 'muscles' | 'equipment', id: string) => setQuery({ [field]: query[field].includes(id) ? query[field].filter((x) => x !== id) : [...query[field], id] });

  const results = useMemo(() => (executed ? searchExercises(list, executed) : []), [list, executed]);

  const run = () => {
    persist({ ...saved, executed: { ...query } });
    setShown(PAGE);
    setOpen(false);
  };
  const clear = () => {
    persist({ ...saved, query: emptyQuery, executed: null });
    setOpen(true);
  };
  const useMyGear = () => {
    const eq = data.meta.settings.equipment;
    if (eq.length === 0) ui.toast('Define tu material en Ajustes para usarlo aquí.');
    else setQuery({ equipment: eq });
  };

  const openTarget = (t: Ex | CardioDef) => {
    if ('i' in t) {
      setSets(3);
      setReps(10);
    } else {
      setMinutes(t.defaultMinutes);
      setKm(0);
    }
    setTarget(t);
  };

  const confirmAdd = async () => {
    if (!routine || !day || !target) return;
    const item: RoutineItem =
      'i' in target
        ? { kind: 'strength', id: uid(), exerciseId: target.i, sets, reps }
        : { kind: 'cardio', id: uid(), cardioId: target.id, minutes, distanceKm: target.distance && km > 0 ? km : undefined };
    const updated = { ...routine, updatedAt: Date.now(), days: routine.days.map((d) => (d.id === day.id ? { ...d, items: [...d.items, item] } : d)) };
    await saveRoutine(updated);
    setAdded((n) => n + 1);
    ui.toast(`Añadido a ${day.name}`);
    setTarget(null);
  };

  if (adding && !day) {
    return (
      <>
        <PageHeader title="Añadir ejercicio" back="/entrenar" />
        <Empty title="No se encontró el día" text="Puede que la rutina se haya eliminado." />
      </>
    );
  }

  const summary = executed
    ? [
        executed.text && `«${executed.text}»`,
        executed.muscles.map(muscleLabel).join(', '),
        executed.equipment.map(equipLabel).join(', '),
        executed.type !== 'all' ? TYPES.find((t) => t.id === executed.type)?.label : '',
      ].filter(Boolean)
    : [];

  return (
    <>
      <PageHeader
        title={adding ? 'Añadir ejercicio' : 'Buscar ejercicios'}
        sub={adding && routine && day ? `${routine.name}, ${day.name}${added ? `, ${added} añadidos` : ''}` : 'Consulta cómo se hace cada uno'}
        back={adding ? `/rutina/${rid}` : '/entrenar'}
      />

      <Segmented<Tab>
        label="Tipo de ejercicio"
        value={tab}
        onChange={(t) => persist({ ...saved, tab: t })}
        options={[
          { id: 'fuerza', label: 'Fuerza' },
          { id: 'cardio', label: 'Cardio' },
        ]}
      />

      {tab === 'cardio' ? (
        <ul className="results">
          {CARDIO.map((c) => (
            <li className="result" key={c.id}>
              <Link to={`/ejercicio/cardio_${c.id}${adding ? `?rid=${rid}&did=${did}` : ''}`} className="result-main">
                <Thumb exerciseId={c.refId} size={64} />
                <span className="result-text">
                  <b>{c.name}</b>
                  <small>{c.distance ? 'Tiempo y distancia' : 'Tiempo'}</small>
                </span>
              </Link>
              {adding && (
                <button className="icon-btn filled" aria-label={`Añadir ${c.name}`} onClick={() => openTarget(c)}>
                  <Plus size={20} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <>
          {open ? (
            <form
              className="card filters"
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <label className="field">
                <span>Nombre del ejercicio</span>
                <div className="input-icon">
                  <Search size={18} aria-hidden="true" />
                  <input className="input" type="search" value={query.text} placeholder="Ej. press de banca, curl, sentadilla" onChange={(e) => setQuery({ text: e.target.value })} />
                </div>
              </label>

              <div className="field-label">Músculo que quieres trabajar</div>
              <div className="chips">
                {MUSCLES.map((m) => (
                  <Chip key={m.id} active={query.muscles.includes(m.id)} onClick={() => toggle('muscles', m.id)}>
                    {m.label}
                  </Chip>
                ))}
              </div>

              <div className="field-label with-action">
                <span>Material del que dispones</span>
                <button type="button" className="link" onClick={useMyGear}>
                  Usar mi material
                </button>
              </div>
              <div className="chips">
                {EQUIPMENT.map((m) => (
                  <Chip key={m.id} active={query.equipment.includes(m.id)} onClick={() => toggle('equipment', m.id)}>
                    {m.label}
                  </Chip>
                ))}
              </div>

              <div className="row wrap">
                <label className="field grow">
                  <span>Tipo</span>
                  <select className="input" value={query.type} onChange={(e) => setQuery({ type: e.target.value })}>
                    {TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  <input type="checkbox" checked={query.includeSecondary} onChange={(e) => setQuery({ includeSecondary: e.target.checked })} />
                  <span>Incluir músculos secundarios</span>
                </label>
              </div>

              <div className="row">
                <button type="button" className="btn" onClick={clear}>
                  Limpiar
                </button>
                <button type="submit" className="btn primary grow" disabled={loading}>
                  <Search size={18} /> {loading ? 'Cargando catálogo…' : 'Buscar'}
                </button>
              </div>
            </form>
          ) : (
            <button className="summary" onClick={() => setOpen(true)}>
              <SlidersHorizontal size={18} aria-hidden="true" />
              <span className="grow">{summary.length ? summary.join(' / ') : 'Todos los ejercicios'}</span>
              <span className="link">Cambiar</span>
            </button>
          )}

          {executed && (
            <>
              <p className="count" role="status">
                {results.length} {results.length === 1 ? 'ejercicio' : 'ejercicios'}
              </p>
              {results.length === 0 ? (
                <Empty title="Ningún ejercicio cumple todas las condiciones" text="Prueba a quitar algún material o músculo, o a incluir los músculos secundarios." action={<button className="btn" onClick={() => setOpen(true)}>Cambiar filtros</button>} />
              ) : (
                <ul className="results">
                  {results.slice(0, shown).map((ex) => (
                    <li className="result" key={ex.i}>
                      <Link to={`/ejercicio/${encodeURIComponent(ex.i)}${adding ? `?rid=${rid}&did=${did}` : ''}`} className="result-main">
                        <Thumb exerciseId={ex.i} size={64} />
                        <span className="result-text">
                          <b>{ex.n}</b>
                          <small>
                            {ex.p.map(muscleLabel).join(', ')} con {equipLabel(ex.q).toLowerCase().replace('barra z', 'barra Z')}
                          </small>
                        </span>
                      </Link>
                      {adding && (
                        <button className="icon-btn filled" aria-label={`Añadir ${ex.n}`} onClick={() => openTarget(ex)}>
                          <Plus size={20} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {results.length > shown && (
                <button className="btn block" onClick={() => setShown((n) => n + PAGE)}>
                  Mostrar más ({results.length - shown} restantes)
                </button>
              )}
            </>
          )}
          {!executed && !open && <Empty title="Sin resultados todavía" />}
        </>
      )}

      {adding && added > 0 && (
        <div className="float-bar">
          <button className="btn primary block" onClick={() => nav(`/rutina/${rid}`)}>
            Listo, volver a la rutina
          </button>
        </div>
      )}

      <Sheet open={!!target} onClose={() => setTarget(null)} title={target ? ('i' in target ? target.n : target.name) : ''}>
        {target && 'i' in target ? (
          <div className="stack">
            <div className="split">
              <span>Series</span>
              <Stepper label="series" value={sets} min={1} max={12} onChange={setSets} />
            </div>
            <div className="split">
              <span>Repeticiones</span>
              <Stepper label="repeticiones" value={reps} min={1} max={100} onChange={setReps} />
            </div>
            <button className="btn primary block" onClick={confirmAdd}>
              Añadir {sets} × {reps}
            </button>
          </div>
        ) : target ? (
          <div className="stack">
            <div className="split">
              <span>Duración</span>
              <Stepper label="minutos" value={minutes} min={1} max={240} step={5} onChange={setMinutes} suffix=" min" />
            </div>
            {target.distance && (
              <div className="split">
                <span>Distancia (opcional)</span>
                <Stepper label="kilómetros" value={km} min={0} max={200} step={0.5} onChange={setKm} suffix=" km" />
              </div>
            )}
            <button className="btn primary block" onClick={confirmAdd}>
              Añadir {minutes} min de {cardioById(target.id)?.name.toLowerCase()}
            </button>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
