// Form to create workspace-based meetings with member selection, project tags, and email notifications
// Supports workspace & project hierarchy, member selection, and smart launch controls

import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  Video,
  ArrowLeft,
  Clock,
  Users,
  Briefcase,
  Layers,
  Search,
  Check,
  MessageSquare,
  Share2,
  MicOff,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMeeting, getProjectMembers } from "@/services/meetingService";
import { getUserTeams, getProjectsByTeam } from "@/services/teamService";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/utils/errorHelper";
import type { Team, ProjectBoard } from "@/types/team";

// Format date into YYYY-MM-DDTHH:mm local datetime string for input
const formatLocalDateTime = (date: Date = new Date()) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

interface MemberOption {
  _id: string;
  name: string;
  username: string;
  email: string;
  profilePicture?: string;
  role?: string;
}

export default function CreateMeeting() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  // Data states
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  const [projects, setProjects] = useState<ProjectBoard[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Participant selection states
  const [availableMembers, setAvailableMembers] = useState<MemberOption[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isAllWorkspaceSelected, setIsAllWorkspaceSelected] = useState(false);
  const [isProjectFilterActive, setIsProjectFilterActive] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(formatLocalDateTime(new Date()));
  const [endTime, setEndTime] = useState("");

  // Settings
  const [allowChat, setAllowChat] = useState(true);
  const [allowScreenShare, setAllowScreenShare] = useState(true);
  const [muteOnJoin, setMuteOnJoin] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch user's workspaces
  useEffect(() => {
    let isMounted = true;
    const fetchTeams = async () => {
      setIsLoadingTeams(true);
      try {
        const userTeams = await getUserTeams();
        if (isMounted) {
          setTeams(userTeams);
          if (userTeams.length > 0) {
            setSelectedTeamId(userTeams[0]._id);
          }
        }
      } catch (err) {
        toast.error("Failed to load your workspaces");
      } finally {
        if (isMounted) setIsLoadingTeams(false);
      }
    };
    fetchTeams();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. When selectedTeamId changes, load projects and team members
  useEffect(() => {
    if (!selectedTeamId) {
      setProjects([]);
      setSelectedProjectId("");
      setAvailableMembers([]);
      setSelectedParticipantIds([]);
      return;
    }

    const currentTeam = teams.find((t) => t._id === selectedTeamId);
    if (currentTeam) {
      // Build member list from team.owner and team.members
      const membersMap = new Map<string, MemberOption>();

      if (currentTeam.owner && currentTeam.owner._id !== currentUser?.id) {
        membersMap.set(currentTeam.owner._id, {
          _id: currentTeam.owner._id,
          name: currentTeam.owner.name,
          username: currentTeam.owner.username,
          email: currentTeam.owner.email,
          profilePicture: currentTeam.owner.profilePicture,
          role: "owner",
        });
      }

      (currentTeam.members || []).forEach((m) => {
        if (m.user && m.user._id !== currentUser?.id && (m.status === "active" || !m.status)) {
          membersMap.set(m.user._id, {
            _id: m.user._id,
            name: m.user.name,
            username: m.user.username,
            email: m.user.email,
            profilePicture: m.user.profilePicture,
            role: m.role || "member",
          });
        }
      });

      const memberList = Array.from(membersMap.values());
      setAvailableMembers(memberList);

      // Default: Select all members of workspace
      const allIds = memberList.map((m) => m._id);
      setSelectedParticipantIds(allIds);
      setIsAllWorkspaceSelected(true);
      setIsProjectFilterActive(false);
    }

    // Fetch projects for this team
    let isMounted = true;
    setIsLoadingProjects(true);
    getProjectsByTeam(selectedTeamId)
      .then((data) => {
        if (isMounted) {
          setProjects(data || []);
          setSelectedProjectId("");
        }
      })
      .catch(() => {
        if (isMounted) setProjects([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProjects(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTeamId, teams, currentUser?.id]);

  // Toggle "All Workspace Members" checkbox
  const handleToggleAllWorkspace = (checked: boolean) => {
    setIsAllWorkspaceSelected(checked);
    setIsProjectFilterActive(false);
    if (checked) {
      setSelectedParticipantIds(availableMembers.map((m) => m._id));
    } else {
      setSelectedParticipantIds([]);
    }
  };

  // Filter or select only project members
  const handleSelectProjectMembersOnly = async () => {
    if (!selectedProjectId) return;
    try {
      const pMembers = await getProjectMembers(selectedProjectId);
      const myId = currentUser?.id || currentUser?._id;
      const filtered = pMembers
        .map((pm) => pm._id)
        .filter((id) => id !== myId);

      if (filtered.length === 0) {
        const allAvailable = availableMembers.map((m) => m._id);
        setSelectedParticipantIds(allAvailable);
        toast.info("Selected all workspace members for this project");
        return;
      }

      setSelectedParticipantIds(filtered);
      setIsProjectFilterActive(true);
      setIsAllWorkspaceSelected(false);
      toast.success(`Selected ${filtered.length} member(s) from project board`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not fetch project members");
    }
  };

  // Toggle individual member checkbox
  const handleToggleMember = (memberId: string) => {
    setSelectedParticipantIds((prev) => {
      const next = prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];

      setIsAllWorkspaceSelected(next.length === availableMembers.length && availableMembers.length > 0);
      setIsProjectFilterActive(false);
      return next;
    });
  };

  // Filtered members by search query
  const displayedMembers = useMemo(() => {
    if (!memberSearch.trim()) return availableMembers;
    const q = memberSearch.toLowerCase();
    return availableMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.username.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [availableMembers, memberSearch]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }

    if (!selectedTeamId) {
      toast.error("Please select a workspace for the meeting");
      return;
    }

    if (selectedParticipantIds.length === 0) {
      toast.error("Please select at least 1 participant for the meeting");
      return;
    }

    // Past time prevention (1-minute grace buffer for filling the form)
    const nowTime = Date.now() - 60000;
    if (new Date(startTime).getTime() < nowTime) {
      toast.error("Meeting start time cannot be in the past. Please select a current or future time.");
      return;
    }

    if (endTime && new Date(endTime) <= new Date(startTime)) {
      toast.error("Ending time must be later than starting time");
      return;
    }

    setIsSubmitting(true);
    try {
      const meetingStartTime = new Date(startTime).toISOString();
      const meetingEndTime = endTime ? new Date(endTime).toISOString() : null;

      await createMeeting({
        title: title.trim(),
        description: description.trim(),
        workspace: selectedTeamId,
        project: selectedProjectId || null,
        participants: selectedParticipantIds,
        startTime: meetingStartTime,
        endTime: meetingEndTime,
        settings: {
          allowChat,
          allowScreenShare,
          muteOnJoin,
          waitingRoom: false,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting scheduled & invitations dispatched!");
      navigate("/meetings");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-10 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
          <Link to="/dashboard" className="hover:underline">Dashboard</Link>
          <span className="text-slate-400">/</span>
          <Link to="/meetings" className="hover:underline">Meetings</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Create Meeting</span>
        </div>

        <Card className="border-slate-200/90 bg-white text-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 tracking-tight">
                  Schedule Workspace Meeting
                </CardTitle>
                <CardDescription className="text-slate-600 text-xs mt-0.5">
                  Host an encrypted workspace conference. All selected team members will receive instant email & in-app invites.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SECTION A: Workspace & Project Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200/90 bg-slate-50/70">
                {/* (A) Workspace Selection (Mandatory) */}
                <div className="space-y-1.5">
                  <Label htmlFor="workspace-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                    Select Workspace <span className="text-red-500">*</span>
                  </Label>
                  {isLoadingTeams ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      Loading workspaces...
                    </div>
                  ) : teams.length === 0 ? (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
                      <span>You have no workspaces yet.</span>
                      <Link to="/teams" className="font-semibold underline text-blue-600">
                        Create Workspace
                      </Link>
                    </div>
                  ) : (
                    <select
                      id="workspace-select"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900 rounded-xl text-xs h-10 px-3 font-medium outline-hidden"
                    >
                      {teams.map((team) => (
                        <option key={team._id} value={team._id}>
                          {team.name} ({team.code})
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Only members of this workspace can be invited.
                  </p>
                </div>

                {/* (B) Project Selection (Optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="project-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Select Project <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <select
                    id="project-select"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={isLoadingProjects || projects.length === 0}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900 rounded-xl text-xs h-10 px-3 font-medium outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">None (Workspace-level meeting)</option>
                    {projects.map((proj) => (
                      <option key={proj._id} value={proj._id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    {selectedProjectId
                      ? "Meeting will be linked to this project board."
                      : "General meeting across the whole workspace."}
                  </p>
                </div>
              </div>

              {/* SECTION B: Participant Selection (Mandatory) */}
              <div className="p-4 sm:p-5 rounded-xl border border-slate-200/90 bg-white space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <Label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Select Participants <span className="text-red-500">*</span>
                      <span className="ml-1 text-xs font-normal text-slate-500">
                        ({selectedParticipantIds.length} of {availableMembers.length} selected)
                      </span>
                    </Label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Invited members will receive email & in-app notifications with dashboard access.
                    </p>
                  </div>

                  {/* Filter & Select Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Option 1: All Workspace Members */}
                    <button
                      type="button"
                      onClick={() => handleToggleAllWorkspace(!isAllWorkspaceSelected)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                        isAllWorkspaceSelected
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                        isAllWorkspaceSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-400 bg-white"
                      }`}>
                        {isAllWorkspaceSelected && <Check className="w-2.5 h-2.5" />}
                      </div>
                      All Workspace Members
                    </button>

                    {/* Option 2: Project Filter Button (if project selected) */}
                    {selectedProjectId && (
                      <button
                        type="button"
                        onClick={handleSelectProjectMembersOnly}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                          isProjectFilterActive
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        Only Selected Project Members
                      </button>
                    )}
                  </div>
                </div>

                {/* Search input for members */}
                {availableMembers.length > 4 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search member by name or username..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-8.5 bg-slate-50 text-xs h-9 rounded-lg border-slate-200"
                    />
                  </div>
                )}

                {/* Member Checkbox List */}
                {availableMembers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-500">
                    No other members found in this workspace yet. You can invite team members on the workspace page.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {displayedMembers.map((member) => {
                      const isChecked = selectedParticipantIds.includes(member._id);
                      return (
                        <div
                          key={member._id}
                          onClick={() => handleToggleMember(member._id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isChecked
                              ? "bg-blue-50/50 border-blue-200 shadow-2xs"
                              : "bg-slate-50/50 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0 overflow-hidden">
                              {member.profilePicture ? (
                                <img
                                  src={member.profilePicture}
                                  alt={member.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                member.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {member.name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                @{member.username} {member.role ? `• ${member.role}` : ""}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 ml-2 ${
                              isChecked
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION C: Meeting Title & Description */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meeting-title" className="text-xs font-semibold text-slate-700">
                    Meeting Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="meeting-title"
                    placeholder="e.g. Sprint Planning & Architecture Review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="meeting-desc" className="text-xs font-semibold text-slate-700">
                    Meeting Description <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="meeting-desc"
                    placeholder="e.g. Discuss roadmap milestones, frontend updates, and blockers"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 text-slate-900 placeholder:text-slate-400 rounded-xl text-sm h-11"
                  />
                </div>
              </div>

              {/* SECTION D: Schedule Time (Start & End) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200/90 bg-slate-50/70">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="meeting-start" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Start Time <span className="text-red-500">*</span>
                    </Label>
                    <span className="text-[10px] text-slate-400 font-medium">Default: Current time</span>
                  </div>
                  <Input
                    id="meeting-start"
                    type="datetime-local"
                    value={startTime}
                    min={formatLocalDateTime(new Date())}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-white border-slate-200 focus:border-blue-500 text-slate-900 rounded-xl text-xs h-10"
                  />
                  <p className="text-[10px] text-slate-400">
                    Participants can join only when this start time arrives.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="meeting-end" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      End Time <span className="text-slate-400 font-normal">(Optional)</span>
                    </Label>
                    <span className="text-[10px] text-slate-400 font-medium">Leave empty: Open-ended</span>
                  </div>
                  <Input
                    id="meeting-end"
                    type="datetime-local"
                    value={endTime}
                    min={startTime || formatLocalDateTime(new Date())}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-white border-slate-200 focus:border-blue-500 text-slate-900 rounded-xl text-xs h-10"
                  />
                </div>
              </div>

              {/* SECTION E: Settings Controls */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 space-y-3">
                <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wider block">
                  MEETING CONTROLS
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={allowChat}
                      onChange={(e) => setAllowChat(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>In-Meeting Chat</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={allowScreenShare}
                      onChange={(e) => setAllowScreenShare(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Share2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Screen Sharing</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={muteOnJoin}
                      onChange={(e) => setMuteOnJoin(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <MicOff className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mute on Join</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Link to="/meetings">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                    Cancel
                  </Button>
                </Link>

                <Button
                  type="submit"
                  disabled={isSubmitting || isLoadingTeams || selectedParticipantIds.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm px-6 h-11 shadow-xs cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isSubmitting ? "Creating Meeting..." : "Schedule Meeting"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}