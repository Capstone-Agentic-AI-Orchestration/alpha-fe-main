# Deploying the web app

The PM and client half of Alpha. Developers use the desktop app instead — the
web build detects a `dev` role and offers the installer rather than a workspace,
because developer tools need a checkout and the AI CLIs on a real machine.

## Vercel

Import `alpha-fe-main`. `vercel.json` pins the build, so nothing needs choosing
in the UI.

It exists only for the security headers; a Vite SPA deploys fine without one.
There is no rewrite rule because this app has no router — navigation is
component state on a single URL, so there are no deep links to fall back for.

### Environment variables

| Variable | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://<render-service>.onrender.com/api` |
| `VITE_SUPABASE_URL` | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API |

`VITE_WS_URL` is deliberately unset. The raw WebSocket is not created in cloud
mode: it broadcasts every run to every client with no token check on upgrade,
which is fine on a developer's loopback and would be a public firehose on
Render. Cloud clients get the same telemetry through Supabase Realtime, where
RLS applies.

The anon key being public is expected. It grants nothing on its own — every
table has RLS enabled, and the policies read claims from a short-lived token
the API mints per session.

## After the first deploy

The API needs to know this origin, or the browser will block every request:

```
CORS_ORIGIN = https://<this-app>.vercel.app
```

For preview deploys to work too, add a pattern that pins a label you control:

```
https://<project>-*-<your-team-slug>.vercel.app
```

A bare `https://*.vercel.app` is refused at parse time and logged. `vercel.app`
is a shared apex — anyone can deploy to it — so that pattern is not an
allowlist, it is every tenant on the platform, and the API sends credentials.

## What working looks like

1. Open the app. It calls `GET /api/me`.
2. Not signed in → the sign-in screen, with a GitHub button.
   - No button and a "not configured" note means the API has no
     `GITHUB_CLIENT_ID`.
3. Sign in → GitHub → back to the app with a session cookie.
4. Role comes from your team in the workspace organisation:
   - `project-managers` → the PM workspace
   - `developers` → the desktop download page
   - no mapped team → refused, with the reason

### If sign-in bounces with `no_team`

Either you are genuinely in no mapped team, or the API could not read team
membership at all. The server log distinguishes them. If *everyone* is refused
at once it is the second: check that the GitHub App is installed on the
organisation with `Members: read`.
