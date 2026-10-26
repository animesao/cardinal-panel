# server — Nitro API, auth, and utilities

This is the backend half of the panel. It is one Nitro server with file-based
routing. Read the root `AGENTS.md` first; this file covers the traps.

## Layout

| Path | Contents |
|---|---|
| `server/api/**` | Route handlers, named `<name>.<method>.ts`; `[...].ts` is a catch-all |
| `server/middleware/` | Global middleware: admin gate and auth-route rate limit |
| `server/plugins/` | Startup plugins; `scheduler.ts` is the only background loop |
| `server/utils/` | Shared logic: auth, wings client, DB provisioning, TOTP, SSRF, limits |
| `server/db/` | Dialect switch, connection, schema, migrations |

## Rules

- **Do not rely on auto-imports.** `npm run lint` (`scripts/check-imports.mjs`)
  requires a file at depth N under `server/` to reach `server/db` and
  `server/utils` with exactly N `../` segments. A wrong depth typechecks in dev
  and fails the Nitro build.
- **Many files start with `// @ts-nocheck`.** Do not assume `npm run typecheck`
  covers a handler you edited; check whether the directive is present and read
  the code carefully.
- **Authorization is per handler.** Middleware is a gate, not the boundary. An
  admin route calls `requireAdmin`; a server route calls `requireServer` and then
  `needPerm`. See `docs/architecture/api-and-auth.md`.
- **Never trust `session.user.role`.** Read the fresh role from `users` (helpers
  already do this).
- **Every wings call goes through `wingsFetch`.** It adds the node token and
  forbids redirects. Do not use raw `$fetch` against a node URL.
- **Two credentials.** A route that accepts API keys must detect `Bearer cp_*`
  and use `requireServer`/`requireAdmin`; a session-only route must not silently
  accept a key.
- **Log mutations.** Use `logActivity` for user-visible changes so the server
  activity tab stays meaningful.
- **Secret projections.** Do not return `nodes.token`, `database_hosts.password`,
  `server_databases.password`, `sftp_credentials.password`, or
  `users.sftpPassword` from a route. Select explicit columns.
- **Suspended servers.** `power`, `command`, `reinstall`, and `ws-token` check
  `srv.suspended` before calling wings. A new mutation needs the same check.
- **Do not create a second error envelope.** Use `createError`; H3 shapes the
  response.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` covers pure utilities (`password`, `ratelimit`, `clientip`,
`node-url`, `oauth-seal`, `disk`, `pagination`, `apikeys`). A route change with
no utility change needs a manual request or an e2e test; do not claim it is
covered because the suite passed.
