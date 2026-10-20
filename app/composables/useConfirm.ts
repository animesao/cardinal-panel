// useConfirm — модальные подтверждения в стиле панели взамен
// нативного confirm(). Монтируется один раз (UiConfirmModal в лейаутах),
// вызывается из любого места: await confirmDialog({ message, ... }).
export const useConfirmState = () => useState('ui-confirm', () => ({
  open: false,
  title: '',
  message: '',
  confirmText: 'Подтвердить',
  cancelText: 'Отмена',
  danger: false,
  resolve: null as null | ((v: boolean) => void),
}))

export const confirmDialog = (opts: {
  message: string
  title?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}): Promise<boolean> => {
  const state = useConfirmState()
  // Если окно уже открыто — честно закрываем старое отказом,
  // чтобы не висели два неразрешённых промиса.
  if (state.value.open && state.value.resolve) {
    state.value.resolve(false)
  }
  return new Promise<boolean>((resolve) => {
    state.value = {
      open: true,
      title: opts.title || 'Подтвердите действие',
      message: opts.message,
      confirmText: opts.confirmText || 'Подтвердить',
      cancelText: opts.cancelText || 'Отмена',
      danger: !!opts.danger,
      resolve,
    }
  })
}

export const closeConfirm = (result: boolean) => {
  const state = useConfirmState()
  state.value.resolve?.(result)
  state.value = { ...state.value, open: false, resolve: null }
}
