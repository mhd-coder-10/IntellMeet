// Enterprise Meeting Card component
// Displays meeting status (Upcoming / Live / Completed), workspace & project badges,
// real-time countdown, conditional join button, and lifecycle actions without meeting codes

import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  Video,
  Trash2,
  X,
  Loader2,
  Info,
  Clock,
  Briefcase,
  Layers,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { deleteMeeting, hideMeeting } from "@/services/meetingService";
import { getErrorMessage } from "@/utils/errorHelper";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import type { Meeting } from "@/types/meeting";

interface Props {
  meeting: Meeting;
}

// Calculate countdown string (e.g. "Starts in 2h 15m")
const getCountdownText = (targetMs: number, currentMs: number) => {
  const diff = targetMs - currentMs;
  if (diff <= 0) return "Starting now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Starts in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `Starts in ${hours}h ${minutes}m`;
  }
  return `Starts in ${Math.max(1, minutes)}m`;
};

export function MeetingCard({ meeting }: Props) {
  const [now, setNow] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isHideConfirmOpen, setIsHideConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  // Auto-tick every 10 seconds so Join button enables automatically when time arrives
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const isHost = meeting.host?._id === currentUser?.id;
  const startMs = new Date(meeting.startTime || meeting.scheduledAt).getTime();
  const isFuture = now < startMs;
  const isCancelled = meeting.status === "cancelled";
  const isExpired = meeting.status === "expired";
  const isCompleted = (meeting.status === "completed" || (Boolean(meeting.endedAt) && !isCancelled && !isExpired)) && !isCancelled && !isExpired;
  const isLive = !isCompleted && !isCancelled && !isExpired && !isFuture;

  // Delete only for host on completed/cancelled/expired meetings
  const canDelete = isHost && (isCompleted || isCancelled || isExpired);

  // Hide/Remove option only for non-host users on completed/cancelled/expired meetings
  const canHide = !isHost && (isCompleted || isCancelled || isExpired);

  const participantCount = (meeting.participants?.length || 0) + 1;

  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      await deleteMeeting(meeting._id);
      toast.success("Meeting deleted");
      setIsDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const confirmHide = async () => {
    setIsLoading(true);
    try {
      await hideMeeting(meeting._id);
      toast.success("Removed from your list");
      setIsHideConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const formattedStartTime = new Date(meeting.startTime || meeting.scheduledAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
      <CardHeader className="p-5 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight line-clamp-1">
                {meeting.title}
              </CardTitle>
              {isHost ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  Host
                </span>
              ) : isCompleted ? (
                meeting.wasAttended ? (
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Present
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200 shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Absent
                  </span>
                )
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                  Invited
                </span>
              )}
            </div>

            {meeting.description && (
              <p className="text-xs text-slate-500 line-clamp-2">
                {meeting.description}
              </p>
            )}
          </div>

          {/* Status States Badge */}
          {isCancelled ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Cancelled
            </span>
          ) : isExpired ? (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Expired
            </span>
          ) : isCompleted ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Completed
            </span>
          ) : isLive ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              LIVE NOW
            </span>
          ) : (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              Upcoming
            </span>
          )}
        </div>

        {/* Workspace & Project tags */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {meeting.workspace && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-100">
              <Briefcase className="w-3 h-3 text-indigo-500" />
              {meeting.workspace.name}
            </span>
          )}
          {meeting.project && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-purple-50/80 text-purple-700 border border-purple-100">
              <Layers className="w-3 h-3 text-purple-500" />
              {meeting.project.name}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Users className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{participantCount} {participantCount === 1 ? "participant" : "participants"}</span>
          </div>

          <div className="flex items-center gap-2 text-slate-700">
            <Calendar className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <span className="truncate">
              {new Date(meeting.startTime || meeting.scheduledAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Schedule Time Window */}
          <div className="flex items-center gap-2 text-slate-700 col-span-2 pt-1 border-t border-slate-200/70">
            <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] text-slate-600 truncate font-medium">
              {formattedStartTime}
              {" — "}
              {meeting.endTime ? new Date(meeting.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Open-ended"}
            </span>
          </div>

          {/* Status Hint / Countdown Banner */}
          {isCancelled ? (
            <div className="col-span-2 pt-1.5 border-t border-rose-200/70 flex items-center justify-between text-[11px] text-rose-700 font-semibold bg-rose-50/70 -mx-3 -mb-3 px-3 py-1.5 rounded-b-xl">
              <span>Cancelled by host</span>
            </div>
          ) : isExpired ? (
            <div className="col-span-2 pt-1.5 border-t border-amber-200/70 flex items-center justify-between text-[11px] text-amber-700 font-semibold bg-amber-50/70 -mx-3 -mb-3 px-3 py-1.5 rounded-b-xl">
              <span>Not conducted (Expired)</span>
            </div>
          ) : !isCompleted && isFuture ? (
            <div className="col-span-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-blue-700 font-semibold bg-blue-50/50 -mx-3 -mb-3 px-3 py-1.5 rounded-b-xl">
              <span>Starts at {formattedStartTime}</span>
              <span className="text-blue-600 font-medium">{getCountdownText(startMs, now)}</span>
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1 w-full min-w-0">
          {/* Details / Summary Button */}
          <Link to={`/meetings/${meeting._id}/details`} className="flex-1 min-w-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 rounded-xl text-xs border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 px-2.5 flex items-center justify-center min-w-0"
            >
              <Info className="h-3.5 w-3.5 mr-1 text-blue-600 shrink-0" />
              <span className="truncate">{isCompleted ? "Summary & Recording" : "Details"}</span>
            </Button>
          </Link>

          {/* Conditional Join Button */}
          {!isCompleted && !isCancelled && !isExpired && (
            <div className="flex-1 min-w-0">
              {isLive ? (
                <Link to={`/meetings/${meeting._id}`} className="w-full block">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs h-9 shadow-xs cursor-pointer px-2.5 flex items-center justify-center min-w-0"
                  >
                    <Video className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <span className="truncate">Join Call (Live)</span>
                  </Button>
                </Link>
              ) : (
                <Button
                  disabled
                  title={`Meeting starts at ${formattedStartTime}`}
                  className="w-full bg-slate-100 text-slate-400 border border-slate-200 font-medium rounded-xl text-xs h-9 cursor-not-allowed opacity-80 px-2.5 flex items-center justify-center min-w-0"
                >
                  <Clock className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
                  <span className="truncate">{getCountdownText(startMs, now)}</span>
                </Button>
              )}
            </div>
          )}

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(true)}
              disabled={isLoading}
              className="h-9 px-3 rounded-xl text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer shrink-0 flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 shrink-0" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1 shrink-0" />
              )}
              <span>Delete</span>
            </Button>
          )}

          {canHide && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHideConfirmOpen(true)}
              disabled={isLoading}
              className="h-9 px-3 rounded-xl text-xs border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 cursor-pointer shrink-0 flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 mr-1 shrink-0" />
              )}
              <span>Remove</span>
            </Button>
          )}
        </div>
      </CardContent>

      {/* Delete Meeting Confirm Modal */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        isLoading={isLoading}
        variant="danger"
        title="Delete Meeting Permanently?"
        description={`Are you sure you want to delete "${meeting.title}"? All recordings, action items, and data will be permanently removed.`}
        confirmText="Delete Meeting"
      />

      {/* Remove Meeting Confirm Modal */}
      <ConfirmModal
        isOpen={isHideConfirmOpen}
        onClose={() => setIsHideConfirmOpen(false)}
        onConfirm={confirmHide}
        isLoading={isLoading}
        variant="warning"
        title="Remove from Dashboard?"
        description={`Remove "${meeting.title}" from your dashboard list? You will lose access to its details.`}
        confirmText="Remove"
      />
    </Card>
  );
}