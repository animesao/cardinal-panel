export default defineNuxtPlugin(() => {
  const $api = $fetch.create({
    baseURL: '',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  
  return {
    provide: {
      api: $api
    }
  }
})