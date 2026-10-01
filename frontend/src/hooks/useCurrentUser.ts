// Fetches fresh user data from backend on app load
// Updates Zustand store with latest info

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export function useCurrentUser() {
  const { isAuthenticated, setUser, clearAuth } = useAuthStore()

  const { data, isError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getMe,
    enabled: isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (data) {
      setUser(data)
    }
  }, [data, setUser])

  useEffect(() => {
    if (isError) {
      clearAuth()
    }
  }, [isError, clearAuth])
}