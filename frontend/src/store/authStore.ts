// Zustand store for authentication state
// Persists user session and tokens to ensure 7-day seamless login across reloads & devices

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
          localStorage.removeItem('auth-storage')
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
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
      // Persist session tokens and user state to keep user logged in for 7 full days
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
