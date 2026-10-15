// Confirmation modal shown to Host when clicking the End button
// Prevents accidental meeting termination and finalizes recording if active

import { XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EndMeetingConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  meetingTitle?: string;
  isRecordingActive?: boolean;
}

export function EndMeetingConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  meetingTitle,
  isRecordingActive = false,
}: EndMeetingConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-[#1e2022] border border-red-500/30 rounded-2xl shadow-2xl text-white overflow-hidden p-6 space-y-5">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-wider">
              Host Action
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              End Meeting for Everyone?
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed truncate max-w-xs">
              {meetingTitle ? `"${meetingTitle}"` : "Active Meeting"}
            </p>
          </div>
        </div>

        {/* Warning & Context Message */}
        <div className="p-3.5 rounded-xl bg-gray-900/90 border border-gray-800 space-y-2 text-xs">
          <p className="text-gray-300 leading-relaxed">
            Are you sure you want to end this meeting? All participants will be disconnected immediately and the meeting will be officially completed.
          </p>
          {isRecordingActive && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span>The active recording will be finalized and saved to Meeting Details.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-1">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="w-full sm:flex-1 h-10 border border-gray-700 bg-gray-800/80 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cancel / Stay
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            className="w-full sm:flex-1 h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-lg shadow-red-950/40 transition cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            End Meeting
          </Button>
        </div>
      </div>
    </div>
  );
}
