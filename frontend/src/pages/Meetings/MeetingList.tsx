
// Lists all meetings of the logged in user
// Auto-refetches on socket events and every 30 seconds

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Header } from '@/components/common/Header';
import { Button } from '@/components/ui/button';
import { MeetingCard } from '@/components/Meetings/MeetingCard';
import { getMyMeetings } from '@/services/meetingService';
import { useSocket } from '@/hooks/useSocket';

export default function MeetingList() {
    const queryClient = useQueryClient();
    const { socket } = useSocket();

    const { data: meetings, isLoading } = useQuery({
        queryKey: ['meetings'],
        queryFn: getMyMeetings,
        staleTime: 0,
        refetchOnMount: true,
        // Auto-refetch every 30 seconds to remove expired meetings
        refetchInterval: 30 * 1000,
    });

    // Listen for socket events and refresh list
    useEffect(() => {
        if (!socket) return;

        const invalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
        };

        socket.on('meeting:user-joined', invalidate);
        socket.on('meeting:user-left', invalidate);
        socket.on('meeting:ended', invalidate);

        return () => {
            socket.off('meeting:user-joined', invalidate);
            socket.off('meeting:user-left', invalidate);
            socket.off('meeting:ended', invalidate);
        };
    }, [socket, queryClient]);

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">My Meetings</h1>
                    <Link to="/meetings/create">
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            New Meeting
                        </Button>
                    </Link>
                </div>

                {isLoading && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                )}

                {!isLoading && meetings && meetings.length === 0 && (
                    <div className="text-center py-10">
                        <p className="text-gray-600 mb-4">No meetings yet</p>
                        <Link to="/meetings/create">
                            <Button>Create your first meeting</Button>
                        </Link>
                    </div>
                )}

                {!isLoading && meetings && meetings.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {meetings.map((meeting) => (
                            <MeetingCard key={meeting._id} meeting={meeting} />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}