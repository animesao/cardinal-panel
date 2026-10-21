#!/usr/bin/env bash
# Проверка установщика cardinal-panel внутри ubuntu:24.04.
#
# Запускается в контейнере (tests/install/Dockerfile). Проверяет то, что
# невозможно проверить на другой ОС:
#   1. подстановка /etc/os-release (Version из os-release затирал версию панели);
#   2. скачивание релиза и проверка SHA-256;
#   3. распаковка: в архиве не должно быть битых ссылок;
#   4. генерация panel.env с NEXTAUTH_SECRET;
#   5. миграции SQLite в реальной БД;
#   6. запуск production-сборки и ответ /api/health;
#   7. валидность systemd-юнита.
#
# systemd в контейнере не запускается (это не нужно и неудобно), поэтому
# установщик запускается с --no-start, а сервис поднимается вручную —
# ровно тем же бинарником, что и в юните.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }

INSTALL_DIR="/tmp/panel"
DATA_DIR="/tmp/panel-data"
CONF_DIR="/tmp/panel-conf"
PORT="3999"
FAILURES=0

check() {
  local name="$1"; shift
  if "$@"; then
    log "OK: $name"
  else
    warn "ПРОВАЛ: $name"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- окружение контейнера ---
log "OS: $(. /etc/os-release && echo "$PRETTY_NAME")"
log "Версия os-release: ${VERSION:-<нет>}"

# Установщик должен НЕ использовать переменную VERSION из os-release.
# Если использует — в URL релиза попадёт «24.04.4 LTS (Noble Numbat)».
if grep -q 'PANEL_VERSION=""' /work/install.sh && grep -q 'unset VERSION' /work/install.sh; then
  log "OK: версия панели не перетирается os-release"
else
  warn "ПРОВАЛ: установщик не защищён от VERSION из os-release"
  FAILURES=$((FAILURES + 1))
fi

# --- установка ---
log "Запускаем установщик (--no-start: systemd в контейнере не нужен)"
bash /work/install.sh \
  --no-start \
  --dir "$INSTALL_DIR" \
  --data-dir "$DATA_DIR" \
  --conf-dir "$CONF_DIR" \
  --port "$PORT" \
  --admin-email test@example.com \
  > /tmp/install.log 2>&1 || {
    warn "установщик завершился с ошибкой:"
    tail -40 /tmp/install.log
    FAILURES=$((FAILURES + 1))
  }

tail -20 /tmp/install.log

# --- проверки результата ---
check "каталог установки создан" test -d "$INSTALL_DIR"
check "точка входа собрана" test -f "$INSTALL_DIR/.output/server/index.mjs"
check "конфиг создан" test -f "$CONF_DIR/panel.env"
check "миграции применены" test -f "$DATA_DIR/panel.sqlite"
check "systemd-юнит установлен" test -f "/etc/systemd/system/cardinal-panel.service"

if [ -f "$CONF_DIR/panel.env" ]; then
  check "NEXTAUTH_SECRET сгенерирован" grep -qE '^NEXTAUTH_SECRET="[^"]{16,}"' "$CONF_DIR/panel.env"
  check "путь к БД указывает на data-dir" grep -q "SQLITE_PATH=\"$DATA_DIR/panel.sqlite\"" "$CONF_DIR/panel.env"
  check "в конфиге нет мусора из os-release" bash -c "! grep -q 'Noble Numbat' '$CONF_DIR/panel.env'"
fi

# --- в архиве не должно быть ссылок ---
log "Проверяем, что в собранном релизе нет битых ссылок"
if [ -f /work/release/cardinal-panel-0.5.4.tar.gz ]; then
  ARCHIVE=/work/release/cardinal-panel-0.5.4.tar.gz
else
  ARCHIVE="$(ls /work/release/*.tar.gz 2>/dev/null | head -n1 || true)"
fi
if [ -n "${ARCHIVE:-}" ] && [ -f "$ARCHIVE" ]; then
  LINKS="$(tar -tvzf "$ARCHIVE" | grep -c '^l' || true)"
  if [ "$LINKS" = "0" ]; then
    log "OK: ссылок в архиве нет"
  else
    warn "ПРОВАЛ: в архиве $LINKS ссылок (на Linux они битые)"
    tar -tvzf "$ARCHIVE" | grep '^l' | head -5
    FAILURES=$((FAILURES + 1))
  fi
else
  warn "архив не найден — проверка ссылок пропущена"
fi

# --- systemd-юнит ---
if command -v systemd-analyze >/dev/null 2>&1; then
  log "Проверяем systemd-юнит"
  if systemd-analyze verify "/etc/systemd/system/cardinal-panel.service" >/tmp/unit.log 2>&1; then
    log "OK: systemd-юнит валиден"
  else
    warn "ПРОВАЛ: systemd-юнит не проходит проверку"
    cat /tmp/unit.log
    FAILURES=$((FAILURES + 1))
  fi
else
  warn "systemd-analyze недоступен — юнит не проверен"
fi

# --- запуск и health ---
log "Запускаем production-сборку"
export DB_DIALECT=sqlite
export SQLITE_PATH="$DATA_DIR/panel.sqlite"
export NEXTAUTH_SECRET="container-test-secret-0123456789abcdef"
export NEXTAUTH_URL="http://127.0.0.1:$PORT"
export AUTH_ORIGIN="http://127.0.0.1:$PORT/api/auth"
export NUXT_PANEL_URL="http://127.0.0.1:$PORT"
export NITRO_HOST=127.0.0.1
export NITRO_PORT="$PORT"

node "$INSTALL_DIR/.output/server/index.mjs" > /tmp/server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

HEALTHY=0
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" > /tmp/health.json 2>/dev/null; then
    HEALTHY=1
    break
  fi
  sleep 1
done

if [ "$HEALTHY" = "1" ]; then
  log "OK: /api/health ответил"
  cat /tmp/health.json; echo
  check "в health статус ok" grep -q '"status":"ok"' /tmp/health.json
  check "в health база доступна" grep -q '"database":"ok"' /tmp/health.json
  check "в health версия" grep -qE '"version":"[0-9]+\.[0-9]+\.[0-9]+"' /tmp/health.json
else
  warn "ПРОВАЛ: /api/health не ответил"
  tail -30 /tmp/server.log
  FAILURES=$((FAILURES + 1))
fi

# --- скрипты панели должны видеть ту же БД ---
log "Проверяем, что скрипты панели используют путь из panel.env"
cat > /tmp/panel.env <<EOF
SQLITE_PATH="$DATA_DIR/panel.sqlite"
EOF
check "create-admin читает panel.env" grep -q 'panel-env.mjs' "$INSTALL_DIR/scripts/create-admin.mjs"
check "migrate читает panel.env" grep -q 'panel-env.mjs' "$INSTALL_DIR/scripts/migrate-sqlite.mjs"

# --- кодировка ---
log "Проверяем кодировку install.sh (кириллица не должна побиться)"
check "в install.sh нет mojibake" bash -c "! grep -q 'РџСѓР±' /work/install.sh"

echo
if [ "$FAILURES" -eq 0 ]; then
  log "ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ"
  exit 0
fi
err "ПРОВАЛОВ: $FAILURES"
exit 1
