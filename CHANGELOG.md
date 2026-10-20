# Changelog — cardinal-panel

Все значимые изменения панели. Формат основан на
[Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
версии — по [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

## [0.2.0] — 2026-10-21

### Added

- **Развёртывание панели на runtime cardinal.** Новый режим установщика
  `--install-mode cardinal`: образ `cardinal-panel:<версия>` собирается из
  релизного пакета через `cardinal build` (одна стадия — сборка `.output`
  уже готова, native-модулей нет, образ переносим между машинами), сервис
  поднимается через `cardinal up` по описанию `/etc/cardinal-panel/cardinal.toml`,
  миграции выполняются внутри контейнера (`cardinal exec`), включается
  boot-восстановление (`cardinal bootstrap --install`) — контейнер переживает
  перезагрузку хоста.
- **`Dockerfile.cardinal`** — образ для runtime cardinal: база `node:24-alpine`,
  непривилегированный пользователь `10001:10001`, `VOLUME /app/data`.
- **`packaging/cardinal/cardinal-panel.toml`** — описание сервиса для cardinal:
  `network_mode = "host"` (панели нужен доступ к wings на `127.0.0.1:8080`
  и SFTP на `:2022`, в мосте эти адреса указывают внутрь контейнера),
  именованный том `panel-data`, `cap_drop = ["ALL"]`, `no_new_privs = true`,
  healthcheck на `/api/health`.
- **Ключи установщика:** `--install-mode <cardinal|systemd>`,
  `--network <host|bridge>`, `--image-tag <тег>`.
- **Тесты развёртывания на cardinal** (8 шт.): compose-файл разбирается и
  содержит только поля, поддерживаемые схемой `cardinal/internal/config`;
  Dockerfile использует только инструкции, поддерживаемые билдером cardinal;
  все `COPY`-источники образа есть в релизном пакете. Схема и список
  инструкций продублированы в тесте намеренно — расхождение должно ломать
  CI панели, а не сборку образа.
- **Проверка TOML и Dockerfile настоящими парсерами cardinal.** Оба файла
  разобраны `cardinal/internal/config` и `cardinal/internal/builder` — схема
  и поддерживаемые инструкции подтверждены на настоящем коде рантайма.

### Fixed

- **`COPY output/` → `COPY .output/`** в `Dockerfile.cardinal`: каталог
  сборки называется `.output` (с точкой), как его кладёт Nitro. Сборка
  образа падала бы с «no such file or directory».

## [0.1.0] — 2026-10-20

### Added

- **Сборка и релиз:** пайплайн `build.yml` (lint → typecheck → тесты →
  сборка → `npm audit` → gitleaks) и `release.yml` (тег `v*` → артефакты
  `.tar.gz` + `.sha256` + SPDX-SBOM → GitHub Release).
- **Установщик** `install.sh`: ставит панель из GitHub Releases, проверяет
  SHA-256, создаёт пользователя и каталоги, генерирует
  `NEXTAUTH_SECRET`, накатывает миграции, включает systemd-юнит.
  Поддержаны `--version`, `--dir`, `--data-dir`, `--port`, `--no-start`,
  `--uninstall`.
- **Docker:** `Dockerfile` (multi-stage, Node 24, non-root, healthcheck) и
  `docker-compose.yml` с именованным томом под SQLite.
- **systemd-юнит** `packaging/systemd/cardinal-panel.service` с
  песочницей (`ProtectSystem=strict`, `NoNewPrivileges`, `PrivateTmp`).
  Секреты вынесены в отдельный `EnvironmentFile` с правами 0600, чтобы не
  светить их в `systemctl show`.
- **Эндпоинт здоровья** `GET /api/health`: версия, uptime и состояние БД.
  Без авторизации, чтобы балансировщик и Docker HEALTHCHECK отличали
  «панель сломалась» от «панель занята».
- **Юнит-тесты** (vitest) для `server/utils`: `clientip`, `password`,
  `pagination`, `ratelimit`, `oauth-seal` — 74 теста.
- **`scripts/sync-version.mjs`**: источник истины — файл `VERSION`,
  синхронизируется с `package.json`; режим `--check` для CI.
- **`scripts/package-release.mjs`**: сборка релизного пакета, контрольные
  суммы и SPDX-SBOM.
- **`scripts/simulate-install.mjs`**: прогон шагов `install.sh` в песочнице
  (распаковка → перенос → миграции → запуск сервера → health). Гоняется в
  CI, чтобы раскладка файлов после установки проверялась до выкладки на
  VPS, а не после.

### Security

- **Критических уязвимостей в production-зависимостях не осталось.**
  `npm audit fix` обновил транзитивные пакеты (`simple-git`,
  `fast-glob`, `globby`, `@nuxt/devtools`): было 4 critical → стало 0.
  Оставшиеся 14 high — исключительно build-инструментарий
  (`tailwindcss`, `chokidar`, `micromatch`, `esbuild`, `postcss`,
  `vite-builder`), в рантайм запросов они не попадают и ломающей
  правки без смены мажорных версий не имеют. Гейт CI —
  `npm audit --audit-level=critical --omit=dev`; полный отчёт
  сохраняется артефактом.

### Fixed

- **IPv6-адреса склеивались в один rate-limit бакет.** `normalizeIp` в
  `server/utils/clientip.ts` отбрасывал «порт» у голого IPv6:
  `fe80::1` нормализовался в `fe80:`, поэтому все адреса с одинаковым
  префиксом делили один счётчик попыток входа. IPv6 в квадратных скобках
  с портом (`[2001:db8::1]:443`) разбирался неверно.
- **Typecheck падал** на опции `cookie` в `nuxt.config.ts`: она осталась
  от API `@sidebase/nuxt-auth` v0 и не поддерживается в v1. Удалена как
  мёртвая конфигурация.
- **Health-эндпоинт проверял БД неверным методом** (`db.execute` есть
  только у mysql2-драйвера, у sqlite-proxy — `db.all`): панель всегда
  отдавала 503. Теперь выбирается метод по диалекту.

[Unreleased]: https://github.com/animesao/cardinal-panel/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/animesao/cardinal-panel/releases/tag/v0.1.0
