// @ts-nocheck
// POST /api/servers/[id]/files/archive {paths: []} — скачать выбранное
// одним .zip. Файлы тянутся из wings (fm/download), папки раскрываются
// рекурсивно (fm/list). Упаковка — stored (без сжатия), без внешних
// зависимостей. Лимиты: ≤200 файлов, ≤512 МБ суммарно.
import { requireServer, wingsFetch, containerRef, needPerm } from '../../../../utils/wings'

const MAX_FILES = 200
const MAX_BYTES = 512 * 1024 * 1024

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(d = new Date()) {
  return {
    time: (((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2))) & 0xffff,
    date: ((((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate())) & 0xffff,
  }
}

// sanitizeArc — имя внутри архива: без слэшей/путей (защита от zip-slip
// при распаковке чужими именами файлов из контейнера).
function sanitizeArc(s: string): string {
  return String(s || '').replace(/[\\/]/g, '_').slice(0, 255) || 'file'
}

function buildZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  const { time, date } = dosDateTime()
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8')
    const crc = crc32(e.data)
    const size = e.data.length
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0)
    head.writeUInt16LE(20, 4)
    head.writeUInt16LE(0x0800, 6)
    head.writeUInt16LE(0, 8)
    head.writeUInt16LE(time, 10)
    head.writeUInt16LE(date, 12)
    head.writeUInt32LE(crc, 14)
    head.writeUInt32LE(size, 18)
    head.writeUInt32LE(size, 22)
    head.writeUInt16LE(nameBuf.length, 26)
    head.writeUInt16LE(0, 28)
    parts.push(head, nameBuf, e.data)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt16LE(0, 10)
    ch.writeUInt16LE(time, 12)
    ch.writeUInt16LE(date, 14)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(size, 20)
    ch.writeUInt32LE(size, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt16LE(0, 30)
    ch.writeUInt16LE(0, 32)
    ch.writeUInt16LE(0, 34)
    ch.writeUInt16LE(0, 36)
    ch.writeUInt32LE(0, 38)
    ch.writeUInt32LE(offset, 42)
    central.push(ch, nameBuf)
    offset += 30 + nameBuf.length + size
  }
  const centralStart = offset
  const centralSize = central.reduce((a, b) => a + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralStart, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...parts, ...central, end])
}

export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params?.id || '0')
  const body = await readBody(event).catch(() => ({}))
  const ctx = await requireServer(event, id)
  const { srv, node } = ctx
  needPerm(ctx, 'file.archive')

  let paths = Array.isArray(body?.paths) ? body.paths : []
  paths = [...new Set(paths.map((p) => String(p || '')))]
    .filter((p) => p.startsWith('/') && !p.includes('..') && p.length > 1 && p.length < 512)
  if (!paths.length) throw createError({ statusCode: 400, message: 'Нет путей для архива' })
  if (paths.length > MAX_FILES) throw createError({ statusCode: 413, message: `Слишком много путей (максимум ${MAX_FILES})` })

  const ref = containerRef(srv.uuid)
  const entries: Array<{ name: string; data: Buffer }> = []
  let total = 0
  let skipped = 0

  const addFile = async (arcName: string, fullPath: string) => {
    if (entries.length >= MAX_FILES) throw createError({ statusCode: 413, message: `Слишком много файлов (максимум ${MAX_FILES})` })
    let res: any
    try {
      res = await wingsFetch(node, `/v1/containers/${ref}/fm/download?path=${encodeURIComponent(fullPath)}`)
    } catch {
      skipped++
      return
    }
    const buf = Buffer.from(res?.content || '', 'base64')
    if (!buf.length) {
      skipped++
      return
    }
    if (total + buf.length > MAX_BYTES) {
      throw createError({ statusCode: 413, message: 'Архив больше 512 МБ — качай частями' })
    }
    total += buf.length
    entries.push({ name: arcName, data: buf })
  }

  const walk = async (arcBase: string, fullPath: string, depth: number) => {
    if (depth > 8) return
    let fm: any
    try {
      fm = await wingsFetch(node, `/v1/containers/${ref}/fm/list?path=${encodeURIComponent(fullPath)}`)
    } catch {
      skipped++
      return
    }
    const list = Array.isArray(fm) ? fm : fm?.entries || []
    for (const e of list) {
      const name = sanitizeArc(e?.name)
      if (!name || name === '.' || name === '..') continue
      const childFull = fullPath === '/' ? `/${e.name}` : `${fullPath}/${e.name}`
      const childArc = arcBase ? `${arcBase}/${name}` : name
      if (e?.type === 'dir' || e?.directory === true) await walk(childArc, childFull, depth + 1)
      else await addFile(childArc, childFull)
    }
  }

  for (const p of paths) {
    const base = sanitizeArc(p.split('/').pop())
    let isDir = false
    try {
      const probe: any = await wingsFetch(node, `/v1/containers/${ref}/fm/list?path=${encodeURIComponent(p)}`)
      const list = Array.isArray(probe) ? probe : probe?.entries
      isDir = Array.isArray(list)
    } catch {
      isDir = false
    }
    if (isDir) await walk(base, p, 0)
    else await addFile(base, p)
  }

  if (!entries.length) throw createError({ statusCode: 404, message: 'Нечего архивировать (файлы не прочитались)' })

  const zip = buildZip(entries)
  const singleDir = paths.length === 1 && entries.every((e) => e.name.startsWith(sanitizeArc(paths[0].split('/').pop() || '') + '/'))
  const fileName = singleDir
    ? `${sanitizeArc(paths[0].split('/').pop()).slice(0, 100) || 'archive'}.zip`
    : `archive-${entries.length}-files.zip`

  event.node.res.setHeader('Content-Type', 'application/zip')
  event.node.res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  event.node.res.setHeader('Content-Length', zip.length)
  return zip
})
