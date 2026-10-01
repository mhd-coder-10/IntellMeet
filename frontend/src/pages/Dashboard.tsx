// Dashboard page shown after successful login
// Placeholder for future features like meetings and chat

import { Header } from '@/components/common/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {user?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600">
              <strong>Email:</strong> {user?.email}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Username:</strong> @{user?.username}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Role:</strong> {user?.role}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}