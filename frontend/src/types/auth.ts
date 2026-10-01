// Defines authentication related TypeScript types
// Used across services, stores and components

export interface User {
  id: string
  name: string
  username: string
  email: string
  role: 'admin' | 'member'
  profilePicture?: string
  bio?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}