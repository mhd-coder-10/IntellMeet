// Comprehensive Meeting Details Page
// Displays start & end timestamps, duration, date, day, participant attendance list,
// embedded video recording player (if recorded by host), and removal from dashboard

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Users,
  Video,
  Download,
  Copy,
  ArrowLeft,
  XCircle,
  Crown,
  HardDrive,
  Loader2,
  AlertCircle,
  PlayCircle,
  VideoOff,
  AlertTriangle,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMeetingById, hideMeeting, deleteMeeting } from "@/services/meetingService";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/utils/errorHelper";

// Format Date & Day: e.g. "Monday, October 6, 2026"
const formatDateAndDay = (isoString?: string | null) => {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
};

// Format Time: e.g. "10:30 AM"
const formatTimeOnly = (isoString?: string | null) => {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "--:--";
  }
};

// Calculate duration between start and end
const calculateDuration = (startIso?: string | null, endIso?: string | null) => {
  if (!startIso || !endIso) return null;
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diffSec = Math.max(0, Math.round((end - start) / 1000));
    const hours = Math.floor(diffSec / 3600);
    const minutes = Math.floor((diffSec % 3600) / 60);
    const seconds = diffSec % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    return `${minutes}m ${seconds}s`;
  } catch {
    return null;
  }
};

export default function MeetingDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [isRemoving, setIsRemoving] = useState(false);

  const {
    data: meeting,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => getMeetingById(id!),
    enabled: !!id,
    retry: 1,
  });

  const isHost = meeting?.host._id === currentUser?.id;

  const handleCopyCode = () => {
    if (!meeting?.meetingCode) return;
    navigator.clipboard.writeText(meeting.meetingCode);
    toast.success(`Meeting code ${meeting.meetingCode} copied to clipboard!`);
  };

  const handleRemove = async () => {
    if (
      !confirm(
        "Are you sure you want to remove this meeting from your dashboard? You will lose access to its details and recording."
      )
    ) {
      return;
    }

    setIsRemoving(true);
    try {
      if (isHost && (meeting?.status === "completed" || meeting?.status === "cancelled")) {
        await deleteMeeting(meeting._id);
        toast.success("Meeting deleted permanently");
      } else {
        await hideMeeting(meeting!._id);
        toast.success("Meeting removed from your dashboard");
      }
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRemoving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900">
        <Header />
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500">
            Loading meeting details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Meeting Not Found or Access Removed
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            This meeting does not exist, or you have removed it from your dashboard and no longer have access to its details.
          </p>
          <div className="pt-2">
            <Link to="/dashboard">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-5">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const durationText = calculateDuration(meeting.startedAt, meeting.endedAt);
  const meetingDateDay = formatDateAndDay(
    meeting.startedAt || meeting.scheduledAt || meeting.createdAt
  );
  const participantList = [meeting.host, ...(meeting.participants || [])];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100">
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
        {/* Navigation Breadcrumb & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-1">
              <Link to="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <span>/</span>
              <Link to="/meetings" className="hover:underline">
                Meetings
              </Link>
              <span>/</span>
              <span className="text-slate-500 truncate max-w-[200px]">
                {meeting.title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {meeting.title}
              </h1>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  meeting.status === "ongoing"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : meeting.status === "completed"
                    ? "bg-slate-100 text-slate-600 border border-slate-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {meeting.status === "ongoing" ? "Live Now" : meeting.status}
              </span>
            </div>
            {meeting.description && (
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {meeting.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link to="/dashboard">
              <Button
                variant="outline"
                className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs h-9 px-3.5"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Dashboard
              </Button>
            </Link>

            {meeting.status === "ongoing" && (
              <Link to={`/meetings/${meeting._id}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-sm shadow-emerald-500/20">
                  <Video className="w-4 h-4 mr-1.5" />
                  Enter Live Call
                </Button>
              </Link>
            )}

            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 rounded-xl text-xs h-9 px-3.5 shadow-none"
            >
              {isRemoving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
              )}
              {isHost ? "Delete Meeting" : "Remove from Dashboard"}
            </Button>
          </div>
        </div>

        {/* Meeting Core Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date & Day */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Date & Day</span>
            </div>
            <p className="text-sm font-bold text-slate-900 pt-1">
              {meetingDateDay}
            </p>
          </Card>

          {/* Actual Start Time */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Started At</span>
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {formatTimeOnly(meeting.startedAt)}
            </p>
            <p className="text-[11px] text-slate-400">
              {meeting.startedAt
                ? "Host launched the call"
                : "Scheduled (Not started)"}
            </p>
          </Card>

          {/* Actual End Time */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>Ended At</span>
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {formatTimeOnly(meeting.endedAt)}
            </p>
            <p className="text-[11px] text-slate-400">
              {meeting.endedAt ? "Host concluded call" : "Session active or scheduled"}
            </p>
          </Card>

          {/* Total Duration */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <span>Total Duration</span>
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {durationText || (meeting.status === "ongoing" ? "In Progress" : "--")}
            </p>
            <p className="text-[11px] text-slate-400">
              Total active meeting duration
            </p>
          </Card>
        </div>

        {/* Meeting Recording Section */}
        <Card className="rounded-3xl border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-lg font-bold text-slate-900">
                  Meeting Recording
                </CardTitle>
                {meeting.recordingDeletedByHost ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Recording Deleted by Host
                  </span>
                ) : meeting.recordingUrl ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Recording Available
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                {meeting.recordingDeletedByHost
                  ? "The host has removed the media recording for this session."
                  : "Full session recording captured by the host. All attendees can view and download."}
              </p>
            </div>

            {!meeting.recordingDeletedByHost && meeting.recordingUrl && (
              <a
                href={meeting.recordingUrl}
                download={`IntelliMeet-${meeting.meetingCode}-recording`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-sm shadow-blue-500/20 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Download Recording
                </Button>
              </a>
            )}
          </CardHeader>

          <CardContent className="p-6">
            {meeting.recordingDeletedByHost ? (
              <div className="py-12 px-6 text-center space-y-3.5 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/90 shadow-xs">
                  <VideoOff className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wide">
                    <AlertTriangle className="w-3 h-3" />
                    Notice
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    Recording deleted by the host
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                    The host has permanently removed this recording file from the cloud server and database. Session details and attendee history remain accessible for your reference.
                  </p>
                </div>
              </div>
            ) : meeting.recordingUrl ? (
              <div className="space-y-4">
                <div className="relative aspect-video max-w-4xl mx-auto rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl flex items-center justify-center">
                  <video
                    src={meeting.recordingUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 max-w-4xl mx-auto px-2">
                  <span>
                    Audio/Video composite recording saved in high fidelity.
                  </span>
                  <span className="font-mono text-slate-700 font-medium">
                    Code: {meeting.meetingCode}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                  <Video className="w-7 h-7" />
                </div>
                <h4 className="text-base font-semibold text-slate-800">
                  No recording captured for this session
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  The host did not record this meeting, or recording was not saved before the call ended.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Participants & Host Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Host Card */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>Meeting Host</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-sm">
                {meeting.host.name?.charAt(0).toUpperCase() || "H"}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-900">
                  {meeting.host.name}
                </h4>
                <p className="text-xs text-slate-500 font-mono">
                  @{meeting.host.username}
                </p>
                <span className="inline-block text-[10px] text-blue-700 font-medium bg-blue-50 border border-blue-200 px-2 py-0.2 rounded">
                  Organizer
                </span>
              </div>
            </div>
          </Card>

          {/* Participants Attendance List */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-6 md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Attendees & Participants ({participantList.length})</span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Meeting Code:</span>
                <button
                  onClick={handleCopyCode}
                  className="font-mono text-xs font-bold text-blue-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded border border-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {meeting.meetingCode}
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {participantList.map((participant) => {
                const isUserHost = participant._id === meeting.host._id;

                return (
                  <div
                    key={participant._id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0">
                      {participant.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {participant.name}
                        </span>
                        {isUserHost && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                            Host
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate font-mono">
                        @{participant.username}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
