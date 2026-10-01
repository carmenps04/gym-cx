import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Empty, PageHeader } from '../components/ui';
import { useData } from '../state/data';
import { cardioById, useExercises } from '../lib/catalog';
import { weekdayIndex } from '../lib/util';
import { useStartDay } from '../lib/useStart';

export default function DayPicker() {
  const { rid } = useParams();
  const { data } = useData();
  const { byId } = useExercises();
  const startDay = useStartDay();
  const routine = data.routines.find((r) => r.id === rid);
  const days = useMemo(() => routine?.days.filter((d) => d.items.length > 0) ?? [], [routine]);
  const today = weekdayIndex(new Date());

  // Día sugerido: el programado para hoy; si no, el siguiente al último entrenado de esta rutina.
  const suggested = useMemo(() => {
    const scheduled = days.find((d) => d.weekdays.includes(today as 0));
    if (scheduled) return { id: scheduled.id, why: 'Toca hoy' };
    const last = data.sessions.filter((s) => s.routineId === rid).sort((a, b) => b.endedAt - a.endedAt)[0];
    const idx = last ? days.findIndex((d) => d.id === last.dayId) : -1;
    if (idx >= 0) return { id: days[(idx + 1) % days.length].id, why: 'Siguiente en tu rotación' };
    return days.length ? { id: days[0].id, why: '' } : null;
  }, [days, data.sessions, rid, today]);

  const [chosen, setChosen] = useState<string | null>(null);
  const selectedId = chosen ?? suggested?.id ?? null;
  const selected = days.find((d) => d.id === selectedId);

  if (!routine) return (
    <>
      <PageHeader title="Entrenar" back="/entrenar" />
      <Empty title="No se encontró la rutina" action={<Link className="btn" to="/entrenar">Volver a Entrenamiento</Link>} />
    </>
  );
  if (days.length === 0) return (
    <>
      <PageHeader title="Entrenar" back={`/rutina/${routine.id}`} />
      <Empty title="Esta rutina no tiene ejercicios" text="Añade al menos un ejercicio para poder entrenarla." action={<Link className="btn primary" to={`/rutina/${routine.id}/editar`}>Editar rutina</Link>} />
    </>
  );

  return (
    <>
      <PageHeader title="¿Qué quieres entrenar hoy?" sub="Revisa los ejercicios y elige el día que prefieras." back={`/rutina/${routine.id}`} />
      <div className="stack" role="radiogroup" aria-label="Día a entrenar">
        {days.map((d) => (
          <button key={d.id} role="radio" aria-checked={d.id === selectedId} className={`radio-card${d.id === selectedId ? ' on' : ''}`} onClick={() => setChosen(d.id)}>
            <span className="grow">
              <b>{d.name}</b>
              <small className="muted">
                {d.items.length} {d.items.length === 1 ? 'ejercicio' : 'ejercicios'}
                {d.id === suggested?.id && suggested.why ? `, ${suggested.why.toLowerCase()}` : ''}
              </small>
            </span>
            <span className="radio-dot" aria-hidden="true" />
          </button>
        ))}
      </div>
      {selected && (
        <section className="card">
          <h2 className="h3">Vas a entrenar {selected.name}</h2>
          <ol className="review-list">
            {selected.items.map((it) => (
              <li key={it.id}>
                <span>{it.kind === 'strength' ? byId.get(it.exerciseId)?.n ?? '…' : cardioById(it.cardioId)?.name ?? 'Cardio'}</span>
                <small className="muted">{it.kind === 'strength' ? `${it.sets} series, ${it.reps} reps` : `${it.minutes} min`}</small>
              </li>
            ))}
          </ol>
          <button className="btn primary block" onClick={() => startDay(routine.id, selected.id)}>
            <Play size={18} /> Empezar este día
          </button>
        </section>
      )}
    </>
  );
}
