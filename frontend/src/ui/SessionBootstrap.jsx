import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'

const STALE_TIME = 30 * 60 * 1000 // 30 minutes in milliseconds
const AUTO_LOGOUT_TIME = 30 * 60 * 1000 // 30 minutes in milliseconds

export function SessionBootstrap() {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)
  const clearSession = useAuthStore((s) => s.clearSession)
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped)

  // Setup meQuery with max 30min staleTime
  const meQuery = useQuery({
    queryKey: ['me'],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await api.get('/me')
      return res.data?.data
    },
    staleTime: STALE_TIME,
  })

  // Handle session bootstrap logic
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

  // Auto logout after 30min of inactivity
  const logoutTimerRef = useRef()

  useEffect(() => {
    if (!token) {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current)
        logoutTimerRef.current = null
      }
      return
    }

    const resetTimer = () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = setTimeout(() => {
        clearSession()
      }, AUTO_LOGOUT_TIME)
    }

    // Listen for relevant events to reset the timer
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    for (const event of events) {
      window.addEventListener(event, resetTimer)
    }

    resetTimer() 

    return () => {
      for (const event of events) {
        window.removeEventListener(event, resetTimer)
      }
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current)
        logoutTimerRef.current = null
      }
    }
  }, [token, clearSession])

  return null
}