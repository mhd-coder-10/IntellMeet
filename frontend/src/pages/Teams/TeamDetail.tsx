import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Plus,
  FolderKanban,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  UserMinus,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Trash2,
  Calendar,
  Search,
  Building2,
  X,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  getTeamById,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  createProject,
  updateProject,
  deleteProject,
  respondToJoinRequest,
} from "@/services/teamService";
import { useAuthStore } from "@/store/authStore";
import { useSocket } from "@/hooks/useSocket";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import type { Team } from "@/types/team";

const boardColorThemes: Record<
  string,
  { bg: string; border: string; text: string; bar: string; badge: string }
> = {
  indigo: {
    bg: "bg-indigo-50/70",
    border: "border-indigo-200",
    text: "text-indigo-700",
    bar: "bg-indigo-600",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  blue: {
    bg: "bg-blue-50/70",
    border: "border-blue-200",
    text: "text-blue-700",
    bar: "bg-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  emerald: {
    bg: "bg-emerald-50/70",
    border: "border-emerald-200",
    text: "text-emerald-700",
    bar: "bg-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  purple: {
    bg: "bg-purple-50/70",
    border: "border-purple-200",
    text: "text-purple-700",
    bar: "bg-purple-600",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
  },
  amber: {
    bg: "bg-amber-50/70",
    border: "border-amber-200",
    text: "text-amber-700",
    bar: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  rose: {
    bg: "bg-rose-50/70",
    border: "border-rose-200",
    text: "text-rose-700",
    bar: "bg-rose-600",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

export default function TeamDetail() {
  const { id: teamId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [activeTab, setActiveTab] = useState<"projects" | "members">("projects");
  const [boardSearch, setBoardSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Modals state
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isEditBoardOpen, setIsEditBoardOpen] = useState(false);
  const [isEditTeamOpen, setIsEditTeamOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<{ id: string; name: string } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  // Form states
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [boardColor, setBoardColor] = useState("indigo");
  const [createBoardMembers, setCreateBoardMembers] = useState<string[]>([]);

  // Edit Board Form state
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editBoardName, setEditBoardName] = useState("");
  const [editBoardDescription, setEditBoardDescription] = useState("");
  const [editBoardColor, setEditBoardColor] = useState("indigo");
  const [editBoardMembers, setEditBoardMembers] = useState<string[]>([]);

  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [editTeamColor, setEditTeamColor] = useState("indigo");

  const [memberIdentifier, setMemberIdentifier] = useState("");
  const [memberRole, setMemberRole] = useState<"member" | "admin">("member");

  // Fetch Team details
  const {
    data: team,
    isLoading,
    isError,
  } = useQuery<Team>({
    queryKey: ["team", teamId],
    queryFn: () => getTeamById(teamId!),
    enabled: !!teamId,
    staleTime: 10 * 1000,
  });

  const currentUserId = currentUser?.id || currentUser?._id;

  // Check roles
  const userMembership = useMemo(() => {
    if (!team || !team.members || !Array.isArray(team.members) || !currentUserId) return null;
    return team.members.find(
      (m) =>
        m.user?._id === currentUserId ||
        (m.user as any) === currentUserId
    );
  }, [team, currentUserId]);

  const isOwner =
    team?.owner?._id === currentUserId ||
    (team?.owner as any) === currentUserId;
  const isAdmin = isOwner || userMembership?.role === "admin";

  // Create Project Board Mutation
  const createProjectMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      color?: string;
      memberIds?: string[];
    }) => createProject(teamId!, data),
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      toast.success(`Project board "${newBoard.name}" created!`);
      setIsCreateBoardOpen(false);
      setBoardName("");
      setBoardDescription("");
      setCreateBoardMembers([]);
      navigate(`/teams/${teamId}/projects/${newBoard._id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create board");
    },
  });

  // Update Project Board Mutation
  const updateProjectMutation = useMutation({
      mutationFn: (data: {
        id: string;
        name: string;
        description?: string;
        color?: string;
        memberIds?: string[];
      }) =>
  updateProject(data.id, {
    name: data.name,
    description: data.description,
    color: data.color,
    memberIds: data.memberIds,
  }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      toast.success(`Project board "${updated.name}" updated!`);
      setIsEditBoardOpen(false);
      setEditingBoardId(null);
      setEditBoardMembers([]);
    },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to update board");
      },
  });

// Delete Board Mutation
const deleteProjectMutation = useMutation({
  mutationFn: (projId: string) => deleteProject(projId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    toast.success("Project board and associated tasks deleted successfully");
    setBoardToDelete(null);
  },
  onError: (err: any) => {
    toast.error(err?.response?.data?.message || "Failed to delete board");
  },
});

// Add Member Mutation
const addMemberMutation = useMutation({
  mutationFn: (data: { identifier: string; role?: "member" | "admin" }) =>
    addTeamMember(teamId!, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    toast.success("Teammate added successfully!");
    setIsAddMemberOpen(false);
    setMemberIdentifier("");
  },
  onError: (err: any) => {
    toast.error(err?.response?.data?.message || "Failed to add member");
  },
});

// Remove Member Mutation
const removeMemberMutation = useMutation({
  mutationFn: (userId: string) => removeTeamMember(teamId!, userId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    toast.success("Teammate removed from workspace");
    setMemberToRemove(null);
  },
  onError: (err: any) => {
    toast.error(err?.response?.data?.message || "Failed to remove member");
  },
});

// Update Member Role Mutation (Member <-> Admin)
const updateRoleMutation = useMutation({
  mutationFn: ({ userId, role }: { userId: string; role: "admin" | "member" }) =>
    updateTeamMemberRole(teamId!, userId, role),
  onSuccess: (_, vars) => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    toast.success(
      vars.role === "admin"
        ? "Promoted teammate to Workspace Admin!"
        : "Demoted teammate to regular Member."
    );
  },
  onError: (err: any) => {
    toast.error(err?.response?.data?.message || "Failed to update member role");
  },
});

// Respond to Join Request Mutation (Accept or Reject)
const respondJoinRequestMutation = useMutation({
  mutationFn: ({ userId, action }: { userId: string; action: "accept" | "reject" }) =>
    respondToJoinRequest(teamId!, userId, action),
  onSuccess: (_, vars) => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    toast.success(
      vars.action === "accept"
        ? "Join request accepted! Teammate can now access boards."
        : "Join request declined."
    );
  },
  onError: (err: any) => {
    toast.error(err?.response?.data?.message || "Failed to respond to request");
  },
});

// Socket.io for Real-Time Team Updates
const { socket, isConnected } = useSocket();

useEffect(() => {
  if (!socket || !isConnected || !teamId) return;
  socket.emit("team:join", { teamId });

  const handleTeamUpdated = (updatedTeam: any) => {
    const updatedId = updatedTeam?._id || updatedTeam?.id;
    if (updatedId === teamId) {
      queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      queryClient.invalidateQueries({ queryKey: ["userTeams"] });
    }
  };

  socket.on("team:updated", handleTeamUpdated);

  return () => {
    socket.emit("team:leave", { teamId });
    socket.off("team:updated", handleTeamUpdated);
  };
}, [socket, isConnected, teamId, queryClient]);

// Update Team Mutation
const updateTeamMutation = useMutation({
  mutationFn: (data: { name?: string; description?: string; color?: string }) =>
    updateTeam(teamId!, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    queryClient.invalidateQueries({ queryKey: ["userTeams"] });
    toast.success("Workspace details updated successfully!");
    setIsEditTeamOpen(false);
  },
  onError: (err: any) => {
    toast.error(err?.response?.data?.message || "Failed to update workspace");
  },
});

// Delete Team Mutation
const deleteTeamMutation = useMutation({
  mutationFn: () => deleteTeam(teamId!),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["userTeams"] });
    toast.success("Workspace deleted");
    navigate("/teams");
  },
  onError: (err: any) => {
    toast.error(err?.response?.data?.message || "Failed to delete team");
  },
});

// Copy code helper
const handleCopyCode = () => {
  if (!team) return;
  navigator.clipboard.writeText(team.code);
  setCopiedCode(true);
  toast.success(`Invite code "${team.code}" copied to clipboard!`);
  setTimeout(() => setCopiedCode(false), 2000);
};

// Refresh helper
const handleRefresh = async () => {
  setIsRefreshing(true);
  try {
    await queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    toast.success("Workspace updated");
  } finally {
    setIsRefreshing(false);
  }
};

// Filtered boards
const filteredBoards = useMemo(() => {
  if (!team?.projects) return [];
  if (!boardSearch.trim()) return team.projects;
  const q = boardSearch.toLowerCase();
  return team.projects.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      (b.description && b.description.toLowerCase().includes(q))
  );
}, [team?.projects, boardSearch]);

// Separate Pending Requests and Active Members
const pendingRequests = useMemo(() => {
  if (!team?.members || !Array.isArray(team.members)) return [];
  return team.members.filter((m) => m.status === "pending");
}, [team?.members]);

const activeMembers = useMemo(() => {
  if (!team?.members || !Array.isArray(team.members)) return [];
  return team.members.filter((m) => m.status !== "pending" && m.status !== "rejected");
}, [team?.members]);

// Filtered active members
const filteredActiveMembers = useMemo(() => {
  if (!activeMembers) return [];
  if (!memberSearch.trim()) return activeMembers;
  const q = memberSearch.toLowerCase();
  return activeMembers.filter((m) => {
    const u = m.user;
    return (
      u?.name?.toLowerCase().includes(q) ||
      u?.username?.toLowerCase().includes(q) ||
      u?.email?.toLowerCase().includes(q)
    );
  });
}, [activeMembers, memberSearch]);

if (isLoading) {
  return (
    <div className="w-full">
      <main className="w-full px-4 sm:px-6 md:px-8 py-16 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 font-medium">
          Loading team workspace...
        </p>
      </main>
    </div>
  );
}

if (isError || !team || !team.name) {
  return (
    <div className="w-full">
      <main className="w-full px-4 sm:px-6 md:px-8 py-16 text-center space-y-4">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Workspace Not Found</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          This workspace may have been removed or you don't have permission to view it.
        </p>
        <Link to="/teams">
          <Button className="mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
            Back to Workspaces
          </Button>
        </Link>
      </main>
    </div>
  );
}

const teamInitial = team.name.slice(0, 1).toUpperCase();
const theme = boardColorThemes[team.color || "indigo"] || boardColorThemes.indigo;

return (
  <div className="w-full max-w-full overflow-x-hidden min-w-0 pb-16">
    <main className="w-full px-4 sm:px-6 md:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 min-w-0">
      {/* Navigation Breadcrumbs & Top Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link
            to="/teams"
            className="hover:text-blue-600 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspaces</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900 font-semibold">{team.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-white text-xs h-9 gap-1.5 shadow-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditTeamName(team.name);
                setEditTeamDescription(team.description || "");
                setEditTeamColor(team.color || "indigo");
                setIsEditTeamOpen(true);
              }}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-9 gap-1.5 shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Edit Workspace</span>
            </Button>
          )}

          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmTeam(true)}
              className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs h-9 gap-1.5 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete Workspace</span>
            </Button>
          )}
        </div>
      </div>

      {/* Workspace Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-7 lg:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl sm:text-3xl shadow-md shrink-0 ${theme.bar}`}
            >
              {teamInitial}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {team.name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isOwner
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : isAdmin
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                >
                  {isOwner ? "Owner" : isAdmin ? "Admin" : "Member"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-2xl">
                {team.description || "Collaborative team workspace with Kanban boards and real-time tracking."}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Owner: <strong className="text-slate-700">{team.owner?.name}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Created {new Date(team.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Invite Code Banner in Hero */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-50/90 border border-slate-200/90 p-3 sm:p-4 rounded-2xl">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Team Invite Code</span>
              </div>
              <div className="font-mono text-base font-bold text-slate-900 tracking-widest">
                {team.code}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="rounded-xl border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold h-10 px-3.5 gap-1.5 shadow-xs"
            >
              {copiedCode ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copy Code</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-slate-100 text-center sm:text-left">
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Project Boards
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">
              {team.projects?.length || 0}
            </span>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Total Members
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">
              {team.members?.length || 0}
            </span>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Total Tasks
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-slate-900">
              {team.taskCount || 0}
            </span>
          </div>
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Workspace Role
            </span>
            <span className="text-xs sm:text-sm font-bold text-blue-600 capitalize">
              {isOwner ? "Workspace Owner" : isAdmin ? "Team Admin" : "Team Member"}
            </span>
          </div>
        </div>
      </div>

      {/* Section Tabs & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Segmented Tab Buttons */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("projects")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${activeTab === "projects"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <FolderKanban className="w-4 h-4 text-blue-600" />
            <span>Project Boards ({team.projects?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${activeTab === "members"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Teammates ({team.members?.length || 0})</span>
          </button>
        </div>

        {/* Action Trigger Buttons */}
        <div className="flex items-center gap-2.5">
          {activeTab === "projects" ? (
            <Button
              onClick={() => setIsCreateBoardOpen(true)}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm h-10 px-4 shadow-xs gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Project Board</span>
            </Button>
          ) : (
            isAdmin && (
              <Button
                onClick={() => setIsAddMemberOpen(true)}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs sm:text-sm h-10 px-4 shadow-xs gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Teammate</span>
              </Button>
            )
          )}
        </div>
      </div>

      {/* TAB 1: PROJECT BOARDS */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          {/* Search filter if multiple boards */}
          {team.projects && team.projects.length > 2 && (
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <Input
                value={boardSearch}
                onChange={(e) => setBoardSearch(e.target.value)}
                placeholder="Search project boards..."
                className="pl-9 h-10 bg-white border-slate-200 text-xs rounded-xl"
              />
            </div>
          )}

          {filteredBoards.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-white/50 rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-center">
              <CardContent className="space-y-4 max-w-md mx-auto p-0">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-xs">
                  <FolderKanban className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {boardSearch ? "No matching boards found" : "No Project Boards Yet"}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    {boardSearch
                      ? "Try clearing your search term to see all project boards."
                      : "Create a Kanban board to organize sprint tasks, track real-time progress, and assign action items."}
                  </p>
                </div>
                {!boardSearch && (
                  <Button
                    onClick={() => setIsCreateBoardOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm h-10 px-5 shadow-xs gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Kanban Board</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredBoards.map((board) => {
                const bTheme =
                  boardColorThemes[board.color || "indigo"] ||
                  boardColorThemes.indigo;
                const total = board.totalTasks || 0;
                const done = board.doneTasks || 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <Card
                    key={board._id}
                    className="group border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-md transition-all duration-200 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between"
                  >
                    <CardContent className="p-5 sm:p-6 space-y-4">
                      {/* Board Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs shrink-0 ${bTheme.bar}`}
                          >
                            <FolderKanban className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                              {board.name}
                            </h3>
                            <span className="text-[11px] text-slate-400 block truncate">
                              Updated {new Date(board.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingBoardId(board._id);
                                setEditBoardName(board.name);
                                setEditBoardDescription(board.description || "");
                                setEditBoardColor(board.color || "indigo");
                                setEditBoardMembers(
                                  (board.members || []).map((m: any) => m.user?._id || m.user || m)
                                );
                                setIsEditBoardOpen(true);
                              }}
                              className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                              title="Edit Board"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setBoardToDelete({ id: board._id, name: board.name })
                              }
                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                              title="Delete Board"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {board.description || "Kanban project board with automated status columns."}
                      </p>

                      {/* Members Stack Preview */}
                      {board.members && board.members.length > 0 && (
                        <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-500">
                          <div className="flex -space-x-1.5 overflow-hidden">
                            {board.members.slice(0, 3).map((m: any, idx: number) => {
                              const u = m.user || m;
                              return (
                                <div
                                  key={u._id || idx}
                                  className="w-5 h-5 rounded-full bg-blue-100 border border-white text-[9px] font-bold flex items-center justify-center text-blue-700"
                                >
                                  {(u.name || "U")[0].toUpperCase()}
                                </div>
                              );
                            })}
                          </div>
                          <span className="text-[11px] font-medium text-slate-500">
                            {board.members.length} {board.members.length === 1 ? "project member" : "project members"}
                          </span>
                        </div>
                      )}

                      {/* Columns Preview Pill */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          To Do
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          In Progress
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          Review
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Done
                        </span>
                      </div>

                      {/* Progress Bar & Task Count */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            Tasks Completion
                          </span>
                          <span className="text-slate-800 font-bold font-mono">
                            {done}/{total} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${bTheme.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Open Board Button */}
                      <Link
                        to={`/teams/${team._id}/projects/${board._id}`}
                        className="block pt-1"
                      >
                        <Button
                          variant="outline"
                          className="w-full rounded-xl border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-xs font-semibold h-10 gap-1.5 transition"
                        >
                          <span>Open Kanban Board</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEAM MEMBERS */}
      {activeTab === "members" && (
        <div className="space-y-5">
          {/* PENDING JOIN REQUESTS SECTION (FOR OWNER / ADMIN) */}
          {isAdmin && pendingRequests.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-extrabold text-xs shadow-xs">
                    {pendingRequests.length}
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      Pending Join Requests
                    </h4>
                    <p className="text-xs text-slate-500">
                      Users who entered workspace invite code and are waiting for your approval.
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  Approval Required
                </span>
              </div>

              <div className="divide-y divide-amber-100">
                {pendingRequests.map((req) => {
                  const u = req.user;
                  if (!u) return null;
                  const initials = (u.name || "U")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={u._id}
                      className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
                          {u.profilePicture ? (
                            <img
                              src={u.profilePicture}
                              alt={u.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {u.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>@{u.username}</span>
                            <span className="text-slate-300">•</span>
                            <span className="truncate">{u.email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-0">
                        <Button
                          size="sm"
                          onClick={() =>
                            respondJoinRequestMutation.mutate({
                              userId: u._id,
                              action: "accept",
                            })
                          }
                          disabled={respondJoinRequestMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3.5 rounded-xl font-semibold shadow-xs gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            respondJoinRequestMutation.mutate({
                              userId: u._id,
                              action: "reject",
                            })
                          }
                          disabled={respondJoinRequestMutation.isPending}
                          className="border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-3.5 rounded-xl font-semibold gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Active Members Section Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-slate-800">
              Active Teammates ({activeMembers.length})
            </h4>
            {/* Search filter for members */}
            {activeMembers.length > 2 && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search teammates..."
                  className="pl-9 h-10 bg-white border-slate-200 text-xs rounded-xl"
                />
              </div>
            )}
          </div>

          <Card className="border-slate-200/90 bg-white rounded-2xl shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filteredActiveMembers.map((member) => {
                const user = member.user;
                if (!user) return null;
                const isMemberOwner =
                  user._id === team.owner?._id ||
                  (user as any) === team.owner?._id;
                const isSelf = user._id === currentUserId;
                const initials = (user.name || "U")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={user._id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {user.name}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>@{user.username}</span>
                          <span className="text-slate-300">•</span>
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-wrap">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${isMemberOwner
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : member.role === "admin"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                      >
                        {isMemberOwner ? "Owner" : member.role === "admin" ? "Admin" : "Member"}
                      </span>

                      {isAdmin && !isMemberOwner && !isSelf && (
                        <div className="flex items-center gap-2">
                          {/* Make Admin / Demote to Member Toggle Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updateRoleMutation.isPending}
                            onClick={() => {
                              const newRole = member.role === "admin" ? "member" : "admin";
                              updateRoleMutation.mutate({
                                userId: user._id,
                                role: newRole,
                              });
                            }}
                            className={`text-xs h-8 px-2.5 rounded-lg border transition font-medium cursor-pointer ${member.role === "admin"
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50 bg-amber-50/40"
                                : "border-purple-200 text-purple-700 hover:bg-purple-50 bg-purple-50/40"
                              }`}
                            title={
                              member.role === "admin"
                                ? "Demote to regular Member"
                                : "Promote to Workspace Admin"
                            }
                          >
                            {updateRoleMutation.isPending &&
                              (updateRoleMutation.variables as any)?.userId === user._id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : member.role === "admin" ? (
                              <ShieldAlert className="w-3.5 h-3.5 mr-1 text-amber-600" />
                            ) : (
                              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-purple-600" />
                            )}
                            <span>{member.role === "admin" ? "Demote to Member" : "Make Admin"}</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setMemberToRemove({ id: user._id, name: user.name })
                            }
                            disabled={removeMemberMutation.isPending}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-8 px-2.5 rounded-lg cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5 mr-1" />
                            <span>Remove</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </main>

    {/* CREATE PROJECT BOARD MODAL */}
    {isCreateBoardOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Create Project Board
                </h3>
                <p className="text-xs text-slate-500">
                  Set up a Kanban board for sprints, feature tracking, or milestones.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCreateBoardOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!boardName.trim()) {
                toast.error("Board name is required");
                return;
              }
              createProjectMutation.mutate({
                name: boardName.trim(),
                description: boardDescription.trim(),
                color: boardColor,
                memberIds: createBoardMembers,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Board Name *
              </label>
              <Input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                placeholder="e.g. Sprint 1, Mobile App MVP, Marketing Launch"
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Description (Optional)
              </label>
              <textarea
                value={boardDescription}
                onChange={(e) => setBoardDescription(e.target.value)}
                placeholder="What is the goal or focus of this board?"
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Board Theme Accent
              </label>
              <div className="flex flex-wrap gap-2.5">
                {Object.keys(boardColorThemes).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBoardColor(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition ${boardColor === c
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Assign Members to this Project */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Assign Workspace Members (Optional)
              </label>
              <p className="text-[11px] text-slate-400">
                Select which workspace members should be part of this project board.
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-2 bg-slate-50/50">
                {activeMembers.length > 0 ? (
                  activeMembers.map((m) => {
                    const uid = m.user?._id || (m.user as any);
                    const isSelected = createBoardMembers.includes(uid);
                    return (
                      <label
                        key={uid}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white cursor-pointer transition text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateBoardMembers((prev) => [...prev, uid]);
                            } else {
                              setCreateBoardMembers((prev) => prev.filter((id) => id !== uid));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="font-medium text-slate-900">{m.user?.name}</span>
                        <span className="text-slate-400 text-[11px]">(@{m.user?.username || m.user?.email})</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic p-1">No other members in workspace.</p>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-800 space-y-1">
              <span className="font-semibold block">Automatic Kanban Structure:</span>
              <span className="text-[11px] text-blue-700">
                This board automatically initializes with 4 columns: <strong>To Do</strong>, <strong>In Progress</strong>, <strong>In Review</strong>, and <strong>Done</strong>.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateBoardOpen(false)}
                className="rounded-xl border-slate-200 text-slate-600 text-xs h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProjectMutation.isPending || !boardName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-10 px-5 shadow-xs"
              >
                {createProjectMutation.isPending ? "Creating..." : "Create Board"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* ADD MEMBER MODAL */}
    {isAddMemberOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Add Teammate
                </h3>
                <p className="text-xs text-slate-500">
                  Invite an existing user by email or username.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddMemberOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!memberIdentifier.trim()) {
                toast.error("Please enter email or username");
                return;
              }
              addMemberMutation.mutate({
                identifier: memberIdentifier.trim(),
                role: memberRole,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                User Email or Username *
              </label>
              <Input
                value={memberIdentifier}
                onChange={(e) => setMemberIdentifier(e.target.value)}
                placeholder="e.g. colleague@example.com or @john"
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Workspace Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMemberRole("member")}
                  className={`p-3 rounded-xl border text-left transition ${memberRole === "member"
                      ? "border-blue-500 bg-blue-50/50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                >
                  <div className="text-xs font-bold text-slate-900">Member</div>
                  <div className="text-[11px] text-slate-500">
                    Can view boards and manage tasks
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMemberRole("admin")}
                  className={`p-3 rounded-xl border text-left transition ${memberRole === "admin"
                      ? "border-purple-500 bg-purple-50/50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                >
                  <div className="text-xs font-bold text-slate-900">Admin</div>
                  <div className="text-[11px] text-slate-500">
                    Can create boards & add members
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddMemberOpen(false)}
                className="rounded-xl border-slate-200 text-slate-600 text-xs h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addMemberMutation.isPending || !memberIdentifier.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs h-10 px-5 shadow-xs"
              >
                {addMemberMutation.isPending ? "Adding..." : "Add to Team"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* EDIT PROJECT BOARD MODAL */}
    {isEditBoardOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Edit Project Board
                </h3>
                <p className="text-xs text-slate-500">
                  Update board title, description, and visual theme.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditBoardOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editBoardName.trim()) {
                toast.error("Board title is required");
                return;
              }
              updateProjectMutation.mutate({
                id: editingBoardId!,
                name: editBoardName.trim(),
                description: editBoardDescription.trim(),
                color: editBoardColor,
                memberIds: editBoardMembers,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Board Title *
              </label>
              <Input
                value={editBoardName}
                onChange={(e) => setEditBoardName(e.target.value)}
                placeholder="e.g. Q3 Product Roadmap"
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={editBoardDescription}
                onChange={(e) => setEditBoardDescription(e.target.value)}
                placeholder="Board purpose and sprint goals..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Theme Accent Color
              </label>
              <div className="flex flex-wrap gap-2.5">
                {Object.keys(boardColorThemes).map((cKey) => (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => setEditBoardColor(cKey)}
                    className={`h-8 w-8 rounded-full border-2 flex items-center justify-center transition ${editBoardColor === cKey
                        ? "border-slate-900 scale-110 shadow-sm"
                        : "border-transparent opacity-75 hover:opacity-100"
                      }`}
                    style={{
                      backgroundColor:
                        cKey === "indigo"
                          ? "#4f46e5"
                          : cKey === "blue"
                            ? "#2563eb"
                            : cKey === "emerald"
                              ? "#059669"
                              : cKey === "purple"
                                ? "#9333ea"
                                : cKey === "amber"
                                  ? "#d97706"
                                  : "#e11d48",
                    }}
                  >
                    {editBoardColor === cKey && <Check className="w-4 h-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Manage Members in Edit Modal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Project Members
              </label>
              <p className="text-[11px] text-slate-400">
                Select which workspace members have access to this board.
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-200 p-2 bg-slate-50/50">
                {activeMembers.length > 0 ? (
                  activeMembers.map((m) => {
                    const uid = m.user?._id || (m.user as any);
                    const isSelected = editBoardMembers.includes(uid);
                    return (
                      <label
                        key={uid}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white cursor-pointer transition text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditBoardMembers((prev) => [...prev, uid]);
                            } else {
                              setEditBoardMembers((prev) => prev.filter((id) => id !== uid));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="font-medium text-slate-900">{m.user?.name}</span>
                        <span className="text-slate-400 text-[11px]">(@{m.user?.username || m.user?.email})</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic p-1">No other members in workspace.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditBoardOpen(false)}
                className="rounded-xl border-slate-200 text-slate-600 text-xs h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProjectMutation.isPending || !editBoardName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-10 px-5 shadow-xs"
              >
                {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* DELETE BOARD CONFIRM MODAL */}
    <ConfirmModal
      isOpen={Boolean(boardToDelete)}
      onClose={() => setBoardToDelete(null)}
      onConfirm={() => {
        if (boardToDelete) {
          deleteProjectMutation.mutate(boardToDelete.id);
        }
      }}
      isLoading={deleteProjectMutation.isPending}
      variant="danger"
      title="Delete Project Board?"
      description={`This will permanently delete "${boardToDelete?.name}" and all associated Kanban tasks. This action cannot be undone.`}
      confirmText="Delete Board"
    />

    {/* REMOVE TEAMMATE CONFIRM MODAL */}
    <ConfirmModal
      isOpen={Boolean(memberToRemove)}
      onClose={() => setMemberToRemove(null)}
      onConfirm={() => {
        if (memberToRemove) {
          removeMemberMutation.mutate(memberToRemove.id);
        }
      }}
      isLoading={removeMemberMutation.isPending}
      variant="danger"
      title="Remove Teammate?"
      description={`Are you sure you want to remove ${memberToRemove?.name} from this workspace? They will lose access to all boards.`}
      confirmText="Remove Teammate"
    />

    {/* DELETE WORKSPACE CONFIRM MODAL */}
    <ConfirmModal
      isOpen={deleteConfirmTeam}
      onClose={() => setDeleteConfirmTeam(false)}
      onConfirm={() => deleteTeamMutation.mutate()}
      isLoading={deleteTeamMutation.isPending}
      variant="danger"
      title="Delete Entire Workspace?"
      description={`Are you sure? All project boards, Kanban tasks, and configurations in "${team.name}" will be permanently removed.`}
      confirmText="Delete Workspace"
    />

    {/* EDIT WORKSPACE MODAL */}
    {isEditTeamOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Edit Workspace Details
                </h3>
                <p className="text-xs text-slate-500">
                  Update workspace name, description, and visual theme.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditTeamOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editTeamName.trim()) {
                toast.error("Workspace name is required");
                return;
              }
              updateTeamMutation.mutate({
                name: editTeamName.trim(),
                description: editTeamDescription.trim(),
                color: editTeamColor,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Workspace Name *
              </label>
              <Input
                value={editTeamName}
                onChange={(e) => setEditTeamName(e.target.value)}
                placeholder="e.g. Core Engineering"
                className="h-11 rounded-xl text-sm"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Description
              </label>
              <textarea
                value={editTeamDescription}
                onChange={(e) => setEditTeamDescription(e.target.value)}
                placeholder="What is the mission or focus of this workspace?"
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Workspace Theme Accent
              </label>
              <div className="flex flex-wrap gap-2.5">
                {Object.keys(boardColorThemes).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditTeamColor(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition ${editTeamColor === c
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditTeamOpen(false)}
                className="rounded-xl border-slate-200 text-slate-600 text-xs h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateTeamMutation.isPending || !editTeamName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-10 px-5 shadow-xs"
              >
                {updateTeamMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
);
}
