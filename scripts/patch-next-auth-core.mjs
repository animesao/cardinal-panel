// Возвращает подпуть `next-auth/core` в карту exports next-auth.
//
// ЗАЧЕМ. Панель работает с провайдером "authjs" из @sidebase/nuxt-auth:
// его обработчик импортирует `AuthHandler` из `next-auth/core`.
//
//   - next-auth 4.22.5 и старше — подпуть ./core есть в exports;
//   - next-auth 4.23.0+ — подпуть УБРАН из exports, хотя сам файл
//     core/index.js в пакете остался и по-прежнему экспортирует AuthHandler.
//
// Из-за этого Nitro не может разрешить импорт, и панель падает при старте:
//   ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './core' is not defined
//   by "exports" in .../next-auth/package.json
//
// ПОЧЕМУ НЕ ОТКАТИТЬ ВЕРСИЮ. @sidebase/nuxt-auth 1.4.0 объявляет peer
// next-auth ~4.21.1 — то есть как раз версию с подпутем. Но откат вниз
// означает:
//
//   GHSA-7rqj-j65f-68wh  CRITICAL  Unicode-нормализация e-mail валидируется
//                                  ДО нормализации → гомоглиф `@` обходит
//                                  аутентификацию по почте.  >=4.10.3 <4.24.15
//   GHSA-xmf8-cvqr-rfgj  high      getToken() падает на кривом Bearer-заголовке
//                                  >=4.0.6 <=4.24.14
//   GHSA-v64w-49xw-qq89  moderate  подмена пользователя, обход базовой
//                                  аутентификации.  <4.24.5
//   GHSA-5jpx-9hw9-2fx4  moderate  некорректная доставка e-mail.  <4.24.12
//   GHSA-x445-f3h2-j279  moderate  state/nonce/PKCE-cookie не привязаны к
//                                  провайдеру.  <=4.24.14
//
// Все пять закрыты в 4.24.15. Значит откатываться нельзя, а подпуть
// приходится вернуть: файла в пакете он не трогает, меняется только карта
// exports — ровно то, что upstream делал до 4.23.0.
//
// Скрипт идемпотентен: если подпуть уже есть (или next-auth обновился и
// вернул его сам), ничего не меняется.

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require_ = createRequire(import.meta.url)

let pkgJsonPath
try {
  pkgJsonPath = join(dirname(require_.resolve('next-auth')), 'package.json')
} catch {
  console.warn('[next-auth-core] next-auth не установлен — пропускаю')
  process.exit(0)
}

const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))

if (!pkg.exports || Object.prototype.hasOwnProperty.call(pkg.exports, './core')) {
  console.log(`[next-auth-core] next-auth@${pkg.version}: подпуть ./core уже на месте — ничего не меняю`)
  process.exit(0)
}

// Проверяем, что сам файл на месте: если next-auth переедет, лучше упасть
// здесь с понятным сообщением, чем получить нерезолвящийся импорт.
const coreFile = join(dirname(pkgJsonPath), 'core', 'index.js')
try {
  readFileSync(coreFile)
} catch {
  console.error(
    `[next-auth-core] next-auth@${pkg.version}: нет файла core/index.js — патч невозможен.\n` +
      '  Возможно, в новой версии AuthHandler переехал. Проверьте, что нужно ' +
      'провайдеру @sidebase/nuxt-auth, и поправьте импорт в его runtime.',
  )
  process.exit(1)
}

// Вставляем ключ рядом с ./adapters, сохраняя порядок остальных полей.
const rebuilt = {}
for (const [key, value] of Object.entries(pkg.exports)) {
  rebuilt[key] = value
  if (key === './adapters') {
    rebuilt['./core'] = { types: './core/index.d.ts', default: './core/index.js' }
  }
}
if (!rebuilt['./core']) {
  rebuilt['./core'] = { types: './core/index.d.ts', default: './core/index.js' }
}

pkg.exports = rebuilt
writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`[next-auth-core] next-auth@${pkg.version}: подпуть ./core возвращён в exports`)
