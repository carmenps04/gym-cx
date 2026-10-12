// Lectura de texto en capturas de pantalla, dentro del propio navegador (Tesseract.js).
// Los archivos del lector se sirven desde ./ocr/ (los copia vite.config.ts al compilar).

export interface OcrProgress {
  file: number;
  files: number;
  /** 0–1 dentro de la imagen actual. */
  progress: number;
  status: string;
}

/**
 * Prepara la captura: gris, y si el fondo es oscuro se invierte (el lector funciona mejor con
 * texto oscuro sobre fondo claro). Las capturas pequeñas se amplían.
 */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  // Ampliar ayuda a no perder dígitos finos («110» leído como «10»).
  const scale = Math.min(3, Math.max(1, 1800 / bmp.width));
  const c = document.createElement('canvas');
  c.width = bmp.width * scale;
  c.height = bmp.height * scale;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = g;
    sum += g;
  }
  if (sum / (px.length / 4) < 110) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function readScreenshots(files: File[], onProgress?: (p: OcrProgress) => void): Promise<string[]> {
  const { createWorker } = await import('tesseract.js');
  const base = new URL('./ocr/', window.location.href.split('#')[0]).href;
  let current = 0;
  const worker = await createWorker('spa', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    logger: (m: { status: string; progress: number }) => onProgress?.({ file: current + 1, files: files.length, progress: m.progress ?? 0, status: m.status }),
  });
  try {
    const texts: string[] = [];
    for (current = 0; current < files.length; current++) {
      const canvas = await prepare(files[current]);
      const { data } = await worker.recognize(canvas);
      texts.push(data.text);
    }
    return texts;
  } finally {
    // Se libera la memoria en cuanto termina (importante en el iPhone).
    await worker.terminate();
  }
}
