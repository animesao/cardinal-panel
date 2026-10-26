# app — the Nuxt SPA

`nuxt.config.ts` sets `srcDir: 'app/'`, so this directory **is** the Nuxt source
root: `~/` resolves to `app/`, not to the repository root. There is no top-level
`pages/`, `components/`, or `composables/`.

Read the root [`AGENTS.md`](../AGENTS.md) first. This file covers the frontend
traps; the backend contract is in
[`docs/architecture/api-and-auth.md`](../docs/architecture/api-and-auth.md).

## Layout

| Path | Contents |
|---|---|
| `app.vue` | Root: `<NuxtLayout><NuxtPage /></NuxtLayout>` |
| `pages/` | File-based routes: `index`, `login`, `dashboard/*`, `admin/*` |
| `layouts/` | `dashboard.vue` (user shell) and `admin.vue` (admin shell) |
| `middleware/` | `auth.global.ts` (any non-login page) and `admin.ts` (admin pages) |
| `plugins/` | `api.client.ts` (`$api`), `i18n.ts` (vue-i18n + `LANGS`) |
| `composables/` | `useLocale`, `usePanelName`, `useNodeStatus`, `useNoAccess`, `useConfirm`, `useFormat` |
| `components/` | `Ui*` primitives plus feature components (`ServerConsole`, `ServerFiles`, `NodeStatus`, …) |
| `locales/` | Ten JSON dictionaries: `ru en de es fr pt zh ar hi ja` |
| `assets/css/` | `main.css`, `animations.css` (Tailwind) |
| `types/` | `auth.d.ts`, `index.d.ts` |

## Routing and guards

- `/` is a landing page with a link to `/dashboard`; it is **not** a redirect.
- `middleware/auth.global.ts` redirects unauthenticated users to
  `/login?redirect=<fullPath>`; `/login` is the only public route.
- `middleware/admin.ts` is applied per page (`definePageMeta`) and sends a
  non-admin to `/dashboard`.
- **Both middlewares are UX only.** The server re-checks the role from the
  database (`requireAdmin`) and per-server permissions (`requireServer` +
  `needPerm`). Never treat a hidden button as an authorization control, and
  never remove the server check because the page already hides the action.
- A `403` from the API should go through `deny(e)` from
  [`composables/useNoAccess.ts`](composables/useNoAccess.ts), which opens the
  shared `NoAccessModal` instead of showing a raw error.

## Auth in the SPA

`useAuth()` comes from `@sidebase/nuxt-auth` (Auth.js provider,
`nuxt.config.ts → auth`). `status` is `loading | authenticated | unauthenticated`;
`session.user.role` is a cached hint for the UI, not proof.

Login is e-mail + password plus an optional TOTP field. A 2FA-enabled account
that tries OAuth is redirected to `/login?error=TwoFactorRequired` — surface that
error, do not hide it. First-run setup is handled on `/login` with
`PANEL_SETUP_TOKEN` (see `POST /api/setup/bootstrap`).

## Data access

- `$api` is a thin `$fetch.create` wrapper with a JSON content type
  ([`plugins/api.client.ts`](plugins/api.client.ts)). It is **client-only**, so a
  component that also renders on the server must use plain `$fetch` or
  `useFetch`. Do not assume `$api` exists during SSR.
- `usePanelName` uses `useFetch('/api/settings/public', { key: 'panel-name' })`
  and also provides `usePanelTitle(suffix)`.
- Pages call same-origin `/api/**` only. The panel adds the node token; the
  browser must never receive `nodes.token` or a password. Console, file
  transfer, and backup download are the exceptions: the page asks for a
  short-lived token from `/api/servers/<id>/ws-token` (or an equivalent route)
  and then talks to wings directly.
- `GET` routes must not have side effects. If an action mints a token or writes
  an activity row, it is a `POST`.

## Internationalization

- `plugins/i18n.ts` creates vue-i18n with `legacy: false`, `fallbackLocale:
  'en'`, and ten message bundles. `LANGS` is the canonical language list;
  `RTL_LOCALES = ['ar']`.
- The initial locale comes from the `panel-locale` cookie, then `localStorage`,
  then `en`. `useLocale().setLocale(code)` updates all three and persists via
  `PUT /api/account/locale`.
- Every user-visible string in a page or component must be a `$t('key')`, not
  hardcoded Russian or English. When you add a key, add it to **all ten** files;
  a missing key silently falls back to English, which looks like a bug in
  Russian.
- Russian is the primary language of the README and `docs/`, but the default UI
  locale is `en` (the plugin forces `en` when nothing is stored). Do not change
  that default as a side effect of a copy edit.
- `ar` is RTL: test layouts with `dir="rtl"`; do not hardcode `left`/`right`
  margins where logical properties or `flex` work.

## Styling

- Tailwind via `@nuxtjs/tailwindcss`; dark surfaces, emerald accents, rounded
  `2xl`/`3xl` cards. Reuse the existing utility vocabulary instead of adding a
  CSS file.
- Icons are inline SVG through `UiIcon` (`name` + optional sizing classes); it
  uses `v-html` on a local path table, not user input. Do not pass a dynamic
  string from the server into `UiIcon`.
- Keep interactive elements real `<button>`/`<a>` elements. `NuxtLink` for
  navigation; a `div` with `@click` loses keyboard access.

## Verification

```sh
npm run typecheck   # vue-tsc over app + server
npm run build       # catches SSR/bundling mistakes typecheck misses
npm run test:e2e    # Playwright against a built panel (needs Chromium)
```

There are **no unit tests for Vue components** (`vitest.config.ts` only includes
`tests/unit/**/*.test.ts` and measures `server/utils`). A UI change is verified
by typecheck, build, and either e2e or a manual browser check. Say which one you
actually ran.

`tests/e2e/panel.spec.ts` covers landing → dashboard, the login form, a rejected
login, the seeded admin login, and `/api/health`. Add a case there for a new
critical flow; do not claim a page is tested because the suite passed.
