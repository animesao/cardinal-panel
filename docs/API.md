# API панели

Панель предоставляет три API. Основной — **Pterodactyl-совместимый
Client API** (`/v1`), чтобы существующие клиенты работали без
изменений.

- [Аутентификация](#аутентификация)
- [Client API (`/v1`)](#client-api-v1)
- [Панельный API (`/api`)](#панельный-api-api)
- [Админский API (`/api/admin`)](#админский-api-apiadmin)
- [Колбэки от wings (`/api/remote`)](#колбэки-от-wings-apiremote)
- [Служебные](#служебные)
- [Коды ошибок](#коды-ошибок)

---

## Аутентификация

### API-ключ (для Client API)

```
Authorization: Bearer cp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Ключ выдаётся пользователю (Account → API-ключи) или администратором:

```bash
cd /opt/cardinal-panel && node scripts/admin-api-key.mjs \
  --email=admin@example.com --name=ci --scopes=nodes:2
```

Уровни доступа: `1` — чтение, `2` — запись. Секрет показывается один
раз: в БД лежит только SHA-256 хэш.

Ключ работает, только если его маршрут входит в `KEY_POLICY`
(`server/utils/apikey-auth.ts`). Управление ключами и настройками через
API **намеренно невозможно** — только через интерфейс.

### Сессия (для панельного API)

Обычный вход через `/api/auth/*` (NextAuth). Куки
`kt_panel_session`. Панельный API работает с сессией; внешние клиенты —
с API-ключом.

### Ограничения

| | |
|---|---|
| Rate limit клиентского API | 60 запросов в минуту на ключ |
| Rate limit входа | 10 попыток на e-mail за 15 минут, 30 на IP за 10 минут |
| Rate limit 2FA | 5 попыток на пользователя за 5 минут |

Счётчики входа ведутся по **идентичности** (e-mail), а не по IP: IP берётся
из доверенного источника (см. `TRUSTED_PROXY`), потому что
`X-Forwarded-For` подделывается клиентом.

---

## Client API (`/v1`)

Pterodactyl-совместимые маршруты. Требуют API-ключ.

### Аккаунт и пользователи

| Метод | Путь | Уровень | Что делает |
|---|---|---|---|
| `GET` | `/v1/account` | 1 | Текущий пользователь |
| `GET` | `/v1/users` | 1 | Список пользователей (админ) |
| `GET` | `/v1/users/{id}` | 1 | Пользователь по id |

### Серверы

| Метод | Путь | Уровень | Что делает |
|---|---|---|---|
| `GET` | `/v1/servers` | 1 | Свои серверы |
| `GET` | `/v1/servers/{uuid}` | 1 | Сервер по uuid |
| `GET` | `/v1/servers/{uuid}/resources` | 1 | Ресурсы: cpu, память, диск |
| `POST` | `/v1/servers/{uuid}/power` | 2 | `start` / `stop` / `restart` / `kill` |
| `POST` | `/v1/servers/{uuid}/command` | 2 | Команда в консоль |

### Справочники

| Метод | Путь | Уровень |
|---|---|---|
| `GET` | `/v1/locations` | 1 |
| `GET` | `/v1/nodes` | 1 |
| `GET` | `/v1/nodes/{id}` | 1 |
| `GET` | `/v1/nodes/{id}/allocations` | 1 |
| `GET` | `/v1/blueprints` | 1 |
| `GET` | `/v1/blueprints/{id}` | 1 |
| `GET` | `/v1/database-hosts` | 1 |
| `GET` | `/v1/server-databases` | 1 |

Пример:

```bash
curl -H "Authorization: Bearer cp_..." http://192.168.0.104:3000/v1/servers
```

---

## Панельный API (`/api`)

Маршруты для интерфейса панели. Работают с сессией; частично — с
API-ключом.

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/api/health` | Проверка живости (без авторизации) |
| `GET` | `/api/settings/public` | Публичные настройки (название, включённые способы входа) |
| `GET` | `/api/account/locale` | Язык пользователя |
| `PUT` | `/api/account/locale` | Сменить язык |
| `PUT` | `/api/account/password` | Сменить пароль |
| `GET` | `/api/account/2fa` | Состояние 2FA |
| `POST` | `/api/account/2fa/setup` | Начать настройку 2FA |
| `POST` | `/api/account/2fa/enable` | Включить 2FA |
| `POST` | `/api/account/2fa/disable` | Выключить 2FA |
| `POST` | `/api/account/2fa/backup-codes` | Новые резервные коды |
| `GET` | `/api/account/api-keys` | Свои API-ключи |
| `POST` | `/api/account/api-keys` | Создать API-ключ |
| `DELETE` | `/api/account/api-keys/{id}` | Удалить API-ключ |
| `GET` | `/api/account/logins` | История входов |
| `POST` | `/api/users/sftp-password` | SFTP-пароль |
| `GET` | `/api/servers/my` | Свои серверы |
| `GET` | `/api/servers/{id}` | Сервер |
| `GET` | `/api/servers/{id}/status` | Статус (power, ресурсы) |
| `POST` | `/api/servers/{id}/power` | Управление питанием |
| `POST` | `/api/servers/{id}/command` | Команда в консоль |
| `GET` | `/api/servers/{id}/files` | Список файлов |
| `GET` | `/api/servers/{id}/files/contents` | Содержимое файла |
| `POST` | `/api/servers/{id}/files/write` | Записать файл |
| `DELETE` | `/api/servers/{id}/files` | Удалить файл |
| `POST` | `/api/servers/{id}/files/rename` | Переименовать |
| `POST` | `/api/servers/{id}/files/chmod` | Права |
| `POST` | `/api/servers/{id}/files/folder` | Создать папку |
| `GET` | `/api/servers/{id}/files/archive` | Скачать архив |
| `POST` | `/api/servers/{id}/files/archive` | Распаковать архив |
| `GET` | `/api/servers/{id}/files/download` | Скачать файл |
| `GET` | `/api/servers/{id}/environment` | Переменные окружения |
| `PUT` | `/api/servers/{id}/environment` | Изменить переменные |
| `GET` | `/api/servers/{id}/resources` | Ресурсы |
| `PUT` | `/api/servers/{id}/resources` | Изменить лимиты |
| `GET` | `/api/servers/{id}/backups` | Список бэкапов |
| `POST` | `/api/servers/{id}/backups` | Создать бэкап |
| `GET` | `/api/servers/{id}/backups/{backupId}/download` | Скачать бэкап |
| `POST` | `/api/servers/{id}/backups/{backupId}/restore` | Восстановить |
| `DELETE` | `/api/servers/{id}/backups/{backupId}` | Удалить бэкап |
| `GET` | `/api/servers/{id}/ports` | Порты |
| `POST` | `/api/servers/{id}/ports` | Выделить порт |
| `POST` | `/api/servers/{id}/ports/{allocationId}/primary` | Сделать порт основным |
| `DELETE` | `/api/servers/{id}/ports/{allocationId}` | Освободить порт |
| `GET` | `/api/servers/{id}/databases` | Базы сервера |
| `POST` | `/api/servers/{id}/databases` | Создать базу |
| `POST` | `/api/servers/{id}/databases/{dbId}/password` | Сменить пароль базы |
| `GET` | `/api/servers/{id}/schedules` | Расписания |
| `POST` | `/api/servers/{id}/schedules` | Создать расписание |
| `PUT` | `/api/servers/{id}/schedules/{schedId}` | Изменить расписание |
| `DELETE` | `/api/servers/{id}/schedules/{schedId}` | Удалить расписание |
| `POST` | `/api/servers/{id}/schedules/{schedId}/run` | Выполнить сейчас |
| `GET` | `/api/servers/{id}/users` | Пользователи сервера |
| `POST` | `/api/servers/{id}/users` | Выдать доступ |
| `PUT` | `/api/servers/{id}/users/{userId}` | Изменить права |
| `DELETE` | `/api/servers/{id}/users/{userId}` | Отозвать доступ |
| `POST` | `/api/servers/{id}/users/lookup` | Найти пользователя |
| `GET` | `/api/servers/{id}/activity` | Журнал действий |
| `GET` | `/api/servers/{id}/install-logs` | Логи установки |
| `GET` | `/api/servers/{id}/live` | Поток логов (SSE) |
| `GET` | `/api/servers/{id}/sftp` | SFTP-реквизиты |
| `POST` | `/api/servers/{id}/sftp/ensure` | Создать SFTP-доступ |
| `POST` | `/api/servers/{id}/ws-token` | Токен для WebSocket-консоли |
| `PUT` | `/api/servers/{id}/autostart` | Автозапуск |
| `PUT` | `/api/servers/{id}/settings` | Настройки сервера |
| `PUT` | `/api/servers/{id}/setup` | Образ и параметры установки |
| `PUT` | `/api/servers/{id}/startup` | Стартовая команда |
| `POST` | `/api/servers/{id}/reinstall` | Переустановка |
| `GET` | `/api/nodes/{id}/status` | Статус узла |
| `GET` | `/api/blueprints` | Шаблоны установки |

---

## Админский API (`/api/admin`)

Только для роли `admin`. Проверка роли — в обработчике, а не только в
middleware: middleware — единственный барьер, и одна ошибка в нём открыла
бы все админские маршруты.

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/api/admin/settings` | Все настройки |
| `PUT` | `/api/admin/settings` | Изменить настройки |
| `GET` | `/api/admin/users` | Пользователи |
| `POST` | `/api/admin/users` | Создать пользователя |
| `GET` | `/api/admin/users/{id}` | Пользователь |
| `PUT` | `/api/admin/users/{id}` | Изменить пользователя |
| `PUT` | `/api/admin/users/{id}/role` | Назначить роль |
| `DELETE` | `/api/admin/users/{id}` | Удалить пользователя |
| `GET` | `/api/admin/nodes` | Узлы |
| `POST` | `/api/admin/nodes` | Создать узел (+ синхронизация с wings) |
| `POST` | `/api/admin/nodes/detect` | Определить узел по URL |
| `PUT` | `/api/admin/nodes/{id}` | Изменить узел |
| `DELETE` | `/api/admin/nodes/{id}` | Удалить узел |
| `POST` | `/api/admin/nodes/{id}/sync` | Синхронизировать с wings |
| `GET` | `/api/admin/nodes/{id}/usage` | Ресурсы узла |
| `GET` | `/api/admin/nodes/{id}/types` | Типы нод |
| `GET` | `/api/admin/locations` | Локации |
| `POST` | `/api/admin/locations` | Создать локацию |
| `DELETE` | `/api/admin/locations/{id}` | Удалить локацию |
| `GET` | `/api/admin/servers` | Все серверы |
| `POST` | `/api/admin/servers` | Создать сервер |
| `PUT` | `/api/admin/servers/{id}` | Изменить сервер |
| `DELETE` | `/api/admin/servers/{id}` | Удалить сервер |
| `PUT` | `/api/admin/servers/{id}/resources` | Лимиты сервера |
| `POST` | `/api/admin/servers/{id}/suspend` | Приостановить |
| `POST` | `/api/admin/servers/{id}/unsuspend` | Возобновить |
| `GET` | `/api/admin/allocations` | Выделенные порты |
| `POST` | `/api/admin/allocations/{id}/delete` | Освободить порт |
| `GET` | `/api/admin/blueprints` | Шаблоны |
| `POST` | `/api/admin/blueprints` | Создать шаблон |
| `PUT` | `/api/admin/blueprints/{id}` | Изменить шаблон |
| `DELETE` | `/api/admin/blueprints/{id}` | Удалить шаблон |
| `POST` | `/api/admin/blueprints/import` | Импортировать шаблоны |
| `GET` | `/api/admin/database-hosts` | Хосты БД |
| `POST` | `/api/admin/database-hosts` | Создать хост |
| `POST` | `/api/admin/database-hosts/test` | Проверить хост |
| `GET` | `/api/admin/api-keys` | API-ключи пользователей |

---

## Колбэки от wings (`/api/remote`)

Вызывает **wings**, а не панель. Аутентификация — токен узла
(`Authorization: Bearer <token>`), у wings он свой.

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/api/remote/autostart` | Какие серверы поднять при старте |
| `POST` | `/api/remote/sftp/auth` | Проверка SFTP-пароля |
| `POST` | `/api/remote/backups/{uuid}` | Колбэк о завершении бэкапа |

При создании узла панель отправляет wings `POST /v1/config` с
`panel_url` и токеном — после этого wings знает, куда обращаться.

---

## Служебные

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/api/health` | Живость: `{status, version, uptimeSeconds, timestamp, database, disk}`. 503, если БД недоступна; `status: degraded`, если мало свободного места на разделе с БД |
| `POST` | `/api/setup/bootstrap` | Первичная настройка (создание первого админа по `PANEL_SETUP_TOKEN`). Только когда админов ещё нет |
| `*` | `/api/auth/*` | NextAuth: вход, сессия, колбэки OAuth |

---

## Коды ошибок

| Код | Когда |
|---|---|
| `400` | Некорректные данные (не хватает полей, неверный формат) |
| `401` | Нет сессии или API-ключ неверный |
| `403` | Недостаточно прав: не админ, недостаточный уровень ключа, узел заблокирован |
| `404` | Не найдено: сервер, узел, пользователь |
| `409` | Конфликт: e-mail уже занят, имя уже используется |
| `429` | Превышен лимит запросов; в ответе `Retry-After` |
| `500` | Внутренняя ошибка |
| `502` | Узел wings недоступен или ответил ошибкой |
| `503` | Зависимость недоступна (например, БД в `/api/health`) |

Формат ответа с ошибкой:

```json
{ "statusCode": 403, "statusMessage": "Только для администраторов" }
```

---

Дальше: [установка](INSTALL.md) · [настройка](CONFIGURE.md) ·
[разработка](DEVELOPMENT.md)
