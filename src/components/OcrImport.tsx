import { useRef, useState } from 'react';
import { ClipboardPaste, ImagePlus, X } from 'lucide-react';
import type { ExerciseLog } from '../types';
import { useUi } from '../state/ui';
import { parseScreenshots } from '../lib/ocrParse';
import { resolveNbName } from '../lib/nivelbestia';
import type { OcrExercise } from '../lib/ocrParse';
import type { OcrProgress } from '../lib/ocr';
import { NumField } from './ui';

interface Row {
  include: boolean;
  name: string;
  matched: boolean;
  raw: string;
  kg: number | null;
  reps: number | null;
  sets: number;
  /** Series leídas, para comprobarlas de un vistazo: «4×11 · 4×12 · 4×10». */
  detail: string;
}

const toRows = (xs: OcrExercise[]): Row[] =>
  xs.map((e) => ({
    include: e.avg != null,
    name: e.name,
    matched: e.matched,
    raw: e.raw,
    kg: e.avg?.kg ?? null,
    reps: e.avg?.reps ?? null,
    sets: e.sets.length,
    detail: e.sets.map((x) => `${x.kg == null ? '—' : String(x.kg).replace('.', ',')}×${x.reps}`).join(' · '),
  }));

/**
 * Lee capturas de pantalla de Nivel Bestia (o texto pegado) y propone las cargas de cada ejercicio.
 * Nada se rellena sin pasar por la revisión.
 */
export function OcrImport({ known, onApply }: { known: string[]; onApply: (rows: ExerciseLog[]) => void }) {
  const ui = useUi();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'reading' | 'review' | 'paste'>('idle');
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rawText, setRawText] = useState('');
  const [paste, setPaste] = useState('');

  const review = (texts: string[]) => {
    setRawText(texts.join('\n\n'));
    // Solo ejercicios con series leídas: los nombres sueltos (menús, listas de la rutina…) se descartan.
    const found = parseScreenshots(texts, known, (n) => resolveNbName(n, known)).filter((e) => e.sets.length > 0);
    setRows(toRows(found));
    setStage('review');
  };

  const read = async (files: File[]) => {
    setStage('reading');
    setProgress({ file: 1, files: files.length, progress: 0, status: 'loading' });
    try {
      const { readScreenshots } = await import('../lib/ocr');
      const texts = await readScreenshots(files, setProgress);
      review(texts);
    } catch {
      setStage('idle');
      ui.toast('No se pudieron leer las capturas. Revisa la conexión la primera vez (descarga el lector) e inténtalo otra vez.');
    }
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const apply = () => {
    const chosen = rows.filter((r) => r.include && r.name.trim() && (r.kg != null || r.reps != null));
    if (!chosen.length) {
      ui.toast('No hay ninguna carga marcada para rellenar.');
      return;
    }
    onApply(chosen.map((r) => ({ name: r.name.trim(), kg: r.kg, reps: r.reps })));
    setStage('idle');
    ui.toast(`${chosen.length} ${chosen.length === 1 ? 'ejercicio rellenado' : 'ejercicios rellenados'}. Revísalos antes de guardar.`);
  };

  const pct = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <>
      <button type="button" className="choice primary" onClick={() => input.current?.click()}>
        <ImagePlus size={22} />
        <span>Leer capturas de pantalla</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) void read(files);
        }}
      />

      {stage !== 'idle' && (
        <div className="overlay sheet-overlay" role="dialog" aria-modal="true" aria-label="Cargas leídas de las capturas">
          <div className="sheet">
            <div className="sheet-head">
              <h2 className="h3">{stage === 'reading' ? 'Leyendo capturas…' : stage === 'paste' ? 'Pegar texto' : 'Revisa lo que he leído'}</h2>
              {stage !== 'reading' && (
                <button className="icon-btn sm" aria-label="Cerrar" onClick={() => setStage('idle')}>
                  <X size={18} />
                </button>
              )}
            </div>

            {stage === 'reading' && progress && (
              <div className="ocr-progress">
                <p>
                  Captura {progress.file} de {progress.files}
                  {progress.status.includes('recogniz') ? ` · ${pct} %` : ' · preparando el lector'}
                </p>
                <div className="progress-bar">
                  <span style={{ width: `${progress.status.includes('recogniz') ? pct : 5}%` }} />
                </div>
                <p className="hint">La primera vez descarga el lector (unos 6 MB). Después funciona más rápido.</p>
              </div>
            )}

            {stage === 'paste' && (
              <>
                <p className="hint">En Fotos, abre la captura, mantén pulsado sobre el texto → Seleccionar todo → Copiar, y pégalo aquí.</p>
                <textarea rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Texto copiado de la captura" />
                <button className="btn primary block" disabled={!paste.trim()} onClick={() => review([paste])}>
                  Leer cargas
                </button>
              </>
            )}

            {stage === 'review' && (
              <>
                {rows.length === 0 ? (
                  <p className="card-sub">
                    No he encontrado ejercicios conocidos con sus series. Comprueba que en la captura se ven el nombre del ejercicio y los kg y repeticiones, o que los ejercicios están en tus días de rutina.
                  </p>
                ) : (
                  <p className="card-sub">Carga media de cada ejercicio (media de sus series). Corrige lo que esté mal y desmarca lo que no quieras usar.</p>
                )}
                <ul className="ocr-rows">
                  {rows.map((r, i) => (
                    <li key={i} className={r.include ? '' : 'off'}>
                      <label className="ocr-check">
                        <input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} />
                        <input className="ocr-name" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label="Ejercicio" />
                      </label>
                      <div className="ocr-fields">
                        <NumField small label="kg" value={r.kg} onChange={(v) => setRow(i, { kg: v })} />
                        <NumField small label="reps" value={r.reps} onChange={(v) => setRow(i, { reps: v })} />
                        <span className="ocr-meta">
                          media de {r.sets} {r.sets === 1 ? 'serie' : 'series'}
                        </span>
                      </div>
                      <p className="ocr-detail">
                        {r.detail}
                        {r.raw && r.raw.split(' (')[0] !== r.name ? ` · en Nivel Bestia: ${r.raw}` : r.raw.includes('(kg') ? ` · ${r.raw.slice(r.raw.indexOf('(') + 1, -1)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
                <button type="button" className="link-btn" onClick={() => setStage('paste')}>
                  <ClipboardPaste size={16} /> ¿Se ha leído mal? Pega el texto copiado de la captura
                </button>
                {rawText && (
                  <details className="more">
                    <summary>Ver el texto leído</summary>
                    <pre className="ocr-raw">{rawText.trim()}</pre>
                  </details>
                )}
                <button className="btn primary block" onClick={apply} disabled={!rows.some((r) => r.include)}>
                  Rellenar las cargas
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
