import {
  ShieldAlert,
  Radio,
  Users,
  Monitor,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  meetingTitle?: string;
}

export function RecordConsentModal({
  isOpen,
  onClose,
  onConfirm,
  meetingTitle,
}: RecordConsentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#202124] border border-gray-700/60 rounded-2xl shadow-2xl text-white overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center text-red-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Record meeting?</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {meetingTitle ? `"${meetingTitle}"` : "IntelliMeet Session"}
            </p>
          </div>
        </div>

        {/* Content info */}
        <div className="space-y-3.5 text-sm text-gray-300">
          <p className="leading-relaxed">
            Recording will capture member webcams, active screens, and mixed audio in high quality.
          </p>

          <div className="grid grid-cols-3 gap-2.5 py-2">
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gray-800/60 border border-gray-700/40 text-center">
              <Users className="w-4 h-4 text-blue-400 mb-1" />
              <span className="text-[11px] text-gray-300">Member Grid</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gray-800/60 border border-gray-700/40 text-center">
              <Monitor className="w-4 h-4 text-emerald-400 mb-1" />
              <span className="text-[11px] text-gray-300">Screen Shares</span>
            </div>
            <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gray-800/60 border border-gray-700/40 text-center">
              <Volume2 className="w-4 h-4 text-amber-400 mb-1" />
              <span className="text-[11px] text-gray-300">Mixed Audio</span>
            </div>
          </div>

          {/* Google Meet style consent alert */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300">Consent reminder: </span>
              Recording without the consent of all attendees may violate privacy regulations.
              Please ensure all members agree to being recorded.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg px-5 flex items-center gap-2 shadow-lg shadow-red-900/30"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            Start recording
          </Button>
        </div>
      </div>
    </div>
  );
}
