// server/db/dialect.ts — выбор диалекта БД панели.
//
//   DB_DIALECT=sqlite (по умолчанию) — локальный файл SQLITE_PATH
//     (./data/panel.sqlite), драйвер — встроенный node:sqlite, ноль
//     внешних сервисов. Идеально для «поставил и работает».
//   DB_DIALECT=mysql — серверная MySQL через DB_HOST/DB_PORT/DB_USER/
//     DB_PASSWORD/DB_NAME. Миграции: db:push / db:migrate:mysql.
//
// Читается и схемой (какие таблицы строить), и рантаймом (какой драйвер),
// и drizzle.config.ts (какие миграции генерить) — один источник правды.
export const DIALECT: 'sqlite' | 'mysql' =
  (process.env.DB_DIALECT || 'sqlite').toLowerCase() === 'mysql' ? 'mysql' : 'sqlite'

export const IS_SQLITE = DIALECT !== 'mysql'

export const SQLITE_PATH = process.env.SQLITE_PATH || './data/panel.sqlite'
