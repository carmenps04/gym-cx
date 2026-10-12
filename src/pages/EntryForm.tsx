import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, X } from 'lucide-react';
import type { DayDef, Entry, ExerciseLog, Treadmill, TreadmillRating } from '../types';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { lastLog, loadSessions, localDate, normName, pending24h, suggestDay } from '../lib/report';
import { guessDay } from '../lib/nivelbestia';
import { NbImportButton } from '../components/NbImport';
import type { NbResult } from '../components/NbImport';
import { fmtDate, fmtLoad, fmtTime, fromLocalInput, toLocalInput, uid } from '../lib/util';
import { Card, Empty, NumField, PageHeader, PainScale, Scale5, Segmented } from '../components/ui';

const NO_TREADMILL: Treadmill = { done: false, min: null, speed: null, incline: null, rating: null };

function rowsFor(day: DayDef | undefined, keep: ExerciseLog[] = []): ExerciseLog[] {
  if (!day) return keep;
  const names = new Set(day.exercises.map(normName));
  // Lo ya escrito en ejercicios que no son del día se conserva al cambiar de día.
  const extra = keep.filter((x) => !names.has(normName(x.name)) && (x.kg != null || x.reps != null));
  return [
    ...day.exercises.map((name) => keep.find((x) => normName(x.name) === normName(name)) ?? { name, kg: null, reps: null }),
    ...extra,
  ];
}

export default function EntryForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const ui = useUi();
  const { data, saveEntry, deleteEntry, saveConfig } = useData();
  const existing = id ? data.entries.find((e) => e.id === id) : undefined;
  const days = data.config.days;

  const [draft, setDraft] = useState<Entry>(() => {
    if (existing) return { ...existing, exercises: existing.exercises.map((x) => ({ ...x })) };
    const day = suggestDay(data.config, data.entries) ?? undefined;
    return {
      id: uid(),
      at: Date.now(),
      dayId: day?.id ?? '',
      dayName: day?.name ?? '',
      isLeg: day?.isLeg ?? false,
      kneeDuring: null,
      knee24h: null,
      exercises: rowsFor(day),
      treadmill: { ...NO_TREADMILL },
      energy: null,
      sleepHours: null,
      sleepQuality: null,
      recovery: null,
      dayFeel: null,
      note: '',
      updatedAt: 0,
    };
  });
  const [editingDate, setEditingDate] = useState(false);
  const [newEx, setNewEx] = useState('');
  const [saving, setSaving] = useState(false);
  // Dolor a las 24 h de sesiones anteriores que toca contestar ahora (solo al registrar una sesión nueva).
  const [dueIds] = useState<string[]>(() => (id ? [] : pending24h(data.entries, Date.now()).due.map((e) => e.id)));
  const [dueValues, setDueValues] = useState<Record<string, number | null>>({});
  const dueEntries = dueIds.map((x) => data.entries.find((e) => e.id === x)).filter((e): e is Entry => Boolean(e));

  const set = <K extends keyof Entry>(k: K, v: Entry[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setEx = (i: number, patch: Partial<ExerciseLog>) => setDraft((d) => ({ ...d, exercises: d.exercises.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const setTm = (patch: Partial<Treadmill>) => setDraft((d) => ({ ...d, treadmill: { ...d.treadmill, ...patch } }));

  const dateKey = localDate(draft.at);
  const imported = data.loads.find((l) => l.date === dateKey);
  const sessions = useMemo(() => loadSessions(data.entries.filter((e) => e.id !== draft.id), data.loads), [data.entries, data.loads, draft.id]);
  const previous = useMemo(() => {
    const m = new Map<string, ReturnType<typeof lastLog>>();
    const names = imported ? imported.exercises.map((x) => x.name) : draft.exercises.map((x) => x.name);
    names.forEach((n) => m.set(normName(n), lastLog(sessions, n, dateKey)));
    return m;
  }, [draft.exercises, imported, sessions, dateKey]);

  if (!existing && id) {
    return (
      <div className="page">
        <PageHeader title="Sesión" back="/inicio" />
        <Empty title="No encuentro esta sesión" text="Puede que se haya borrado desde otro dispositivo." action={<Link className="btn" to="/inicio">Volver al inicio</Link>} />
      </div>
    );
  }
  if (days.length === 0 && !existing) {
    return (
      <div className="page">
        <PageHeader title="Nueva sesión" back="/inicio" />
        <Empty
          title="Antes, tus días de rutina"
          text="Importa la copia de Nivel Bestia (Ajustes → Guardar copia) y se rellenan solos. Solo se hace una vez."
          action={
            <div className="empty-actions">
              <NbImportButton />
              <Link className="btn block ghost" to="/ajustes/dias">
                Apuntarlos a mano
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const chooseDay = (d: DayDef) => setDraft((x) => ({ ...x, dayId: d.id, dayName: d.name, isLeg: d.isLeg, exercises: rowsFor(d, x.exercises) }));

  // Tras importar: si hay entrenamiento ese día, se elige el día de la rutina que más se parece.
  const afterImport = (r: NbResult) => {
    const today = r.loads.find((l) => l.date === dateKey);
    if (!today) {
      ui.toast(`La copia no tiene nada registrado el ${fmtDate(draft.at)}. ¿Terminaste la rutina en Nivel Bestia antes de guardar la copia?`);
      return;
    }
    const d = guessDay(r.finalDays, today.exercises.map((x) => x.name));
    if (d) chooseDay(d);
  };

  const addExercise = () => {
    const name = newEx.trim();
    if (!name) return;
    if (draft.exercises.some((x) => normName(x.name) === normName(name))) {
      ui.toast('Ese ejercicio ya está en la lista.');
      return;
    }
    setDraft((d) => ({ ...d, exercises: [...d.exercises, { name, kg: null, reps: null }] }));
    setNewEx('');
  };

  /** Guarda los dolores a 24 h contestados aquí. Devuelve cuántos se guardaron. */
  const saveDue = async () => {
    let n = 0;
    for (const e of dueEntries) {
      const v = dueValues[e.id];
      if (v != null) {
        await saveEntry({ ...e, knee24h: v });
        n++;
      }
    }
    return n;
  };

  const saveOnlyDue = async () => {
    const n = await saveDue();
    if (!n) {
      ui.toast('Elige un valor de 0 a 10.');
      return;
    }
    ui.toast('Guardado.');
    nav('/informe', { replace: true });
  };

  const save = async () => {
    if (!draft.dayId) {
      ui.toast('Elige qué día de la rutina has hecho.');
      return;
    }
    if (draft.kneeDuring == null) {
      ui.toast('Falta el dolor de rodilla durante la sesión (0 si no hubo).');
      return;
    }
    setSaving(true);
    try {
      const entry: Entry = {
        ...draft,
        // Si ese día hay cargas importadas, mandan esas: no se guardan también a mano.
        exercises: imported ? [] : draft.exercises.map((x) => ({ ...x, name: x.name.trim() })).filter((x) => x.name && (x.kg != null || x.reps != null)),
        treadmill: draft.treadmill.done ? draft.treadmill : { ...NO_TREADMILL },
      };
      await saveDue();
      await saveEntry(entry);
      // Los ejercicios añadidos a mano pasan a formar parte del día para la próxima vez.
      const day = days.find((d) => d.id === draft.dayId);
      if (day && !imported) {
        const known = new Set(day.exercises.map(normName));
        const added = entry.exercises.map((x) => x.name).filter((n) => !known.has(normName(n)));
        if (added.length) await saveConfig({ ...data.config, days: days.map((d) => (d.id === day.id ? { ...d, exercises: [...d.exercises, ...added] } : d)) });
      }
      if (existing) {
        ui.toast('Cambios guardados.');
        nav('/inicio');
      } else nav('/informe', { replace: true, state: { saved: entry.id } });
    } catch {
      ui.toast('No se pudo guardar. Revisa la conexión e inténtalo otra vez.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await ui.confirm({ title: '¿Borrar esta sesión?', message: 'Desaparecerá también del informe.', confirmLabel: 'Borrar', danger: true });
    if (!ok) return;
    await deleteEntry(draft.id);
    nav('/inicio', { replace: true });
  };

  const tm = draft.treadmill;

  return (
    <div className="page form-page">
      <PageHeader
        title={existing ? 'Editar sesión' : 'Sesión terminada'}
        sub={existing ? `${fmtDate(draft.at)} · ${draft.dayName}` : 'Contesta lo que puedas; lo obligatorio es el día y la rodilla.'}
        back="/inicio"
        right={
          existing ? (
            <button className="icon-btn" aria-label="Borrar sesión" onClick={remove}>
              <Trash2 size={20} />
            </button>
          ) : undefined
        }
      />

      {dueEntries.map((e) => (
        <Card key={e.id} title="Pendiente: rodilla a las 24 h" sub={`De la sesión de ${e.dayName} (${fmtDate(e.at)} a las ${fmtTime(e.at)}).`} className="due-card">
          <PainScale label="¿Cuánto te duele ahora?" value={dueValues[e.id] ?? null} onChange={(v) => setDueValues((m) => ({ ...m, [e.id]: v }))} />
          <button type="button" className="link-btn" onClick={saveOnlyDue}>
            Hoy no he entrenado: guardar solo esto
          </button>
        </Card>
      ))}

      <Card title="¿Qué día has hecho?">
        <div className="chips">
          {days.map((d) => (
            <button key={d.id} type="button" className={`chip${draft.dayId === d.id ? ' on' : ''}`} onClick={() => chooseDay(d)}>
              {d.name}
              {d.isLeg && <span className="chip-tag">pierna</span>}
            </button>
          ))}
          {existing && !days.some((d) => d.id === draft.dayId) && <span className="chip on">{draft.dayName}</span>}
        </div>
        {editingDate ? (
          <label className="date-edit">
            <span className="field-label">Fecha y hora en que terminaste</span>
            <input type="datetime-local" value={toLocalInput(draft.at)} onChange={(e) => {
              const t = fromLocalInput(e.target.value);
              if (t) set('at', t);
            }} />
          </label>
        ) : (
          <button type="button" className="link-btn" onClick={() => setEditingDate(true)}>
            {fmtDate(draft.at)}, {fmtTime(draft.at)} · cambiar
          </button>
        )}
      </Card>

      <Card title="Rodilla">
        <PainScale label="Dolor durante la sesión" value={draft.kneeDuring} onChange={(v) => set('kneeDuring', v)} />
        {existing ? (
          <PainScale label="Dolor a las 24 h" value={draft.knee24h} onChange={(v) => set('knee24h', v)} />
        ) : (
          <p className="hint">El dolor a las 24 h te lo pregunto mañana.</p>
        )}
      </Card>

      <Card title="Cargas">
        {imported ? (
          <>
            <p className="card-sub">
              Importadas de Nivel Bestia. Mejor serie de cada ejercicio el {fmtDate(draft.at)}.
            </p>
            <ul className="imported">
              {imported.exercises.map((x) => {
                const prev = previous.get(normName(x.name));
                return (
                  <li key={x.id}>
                    <span className="ex-name">{x.name}</span>
                    <span className="imp-load">
                      <b>{fmtLoad(x.kg, x.reps)}</b>
                      <small>
                        {x.sets} {x.sets === 1 ? 'serie' : 'series'}
                        {prev && ` · antes ${fmtLoad(prev.kg, prev.reps)}`}
                      </small>
                    </span>
                  </li>
                );
              })}
            </ul>
            <NbImportButton className="link-btn" label="Volver a importar" onDone={afterImport} />
          </>
        ) : (
          <>
            <p className="card-sub">Lo más rápido es traerlas de Nivel Bestia.</p>
            <ol className="steps small">
              <li>
                En Nivel Bestia: <b>Ajustes → Guardar copia</b>.
              </li>
              <li>
                Aquí: <b>Importar</b> y elige el archivo <i>nivel-bestia-…json</i> (está en Descargas).
              </li>
            </ol>
            <NbImportButton onDone={afterImport} />
            <details className="manual">
              <summary>O escríbelas a mano</summary>
              <p className="hint">La mejor serie de cada ejercicio. Deja en blanco los que no hayas hecho; sin kg = peso corporal.</p>
              <div className="ex-list">
                {draft.exercises.map((x, i) => {
                  const prev = previous.get(normName(x.name));
                  return (
                    <div className="ex-row" key={x.name + i}>
                      <div className="ex-head">
                        <span className="ex-name">{x.name}</span>
                        <button type="button" className="icon-btn sm" aria-label={`Quitar ${x.name} de esta sesión`} onClick={() => setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, j) => j !== i) }))}>
                          <X size={16} />
                        </button>
                      </div>
                      <div className="ex-fields">
                        <NumField small label="kg" value={x.kg} onChange={(v) => setEx(i, { kg: v })} />
                        <NumField small label="reps" value={x.reps} onChange={(v) => setEx(i, { reps: v == null ? null : Math.round(v) })} />
                        {prev && (
                          <button type="button" className="prev" onClick={() => setEx(i, { kg: prev.kg, reps: prev.reps })} title="Copiar la carga anterior">
                            <span>Anterior</span>
                            <b>{fmtLoad(prev.kg, prev.reps)}</b>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="add-row">
                <input value={newEx} placeholder="Añadir otro ejercicio" onChange={(e) => setNewEx(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addExercise()} />
                <button type="button" className="btn" onClick={addExercise} aria-label="Añadir ejercicio">
                  <Plus size={18} />
                </button>
              </div>
              {draft.dayId && <p className="hint">Lo que añadas aquí se guarda en la lista de este día para las próximas veces.</p>}
            </details>
          </>
        )}
      </Card>

      <Card title="Cinta">
        <Segmented
          label="¿Hiciste cinta?"
          options={[
            { id: 'si', label: 'Hice cinta' },
            { id: 'no', label: 'Sin cinta' },
          ]}
          value={tm.done ? 'si' : 'no'}
          onChange={(v) => setTm({ done: v === 'si' })}
        />
        {tm.done && (
          <>
            <div className="tm-fields">
              <NumField label="Minutos" value={tm.min} onChange={(v) => setTm({ min: v })} />
              <NumField label="Velocidad" suffix="km/h" value={tm.speed} onChange={(v) => setTm({ speed: v })} />
              <NumField label="Inclinación" suffix="%" value={tm.incline} onChange={(v) => setTm({ incline: v })} />
            </div>
            <span className="field-label">¿Cómo de exigente fue?</span>
            <Segmented<TreadmillRating>
              label="Exigencia de la cinta"
              options={[
                { id: 'poco', label: 'Poco' },
                { id: 'bien', label: 'Bien' },
                { id: 'mucho', label: 'Demasiado' },
              ]}
              value={tm.rating}
              onChange={(v) => setTm({ rating: v })}
            />
          </>
        )}
      </Card>

      <Card title="Energía, sueño y recuperación">
        <Scale5 label="Energía hoy" low="Muy baja" high="Muy alta" value={draft.energy} onChange={(v) => set('energy', v)} />
        <div className="inline-num">
          <NumField label="Horas dormidas anoche" suffix="h" value={draft.sleepHours} onChange={(v) => set('sleepHours', v)} />
        </div>
        <Scale5 label="Calidad del sueño" low="Muy mala" high="Muy buena" value={draft.sleepQuality} onChange={(v) => set('sleepQuality', v)} />
        <Scale5 label="Recuperación desde la última sesión" low="Nada recuperada" high="Totalmente" value={draft.recovery} onChange={(v) => set('recovery', v)} />
      </Card>

      <Card title={`Sensaciones${draft.dayName ? ` con ${draft.dayName}` : ''}`}>
        <Scale5 label="¿Qué tal el día?" low="No me gustó" high="Me encantó" value={draft.dayFeel} onChange={(v) => set('dayFeel', v)} />
        <label className="field">
          <span className="field-label">Comentario (opcional)</span>
          <textarea rows={3} value={draft.note} placeholder="Qué te gustó, qué no, molestias…" onChange={(e) => set('note', e.target.value)} />
        </label>
      </Card>

      <div className="save-bar">
        <button className="btn primary block" onClick={save} disabled={saving}>
          {saving ? 'Guardando…' : existing ? 'Guardar cambios' : 'Guardar sesión'}
        </button>
      </div>
    </div>
  );
}
