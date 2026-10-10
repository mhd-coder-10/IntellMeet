// AI Meeting Summary & Smart Action Items Card (Day 16)
// Displays Executive Overview, Key Discussion Points, Decisions Made,
// and interactive Action Items checklist with assignees and priority badges

import { useState, useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getMeetingSummary,
  generateMeetingSummary,
  downloadMeetingSummary,
  toggleActionItemStatus,
  createMeetingActionItem,
  updateMeetingActionItem,
  deleteMeetingActionItem,
} from "@/services/aiService";
import type {
  MeetingSummaryResponse,
  MeetingActionItem,
  ActionItemPriority,
} from "@/types/summary";

interface Props {
  meetingId: string;
  meetingTitle?: string;
  hasTranscript?: boolean;
  participants?: Array<{ _id: string; name: string; username: string }>;
}

export function SummaryAndActionItemsCard({
  meetingId,
  meetingTitle = "Meeting",
  hasTranscript = false,
  participants = [],
}: Props) {
  const queryClient = useQueryClient();
  const [isCopied, setIsCopied] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [newPriority, setNewPriority] = useState<ActionItemPriority>("medium");

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

  // Generate / Regenerate mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      generateMeetingSummary(meetingId, { forceRegenerate: true }),
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
      toast.success("Action item removed");
    },
    onError: () => {
      toast.error("Failed to remove action item");
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
  }, [completedCount, actionItems.length]);

  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
      {/* Header Bar */}
      <CardHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-3.5 sm:p-4 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner">
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm sm:text-base font-semibold text-white tracking-wide">
                  AI Meeting Summary & Action Items
                </CardTitle>
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

            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || isLoading}
              className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-sm gap-1.5 transition-all"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Summarizing...
                </>
              ) : summary ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Summary
                </>
              )}
            </Button>
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
      </CardHeader>

      <CardContent className="p-3.5 sm:p-5">
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2.5">
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <p className="text-xs">Loading AI meeting summary...</p>
          </div>
        ) : !summary ? (
          /* Empty State: Not generated yet */
          <div className="py-5 px-3 text-center max-w-sm mx-auto space-y-2.5">
            <div className="w-10 h-10 mx-auto rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-xs">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-800">
                No Summary Generated Yet
              </h3>
              <p className="text-[11px] text-slate-500 leading-normal">
                {hasTranscript
                  ? "Generate an executive recap, key discussion takeaways, and smart action items from this meeting."
                  : "Meeting speech transcript is recommended first to generate high-accuracy summaries."}
              </p>
            </div>
            <div className="pt-1 flex justify-center">
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
                    Generate AI Summary & Tasks
                  </>
                )}
              </Button>
            </div>
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

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingItem(!isAddingItem)}
                  className="h-7 px-2 text-xs rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 gap-1"
                >
                  <Plus className="w-3 h-3 text-purple-600" />
                  Add Task
                </Button>
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
                        className={`group p-3 rounded-xl border transition-all duration-200 flex items-start gap-2.5 ${
                          isDone
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
                            className={`text-xs leading-relaxed font-medium transition ${
                              isDone
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
                              className={`px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                                item.priority === "urgent"
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

                            {/* Timeframe / Due */}
                            {item.dueDateText && item.dueDateText !== "TBD" && (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                {item.dueDateText}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit & Delete Action Buttons (hover only) */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="text-slate-300 hover:text-purple-600 p-1 rounded transition"
                            title="Edit action item"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteItemMutation.mutate(item._id)}
                            className="text-slate-300 hover:text-red-500 p-1 rounded transition"
                            title="Delete action item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
