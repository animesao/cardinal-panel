# Runtime and request flow

The panel is a single Nuxt 4 process: Nitro serves the SPA and the HTTP API. It
does not run containers; it stores intended state and forwards operations to a
wing node. This page explains the process model, the browser/server split, the
panel-to-wings contract, and the callbacks wings sends back.

## Process model

```
browser ──HTTPS──▶ panel (Nitro, :3000) ──HTTP+Bearer──▶ wings (:8080) ──▶ cardinal serve ──▶ container
   │                     │                                   │
   │                     ├── app/  SPA (Vue pages)           └── SFTP :2022, console WS
   │                     └── server/api/**  HTTP handlers
   └── /api/servers/<id>/ws-token → short-lived JWT → direct WS to wings
```

- One Node.js process. `nuxt build` emits `.output/`; the production start
  command runs the Nitro server. There is no separate API service.
- The database connection is created lazily and cached per process
  (`server/db/index.ts`). SQLite opens one `DatabaseSync` handle and sets
  `journal_mode = WAL` and `foreign_keys = ON`.
- The only background work is `server/plugins/scheduler.ts`: a `setInterval`
  every 60 seconds that runs due schedules. Anything else is request-driven.
- The process is stateless between restarts except for the database file. Rate
  limit buckets and the SQLite handle live in memory and reset on restart.
- `server/api/health.get.ts` is intentionally reachable without auth so a load
  balancer or Docker `HEALTHCHECK` can distinguish "panel broken" from "panel
  busy". It returns 200 with `status: degraded` when disk space is low, and 503
  only when the database check fails.

## Two source trees

`nuxt.config.ts` sets `srcDir: 'app/'`, so the SPA lives in `app/`, not in a
top-level `pages/` directory.

| Tree | Contains | Conventions |
|---|---|---|
| `app/` | Pages, layouts, middleware, composables, plugins, components, assets | Nuxt auto-imports; `$api` is a thin `$fetch` wrapper (`app/plugins/api.client.ts`) |
| `server/` | Nitro routes (`api/`), middleware, plugins, DB layer, utilities | Every handler is `defineEventHandler`; shared logic lives in `server/utils/` |

The SPA never talks to wings directly for normal API calls. It calls
same-origin `/api/**`; the panel adds the node token. The exceptions are the
console WebSocket, file download/upload, and backup download, where the browser
receives a short-lived JWT and connects to wings itself.

## Request path

1. `app/middleware/auth.global.ts` redirects unauthenticated page navigations to
   `/login`. It is a UX gate, not an authorization boundary.
2. `app/middleware/admin.ts` redirects non-admins away from `/admin/*` pages.
   This is also a UX gate.
3. A Nitro route under `server/api/**` runs. It resolves the caller:
   - session: `getServerSession(event)`;
   - API key: `Authorization: Bearer cp_*` through `resolveApiKey`;
   - or a node token for `/api/remote/**`.
4. For `/api/admin/**`, `server/middleware/admin.ts` calls `requireAdmin`, and
   the handler calls it again. The duplication is deliberate: one missed
   middleware check would otherwise expose every admin route.
5. For a server-scoped route, `requireServer(event, id)` loads the server and
   node, resolves fresh role/owner/member state, and returns a context; the
   handler then calls `needPerm(ctx, '<permission>')`.
6. The handler reads or writes the panel database, and calls `wingsFetch(node,
   path)` for anything that changes the container.
7. `logActivity` records user-visible mutations in `server_activity`.

## Panel → wings contract

`server/utils/wings.ts` is the single client. `wingsFetch` adds
`Authorization: Bearer <nodes.token>`, strips trailing slashes from the node URL,
and sets `redirect: 'manual'` so a node cannot redirect the panel (and its token)
to another internal address.

Representative flows:

| Panel route | wings call | Notes |
|---|---|---|
| `POST /api/admin/servers` | `POST /v1/containers` | Container name is `srv-<server uuid>`; payload is built by `buildCreatePayload` |
| `POST /api/servers/[id]/power` | `POST /v1/containers/srv-<uuid>/{start,stop,restart,kill}` | Rejects a suspended server; updates `servers.status` optimistically |
| `POST /api/servers/[id]/command` | `POST /v1/containers/srv-<uuid>/exec` | Fire-and-forget command |
| `POST /api/servers/[id]/ws-token` | none (mints a JWT) | Returns the wings WS URL and a 10-minute HS256 token |
| `GET/POST /api/servers/[id]/files*` | `/v1/containers/srv-<uuid>/files*` | The panel is a proxy; no file content is stored in the panel DB |
| `POST /api/servers/[id]/backups` | `POST /v1/containers/srv-<uuid>/backup` | Returns 202; the row stays `creating` until the callback |
| `POST /api/servers/[id]/databases` | none | The panel provisions MySQL directly and stores credentials |
| `POST /api/admin/nodes` | `POST /v1/config` | Pushes `panel_url` and the node token to wings for callbacks |

Browser-side flows bypass the panel after the token is minted:

- console: `POST /api/servers/[id]/ws-token` → `{url, token}` → browser connects
  to wings `/api/servers/srv-<uuid>/ws`;
- file download/upload and backup download: the page asks for a URL/token and
  then talks to wings.

`mintWingsJwt(nodeToken, claims, ttlSec = 600)` signs HS256 with the node token,
so wings can verify the token with a key it already has. A read-only API key
cannot mint a write-capable console token: `needPerm` gates `websocket.connect`
and the permission list is derived from the caller's role.

## wings → panel callbacks

Three routes are authenticated by the node token, not by a user session. The
token is compared as a SHA-256 digest with `timingSafeEqual`. wings may send
`<tokenID>.<token>`; only the part after the first dot is compared.

| Route | Purpose | Source of truth |
|---|---|---|
| `GET /api/remote/autostart` | Containers to start when the node boots | `servers` where `nodeId` matches, `autoStart = 1`, `suspended = 0` |
| `POST /api/remote/backups/[uuid]` | Mark a backup `completed` or `failed` | `backups` row by UUID |
| `POST /api/remote/sftp/auth` | Validate an SFTP login | `sftp_credentials`, legacy `servers.sftpPassword`, or `users.sftpPassword` |

The panel never trusts the callback body for identity: the node is resolved from
the Bearer token, and only that node's servers are returned or updated.

## Scheduler

`server/plugins/scheduler.ts` runs every 60 seconds. It selects up to 25
schedules that are active and due (`nextRunAt <= now`), then calls
`runSchedule` from `server/utils/schedules.ts`.

- Actions: `start`, `stop`, `restart`, `command`.
- A suspended server is skipped, but `nextRunAt` is still advanced so the tick
  does not retry every minute.
- The minimum interval is 5 minutes (`nextRun` clamps to `Math.max(5, …)`).
- A failure in one schedule is logged and does not stop the others.

There is no queue, no retry, and no persistence of a failed run beyond the
schedule's own row. Treat the scheduler as best-effort.

## Health and disk

`GET /api/health` returns:

```json
{
  "status": "ok | degraded",
  "version": "0.6.4",
  "uptimeSeconds": 3600,
  "timestamp": "2026-10-26T12:00:00.000Z",
  "database": "ok | unavailable | unknown",
  "disk": {
    "freeMb": 12345,
    "path": "/var/lib/cardinal-panel",
    "warnMb": 512
  }
}
```

- `503` means the database check failed (`database: "unavailable"`, plus an
  `error` string). `200` with `status: degraded` means the process is alive but
  disk space is below `DISK_WARN_MB` (512 MiB); the response then also carries
  `disk.warning`.
- `version` is read from the `VERSION` file relative to the built server bundle;
  it is `unknown` if the file is not shipped.
- Disk measurement is `statfs` on the directory containing `SQLITE_PATH` (or the
  MySQL host when that is the dialect). An unmeasurable disk is `null`, not a
  failure.
- The panel keeps serving pages with a full disk but writes fail. That is why
  the health payload includes disk instead of only checking the DB.

## Dev versus production

- `npm run dev` binds `0.0.0.0:3000` (`nuxt.config.ts`) so localhost, LAN IPs,
  and OAuth callbacks on a LAN address all work. LAN exposure is a dev
  convenience, not a production hardening.
- Production runs the built `.output/` under systemd, Docker, or a cardinal
  container. The install paths and the systemd sandbox are described in
  [`build-and-release.md`](build-and-release.md).
- `NITRO_HOST`/`NITRO_PORT` override the bind address in the container images.

## Decisions

- **No panel-side container runtime.** The panel keeps desired state; wings is
  the only component that talks to cardinal. This keeps the panel restartable
  without affecting running game servers.
- **Node token as the only shared secret.** Panel→wings and browser→wings both
  derive authority from `nodes.token`; there is no separate panel signing key.
  `NUXT_JWT_SECRET` is legacy and unused.
- **Node callbacks are unauthenticated by user identity on purpose.** wings has
  no panel user session; the node token is its identity.
