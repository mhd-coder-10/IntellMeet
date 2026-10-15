// Meetings List Page with 3 tabs: Upcoming, Past, and Analytics
// Completely removes meeting codes, provides countdowns for upcoming meetings, and visual analytics

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Loader2,
  Video,
  Search,
  RefreshCw,
  Calendar,
  History,
  BarChart3,
  Clock,
  Users,
  Award,
  TrendingUp,
  CalendarRange,
  Eye,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MeetingCard } from "@/components/Meetings/MeetingCard";
import { MeetingRow } from "@/components/Meetings/MeetingRow";
import { MeetingNotFoundModal } from "@/components/Meetings/MeetingNotFoundModal";
import { getMyMeetings, getMeetingAnalytics } from "@/services/meetingService";
import { useSocket } from "@/hooks/useSocket";
import type { Meeting, MeetingAnalyticsItem } from "@/types/meeting";

export default function MeetingList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "analytics">("upcoming");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // View Mode: "card" (grid) or "row" (horizontal list)
  const [viewMode, setViewMode] = useState<"card" | "row">("card");

  // Sub-filter for Upcoming tab: "all", "live", "upcoming"
  const [upcomingFilter, setUpcomingFilter] = useState<"all" | "live" | "upcoming">("all");

  // Sub-filter for Past tab: "all", "completed", "expired", "cancelled"
  const [pastFilter, setPastFilter] = useState<"all" | "completed" | "expired" | "cancelled">("all");

  // Top Date Range Filter state for Analytics tab: Today, This Week, This Month, Custom (Start - End), All
  const [analyticsDateFilter, setAnalyticsDateFilter] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [analyticsCustomStartDate, setAnalyticsCustomStartDate] = useState("");
  const [analyticsCustomEndDate, setAnalyticsCustomEndDate] = useState("");

  // Month Selection Dropdown state for Meeting Participation Breakdown
  const [breakdownSelectedMonth, setBreakdownSelectedMonth] = useState<string>("all");

  // Meeting Not Found Modal state when clicking view on a removed/deleted meeting
  const [notFoundMeetingTitle, setNotFoundMeetingTitle] = useState<string | null>(null);
  const [isNotFoundModalOpen, setIsNotFoundModalOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["meetings"] }),
        queryClient.invalidateQueries({ queryKey: ["meeting-analytics"] }),
      ]);
      toast.success("Meetings and analytics refreshed!");
    } catch {
      toast.error("Failed to refresh meetings");
    } finally {
      setIsRefreshing(false);
    }
  };

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: getMyMeetings,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 30 * 1000,
  });

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["meeting-analytics"],
    queryFn: getMeetingAnalytics,
    staleTime: 60 * 1000,
  });

  // Listen for socket events and refresh list
  useEffect(() => {
    if (!socket) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-analytics"] });
    };

    socket.on("meeting:created", invalidate);
    socket.on("meeting:updated", invalidate);
    socket.on("meeting:user-joined", invalidate);
    socket.on("meeting:user-left", invalidate);
    socket.on("meeting:cancelled", invalidate);
    socket.on("meeting:expired", invalidate);
    socket.on("meeting:ended", invalidate);

    return () => {
      socket.off("meeting:created", invalidate);
      socket.off("meeting:updated", invalidate);
      socket.off("meeting:cancelled", invalidate);
      socket.off("meeting:expired", invalidate);
      socket.off("meeting:user-joined", invalidate);
      socket.off("meeting:user-left", invalidate);
      socket.off("meeting:ended", invalidate);
    };
  }, [socket, queryClient]);

  // Separate upcoming/live meetings and past meetings
  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    if (!meetings) return { upcomingMeetings: [], pastMeetings: [] };

    const upcoming: Meeting[] = [];
    const past: Meeting[] = [];

    for (const m of meetings) {
      const isCancelled = m.status === "cancelled";
      const isExpired = m.status === "expired";
      const isCompleted = m.status === "completed" || Boolean(m.endedAt) || isCancelled || isExpired;
      if (isCompleted) {
        past.push(m);
      } else {
        upcoming.push(m);
      }
    }

    // Sort upcoming by start time ascending (earliest first)
    upcoming.sort((a, b) => {
      const timeA = new Date(a.startTime || a.scheduledAt || a.createdAt).getTime();
      const timeB = new Date(b.startTime || b.scheduledAt || b.createdAt).getTime();
      return timeA - timeB;
    });

    // Sort past by endedAt / startTime descending (latest first)
    past.sort((a, b) => {
      const timeA = new Date(a.endedAt || a.startTime || a.createdAt).getTime();
      const timeB = new Date(b.endedAt || b.startTime || b.createdAt).getTime();
      return timeB - timeA;
    });

    return { upcomingMeetings: upcoming, pastMeetings: past };
  }, [meetings]);

  // Counts for Upcoming & Live sub-filters
  const upcomingFilterCounts = useMemo(() => {
    const nowMs = Date.now();
    let live = 0;
    let upcoming = 0;
    for (const m of upcomingMeetings) {
      const startMs = new Date(m.startTime || m.scheduledAt).getTime();
      const isLive = m.status === "ongoing" || nowMs >= startMs;
      if (isLive) live++;
      else upcoming++;
    }
    return { all: upcomingMeetings.length, live, upcoming };
  }, [upcomingMeetings]);

  // Counts for Past sub-filters
  const pastFilterCounts = useMemo(() => {
    let completed = 0;
    let expired = 0;
    let cancelled = 0;
    for (const m of pastMeetings) {
      if (m.status === "cancelled") cancelled++;
      else if (m.status === "expired") expired++;
      else completed++;
    }
    return { all: pastMeetings.length, completed, expired, cancelled };
  }, [pastMeetings]);

  // Filter current list based on sub-filters (Live vs Upcoming for Tab 1, Completed vs Expired vs Cancelled for Tab 2) and search term
  const displayedMeetings = useMemo(() => {
    let list: Meeting[] = [];
    const nowMs = Date.now();

    if (activeTab === "upcoming") {
      list = upcomingMeetings.filter((m) => {
        const startMs = new Date(m.startTime || m.scheduledAt).getTime();
        const isLive = m.status === "ongoing" || nowMs >= startMs;
        if (upcomingFilter === "live") return isLive;
        if (upcomingFilter === "upcoming") return !isLive;
        return true;
      });
    } else if (activeTab === "past") {
      list = pastMeetings.filter((m) => {
        if (pastFilter === "completed") {
          return m.status === "completed" || (Boolean(m.endedAt) && m.status !== "expired" && m.status !== "cancelled");
        }
        if (pastFilter === "expired") return m.status === "expired";
        if (pastFilter === "cancelled") return m.status === "cancelled";
        return true;
      });
    }

    if (!searchTerm.trim()) return list;

    const q = searchTerm.toLowerCase();
    return list.filter((m) => {
      const titleMatch = m.title.toLowerCase().includes(q);
      const descMatch = m.description && m.description.toLowerCase().includes(q);
      const workspaceMatch = m.workspace && m.workspace.name.toLowerCase().includes(q);
      const projectMatch = m.project && m.project.name.toLowerCase().includes(q);
      return titleMatch || descMatch || workspaceMatch || projectMatch;
    });
  }, [activeTab, upcomingMeetings, pastMeetings, upcomingFilter, pastFilter, searchTerm]);

  // Helper: Format seconds into suitable h:m:s format
  const formatDurationHms = (totalSeconds: number): string => {
    if (!totalSeconds || totalSeconds <= 0) return "00m 00s";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
    }
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  };

  // Filter analytics meetings according to top date range filter (All, Today, This Week, This Month, Custom)
  const filteredAnalyticsMeetings = useMemo(() => {
    const all = analytics?.meetings || [];
    if (analyticsDateFilter === "all") return all;

    const now = new Date();
    return all.filter((m) => {
      const mDate = new Date(m.startTime);
      if (analyticsDateFilter === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return mDate >= startOfToday && mDate <= endOfToday;
      }
      if (analyticsDateFilter === "week") {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        startOfWeek.setHours(0, 0, 0, 0);
        return mDate >= startOfWeek;
      }
      if (analyticsDateFilter === "month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        return mDate >= startOfMonth && mDate <= endOfMonth;
      }
      if (analyticsDateFilter === "custom") {
        if (analyticsCustomStartDate && mDate < new Date(analyticsCustomStartDate + "T00:00:00")) return false;
        if (analyticsCustomEndDate && mDate > new Date(analyticsCustomEndDate + "T23:59:59.999")) return false;
        return true;
      }
      return true;
    });
  }, [analytics?.meetings, analyticsDateFilter, analyticsCustomStartDate, analyticsCustomEndDate]);

  // Recalculate summary metrics dynamically based on filtered meetings
  const summaryStats = useMemo(() => {
    let timeSpentSeconds = 0;
    let assignedCount = 0;
    let joinedCount = 0;
    let hostedCount = 0;

    for (const m of filteredAnalyticsMeetings) {
      if (m.status !== "cancelled") {
        assignedCount++;
      }
      if (m.participationStatus === "present" || m.participationStatus === "hosted") {
        joinedCount++;
        timeSpentSeconds += m.userDurationSeconds || 0;
      }
      if (m.isHost && (m.participationStatus === "hosted" || m.participationStatus === "present")) {
        hostedCount++;
      }
    }

    const attendanceRate = assignedCount > 0 ? Math.round((joinedCount / assignedCount) * 100) : 100;

    return {
      timeSpentSeconds,
      assignedCount,
      joinedCount,
      hostedCount,
      attendanceRate,
    };
  }, [filteredAnalyticsMeetings]);

  // Distinct months available in the filtered dataset for the breakdown dropdown
  const availableMonths = useMemo(() => {
    const months: string[] = [];
    filteredAnalyticsMeetings.forEach((m) => {
      if (m.monthName && !months.includes(m.monthName)) {
        months.push(m.monthName);
      }
    });
    return months;
  }, [filteredAnalyticsMeetings]);

  // Filter breakdown meetings by selected month
  const breakdownMeetings = useMemo(() => {
    if (breakdownSelectedMonth === "all") return filteredAnalyticsMeetings;
    return filteredAnalyticsMeetings.filter((m) => m.monthName === breakdownSelectedMonth);
  }, [filteredAnalyticsMeetings, breakdownSelectedMonth]);

  // Handle clicking view on a meeting item
  const handleViewMeeting = (m: MeetingAnalyticsItem) => {
    if (!m.isAccessible) {
      setNotFoundMeetingTitle(m.title);
      setIsNotFoundModalOpen(true);
    } else {
      navigate(`/meetings/${m._id}/details`);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0">
      <main className="w-full px-4 sm:px-6 md:px-8 py-5 sm:py-8 space-y-6 min-w-0">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-1">
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-500">Meetings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              Workspace Meetings
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                {meetings?.length || 0} Total
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Schedule, launch, and review team conferences tied to your workspaces and projects.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-xl h-10 px-4 cursor-pointer"
              title="Refresh meetings"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              Refresh
            </Button>

            <Link to="/meetings/create">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-10 px-4 shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer">
                <Plus className="h-4 w-4" />
                Schedule Meeting
              </Button>
            </Link>
          </div>
        </div>

        {/* 3 Main Tabs: Upcoming, Past, Analytics */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 max-w-full min-w-0">
          {/* Scrollable Tabs Wrapper for Mobile & Desktop */}
          <div className="w-full sm:w-auto max-w-full overflow-x-auto scrollbar-none pb-1 sm:pb-0 -mx-1 px-1">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-max sm:w-fit">
              <button
                onClick={() => setActiveTab("upcoming")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === "upcoming"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Upcoming & Live</span>
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                  activeTab === "upcoming" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-700"
                }`}>
                  {upcomingMeetings.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("past")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === "past"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <History className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Past Meetings</span>
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                  activeTab === "past" ? "bg-purple-100 text-purple-800" : "bg-slate-200 text-slate-700"
                }`}>
                  {pastMeetings.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("analytics")}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  activeTab === "analytics"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Analytics</span>
              </button>
            </div>
          </div>

          {/* Controls bar: Sub-filters + Search + View Mode toggle */}
          {activeTab !== "analytics" ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              {/* Sub-filter dropdown for Upcoming tab: Live vs Upcoming */}
              {activeTab === "upcoming" && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-700">Filter:</span>
                  <select
                    value={upcomingFilter}
                    onChange={(e) => setUpcomingFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-slate-800 cursor-pointer outline-none"
                  >
                    <option value="all">All ({upcomingFilterCounts.all})</option>
                    <option value="live">Live Calls ({upcomingFilterCounts.live})</option>
                    <option value="upcoming">Upcoming Only ({upcomingFilterCounts.upcoming})</option>
                  </select>
                </div>
              )}

              {/* Sub-filter dropdown for Past tab: Completed, Expired, Cancelled */}
              {activeTab === "past" && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs font-bold text-slate-700">Status:</span>
                  <select
                    value={pastFilter}
                    onChange={(e) => setPastFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-slate-800 cursor-pointer outline-none"
                  >
                    <option value="all">All Past ({pastFilterCounts.all})</option>
                    <option value="completed">Completed ({pastFilterCounts.completed})</option>
                    <option value="expired">Expired ({pastFilterCounts.expired})</option>
                    <option value="cancelled">Cancelled ({pastFilterCounts.cancelled})</option>
                  </select>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative flex-1 sm:w-64 min-w-[150px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search meetings..."
                  className="pl-9 h-9 bg-white border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 rounded-xl text-xs placeholder:text-slate-400 shadow-2xs w-full"
                />
              </div>

              {/* View Mode Toggle: Card vs Row */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0 ml-auto sm:ml-0">
                <button
                  type="button"
                  onClick={() => setViewMode("card")}
                  title="Card Grid View"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "card"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("row")}
                  title="Row / List View"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "row"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Top Date Range Filter bar (when activeTab === 'analytics') */
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <CalendarRange className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-700">Period:</span>
                <select
                  value={analyticsDateFilter}
                  onChange={(e) => setAnalyticsDateFilter(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-800 cursor-pointer outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {analyticsDateFilter === "custom" && (
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs animate-in fade-in duration-150">
                  <Input
                    type="date"
                    value={analyticsCustomStartDate}
                    onChange={(e) => setAnalyticsCustomStartDate(e.target.value)}
                    className="h-8 text-[11px] px-2 rounded-lg border-slate-200 bg-slate-50 text-slate-700 w-32"
                  />
                  <span className="text-[11px] text-slate-400 font-medium">to</span>
                  <Input
                    type="date"
                    value={analyticsCustomEndDate}
                    onChange={(e) => setAnalyticsCustomEndDate(e.target.value)}
                    className="h-8 text-[11px] px-2 rounded-lg border-slate-200 bg-slate-50 text-slate-700 w-32"
                  />
                </div>
              )}

              {/* View Mode Toggle: Card vs Row in Analytics tab */}
              <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("card")}
                  title="Card Grid View"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "card"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("row")}
                  title="Row / List View"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === "row"
                      ? "bg-white text-blue-600 shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* TAB 1 & 2: UPCOMING & PAST CONTENT */}
        {activeTab !== "analytics" ? (
          isLoading ? (
            <div className="p-16 text-center text-slate-500 border border-slate-200/90 rounded-2xl bg-white shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm font-medium">Loading workspace meetings...</p>
            </div>
          ) : displayedMeetings.length === 0 ? (
            <div className="p-14 text-center rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
                <Video className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">
                  {searchTerm
                    ? "No matching meetings found"
                    : activeTab === "upcoming"
                    ? "No upcoming meetings scheduled"
                    : "No past meetings completed yet"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchTerm
                    ? "Try searching for a different keyword or workspace name."
                    : activeTab === "upcoming"
                    ? "Create your first workspace meeting to invite colleagues and schedule calls."
                    : "Completed meetings, recordings, and AI summaries will appear here."}
                </p>
              </div>
              {activeTab === "upcoming" && (
                <Link to="/meetings/create">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-4 shadow-sm shadow-blue-500/20">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Schedule Meeting
                  </Button>
                </Link>
              )}
            </div>
          ) : viewMode === "card" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedMeetings.map((meeting) => (
                <MeetingCard key={meeting._id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedMeetings.map((meeting) => (
                <MeetingRow key={meeting._id} meeting={meeting} />
              ))}
            </div>
          )
        ) : (
          /* TAB 3: ANALYTICS CONTENT */
          <div className="space-y-6">
            {isLoadingAnalytics ? (
              <div className="p-16 text-center text-slate-500 border border-slate-200/90 rounded-2xl bg-white shadow-xs">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm font-medium">Calculating meeting analytics...</p>
              </div>
            ) : (
              <>
                {/* 4 Analytics Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Time in Meetings */}
                  <Card className="rounded-2xl border-slate-200/90 bg-white p-5 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Time in Meetings
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {formatDurationHms(summaryStats.timeSpentSeconds)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Total duration across all sessions & rejoins
                      </p>
                    </div>
                  </Card>

                  {/* Card 2: Meetings Joined */}
                  <Card className="rounded-2xl border-slate-200/90 bg-white p-5 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Meetings Joined
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {summaryStats.joinedCount}{" "}
                        <span className="text-base font-medium text-slate-400">
                          / {summaryStats.assignedCount}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {summaryStats.joinedCount} joined out of {summaryStats.assignedCount} assigned
                      </p>
                    </div>
                  </Card>

                  {/* Card 3: Attendance Rate */}
                  <Card className="rounded-2xl border-slate-200/90 bg-white p-5 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Attendance Rate
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {summaryStats.attendanceRate}%
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Calculated from joined vs assigned meetings
                      </p>
                    </div>
                  </Card>

                  {/* Card 4: Meetings Hosted */}
                  <Card className="rounded-2xl border-slate-200/90 bg-white p-5 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Meetings Hosted
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Award className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {summaryStats.hostedCount}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Sessions where you were the host
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Meeting Participation Breakdown Card with Month Selection Dropdown */}
                <Card className="rounded-2xl border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Meeting Participation Breakdown
                      </h3>
                      <p className="text-xs text-slate-500">
                        Individual meeting attendance status and time in calls
                      </p>
                    </div>

                    {/* Month Selection Dropdown */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">Month:</span>
                      <select
                        value={breakdownSelectedMonth}
                        onChange={(e) => setBreakdownSelectedMonth(e.target.value)}
                        className="h-8 px-3 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer outline-none focus:border-blue-500"
                      >
                        <option value="all">All Months ({filteredAnalyticsMeetings.length})</option>
                        {availableMonths.map((m) => (
                          <option key={m} value={m}>
                            {m} ({filteredAnalyticsMeetings.filter((item) => item.monthName === m).length})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Individual Meeting Cards or Rows */}
                  {breakdownMeetings.length > 0 ? (
                    viewMode === "card" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {breakdownMeetings.map((item) => {
                          const isAttended =
                            item.participationStatus === "present" || item.participationStatus === "hosted";
                          return (
                            <div
                              key={item._id}
                              className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all space-y-3"
                            >
                              {/* Header: Title and View Button */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5 min-w-0">
                                  <h4
                                    className="text-xs font-bold text-slate-900 truncate"
                                    title={item.title}
                                  >
                                    {item.title}
                                  </h4>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {item.workspace?.name && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 truncate max-w-[110px]">
                                        {item.workspace.name}
                                      </span>
                                    )}
                                    {item.project?.name && (
                                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-100/70 text-blue-800 truncate max-w-[110px]">
                                        {item.project.name}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* View Icon Button */}
                                <button
                                  onClick={() => handleViewMeeting(item)}
                                  title={
                                    item.isAccessible
                                      ? "View Meeting Details"
                                      : "Meeting Removed or Deleted"
                                  }
                                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 text-slate-500 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Scheduled Date */}
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  {new Date(item.startTime).toLocaleString("default", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              {/* Status Badge & Time in Meeting */}
                              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                                {/* Status Badge */}
                                {item.participationStatus === "present" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ● Present
                                  </span>
                                ) : item.participationStatus === "hosted" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                    ● Hosted
                                  </span>
                                ) : item.participationStatus === "absent" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                    ● Absent
                                  </span>
                                ) : item.participationStatus === "cancelled" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    ● Cancelled
                                  </span>
                                ) : item.participationStatus === "expired" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600 border border-slate-300">
                                    ● Expired
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    ● Scheduled
                                  </span>
                                )}

                                {/* Time Spent in Call */}
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {isAttended
                                      ? formatDurationHms(item.userDurationSeconds)
                                      : "00m 00s"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Breakdown Row View */
                      <div className="space-y-2.5">
                        {breakdownMeetings.map((item) => {
                          const isAttended =
                            item.participationStatus === "present" || item.participationStatus === "hosted";
                          return (
                            <div
                              key={item._id}
                              className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4
                                    className="text-xs font-bold text-slate-900 truncate"
                                    title={item.title}
                                  >
                                    {item.title}
                                  </h4>
                                  {item.workspace?.name && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 truncate max-w-[110px]">
                                      {item.workspace.name}
                                    </span>
                                  )}
                                  {item.project?.name && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-blue-100/70 text-blue-800 truncate max-w-[110px]">
                                      {item.project.name}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>
                                    {new Date(item.startTime).toLocaleString("default", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {/* Status Badge */}
                                {item.participationStatus === "present" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ● Present
                                  </span>
                                ) : item.participationStatus === "hosted" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                    ● Hosted
                                  </span>
                                ) : item.participationStatus === "absent" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                    ● Absent
                                  </span>
                                ) : item.participationStatus === "cancelled" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    ● Cancelled
                                  </span>
                                ) : item.participationStatus === "expired" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600 border border-slate-300">
                                    ● Expired
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    ● Scheduled
                                  </span>
                                )}

                                {/* Time in Meeting */}
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 min-w-[70px]">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {isAttended
                                      ? formatDurationHms(item.userDurationSeconds)
                                      : "00m 00s"}
                                  </span>
                                </div>

                                {/* View Button */}
                                <button
                                  onClick={() => handleViewMeeting(item)}
                                  title={
                                    item.isAccessible
                                      ? "View Meeting Details"
                                      : "Meeting Removed or Deleted"
                                  }
                                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 text-slate-500 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-xl text-xs text-slate-500">
                      No meetings found for the selected time range and month.
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </main>

      {/* Meeting Not Found Modal when viewing removed/deleted meetings */}
      <MeetingNotFoundModal
        isOpen={isNotFoundModalOpen}
        onClose={() => {
          setIsNotFoundModalOpen(false);
          setNotFoundMeetingTitle(null);
        }}
        meetingTitle={notFoundMeetingTitle || undefined}
      />
    </div>
  );
}