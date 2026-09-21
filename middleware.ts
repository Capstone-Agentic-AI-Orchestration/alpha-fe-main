import { rewrite } from '@vercel/functions';

/**
 * Serve the API from this origin: `/api/*` here is forwarded to the Alpha API.
 *
 * Why it has to be this origin: `vercel.app` and `onrender.com` are both public
 * suffixes, so the web app and the API would be different sites. The session
 * cookie is `SameSite=Lax`, and a browser withholds a Lax cookie from a
 * cross-site fetch -- sign-in would set it and every request after would
 * arrive without it. Forwarded from here, the cookie is first-party.
 *
 * Why middleware and not a `vercel.json` rewrite: a rewrite's destination is a
 * literal in the repository, which names one deployment's hostname. This reads
 * it from `API_ORIGIN`, a server-side variable -- no `VITE_` prefix, so it is
 * never compiled into the bundle. There is no fallback: an unset origin answers
 * 503 and says so, rather than guessing where the API might be.
 */
export const config = { matcher: '/api/:path*' };

export default function middleware(request: Request): Response {
  const apiOrigin = process.env.API_ORIGIN;
  if (!apiOrigin) {
    return new Response(
      JSON.stringify({ error: 'API_ORIGIN is not set on this deployment, so the API cannot be reached.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Path and query only: API_ORIGIN is an origin, and the path is the caller's.
  const { pathname, search } = new URL(request.url);
  return rewrite(new URL(pathname + search, apiOrigin));
}
