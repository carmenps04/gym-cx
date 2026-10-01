import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Plus, Search, Shuffle, Trash2 } from 'lucide-react';
import { Chip, Empty, PageHeader, Stepper, Thumb } from '../components/ui';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { CARDIO, EQUIPMENT, MUSCLES, cardioById, equipLabel, muscleLabel, useExercises } from '../lib/catalog';
import type { CardioDef, Ex } from '../lib/catalog';
import { searchExercises } from '../lib/search';
import { proposeExercises } from '../lib/propose';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, newDay, toggleWeekday, weekdaysLabel } from '../lib/routine';
import { uid } from '../lib/util';
import type { Routine, RoutineDay, RoutineItem, StrengthItem } from '../types';

const MAX_PER_DAY = 7;
const PAGE = 30;
type Step = 'plan' | 'days' | 'review';
type Sub =
  | { kind: 'muscle' }
  | { kind: 'proposal'; muscle: string; picks: Ex[]; seen: string[] }
  | { kind: 'pick' }
  | { kind: 'target'; exerciseId?: string; cardioId?: string; itemId?: string };

function itemSummary(it: RoutineItem): string {
  if (it.kind === 'strength') return `${it.sets} series, ${it.reps} reps`;
  return `${it.minutes} min${it.distanceKm ? `, ${it.distanceKm} km` : ''}`;
}

function WizardSteps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ['Tu plan', 'Ejercicios', 'Revisar'];
  return (
    <ol className="wiz-steps" aria-label="Pasos">
      {labels.map((l, i) => (
        <li key={l} className={i + 1 === current ? 'on' : i + 1 < current ? 'past' : ''} aria-current={i + 1 === current ? 'step' : undefined}>
          <b>{i + 1}</b>
          <span>{l}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- selector de ejercicio

function ExercisePicker({ list, loading, gear, full, onPick, onPickCardio, onBack }: { list: Ex[]; loading: boolean; gear: string[]; full: boolean; onPick: (e: Ex) => void; onPickCardio: (c: CardioDef) => void; onBack: () => void }) {
  const [tab, setTab] = useState<'fuerza' | 'cardio'>('fuerza');
  const [text, setText] = useState('');
  const [muscle, setMuscle] = useState('');
  const [material, setMaterial] = useState(gear.length ? 'mine' : 'all');
  const [shown, setShown] = useState(PAGE);

  const equipment = material === 'mine' ? gear : material === 'all' ? [] : [material];
  const results = useMemo(() => searchExercises(list, { text, muscles: muscle ? [muscle] : [], equipment, type: 'all', includeSecondary: false }), [list, text, muscle, material, gear]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Elige un ejercicio" sub="Busca por nombre o filtra por músculo y material." back={onBack} />
      <div className="segmented" role="radiogroup" aria-label="Tipo de ejercicio">
        {(['fuerza', 'cardio'] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'fuerza' ? 'Fuerza' : 'Cardio'}
          </button>
        ))}
      </div>

      {tab === 'cardio' ? (
        <ul className="results">
          {CARDIO.map((c) => (
            <li key={c.id}>
              <button className="result result-btn" disabled={full} onClick={() => onPickCardio(c)}>
                <Thumb exerciseId={c.refId} size={56} />
                <span className="result-text">
                  <b>{c.name}</b>
                  <small>{c.distance ? 'Tiempo y distancia' : 'Tiempo'}</small>
                </span>
                <Plus size={20} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="input-icon">
            <Search size={18} aria-hidden="true" />
            <input className="input" type="search" aria-label="Buscar ejercicio" placeholder="Buscar ejercicio…" value={text} onChange={(e) => { setText(e.target.value); setShown(PAGE); }} />
          </div>
          <div className="row">
            <select className="input grow" aria-label="Músculo" value={muscle} onChange={(e) => { setMuscle(e.target.value); setShown(PAGE); }}>
              <option value="">Todos los músculos</option>
              {MUSCLES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <select className="input grow" aria-label="Material" value={material} onChange={(e) => { setMaterial(e.target.value); setShown(PAGE); }}>
              {gear.length > 0 && <option value="mine">Mi material</option>}
              <option value="all">Todo el material</option>
              {EQUIPMENT.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <p className="muted" role="status">Cargando catálogo…</p>
          ) : (
            <p className="count" role="status">
              {results.length} {results.length === 1 ? 'ejercicio' : 'ejercicios'}
            </p>
          )}
          {!loading && results.length === 0 ? (
            <Empty title="Ningún ejercicio cumple las condiciones" text="Prueba con otro material, otro músculo o menos letras." />
          ) : (
            <ul className="results">
              {results.slice(0, shown).map((ex) => (
                <li key={ex.i}>
                  <button className="result result-btn" disabled={full} onClick={() => onPick(ex)}>
                    <Thumb exerciseId={ex.i} size={56} />
                    <span className="result-text">
                      <b>{ex.n}</b>
                      <small>
                        {equipLabel(ex.q)}, {ex.p.map(muscleLabel).join(', ')}
                      </small>
                    </span>
                    <Plus size={20} aria-hidden="true" />
                  </button>
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
    </>
  );
}

// ---------------------------------------------------------------- series y objetivo

function TargetForm({ title, subtitle, initial, cardio, onSave, onBack }: { title: string; subtitle: string; initial: RoutineItem | null; cardio?: CardioDef; onSave: (patch: Partial<StrengthItem> & { minutes?: number; distanceKm?: number }) => void; onBack: () => void }) {
  const s = initial?.kind === 'strength' ? initial : null;
  const c = initial?.kind === 'cardio' ? initial : null;
  const [sets, setSets] = useState(s?.sets ?? 3);
  const [reps, setReps] = useState(s?.reps ?? 10);
  const [minutes, setMinutes] = useState(c?.minutes ?? cardio?.defaultMinutes ?? 20);
  const [km, setKm] = useState(c?.distanceKm ?? 0);
  return (
    <>
      <PageHeader title="Series y objetivo" back={onBack} />
      <section className="card">
        <h2 className="h3">{title}</h2>
        <p className="muted">{subtitle}</p>
        {cardio ? (
          <>
            <div className="split">
              <span>Minutos</span>
              <Stepper label="minutos" value={minutes} min={1} max={240} step={5} onChange={setMinutes} />
            </div>
            {cardio.distance && (
              <div className="split">
                <span>Kilómetros (opcional)</span>
                <Stepper label="kilómetros" value={km} min={0} max={200} step={0.5} onChange={setKm} />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="split">
              <span>Series</span>
              <Stepper label="series" value={sets} min={1} max={12} onChange={setSets} />
            </div>
            <div className="split">
              <span>Repeticiones por serie</span>
              <Stepper label="repeticiones" value={reps} min={1} max={100} onChange={setReps} />
            </div>
          </>
        )}
        <button className="btn primary block" onClick={() => onSave(cardio ? { minutes, distanceKm: km > 0 ? km : undefined } : { sets, reps })}>
          <Check size={18} /> Guardar objetivo
        </button>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- asistente

function Wizard({ initial, editing }: { initial: Routine; editing: boolean }) {
  const nav = useNavigate();
  const ui = useUi();
  const { data, saveRoutine } = useData();
  const { list, byId, loading } = useExercises();
  const snapshot = useMemo(() => JSON.stringify(initial), [initial]);

  const [routine, setRoutine] = useState<Routine>(initial);
  const [step, setStep] = useState<Step>(editing ? 'review' : 'plan');
  const [dayIdx, setDayIdx] = useState(0);
  const [sub, setSub] = useState<Sub | null>(null);
  const [perWeek, setPerWeek] = useState(editing ? initial.days.length : 3);
  const [gear, setGear] = useState<string[]>(data.meta.settings.equipment);
  const [saving, setSaving] = useState(false);

  const day = routine.days[Math.min(dayIdx, routine.days.length - 1)];
  const dIdx = routine.days.indexOf(day);
  const dirty = JSON.stringify(routine) !== snapshot;
  const usedIds = useMemo(() => new Set(routine.days.flatMap((d) => d.items.filter((i): i is StrengthItem => i.kind === 'strength').map((i) => i.exerciseId))), [routine]);

  const patchDay = (idx: number, fn: (d: RoutineDay) => RoutineDay) => setRoutine((r) => ({ ...r, days: r.days.map((d, i) => (i === idx ? fn(d) : d)) }));
  const addItems = (items: RoutineItem[], dayName?: string) =>
    patchDay(dIdx, (d) => ({ ...d, name: dayName && /^Día \d+$/.test(d.name) ? dayName : d.name, items: [...d.items, ...items].slice(0, MAX_PER_DAY) }));
  const move = (idx: number, dir: -1 | 1) =>
    patchDay(dIdx, (d) => {
      const items = [...d.items];
      const j = idx + dir;
      if (j < 0 || j >= items.length) return d;
      [items[idx], items[j]] = [items[j], items[idx]];
      return { ...d, items };
    });

  const exit = async () => {
    if (dirty && !(await ui.confirm({ title: 'Salir sin guardar', message: 'Se perderán los cambios de esta rutina.', confirmLabel: 'Salir', danger: true }))) return;
    nav(editing ? `/rutina/${initial.id}` : '/entrenar', { replace: true });
  };

  const goBack = () => {
    if (sub) {
      if (sub.kind === 'proposal') setSub({ kind: 'muscle' });
      else if (sub.kind === 'target' && !sub.itemId) setSub({ kind: 'pick' });
      else setSub(null);
    } else if (step === 'review') editing ? void exit() : setStep('days');
    else if (step === 'days') setStep(editing ? 'review' : 'plan');
    else void exit();
  };

  // ---- paso 1 → 2: ajusta el número de días
  const toDays = async () => {
    const cur = routine.days;
    if (perWeek < cur.length) {
      const removed = cur.slice(perWeek);
      if (removed.some((d) => d.items.length > 0) && !(await ui.confirm({ title: 'Se quitarán días con ejercicios', message: `Se eliminarán ${removed.length} ${removed.length === 1 ? 'día' : 'días'} del final de la rutina, con sus ejercicios.`, confirmLabel: 'Quitar días', danger: true }))) return;
    }
    setRoutine((r) => {
      const days = r.days.slice(0, perWeek);
      for (let k = days.length; k < perWeek; k++) days.push(newDay(k + 1));
      return { ...r, name: r.name.trim() || `Rutina ${data.routines.length + 1}`, days };
    });
    setDayIdx((i) => Math.min(i, perWeek - 1));
    setStep('days');
  };

  // ---- paso 2 → 3: todos los días necesitan al menos un ejercicio
  const toReview = async () => {
    const empty = routine.days.findIndex((d) => d.items.length === 0);
    if (empty >= 0) {
      await ui.confirm({ title: 'Rellena todos los días de entrenamiento', message: 'Debes rellenar al menos con 1 ejercicio cada día antes de guardar.', confirmLabel: 'Entendido', hideCancel: true });
      setDayIdx(empty);
      return;
    }
    setStep('review');
  };

  const save = async () => {
    if (routine.days.some((d) => d.items.length === 0)) return void toReview();
    setSaving(true);
    try {
      const final: Routine = { ...routine, name: routine.name.trim() || 'Rutina', updatedAt: Date.now(), days: routine.days.map((d, i) => ({ ...d, name: d.name.trim() || `Día ${i + 1}` })) };
      await saveRoutine(final);
      ui.toast('Rutina guardada.');
      nav(editing ? `/rutina/${final.id}` : '/entrenar', { replace: true });
    } catch {
      ui.toast('No se pudo guardar. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  const propose = (muscle: string, seenIn: string[]) => {
    const exclude = new Set([...usedIds, ...seenIn]);
    let seen = seenIn;
    let picks = proposeExercises(list, muscle, gear, exclude, 3);
    if (picks.length === 0 && seenIn.length > 0) {
      picks = proposeExercises(list, muscle, gear, usedIds, 3);
      seen = [];
    }
    setSub({ kind: 'proposal', muscle, picks, seen: [...seen, ...picks.map((p) => p.i)] });
  };

  const remaining = MAX_PER_DAY - (day?.items.length ?? 0);

  // ================= subpantallas =================
  if (sub?.kind === 'muscle') {
    const otherMuscles = new Set(routine.days.filter((_, i) => i !== dIdx).flatMap((d) => d.items.flatMap((i) => (i.kind === 'strength' ? byId.get(i.exerciseId)?.p ?? [] : []))));
    return (
      <>
        <PageHeader title="¿Qué músculo quieres hacer este día?" sub="Los marcados ya están en otros días. Puedes repetirlos." back={goBack} />
        {loading && <p className="muted" role="status">Cargando catálogo…</p>}
        <div className="muscle-grid">
          {MUSCLES.map((m) => (
            <button key={m.id} className={`muscle${otherMuscles.has(m.id) ? ' used' : ''}`} disabled={loading} onClick={() => propose(m.id, [])}>
              {m.label}
              {otherMuscles.has(m.id) && <small>en otro día</small>}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (sub?.kind === 'proposal') {
    const label = muscleLabel(sub.muscle).toLowerCase();
    const take = sub.picks.slice(0, remaining);
    return (
      <>
        <PageHeader title={`Tu propuesta de ${label}`} sub={sub.picks.length ? `${sub.picks.length} ${sub.picks.length === 1 ? 'ejercicio' : 'ejercicios'} según el material elegido. Después puedes añadir, quitar o cambiar cualquiera.` : undefined} back={goBack} />
        {sub.picks.length === 0 ? (
          <Empty title="No hay ejercicios para ese músculo con tu material" text="Elige otro músculo o añade más material en el primer paso." />
        ) : (
          <ul className="results">
            {sub.picks.map((ex) => (
              <li className="result" key={ex.i}>
                <Thumb exerciseId={ex.i} size={56} />
                <span className="result-text">
                  <b>{ex.n}</b>
                  <small>{equipLabel(ex.q)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
        {sub.picks.length > take.length && <p className="hint">Solo caben {take.length} más en este día (máximo {MAX_PER_DAY}).</p>}
        {take.length > 0 && (
          <button
            className="btn primary block"
            onClick={() => {
              addItems(take.map((e) => ({ kind: 'strength', id: uid(), exerciseId: e.i, sets: 3, reps: 10 })), muscleLabel(sub.muscle));
              setSub(null);
            }}
          >
            Añadir {take.length === 1 ? 'este ejercicio' : `estos ${take.length} ejercicios`}
          </button>
        )}
        <div className="row">
          {sub.picks.length > 0 && (
            <button className="btn grow" onClick={() => propose(sub.muscle, sub.seen)}>
              Otra propuesta
            </button>
          )}
          <button className="btn grow" onClick={() => setSub({ kind: 'muscle' })}>
            Cambiar músculo
          </button>
        </div>
      </>
    );
  }

  if (sub?.kind === 'pick') {
    return (
      <ExercisePicker
        list={list}
        loading={loading}
        gear={gear}
        full={remaining <= 0}
        onBack={goBack}
        onPick={(e) => setSub({ kind: 'target', exerciseId: e.i })}
        onPickCardio={(c) => setSub({ kind: 'target', cardioId: c.id })}
      />
    );
  }

  if (sub?.kind === 'target') {
    const existing = sub.itemId ? day.items.find((i) => i.id === sub.itemId) ?? null : null;
    const cardioId = sub.cardioId ?? (existing?.kind === 'cardio' ? existing.cardioId : undefined);
    const exerciseId = sub.exerciseId ?? (existing?.kind === 'strength' ? existing.exerciseId : undefined);
    const cardio = cardioId ? cardioById(cardioId) : undefined;
    const ex = exerciseId ? byId.get(exerciseId) : undefined;
    return (
      <TargetForm
        key={sub.itemId ?? sub.exerciseId ?? sub.cardioId}
        title={cardio?.name ?? ex?.n ?? 'Ejercicio'}
        subtitle={cardio ? 'Cardio' : ex ? equipLabel(ex.q) : ''}
        initial={existing}
        cardio={cardio}
        onBack={goBack}
        onSave={(patch) => {
          if (sub.itemId) patchDay(dIdx, (d) => ({ ...d, items: d.items.map((i) => (i.id === sub.itemId ? ({ ...i, ...patch } as RoutineItem) : i)) }));
          else if (cardio) addItems([{ kind: 'cardio', id: uid(), cardioId: cardio.id, minutes: patch.minutes ?? cardio.defaultMinutes, distanceKm: patch.distanceKm }]);
          else if (exerciseId) addItems([{ kind: 'strength', id: uid(), exerciseId, sets: patch.sets ?? 3, reps: patch.reps ?? 10 }]);
          setSub(null);
        }}
      />
    );
  }

  // ================= pasos =================
  if (step === 'plan') {
    return (
      <>
        <PageHeader title="Hagámosla tuya" sub="Organiza tus días. Tú eliges cuándo entrenar cada uno." back={goBack} />
        <WizardSteps current={1} />
        <label className="field">
          <span>Nombre de tu rutina</span>
          <input className="input big" value={routine.name} maxLength={60} placeholder="Ej. Mi rutina de fuerza" onChange={(e) => setRoutine((r) => ({ ...r, name: e.target.value }))} />
        </label>
        <div>
          <div className="field-label">¿Cuántos días vas a entrenar a la semana?</div>
          <div className="num-grid" role="radiogroup" aria-label="Días de entrenamiento a la semana">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={perWeek === n} className={perWeek === n ? 'on' : ''} onClick={() => setPerWeek(n)}>
                {n}
              </button>
            ))}
          </div>
          <p className="hint">Organiza de 1 a 7 días de entrenamiento.</p>
        </div>
        <div>
          <div className="field-label">Material que sueles tener</div>
          <div className="chips">
            {EQUIPMENT.map((m) => (
              <Chip key={m.id} active={gear.includes(m.id)} onClick={() => setGear((g) => (g.includes(m.id) ? g.filter((x) => x !== m.id) : [...g, m.id]))}>
                {m.label}
              </Chip>
            ))}
          </div>
          <p className="hint">Se usará como filtro inicial al buscar ejercicios y en «Decide por mí». Sin nada marcado, se usa todo el catálogo.</p>
        </div>
        <button className="btn primary block" onClick={toDays}>
          Elegir ejercicios
        </button>
      </>
    );
  }

  if (step === 'days') {
    return (
      <>
        <PageHeader title="Un orden que sea tuyo" sub="Añade los ejercicios, ajusta las series y usa las flechas para cambiar su orden." back={goBack} />
        <WizardSteps current={2} />
        <div className="day-tabs" role="tablist" aria-label="Días de la rutina">
          {routine.days.map((d, i) => (
            <button key={d.id} role="tab" aria-selected={i === dIdx} className={`chip${i === dIdx ? ' on' : ''}`} onClick={() => setDayIdx(i)}>
              Día {i + 1}/{routine.days.length}
              {d.items.length > 0 && <Check size={14} aria-label="con ejercicios" />}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Nombre de este día</span>
          <input className="input" value={day.name} maxLength={40} onChange={(e) => patchDay(dIdx, (d) => ({ ...d, name: e.target.value }))} />
        </label>
        <div>
          <div className="field-label">Días de la semana (opcional)</div>
          <div className="chips" role="group" aria-label="Días de la semana en que lo entrenas">
            {WEEKDAY_SHORT.map((l, w) => (
              <button key={w} type="button" className={`wd-chip${day.weekdays.includes(w as 0) ? ' on' : ''}`} aria-pressed={day.weekdays.includes(w as 0)} aria-label={WEEKDAY_NAMES[w]} onClick={() => patchDay(dIdx, (d) => ({ ...d, weekdays: toggleWeekday(d.weekdays, w as 0) }))}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="section-head">
          <h2>Ejercicios</h2>
          <span className="muted" aria-label={`${day.items.length} de ${MAX_PER_DAY} ejercicios`}>
            {day.items.length} / {MAX_PER_DAY}
          </span>
        </div>

        {day.items.length === 0 ? (
          <section className="card empty-day">
            <h3>Este día lo decides tú.</h3>
            <p className="muted">Busca un ejercicio o filtra por músculo y material.</p>
            <button className="btn" onClick={() => setSub({ kind: 'muscle' })}>
              <Shuffle size={16} /> Decide por mí
            </button>
          </section>
        ) : (
          <ul className="stack">
            {day.items.map((it, idx) => {
              const ex = it.kind === 'strength' ? byId.get(it.exerciseId) : undefined;
              const cd = it.kind === 'cardio' ? cardioById(it.cardioId) : undefined;
              const name = it.kind === 'strength' ? ex?.n ?? 'Cargando…' : cd?.name ?? 'Cardio';
              return (
                <li className="card exo-row" key={it.id}>
                  <span className="exo-num" aria-hidden="true">{idx + 1}</span>
                  <div className="grow">
                    <b className="item-name">{name}</b>
                    <small className="muted">{itemSummary(it)}</small>
                    <div className="exo-actions">
                      <button className="btn sm" onClick={() => setSub({ kind: 'target', itemId: it.id })}>
                        {it.kind === 'strength' ? 'Series y reps' : 'Tiempo'}
                      </button>
                      <span className="item-tools">
                        <button className="icon-btn sm" aria-label="Subir" disabled={idx === 0} onClick={() => move(idx, -1)}>
                          <ArrowUp size={16} />
                        </button>
                        <button className="icon-btn sm" aria-label="Bajar" disabled={idx === day.items.length - 1} onClick={() => move(idx, 1)}>
                          <ArrowDown size={16} />
                        </button>
                        <button className="icon-btn sm" aria-label={`Quitar ${name}`} onClick={() => patchDay(dIdx, (d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) }))}>
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <button className="btn block" disabled={remaining <= 0} onClick={() => setSub({ kind: 'pick' })}>
          <Plus size={18} /> Añadir ejercicio
        </button>
        <p className="hint center">Hasta {MAX_PER_DAY} ejercicios por día en tu rutina.</p>
        <button className="btn primary block" onClick={toReview}>
          Revisar mi rutina
        </button>
      </>
    );
  }

  // review
  return (
    <>
      <PageHeader title={routine.name || 'Rutina'} sub="Así quedará tu plan. Puedes volver y cambiar cualquier detalle." back={goBack} />
      <WizardSteps current={3} />
      <div className="stack">
        {routine.days.map((d, i) => (
          <section className="card" key={d.id}>
            <div className="split">
              <div>
                <small className="muted">Día {i + 1}</small>
                <h3 className="card-title">{d.name}</h3>
                <small className="muted">{weekdaysLabel(d)}</small>
              </div>
              <button className="btn sm" onClick={() => { setDayIdx(i); setStep('days'); }}>
                Editar
              </button>
            </div>
            {d.items.length === 0 ? (
              <p className="muted">Sin ejercicios todavía.</p>
            ) : (
              <ol className="review-list">
                {d.items.map((it) => (
                  <li key={it.id}>
                    <span>{it.kind === 'strength' ? byId.get(it.exerciseId)?.n ?? '…' : cardioById(it.cardioId)?.name ?? 'Cardio'}</span>
                    <small className="muted">{itemSummary(it)}</small>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
      <button className="link center" onClick={() => setStep('plan')}>
        Cambiar nombre o número de días
      </button>
      <button className="btn primary block" onClick={save} disabled={saving}>
        {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar rutina'}
      </button>
    </>
  );
}

export default function RoutineWizard() {
  const { rid } = useParams();
  const { data } = useData();
  const existing = rid ? data.routines.find((r) => r.id === rid) : undefined;
  const fresh = useMemo<Routine>(() => {
    const now = Date.now();
    return { id: uid(), name: '', days: [newDay(1)], createdAt: now, updatedAt: now };
  }, []);
  if (rid && !existing) {
    return (
      <>
        <PageHeader title="Rutina" back="/entrenar" />
        <Empty title="No se encontró la rutina" text="Puede que se haya eliminado." action={<Link className="btn" to="/entrenar">Volver a Entrenamiento</Link>} />
      </>
    );
  }
  return <Wizard key={existing?.id ?? 'nueva'} initial={existing ?? fresh} editing={Boolean(existing)} />;
}
