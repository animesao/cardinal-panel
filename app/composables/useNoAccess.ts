// useNoAccess — глобальное окно «Нет доступа» для субпользователей.
// Состояние через useState: модалка монтируется один раз (страница сервера),
// а открывать её может любой компонент через deny().
export const useNoAccess = () => {
  const state = useState('no-access', () => ({ open: false, message: '' }))
  const show = (message?: string) => {
    state.value = {
      open: true,
      message: message || 'У вас нет прав для этого действия на сервере.',
    }
  }
  const close = () => {
    state.value.open = false
  }
  return { state, show, close }
}

// isNoAccess — это 403? Проверяем все формы, в которых ofetch отдаёт статус.
export const isNoAccess = (e: any): boolean => {
  const code = e?.statusCode ?? e?.status ?? e?.response?.status ?? e?.data?.statusCode
  return code === 403
}

// deny(e) — единый воронка для запретов: 403 открывает окно «Нет доступа»
// и возвращает true (вызывающий пропускает свою ошибку), иначе false.
export const deny = (e: any): boolean => {
  if (!isNoAccess(e)) return false
  const { show } = useNoAccess()
  show(e?.data?.message || e?.message)
  return true
}
