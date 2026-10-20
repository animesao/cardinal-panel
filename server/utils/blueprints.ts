// @ts-nocheck
// server/utils/blueprints.ts — яйца в стиле Pterodactyl.
//
// Чертёж хранит:
//   image            — основной образ (legacy, одиночный);
//   images           — JSON-массив ВСЕХ образов (egg.images) для выбора версии;
//   startupCommand   — шаблон запуска с {{ПЕРЕМЕННЫМИ}};
//   environment      — JSON дефолтов окружения (legacy);
//   variables        — JSON-массив переменных яйца:
//     {name, description, env_variable, default_value,
//      user_viewable, user_editable, rules}.
//   installScript    — скрипт установки (egg.scripts.installation.script).
//
// Приоритет дефолтов: variables[] → environment (legacy, только если
// variables пуст). Стартап рендерится renderStartup() из wings.ts,
// его {{...}} покрывает любые переменные яйца автоматически.
import { renderStartup } from './wings'

export function parseJsonArray(raw: any): any[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return []
    try {
      const v = JSON.parse(t)
      return Array.isArray(v) ? v : []
    } catch {
      return t.split('\n').map((s) => s.trim()).filter(Boolean)
    }
  }
  return []
}

export function parseEnvObject(raw: any): Record<string, any> {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw }
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw)
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
    } catch { return {} }
  }
  return {}
}

// enrichBlueprint — строка БД → объект для фронта: images[], variables[],
// snake-алиасы. Старые поля на месте (обратная совместимость).
export function enrichBlueprint(b: any) {
  if (!b) return b
  let images = parseJsonArray(b.images)
  if (!images.length && b.image) images = [b.image]
  let variables = parseJsonArray(b.variables)
  if (!variables.length) {
    const env = parseEnvObject(b.environment)
    variables = Object.entries(env).map(([k, v]) => ({
      name: k,
      description: '',
      env_variable: k,
      default_value: v ?? '',
      user_viewable: true,
      user_editable: true,
      rules: 'nullable|string',
    }))
  }
  return {
    ...b,
    images,
    variables,
    startup_command: b.startupCommand ?? b.startup_command,
    install_script: b.installScript ?? b.install_script,
  }
}

// variableDefaults — {ENV_VAR: default} из variables[] (null/undefined пропускаем).
export function variableDefaults(vars: any[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const v of vars || []) {
    const key = v?.env_variable
    if (!key) continue
    if (v.default_value !== undefined && v.default_value !== null) out[key] = v.default_value
  }
  return out
}

// checkRules — мини-подмножество правил pterodactyl: required/nullable/string/max:N.
export function checkRules(value: any, rules: string): string | null {
  const parts = String(rules || 'nullable|string').split('|').map((s) => s.trim())
  const str = value === undefined || value === null ? '' : String(value)
  if (parts.includes('required') && !str) return 'обязательна для заполнения'
  if (parts.includes('string') && value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'number') {
    return 'должна быть строкой'
  }
  for (const p of parts) {
    const m = p.match(/^max:(\d+)$/)
    if (m && str.length > Number(m[1])) return `не длиннее ${m[1]} символов`
  }
  return null
}

// applyVariables — слияние ввода поверх текущих env с учётом variables[]:
// user_editable=false игнорируется (берётся дефолт/текущее), required/max
// проверяются. Возвращает {env, errors[]} (errors — человекочитаемые).
export function applyVariables(bpVars: any[], currentEnv: Record<string, any>, input: Record<string, any>) {
  const env = { ...(currentEnv || {}) }
  const errors: string[] = []
  const byKey: Record<string, any> = {}
  for (const v of bpVars || []) {
    if (v?.env_variable) byKey[v.env_variable] = v
  }
  for (const [key, spec] of Object.entries(byKey)) {
    const editable = spec.user_editable !== false
    const incoming = input && Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined
    // Чужой ввод в нередактируемую переменную игнорируется, дефолт — нет.
    if (incoming !== undefined && editable) env[key] = incoming
    else if (env[key] === undefined && spec.default_value !== undefined && spec.default_value !== null) {
      env[key] = spec.default_value
    }
    const problem = checkRules(env[key], spec.rules)
    if (problem) errors.push(`${key}: ${problem}`)
  }
  // Внеплановые ключи (extras) пропускаем как есть.
  for (const [key, value] of Object.entries(input || {})) {
    if (!byKey[key] && value !== undefined) env[key] = value
  }
  return { env, errors }
}

// eggToBlueprint — маппинг экспортного JSON яйца Pterodactyl
// (PTDL_v1) в строку blueprints. Чистая функция (тестируется отдельно).
export function eggToBlueprint(egg: any) {
  if (!egg || typeof egg !== 'object' || Array.isArray(egg)) {
    throw createError({ statusCode: 400, message: 'Это не похоже на JSON яйца (нужен объект PTDL_v1)' })
  }
  if (!egg.name) throw createError({ statusCode: 400, message: 'У яйца нет name' })
  const images = Array.isArray(egg.images) ? egg.images.filter(Boolean) : []
  const variables = Array.isArray(egg.variables)
    ? egg.variables.map((v: any) => ({
        name: v?.name || v?.env_variable || '',
        description: v?.description || '',
        env_variable: v?.env_variable || '',
        default_value: v?.default_value ?? '',
        user_viewable: v?.user_viewable !== false,
        user_editable: v?.user_editable !== false,
        rules: v?.rules || 'nullable|string',
      })).filter((v: any) => v.env_variable)
    : []
  const envDefaults: Record<string, any> = {}
  for (const v of variables) {
    if (v.default_value !== '' && v.default_value !== null && v.default_value !== undefined) {
      envDefaults[v.env_variable] = v.default_value
    }
  }
  return {
    name: String(egg.name),
    description: egg.description || null,
    image: images[0] || 'alpine:latest',
    startupCommand: egg.startup || '',
    environment: Object.keys(envDefaults).length ? JSON.stringify(envDefaults) : null,
    installScript: egg?.scripts?.installation?.script ?? null,
    images: images.length ? JSON.stringify(images) : null,
    variables: variables.length ? JSON.stringify(variables) : null,
  }
}

// renderEggStartup — шаблон + переменные + системные (память/порт...).
export function renderEggStartup(template: string, vars: Record<string, any>, system: Record<string, any> = {}) {
  return renderStartup(template || '', { ...vars, ...system })
}
