# Разработка cardinal-panel

- [Требования](#требования)
- [Запуск](#запуск)
- [Проверки](#проверки)
- [Структура проекта](#структура-проекта)
- [База данных и миграции](#база-данных-и-миграции)
- [Релизный процесс](#релизный-процесс)
- [Как устроен релиз](#как-устроен-релиз)
- [Чек-лист перед релизом](#чек-лист-перед-релизом)
- [Секреты](#секреты)

---

## Требования

| | |
|---|---|
| Node.js | **24** (встроенный `node:sqlite`) |
| npm | 11+ |
| Для E2E | Chromium через `npx playwright install chromium` |
| Для shell-скриптов | `shellcheck` (в CI ставится автоматически) |

---

## Запуск

```bash
git clone https://github.com/animesao/cardinal-panel.git
cd cardinal-panel
npm ci
cp .env.example .env
npm run db:migrate
npm run create-admin -- --email=dev@example.com
npm run dev
```

Панель откроется на <http://localhost:3000>.

`npm ci` выполняет `postinstall`: патчит `next-auth` (`patch-next-auth-core.mjs`)
и готовит типы (`nuxt prepare`). Без патча next-auth v4 не работает с
текущей версией Nuxt.

---

## Проверки

| Команда | Что делает |
|---|---|
| `npm run lint` | Проверка относительных импортов в `server/**` (своя проверка, `scripts/check-imports.mjs`) |
| `npm run lint:shell` | `shellcheck` для `install.sh` |
| `npm run typecheck` | `vue-tsc` по всему проекту |
| `npm test` | Юнит-тесты (vitest) |
| `npm run test:watch` | То же в watch-режиме |
| `npm run test:coverage` | Покрытие (v8) |
| `npm run test:e2e` | Сквозные тесты (Playwright) по собранной панели |
| `npm run test:install` | Симуляция установки: распаковка → миграции → запуск → health |
| `npm run check:secrets` | Секреты в отслеживаемых файлах |
| `npm run ci` | lint → typecheck → test → build (ровно то, что гоняет CI) |

Полный набор (как в CI):

```bash
npm run lint && npm run lint:shell && npm run check:secrets \
  && npm run typecheck && npm test && npm run build \
  && npm run test:e2e && npm run test:install
```

### Структура тестов

```
tests/
├── setup.ts            заглушки Nuxt auto-import'ов (createError)
├── unit/               юнит-тесты (vitest) — по модулю на файл
└── e2e/                сквозные (playwright) — по собранной панели
```

Сквозные тесты поднимают **production-сборку** на временной БД
(`scripts/e2e-server.mjs`): готовятся миграции, создаётся администратор,
запускается `.output/server/index.mjs`.

---

## Структура проекта

```
app/                    клиент (Nuxt 4, srcDir)
├── pages/              страницы: login, dashboard, admin/…
├── components/         Vue-компоненты
├── composables/        Composition API
├── layouts/            оболочки
├── locales/            11 языков: en, ru, de, fr, es, pt, zh, ja, ar, hi, …
├── middleware/         клиентские middleware
└── plugins/            Nuxt-плагины

server/                 сервер (Nitro)
├── api/                HTTP-обработчики
│   ├── account/        профиль, 2FA, API-ключи, история входов
│   ├── admin/          админка: узлы, серверы, пользователи, настройки
│   ├── auth/[...].ts   NextAuth: OAuth + вход по паролю
│   ├── remote/         колбэки от wings (автозапуск, SFTP, бэкапы)
│   ├── servers/        API сервера для его владельца
│   ├── v1/             Pterodactyl-совместимый Client API
│   ├── health.get.ts   проверка живости
│   └── setup/          первичная настройка
├── db/                 схема, подключение, миграции
├── middleware/         auth-ratelimit, admin
├── plugins/            планировщик расписаний
└── utils/              clientip, password, ratelimit, pagination, wings, …

scripts/                служебные скрипты (см. ниже)
packaging/              systemd-юнит, nginx-шаблон, compose для cardinal
tests/                  тесты
docs/                   документация
```

### Скрипты

| Скрипт | Назначение |
|---|---|
| `create-admin.mjs` | Создать/повысить администратора |
| `migrate-sqlite.mjs` | Применить миграции SQLite |
| `admin-api-key.mjs` | Выпустить/отозвать API-ключ |
| `check-db-connection.mjs` | Проверить соединение с БД |
| `check-imports.mjs` | Линтер относительных импортов в `server/**` |
| `check-no-secrets.mjs` | Секреты в отслеживаемых файлах |
| `package-release.mjs` | Сборка релизного пакета, `.sha256`, SPDX-SBOM |
| `simulate-install.mjs` | Симуляция установки (распаковка → миграции → запуск) |
| `e2e-server.mjs` | Подъём production-сборки для Playwright |
| `sync-version.mjs` | Синхронизация `VERSION` и `package.json` |
| `patch-next-auth-core.mjs` | Патч next-auth под Nuxt 4 |

---

## База данных и миграции

Схема — `server/db/schema.ts` (drizzle). Диалект выбирается по
`DB_DIALECT`.

Сгенерировать миграцию после изменения схемы:

```bash
# SQLite
npm run db:generate

# MySQL
npm run db:generate:mysql
```

Применить:

```bash
npm run db:migrate          # SQLite
npm run db:migrate:mysql    # MySQL
```

Миграции идемпотентны: применённые теги пишутся в `__kt_migrations` и
пропускаются при повторном запуске.

> **Важно:** скрипты панели берут путь к БД из `/etc/cardinal-panel/panel.env`,
> если `SQLITE_PATH` не задан в окружении. Без этого (до 0.5.4) скрипты
> писали в `./data/panel.sqlite`, а панель читала
> `/var/lib/cardinal-panel/panel.sqlite` — admin создавался не в той базе.

---

## Релизный процесс

Версия живёт в файле `VERSION` — это источник истины. `package.json`
синхронизируется скриптом.

```bash
# 1. поднять версию
echo "0.6.0" > VERSION
npm run release:version

# 2. описать изменения
$EDITOR CHANGELOG.md

# 3. закоммитить и запушить
git commit -am "chore(release): v0.6.0"
git push origin main

# 4. поставить тег — это запускает публикацию
git tag -a v0.6.0 -m "cardinal-panel v0.6.0"
git push origin v0.6.0
```

Тег `v*` запускает `.github/workflows/release.yml`: сборка → упаковка →
GitHub Release с артефактами и SBOM.

**Тег обязан совпадать с `VERSION`** — иначе релиз не создастся.

### Как устроен релиз

`.output` (23 МБ) упаковывается в `.tar.gz` вместе с `scripts/`,
миграциями, `packaging/`, `package.json` и `VERSION`.

Упаковщик копирует файлы с `dereference: true`: npm на Windows
дедуплицирует пакеты через junction'ы, и без dereference в архив попадают
**ссылки на виндовые абсолютные пути** — на Linux они битые, и Node падает
с `Cannot read package config`. Упаковщик дополнительно проверяет, что
в архиве не осталось ссылок, и обрывает сборку, если они есть.

Артефакты релиза:

| Файл | Что это |
|---|---|
| `cardinal-panel-<version>.tar.gz` | Панель для установки |
| `cardinal-panel-<version>.tar.gz.sha256` | Контрольная сумма |
| `cardinal-panel-<version>.sbom.json` | SPDX-SBOM по дереву зависимостей |

---

## Чек-лист перед релизом

- [ ] `npm run ci` — зелёное
- [ ] `npm run test:e2e` — зелёное
- [ ] `npm run test:install` — зелёное
- [ ] `npm run check:secrets` — зелёное
- [ ] `npm run lint:shell` — зелёное
- [ ] `VERSION` обновлён, `npm run release:version -- --check` проходит
- [ ] `CHANGELOG.md` описывает изменения
- [ ] Миграции (если менялась схема) применены и проверены
- [ ] Документация обновлена: `docs/`, `README.md`

---

## Секреты

- Секреты — только в `.env` и `/etc/cardinal-panel/panel.env`. Никогда в
  git.
- `npm run check:secrets` проверяет отслеживаемые файлы на типичные
  литералы (`NEXTAUTH_SECRET=`, `DB_PASSWORD=`, GitHub-токены,
  приватные ключи) и запускается в CI.
- `gitleaks` сканирует историю репозитория.
- Пароли пользователей — scrypt. API-ключи — только SHA-256. OAuth-секреты
  — AES-256-GCM.

> Токены узлов wings, SFTP-пароли и пароли хостов БД хранятся в базе
> **открытым текстом**. Для мультиарендного размещения это стоит исправить
> тем же `oauth-seal`, что уже используется для OAuth.

---

Дальше: [установка](INSTALL.md) · [настройка](CONFIGURE.md) ·
[безопасность](../SECURITY.md) · [эксплуатация](OPERATIONS.md)
