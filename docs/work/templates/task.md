# Task: <short title>

- **Status:** `Planned` | `In progress` | `Blocked`
- **Owner:** <name or agent>
- **Started:** <YYYY-MM-DD>
- **Branch / commit:** <branch or `main@<sha>`>
- **Related issue / plan:** <link or "none">

## Goal

One paragraph. What observable outcome should exist when this is done?

## Scope

- <in scope>

## Non-goals

- <explicitly out of scope>

## Current behavior and evidence

State what the code does today, not what older docs claim. Use the
[`context map`](../../ai/context-map.md) to find the right files.

| Claim | Evidence (file, test, command) | Fact label |
|---|---|---|
| <claim> | `<path>:<line>` or `<command>` | `Implemented` |

## Constraints

- Security controls from the root [`AGENTS.md`](../../../AGENTS.md) must not be
  weakened.
- Role checks are fresh from the database; do not read authorization from the
  session.
- `server/api/**` is the route contract; update `docs/API.md` and the Russian
  user docs for a user-visible change.
- Table/column names in `server/db/schema.ts` are consumed by the UI and
  `/api/v1`; treat them as a contract.
- `VERSION` and `package.json` are bumped together with `npm run release:version`
  and a `CHANGELOG.md` entry.
- <other constraints>

## Plan

1. <step>
2. <step>
3. <step>

## Verification plan

| Check | Command | Environment |
|---|---|---|
| Lint | `npm run lint` | any with Node 24 |
| Secrets | `npm run check:secrets` | any |
| Types | `npm run typecheck` | any |
| Unit | `npm test` | any |
| Build | `npm run build` | any |
| Version sync | `npm run release:version -- --check` | any |
| E2E | `npm run test:e2e` | Chromium installed |
| Installer | `npm run test:install`, `npm run lint:shell` | Linux with shellcheck |
| Container install | `tests/install/Dockerfile` | Linux with Docker |

Name the checks that cannot run on this host and why.

## Decisions and open questions

- <decision, with the alternative rejected>
- <question that must be answered before implementation>

## Exit criteria

- [ ] Behavior implemented and covered by a test that fails without the change.
- [ ] `docs/API.md` and the Russian user docs updated, or the omission recorded.
- [ ] New drift recorded in [`../../status/known-issues.md`](../../status/known-issues.md).
- [ ] Handoff written with exact commands and results.
