# API surface and authentication

This page explains how a request reaches a handler, which credential each route
family accepts, how API keys are scoped, and what a new route must do to stay
consistent. The user-facing reference is [`../API.md`](../API.md); the route tree
in `server/api/**` is the actual contract.

## Two credentials, three route families

| Family | Prefix | Credential | Typical caller |
|---|---|---|---|
| Page API (session) | `/api/**` | NextAuth JWT session | The browser SPA |
| Client API | `/api/v1/**` | `Authorization: Bearer cp_*` | External automation, Pterodactyl-style clients |
| Node callbacks | `/api/remote/**` | `Authorization: Bearer <nodes.token>` | wings |
| Public | `/api/health`, `/api/settings/public`, `/api/auth/**`, `/api/setup/bootstrap` | none | Health checks, login, first-admin setup |

Several `/api/**` routes accept **either** a session or an API key. They detect
`Bearer cp_*`, resolve it, and build a synthetic session (`requireServer`,
`requireAdmin`). Routes that deliberately stay session-only are documented in
`README.md`: personal SFTP password rotation, the server page payload, the node
status widget, the blueprint catalogue for the create form, the "my servers"
list, and 2FA management.

`/api/v1/**` is the short compatibility API. It is not a full Pterodactyl
implementation: it covers account, servers (list/get/resources/power/command),
nodes, allocations, users, locations, blueprints, database hosts, and server
databases. Check `server/api/v1/**` before promising a route.

## File naming

Nitro maps the file path and suffix to a route:

| File | Route |
|---|---|
| `server/api/servers/[id]/power.post.ts` | `POST /api/servers/:id/power` |
| `server/api/admin/nodes/index.post.ts` | `POST /api/admin/nodes` |
| `server/api/v1/servers/[uuid].get.ts` | `GET /api/v1/servers/:uuid` |
| `server/api/auth/[...].ts` | catch-all for NextAuth |

`index.*` maps to the collection root. `[...].ts` is a catch-all. There is no
central router file; adding a file adds a route.

## Authentication

### Session

`@sidebase/nuxt-auth` / NextAuth v4 issues a signed JWT session. Handlers call
`getServerSession(event)`; the session is not authoritative for roles or
per-server access. `requireAdmin` re-reads `users.role`, and `requireServer`
re-reads the role and `server_users` membership on every request, so a demotion
or ownership change applies immediately.

`nuxt.config.ts` configures `AUTH_ORIGIN` (default
`http://localhost:3000/api/auth`) and `NEXTAUTH_SECRET`. The session cookie name
is NextAuth's own; the panel does not set a custom `kt_panel_session` cookie.

### API keys

Format: `cp_` + 32 URL-safe characters (144 bits). Only a SHA-256 hash is stored
in `api_keys`. The secret is shown once at creation.

- `resolveApiKey` hashes the presented token, finds the row, checks the owning
  user still exists, and applies the per-key token bucket (60 requests/minute,
  `X-RateLimit-Limit` / `X-RateLimit-Remaining`, `429` with `Retry-After`).
- The key acts as its owner: the owner's own servers plus servers shared with
  them; an admin key sees everything **for admin resources only**.
- `API_RESOURCES` in `server/utils/apikey-auth.ts` defines every resource and its
  maximum level (0 none, 1 read, 2 read/write). `server_databases` and
  `activity` are read-only.
- For `/api/admin/**`, `KEY_POLICY` maps method + path prefix to a resource and
  minimum level. **No match means no access**, and routes outside the policy
  cannot be used with a key at all. There is intentionally no API access to key
  management or settings.
- For server routes, `needPerm` maps a subuser permission to a key resource and
  level (`KEY_LEVEL_FOR_PERM`). A read-only admin key still cannot perform a
  write: key levels cut even the owner/admin path. `needKeyWrite` covers the few
  routes that only check `isAdmin`/`isOwner`.

`ad-hoc` grant example (operator script, not an API route):

```sh
cd /opt/cardinal-panel && node scripts/admin-api-key.mjs \
  --email=admin@example.com --name=ci --scopes=nodes:2
```

### Node token

`/api/remote/**` does not use a user identity. It takes the Bearer value, strips
an optional `<tokenID>.` prefix, and compares the remaining secret against every
`nodes.token` as a SHA-256 digest with `timingSafeEqual`. The matched node scopes
the response: only that node's servers are returned.

### First admin

There is no auto-promotion. The first admin is created by:

- `POST /api/setup/bootstrap` with `PANEL_SETUP_TOKEN` (one-shot; the route
  returns 403 once an admin exists and the token is cleared), or
- `npm run create-admin -- --email=...` with database access.

An OAuth login never grants `admin`; new OAuth users are always `role=user`.

## Authorization model

| Check | Location | Rule |
|---|---|---|
| Admin route | `server/middleware/admin.ts` + handler `requireAdmin` | Fresh `users.role === 'admin'` |
| Server access | `requireServer(event, id)` | Admin, owner, or member with a row in `server_users` |
| Fine-grained action | `needPerm(ctx, perm)` | Admin/owner bypass; member needs the exact permission string |
| API-key scope | `needPerm` + `KEY_LEVEL_FOR_PERM`, `KEY_POLICY` | Resource level must be sufficient, even for admin/owner |
| Suspended server | Handler (`power`, `command`, `reinstall`, `ws-token`, console) | `403` before any wings call |

Subuser permissions are grouped in `SUBUSER_PERMISSIONS`
(`server/utils/wings.ts`). The canonical strings are stored as a JSON array in
`server_users.permissions`. `upgradePerms` migrates older shorthand when a row
is read; do not assume the stored set is already canonical.

## Request and response shapes

- JSON in, JSON out. `readBody` failures are usually caught with `.catch(() => ({}))`
  in routes that accept an empty body.
- Unknown/invalid input uses `createError({ statusCode, message })`; Nitro returns
  `{ statusCode, statusMessage, message }` (H3's shape), not a custom envelope.
  Do not add a second error envelope without a migration plan for the UI.
- List routes have two formats (`server/utils/pagination.ts`):
  - legacy: `?limit=&offset=` → bare array; no parameters → the whole list;
  - Pterodactyl: `?page=&per_page=` → `{ data, meta: { pagination: { total,
    count, per_page, current_page, total_pages } } }`, plus
    `?filter[field]=` and `?sort=[-]field`.
  `page/per_page` are also accepted as aliases on session list routes, which
  keep returning a bare array and `X-Total-Count`.
- Secret-bearing fields are stripped in projections, not by trusting the schema:
  node tokens, database host passwords, database passwords, and SFTP passwords
  do not appear in list/detail responses.

## Route map (high level)

| Area | Route family | Auth |
|---|---|---|
| Account | `/api/account/**` (2FA, API keys, logins, locale, password) | session |
| Admin | `/api/admin/**` (nodes, servers, users, locations, allocations, blueprints, database hosts, settings, keys) | admin session or admin key per `KEY_POLICY` |
| Servers | `/api/servers/**` (detail, power, command, files, backups, databases, ports, schedules, users, SFTP, activity, setup, startup) | session or key, per-server |
| Client API | `/api/v1/**` | API key |
| Remote | `/api/remote/**` | node token |
| Public | `/api/health`, `/api/settings/public`, `/api/auth/**`, `/api/setup/bootstrap` | none |

`server/api/AGENTS.md` has the file-level checklist for adding a route.

## Decisions

- **Role is never read from the JWT.** The session is an identity, not an
  authorization cache.
- **Admin checks are duplicated on purpose.** Middleware is a cheap gate; the
  handler is the boundary.
- **API keys are deny-by-default for admin routes.** A new admin route is
  unusable by keys until it is added to `KEY_POLICY`.
- **`/api/v1` is a compatibility surface, not the panel's internal API.** The UI
  uses `/api/**`; changing a `/api/v1` shape breaks external clients only.
