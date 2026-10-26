# Work records

This directory is for multi-step work that needs a written goal, evidence, and a
handoff. It exists so a fresh session can recover state without re-reading the
whole repository.

It is not a roadmap, a release log, or a place for architecture prose.

## When to use it

Use a work record when at least one of these is true:

- the change spans several areas (`server/`, `app/`, installer, docs);
- another agent or maintainer must continue the work;
- a decision needs an explicit scope and non-goals;
- the verification is partly blocked by the environment (for example, a Windows
  host with no Linux runtime or no Chromium).

For a one-file fix, use the change protocol in the root
[`AGENTS.md`](../../AGENTS.md) and skip this directory.

## Layout

| Path | Purpose |
|---|---|
| [`templates/task.md`](templates/task.md) | Copy this before starting. State goal, scope, evidence, and verification. |
| [`templates/handoff.md`](templates/handoff.md) | Fill this in before stopping or handing off. Exact commands and results. |
| [`active/`](active/README.md) | Work in progress. Create one file per task, named after the branch or slug. |

## Rules

- One record per task. Name it after the branch or a short slug, for example
  `active/server-audit-log.md`.
- Fill the task template **before** the first edit. If the goal is still vague,
  the work is not ready.
- Record evidence as `path:line`, a test name, or a command with its result.
  Do not write "the code does X" without a pointer.
- Keep the record short. Code and tests are the source of truth.
- Finish with the handoff template. Include the commands you ran, the ones you
  did not run, and why.
- Delete the record when the work is merged, or move the durable part into
  [`../architecture/`](../architecture/) or
  [`../status/known-issues.md`](../status/known-issues.md). Do not leave
  completed tasks in `active/`.

## Fact labels

Use the same labels as the root `AGENTS.md`: `Implemented`, `Partial`,
`Planned`, `Deprecated`, `Unknown`. A claim without a label and a pointer is a
guess.

## Security and contract reminders

- Do not weaken a control from the root `AGENTS.md` to make a task easier.
- `server/api/**` is the route contract; a user-visible route change updates
  `docs/API.md` and the Russian user docs.
- Table and column names in `server/db/schema.ts` are read by the UI and
  `/api/v1`; they are a contract even without a migration.
- Never put a real API key, node token, `NEXTAUTH_SECRET`, or password in a work
  record.
