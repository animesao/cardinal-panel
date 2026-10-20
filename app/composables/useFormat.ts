// useFormat — человеческие размеры вместо сырых чисел:
// 512 МБ, 1024 МБ → 1 ГБ, 1536 МБ → 1.5 ГБ.
// Единицы берутся из i18n (units.mb/gb), поэтому уважают язык.
export const formatMb = (mb: any): string => {
  const { t } = useI18n()
  const n = Number(mb) || 0
  if (n <= 0) return `0 ${t('units.mb')}`
  if (n < 1024) return `${Math.round(n)} ${t('units.mb')}`
  const gb = n / 1024
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} ${t('units.gb')}`
}

export const formatBytes = (bytes: any): string => {
  const { t } = useI18n()
  const b = Number(bytes) || 0
  if (b <= 0) return '0 B'
  const mbUnit = t('units.mb')
  const gbUnit = t('units.gb')
  const sizes = ['B', 'KB', mbUnit, gbUnit, 'TB']
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(b) / Math.log(1024)))
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}
