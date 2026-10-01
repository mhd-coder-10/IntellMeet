import { Routes, Route, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-2xl text-center max-w-md">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          IntelliMeet
        </h1>
        <p className="text-gray-600 mb-6">
          AI-Powered Enterprise Meeting & Collaboration Platform
        </p>
        <Button>Get Started</Button>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App