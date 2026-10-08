# Plan 3 — application-first implementation

> Historical six-phase execution notes. The current deliverable-first work is
> tracked as Phase 1 of 9 in [phase-one-deliverable.md](phase-one-deliverable.md).
> Historical completion labels below do not establish connected production readiness.

## Faster phase-by-phase plan — 8 October 2026

This is a shorter execution path for Plan 3, with the same phase order and
requirements. It saves time by reusing the screens and services already built,
limiting active work to one complete ticket workflow, and avoiding new adjacent
features until their planned phase. Supabase remains Phase 5, after local flow,
safety, and compatibility gates. No provider, hosted database, staging, or live
changes occur before then.

### Phase 1 — Existing-system UI integration

**Status: complete. Estimate: no planned work.** Keep the PM Tickets page in the
existing internal app and the client entry isolated. Reuse these screens; do not
build another PM portal or redo the UI foundation.

**Exit:** existing destinations and app entry remain intact; the PM Tickets page
and isolated client entry load in their intended app contexts.

### Phase 2 — Frontend/backend application flow

**Status: active. Estimate: 3–5 focused workdays.** Finish one local workflow:
ticket creation, PM queue/detail, public PM reply, separate private note, client
public-message view, and recovery from uncertain/repeated writes. Shape a screen
only where this workflow needs it, then connect it to the matching existing
backend service in the same slice. Use isolated local/test adapters and test data;
do not add hosted persistence or enable real client access.

**Exit:** the complete flow works locally through the existing app surfaces;
private notes stay out of the client projection; retries do not duplicate work;
focused frontend/backend regression tests and affected typechecks pass.

### Phase 3 — Transport and execution/review guards

**Status: partially prepared. Estimate: 2–4 focused workdays.** Complete only the
transport and fail-closed guards needed by the planned flow. Keep the production
client boundary unavailable until its later identity and persistence phase. Verify
allowlisted responses, origin/CSRF refusal, current authorization checks, and safe
errors. Do not connect ticket work to runners or enable release actions here.

**Exit:** controller/service boundaries reject unauthorized requests and do not
expose internal tokens, PM notes, or diagnostics; existing PM/developer sessions,
Projects, Issues, and runner paths remain compatible. Focused boundary tests pass.

### Phase 4 — Local verification and compatibility

**Status: underway as quality checks; final gate pending. Estimate: 2–4 focused
workdays.** Fix bugs found while integrating the flow. Run the full existing
frontend and backend test suites, both typechecks, and both production builds.
Check compatibility with current login, Projects/Issues, desktop transport, and
runner queue behavior. Keep focused tests for each touched boundary; batch full
suite runs at phase exit instead of repeating them for every small edit.

**Exit:** all required checks pass, known failures are resolved or documented,
and local end-to-end behavior preserves existing functionality. Do not start
Phase 5 while this gate is open.

### Phase 5 — Persistence and hosted-provider integration

**Status: deferred until Phases 2–4 pass. Estimate: 5–10 focused workdays, plus
any external configuration wait.** Then connect the approved isolated Supabase
staging project for the persistence, client identity/grants, and recovery work
required by the governing plan. Review any additive migration before applying
it. Keep shared/live untouched. Verify staging Auth origin/callback and sender
settings before invitations; do not send email to an unapproved recipient.

**Exit:** staging persistence and identity enforce ticket grants, revocation,
private-note separation, and idempotent recovery; migration and provider checks
pass; the client endpoint remains fail-closed until its complete guards pass.

### Phase 6 — Cross-persona staging and pilot

**Status: pending. Estimate: 2–4 focused workdays after Phase 5.** Use approved
test identities to exercise the client and PM views across ticket creation,
public/private messages, retries, revocation, cross-account denial, and recovery.
Keep file delivery, agent execution, and release actions behind their own phase
gates. Obtain the required pilot approval before live use.

**Exit:** cross-persona staging checks pass, recovery and denial cases behave
as expected, and all original release safeguards are satisfied.

### Phase-by-phase breakdown for the remaining Plan 3 workflows

The repository already contains local service contracts and UI for parts of
these workflows. Treat those as starting points; check the backend checkpoint
notes below, then implement only the missing tasks. Their contracts do not prove
production enablement. “Local” tasks use isolated test adapters and never enable
hosted access. Every Supabase, provider, or durable staging task stays in Phase 5.

- Public inquiry: `application-public-intake-layer.md`.
- Files and results: `application-delivery-read-layer.md` and
  `application-delivery-registration-assessment.md`.
- Invitation/email: `application-invitation-layer.md`.
- Project/Issue handoff: `application-work-handoff.md`.
- Agent execution: `application-execution-admission.md` and
  `application-runner-queue-lifetime.md`.
- Result review: `application-result-review-loop.md`.

#### Phase 2 — local application behavior

- **Public inquiries:** connect the existing form and contract to the local
  intake service; preserve the generic acknowledgement, private unverified
  contact, and same-operation retry. No public production route.
- **File storage and scanning:** finalize upload metadata, size/type limits, and
  `pending`, `clean`, and `rejected` states. Keep unscanned files unavailable;
  do not add a local fake scanner to runtime code.
- **Automated email:** define the notification events and allowlisted message
  fields, including invitation and ticket-update events. Record an outbox intent
  locally; send nothing.
- **Project/Issue handoff:** finish the existing PM selector and local workflow
  for linking only the agreed scope to eligible existing Projects and Issues.
  Preserve operation IDs for retry and recovery.
- **Agent execution:** complete the local admission decision for approved Issue
  revisions, holds, corrections, and duplicate claims. Keep actual ticket-backed
  starts disabled.
- **Result review:** finish the local sequence for immutable result registration,
  PM inspection/assessment, separate sharing, client acceptance or correction,
  and explicit PM closure. No action should start a runner automatically.

#### Phase 3 — transport, authorization, and safety guards

- **Public inquiries:** add the narrow proof/origin/rate-limit guard and bounded
  request handling. Trust only the server-owned intake slug and server-derived
  request context; never authorize from the submitted email or body fields.
- **File storage and scanning:** require current ticket grants for upload and
  read; quarantine uploads; bind reads to an exact immutable file/version; deny
  pending, rejected, oversized, or unverifiable content.
- **Automated email:** specify idempotent outbox claims, retry/backoff, recipient
  binding, suppression, and safe content. Keep provider delivery disabled.
- **Project/Issue handoff:** recheck PM authority, agreed scope, project access,
  Issue eligibility, and current revisions at commit. Make binding and audit
  atomic; do not grant the client internal project or repository access.
- **Agent execution:** put admission checks at direct, retry, squad, and queue
  entry points; recheck hold/revocation and exact revisions. Keep ticket-backed
  runner and release paths fail-closed until durable claims arrive in Phase 5.
- **Result review:** require exact current revisions and verified clean-file
  evidence. Keep registration, PM assessment, sharing, client decision, and
  closure separate; corrections must not restart execution automatically.

#### Phase 4 — local regression and compatibility

- **Public inquiries:** cover invalid proof/origin, bounds, rate limits, generic
  response, private-contact projection, rollback, and same-operation retry.
- **File storage and scanning:** cover authorization denial, pending/rejected
  files, size/type limits, scanner failure, corrupt bytes, tampering, timeout,
  cancellation, and revocation during reads.
- **Automated email:** use a fake provider to cover duplicate events, retry,
  suppression, uncertain outcomes, wrong-recipient refusal, and content allowlists.
- **Project/Issue handoff:** cover stale scope/revisions, duplicate binding,
  concurrent changes, rollback, lost-response recovery, and existing Projects/
  Issues behavior.
- **Agent execution:** cover duplicate claims, holds, corrections, queue-front
  rechecks, cancellation and recovery; rerun existing runner/squad regressions.
- **Result review:** cover missing/corrupt files, stale manifests, scan drift,
  uncertain assessment/share responses, client correction, and explicit closure.
- At the phase exit, run the full frontend/backend suites, typechecks, and builds.
  Resolve regressions before Phase 5; local test success does not prove hosted
  authorization, storage, or delivery.

#### Phase 5 — Supabase and external-provider integration

Begin only after Phases 2–4 exit checks pass. Use the approved isolated staging
project and reviewed additive migrations. Never apply these tasks to shared/live.

- **Public inquiries:** persist the private contact, rate budgets, operation
  outcome, audit, and outbox atomically; verify cross-instance limits and
  concurrency with the real database policies.
- **File storage and scanning:** configure private quarantine/storage, scoped
  object access, immutable versions, durable scan evidence, cleanup, and
  promotion of clean files only. Verify scanner failure remains fail-closed.
- **Automated email:** implement the durable outbox worker and approved sender;
  store provider secrets safely and keep Auth email separate from ticket
  notifications. Confirm origin, sender, and test-recipient settings first.
- **Project/Issue handoff:** implement durable unique bindings and atomic writes
  with the same authorization/lock order as ticket and Issue changes.
- **Agent execution:** persist claims and dispatch/recovery state; reconcile
  uncertain starts, cancellation, revocation, and completion without blind retry.
  Keep non-ticket runner behavior unchanged.
- **Result review:** persist exact artifact manifests, scan/version evidence,
  assessment/share decisions, client decisions, and operation recovery. Mount
  only the routes whose Phase 3 guards and Phase 4 tests passed.

#### Phase 6 — cross-persona staging acceptance

- **Public inquiries:** submit approved test inquiries; check generic responses,
  rate limits, duplicate recovery, private contact visibility, and ticket binding.
- **File storage and scanning:** upload clean and rejected test files; verify
  quarantine, scan transitions, bounded authorized downloads, and revocation.
- **Automated email:** send only to an approved test recipient; verify invitation
  binding, notification content, retry behavior, and suppression.
- **Project/Issue handoff:** have a PM link agreed work; verify the client gains
  no internal Project/Issue access and stale or unauthorized work is refused.
- **Agent execution:** run only in an approved staging sandbox; verify claim,
  queue, hold, correction, cancellation, and recovery behavior.
- **Result review:** inspect every prepared file, assess and share explicitly,
  then test client acceptance/correction and separate PM closure.
- Keep production enablement behind the original release approval and safeguards.

### Regression cadence and estimate

Run focused tests for every changed slice. Run the full frontend/backend suites
and typechecks at Phase 2 exit, Phase 4 exit, and before staging enablement; run
both builds at Phase 4 exit and before staging enablement. In Phase 5, also run
the migration audit/replay checks required by the backend plan. Preserve coverage
for private-note exclusion, client authorization, CSRF/origin handling, duplicate
recovery, existing login, Projects/Issues, and runner queue behavior.

The earlier **3–5 focused week** estimate covers only the initial ticket/PM
workflow, assuming one developer, reuse of existing code, and ready staging
configuration. It does not estimate the six additional workstreams above. Size
those small tasks against the existing checkpoint notes before scheduling them;
provider and recipient approvals can add waiting time. Current project status
remains **Phase 2 of 6**; the plan does not claim these gates are complete.

The six phases here are status roll-ups; the governing phase-by-phase plan remains
the source for requirements and order. Updating this document changes focus and
exit checks only; it does not implement features or change staging.

## UI foundation implemented locally

- Local preview: My Tickets, inline New Ticket form, Ticket Detail. This remains
  a labelled rehearsal and is separate from the production client route.
- Production client route: `/client` and `/#/client` load an isolated,
  session-gated portal using `clientApi.ts`. It displays authorized workspaces
  and tickets, creates requests, shows ticket conversations, and supports the
  currently available scope-agreement decision. It does not import the internal
  app/session or desktop API path.
- The production portal does not invent sign-in: it shows invitation-only
  guidance until a valid client session exists. Provider login and invitation
  redemption are not connected. Since the backend route is unmounted, it reports
  unavailable rather than creating mock or local ticket records.
- Invitation links now resolve to an isolated `/client/activate` entry rather
  than the internal app or generic portal. It removes the token from the address
  bar and explains that activation is unavailable; it does not validate the
  invitation with the server, create an account, or consume the link.
- Client details expose only PM-shared project names and safe ticket summaries.
  There is no dedicated read-only project-preview API. Protected pinned-file
  download controls now exist, but the backing routes/storage remain unmounted.
  Formal result acceptance and same-ticket correction controls now exist locally,
  gated on inspection of the current shared result; the backing API remains unmounted.
- Public entry: no-account inquiry form with a generic local-preview acknowledgement.
- PM: one Tickets page in the existing internal app containing the queue,
  ticket detail, public conversation and private notes. It supports marking a
  received ticket under review, ordinary replies, and requests for client
  details, proposes scope, selects existing Project/Issues for handoff, returns
  affected reviewed Issues with explicit developer instructions, and closes a
  client-accepted ticket after confirmation. The real ticket API/persistence is
  still unmounted/unconnected. PM inspection of prepared results, explicit
  assessment and separate sharing now exist in this same Tickets detail.
  The server has application-only immutable registration/assessment services;
  real artifact sources, durable storage and mounted APIs remain future work.
  No new PM Messages/Documents/Projects pages.
- Public inquiries are visibly marked unverified in the PM queue; PM-only contact
  details are shown in the inquiry detail. No client thread or workflow scene is
  available before verified account activation. The local preview's PM can add
  only rehearsal notes; they are never sent to the contact. The production PM
  page uses distinct API operations and UI surfaces for public replies and
  PM-only notes.
- Empty initial state; records come only from text entered in this browser tab.
- Public replies appear in both preview views. Internal notes are explicitly
  separate, excluded from the client projection and its last-visible-update time.
- Search, clickable minimal counters, history and linked follow-up requests.
- A marked scene selector demonstrates waiting/work/review/closed layouts only.
  It records no scope agreement, authorization, acceptance or release decision.
- Scope, Documents and Delivery sections explain the flow; corresponding business
  buttons stay disabled rather than falsely confirming an unsupported operation.
- No login, invitations, uploads, cloud writes, project/Issue creation or execution
  is functional through this preview. Refresh clears all rehearsal content.

## Folder structure

The feature follows the existing repository pattern, not a second application:

```text
src/
  app/
    AppEntry.tsx                 # chooses the module graph before workspace state
    InternalApp.tsx              # unchanged internal App + AppProvider composition
    ErrorBoundary.tsx            # internal defaults retained; safe client recovery
  features/ticketing/
    entry.ts                     # pure entry selection; tests beside it
    PublicInquiryUnavailable.tsx # fail-closed public request URL, no false submission
    ClientActivationUnavailable.tsx # isolated, fail-closed invitation destination
    clientApi.ts                 # isolated same-origin client HTTP contract
    clientApiError.ts            # shared client-only error type, no transport cycle
    clientDelivery.ts            # pinned manifest and bounded binary verification
    ClientDeliveryFiles.tsx      # exact shared-result downloads, no repository URL
    clientReview.ts             # exact-result client review display-only gates
    ClientPortal.tsx              # session-gated client web portal
    ClientCreateTicketForm.tsx    # authorized workspace-scoped request form
    ClientTicketDetail.tsx        # safe ticket view and client conversation
    pmApi.ts                     # typed PM API over the existing apiService
    PmTicketsView.tsx             # PM-only queue/detail/conversation screen
    PmScopeProposalForm.tsx       # public summary + private developer brief
    PmWorkHandoffForm.tsx         # existing Project/Issue selection, no runner launch
    pmWorkHandoff.ts              # label projection and display-only preflight
    PmCorrectionForm.tsx          # targeted Issue return + explicit developer instructions
    PmDeliveryAssessment.tsx      # inspect prepared files, approve without publishing
    pmDeliveryCandidates.ts       # bounded candidate-list projection, no private metadata
    PmDeliveryReview.tsx          # inspect assessed result, acknowledge, explicitly share
    pmReview.ts                   # correction and accepted-closure preflight
    TicketingPreview.tsx          # local preview shell/queue only
    CreateTicketForm.tsx
    PublicInquiryForm.tsx         # no-account first step; rehearsal only
    TicketDetailView.tsx
    TicketConversation.tsx
    TicketStatusBadge.tsx
    publicIntakeContract.ts     # versioned inquiry wire DTO, paired with backend
    ticketUi.ts                  # feature-specific existing-theme classes
    previewModel.ts              # explicitly temporary UI fixture, not business authority
scripts/
  test-ticketing-preview.mjs     # optional isolated browser rehearsal
  test-ticketing-pm-handoff.mjs  # isolated real PM view/transport rehearsal
  test-ticketing-client-delivery.mjs # isolated real client view/download rehearsal
  test-ticketing-review-loop.mjs # isolated real PM/client review and recovery rehearsal
docs/client-ticketing/
  application-first.md
```

The existing CSS tokens, brand asset, typography and layout vocabulary are reused.
The internal `apiService` has an additive, namespace-restricted ticket helper;
navigation adds PM-only Tickets while retaining existing destinations and landing
pages. AppContext state, package dependencies, environment files and desktop source
remain unchanged for ticketing. A separate client-only HTTP facade exists in the feature folder;
it uses relative `/api/client` same-origin requests, never `API_BASE`, the
desktop daemon, or `VITE_ALPHA_LOCAL_TOKEN`.
Earlier independent desktop-detection test fixes remain in the worktree.

## How to inspect locally

The actual PM integration is the existing internal app's **Tickets** navigation
item, rendered by `App.tsx` for the PM persona. It is not another PM portal.
Use the normal local app URL to inspect that integration; unavailable API messages
are expected until the durable backend is connected. The query-string previews
below are optional empty rehearsals, not the final location of PM functionality.

Run the frontend dev server with its existing configuration. On loopback only:

- `/?ticketing-preview=client`
- `/?ticketing-preview=pm`

The toolbar changes the preview view while preserving the same in-memory records;
it is not sign-in or a real persona-switching permission. Opening a second tab
starts a separate empty rehearsal. Reset clears only these temporary records.
Do not use confidential text. There is no browser-storage persistence or sync.

Production builds strip the preview component/model. The reserved client web
entry is `/#/client` (and `/#/client/...`), showing an explicit unavailable screen
until secure integration. Public inquiry links use the `/#/request/:slug` route;
until a real proof provider and mounted server endpoint are configured, that
route shows a generic unavailable screen and never loads the internal workspace.
It accepts no contact details and sends no requests. Hash navigation keeps the existing `base: './'`,
Electron file assets and single-URL Vercel setup unchanged. Do not publish
pathname deep links without separately configuring/testing their hosting/assets.
Legacy GitHub OAuth error fragments and internal routes remain internal.

Client entry is selected before importing the internal App/AppProvider graph.
Its error screen cannot display internal diagnostics or clear internal caches.
These are frontend isolation checks, not server-side authorization evidence.

## Client API transport contract

`src/features/ticketing/clientApi.ts` now describes the client session,
invitation activation, authorized workspace selector, intake-context/project
choices, ticket list/create/recovery, detail, conversation, reply and decision calls. Authenticated writes require the
dedicated client CSRF cookie and send its value in `X-CSRF-Token`; provider
credentials are passed only in the Authorization header for activation/session
exchange and are not persisted by this module. Requests are same-origin,
`credentials: 'same-origin'`, no-store, and disallow redirects. It intentionally
does not use the existing internal `apiService`, which can address a desktop
daemon and add an Alpha local token.

The production portal now consumes this transport, but this remains an
application/API contract rather than a live service: backend routes are
unmounted, and the portal requires an already-established client session. It
cannot authenticate or read/write real tickets in the current environment.
Provider verification, durable stores, trusted origin/rate-limit configuration,
and exact router mount order remain gates before the service can be enabled. No
provider/database setting is changed in this phase.

Latest application-only checkpoint: the backend has matching unmounted
workspace, intake-context, ticket, and session service/store contracts. The
isolated client portal consumes the typed API but has no provider login, durable
store, or mounted router, so real client access remains unavailable. Frontend
and backend typechecks passed, and the production frontend bundle built into an
isolated temporary directory. Static inspection of the generated ClientPortal
chunk found the client API root but no internal `apiService`, desktop local
token, or `InternalApp` import. This is bundle isolation evidence, not server
authorization evidence. No tests were run for this checkpoint.

## Verification

Use `npm test -- --maxWorkers 2`, `npm run typecheck` and `npm run build`.
The optional browser script takes a separately installed Playwright module path,
a loopback URL and an artifact directory; an optional fourth argument selects an
already-installed Chromium executable. A fifth `--production` argument checks
the built disabled client entry instead of the development rehearsal.

The browser test uses a fresh profile, blocks all external/protected API requests
and checks the public conversation, note exclusion, read-only history, separate
follow-up, responsive layout, reset-on-refresh and no internal workspace imports.
It must not run against live hosting. No new dependency is needed in this repo.

Verified 8 October 2026: 12 frontend files / 104 tests passed; typecheck and
production build passed. Browser rehearsal passed public replies, private-note
exclusion, read-only terminal records, separate linked work, mobile overflow,
refresh clearing and zero protected requests/internal workspace imports/errors.
The built client hash-link also passed with preview controls unavailable and
zero protected requests/internal modules/errors. JavaScript build inspection
confirmed the local preview implementation is absent. Cached Playwright 1.63.0
was run against already-installed Chromium revision 1228; no browser/dependency
download or package/lockfile change occurred. This is local compatibility evidence,
not a packaged-desktop or hosted-production acceptance test. The existing large
internal application chunk warning remains (about 1.18 MB minified).

Initial verification caught an overly narrow inferred test-ID type, which was
fixed before the successful checks. The first browser launch expected a missing
newer Chromium revision; using the explicit installed executable resolved it.
Queue filters now close an unrelated open detail; client error recovery avoids
raw diagnostics/log bodies and internal cache-reset controls. No Supabase call,
email, environment switch, migration, commit, push or deployment was made in this
application-only checkpoint. Desktop source and existing Issues naming remain intact.

The backend now has a local application command service in its existing
`src/services` and persistence contract in `src/store`, reusing
`src/ticketing/workflow.ts`. It handles fresh authorization, operation replay,
version conflicts, atomic effects and safe receipts; its in-memory adapter is
test-only. It is not mounted to APIs or connected to this frontend preview.
See the backend `docs/client-ticketing/application-command-layer.md`.

The subsequent backend read layer now separates safe client/PM detail, the
shared public conversation and PM-only notes. It uses shared authorization and
excludes unpublished assessments, private clocks and internal IDs from client
responses. Neither these reads nor the command service are connected to this
preview. See backend `docs/client-ticketing/application-read-layer.md`.

The backend communication service now saves public reply decisions atomically
and keeps private notes out of public clocks, workflow versions and signals.
It reuses existing workflow/read rules and one operation namespace, but has no
mounted API or runtime persistence and is not connected to this rehearsal.
See backend `docs/client-ticketing/application-communication-layer.md`.

The backend queue service now defines explicitly authorized lists and the agreed
two client/four PM counters, independent of page length, with separate private/
public sorting and workspace-local monthly boundaries. Its store is a contract
with test-only adapters, not a mounted API or durable source for this preview.
See backend `docs/client-ticketing/application-queue-layer.md`.

The backend creation service defines signed-in requests, exact ticket grants,
server reference allocation and duplicate-safe recovery. Shared-project selection
and desired date are preferences, not automatic work authorization. The local
public-intake layer now defines a generic anonymous acknowledgement, an
unactivated inquiry ticket, safe request-detail projections, proof/rate-budget
contracts and duplicate-safe retry behavior. Nothing is connected to this preview:
there is no public route, real anti-abuse verifier, durable production limiter,
database adapter, invitation activation, client login or email delivery. See the
backend `docs/client-ticketing/application-creation-layer.md` and
`docs/client-ticketing/application-public-intake-layer.md`.

The backend also now defines a separate developer work-context read boundary:
only the assigned developer's approved Issue brief/revision is projected, with
no client contact, thread, private PM note or unrelated ticket details. It is
not a run permission; start/retry still need their own live gate. See backend
`docs/client-ticketing/application-developer-context-layer.md`.

The backend now also has an unmounted, dependency-injected HTTP controller for
public inquiry submission. It returns only a generic acknowledgement and uses
the existing safe error mapping. It is not registered in `index.ts`; there is
still no callable endpoint until durable storage, rate budgeting and a real
anti-abuse proof provider are configured. See backend
`docs/client-ticketing/application-public-intake-layer.md`.

The backend now defines a provider-neutral activation eligibility check and
application/store transaction contract: a server-verified invited identity can
bind only to the same pending public-inquiry ticket, creating only the client
service/ticket grants—not workspace membership or project access. It does not
send an invitation, create an Auth user, or create the separate Alpha client
session. See backend
`docs/client-ticketing/application-client-activation-layer.md`.

The PM invitation-issuance checkpoint now adds a provider-neutral application
service, store contract, and unmounted PM-only command/invitation transport
controllers in the backend's existing `src/services`, `src/store`, and
`src/controllers` folders. The command controller lets the PM mark an inquiry
under review; the separate invitation controller then issues an invitation tied
to an internal reference to the original private contact.
It does not store the email in the invitation, send mail, or create an account.
The activation check re-reads that same contact and compares it to the verified
identity. The route is not mounted because there is still no durable adapter;
there is also no resend/revoke UI, email worker, or provider integration. See backend
`docs/client-ticketing/application-invitation-layer.md`.

The full Plan 3 feature remains incomplete. Next: continue the isolated API
contracts and remaining client/PM account and ticket flows; do not expose a
route against placeholder identity or process-memory storage. Supabase stays
deferred to the last integration phase, along with hosted auth/email and the
full scope/review/execution/document/release gates.

### Authenticated creation adapter checkpoint — 8 October 2026

The backend now has `PostgresTicketCreationStore` in the existing store layer.
It uses current client-session/service-grant checks, workspace and service write
modes, an absent-key advisory lock, exact ticket grants, private request
preferences, minimal audit/outbox records, and the dedicated
`ticket_creation_operations` table. Creation recovery and ordinary command-ID
collision checks use that same logical operation identity without writing a
`create` row into `ticket_operation_receipts` (whose deployed constraint rejects
that kind). Project choices use a deterministic opaque selector; every use still
rechecks the current client-visible row and never grants project/repository access.

The adapter was exercised against the checked-in baseline and ticket schema in
local PGlite: **5 adapter tests passed**, covering create/replay, authorized
detail, preference privacy, revoked access, write-off recovery and rollback.
This did not connect to either Supabase project, mount a route, or make client
login or email operational. Client activation/session persistence and matching
workspace/intake-context adapters are still required before API composition.

Sequencing update after the adapter checkpoint: continue with frontend and
backend application/transport work first. Do not expand or connect this adapter,
alter any schema, or contact a Supabase project before Phase 5.

The backend now defines a separate provider-neutral client-session exchange,
hash-only revocable cookie/CSRF persistence contract, exact-origin cloud-only
transport, and logout/session inspection. It is not wired to a provider, durable
store, frontend sign-in, or mounted route. This does not alter the GitHub-based
internal login. See backend
`docs/client-ticketing/application-client-session-layer.md`.

The anonymous inquiry transport now has a separate same-origin browser client
in `src/features/ticketing/publicIntakeApi.ts`. It omits cookies and internal
desktop tokens, keeps the server-issued acknowledgement allowlist, and tells a
caller to retain the same operation ID after an uncertain result. The local
preview form does not call it; no inquiry is sent until the real proof provider,
durable store and narrow public route are configured.

The PM API composition gap is also now addressed locally: a PM message controller
supports public replies and private notes, and an injected route factory composes
the queue, detail, note, conversation, command/recovery, and invitation endpoints
for the single PM Tickets namespace. It remains unmounted and has no durable
store/provider adapter. The existing app now mounts a PM-only Tickets view that
consumes the typed transport, distinguishes a normal client update from a
request-for-details workflow action, and offers cursor-based queue/conversation
loading. See backend
`docs/client-ticketing/application-pm-api-layer.md`. Typecheck passed; no tests
were added or run for this checkpoint.

The PM browser/desktop transport now exists in `src/features/ticketing/pmApi.ts`.
It uses a restricted `/tickets` request in the existing `apiService`, retaining
the active workspace, internal session and desktop-to-cloud relay. Public
replies, notes and commands reconcile uncertain writes by the same operation ID;
private-note transport is separate from public messages. The PM Tickets page now
consumes this transport, but the backend endpoints remain unmounted; therefore
the page cannot yet load or change real tickets. Frontend typecheck passed; no
tests were run.

The PM detail now also includes a scope-proposal form, connected to the
provider-neutral `POST /api/tickets/:ticketId/scopes` contract. It keeps the
client-facing summary separate from the internal developer brief and permits
proposal only before work authorization, for an active client ticket grant.
Backend workflow rules now require extra scope after authorization to use a
linked ticket, preserving the existing project/Issue work instead of silently
resetting its authorization. The scope route/store remain unmounted and
unpersisted, so this is not yet live functionality. Frontend/backend typechecks
and the frontend production build passed; no tests were run.

### Verification checkpoint — 8 October 2026

The client browser transport now has tests for secure-origin refusal,
same-origin/no-store requests, CSRF enforcement, no internal desktop bearer
headers, and same-operation recovery after an uncertain reply. The PM transport
tests cover opaque path-ID encoding, invitation requests with no caller-supplied
recipient/role fields, and reconciliation before replaying a reply.

| Check | Result |
| --- | --- |
| Backend regression | 127 files / 2,125 tests passed. |
| Frontend regression | 14 files / 114 tests passed. |
| Backend and frontend typechecks | Passed. |
| Vitest worker compatibility | Test-only `preserveSymlinks` settings avoid a restricted-Windows worker `EPERM`; production FE Vite config is unchanged. |

The test run uses cleared hosted credentials and isolated local fixtures. It did
not write to staging/live Supabase, mount ticket routes, send invitations/email,
or make ticket data live. The one regression surfaced was an outdated test
expectation for a legacy PM scope with no developer brief; the projection
correctly returns `developerBrief: null`, and the assertion now reflects that
contract. Next work remains the atomic project/Issue binding and execution gate;
those must be implemented before any PM action can start developer work.

### PM work handoff checkpoint — 8 October 2026

The one-page Tickets detail now offers **Link agreed work** after client scope
agreement. `PmWorkHandoffForm.tsx` and `pmWorkHandoff.ts` remain under the existing
`src/features/ticketing` folder. They reuse the current workspace Projects/Issues
APIs, retain only selection labels, exclude started/unassigned Issues, clear Issue
selection when the project changes, and require acknowledgement before sending
the existing `authorize_work` command. The backend must independently recheck all
eligibility and tenant evidence. No agent starts from this form.

Missing work uses the current Project/Issue creation/assignment screens; there is
no second task system or multi-request pseudo-atomic creation flow. New backend
transaction behavior records the exact private work links with authorization,
audit/outbox and operation outcome, or rolls all of them back.

This is still application-only: ticket endpoints remain unmounted, the durable
adapter and execution gate are missing, and no real ticket handoff is enabled.
Supabase, email, real auth, documents and previews remain deferred. See backend
`docs/client-ticketing/application-work-handoff.md` for the integration gates.

### Review/correction checkpoint — 8 October 2026

PMs can now select only affected review/done Issues from the existing ticket
manifest and write explicit developer instructions on Tickets. Both PM review
failures and client correction triage send the appropriate existing command,
with stable operation/version recovery. Closure is separately confirmed and
offered only for an accepted current delivery; no project completion is implied.
These controls remain dependent on the unmounted durable backend, not local state.

Public/private message drafts are separate, switching tickets clears both, and
recovering a correction no longer clears an unrelated conversation/private draft.
Detail/forms have an accessible vertical scroll region. New UI code and tests
stay in `src/features/ticketing`, with optional browser checks in `scripts`.
See backend `docs/client-ticketing/application-review-corrections.md` for exact
revision/store and developer-context obligations. At this earlier checkpoint,
inspection and acceptance remained disabled; the checkpoint below supersedes that UI limitation.

### Protected delivery checkpoint — 8 October 2026

Ticket Detail now requests only the exact shared delivery's protected file list.
`ClientDeliveryFiles.tsx` and `clientDelivery.ts` validate its scope, allowlisted
metadata, bounded binary size and SHA-256 fingerprint before creating a download.
The isolated client transport retains same-origin cookies/no-store/no-redirect
behavior and never sends internal desktop tokens. The server returns attachments,
not executable previews or storage links. Failed/unshared/changed/revoked content
cannot be downloaded through the boundary. Requests are cancelled on view exit.

This is not live storage: the dependency-injected backend factory requires a
durable manifest store and private object reader, and remains unmounted. Real
storage/scanning, result registration, PM technical assessment, authenticated web
previews and durable client acceptance/correction integration remain outstanding.
The UI gives an unavailable state instead of inventing file contents. No Supabase
or environment changes, real email, desktop changes, branch/commit/push or release.

Verification: backend 129 files / 2,267 tests; frontend 17 files / 202 tests;
typechecks and frontend production build passed. The optional isolated browser
rehearsal passed valid download, corrupt-content refusal, revoked-access refusal,
scope mismatch and mobile layout with zero real API requests/page errors. The
desktop/mobile captures were inspected. See backend
`docs/client-ticketing/application-delivery-read-layer.md` for integration gates.

### Result review and compatibility checkpoint — 8 October 2026

PMs can inspect an already-assessed protected result on Tickets, acknowledge review,
and explicitly share its exact delivery. Clients must download verified current
content and acknowledge review before accepting or submitting agreed-work feedback.
Feedback stays on the same ticket; extra work uses a linked ticket. Acceptance
does not close the ticket or complete the project: the PM closes it separately.
Stable operation recovery handles uncertain writes without creating a second decision.
These API-backed controls are not the temporary local-preview scene selector.

PM content uses bounded base64 JSON over the existing desktop cloud relay; the
client retains its separate same-origin binary download transport. No storage URL
or internal project access is granted. Real result registration/technical assessment,
durable storage/scanning, provider identity, execution gates and route mounting
remain deferred. Nothing here enables a real service or automatically starts work.

Compatibility is a release gate, not an assumption: preserve existing login,
workspace permissions, Projects, Issues, runner behavior and deployments. The new
ticket helper now accepts the queue's query string and rejects namespace traversal.
Tests retain existing project transport, workspace-refusal handling, navigation
destinations, sidebar ordering and landing pages. The existing PM/admin sidebar
omission of Specifications is recorded as baseline behavior, not silently changed.

Verification: backend 130 files / 2,279 tests; frontend 20 files / 246 tests;
typechecks and frontend production build passed (existing chunk-size advisory).
An isolated browser rehearsal passed PM inspection/sharing, client acceptance,
lost-response recovery, explicit PM closure, same-ticket correction and mobile
overflow checks, with zero real API requests or page errors. Three captures were
visually inspected. No Supabase/env/desktop/deployment changes were made.
Real staging compatibility and tenant/security acceptance remain mandatory before
enabling any ticket endpoint; local tests cannot guarantee absence of regressions.

### Technical readiness checkpoint — 8 October 2026

The backend now has an isolated transaction service for the existing technical
completion decision. It requires verified completion authority and the complete
current reviewed Issue manifest, atomically records readiness for PM assessment,
deduplicates late completion events, and recovers uncertain commits by the same
operation ID. A corrected revision can become ready after fresh review. It does
not register/share a result, close the ticket, or automatically start work.

The service is not connected to real runner events and no endpoint was mounted.
The durable store, event dispatcher and actual execution/release safeguards are
still required. This closes an application-service gap, not the live integration.
Backend verification: 131 files / 2,330 tests; typecheck passed. No frontend runtime
changes this checkpoint; its previous 246-test/build baseline was not rerun.
Supabase stays last and untouched. See backend
`docs/client-ticketing/application-technical-readiness-layer.md`.

### Prepared-result assessment checkpoint — 8 October 2026

The existing PM Tickets detail now lists protected prepared results, requires
inspection of every candidate file and acknowledgement, then sends an explicit
assessment command. This approves the result for sharing; it does not publish it.
The existing separate sharing and client acceptance/correction/closure flow remains.
Uncertain assessment responses reconcile the original operation instead of
creating another command. No result is seeded into the actual app.

The backend now has immutable registration and PM candidate inspection services.
Assessment rechecks the registered bundle, current completed/reviewed Issue
revisions, committed technical readiness and clean scan evidence in the command
transaction. Protected reads reauthorize after reading verified bounded bytes.
These are application contracts, not a real scanner or persistence adapter.

Verification: backend **134 files / 2,410 tests**, frontend **21 files / 257 tests**;
both typechecks and the frontend production build passed. The existing chunk-size
advisory remains. The isolated real-component browser rehearsal passed corrupt-file
refusal, all-file inspection, lost-assessment recovery, separate sharing, client
review/correction, explicit closure and mobile overflow checks, with zero real API
requests or page errors. PM desktop/mobile captures were visually inspected.

Ticket backend factories remain unmounted. Real artifact verification, durable
adapters, provider identity, intake documents, execution/release guards and staging
acceptance are still required. No Supabase/env/desktop changes, real email,
deployment, branch, commit or push. Supabase remains last. See backend
`docs/client-ticketing/application-delivery-registration-assessment.md`.

### Execution admission checkpoint — 8 October 2026

Backend application work now reserves exact approved Issue revisions and rechecks
live ticket authority when queued work is admitted. Duplicate agent/squad claims
and stale queued work are refused by this isolated service. A developer-context
bug was also fixed: ordinary client/PM conversation must not revoke agreed work
merely by changing the ticket's next-action label. Holds and withdrawal still block.

The service is not wired to existing runners; no real execution path has changed.
Durable claim/dispatch/cancellation/recovery and release safeguards remain required.
No additional PM page or frontend runtime change. No hosted integration was
performed at that checkpoint. Supabase remains in its planned later phase. See
backend `docs/client-ticketing/application-execution-admission.md`.

Verification for this backend-only checkpoint: **135 files / 2,482 tests passed**
and typecheck passed. The first restricted Windows run hit existing loopback and
temporary fixture permission errors; the permitted full rerun passed. Frontend
runtime/build inputs are unchanged, so no new FE test/build result is claimed.

### Existing runner queue-lifetime checkpoint — 8 October 2026

Reviewing real execution paths uncovered an existing runner/queue boundary bug:
the checkout slot was released after spawn, while the child was still editing.
The backend now holds that slot through exit, verification and review preparation.
It also handles failed spawns without waiting forever and rechecks cancellation
after asynchronous branch preparation. Different checkouts remain parallel, and
the real sequential squad advances without a deadlock in regression tests.

This changes actual local backend runner code, not just a ticket contract. It does
not wire the ticket admission service, enable client access, alter the frontend
or update the installed desktop executable. Supabase and environment remain
untouched. See backend `docs/client-ticketing/application-runner-queue-lifetime.md`.

Backend verification: **136 files / 2,498 tests passed**, typecheck and whitespace
checks passed. The 13 new runner-lifetime tests exercise actual RunnerService and
WorkspaceQueue together with isolated external-effect doubles. No new frontend
runtime or build changes; prior FE checks were not rerun for this backend-only fix.

### PM Tickets detail error-state fix — 8 October 2026

A private-note history read failure was incorrectly promoted to the whole ticket
detail error state, hiding a ticket that had already loaded successfully. Initial
conversation loading had the same coupling. Ticket detail now loads independently;
both history errors stay inside the history panel, while the ticket remains visible.
The isolated PM browser rehearsal now includes both failure cases.

Verification: frontend **21 files / 258 tests**, typecheck and production build
passed. The build retains its existing large-chunk advisory. The added browser
failure scenario was not executed in this environment because a Playwright runtime
is unavailable; it remains an additional manual/CI verification item. A paired
frontend create-request transport test and backend client API boundary tests now
pin the `/api/client/tickets` contract, intake context, cookie/CSRF check, origin
refusal, and safe field projections using injected local test services only.
Backend verification: **141 files / 2,515 tests**, typecheck and build passed.
No ticket persistence, Supabase, environment, email, deployment, branch, commit or
push work was performed. Phase 2 remains in progress.

### Client create recovery and visibility — 8 October 2026

After a successful client submission, the portal now returns to the unfiltered
ticket list and clears the prior search. This prevents a new request from seeming
to disappear when it was submitted from History or while a search was active.
The isolated client API test also covers an uncertain create response: it looks
up the exact operation using the same intake context and operation ID rather than
creating a second request. Backend persistence and routes remain unmounted, so
this verifies the frontend contract only.

Verification: frontend **21 files / 259 tests passed**, typecheck passed, and the
production build succeeded after running outside the sandbox because Vite's
native Windows `realpath` call was denied inside it. The build retains the
existing large-chunk advisory for the internal app bundle. No database or
hosted-service work was performed. Phase 2 remains in progress.

### Client API fail-closed boundary — 8 October 2026

The backend now mounts an explicit `/api/client` unavailable boundary before
Alpha's local-token, workspace, and GitHub-session middleware. Until the durable
client application is ready, every client API request receives a fixed 503
response with private/no-store and browser-safety headers. It does not relay to
the desktop/cloud PM path, access ticket persistence, or reveal internal auth
details. Client routes and ticket execution remain disabled; this is not client
feature enablement.

Verification: backend **142 files / 2,518 tests passed**, typecheck and build
passed. The restricted run could not reach test-only loopback servers, so the
full suite was rerun with local test-server access; GitHub test cases used their
local doubles. No GitHub App settings, credentials, permissions, OAuth setup,
Supabase, environment files, email delivery, desktop app, deployment, branch,
commit, or push were changed. Phase 2 remains the only active phase. This single
fail-closed boundary is an early Phase 3 precaution, not Phase 3 completion.
The test suite run is a Phase 2 quality gate, not formal Phase 4 acceptance.
