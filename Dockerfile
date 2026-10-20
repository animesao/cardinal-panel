# cardinal-panel — образ для Docker / Podman.
#
#   docker build -t cardinal-panel:0.1.0 .
#   docker run -d -p 3000:3000 --env-file .env -v panel-data:/app/data cardinal-panel:0.1.0
#
# Базовый образ — Node 24: модуль node:sqlite (диалект SQLite по умолчанию)
# доступен без experimental-флага начиная с Node 23.4.

# ─── сборка ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /build

# Зависимости — отдельным слоем, чтобы переиспользовать кэш Docker.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# postinstall патчит next-auth и готовит типы — запускаем явно.
RUN node scripts/patch-next-auth-core.mjs \
 && npx nuxt prepare \
 && npm run build

# ─── рантайм ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

# tini — чтобы SIGTERM доходил до node (корректный graceful shutdown),
# curl — для healthcheck.
RUN apk add --no-cache tini curl \
 && addgroup -g 10001 -S cardinal \
 && adduser -u 10001 -S cardinal -G cardinal

WORKDIR /app

ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    DB_DIALECT=sqlite \
    SQLITE_PATH=/app/data/panel.sqlite

COPY --from=builder --chown=cardinal:cardinal /build/.output ./.output
COPY --from=builder --chown=cardinal:cardinal /build/scripts ./scripts
COPY --from=builder --chown=cardinal:cardinal /build/server/db/migrations ./server/db/migrations
COPY --from=builder --chown=cardinal:cardinal /build/package.json ./package.json
COPY --from=builder --chown=cardinal:cardinal /build/VERSION ./VERSION
COPY --from=builder --chown=cardinal:cardinal /build/.env.example ./.env.example

# Каталог под SQLite-базу: он должен принадлежать пользователю cardinal.
RUN mkdir -p /app/data && chown -R cardinal:cardinal /app/data
VOLUME ["/app/data"]

USER cardinal
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
