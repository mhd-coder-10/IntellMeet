// Handles meeting recording using MediaRecorder API
// Records live tracks only and downloads as a webm file

// import { useRef, useState, useCallback } from "react";

// export function useRecording() {
//     const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//     const chunksRef = useRef<Blob[]>([]);
//     const [isRecording, setIsRecording] = useState(false);
//     const [recordingTime, setRecordingTime] = useState(0);
//     const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

//     // Start recording the given stream
//     const startRecording = useCallback(
//         (stream: MediaStream) => {
//             if (isRecording || !stream) return;

//             // Only keep tracks that are actually live
//             const liveVideo = stream
//                 .getVideoTracks()
//                 .filter((t) => t.readyState === "live");
//             const liveAudio = stream
//                 .getAudioTracks()
//                 .filter((t) => t.readyState === "live");

//             if (liveVideo.length === 0 && liveAudio.length === 0) {
//                 console.error("No live tracks to record");
//                 throw new Error("No active media to record");
//             }

//             // Build a clean stream from live tracks only
//             const recordStream = new MediaStream();
//             liveVideo.forEach((t) => recordStream.addTrack(t));
//             liveAudio.forEach((t) => recordStream.addTrack(t));

//             // Pick a supported mime type that includes video codec
//             const mimeTypes = [
//                 "video/webm;codecs=vp9,opus",
//                 "video/webm;codecs=vp8,opus",
//                 "video/webm;codecs=vp8",
//                 "video/webm",
//             ];

//             let mimeType = "";
//             for (const type of mimeTypes) {
//                 if (MediaRecorder.isTypeSupported(type)) {
//                     mimeType = type;
//                     break;
//                 }
//             }

//             if (!mimeType) {
//                 throw new Error("No supported recording format found");
//             }

//             try {
//                 chunksRef.current = [];

//                 const recorder = new MediaRecorder(recordStream, { mimeType });

//                 recorder.ondataavailable = (e) => {
//                     if (e.data && e.data.size > 0) {
//                         chunksRef.current.push(e.data);
//                     }
//                 };

//                 recorder.onstop = () => {
//                     if (chunksRef.current.length === 0) {
//                         console.error("No data was recorded");
//                         return;
//                     }

//                     const blob = new Blob(chunksRef.current, { type: "video/webm" });
//                     const url = URL.createObjectURL(blob);

//                     const a = document.createElement("a");
//                     a.href = url;
//                     a.download = `intellimeet-recording-${Date.now()}.webm`;
//                     document.body.appendChild(a);
//                     a.click();
//                     document.body.removeChild(a);

//                     URL.revokeObjectURL(url);
//                 };

//                 // Request chunks every 1 second
//                 recorder.start(1000);
//                 mediaRecorderRef.current = recorder;
//                 setIsRecording(true);
//                 setRecordingTime(0);

//                 timerRef.current = setInterval(() => {
//                     setRecordingTime((prev) => prev + 1);
//                 }, 1000);
//             } catch (error) {
//                 console.error("Failed to start recording:", error);
//                 throw error;
//             }
//         },
//         [isRecording]
//     );

//     // Stop recording and download the file
//     const stopRecording = useCallback(() => {
//         if (mediaRecorderRef.current && isRecording) {
//             mediaRecorderRef.current.stop();
//             mediaRecorderRef.current = null;
//             setIsRecording(false);

//             if (timerRef.current) {
//                 clearInterval(timerRef.current);
//                 timerRef.current = null;
//             }
//             setRecordingTime(0);
//         }
//     }, [isRecording]);

//     return {
//         isRecording,
//         recordingTime,
//         startRecording,
//         stopRecording,
//     };
// }


// Handles meeting recording using MediaRecorder API
// Records live audio and video tracks from a stream

import { useRef, useState, useCallback } from "react";

export function useRecording() {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Start recording the given stream
    const startRecording = useCallback(
        (stream: MediaStream) => {
            if (isRecording || !stream) return;

            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();

            // Debug logs to verify what's being recorded
            console.log("=== RECORDING START ===");
            console.log("Video tracks:", videoTracks.length);
            console.log("Audio tracks:", audioTracks.length);
            console.log(
                "Video states:",
                videoTracks.map((t) => ({ ready: t.readyState, enabled: t.enabled }))
            );
            console.log(
                "Audio states:",
                audioTracks.map((t) => ({ ready: t.readyState, enabled: t.enabled }))
            );

            if (videoTracks.length === 0 && audioTracks.length === 0) {
                throw new Error("No media tracks available");
            }

            // Build a fresh stream with cloned tracks for MediaRecorder
            // Cloning ensures MediaRecorder gets its own track instances
            const recordStream = new MediaStream();

            videoTracks.forEach((track) => {
                if (track.readyState === "live") {
                    // Ensure track is enabled before recording
                    track.enabled = true;
                    recordStream.addTrack(track.clone());
                }
            });

            audioTracks.forEach((track) => {
                if (track.readyState === "live") {
                    // Ensure audio track is enabled before recording
                    track.enabled = true;
                    recordStream.addTrack(track.clone());
                }
            });

            if (recordStream.getTracks().length === 0) {
                throw new Error("No live tracks to record");
            }

            console.log(
                "Record stream tracks:",
                recordStream.getTracks().map((t) => t.kind)
            );

            try {
                chunksRef.current = [];

                // Don't specify mimeType — let browser choose best supported
                const recorder = new MediaRecorder(recordStream);

                console.log("MediaRecorder mimeType:", recorder.mimeType);

                recorder.ondataavailable = (e) => {
                    console.log("Chunk received, size:", e.data.size);
                    if (e.data && e.data.size > 0) {
                        chunksRef.current.push(e.data);
                    }
                };

                recorder.onerror = (event) => {
                    console.error("MediaRecorder error:", event);
                };

                recorder.onstop = () => {
                    console.log("Recording stopped, chunks:", chunksRef.current.length);

                    if (chunksRef.current.length === 0) {
                        console.error("No data was recorded");
                        return;
                    }

                    const blob = new Blob(chunksRef.current, { type: "video/webm" });
                    console.log("Final blob size:", blob.size);
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `intellimeet-recording-${Date.now()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    URL.revokeObjectURL(url);
                };

                // Collect chunks every 1 second
                recorder.start(1000);
                mediaRecorderRef.current = recorder;
                setIsRecording(true);
                setRecordingTime(0);

                timerRef.current = setInterval(() => {
                    setRecordingTime((prev) => prev + 1);
                }, 1000);
            } catch (error) {
                console.error("Failed to start recording:", error);
                throw error;
            }
        },
        [isRecording]
    );

    // Stop recording and download the file
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
            setIsRecording(false);

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setRecordingTime(0);
        }
    }, [isRecording]);

    return {
        isRecording,
        recordingTime,
        startRecording,
        stopRecording,
    };
}