# TODO — паритет с механиками Pterodactyl API

Сравнение `Client /api/client` + `Application /api/application` + WS против
`panel` (`server/api/**`) и `cardinal-wings` (`/v1/*`). Дата: 16.10.2026.

## Приоритет 1 — дёшево, заметно

- [x] **Suspend/unsuspend серверов** — сделано (см. выше).
- [x] **Создание файлов в файловом менеджере** — кнопка «Новый файл» +
  модалка (`ServerFiles.vue`: `createFile` → `POST .../files/write` с пустым
  контентом → сразу открывается редактор; существующий файл просто открывается).
  Ключ `files.newFile` во всех 10 языках. Отдельного бэкенд-роута не понадобилось.

- [x] **Suspend/unsuspend серверов** — как `POST /api/application/servers/{id}/suspend`.
  Панель: флаг `servers.suspended` (миграция `0018`) + проверка в `power.post.ts`
  (сессия и `/api/v1`, 403) + исключение из `autostart` + бейдж в UI
  (дашборд, страница сервера, админка) + `POST /api/admin/servers/[id]/suspend|unsuspend`.
- [x] **Ротация пароля БД** — `POST /api/servers/[id]/databases/[dbId]/password`
  (право `database.create`): новый пароль сначала на хост (`ALTER USER` + verify),
  затем в БД; кнопка в карточке базы + запись в activity.
- [x] **Переименование/описание сервера юзером** — `PUT /api/servers/[id]/settings`
  (только владелец/админ, без новых прав): карандаш в шапке сервера + модалка,
  запись в activity. Ключи `server.settings.*` в 10 языках.

## Приоритет 2 — средне

- [x] **Schedules (cron-задачи)** — таблица `schedules` (миграция `0019`) +
  CRUD `GET/POST /api/servers/[id]/schedules`, `PUT/DELETE .../[schedId]`,
  `POST .../run` (только владелец/админ) + исполнитель `server/plugins/scheduler.ts`
  (тик 60с, power через wings lifecycle, команды через wings exec, замороженные
  пропускаются) + вкладка «Расписание». Ключи в 10 языках.
- [x] **Выпуск API-ключей юзером** — как Client API keys (`/account/api`).
  Панель: `GET/POST/DELETE /api/account/api-keys` (свои ключи, секрет один раз),
  уровни из `API_RESOURCES`, админские ресурсы не-админу — 403 + секция
  «API-ключи» в аккаунте. Ключи `account.apiKeys*` в 10 языках.
- [x] **Users admin: полный CRUD** — `GET /api/admin/users/[id]`,
  `PUT /api/admin/users/[id]` (имя/почта/роль/пароль, защита последнего админа),
  `DELETE /api/admin/users/[id]` (не себя/последнего админа/владельца серверов) +
  `DELETE` в `KEY_POLICY` + правка/удаление в `admin/users.vue`.
  Ключи `usersAdmin.edit*/delete*` в 10 языках.
- [x] **`POST .../command`** — отправка команды REST'ом (раньше только через WS).
  Панель: `POST /api/servers/[id]/command` (сессия, `control.console`) и
  `POST /api/v1/servers/[uuid]/command` (ключ `servers.write` + `control.console`),
  прокси в wings `POST /v1/containers/<ref>/terminal[/input]` (stdin игры,
  не docker exec) + `console.command` в activity (`activity.actions.consoleCommand`).

## Приоритет 3 — крупно / опционально

- [x] **2FA (TOTP)** — таблица `user_totp` (миграция `0020`, sqlite+mysql) +
  `server/utils/totp.ts` (RFC 6238, окно ±1 шаг, резервные коды) +
  `GET/POST /api/account/2fa/*` (setup по паролю → QR + секрет → confirm кодом → коды один раз,
  disable/regen по паролю) + проверка в Credentials-авторизации
  (`2FA_REQUIRED/INVALID/THROTTLED`, троттлинг 10/5мин, резервные коды сгорают) +
  двухшаговый логин + секция в аккаунте + бейдж в админке (`totpEnabled` в
  `/api/admin/users` и `/api/v1/users`). OAuth-входы 2FA не касается.
  Ключи `login.twoFa*`, `account.twoFa*` в 10 языках.
- [x] **Пагинация в стиле Pterodactyl** (`page/per_page`, `filter[]`, `include[]`)
  вместо `limit/offset` — каснуть `/api/v1/*` и списки админки.
  Готово совместимо: `server/utils/pagination.ts` (`parseListQuery`,
  `listResponse`, `pageAliases`) — без `page/per_page` ответ как раньше
  (голый массив), с ними — конверт
  `{data, meta: {pagination: {total, count, per_page, current_page, total_pages}}}`,
  плюс `filter[field]=` (подстрока по whitelist) и `sort=[-]field`.
  Применено к 8 листам `/api/v1/*` (servers, users, nodes, allocations,
  locations, blueprints, database-hosts, server-databases) и 3 спискам админки
  (servers, users, nodes); `logins` и `activity` понимают `page/per_page`
  как алиасы (формат с `X-Total-Count` без изменений).
  `include[]` не нужен: связи (нода, аллокация, владелец) уже встроены в ответы.
- [x] **Rate limiting публичного API** — сейчас только auth-уровни ключа.
  Готово: `server/utils/ratelimit.ts` (token bucket 60/мин на ключ) +
  проверка в `resolveApiKey` (одна точка для `/api/v1/*` и Bearer-доступа),
  заголовки `X-RateLimit-Limit/Remaining`, 429 + `Retry-After`.

## Уже есть (не трогать)

Power start/stop/restart/kill, WS-консоль + ws-token, файлы (CRUD+архивы),
бэкапы (CRUD+download/restore), базы (CRUD), порты (+primary), субпользователи
(+пресеты, личные SFTP-креды), startup/environment/setup, reinstall,
ноды/аллокации (+detect/sync/usage), локации, чертежи (+импорт яиц),
API-ключи со скоупами, activity-лог, SFTP, автозапуск, колбэки wings→панель.
