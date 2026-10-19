// Fetches fresh user data from backend on app load
// Updates Zustand store with latest info without logging out on temporary network issues

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

export function useCurrentUser() {
  const { isAuthenticated, setUser, clearAuth } = useAuthStore()

  const { data, isError, error } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getMe,
    enabled: isAuthenticated,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes cache to prevent aggressive refetching
  })

  useEffect(() => {
    if (data) {
      setUser(data)
    }
  }, [data, setUser])

  useEffect(() => {
    // Only clear authentication if backend specifically returns 401 Unauthorized
    // Never logout on temporary Render cold starts, network timeouts, or 5xx server issues
    if (isError && error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        clearAuth()
      }
    }
  }, [isError, error, clearAuth])
}
