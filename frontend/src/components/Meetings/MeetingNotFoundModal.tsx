// Modal displayed when user clicks to view a meeting that was removed or host-deleted
// Preserves historical analytics while clearly informing the user that the live session details are no longer accessible

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeetingNotFoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingTitle?: string;
}

export function MeetingNotFoundModal({
  isOpen,
  onClose,
  meetingTitle,
}: MeetingNotFoundModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl text-slate-900 overflow-hidden p-6 space-y-4">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
            <AlertCircle className="w-6 h-6 text-amber-500" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
              Notice
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Meeting Not Found
            </h3>
            {meetingTitle && (
              <p className="text-xs text-slate-500 truncate max-w-xs font-medium">
                "{meetingTitle}"
              </p>
            )}
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
          This meeting has been removed from your dashboard or was deleted by the host. Its historical attendance and participation records remain preserved in your analytics.
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-1">
          <Button
            onClick={onClose}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold px-5 h-9 cursor-pointer"
          >
            Understood
          </Button>
        </div>
      </div>
    </div>
  );
}
