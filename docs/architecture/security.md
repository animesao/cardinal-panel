# Security model

The panel is an entry point into the infrastructure: whoever controls it can
create containers, issue SFTP credentials, and provision databases. This page
lists the controls that actually exist, where they live, and which claims in
older documents are stronger than the implementation.

The endpoint contract is in [`api-and-auth.md`](api-and-auth.md); this page is
about what stops an attacker.

## Trust boundaries

```
browser ──HTTPS+session or cp_* key──▶ panel ──HTTP+Bearer node token──▶ wings ──▶ cardinal ──▶ container
                                          │
                                          ├── MySQL server for game databases (panel provisions)
                                          ├── SFTP through wings (panel validates the login)
                                          └── short-lived JWT → browser ↔ wings (console, files)
```

- The panel is trusted to hold `nodes.token`, which is enough to control every
  server on that node. A panel compromise is a node compromise.
- wings is trusted to report container state and to enforce the container
  boundary. The panel does not sandbox workloads.
- The panel database is a sensitive asset: it contains node tokens, SFTP
  passwords, and database passwords in plaintext (see below).
- A node callback is authenticated by the node token only. wings has no panel
  user session, so the token is its identity.

## Authentication surfaces

| Surface | Credential | Evidence |
|---|---|---|
| `/api/**` (browser) | NextAuth JWT session | `server/api/auth/[...].ts`, `getServerSession` |
| `/api/**` and `/api/v1/**` (automation) | `Authorization: Bearer cp_*` | `server/utils/apikey-auth.ts` |
| `/api/admin/**` | admin session or admin key allowed by `KEY_POLICY` | `server/utils/admin.ts`, `server/middleware/admin.ts` |
| `/api/remote/**` | `Authorization: Bearer <nodes.token>`; `<tokenID>.` prefix stripped | `server/api/remote/**` |
| `/api/health`, `/api/settings/public`, `/api/auth/**`, `/api/setup/bootstrap` | none | route files |
| SFTP (through wings) | panel username/password, validated by `POST /api/remote/sftp/auth` | `server/api/remote/sftp/auth.post.ts` |

Credentials are compared in constant time where the value is a secret:
- API keys: SHA-256 digest lookup (the stored value is a hash; lookup is by hash).
- Node tokens: SHA-256 of both sides + `timingSafeEqual`.
- Panel passwords: `scrypt` (`N=16384, r=8, p=1`, 16-byte salt) +
  `timingSafeEqual`.
- TOTP codes: `timingSafeEqual` over the 6-byte code.
- Backup codes: SHA-256 digests, compared with `includes` after both sides are
  hashed. Backup codes are high-entropy (10 random bytes from a 32-character
  alphabet, 8 codes), so unsalted SHA-256 is acceptable; bcrypt is not used.

## Password and session handling

- `hashPassword` / `verifyPassword` live in `server/utils/password.ts`. Password
  rules: 8–128 characters.
- A dummy hash is verified for a missing account so response time does not
  reveal whether an e-mail exists (`server/api/auth/[...].ts`).
- Sessions are signed JWTs; `NEXTAUTH_SECRET` is the only key. Changing it
  invalidates every session and makes sealed OAuth secrets unreadable.
- The JWT caches `role`, `id`, `uuid`, `provider`, and `locale`. Authorization
  never trusts the cached role: handlers re-read `users.role`.

## Login and 2FA throttling

| Bucket | Limit | Window | Key |
|---|---|---|---|
| Login attempts | 10 | 15 min | normalized e-mail |
| Login attempts per IP | 30 | 60 s | socket IP / trusted `X-Forwarded-For` |
| TOTP / backup-code attempts | 5 | 5 min | user id |
| API key requests | 60 | 60 s | API key id |
| Sensitive auth routes per IP (`/api/auth/callback/credentials`, `/api/auth/signin`, `/api/auth/csrf`, `/api/account/password`, `/api/account/2fa/*`, `/api/users/sftp-password`) | 30 | 60 s | socket IP / trusted XFF |

All buckets are in-memory. They reset on restart and are per process; the panel
is designed as a single process, so this is not a correctness bug, but it is not
a distributed limiter either.

IP resolution (`server/utils/clientip.ts`):
- `socket.remoteAddress` is the primary source.
- `X-Forwarded-For` is used **only** when the direct peer is in `TRUSTED_PROXY`
  (default loopback). The **last** address in the chain is used, because a
  standard reverse proxy appends the real client.
- `X-Forwarded-For` is never trusted from an arbitrary peer; that would let an
  attacker reset the per-IP bucket with one header.

## 2FA (TOTP)

- TOTP is RFC 6238, SHA-1, 30-second step, 6 digits, ±1 step window
  (`server/utils/totp.ts`).
- The secret is sealed with AES-256-GCM before it is stored; the key is derived
  from `NEXTAUTH_SECRET` (`server/utils/oauth-seal.ts`). A stolen database
  without the secret cannot generate codes.
- Enrollment is two-step: `POST /api/account/2fa/setup` stores a pending,
  disabled secret and returns the `otpauth://` URL once; `enable` verifies a code
  and returns 8 backup codes once. Backup codes are stored as SHA-256 hashes and
  consumed on first use.
- **2FA applies to every login method.** A password login for an enabled account
  requires the `totp` credential (code or backup code). An OAuth login for an
  enabled account is rejected with a redirect to
  `/login?error=TwoFactorRequired`; the user must sign in with e-mail + password.
  There is no TOTP prompt inside the OAuth callback.
- The credential form reveals whether the password was correct by switching to
  the 2FA step (`2FA_REQUIRED`). This is an accepted trade-off: without it the
  user cannot know to enter a code. It is recorded in `TODO-SECURITY.md`.

## API keys

See [`api-and-auth.md`](api-and-auth.md) for the policy details. Security-relevant
properties:

- Only `cp_` + 32 random characters is issued; only a SHA-256 hash is stored.
- Levels are per resource and are enforced **after** role/ownership, so a
  read-only key cannot write even for an admin.
- `KEY_POLICY` is an allowlist: a new admin route is unusable by keys until it is
  added deliberately.
- Key management and settings have no API surface by design.
- The rate limit is per key, not per IP. A leaked key is still limited to
  60 requests/minute, but revoke it; the limit is not a substitute for revocation.

## SSRF and outbound requests

`server/utils/node-url.ts` validates node URLs; `server/utils/cidr.ts` does the
CIDR math.

- Scheme must be `http` or `https`; embedded credentials are rejected.
- Public addresses pass.
- Private, loopback, link-local, CGNAT, and `.local`/`.internal` addresses are
  rejected unless they fall into `NODE_TRUSTED_CIDRS`.
- Hostnames are resolved and the resolved address is checked, so a public name
  pointing at `127.0.0.1` is treated as private. The validated address is pinned
  for the connection.
- Cloud metadata addresses (`169.254.169.254`, `169.254.170.2`,
  `100.100.100.200`, `fd00:ec2::254`) are blocked always, regardless of the
  allowlist.
- `wingsFetch` uses `redirect: 'manual'`. A node cannot redirect the panel (and
  the node token in `Authorization`) to another host.
- The same `isPrivateHost` barrier is used before opening a MySQL connection to a
  database host (`server/utils/databases.ts`).

## Secrets at rest

Honest list. These are stored in plaintext in the panel database:

| Value | Column | Impact of a database leak |
|---|---|---|
| wings node token | `nodes.token` | Full control of that node's containers and SFTP |
| per-user SFTP password | `sftp_credentials.password` | File access to that server |
| legacy server SFTP password | `servers.sftpPassword` | File access to that server |
| panel user SFTP password | `users.sftpPassword` | Personal SFTP login |
| database host password | `database_hosts.password` | Access to the MySQL host |
| provisioned database password | `server_databases.password` | Access to that game database |

Encrypted or hashed:

| Value | Storage |
|---|---|
| panel account password | scrypt hash (`users.passwordHash`) |
| API key | SHA-256 hash (`api_keys.tokenHash`) |
| TOTP secret | AES-256-GCM sealed (`user_totp.secret`) |
| TOTP backup codes | SHA-256 hashes (`user_totp.backupCodes`) |
| OAuth client secret | AES-256-GCM sealed (`settings.oauth_*_secret`) |

`NEXTAUTH_SECRET` is therefore not just a session key: it is also the key
material for OAuth secrets and TOTP secrets. Losing it locks out every 2FA user
and forces re-entering OAuth secrets. Leaking it does not by itself expose the
plaintext columns above, but it lets an attacker forge sessions.

## Process hardening

The installed systemd unit runs the panel as the unprivileged `cardinal` user
with `ProtectSystem=strict`, `NoNewPrivileges`, `PrivateTmp`,
`ProtectKernelTunables`, and `RestrictSUIDSGID`. The configuration file
`/etc/cardinal-panel/panel.env` is `0600` and owned by `cardinal`; the data
directory `/var/lib/cardinal-panel` is `0750`. The unit is generated by
`install.sh`, so read the current script for the exact directives.

The Docker images run as uid/gid `10001` and use `tini` as PID 1. They are not
privileged and do not mount the Docker socket.

## Known gaps

- **No tenancy beyond per-server sharing.** Subusers exist
  (`server_users` + `needPerm`), but all users share one panel database, one
  node pool, and one admin role. There is no organization/project boundary.
- **Plaintext secrets at rest** (table above). Moving them under `oauth-seal` is
  an open task, not an implemented feature.
- **Scheduler is best-effort.** A missed tick or a failed action is not retried.
- **`npm audit` findings** may include transitive dependencies with no upstream
  fix; see `TODO-SECURITY.md` for accepted risks.
- **Rate limits are in-memory.** A restart clears them; a multi-process
  deployment would not share them.

## Deployment guidance

- Serve the panel over HTTPS. OAuth providers require it, and without it session
  cookies and passwords travel in cleartext.
- Bind the panel to loopback and put nginx (or another TLS terminator) in front.
- Set `TRUSTED_PROXY` to the exact proxy addresses. `*` or `0.0.0.0/0`
  neutralizes the IP-based throttles.
- Use a unique `NEXTAUTH_SECRET` per deployment and keep it out of backups that
  are less protected than the database itself.
- Treat a panel database backup as a secret: it contains node tokens and
  passwords.
- Give each wings node its own token. A shared token makes one leaked node
  compromise all of them.
- Review Account → Login history and the per-server activity log.

## Reporting a vulnerability

Do not open a public issue. Use the process in
[`../../SECURITY.md`](../../SECURITY.md): e-mail `security@animesao.dev` or a
private GitHub Security Advisory.

## What is not a vulnerability

- A panel admin can see and change everything, including SFTP and database
  credentials. That is the role.
- Container console output and file contents are visible to users who have the
  corresponding per-server permission.
- The panel trusts wings responses. A compromised wings is outside the panel's
  threat model.
- A 2FA-enabled account cannot sign in through OAuth. That is the intended
  behavior, not a lockout bug; use e-mail + password.
