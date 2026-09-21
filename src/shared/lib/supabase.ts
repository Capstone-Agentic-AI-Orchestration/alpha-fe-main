import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { apiService } from '@/shared/services/apiService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

/** Refresh this long before the token expires, so a join never uses a stale one. */
const REFRESH_MARGIN_MS = 60 * 1000;

let cached: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;

/**
 * The token Supabase sees, from this session rather than the anon key.
 *
 * Run channels are private: Realtime lets a browser join `run:<id>` only if
 * the token's login can see that run. The anon key has no login, so it can
 * join nothing. The API mints a ten-minute token from the session cookie;
 * this caches it and asks again shortly before it lapses.
 *
 * Falls back to the anon key when there is no session or the API is
 * unreachable -- private channels then refuse the join, which is the right
 * answer for someone the API cannot vouch for.
 */
async function databaseToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - REFRESH_MARGIN_MS) return cached.token;

  inFlight ??= apiService
    .getDatabaseToken()
    .then(({ token, expiresAt }) => {
      cached = { token, expiresAt: Date.parse(expiresAt) };
      return token;
    })
    .catch(() => supabaseAnonKey)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * `accessToken` hands Supabase this session's token for REST and Realtime
 * alike. It also switches off supabase-js's own auth, which Alpha never used:
 * identity is the GitHub session, not a Supabase account.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      accessToken: databaseToken,
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    })
  : null;
