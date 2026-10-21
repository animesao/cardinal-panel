# Обновление cardinal-panel

Обновление панели — та же установка, что и первичная: установщик идемпотентен
и сам останавливает сервис, подменяет файлы, применяет миграции и проверяет
здоровье.

- [Обычное обновление](#обычное-обновление)
- [Обновление до конкретной версии](#обновление-до-конкретной-версии)
- [Что происходит при обновлении](#что-происходит-при-обновлении)
- [Миграции базы данных](#миграции-базы-данных)
- [Откат на предыдущую версию](#откат-на-предыдущую-версию)
- [Обновление в режиме cardinal](#обновление-в-режиме-cardinal)
- [Обновление через Docker](#обновление-через-docker)
- [Проверка после обновления](#проверка-после-обновления)
- [Что делать, если обновление сломалось](#что-делать-если-обновление-сломалось)

---

## Обычное обновление

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash
```

Установщик:

1. найдёт последний релиз;
2. скачает архив и **проверит SHA-256**;
3. **остановит** работающую панель;
4. заменит файлы в `/opt/cardinal-panel` (старый `.output` удаляется целиком —
   мёртвых чанков не остаётся);
5. применит миграции;
6. перезапустит сервис и проверит `/api/health`.

Переустанавливать каждый раз с полным набором ключей **не нужно**:
секреты и публичный адрес сохраняются из `/etc/cardinal-panel/panel.env`.

Но если адрес или админ изменились — передайте их явно:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --domain panel.example.com --hostname panel.local --admin-email admin@example.com
```

---

## Обновление до конкретной версии

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- --version 0.5.4
```

Список релизов: <https://github.com/animesao/cardinal-panel/releases>

---

## Что происходит при обновлении

| Что | Как |
|---|---|
| Секреты | `NEXTAUTH_SECRET` сохраняется — сессии не разламываются |
| База | Миграции применяются поверх существующей, данные не теряются |
| Файлы | Каталог `.output` заменяется целиком |
| Панель | Останавливается на время замены файлов, потом стартует |
| nginx | Конфиг перезаписывается по текущим флагам |
| Узел wings | Не трогается: связь хранится в БД панели |

Перед обновлением **сделайте резервную копию базы** — это одна команда
(подробности в [эксплуатации](OPERATIONS.md)):

```bash
sudo systemctl stop cardinal-panel
sudo cp /var/lib/cardinal-panel/panel.sqlite /var/lib/cardinal-panel/panel.sqlite.bak
sudo systemctl start cardinal-panel
```

---

## Миграции базы данных

Миграции применяются автоматически и **идемпотентны**: применённые теги
пропускаются (в логе видно `- skip 0000_...`), поэтому повторный запуск
установщика безопасен.

```bash
# вручную (скрипт сам читает путь к БД из /etc/cardinal-panel/panel.env)
cd /opt/cardinal-panel && node scripts/migrate-sqlite.mjs
```

Для MySQL:

```bash
cd /opt/cardinal-panel && npm run db:migrate:mysql
```

> **Важно:** `node scripts/migrate-sqlite.mjs` и `npm run db:migrate` без
> `SQLITE_PATH` в окружении пишут в `./data/panel.sqlite`, а панель читает
> `/var/lib/cardinal-panel/panel.sqlite`. С версии **0.5.4** скрипты сами
> берут путь из `panel.env`, но путь можно уточнить явно:
> `node scripts/migrate-sqlite.mjs --db=/var/lib/cardinal-panel/panel.sqlite`.

---

## Откат на предыдущую версию

Откат возможен, пока миграции новой версии не удаляли нужные данные.
Порядок:

```bash
# 1. остановить панель
sudo systemctl stop cardinal-panel

# 2. восстановить базу из копии (миграции новой версии несовместимы со старой)
sudo cp /var/lib/cardinal-panel/panel.sqlite.bak /var/lib/cardinal-panel/panel.sqlite

# 3. поставить старую версию
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- --version 0.5.3

# 4. миграции применятся заново ( idempotentно )
sudo systemctl start cardinal-panel
curl -s http://127.0.0.1:3000/api/health
```

Если новая версия добавляла колонки, старая их просто не увидит — обычно
это безопасно. Если менялись формат данных — откат может потребовать
ручного вмешательства, поэтому **резервная копия перед обновлением
обязательна**.

---

## Обновление в режиме cardinal

Тот же установщик, но образ пересобирается:

```bash
curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash -s -- \
  --install-mode cardinal --domain panel.example.com
```

Контейнер пересоздаётся, том `panel-data` с базой остаётся на месте.

Проверить, что новый образ действительно пересобран:

```bash
cardinal images | grep cardinal-panel
```

---

## Обновление через Docker

```bash
cd cardinal-panel
git pull
docker compose build --pull
docker compose up -d
```

БД — в именованном томе `panel-data`, он переживает пересборку.

---

## Проверка после обновления

```bash
systemctl status cardinal-panel
journalctl -u cardinal-panel -n 50 --no-pager
curl -s http://127.0.0.1:3000/api/health
```

Ожидаемый ответ:

```json
{
  "status": "ok",
  "version": "0.5.4",
  "uptimeSeconds": 12,
  "timestamp": "2026-10-21T05:00:00.000Z",
  "database": "ok"
}
```

`"database": "unavailable"` означает, что панель поднялась, но не видит
базу — проверьте `DB_DIALECT`, `SQLITE_PATH` и права на каталог данных.

Дополнительно:

- откройте панель в браузере и убедитесь, что вход работает (сессии не
  должны слететь — секрет сохраняется);
- проверьте, что узел wings на месте: Admin → Nodes, статус «online»;
- если были включены OAuth-провайдеры — они лежат в БД и переживают
  обновление, но проверьте, что кнопки входа появились.

---

## Что делать, если обновление сломалось

Смотрите [диагностику](TROUBLESHOOTING.md). Самое частое:

| Симптом | Причина | Что делать |
|---|---|---|
| `Service is running`, но `/api/health` → 503 | панель не видит БД | `journalctl -u cardinal-panel -n 50`, проверить `SQLITE_PATH` и права |
| `database or disk is full` | кончилось место | `df -h /`, `apt-get clean`, `journalctl --vacuum-size=50M` |
| `Not enough free space` | место кончилось до распаковки | освободить место, повторить |
| Панель не отвечает снаружи | firewall | `ufw allow 80/tcp` |
| Вход не работает | admin создан в другой базе | `rm -rf /opt/cardinal-panel/data`, пересоздать админа (0.5.4+) |

Панель всегда можно вернуть в рабочее состояние: установщик не удаляет
базу и секреты, поэтому повторный запуск безопасен.

---

Дальше: [установка](INSTALL.md) · [настройка](CONFIGURE.md) ·
[эксплуатация](OPERATIONS.md) · [проблемы](TROUBLESHOOTING.md)
