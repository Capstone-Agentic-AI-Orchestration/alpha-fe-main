/**
 * Where this build finds Alpha's API -- from the build environment, nowhere else.
 *
 * These used to fall back to `http://localhost:3001`, which quietly pointed a
 * web build with a missing setting at the visitor's own machine. There is no
 * fallback now: `vite.config.ts` refuses to build without VITE_API_URL, so an
 * unset value fails the build instead of shipping.
 *
 *   web      VITE_API_URL=/api   (same origin; see middleware.ts)
 *   desktop  VITE_API_URL=http://127.0.0.1:3001/api, from the local .env
 */
export const API_BASE: string = import.meta.env.VITE_API_URL;

/**
 * The desktop daemon's raw WebSocket. Unset in the web build on purpose --
 * cloud mode never opens it -- so absent means "do not connect".
 */
export const WS_URL: string | undefined = import.meta.env.VITE_WS_URL || undefined;
