/** Utilidades del PDF. El informe se dibuja en lib/summaryPdf.ts. */

/** ¿Se puede abrir la hoja Compartir con un archivo? (iPhone, Android y algunos navegadores de escritorio). */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
