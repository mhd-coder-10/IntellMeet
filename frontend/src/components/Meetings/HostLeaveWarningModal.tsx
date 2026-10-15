// Modal shown to Host when clicking Leave while recording is active or pending
// Prevents accidental disconnection and gives choice to End & Save or Stop & Leave

import { AlertTriangle, XCircle, PhoneOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HostLeaveWarningModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onEndMeeting: () => void;
  onLeaveOnly: () => void;
  meetingTitle?: string;
  isRecordingActive?: boolean;
}

export function HostLeaveWarningModal({
  isOpen,
  onCancel,
  onEndMeeting,
  onLeaveOnly,
  meetingTitle,
  isRecordingActive = true,
}: HostLeaveWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-[#1e2022] border border-amber-500/30 rounded-2xl shadow-2xl text-white overflow-hidden p-6 space-y-5">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
              Host Action Required
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {isRecordingActive ? "Recording in Progress" : "Pending Recording"}
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed truncate max-w-xs">
              {meetingTitle ? `"${meetingTitle}"` : "Meeting in progress"}
            </p>
          </div>
        </div>

        {/* Warning & Context Message */}
        <div className="p-3.5 rounded-xl bg-gray-900/90 border border-gray-800 space-y-2 text-xs">
          <p className="text-gray-300 leading-relaxed">
            You are the meeting host and recording is active on your session. If you leave now, the recording will stop.
          </p>
          <p className="text-gray-400 leading-relaxed">
            Please choose how you would like to proceed:
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* Option 1: End Meeting & Save (Recommended) */}
          <Button
            type="button"
            onClick={onEndMeeting}
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold gap-2 shadow-lg shadow-red-950/40 transition-all justify-start px-4"
          >
            <XCircle className="w-4 h-4 shrink-0" />
            <div className="text-left flex-1 truncate">
              <span className="font-bold">End Meeting for Everyone & Save</span>
              <span className="text-[10px] block text-red-200/80 font-normal">
                Concludes meeting and finalizes recording
              </span>
            </div>
          </Button>

          {/* Option 2: Stop Recording & Leave */}
          <Button
            type="button"
            onClick={onLeaveOnly}
            variant="outline"
            className="w-full h-11 bg-gray-800/80 hover:bg-gray-700 border-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold gap-2 transition-all justify-start px-4"
          >
            <PhoneOff className="w-4 h-4 shrink-0 text-amber-400" />
            <div className="text-left flex-1 truncate">
              <span className="font-bold">Stop Recording & Leave Meeting</span>
              <span className="text-[10px] block text-gray-400 font-normal">
                Saves current recording; other members remain in meeting
              </span>
            </div>
          </Button>

          {/* Option 3: Cancel / Stay in Meeting */}
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="w-full h-9 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-xl text-xs font-medium gap-1.5 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Stay in Meeting
          </Button>
        </div>
      </div>
    </div>
  );
}
