# Deploying the web app

The PM and client half of Alpha. Developers use the desktop app instead — the
web build detects a `dev` role and offers the installer rather than a workspace,
because developer tools need a checkout and the AI CLIs on a real machine.

## Vercel

Import `alpha-fe-main`. `vercel.json` pins the build, so nothing needs choosing
in the UI.

It carries the security headers and one rewrite. There is no SPA fallback
because this app has no router — navigation is component state on a single
URL, so there are no deep links to fall back for.

### The API is served from this origin

`vercel.json` forwards `/api/*` to the Render service, so the browser only ever
talks to `<this-app>.vercel.app`. That is what makes sign-in work.

`vercel.app` and `onrender.com` are both on the Public Suffix List, so the app
and the API are **different sites** to a browser. The session cookie is
`SameSite=Lax`, and a Lax cookie is not sent on a cross-site `fetch` — so when
the app called Render directly, sign-in set the cookie and every `/api/me`
after it arrived without one. The result was a loop back to the sign-in screen.

Serving the API from this origin makes the cookie first-party. `SameSite=None`
would also have worked in Chrome, but it drops the CSRF protection Lax gives
every state-changing route, and Safari, Firefox and private windows block
third-party cookies anyway.

The Render hostname is written into `vercel.json` because rewrites cannot read
environment variables. Change it there if the service is renamed.

### Environment variables

| Variable | Value |
| :--- | :--- |
| `VITE_API_URL` | `/api` — relative, so requests go through the rewrite |
| `VITE_SUPABASE_URL` | Supabase → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API |

Leave all three as plain variables, not **Sensitive**. Vite compiles every
`VITE_` value into the bundle, so none of them is secret, and a Sensitive
variable cannot be read back to check it — or converted afterwards.

The GitHub App's **Callback URL**, and Render's `GITHUB_CALLBACK_URL`, must use
this origin too, so the cookie is set on it:

```
https://<this-app>.vercel.app/api/github/oauth/callback
```

The webhook URL stays pointed at Render directly; it is server to server and
carries no cookie.

`VITE_WS_URL` is deliberately unset. The raw WebSocket is not created in cloud
mode: it broadcasts every run to every client with no token check on upgrade,
which is fine on a developer's loopback and would be a public firehose on
Render. Cloud clients get the same telemetry through Supabase Realtime, where
RLS applies.

The anon key being public is expected. It grants nothing on its own — every
table has RLS enabled, and the policies read claims from a short-lived token
the API mints per session.

## After the first deploy

The API needs to know this origin. Its first entry is also where the OAuth
callback sends the browser after sign-in, so a wrong value lands people on the
wrong site:

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
