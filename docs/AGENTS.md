# docs — documentation rules

Read the root [`AGENTS.md`](../AGENTS.md) and
[`ai/context-map.md`](ai/context-map.md) first. This file covers the layout and
the rules that keep two documentation tracks from drifting into each other.

## Two tracks

| Track | Language | Audience | Paths |
|---|---|---|---|
| User and operator docs | Russian | Panel users, operators, integrators | [`README.md`](../README.md), [`docs/README.md`](README.md) (this index), `INSTALL.md`, `UPGRADE.md`, `CONFIGURE.md`, `OPERATIONS.md`, `TROUBLESHOOTING.md`, `API.md`, `DEVELOPMENT.md`, [`../SECURITY.md`](../SECURITY.md) |
| Agent and maintainer docs | English | AI agents, maintainers | [`AGENTS.md`](../AGENTS.md), [`ai/`](ai/), [`architecture/`](architecture/), [`status/`](status/), [`work/`](work/), local `AGENTS.md` files |

Do not translate the Russian user docs into English or the English agent docs
into Russian as part of an unrelated change. If a user-visible behavior changes,
fix the Russian page. If a durable internal rule changes, fix the English page.

## Layout

| Path | Audience | Notes |
|---|---|---|
| [`README.md`](README.md) | Russian readers | Index of the user docs. Update it when a page is added or renamed. |
| [`INSTALL.md`](INSTALL.md), [`UPGRADE.md`](UPGRADE.md), [`CONFIGURE.md`](CONFIGURE.md), [`OPERATIONS.md`](OPERATIONS.md), [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Operators | Install, upgrade, configure, operate, troubleshoot. |
| [`API.md`](API.md) | API consumers | Usage reference with `curl`. Grep a section; the route file is the contract. |
| [`DEVELOPMENT.md`](DEVELOPMENT.md) | Contributors | Local setup, checks, release process. Duplicates parts of `CONTRIBUTING.md` on purpose. |
| [`architecture/`](architecture/) | Maintainers/agents | Current subsystem behavior with file evidence. |
| [`status/known-issues.md`](status/known-issues.md) | Maintainers/agents | Verified drift and technical gaps. Read before trusting older claims. |
| [`ai/context-map.md`](ai/context-map.md) | Agents | Routing layer and context budget. |
| [`work/`](work/) | Agents/maintainers | Task and handoff records for multi-step work. |

## Content rules

- Code and tests override every document here. If a page contradicts the code,
  fix the page or record the drift; do not change working code to match prose.
- The route tree `server/api/**` is the API contract. When a route is added,
  renamed, or changes its request/response shape, update [`API.md`](API.md) in
  the same change. A route that exists only in docs is worse than a missing
  document.
- Do not duplicate architecture detail in `API.md` or `README.md`. Link to
  [`architecture/`](architecture/) instead.
- Security statements must match [`architecture/security.md`](architecture/security.md)
  and the code. In particular: 2FA applies to OAuth too, backup codes are
  SHA-256 (not bcrypt), node/SFTP/database secrets are plaintext at rest, and
  there is per-server sharing through `server_users`.
- Version numbers in prose are a liability. Prefer "current release" or a link
  to `CHANGELOG.md`. When a version must appear, take it from `VERSION`.
- Relative links are preferred. External links should point at stable upstream
  pages, not search results or temporary URLs.
- Never paste API keys, node tokens, passwords, `NEXTAUTH_SECRET`, or real
  customer data into docs or examples. Use `cp_...`, `<node-token>`,
  `CHANGE-ME`, or another obvious placeholder.
- Historical documents (`CHANGELOG.md`, `TODO.md`, old audit notes) stay
  historical. Add a date or a superseded note instead of rewriting them to look
  current.

## Verification

There is no documentation link checker in CI. Verify manually:

1. Every relative link and image target exists.
2. Fenced `curl` examples include the `Authorization` header where the route is
   authenticated and use a placeholder key.
3. `VERSION` still matches `package.json` unless this is a release change.
4. `npm run check:secrets` passes (it scans tracked files for accidental
   secrets).
5. A behavior claim has a code or test pointer. If you cannot find one, label
   it `Unknown` and say so.

## Before closing a documentation change

- [ ] Relative links resolve.
- [ ] User-visible behavior changes are reflected in the Russian page, and the
      English architecture page if the behavior is durable.
- [ ] Security statements match the code, not an older audit or README claim.
- [ ] API routes mentioned in `API.md` exist in `server/api/**`.
- [ ] New drift is recorded in [`status/known-issues.md`](status/known-issues.md).
- [ ] `VERSION`/`package.json` are unchanged, or intentionally bumped together
      with a `CHANGELOG.md` entry.
- [ ] No token, key, password, or private key is present in the diff.
