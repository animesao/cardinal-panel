# server/utils — shared backend logic

Utilities here are imported by routes and by each other. Keep them free of Nuxt
page code. Many carry `// @ts-nocheck`, so the typechecker is not a safety net.

## Map

| Module | Responsibility | Do not break |
|---|---|---|
| `wings.ts` | wings client, server access, subuser permissions, SFTP helpers, create payload, activity log, panel JWT | `requireServer` role resolution, `needPerm` mapping, `redirect: 'manual'` |
| `apikey-auth.ts` | API key model, hashing, `KEY_POLICY`, rate limit | Deny-by-default for admin routes; levels are per resource |
| `apikeys.ts` | Key minting/listing, user-scoped server queries | Secret shown once; only SHA-256 stored |
| `admin.ts` | `requireAdmin` with a fresh role | Session role is not trusted |
| `node-url.ts` | Node URL validation and DNS check | Metadata hosts always blocked; private only via `NODE_TRUSTED_CIDRS` |
| `cidr.ts` | IPv4/IPv6 parsing and CIDR membership | Pure functions; covered by `tests/unit/node-url.test.ts` |
| `clientip.ts` | Trusted client IP | XFF is used only for a trusted proxy; last address wins |
| `ratelimit.ts` | Token bucket + attempt buckets | In-memory; keys must be attacker-uncontrolled |
| `password.ts` | scrypt hash/verify | Format `scrypt$N$r$p$salt$hash`; `timingSafeEqual` |
| `totp.ts` | TOTP + backup codes | SHA-1/30 s/6 digits; SHA-256 backup codes |
| `oauth-seal.ts` | AES-256-GCM for secrets | Key derived from `NEXTAUTH_SECRET`; changing it breaks sealed values |
| `settings.ts` | Settings table + panel name + setup token + OAuth seeding | `panel_name` 2–60 chars; env seeding happens once |
| `databases.ts` | MySQL provisioning and SSRF check | PostgreSQL returns 501 by design; random credentials |
| `schedules.ts` | Schedule execution | Suspended servers are skipped but advanced |
| `disk.ts` | Free-space measurement | `DISK_WARN_MB = 512`; unmeasurable is `null` |
| `blueprints.ts` | Blueprint enrichment, variables, env parsing | Import/export format is read by the admin UI |
| `pagination.ts` | Legacy and Pterodactyl list formats | Legacy shape must stay a bare array |

## Rules

- A utility that both a route and a plugin use must not import `#auth` or call
  `getServerSession` (the scheduler has no session). Pass `db`/`userId` in.
- Keep pure functions pure and inject `now`/`Date.now()` where tests need it
  (`ratelimit`, `totp`).
- Do not add a dependency for crypto. `node:crypto` covers hashing, scrypt,
  AES-GCM, HMAC, and random bytes.
- Do not weaken a check to make a caller simpler. Fix the caller.
- If you change a permission string, `needPerm` mapping, or `KEY_POLICY`, update
  the UI permission groups and `README.md` in the same change.
- If you change a response projection, check the page that consumes it.

## Tests

`vitest.config.ts` includes `server/utils/**/*.ts` in coverage but excludes
`wings.ts`. The unit suite covers the pure modules; `wings.ts` is exercised only
through routes and e2e. Do not claim a `wings.ts` change is unit-tested.
