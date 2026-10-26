# AGENTS.md — cardinal-panel

This is the entry point for AI agents and new maintainers. It is a map, not an
encyclopedia. Read only what the task needs, then verify against code and tests.

## First 10 minutes

1. `git status --short --branch` and `git log -5 --oneline` — never overwrite
   work you did not create.
2. Read this file, then [`docs/ai/context-map.md`](docs/ai/context-map.md).
3. Read the nearest local `AGENTS.md` for the area you will edit.
4. Read the one relevant architecture document, not all of them.
5. Check [`docs/status/known-issues.md`](docs/status/known-issues.md) before
   trusting older docs or the README.
6. Open the smallest set of source files that can prove or disprove the task.

## What this repository is

`cardinal-panel` is the web control panel for game servers that run on
[cardinal](https://github.com/animesao/cardinal) through
[cardinal-wings](https://github.com/animesao/cardinal-wings). It is a Nuxt 4
application with a Nitro server API, not a container runtime and not a daemon.
It stores users, nodes, servers, allocations, backups, databases, schedules, and
settings; every container action is forwarded to a wings node over HTTP.

Facts to keep in mind:

- One Node.js process serves both the SPA (`app/`) and the API (`server/api/`).
  `nuxt.config.ts` sets `srcDir: 'app/'`, so page code lives in `app/`, not
  `pages/`.
- The default database is a local SQLite file (`DB_DIALECT=sqlite`,
  `SQLITE_PATH=./data/panel.sqlite`) through the built-in `node:sqlite` and
  Drizzle's `sqlite-proxy`. MySQL is an opt-in alternative
  (`DB_DIALECT=mysql`). `server/db/schema.ts` builds the same logical schema for
  both dialects; `server/db/dialect.ts` is the single source of truth for the
  choice.
- The panel is stateful on the filesystem: the SQLite file (plus `-wal`/`-shm`)
  is the source of truth for everything except wings state. There is no Redis,
  no queue, and no background worker other than an in-process scheduler tick
  (`server/plugins/scheduler.ts`).
- Authentication has two independent surfaces: a NextAuth JWT session for the
  browser (`@sidebase/nuxt-auth`, `getServerSession`) and `Authorization:
  Bearer cp_*` API keys for automation. Several routes accept both; admin routes
  accept both but re-check the role from the database.
- The panel talks to wings with the node token from `nodes.token`
  (`server/utils/wings.ts`). Browser WebSocket/download/upload flows get a
  short-lived HS256 JWT signed with the same node token (`mintWingsJwt`), so
  wings can verify it without a panel session.
- Node URLs are validated against an SSRF policy (`server/utils/node-url.ts`):
  public addresses pass, private ones require `NODE_TRUSTED_CIDRS`, cloud
  metadata addresses are always blocked, and redirects to wings are never
  followed (`wingsFetch` uses `redirect: 'manual'`).
- The version lives in `VERSION` and is mirrored into `package.json` by
  `npm run release:version`. CI fails when they disagree. The release workflow
  also requires the tag `vX.Y.Z` to equal `VERSION`.
- The user-facing documentation in `docs/` and `README.md` is **Russian**. The
  agent-facing documents (`AGENTS.md`, `docs/ai/`, `docs/architecture/`,
  `docs/status/`, `docs/work/`) are **English**. Keep that split.
- Tests are Vitest unit tests (`tests/unit/`) and Playwright e2e tests against a
  built panel (`tests/e2e/`). There is no test that starts real containers; that
  belongs to cardinal/wings.

## Source-of-truth order

When documents disagree, trust this order:

1. Runtime behavior: code and tests.
2. Public contracts: hooks in `server/api/**`, response shapes consumed by
   `app/**`, `server/db/schema.ts` column names, `docs/API.md`, and the
   `/api/v1/*` surface.
3. Build and release: `package.json`, `VERSION`,
   `.github/workflows/*.yml`, `scripts/*.mjs`, `install.sh`.
4. `README.md` and `docs/*.md` (Russian, user-facing).
5. `TODO.md`, `TODO-SECURITY.md`, and `CHANGELOG.md` history — intent and past
   state, not proof of current behavior.

If you find drift, record it in `docs/status/known-issues.md`; do not silently
rewrite history or invent a rationale.

## Context routing

| If the task is about… | Read first | Then |
|---|---|---|
| App shell, pages, middleware, i18n, UI components | [`app/AGENTS.md`](app/AGENTS.md) | `app/middleware/`, `app/pages/`, `nuxt.config.ts` |
| HTTP routes, auth callbacks, request/response shapes | [`server/api/AGENTS.md`](server/api/AGENTS.md) | [`docs/architecture/api-and-auth.md`](docs/architecture/api-and-auth.md), the matching handler |
| wings client, server permissions, SFTP, console tokens | [`server/utils/AGENTS.md`](server/utils/AGENTS.md) | `server/utils/wings.ts`, [`docs/architecture/runtime.md`](docs/architecture/runtime.md) |
| Database dialect, schema, migrations, provisioning | [`server/db/AGENTS.md`](server/db/AGENTS.md) | [`docs/architecture/state-and-storage.md`](docs/architecture/state-and-storage.md), `server/db/schema.ts` |
| Security, 2FA, API keys, rate limits, SSRF, secrets at rest | [`docs/architecture/security.md`](docs/architecture/security.md) | `server/utils/apikey-auth.ts`, `server/utils/node-url.ts`, `server/utils/totp.ts`, `server/middleware/` |
| Installer, Docker, systemd, upgrade | [`docs/architecture/build-and-release.md`](docs/architecture/build-and-release.md) | `install.sh`, `Dockerfile`, `docker-compose.yml`, `docs/INSTALL.md`, `docs/UPGRADE.md` |
| CI, versioning, packaging, release | [`docs/architecture/build-and-release.md`](docs/architecture/build-and-release.md) | [`.github/workflows/build.yml`](.github/workflows/build.yml), `scripts/package-release.mjs` |
| Unit or e2e tests | `tests/unit/`, `tests/e2e/` | `vitest.config.ts`, `playwright.config.ts`, [`scripts/AGENTS.md`](scripts/AGENTS.md) |
| Large multi-step work | [`docs/work/README.md`](docs/work/README.md) | copy `task.md` and `handoff.md` templates |

Do not read the whole `server/api/` tree to answer one question. There are ~140
route files; start from the URL, open that file, then follow one utility.

## Non-negotiables

- Do not weaken a security control to make a test, demo, or UI flow pass. In
  particular: fresh-role checks (`requireAdmin`, `requireServer`), the
  `KEY_POLICY` allowlist, `needPerm`/`needKeyWrite`, login and TOTP throttles,
  trusted-proxy IP resolution, the node-URL SSRF barrier, `redirect: 'manual'`
  in `wingsFetch`, archive path checks, and node-token comparison.
- Admin routes require an admin both in `server/middleware/admin.ts` and in the
  handler. Do not remove the handler check "because middleware covers it"; the
  duplication is deliberate.
- 2FA is enforced for every login method. An OAuth login for a 2FA-enabled
  account is rejected (`/login?error=TwoFactorRequired`); it must not fall back
  to a password-less session.
- New API routes must decide explicitly whether they accept a session, an API
  key, or both, and must declare the key resource in `KEY_POLICY` when they do.
- Do not rename database columns, table names, or JSON fields consumed by
  `app/**` without checking the UI, `/api/v1/*`, and both language docs. The
  schema is the contract.
- Secrets live in `.env` / `/etc/cardinal-panel/panel.env` or in the `settings`
  table where the code seals them. Never commit a real `NEXTAUTH_SECRET`, node
  token, API key, OAuth client secret, or password. Examples use placeholders.
- Plaintext-at-rest is a known, documented risk (node tokens, SFTP passwords,
  database passwords). Do not claim it is encrypted.
- Do not run `git reset --hard`, `git clean`, force-push, or delete branches
  without explicit user permission.
- Do not claim a test, lint, typecheck, build, or e2e passed unless you ran it
  and saw the result. On Windows, a successful `npm run build` is not runtime
  verification of a Linux install or of wings integration.

## Verification matrix

Run the narrowest check that can falsify the change, then the repository gates.

| Change | Minimum verification |
|---|---|
| Server route or utility | `npm run lint`, `npm run typecheck`, `npm test` |
| Auth, API keys, 2FA, rate limits | Above + `npm test` (the unit suite covers `password`, `ratelimit`, `apikey`, `oauth-seal`, `clientip`, `node-url`) and a manual login flow |
| Database schema or dialect | `npm run db:check` (with the target dialect) + `npm test`; state which dialect you actually ran |
| UI page or component | `npm run typecheck`, `npm run build`, and the e2e suite or a manual browser check |
| Installer / Docker | `npm run lint:shell` (shellcheck) and `node tests/install/run.sh` on Linux; not available on a plain Windows host |
| Docs only | relative links resolve; `npm run check:secrets`; no version change unless it is a release |
| Release | `VERSION` == `package.json`; `npm run release:version -- --check`; tag `vX.Y.Z` == `VERSION`; build + e2e green |

Repository gates from [`CONTRIBUTING.md`](CONTRIBUTING.md):

```sh
npm run lint          # server import hygiene
npm run check:secrets # no secrets in tracked files
npm run typecheck
npm test
npm run build
npm run test:e2e      # Playwright, needs a browser
npm run lint:shell    # shellcheck for install.sh
```

`npm run release:version -- --check` is a separate CI gate; run it before
tagging. On a Windows host without `bash`/WSL, say explicitly which Linux-only
checks (install simulation, shellcheck, container run) were not executed.

## Fact status labels

Use these labels in plans, status files, and handoffs:

- `Implemented` — code exists and a test or runtime check proves it.
- `Partial` — code exists but a known gap remains.
- `Planned` — accepted intent, no working implementation.
- `Deprecated` — still present but should not be used for new work.
- `Unknown` — not verified; say so instead of guessing.

Every non-obvious claim should point to a file, test, command, or commit.

## Change protocol

1. State the goal, scope, and non-goals in a task file for multi-step work
   (see [`docs/work/`](docs/work/README.md)).
2. Make the smallest change that satisfies the goal.
3. Update tests with behavior changes. A security fix needs a test that fails
   before it and passes after it.
4. Update the Russian user docs when a user-visible behavior changes; keep the
   English agent docs factual.
5. Update the relevant architecture doc only if durable behavior changed.
6. Add or close an entry in `docs/status/known-issues.md` when you discover or
   fix drift.
7. Write a handoff with exact commands and results, including failures.

## Context maintenance

Add a new architecture document only when a subsystem cannot be understood from
an existing one. Add a local `AGENTS.md` only where a future agent would
otherwise repeat a costly mistake. Keep this file short; move detail down the
tree.
