import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
  server: { port: 5173 }
});
