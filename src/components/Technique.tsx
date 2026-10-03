import { useEffect, useState } from 'react';
import { ExternalLink, Languages, Pause, Play, Trash2 } from 'lucide-react';
import { useData } from '../state/data';
import { useUi } from '../state/ui';
import { imageUrl, parseYouTubeId, translateUrl, youtubeSearchUrl } from '../lib/catalog';
import type { Ex } from '../lib/catalog';
import { MuscleFigure, figureLabel, thumbSpec } from './MuscleFigure';

/** Vista previa del ejercicio: fotos del movimiento en bucle y, en la esquina, el músculo trabajado en rojo. */
export function Preview({ ex, name }: { ex: Ex; name: string }) {
  const count = ex.m;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!playing || count < 2) return;
    const t = window.setInterval(() => setFrame((f) => (f + 1) % count), 1200);
    return () => window.clearInterval(t);
  }, [playing, count]);

  const { view } = thumbSpec(ex.p);
  const showPhoto = count > 0 && !failed;
  return (
    <div className="preview">
      {showPhoto ? (
        <img src={imageUrl(ex.i, frame)} alt={`${name}, posición ${frame + 1} de ${count}`} onError={() => setFailed(true)} />
      ) : (
        <div className="preview-empty">Sin foto disponible</div>
      )}
      <div className="preview-fig">
        <MuscleFigure primary={ex.p} secondary={ex.s} view={view} label={figureLabel(ex.p, ex.s)} />
      </div>
      {showPhoto && count > 1 && (
        <div className="frames-bar">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              className={`frame-dot${i === frame ? ' on' : ''}`}
              aria-label={`Ver posición ${i + 1}`}
              onClick={() => {
                setPlaying(false);
                setFrame(i);
              }}
            />
          ))}
          <button className="icon-btn sm" aria-label={playing ? 'Pausar animación' : 'Reproducir animación'} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

/** «Cómo se hace»: pasos del catálogo (en inglés) con enlace para traducirlos. */
export function Steps({ ex }: { ex: Ex }) {
  if (ex.t.length === 0) return null;
  return (
    <section className="card">
      <h2 className="h3">Cómo se hace</h2>
      <ol className="steps" lang="en">
        {ex.t.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="hint">Las instrucciones del catálogo están en inglés.</p>
      <a className="btn block" href={translateUrl(ex.t.join('\n'))} target="_blank" rel="noopener noreferrer">
        <Languages size={16} /> Traducir al español
      </a>
    </section>
  );
}

/** Vídeo propio: se pega un enlace de YouTube y queda guardado para ese ejercicio. */
export function VideoCard({ videoKey, title }: { videoKey: string; title: string }) {
  const { data, updateMeta } = useData();
  const ui = useUi();
  const [input, setInput] = useState('');
  const url = data.meta.videos[videoKey];
  const id = url ? parseYouTubeId(url) : null;

  const save = async () => {
    if (!parseYouTubeId(input)) {
      ui.toast('Pega un enlace de YouTube válido (youtube.com o youtu.be).');
      return;
    }
    await updateMeta((m) => ({ ...m, videos: { ...m.videos, [videoKey]: input.trim() } }));
    setInput('');
  };

  return (
    <section className="card">
      <h2 className="h3">Vídeo explicativo</h2>
      {id ? (
        <>
          <div className="video">
            <iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title={`Vídeo de ${title}`} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
          </div>
          <button
            className="btn block"
            onClick={() =>
              updateMeta((m) => {
                const v = { ...m.videos };
                delete v[videoKey];
                return { ...m, videos: v };
              })
            }
          >
            <Trash2 size={16} /> Quitar este vídeo
          </button>
        </>
      ) : (
        <>
          <p className="muted">El catálogo no incluye vídeos. Busca uno en YouTube y pega el enlace para verlo aquí cada vez que hagas este ejercicio.</p>
          <a className="btn block" href={youtubeSearchUrl(title)} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} /> Buscar vídeos en YouTube
          </a>
          <div className="row">
            <input className="input grow" inputMode="url" placeholder="Pega aquí el enlace del vídeo" aria-label="Enlace del vídeo" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn" onClick={save} disabled={!input.trim()}>
              Guardar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
