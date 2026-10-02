// Dashboard page shown after successful login
// Placeholder for future features like meetings and chat

import { Link } from 'react-router-dom'
import { Video, Plus, Search } from 'lucide-react'
import { Header } from '@/components/common/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-gray-600">
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Username:</strong> @{user?.username}</p>
            <p><strong>Role:</strong> {user?.role}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/meetings/create">
            <Card className="hover:shadow-lg transition cursor-pointer">
              <CardContent className="p-6 text-center">
                <Plus className="h-10 w-10 mx-auto mb-3 text-blue-600" />
                <h3 className="font-semibold">Create Meeting</h3>
                <p className="text-sm text-gray-600">Start a new video call</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/meetings/join">
            <Card className="hover:shadow-lg transition cursor-pointer">
              <CardContent className="p-6 text-center">
                <Search className="h-10 w-10 mx-auto mb-3 text-green-600" />
                <h3 className="font-semibold">Join Meeting</h3>
                <p className="text-sm text-gray-600">Enter a meeting code</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/meetings">
            <Card className="hover:shadow-lg transition cursor-pointer">
              <CardContent className="p-6 text-center">
                <Video className="h-10 w-10 mx-auto mb-3 text-purple-600" />
                <h3 className="font-semibold">My Meetings</h3>
                <p className="text-sm text-gray-600">View all meetings</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  )
}