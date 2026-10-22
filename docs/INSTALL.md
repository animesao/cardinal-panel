# Установка cardinal-panel

Панель — веб-интерфейс управления игровыми серверами, которые работают на
[node cardinal](https://github.com/animesao/cardinal) через
[cardinal-wings](https://github.com/animesao/cardinal-wings).

- [Требования](#требования)
- [Быстрая установка](#быстрая-установка)
- [Все ключи установщика](#все-ключи-установщика)
- [Режимы установки](#режимы-установки)
- [Публичный адрес и HTTPS](#публичный-адрес-и-https)
- [Дополнительные имена доступа](#дополнительные-имена-доступа)
- [Установка из исходников](#установка-из-исходников)
- [Установка в Docker](#установка-в-docker)
- [Установка на runtime cardinal](#установка-на-runtime-cardinal)
- [Что делает установщик](#что-делает-установщик)
- [После установки](#после-установки)
- [Удаление](#удаление)

---

## Требования

| | |
|---|---|
| ОС | Linux с systemd (проверено на Ubuntu 24.04) |
| Node.js | **≥ 24** — нужен встроенный `node:sqlite`; на 23.4+ модуль есть без experimental-флага, но 24 — проверенная версия |
| RAM | 150 МБ у панели, реально ~200 МБ |
| Диск | 60 МБ под панель + место под базу, логи и бэкапы |
| БД | SQLite (по умолчанию, файл) или MySQL 8 |
| Права | установка требует root |

Панели нужен **cardinal-wings** — это агент на узле, который управляет
контейнерами. Панель сама контейнеры не запускает, она ими управляет
через wings.

---

## Быстрая установка

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash
```

Установщик скачает последний релиз, проверит SHA-256, развернёт панель,
создаст системного пользователя, сгенерирует секреты, применит миграции,
поднимет systemd-юнит и nginx.

Полная установка — с публичным адресом, первым администратором и
подключённым узлом wings:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --domain panel.example.com \
  --hostname panel.local \
  --admin-email admin@example.com \
  --wings-url http://10.0.0.5:8080 \
  --wings-token <токен-из-установщика-wings>
```

---

## Все ключи установщика

| Ключ | Значение | Назначение |
|---|---|---|
| `--version <X.Y.Z>` | | Версия панели. По умолчанию — последний релиз |
| `--dir <путь>` | `/opt/cardinal-panel` | Каталог установки |
| `--data-dir <путь>` | `/var/lib/cardinal-panel` | Каталог данных (файл БД) |
| `--port <порт>` | `3000` | Порт, на котором слушает панель |
| `--domain <хост>` | | Публичный адрес. Включает nginx; для домена — ещё и TLS |
| `--hostname <имя>` | | Дополнительное имя доступа. Можно указать несколько раз |
| `--admin-email <почта>` | | E-mail первого администратора |
| `--wings-url <url>` | | Адрес узла wings (`http://хост:8080`) |
| `--wings-token <токен>` | | Токен узла wings. Требуется вместе с `--wings-url` |
| `--install-mode <режим>` | `systemd` | `systemd` — родной процесс, `cardinal` — контейнер на cardinal |
| `--network <режим>` | `host` | Сетевой режим контейнера: `host` или `bridge` |
| `--image-tag <тег>` | `cardinal-panel:<версия>` | Тег собираемого образа (режим `cardinal`) |
| `--min-free <МиБ>` | `256` | Минимально свободное место; меньше — установка прервётся |
| `--no-proxy` | | Не ставить nginx |
| `--no-tls` | | Не выпускать сертификат |
| `--no-start` | | Установить, но не запускать |
| `--uninstall` | | Снять панель (данные сохраняются) |

Значения `http://`, `https://`, путь и порт в `--domain` и `--hostname`
отбрасываются: `https://example.com/` и `example.com` — одно и то же.

---

## Режимы установки

### `systemd` (по умолчанию)

Панель работает как обычный системный сервис.

```
/opt/cardinal-panel/          файлы приложения (.output, scripts, server)
/var/lib/cardinal-panel/      база данных
/etc/cardinal-panel/panel.env конфигурация (0600, владелец cardinal)
/etc/systemd/system/cardinal-panel.service
```

Юнит запускает `node .output/server/index.mjs` от пользователя `cardinal`
с песочницей (`ProtectSystem=strict`, `NoNewPrivileges`, `PrivateTmp`).
Секреты лежат в отдельном `EnvironmentFile` с правами 0600 — они не
светятся в `systemctl show`.

### `cardinal`

Панель работает как контейнер на runtime cardinal.

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --install-mode cardinal --domain panel.example.com
```

Образ `cardinal-panel:<версия>` собирается из того же релизного пакета
(`Dockerfile.cardinal`, одна стадия — сборка `.output` уже готова).
Данные — в именованном томе cardinal `panel-data`, конфиг — тот же
`panel.env`.

Требуется установленный cardinal:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal/main/install.sh | sudo bash
```

### Docker

```bash
git clone https://github.com/animesao/cardinal-panel.git
cd cardinal-panel
cp .env.example .env      # заполнить NEXTAUTH_SECRET и NUXT_PANEL_URL
docker compose up -d
```

---

## Публичный адрес и HTTPS

`--domain` задаёт адрес, по которому панель будет доступна снаружи.

**Домен** (`panel.example.com`) — установщик:

1. ставит nginx и пишет vhost с проксированием на `127.0.0.1:3000`;
2. получает сертификат Let's Encrypt через certbot и переводит nginx на
   HTTPS с редиректом;
3. прописывает `NUXT_PANEL_URL=https://panel.example.com` — этот адрес
   уходит в wings и используется в OAuth-колбэках.

Для этого нужна A-запись домена на IP машины **до** запуска установщика:
certbot проверяет владение доменом.

**IP-адрес** (`192.168.0.104`) — Let's Encrypt сертификаты на IP не
выдаёт, поэтому TLS пропускается, панель работает по HTTP. Такой режим
подходит для локальной сети без OAuth-провайдеров.

> Установщик предупредит, если переданный адрес не совпадает с адресом
> этой машины: клиенты не достучатся, а в браузере будет «превышено время
> ожидания ответа».

---

## Дополнительные имена доступа

Панель принимает **любой** Host (в next-auth включён `trustHost`), поэтому
достаточно сказать nginx, какие имена обслуживать:

```bash
... install.sh -s -- --domain 192.168.0.104 --hostname panel.local --hostname cardinal.local
```

Что делает установщик:

- `server_name` nginx получает все имена: `192.168.0.104 panel.local cardinal.local`;
- имена добавляются в `/etc/hosts` сервера;
- если установлен `avahi-daemon` — имена публикуются через **mDNS**, и
  `panel.local` видно всей локальной сети без настройки DNS на клиентах;
- если `avahi` нет, установщик скажет об этом и подскажет, что добавить
  в hosts-файл клиента.

```bash
apt-get install -y avahi-daemon     # чтобы .local заработал в сети
```

**mDNS публикует только имена в зоне `.local`** — для `panel` (без
`.local`) нужно либо DNS-запись, либо hosts-файл на каждом клиенте.

Адрес, который панель сообщает сама (`NUXT_PANEL_URL`), остаётся
основным — `--domain`. Алиасы нужны только для удобства входа.

---

## Установка из исходников

```bash
git clone https://github.com/animesao/cardinal-panel.git
cd cardinal-panel
npm ci
cp .env.example .env          # заполнить NEXTAUTH_SECRET, NUXT_PANEL_URL
npm run db:migrate            # миграции SQLite
npm run create-admin -- --email=admin@example.com
npm run dev                   # http://localhost:3000
```

Сборка для production:

```bash
npm run build
node .output/server/index.mjs
```

---

## Что делает установщик

По шагам, в порядке выполнения:

1. **Проверки.** Версия `--install-mode` и `--network`, права root,
   свободное место на диске (`--min-free`, по умолчанию 128 МиБ).
2. **Версия.** Если не указана — последний релиз через GitHub API;
   ответ проверяется на SemVer, иначе выводится внятная ошибка.
3. **Загрузка.** Архив `.tar.gz` и `.sha256` с GitHub Releases; SHA-256
   **обязательно** проверяется — при несовпадении установка прерывается.
4. **Остановка сервиса.** Если панель уже установлена, она корректно
   останавливается до замены файлов (иначе процесс падал бы на
   удалённых чанках, а `Restart=on-failure` поднимал его снова).
5. **Файлы.** Раскладка в `/opt/cardinal-panel`, права выставлены.
6. **Конфигурация.** `/etc/cardinal-panel/panel.env`: `NEXTAUTH_SECRET`
   генерируется и **сохраняется** при переустановке (иначе все сессии
   разломались бы), публичный адрес и путь к БД — по вашим флагам.
7. **Миграции.** Идемпотентно: уже применённые теги показываются как
   `- skip`.
8. **systemd-юнит.** Ставится и включается в автозагрузку.
9. **Запуск и проверка.** Панель опрашивается на `/api/health`.
10. **Первый администратор.** Создаётся неинтерактивно, пароль
    генерируется и печатается один раз в финальном отчёте.
11. **nginx и TLS.** Если задан `--domain`.
12. **Брандмауэр.** Открываются 80/tcp, 443/tcp и 5353/udp (mDNS) —
    ufw или firewalld.
13. **Узел wings.** Если заданы `--wings-url` и `--wings-token`: узел
    заводится через API панели, временный админ-ключ сразу отзывается.

---

## После установки

```bash
# состояние
systemctl status cardinal-panel
curl -s http://127.0.0.1:3000/api/health

# логи
journalctl -u cardinal-panel -f

# сменить пароль админа
cd /opt/cardinal-panel && node scripts/create-admin.mjs --email=admin@example.com
```

Дальше — по шагам:

1. **Локация.** Admin → Locations: «Домашняя сеть» и т.п. Узел ссылается
   на локацию, а в интерфейсе она группирует ноды.
2. **Узел.** Admin → Nodes → Add node: URL, токен, лимиты памяти/диска/swap
   (в байтах). Лимиты смотрите на самой машине: `free -m`, `df -h /`.
3. **Способы входа.** Admin → Настройки: включить нужные OAuth-провайдеры
   (client_id/secret). Секреты шифруются в БД автоматически.

> OAuth-провайдеры требуют **https** и зарегистрированного
> callback-URL. На HTTP и по IP-адресу они не работают.

---

## Удаление

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- --uninstall
```

Снимаются systemd-юнит, vhost nginx, compose-файл cardinal и образ
панели. **База данных и каталог установки удаляются** — чтобы их
сохранить, передайте `KEEP_DATA=1` (переменная должна попасть в bash,
а не в curl):

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo KEEP_DATA=1 bash -s -- --uninstall
```

Секреты в `/etc/cardinal-panel/panel.env` остаются: чтобы панель можно
было поднять заново с теми же сессиями. Удалите каталог вручную, если он
не нужен.

> Перед удалением с `KEEP_DATA=1` сделайте резервную копию базы —
> инструкция в [эксплуатации](OPERATIONS.md).

Дальше: [обновление](UPGRADE.md) · [настройка](CONFIGURE.md) ·
[эксплуатация](OPERATIONS.md) · [проблемы](TROUBLESHOOTING.md)
