import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Minus, Play, Plus, X } from 'lucide-react';
import { Empty, NumInput, PageHeader, Plate, Sheet, Thumb } from '../components/ui';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { cardioById, useExercises } from '../lib/catalog';
import { Preview, Steps, VideoCard } from '../components/Technique';
import { clearDraft, loadDraft, saveDraft } from '../lib/routine';
import { findRecords, lastSets, sessionSetCount, sessionVolume } from '../lib/stats';
import { fmtNum, formatClock, formatMinutes, kgToUnit, uid, unitToKg } from '../lib/util';
import type { Draft, LoggedSet, Session as SessionT, SessionEntry } from '../types';

interface Summary {
  seconds: number;
  sets: number;
  volume: number;
  records: { name: string; weight: number }[];
}

export default function Session() {
  const { rid, did } = useParams();
  const nav = useNavigate();
  const ui = useUi();
  const { data, saveSession } = useData();
  const { byId } = useExercises();
  const units = data.meta.settings.units;
  const restSec = data.meta.settings.restSec;

  const routine = data.routines.find((r) => r.id === rid);
  const day = routine?.days.find((d) => d.id === did);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [now, setNow] = useState(Date.now());
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  // Técnica abierta durante el entrenamiento: id del catálogo, clave del vídeo y título.
  const [tech, setTech] = useState<{ exId: string; videoKey: string; title: string } | null>(null);
  const finished = useRef(false);

  // Crea el borrador al entrar (o retoma el que ya existía para este día).
  useEffect(() => {
    if (draft || !routine || !day || finished.current) return;
    const existing = loadDraft();
    if (existing && existing.routineId === routine.id && existing.dayId === day.id) {
      setDraft(existing);
      return;
    }
    const entries: SessionEntry[] = day.items.map((it) => {
      if (it.kind === 'cardio') return { kind: 'cardio', itemId: it.id, cardioId: it.cardioId, minutes: it.minutes, distanceKm: it.distanceKm, done: false };
      const prev = lastSets(data.sessions, it.exerciseId);
      const sets: LoggedSet[] = Array.from({ length: it.sets }, (_, i) => {
        const p = prev ? (prev[i] ?? prev[prev.length - 1]) : undefined;
        return { weight: p?.weight ?? 0, reps: it.reps, done: false };
      });
      return { kind: 'strength', itemId: it.id, exerciseId: it.exerciseId, sets };
    });
    setDraft({ routineId: routine.id, dayId: day.id, startedAt: Date.now(), entries });
  }, [draft, routine, day, data.sessions]);

  useEffect(() => {
    if (draft && !finished.current) saveDraft(draft);
  }, [draft]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  // Aviso al terminar el descanso.
  const restAlerted = useRef(false);
  useEffect(() => {
    if (restEnd === null) {
      restAlerted.current = false;
      return;
    }
    if (now >= restEnd && !restAlerted.current) {
      restAlerted.current = true;
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [now, restEnd]);

  const totals = useMemo(() => {
    let done = 0;
    let all = 0;
    for (const e of draft?.entries ?? []) {
      if (e.kind === 'strength') {
        all += e.sets.length;
        done += e.sets.filter((s) => s.done).length;
      } else {
        all += 1;
        done += e.done ? 1 : 0;
      }
    }
    return { done, all };
  }, [draft]);

  if (!routine || !day) {
    return (
      <>
        <PageHeader title="Entrenamiento" back="/entrenar" />
        <Empty title="No se encontró el día de entrenamiento" text="Puede que se haya eliminado de la rutina." />
      </>
    );
  }
  if (!draft) return <div className="splash">Preparando…</div>;

  const patchEntry = (itemId: string, fn: (e: SessionEntry) => SessionEntry) =>
    setDraft((d) => (d ? { ...d, entries: d.entries.map((e) => (e.itemId === itemId ? fn(e) : e)) } : d));
  const patchSet = (itemId: string, idx: number, patch: Partial<LoggedSet>) =>
    patchEntry(itemId, (e) => (e.kind === 'strength' ? { ...e, sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)) } : e));

  const toggleSet = (itemId: string, idx: number) => {
    const entry = draft.entries.find((e) => e.itemId === itemId);
    if (!entry || entry.kind !== 'strength') return;
    const becomingDone = !entry.sets[idx].done;
    patchSet(itemId, idx, { done: becomingDone });
    if (becomingDone && totals.done + 1 < totals.all) {
      restAlerted.current = false;
      setRestEnd(Date.now() + restSec * 1000);
    } else if (!becomingDone) setRestEnd(null);
  };

  const elapsed = Math.floor((now - draft.startedAt) / 1000);
  const remaining = restEnd ? Math.ceil((restEnd - now) / 1000) : 0;

  const finish = async () => {
    if (totals.done === 0) {
      if (await ui.confirm({ title: 'No has completado ninguna serie', message: '¿Descartar este entrenamiento?', confirmLabel: 'Descartar', danger: true })) {
        finished.current = true;
        clearDraft();
        nav('/entrenar', { replace: true });
      }
      return;
    }
    if (totals.done < totals.all) {
      const ok = await ui.confirm({ title: 'Quedan series sin completar', message: 'Solo se guardarán las series que has marcado como hechas.', confirmLabel: 'Terminar y guardar', cancelLabel: 'Seguir entrenando' });
      if (!ok) return;
    }
    const entries: SessionEntry[] = [];
    for (const e of draft.entries) {
      if (e.kind === 'strength') {
        const sets = e.sets.filter((s) => s.done);
        if (sets.length) entries.push({ ...e, sets });
      } else if (e.done) entries.push(e);
    }
    const endedAt = Date.now();
    const session: SessionT = {
      id: uid(),
      routineId: routine.id,
      routineName: routine.name,
      dayId: day.id,
      dayName: day.name,
      startedAt: draft.startedAt,
      endedAt,
      entries,
      updatedAt: endedAt,
    };
    const records = findRecords(data.sessions, session).map((r) => ({ name: byId.get(r.exerciseId)?.n ?? r.exerciseId, weight: r.weight }));
    try {
      await saveSession(session);
    } catch {
      ui.toast('No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }
    finished.current = true;
    clearDraft();
    setRestEnd(null);
    setSummary({ seconds: Math.round((endedAt - draft.startedAt) / 1000), sets: sessionSetCount(session), volume: sessionVolume(session), records });
  };

  const exit = () => nav('/entrenar');

  return (
    <>
      <PageHeader
        title={day.name}
        sub={`${routine.name}, ${formatClock(elapsed)}`}
        right={
          <div className="row">
            <button className="icon-btn" aria-label="Salir sin terminar" onClick={exit}>
              <X size={20} />
            </button>
            <button className="btn primary sm" onClick={finish}>
              Terminar
            </button>
          </div>
        }
      />
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={totals.all} aria-valuenow={totals.done} aria-label="Series completadas">
        <div style={{ width: `${totals.all ? (totals.done / totals.all) * 100 : 0}%` }} />
      </div>
      <p className="muted small">
        {totals.done} de {totals.all} series completadas
      </p>

      <div className="stack">
        {draft.entries.map((e) => {
          if (e.kind === 'cardio') {
            const cd = cardioById(e.cardioId);
            return (
              <section className={`card exo${e.done ? ' finished' : ''}`} key={e.itemId}>
                <div className="exo-head">
                  <Thumb exerciseId={cd?.refId} size={56} />
                  <div className="grow">
                    <Link to={`/ejercicio/cardio_${e.cardioId}`} className="exo-name">{cd?.name ?? 'Cardio'}</Link>
                    <small className="muted">Cardio</small>
                  </div>
                  {cd?.refId && (
                    <button className="btn sm" onClick={() => setTech({ exId: cd.refId as string, videoKey: `cardio_${cd.id}`, title: cd.name })}>
                      <Play size={14} /> Técnica
                    </button>
                  )}
                </div>
                <div className="set-row">
                  <Plate n={1} done={e.done} label={e.done ? 'Marcar como no hecho' : 'Marcar como hecho'} onClick={() => patchEntry(e.itemId, (x) => (x.kind === 'cardio' ? { ...x, done: !x.done } : x))} />
                  <label className="cell">
                    <NumInput label="Minutos" value={e.minutes} onChange={(n) => patchEntry(e.itemId, (x) => (x.kind === 'cardio' ? { ...x, minutes: n } : x))} />
                    <span>min</span>
                  </label>
                  {cd?.distance && (
                    <label className="cell">
                      <NumInput label="Kilómetros" value={e.distanceKm ?? 0} onChange={(n) => patchEntry(e.itemId, (x) => (x.kind === 'cardio' ? { ...x, distanceKm: n || undefined } : x))} />
                      <span>km</span>
                    </label>
                  )}
                </div>
              </section>
            );
          }
          const ex = byId.get(e.exerciseId);
          const prev = lastSets(data.sessions, e.exerciseId);
          const top = prev ? prev.reduce((a, b) => (b.weight > a.weight ? b : a)) : null;
          return (
            <section className={`card exo${e.sets.every((s) => s.done) ? ' finished' : ''}`} key={e.itemId}>
              <div className="exo-head">
                <Thumb exerciseId={e.exerciseId} size={56} />
                <div className="grow">
                  <Link to={`/ejercicio/${encodeURIComponent(e.exerciseId)}`} className="exo-name">{ex?.n ?? '…'}</Link>
                  <small className="muted">{top ? `Última vez: ${fmtNum(kgToUnit(top.weight, units))} ${units} × ${top.reps}` : 'Primera vez'}</small>
                </div>
                <button className="btn sm" onClick={() => setTech({ exId: e.exerciseId, videoKey: e.exerciseId, title: ex?.n ?? 'Ejercicio' })}>
                  <Play size={14} /> Técnica
                </button>
              </div>
              <div className="set-head" aria-hidden="true">
                <span />
                <span>{units}</span>
                <span>reps</span>
                <span />
              </div>
              {e.sets.map((s, i) => (
                <div className="set-row" key={i}>
                  <Plate n={i + 1} done={s.done} label={`Serie ${i + 1}, ${s.done ? 'hecha' : 'pendiente'}`} onClick={() => toggleSet(e.itemId, i)} />
                  <div className="cell">
                    <NumInput label={`Peso de la serie ${i + 1}`} value={kgToUnit(s.weight, units)} onChange={(n) => patchSet(e.itemId, i, { weight: unitToKg(n, units) })} />
                  </div>
                  <div className="cell">
                    <NumInput label={`Repeticiones de la serie ${i + 1}`} value={s.reps} step="1" onChange={(n) => patchSet(e.itemId, i, { reps: Math.round(n) })} />
                  </div>
                  <button
                    className="icon-btn sm"
                    aria-label={`Quitar serie ${i + 1}`}
                    disabled={e.sets.length <= 1}
                    onClick={() => patchEntry(e.itemId, (x) => (x.kind === 'strength' ? { ...x, sets: x.sets.filter((_, k) => k !== i) } : x))}
                  >
                    <Minus size={16} />
                  </button>
                </div>
              ))}
              <button
                className="btn block sm"
                onClick={() =>
                  patchEntry(e.itemId, (x) => {
                    if (x.kind !== 'strength') return x;
                    const last = x.sets[x.sets.length - 1];
                    return { ...x, sets: [...x.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 10, done: false }] };
                  })
                }
              >
                <Plus size={16} /> Añadir serie
              </button>
            </section>
          );
        })}
      </div>
      <div className="spacer tall" />

      {restEnd !== null && !summary && (
        <div className={`rest${remaining <= 0 ? ' over' : ''}`} role="timer" aria-live="off">
          <div className="rest-time">{remaining > 0 ? formatClock(remaining) : 'Descanso terminado'}</div>
          <div className="rest-actions">
            <button className="btn sm" onClick={() => setRestEnd((t) => (t ? t + 15000 : t))}>+15 s</button>
            <button className="btn sm" onClick={() => setRestEnd(null)}>{remaining > 0 ? 'Saltar' : 'Cerrar'}</button>
          </div>
        </div>
      )}

      <Sheet open={!!tech} onClose={() => setTech(null)} title={tech?.title ?? 'Técnica'}>
        {tech && (
          <div className="stack">
            {byId.get(tech.exId) && <Preview ex={byId.get(tech.exId)!} name={tech.title} />}
            {byId.get(tech.exId) && <Steps ex={byId.get(tech.exId)!} />}
            <VideoCard videoKey={tech.videoKey} title={tech.title} />
            <button className="btn primary block" onClick={() => setTech(null)}>
              Volver al entrenamiento
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!summary} onClose={() => nav('/progreso', { replace: true })} title="Entrenamiento guardado">
        {summary && (
          <div className="stack">
            <div className="stats3">
              <div><b>{formatMinutes(summary.seconds)}</b><span>duración</span></div>
              <div><b>{summary.sets}</b><span>series</span></div>
              <div><b>{fmtNum(kgToUnit(summary.volume, units))}</b><span>{units} movidos</span></div>
            </div>
            {summary.records.length > 0 && (
              <div className="records">
                <h3>Nuevos récords de peso</h3>
                <ul>
                  {summary.records.map((r) => (
                    <li key={r.name}>
                      <span>{r.name}</span>
                      <b>{fmtNum(kgToUnit(r.weight, units))} {units}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button className="btn primary block" onClick={() => nav('/progreso', { replace: true })}>Ver mi progreso</button>
          </div>
        )}
      </Sheet>
    </>
  );
}
