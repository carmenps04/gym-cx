import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Play, Plus, Search, X } from 'lucide-react';
import { PageHeader, Empty, Thumb } from '../components/ui';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { WEEKDAY_NAMES, WEEKDAY_SHORT, clearDraft, exerciseCount, loadDraft, weekdaysLabel } from '../lib/routine';
import { addDays, isoDate, startOfWeek, weekdayIndex } from '../lib/util';
import { trainedDays } from '../lib/stats';
import { useStartDay } from '../lib/useStart';
import { nextWorkout } from '../lib/next';
import { cardioById, useExercises } from '../lib/catalog';
import type { RoutineItem } from '../types';

export default function Train() {
  const { data, deleteRoutine } = useData();
  const nav = useNavigate();
  const ui = useUi();
  const startDay = useStartDay();
  const now = new Date();
  const today = weekdayIndex(now);
  const name = data.meta.profile.name.trim();

  const { byId } = useExercises();
  const scheduled = useMemo(
    () => data.routines.flatMap((r) => r.days.filter((d) => d.items.length > 0).map((d) => ({ r, d }))),
    [data.routines],
  );
  const next = useMemo(() => nextWorkout(data.routines, data.sessions), [data.routines, data.sessions]);
  const startable = useMemo(() => data.routines.filter((r) => r.days.some((d) => d.items.length > 0)), [data.routines]);

  const itemName = (it: RoutineItem) => (it.kind === 'strength' ? byId.get(it.exerciseId)?.n ?? '…' : cardioById(it.cardioId)?.name ?? 'Cardio');
  const itemRef = (it: RoutineItem) => (it.kind === 'strength' ? it.exerciseId : cardioById(it.cardioId)?.refId);
  const itemGoal = (it: RoutineItem) => (it.kind === 'strength' ? `${it.sets} × ${it.reps}` : `${it.minutes} min`);

  const trained = trainedDays(data.sessions);
  const weekStart = startOfWeek(now);

  const draft = loadDraft();
  const draftRoutine = draft ? data.routines.find((r) => r.id === draft.routineId) : undefined;
  const draftDay = draftRoutine?.days.find((d) => d.id === draft?.dayId);

  const removeRoutine = async (id: string, name: string) => {
    if (!(await ui.confirm({ title: 'Eliminar rutina', message: `Se eliminará «${name}» con sus días y ejercicios. Tu historial de entrenamientos se conserva.`, confirmLabel: 'Eliminar', danger: true }))) return;
    if (loadDraft()?.routineId === id) clearDraft();
    await deleteRoutine(id);
    ui.toast('Rutina eliminada.');
  };

  return (
    <>
      <PageHeader title={name ? `Hola, ${name}` : 'Entrenamiento'} sub={name ? 'Entrenamiento' : undefined} />

      {draft && draftRoutine && draftDay && (
        <section className="card hero resume">
          <h2>Entrenamiento en curso</h2>
          <p>
            {draftRoutine.name}, {draftDay.name}
          </p>
          <div className="row">
            <Link className="btn primary grow" to={`/sesion/${draft.routineId}/${draft.dayId}`}>
              <Play size={18} /> Continuar
            </Link>
            <button
              className="btn"
              onClick={async () => {
                if (await ui.confirm({ title: 'Descartar entrenamiento', message: 'Se perderán las series registradas.', confirmLabel: 'Descartar', danger: true })) {
                  clearDraft();
                  nav('/entrenar', { replace: true });
                }
              }}
            >
              Descartar
            </button>
          </div>
        </section>
      )}

      {!draft && next && (
        <section className="card hero">
          <p className="eyebrow">
            {next.routine.name}, día {next.number} de {next.total}
          </p>
          <h2 className="hero-title">{next.day.name}</h2>
          <ul className="hero-list">
            {next.day.items.map((it) => (
              <li key={it.id}>
                <Thumb exerciseId={itemRef(it)} size={44} />
                <span className="grow">{itemName(it)}</span>
                <b>{itemGoal(it)}</b>
              </li>
            ))}
          </ul>
          <button className="btn primary block" onClick={() => startDay(next.routine.id, next.day.id)}>
            <Play size={18} /> Empezar entrenamiento
          </button>
          <Link className="link center" to={`/rutina/${next.routine.id}/entrenar`}>
            Elegir otro día
          </Link>
        </section>
      )}

      {!draft && !next && (
        <section className="card hero">
          <h2 className="hero-title">Empezar rutina</h2>
          {startable.length === 0 ? (
            <>
              <p className="muted">Aún no tienes ninguna rutina. Crea una para poder empezar.</p>
              <Link className="btn primary block" to="/rutina/nueva">
                <Plus size={18} /> Crear una rutina
              </Link>
            </>
          ) : startable.length === 1 ? (
            <>
              <p className="muted">
                {startable[0].name}, {startable[0].days.length} {startable[0].days.length === 1 ? 'día' : 'días'}. Empiezas por el primer día.
              </p>
              <button
                className="btn primary block"
                onClick={() => {
                  const first = startable[0].days.find((d) => d.items.length > 0);
                  if (first) startDay(startable[0].id, first.id);
                }}
              >
                <Play size={18} /> Empezar rutina
              </button>
            </>
          ) : (
            <>
              <p className="muted">Elige con cuál quieres empezar.</p>
              <div className="stack">
                {[...startable]
                  .sort((a, b) => a.createdAt - b.createdAt)
                  .map((r) => (
                    <button
                      key={r.id}
                      className="btn primary block"
                      onClick={() => {
                        const first = r.days.find((d) => d.items.length > 0);
                        if (first) startDay(r.id, first.id);
                      }}
                    >
                      <Play size={18} /> {r.name}
                    </button>
                  ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="week" aria-label="Esta semana">
        {WEEKDAY_SHORT.map((l, i) => {
          const date = addDays(weekStart, i);
          const did = trained.has(isoDate(date));
          const planned = scheduled.some(({ d }) => d.weekdays.includes(i as 0));
          return (
            <div key={i} className={`wd${i === today ? ' today' : ''}${did ? ' did' : ''}${planned && !did ? ' planned' : ''}`} title={WEEKDAY_NAMES[i]}>
              <span>{l}</span>
              <b>{did ? <Check size={14} strokeWidth={3} aria-label="Entrenado" /> : date.getDate()}</b>
            </div>
          );
        })}
      </section>

      <div className="section-head">
        <h2>Mis rutinas</h2>
      </div>

      {data.routines.length === 0 ? (
        <Empty title="Aún no tienes rutinas" text="Crea una, añade los días de entrenamiento y busca los ejercicios que quieras hacer." />
      ) : (
        <div className="stack">
          {[...data.routines]
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((r) => (
              <article className="card" key={r.id}>
                <div className="split">
                  <h3 className="card-title">{r.name}</h3>
                  <button className="icon-btn sm" aria-label={`Eliminar ${r.name}`} onClick={() => removeRoutine(r.id, r.name)}>
                    <X size={18} />
                  </button>
                </div>
                <p className="muted">
                  {r.days.length} {r.days.length === 1 ? 'día' : 'días'}, {exerciseCount(r)} ejercicios
                </p>
                <ul className="day-list">
                  {r.days.map((d) => (
                    <li key={d.id}>
                      <span>{d.name}</span>
                      <span className="muted">{weekdaysLabel(d)}</span>
                    </li>
                  ))}
                </ul>
                <div className="row">
                  <Link className="btn grow" to={`/rutina/${r.id}`}>
                    Ver rutina
                  </Link>
                  <Link className="btn primary grow" to={`/rutina/${r.id}/entrenar`}>
                    <Play size={16} /> Entrenar
                  </Link>
                </div>
              </article>
            ))}
        </div>
      )}

      <div className="stack gap-top">
        {startable.length > 0 && (
          <Link className="btn block" to="/rutina/nueva">
            <Plus size={18} /> Crear una rutina
          </Link>
        )}
        <Link className="btn block" to="/explorar">
          <Search size={18} /> Buscar ejercicios
        </Link>
      </div>

    </>
  );
}
