// @ts-nocheck
// server/utils/ratelimit.ts — троттлинг публичного API (как Application API
// в Pterodactyl: 60 запросов в минуту на ключ).
// Token bucket в памяти (панель — один процесс, при рестарте сбрасывается):
// ключ — id API-ключа. Чистые функции от времени — тестируемы без таймеров.
export const API_RATE_LIMIT = 60
export const API_RATE_WINDOW_MS = 60 * 1000

const buckets = new Map()

// checkBucket — занять один токен. nowMs инжектится для тестов.
export function checkBucket(key, limit = API_RATE_LIMIT, windowMs = API_RATE_WINDOW_MS, nowMs = Date.now()) {
  const perToken = windowMs / limit
  let b = buckets.get(key)
  if (!b) {
    b = { tokens: limit, updated: nowMs }
    buckets.set(key, b)
    if (buckets.size > 10000) buckets.clear()
  }
  const elapsed = Math.max(0, nowMs - b.updated)
  b.tokens = Math.min(limit, b.tokens + elapsed / perToken)
  b.updated = nowMs
  if (b.tokens >= 1) {
    b.tokens -= 1
    return {
      allowed: true,
      remaining: Math.floor(b.tokens),
      limit,
      resetMs: Math.ceil(perToken - (elapsed % perToken || 0)) || 1,
      retryAfter: 0,
    }
  }
  const retryAfter = Math.max(1, Math.ceil((1 - b.tokens) * perToken / 1000))
  return { allowed: false, remaining: 0, limit, resetMs: retryAfter * 1000, retryAfter }
}

// rateLimitHeaders — заголовки ответа (и для 200, и для 429).
export function rateLimitHeaders(st) {
  return {
    'X-RateLimit-Limit': String(st.limit),
    'X-RateLimit-Remaining': String(st.remaining),
  }
}

// ---------------------------------------------------------------------------
// Счётчики попыток входа (H1)
// ---------------------------------------------------------------------------
//
// Ключ счётчика НЕ ДОЛЖЕН зависеть от заголовков, которые присылает
// клиент: X-Forwarded-For подделывается одной строкой. Раньше бакет входа
// был `${ip}:${email}`, где ip брался из заголовка, — ограничение на
// перебор паролей обходилось заголовком с новым адресом на каждый запрос.
//
// Поэтому основной лимит всегда по идентичности (e-mail), а IP-ведро —
// только дополнение, и IP берётся из доверенного источника (см.
// clientIp в server/utils/clientip.ts).

const attemptBuckets = new Map()

export const LOGIN_ATTEMPT_LIMIT = 10
export const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_IP_ATTEMPT_LIMIT = 30
export const LOGIN_IP_ATTEMPT_WINDOW_MS = 10 * 60 * 1000

// checkAttemptBucket — счётчик попыток по ключу. Возвращает true, если
// попытку ОТКЛОНИТЬ (лимит исчерпан). nowMs инжектится для тестов.
export function checkAttemptBucket(key, limit, windowMs, nowMs = Date.now()) {
  if (!key) return false
  const fresh = (attemptBuckets.get(key) || []).filter((t) => nowMs - t < windowMs)
  if (fresh.length >= limit) {
    attemptBuckets.set(key, fresh)
    return true
  }
  fresh.push(nowMs)
  if (attemptBuckets.size > 10000) attemptBuckets.clear()
  attemptBuckets.set(key, fresh)
  return false
}

// resetAttemptBucket — сбросить счётчик (после успешного входа).
export function resetAttemptBucket(key) {
  if (key) attemptBuckets.delete(key)
}
