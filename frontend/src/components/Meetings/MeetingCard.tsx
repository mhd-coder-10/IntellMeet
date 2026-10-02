
// Displays a single meeting as a card
// Shows delete for host (completed only) and remove for members

import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { Calendar, Users, Video, Trash2, X, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { deleteMeeting, hideMeeting } from '@/services/meetingService';
import { getErrorMessage } from '@/utils/errorHelper';
import type { Meeting } from '@/types/meeting';

interface Props {
    meeting: Meeting;
}

const statusColors = {
    scheduled: 'bg-blue-100 text-blue-700',
    ongoing: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
};

export function MeetingCard({ meeting }: Props) {
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();
    const currentUser = useAuthStore((state) => state.user);

    const isHost = meeting.host._id === currentUser?.id;

    // Delete only for host on completed/cancelled meetings
    const canDelete =
        isHost && (meeting.status === 'completed' || meeting.status === 'cancelled');

    // Join only for active meetings
    const canJoin =
        meeting.status !== 'completed' && meeting.status !== 'cancelled';

    // Hide option only for non-host users
    const canHide = !isHost;

    const participantCount = meeting.participants.length + 1;

    const handleDelete = async () => {
        if (!confirm('Delete this meeting permanently? This cannot be undone.')) {
            return;
        }

        setIsLoading(true);
        try {
            await deleteMeeting(meeting._id);
            toast.success('Meeting deleted');
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleHide = async () => {
        setIsLoading(true);
        try {
            await hideMeeting(meeting._id);
            toast.success('Removed from your list');
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{meeting.title}</CardTitle>
                    <span
                        className={`text-xs px-2 py-1 rounded-full ${statusColors[meeting.status]}`}
                    >
                        {meeting.status}
                    </span>
                </div>
                {meeting.description && (
                    <p className="text-sm text-gray-600">{meeting.description}</p>
                )}
            </CardHeader>

            <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{participantCount} participant(s)</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(meeting.scheduledAt).toLocaleString()}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {meeting.meetingCode}
                    </span>
                </div>

                <div className="flex gap-2">
                    {canJoin && (
                        <Link to={`/meetings/${meeting._id}`} className="flex-1">
                            <Button className="w-full">
                                <Video className="h-4 w-4 mr-2" />
                                {meeting.status === 'ongoing' ? 'Join Now' : 'Start'}
                            </Button>
                        </Link>
                    )}

                    {canDelete && (
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            {isLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    )}

                    {canHide && (
                        <Button
                            variant="outline"
                            onClick={handleHide}
                            disabled={isLoading}
                            className={canJoin ? '' : 'flex-1'}
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <X className="h-4 w-4 mr-2" />
                                    Remove
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}