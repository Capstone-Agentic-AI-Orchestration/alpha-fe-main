import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  /**
   * Refuse to build or serve without an API address.
   *
   * The app used to fall back to `http://localhost:3001` when VITE_API_URL was
   * missing, so a web build with the setting forgotten shipped pointed at the
   * visitor's own machine, and looked broken rather than misconfigured. Vite
   * inlines the value at build time, so the build is the place to stop it.
   */
  const env = loadEnv(mode, process.cwd());
  if (!env.VITE_API_URL) {
    throw new Error(
      'VITE_API_URL is not set. Web builds use "/api" (see DEPLOYMENT.md); the ' +
        "desktop and local development point it at the daemon's /api in .env.local."
    );
  }

  return {
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
      /**
       * Fail if 3000 is taken instead of quietly moving.
       *
       * Vite's default is to walk up to the next free port, and the next one is
       * 3001 — the daemon's. A dev server that lands there either loses to the
       * daemon or, if it wins the race, serves the UI on the address the UI
       * itself calls for its API, so every request 404s against the frontend.
       * A refusal to start says what is wrong; a silent move does not.
       */
      strictPort: true,
      open: false,
    },
  };
});
