# Context map

This file is the routing layer between the root [`AGENTS.md`](../../AGENTS.md)
and the rest of the repository. Its job is to keep an agent's context small and
correct: read one routing row, open the smallest set of files that can prove or
disprove the task, and stop.

It is not a tutorial and it is not a second copy of the architecture docs.

## Context tiers

| Tier | Read | When |
|---|---|---|
| 0 | [`AGENTS.md`](../../AGENTS.md) | Always. It contains the non-negotiables and the verification matrix. |
| 1 | This map + one local `AGENTS.md` | Before the first edit in an area. |
| 2 | One architecture document + [`status/known-issues.md`](../status/known-issues.md) | Before trusting older docs or changing a contract. |
| 3 | Source files and tests that the task touches | Before editing. Code wins over every document. |
| 4 | `git log` / `git blame` | Only when the question is "why is it like this and no doc says". |

## Routing

| Task | Open first | Then (only if needed) |
|---|---|---|
| Add a Nitro route | `server/api/<area>/<name>.<method>.ts` | `server/api/AGENTS.md`, `docs/API.md`, `server/utils/admin.ts` or `server/utils/wings.ts` |
| Change a response shape consumed by the UI | The route + the page that fetches it | `app/composables/`, `app/pages/`, `npm run typecheck` |
| Login, session, OAuth, 2FA | `server/api/auth/[...].ts` | `server/utils/{totp,oauth-seal,settings,password}.ts`, `docs/architecture/security.md` |
| API keys or `KEY_POLICY` | `server/utils/apikey-auth.ts` | `server/utils/apikeys.ts`, `server/utils/admin.ts`, `server/utils/wings.ts` (`needPerm`) |
| Rate limiting or client IP | `server/utils/ratelimit.ts`, `server/utils/clientip.ts` | `server/middleware/auth-ratelimit.ts`, `tests/unit/{ratelimit,clientip}.test.ts` |
| Server power, files, backups, databases, console | `server/utils/wings.ts` + the route under `server/api/servers/[id]/` | `docs/architecture/runtime.md`, the matching wings endpoint |
| Node registration or SSRF | `server/api/admin/nodes/index.post.ts`, `server/utils/node-url.ts` | `server/utils/cidr.ts`, `tests/unit/node-url.test.ts` |
| Subusers and per-server permissions | `server/utils/wings.ts` (`requireServer`, `needPerm`, `SUBUSER_PERMISSIONS`) | `server/api/servers/[id]/users/*`, `server/db/schema.ts` (`server_users`) |
| Database dialect, schema, migrations | `server/db/dialect.ts`, `server/db/schema.ts` | `server/db/index.ts`, `server/db/migrations/`, `scripts/migrate-sqlite.mjs` |
| Scheduler | `server/plugins/scheduler.ts`, `server/utils/schedules.ts` | `server/api/servers/[id]/schedules/` |
| Health endpoint or disk state | `server/api/health.get.ts`, `server/utils/disk.ts` | `tests/unit/disk.test.ts` |
| UI page, layout, middleware, i18n | `app/` local `AGENTS.md` | `app/pages/`, `app/middleware/`, `app/composables/`, `i18n/` |
| Installer, Docker, systemd | `install.sh`, `Dockerfile`, `docker-compose.yml` | `docs/INSTALL.md`, `docs/architecture/build-and-release.md` |
| CI, versioning, packaging | `package.json`, `VERSION`, `.github/workflows/` | `scripts/sync-version.mjs`, `scripts/package-release.mjs`, `CHANGELOG.md` |
| Unit tests | `tests/unit/`, `vitest.config.ts` | the module under test |
| E2E | `tests/e2e/panel.spec.ts`, `playwright.config.ts` | `scripts/e2e-server.mjs` |

## Context budget

- Root `AGENTS.md` + this map: read fully, always.
- One architecture document: read fully.
- `docs/API.md`: grep the section; it is a usage reference, not a complete
  route list. There are more routes in `server/api/**` than in the page.
- `server/api/**`: ~140 files. Never "read the API tree". Start from the URL,
  open that one file, then one utility.
- `server/utils/wings.ts` is ~600 lines and is the most-used module. Grep for
  the function name returned by the route.
- `server/db/schema.ts` defines every table twice (SQLite and MySQL branches).
  Read the branch selected by `IS_SQLITE`, then check the other for drift.
- Tests are the cheapest evidence: `tests/unit/{password,ratelimit,apikey,
  clientip,node-url,oauth-seal,disk,pagination}.test.ts` encode most invariants.
- `CHANGELOG.md` is long. Read the top entries for recent behavior; do not treat
  old entries as current documentation.

## Fast facts

| Question | Answer | Evidence |
|---|---|---|
| Where does the app start? | `nuxt build` produces `.output/`; Nitro serves the SPA and `server/api/**` | `package.json`, `nuxt.config.ts` |
| Where is the page source? | `app/` (`srcDir: 'app/'`) | `nuxt.config.ts` |
| Default database? | SQLite file `./data/panel.sqlite` via `node:sqlite`, WAL + foreign keys on | `server/db/dialect.ts`, `server/db/index.ts` |
| How is MySQL selected? | `DB_DIALECT=mysql` plus `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` | `server/db/index.ts`, `.env.example` |
| How does the browser authenticate? | NextAuth JWT session; `getServerSession(event)` | `server/api/auth/[...].ts`, `nuxt.config.ts` |
| How does automation authenticate? | `Authorization: Bearer cp_...`; SHA-256 hash in `api_keys`, per-resource levels, `KEY_POLICY` allowlist | `server/utils/apikey-auth.ts`, `server/utils/apikeys.ts` |
| How is an admin checked? | Fresh role from `users` in `requireAdmin`; middleware is a second gate | `server/utils/admin.ts`, `server/middleware/admin.ts` |
| How is a server checked? | `requireServer` resolves admin/owner/member and then `needPerm` checks one permission | `server/utils/wings.ts` |
| How does the panel reach wings? | `wingsFetch(node, path)` with `Bearer <nodes.token>` and `redirect: 'manual'` | `server/utils/wings.ts` |
| How does the browser reach wings? | 10-minute HS256 JWT signed with the node token (`mintWingsJwt`) | `server/utils/wings.ts` |
| Where do wings call the panel? | `/api/remote/autostart`, `/api/remote/backups/{uuid}`, `/api/remote/sftp/auth`; node token in `Authorization` | `server/api/remote/**` |
| What limits logins? | 10 attempts / 15 min per e-mail; 30 / 60 s per socket IP; 5 TOTP attempts / 5 min | `server/api/auth/[...].ts`, `server/middleware/auth-ratelimit.ts` |
| Where is the scheduler? | Nitro plugin, one tick every 60 s, batches of 25 due schedules | `server/plugins/scheduler.ts` |
| How is the version bumped? | Edit `VERSION`, then `npm run release:version` writes `package.json` | `scripts/sync-version.mjs` |
| What gates a release? | Tag `vX.Y.Z` equals `VERSION`; build, unit, e2e, package jobs green | `.github/workflows/release.yml`, `build.yml` |
| Where is state on disk? | `/var/lib/cardinal-panel/panel.sqlite` for systemd; `/app/data` in the container; `./data` for dev | `install.sh`, `docker-compose.yml`, `server/db/dialect.ts` |

## Do not trust without checking

The following claims exist in older docs and are either imprecise or wrong.
Each has an entry in [`status/known-issues.md`](../status/known-issues.md):

- "The stack is Nuxt 4 + MySQL" — SQLite is the default; MySQL is opt-in.
- "OAuth logins skip 2FA" — a 2FA-enabled account is rejected on OAuth login and
  must use e-mail + password.
- "Backup codes are bcrypt" — they are unsalted SHA-256 of a high-entropy code.
- "Database user passwords are scrypt" — the panel does not store database user
  passwords hashed; provisioned database passwords are random plaintext.
- "The panel has no per-server access separation" — subusers and
  `server_users.permissions` exist and are enforced by `needPerm`.
- "The installer requires 128 MiB free" — the default is 256 MiB.
- "API paths are `/v1/...`" — the mounted prefix is `/api/v1/...`.
- "The session cookie is `kt_panel_session`" — no code sets that name; NextAuth
  uses its own cookie.
- "`docker-compose.yml` builds the current version" — its build arg/image tag
  are stale and must be checked against `VERSION`.

## Where to record new knowledge

- New verified drift or a security gap: `docs/status/known-issues.md`.
- A durable design decision: a short note in the relevant architecture document
  under "Decisions"; this repo has no ADR directory.
- Multi-step work: `docs/work/` using the templates.
- A user-visible change: the Russian user docs, plus `CHANGELOG.md` on release.
