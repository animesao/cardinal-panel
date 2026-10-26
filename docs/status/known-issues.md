# Known issues and documentation drift

This file records places where documentation and code disagree, plus known
technical gaps. It is a register, not a roadmap. Label each item with the fact
status from the root `AGENTS.md` and point to evidence.

Last audited: 2026-10-26 against the code at `main@2b11b64`; panel version
`0.6.4`.

## Documentation drift

### K-01 — README calls MySQL the stack, SQLite is the default

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `README.md`.
- **Documents (before the fix):** `README.md` line 7 said "Nuxt 4 + MySQL
  (Drizzle)".
- **Code:** `server/db/dialect.ts` defaults `DB_DIALECT` to `sqlite`; SQLite is
  the documented default in `.env.example`, `docs/INSTALL.md`, and
  `docs/CONFIGURE.md`. MySQL is opt-in.
- **Impact:** a new operator could assume a MySQL server is required and skip
  the panel entirely, or misread the backup instructions.
- **Action:** keep the stack line as "Nuxt 4 + SQLite (MySQL optional)".

### K-02 — README and TODO say OAuth bypasses 2FA

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `README.md`; `TODO.md`
  still has a historical note.
- **Documents (before the fix):** `README.md` said "OAuth-входы … 2FA не
  касается — только credentials"; `TODO.md` said 2FA only covers the password
  form.
- **Code:** `server/api/auth/[...].ts:150-154` loads `user_totp` in the
  `signIn` callback and, when 2FA is enabled and the provider is not
  `credentials`, returns `/login?error=TwoFactorRequired`. Password login
  verifies TOTP inside `authorize` (`:245-275`).
- **Impact:** operators were told OAuth is a way around 2FA, which is the
  opposite of the enforcement. The behavior is correct; the prose was not.
- **Action:** document that a 2FA-enabled account must use e-mail + password.
  There is no TOTP prompt inside the OAuth callback.

### K-03 — SECURITY.md says backup codes are bcrypt

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `SECURITY.md`.
- **Documents (before the fix):** `SECURITY.md` said backup codes are stored as
  bcrypt hashes.
- **Code:** `server/utils/totp.ts:93-95` hashes a code with unsalted SHA-256
  after uppercasing and stripping separators. `server/api/account/2fa/enable.post.ts:33`
  stores the JSON array of those hashes.
- **Impact:** the hash choice is defensible because codes are 10 random bytes
  from a 32-character alphabet, but the document named the wrong primitive. A
  future change might "restore" bcrypt and break existing codes.
- **Action:** say SHA-256 of a high-entropy one-time code.

### K-04 — SECURITY.md claims database user passwords are scrypt

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `SECURITY.md`.
- **Documents (before the fix):** the storage table had a "Пароли БД
  пользователей | scrypt" row.
- **Code:** there is no such hash. `server/utils/databases.ts` generates a random
  24-character password and `server/api/servers/[id]/databases.post.ts` stores it
  in `server_databases.password` as text. `database_hosts.password` is also
  plaintext.
- **Impact:** an operator could believe a database dump leaks only hashes. It
  leaks working credentials.
- **Action:** list provisioned database passwords under plaintext-at-rest.

### K-05 — SECURITY.md says the panel has no per-server separation

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `SECURITY.md`.
- **Documents (before the fix):** boundary 7 and "what is not a vulnerability"
  said the panel does not separate access to servers and leaves it all to wings.
- **Code:** `server_users` stores members and a permission JSON; `requireServer`
  resolves owner/member/admin, and `needPerm` enforces one permission per
  action. `server/api/servers/[id]/users/*` manages them.
- **Impact:** the old text understated the panel's own authorization layer and
  could lead an agent to skip `needPerm`. The remaining true limitation is that
  there is no organization/project tenancy, and an admin sees everything.
- **Action:** describe subuser permissions as real; keep "no tenant boundary"
  as the actual gap.

### K-06 — SECURITY.md says the login IP limit is 30 per 10 minutes

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `SECURITY.md`.
- **Documents (before the fix):** the limits paragraph said "30 на IP за
  10 минут".
- **Code:** the active per-IP gate is `server/middleware/auth-ratelimit.ts`
  (`IP_LIMIT = 30`, `IP_WINDOW_MS = 60_000`). `server/api/auth/[...].ts` still
  declares `LOGIN_IP_MAX_ATTEMPTS`/`LOGIN_IP_WINDOW_MS` (10 minutes) but does not
  use them; the middleware is the real limit.
- **Impact:** 10× overstatement of the window. Also dead constants invite a
  future edit to "fix" a limit that is not wired.
- **Action:** document 30 per 60 s. Remove or use the dead constants in a code
  change, not a docs change.

### K-07 — README says TOTP allows 10 attempts per 5 minutes

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `README.md`.
- **Documents (before the fix):** `README.md` said "10 попыток за 5 минут".
- **Code:** `TOTP_MAX_ATTEMPTS = 5`, `TOTP_WINDOW_MS = 5 * 60 * 1000`
  (`server/api/auth/[...].ts:40-43`). The comment at `:251-253` explains why 10
  was considered too generous.
- **Impact:** doubled the stated brute-force budget.
- **Action:** document 5 per 5 minutes.

### K-08 — docs/INSTALL.md says the default `--min-free` is 128 MiB

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `docs/INSTALL.md`.
- **Documents (before the fix):** the "what the installer does" section said
  "по умолчанию 128 МиБ"; the key table on the same page correctly said 256.
- **Code:** `install.sh:94` sets `MIN_FREE_MB=256`; the script header and
  `--help` say 256.
- **Impact:** an operator sizing a small VPS gets a different answer depending on
  which paragraph they read.
- **Action:** one value, 256 MiB.

### K-09 — docs/API.md uses the wrong base path and a nonexistent cookie

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `docs/API.md`.
- **Documents (before the fix):** the Client API tables listed `/v1/...` and one
  `curl` used `http://host:3000/v1/servers`; the auth section named a
  `kt_panel_session` cookie.
- **Code:** every route is under `/api/v1/**` (`server/api/v1/...`). No code sets
  `kt_panel_session`; NextAuth uses its own session cookie name.
- **Impact:** copied examples 404. A client that tries to set the named cookie
  gets no session.
- **Action:** prefix all examples with `/api`, and do not name the session cookie
  unless it is read from the running build.

### K-10 — docs/API.md lists routes that do not exist and misses others

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `docs/API.md` for the
  known cases; the page is still not a complete route list.
- **Documents (before the fix):**
  - `PUT /api/servers/{id}/resources` — only `GET` exists; the write is
    `PUT /api/admin/servers/{id}/resources`.
  - `DELETE /api/admin/allocations/{id}/delete` — the actual routes are
    `DELETE /api/admin/allocations/[id]` and `DELETE /api/admin/allocations/batch`.
  - Several server routes (ports, schedules, activity, setup, startup, SFTP,
    reinstall, install logs, live status) were absent.
- **Code:** `server/api/**`.
- **Impact:** an integrator follows a documented route and gets 404/405, or
  assumes a feature is unsupported.
- **Action:** `server/api/**` wins. In this repository `docs/API.md` is a usage
  guide, not a generated OpenAPI. Record new omissions here instead of claiming
  completeness.

### K-11 — `.env.example` has `NUXTAUTH_URL` instead of `NEXTAUTH_URL`

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `.env.example`.
- **Documents (before the fix):** the example file defined `NUXTAUTH_URL`.
- **Code and scripts:** `install.sh`, `nuxt.config.ts` (`authSecret`),
  `scripts/e2e-server.mjs`, `tests/install/run.sh`, `SECURITY.md`, and
  `docs/CONFIGURE.md` all use `NEXTAUTH_URL`. Nothing reads `NUXTAUTH_URL`.
- **Impact:** a copy of `.env.example` leaves `NEXTAUTH_URL` unset for local
  OAuth callbacks; the typo silently does nothing.
- **Action:** `NEXTAUTH_URL`.

### K-12 — docker-compose.yml pins version 0.1.0

- **Status:** `Partial` — the Compose file is not part of the release package.
- **Documents/code:** `docker-compose.yml` sets build arg `VERSION: '0.1.0'` and
  `image: cardinal-panel:0.1.0`; `VERSION` is `0.6.4`.
- **Impact:** `docker compose build` labels the image as an old release. The
  release tarball and `install.sh` are unaffected, so this is a developer/operator
  confusion, not a broken release.
- **Action:** either derive the version from `VERSION` in a wrapper script or
  update it on each release. Do not hand-edit it in an unrelated PR.

### K-13 — docs/DEVELOPMENT.md references commands that do not exist

- **Status:** `Fixed (docs)` — corrected 2026-10-26 in `docs/DEVELOPMENT.md`.
- **Documents (before the fix):** a pre-commit example ran
  `npm run check:links 2>/dev/null`; the file table listed `scripts/gen-og.mjs`.
- **Code:** `package.json` has no `check:links` script, and `scripts/` has no
  `gen-og.mjs`.
- **Impact:** a contributor copies a command that fails, or looks for a file that
  was removed.
- **Action:** list only scripts that exist in `package.json`.

### K-14 — status_pages tables are migrated but unused

- **Status:** `Deprecated` (unused schema).
- **Code:** `server/db/schema.ts:326-370` defines `status_pages` and
  `status_page_monitors`; the SQLite and MySQL migrations create them. No route,
  page, or script reads or writes them (grep finds only the schema and the SQL).
- **Impact:** they add schema noise and can be mistaken for a working feature.
  Dropping them is a migration and needs a decision.
- **Action:** do not build on these tables without an explicit plan. Record the
  decision before removing them.

### K-15 — Stale comment in the auth callback says OAuth ignores 2FA

- **Status:** `Partial` (comment only; behavior is correct).
- **Code:** `server/api/auth/[...].ts:246` says "OAuth-входы 2FA не касается —
  только credentials", while the `signIn` callback at `:145-154` rejects OAuth
  for 2FA-enabled accounts.
- **Impact:** an agent reading only `authorize` may conclude OAuth bypasses 2FA
  and "fix" a non-bug, or document the wrong behavior.
- **Action:** fix the comment when touching that block. The behavior is the
  source of truth.

### K-16 — TODO.md has stale 2FA and OAuth parity notes

- **Status:** `Partial` (historical file).
- **Documents:** `TODO.md` describes 2FA as password-only and lists parity items
  that have since been implemented.
- **Impact:** low for users, moderate for agents that treat TODO as status.
- **Action:** treat `TODO.md` and `TODO-SECURITY.md` as dated intent. The current
  behavior is in the code and in [`architecture/security.md`](../architecture/security.md).

## Technical gaps (not documentation drift)

### G-01 — Secrets at rest are plaintext

- **Status:** `Partial`.
- **Code:** `nodes.token`, `sftp_credentials.password`, `servers.sftpPassword`,
  `users.sftpPassword`, `database_hosts.password`, `server_databases.password`
  are text columns. `user_totp.secret` and OAuth secrets are sealed; API keys,
  passwords, and backup codes are hashed.
- **Impact:** a database dump is enough to control nodes and access servers and
  databases.
- **Action:** moving these under `oauth-seal` is open work. Until then, treat the
  database as a secret and say so in docs.

### G-02 — Rate limits are in-memory and per process

- **Status:** `Partial`.
- **Code:** `server/utils/ratelimit.ts` uses module-level `Map`s; restart clears
  them. The scheduler is also a per-process interval.
- **Impact:** a multi-instance deployment does not share limits; a restart resets
  brute-force budgets.
- **Action:** keep the panel single-process, or move buckets to a shared store
  before scaling out.

### G-03 — The scheduler has no retry or persistence

- **Status:** `Partial`.
- **Code:** `server/plugins/scheduler.ts` selects due rows and calls
  `runSchedule`; failures are logged and the next run time is advanced.
- **Impact:** a failed action is silently missed until the next interval.
- **Action:** acceptable for start/stop/restart; document the limitation and do
  not use schedules for critical one-shot tasks.

### G-04 — `npm audit` can report transitive findings with no fix

- **Status:** `Partial` (accepted risk).
- **Code/CI:** `build.yml` gates only `critical` production findings; full report
  is uploaded as an artifact.
- **Impact:** high/moderate findings may remain in build tooling.
- **Action:** see `TODO-SECURITY.md` for the accepted list; do not silently
  ignore a new critical one.

### G-05 — 2FA error markers reveal a valid password

- **Status:** `Partial` (accepted risk).
- **Code:** `authorize` throws `2FA_REQUIRED` only after the password verifies,
  so an attacker learns that a password is correct without the second factor.
- **Impact:** account enumeration is limited to accounts with a known password;
  the alternative is a worse UX (the user cannot know to enter a code).
- **Action:** recorded in `TODO-SECURITY.md`. Do not change without a UX plan.

## How to use this file

- When you fix an item, change its status to `Fixed (docs)` or `Fixed` and add
  the date and the files. Do not delete the entry immediately; the history is
  useful for the next audit.
- When you find a new discrepancy, add `K-NN` with the document, the code
  pointer, the impact, and the action.
- `G-NN` is for technical gaps that are not a docs bug.
