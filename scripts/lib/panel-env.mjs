// scripts/lib/panel-env.mjs — где лежит конфигурация панели.
//
// Скрипты панели (create-admin, admin-api-key, migrate-sqlite) запускают
// и из установки, и вручную из консоли. Путь к базе задаётся в
// /etc/cardinal-panel/panel.env — том же файле, который читает
// systemd-юнит. Если переменной SQLITE_PATH нет в окружении, берём её
// оттуда: иначе скрипт молча работает с другой базой
// (./data/panel.sqlite вместо /var/lib/cardinal-panel/panel.sqlite)
// и админ создаётся не там, где его ищет панель.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')

/** Куда установщик кладёт конфигурацию. Переопределяется переменной. */
export function panelEnvFile() {
  return process.env.PANEL_ENV_FILE || '/etc/cardinal-panel/panel.env'
}

/**
 * Читает panel.env и отдаёт переменные окружения.
 * Значения в кавычках снимаются, `#`-комментарии игнорируются.
 */
export function readPanelEnv(file = panelEnvFile()) {
  const out = {}
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch {
    return out
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

/**
 * Путь к базе SQLite: сначала окружение, потом panel.env, потом
 * значение по умолчанию из .env.example.
 */
export function resolveSqlitePath(argvDb) {
  if (argvDb) return path.resolve(root, argvDb)
  const fromEnv = process.env.SQLITE_PATH
  if (fromEnv) return path.resolve(root, fromEnv)
  const fromFile = readPanelEnv().SQLITE_PATH
  if (fromFile) return path.resolve(root, fromFile)
  return path.resolve(root, './data/panel.sqlite')
}

/** Диалект БД: panel.env, затем окружение, затем sqlite. */
export function resolveDialect() {
  return (
    process.env.DB_DIALECT ||
    readPanelEnv().DB_DIALECT ||
    'sqlite'
  ).toLowerCase()
}
