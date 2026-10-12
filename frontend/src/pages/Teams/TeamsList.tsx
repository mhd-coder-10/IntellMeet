// Teams & Workspaces List Page
// Enterprise workspaces dashboard with team creation, invite codes, and project board links

import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Search,
  KeyRound,
  RefreshCw,
  FolderKanban,
  Copy,
  Check,
  ArrowRight,
  Loader2,
  Building2,
  X,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  getUserTeams,
  createTeam,
  joinTeamByCode,
  cancelJoinRequest,
} from "@/services/teamService";
import { useAuthStore } from "@/store/authStore";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import type { Team } from "@/types/team";

const colorThemes: Record<string, { bg: string; border: string; text: string; badge: string; gradient: string }> = {
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    gradient: "from-indigo-600 to-blue-600",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    gradient: "from-blue-600 to-cyan-600",
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    gradient: "from-emerald-600 to-teal-600",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    gradient: "from-purple-600 to-pink-600",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    gradient: "from-amber-500 to-orange-600",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    gradient: "from-rose-600 to-red-600",
  },
};

export default function TeamsList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);

  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [cancelRequestTeam, setCancelRequestTeam] = useState<{
    id: string;
    name: string;
    type: "cancel" | "remove";
  } | null>(null);

  // Create Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("indigo");

  // Join Form State
  const [joinCode, setJoinCode] = useState("");

  // Fetch all user teams
  const { data: teams, isLoading } = useQuery<Team[]>({
    queryKey: ["userTeams"],
    queryFn: getUserTeams,
    staleTime: 10 * 1000,
  });

  // Create Team Mutation
  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ["userTeams"] });
      toast.success(`Workspace "${newTeam.name}" created successfully!`);
      setIsCreateModalOpen(false);
      setName("");
      setDescription("");
      navigate(`/teams/${newTeam._id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create team");
    },
  });

  // Join Team Mutation
  const joinMutation = useMutation({
    mutationFn: joinTeamByCode,
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ["userTeams"] });
      setIsJoinModalOpen(false);
      setJoinCode("");
      if (
        team.currentUserStatus === "pending" ||
        team.membershipMessage?.toLowerCase().includes("approval") ||
        team.membershipMessage?.toLowerCase().includes("pending") ||
        team.membershipMessage?.toLowerCase().includes("request")
      ) {
        toast.success(
          team.membershipMessage ||
            "Join request submitted. Awaiting workspace owner approval!"
        );
      } else {
        toast.success(`Joined "${team.name}" workspace successfully!`);
        navigate(`/teams/${team._id}`);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to join team");
    },
  });

  // Cancel / Remove Request Mutation
  const cancelMutation = useMutation({
    mutationFn: (tId: string) => cancelJoinRequest(tId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userTeams"] });
      toast.success(
        cancelRequestTeam?.type === "cancel"
          ? "Join request cancelled"
          : "Workspace removed from your list"
      );
      setCancelRequestTeam(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to process request");
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["userTeams"] });
      toast.success("Workspaces refreshed!");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Invite code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Workspace name is required");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      color: selectedColor,
    });
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error("Please enter team invite code");
      return;
    }
    joinMutation.mutate(joinCode.trim());
  };

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teams, searchTerm]);

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0">
      <main className="w-full px-4 sm:px-6 md:px-8 py-5 sm:py-8 space-y-5 sm:space-y-6 min-w-0">
        {/* Top Header & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5 sm:pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold mb-1">
              <Link to="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-slate-500">Workspaces & Teams</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
              <span>Team Workspaces</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                {teams?.length || 0} Total
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Collaborate on shared project boards, manage members, and track Kanban deliverables.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 sm:flex-none border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-xl h-9 sm:h-10 px-3 shadow-xs"
              title="Refresh workspaces"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin text-blue-600" : "text-slate-500"}`}
              />
              Refresh
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsJoinModalOpen(true)}
              className="flex-1 sm:flex-none border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded-xl h-9 sm:h-10 px-3.5 shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Join with Code
            </Button>

            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl h-9 sm:h-10 px-4 shadow-sm shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </Button>
          </div>
        </div>

        {/* Search Bar & Workspace Stats Banner */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 bg-white shadow-xs min-w-0">
          <div className="relative w-full sm:w-80 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search workspaces by name or code..."
              className="pl-10 h-10 bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 text-slate-900 rounded-xl text-xs placeholder:text-slate-400 w-full min-w-0"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5 shrink-0">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>{teams?.length || 0}</strong> Workspaces
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <FolderKanban className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>{teams?.reduce((acc, t) => acc + (t.projectCount || 0), 0) || 0}</strong> Active Boards
              </span>
            </div>
          </div>
        </div>

        {/* Workspaces Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-medium text-slate-500">Loading workspaces...</p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200 shadow-xs max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-sm">
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                {searchTerm ? "No workspaces found" : "No Team Workspaces Yet"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                {searchTerm
                  ? "Try searching with a different keyword or workspace code."
                  : "Create your first team workspace to organize project boards, collaborate on Kanban tasks, and assign deliverables."}
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 px-4 gap-1.5 shadow-sm shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                Create Workspace
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsJoinModalOpen(true)}
                className="border-slate-300 text-slate-700 rounded-xl text-xs h-9 px-4 gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                Join with Code
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeams.map((team) => {
              const theme = colorThemes[team.color] || colorThemes.indigo;
              const isOwner = team.owner?._id === currentUser?.id;
              const userMember = team.members.find(
                (m) =>
                  m.user?._id === currentUser?.id ||
                  (m.user as any) === currentUser?.id
              );
              const userRole = isOwner ? "owner" : userMember?.role || "member";
              const userStatus = isOwner
                ? "active"
                : team.currentUserStatus || userMember?.status || "active";

              const isPending = userStatus === "pending";
              const isRejected = userStatus === "rejected";

              return (
                <Card
                  key={team._id}
                  className={`rounded-2xl border bg-white transition-all duration-200 shadow-xs flex flex-col justify-between overflow-hidden group min-w-0 ${
                    isPending
                      ? "border-amber-200 hover:border-amber-300"
                      : isRejected
                      ? "border-rose-200 hover:border-rose-300 opacity-80"
                      : "border-slate-200/90 hover:border-indigo-300 hover:shadow-lg"
                  }`}
                >
                  <CardContent className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 min-w-0">
                    {/* Top Header Card */}
                    <div className="flex items-start justify-between gap-2.5 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr ${theme.gradient} flex items-center justify-center text-white text-base sm:text-lg font-extrabold shadow-md shadow-indigo-500/15 shrink-0`}
                        >
                          {team.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          {isPending || isRejected ? (
                            <span className="font-bold text-sm sm:text-base text-slate-900 truncate block">
                              {team.name}
                            </span>
                          ) : (
                            <Link
                              to={`/teams/${team._id}`}
                              className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-indigo-600 transition-colors truncate block"
                            >
                              {team.name}
                            </Link>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span
                              className={`inline-flex items-center text-[9px] sm:text-[10px] font-semibold px-2 py-0.2 rounded-full border uppercase tracking-wider ${
                                userRole === "owner"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : userRole === "admin"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {userRole}
                            </span>

                            {isPending && (
                              <span className="inline-flex items-center text-[9px] sm:text-[10px] font-semibold px-2 py-0.2 rounded-full border uppercase tracking-wider bg-amber-50 text-amber-700 border-amber-200">
                                Pending Approval
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center text-[9px] sm:text-[10px] font-semibold px-2 py-0.2 rounded-full border uppercase tracking-wider bg-rose-50 text-rose-700 border-rose-200">
                                Declined
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Invite Code Badge with Copy */}
                      <button
                        onClick={() => handleCopyCode(team.code)}
                        className="shrink-0 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg border border-slate-200/80 transition cursor-pointer"
                        title="Click to copy invite code"
                      >
                        {copiedCode === team.code ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{team.code}</span>
                      </button>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[32px] break-words">
                      {team.description || "Enterprise workspace for collaborative project planning and live meetings."}
                    </p>

                    {/* Stats & Members Stack */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {/* Member Avatars Stack */}
                      <div className="flex items-center -space-x-2 overflow-hidden shrink-0">
                        {team.members.slice(0, 4).map((m, idx) => (
                          <div
                            key={m.user?._id || idx}
                            className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700 overflow-hidden shadow-xs shrink-0"
                            title={m.user?.name}
                          >
                            {m.user?.profilePicture ? (
                              <img
                                src={m.user.profilePicture}
                                alt={m.user.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              m.user?.name?.[0]?.toUpperCase() || "U"
                            )}
                          </div>
                        ))}
                        {team.members.length > 4 && (
                          <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-bold shrink-0">
                            +{team.members.length - 4}
                          </div>
                        )}
                      </div>

                      {/* Boards & Tasks Counters */}
                      <div className="flex items-center gap-2 sm:gap-3 text-slate-500 font-medium text-[11px] sm:text-xs shrink-0">
                        <span className="flex items-center gap-1">
                          <FolderKanban className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          {team.projectCount || 0} Boards
                        </span>
                        <span>•</span>
                        <span>{team.taskCount || 0} Tasks</span>
                      </div>
                    </div>
                  </CardContent>

                  {/* Bottom Action Footer */}
                  {isPending ? (
                    <div className="bg-amber-50/70 border-t border-amber-100 px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Awaiting Approval</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCancelRequestTeam({
                            id: team._id,
                            name: team.name,
                            type: "cancel",
                          })
                        }
                        className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7 px-2.5 rounded-lg font-medium cursor-pointer"
                      >
                        Cancel Request
                      </Button>
                    </div>
                  ) : isRejected ? (
                    <div className="bg-rose-50/70 border-t border-rose-100 px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-rose-700 font-semibold">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Declined by Owner</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCancelRequestTeam({
                            id: team._id,
                            name: team.name,
                            type: "remove",
                          })
                        }
                        className="text-slate-600 border-slate-200 hover:bg-slate-100 text-xs h-7 px-2.5 rounded-lg font-medium cursor-pointer"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-slate-50/70 border-t border-slate-100 px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between">
                      <Link
                        to={`/teams/${team._id}`}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 group/link"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Cancel / Remove Workspace Request Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(cancelRequestTeam)}
        onClose={() => setCancelRequestTeam(null)}
        onConfirm={() => {
          if (cancelRequestTeam) {
            cancelMutation.mutate(cancelRequestTeam.id);
          }
        }}
        isLoading={cancelMutation.isPending}
        variant={cancelRequestTeam?.type === "cancel" ? "warning" : "danger"}
        title={
          cancelRequestTeam?.type === "cancel"
            ? "Cancel Join Request?"
            : "Remove Workspace?"
        }
        description={
          cancelRequestTeam?.type === "cancel"
            ? `Are you sure you want to cancel your pending join request for "${cancelRequestTeam?.name}"?`
            : `Remove "${cancelRequestTeam?.name}" from your workspace list?`
        }
        confirmText={
          cancelRequestTeam?.type === "cancel" ? "Cancel Request" : "Remove"
        }
      />

      {/* Create Team Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Workspace</h3>
                  <p className="text-xs text-slate-500">Set up a new team workspace</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Workspace Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering Team, Product Core"
                  className="rounded-xl text-xs h-10 bg-slate-50 focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what this workspace is for..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Color Theme Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Workspace Color Accent</label>
                <div className="flex items-center gap-2">
                  {Object.keys(colorThemes).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition ${
                        colorThemes[c].bg
                      } border ${selectedColor === c ? "ring-2 ring-indigo-500 border-indigo-500 scale-110" : "border-slate-200"}`}
                    >
                      <span className={`w-3 h-3 rounded-full bg-gradient-to-tr ${colorThemes[c].gradient}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl text-xs h-9 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 px-5 font-semibold gap-1.5"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Create Workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Team by Code Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Join Workspace</h3>
                  <p className="text-xs text-slate-500">Enter your team invite code</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsJoinModalOpen(false)}
                className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Team Invite Code *</label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TM-A4C8E2"
                  className="rounded-xl text-sm font-mono tracking-wider h-11 bg-slate-50 focus:bg-white text-slate-900"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Ask the workspace owner or admin for their team invite code.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="rounded-xl text-xs h-9 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={joinMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-5 font-semibold gap-1.5"
                >
                  {joinMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Join Workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
