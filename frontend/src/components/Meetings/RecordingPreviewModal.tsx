import { useEffect, useState } from "react";
import {
  Download,
  CheckCircle2,
  X,
  Clock,
  HardDrive,
  Calendar,
  CloudUpload,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadMeetingRecording } from "@/services/meetingService";
import type { RecordedResult } from "@/hooks/useCompositeRecording";

interface RecordingPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: RecordedResult | null;
  onDownload: () => void;
  meetingTitle?: string;
  meetingId?: string;
}

const formatSeconds = (sec: number) => {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export function RecordingPreviewModal({
  isOpen,
  onClose,
  result,
  onDownload,
  meetingTitle,
  meetingId,
}: RecordingPreviewModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSavedCloud, setIsSavedCloud] = useState(false);

  // Automatically upload recording to meeting backend so participants can access on Details page
  useEffect(() => {
    if (!isOpen || !result || !meetingId || isSavedCloud || isUploading) return;

    let cancelled = false;
    const saveToMeeting = async () => {
      setIsUploading(true);
      try {
        await uploadMeetingRecording(meetingId, result.blob);
        if (!cancelled) {
          setIsSavedCloud(true);
          toast.success("Recording saved to Meeting Details!");
        }
      } catch (err) {
        console.warn("Auto-upload recording warning:", err);
      } finally {
        if (!cancelled) setIsUploading(false);
      }
    };

    saveToMeeting();
    return () => {
      cancelled = true;
    };
  }, [isOpen, result, meetingId]);

  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#1e2022] border border-gray-700/70 rounded-2xl shadow-2xl text-white overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Recording Captured</h2>
                {isSavedCloud && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                    Cloud Synced
                  </span>
                )}
                {isUploading && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving...
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {meetingTitle ? `"${meetingTitle}"` : "Meeting Recording"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-gray-800 shadow-inner flex items-center justify-center">
            <video
              src={result.url}
              controls
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          {/* Details Bar */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-gray-900/60 rounded-xl border border-gray-800/80 text-xs">
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Duration: <strong>{formatSeconds(result.duration)}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>Size: <strong>{formatBytes(result.size)}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Format: <strong>{result.formatLabel || (result.filename.endsWith(".mp4") ? "MP4 (H.264 / AAC)" : "WebM")}</strong></span>
            </div>
          </div>

          {/* Cloud Sync Status Note */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-800/40 border border-gray-700/50 text-xs text-gray-300">
            <span className="flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-blue-400" />
              <span>
                {isSavedCloud
                  ? "Recording is now available to all participants in Meeting Details."
                  : isUploading
                  ? "Syncing recording with meeting details in the cloud..."
                  : "Recording will be viewable on the Meeting Details page."}
              </span>
            </span>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-[#17191b]">
          <span className="text-xs text-gray-400 truncate max-w-xs">
            {result.filename}
          </span>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg text-sm"
            >
              Close
            </Button>
            <Button
              onClick={onDownload}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 flex items-center gap-2 shadow-lg shadow-blue-900/30 text-sm"
            >
              <Download className="w-4 h-4" />
              Download Video
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
