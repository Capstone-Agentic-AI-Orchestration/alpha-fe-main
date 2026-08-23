import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset URLs. The Electron renderer loads index.html over file://,
  // where the default absolute '/' base resolves to the filesystem root and
  // every script and stylesheet 404s — a blank window with no error.
  // Harmless for web hosting, which serves from the same directory anyway.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
