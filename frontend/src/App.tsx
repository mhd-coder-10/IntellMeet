import { Routes, Route, Navigate } from 'react-router-dom'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import MeetingList from '@/pages/Meetings/MeetingList'
import CreateMeeting from '@/pages/Meetings/CreateMeeting'
import JoinMeeting from '@/pages/Meetings/JoinMeeting'
import MeetingRoom from '@/pages/Meetings/MeetingRoom'
import MeetingDetails from '@/pages/Meetings/MeetingDetails'
import Profile from '@/pages/Profile'
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute'
import { useCurrentUser } from '@/hooks/useCurrentUser'

function App() {
  useCurrentUser()

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings/profile" element={<Profile />} />
        <Route path="/meetings" element={<MeetingList />} />
        <Route path="/meetings/create" element={<CreateMeeting />} />
        <Route path="/meetings/join" element={<JoinMeeting />} />
        <Route path="/meetings/:id" element={<MeetingRoom />} />
        <Route path="/meetings/:id/details" element={<MeetingDetails />} />
        <Route path="/meetings/details/:id" element={<MeetingDetails />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App