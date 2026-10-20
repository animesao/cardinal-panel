export const useNodeStatus = (nodeId: number) => {
  const status = ref<'online' | 'offline' | 'loading'>('loading')
  
  const checkStatus = async () => {
    try {
      // Используем прямой fetch вместо $api
      const response = await $fetch<{ status: string }>(`/api/nodes/${nodeId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      status.value = response.status as 'online' | 'offline'
    } catch {
      status.value = 'offline'
    }
  }
  
  // Автообновление каждые 30 секунд
  let interval: NodeJS.Timeout
  
  onMounted(() => {
    checkStatus()
    interval = setInterval(checkStatus, 30000)
  })
  
  onUnmounted(() => {
    clearInterval(interval)
  })
  
  return { status, checkStatus }
}