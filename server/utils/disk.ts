// server/utils/disk.ts — свободное место на разделе.
//
// Панель на заполненном разделе продолжает отдавать страницы, но любая
// запись в БД падает с «database or disk is full». Узнать об этом заранее
// можно только здесь: /api/health отдаёт раздел disk со свободным
// местом и статус degraded, когда места мало.
//
// Отдельный модуль (без импортов Nuxt), чтобы правило можно было покрыть
// юнит-тестами.
import { statfs } from 'node:fs/promises'

// Ниже этого объёма панель ещё работает, но запись в БД может упасть.
export const DISK_WARN_MB = 512

/**
 * freeDiskMb — свободное место (МиБ) на разделе, где лежит каталог.
 * null, если раздел не удалось измерить.
 */
export async function freeDiskMb(dir: string): Promise<number | null> {
  try {
    const st = await statfs(dir)
    return Math.floor((st.bavail * st.bsize) / 1048576)
  } catch {
    return null
  }
}

/**
 * diskStatus — состояние панели по свободному месту.
 * null означает «измерить не удалось» — тогда ничего не утверждаем.
 */
export function diskStatus(
  freeMb: number | null,
  warnMb: number = DISK_WARN_MB,
): { status: 'ok' | 'degraded'; warning?: string } {
  if (freeMb === null) return { status: 'ok' }
  if (freeMb < warnMb) {
    return {
      status: 'degraded',
      warning: `free space below ${warnMb} MB - database writes will fail`,
    }
  }
  return { status: 'ok' }
}
