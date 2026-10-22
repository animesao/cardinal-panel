# Диагностика cardinal-panel

Разбор по симптомам: **Симптом → Диагностика → Причина → Решение**.
Эксплуатация и регламентные процедуры — в
[OPERATIONS.md](./OPERATIONS.md).

## Быстрый индекс

| № | Симптом | Раздел |
|---|---|---|
| 1 | `ERR_CONNECTION_TIMED_OUT` в браузере | [Брандмауэр](#1-панель-не-открывается-из-сети-таймаут) |
| 2 | `panel.local` не резолвится (NXDOMAIN) | [mDNS и имя хоста](#2-имя-панели-не-резолвится-nxdomain) |
| 3 | «Invalid email or password» при верном пароле | [Админ в другой базе](#3-invalid-email-or-password-при-верном-пароле) |
| 4 | `database or disk is full`, `ENOSPC` | [Кончилось место](#4-database-or-disk-is-full--enospc) |
| 5 | `Cannot read package config …/entities/package.json` | [Битый релиз](#5-cannot-read-package-configentitiespackagejson) |
| 6 | certbot: «appears to be a URL, not a FQDN» | [Неверный --domain](#6-certbot-appears-to-be-a-url-not-a-fqdn) |
| 7 | Let's Encrypt не выдаёт сертификат | [Сертификат на IP](#7-let-s-encrypt-не-выдаёт-сертификаты-на-ip-адрес) |
| 8 | Node.js слишком старый | [Старый Node](#8-nodejs-слишком-старый) |
| 9 | Панель отвечает по `127.0.0.1`, но не по внешнему IP | [Внешний доступ](#9-панель-отвечает-по-1270011-но-не-по-внешнему-ip) |
| 10 | `npm install failed — migrations may not run` | [Миграции не прошли](#10-npm-install-failed--migrations-may-not-run) |
| 11 | `/api/health` отдаёт 503 | [База недоступна](#11-панель-стартует-но-apihealth-отдаёт-503) |
| 12 | Панель не открывается с другой машины в сети | [Слоями](#панель-не-открывается-с-другой-машины-в-сети) |
| 13 | Скрипты панели работают не с той базой | [Скрипты и база](#скрипты-панели-работают-не-с-той-базой) |

Перед разбором конкретной проблемы снимите общее состояние — на него
ссылаются почти все диагностики:

```bash
systemctl status cardinal-panel
journalctl -u cardinal-panel -n 50
curl -sS http://127.0.0.1:3000/api/health
```

---

## 1. Панель не открывается из сети: таймаут

### Симптом

В браузере — `ERR_CONNECTION_TIMED_OUT` (превышено время ожидания ответа).
Не «соединение отклонено»: пакеты **дропаются** брандмауэром, поэтому
причина не читается из сообщения браузера.

### Диагностика

```bash
ufw status verbose                      # ufw активен? что пропускается?
systemctl is-active ufw
firewall-cmd --state 2>/dev/null       # firewalld активен?
firewall-cmd --list-ports 2>/dev/null
ss -ltnp | grep ':80'                   # nginx слушает 80?
```

### Причина

Активен ufw или firewalld, а порт **80/tcp** не открыт. Для mDNS
дополнительно нужен **5353/udp** (иначе имя `.local` не резолвится).
С 0.5.3 установщик открывает эти порты сам — значит, брандмауэр включили
или сбросили правила уже после установки.

### Решение

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5353/udp
```

Для firewalld:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=5353/udp
sudo firewall-cmd --reload
```

Проверка:

```bash
ss -ltnp | grep ':80'
curl -sS -I http://127.0.0.1/        # от локального nginx
```

---

## 2. Имя панели не резолвится (NXDOMAIN)

### Симптом

`panel.local` (или другое имя из `--hostname`) не открывается, браузер
сообщает `DNS_PROBE_FINISHED_NXDOMAIN`.

### Диагностика

```bash
getent hosts panel.local            # резолвится ли вообще
ping -c1 panel.local                # отвечает ли mDNS
systemctl status avahi-daemon       # mDNS-демон жив?
cat /etc/avahi/hosts                # опубликовано ли имя
ufw status verbose | grep 5353      # не заблокирован ли mDNS
```

### Причина

Одно из трёх:

1. не установлен `avahi-daemon` — установщик в таком случае прямо
   предупреждает, что имя не будет видно в локальной сети;
2. mDNS заблокирован брандмауэром (5353/udp закрыт);
3. имя не в зоне `.local` — mDNS публикует только `.local`; для других имён
   нужен DNS или hosts-файл клиента.

### Решение

```bash
sudo apt-get install -y avahi-daemon
sudo systemctl enable --now avahi-daemon
sudo ufw allow 5353/udp
```

Имя должно быть в зоне `.local` и в файле публикаций avahi:

```bash
echo "$LOCAL_IP	panel.local" | sudo tee -a /etc/avahi/hosts
sudo systemctl reload avahi-daemon
```

Если имя не в зоне `.local` (например, `panel` или `panel.example.internal`),
mDNS его не раздаст — добавьте имя в hosts-файл клиентов вручную или
настройте DNS. Сам панель на это не влияет: nginx принимает любой `Host`
(в `next-auth` включён `trustHost`), имя нужно только клиенту, чтобы
дойти до панели.

---

## 3. «Invalid email or password» при верном пароле

### Симптом

Вход по почте и паролю отклоняется, хотя пароль точно верный.

### Диагностика

```bash
grep -E 'SQLITE_PATH|DB_DIALECT' /etc/cardinal-panel/panel.env
systemctl show cardinal-panel -p Environment
sudo ls -la /var/lib/cardinal-panel/
sudo ls -la /opt/cardinal-panel/data/ 2>/dev/null   # «лишняя» база
sudo sqlite3 /var/lib/cardinal-panel/panel.sqlite "SELECT email, role FROM users;"
sudo sqlite3 /opt/cardinal-panel/data/panel.sqlite "SELECT email, role FROM users;" 2>/dev/null
```

### Причина

Админ создан **в другой базе**. Скрипты панели брали путь к SQLite только
из окружения и, запущенные вручную без `panel.env`, писали в
`./data/panel.sqlite`, тогда как панель читает
`/var/lib/cardinal-panel/panel.sqlite`. Ключ `cp_...` тоже выдавался для
не той базы.

Исправлено в **0.5.4**: `create-admin.mjs`, `migrate-sqlite.mjs` и
`admin-api-key.mjs` читают `/etc/cardinal-panel/panel.env` (переопределяется
`PANEL_ENV_FILE`).

### Решение

На версиях до 0.5.4:

```bash
sudo rm -rf /opt/cardinal-panel/data      # убрать «лишнюю» базу
cd /opt/cardinal-panel && sudo -u cardinal node scripts/create-admin.mjs \
  --email=you@example.com
sudo systemctl restart cardinal-panel
```

На 0.5.4 и новее скрипт сам берёт путь из `panel.env` — достаточно
пересоздать админа:

```bash
cd /opt/cardinal-panel && sudo -u cardinal node scripts/create-admin.mjs \
  --email=you@example.com
```

Пароль генерируется и печатается **один раз** — сохраните его.

Если вход не проходит и после этого — проверьте, что `SQLITE_PATH` в
`panel.env` совпадает с тем, что видит процесс:

```bash
systemctl show cardinal-panel -p Environment | tr ' ' '\n' | grep SQLITE
```

---

## 4. `database or disk is full` / `ENOSPC`

### Симптом

Установщик или панель падает с `database or disk is full` / `ENOSPC`:
SQLite не может писать, миграции не применяются.

### Диагностика

```bash
df -h /
df -h /var/lib/cardinal-panel
du -xh --max-depth=1 / 2>/dev/null | sort -h | tail -15
journalctl --disk-usage
```

### Причина

Закончилось место на разделе с данными. Чаще всего съедают журнал systemd
и кэш пакетов.

### Решение

```bash
sudo apt-get clean
sudo apt-get autoremove -y
sudo rm -rf /var/lib/apt/lists/*
sudo journalctl --vacuum-size=50M
npm cache clean --force
```

Если места всё равно мало — расширяйте том (`/var/lib/cardinal-panel`
должен лежать на разделе с запасом) и повторите установку. Установщик
проверяет свободное место **до** установки и по умолчанию требует 128 МБ
(порог меняется `--min-free <MiB>`), но после установки место может
кончиться уже от базы, логов и бэкапов.

---

## 5. `Cannot read package config …/entities/package.json`

### Симптом

Панель не стартует, в журнале:

```
Error: Cannot read package config /opt/cardinal-panel/.output/server/node_modules/entities/package.json
```

### Диагностика

```bash
cat /opt/cardinal-panel/VERSION
sudo ls -la /opt/cardinal-panel/.output/server/node_modules/entities/
sudo ls -la /opt/cardinal-panel/.output/server/node_modules/ | head -20
journalctl -u cardinal-panel -n 50
```

### Причина

В релиз попали **битые симлинки**: npm на Windows дедуплицирует одинаковые
пакеты через junction'ы (`node_modules/.nitro/<pkg>@<ver>`), и упаковщик
переносил их в архив как ссылки на виндовые абсолютные пути
(`//?/C:/Users/…`). На Linux такие ссылки битые.

Исправлено в **0.4.4**: копирование идёт с `dereference: true`, а упаковщик
проверяет архив на ссылки и роняет сборку, если они остались.

### Решение

Для старых версий (до 0.4.4) — переустановить панель: битые ссылки лежат
внутри релизного архива, «починить» их на месте можно только заменой пакета.

```bash
cd /tmp
VER=0.5.4
curl -fLO https://github.com/animesao/cardinal-panel/releases/download/v${VER}/cardinal-panel-${VER}.tar.gz
curl -fLO https://github.com/animesao/cardinal-panel/releases/download/v${VER}/cardinal-panel-${VER}.tar.gz.sha256
sha256sum -c cardinal-panel-${VER}.tar.gz.sha256
sudo systemctl stop cardinal-panel
sudo rm -rf /opt/cardinal-panel/.output
sudo tar -xzf cardinal-panel-${VER}.tar.gz
sudo cp -a cardinal-panel-${VER}/.output /opt/cardinal-panel/.output
sudo chown -R cardinal:cardinal /opt/cardinal-panel
sudo systemctl start cardinal-panel
```

Проще — прогнать установщик поверх: он сам останавливает сервис, заменяет
файлы и накатывает миграции:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash
```

---

## 6. certbot: «appears to be a URL, not a FQDN»

### Симптом

Установщик или ручной запуск certbot отвечает:

```
certbot ... appears to be a URL, not a FQDN
```

### Диагностика

```bash
grep server_name /etc/nginx/sites-available/cardinal-panel.conf
grep NUXT_PANEL_URL /etc/cardinal-panel/panel.env
```

### Причина

В `--domain` передали URL со схемой или путём (`https://panel.example.com/`).
Значение попадало и в `server_name` nginx («suspicious symbols»), и в
`NUXT_PANEL_URL` («https://http://192.168.0.105»), и в имя сертификата.

Исправлено в **0.4.6**: схема, путь и порт отбрасываются, принимаются
`example.com`, `https://example.com`, `http://example.com/` и
`example.com:8080`.

### Решение

Передавайте голый хост:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --domain example.com
```

Для локальной сети — тоже голый адрес, без схемы:

```bash
  --domain 192.168.0.104
```

Если vhost уже создан с мусором — перезапустите установщик с правильным
`--domain` (он перепишет `server_name` и `panel.env`).

---

## 7. Let's Encrypt не выдаёт сертификаты на IP-адрес

### Симптом

`--domain 192.168.0.104` — панель работает, но только по HTTP; в отчёте
установщика «TLS skipped: Let's Encrypt не выдаёт сертификаты на IP».
OAuth-провайдеры при этом не работают: колбэк уходит на `https://`, а
сертификата нет.

### Диагностика

```bash
grep -E 'NUXT_PANEL_URL|NEXTAUTH_URL' /etc/cardinal-panel/panel.env
dig +short panel.example.com        # есть ли A-запись на этот хост
certbot certificates                 # какие сертификаты есть
```

### Причина

Let's Encrypt сертификаты на IP-адрес не выдаёт. Для OAuth нужен домен с
A-записью на панель и HTTPS: `NUXT_PANEL_URL` уходит и в wings, и в
колбэки OAuth-провайдера.

### Решение

1. Заведите домен (например, `panel.example.com`) и направьте его A-запись
   на IP панели.
2. Переустановите/перезапустите установщик с доменом:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --domain panel.example.com \
  --admin-email admin@example.com
```

3. Убедитесь, что в `panel.env` схема стала `https`:

```bash
grep -E 'NUXT_PANEL_URL|NEXTAUTH_URL|AUTH_ORIGIN' /etc/cardinal-panel/panel.env
```

Пока сертификата нет, панель должна работать по HTTP — установщик
переписывает `panel.env` на `http://`, чтобы OAuth-колбэки не уходили на
несуществующий `https://`. Если в `panel.env` остался `https://`, а
сертификата нет — перепишите схему вручную и перезапустите панель.

---

## 8. Node.js слишком старый

### Симптом

Панель не стартует, в журнале — ошибки про `node:sqlite`
(`ERR_UNKNOWN_BUILTIN_MODULE`, «No such built-in module: node:sqlite») либо
установщик ругается «Node v18.x is too old (need >= 24)».

### Диагностика

```bash
node -v
journalctl -u cardinal-panel -n 50
```

### Причина

Нужен **Node.js ≥ 24**: диалект SQLite использует встроенный модуль
`node:sqlite`, доступный без experimental-флага начиная с Node 23.4.
Установщик ставит Node 24 из NodeSource сам, но если Node в системе был
поставлен раньше (или вручную добавлен в `PATH`), проверка версии
срабатывает не всегда.

### Решение

Установщик сделает это сам:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash
```

Вручную (Debian/Ubuntu) — репозиторий NodeSource для 24.x:

```bash
sudo apt-get install -y ca-certificates curl gnupg
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update -qq
sudo apt-get install -y nodejs
node -v
sudo systemctl restart cardinal-panel
```

В режиме cardinal версия Node задана образом (`node:24-alpine`) — проблемы
нет.

---

## 9. Панель отвечает по `127.0.0.1`, но не по внешнему IP

### Симптом

`curl http://127.0.0.1:3000/api/health` отвечает, а `curl
http://192.168.0.104/` — нет (таймаут или отказ).

### Диагностика

```bash
ss -ltnp | grep -E ':3000|:80'        # что и где слушает
grep server_name /etc/nginx/sites-available/cardinal-panel.conf
nginx -t
curl -sS -H 'Host: 192.168.0.104' http://127.0.0.1/api/health
ufw status verbose
```

### Причина

Три варианта:

1. **nginx не обслуживает этот адрес.** `server_name` перечисляет только
   домен и `--hostname`-алиасы; если адрес машины в список не попал,
   запрос попадает в default-сервер nginx. Установщик предупреждает об
   этом, если переданный `--domain` не совпадает с адресом машины.
2. **брандмауэр дропает пакеты** (см. раздел 1).
3. **nginx не запущен или не слушает 80** — в `ss -ltnp` порта 80 нет,
   либо `nginx -t` падает с ошибкой конфига.

Проверить, что дело не в самой панели: `NITRO_HOST=127.0.0.1` — так и
задумано, наружу панель выпускает nginx.

### Решение

Добавить адрес/имя в `server_name` и перезагрузить nginx:

```bash
sudo sed -i 's/server_name .*/server_name 192.168.0.104 panel.local;/' \
  /etc/nginx/sites-available/cardinal-panel.conf
sudo nginx -t && sudo systemctl reload nginx
```

Либо переустановить панель с правильными именами:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --domain 192.168.0.104 \
  --hostname panel.local
```

И открыть порты в брандмауэре:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 10. `npm install failed — migrations may not run`

### Симптом

Установщик пишет `npm install failed — see the error above` и/или
`migrations failed - the panel cannot start without a schema`.

### Диагностика

```bash
df -h /                                    # место
journalctl -u cardinal-panel -n 50         # что именно упало
curl -sS -I https://registry.npmjs.org/    # есть ли сеть до реестра
sudo -u cardinal test -w /opt/cardinal-panel && echo writable
```

### Причина

`npm ci`/`npm install` не прошёл: кончилось место или нет сети до реестра
npm. Это вторичная ошибка — установщик сначала пробует применить миграции
без зависимостей (для SQLite достаточно встроенного `node:sqlite`), и
`node_modules` ставит только если миграция не прошла.

### Решение

1. Освободить место (см. раздел 4) и/или обеспечить доступ к реестру.
2. Применить миграции вручную — для SQLite зависимости не нужны:

```bash
cd /opt/cardinal-panel && sudo -u cardinal node scripts/migrate-sqlite.mjs
```

3. Убедиться, что схема применилась, и запустить панель:

```bash
sudo systemctl restart cardinal-panel
curl -fsS http://127.0.0.1:3000/api/health
```

Для MySQL зависимости нужны (`mysql2`):

```bash
cd /opt/cardinal-panel
sudo npm ci --omit=dev --no-audit --no-fund --ignore-scripts
DB_DIALECT=mysql node scripts/with-env.mjs DB_DIALECT=mysql -- \
  node node_modules/drizzle-kit/bin.cjs migrate
```

---

## 11. Панель стартует, но `/api/health` отдаёт 503

### Симптом

```bash
curl -sS -i http://127.0.0.1:3000/api/health
# HTTP/1.1 503 Service Unavailable
# {"status":"degraded","database":"unavailable","error":"..."}
```

Панель при этом открывается, но логины и списки не работают.

### Диагностика

```bash
curl -sS http://127.0.0.1:3000/api/health
journalctl -u cardinal-panel -n 50
grep -E 'DB_DIALECT|SQLITE_PATH|DB_HOST|DB_NAME' /etc/cardinal-panel/panel.env
sudo ls -la /var/lib/cardinal-panel/
sudo -u cardinal test -w /var/lib/cardinal-panel && echo "каталог доступен на запись"
```

### Причина

База недоступна:

- в `panel.env` указан один диалект, а база подключается по другому
  (`DB_DIALECT=sqlite` при живом MySQL или наоборот);
- для SQLite — нет прав на каталог данных (в `ProtectSystem=strict`
  писать можно только в `/var/lib/cardinal-panel`, владелец — `cardinal`);
- для MySQL — неверные реквизиты, база недоступна по сети или упал сам
  MySQL;
- база повреждена после неудачного восстановления.

### Решение

Проверить права и путь:

```bash
sudo chown -R cardinal:cardinal /var/lib/cardinal-panel
sudo chmod 0750 /var/lib/cardinal-panel
sudo chmod 0640 /var/lib/cardinal-panel/panel.sqlite
```

Проверить, что процесс видит ту же базу, что и оператор:

```bash
systemctl show cardinal-panel -p Environment | tr ' ' '\n' | grep -E 'SQLITE|DB_'
```

Для MySQL — разобрать подключение по шагам (сеть → авторизация → база →
права):

```bash
cd /opt/cardinal-panel
node scripts/check-db-connection.mjs --host <DB_HOST> --user <DB_USER> --database <DB_NAME>
```

Пароль лучше передавать переменной окружения, а не аргументом (иначе он
останется в истории командной строки):

```bash
DB_PASSWORD=... node scripts/check-db-connection.mjs
```

После исправления:

```bash
sudo systemctl restart cardinal-panel
curl -fsS http://127.0.0.1:3000/api/health
```

Если база повреждена — восстановить из бэкапа (см.
[OPERATIONS.md → Бэкап и восстановление](./OPERATIONS.md#бэкап-и-восстановление)).

---

## 12. Нода не отвечает: `fetch failed` или «внутренний адрес запрещён»

### Симптом

При добавлении узла:

```
Нода не отвечает: [GET] "http://192.168.0.104:8080/v1/system/info": <no response>; fetch failed
```

или

```
URL ноды: внутренний адрес 192.168.0.104 запрещён. Добавьте подсеть ноды в
NODE_TRUSTED_CIDRS (env панели), например NODE_TRUSTED_CIDRS=192.168.0.0/16
```

### Диагностика

Проверить, что wings отвечает и с какого адреса:

```bash
# с самой машины панели
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.0.104:8080/v1/ping
# 200 - wings жив, /v1/ping не требует токена
```

Если таймаут — панель не видит узел по сети: не проброшен порт, или
брандмауэр режет. Если `400` на `/v1/version` — узел жив, но токен не тот.

### Причина

Два разных случая:

- **`fetch failed`** — запрос не установился: порт закрыт, адрес не
  проброшен, или указан публичный адрес, за которым нет ноды. Панель
  ходит по HTTP без прокси, поэтому публичный адрес без проброса порта
  не сработает.
- **«внутренний адрес запрещён»** — SSRF-барьер панели. Внутренние адреса
  разрешены только из подсетей, перечисленных в `NODE_TRUSTED_CIDRS`.

### Решение

Для внутренней сети — разрешить подсеть:

```bash
sudo sed -i 's|^NODE_TRUSTED_CIDRS=.*|NODE_TRUSTED_CIDRS="192.168.0.0/16"|' /etc/cardinal-panel/panel.env
sudo systemctl restart cardinal-panel
```

Для публичного адреса — пробросить порт на роутере и открыть его в
брандмауэре ноды:

```bash
sudo ufw allow from <подсеть панели> to any port 8080 proto tcp
```

Проверить, что адрес из панели действительно отвечает:

```bash
curl -sS -H "Authorization: Bearer <токен ноды>" http://192.168.0.104:8080/v1/version
```

---

## 13. Запись в панель падает: `database or disk is full`

### Симптом

Любое действие, которое пишет в базу, отдаёт 500:

```
POST /api/admin/blueprints/import 500 (Server Error)
POST /api/account/logins          500 (Server Error)
DELETE /api/admin/database-hosts/1 500 (Server Error)
```

При этом `/api/health` отвечает `status: ok` — чтение из базы работает,
ломается только запись. В журнале:

```
cause: Error: database or disk is full
code: 'ERR_SQLITE_ERROR', errcode: 13
```

### Диагностика

```bash
df -h /
curl -sS http://127.0.0.1:3000/api/health | grep -A3 '"disk"'
journalctl -u cardinal-panel --since "10 min ago" --no-pager | grep -i 'disk is full' | head
```

Раздел `disk` в health показывает свободное место на разделе с базой;
при нехватке статус становится `degraded`.

### Причина

Раздел с базой заполнен. Частые источники на ноде платформы:

- `/root/.cardinal/images` — образы контейнеров (десятки тысяч файлов);
- `/root/.cardinal/volumes` — тома удалённых контейнеров, они переживают
  удаление контейнера;
- журнал systemd (`journalctl --disk-usage`).

### Решение

```bash
cardinal system prune        # контейнеры, образы и тома (cardinal 2.4.10+)
cardinal volume prune        # только тома (на старых версиях)
journalctl --disk-usage
sudo journalctl --vacuum-size=100M
sudo apt-get clean && sudo apt-get autoremove -y
```

Чтобы журнал не разросся обратно:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' | sudo tee /etc/systemd/journald.conf.d/size.conf
sudo systemctl restart systemd-journald
```

После освобождения места панель работает сама; перезапуск не обязателен,
но можно перезапустить для ровного счёта:

```bash
sudo systemctl restart cardinal-panel
```

---

## Панель не открывается с другой машины в сети

Разбираем **по слоям**: DNS → сеть → firewall → nginx → процесс. Останавливайтесь
на первом слое, который дал сбой — следующие зависят от него.

### Слой 1. DNS

Клиент должен превратить имя в адрес.

```bash
# на клиенте
getent hosts panel.local
ping -c1 panel.local
dig +short panel.example.com
```

| Что видим | Что значит |
|---|---|
| `NXDOMAIN` | имя не резолвится → [раздел 2](#2-имя-панели-не-резолвится-nxdomain) |
| адрес есть, но чужой | в DNS/A-записи или в mDNS указан не тот хост |
| адрес верный | идём к слою 2 |

### Слой 2. Сеть

```bash
# на клиенте
ping -c3 <IP-панели>
nc -vz <IP-панели> 80
nc -vz <IP-панели> 3000
```

| Что видим | Что значит |
|---|---|
| ping не проходит | клиент и панель в разных подсетях/VLAN, нет маршрута — проблема не в панели |
| ping проходит, `nc` на 80 молчит | до nginx не доходим → слой 3 |
| `nc` на 3000 недоступен снаружи | так и задумано: панель слушает только `127.0.0.1` |

### Слой 3. Firewall

```bash
# на панели
ufw status verbose
firewall-cmd --list-all 2>/dev/null
ss -ltnp | grep ':80'
```

| Что видим | Что значит |
|---|---|
| 80/tcp не разрешён | → [раздел 1](#1-панель-не-открывается-из-сети-таймаут) |
| 80/tcp разрешён, но nginx не слушает | → слой 4 |
| всё открыто | → слой 4 |

### Слой 4. nginx

```bash
systemctl status nginx
nginx -t
grep -n 'listen\|server_name\|proxy_pass' /etc/nginx/sites-available/cardinal-panel.conf
sudo ss -ltnp | grep nginx
```

| Что видим | Что значит |
|---|---|
| `nginx: [emerg]` в `nginx -t` | сломан конфиг (часто — `server_name` с URL) → [раздел 6](#6-certbot-appears-to-be-a-url-not-a-fqdn) |
| nginx слушает только IPv4 | клиент приходит по IPv6 → добавьте `listen [::]:80;` |
| `server_name` не содержит имя/адрес клиента | запрос попал в default-сервер → [раздел 9](#9-панель-отвечает-по-1270011-но-не-по-внешнему-ip) |
| `proxy_pass` указывает на неверный порт | порт панели не 3000 → сверьте с `NITRO_PORT` в `panel.env` |

Локальная проверка через сам nginx (с правильным Host):

```bash
curl -sS -I -H 'Host: panel.local' http://127.0.0.1/
```

### Слой 5. Процесс панели

```bash
systemctl status cardinal-panel
journalctl -u cardinal-panel -n 50
curl -sS http://127.0.0.1:3000/api/health
ss -ltnp | grep ':3000'
```

| Что видим | Что значит |
|---|---|
| сервис `inactive (dead)` | смотрите журнал; частая причина — не сработавший `WorkingDirectory` после неудачного обновления |
| сервис `active (running)`, но 503 от health | БД недоступна → [раздел 11](#11-панель-стартует-но-apihealth-отдаёт-503) |
| health 200, через nginx не отвечает | проблема в nginx (слой 4) |
| `ProtectSystem=strict` мешает записи | панель пишет только в `/var/lib/cardinal-panel` |

### Сводка

| Симптом | Первый подозреваемый | Раздел |
|---|---|---|
| `NXDOMAIN` | DNS/mDNS/зона `.local` | [2](#2-имя-панели-не-резолвится-nxdomain) |
| таймаут, `ping` проходит | брандмауэр | [1](#1-панель-не-открывается-из-сети-таймаут) |
| «connection refused» | nginx не слушает / упал | [4](#панель-не-открывается-с-другой-машины-в-сети) |
| 502 от nginx | панель не поднялась | [5](#5-cannot-read-package-configentitiespackagejson), [11](#11-панель-стартует-но-apihealth-отдаёт-503) |
| пустая страница, логи молчат | маршрутизация/`Host` | [9](#9-панель-отвечает-по-1270011-но-не-по-внешнему-ip) |

---

## Скрипты панели работают не с той базой

### Симптом

- `create-admin.mjs` отработал, но в панели вход не проходит;
- `migrate-sqlite.mjs` отработал, а таблиц в панели нет;
- `admin-api-key.mjs` выдал ключ, который панель не принимает.

### Диагностика

Показать, какую базу видит скрипт и какая база у панели:

```bash
grep SQLITE_PATH /etc/cardinal-panel/panel.env
systemctl show cardinal-panel -p Environment | tr ' ' '\n' | grep SQLITE
sudo ls -la /var/lib/cardinal-panel/panel.sqlite
sudo ls -la /opt/cardinal-panel/data/panel.sqlite 2>/dev/null
sudo -u cardinal sqlite3 /var/lib/cardinal-panel/panel.sqlite \
  "SELECT email, role FROM users;"
```

### Причина

Путь к базе задаётся в `/etc/cardinal-panel/panel.env` — том же файле, что
читает systemd-юнит. Скрипты, запущенные **вручную без окружения**, раньше
брали путь только из переменной окружения и работали с
`./data/panel.sqlite` вместо `/var/lib/cardinal-panel/panel.sqlite`.

Исправлено в **0.5.4**: скрипты читают `panel.env` (путь переопределяется
`PANEL_ENV_FILE`), если `SQLITE_PATH` не задан в окружении.

Порядок выбора пути:

1. `--db=…` в аргументах;
2. `SQLITE_PATH` из окружения;
3. `SQLITE_PATH` из `panel.env`;
4. `./data/panel.sqlite` (запасной вариант).

### Решение

На 0.5.4 и новее — запускать из каталога установки, без указания пути:

```bash
cd /opt/cardinal-panel
sudo -u cardinal node scripts/create-admin.mjs --email=you@example.com
sudo -u cardinal node scripts/migrate-sqlite.mjs
sudo -u cardinal node scripts/admin-api-key.mjs --email=admin@example.com --scopes=nodes:2
```

Проверить, какую базу возьмёт скрипт (подставив путь из `panel.env`):

```bash
cd /opt/cardinal-panel
sudo -u cardinal node scripts/migrate-sqlite.mjs --db=/var/lib/cardinal-panel/panel.sqlite
```

На версиях до 0.5.4 — убрать «лишнюю» базу и пересоздать админа:

```bash
sudo rm -rf /opt/cardinal-panel/data
cd /opt/cardinal-panel && sudo -u cardinal node scripts/create-admin.mjs \
  --email=you@example.com
```

В режиме cardinal те же скрипты выполняются внутри контейнера, где путь
другой (`/app/data/panel.sqlite`, том `panel-data`):

```bash
cardinal exec panel node scripts/migrate-sqlite.mjs
```

---

## Быстрая самопроверка

```bash
systemctl is-active cardinal-panel
systemctl is-enabled cardinal-panel
curl -sS http://127.0.0.1:3000/api/health
nginx -t
grep -E 'NUXT_PANEL_URL|SQLITE_PATH|DB_DIALECT' /etc/cardinal-panel/panel.env
df -h /var/lib/cardinal-panel
journalctl --disk-usage
sudo ls -la /var/lib/cardinal-panel/
```

Если панель жива, а проблема с внешним доступом — вернитесь к разделу
[«Панель не открывается с другой машины в сети»](#панель-не-открывается-с-другой-машины-в-сети)
и идите по слоям.
