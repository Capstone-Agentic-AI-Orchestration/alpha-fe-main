import { desktop } from './desktop';

/**
 * Where this build finds Alpha's API -- from the build environment, nowhere else.
 *
 * These used to fall back to `http://localhost:3001`, which quietly pointed a
 * web build with a missing setting at the visitor's own machine. There is no
 * fallback now: `vite.config.ts` refuses to build without VITE_API_URL, so an
 * unset value fails the build instead of shipping.
 *
 *   web      VITE_API_URL=/api   (same origin; see middleware.ts)
 *   desktop  runtime API/WS addresses from the preload bridge; the baked Vite
 *            values are only a fallback for older desktop shells
 */
export const API_BASE: string = desktop?.apiBase || import.meta.env.VITE_API_URL;

/**
 * The desktop daemon's raw WebSocket. Unset in the web build on purpose --
 * cloud mode never opens it -- so absent means "do not connect".
 */
export const WS_URL: string | undefined = desktop?.wsUrl || import.meta.env.VITE_WS_URL || undefined;
