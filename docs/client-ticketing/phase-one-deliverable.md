# Plan 3 — Phase 1 of 9: real application interfaces

Date: 8 October 2026. Scope: the newest deliverable-first plan, not the older
six-phase implementation history in `application-first.md`.

## Delivered

- PM: **Tickets** inside Alpha's existing authenticated app, sidebar and tabs.
  Queue, minimal counters, search/filter, detail, public conversation and private
  notes reuse the actual ticket components. Other navigation remains present.
- Development only: **Show sample data** on that same PM page loads explicitly
  fictional, read-only records. **Hide sample data** removes them. No sample
  fallback is used when a connected request fails.
- Until ticketing is enabled, that page shows a neutral **Ticketing is coming
  soon** notice, disables search/filter/refresh, makes no ticket API requests,
  and does not fabricate empty results or zero counters. Samples remain browsable.
- Client web: `/#/client` shows the real email-access entry, with sign-in disabled
  until secure account access is connected. `/#/request` shows the real inquiry
  interface with submission disabled. Both links and browser back/forward work.
- Local client inspection: `/?ticketing-preview=client` renders the same
  `ClientPortal` component intended for the connected portal, with a dev-only
  read transport. Includes ticket list/detail, search/filter/history, conversation,
  shared project/scope and the actual new-request form. Submission is disabled.
- Desktop and narrow-screen layouts; mobile search stays in the list and a back
  action returns from a detail. Saved internal Tickets tabs survive refresh.

## Explicitly not delivered or enabled

- No new create-developer-Issue form. Existing global Issue creation and prior
  linking-to-existing-Issues components were preserved.
- No invitation email, email verification, account creation, durable ticket
  intake, messages/notes writes, uploads/downloads, client acceptance, agent
  execution or deployment was enabled in this phase.
- Client review samples have no actual delivery files. Do not treat their
  statuses or text as proof that result sharing works.
- Sample data is not backend data. Development-only UI inspection is not a
  security or production-readiness test for the eventual client service.

## Local runtime

Frontend: `http://localhost:3000`. Internal PM Tickets requires normal authorized
PM sign-in; there is no new login bypass. Client UI inspection does not require
an internal identity and grants no real access.

With user approval, only local backend `.env` CORS entries were appended for
`http://localhost:3000` and `http://127.0.0.1:3000`, preserving existing entries.
The verified local backend was restarted using its existing Node executable.
Health with a localhost Origin returned 200; CORS preflight returned 204 with
the expected exact origin and credentials support. This does not imply that
shared database errors or workspace permissions have been repaired.

No hosted settings, migrations, GitHub App settings, desktop source, commits,
pushes or deployments were changed. Existing backend startup behavior remains
unchanged; no new database command was introduced. Earlier backend source is
preserved in the separate local-preservation archive, not deleted or reset.

## Verification

- Frontend typecheck and production build passed; build reports the existing
  large internal-app bundle warning.
- Frontend suite: 24 files / 269 tests passed.
- `scripts/test-ticketing-phase-one.mjs` exercises the actual internal App shell
  with test-only identity/API responses, PM navigation/reload/sample switching,
  notes, mobile search/back, actual client component and request form, public
  entry navigation and browser history. Zero browser runtime errors.
- The isolated browser blocks external requests and intercepts every API call,
  including Alpha's existing startup board-sync POST. No API request is forwarded
  and no test writes reach a backend. Client sample inspection makes no API calls.
- Browser screenshots and `verification.json` are in the local visualization
  folder `phase-one-ui-2026-10-08`, outside the repositories.

## How to review

1. Open the local frontend and sign in normally as a PM.
2. Open **Tickets** under Delivery, then **Show sample data**.
3. Use **Hide sample data** to return to the neutral unavailable state. The
   development toggle is omitted by normal production builds, including the
   standard desktop preparation command. Local desktop review needs a development
   renderer; an installed/released build deliberately has no sample records.
4. Open `http://localhost:3000/?ticketing-preview=client` to inspect client samples.
5. Open `http://localhost:3000/#/request` and `http://localhost:3000/#/client` for the
   real public entry screens. Their unavailable actions are intentionally disabled.

The next feature phase should connect one approved workflow to these interfaces;
it should not build another PM shell or substitute a prototype for the app.

## UI availability (9 October 2026)

`VITE_TICKETING_ENABLED=1` opts the real PM page into connected requests at build
time. It is **off by default** and does not enable any backend route, grant a
role or bypass authentication. No environment file is changed by the UI update.
Enable it only when the backend read boundary and approved database are ready.
When connected mode is explicitly enabled, unexpected errors (including HTTP
503) remain errors; they are not disguised as the planned coming-soon state or
replaced by sample records. Sample transports reject writes and never fall back
to real transport calls. The local toggle stays inside the normal PM app shell.
