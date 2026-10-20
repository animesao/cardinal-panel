# TODO — устранение находок аудита безопасности (16.10.2026)

Источник: полный аудит панели (`server/**`, `app/**`).
Статусы: `[ ]` — не начато, `[x]` — сделано + проверено.

## Medium

- [x] **1. Reinstall обходит suspend** — `server/api/servers/[id]/reinstall.post.ts`:
  добавить `if (srv.suspended) throw 403` до `wingsFetch` (как в `power`/`command`).
  Проверка: grep `suspended` в файле + `tsc` + build.
- [x] **2. WS-консоль обходит suspend + GET с побочным эффектом** —
  `server/api/servers/[id]/ws-token.post.ts` (бывший `.get.ts`):
  `suspended`-проверка + метод POST. Фронт: `ServerConsole.vue` — POST.
  Проверка: 405 на GET, 403 на замороженном, `tsc` + build.

## Low

- [x] **3. SFTP GET с побочным эффектом** — чтение и создание разделены:
  `sftp.get.ts` — чистое чтение (404 без строки в БД),
  `sftp/ensure.post.ts` — идемпотентное создание, `sftp.post.ts` — ротация.
  Фронт (`[id].vue loadSftp`): GET → 404 → POST ensure.
  Проверка: в GET нет `insert`/`update`/`ensureSftpCredential`, `tsc` + build.
- [x] **4. Неконстантное сравнение токена ноды** — `server/api/remote/autostart.get.ts`:
  `eq(nodes.token, secret)` заменено на перебор с `secretsEqual`
  (как в `remote/sftp/auth.post.ts` и `remote/backups/[uuid].post.ts`).
  Проверка: чтение файла + `tsc` + build.

## Документация

- [x] **5. README/TODO**: suspend-контракт зафиксировать (раздел «Заморозка»):
  power/reinstall/setup-image/command/WS блокируются 403, ручной запуск
  расписания — 403 через `res.skipped`, таймер просто откладывает запуск;
  флажок autostart переключать можно (фильтр на `GET /api/remote/autostart`),
  файлы/переменные/базы/бэкапы/расписания/порты/субадмины/SFTP/startup/
  настройки — доступны. Правка README, код не трогали.

## Второй проход (агенты + верификация чтением, 16.10.2026)

- [x] **6. setup.put обходит suspend (HIGH)** — добавлен 403-чек
  (`setup.put.ts:22`). Проверено: `tsc` + build exit 0.
- [x] **7. files/write и upload (HIGH)** — `wingsFileExists` в `wings.ts`:
  существующий файл требует `file.update`, новый — `file.create`
  (`write.post.ts:15`, `files.post.ts:37-43`). Проверено: `tsc` + build exit 0.
- [x] **8. Мутации без keyLevels-гейта (MEDIUM)** — `needKeyWrite(ctx)` в `wings.ts`:
  ключ требует `servers:2`. Применён в autostart/settings/schedules-CRUD+run/
  activity-delete (7 роутов). Сессии не задеты. Проверено: `tsc` + build exit 0.
- [x] **9. Документация**: suspend-контракт + file.create/update + needKeyWrite
  в README (раздел «Заморозка»). Финально: `check-imports` 378 OK,
  `tsc` exit 0, `npm run build` exit 0.

## Wings (верифицировано чтением → исправлено, коммит 2e04b4d, запушено)

- [x] (Medium) Роль ключа игнорируется в browser-JWT: `POST /upload/file`
  отклоняет readonly-подписанные токены 403 (`panelbrowser.go:148-153`,
  тест `TestBrowserUploadRejectsReadonlyJWT` + allow-тест для admin).
  Скачивание осталось доступно readonly (консистентно с `fm/download`
  и вотч-режимом WS; дока в `docs/api.md:300-303` обновлена).
- [x] (Low) SFTP user enumeration: единое `invalid sftp credentials`
  в обеих ветках (`sftp.go:503,514,525`).
- Отклонено с обоснованием: `GET .../backup` для readonly — by design
  (закреплено тестом `TestIsMutatingBackupDelete`, консистентно с
  `fm/download`/`fs/cat`); TOCTOU FM-jail (нужен второй примитив + гонка);
  `terminal/stream` для readonly (наблюдатель by design).

## Принятые риски (без кода, зафиксировано)

- `2FA_REQUIRED` раскрывает валидность пары почта+пароль — неизбежно для
  двухшагового логина, отдельная mitigation отсутствует в индустрии.
- SFTP-пароли открытым текстом в БД — by design (нужны wings в исходном виде).
- `npm audit`: 32 уязвимости транзитивные, недостижимы в проде.
- Куки сессии — дефолты next-auth (Lax, Secure на https); прод только за https.
