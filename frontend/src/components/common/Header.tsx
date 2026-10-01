// Application header with logo, user info and logout
// Shown on all authenticated pages

import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { LogOut, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'

export function Header() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logoutApi()
    } catch (error) {
      console.error('Logout API error:', error)
    }
    clearAuth()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Video className="h-6 w-6 text-blue-600" />
          <span className="text-xl font-bold text-gray-800">IntelliMeet</span>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-gray-600">
                Hi, {user.name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}