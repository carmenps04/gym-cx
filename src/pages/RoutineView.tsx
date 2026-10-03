import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Play, Trash2 } from 'lucide-react';
import { Empty, PageHeader, Thumb } from '../components/ui';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { cardioById, useExercises } from '../lib/catalog';
import { clearDraft, exerciseCount, loadDraft, weekdaysLabel } from '../lib/routine';
import { useStartDay } from '../lib/useStart';

export default function RoutineView() {
  const { rid } = useParams();
  const nav = useNavigate();
  const ui = useUi();
  const { data, deleteRoutine } = useData();
  const { byId } = useExercises();
  const startDay = useStartDay();
  const routine = data.routines.find((r) => r.id === rid);

  if (!routine) {
    return (
      <>
        <PageHeader title="Rutina" back="/entrenar" />
        <Empty title="No se encontró la rutina" text="Puede que se haya eliminado." action={<Link className="btn" to="/entrenar">Volver a Entrenamiento</Link>} />
      </>
    );
  }

  const remove = async () => {
    if (!(await ui.confirm({ title: 'Eliminar rutina', message: `Se eliminará «${routine.name}» con sus días y ejercicios. Tu historial de entrenamientos se conserva.`, confirmLabel: 'Eliminar', danger: true }))) return;
    if (loadDraft()?.routineId === routine.id) clearDraft();
    await deleteRoutine(routine.id);
    ui.toast('Rutina eliminada.');
    nav('/entrenar', { replace: true });
  };

  const n = exerciseCount(routine);
  return (
    <>
      <PageHeader title={routine.name} sub={`${routine.days.length} ${routine.days.length === 1 ? 'día' : 'días'}, ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}`} back="/entrenar" />
      <div className="stack">
        {routine.days.map((d, i) => (
          <section className="card" key={d.id}>
            <div>
              <small className="muted">Día {i + 1}, {weekdaysLabel(d)}</small>
              <h2 className="card-title">{d.name}</h2>
            </div>
            {d.items.length === 0 ? (
              <p className="muted">Este día no tiene ejercicios.</p>
            ) : (
              <ul className="items">
                {d.items.map((it) => {
                  const ex = it.kind === 'strength' ? byId.get(it.exerciseId) : undefined;
                  const cd = it.kind === 'cardio' ? cardioById(it.cardioId) : undefined;
                  return (
                    <li className="item item-row" key={it.id}>
                      <Link to={it.kind === 'strength' ? `/ejercicio/${encodeURIComponent(it.exerciseId)}` : `/ejercicio/cardio_${it.cardioId}`} className="item-main">
                        <Thumb exerciseId={it.kind === 'strength' ? it.exerciseId : cd?.refId} size={56} />
                        <span className="result-text">
                          <b>{it.kind === 'strength' ? ex?.n ?? '…' : cd?.name ?? 'Cardio'}</b>
                          <small className="muted">{it.kind === 'strength' ? `${it.sets} series, ${it.reps} reps` : `${it.minutes} min${it.distanceKm ? `, ${it.distanceKm} km` : ''}`}</small>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {d.items.length > 0 && (
              <button className="btn sm" onClick={() => startDay(routine.id, d.id)}>
                <Play size={16} /> Entrenar este día
              </button>
            )}
          </section>
        ))}
      </div>
      <div className="stack gap-top">
        <Link className="btn primary block" to={`/rutina/${routine.id}/editar`}>
          <Pencil size={18} /> Editar rutina
        </Link>
        <Link className="btn block" to={`/rutina/${routine.id}/entrenar`}>
          <Play size={18} /> Entrenar
        </Link>
        <button className="btn danger-text block" onClick={remove}>
          <Trash2 size={18} /> Eliminar rutina
        </button>
      </div>
    </>
  );
}
