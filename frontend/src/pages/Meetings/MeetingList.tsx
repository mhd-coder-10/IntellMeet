// Lists all meetings of the logged in user with search, filtering, and real-time socket refresh
// Responsive full-width layout with refined slate aesthetic

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus,
  Loader2,
  Video,
  Search,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetingCard } from "@/components/Meetings/MeetingCard";
import { getMyMeetings } from "@/services/meetingService";
import { useSocket } from "@/hooks/useSocket";

export default function MeetingList() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "ongoing" | "scheduled" | "completed"
  >("all");

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: getMyMeetings,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 30 * 1000,
  });

  // Listen for socket events and refresh list
  useEffect(() => {
    if (!socket) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    };

    socket.on("meeting:user-joined", invalidate);
    socket.on("meeting:user-left", invalidate);
    socket.on("meeting:ended", invalidate);

    return () => {
      socket.off("meeting:user-joined", invalidate);
      socket.off("meeting:user-left", invalidate);
      socket.off("meeting:ended", invalidate);
    };
  }, [socket, queryClient]);

  // Filter & Search Meetings
  const filteredMeetings = useMemo(() => {
    if (!meetings) return [];

    return meetings.filter((m) => {
      const matchesSearch =
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.meetingCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description && m.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ? true : m.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [meetings, searchTerm, statusFilter]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100">
      <Header />

      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-1">
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-500">Meetings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              My Meetings
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                {meetings?.length || 0} Total
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Create, join, and manage your live video conferences and scheduled sessions.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <Link to="/meetings/join" className="w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-xl h-10 px-4"
              >
                <Search className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Join with Code
              </Button>
            </Link>

            <Link to="/meetings/create" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl h-10 px-4 shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                New Meeting
              </Button>
            </Link>
          </div>
        </div>

        {/* Search Bar & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, code, or description..."
              className="pl-10 h-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 rounded-xl text-xs placeholder:text-slate-400"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "ongoing", label: "Live Now" },
                { id: "scheduled", label: "Scheduled" },
                { id: "completed", label: "Completed" },
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 border border-slate-200/60"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 border border-slate-200/90 rounded-2xl bg-white shadow-xs">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-sm font-medium">Loading meetings...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="p-14 text-center rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mx-auto">
              <Video className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                {searchTerm || statusFilter !== "all"
                  ? "No matching meetings found"
                  : "No meetings yet"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm || statusFilter !== "all"
                  ? "Try changing your search term or filter status."
                  : "Get started by hosting your first meeting with high quality video and cloud recordings."}
              </p>
            </div>
            <Link to="/meetings/create">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-4 shadow-sm shadow-blue-500/20">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create Meeting
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMeetings.map((meeting) => (
              <MeetingCard key={meeting._id} meeting={meeting} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}