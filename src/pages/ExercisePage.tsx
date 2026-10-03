import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, Languages, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { Empty, PageHeader, Stepper } from '../components/ui';
import { MuscleFigure, figureLabel } from '../components/MuscleFigure';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { LEVEL_LABEL, cardioById, equipLabel, imageUrl, muscleLabel, parseYouTubeId, translateUrl, useExercises, youtubeSearchUrl } from '../lib/catalog';
import { exerciseSeries, lastSets } from '../lib/stats';
import { fmtNum, kgToUnit, uid } from '../lib/util';
import type { RoutineItem } from '../types';

function Frames({ id, count, name }: { id: string; count: number; name: string }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!playing || count < 2) return;
    const t = window.setInterval(() => setFrame((f) => (f + 1) % count), 1200);
    return () => window.clearInterval(t);
  }, [playing, count]);
  if (count === 0 || failed) return <div className="frames frames-empty">Sin imagen disponible</div>;
  return (
    <div className="frames">
      <img src={imageUrl(id, frame)} alt={`${name}, posición ${frame + 1} de ${count}`} onError={() => setFailed(true)} />
      {count > 1 && (
        <div className="frames-bar">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} className={`frame-dot${i === frame ? ' on' : ''}`} aria-label={`Ver posición ${i + 1}`} onClick={() => { setPlaying(false); setFrame(i); }} />
          ))}
          <button className="icon-btn sm" aria-label={playing ? 'Pausar animación' : 'Reproducir animación'} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ExercisePage() {
  const { eid = '' } = useParams();
  const [sp] = useSearchParams();
  const rid = sp.get('rid');
  const did = sp.get('did');
  const nav = useNavigate();
  const ui = useUi();
  const { data, saveRoutine, updateMeta } = useData();
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
  const [videoInput, setVideoInput] = useState('');

  const title = isCardio ? cardio?.name : ex?.n;
  const videoUrl = data.meta.videos[eid];
  const videoId = videoUrl ? parseYouTubeId(videoUrl) : null;

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

  const steps = ex?.t ?? [];

  const add = async () => {
    if (!routine || !day) return;
    const item: RoutineItem = isCardio && cardio ? { kind: 'cardio', id: uid(), cardioId: cardio.id, minutes } : { kind: 'strength', id: uid(), exerciseId: eid, sets, reps };
    await saveRoutine({ ...routine, updatedAt: Date.now(), days: routine.days.map((d) => (d.id === day.id ? { ...d, items: [...d.items, item] } : d)) });
    ui.toast(`Añadido a ${day.name}`);
    nav(-1);
  };

  const saveVideo = async () => {
    if (!parseYouTubeId(videoInput)) {
      ui.toast('Pega un enlace de YouTube válido (youtube.com o youtu.be).');
      return;
    }
    await updateMeta((m) => ({ ...m, videos: { ...m.videos, [eid]: videoInput.trim() } }));
    setVideoInput('');
  };

  const best = history?.series.length ? Math.max(...history.series.map((s) => s.maxWeight)) : 0;

  return (
    <>
      <PageHeader title={title} sub={!isCardio && ex ? ex.e : undefined} back />

      {ex && (
        <section className="card figure-card" aria-label="Músculos trabajados">
          <div className="figures">
            <figure>
              <MuscleFigure primary={ex.p} secondary={ex.s} view="front" label={figureLabel(ex.p, ex.s)} />
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

      {ex ? <Frames id={ex.i} count={ex.m} name={title} /> : <div className="frames frames-empty">Sin imagen disponible</div>}

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

      <section className="card">
        <h2 className="h3">Vídeo explicativo</h2>
        {videoId ? (
          <>
            <div className="video">
              <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}`} title={`Vídeo de ${title}`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
            </div>
            <button className="btn block" onClick={() => updateMeta((m) => { const v = { ...m.videos }; delete v[eid]; return { ...m, videos: v }; })}>
              <Trash2 size={16} /> Quitar este vídeo
            </button>
          </>
        ) : (
          <>
            <p className="muted">El catálogo no incluye vídeos. Busca uno en YouTube y pega el enlace para verlo aquí en cada ejercicio.</p>
            <a className="btn block" href={youtubeSearchUrl(title)} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} /> Buscar vídeos en YouTube
            </a>
            <div className="row">
              <input className="input grow" inputMode="url" placeholder="Pega aquí el enlace del vídeo" aria-label="Enlace del vídeo" value={videoInput} onChange={(e) => setVideoInput(e.target.value)} />
              <button className="btn" onClick={saveVideo} disabled={!videoInput.trim()}>
                Guardar
              </button>
            </div>
          </>
        )}
      </section>

      {steps.length > 0 && (
        <section className="card">
          <h2 className="h3">Cómo se hace</h2>
          <ol className="steps" lang="en">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="hint">Las instrucciones del catálogo están en inglés.</p>
          <a className="btn block" href={translateUrl(steps.join('\n'))} target="_blank" rel="noopener noreferrer">
            <Languages size={16} /> Traducir al español
          </a>
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
