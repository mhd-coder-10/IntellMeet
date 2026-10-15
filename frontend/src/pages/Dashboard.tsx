// Enterprise Dashboard for IntellMeet
// Displays user identity, workspace shortcuts, and "Your Upcoming Meetings" (Today, Tomorrow, This Week)
// with conditional real-time join controls and zero meeting codes

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Video,
  Plus,
  Calendar,
  ArrowRight,
  Sparkles,
  Settings,
  Info,
  Loader2,
  RefreshCw,
  FolderKanban,
  Clock,
  Briefcase,
  Layers,
  Users,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import {
  getMyMeetings,
  hideMeeting,
  deleteMeeting,
} from "@/services/meetingService";
import { getErrorMessage } from "@/utils/errorHelper";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { useSocket } from "@/hooks/useSocket";
import type { Meeting } from "@/types/meeting";

// Helper to determine day group
const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const getMeetingDayGroup = (dateInput: string | Date) => {
  const date = new Date(dateInput);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (isSameDay(date, today)) return "today";
  if (isSameDay(date, tomorrow)) return "tomorrow";

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays <= 7 && diffDays > 0) return "thisWeek";
  return "later";
};

// Countdown text helper
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

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [now, setNow] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { socket } = useSocket();

  // Auto-tick every 10 seconds to auto-enable Join button when start time arrives
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Real-time synchronization when meetings are scheduled, updated, or ended
  useEffect(() => {
    if (!socket) return;

    const handleSync = () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    };

    socket.on("meeting:created", handleSync);
    socket.on("meeting:updated", handleSync);
    socket.on("meeting:cancelled", handleSync);
    socket.on("meeting:expired", handleSync);
    socket.on("meeting:ended", handleSync);
    socket.on("notification:new", handleSync);

    return () => {
      socket.off("meeting:created", handleSync);
      socket.off("meeting:updated", handleSync);
      socket.off("meeting:cancelled", handleSync);
      socket.off("meeting:expired", handleSync);
      socket.off("meeting:ended", handleSync);
      socket.off("notification:new", handleSync);
    };
  }, [socket, queryClient]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
        queryClient.invalidateQueries({ queryKey: ["userProfile"] }),
      ]);
      toast.success("Dashboard refreshed!");
    } catch {
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch user's meetings
  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: getMyMeetings,
    staleTime: 30 * 1000,
  });

  const [meetingToRemove, setMeetingToRemove] = useState<{
    id: string;
    isHost: boolean;
    title: string;
  } | null>(null);

  const confirmRemoveMeeting = async () => {
    if (!meetingToRemove) return;
    setRemovingId(meetingToRemove.id);
    try {
      if (meetingToRemove.isHost) {
        await deleteMeeting(meetingToRemove.id);
        toast.success("Meeting deleted permanently");
      } else {
        await hideMeeting(meetingToRemove.id);
        toast.success("Meeting removed from your dashboard");
      }
      setMeetingToRemove(null);
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  // Group upcoming meetings into Today, Tomorrow, This Week, and Later
  const { todayMeetings, tomorrowMeetings, thisWeekMeetings, otherUpcoming } = useMemo(() => {
    if (!meetings) return { todayMeetings: [], tomorrowMeetings: [], thisWeekMeetings: [], otherUpcoming: [] };

    const upcoming = meetings.filter(
      (m) => m.status !== "completed" && m.status !== "cancelled" && m.status !== "expired" && !m.endedAt
    );
    upcoming.sort((a, b) => {
      const timeA = new Date(a.startTime || a.scheduledAt || a.createdAt).getTime();
      const timeB = new Date(b.startTime || b.scheduledAt || b.createdAt).getTime();
      return timeA - timeB;
    });

    const today: Meeting[] = [];
    const tomorrow: Meeting[] = [];
    const thisWeek: Meeting[] = [];
    const later: Meeting[] = [];

    upcoming.forEach((m) => {
      const group = getMeetingDayGroup(m.startTime || m.scheduledAt || m.createdAt);
      if (group === "today") today.push(m);
      else if (group === "tomorrow") tomorrow.push(m);
      else if (group === "thisWeek") thisWeek.push(m);
      else later.push(m);
    });

    return {
      todayMeetings: today,
      tomorrowMeetings: tomorrow,
      thisWeekMeetings: thisWeek,
      otherUpcoming: later,
    };
  }, [meetings]);

  const totalUpcomingCount =
    todayMeetings.length + tomorrowMeetings.length + thisWeekMeetings.length + otherUpcoming.length;

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Helper renderer for an upcoming meeting card
  const renderMeetingRow = (meeting: Meeting) => {
    const isHost = meeting.host?._id === user?.id;
    const startMs = new Date(meeting.startTime || meeting.scheduledAt).getTime();
    const isFuture = now < startMs;
    const isLive = !isFuture;

    const formattedTime = new Date(meeting.startTime || meeting.scheduledAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const endTimeFormatted = meeting.endTime
      ? new Date(meeting.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Open-ended";

    const participantCount = (meeting.participants?.length || 0) + 1;

    return (
      <div
        key={meeting._id}
        className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 text-base truncate">
              {meeting.title}
            </h3>

            {/* Status Indicator */}
            {isLive ? (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                LIVE NOW
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                {getCountdownText(startMs, now)}
              </span>
            )}

            {isHost ? (
              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                Host
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                Participant
              </span>
            )}
          </div>

          {/* Workspace, Project, and Schedule Context */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 pt-0.5">
            <span className="flex items-center gap-1 font-medium text-slate-700">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              {formattedTime} — {endTimeFormatted}
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

            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {participantCount} {participantCount === 1 ? "member" : "members"}
            </span>
          </div>

          {meeting.description && (
            <p className="text-xs text-slate-500 line-clamp-1 pt-0.5">
              {meeting.description}
            </p>
          )}
        </div>

        {/* Action Controls: Join & Details */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link to={`/meetings/${meeting._id}/details`}>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs h-9 px-3.5 font-medium cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 mr-1 text-blue-600" />
              Details
            </Button>
          </Link>

          {/* Conditional Join Button */}
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
              title={`Meeting starts at ${formattedTime}`}
              className="bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs h-9 px-4 font-medium opacity-80 cursor-not-allowed"
            >
              <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              Starts at {formattedTime}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0">
      <main className="w-full px-4 sm:px-6 md:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 min-w-0">
        {/* Top Welcome & Identity Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-5 sm:p-8 lg:p-10 shadow-xs">
          <div className="absolute top-0 right-1/4 w-80 h-80 rounded-full bg-blue-400/10 blur-[90px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-indigo-400/10 blur-[90px] pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
              <Link to="/profile" className="relative group shrink-0" title="Manage Profile">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-xl sm:text-2xl font-bold shadow-md shadow-blue-500/15 group-hover:scale-105 transition transform">
                  {user?.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-blue-600 border border-white text-white flex items-center justify-center shadow">
                  <Settings className="w-3.5 h-3.5" />
                </div>
              </Link>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Welcome, {user?.name || "Member"}!
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-blue-100/70 text-blue-700 border border-blue-200">
                    <Sparkles className="w-3 h-3" />
                    AI Workspace
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-x-2">
                  <span className="font-mono text-slate-800 font-semibold">@{user?.username}</span>
                  <span>•</span>
                  <span>{user?.email}</span>
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                    {user?.role === "admin" ? "Workspace Admin" : "Team Member"}
                  </span>
                  <Link
                    to="/profile"
                    className="text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1"
                  >
                    <span>Edit Profile</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link to="/meetings/create" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm shadow-blue-500/20 px-5 py-2.5 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <Plus className="w-4 h-4" />
                  Schedule Meeting
                </Button>
              </Link>

              <Link to="/teams" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-5 py-2.5 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FolderKanban className="w-4 h-4 text-indigo-600" />
                  Workspaces
                </Button>
              </Link>

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full sm:w-auto border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-2.5 font-medium text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                title="Refresh dashboard data"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : "text-slate-500"}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          <Link to="/meetings/create" className="group">
            <Card className="h-full border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs cursor-pointer">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition transform">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base group-hover:text-blue-600 transition">
                    Schedule Meeting
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Create a workspace meeting with all members or specific project teammates.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/teams" className="group">
            <Card className="h-full border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-indigo-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs cursor-pointer">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-105 transition transform">
                  <FolderKanban className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base group-hover:text-indigo-600 transition">
                    Workspaces & Boards
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Collaborate with teammates on real-time Kanban sprint boards and action items.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/meetings" className="group">
            <Card className="h-full border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-purple-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs cursor-pointer">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-105 transition transform">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base group-hover:text-purple-600 transition">
                    Meetings & Analytics
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    View upcoming schedules, past recordings, attendance percentage, and call hours.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* SECTION 11: YOUR UPCOMING MEETINGS (Today, Tomorrow, Week) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200/90 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Your Upcoming Meetings
                </h2>
                <p className="text-xs text-slate-500">
                  {totalUpcomingCount} session(s) scheduled on your workspace calendar
                </p>
              </div>
            </div>

            <Link
              to="/meetings"
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View All Meetings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-500 border border-slate-200/90 rounded-2xl bg-white shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm font-medium">Loading upcoming meetings...</p>
            </div>
          ) : totalUpcomingCount === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">
                  No upcoming meetings scheduled
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  You are all caught up! Schedule a new workspace meeting to invite colleagues and sync with team members.
                </p>
              </div>
              <Link to="/meetings/create">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-4 shadow-sm shadow-blue-500/20">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Schedule First Meeting
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* GROUP 1: TODAY */}
              {todayMeetings.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>Today ({todayMeetings.length})</span>
                  </div>
                  <div className="space-y-3">
                    {todayMeetings.map((meeting) => renderMeetingRow(meeting))}
                  </div>
                </div>
              )}

              {/* GROUP 2: TOMORROW */}
              {tomorrowMeetings.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span>Tomorrow ({tomorrowMeetings.length})</span>
                  </div>
                  <div className="space-y-3">
                    {tomorrowMeetings.map((meeting) => renderMeetingRow(meeting))}
                  </div>
                </div>
              )}

              {/* GROUP 3: LATER THIS WEEK */}
              {thisWeekMeetings.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Later This Week ({thisWeekMeetings.length})</span>
                  </div>
                  <div className="space-y-3">
                    {thisWeekMeetings.map((meeting) => renderMeetingRow(meeting))}
                  </div>
                </div>
              )}

              {/* GROUP 4: LATER */}
              {otherUpcoming.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>Upcoming ({otherUpcoming.length})</span>
                  </div>
                  <div className="space-y-3">
                    {otherUpcoming.map((meeting) => renderMeetingRow(meeting))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete / Remove Modal */}
        <ConfirmModal
          isOpen={Boolean(meetingToRemove)}
          onClose={() => setMeetingToRemove(null)}
          onConfirm={confirmRemoveMeeting}
          isLoading={Boolean(removingId)}
          variant="danger"
          title={meetingToRemove?.isHost ? "Delete Meeting Permanently?" : "Remove Meeting from Dashboard?"}
          description={`Are you sure you want to remove "${meetingToRemove?.title}"?`}
          confirmText={meetingToRemove?.isHost ? "Delete" : "Remove"}
        />
      </main>
    </div>
  );
}