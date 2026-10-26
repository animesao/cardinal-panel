# Build, CI, and release

This page covers the local toolchain, the CI gates, the release procedure, and
the installer layout. The user-facing install and upgrade instructions are
[`../INSTALL.md`](../INSTALL.md) and [`../UPGRADE.md`](../UPGRADE.md).

## Toolchain

| Tool | Version | Why |
|---|---|---|
| Node.js | 24 (CI pins 24) | Built-in `node:sqlite`; 23.4+ has it without a flag, 24 is the tested version |
| npm | 11+ | Lockfile and scripts |
| Chromium | Playwright-managed | E2E only |
| shellcheck | any recent | `install.sh` lint |
| Docker | optional | Container build, install simulation |

`npm ci` runs `postinstall`, which patches `next-auth` v4
(`scripts/patch-next-auth-core.mjs`) and runs `nuxt prepare`. Without the patch,
next-auth does not work with the current Nuxt/Nitro combination. Do not skip
`postinstall` in a clean build.

## Scripts that matter

| Script | Command | Purpose |
|---|---|---|
| `dev` | `nuxt dev` | Local server on `0.0.0.0:3000` |
| `build` | `nuxt build` | Production bundle in `.output/` |
| `typecheck` | `nuxt typecheck` | `vue-tsc` over app + server |
| `lint` | `node scripts/check-imports.mjs` | Rejects relative imports that break Nitro bundling |
| `check:secrets` | `node scripts/check-no-secrets.mjs` | Tracks-file secret scan |
| `test` | `vitest run` | Unit tests in `tests/unit/` |
| `test:e2e` | `playwright test` | Browser tests against a built panel |
| `db:migrate` | `node scripts/migrate-sqlite.mjs` | Apply SQLite migrations |
| `db:migrate:mysql` | Drizzle Kit | Apply MySQL migrations |
| `db:check` | `node scripts/check-db-connection.mjs` | Connectivity check for the selected dialect |
| `create-admin` | `node scripts/create-admin.mjs` | Create the first admin without the HTTP route |
| `release:version` | `node scripts/sync-version.mjs` | `VERSION` → `package.json`; `-- --check` verifies |
| `release:package` | `node scripts/package-release.mjs` | Build `release/` artifacts |
| `test:install` | `node scripts/simulate-install.mjs` | Lay out a release package and check paths |
| `lint:shell` | `shellcheck -S warning install.sh` | Installer lint |

## Versioning

`VERSION` is the source of truth. `package.json` mirrors it.

```sh
# bump
printf '0.6.5\n' > VERSION
npm run release:version

# verify
npm run release:version -- --check
```

Rules:

- Never edit `package.json` `version` by hand; run the script.
- Never hand-edit historical `CHANGELOG.md` entries.
- `VERSION` must be plain `X.Y.Z`. The release workflow compares it to the tag
  without the leading `v`.
- The README badge and any prose version are updated manually; they are not
  generated. Treat a stale badge as documentation drift.

## CI gates

`.github/workflows/build.yml` runs on every push to `main` and every PR:

1. `npm ci`
2. `npm run lint`
3. `npm run check:secrets`
4. `npm run typecheck`
5. `npm test`
6. `npm run release:version -- --check`
7. `npm run build`
8. Playwright install + `npm run test:e2e`
9. `npm run release:package`
10. `npm run test:install` (file layout simulation)
11. `npm audit --audit-level=critical --omit=dev`
12. full audit report artifact (always)
13. `shellcheck -S warning install.sh`
14. gitleaks over the full history
15. upload `release/` artifacts

A second job, `install-test`, builds a release package, builds
`tests/install/Dockerfile`, and runs the installer inside `ubuntu:24.04` with
Docker. That job is the only place the real install path is exercised; a local
`npm run build` does not replace it.

`release.yml` runs on `v*` tags or manual dispatch. It re-runs lint, typecheck,
unit tests, build, and packaging, then checks `tag == VERSION` and publishes a
GitHub release with `release/*.tar.gz`, `*.sha256`, and `*.sbom.json`. The
release body is `CHANGELOG.md`.

Consequences:

- A docs-only change still goes through lint/typecheck/test/build/e2e; there is
  no path filter.
- A release can fail after the tag is pushed if the tag does not match
  `VERSION`. Bump and commit before tagging.
- `npm audit` is a gate at `critical` for production dependencies only.
  Non-critical findings are reported, not blocking.

## Release checklist

1. `git status` is clean and `main` is up to date.
2. Behavior changes are covered by tests; docs are updated.
3. `CHANGELOG.md` has an entry under the new version with Added / Changed /
   Fixed / Security sections as needed.
4. `VERSION` and `package.json` are bumped together; `--check` passes.
5. Run the local gates you can run (`lint`, `typecheck`, `test`, `build`,
   `check:secrets`, `release:version -- --check`).
6. Commit as `chore(release): X.Y.Z` or the project's chosen prefix.
7. Push `main`, wait for `build` to be green.
8. Tag `vX.Y.Z` (annotated) on the release commit and push the tag.
9. Wait for `release` to publish; verify the three asset types.
10. Check that the README badge and `docs/` version claims match `VERSION`.

Do not move an already published tag. If a post-release fix is needed, ship the
next patch version.

## Installer

`install.sh` supports two modes:

| Mode | Default | What it does |
|---|---|---|
| `systemd` | yes | Downloads the release tarball, verifies SHA-256, unpacks to `/opt/cardinal-panel`, creates the `cardinal` user, writes `/etc/cardinal-panel/panel.env`, runs migrations, installs and starts a systemd unit |
| `cardinal` | no | Builds/runs the panel as a cardinal service (`/etc/cardinal-panel/cardinal.toml`), with host or bridge networking |

Defaults:

| Setting | Value |
|---|---|
| Install dir | `/opt/cardinal-panel` |
| Data dir | `/var/lib/cardinal-panel` |
| Config | `/etc/cardinal-panel/panel.env` (0600) |
| User | `cardinal` |
| Port | `3000` |
| Free-space check | 256 MiB (`--min-free`) |
| Node.js | 24 |

Optional full install: `--domain`, `--admin-email`, `--wings-url`,
`--wings-token`, `--hostname`, `--no-proxy`, `--no-tls`, `--no-start`,
`--uninstall`, `--install-mode`, `--network`, `--image-tag`. The full install
generates `NEXTAUTH_SECRET`, creates the first admin, registers the wings node
through the real API with a temporary admin key, and then revokes that key.

Re-running the installer preserves `NEXTAUTH_SECRET` (sessions survive) and
updates the public URL and mode. `--uninstall` keeps the database unless
`KEEP_DATA=1` is set.

The installer is POSIX `bash` with `set -euo pipefail`. It deliberately does not
use the `/etc/os-release` `VERSION` variable (the panel version is
`PANEL_VERSION`), because distro `VERSION` leaked into release downloads before.

## Docker

- `Dockerfile` is a two-stage Node 24 Alpine build. The runtime adds `tini` and
  `curl`, runs as uid/gid `10001`, and stores the database under `/app/data`.
- `docker-compose.yml` builds the panel, mounts the `panel-data` volume, and
  exposes `${PANEL_PORT:-3000}`. MySQL is a commented-out service.
- The Compose build arg and image tag are **hardcoded** and have drifted from
  `VERSION` before (`K-08`). Check them before claiming the image matches the
  release; the release tarball does not use Compose.
- Release artifacts are `.tar.gz`, `.sha256`, and a SPDX `.sbom.json` produced by
  `scripts/package-release.mjs`. The tarball contains `.output/`, migrations,
  scripts, and packaging files; `install.sh` expects that layout.

## Verification recipe

Local, in order:

```sh
npm run lint
npm run check:secrets
npm run typecheck
npm test
npm run build
npm run release:version -- --check
```

Linux-only or CI-only (say so when you skip them on Windows):

```sh
npm run test:e2e        # needs Chromium
npm run lint:shell      # needs shellcheck
npm run test:install    # file-layout simulation
docker build -f tests/install/Dockerfile -t panel-install-test .
docker run --rm panel-install-test
```

## Decisions

- **One artifact for all install modes.** The release tarball is the same bytes
  for systemd and the cardinal container; the installer chooses the layout.
- **Release is tag-driven.** No manual upload step; the workflow publishes from
  the tag and refuses a mismatch with `VERSION`.
- **Docs are not generated.** Version markers in Markdown are manual, so the
  release checklist includes checking them.
