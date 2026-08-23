/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local Alpha daemon REST base, e.g. http://localhost:3001/api */
  readonly VITE_API_URL: string;
  /** Local Alpha daemon WebSocket, e.g. ws://localhost:3001 */
  readonly VITE_WS_URL: string;

  /** Team mode only. Blank in solo mode. */
  readonly VITE_SUPABASE_URL?: string;
  /** Team mode only. Public by design — safe only because RLS constrains it. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
