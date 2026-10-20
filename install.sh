#!/usr/bin/env bash
# ============================================================
# cardinal-panel - Universal Installer
#
# Ставит веб-панель cardinal (Nuxt 4) на любой Linux с systemd:
#   - скачивает релиз с GitHub (архив .tar.gz + .sha256),
#   - проверяет контрольную сумму,
#   - разворачивает в /opt/cardinal-panel,
#   - создаёт пользователя cardinal и каталог /var/lib/cardinal-panel,
#   - генерирует /etc/cardinal-panel/panel.env с новым NEXTAUTH_SECRET,
#   - накатывает миграции БД,
#   - ставит и включает systemd-юнит.
#
# Всё (версия, артефакты, контрольные суммы) скачивается исключительно
# с официального репозитория GitHub.
#
# Использование:
#   curl -fsSL https://raw.githubusercontent.com/animesao/cardinal-panel/main/install.sh | sudo bash
#
#   ./install.sh --version 0.1.0     # конкретная версия
#   ./install.sh --dir /srv/panel    # другой каталог установки
#   ./install.sh --no-start          # установить, но не запускать
#   ./install.sh --uninstall         # снести (данные БД сохраняются)
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  err "Must run as root: sudo bash install.sh"
fi

# ---- параметры ----
REPO="animesao/cardinal-panel"
INSTALL_DIR="/opt/cardinal-panel"
DATA_DIR="/var/lib/cardinal-panel"
CONF_DIR="/etc/cardinal-panel"
CONF_FILE="${CONF_DIR}/panel.env"
SERVICE_USER="cardinal"
SERVICE_NAME="cardinal-panel"
NODE_VERSION="24"
PORT="3000"
VERSION=""
DO_START=1
DO_UNINSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)   VERSION="${2:-}"; shift 2 ;;
    --dir)       INSTALL_DIR="${2:-}"; shift 2 ;;
    --data-dir)  DATA_DIR="${2:-}"; shift 2 ;;
    --port)      PORT="${2:-}"; shift 2 ;;
    --no-start)  DO_START=0; shift ;;
    --uninstall) DO_UNINSTALL=1; shift ;;
    --help|-h)   sed -n '2,30p' "$0"; exit 0 ;;
    *)           err "Unknown option: $1" ;;
  esac
done

# ---- надёжная загрузка: повторы, жёсткие таймауты, запасной IPv4 ----
download() {
  local url="$1" dest="$2"
  local tmp="${dest}.tmp.$$"
  local try

  for try in 1 2 3; do
    rm -f "$tmp"
    if curl -fsSL --retry 2 --connect-timeout 15 --max-time 300 "$url" -o "$tmp" \
      || curl -4 -fsSL --retry 2 --connect-timeout 15 --max-time 300 "$url" -o "$tmp"; then
      if [[ -s "$tmp" ]]; then
        mv -f "$tmp" "$dest"
        return 0
      fi
      warn "Downloaded empty file from $url"
      rm -f "$tmp"
    else
      warn "Download attempt ${try}/3 failed for $url"
      rm -f "$tmp"
    fi
    sleep 2
  done

  echo "error: failed to download $url after 3 attempts" >&2
  return 1
}

# ---- определение ОС / архитектуры ----
[[ -f /etc/os-release ]] || err "Cannot detect OS - /etc/os-release not found"
# shellcheck disable=SC1091
. /etc/os-release
log "OS: ${PRETTY_NAME:-${ID:-unknown} ${VERSION_ID:-}}"

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) err "Unsupported architecture: $(uname -m)" ;;
esac
log "Architecture: $ARCH"

command -v systemctl >/dev/null 2>&1 || err "systemd is required"

# ---- удаление ----
if [[ "$DO_UNINSTALL" -eq 1 ]]; then
  log "Stopping and disabling $SERVICE_NAME"
  systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  if [[ "${KEEP_DATA:-0}" != "1" ]]; then
    warn "Removing $INSTALL_DIR and $DATA_DIR"
    rm -rf "$INSTALL_DIR" "$DATA_DIR"
  else
    info "Keeping $DATA_DIR (KEEP_DATA=1)"
  fi
  log "Uninstalled. Secrets in $CONF_FILE were left in place."
  exit 0
fi

# ---- Node.js ----
install_node() {
  local need=0
  if ! command -v node >/dev/null 2>&1; then
    need=1
  else
    local major
    major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    # Модуль node:sqlite (диалект SQLite) доступен без experimental-флага
    # начиная с Node 23.4; ниже 24 работать не будет.
    if [[ "$major" -lt 24 ]]; then
      need=1
      warn "Node $(node -v) is too old (need >= ${NODE_VERSION})"
    fi
  fi
  [[ "$need" -eq 0 ]] && return 0

  log "Installing Node.js ${NODE_VERSION}.x"
  case "${ID:-}" in
    debian|ubuntu)
      apt-get update -qq
      apt-get install -y -qq ca-certificates curl gnupg
      install -d -m 0755 /etc/apt/keyrings
      curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
      echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list
      apt-get update -qq
      apt-get install -y -qq nodejs
      ;;
    fedora|rhel|centos|rocky|almalinux)
      dnf install -y -q https://rpm.nodesource.com/setup_${NODE_VERSION}.x
      dnf install -y -q nodejs
      ;;
    arch|manjaro)
      pacman -Sy --noconfirm node
      ;;
    alpine)
      apk add --no-cache nodejs npm
      ;;
    *)
      err "Unsupported package manager for Node.js installation: ${ID:-unknown}"
      ;;
  esac
  node -v || err "Node.js installation failed"
}

install_node

# ---- определение версии ----
if [[ -z "$VERSION" ]]; then
  info "Resolving latest release"
  VERSION="$(curl -fsSL --connect-timeout 15 --max-time 60 \
    "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep -m1 '"tag_name"' | cut -d'"' -f4 | sed 's/^v//')" || true
  [[ -n "$VERSION" ]] || err "Cannot resolve the latest release from GitHub API"
fi
log "Version: $VERSION"

ARCHIVE="cardinal-panel-${VERSION}.tar.gz"
BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log "Downloading $ARCHIVE"
download "${BASE_URL}/${ARCHIVE}" "${TMP_DIR}/${ARCHIVE}"
download "${BASE_URL}/${ARCHIVE}.sha256" "${TMP_DIR}/${ARCHIVE}.sha256"

# ---- проверка контрольной суммы ----
log "Verifying SHA-256"
( cd "$TMP_DIR" && sha256sum -c "${ARCHIVE}.sha256" >/dev/null ) \
  || err "Checksum verification FAILED - refusing to install"

# ---- пользователь и каталоги ----
if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  log "Creating system user: $SERVICE_USER"
  useradd --system --home-dir "$DATA_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

log "Installing to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$CONF_DIR"

# Старый .output заменяем целиком, чтобы не осталось мёртвых чанков.
rm -rf "${INSTALL_DIR}/.output" "${INSTALL_DIR}/scripts" "${INSTALL_DIR}/server" "${INSTALL_DIR}/packaging"
tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "$TMP_DIR"
mv "${TMP_DIR}/cardinal-panel/.output" "$INSTALL_DIR/.output"
mv "${TMP_DIR}/cardinal-panel/scripts" "$INSTALL_DIR/scripts"
mv "${TMP_DIR}/cardinal-panel/server" "$INSTALL_DIR/server"
# systemd-юнит лежит в пакете — без него install.sh не поставит сервис.
mv "${TMP_DIR}/cardinal-panel/packaging" "$INSTALL_DIR/packaging"
cp "${TMP_DIR}/cardinal-panel/package.json" "$INSTALL_DIR/package.json"
cp "${TMP_DIR}/cardinal-panel/VERSION" "$INSTALL_DIR/VERSION"
[[ -f "${TMP_DIR}/cardinal-panel/.env.example" ]] && cp "${TMP_DIR}/cardinal-panel/.env.example" "$INSTALL_DIR/.env.example"

chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" "$DATA_DIR"
chmod 0755 "$INSTALL_DIR"
chmod 0750 "$DATA_DIR"

# ---- конфигурация и секреты ----
if [[ -f "$CONF_FILE" ]]; then
  info "Keeping existing $CONF_FILE"
else
  log "Generating $CONF_FILE"
  SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n=+/' | cut -c1-40)"
  cat > "$CONF_FILE" <<EOF
# cardinal-panel configuration
# Сгенерировано install.sh. Права: 0600, владелец: ${SERVICE_USER}.
# Секреты НЕ хранятся в репозитории и НЕ попадают в git.

# Обязательный секрет NextAuth: подпись сессий и токенов.
NEXTAUTH_SECRET="${SECRET}"

# Публичный адрес панели (нужен для OAuth-колбэков).
NUXT_PANEL_URL="http://localhost:${PORT}"

# Origin для next-auth.
NEXTAUTH_URL="http://localhost:${PORT}"
AUTH_ORIGIN="http://localhost:${PORT}/api/auth"

# OAuth-провайдеры можно задать здесь, но проще включить их позже
# в панели: Admin -> Настройки (значения шифруются в БД).

# База данных.
DB_DIALECT="sqlite"
SQLITE_PATH="${DATA_DIR}/panel.sqlite"

# Порт, на котором слушает панель (127.0.0.1 - за обратным прокси).
NITRO_HOST="127.0.0.1"
NITRO_PORT="${PORT}"

# Доверенные обратные прокси (через запятую). IP клиента берётся из
# X-Forwarded-For только если соединение пришло с одного из них.
TRUSTED_PROXY="127.0.0.1,::1"

DEBUG="false"
EOF
  chown "$SERVICE_USER:$SERVICE_USER" "$CONF_FILE"
  chmod 0600 "$CONF_FILE"
  log "Generated NEXTAUTH_SECRET in $CONF_FILE"
fi

# ---- зависимости для миграций ----
# Миграции запускаются из scripts/ и тянут drizzle-kit + drizzle-orm.
if [[ ! -d "${INSTALL_DIR}/node_modules" ]]; then
  log "Installing runtime dependencies (needed for migrations)"
  ( cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund --ignore-scripts ) \
    || warn "npm install failed - migrations may not run"
fi

# ---- миграции БД ----
log "Applying database migrations"
if ( cd "$INSTALL_DIR" && DB_DIALECT=sqlite SQLITE_PATH="${DATA_DIR}/panel.sqlite" \
      node scripts/migrate-sqlite.mjs ); then
  log "Migrations applied"
else
  warn "Migrations failed - run manually: cd $INSTALL_DIR && npm run db:migrate"
fi

# ---- systemd ----
log "Installing systemd unit"
UNIT_SRC="${INSTALL_DIR}/packaging/systemd/${SERVICE_NAME}.service"
[[ -f "$UNIT_SRC" ]] || err "Systemd unit not found in the release package: $UNIT_SRC"
sed -e "s#/opt/cardinal-panel#${INSTALL_DIR}#g" \
    -e "s#/var/lib/cardinal-panel#${DATA_DIR}#g" \
    -e "s#/etc/cardinal-panel#${CONF_DIR}#g" \
    -e "s#^User=.*#User=${SERVICE_USER}#" \
    -e "s#^Group=.*#Group=${SERVICE_USER}#" \
    -e "s#^NITRO_PORT=.*#NITRO_PORT=${PORT}#" \
    "$UNIT_SRC" > "/etc/systemd/system/${SERVICE_NAME}.service"
chmod 0644 "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true

if [[ "$DO_START" -eq 1 ]]; then
  log "Starting $SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    log "Service is running"
  else
    warn "Service failed to start. Check: journalctl -u ${SERVICE_NAME} -n 50"
  fi
fi

cat <<EOF

${GREEN}cardinal-panel ${VERSION} installed${NC}

  Install dir : ${INSTALL_DIR}
  Data dir    : ${DATA_DIR}
  Config      : ${CONF_FILE}
  Panel URL   : http://localhost:${PORT}

Next steps:
  1. Create the first admin account:
       cd ${INSTALL_DIR} && npm run create-admin
  2. Put a reverse proxy (nginx/Caddy) in front of 127.0.0.1:${PORT}
     and set NUXT_PANEL_URL in ${CONF_FILE} to the public address.
  3. Add the panel node in cardinal-wings (Admin -> Nodes -> Add node).

  Logs:    journalctl -u ${SERVICE_NAME} -f
  Status:  systemctl status ${SERVICE_NAME}

EOF
