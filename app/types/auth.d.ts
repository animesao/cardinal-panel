declare module 'next-auth' {
  interface User {
    id?: number
    uuid?: string
    role?: string
    provider?: string
    lastLogin?: string
  }
  
  interface Session {
    user: {
      id?: number
      uuid?: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
      provider?: string
      lastLogin?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: number
    uuid?: string
    role?: string
    provider?: string
    lastLogin?: string
  }
}

export {}