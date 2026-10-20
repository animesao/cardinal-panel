#!/usr/bin/env node
// scripts/with-env.mjs — выставить env-переменные для одной команды.
// Нужно, т.к. префикс `VAR=val cmd` в npm-скриптах не переносим на Windows.
//
//   node scripts/with-env.mjs DB_DIALECT=mysql SQLITE_PATH=./x.sqlite -- drizzle-kit push
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const sep = args.indexOf('--')
const assigns = sep === -1 ? [] : args.slice(0, sep)
const cmd = sep === -1 ? args : args.slice(sep + 1)

if (!cmd.length) {
  console.error('usage: node scripts/with-env.mjs KEY=VAL... -- <cmd> [args...]')
  process.exit(2)
}

const env = { ...process.env }
for (const a of assigns) {
  const i = a.indexOf('=')
  if (i > 0) env[a.slice(0, i)] = a.slice(i + 1)
}

const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env })
process.exit(r.status ?? 1)
