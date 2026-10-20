export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/login']
  
  if (publicRoutes.includes(to.path)) {
    return
  }
  
  const { status } = useAuth()
  
  if (status.value === 'loading') {
    return
  }
  
  if (status.value !== 'authenticated') {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})