import { CheckCircle2, Play, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordStopConfirmModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onDone: () => void;
  recordingTime: number;
  meetingTitle?: string;
  isSaving?: boolean;
}

const formatSeconds = (sec: number) => {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export function RecordStopConfirmModal({
  isOpen,
  onContinue,
  onDone,
  recordingTime,
  meetingTitle,
  isSaving = false,
}: RecordStopConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-md bg-[#1e2022] border border-gray-700/80 rounded-2xl shadow-2xl text-white overflow-hidden p-6 space-y-5">
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Save Meeting Recording?
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              {meetingTitle ? `"${meetingTitle}"` : "Meeting in progress"}
            </p>
          </div>
        </div>

        {/* Live Timer Pill */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-900/80 border border-gray-800 text-xs">
          <div className="flex items-center gap-2 text-gray-300">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="font-medium text-gray-200">Captured so far:</span>
          </div>
          <span className="font-mono text-sm font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
            {formatSeconds(recordingTime)}
          </span>
        </div>

        {/* Informative Explanation */}
        <p className="text-xs text-gray-300 leading-relaxed bg-gray-800/40 p-3 rounded-xl border border-gray-700/50">
          The meeting is still active. If you select <strong>Done</strong>, the recording captured up to this point will be saved immediately to the Meeting Details page. You can still continue the meeting and start another recording later. Or choose <strong>Continue</strong> to keep recording uninterrupted.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          {/* Continue button */}
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onContinue}
            className="w-full sm:flex-1 h-10 border-gray-700 bg-gray-800/80 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-semibold gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
            Continue Recording
          </Button>

          {/* Done & Save button */}
          <Button
            type="button"
            disabled={isSaving}
            onClick={onDone}
            className="w-full sm:flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-md shadow-blue-900/30 transition"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" />
                Done (Save Now)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
