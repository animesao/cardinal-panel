# scripts — build, release, migration, and CI helpers

These are Node.js utilities run by `package.json`, GitHub Actions, and the
installer. They are not part of the Nitro runtime and run in the repo root or in
a staging directory.

## Map

| Script | Called by | Purpose |
|---|---|---|
| `patch-next-auth-core.mjs` | `postinstall` | Patches `next-auth` for `@sidebase/nuxt-auth` (must run after install) |
| `sync-version.mjs` | `release:version` | Copies `VERSION` to `package.json`; `--check` is the CI gate |
| `package-release.mjs` | `release:package`, `release.yml` | Builds `release/*.tar.gz`, `.sha256`, `.sbom.json` |
| `migrate-sqlite.mjs` | `db:migrate`, installer | Applies SQLite SQL migrations in order into `__kt_migrations` |
| `check-imports.mjs` | `lint` | Enforces `../` depth for `server/` imports (prevents Nitro/Rollup failures) |
| `check-no-secrets.mjs` | `check:secrets` | Scans tracked files for likely secrets/patterns |
| `check-db-connection.mjs` | `db:check` | Connects with the selected dialect and reports a short error |
| `create-admin.mjs` | `create-admin` | Creates an admin directly in the DB |
| `admin-api-key.mjs` | operator | Creates/revokes an admin API key (used by the installer) |
| `simulate-install.mjs` | `test:install`, CI | Layout test for the release package |
| `e2e-server.mjs` | Playwright `webServer` | Builds and starts the panel for e2e |
| `with-env.mjs` | npm scripts | Cross-platform env assignment for Drizzle Kit |
| `lib/panel-env.mjs` | several | Reads `panel.env` from `/etc/cardinal-panel/` for scripts run on a host |

## Rules

- **Do not read `process.env` ad hoc.** Use `with-env.mjs` or pass vars
  explicitly; on Windows `VAR=val cmd` does not work in all shells.
- **Keep scripts idempotent where possible.** `migrate-sqlite.mjs` tracks
  applied migration tags; re-running it must not re-apply.
- **`package-release.mjs` must not include symlinks.** It uses `dereference:
  true` on copy and asserts the tar has no `l` entries. A junction in
  `node_modules` must be dereferenced or the archive becomes broken on Linux.
- **Release payload is explicit.** If you add a file the installer needs
  (`.output/`, `scripts/`, `packaging/`, `server/db/migrations/`, `package.json`,
  `package-lock.json`, `VERSION`), add it to `PAYLOAD`. The script writes a
  generated `INSTALL.md`.
- **Version scripts are the source of truth.** `sync-version.mjs` copies
  `VERSION` to `package.json`; never edit `package.json` version by hand.
- **Secrets checks must stay fast.** `check-no-secrets.mjs` reads tracked
  files only (`git ls-files`).
- **Installer integration.** `install.sh` expects the tar layout produced by
  `package-release.mjs`. A change to paths in the tar requires a change to both
  scripts and `simulate-install.mjs`.
- **Do not log secrets.** `admin-api-key.mjs` prints the key **once** and
  never again; treat it as sensitive output.

## Verification

```sh
node scripts/sync-version.mjs --check
npm run check:secrets
npm run lint:shell
npm run test:install
```

Run `npm run release:package` in CI; locally it writes into `release/` and can be
slow on a cold build. `simulate-install.mjs` needs a built package or it skips;
it simulates layout and can run the installer logic.
