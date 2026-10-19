import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, Share, X } from 'lucide-react';
import { buildReportPdf, canShareFile } from '../lib/pdf';
import { useUi } from '../state/ui';

/**
 * Genera un PDF a partir de un elemento de la página y muestra la ventana «PDF listo» con
 * «Guardar» (hoja Compartir de iOS) y «Ver» (vista previa dentro de la app).
 * «Guardar» tiene que ser un toque nuevo: iOS no deja abrir la hoja al final de una tarea larga.
 */
export function usePdfExport(): { busy: boolean; run: (el: HTMLElement | null, fileName: string) => Promise<void>; dialog: ReactNode } {
  const ui = useUi();
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<{ file: File; url: string; pages: string[] } | null>(null);
  const [view, setView] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url);
    },
    [pdf],
  );

  const run = async (el: HTMLElement | null, fileName: string) => {
    if (!el || busy) return;
    setBusy(true);
    try {
      const { blob, pages } = await buildReportPdf(el);
      setView(false);
      setZoom(false);
      setPdf({ file: new File([blob], fileName, { type: 'application/pdf' }), url: URL.createObjectURL(blob), pages });
    } catch {
      ui.toast('No se pudo generar el PDF. Inténtalo otra vez.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setPdf(null);
    setView(false);
    setZoom(false);
  };

  const share = (file: File) => {
    navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') }).catch((e: unknown) => {
      if ((e as { name?: string })?.name !== 'AbortError') ui.toast('No se pudo abrir Guardar. Inténtalo otra vez.');
    });
  };

  // Donde no existe la hoja Compartir (algunos navegadores de ordenador) se descarga el archivo.
  const saveButton = (cls: string, autoFocus = false) =>
    pdf &&
    (canShareFile(pdf.file) ? (
      <button className={cls} onClick={() => share(pdf.file)} autoFocus={autoFocus}>
        <Share size={17} /> Guardar
      </button>
    ) : (
      <a className={cls} href={pdf.url} download={pdf.file.name}>
        <Share size={17} /> Guardar
      </a>
    ));

  const dialog =
    pdf &&
    (view ? (
      <div className="pdf-viewer" role="dialog" aria-modal="true" aria-label={`Vista previa: ${pdf.file.name}`}>
        <div className="pdf-viewer-bar">
          <button className="icon-btn" aria-label="Cerrar la vista previa" onClick={() => setView(false)}>
            <X size={20} />
          </button>
          <span className="pdf-viewer-title">
            {pdf.pages.length} {pdf.pages.length === 1 ? 'página' : 'páginas'}
          </span>
          {saveButton('btn sm primary')}
        </div>
        <div className={`pdf-viewer-pages${zoom ? ' zoom' : ''}`}>
          {pdf.pages.map((src, i) => (
            <img key={i} src={src} alt={`Página ${i + 1} de ${pdf.pages.length}`} onClick={() => setZoom((z) => !z)} />
          ))}
          <p className="pdf-viewer-hint">Toca una página para {zoom ? 'verla entera' : 'ampliarla'}.</p>
        </div>
      </div>
    ) : (
      <div className="overlay" onClick={close}>
        <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="pdf-title" onClick={(e) => e.stopPropagation()}>
          <h2 id="pdf-title">PDF listo</h2>
          <p>{pdf.file.name}</p>
          <div className="dialog-actions pdf-actions">
            {saveButton('btn primary', true)}
            <button className="btn" onClick={() => setView(true)}>
              <Eye size={17} /> Ver
            </button>
            <button className="btn ghost" onClick={close}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    ));

  return { busy, run, dialog };
}

export function dateStamp(ms = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
