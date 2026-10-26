# State and storage

The panel is filesystem-stateful: one database file (or one MySQL database) is
the source of truth for every panel object. This page describes where that state
lives, how it is migrated, what is stored in plaintext, and how backup/restore
works.

## Where state lives

| Deployment | Database | Configuration | Application |
|---|---|---|---|
| systemd (installer default) | `/var/lib/cardinal-panel/panel.sqlite` | `/etc/cardinal-panel/panel.env` (0600, owner `cardinal`) | `/opt/cardinal-panel` |
| Docker / Compose | `/app/data/panel.sqlite` in the `panel-data` volume | `.env` / container env | `/app` |
| cardinal container mode | `/app/data/panel.sqlite` | `/etc/cardinal-panel/cardinal.toml` (host) + panel env | `/app` |
| Development | `./data/panel.sqlite` relative to the repo | `.env` | repo root |

`DB_DIALECT` selects the engine; `SQLITE_PATH` selects the SQLite file. When
`SQLITE_PATH` is relative, it is resolved against the process working directory
(`server/db/index.ts`). The installer sets an absolute path on purpose.

The SQLite handle sets `journal_mode = WAL` and `foreign_keys = ON`. Expect
`panel.sqlite`, `panel.sqlite-wal`, and `panel.sqlite-shm`; a backup that copies
only the main file can miss recent commits or be inconsistent. Use the panel's
backup flow or `sqlite3 .backup`, not `cp` on a live file.

MySQL is opt-in: `DB_DIALECT=mysql` plus `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD`, `DB_NAME`. There is no connection pool configuration beyond the
single connection created at startup.

## Schema

`server/db/schema.ts` defines each table twice, once for SQLite and once for
MySQL, selected by `IS_SQLITE`. The logical tables:

| Table | Purpose |
|---|---|
| `users` | Panel accounts, role, password hash, locale, SFTP password |
| `locations` | Grouping for nodes |
| `nodes` | wings endpoints, token, capacity, database host |
| `blueprints` | Game templates: image, startup, variables |
| `servers` | Server records: resources, limits, status, owner, node, allocation |
| `allocations` | Port pool per node |
| `server_users` | Subusers and their permission JSON |
| `sftp_credentials` | Per-user SFTP username/password per server |
| `database_hosts` | MySQL hosts the panel provisions on |
| `server_databases` | Provisioned databases and credentials |
| `backups` | Backup metadata; bytes live on wings |
| `status_pages`, `status_page_monitors` | Reserved; see below |
| `settings` | Key/value panel settings, including sealed OAuth secrets |
| `login_history` | IP, user-agent, provider, timestamp |
| `api_keys` | Key hash, owner, resource levels |
| `server_activity` | Per-server action log (last 500 per server) |
| `schedules` | Start/stop/restart/command schedules |
| `user_totp` | Sealed TOTP secret, enabled flag, backup-code hashes |

`status_pages` and `status_page_monitors` are defined and migrated but no route
or page uses them. Treat them as unused schema, not as a feature (`K-09` in
`docs/status/known-issues.md`). Do not build on them without a decision.

## Migrations

| Dialect | Command | Mechanism |
|---|---|---|
| SQLite | `npm run db:migrate` | `scripts/migrate-sqlite.mjs` applies `server/db/migrations/sqlite/*.sql` in journal order and records tags in `__kt_migrations` |
| MySQL | `npm run db:migrate:mysql` or `npm run db:push` | Drizzle Kit against `server/db/migrations/mysql` |
| Generate | `npm run db:generate` / `npm run db:generate:mysql` | Drizzle Kit, selected dialect |
| Inspect | `npm run db:studio` | Drizzle Studio |
| Connectivity | `npm run db:check` | `scripts/check-db-connection.mjs` |

SQLite migrations are applied manually because `drizzle-kit` cannot push through
`sqlite-proxy`. Each migration runs in a transaction; a failure rolls back and
stops. The script resolves the database path from `--db`, then `SQLITE_PATH`,
then `/etc/cardinal-panel/panel.env` — this ordering exists because a previous
version migrated the repo-local file while the service used the data directory.

Rules for a schema change:

1. Edit `server/db/schema.ts` in **both** branches.
2. Generate the migration for both dialects.
3. Run the SQLite migration against a copy of a real database, not only an empty
   one.
4. Update `server/api/**`, the UI projections, and `docs/API.md` if a column is
   exposed.
5. Record destructive or asymmetric changes in `CHANGELOG.md` and
   `docs/UPGRADE.md`.

## What is stored in plaintext

The schema intentionally stores several secrets as text. See
[`security.md`](security.md) for the full table and impact. In short:
`nodes.token`, `sftp_credentials.password`, `servers.sftpPassword`,
`users.sftpPassword`, `database_hosts.password`, and
`server_databases.password` are plaintext. Password hashes, API-key hashes,
TOTP secrets (sealed), and backup-code hashes are not.

A database dump is therefore equivalent to node access plus SFTP and database
credentials. Protect it like the panel itself.

## Backups

There are two different things called "backup":

1. **Game-server backups** — created from the panel, stored on the wings node
   under its data directory, metadata in `backups`.
2. **Panel database backups** — an operator responsibility. The panel has no
   built-in dump/restore command; use `sqlite3 .backup` or `mysqldump` on a
   schedule and store the result offline.

Game-server backup lifecycle:

- `POST /api/servers/[id]/backups` inserts a row with `status = 'creating'` and
  calls wings.
- wings answers `202` and later calls `POST /api/remote/backups/{uuid}` with the
  final `completed` or `failed`.
- The UI polls while any row is `creating`; download and restore are offered
  only for `completed`.
- Restore and delete are proxied to wings. The panel does not keep the bytes.
- Creating a backup works on a stopped container; wings mounts the overlay
  on demand. That is wings behavior, not a panel fallback.

## Panel settings

`settings` is a key/value table. Values the code reads include `panel_name`,
`oauth_<provider>_enabled`, `oauth_<provider>_id`, `oauth_<provider>_secret`
(sealed), and `oauth_seeded`. `.env` OAuth values are imported once into the
database (`seedOAuthFromEnv`); after that the admin UI is authoritative. Changing
`NEXTAUTH_SECRET` makes sealed values unreadable and requires re-entering OAuth
secrets and re-enrolling 2FA.

`panel_name` is validated to 2–60 visible characters. The default is
`Cardinal Panel`.

## Activity and retention

`server_activity` keeps the last 500 rows per server; older rows are pruned by
`logActivity`. Users with `activity.read` (or owner/admin) can read it; only
owner/admin can clear it. The log records panel-mediated actions, not raw
console traffic or SFTP operations (those go browser→wings or client→wings).

`login_history` grows without an automatic prune. Plan retention at the database
level if it matters.

## Upgrade and rollback

- `VERSION` and `package.json` must match; `npm run release:version -- --check`
  is the gate.
- SQLite migrations are forward-only. There is no down migration. A rollback
  means restoring the pre-upgrade database file together with the previous
  application build.
- Before an upgrade: stop the service, back up the database (including WAL), back
  up `panel.env`, then install the new version and run migrations.
- MySQL migrations are Drizzle-managed; check `docs/UPGRADE.md` for the current
  procedure and whether a table lock is expected.

## Decisions

- **SQLite by default.** It removes an external dependency for the common
  single-node panel and matches the "install and it works" goal. MySQL remains
  for deployments that need it.
- **No ORM-level encryption.** Secrets are stored as text and the database is
  treated as a trusted boundary. Encrypting them would require a key-management
  story the project does not have yet.
- **Backup bytes belong to wings.** The panel stores metadata so it can list and
  authorize, but it is not a storage service.
