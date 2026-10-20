#!/usr/bin/env node
// scripts/check-imports.mjs — проверка глубины относительных импортов
// в server/**: файл в подпапке на N уровней ниже server/ обязан обращаться
// к server/db и server/utils ровно N раз через '../'.
// Ловит класс багов «лишний/недостающий ../», который tsc и dev-режим
// не видят, а прод-сборка Nitro роняет
// (RollupError: Could not resolve ...).
//   node scripts/check-imports.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = 'server'
let bad = 0
let checked = 0
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { walk(p); continue }
    if (!p.endsWith('.ts')) continue
    const rel = path.relative('server', path.dirname(p)).split(path.sep)
    const ups = rel.length
    const s = fs.readFileSync(p, 'utf8')
    for (const m of s.matchAll(/from '(\.\.[^']+)'/g)) {
      const target = m[1]
      checked++
      const parts = target.split('/')
      const got = parts.filter((x) => x === '..').length
      if (got !== ups) {
        console.log('BAD ' + p + ' -> ' + target + ' (got ' + got + ' ups, file needs ' + ups + ')')
        bad = 1
      } else {
        const abs = path.normalize(path.join(path.dirname(p), target))
        if (!fs.existsSync(abs) && !fs.existsSync(abs + '.ts')) {
          console.log('MISSING ' + p + ' -> ' + target + ' (resolves ' + abs + ')')
          bad = 1
        }
      }
    }
  }
}
walk(root)
console.log('checked=' + checked + ' ' + (bad ? 'FAIL' : 'OK'))
process.exit(bad)
