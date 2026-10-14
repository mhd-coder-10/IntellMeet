// Zustand store for authentication state
// Uses HttpOnly Cookies for token security.
// Only user profile and isAuthenticated flag are persisted to localStorage (tokens are NOT persisted).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/auth'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken?: string, refreshToken?: string) => void
  setAccessToken: (accessToken: string | null) => void
  setUser: (user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken = "", refreshToken = "") => {
        // Clean up any legacy localStorage tokens for security
        try {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        } catch {}

        set({
          user,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          isAuthenticated: true,
        })
      },

      setAccessToken: (accessToken) => {
        set({ accessToken })
      },

      setUser: (user) => set({ user }),

      clearAuth: () => {
        try {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('auth-storage')
        } catch {}

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },
    }),
    {
      name: 'auth-storage',
      // ONLY persist user and isAuthenticated. Tokens remain in secure HttpOnly cookies + RAM memory.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)