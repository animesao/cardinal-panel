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
# Второй режим — развёртывание контейнером на runtime cardinal:
# образ собирается из того же релизного пакета, панель запускается
# как сервис cardinal (cardinal.toml) и переживает перезагрузку хоста.
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
#
#   ./install.sh --install-mode cardinal   # развернуть как контейнер на cardinal
#   ./install.sh --install-mode cardinal --network bridge
#
# Полная установка (публичный адрес, админ, узел wings):
#   ./install.sh --domain panel.example.com \
#                --admin-email admin@example.com \
#                --wings-url http://10.0.0.5:8080 --wings-token <token>
#
# Прочие ключи: --min-free <MiB> (минимальное свободное место, по умолчанию 256),
#               --no-proxy, --no-tls, --no-start, --uninstall, --version, --dir, --port
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }
info() { echo -e "${CYAN}[i]${NC} $1"; }

# ---- параметры ----
REPO="animesao/cardinal-panel"
INSTALL_DIR="/opt/cardinal-panel"
DATA_DIR="/var/lib/cardinal-panel"
CONF_DIR="/etc/cardinal-panel"
CONF_FILE="${CONF_DIR}/panel.env"
COMPOSE_FILE="${CONF_DIR}/cardinal.toml"
SERVICE_USER="cardinal"
SERVICE_NAME="cardinal-panel"
NODE_VERSION="24"
PORT="3000"
# Версия панели. Имя НЕ `VERSION`: /etc/os-release определяет переменную
# VERSION (например "24.04.4 LTS (Noble Numbat)"), и её подстановка
# перетирала бы нашу — установщик пытался скачать релиз с именем
# "24.04.4 LTS (Noble Numbat)".
PANEL_VERSION=""
DO_START=1
DO_UNINSTALL=0

# Режим установки: systemd (родной процесс) или cardinal (контейнер на
# runtime cardinal). По умолчанию — systemd.
INSTALL_MODE="systemd"
# Сетевой режим контейнера: host — панель видит wings на 127.0.0.1;
# bridge — панель изолирована, узлы wings указываются по IP хоста.
NETWORK_MODE="host"
IMAGE_TAG=""
BASE_IMAGE="node:24-alpine"

# Полная установка:
#   DOMAIN      — публичный адрес (https://<domain>); без него панель
#                 доступна только на 127.0.0.1 и OAuth-колбэки не работают.
#   ADMIN_EMAIL — e-mail первого администратора.
#   WINGS_URL   — адрес cardinal-wings на узле (http://host:8080).
#   WINGS_TOKEN — токен узла (выдаёт установщик wings).
DOMAIN=""
ADMIN_EMAIL=""
WINGS_URL=""
WINGS_TOKEN=""
USE_PROXY=1
USE_TLS=1
# Минимально свободное место на диске с данными, МБ.
# Самой панели хватает ~50 МБ (релиз + .output + база); остальное — запас
# под базу, логи и бэкапы.
MIN_FREE_MB=128

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)   PANEL_VERSION="${2:-}"; shift 2 ;;
    --dir)       INSTALL_DIR="${2:-}"; shift 2 ;;
    --data-dir)  DATA_DIR="${2:-}"; shift 2 ;;
    --port)      PORT="${2:-}"; shift 2 ;;
    --no-start)  DO_START=0; shift ;;
    --uninstall) DO_UNINSTALL=1; shift ;;
    --install-mode) INSTALL_MODE="${2:-}"; shift 2 ;;
    --network)   NETWORK_MODE="${2:-}"; shift 2 ;;
    --image-tag) IMAGE_TAG="${2:-}"; shift 2 ;;
    --domain)    DOMAIN="${2:-}"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="${2:-}"; shift 2 ;;
    --wings-url) WINGS_URL="${2:-}"; shift 2 ;;
    --wings-token) WINGS_TOKEN="${2:-}"; shift 2 ;;
    --no-proxy)  USE_PROXY=0; shift ;;
    --no-tls)    USE_TLS=0; shift ;;
    --min-free)  MIN_FREE_MB="${2:-}"; shift 2 ;;
    --help|-h)   awk 'NR==1{next} /^#/{print; next} {exit}' "$0"; exit 0 ;;
    *)           err "Unknown option: $1" ;;
  esac
done

case "$INSTALL_MODE" in
  systemd|cardinal) ;;
  *) err "--install-mode must be 'systemd' or 'cardinal' (got: $INSTALL_MODE)" ;;
esac

case "$NETWORK_MODE" in
  host|bridge) ;;
  *) err "--network must be 'host' or 'bridge' (got: $NETWORK_MODE)" ;;
esac

# ---- нормализация публичного адреса ----
# Принимаем и «example.com», и «https://example.com/», и «example.com:8080»:
# дальше везде используется голый хост. Раньше схема попадала в server_name
# nginx и в NUXT_PANEL_URL («https://http://192.168.0.105»).
if [[ -n "$DOMAIN" ]]; then
  _d="${DOMAIN#http://}"
  _d="${_d#https://}"
  _d="${_d%%/*}"     # отбрасываем путь
  _d="${_d%%:*}"     # отбрасываем порт
  DOMAIN="$_d"
  [[ -n "$DOMAIN" ]] || err "--domain is empty after normalization: '${_d}'"
  [[ "$DOMAIN" != *[[:space:]]* ]] || err "--domain must not contain spaces: '$DOMAIN'"
  unset _d
fi

# IP-адрес: Let's Encrypt сертификаты на IP не выдаёт, поэтому TLS не нужен.
is_ip_address() {
  [[ "$1" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || [[ "$1" == *:* ]]
}
PUBLIC_SCHEME="http"
TLS_SKIP_REASON=""
if [[ -n "$DOMAIN" ]]; then
  if is_ip_address "$DOMAIN"; then
    USE_TLS=0
    PUBLIC_SCHEME="http"
    TLS_SKIP_REASON="${DOMAIN} is an IP address and Let's Encrypt does not issue certificates for IPs - the panel works over HTTP, but OAuth providers require HTTPS and a domain"
    info "$TLS_SKIP_REASON"
  else
    PUBLIC_SCHEME="https"
  fi
fi

if [[ -n "$WINGS_URL" && -z "$WINGS_TOKEN" ]]; then
  err "--wings-url требует --wings-token (без токена узел не подключить)"
fi
if [[ -n "$WINGS_TOKEN" && -z "$WINGS_URL" ]]; then
  err "--wings-token требует --wings-url"
fi
if [[ -n "$DOMAIN" && "$USE_TLS" -eq 0 ]]; then
  warn "TLS выключен: OAuth-колбэки и cookie secure не будут работать"
fi

# Проверка прав — после разбора аргументов, чтобы --help работал без root.
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  err "Must run as root: sudo bash install.sh"
fi

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

# os-release определяет VERSION (например "24.04.4 LTS (Noble Numbat)").
# Убираем её, чтобы переменная с таким именем не означала «версию панели»
# и не подставилась случайно в URL релиза.
unset VERSION

case "$(uname -m)" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) err "Unsupported architecture: $(uname -m)" ;;
esac
log "Architecture: $ARCH"

command -v systemctl >/dev/null 2>&1 || err "systemd is required"

# ---- удаление ----
if [[ "$DO_UNINSTALL" -eq 1 ]]; then
  # Контейнер на cardinal: сносим сервис и образ (данные в томе — отдельно).
  if command -v cardinal >/dev/null 2>&1 && [[ -f "$COMPOSE_FILE" ]]; then
    log "Stopping cardinal service from $COMPOSE_FILE"
    cardinal down -f "$COMPOSE_FILE" >/dev/null 2>&1 || warn "cardinal down failed (ignored)"
    rm -f "$COMPOSE_FILE"
  fi
  if command -v cardinal >/dev/null 2>&1; then
    for tag in $(cardinal images 2>/dev/null | awk '/cardinal-panel/ {print $1" "$2}' | awk '{print $2}' | tr ':' ' ' | awk '{print $1}' | sort -u); do
      cardinal rmi "$tag" >/dev/null 2>&1 || true
    done
  fi

  log "Stopping and disabling $SERVICE_NAME"
  systemctl disable --now "$SERVICE_NAME" >/dev/null 2>&1 || true
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

# ---- свободное место ----
# Проверка ДО установки: без неё установщик падает на середине с
# «database or disk is full» и оставляет после себя сломанный сервис.
check_disk_space() {
  local need_mb="${MIN_FREE_MB:-128}"
  local avail_mb=""
  if command -v df >/dev/null 2>&1; then
    avail_mb="$(df -Pm "$DATA_DIR" 2>/dev/null | awk 'NR==2 {print $4}')"
  fi
  if [[ -z "$avail_mb" ]]; then
    info "Cannot determine free space - skipping the check"
    return 0
  fi
  if [[ "$avail_mb" -lt "$need_mb" ]]; then
    err "Not enough free space in $DATA_DIR: ${avail_mb} MiB available, ${need_mb} MiB required.
The panel itself needs about 50 MiB (release + .output + database); the rest is
a reserve for the database, logs and backups.
Free some space and re-run:
  apt-get clean && apt-get autoremove -y
  journalctl --vacuum-time=7d
  rm -rf /var/lib/apt/lists/*
To find what occupies the disk:
  du -xh --max-depth=1 / 2>/dev/null | sort -h | tail -15
Override the threshold with --min-free <MiB> if you know what you are doing."
  fi
  if [[ "$avail_mb" -lt 512 ]]; then
    warn "Only ${avail_mb} MiB free - the panel will work, but backups and logs may hit the limit"
  fi
  log "Free space: ${avail_mb} MiB"
}

# ---- определение версии ----
if [[ -z "$PANEL_VERSION" ]]; then
  info "Resolving latest release"
  PANEL_VERSION="$(curl -fsSL --connect-timeout 15 --max-time 60 \
    "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | grep -m1 '"tag_name"' | cut -d'"' -f4 | sed 's/^v//')" || true
  # Ответ API должен быть SemVer. Если это не так — внятная ошибка вместо
  # URL с пробелами, который curl отвергнет.
  if ! printf '%s' "$PANEL_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    err "Cannot resolve the latest release from the GitHub API (got: '${PANEL_VERSION}')"
  fi
fi
log "Version: $PANEL_VERSION"

ARCHIVE="cardinal-panel-${PANEL_VERSION}.tar.gz"
BASE_URL="https://github.com/${REPO}/releases/download/v${PANEL_VERSION}"

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

# Останавливаем сервис ДО замены файлов. Иначе процесс продолжает работать
# с удаляемыми чанками .output и падает, а Restart=on-failure заставляет его
# стартовать в недоконченном каталоге (в логе это выглядит как
# "Changing to the requested working directory failed" и десятки рестартов).
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  log "Stopping $SERVICE_NAME before the upgrade"
  systemctl stop "$SERVICE_NAME" || warn "Could not stop $SERVICE_NAME"
fi

# Место проверяем после создания каталогов: df должен смотреть на ту же
# файловую систему, где будет лежать база.
check_disk_space

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
# Путь к базе различается по режиму: в системном режиме файл лежит на
# хосте, в режиме cardinal — внутри контейнера (том panel-data).
if [[ "$INSTALL_MODE" == "cardinal" ]]; then
  SQLITE_PATH_IN="/app/data/panel.sqlite"
else
  SQLITE_PATH_IN="${DATA_DIR}/panel.sqlite"
fi

# Секрет сохраняется между переустановками: адреса и режим могут
# меняться, а NEXTAUTH_SECRET — нет (иначе все сессии разломаются).
SECRET=""
if [[ -f "$CONF_FILE" ]]; then
  SECRET="$(sed -n 's/^NEXTAUTH_SECRET="\([^"]*\)".*/\1/p' "$CONF_FILE" | head -n1)"
  if [[ -n "$SECRET" ]]; then
    info "Keeping the existing NEXTAUTH_SECRET from $CONF_FILE"
  else
    SECRET=""
  fi
fi
if [[ -z "$SECRET" ]]; then
  SECRET="$(head -c 32 /dev/urandom | base64 | tr -d '\n=+/' | cut -c1-40)"
  log "Generated a new NEXTAUTH_SECRET"
fi

# Публичный адрес панели. С доменом — по схеме (https, если сертификат
# получен), без домена — только localhost (панель слушает 127.0.0.1,
# наружу её выпускает обратный прокси).
public_url() {
  if [[ -n "$DOMAIN" ]]; then
    printf '%s://%s' "$PUBLIC_SCHEME" "$DOMAIN"
  else
    printf 'http://localhost:%s' "$PORT"
  fi
}

# Запись panel.env. Вызывается повторно, если TLS не удался и схема
# меняется на http.
write_env() {
  local url
  url="$(public_url)"
  log "Writing $CONF_FILE (panel URL: $url)"
  cat > "$CONF_FILE" <<EOF
# cardinal-panel configuration
# Сгенерировано install.sh. Права: 0600, владелец: ${SERVICE_USER}.
# Секреты НЕ хранятся в репозитории и НЕ попадают в git.

# Обязательный секрет NextAuth: подпись сессий и токенов.
NEXTAUTH_SECRET="${SECRET}"

# Публичный адрес панели (нужен для OAuth-колбэков и для wings:
# панель отправляет ему свой URL через POST /v1/config).
NUXT_PANEL_URL="${url}"

# Origin для next-auth.
NEXTAUTH_URL="${url}"
AUTH_ORIGIN="${url}/api/auth"

# OAuth-провайдеры можно задать здесь, но проще включить их позже
# в панели: Admin -> Настройки (значения шифруются в БД).

# База данных.
DB_DIALECT="sqlite"
SQLITE_PATH="${SQLITE_PATH_IN}"

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
}

write_env

# ---- развёртывание: systemd (родной процесс) ----
deploy_systemd() {
  install_node

  log "Installing systemd unit"
  local unit_src="${INSTALL_DIR}/packaging/systemd/${SERVICE_NAME}.service"
  [[ -f "$unit_src" ]] || err "Systemd unit not found in the release package: $unit_src"
  sed -e "s#/opt/cardinal-panel#${INSTALL_DIR}#g" \
      -e "s#/var/lib/cardinal-panel#${DATA_DIR}#g" \
      -e "s#/etc/cardinal-panel#${CONF_DIR}#g" \
      -e "s#^User=.*#User=${SERVICE_USER}#" \
      -e "s#^Group=.*#Group=${SERVICE_USER}#" \
      -e "s#^NITRO_PORT=.*#NITRO_PORT=${PORT}#" \
      "$unit_src" > "/etc/systemd/system/${SERVICE_NAME}.service"
  chmod 0644 "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true

  # Миграции БД: запускаются на хосте (нужен Node и scripts/).
  apply_migrations_host

  if [[ "$DO_START" -eq 1 ]]; then
    log "Starting $SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"
    sleep 2
    if systemctl is-active --quiet "$SERVICE_NAME"; then
      log "Service is running"
    else
      INSTALL_OK=0
      warn "Service failed to start. Check: journalctl -u ${SERVICE_NAME} -n 50"
    fi
  fi
}

# ---- развёртывание: контейнер на runtime cardinal ----
deploy_cardinal() {
  command -v cardinal >/dev/null 2>&1 || err "cardinal is not installed.
Install the runtime first:
  curl -fsSL https://raw.githubusercontent.com/animesao/cardinal/main/install.sh | sudo bash
Then re-run this installer with --install-mode cardinal."

  local tag="${IMAGE_TAG:-cardinal-panel:${PANEL_VERSION}}"
  local dockerfile="${INSTALL_DIR}/Dockerfile.cardinal"
  [[ -f "$dockerfile" ]] || err "Dockerfile.cardinal not found in the release package: $dockerfile"

  # Базовый образ тянется заранее: так ошибка доступа к реестру видна сразу,
  # а не внутри сборки.
  log "Pulling base image $BASE_IMAGE"
  if ! cardinal pull "$BASE_IMAGE"; then
    warn "cardinal pull failed. If the runtime works with a strict registry allowlist"
    warn "(CARDINAL_REGISTRY_STRICT=1), allow the registry: cardinal registry allowlist add docker.io"
  fi

  log "Building image $tag"
  ( cd "$INSTALL_DIR" && cardinal build -t "$tag" -f Dockerfile.cardinal . ) \
    || err "cardinal build failed"

  # Compose-файл для cardinal: подставляем фактические значения.
  log "Writing $COMPOSE_FILE"
  mkdir -p "$CONF_DIR"
  local template="${INSTALL_DIR}/packaging/cardinal/cardinal-panel.toml"
  [[ -f "$template" ]] || err "cardinal-panel.toml not found in the release package: $template"
  sed -e "s#^image = .*#image = \"${tag}\"#" \
      -e "s#^network_mode = .*#network_mode = \"${NETWORK_MODE}\"#" \
      -e "s#/etc/cardinal-panel/panel.env#${CONF_FILE}#g" \
      "$template" > "$COMPOSE_FILE"
  chmod 0640 "$COMPOSE_FILE"

  # Порт должен быть свободен: иначе контейнер не поднимется, а сообщение
  # об ошибке будет невнятным.
  if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
    warn "Port ${PORT} is already in use on the host"
    warn "Stop the service that occupies it or pass --port with a free one"
  fi

  if [[ "$DO_START" -eq 1 ]]; then
    # Панель могла быть поставлена ранее: снимаем старый контейнер, чтобы
    # апгрейд не падал на занятом имени.
    log "Stopping the previous panel container (if any)"
    cardinal down -f "$COMPOSE_FILE" >/dev/null 2>&1 || true

    log "Starting the panel with cardinal"
    cardinal up -f "$COMPOSE_FILE" || err "cardinal up failed"

    # Миграции выполняются внутри контейнера: на хосте Node может отсутствовать.
    log "Applying database migrations inside the container"
    sleep 3
    cardinal exec panel node scripts/migrate-sqlite.mjs \
      || warn "migrations failed - run: cardinal exec panel node scripts/migrate-sqlite.mjs"

    # Ждём, пока панель поднимется и ответит на /api/health.
    local attempt=0
    local ready=0
    while [[ "$attempt" -lt 30 ]]; do
      if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
        ready=1
        break
      fi
      attempt=$((attempt + 1))
      sleep 2
    done
    if [[ "$ready" -eq 1 ]]; then
      log "Panel is healthy at http://127.0.0.1:${PORT}"
    else
      warn "Panel did not become healthy in 60s. Check: cardinal logs panel"
    fi

    # Чтобы контейнер пережил перезагрузку хоста, ставим boot-восстановление.
    log "Enabling cardinal boot recovery"
    cardinal bootstrap --install || warn "cardinal bootstrap --install failed (containers may not survive reboot)"
  fi
}

# ---- зависимости и миграции (системный режим) ----
# Миграции SQLite используют только встроенный node:sqlite, поэтому в
# обычном случае npm-зависимости НЕ нужны (и не ставятся — это ~300 МБ
# и лишние минуты). Для MySQL нужен драйвер mysql2 — тогда ставим и повторяем.
install_runtime_deps() {
  if [[ -d "${INSTALL_DIR}/node_modules" ]]; then
    return 0
  fi
  log "Installing runtime dependencies"
  ( cd "$INSTALL_DIR" && npm ci --omit=dev --no-audit --no-fund --ignore-scripts ) \
    || ( cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund --ignore-scripts ) \
    || warn "npm install failed - see the error above"
}

apply_migrations_host() {
  log "Applying database migrations"
  local env_prefix="DB_DIALECT=sqlite SQLITE_PATH=${DATA_DIR}/panel.sqlite"
  # shellcheck disable=SC2086  # env_prefix — это список VAR=VALUE
  if ( cd "$INSTALL_DIR" && env $env_prefix node scripts/migrate-sqlite.mjs ); then
    log "Migrations applied"
    return 0
  fi
  warn "Migrations failed without dependencies - installing them and retrying"
  install_runtime_deps
  # shellcheck disable=SC2086
  if ( cd "$INSTALL_DIR" && env $env_prefix node scripts/migrate-sqlite.mjs ); then
    log "Migrations applied"
    return 0
  fi
  err "Migrations failed - the panel cannot start without a schema.
Run manually: cd $INSTALL_DIR && npm run db:migrate
If the disk is full, free some space first."
}

# ---- вспомогательное: выполнить скрипт панели в её окружении ----
# В системном режиме — на хосте (с переменными из panel.env),
# в режиме cardinal — внутри контейнера.
run_in_panel() {
  if [[ "$INSTALL_MODE" == "cardinal" ]]; then
    cardinal exec panel node "$@"
  else
    # shellcheck disable=SC1090  # путь к panel.env задаётся переменной
    ( set -a; . "${CONF_FILE}"; set +a; cd "$INSTALL_DIR" && node "$@" )
  fi
}

# ---- обратный прокси ----
install_nginx() {
  if ! command -v nginx >/dev/null 2>&1; then
    log "Installing nginx"
    case "${ID:-}" in
      debian|ubuntu) apt-get update -qq && apt-get install -y -qq nginx ;;
      fedora|rhel|centos|rocky|almalinux) dnf install -y -q nginx || yum install -y -q nginx ;;
      arch|manjaro) pacman -Sy --noconfirm nginx ;;
      alpine) apk add --no-cache nginx ;;
      *) warn "Cannot install nginx automatically on ${ID:-unknown} - install it yourself and re-run" ; return 1 ;;
    esac
  fi

  local template="${INSTALL_DIR}/packaging/nginx/cardinal-panel.conf"
  [[ -f "$template" ]] || { warn "nginx template not found in the release package: $template"; return 1; }

  # Карта для WebSocket: переменная $connection_upgrade обязана быть
  # определена в контексте http{}, а не в server{}.
  local map_dir="/etc/nginx/conf.d"
  local site_dir="/etc/nginx/sites-available"
  local link_dir="/etc/nginx/sites-enabled"
  if [[ ! -d "$site_dir" ]]; then
    # RHEL/Alpine: всё в conf.d.
    site_dir="$map_dir"
    link_dir=""
  fi

  mkdir -p "$map_dir" "$site_dir"
  cat > "${map_dir}/cardinal-panel-upgrade-map.conf" <<'EOF'
# Для WebSocket: Connection: upgrade только когда клиент его просил.
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
EOF

  log "Configuring nginx for $DOMAIN"
  sed -e "s#__DOMAIN__#${DOMAIN}#g" \
      -e "s#__PORT__#${PORT}#g" \
      "$template" > "${site_dir}/cardinal-panel.conf"

  if [[ -n "$link_dir" ]]; then
    mkdir -p "$link_dir"
    ln -sf "${site_dir}/cardinal-panel.conf" "${link_dir}/cardinal-panel.conf"
  fi

  nginx -t || { warn "nginx configuration is invalid - fix ${site_dir}/cardinal-panel.conf"; return 1; }
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl reload nginx 2>/dev/null || systemctl restart nginx
  log "nginx is configured"
}

setup_tls() {
  if [[ "$USE_TLS" -eq 0 ]]; then
    if [[ -n "$TLS_SKIP_REASON" ]]; then
      warn "TLS skipped: ${TLS_SKIP_REASON}"
    else
      warn "TLS skipped (--no-tls)"
    fi
    return 0
  fi
  if ! command -v certbot >/dev/null 2>&1; then
    log "Installing certbot"
    case "${ID:-}" in
      debian|ubuntu) apt-get install -y -qq certbot python3-certbot-nginx ;;
      fedora|rhel|centos|rocky|almalinux) dnf install -y -q certbot || yum install -y -q certbot ;;
      alpine) apk add --no-cache certbot py3-certbot-nginx ;;
      *) warn "Cannot install certbot automatically - install it and re-run"; return 1 ;;
    esac
  fi
  local mail="${ADMIN_EMAIL:-}"
  if [[ -z "$mail" ]]; then
    warn "No --admin-email for the ACME registration - TLS skipped"
    return 1
  fi
  log "Requesting a TLS certificate for $DOMAIN"
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$mail" --redirect; then
    log "TLS certificate issued"
    PUBLIC_SCHEME="https"
    return 0
  fi
  # Сертификат не выдали — панель продолжает работать по HTTP. Схему в
  # panel.env меняем на http, иначе OAuth-колбэки уйдут на https и
  # сломаются.
  warn "certbot failed - the panel keeps working over HTTP, but OAuth"
  warn "callbacks need HTTPS (check that DNS for $DOMAIN points to this host)"
  PUBLIC_SCHEME="http"
  write_env
  if [[ "$INSTALL_MODE" == "systemd" ]]; then
    systemctl restart "$SERVICE_NAME" >/dev/null 2>&1 || true
  fi
  return 1
}

# ---- первый администратор ----
create_first_admin() {
  if [[ -z "$ADMIN_EMAIL" ]]; then
    warn "No --admin-email: the first admin is NOT created."
    warn "Create it manually: node scripts/create-admin.mjs --email=you@example.com"
    return 0
  fi
  log "Creating the first admin: $ADMIN_EMAIL"
  # Скрипт вызывается ОДИН раз: он генерирует пароль и печатает его.
  # Повторный вызов сбросил бы пароль на новый.
  local out
  if ! out="$(run_in_panel scripts/create-admin.mjs --email="$ADMIN_EMAIL" --name="admin" 2>&1)"; then
    warn "Failed to create the admin - run it manually:"
    warn "  node scripts/create-admin.mjs --email=${ADMIN_EMAIL}"
    return 1
  fi
  ADMIN_PASSWORD="$(printf '%s\n' "$out" | sed -n 's/^  пароль:  \([^ ]*\).*/\1/p' | head -n1)"
  ADMIN_CREATED=1
  if [[ -z "$ADMIN_PASSWORD" ]]; then
    info "Admin created (password was not printed - reset it if needed)"
  fi
}

# ---- узел wings ----
register_node() {
  if [[ -z "$WINGS_URL" ]]; then
    info "No --wings-url: the node is not registered (add it in Admin -> Nodes)"
    return 0
  fi
  log "Registering the wings node: $WINGS_URL"
  local minted key prefix
  minted="$(run_in_panel scripts/admin-api-key.mjs --email="$ADMIN_EMAIL" --name=installer --scopes=nodes:2 2>/dev/null || true)"
  key="$(printf '%s\n' "$minted" | sed -n 's/^TOKEN=//p' | head -n1)"
  prefix="$(printf '%s\n' "$minted" | sed -n 's/^PREFIX=//p' | head -n1)"
  if [[ -z "$key" ]]; then
    warn "Could not mint a temporary admin key - register the node in Admin -> Nodes"
    return 1
  fi

  local body
  body="$(printf '{"name":"%s","url":"%s","token":"%s"}' "${NODE_NAME:-local}" "$WINGS_URL" "$WINGS_TOKEN")"
  local response
  response="$(curl -fsS -X POST \
    -H "Authorization: Bearer $key" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "http://127.0.0.1:${PORT}/api/admin/nodes" 2>&1)" || response=""

  # Ключ больше не нужен — отзываем сразу, даже если запрос не удался.
  run_in_panel scripts/admin-api-key.mjs --revoke="$prefix" >/dev/null 2>&1 || true

  if printf '%s' "$response" | grep -q '"success":true'; then
    log "Node registered: $WINGS_URL"
    if printf '%s' "$response" | grep -q '"wingsSynced":true'; then
      log "wings confirmed the link"
    else
      warn "The node is created, but wings did not confirm the link."
      warn "Check that the URL and token are correct and that wings is running."
    fi
  else
    warn "Could not register the node: ${response:-no response}"
    warn "Add it manually in Admin -> Nodes (URL: $WINGS_URL)"
  fi
}

# ---- проверка ----
verify_panel() {
  local attempt=0
  while [[ "$attempt" -lt 30 ]]; do
    if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
      log "Panel is healthy"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  warn "The panel did not answer on http://127.0.0.1:${PORT}/api/health"
  return 1
}

# ---- запуск выбранного режима ----
if [[ "$INSTALL_MODE" == "cardinal" ]]; then
  deploy_cardinal
else
  deploy_systemd
fi

# ---- доводка до рабочего состояния ----
ADMIN_CREATED=0
ADMIN_PASSWORD=""
NODE_NAME="${NODE_NAME:-local}"
INSTALL_OK=1

if [[ "$DO_START" -eq 1 ]]; then
  verify_panel || INSTALL_OK=0

  create_first_admin || true

  if [[ "$USE_PROXY" -eq 1 ]]; then
    if [[ -n "$DOMAIN" ]]; then
      install_nginx || INSTALL_OK=0
      # Неудачный TLS — не «нерабочая установка»: панель живёт по HTTP.
      setup_tls || true
    else
      info "No --domain: the panel stays on 127.0.0.1:${PORT} (no reverse proxy)"
    fi
  else
    info "Reverse proxy skipped (--no-proxy)"
  fi

  register_node || true
fi

if [[ "$INSTALL_OK" -eq 1 ]]; then
  STATUS_LINE="${GREEN}cardinal-panel ${PANEL_VERSION} installed${NC}"
else
  STATUS_LINE="${RED}cardinal-panel ${PANEL_VERSION} installed, BUT NOT WORKING${NC}"
fi

if [[ "$INSTALL_MODE" == "cardinal" ]]; then
cat <<EOF

${STATUS_LINE}

  Image       : $(command -v cardinal >/dev/null 2>&1 && echo "${IMAGE_TAG:-cardinal-panel:${PANEL_VERSION}}" || echo "n/a")
  Config      : ${CONF_FILE}
  Compose     : ${COMPOSE_FILE}
  Panel URL   : $(public_url)
  Data        : именованный том cardinal "panel-data"
EOF
if [[ "$ADMIN_CREATED" -eq 1 ]]; then
cat <<EOF

  ${YELLOW}Вход в панель${NC}
    e-mail  : ${ADMIN_EMAIL}
    пароль  : ${ADMIN_PASSWORD:-<создан, пароль не показан>}
EOF
fi
cat <<EOF

  Управление:
    Status:  cardinal ps
    Logs:    cardinal logs panel
    Stop:    cardinal down -f ${COMPOSE_FILE}

EOF
else
cat <<EOF

${STATUS_LINE}

  Install dir : ${INSTALL_DIR}
  Data dir    : ${DATA_DIR}
  Config      : ${CONF_FILE}
  Panel URL   : $(public_url)
EOF
if [[ "$ADMIN_CREATED" -eq 1 ]]; then
cat <<EOF

  ${YELLOW}Вход в панель${NC}
    e-mail  : ${ADMIN_EMAIL}
    пароль  : ${ADMIN_PASSWORD:-<создан, пароль не показан>}
EOF
fi
cat <<EOF

  Управление:
    Logs:    journalctl -u ${SERVICE_NAME} -f
    Status:  systemctl status ${SERVICE_NAME}
    Stop:    systemctl stop ${SERVICE_NAME}

EOF
fi

if [[ "$INSTALL_OK" -ne 1 ]]; then
  cat >&2 <<EOF

${RED}Установка не завершена${NC}

Панель установлена, но не отвечает. Разберитесь по логам:
  journalctl -u ${SERVICE_NAME} -n 100
  df -h ${DATA_DIR}

EOF
  exit 1
fi
