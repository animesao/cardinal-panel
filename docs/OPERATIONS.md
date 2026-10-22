# Эксплуатация cardinal-panel

Документ для оператора: как панель устроена в системе, что где лежит,
как её обновлять, бэкапить, мониторить и снимать. Диагностика конкретных
симптомов — в [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

Панель не управляет контейнерами напрямую: рантайм — **cardinal**,
агент на каждой ноде — **cardinal-wings**. Панель отвечает за учётные
записи, ноды, чертежи, аллокации и проксирует команды в wings.

## Содержание

- [Где что лежит](#где-что-лежит)
- [Режимы развёртывания](#режимы-развёртывания)
- [systemd-юнит](#systemd-юнит)
- [Автозапуск](#автозапуск)
- [Логи](#логи)
- [Конфигурация: panel.env](#конфигурация-panelenv)
- [Секреты](#секреты)
- [Бэкап и восстановление](#бэкап-и-восстановление)
- [Ротация бэкапов](#ротация-бэкапов)
- [Мониторинг](#мониторинг)
- [Обслуживание wings-узла](#обслуживание-wings-узла)
- [Лимиты ресурсов](#лимиты-ресурсов)
- [Безопасный перезапуск](#безопасный-перезапуск)
- [Обновление панели](#обновление-панели)
- [Регулярное обслуживание](#регулярное-обслуживание)
- [Снятие панели](#снятие-панели)
- [Скрипты панели](#скрипты-панели)
- [Шпаргалка команд](#шпаргалка-команд)

## Где что лежит

| Что | Путь | Комментарий |
|---|---|---|
| Каталог установки | `/opt/cardinal-panel` | `.output/`, `scripts/`, `server/`, `packaging/`; владелец `cardinal` |
| База панели (SQLite) | `/var/lib/cardinal-panel/panel.sqlite` | рядом `panel.sqlite-wal` и `panel.sqlite-shm`, пока панель работает |
| Каталог данных | `/var/lib/cardinal-panel` | права `0750`, владелец `cardinal` |
| Конфигурация и секреты | `/etc/cardinal-panel/panel.env` | права `0600`, владелец `cardinal` |
| systemd-юнит (установленный) | `/etc/systemd/system/cardinal-panel.service` | генерируется установщиком из шаблона в релизе |
| Шаблон юнита в релизе | `/opt/cardinal-panel/packaging/systemd/cardinal-panel.service` | `sed`-подстановки путей делает `install.sh` |
| nginx: vhost панели | `/etc/nginx/sites-available/cardinal-panel.conf` (+ симлинк в `sites-enabled`) | на RHEL/Alpine — `/etc/nginx/conf.d/cardinal-panel.conf` |
| nginx: карта WebSocket | `/etc/nginx/conf.d/cardinal-panel-upgrade-map.conf` | `$connection_upgrade` — без неё WS не поднимается |
| Compose-файл cardinal | `/etc/cardinal-panel/cardinal.toml` | только в режиме `--install-mode cardinal` |
| Том cardinal | `panel-data` | SQLite внутри контейнера: `/app/data/panel.sqlite` |
| Логи | journald | `journalctl -u cardinal-panel`; файлов логов панель не пишет |
| Версия | `/opt/cardinal-panel/VERSION` | источник истины, дублируется в `package.json` |

Панель слушает **только `127.0.0.1`** (`NITRO_HOST=127.0.0.1`) — наружу её
выпускает nginx. Порт по умолчанию `3000`.

## Режимы развёртывания

| Режим | Что это | Управление | Где база |
|---|---|---|---|
| **systemd** (по умолчанию) | родной процесс Node на хосте | `systemctl {start\|stop\|restart} cardinal-panel` | файл на хосте: `/var/lib/cardinal-panel/panel.sqlite` |
| **cardinal** (`--install-mode cardinal`) | контейнер на runtime cardinal, образ `cardinal-panel:<версия>` | `cardinal up/down -f /etc/cardinal-panel/cardinal.toml`, `cardinal logs panel` | именованный том `panel-data` |
| **Docker** | `Dockerfile` + `docker-compose.yml` | `docker compose up -d` | именованный том `panel-data` |

Во всех режимах конфиг один и тот же — `/etc/cardinal-panel/panel.env`
(в Docker — `.env` рядом с `docker-compose.yml`). В режиме cardinal
`SQLITE_PATH` указывает внутрь контейнера (`/app/data/panel.sqlite`).

## systemd-юнит

Юнит ставится установщиком и включается в автозапуск. Ключевые строки:

```ini
[Service]
Type=simple
User=cardinal
Group=cardinal
WorkingDirectory=/opt/cardinal-panel

# Секреты НЕ кладутся в Environment= файла юнита: они попадают в
# `systemctl show` и в /proc/<pid>/environ. У оператора есть отдельный
# файл /etc/cardinal-panel/panel.env с правами 0600.
EnvironmentFile=-/etc/cardinal-panel/panel.env
Environment=NODE_ENV=production
Environment=NITRO_HOST=127.0.0.1
Environment=NITRO_PORT=3000
Environment=DB_DIALECT=sqlite
Environment=SQLITE_PATH=/var/lib/cardinal-panel/panel.sqlite

ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30
```

| Параметр | Значение |
|---|---|
| `EnvironmentFile=-…` | минус перед путём — файл необязательный: сервис стартует и без него, но без `NEXTAUTH_SECRET` вход не работает |
| `Environment=` | дефолты хоста/порта/диалекта/пути к БД; значения из `panel.env` их перекрывают |
| `Restart=on-failure` | после падения процесс поднимается через 5 с; штатная остановка — нет |
| `TimeoutStopSec=30` | 30 с на graceful-закрытие (SIGTERM) перед `SIGKILL` |
| `KillSignal=SIGTERM` | корректное завершение: не обрывать WS-консоли и запросы |

### Песочница процесса

Панель запущена под ограничениями ядра Linux:

| Директива | Что даёт |
|---|---|
| `ProtectSystem=strict` | вся ФС только на чтение |
| `ReadWritePaths=/var/lib/cardinal-panel` | единственный каталог, куда можно писать (БД) |
| `PrivateTmp=true` | свой `/tmp` |
| `PrivateDevices=true` | без доступа к устройствам |
| `ProtectHome=true` | домашние каталоги не видны |
| `ProtectKernelTunables`, `ProtectKernelModules`, `ProtectControlGroups` | нельзя трогать параметры ядра и cgroup |
| `NoNewPrivileges=true` | процесс не может повысить привилегии |
| `RestrictSUIDSGID`, `RestrictRealtime`, `LockPersonality` | запрет suid-битов, realtime-приоритетов и смены personality |

Практический вывод: если панели понадобилось писать куда-то ещё (например,
кастомный каталог под логи), это не сработает без правки юнита — сначала
проверь `journalctl -u cardinal-panel -n 50` на `EROFS: read-only file system`.
Логи наружу не пишутся: stdout/stderr идут в journald.

## Автозапуск

```bash
systemctl is-enabled cardinal-panel   # ожидается: enabled
systemctl enable cardinal-panel       # включить, если выключен
```

Юнит подключён к `multi-user.target` — панель поднимается при загрузке
хоста. `WantedBy=multi-user.target` в `[Install]`.

В режиме cardinal автозапуск настраивается runtime:

```bash
cardinal bootstrap --install   # boot-восстановление контейнера панели
```

Docker-режим: `restart: unless-stopped` в `docker-compose.yml` — демон
Docker поднимает контейнер после перезагрузки хоста.

Проверка после перезагрузки:

```bash
systemctl status cardinal-panel
curl -fsS http://127.0.0.1:3000/api/health
```

## Логи

Панель пишет в journald, `SyslogIdentifier=cardinal-panel`.

```bash
journalctl -u cardinal-panel -f                  # живой хвост
journalctl -u cardinal-panel -n 50               # последние 50 строк
journalctl -u cardinal-panel --since "1 hour ago"
journalctl -u cardinal-panel -p err             # только ошибки
journalctl -u cardinal-panel --since "2026-10-21 10:00" --until "2026-10-21 11:00"
journalctl -u cardinal-panel --disk-usage        # сколько места занимает журнал
```

В режиме cardinal журнал контейнера — через runtime:

```bash
cardinal logs panel
```

Журнал растёт без ограничений, пока его не у vacuum'нут:

```bash
journalctl --vacuum-size=50M    # оставить 50 МБ
journalctl --vacuum-time=7d     # оставить недельные записи
```

## Конфигурация: panel.env

Файл `/etc/cardinal-panel/panel.env` (0600, владелец `cardinal`) — единственное
место, где лежат секреты панели. Формат: `KEY=VALUE`, значения в кавычках
допустимы, `#` начинает комментарий.

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `NEXTAUTH_SECRET` | **обязателен.** Подпись сессий и ключ шифрования секретов в БД (OAuth Client Secret, 2FA-секреты) | генерируется установщиком |
| `NUXT_PANEL_URL` | публичный адрес панели: уходит в wings (`POST /v1/config`) и в OAuth-колбэки | `http://localhost:3000` без `--domain` |
| `NEXTAUTH_URL` | origin для next-auth | равен публичному адресу |
| `AUTH_ORIGIN` | origin для next-auth (с путём `/api/auth`) | `<публичный адрес>/api/auth` |
| `DB_DIALECT` | `sqlite` или `mysql` | `sqlite` |
| `SQLITE_PATH` | путь к файлу SQLite | `/var/lib/cardinal-panel/panel.sqlite` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | подключение к MySQL | — |
| `NITRO_HOST` | адрес, который слушает панель | `127.0.0.1` |
| `NITRO_PORT` | порт панели | `3000` |
| `TRUSTED_PROXY` | список доверенных обратных прокси через запятую | `127.0.0.1,::1` |
| `PANEL_SETUP_TOKEN` | одноразовый токен первичной настройки (`POST /api/setup/bootstrap`) | — |
| `DEBUG` | отладочный режим | `false` |

Про `TRUSTED_PROXY`: IP клиента берётся из `X-Forwarded-For` **только** если
соединение пришло с одного из перечисленных адресов (см.
`server/utils/clientip.ts`). Иначе берётся адрес TCP-сокета. Если панель
за nginx, а в `TRUSTED_PROXY` нет адреса nginx — троттлинг входа будет
считать всех клиентов одним адресом.

### Правка конфигурации

```bash
sudo -u cardinal nano /etc/cardinal-panel/panel.env   # или sudoedit
sudo systemctl restart cardinal-panel
curl -fsS http://127.0.0.1:3000/api/health
```

Правка `panel.env` без перезапуска не действует: переменные читаются
процессом при старте. Юнит перезапускать нужно и после смены
`NITRO_PORT` (и nginx-конфига под него), и после смены `SQLITE_PATH`.

### Первичная настройка

Первого администратора заводит оператор — одним из двух способов:

```bash
# 1. Через CLI (доступ к БД на хосте)
cd /opt/cardinal-panel && node scripts/create-admin.mjs --email=you@example.com
```

2. Через форму на странице входа: `POST /api/setup/bootstrap` с
   `PANEL_SETUP_TOKEN` из `panel.env`. Маршрут работает **один раз** — после
   появления админа он отвечает 403 «Панель уже инициализирована».
   После первичной настройки `PANEL_SETUP_TOKEN` из `panel.env` убирают.

Пароль при первом варианте генерируется и печатается **один раз** — сохраните
его сразу.

## Секреты

- Секреты лежат только в `/etc/cardinal-panel/panel.env` (0600) и в БД
  панели (в зашифрованном виде — AES-256-GCM, ключ из `NEXTAUTH_SECRET`).
- В юнит секреты **не кладутся**: `Environment=` видно в `systemctl show` и
  в `/proc/<pid>/environ`.
- `NEXTAUTH_SECRET` установщик сохраняет при переустановке и обновлении —
  сессии не разламываются.

### Смена `NEXTAUTH_SECRET`

Секрет — не просто подпись cookie. Из него выводится ключ шифрования
значений в БД, поэтому его смена ломает:

- все активные сессии (все разлогиниваются);
- сохранённые OAuth Client Secret (`oauth_*_secret`) — их придётся ввести
  заново в Admin → Настройки;
- 2FA-секреты (`user_totp.secret`) — включённый TOTP перестанет
  проверяться, пользователям придётся включать его заново.

Порядок: выдать новый секрет, перезапустить панель, заново внести OAuth
секреты, попросить пользователей перевключить 2FA. Если это не нужно —
не меняйте.

### Что бэкапить из секретов

`panel.env` бэкапится вместе с БД панели: без `NEXTAUTH_SECRET` из
бэкапа восстановленная панель не расшифрует OAuth-секреты и 2FA.

## Бэкап и восстановление

### Что бэкапить

| Объект | Как | Куда |
|---|---|---|
| БД панели (SQLite) | `.backup` из `sqlite3` или копия при остановленной панели | `/var/backups/cardinal-panel/` |
| БД панели (MySQL) | `mysqldump` | `/var/backups/cardinal-panel/` |
| `panel.env` | копия, права 0600 | `/var/backups/cardinal-panel/` |
| Код панели | не нужен: ставится релизом | — |
| **Бэкапы игровых серверов** | **делает wings, не панель** | снимаются на самих нодах |

Панель хранит в БД только метаданные бэкапов (статус, размер, чек-сумма);
сами снапшоты игровых серверов лежат на ноде и панель их не копирует.

### Бэкап SQLite

Рабочая база — в режиме WAL, поэтому простое копирование `panel.sqlite`
на живой панели может потерять последние транзакции. Два правильных
способа:

```bash
# каталог для бэкапов (создать один раз)
sudo mkdir -p /var/backups/cardinal-panel
sudo chown cardinal:cardinal /var/backups/cardinal-panel

# Способ 1: онлайн, без остановки панели (предпочтительно)
sudo -u cardinal sqlite3 /var/lib/cardinal-panel/panel.sqlite \
  ".backup '/var/backups/cardinal-panel/panel-$(date +%F).sqlite'"

# Способ 2: с остановкой панели
sudo systemctl stop cardinal-panel
sudo -u cardinal cp -a /var/lib/cardinal-panel/panel.sqlite \
  /var/backups/cardinal-panel/panel-$(date +%F).sqlite
sudo systemctl start cardinal-panel
```

Если копировать вручную при работающей панели — берите **все три** файла:
`panel.sqlite`, `panel.sqlite-wal`, `panel.sqlite-shm`.

### Бэкап MySQL

```bash
mysqldump -h <DB_HOST> -u <DB_USER> -p <DB_NAME> \
  | gzip > /var/backups/cardinal-panel/panel-$(date +%F).sql.gz
```

### Восстановление

```bash
sudo systemctl stop cardinal-panel
sudo cp -a /var/backups/cardinal-panel/panel-2026-10-21.sqlite \
  /var/lib/cardinal-panel/panel.sqlite
sudo rm -f /var/lib/cardinal-panel/panel.sqlite-wal /var/lib/cardinal-panel/panel.sqlite-shm
sudo chown cardinal:cardinal /var/lib/cardinal-panel/panel.sqlite
sudo chmod 0640 /var/lib/cardinal-panel/panel.sqlite
sudo systemctl start cardinal-panel
curl -fsS http://127.0.0.1:3000/api/health
```

После восстановления проверьте журнал миграций — таблица `__kt_migrations`
должна содержать применённые теги:

```bash
sudo -u cardinal sqlite3 /var/lib/cardinal-panel/panel.sqlite \
  "SELECT tag FROM __kt_migrations ORDER BY applied_at;"
```

Если база отстала по схеме — прогоните миграции:

```bash
cd /opt/cardinal-panel && node scripts/migrate-sqlite.mjs
```

### Ротация бэкапов

Бэкапы без ротации съедают диск, а диск кончившийся — это «database or
disk is full» и упавшая панель. Ротацию бэкапов панели делает ОС, не сама
панель.

`/etc/logrotate.d/cardinal-panel`:

```
/var/backups/cardinal-panel/*.sqlite
/var/backups/cardinal-panel/*.sql.gz {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    su root root
}
```

Ручная чистка по возрасту (например, из cron):

```bash
find /var/backups/cardinal-panel -type f -name '*.sqlite*' -mtime +30 -delete
```

Сколько копий держать — решение оператора; для панели с парой десятков
серверов хватает недели ежедневных копий.

## Мониторинг

### Health-check

`GET /api/health` — единственный эндпоинт без авторизации, отвечает всегда:

```bash
curl -sS http://127.0.0.1:3000/api/health
```

```json
{
  "status": "ok",
  "version": "0.6.4",
  "uptimeSeconds": 8123,
  "timestamp": "2026-10-21T12:00:00.000Z",
  "database": "ok",
  "disk": {
    "freeMb": 8421,
    "path": "/var/lib/cardinal-panel",
    "warnMb": 512
  }
}
```

Раздел `disk` — свободное место на разделе с базой. Когда его меньше
`warnMb` (512 МиБ), `status` становится `degraded`, а в `disk.warning`
появляется причина. HTTP остаётся 200: панель продолжает отдавать
страницы, но **запись в БД уже падает** с «database or disk is full».
Проверяйте это место, а не только код ответа:

```bash
curl -sS http://127.0.0.1:3000/api/health | grep -A3 '"disk"'
```

| Код | Тело | Значит |
|---|---|---|
| 200 | `status: ok`, `database: ok` | панель жива, БД доступна |
| 503 | `status: degraded`, `database: unavailable`, поле `error` | процесс жив, но БД недоступна |

Health-check не требует авторизации специально: и балансировщик, и
HEALTHCHECK в Docker/cardinal должны отличать «панель сломалась» от
«панель занята».

### Свонинг

Базовый вариант — systemd-таймер. `/etc/systemd/system/panel-health.service`:

```ini
[Service]
Type=oneshot
ExecStart=/usr/bin/curl -fsS http://127.0.0.1:3000/api/health
```

и `/etc/systemd/system/panel-health.timer`:

```ini
[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now panel-health.timer
```

Ненулевой код возврата `curl -f` при 503 — сигнал для алерта. Внешний
монитор (Uptime Kuma, Prometheus node-exporter + blackbox, Nagios) должен
бить по **внешнему** адресу панели: `/api/health` на `127.0.0.1` не
проверит доступность снаружи.

### Что ещё стоит смотреть

| Показатель | Источник |
|---|---|
| Панель жива | `GET /api/health` |
| Место на диске с данными | `df -h /var/lib/cardinal-panel` |
| Место в журнале | `journalctl --disk-usage` |
| Ноды на связи | `GET /api/nodes/<id>/status` (в UI — Admin → Nodes) |
| События панели | вкладка «Активность» сервера |

## Обслуживание wings-узла

Нода — это узел с `cardinal-wings`. Панель хранит его URL и токен и сама
пушит в него свой публичный адрес (`POST /v1/config`) — так wings знает, куда
присылать колбэки бэкапов и проверки SFTP.

### Проверка связи

```bash
curl -sS http://127.0.0.1:3000/api/nodes/<id>/status
```

Эндпоинт опрашивает ноду (`/v1/version` и `/v1/system/info`). В UI то же
видно в Admin → Nodes: статус и реальные ресурсы ноды.

### Синхронизация ресурсов ноды

Память и диск ноды в БД панели протухают. Кнопка «Синхронизировать» в
Admin → Nodes вызывает `POST /api/admin/nodes/<id>/sync`: панель опрашивает
wings `/v1/system/info` и записывает реальные значения. Swap wings не
отдаёт — его заносят вручную.

### Нода перестала подтверждать связь

1. Проверить, что wings запущен и слушает: `curl -sS http://<узел>:8080/v1/version`.
2. Сверить URL и токен ноды в Admin → Nodes с тем, что выдал установщик
   wings.
3. Перевыпустить токен на стороне wings и обновить его в панели.
4. Нажать «Синхронизировать» — панель заново запушит свой URL ноде.

### Последствия недоступности панели для ноды

- **Автозапуск серверов не сработает.** При загрузке wings спрашивает
  `GET /api/remote/autostart` (токен ноды) и поднимает помеченные
  контейнеры. Если панель недоступна, проход молча пропускается — после
  ребута хоста серверы останутся выключенными.
- **Колбэки бэкапов не придут**: `POST /api/remote/backups/<uuid>` —
  снапшот создастся, но статус в панели останется `creating`.
- **Проверки SFTP-логина** (`POST /api/remote/sftp/auth`) не пройдут.
- При этом сами контейнеры продолжают работать: панель их не держит.

Поэтому недоступность панели на долгий срок стоит считать инцидентом
уровня сервиса, даже если игровые серверы живы.

### Бэкапы игровых серверов

Снапшоты делает wings на самой ноде. Панель только инициирует
(`POST /v1/backup`), показывает статус и даёт скачать
(`GET /download/backup?token=`). Место под снапшоты на ноде — её диск;
панель его не раздаёт. Следите за `df -h` на ноде.

## Лимиты ресурсов

Лимиты сервера живут в двух местах: в БД панели (источник правды) и в
контейнере на ноде.

| Лимит | Единица | Где применяется |
|---|---|---|
| `memory` | МБ | сразу в cgroup |
| `cpu` | %, где 100 = 1 ядро | сразу в cgroup |
| `disk` | МБ | **со следующего рестарта контейнера** |
| `swap`, `io` | МБ / вес | только в БД — cardinal их не умеет |
| `portSlots`, `backupSlots`, `databaseSlots` | штуки | только в БД; 0 = безлимит |
| `autoStart` | флаг | автозапуск контейнера при загрузке |

Меняются в UI (Админ → Серверы → Ресурсы) или через API:

```
PUT /api/admin/servers/<id>/resources
{ "memory": 2048, "cpu": 100, "disk": 10240, "swap": 0, "io": 500 }
```

Панель пишет значения в БД и затем пушит их в cardinal через
`POST /v1/containers/srv-<uuid>/limits`.

**Ответ 502 «Сохранено в БД, но нода не применила лимиты»** означает:
- в БД значения уже записаны;
- живая нода их не применила (нет связи с нодой, нода отвечает ошибкой).

Что делать: восстановить связь с нодой и повторить изменение; для дискового
лимита — перезапустить контейнер, иначе он применится только при следующем
рестарте.

## Безопасный перезапуск

```bash
sudo systemctl restart cardinal-panel
```

Юнит шлёт `SIGTERM` и ждёт до 30 с (`TimeoutStopSec=30`) — процесс
закрывает открытые WS-соединения и HTTP-запросы штатно. `restart`
безопасен для данных: SQLite в режиме WAL переживает перезапуск.

| Что делаем | Команда | Комментарий |
|---|---|---|
| Плавный рестарт | `systemctl restart cardinal-panel` | обычная операция после правки конфига |
| Остановить | `systemctl stop cardinal-panel` | нужно перед копированием БД «на живую» |
| Запустить | `systemctl start cardinal-panel` | — |
| Проверить | `curl -fsS http://127.0.0.1:3000/api/health` | 200 = жива |

Нюансы:

- `systemctl kill -s SIGKILL` — жёсткий вариант, только если процесс
  завис и не завершается за 30 с. После SIGKILL база может потребовать
  восстановления из WAL (SQLite разберётся сам при следующем открытии).
- В режиме cardinal перезапуск — `cardinal down -f /etc/cardinal-panel/cardinal.toml`
  и `cardinal up -f ...`; простое `cardinal restart` тоже допустимо.
- Перед рестартом **не удаляйте** `/opt/cardinal-panel/.output`: процесс
  работает с этими файлами (в журнале это выглядит как «Changing to the
  requested working directory failed» и серия рестартов).

## Обновление панели

Версия живёт в файле `VERSION` — он и есть источник истины.

### Обычное обновление (установщиком)

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash
```

Установщик сам:

1. скачивает архив релиза и проверяет SHA-256;
2. **останавливает сервис** перед заменой файлов (иначе процесс работает с
   удаляемыми чанками `.output` и падает в рестартном цикле);
3. заменяет `.output/`, `scripts/`, `server/`, `packaging/`;
4. сохраняет `NEXTAUTH_SECRET` из `panel.env`;
5. накатывает миграции БД;
6. включает и перезапускает юнит;
7. проверяет `/api/health`.

Миграции **идемпотентны**: применённые теги хранятся в таблице
`__kt_migrations`, повторный прогон показывает их как `- skip`, а не
применяет заново.

### Обновление вручную

```bash
VER=0.5.4
cd /tmp
curl -fLO https://github.com/animesao/cardinal-panel/releases/download/v${VER}/cardinal-panel-${VER}.tar.gz
curl -fLO https://github.com/animesao/cardinal-panel/releases/download/v${VER}/cardinal-panel-${VER}.tar.gz.sha256
sha256sum -c cardinal-panel-${VER}.tar.gz.sha256

sudo systemctl stop cardinal-panel
sudo tar -xzf cardinal-panel-${VER}.tar.gz
sudo rm -rf /opt/cardinal-panel/.output
sudo cp -a cardinal-panel-${VER}/.output /opt/cardinal-panel/.output
sudo cp -a cardinal-panel-${VER}/scripts /opt/cardinal-panel/scripts
sudo cp -a cardinal-panel-${VER}/server /opt/cardinal-panel/server
sudo cp -a cardinal-panel-${VER}/packaging /opt/cardinal-panel/packaging
sudo cp -a cardinal-panel-${VER}/VERSION /opt/cardinal-panel/VERSION
sudo cp -a cardinal-panel-${VER}/package.json /opt/cardinal-panel/package.json
sudo chown -R cardinal:cardinal /opt/cardinal-panel

cd /opt/cardinal-panel && sudo -u cardinal node scripts/migrate-sqlite.mjs
sudo systemctl start cardinal-panel
curl -fsS http://127.0.0.1:3000/api/health
```

Юнит после ручного обновления не меняется: он уже установлен в
`/etc/systemd/system/`.

### Откат

Отката схемы БД автоматически нет: миграции только вперёд. Если новая
версия не пошла — верните предыдущий релиз (файлы) и восстановите базу из
бэкапа, сделанного **до** обновления.

## Регулярное обслуживание

| Период | Что делать | Команда |
|---|---|---|
| Ежедневно | место на диске с данными | `df -h /var/lib/cardinal-panel` |
| Ежедневно | бэкап БД панели | `sqlite3 … ".backup …"` (см. выше) |
| Ежедневно | место в журнале | `journalctl --disk-usage` |
| Еженедельно | ротация бэкапов | `logrotate` / `find -mtime +30 -delete` |
| Еженедельно | здоровье панели и нод | `curl -fsS …/api/health`, Admin → Nodes |
| Еженедельно | свободное место в корне | `du -xh --max-depth=1 / \| sort -h \| tail -15` |
| Ежемесячно | проверка, что обновление доступно | `VERSION` в GitHub Releases против `cat /opt/cardinal-panel/VERSION` |
| Ежемесячно | ротация API-ключей | Admin → API-ключи: отозвать неиспользуемые |
| Ежемесячно | проверка бэкапа | развернуть копию в отдельный каталог и открыть |

## Снятие панели

```bash
cd /path/to/install.sh && sudo ./install.sh --uninstall
```

Что делает снятие:

| Объект | Судьба |
|---|---|
| systemd-юнит | останавливается, выключается, файл `/etc/systemd/system/cardinal-panel.service` удаляется, `systemctl daemon-reload` |
| `/opt/cardinal-panel` | удаляется |
| `/var/lib/cardinal-panel` | **удаляется** — БД панели теряется |
| `/etc/cardinal-panel/panel.env` | **остаётся** (в нём `NEXTAUTH_SECRET`) |
| контейнер cardinal и образы `cardinal-panel:*` | останавливаются и удаляются (`cardinal down`, `cardinal rmi`) |
| compose-файл `/etc/cardinal-panel/cardinal.toml` | удаляется |
| том `panel-data` | **остаётся** (в нём SQLite в режиме cardinal) |
| nginx-конфиг панели | **остаётся** — снять вручную |
| правила firewall | **остаются** — снять вручную |
| Node.js, nginx, certbot, avahi | **остаются** — установщик их ставил |

Сохранить каталог данных при снятии:

```bash
sudo KEEP_DATA=1 ./install.sh --uninstall
```

Снять nginx-конфиг вручную:

```bash
sudo rm -f /etc/nginx/sites-available/cardinal-panel.conf
sudo rm -f /etc/nginx/sites-enabled/cardinal-panel.conf
sudo rm -f /etc/nginx/conf.d/cardinal-panel-upgrade-map.conf
sudo nginx -t && sudo systemctl reload nginx
```

Снять правила firewall:

```bash
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
sudo ufw delete allow 5353/udp
```

## Скрипты панели

Скрипты `create-admin.mjs`, `migrate-sqlite.mjs` и `admin-api-key.mjs`
читают `/etc/cardinal-panel/panel.env` (через `scripts/lib/panel-env.mjs`),
поэтому работают с той же базой, что и панель. Путь к файлу можно
переопределить переменной `PANEL_ENV_FILE`. `check-db-connection.mjs`
работает с MySQL и берёт реквизиты из аргументов или из переменных
окружения (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

| Скрипт | Что делает |
|---|---|
| `node scripts/create-admin.mjs --email=you@example.com` | создаёт админа или повышает существующего до `admin`; пароль генерируется и печатается один раз (можно задать `--password=…`, `--name=…`) |
| `node scripts/migrate-sqlite.mjs` | применяет миграции SQLite к базе из `panel.env`; уже применённые — `- skip` |
| `node scripts/admin-api-key.mjs --email=… --scopes=nodes:2` | выпускает временный API-ключ (`TOKEN=`/`PREFIX=` печатаются один раз) |
| `node scripts/admin-api-key.mjs --revoke=cp_xxx` | отзывает ключ по префиксу |
| `node scripts/check-db-connection.mjs` | проверка соединения с MySQL-хостом: сеть, авторизация, база, права |

Опции скриптов:

| Скрипт | Опции |
|---|---|
| `create-admin.mjs` | `--email=` (обязателен), `--password=`, `--name=`, `--db=` |
| `migrate-sqlite.mjs` | `--db=`, `--dir=` (каталог миграций) |
| `admin-api-key.mjs` | `--email=`, `--name=`, `--scopes=ресурс:уровень` (уровни 0/1/2), `--revoke=` |
| `check-db-connection.mjs` | `--host/--port/--user/--password/--database`, `--url jdbc:mysql://…`, `--json`, `--help` |

Пример (выпуск ключа для интеграции и его отзыв):

```bash
cd /opt/cardinal-panel
node scripts/admin-api-key.mjs --email=admin@example.com --name=integrations --scopes=servers:2,nodes:1
node scripts/admin-api-key.mjs --revoke=cp_xxxxxxxxxxx
```

В режиме cardinal те же скрипты выполняются внутри контейнера:

```bash
cardinal exec panel node scripts/migrate-sqlite.mjs
```

## Шпаргалка команд

```bash
# Состояние
systemctl status cardinal-panel
systemctl is-enabled cardinal-panel
curl -sS http://127.0.0.1:3000/api/health

# Логи
journalctl -u cardinal-panel -f
journalctl -u cardinal-panel -n 50 -p err
journalctl --vacuum-size=50M

# Управление
sudo systemctl restart cardinal-panel
sudo systemctl stop cardinal-panel
sudo systemctl start cardinal-panel

# Миграции
cd /opt/cardinal-panel && node scripts/migrate-sqlite.mjs

# Админ
cd /opt/cardinal-panel && node scripts/create-admin.mjs --email=you@example.com

# Диагностика БД
cd /opt/cardinal-panel && node scripts/check-db-connection.mjs

# Место
df -h /var/lib/cardinal-panel
du -xh --max-depth=1 / | sort -h | tail -15

# nginx
sudo nginx -t
sudo systemctl reload nginx
```

Если что-то не работает — идите в
[TROUBLESHOOTING.md](./TROUBLESHOOTING.md): там разбор по симптомам.
