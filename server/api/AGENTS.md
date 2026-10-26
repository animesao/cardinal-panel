# server/api — route handlers

Every file here is a route. The path and the method suffix are the URL; there is
no central router.

## Adding a route

1. Pick the family: `/api/**` (session/panel UI), `/api/v1/**` (API key),
   `/api/admin/**` (admin), `/api/remote/**` (node token).
2. Create `server/api/<area>/<name>.<method>.ts` (`index.*` for the collection
   root, `[id].*` for a parameter).
3. Resolve the caller explicitly:
   - `getServerSession(event)` for a session-only route;
   - `requireAdmin(event)` for admin;
   - `requireServer(event, id)` + `needPerm(ctx, perm)` for a server;
   - `resolveApiKey` / `requireApiKey` for `/api/v1`.
4. If it accepts API keys and lives under `/api/admin/**`, add a `KEY_POLICY`
   rule in `server/utils/apikey-auth.ts`. No rule means no access.
5. Read the body with `readBody(event)`. Use `.catch(() => ({}))` only when an
   empty body is valid.
6. Select explicit columns. Never return a token or a password column.
7. Return a plain object/array. Use `listResponse` / `parseListQuery` for lists.
8. If it mutates a server, call `logActivity`; if it calls wings, use
   `wingsFetch`; if the server is suspended, return 403 before the call.
9. Update `docs/API.md` (and the Russian user docs if behavior is user-visible).

## Route families

| Prefix | Credential | Notes |
|---|---|---|
| `/api/account/**` | session | 2FA, API keys, login history, locale, password |
| `/api/admin/**` | admin session or admin key | `server/middleware/admin.ts` + handler `requireAdmin` |
| `/api/servers/**` | session or key | `requireServer` + `needPerm` |
| `/api/v1/**` | `cp_*` key | Compatibility API; `requireApiKey` + `needLevel` |
| `/api/remote/**` | node token | wings callbacks; no user identity |
| `/api/health`, `/api/settings/public`, `/api/auth/**`, `/api/setup/bootstrap` | none | Keep the public surface minimal |

## Traps

- `server/api/auth/[...].ts` is the NextAuth catch-all. It contains the
  credentials provider, OAuth providers, 2FA enforcement, and login throttling.
  Changes there affect every login method.
- A route under `[id]` gets the parameter from `event.context.params?.id`;
  parse it and reject non-numeric values.
- `GET` must not mutate. The console token route is `POST` for exactly this
  reason.
- The `/api/v1` error shape is H3's default; do not invent a Pterodactyl error
  envelope unless the client requires it and the change is deliberate.
