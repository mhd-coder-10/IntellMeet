// Allows user to join a meeting by entering meeting code
// Fetches meeting, joins it and navigates to room

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'
import { Header } from '@/components/common/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getMeetingByCode, joinMeeting } from '@/services/meetingService'
import { getErrorMessage } from '@/utils/errorHelper'

export default function JoinMeeting() {
    const [code, setCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const navigate = useNavigate()

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!code.trim()) return

        setIsLoading(true)
        try {
            const meeting = await getMeetingByCode(code.trim().toUpperCase())
            await joinMeeting(meeting._id)
            toast.success('Joined meeting successfully')
            navigate(`/meetings/${meeting._id}`)
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="container mx-auto px-4 py-8 max-w-md">
                <Card>
                    <CardHeader>
                        <CardTitle>Join Meeting</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleJoin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Meeting Code</Label>
                                <Input
                                    id="code"
                                    placeholder="ABC12345"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    className="font-mono tracking-wider text-center text-lg"
                                    maxLength={8}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="mr-2 h-4 w-4" />
                                )}
                                {isLoading ? 'Joining...' : 'Join Meeting'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}