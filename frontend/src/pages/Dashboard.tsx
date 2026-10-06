// Enterprise Dashboard for IntelliMeet
// Responsive layout, balanced slate aesthetic, quick room join, and meeting overview

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Video,
  Plus,
  Search,
  Calendar,
  Copy,
  ArrowRight,
  Sparkles,
  Radio,
  Settings,
  ShieldCheck,
  Info,
  Trash2,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/common/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import {
  getMyMeetings,
  joinMeeting,
  getMeetingByCode,
  hideMeeting,
  deleteMeeting,
} from "@/services/meetingService";
import { getErrorMessage } from "@/utils/errorHelper";

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Quick Join Code State
  const [quickCode, setQuickCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Fetch recent meetings
  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings"],
    queryFn: getMyMeetings,
    staleTime: 30 * 1000,
  });

  const handleRemoveMeeting = async (meetingId: string, isHostMeeting: boolean) => {
    if (
      !confirm(
        "Remove this meeting from your dashboard? You will lose access to its details."
      )
    ) {
      return;
    }
    setRemovingId(meetingId);
    try {
      if (isHostMeeting) {
        await deleteMeeting(meetingId);
        toast.success("Meeting deleted permanently");
      } else {
        await hideMeeting(meetingId);
        toast.success("Meeting removed from your dashboard");
      }
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  // Handle Quick Join
  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = quickCode.trim().toUpperCase();
    if (!cleanCode) {
      toast.error("Please enter a meeting code");
      return;
    }

    setIsJoining(true);
    try {
      const meeting = await getMeetingByCode(cleanCode);
      await joinMeeting(meeting._id);
      toast.success("Joined meeting successfully!");
      navigate(`/meetings/${meeting._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsJoining(false);
    }
  };

  // Copy Meeting Code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Meeting code ${code} copied to clipboard!`);
  };

  const recentMeetings = meetings?.slice(0, 4) || [];

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased selection:bg-blue-100">
      <Header />

      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Top Welcome & Identity Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-5 sm:p-8 lg:p-10 shadow-xs">
          {/* Subtle Ambient Glow */}
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
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm shadow-blue-500/20 px-5 py-2.5 font-semibold text-sm flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Meeting
                </Button>
              </Link>

              <Link to="/meetings/join" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-5 py-2.5 font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4 text-emerald-600" />
                  Join Room
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Join Widget & System Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Quick Join Bar Card */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Quick Room Join</span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Instant WebRTC Connection
              </span>
            </div>

            <form onSubmit={handleQuickJoin} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <Input
                  value={quickCode}
                  onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-digit Meeting Code (e.g. ABC12345)"
                  className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 font-mono tracking-wider text-sm rounded-xl"
                  maxLength={10}
                />
              </div>
              <Button
                type="submit"
                disabled={isJoining || !quickCode.trim()}
                className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-xs"
              >
                {isJoining ? "Connecting..." : "Join Now"}
              </Button>
            </form>
          </div>

          {/* Account Status Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                Account Status
              </span>
              <h3 className="text-slate-900 font-bold text-base sm:text-lg flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Verified & Active
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Encrypted WebRTC conferencing and secure cloud storage enabled.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-slate-100 text-xs">
              <span className="text-slate-500">Total Hosted Meetings:</span>
              <span className="text-slate-900 font-bold font-mono text-sm">
                {meetings?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <Link to="/meetings/create" className="group">
            <Card className="h-full border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-blue-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs cursor-pointer">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition transform">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base group-hover:text-blue-600 transition">
                    Start New Meeting
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Instant video call with screen sharing, participant grid, and MP4 composite recording.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/meetings/join" className="group">
            <Card className="h-full border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-emerald-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs cursor-pointer">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition transform">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base group-hover:text-emerald-600 transition">
                    Join a Room
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Enter an invitation code to enter an active or scheduled conference room.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/meetings" className="group sm:col-span-2 lg:col-span-1">
            <Card className="h-full border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-purple-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs cursor-pointer">
              <CardContent className="p-5 sm:p-6 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-105 transition transform">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-slate-900 font-bold text-base group-hover:text-purple-600 transition">
                    Meeting History
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    View upcoming, live, and completed meetings with full attendance details.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent & Upcoming Meetings List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Recent & Upcoming Meetings
              </h2>
            </div>
            <Link
              to="/meetings"
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View All ({meetings?.length || 0})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-slate-500 border border-slate-200/90 rounded-2xl bg-white shadow-xs">
              <div className="inline-block animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mb-3" />
              <p className="text-sm font-medium">Loading your meetings...</p>
            </div>
          ) : recentMeetings.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-slate-200/90 bg-white shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                <Video className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">No meetings created yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Start your first meeting to collaborate with team members using live video, audio, and MP4 recording.
                </p>
              </div>
              <Link to="/meetings/create">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs px-4 shadow-sm shadow-blue-500/20">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Create First Meeting
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentMeetings.map((meeting) => {
                const isHost = meeting.host._id === user?.id;
                const isOngoing = meeting.status === "ongoing";

                return (
                  <div
                    key={meeting._id}
                    className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md transition shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base truncate max-w-[200px] sm:max-w-xs">
                            {meeting.title}
                          </h3>
                          {isHost && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              Host
                            </span>
                          )}
                        </div>
                        {meeting.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {meeting.description}
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                          isOngoing
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : meeting.status === "completed"
                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {meeting.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Code:</span>
                        <button
                          onClick={() => handleCopyCode(meeting.meetingCode)}
                          className="font-mono text-blue-700 hover:text-blue-800 font-bold flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                          title="Copy meeting code"
                        >
                          {meeting.meetingCode}
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Link to={`/meetings/${meeting._id}/details`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs px-2.5 h-8 font-medium"
                          >
                            <Info className="w-3.5 h-3.5 mr-1 text-blue-600" />
                            Details
                          </Button>
                        </Link>

                        {meeting.status === "completed" || meeting.status === "cancelled" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveMeeting(meeting._id, isHost)}
                            disabled={removingId === meeting._id}
                            className="border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs px-2.5 h-8 font-medium"
                          >
                            {removingId === meeting._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Remove
                          </Button>
                        ) : (
                          <Link to={`/meetings/${meeting._id}`}>
                            <Button
                              size="sm"
                              className={`${
                                isOngoing
                                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-xs"
                                  : "bg-blue-600 hover:bg-blue-700 shadow-xs"
                              } text-white rounded-xl text-xs px-3.5 h-8 font-medium`}
                            >
                              <Video className="w-3.5 h-3.5 mr-1" />
                              {isOngoing ? "Enter Call" : isHost ? "Start Meeting" : "Join"}
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}