# Настройка cardinal-panel

Всё, что настраивается: переменные окружения, настройки в панели и
параметры, которые меняются только при установке.

- [Где что лежит](#где-что-лежит)
- [Переменные окружения](#переменные-окружения)
- [Обязательные переменные](#обязательные-переменные)
- [База данных](#база-данных)
- [Сеть и обратный прокси](#сеть-и-обратный-прокси)
- [Пользователи и вход](#пользователи-и-вход)
- [Настройки в панели](#настройки-в-панели)
- [Узлы cardinal-wings](#узлы-cardinal-wings)
- [API-ключи](#api-ключи)
- [Серверы и лимиты](#серверы-и-лимиты)
- [Резервное копирование](#резервное-копирование)
- [Смена параметров после установки](#смена-параметров-после-установки)

---

## Где что лежит

| Что | Путь |
|---|---|
| Файлы приложения | `/opt/cardinal-panel` |
| База данных (SQLite) | `/var/lib/cardinal-panel/panel.sqlite` |
| Конфигурация | `/etc/cardinal-panel/panel.env` (0600, владелец `cardinal`) |
| Compose-файл (режим cardinal) | `/etc/cardinal-panel/cardinal.toml` |
| systemd-юнит | `/etc/systemd/system/cardinal-panel.service` |
| vhost nginx | `/etc/nginx/sites-available/cardinal-panel.conf` |
| Логи | journald, `journalctl -u cardinal-panel` |

---

## Переменные окружения

Файл `/etc/cardinal-panel/panel.env` — источник истины. Формат
`KEY="value"`, комментарии с `#`. systemd-юнит читает его как
`EnvironmentFile`, поэтому **изменения требуют перезапуска**:

```bash
sudo systemctl restart cardinal-panel
```

Полный список (`.env.example` — тот же набор с пояснениями):

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `NEXTAUTH_SECRET` | — | **Обязателен.** Ключ подписи сессий и JWT. От 16 символов. При смене все сессии слетают |
| `NEXTAUTH_URL` | `http://localhost:3000` | Публичный адрес для next-auth |
| `AUTH_ORIGIN` | `http://localhost:3000/api/auth` | Origin обработчика авторизации |
| `NUXT_PANEL_URL` | `http://localhost:3000` | Публичный адрес панели. Уходит в wings (`POST /v1/config`) и используется в OAuth-колбэках |
| `DB_DIALECT` | `sqlite` | `sqlite` или `mysql` |
| `SQLITE_PATH` | `/var/lib/cardinal-panel/panel.sqlite` | Файл базы (режим cardinal: `/app/data/panel.sqlite`) |
| `DB_HOST` | `localhost` | Хост MySQL |
| `DB_PORT` | `3306` | Порт MySQL |
| `DB_USER` | `root` | Пользователь MySQL |
| `DB_PASSWORD` | — | Пароль MySQL |
| `DB_NAME` | `ktpanel` | База MySQL |
| `NITRO_HOST` | `127.0.0.1` | Адрес прослушивания. `127.0.0.1` — только через прокси |
| `NITRO_PORT` | `3000` | Порт прослушивания |
| `TRUSTED_PROXY` | `127.0.0.1,::1` | Обратные прокси, которым можно доверять (см. ниже) |
| `PANEL_SETUP_TOKEN` | — | Одноразовый токен первичной настройки через `POST /api/setup/bootstrap` |
| `DEBUG` | `false` | Подробные логи |
| `NODE_ENV` | `production` | Режим Node |
| `PANEL_ENV_FILE` | `/etc/cardinal-panel/panel.env` | Где искать конфигурацию для скриптов панели |

---

## Обязательные переменные

### `NEXTAUTH_SECRET`

Ключ подписи сессий и браузерных JWT. Генерируется установщиком:

```bash
openssl rand -base64 32
```

**Никогда не кладите его в репозиторий.** При утечке — смените и
перезапустите панель: все сессии сбросятся.

### `NUXT_PANEL_URL`

Адрес, под которым панель доступна **снаружи**. Должен совпадать с тем,
что панель отдаёт wings и что прописан у OAuth-провайдера в качестве
callback-URL. Неверное значение — самая частая причина «вход через
GitHub не работает».

```bash
# в режиме cardinal адрес указывается на хост, а не на контейнер
NUXT_PANEL_URL="https://panel.example.com"
```

---

## База данных

### SQLite (по умолчанию)

Файл `panel.sqlite` плюс `-wal` и `-shm` при работающей панели. Никаких
внешних сервисов: подошёл SQLite — и заработало.

```bash
SQLITE_PATH=/var/lib/cardinal-panel/panel.sqlite
```

### MySQL

```bash
DB_DIALECT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=kt-panel
DB_PASSWORD=...
DB_NAME=ktpanel
```

Миграции для MySQL — отдельные (`npm run db:migrate:mysql`), в каталоге
`server/db/migrations/mysql`.

Проверка соединения:

```bash
cd /opt/cardinal-panel && node scripts/check-db-connection.mjs
```

### Права

```bash
sudo chown -R cardinal:cardinal /var/lib/cardinal-panel
sudo chmod 0750 /var/lib/cardinal-panel
```

---

## Сеть и обратный прокси

### `TRUSTED_PROXY`

Список обратных прокси, которым можно доверять при определении IP
клиента. **X-Forwarded-For присылает клиент** — если бы панель верила
ему всегда, троттлинг входа обходился бы одной сменой заголовка.

```bash
TRUSTED_PROXY="127.0.0.1,::1,10.0.0.5"
```

Правило: IP берётся из `X-Forwarded-For` **только** если соединение
пришло с одного из перечисленных адресов; иначе берётся адрес сокета
(см. `server/utils/clientip.ts`).

Если панель стоит за nginx на той же машине — `127.0.0.1` достаточно.
Если за другим балансировщиком — добавьте его адрес.

### nginx

Установщик пишет vhost сам. Ключевое в нём:

- `proxy_set_header Host $host` — панель принимает любой Host;
- `proxy_buffering off` — без этого SSE-события (логи, статус) приходят
  пачками с задержкой в минуту;
- `proxy_set_header Upgrade $http_upgrade` + `$connection_upgrade` —
  WebSocket терминала;
- `client_max_body_size 512M` — бэкапы и файловый менеджер.

Правка вручную:

```bash
sudo nano /etc/nginx/sites-available/cardinal-panel.conf
sudo nginx -t && sudo systemctl reload nginx
```

### Порты

| Порт | Что слушает | Кто |
|---|---|---|
| 3000 | сама панель | `127.0.0.1` — наружу только через nginx |
| 80 | nginx | публичный HTTP |
| 443 | nginx | публичный HTTPS (если есть сертификат) |
| 5353/udp | mDNS (avahi) | имена `.local` в локальной сети |

---

## Пользователи и вход

### Первый администратор

```bash
cd /opt/cardinal-panel && node scripts/create-admin.mjs --email=admin@example.com
```

Пароль генерируется и печатается **один раз**. Скрипт читает путь к БД
из `panel.env` (с версии 0.5.4) — иначе он создал бы админа не в той
базе.

Повторный запуск с тем же e-mail **сбрасывает пароль** и повышает до
админа.

### Вход по паролю и по OAuth

- **По паролю** — работает всегда, OAuth не нужен.
- **По OAuth** (Discord / GitHub / Google) — включается в админке:
  Admin → Настройки → Способы входа. Нужны client_id и client_secret,
  панель их шифрует в БД (AES-256-GCM, ключ из `NEXTAUTH_SECRET`).

Требования OAuth:

1. **HTTPS** — колбэк-URL должен быть `https://`.
2. Callback-URL у провайдера: `{NUXT_PANEL_URL}/api/auth/callback/<provider>`.
3. Провайдер должен вернуться на тот же адрес, что указан в
   `NUXT_PANEL_URL`.

### Двухфакторная аутентификация

Включается пользователем в профиле: Account → 2FA. TOTP (приложение-аутентификатор) + резервные коды.

В панели 2FA **обязательна для всех способов входа** — и для OAuth, и
для пароля.

### Сброс 2FA администратора

Если админ потерял код:

```bash
cd /opt/cardinal-panel && node -e "
const {DatabaseSync}=require('node:sqlite');
const db=new DatabaseSync('/var/lib/cardinal-panel/panel.sqlite');
db.prepare('DELETE FROM user_totp WHERE user_id=(SELECT id FROM users WHERE email=?)').run('admin@example.com');
console.log('2FA сброшена');
"
```

---

## Настройки в панели

Хранятся в таблице `settings` (ключ-значение), меняются в админке.

| Ключ | Что делает |
|---|---|
| `panel_name` | Название панели в шапке, на странице входа и во вкладке браузера |
| `oauth_<provider>_enabled` | Включён ли провайдер (`1`/`0`) |
| `oauth_<provider>_id` | Client ID провайдера |
| `oauth_<provider>_secret` | Client secret, **зашифрован** (AES-256-GCM) |
| `oauth_seeded` | Флаг: OAuth-ключи уже перенесены из `.env` в БД |

Первый перенос из `.env` происходит один раз при первом входе в панель
(`seedOAuthFromEnv`). Дальше источник истины — БД.

---

## Узлы cardinal-wings

Узел — это машина с установленным wings. Панель общается с ним по
Docker-совместимому HTTP API.

Создание: Admin → Nodes → Add node.

| Поле | Что это | Где взять |
|---|---|---|
| Name | Имя узла | произвольно |
| URL | Адрес wings | `http://<ip>:8080` |
| Token | Токен узла | выдаёт установщик wings |
| Memory / Disk / Swap | Лимиты в **байтах** | `free -m`, `df -h /` на узле |
| Location | Локация | Admin → Locations |

При создании узла панель отправляет wings свой `panel_url` и токен
(`POST /v1/config`) — после этого wings начинает присылать колбэки
(автозапуск, проверка SFTP, статус бэкапов).

Через установщик:

```bash
... install.sh -s -- --wings-url http://10.0.0.5:8080 --wings-token <токен>
```

Синхронизация узла вручную: Admin → Nodes → Sync.

---

## API-ключи

Ключи для внешних клиентов (Pterodactyl-совместимый Client API).

```bash
# выпустить ключ администратору
cd /opt/cardinal-panel && node scripts/admin-api-key.mjs \
  --email=admin@example.com --name=ci --scopes=nodes:2
```

Уровни доступа: `1` — чтение, `2` — запись. Ключ показывается **один
раз**: в БД лежит только SHA-256 хэш.

Отозвать:

```bash
node scripts/admin-api-key.mjs --revoke=cp_xxxxxxxx
```

---

## Серверы и лимиты

Сервер создаётся в панели и физически запускается в cardinal на
выбранном узле. Лимиты (память, CPU, диск) задаются на сервере и
enforce'ятся ядром кардинала через cgroups.

Blueprints (шаблоны установки) — Admin → Blueprints: образ, стартовая
команда, переменные окружения, install-скрипт. Импортируются из
репозитория cardinal-blueprints.

---

## Резервное копирование

Бэкап панели — это копия файла БД. Надёжнее через API SQLite, которая
не требует остановки панели:

```bash
sudo -u cardinal sqlite3 /var/lib/cardinal-panel/panel.sqlite \
  ".backup /var/lib/cardinal-panel/panel.sqlite.bak"
```

Если `sqlite3` не установлен:

```bash
sudo systemctl stop cardinal-panel
sudo cp /var/lib/cardinal-panel/panel.sqlite /var/lib/cardinal-panel/panel.sqlite.bak
sudo systemctl start cardinal-panel
```

Бэкапы **серверов** делает wings, не панель.

---

## Смена параметров после установки

1. Правьте `/etc/cardinal-panel/panel.env`.
2. Перезапустите:

```bash
sudo systemctl restart cardinal-panel
```

3. Проверьте:

```bash
curl -s http://127.0.0.1:3000/api/health
journalctl -u cardinal-panel -n 20 --no-pager
```

Для смены публичного адреса проще переустановить с новым `--domain` —
установщик перепишет `panel.env` и перезапустит nginx с нужным
`server_name` и сертификатом.

---

Дальше: [установка](INSTALL.md) · [обновление](UPGRADE.md) ·
[эксплуатация](OPERATIONS.md) · [проблемы](TROUBLESHOOTING.md)
