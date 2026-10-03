import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Empty, PageHeader, Stepper } from '../components/ui';
import { MuscleFigure } from '../components/MuscleFigure';
import { Preview, Steps, VideoCard } from '../components/Technique';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { LEVEL_LABEL, cardioById, equipLabel, muscleLabel, useExercises } from '../lib/catalog';
import { exerciseSeries, lastSets } from '../lib/stats';
import { fmtNum, kgToUnit, uid } from '../lib/util';
import type { RoutineItem } from '../types';

export default function ExercisePage() {
  const { eid = '' } = useParams();
  const [sp] = useSearchParams();
  const rid = sp.get('rid');
  const did = sp.get('did');
  const nav = useNavigate();
  const ui = useUi();
  const { data, saveRoutine } = useData();
  const { byId, loading } = useExercises();
  const units = data.meta.settings.units;

  const isCardio = eid.startsWith('cardio_');
  const cardio = isCardio ? cardioById(eid.slice(7)) : undefined;
  const ex = byId.get(isCardio ? (cardio?.refId ?? '') : eid);

  const routine = rid ? data.routines.find((r) => r.id === rid) : undefined;
  const day = routine?.days.find((d) => d.id === did);

  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [minutes, setMinutes] = useState(cardio?.defaultMinutes ?? 20);

  const title = isCardio ? cardio?.name : ex?.n;

  const history = useMemo(() => (!isCardio && ex ? { last: lastSets(data.sessions, ex.i), series: exerciseSeries(data.sessions, ex.i) } : null), [data.sessions, ex, isCardio]);

  if (isCardio ? !cardio : !ex && !loading) {
    return (
      <>
        <PageHeader title="Ejercicio" back />
        <Empty title="No se encontró el ejercicio" />
      </>
    );
  }
  if (!title) return <div className="splash">Cargando…</div>;

  const add = async () => {
    if (!routine || !day) return;
    const item: RoutineItem = isCardio && cardio ? { kind: 'cardio', id: uid(), cardioId: cardio.id, minutes } : { kind: 'strength', id: uid(), exerciseId: eid, sets, reps };
    await saveRoutine({ ...routine, updatedAt: Date.now(), days: routine.days.map((d) => (d.id === day.id ? { ...d, items: [...d.items, item] } : d)) });
    ui.toast(`Añadido a ${day.name}`);
    nav(-1);
  };

  const best = history?.series.length ? Math.max(...history.series.map((s) => s.maxWeight)) : 0;

  return (
    <>
      <PageHeader title={title} sub={!isCardio && ex ? ex.e : undefined} back />

      {ex ? <Preview ex={ex} name={title} /> : <div className="preview"><div className="preview-empty">Sin foto disponible</div></div>}

      <div className="tags">
        {ex ? (
          <>
            {ex.p.map((m) => (
              <span className="tag strong" key={m}>{muscleLabel(m)}</span>
            ))}
            {ex.s.map((m) => (
              <span className="tag" key={m}>{muscleLabel(m)}</span>
            ))}
            <span className="tag">{equipLabel(ex.q)}</span>
            <span className="tag">{LEVEL_LABEL[ex.l] ?? ex.l}</span>
          </>
        ) : (
          <span className="tag">Cardio</span>
        )}
      </div>
      {ex && ex.s.length > 0 && <p className="hint">Los músculos con etiqueta oscura son los principales; los demás trabajan como apoyo.</p>}
      {cardio && <p className="muted">{cardio.hint}</p>}

      {ex && <Steps ex={ex} />}

      <VideoCard videoKey={eid} title={title} />

      {ex && (
        <section className="card figure-card" aria-label="Músculos trabajados">
          <h2 className="h3">Músculos trabajados</h2>
          <div className="figures">
            <figure>
              <MuscleFigure primary={ex.p} secondary={ex.s} view="front" />
              <figcaption>Frente</figcaption>
            </figure>
            <figure>
              <MuscleFigure primary={ex.p} secondary={ex.s} view="back" />
              <figcaption>Espalda</figcaption>
            </figure>
          </div>
          <p className="legend">
            <span className="dot hot" /> Principal
            {ex.s.length > 0 && (
              <>
                <span className="dot warm" /> Apoyo
              </>
            )}
          </p>
        </section>
      )}

      {history && history.series.length > 0 && history.last && (
        <section className="card">
          <h2 className="h3">Tu historial</h2>
          <p>
            Mejor peso: <b>{fmtNum(kgToUnit(best, units))} {units}</b>. Última vez:{' '}
            {history.last.map((s) => `${fmtNum(kgToUnit(s.weight, units))} ${units} × ${s.reps}`).join(', ')}.
          </p>
        </section>
      )}

      {routine && day && (
        <div className="float-bar">
          <div className="add-bar">
            {isCardio ? (
              <Stepper label="minutos" value={minutes} min={1} max={240} step={5} onChange={setMinutes} suffix=" min" />
            ) : (
              <>
                <Stepper label="series" value={sets} min={1} max={12} onChange={setSets} suffix=" series" />
                <Stepper label="repeticiones" value={reps} min={1} max={100} onChange={setReps} suffix=" reps" />
              </>
            )}
            <button className="btn primary grow" onClick={add}>
              <Plus size={18} /> Añadir a {day.name}
            </button>
          </div>
        </div>
      )}
      {!routine && rid && <p className="muted">La rutina ya no existe.</p>}
      <div className="spacer" />
    </>
  );
}
