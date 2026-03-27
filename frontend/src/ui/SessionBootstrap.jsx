import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'

export function SessionBootstrap() {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)
  const clearSession = useAuthStore((s) => s.clearSession)
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped)

  const meQuery = useQuery({
    queryKey: ['me'],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await api.get('/me')
      return res.data?.data
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!token) {
      if (!bootstrapped) setBootstrapped(true)
      return
    }

    if (meQuery.isSuccess) {
      setUser(meQuery.data)
      setBootstrapped(true)
    }

    if (meQuery.isError) {
      const status = meQuery.error?.response?.status
      if (status === 401) clearSession()
      setBootstrapped(true)
    }
  }, [
    token,
    bootstrapped,
    setBootstrapped,
    meQuery.isSuccess,
    meQuery.isError,
    meQuery.data,
    meQuery.error,
    setUser,
    clearSession,
  ])

  return null
}

