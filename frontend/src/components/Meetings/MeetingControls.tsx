// Bottom control bar with mute, camera, leave and end meeting buttons
// End meeting button only visible to host

import { Mic, MicOff, Video, VideoOff, PhoneOff, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMeetingStore } from '@/store/meetingStore'

interface Props {
  onLeave: () => void
  onEnd?: () => void
  isHost?: boolean
  socket?: any
  meetingId?: string
}

export function MeetingControls({ onLeave, onEnd, isHost = false, socket, meetingId }: Props) {
  const {
    localStream,
    isMuted,
    isVideoOn,
    setIsMuted,
    setIsVideoOn,
  } = useMeetingStore()

  const toggleMute = () => {
    if (!localStream) return
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = isMuted
      setIsMuted(!isMuted)

      socket?.emit('meeting:media-state', {
        meetingId,
        isMuted: !isMuted,
        isVideoOn,
      })
    }
  }

  const toggleVideo = () => {
    if (!localStream) return
    const videoTrack = localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !isVideoOn
      setIsVideoOn(!isVideoOn)

      socket?.emit('meeting:media-state', {
        meetingId,
        isMuted,
        isVideoOn: !isVideoOn,
      })
    }
  }

  return (
    <div className="flex items-center justify-center gap-3 py-4">
      <Button
        variant={isMuted ? 'destructive' : 'secondary'}
        size="lg"
        onClick={toggleMute}
        className="rounded-full h-12 w-12 p-0"
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>

      <Button
        variant={!isVideoOn ? 'destructive' : 'secondary'}
        size="lg"
        onClick={toggleVideo}
        className="rounded-full h-12 w-12 p-0"
      >
        {isVideoOn ? (
          <Video className="h-5 w-5" />
        ) : (
          <VideoOff className="h-5 w-5" />
        )}
      </Button>

      {isHost && onEnd && (
        <Button
          variant="destructive"
          size="lg"
          onClick={onEnd}
          className="rounded-full px-6 h-12 gap-2"
        >
          <XCircle className="h-5 w-5" />
          End Meeting
        </Button>
      )}

      <Button
        variant={isHost ? 'secondary' : 'destructive'}
        size="lg"
        onClick={onLeave}
        className={isHost ? 'rounded-full px-6 h-12 gap-2' : 'rounded-full h-12 w-12 p-0'}
      >
        <PhoneOff className="h-5 w-5" />
        {isHost && <span>Leave</span>}
      </Button>
    </div>
  )
}