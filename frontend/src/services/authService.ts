// Handles all authentication API calls
// Uses the centralized axios instance with JWT interceptor

import api from './api'

import type {
  LoginPayload,
  RegisterPayload,
  AuthResponse,
  User,
} from '@/types/auth'

export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  const response = await api.post('/auth/login', payload)
  return response.data.data
}

export const signup = async (
  payload: RegisterPayload
): Promise<AuthResponse> => {
  const response = await api.post('/auth/signup', payload)
  return response.data.data
}

export const logout = async (): Promise<void> => {
  await api.post('/auth/logout')
}

export const getMe = async (): Promise<User> => {
  const response = await api.get('/auth/me')
  return response.data.data.user
}