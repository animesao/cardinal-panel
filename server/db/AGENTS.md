# server/db — dialect, schema, migrations

The panel supports SQLite (default) and MySQL from one logical schema. Read
`docs/architecture/state-and-storage.md` before editing a table.

## Files

| File | Role |
|---|---|
| `dialect.ts` | Reads `DB_DIALECT` and `SQLITE_PATH`; `IS_SQLITE` is used by the schema and runtime |
| `index.ts` | Lazy connection, `node:sqlite` proxy, MySQL connection, `insertAndGetId` |
| `schema.ts` | Every table defined twice, once per dialect |
| `migrations/sqlite/` | SQL applied by `scripts/migrate-sqlite.mjs` |
| `migrations/mysql/` | Drizzle Kit migrations |

## Rules

- **Edit both branches.** `schema.ts` uses `IS_SQLITE ? sqliteTable(...) :
  mysqlTable(...)`. A column added to only one branch works in one deployment
  and breaks the other. When the branches diverge, the SQLite one is not
  automatically "more correct".
- **Generate migrations for both dialects.** `npm run db:generate` and
  `npm run db:generate:mysql`.
- **Never rename a column or table in place.** The UI, `/api/v1`, and `/api/**`
  select by name. Rename means add + backfill + switch + drop, across releases.
- **SQLite timestamps are seconds, not milliseconds.** Use the helpers in the
  schema (`unixepoch()` defaults, `mode: 'timestamp'`). A raw `Date.now()` in a
  comparison silently returns nothing.
- **SQLite cannot `RETURNING` through this proxy in the way MySQL does.** Use
  `insertAndGetId(table, values)` instead of reading `insertId` yourself.
- **Foreign keys are on.** SQLite sets `PRAGMA foreign_keys = ON` per connection.
  A delete order that worked elsewhere can now fail.
- **The migration script is not `drizzle-kit`.** It applies SQL files in journal
  order, records tags in `__kt_migrations`, and wraps each file in a transaction.
  Keep the generated SQL compatible with `node:sqlite`.
- **Do not touch the `status_pages` tables** unless you are implementing or
  removing the feature; they are unused (`K-14`).

## Verification

```sh
npm run db:check     # selected dialect must connect
npm run db:migrate   # SQLite: apply to the resolved SQLITE_PATH
npm test
npm run typecheck
```

Run `db:migrate` against a copy of a real database and against an empty one. A
migration that only works on an empty schema is not verified. MySQL changes need
a real MySQL host: `npm run db:migrate:mysql` against a disposable database.
