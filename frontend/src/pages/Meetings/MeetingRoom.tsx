
// Main video call room with WebRTC integration
// Shows local and remote videos, controls and participant count

import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Users, Loader2 } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useMeetingStore } from '@/store/meetingStore';
import { useAuthStore } from '@/store/authStore';
import {
  getMeetingById,
  joinMeeting,
  leaveMeeting,
  endMeeting,
} from '@/services/meetingService';
import { VideoTile } from '@/components/Meetings/VideoTile';
import { MeetingControls } from '@/components/Meetings/MeetingControls';

export default function MeetingRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { socket, isConnected } = useSocket();
  const user = useAuthStore((state) => state.user);

  const {
    localStream,
    peers,
    isMuted,
    isVideoOn,
    setCurrentMeetingId,
    resetMeeting,
  } = useMeetingStore();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => getMeetingById(id!),
    enabled: !!id,
  });

  const isHost = meeting?.host._id === user?.id;

  const { startLocalStream, stopLocalStream, closeAllPeers } = useWebRTC(
    socket,
    id || null
  );

  // Set current meeting id and call join API
  useEffect(() => {
    if (!id) return;
    setCurrentMeetingId(id);
    joinMeeting(id).catch(() => { });
  }, [id, setCurrentMeetingId]);

  // Emit socket join and initial media state
  useEffect(() => {
    if (!socket || !isConnected || !id) return;

    socket.emit('meeting:join', { meetingId: id });

    // Send our initial media state after 1 second
    const timer = setTimeout(() => {
      const { isMuted, isVideoOn } = useMeetingStore.getState();
      socket.emit('meeting:media-state', {
        meetingId: id,
        isMuted,
        isVideoOn,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [socket, isConnected, id]);

  // Start local camera and microphone
  useEffect(() => {
    if (socket && isConnected && id) {
      startLocalStream().catch(() => {
        toast.error('Failed to access camera and microphone');
      });
    }
  }, [socket, isConnected, id, startLocalStream]);

  // Listen for host ending the meeting
  useEffect(() => {
    if (!socket) return;

    const handleMeetingEnded = async (data: {
      meetingId: string;
      message: string;
    }) => {
      if (data.meetingId === id) {
        toast.error(data.message || 'Meeting has been ended by the host');
        stopLocalStream();
        closeAllPeers();
        resetMeeting();
        await queryClient.invalidateQueries({ queryKey: ['meetings'] });
        navigate('/meetings');
      }
    };

    socket.on('meeting:ended', handleMeetingEnded);

    return () => {
      socket.off('meeting:ended', handleMeetingEnded);
    };
  }, [
    socket,
    id,
    stopLocalStream,
    closeAllPeers,
    resetMeeting,
    navigate,
    queryClient,
  ]);

  const handleLeave = async () => {
    if (id) {
      try {
        socket?.emit('meeting:leave', { meetingId: id });
        await leaveMeeting(id);
      } catch (err) {
        console.error('Leave error:', err);
      }
    }

    stopLocalStream();
    closeAllPeers();
    resetMeeting();

    // Refresh meetings list so it appears immediately
    await queryClient.invalidateQueries({ queryKey: ['meetings'] });
    navigate('/meetings');
  };

  const handleEndMeeting = async () => {
    if (!id) return;

    try {
      socket?.emit('meeting:leave', { meetingId: id });
      await endMeeting(id);
      toast.success('Meeting ended');
    } catch (err) {
      console.error('End meeting error:', err);
      toast.error('Failed to end meeting');
    }

    stopLocalStream();
    closeAllPeers();
    resetMeeting();

    // Refresh meetings list so host sees updated status
    await queryClient.invalidateQueries({ queryKey: ['meetings'] });
    navigate('/meetings');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="border-b border-gray-800 px-6 py-3 flex items-center justify-between text-white">
        <h1 className="text-lg font-semibold">{meeting?.title}</h1>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Users className="h-4 w-4" />
          <span>{peers.length + 1} in meeting</span>
          <span className="ml-2 text-xs font-mono bg-gray-800 px-2 py-1 rounded">
            {meeting?.meetingCode}
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <VideoTile
            stream={localStream}
            name={user?.name || 'You'}
            isMuted={isMuted}
            isVideoOn={isVideoOn}
            isLocal
          />

          {peers.map((peer) => (
            <VideoTile
              key={peer.userId}
              stream={peer.stream || null}
              name={peer.name}
              isMuted={peer.isMuted}
              isVideoOn={peer.isVideoOn}
            />
          ))}
        </div>

        {peers.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p>Waiting for others to join...</p>
            <p className="text-sm mt-2">
              Share meeting code:{' '}
              <span className="font-mono font-bold">
                {meeting?.meetingCode}
              </span>
            </p>
          </div>
        )}
      </div>

      <MeetingControls
        onLeave={handleLeave}
        onEnd={handleEndMeeting}
        isHost={isHost}
        socket={socket}
        meetingId={id}
      />
    </div>
  );
}