// Enterprise Meeting Card component
// Displays meeting details, status badges, quick code copy, host badges, and lifecycle actions

import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  Video,
  Trash2,
  X,
  Loader2,
  Copy,
  Info,
  Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";
import { deleteMeeting, hideMeeting } from "@/services/meetingService";
import { getErrorMessage } from "@/utils/errorHelper";
import type { Meeting } from "@/types/meeting";

interface Props {
  meeting: Meeting;
}

const statusStyles = {
  scheduled: {
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-600",
    label: "Scheduled",
  },
  ongoing: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500 animate-ping",
    label: "Live Now",
  },
  completed: {
    badge: "bg-slate-100 text-slate-600 border border-slate-200",
    dot: "bg-slate-400",
    label: "Completed",
  },
  cancelled: {
    badge: "bg-red-50 text-red-700 border border-red-200",
    dot: "bg-red-500",
    label: "Cancelled",
  },
};

export function MeetingCard({ meeting }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const isHost = meeting.host._id === currentUser?.id;

  // Delete only for host on completed/cancelled meetings
  const canDelete =
    isHost && (meeting.status === "completed" || meeting.status === "cancelled");

  // Join only for active meetings
  const canJoin =
    meeting.status !== "completed" && meeting.status !== "cancelled";

  // Hide option only for non-host users
  const canHide = !isHost;

  const participantCount = (meeting.participants?.length || 0) + 1;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(meeting.meetingCode);
    toast.success(`Code ${meeting.meetingCode} copied!`);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this meeting permanently? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteMeeting(meeting._id);
      toast.success("Meeting deleted");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleHide = async () => {
    setIsLoading(true);
    try {
      await hideMeeting(meeting._id);
      toast.success("Removed from your list");
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const currentStatus = statusStyles[meeting.status] || statusStyles.scheduled;

  return (
    <Card className="border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between">
      <CardHeader className="p-5 pb-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight line-clamp-1">
                {meeting.title}
              </CardTitle>
              {isHost ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Host
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Member
                </span>
              )}
            </div>
            {meeting.description && (
              <p className="text-xs text-slate-500 line-clamp-2">
                {meeting.description}
              </p>
            )}
          </div>

          {/* Status Badge */}
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${currentStatus.badge}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
            {currentStatus.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Users className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{participantCount} {participantCount === 1 ? "member" : "members"}</span>
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

          {/* Schedule Time Window (Start Time — End Time or Open-ended) */}
          <div className="flex items-center gap-2 text-slate-700 col-span-2 pt-1 border-t border-slate-200/70">
            <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] text-slate-600 truncate font-medium">
              {new Date(meeting.startTime || meeting.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {" — "}
              {meeting.endTime ? new Date(meeting.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Open-ended"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-700 col-span-2 pt-1 border-t border-slate-200/70 justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Code:</span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {meeting.meetingCode}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1 text-[11px] bg-white hover:bg-slate-100 px-2 py-0.5 rounded border border-slate-200 transition cursor-pointer"
              title="Copy code"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {/* Details Button - always available */}
          <Link to={`/meetings/${meeting._id}/details`} className={canJoin ? "" : "flex-1"}>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9 rounded-xl text-xs border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900"
            >
              <Info className="h-3.5 w-3.5 mr-1 text-blue-600" />
              Details
            </Button>
          </Link>

          {canJoin && (
            <Link to={`/meetings/${meeting._id}`} className="flex-1">
              <Button
                className={`w-full ${
                  meeting.status === "ongoing"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-xs"
                    : "bg-blue-600 hover:bg-blue-700 shadow-xs"
                } text-white font-medium rounded-xl text-xs h-9`}
              >
                <Video className="h-3.5 w-3.5 mr-1.5" />
                {meeting.status === "ongoing"
                  ? "Join Call"
                  : isHost
                  ? "Start Meeting"
                  : "Join"}
              </Button>
            </Link>
          )}

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isLoading}
              className="flex-1 h-9 rounded-xl text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1" />
              )}
              Delete
            </Button>
          )}

          {canHide && (
            <Button
              variant="outline"
              onClick={handleHide}
              disabled={isLoading}
              className="flex-1 h-9 rounded-xl text-xs border-red-200 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Remove
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}