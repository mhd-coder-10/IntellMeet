import { Navigate } from 'react-router-dom'
import { RegisterForm } from '@/components/Auth/RegisterForm'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import { Video } from 'lucide-react'

export default function Register() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 antialiased selection:bg-blue-100">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
                    <Video className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                        Intelli<span className="text-blue-600">Meet</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                        Enterprise Video Collaboration
                    </span>
                </div>
            </div>

            <Card className="w-full max-w-md border-slate-200/90 bg-white text-slate-900 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="text-center pb-4 pt-6 px-6 sm:px-8 border-b border-slate-100 bg-slate-50/70">
                    <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">Create Account</CardTitle>
                    <CardDescription className="text-xs text-slate-600 mt-1">
                        Join IntelliMeet to start collaborating with your team
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 sm:p-8">
                    <RegisterForm />
                </CardContent>
            </Card>
        </div>
    )
}