export default defineNuxtRouteMiddleware((to) => {
  const { data: session, status } = useAuth()
  
  // Ждём загрузки сессии
  if (status.value === 'loading') return
  
  // Если не авторизован — на логин
  if (status.value !== 'authenticated') {
    return navigateTo('/login')
  }
  
  // Если не админ — на дашборд
  if (session.value?.user?.role !== 'admin') {
    return navigateTo('/dashboard')
  }
})