# Cardinal Panel — панель управления игровыми серверами на cardinal

Nuxt 4 + MySQL (Drizzle). Панель не управляет контейнерами напрямую:
рантайм — **[cardinal](https://github.com/animesao/cardinal)**
(лёгкая daemonless-замена Docker), агент на каждой ноде —
**[cardinal-wings](https://github.com/animesao/cardinal-wings)**
(REST API поверх `cardinal serve`).

```
браузер ──► панель (Nuxt, :3000) ──► wings-нода (:8080) ──► cardinal serve ──► контейнер
   │                │                      │
   │                │                      └── /v1/containers/srv-<uuid>/*, /api/servers/<ref>/ws, SFTP :2022
   │                └── /api/servers/[id]/* (power, files, backups, sftp, ws-token, reinstall …)
   └── WS-консоль, файлы, бэкапы — всё через панель, прямых Geheim-IP в коде нет
```

Контейнер адресуется стабильным именем `srv-<server-uuid>`: cardinal ID
wings резолвит сам, поэтому панель не хранит случайные ID и переживает
`reinstall` без миграций (см. `resolve.go` в cardinal-wings).

## Быстрый старт

```bash
npm install
cp .env.example .env   # заполнить: OAuth, NUXT_PANEL_URL (публичный URL САМОЙ ПАНЕЛИ)

# БД по умолчанию — локальный SQLite-файл, сервер MySQL не нужен:
npm run db:generate    # (один раз) сгенерировать SQL-миграции
npm run db:migrate     # применить их к ./data/panel.sqlite

npm run dev    # http://localhost:3000
npm run build  # production (.output/)
```

## База данных: локальная (по умолчанию) или серверная

Панель говорит с БД через Drizzle в двух диалектах (`server/db/dialect.ts`,
схема `server/db/schema.ts` — одна на оба, код роутов не меняется):

| Режим | `.env` | Миграции |
|---|---|---|
| **SQLite (дефолт)** — файл `SQLITE_PATH` через встроенный `node:sqlite`, ноль зависимостей | `DB_DIALECT="sqlite"`, `SQLITE_PATH="./data/panel.sqlite"` | `npm run db:generate` + `npm run db:migrate` |
| **MySQL на сервере** — обычный `mysql2` | `DB_DIALECT="mysql"` + `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | `npm run db:push` (синк схемы) или `npm run db:migrate:mysql` (журнал `migrations/mysql`) |

Переезд SQLite → MySQL: выставь `DB_DIALECT="mysql"` + доступы,
прогони `npm run db:migrate:mysql` (или `db:push`) в пустую базу и
перезапусти панель. Отличия sqlite-режима: `updatedAt` не обновляется
автоматически (нет `onUpdateNow`), остальное идентично.

## Связка ноды (Admin → Nodes → Add)

1. На игровом хосте: установить `cardinal`, затем `cardinal-wings`
   (`install.sh` из релизов wings печатает блок привязки: `URL` + `Token`).
2. В панели создать ноду с этим URL (`http(s)://<ip>:8080`) и токеном.
3. Панель проверит `/v1/version` и запушит свой адрес в wings
   (`POST /v1/config`) — нужны для колбэков бэкапов и SFTP-проверок.
   Без `NUXT_PANEL_URL` привязка создастся, но wings останется неподтверждённой.

Создание сервера (Admin → Servers) поднимает контейнер в cardinal через
wings `POST /v1/containers`: образ, `startup_script` (шаблоны
`{{memory}}`/`{{SERVER_MEMORY}}`/`{{SERVER_PORT}}`/`{{SERVER_JARFILE}}`
рендерит панель), env, порт аллокации, том `/home/container`, лимиты
(memory MB, cpu % где 100 = 1 ядро, disk MB), `restart: unless-stopped`
(падения и перезагрузка хоста поднимают контейнер, ручной стоп — нет;
с `always` супервизор cardinal перезапускал бы и остановленные вручную).

## Чертежи (яйца Pterodactyl)

Чертёж = яйцо: `images[]` (образы на выбор — версии), `variables[]`
(`{name, description, env_variable, default_value, user_viewable,
user_editable, rules}`), шаблон `startup` с `{{ПЕРЕМЕННЫМИ}}`,
`installScript`. Импорт: `Admin → Чертежи → Импорт яйца` (JSON PTDL_v1
вставкой или файлом). Старые чертежи без массивов работают как раньше
(образ один, env из JSON-объекта синтезируется в variables).

Создание сервера: образ проверяется по списку чертежа, переменные
мержатся поверх дефолтов (`required`/`max` проверяются, `user_editable:
false` игнорирует ввод). Вкладки сервера: «Установка» (образ + настройки
чертежа, либо старые пресеты если чертежа нет), «Запуск» (команда +
переменные чертежа + свободные env; `GET/PUT /api/servers/[id]/environment`
— починены, их не существовало).

## Карта панель → wings

| Панель | Wings |
|---|---|
| `POST /api/servers/[id]/power` | `POST /v1/containers/<ref>/{start,stop,restart,kill}` |
| `GET .../resources` | `GET /v1/containers/<ref>/stats` |
| `GET .../install-logs` | `GET /v1/containers/<ref>/logs?tail=200` |
| `PUT .../startup`, `PUT .../setup` | `POST /v1/containers/<ref>/update`, `.../reinstall` |
| `POST .../reinstall` | `POST /v1/containers/<ref>/reinstall` |
| файлы (`files*`) | `.../fm/{list,read,download,write,mkdir,rm,move,chmod}` |
| бэкапы (`backups*`) | `.../backup` (снапшоты) + `GET /download/backup?token=` |
| `GET .../sftp` | `GET /v1/sftp/info`, `PUT /v1/containers/<ref>/sftp` |
| порты (`ports*`) | `POST /v1/containers/<ref>/ports/{add,remove}` `{mapping: "host:container/proto"}` |
| `GET .../ws-token` → WS-консоль | `GET /api/servers/<ref>/ws` (legacy-протокол, JWT в `auth`-кадре) |
| `POST .../command` (`control.console`) | `POST /v1/containers/<ref>/terminal` + `.../terminal/input` `{data}` (stdin игры) |
| `GET /api/nodes/[id]/status` | `GET /v1/version` + `/v1/system/info` ноды |

Wings → панель (требуют доступный `NUXT_PANEL_URL`):

| Wings | Панель |
|---|---|
| завершение снапшота | `POST /api/remote/backups/{uuid}` `{successful, size, checksum}` |
| проверка SFTP-логина | `POST /api/remote/sftp/auth` `{username, password, type}` → `{server}` |

Базы данных серверов (`databases*`) панель провижинит сама напрямую на
`database_hosts` через MySQL (`CREATE DATABASE/USER/GRANT`) — wings тут
не участвует. Привязка «где что лежит»:
- у хоста БД — нода хранения (`node_id`, видно в списке хостов);
- у ноды — назначенный хост БД (`Admin → Nodes → edit → «Хост баз данных»):
  серверы этой ноды создают базы только на нём (пример: серверы на `test2`,
  базы на `test4`). Без назначения — первый доступный хост.
- у хоста — список нод, которым он доступен (мультивыбор в форме хоста;
  та же связь, вид со стороны хоста).
Имя/пользователь/пароль баз серверов всегда генерируются случайно,
вводить их не нужно.
Аллокации, локации, чертежи — сущности панели
(БД), в wings не дублируются.

## Доп. порты (слоты)

У сервера один первичный порт (аллокация) + доп. порты из того же пула
`allocations`. Админ выдаёт количество (`servers.port_slots`: создание сервера
или «Ресурсы») либо конкретный порт. Игрок занимает сам во вкладке «Порты»
(авто — первый свободный, или конкретный + TCP/UDP): панель проверяет слоты,
свободу в пуле и живьём на ноде (`usedHostPorts`), затем пушит маппинг
`port:port/proto` в контейнер (`ports/add`). Освобождение — там же
(`ports/remove` + строка назад в пул). Reinstall доп. порты сохраняет,
удаление сервера освобождает все его аллокации. Протокол доп. порта хранится
суффиксом IP (`1.2.3.4/udp`), чистый IP — tcp. Любой доп. порт можно сделать
основным («Сделать основным»): адрес сервера, `SERVER_IP`/`SERVER_PORT` и
команда запуска переключаются на него, старый основной остаётся доп. портом.

## Автозапуск

Флаг `servers.auto_start`: чекбокс при создании сервера, в «Ресурсах» админки
и тоггл «Авто» в шапке сервера (владелец). Панель — источник правды; wings при
загрузке спрашивает `GET /api/remote/autostart` (токен ноды) и поднимает
помеченные контейнеры с паузой между стартами. Без линка панели или при её
недоступности проход молча пропускается.

## Заморозка (suspend)

Флаг `servers.suspended`: `POST /api/admin/servers/[id]/suspend|unsuspend`.
Заморозка — панельный уровень: сам контейнер не останавливается.

Заморожены (403):
- питание — `power`, в т.ч. `/api/v1/servers/[uuid]/power`;
- переустановка — `reinstall` и смена образа через «Установку» (`setup`);
- команды — `command` (REST и `/api/v1`) и WS-консоль (`ws-token`);
- ручной запуск расписания — 403 «расписание пропущено»; срабатывание по
  таймеру не выполняется вовсе и просто откладывается на следующий интервал.

Не блокируется: флажок автозапуска (`autostart`) переключается и на
замороженном сервере — фильтр стоит на выдаче, `GET /api/remote/autostart`
отдаёт wings только незамороженные, так что контейнер не поднимется.

Доступны на замороженном (замораживается управление, а не данные): файлы
(чтение, запись, переименование, удаление, папки, права, zip), переменные
окружения, базы данных (включая смену пароля), бэкапы (создание, скачивание,
восстановление, удаление), расписания (список, создание, правка, удаление),
порты, субадмины, SFTP, startup, настройки, чтение статуса и активности.

Мутации через API-ключ требуют `servers: write`
(владелец с read-ключом писать не может). Перезапись существующего файла
требует `file.update`, создание нового —
`file.create` (проверяется живьём через листинг папки).

## Субпользователи (права как в Pterodactyl)
Владелец добавляет пользователя **по почте** (аккаунт панели обязателен) во
вкладке «Пользователи» сервера: сначала поиск аккаунта, затем готовый набор
(**Наблюдатель** — только смотрит, **Игрок** — команды и старт/стоп,
**Доверенный** — всё кроме управления пользователями) или точечные права
группами: консоль (`websocket.connect`, `control.console`), питание
(`control.start/stop/restart`), файлы (`file.read/create/update/delete`,
`file.archive` — скачивание папок и выборки одним `.zip`), бэкапы
(`backup.read/create/restore/delete`), базы (`database.read/create/delete`),
порты (`allocation.read/create/update/delete`), запуск (`startup.read` —
просмотр команды и переменных, `startup.update` — правки),
пользователи (`user.read/create/update/delete`). У каждой строки видно
описание права, у группы — счётчик `n/m` и кнопка «Все». Хранилище —
`server_users(server_id, user_id, permissions JSON)` (миграция `0007`, каскад).
Новые ключи (`websocket.connect`, `startup.read`, `file.archive`) старым
мемберам доезжают сами из старых эквивалентов (`control.console`,
`startup.update`, `file.read`) при первом запросе — ничего не отваливается.

Enforcement в двух местах: панель режет каждый эндпоинт (`needPerm`, 403
с именем права), а команды консоли — сам wings: `ws-token` минтит JWT только
с выданным подмножеством `control.*`. Выдать можно лишь права из своего
набора (без эскалации); владелец и админ — вне ограничений. Расшаренные
серверы видны в дашборде (`GET /api/servers/my`, бейдж «Доступ»), страница
сервера отдаёт `viewer: {owner, admin, permissions}` для гейтинга кнопок.
SFTP-кред у каждого личный (`srv-<server8>-<user8>`, вкладка SFTP отдаёт
свой; нужен `file.read`). Любой 403 открывает модалку «Нет доступа»
с именем нужного права (`useNoAccess` + `deny()`, смонтирована
на странице сервера).

Безопасность доступа:
- вся админка (`/api/admin/*`) закрыта центральным middleware
  (`server/middleware/admin.ts`) — роль проверяется до роутов, забытая
  проверка в новом файле больше не открывает дыру;
- SFTP-креды личные: владелец — `srv-<server8>`, каждый мембер —
  `srv-<server8>-<user8>` (таблица `sftp_credentials`, зеркало в wings);
  удаление участника и отбор `file.read` отзывают только его кред
  (`DELETE .../sftp?username=`), остальные продолжают работать;
- личный SFTP-вход (uuid + пароль панели) пускает только на свои серверы и
  расшаренные с `file.read`; без доступа — отказ, даже с верным паролем.

## Бэкапы: статусы и создание на выключенных

Строка бэкапа живёт статусами `creating → completed|failed` (колбэк wings
`POST /api/remote/backups/{uuid}`). Скачивание/восстановление в UI доступны
только для `completed` — иначе wings честно отвечает `backup not found`.
Пока есть `creating`, список опрашивается раз в 3с. Создание работает и на
остановленных/несмонтированных контейнерах: wings подмонтирует оверлей
on-demand (тот же механизм, что SFTP) вместо отказа `no dedicated data mount`.

## Активность сервера

Вкладка «Активность»: кто запускал/останавливал/перезапускал, открывал
консоль, заливал/правил/удалял/переименовывал файлы, создавал/удалял/
восстанавливал бэкапы, добавлял/убирал пользователей, создавал/удалял базы,
занимал/освобождал порты, менял запуск и переустанавливал. Хранится в
`server_activity` (последние 500 записей на сервер, старые чистятся сами),
очистить целиком могут только владелец и админ. Доступ мемберам выдаётся
правом `activity.read` (группа «Активность» во вкладке «Пользователи»).

Ограничение: текст команд из консоли и операции по SFTP панель не видит
(идут браузер→wings напрямую) — в журнале будет «открыл консоль».

## API-ключи

Внешние интеграции ходят в панель по токенам (как Application API в Pterodactyl):
`Authorization: Bearer cp_...`. Выпуск и отзыв — Admin → API-ключи: на каждый
ресурс свой уровень (None / Read / Read & Write) — ключ легко заточить под
одно API (биллинг — чтение серверов, статус — серверы + ноды).
Секрет показывается один раз (в БД только SHA256-хэш).

Ключ работает в двух местах:
- `/api/v1/*` — короткое публичное API (ниже);
- всё остальное API панели вместо сессии: тот же URL, но с Bearer.
  Права режутся дважды: субпользовательскими правами владельца ключа
  и уровнем ключа (read-ключ админа писать не может).
  Каждый ключ троттлится: 60 запросов в минуту (заголовки
  `X-RateLimit-Limit/Remaining`, при превышении 429 + `Retry-After`).
  Исключения (только сессия): смена личного SFTP-пароля, детали сервера
  для страницы, виджет статуса ноды, каталог чертежей для формы создания,
  список «мои серверы» (эквиваленты есть в `/api/v1/*`), управление 2FA
  (`/api/account/2fa/*`).

## Двухфакторная защита (TOTP)

Аккаунт → «Двухфакторная защита»: пароль + «Включить» → QR сканируется
в приложение-аутентификатор (Google/Microsoft Authenticator, 1Password,
рядом секрет текстом на случай ручного ввода) → код из приложения → 8 резервных кодов (показываются один раз, каждый
сгорает после использования). Дальше вход по почте+паролю спрашивает
второй шаг: код из приложения или резервный код. OAuth-входы (GitHub/
Google/Discord) 2FA не касается — только credentials. Секрет шифруется
AES-256-GCM (`NEXTAUTH_SECRET`), в БД открытого секрета нет. Подбор кода
режется троттлингом (10 попыток за 5 минут). Потерял телефон и коды —
проси админа удалить строку из `user_totp` в БД.

```bash
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/account
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/servers
# Pterodactyl-стиль: страница, фильтры, сортировка (без них — голый массив, как раньше)
curl -H "Authorization: Bearer cp_..." "http://localhost:3000/api/v1/servers?page=2&per_page=10&filter[name]=mc&sort=-name"
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/servers/<uuid>
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/servers/<uuid>/resources
curl -X POST -H "Authorization: Bearer cp_..." -H 'Content-Type: application/json' \
  -d '{"signal":"restart"}' http://localhost:3000/api/v1/servers/<uuid>/power
# Тот же power через обычное API:
curl -X POST -H "Authorization: Bearer cp_..." -H 'Content-Type: application/json' \
  -d '{"action":"restart"}' http://localhost:3000/api/servers/4/power
# Ключ админа с чтением ресурсов:
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/nodes
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/nodes/1/allocations
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/users
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/locations
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/blueprints
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/database-hosts
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/v1/server-databases
# Админский CRUD тем же ключом (нужен write):
curl -H "Authorization: Bearer cp_..." http://localhost:3000/api/admin/nodes
```

Ресурсы и уровни: `servers` (read/write — write это питание),
`files`, `backups`, `databases`, `ports`, `startup`, `server_users`
(read/write соответствующих операций), `nodes`, `users`, `allocations`,
`locations`, `blueprints`, `database_hosts` (read/write — write это CRUD
в `/api/admin/*`), `server_databases`, `activity` (только чтение).
Ключ действует от имени владельца: свои серверы + расшаренные (админу —
все); админские ресурсы — только ключам администраторов. Секреты не
утекают: токены нод, пароли хостов БД и баз, SFTP-пароли в ответах
отсутствуют всегда; управление ключами и настройки через API недоступны.
Действия питания пишутся в активность сервера с пометкой «(API)».

## Переменные окружения

См. `.env.example`. Обязательные: `DB_*`, `NEXTAUTH_SECRET` (+ OAuth),
`NUXT_PANEL_URL`. Вход возможен и по почте+паролю (аккаунты создаёт админ:
Admin → Пользователи, либо API-ключ с `users.write`). OAuth-кнопки
(GitHub/Google/Discord) по умолчанию выключены и включаются в админке
(Admin → Настройки → Способы входа) вместе с Client ID/Secret — секреты
лежат в БД в шифрованном виде (AES-256-GCM, ключ из `NEXTAUTH_SECRET`).
Значения из `.env` забираются один раз при первом запуске. Название панели
задаётся не в `.env`, а в админке
(Admin → Настройки, ключ `panel_name` в таблице `settings`, дефолт
`Cardinal Panel`): применяется сразу в шапках, на странице входа
и во вкладке браузера. Легаси `NUXT_JWT_SECRET` больше не используется:
браузерные JWT для wings панель подписывает токеном ноды (HMAC-SHA256).

Создание аккаунта по API (ключ админа с `users: write`):

```bash
curl -X POST -H "Authorization: Bearer cp_..." -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"СложныйПароль123","name":"Игрок"}' \
  http://localhost:3000/api/admin/users
```

## Установка

### Готовый релиз (рекомендуется)

Установщик ставит панель из GitHub Releases: скачивает архив, проверяет
SHA-256, разворачивает в `/opt/cardinal-panel`, создаёт пользователя
`cardinal`, генерирует `NEXTAUTH_SECRET`, накатывает миграции БД и
включает systemd-юнит.

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash
```

#### Полная установка одной командой

Чтобы панель была сразу рабочей — с публичным адресом, первым
администратором и подключённым узлом `cardinal-wings`:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --domain panel.example.com \
  --admin-email admin@example.com \
  --wings-url http://10.0.0.5:8080 \
  --wings-token <токен-из-установщика-wings>
```

Что делает установщик сверх базовой установки:

1. **публичный адрес** — `--domain` попадает в `NUXT_PANEL_URL`,
   `NEXTAUTH_URL` и `AUTH_ORIGIN` (без них OAuth-колбэки не работают);
2. **обратный прокси** — ставит nginx, пишет vhost с заголовками
   `X-Forwarded-*`, отключает буферизацию (иначе SSE-события приходят
   пачками с задержкой в минуту) и настраивает WebSocket;
3. **TLS** — выпускает сертификат Let's Encrypt через certbot и
   переводит nginx на HTTPS с редиректом;
4. **первый администратор** — создаётся неинтерактивно, пароль
   генерируется и печатается один раз в финальном отчёте;
5. **узел `cardinal-wings`** — заводится через настоящий API панели
   (`POST /api/admin/nodes`): установщик выпускает временный админ-ключ,
   регистрирует узел и **сразу отзывает ключ**;
6. **проверка** — панель опрашивается на `/api/health`, выводится
   сводка с адресом входа и учётными данными.

Ключи запуска:

| Ключ | Назначение |
|---|---|
| `--version <X.Y.Z>` | поставить конкретную версию (по умолчанию — последний релиз) |
| `--dir <путь>` | каталог установки (по умолчанию `/opt/cardinal-panel`) |
| `--data-dir <путь>` | каталог данных (по умолчанию `/var/lib/cardinal-panel`) |
| `--port <порт>` | порт панели (по умолчанию 3000) |
| `--domain <example.com>` | публичный адрес: включает nginx + TLS |
| `--admin-email <email>` | e-mail первого администратора |
| `--wings-url <url>` | адрес узла `cardinal-wings` (http://host:8080) |
| `--wings-token <token>` | токен узла (обязателен вместе с `--wings-url`) |
| `--no-proxy` | не ставить nginx |
| `--no-tls` | не выпускать сертификат (только HTTP) |
| `--no-start` | установить, но не запускать |
| `--uninstall` | снести панель (данные БД сохраняются, `KEEP_DATA=1` — удалить) |
| `--install-mode <cardinal\|systemd>` | способ развёртывания (по умолчанию `systemd`) |
| `--network <host\|bridge>` | сетевой режим контейнера в режиме `cardinal` |
| `--image-tag <тег>` | тег собираемого образа в режиме `cardinal` |

При переустановке `NEXTAUTH_SECRET` сохраняется — сессии не разламываются,
а публичный адрес и режим обновляются.

После установки:

```bash
journalctl -u cardinal-panel -f    # логи
systemctl status cardinal-panel
```

### Развёртывание на runtime cardinal

Панель — обычный контейнер, поэтому её можно развернуть не только как
системный сервис, но и **контейнером на самом cardinal**. Образ собирается
из того же релизного пакета (`Dockerfile.cardinal`, одна стадия: сборка
`.output` уже готова, native-модулей нет — образ переносим между машинами).

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- --install-mode cardinal
```

Что делает установщик в этом режиме:

1. проверяет, что `cardinal` установлен (иначе подсказывает команду);
2. тянет базовый образ `node:24-alpine`;
3. собирает образ `cardinal-panel:<версия>` через `cardinal build`;
4. пишет `/etc/cardinal-panel/cardinal.toml` и поднимает сервис через
   `cardinal up`;
5. выполняет миграции БД **внутри контейнера** (`cardinal exec`);
6. ждёт ответа `/api/health`;
7. включает boot-восстановление (`cardinal bootstrap --install`), чтобы
   контейнер пережил перезагрузку хоста.

Ключи этого режима:

| Ключ | Назначение |
|---|---|
| `--install-mode cardinal` | развернуть контейнером на cardinal (по умолчанию `systemd`) |
| `--network host` (по умолчанию) | панель видит `cardinal-wings` на `127.0.0.1:8080` и SFTP на `:2022` |
| `--network bridge` | панель изолирована; узлы wings указываются в админке по IP хоста |
| `--image-tag <тег>` | собрать образ с другим тегом (по умолчанию `cardinal-panel:<версия>`) |

Файлы после установки:

```
/etc/cardinal-panel/panel.env     # секреты (0600), общий для обоих режимов
/etc/cardinal-panel/cardinal.toml  # описание сервиса для cardinal
```

Управление:

```bash
cardinal ps                        # статус
cardinal logs panel                # логи
cardinal down -f /etc/cardinal-panel/cardinal.toml   # остановить
./install.sh --uninstall            # снести (данные в томе panel-data сохраняются)
```

Если runtime работает со строгим allowlist реестров
(`CARDINAL_REGISTRY_STRICT=1`), нужно разрешить Docker Hub:
`cardinal registry allowlist add docker.io`.

### Docker

```bash
cp .env.example .env      # заполнить NEXTAUTH_SECRET и NUXT_PANEL_URL
docker compose up -d
```

Образ собирается из Node 24, работает от непривилегированного
пользователя, SQLite живёт в именованном томе `panel-data`.

### Из исходников

```bash
npm ci
cp .env.example .env
npm run db:migrate
npm run dev
```

Требуется **Node ≥ 24**: диалект SQLite использует встроенный модуль
`node:sqlite`, доступный без experimental-флага начиная с Node 23.4.

## Разработка и проверки

```bash
npm run lint        # проверка относительных импортов в server/
npm run typecheck   # vue-tsc по всему проекту
npm test            # юнит-тесты (vitest)
npm run test:coverage
npm run build       # production-сборка в .output/
npm run ci          # lint + typecheck + test + build
```

`npm run ci` — ровно то, что выполняет GitHub Actions на каждом PR.

## Релизы

Версия живёт в файле `VERSION` — это источник истины. `package.json`
синхронизируется скриптом:

```bash
npm run release:version            # VERSION → package.json
npm run release:version -- --check # только проверка (CI)
```

Релиз публикуется по тегу `vX.Y.Z`:

```bash
echo "0.2.0" > VERSION
npm run release:version
git commit -am "chore(release): v0.2.0"
git tag v0.2.0 && git push --tags
```

Workflow `release.yml` соберёт панель, упакует её и опубликует в
GitHub Releases:

| Артефакт | Что это |
|---|---|
| `cardinal-panel-<version>.tar.gz` | `.output/`, миграции, скрипты, systemd-юнит, `INSTALL.md` |
| `cardinal-panel-<version>.tar.gz.sha256` | контрольная сумма для проверки |
| `cardinal-panel-<version>.sbom.json` | SPDX-SBOM по дереву зависимостей |

Тег обязан совпадать с `VERSION` — иначе релиз не создастся.

Сборка пакета локально (нужен предварительный `npm run build`):

```bash
npm run release:package   # → release/
```
