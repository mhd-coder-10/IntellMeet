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
  ArrowLeft,
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
  Briefcase,
  Layers,
  Search,
  Check,
  Ban,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  getMeetingById,
  deleteMeeting,
  cancelMeeting,
  updateMeeting,
  getProjectMembers,
} from "@/services/meetingService";
import { getUserTeams, getProjectsByTeam } from "@/services/teamService";
import { useAuthStore } from "@/store/authStore";
import { useSocket } from "@/hooks/useSocket";
import { getErrorMessage } from "@/utils/errorHelper";
import { getMediaUrl } from "@/utils/mediaUrl";
import { TranscriptCard } from "@/components/Meetings/TranscriptCard";
import { SummaryAndActionItemsCard } from "@/components/Meetings/SummaryAndActionItemsCard";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import type { MeetingRecordingItem, UpdateMeetingPayload } from "@/types/meeting";
import type { Team, ProjectBoard } from "@/types/team";

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
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [activeRecording, setActiveRecording] = useState<MeetingRecordingItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-tick every 10s to update real-time Join button state
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Edit Meeting Details Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editScheduledAt, setEditScheduledAt] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editWorkspaceId, setEditWorkspaceId] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editParticipantIds, setEditParticipantIds] = useState<string[]>([]);
  const [editTeams, setEditTeams] = useState<Team[]>([]);
  const [editProjects, setEditProjects] = useState<ProjectBoard[]>([]);
  const [editAvailableMembers, setEditAvailableMembers] = useState<{
    _id: string;
    name: string;
    username: string;
    email: string;
    profilePicture?: string;
    role?: string;
  }[]>([]);
  const [editMemberSearch, setEditMemberSearch] = useState("");
  const [editIsAllWorkspaceSelected, setEditIsAllWorkspaceSelected] = useState(false);
  const [editIsProjectFilterActive, setEditIsProjectFilterActive] = useState(false);
  const [editIsLoadingProjects, setEditIsLoadingProjects] = useState(false);

  // Open Edit Modal instantly and pre-populate workspace, project, participants, and times
  const openEditModal = async () => {
    if (!meeting) return;
    setEditTitle(meeting.title || "");
    setEditDescription(meeting.description || "");
    setEditScheduledAt(toLocalDatetimeInput(meeting.startTime || meeting.scheduledAt));
    setEditEndTime(meeting.endTime ? toLocalDatetimeInput(meeting.endTime) : "");

    const wsId = meeting.workspace?._id || (typeof meeting.workspace === "string" ? meeting.workspace : "");
    const prId = meeting.project?._id || (typeof meeting.project === "string" ? meeting.project : "") || "";
    setEditWorkspaceId(wsId);
    setEditProjectId(prId);

    const initialPIds = (meeting.participants || []).map((p: any) => p._id || p);
    setEditParticipantIds(initialPIds);
    setEditMemberSearch("");
    setEditIsProjectFilterActive(false);

    // Immediately seed participants from current meeting data so modal displays without delay
    const myId = currentUser?.id || currentUser?._id;
    const initialSeed: any[] = [];
    (meeting.participants || []).forEach((p: any) => {
      if (p && (p._id || p) && (p._id || p) !== myId) {
        initialSeed.push({
          _id: p._id || p,
          name: p.name || "Member",
          username: p.username || "user",
          email: p.email || "",
          profilePicture: p.profilePicture,
          role: "member",
        });
      }
    });
    if (initialSeed.length > 0) {
      setEditAvailableMembers(initialSeed);
    }

    // OPEN MODAL INSTANTLY — ZERO DELAY!
    setIsEditModalOpen(true);

    try {
      const uTeams = await getUserTeams();
      setEditTeams(uTeams);
      const activeTeam = uTeams.find((t) => t._id === wsId) || uTeams[0];
      if (activeTeam) {
        if (!wsId) setEditWorkspaceId(activeTeam._id);
        const mList: any[] = [];
        const seen = new Set();
        if (activeTeam.owner && activeTeam.owner._id !== myId) {
          mList.push({
            _id: activeTeam.owner._id,
            name: activeTeam.owner.name,
            username: activeTeam.owner.username,
            email: activeTeam.owner.email,
            profilePicture: activeTeam.owner.profilePicture,
            role: "owner",
          });
          seen.add(activeTeam.owner._id);
        }
        (activeTeam.members || []).forEach((m: any) => {
          if (m.user && m.user._id !== myId && !seen.has(m.user._id) && (m.status === "active" || !m.status)) {
            mList.push({
              _id: m.user._id,
              name: m.user.name,
              username: m.user.username,
              email: m.user.email,
              profilePicture: m.user.profilePicture,
              role: m.role || "member",
            });
            seen.add(m.user._id);
          }
        });
        setEditAvailableMembers(mList);
        setEditIsAllWorkspaceSelected(mList.length > 0 && initialPIds.length === mList.length);

        setEditIsLoadingProjects(true);
        const projs = await getProjectsByTeam(activeTeam._id);
        setEditProjects(projs || []);
        setEditIsLoadingProjects(false);
      }
    } catch {
      setEditIsLoadingProjects(false);
    }
  };

  const handleEditWorkspaceChange = async (newWsId: string) => {
    setEditWorkspaceId(newWsId);
    setEditProjectId("");
    setEditIsProjectFilterActive(false);
    const activeTeam = editTeams.find((t) => t._id === newWsId);
    if (activeTeam) {
      const mList: any[] = [];
      const seen = new Set();
      const myId = currentUser?.id || currentUser?._id;
      if (activeTeam.owner && activeTeam.owner._id !== myId) {
        mList.push({
          _id: activeTeam.owner._id,
          name: activeTeam.owner.name,
          username: activeTeam.owner.username,
          email: activeTeam.owner.email,
          profilePicture: activeTeam.owner.profilePicture,
          role: "owner",
        });
        seen.add(activeTeam.owner._id);
      }
      (activeTeam.members || []).forEach((m: any) => {
        if (m.user && m.user._id !== myId && !seen.has(m.user._id) && (m.status === "active" || !m.status)) {
          mList.push({
            _id: m.user._id,
            name: m.user.name,
            username: m.user.username,
            email: m.user.email,
            profilePicture: m.user.profilePicture,
            role: m.role || "member",
          });
          seen.add(m.user._id);
        }
      });
      setEditAvailableMembers(mList);
      const allIds = mList.map((m) => m._id);
      setEditParticipantIds(allIds);
      setEditIsAllWorkspaceSelected(true);

      setEditIsLoadingProjects(true);
      try {
        const projs = await getProjectsByTeam(newWsId);
        setEditProjects(projs || []);
      } catch {
        setEditProjects([]);
      } finally {
        setEditIsLoadingProjects(false);
      }
    }
  };

  const handleEditSelectProjectMembers = async () => {
    if (!editProjectId) return;
    try {
      const pMembers = await getProjectMembers(editProjectId);
      const myId = currentUser?.id || currentUser?._id;
      const filtered = pMembers.map((pm) => pm._id).filter((pId) => pId !== myId);
      if (filtered.length === 0) {
        const allAvailable = editAvailableMembers.map((m) => m._id);
        setEditParticipantIds(allAvailable);
        toast.info("Selected all workspace members for this project");
        return;
      }
      setEditParticipantIds(filtered);
      setEditIsProjectFilterActive(true);
      setEditIsAllWorkspaceSelected(false);
      toast.success(`Selected ${filtered.length} member(s) from project board`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not fetch project members");
    }
  };

  const editDisplayedMembers = useMemo(() => {
    if (!editMemberSearch.trim()) return editAvailableMembers;
    const q = editMemberSearch.toLowerCase();
    return editAvailableMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [editAvailableMembers, editMemberSearch]);

  // Live Socket Sync for meeting updates
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("meeting:subscribe", { meetingId: id });

    const handleMeetingUpdated = (updatedData: any) => {
      const actual = updatedData?.meeting || updatedData;
      if (actual?._id === id || actual?.id === id) {
        queryClient.setQueryData(["meeting", id], actual);
        queryClient.invalidateQueries({ queryKey: ["meetings"] });
      }
    };

    socket.on("meeting:updated", handleMeetingUpdated);
    socket.on("meeting:cancelled", handleMeetingUpdated);
    socket.on("meeting:expired", handleMeetingUpdated);

    return () => {
      socket.emit("meeting:unsubscribe", { meetingId: id });
      socket.off("meeting:updated", handleMeetingUpdated);
      socket.off("meeting:cancelled", handleMeetingUpdated);
      socket.off("meeting:expired", handleMeetingUpdated);
    };
  }, [socket, id, queryClient]);

  const updateMeetingMutation = useMutation({
    mutationFn: (data: UpdateMeetingPayload) => updateMeeting(id!, data),
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

  const cancelMeetingMutation = useMutation({
    mutationFn: () => cancelMeeting(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(["meeting", id], updated);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting has been cancelled. All participants have been notified.");
      setIsCancelConfirmOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to cancel meeting");
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

  const confirmRemoveMeeting = async () => {
    if (!meeting || !isHost) return;
    setIsRemoving(true);
    try {
      await deleteMeeting(meeting._id);
      toast.success("Meeting deleted permanently");
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

  const durationText = calculateDuration(meeting.startedAt, meeting.endedAt);
  const meetingDateDay = formatDateAndDay(
    meeting.startTime || meeting.scheduledAt || meeting.createdAt
  );

  const startMs = new Date(meeting.startTime || meeting.scheduledAt || 0).getTime();
  const isFuture = now < startMs;
  const isCancelled = meeting.status === "cancelled";
  const isExpired = meeting.status === "expired";
  const isCompleted = (meeting.status === "completed" || (Boolean(meeting.endedAt) && !isCancelled && !isExpired)) && !isCancelled && !isExpired;
  const isLive = !isCompleted && !isCancelled && !isExpired && !isFuture;

  // Whether current logged in user was present in this meeting
  const wasCurrentMemberPresent = isHost || (meeting.attendedUserIds || []).includes(currentUser?.id || "");

  // Countdown text
  const diff = startMs - now;
  const countdownMinutes = Math.max(1, Math.round(diff / 60000));
  const countdownHours = Math.floor(countdownMinutes / 60);
  const countdownRemainingMins = countdownMinutes % 60;
  const countdownText =
    countdownHours > 0
      ? `Starts in ${countdownHours}h ${countdownRemainingMins}m`
      : `Starts in ${countdownMinutes}m`;

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0">
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0">
        {/* Navigation Breadcrumb & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
          <div className="space-y-1">
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

            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {meeting.title}
              </h1>

              {/* Status States Badge */}
              {isCancelled ? (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Cancelled
                </span>
              ) : isExpired ? (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Expired
                </span>
              ) : isCompleted ? (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                  Completed
                </span>
              ) : isLive ? (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  LIVE NOW
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  Upcoming ({countdownText})
                </span>
              )}
            </div>

            {/* Workspace & Project Badges */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {meeting.workspace && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  {meeting.workspace.name}
                </span>
              )}
              {meeting.project && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  {meeting.project.name}
                </span>
              )}
            </div>

            {meeting.description && (
              <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                {meeting.description}
              </p>
            )}

            {isCancelled && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 mt-2 max-w-2xl">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  This meeting was cancelled by the host{meeting.host?.name ? ` (${meeting.host.name})` : ""}. Participants cannot join this session.
                </span>
              </div>
            )}

            {isExpired && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5 mt-2 max-w-2xl">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  This meeting was not conducted and has expired. The scheduled time passed without participants joining.
                </span>
              </div>
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

            {isHost && !isCompleted && !isCancelled && !isExpired && (
              <Button
                variant="outline"
                size="sm"
                onClick={openEditModal}
                className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs h-9 px-3.5 shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Edit Details
              </Button>
            )}

            {isHost && !isCompleted && !isCancelled && !isExpired && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelConfirmOpen(true)}
                className="border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 rounded-xl text-xs h-9 px-3.5 shadow-xs cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                Cancel Meeting
              </Button>
            )}

            {/* Conditional Join Button */}
            {!isCompleted && !isCancelled && !isExpired && (
              isLive ? (
                <Link to={`/meetings/${meeting._id}`}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-sm shadow-emerald-500/20 cursor-pointer">
                    <Video className="w-4 h-4 mr-1.5" />
                    Join Live Call
                  </Button>
                </Link>
              ) : (
                <Button
                  disabled
                  className="bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs h-9 px-4 font-medium opacity-80 cursor-not-allowed"
                  title={`Meeting starts at ${formatTimeOnly(meeting.startTime || meeting.scheduledAt)}`}
                >
                  <Clock className="w-4 h-4 mr-1.5 text-slate-400" />
                  {countdownText}
                </Button>
              )
            )}

            {isHost && (isCompleted || isCancelled || isExpired) && (
              <Button
                variant="destructive"
                onClick={() => setIsRemoveConfirmOpen(true)}
                disabled={isRemoving}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 rounded-xl text-xs h-9 px-3.5 shadow-none cursor-pointer"
              >
                {isRemoving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Delete Meeting
              </Button>
            )}
          </div>
        </div>

        {/* Meeting Core Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Workspace & Project */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              <span>Workspace</span>
            </div>
            <p className="text-sm font-bold text-slate-900 pt-1 truncate">
              {meeting.workspace?.name || "General"}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {meeting.project ? `Project: ${meeting.project.name}` : "Workspace level"}
            </p>
          </Card>

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
              {meeting.status !== "scheduled" && meeting.status !== "expired" && meeting.startedAt
                ? formatTimeOnly(meeting.startedAt)
                : "--:--"}
            </p>
            <p className="text-[11px] text-slate-400">
              {isExpired
                ? "Expired (Not conducted)"
                : meeting.status === "scheduled"
                ? "Scheduled (Not started)"
                : meeting.startedAt
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
              {meeting.status === "completed" && meeting.endedAt
                ? formatTimeOnly(meeting.endedAt)
                : "--:--"}
            </p>
            <p className="text-[11px] text-slate-400">
              {meeting.status === "completed"
                ? "Host concluded call"
                : meeting.status === "cancelled"
                ? "Meeting cancelled"
                : isExpired
                ? "Meeting expired"
                : "Session active or scheduled"}
            </p>
          </Card>

          {/* Total Duration */}
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs p-5 space-y-1">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <HardDrive className="w-4 h-4 text-amber-600" />
              <span>Total Duration</span>
            </div>
            <p className="text-base font-bold text-slate-900 pt-1">
              {meeting.status === "completed" && durationText
                ? durationText
                : meeting.status === "ongoing"
                ? "In Progress"
                : "--"}
            </p>
            <p className="text-[11px] text-slate-400">
              {meeting.status === "completed"
                ? "Total active meeting duration"
                : meeting.status === "ongoing"
                ? "Call currently in progress"
                : isExpired
                ? "Meeting was not conducted"
                : "Session not started"}
            </p>
          </Card>
        </div>

        {/* Guidance Banner for Absent Member */}
        {isCompleted && !isHost && !wasCurrentMemberPresent && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/90 shadow-2xs flex items-start gap-3.5 animate-in fade-in duration-200">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-xs text-amber-900 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-950">
                  You were absent from this meeting
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Missed Session
                </span>
              </div>
              <p className="text-amber-800/90 leading-relaxed text-xs">
                You could not join the live call, but full meeting context has been preserved for you. You have complete access to watch the video recording, review the AI-generated meeting summary, inspect action items assigned to you, and search the transcript below to stay aligned with your team.
              </p>
            </div>
          </div>
        )}

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
                    ) : meeting.status === "expired" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/30 text-amber-200">
                        Expired
                      </span>
                    ) : meeting.status === "ongoing" ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/25 border border-blue-400/30 text-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                        Meeting In Progress
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
                      : meeting.status === "expired"
                        ? "This scheduled meeting expired without being conducted. No recordings exist."
                        : meeting.status === "ongoing"
                          ? "Meeting is currently in progress. Final recording will be available once the meeting concludes."
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
            ) : meeting.status === "expired" ? (
              <div className="py-6 px-4 text-center space-y-2 max-w-sm mx-auto">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
                  <VideoOff className="w-5 h-5 text-amber-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    No recording available
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                    This scheduled meeting expired without being conducted. No session recording was captured.
                  </p>
                </div>
              </div>
            ) : meeting.status === "ongoing" ? (
              <div className="py-6 px-4 text-center space-y-2 max-w-sm mx-auto">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-200 shadow-xs">
                  <Video className="w-5 h-5 text-blue-600 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                    In Progress
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Meeting is currently in progress
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                    Session recording will be finalized and available here once the host ends the meeting or all participants conclude the session.
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
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {participant.name}
                        </span>
                        {isCompleted ? (
                          (meeting.attendedUserIds || []).includes(participant._id?.toString()) ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Present
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Absent
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded shrink-0">
                            Invited
                          </span>
                        )}
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

      {/* EDIT MEETING DETAILS MODAL (FULL WORKSPACE-BASED FORM) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* 1. Fixed Modal Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200/80">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Edit Workspace Meeting
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update workspace, project, participants, and schedule.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. Scrollable Form Body (Single scroll container) */}
            <form
              id="edit-meeting-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editTitle.trim()) {
                  toast.error("Meeting title is required");
                  return;
                }
                if (!editWorkspaceId) {
                  toast.error("Please select a workspace");
                  return;
                }
                if (editParticipantIds.length === 0) {
                  toast.error("Please select at least 1 participant for the meeting");
                  return;
                }

                // Past time prevention (1-minute grace buffer)
                const nowTime = Date.now() - 60000;
                if (editScheduledAt && new Date(editScheduledAt).getTime() < nowTime) {
                  toast.error("Meeting start time cannot be in the past. Please select a current or future time.");
                  return;
                }

                if (editEndTime && editScheduledAt && new Date(editEndTime) <= new Date(editScheduledAt)) {
                  toast.error("Ending time must be later than starting time");
                  return;
                }

                const parsedStart = editScheduledAt ? new Date(editScheduledAt).toISOString() : undefined;
                const parsedEnd = editEndTime ? new Date(editEndTime).toISOString() : null;

                updateMeetingMutation.mutate({
                  title: editTitle.trim(),
                  description: editDescription.trim(),
                  workspace: editWorkspaceId,
                  project: editProjectId || null,
                  participants: editParticipantIds,
                  scheduledAt: parsedStart,
                  startTime: parsedStart,
                  endTime: parsedEnd,
                });
              }}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
            >
              {/* (A) Workspace & Project Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    Workspace <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editWorkspaceId}
                    onChange={(e) => handleEditWorkspaceChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl text-xs h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="" disabled>Select workspace</option>
                    {editTeams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      Project <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    {editIsLoadingProjects && (
                      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    )}
                  </div>
                  <select
                    value={editProjectId}
                    onChange={(e) => {
                      setEditProjectId(e.target.value);
                      setEditIsProjectFilterActive(false);
                    }}
                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl text-xs h-10 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">No Project (Workspace level only)</option>
                    {editProjects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* (B) Participant Selection */}
              <div className="space-y-3 p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Participants ({editParticipantIds.length} selected) <span className="text-red-500">*</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Option 1: All Workspace Members checkbox */}
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={editIsAllWorkspaceSelected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEditIsAllWorkspaceSelected(checked);
                          setEditIsProjectFilterActive(false);
                          if (checked) {
                            setEditParticipantIds(editAvailableMembers.map((m) => m._id));
                          } else {
                            setEditParticipantIds([]);
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span>All Members</span>
                    </label>

                    {/* Quick Button: Only Selected Project Members */}
                    {editProjectId && (
                      <button
                        type="button"
                        onClick={handleEditSelectProjectMembers}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                          editIsProjectFilterActive
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                        }`}
                      >
                        <Layers className="w-3 h-3" />
                        <span>Only Project Members</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Member Search Filter */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search members by name or email..."
                    value={editMemberSearch}
                    onChange={(e) => setEditMemberSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-white rounded-lg border-slate-200"
                  />
                </div>

                {/* Scrollable Members List */}
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                  {editDisplayedMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">
                      No members found matching your search.
                    </p>
                  ) : (
                    editDisplayedMembers.map((m) => {
                      const isSelected = editParticipantIds.includes(m._id);
                      return (
                        <div
                          key={m._id}
                          onClick={() => {
                            setEditParticipantIds((prev) => {
                              const next = prev.includes(m._id)
                                ? prev.filter((id) => id !== m._id)
                                : [...prev, m._id];
                              setEditIsAllWorkspaceSelected(
                                next.length === editAvailableMembers.length && editAvailableMembers.length > 0
                              );
                              setEditIsProjectFilterActive(false);
                              return next;
                            });
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                            isSelected
                              ? "bg-blue-50/80 border-blue-200 text-slate-900"
                              : "bg-white border-slate-100 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {m.profilePicture ? (
                              <img
                                src={getMediaUrl(m.profilePicture)}
                                alt={m.name}
                                className="w-6 h-6 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {m.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">
                                {m.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                @{m.username} · {m.email}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* (C) Meeting Title & Description */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Meeting Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Sprint Planning & Retrospective"
                    className="h-10 rounded-xl text-xs sm:text-sm bg-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Meeting agenda, goals, and preparation notes..."
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* (D) Start Time & End Time (Past Time Restricted) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/70">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={editScheduledAt}
                    min={toLocalDatetimeInput(new Date())}
                    onChange={(e) => setEditScheduledAt(e.target.value)}
                    className="h-9 rounded-xl text-xs bg-white border-slate-200"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    Cannot be set to a past time.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    End Time <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <Input
                    type="datetime-local"
                    value={editEndTime}
                    min={editScheduledAt || toLocalDatetimeInput(new Date())}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="h-9 rounded-xl text-xs bg-white border-slate-200"
                  />
                  <p className="text-[10px] text-slate-400">
                    Leave empty for open-ended session.
                  </p>
                </div>
              </div>
            </form>

            {/* 3. Fixed Modal Footer */}
            <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl border-slate-200 text-slate-600 text-xs h-9 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-meeting-form"
                disabled={updateMeetingMutation.isPending || !editTitle.trim() || editParticipantIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-9 px-5 shadow-xs cursor-pointer"
              >
                {updateMeetingMutation.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving & Notifying...
                  </span>
                ) : (
                  "Save & Notify Members"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MEETING CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={() => cancelMeetingMutation.mutate()}
        isLoading={cancelMeetingMutation.isPending}
        variant="danger"
        title="Cancel This Meeting?"
        description="Are you sure you want to cancel this meeting? All participants will receive an email and in-app notification immediately. The meeting will be marked as Cancelled and nobody will be able to join."
        confirmText="Yes, Cancel Meeting"
      />

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={isRemoveConfirmOpen}
        onClose={() => setIsRemoveConfirmOpen(false)}
        onConfirm={confirmRemoveMeeting}
        isLoading={isRemoving}
        variant="danger"
        title="Delete Meeting Permanently?"
        description="Are you sure you want to delete this meeting? All recordings, action items, and transcripts will be permanently removed."
        confirmText="Delete Meeting"
      />
      </main>
    </div>
  );
}
