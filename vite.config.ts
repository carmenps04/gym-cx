import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Copia el lector de texto (OCR) a dist/ocr al compilar, desde node_modules: así la app no depende de
 * ningún servidor externo para leer capturas y no hace falta subir estos archivos al repositorio.
 */
function ocrAssets(): Plugin {
  return {
    name: 'ocr-assets',
    apply: 'build',
    closeBundle() {
      const out = 'dist/ocr';
      mkdirSync(out, { recursive: true });
      cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`);
      for (const f of readdirSync('node_modules/tesseract.js-core')) {
        if (f.endsWith('.wasm.js')) cpSync(`node_modules/tesseract.js-core/${f}`, `${out}/${f}`);
      }
      cpSync('node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', `${out}/spa.traineddata.gz`);
    },
  };
}

// base './' + HashRouter: funciona igual en Firebase Hosting y en GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), ocrAssets()],
  // Fecha de compilación (hora de Madrid), visible en la app para saber si el móvil tiene la última versión.
  define: {
    __APP_VERSION__: JSON.stringify(
      new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    ),
  },
  build: { chunkSizeWarningLimit: 900 },
});
