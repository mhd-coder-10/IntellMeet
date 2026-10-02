// Form to create a new meeting
// Uses React Hook Form + Zod and redirects on success


import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Header } from '@/components/common/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createMeeting } from '@/services/meetingService'
import { getErrorMessage } from '@/utils/errorHelper'

const schema = z.object({
    title: z.string().min(2, 'Title must be at least 2 characters'),
    description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function CreateMeeting() {
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();


    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<FormData>({ resolver: zodResolver(schema) })

    const onSubmit = async (data: FormData) => {
        setIsLoading(true)
        try {
            const meeting = await createMeeting(data);
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
            toast.success('Meeting created successfully');
            navigate(`/meetings/${meeting._id}`);
        } catch (error) {
            toast.error(getErrorMessage(error))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="container mx-auto px-4 py-8 max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>Create New Meeting</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Meeting Title</Label>
                                <Input
                                    id="title"
                                    placeholder="Team Standup"
                                    {...register('title')}
                                />
                                {errors.title && (
                                    <p className="text-sm text-red-500">{errors.title.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Input
                                    id="description"
                                    placeholder="Daily team sync"
                                    {...register('description')}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isLoading ? 'Creating...' : 'Create Meeting'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}