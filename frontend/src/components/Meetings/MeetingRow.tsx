// Enterprise Meeting Row component (Horizontal / List view)
// Displays meeting status (Upcoming / Live / Completed / Cancelled / Expired),
// workspace & project badges, countdown, conditional join button, and lifecycle actions

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
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { deleteMeeting, hideMeeting } from "@/services/meetingService";
import { getErrorMessage } from "@/utils/errorHelper";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import type { Meeting } from "@/types/meeting";

interface Props {
  meeting: Meeting;
}

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

export function MeetingRow({ meeting }: Props) {
  const [now, setNow] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isHideConfirmOpen, setIsHideConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const isHost = meeting.host?._id === currentUser?.id;
  const startMs = new Date(meeting.startTime || meeting.scheduledAt).getTime();
  const isFuture = now < startMs;
  const isCancelled = meeting.status === "cancelled";
  const isExpired = meeting.status === "expired";
  const isCompleted =
    (meeting.status === "completed" || (Boolean(meeting.endedAt) && !isCancelled && !isExpired)) &&
    !isCancelled &&
    !isExpired;
  const isLive = !isCompleted && !isCancelled && !isExpired && !isFuture;

  const canDelete = isHost && (isCompleted || isCancelled || isExpired);
  const canHide = !isHost && (isCompleted || isCancelled || isExpired);
  const participantCount = (meeting.participants?.length || 0) + 1;

  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      await deleteMeeting(meeting._id);
      toast.success("Meeting deleted");
      setIsDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-analytics"] });
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
      queryClient.invalidateQueries({ queryKey: ["meeting-analytics"] });
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

  const formattedDate = new Date(meeting.startTime || meeting.scheduledAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const endTimeFormatted = meeting.endTime
    ? new Date(meeting.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Open-ended";

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md transition-all shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Left Details Section */}
      <div className="space-y-2 min-w-0 flex-1">
        {/* Title and Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-slate-900 text-base truncate max-w-md" title={meeting.title}>
            {meeting.title}
          </h3>

          {/* Host / Invited / Attendance Badge */}
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

          {/* Status Indicator */}
          {isLive ? (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              LIVE NOW
            </span>
          ) : isCancelled ? (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Cancelled
            </span>
          ) : isExpired ? (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Expired
            </span>
          ) : isCompleted ? (
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Completed
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
              {getCountdownText(startMs, now)}
            </span>
          )}
        </div>

        {/* Workspace, Project, Date & Time, and Participant count */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
          <span className="flex items-center gap-1.5 font-medium text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            {formattedDate}
          </span>

          <span className="flex items-center gap-1 font-medium text-slate-700">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            {formattedStartTime} — {endTimeFormatted}
          </span>

          {meeting.workspace && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
              <Briefcase className="w-3 h-3 text-indigo-500" />
              {meeting.workspace.name}
            </span>
          )}

          {meeting.project && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
              <Layers className="w-3 h-3 text-purple-500" />
              {meeting.project.name}
            </span>
          )}

          <span className="flex items-center gap-1 text-slate-500">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {participantCount} {participantCount === 1 ? "participant" : "participants"}
          </span>
        </div>

        {/* Description */}
        {meeting.description && (
          <p className="text-xs text-slate-500 line-clamp-1">
            {meeting.description}
          </p>
        )}
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
        {/* Details / Summary Button */}
        <Link to={`/meetings/${meeting._id}/details`}>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs h-9 px-3.5 font-medium cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 mr-1 text-blue-600" />
            {isCompleted ? "Summary & Recording" : "Details"}
          </Button>
        </Link>

        {/* Conditional Join / Countdown Button */}
        {!isCompleted && !isCancelled && !isExpired && (
          <div>
            {isLive ? (
              <Link to={`/meetings/${meeting._id}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-xs cursor-pointer">
                  <Video className="w-4 h-4 mr-1.5" />
                  Join Live Call
                </Button>
              </Link>
            ) : (
              <Button
                disabled
                title={`Meeting starts at ${formattedStartTime}`}
                className="bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs h-9 px-4 font-medium opacity-80 cursor-not-allowed"
              >
                <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                {getCountdownText(startMs, now)}
              </Button>
            )}
          </div>
        )}

        {/* Delete Button (Host only) */}
        {canDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteConfirmOpen(true)}
            disabled={isLoading}
            className="h-9 px-3 rounded-xl text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 mr-1" />
            )}
            Delete
          </Button>
        )}

        {/* Remove Button (Participant only) */}
        {canHide && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHideConfirmOpen(true)}
            disabled={isLoading}
            className="h-9 px-3 rounded-xl text-xs border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 cursor-pointer shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <X className="w-3.5 h-3.5 mr-1" />
                Remove
              </>
            )}
          </Button>
        )}
      </div>

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
        description={`Remove "${meeting.title}" from your list? You will lose access to its details.`}
        confirmText="Remove"
      />
    </div>
  );
}
