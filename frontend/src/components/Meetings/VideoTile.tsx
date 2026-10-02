// Displays a single video stream tile
// Shows local or remote participant video

import { useEffect, useRef } from 'react'
import { MicOff, VideoOff } from 'lucide-react'

interface Props {
    stream: MediaStream | null
    name: string
    isMuted?: boolean
    isVideoOn?: boolean
    isLocal?: boolean
}

export function VideoTile({
    stream,
    name,
    isMuted = false,
    isVideoOn = true,
    isLocal = false,
}: Props) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
        }
    }, [stream, isVideoOn]);

    return (
        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            {isVideoOn && stream ? (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <div className="text-center">
                        <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold mx-auto">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                <span>{isLocal ? `${name} (You)` : name}</span>
                {isMuted && <MicOff className="h-3 w-3 text-red-400" />}
                {!isVideoOn && <VideoOff className="h-3 w-3 text-red-400" />}
            </div>
        </div>
    )
}