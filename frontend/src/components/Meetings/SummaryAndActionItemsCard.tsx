// AI Meeting Summary & Smart Action Items Card (Day 16)
// Displays Executive Overview, Key Discussion Points, Decisions Made,
// and interactive Action Items checklist with assignees and priority badges

import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Check,
  RefreshCw,
  Loader2,
  FileText,
  CheckSquare,
  ListOrdered,
  Plus,
  Trash2,
  Cpu,
  Calendar,
  TrendingUp,
  Pencil,
  X,
  FolderKanban,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMeetingSummary,
  generateMeetingSummary,
  downloadMeetingSummary,
  trustMeetingSummary,
  deleteMeetingSummary,
  toggleActionItemStatus,
  createMeetingActionItem,
  updateMeetingActionItem,
  deleteMeetingActionItem,
  convertActionItemToTask,
} from "@/services/aiService";
import { getUserTeams, getProjectsByTeam } from "@/services/teamService";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "@/store/authStore";
import type {
  MeetingSummaryResponse,
  MeetingActionItem,
  ActionItemPriority,
} from "@/types/summary";
import type { Team, ProjectBoard } from "@/types/team";

interface Props {
  meetingId: string;
  meetingTitle?: string;
  hostId?: string;
  hasRecordings?: boolean;
  hasTranscript?: boolean;
  participants?: Array<{ _id: string; name: string; username: string }>;
}

export function SummaryAndActionItemsCard({
  meetingId,
  meetingTitle = "Meeting",
  hostId,
  hasRecordings = true,
  hasTranscript = false,
  participants = [],
}: Props) {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const canGenerate = Boolean(hasRecordings || hasTranscript);
  const [isCopied, setIsCopied] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [newPriority, setNewPriority] = useState<ActionItemPriority>("medium");

  const { user: currentUser } = useAuthStore();
  const currentUserId = currentUser?._id || currentUser?.id;
  const isHost = Boolean(
    currentUserId &&
    hostId &&
    String(currentUserId) === String(hostId)
  );

  const [isTrustConfirmOpen, setIsTrustConfirmOpen] = useState(false);
  const [isDeleteSummaryConfirmOpen, setIsDeleteSummaryConfirmOpen] = useState(false);
  const [deletingActionItemId, setDeletingActionItemId] = useState<string | null>(null);

  // Real-time synchronization for action items & summary
  useEffect(() => {
    if (!socket || !isConnected || !meetingId) return;

    socket.emit("meeting:join", { meetingId });

    const handleActionItemUpdated = (updatedItem: MeetingActionItem) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            actionItems: old.actionItems.map((item) =>
              item._id === updatedItem._id ? updatedItem : item
            ),
          };
        }
      );
    };

    const handleSummaryDeleted = () => {
      queryClient.setQueryData(["meeting-summary", meetingId], {
        summary: null,
        actionItems: [],
      });
      toast.info("Meeting summary was deleted by the host.");
    };

    const handleSummaryTrusted = (payload: { summary: any }) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return { ...old, summary: payload.summary };
        }
      );
      toast.success("Summary verified & marked as trusted by host!");
    };

    const handleSummaryCompleted = () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-summary", meetingId] });
    };

    const handleActionItemDeleted = (payload: { _id: string }) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            actionItems: old.actionItems.filter((item) => item._id !== payload._id),
          };
        }
      );
    };

    socket.on("action_item:updated", handleActionItemUpdated);
    socket.on("action_item:deleted", handleActionItemDeleted);
    socket.on("summary:deleted", handleSummaryDeleted);
    socket.on("summary:trusted", handleSummaryTrusted);
    socket.on("summary:completed", handleSummaryCompleted);

    return () => {
      socket.off("action_item:updated", handleActionItemUpdated);
      socket.off("action_item:deleted", handleActionItemDeleted);
      socket.off("summary:deleted", handleSummaryDeleted);
      socket.off("summary:trusted", handleSummaryTrusted);
      socket.off("summary:completed", handleSummaryCompleted);
    };
  }, [socket, isConnected, meetingId, queryClient]);

  // Inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState("");
  const [editAssigneeName, setEditAssigneeName] = useState("");
  const [editPriority, setEditPriority] = useState<ActionItemPriority>("medium");

  // Fetch summary & action items
  const {
    data: summaryData,
    isLoading,
  } = useQuery<MeetingSummaryResponse>({
    queryKey: ["meeting-summary", meetingId],
    queryFn: () => getMeetingSummary(meetingId),
    enabled: !!meetingId,
    staleTime: 1000 * 60 * 5,
  });

  const summary = summaryData?.summary;
  const actionItems = summaryData?.actionItems || [];

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      generateMeetingSummary(meetingId, { forceRegenerate: false }),
    onSuccess: (data) => {
      queryClient.setQueryData(["meeting-summary", meetingId], data);
      toast.success("AI Summary & Action Items generated successfully!");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Failed to generate meeting summary"
      );
    },
  });

  // Trust summary mutation (Host only)
  const trustSummaryMutation = useMutation({
    mutationFn: () => trustMeetingSummary(meetingId),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return { ...old, summary: data.summary };
        }
      );
      setIsTrustConfirmOpen(false);
      toast.success("Summary marked as Trusted & Finalized!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to mark summary as trusted");
    },
  });

  // Delete summary mutation (Host only)
  const deleteSummaryMutation = useMutation({
    mutationFn: () => deleteMeetingSummary(meetingId),
    onSuccess: () => {
      queryClient.setQueryData(["meeting-summary", meetingId], {
        summary: null,
        actionItems: [],
      });
      setIsDeleteSummaryConfirmOpen(false);
      toast.success("Summary and action items deleted successfully");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete summary");
    },
  });

  // Toggle action item mutation
  const toggleMutation = useMutation({
    mutationFn: (actionItemId: string) => toggleActionItemStatus(actionItemId),
    onSuccess: (updatedItem) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            actionItems: old.actionItems.map((item) =>
              item._id === updatedItem._id ? updatedItem : item
            ),
          };
        }
      );
      toast.success(
        updatedItem.status === "completed"
          ? "Action item completed!"
          : "Action item reopened"
      );
    },
    onError: () => {
      toast.error("Failed to update action item status");
    },
  });

  // Add manual action item mutation
  const addItemMutation = useMutation({
    mutationFn: () =>
      createMeetingActionItem(meetingId, {
        task: newTask,
        assigneeName: newAssigneeName || "Unassigned",
        priority: newPriority,
      }),
    onSuccess: (newItem) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            actionItems: [...old.actionItems, newItem],
          };
        }
      );
      setNewTask("");
      setNewAssigneeName("");
      setNewPriority("medium");
      setIsAddingItem(false);
      toast.success("Action item added!");
    },
    onError: () => {
      toast.error("Failed to add action item");
    },
  });

  // Update action item mutation
  const updateItemMutation = useMutation({
    mutationFn: ({
      actionItemId,
      payload,
    }: {
      actionItemId: string;
      payload: {
        task?: string;
        assigneeName?: string;
        priority?: ActionItemPriority;
      };
    }) => updateMeetingActionItem(actionItemId, payload),
    onSuccess: (updatedItem) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            actionItems: old.actionItems.map((item) =>
              item._id === updatedItem._id ? updatedItem : item
            ),
          };
        }
      );
      setEditingItemId(null);
      toast.success("Action item updated!");
    },
    onError: () => {
      toast.error("Failed to update action item");
    },
  });

  const handleStartEdit = (item: MeetingActionItem) => {
    setEditingItemId(item._id);
    setEditTask(item.task);
    setEditAssigneeName(item.assigneeName || "");
    setEditPriority(item.priority || "medium");
  };

  // Delete action item mutation
  const deleteItemMutation = useMutation({
    mutationFn: (actionItemId: string) => deleteMeetingActionItem(actionItemId),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            actionItems: old.actionItems.filter((item) => item._id !== deletedId),
          };
        }
      );
      setDeletingActionItemId(null);
      toast.success("Action item removed");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to remove action item");
    },
  });

  // Convert Action Item to Kanban Task (Day 19) state
  const [convertModalItem, setConvertModalItem] = useState<MeetingActionItem | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState("col-todo");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<ActionItemPriority>("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskTags, setTaskTags] = useState("Meeting, ActionItem");

  // Fetch workspaces for Convert to Task modal
  const { data: userTeams = [] } = useQuery<Team[]>({
    queryKey: ["userTeams"],
    queryFn: () => getUserTeams(),
    staleTime: 1000 * 60,
  });

  const activeTeams = useMemo(() => {
    return userTeams.filter(
      (t) => t.currentUserStatus === "active" || !t.currentUserStatus
    );
  }, [userTeams]);

  // Fetch project boards for selected team
  const { data: teamProjects = [] } = useQuery<ProjectBoard[]>({
    queryKey: ["team-projects", selectedTeamId],
    queryFn: () => getProjectsByTeam(selectedTeamId),
    enabled: !!selectedTeamId,
    staleTime: 1000 * 30,
  });

  // Active members of selected team
  const selectedTeamMembers = useMemo(() => {
    const t = activeTeams.find((team) => team._id === selectedTeamId);
    if (!t || !t.members) return [];
    return t.members
      .filter((m) => m.status === "active" || !m.status)
      .map((m) => m.user)
      .filter(Boolean);
  }, [activeTeams, selectedTeamId]);

  // Auto-set selectedProjectId when teamProjects loads
  useEffect(() => {
    if (teamProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(teamProjects[0]._id);
    }
  }, [teamProjects, selectedProjectId]);

  // Auto-match assignee from meeting attendee to workspace team member
  useEffect(() => {
    if (convertModalItem && selectedTeamMembers.length > 0 && !selectedAssigneeId) {
      const match = selectedTeamMembers.find(
        (m: any) =>
          (convertModalItem.assignee?._id && m._id === convertModalItem.assignee._id) ||
          (convertModalItem.assigneeName &&
            (m.name?.toLowerCase().includes(convertModalItem.assigneeName.toLowerCase()) ||
              m.username?.toLowerCase().includes(convertModalItem.assigneeName.toLowerCase())))
      );
      if (match) {
        setSelectedAssigneeId((match as any)._id);
      }
    }
  }, [selectedTeamMembers, convertModalItem, selectedAssigneeId]);

  // Open convert modal
  const handleOpenConvertModal = (item: MeetingActionItem) => {
    setConvertModalItem(item);
    setTaskTitle(item.task);
    setTaskDescription(`Action item from meeting "${meetingTitle}": ${item.task}`);
    setTaskPriority(item.priority || "medium");
    setTaskDueDate(
      item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : ""
    );
    setTaskTags("Meeting, ActionItem");
    setSelectedColumnId("col-todo");

    const defaultTeam = activeTeams[0];
    if (defaultTeam) {
      setSelectedTeamId(defaultTeam._id);
    } else {
      setSelectedTeamId("");
    }
    setSelectedProjectId("");
    setSelectedAssigneeId(item.assignee?._id || "");
  };

  // Convert mutation
  const convertTaskMutation = useMutation({
    mutationFn: () => {
      if (!convertModalItem) throw new Error("No item selected");
      return convertActionItemToTask(convertModalItem._id, {
        teamId: selectedTeamId,
        projectId: selectedProjectId,
        columnId: selectedColumnId,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: taskPriority,
        assignee: selectedAssigneeId || undefined,
        dueDate: taskDueDate || undefined,
        tags: taskTags.split(",").map((t) => t.trim()).filter(Boolean),
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["meeting-summary", meetingId],
        (old: MeetingSummaryResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            actionItems: old.actionItems.map((item) =>
              item._id === data.actionItem._id ? data.actionItem : item
            ),
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["tasks", selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ["team", selectedTeamId] });
      toast.success("Action item converted to Kanban task successfully!");
      setConvertModalItem(null);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Failed to convert action item to task"
      );
    },
  });

  // Copy full summary to clipboard
  const handleCopy = async () => {
    if (!summary) return;
    try {
      let text = `AI MEETING SUMMARY: ${meetingTitle}\n\n`;
      text += `EXECUTIVE OVERVIEW:\n${summary.overview}\n\n`;

      if (summary.keyPoints?.length > 0) {
        text += `KEY DISCUSSION POINTS:\n`;
        summary.keyPoints.forEach((p, i) => {
          text += `${i + 1}. ${p}\n`;
        });
        text += `\n`;
      }

      if (summary.decisions?.length > 0) {
        text += `DECISIONS MADE:\n`;
        summary.decisions.forEach((d) => {
          text += `[✓] ${d}\n`;
        });
        text += `\n`;
      }

      if (actionItems.length > 0) {
        text += `ACTION ITEMS & DELIVERABLES:\n`;
        actionItems.forEach((item, i) => {
          const mark = item.status === "completed" ? "[x]" : "[ ]";
          text += `${i + 1}. ${mark} ${item.task} (Owner: ${item.assigneeName || "Unassigned"})\n`;
        });
      }

      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Summary copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy summary");
    }
  };

  // Export summary as file
  const handleExport = async (format: "txt" | "md") => {
    try {
      const sanitized = (meetingTitle || "summary").replace(/[^a-z0-9_-]/gi, "-");
      await downloadMeetingSummary(meetingId, format, `${sanitized}-summary`);
      toast.success(`Downloaded summary (${format.toUpperCase()})`);
    } catch {
      toast.error(`Failed to export summary`);
    }
  };

  // Completion metrics
  const completedCount = useMemo(() => {
    return actionItems.filter((i) => i.status === "completed").length;
  }, [actionItems]);

  const completionPercentage = useMemo(() => {
    if (actionItems.length === 0) return 0;
    return Math.round((completedCount / actionItems.length) * 100);
  }, [completedCount, actionItems.length]); return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 sm:p-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide">
                  AI Meeting Summary & Action Items
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/25 border border-purple-400/30 text-purple-200">
                  <Cpu className="w-2.5 h-2.5" />
                  AI Intelligence
                </span>
              </div>
              <p className="text-[11px] text-slate-300/80 mt-0.5">
                Executive recap, discussion highlights, decisions, and smart task extraction
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {summary && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 px-2.5 text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 rounded-lg gap-1.5"
                  title="Copy full summary"
                >
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{isCopied ? "Copied" : "Copy"}</span>
                </Button>

                <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-lg overflow-hidden h-8">
                  <button
                    onClick={() => handleExport("txt")}
                    className="px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition flex items-center gap-1 border-r border-slate-700 h-full"
                    title="Download Plain Text"
                  >
                    <Download className="w-3 h-3 text-slate-400" />
                    TXT
                  </button>
                  <button
                    onClick={() => handleExport("md")}
                    className="px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition flex items-center gap-1 h-full"
                    title="Download Markdown"
                  >
                    MD
                  </button>
                </div>
              </>
            )}

            {summary ? (
              <div className="flex items-center gap-2">
                {summary.isTrusted ? (
                  // TRUSTED & FINALIZED BADGE (Delete icon removed)
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs"
                    title={`Verified and finalized as official source of truth by host`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Trusted & Finalized</span>
                  </span>
                ) : (
                  // DRAFT STATE (Awaiting Host Trust)
                  <>
                    {isHost ? (
                      <div className="flex items-center gap-1.5">
                        {/* TRUST BUTTON */}
                        <Button
                          size="sm"
                          onClick={() => setIsTrustConfirmOpen(true)}
                          disabled={trustSummaryMutation.isPending}
                          className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-xs gap-1.5 transition-all cursor-pointer"
                          title="Verify and finalize this summary (locks source of truth and removes delete)"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-white" />
                          <span>Trust Summary</span>
                        </Button>

                        {/* DELETE BUTTON */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsDeleteSummaryConfirmOpen(true)}
                          disabled={deleteSummaryMutation.isPending}
                          className="h-8 px-2.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg gap-1.5 transition-all cursor-pointer"
                          title="Delete summary to regenerate a new one"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                        Draft Summary (Pending Host Verification)
                      </span>
                    )}
                  </>
                )}
              </div>
            ) : (
              // NO SUMMARY YET - SHOW GENERATE BUTTON
              <Button
                size="sm"
                onClick={() => {
                  if (!canGenerate) {
                    toast.error("Please record the meeting first to generate summary.");
                    return;
                  }
                  generateMutation.mutate();
                }}
                disabled={generateMutation.isPending || isLoading || !canGenerate}
                title={!canGenerate ? "Recording required to generate summary" : undefined}
                className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-sm gap-1.5 transition-all"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating Summary...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Summary
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats Pill (when summary exists) */}
        {summary && (
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-slate-800/80 text-xs text-slate-300 flex-wrap">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              Tone:{" "}
              <strong className="text-white capitalize">
                {summary.sentiment || "Productive"}
              </strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              Key Points:{" "}
              <strong className="text-white font-mono">
                {summary.keyPoints?.length || 0}
              </strong>
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
              Action Items:{" "}
              <strong className="text-white font-mono">
                {actionItems.length}
              </strong>
              {actionItems.length > 0 && (
                <span className="text-emerald-400 font-mono text-[11px]">
                  ({completedCount}/{actionItems.length} done • {completionPercentage}%)
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="p-3.5 sm:p-5">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2.5">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <p className="text-xs">Loading AI meeting summary...</p>
          </div>
        ) : !summary ? (
          /* Empty State: Not generated yet */
          <div className="py-5 px-3 text-center max-w-sm mx-auto space-y-2.5">
            {!canGenerate ? (
              <>
                <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-xs">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-800">
                    No Recording Available
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Record a meeting session first to generate an executive AI summary and smart action items.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 mx-auto rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-800">
                    No Summary Generated Yet
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Generate an executive recap, key discussion takeaways, and smart action items from this meeting.
                  </p>
                </div>
                <div className="pt-1 flex justify-center">
                  {isHost ? (
                    <Button
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4 py-2 h-8 rounded-xl shadow gap-1.5"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Extracting Summary...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Summary & Tasks
                        </>
                      )}
                    </Button>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Waiting for meeting host to generate AI summary.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* Active Summary & Action Items View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Columns: Executive Overview, Key Points & Decisions */}
            <div className="lg:col-span-7 space-y-4">
              {/* Executive Overview Box */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/60 to-indigo-50/40 border border-purple-100 shadow-2xs space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  <span>Executive Overview</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                  {summary.overview}
                </p>
              </div>

              {/* Key Discussion Points */}
              {summary.keyPoints && summary.keyPoints.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <ListOrdered className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Key Discussion Highlights</span>
                  </div>
                  <div className="space-y-1.5">
                    {summary.keyPoints.map((point, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-700 hover:bg-indigo-50/30 transition"
                      >
                        <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <p className="leading-relaxed flex-1">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Decisions Made */}
              {summary.decisions && summary.decisions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Agreed Decisions & Outcomes</span>
                  </div>
                  <div className="space-y-1.5">
                    {summary.decisions.map((decision, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-950"
                      >
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <p className="leading-relaxed flex-1 font-medium">{decision}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right 5 Columns: Smart Action Items Checklist */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-purple-600" />
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Smart Action Items ({actionItems.length})
                  </h4>
                </div>

                {isHost && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingItem(!isAddingItem)}
                    className="h-7 px-2 text-xs rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 gap-1"
                  >
                    <Plus className="w-3 h-3 text-purple-600" />
                    Add Task
                  </Button>
                )}
              </div>

              {/* Inline Add Action Item Form */}
              {isAddingItem && (
                <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2 animate-in fade-in duration-200">
                  <input
                    type="text"
                    placeholder="Action item task description..."
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {participants && participants.length > 0 ? (
                      <select
                        value={newAssigneeName}
                        onChange={(e) => setNewAssigneeName(e.target.value)}
                        className="text-xs p-1.5 rounded-lg bg-white border border-slate-200 flex-1 min-w-[120px] text-slate-700"
                      >
                        <option value="">Unassigned</option>
                        {participants.map((p) => (
                          <option key={p._id} value={p.name || p.username}>
                            {p.name || p.username}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Assignee name (e.g. Member 1)"
                        value={newAssigneeName}
                        onChange={(e) => setNewAssigneeName(e.target.value)}
                        className="text-xs p-1.5 rounded-lg bg-white border border-slate-200 flex-1 min-w-[120px]"
                      />
                    )}
                    <select
                      value={newPriority}
                      onChange={(e) =>
                        setNewPriority(e.target.value as ActionItemPriority)
                      }
                      className="text-xs p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsAddingItem(false)}
                      className="h-7 text-xs text-slate-500"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => addItemMutation.mutate()}
                      disabled={!newTask.trim() || addItemMutation.isPending}
                      className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {addItemMutation.isPending ? "Adding..." : "Add"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Items List */}
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {actionItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                    <CheckSquare className="w-5 h-5 mx-auto text-slate-300" />
                    <p>No actionable tasks identified from this discussion.</p>
                  </div>
                ) : (
                  actionItems.map((item: MeetingActionItem) => {
                    const isDone = item.status === "completed";
                    const itemAssigneeId =
                      typeof item.assignee === "object" ? item.assignee?._id : item.assignee;
                    const isItemAssignee = Boolean(
                      currentUserId &&
                        ((itemAssigneeId && String(currentUserId) === String(itemAssigneeId)) ||
                          (item.assigneeName &&
                            currentUser &&
                            (item.assigneeName.toLowerCase() === (currentUser.name || "").toLowerCase() ||
                              item.assigneeName.toLowerCase() ===
                                (currentUser.username || "").toLowerCase())))
                    );
                    const canConvertToKanban =
                      (isHost || isItemAssignee) && !item.isConverted && !item.isWorkspaceTaskDeleted;

                    if (editingItemId === item._id) {
                      return (
                        <div
                          key={item._id}
                          className="p-3 rounded-xl bg-purple-50/70 border border-purple-300 space-y-2 animate-in fade-in duration-150"
                        >
                          <div className="flex items-center justify-between pb-1 border-b border-purple-200/60">
                            <span className="text-[11px] font-semibold text-purple-900 flex items-center gap-1">
                              <Pencil className="w-3 h-3 text-purple-600" />
                              Edit Task
                            </span>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Action item task description..."
                            value={editTask}
                            onChange={(e) => setEditTask(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          <div className="flex items-center gap-2 flex-wrap">
                            {participants && participants.length > 0 ? (
                              <select
                                value={editAssigneeName}
                                onChange={(e) => setEditAssigneeName(e.target.value)}
                                className="text-xs p-1.5 rounded-lg bg-white border border-slate-200 flex-1 min-w-[120px] text-slate-700"
                              >
                                <option value="Unassigned">Unassigned</option>
                                {participants.map((p) => (
                                  <option key={p._id} value={p.name || p.username}>
                                    {p.name || p.username}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="Assignee name (e.g. Member 1)"
                                value={editAssigneeName}
                                onChange={(e) => setEditAssigneeName(e.target.value)}
                                className="text-xs p-1.5 rounded-lg bg-white border border-slate-200 flex-1 min-w-[120px]"
                              />
                            )}
                            <select
                              value={editPriority}
                              onChange={(e) =>
                                setEditPriority(e.target.value as ActionItemPriority)
                              }
                              className="text-xs p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700"
                            >
                              <option value="low">Low Priority</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingItemId(null)}
                              className="h-7 text-xs text-slate-500"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() =>
                                updateItemMutation.mutate({
                                  actionItemId: item._id,
                                  payload: {
                                    task: editTask,
                                    assigneeName: editAssigneeName || "Unassigned",
                                    priority: editPriority,
                                  },
                                })
                              }
                              disabled={!editTask.trim() || updateItemMutation.isPending}
                              className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              {updateItemMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item._id}
                        className={`group p-3 rounded-xl border transition-all duration-200 flex items-start gap-2.5 ${isDone
                          ? "bg-slate-50/80 border-slate-200/80 opacity-75"
                          : "bg-white border-slate-200 hover:border-purple-300 hover:shadow-xs"
                          }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleMutation.mutate(item._id)}
                          className="mt-0.5 text-slate-400 hover:text-purple-600 transition shrink-0"
                          title={isDone ? "Mark as pending" : "Mark as completed"}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                          ) : (
                            <Circle className="w-4 h-4 hover:stroke-purple-600" />
                          )}
                        </button>

                        {/* Task Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p
                            className={`text-xs leading-relaxed font-medium transition ${isDone
                              ? "line-through text-slate-400"
                              : "text-slate-800"
                              }`}
                          >
                            {item.task}
                          </p>

                          {/* Metadata row: Assignee, Priority, Due Date */}
                          <div className="flex items-center gap-2 flex-wrap text-[10px]">
                            {/* Assignee Badge */}
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              {item.assigneeName || "Team"}
                            </span>

                            {/* Priority Badge */}
                            <span
                              className={`px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${item.priority === "urgent"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : item.priority === "high"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : item.priority === "medium"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                            >
                              {item.priority}
                            </span>

                            {/* Updated Counter Badge */}
                            {item.updateCount && item.updateCount > 0 ? (
                              <span
                                className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md text-[10px]"
                                title={`Synchronized revision (${item.updateCount} updates)`}
                              >
                                <RefreshCw className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{item.updateCount === 1 ? "Updated" : `Updated ${item.updateCount}x`}</span>
                              </span>
                            ) : null}

                            {/* Timeframe / Due */}
                            {item.dueDateText && item.dueDateText !== "TBD" && (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                {item.dueDateText}
                              </span>
                            )}

                            {/* Converted to Task Link or Convert Button or Deleted from Workspace */}
                            {item.isConverted && item.convertedProject ? (
                              <Link
                                to={`/teams/${(item.convertedTeam as any)?._id || item.convertedTeam}/projects/${(item.convertedProject as any)?._id || item.convertedProject}`}
                                className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 px-2 py-0.5 rounded-md transition"
                                title="Open in Kanban Project Board"
                              >
                                <FolderKanban className="w-2.5 h-2.5 text-indigo-600" />
                                <span>Board: {(item.convertedProject as any)?.name || "Kanban"} ↗</span>
                              </Link>
                            ) : item.isWorkspaceTaskDeleted ? (
                              <span
                                className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md text-[10px]"
                                title="This task was deleted from the workspace Kanban board"
                              >
                                <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                                <span>Deleted from Workspace</span>
                              </span>
                            ) : canConvertToKanban ? (
                              <button
                                type="button"
                                onClick={() => handleOpenConvertModal(item)}
                                className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 px-2 py-0.5 rounded-md transition cursor-pointer"
                                title="Convert Action Item to Kanban Project Task"
                              >
                                <FolderKanban className="w-2.5 h-2.5 text-purple-600" />
                                <span>Convert to Task</span>
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Edit & Delete Action Buttons (Host only, strictly before Kanban conversion or if deleted from workspace) */}
                        {isHost && !item.isConverted && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            {!item.isWorkspaceTaskDeleted && (
                              <button
                                onClick={() => handleStartEdit(item)}
                                className="text-slate-300 hover:text-purple-600 p-1 rounded transition"
                                title="Edit action item"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingActionItemId(item._id)}
                              className="text-slate-300 hover:text-red-500 p-1 rounded transition"
                              title={
                                item.isWorkspaceTaskDeleted
                                  ? "Delete removed task from summary"
                                  : "Delete action item"
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CONVERT ACTION ITEM TO KANBAN TASK MODAL (DAY 19) */}
      {convertModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Convert to Kanban Task
                  </h3>
                  <p className="text-xs text-slate-500">
                    Send this meeting action item directly to a project board.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConvertModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskTitle.trim()) {
                  toast.error("Task title is required");
                  return;
                }
                if (!selectedTeamId) {
                  toast.error("Please select a workspace");
                  return;
                }
                if (!selectedProjectId) {
                  toast.error("Please select a project board");
                  return;
                }
                convertTaskMutation.mutate();
              }}
              className="space-y-4"
            >
              {/* Task Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Task Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Task Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Description
                </label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Task details or context..."
                  rows={2}
                  className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Workspace & Project Board row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Workspace <span className="text-red-500">*</span>
                  </label>
                  {activeTeams.length === 0 ? (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                      No active workspaces found. Please join or create a team first.
                    </div>
                  ) : (
                    <select
                      value={selectedTeamId}
                      onChange={(e) => {
                        setSelectedTeamId(e.target.value);
                        setSelectedProjectId("");
                      }}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      <option value="">Select Workspace...</option>
                      {activeTeams.map((t) => (
                        <option key={t._id} value={t._id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Project Board <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={!selectedTeamId || teamProjects.length === 0}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50 disabled:text-slate-400"
                    required
                  >
                    <option value="">
                      {!selectedTeamId
                        ? "Select workspace first"
                        : teamProjects.length === 0
                        ? "No boards in this workspace"
                        : "Select Board..."}
                    </option>
                    {teamProjects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Column & Priority row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Kanban Column
                  </label>
                  <select
                    value={selectedColumnId}
                    onChange={(e) => setSelectedColumnId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="col-todo">To Do</option>
                    <option value="col-in-progress">In Progress</option>
                    <option value="col-review">Review</option>
                    <option value="col-done">Done</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) =>
                      setTaskPriority(e.target.value as ActionItemPriority)
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                </div>
              </div>

              {/* Assignee & Due Date row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Assignee</span>
                    {convertModalItem.assigneeName && convertModalItem.assigneeName !== "Unassigned" && (
                      <span className="text-[10px] text-purple-600 font-normal">
                        Meeting: {convertModalItem.assigneeName}
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedAssigneeId}
                    onChange={(e) => setSelectedAssigneeId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Unassigned</option>
                    {selectedTeamMembers.map((member: any) => (
                      <option key={member._id} value={member._id}>
                        {member.name} {member.email ? `(${member.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={taskTags}
                  onChange={(e) => setTaskTags(e.target.value)}
                  placeholder="e.g. Meeting, AI, ActionItem"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConvertModalItem(null)}
                  className="rounded-xl border-slate-200 text-slate-600 text-xs h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    convertTaskMutation.isPending ||
                    !taskTitle.trim() ||
                    !selectedTeamId ||
                    !selectedProjectId
                  }
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-xs h-10 px-5 shadow-xs flex items-center gap-1.5"
                >
                  {convertTaskMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <FolderKanban className="w-4 h-4" />
                      <span>Convert & Add Task</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRUST / FINALIZE CONFIRM MODAL */}
      {isTrustConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Mark Summary as Trusted?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Once marked as trusted, this meeting summary becomes the official verified source of truth for all participants. The delete option will be permanently removed.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTrustConfirmOpen(false)}
                disabled={trustSummaryMutation.isPending}
                className="rounded-xl border-slate-200 text-xs px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => trustSummaryMutation.mutate()}
                disabled={trustSummaryMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold px-4 shadow-sm"
              >
                {trustSummaryMutation.isPending ? "Finalizing..." : "Confirm & Trust"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SUMMARY CONFIRM MODAL */}
      {isDeleteSummaryConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Delete Meeting Summary?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure? This will permanently delete this AI summary and all extracted action items from the database. A fresh summary can then be generated.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteSummaryConfirmOpen(false)}
                disabled={deleteSummaryMutation.isPending}
                className="rounded-xl border-slate-200 text-xs px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => deleteSummaryMutation.mutate()}
                disabled={deleteSummaryMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold px-4 shadow-sm"
              >
                {deleteSummaryMutation.isPending ? "Deleting..." : "Delete Summary"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACTION ITEM CONFIRM MODAL */}
      {deletingActionItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                Delete Action Item?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to delete this action item from the meeting summary? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeletingActionItemId(null)}
                disabled={deleteItemMutation.isPending}
                className="rounded-xl border-slate-200 text-xs px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (deletingActionItemId) {
                    deleteItemMutation.mutate(deletingActionItemId);
                  }
                }}
                disabled={deleteItemMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold px-4 shadow-sm"
              >
                {deleteItemMutation.isPending ? "Deleting..." : "Delete Item"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
