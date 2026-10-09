# Phase 2 of 9: frontend release handoff

Changes live in this existing repository on
`feat/client-ticketing-phase-2-release`, not a separate prototype/worktree.

The PM Tickets page uses Alpha's existing sidebar, authentication, workspace and
API transport. It loads persisted queue/detail data and exposes only Phase 2
triage: mark under review, private note and decline with a required reason.
Later client-account, conversation, Issue/execution and delivery actions remain
unavailable on this production page.

The actual public inquiry page fetches only the enabled flag and public site key,
requires a provider proof and required email, submits anonymously through the
existing same-origin API proxy and displays a generic receipt. It preserves an
operation ID across retries and resets verification after an attempt.
There is no new development proxy, simulated email or document adapter in this
branch. Existing Phase 1 sample modules are not a production data fallback.

The backend companion document `docs/client-ticketing/phase-2-release-handoff.md`
defines schema history, authorization boundaries and rollout requirements.

## User-controlled workflow

1. Run automated typecheck, regressions and production build in this repository.
2. Push the Phase 2 branch for the user to create/review the PR.
3. Do not merge, publish or bump a desktop version without explicit instruction.
4. Hosted backend functionality must be released before desktop acceptance.
5. Review the PM interface in the next approved installed desktop update.
6. Real inquiry submission is a browser feature and needs an approved hosted
   client page with its origin in the backend allowlist. No local app test is planned.

Frontend CI uses `VITE_API_URL=/api` for regression tests and production builds.
On 9 October 2026, typecheck, production build and **25 files / 287 tests** passed
in this existing repository. The companion backend passed **151 files / 2,575
tests**. The historical schema audit still requires migration-source/history
review; real provider credentials and installed-update acceptance remain release
gates. No localhost browser/application test or desktop publication was performed.

Provider secrets belong only on the backend. No existing GitHub App, database,
desktop public setting or login behavior is changed by this frontend PR.
