// Comprehensive Meeting Details Page
// Displays start & end timestamps, duration, date, day, participant attendance list,
// embedded video recording player (if recorded by host), and removal from dashboard

import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Users,
  Video,
  Copy,
  ArrowLeft,
  XCircle,
  Crown,
  HardDrive,
  Loader2,
  AlertCircle,
  PlayCircle,
  Play,
  X,
  VideoOff,
  AlertTriangle,
  RefreshCw,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  getMeetingById,
  hideMeeting,
  deleteMeeting,
  updateMeeting,
} from "@/services/meetingService";
import { useAuthStore } from "@/store/authStore";
import { useSocket } from "@/hooks/useSocket";
import { getErrorMessage } from "@/utils/errorHelper";
import { getMediaUrl } from "@/utils/mediaUrl";
import { TranscriptCard } from "@/components/Meetings/TranscriptCard";
import { SummaryAndActionItemsCard } from "@/components/Meetings/SummaryAndActionItemsCard";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import type { MeetingRecordingItem } from "@/types/meeting";

// Helper to convert date to datetime-local input string in user local timezone
const toLocalDatetimeInput = (dateInput?: string | Date | null) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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

// Format seconds for recording duration
const formatRecordingDuration = (sec?: number) => {
  if (!sec || sec <= 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
};

// Format bytes for recording file size
const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return null;
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export default function MeetingDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [isRemoving, setIsRemoving] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [activeRecording, setActiveRecording] = useState<MeetingRecordingItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit Meeting Details Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");

  // Live Socket Sync for meeting updates
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("meeting:join", { meetingId: id });

    const handleMeetingUpdated = (updatedData: any) => {
      const actual = updatedData?.meeting || updatedData;
      if (actual?._id === id || actual?.id === id) {
        queryClient.setQueryData(["meeting", id], actual);
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
      }
    };

    socket.on("meeting:updated", handleMeetingUpdated);

    return () => {
      socket.off("meeting:updated", handleMeetingUpdated);
    };
  }, [socket, id, queryClient]);

  const updateMeetingMutation = useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      scheduledAt?: string;
      startTime?: string;
    }) => updateMeeting(id!, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["meeting", id], updated);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting details updated successfully!");
      setIsEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update meeting");
    },
  });

  const {
    data: meeting,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => getMeetingById(id!),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasRecordings =
        (data?.recordings && data.recordings.length > 0) || !!data?.recordingUrl;
      // Auto-poll every 3s if meeting completed but recording is still uploading/syncing
      if (
        data &&
        data.status === "completed" &&
        !hasRecordings &&
        !data.recordingDeletedByHost
      ) {
        return 3000;
      }
      return false;
    },
    retry: 1,
  });

  const recordingsList: MeetingRecordingItem[] = useMemo(() => {
    if (meeting?.recordings && meeting.recordings.length > 0) {
      return meeting.recordings.map((rec, idx) => ({
        ...rec,
        title: rec.title || `${meeting.title} - Recording ${idx + 1}`,
      }));
    }
    if (meeting?.recordingUrl) {
      return [
        {
          url: meeting.recordingUrl,
          title: `${meeting.title} - Recording 1`,
          duration: 0,
          size: 0,
          createdAt: meeting.updatedAt,
        },
      ];
    }
    return [];
  }, [meeting?.recordings, meeting?.recordingUrl, meeting?.title, meeting?.updatedAt]);

  const isHost = meeting?.host._id === currentUser?.id;

  const handleCopyCode = () => {
    if (!meeting?.meetingCode) return;
    navigator.clipboard.writeText(meeting.meetingCode);
    toast.success(`Meeting code ${meeting.meetingCode} copied to clipboard!`);
  };

  const confirmRemoveMeeting = async () => {
    setIsRemoving(true);
    try {
      if (isHost && (meeting?.status === "completed" || meeting?.status === "cancelled")) {
        await deleteMeeting(meeting._id);
        toast.success("Meeting deleted permanently");
      } else {
        await hideMeeting(meeting!._id);
        toast.success("Meeting removed from your dashboard");
      }
      setIsRemoveConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRemoving(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meeting", id] }),
        queryClient.invalidateQueries({ queryKey: ["meeting-transcript", id] }),
        queryClient.invalidateQueries({ queryKey: ["meeting-summary", id] }),
      ]);
      await refetch();
      toast.success("Meeting details refreshed!");
    } catch {
      toast.error("Failed to refresh meeting details");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-500">
          Loading meeting details...
        </p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="w-full">
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

  // Members who joined this meeting (excluding host who has their own dedicated card)
  const memberParticipants = (meeting.participants || []).filter(
    (p) => p && p._id && p._id.toString() !== meeting.host?._id?.toString()
  );
  const hasOtherParticipants = memberParticipants.length > 0;

  const durationText = calculateDuration(meeting.startedAt, meeting.endedAt);
  const meetingDateDay = formatDateAndDay(
    meeting.startTime || meeting.scheduledAt || meeting.createdAt
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0">
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0">
        {/* Navigation Breadcrumb & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
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
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${meeting.status === "ongoing"
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

            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs h-9 px-3.5 shadow-xs"
              title="Refresh meeting details"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              Refresh
            </Button>

            {isHost && meeting.status !== "completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditTitle(meeting.title || "");
                  setEditDescription(meeting.description || "");
                  setEditScheduledAt(
                    toLocalDatetimeInput(meeting.scheduledAt || meeting.startTime)
                  );
                  setIsEditModalOpen(true);
                }}
                className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs h-9 px-3.5 shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Edit Details
              </Button>
            )}

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
              onClick={() => setIsRemoveConfirmOpen(true)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Date & Day */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Date & Day</span>
            </div>
            <p className="text-sm font-bold text-slate-900 pt-1">
              {meetingDateDay}
            </p>
            <p className="text-[11px] text-slate-400">
              Meeting date
            </p>
          </Card>

          {/* Scheduled Time Window (Reference) */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Scheduled Time</span>
            </div>
            <p className="text-sm font-bold text-slate-900 pt-1">
              {formatTimeOnly(meeting.startTime || meeting.scheduledAt)}
              {" — "}
              {meeting.endTime ? formatTimeOnly(meeting.endTime) : "Open-ended"}
            </p>
            <p className="text-[11px] text-slate-400">
              {meeting.endTime ? "Scheduled reference window" : "Open-ended reference"}
            </p>
          </Card>

          {/* Actual Start Time */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Started At</span>
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {hasOtherParticipants && meeting.startedAt
                ? formatTimeOnly(meeting.startedAt)
                : "--:--"}
            </p>
            <p className="text-[11px] text-slate-400">
              {hasOtherParticipants
                ? meeting.startedAt
                  ? "Host launched the call"
                  : "Scheduled (Not started)"
                : "No other members joined"}
            </p>
          </Card>

          {/* Actual End Time */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>Ended At</span>
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {hasOtherParticipants && meeting.endedAt
                ? formatTimeOnly(meeting.endedAt)
                : "--:--"}
            </p>
            <p className="text-[11px] text-slate-400">
              {hasOtherParticipants
                ? meeting.endedAt
                  ? "Host concluded call"
                  : "Session active or scheduled"
                : "No other members joined"}
            </p>
          </Card>

          {/* Total Duration */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <span>Total Duration</span>
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {hasOtherParticipants
                ? durationText || (meeting.status === "ongoing" ? "In Progress" : "--")
                : "--"}
            </p>
            <p className="text-[11px] text-slate-400">
              {hasOtherParticipants
                ? "Total active meeting duration"
                : "No other members joined"}
            </p>
          </Card>
        </div>

        {/* Meeting Recording Section */}
        <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-3.5 sm:p-4 border-b border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
                  <PlayCircle className="w-4 h-4 text-blue-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide">
                      Meeting Recording
                    </h3>
                    {meeting.recordingDeletedByHost ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/30 text-amber-200">
                        Recording Deleted
                      </span>
                    ) : recordingsList.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/30 text-emerald-200">
                        {recordingsList.length} Recording{recordingsList.length > 1 ? "s" : ""} Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/25 text-blue-200">
                        Media Capture
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300/80 mt-0.5">
                    {meeting.recordingDeletedByHost
                      ? "The host has removed the media recording for this session."
                      : recordingsList.length > 1
                        ? "Multiple recordings captured for this session. Click on any recording card to play."
                        : "Session media recording captured by the host during the live meeting."}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    refetch();
                    toast.info("Checking for recording updates...");
                  }}
                  disabled={isFetching}
                  className="h-8 px-2.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 rounded-lg gap-1.5 transition-all"
                  title="Check for newly uploaded recordings"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="p-3.5 sm:p-4">
            {meeting.recordingDeletedByHost ? (
              <div className="py-5 px-4 text-center space-y-2 max-w-sm mx-auto">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/90 shadow-xs">
                  <VideoOff className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wide">
                    <AlertTriangle className="w-3 h-3" />
                    Notice
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Recording deleted by the host
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                    The host has permanently removed this recording file from the cloud server and database. Session details and attendee history remain accessible for your reference.
                  </p>
                </div>
              </div>
            ) : recordingsList.length > 0 ? (
              <div className="space-y-5">
                {/* Enlarged Video Player on Click (Exact large size as before) */}
                {activeRecording && (
                  <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl animate-in fade-in duration-300">
                    {/* Active Player Header Bar */}
                    <div className="flex items-center justify-between text-white px-2">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Now Playing:
                        </span>
                        <h3 className="text-sm font-bold text-white truncate">
                          {activeRecording.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveRecording(null)}
                          className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Close Player"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Enlarged Video Element */}
                    <div className="relative aspect-video max-w-4xl mx-auto rounded-xl overflow-hidden bg-black border border-slate-800 shadow-xl flex items-center justify-center">
                      <video
                        key={activeRecording.url}
                        src={getMediaUrl(activeRecording.url)}
                        controls
                        controlsList="nodownload"
                        playsInline
                        autoPlay
                        preload="auto"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Small Preview Cards Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
                    <span>
                      {recordingsList.length === 1
                        ? "Click the card below to play recording"
                        : `All Recorded Sessions (${recordingsList.length}) - Click to play`}
                    </span>
                    <span className="font-mono text-slate-600">
                      Code: {meeting.meetingCode}
                    </span>
                  </div>

                  <div className={`grid gap-4 ${recordingsList.length === 1
                      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-md"
                      : recordingsList.length === 2
                        ? "grid-cols-1 sm:grid-cols-2 max-w-2xl"
                        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                    }`}>
                    {recordingsList.map((rec, idx) => {
                      const isPlaying = activeRecording?.url === rec.url;
                      return (
                        <div
                          key={rec.url || idx}
                          onClick={() => setActiveRecording(rec)}
                          className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden p-3 flex flex-col justify-between gap-3 ${isPlaying
                              ? "bg-blue-50/90 border-blue-500 shadow-md ring-2 ring-blue-400/40"
                              : "bg-slate-50/80 border-slate-200 hover:border-blue-400 hover:bg-white hover:shadow-md"
                            }`}
                        >
                          {/* Card Thumbnail / Mini Video Frame */}
                          <div className="relative aspect-video w-full rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-800/80 shadow-inner group-hover:scale-[1.01] transition-transform">
                            <video
                              src={getMediaUrl(rec.url)}
                              preload="metadata"
                              muted
                              playsInline
                              className="w-full h-full object-cover opacity-60 group-hover:opacity-85 transition-opacity pointer-events-none"
                            />

                            {/* Play Button Overlay */}
                            <div
                              className={`absolute inset-0 flex items-center justify-center transition-all ${isPlaying
                                  ? "bg-blue-900/40 backdrop-blur-[1px]"
                                  : "bg-black/35 group-hover:bg-black/15"
                                }`}
                            >
                              <div
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg ${isPlaying
                                    ? "bg-blue-600 text-white scale-110 shadow-blue-500/50 ring-4 ring-blue-300/30"
                                    : "bg-white/95 text-slate-900 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white"
                                  }`}
                              >
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              </div>
                            </div>

                            {/* Part Number Badge */}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white text-[10px] font-bold tracking-wide uppercase border border-white/10 shadow-xs">
                              Recording #{idx + 1}
                            </div>

                            {/* Duration Badge */}
                            {rec.duration && rec.duration > 0 ? (
                              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-white text-[10px] font-mono font-medium border border-white/10 shadow-xs">
                                {formatRecordingDuration(rec.duration)}
                              </div>
                            ) : null}
                          </div>

                          {/* Card Details */}
                          <div className="space-y-1.5 px-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                                {rec.title || `${meeting.title} - Recording ${idx + 1}`}
                              </h4>
                              {isPlaying && (
                                <span className="shrink-0 text-[10px] bg-blue-600 text-white font-semibold px-2 py-0.5 rounded-full shadow-xs">
                                  Playing
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                              {rec.size && rec.size > 0 ? (
                                <span className="flex items-center gap-1">
                                  <HardDrive className="w-3 h-3 text-slate-400" />
                                  {formatFileSize(rec.size)}
                                </span>
                              ) : null}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatTimeOnly(rec.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 px-3 text-center space-y-2 max-w-xs mx-auto">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                  <Video className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold text-slate-800">
                    No recording captured for this session
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    The host did not record this meeting session.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="rounded-xl text-xs h-7 px-3 gap-1.5 text-slate-600 mt-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
                  Check Again
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* AI Meeting Transcription Section (Day 15) */}
        <TranscriptCard
          meetingId={meeting._id}
          meetingTitle={meeting.title}
          meetingCode={meeting.meetingCode}
          recordingIndex={
            activeRecording
              ? Math.max(0, recordingsList.findIndex((r) => r.url === activeRecording.url))
              : 0
          }
          hasRecordings={recordingsList.length > 0}
          onSeekToTime={(seconds) => {
            const videoEl = document.querySelector("video[controls]") as HTMLVideoElement;
            if (videoEl) {
              videoEl.currentTime = seconds;
              videoEl.play().catch(() => { });
            }
          }}
        />

        {/* AI Meeting Summary & Smart Action Items Section (Day 16) */}
        <SummaryAndActionItemsCard
          meetingId={meeting._id}
          meetingTitle={meeting.title}
          hostId={typeof meeting.host === "string" ? meeting.host : meeting.host?._id}
          hasRecordings={recordingsList.length > 0}
          hasTranscript={false}
          participants={[meeting.host, ...(meeting.participants || [])]}
        />

        {/* Members & Host Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Host Card */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-4 sm:p-5 space-y-3">
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
                <span className="inline-block text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.2 rounded">
                  Host & Organizer
                </span>
              </div>
            </div>
          </Card>

          {/* Participants Meeting Members Attendance List */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-4 sm:p-5 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Participants Meeting Members ({memberParticipants.length})</span>
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

            {memberParticipants.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-slate-50/70 border border-dashed border-slate-200 text-center text-slate-500 text-xs gap-1.5">
                <Users className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-500">No members have joined this meeting yet</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {memberParticipants.map((participant) => (
                  <div
                    key={participant._id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0">
                      {participant.name?.charAt(0).toUpperCase() || "M"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {participant.name}
                        </span>
                        <span className="text-[9px] font-medium px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          Member
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate font-mono">
                        @{participant.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      {/* EDIT MEETING DETAILS MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Edit Meeting Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update meeting title, description, and scheduled start time.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editTitle.trim()) {
                  toast.error("Meeting title is required");
                  return;
                }
                const parsedIso = editScheduledAt ? new Date(editScheduledAt).toISOString() : undefined;
                updateMeetingMutation.mutate({
                  title: editTitle.trim(),
                  description: editDescription.trim(),
                  scheduledAt: parsedIso,
                  startTime: parsedIso,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Meeting Title *
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Sprint Planning & Retrospective"
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Meeting agenda, goals, and preparation notes..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Scheduled Start Time
                </label>
                <Input
                  type="datetime-local"
                  value={editScheduledAt}
                  onChange={(e) => setEditScheduledAt(e.target.value)}
                  className="h-11 rounded-xl text-xs sm:text-sm"
                />
                <span className="text-[11px] text-slate-400">
                  Leave blank to keep original start time or leave as instant meeting.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border-slate-200 text-slate-600 text-xs h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMeetingMutation.isPending || !editTitle.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-10 px-5 shadow-xs"
                >
                  {updateMeetingMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / REMOVE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isRemoveConfirmOpen}
        onClose={() => setIsRemoveConfirmOpen(false)}
        onConfirm={confirmRemoveMeeting}
        isLoading={isRemoving}
        variant="danger"
        title={isHost ? "Delete Meeting Permanently?" : "Remove Meeting from Dashboard?"}
        description={
          isHost
            ? "Are you sure you want to delete this meeting? All recordings, action items, and transcripts will be permanently removed."
            : "Are you sure you want to remove this meeting from your dashboard? You will lose access to its details and recordings."
        }
        confirmText={isHost ? "Delete Meeting" : "Remove"}
      />
      </main>
    </div>
  );
}
