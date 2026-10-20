// @ts-nocheck
// server/utils/pagination.ts — пагинация в стиле Pterodactyl поверх limit/offset.
//
// Клиент выбирает формат параметрами:
//   legacy (по умолчанию, как раньше): ?limit=&offset= → голый массив.
//     Без параметров — весь список целиком (поведение не меняется).
//   pterodactyl: ?page=&per_page= → конверт
//     {data, meta: {pagination: {total, count, per_page, current_page, total_pages}}}
//     + ?filter[field]= (подстрока, регистронезависимо, только allowed-поля)
//     + ?sort=[-]field (префикс "-" = desc).
export const DEFAULT_PER_PAGE = 50
export const MAX_PER_PAGE = 100

function toInt(v, fallback) {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isInteger(n) ? n : fallback
}

export function parseListQuery(query = {}, opts = {}) {
  const q = query || {}
  const maxPerPage = opts.maxPerPage || MAX_PER_PAGE
  const ptero = q.page !== undefined || q.per_page !== undefined
  let filter = {}
  if (q.filter && typeof q.filter === 'object' && !Array.isArray(q.filter)) {
    for (const [k, v] of Object.entries(q.filter)) {
      if (typeof v === 'string' && v.length) filter[k] = v
    }
  }
  let sort = null
  let order = String(q.order || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
  if (typeof q.sort === 'string' && q.sort.length) {
    sort = q.sort.startsWith('-') ? q.sort.slice(1) : q.sort
    if (q.sort.startsWith('-')) order = 'desc'
  }
  if (ptero) {
    return {
      ptero: true,
      page: Math.max(1, toInt(q.page, 1)),
      perPage: Math.min(Math.max(1, toInt(q.per_page, opts.defaultPerPage || DEFAULT_PER_PAGE)), maxPerPage),
      limit: 0,
      offset: 0,
      filter,
      sort,
      order,
    }
  }
  // legacy limit: без параметра — весь список (как раньше); с параметром — срез.
  const rawLimit = q.limit === undefined ? 0 : Math.min(Math.max(1, toInt(q.limit, 1)), maxPerPage)
  return {
    ptero: false,
    page: 1,
    perPage: opts.defaultPerPage || DEFAULT_PER_PAGE,
    limit: rawLimit,
    offset: Math.max(0, toInt(q.offset, 0)),
    filter,
    sort,
    order,
  }
}

function fieldValue(item, field) {
  const v = item?.[field]
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return ''
  return String(v)
}

export function applyListFilter(items, filter, allowed) {
  const keys = Object.keys(filter || {}).filter((k) => allowed.includes(k))
  if (!keys.length) return items
  return items.filter((it) => keys.every((k) =>
    fieldValue(it, k).toLowerCase().includes(String(filter[k]).toLowerCase())))
}

export function applyListSort(items, sort, order, allowed) {
  if (!sort || !allowed.includes(sort)) return items
  const dir = order === 'desc' ? -1 : 1
  return [...items].sort((a, b) => {
    const av = fieldValue(a, sort)
    const bv = fieldValue(b, sort)
    const an = Number(av)
    const bn = Number(bv)
    if (av !== '' && bv !== '' && Number.isFinite(an) && Number.isFinite(bn) && (an || bn)) {
      return (an - bn) * dir
    }
    return av.localeCompare(bv, undefined, { numeric: true }) * dir
  })
}

// paginateList — фильтр + сортировка + нарезка; возвращает {items, total, page, perPage}.
export function paginateList(all, parsed, allowed = []) {
  const list = Array.isArray(all) ? all : []
  const filtered = applyListSort(applyListFilter(list, parsed.filter, allowed), parsed.sort, parsed.order, allowed)
  const total = filtered.length
  if (parsed.ptero) {
    const start = (parsed.page - 1) * parsed.perPage
    return { items: filtered.slice(start, start + parsed.perPage), total, page: parsed.page, perPage: parsed.perPage }
  }
  if (parsed.limit > 0) return { items: filtered.slice(parsed.offset, parsed.offset + parsed.limit), total, page: 1, perPage: parsed.limit }
  return { items: filtered, total, page: 1, perPage: total }
}

// pageAliases — page/per_page как алиасы limit/offset для сессионных
// роутов (формат ответа не меняется: голый массив + X-Total-Count).
export function pageAliases(query = {}) {
  const q = query || {}
  if ((q.page !== undefined || q.per_page !== undefined) && q.limit === undefined && q.offset === undefined) {
    const page = Math.max(1, toInt(q.page, 1))
    const perPage = Math.min(Math.max(1, toInt(q.per_page, DEFAULT_PER_PAGE)), MAX_PER_PAGE)
    return { limit: perPage, offset: (page - 1) * perPage }
  }
  return {}
}
export function listResponse(all, parsed, allowed = []) {
  const { items, total, page, perPage } = paginateList(all, parsed, allowed)
  if (!parsed.ptero) return items
  return {
    data: items,
    meta: {
      pagination: {
        total,
        count: items.length,
        per_page: perPage,
        current_page: page,
        total_pages: Math.max(1, Math.ceil(total / perPage)),
      },
    },
  }
}
