import { defineConfig } from 'drizzle-kit'

// Диалект — из DB_DIALECT (по умолчанию sqlite, см. server/db/dialect.ts).
//   sqlite: локальный файл SQLITE_PATH (./data/panel.sqlite), миграции —
//           server/db/migrations/sqlite (применяются npm run db:migrate).
//   mysql:  серверная MySQL (DB_HOST/...), миграции —
//           server/db/migrations/mysql (db:push / db:migrate:mysql).
const dialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase() === 'mysql' ? 'mysql' : 'sqlite'

export default dialect === 'mysql'
  ? defineConfig({
      dialect: 'mysql',
      schema: './server/db/schema.ts',
      out: './server/db/migrations/mysql',
      dbCredentials: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ktpanel',
      },
    })
  : defineConfig({
      dialect: 'sqlite',
      schema: './server/db/schema.ts',
      out: './server/db/migrations/sqlite',
      dbCredentials: {
        url: process.env.SQLITE_PATH || './data/panel.sqlite',
      },
    })
