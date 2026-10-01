import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' + HashRouter: funciona igual en Firebase Hosting y en GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
});
