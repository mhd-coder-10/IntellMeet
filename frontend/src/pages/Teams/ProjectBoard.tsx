// Kanban Project Board Component
// Full-featured responsive Kanban board with columns, card drag-and-drop,
// mobile tap-to-move actions, real-time socket updates, comments, and list view

import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FolderKanban,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Flame,
  RefreshCw,
  Trash2,
  Pencil,
  MessageSquare,
  Send,
  Calendar,
  LayoutGrid,
  List,
  X,
  Loader2,
  Building2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { getProjectById, getTeamById } from "@/services/teamService";
import {
  getTasksByProject,
  createTask,
  moveTask,
  updateTask,
  deleteTask,
  addTaskComment,
} from "@/services/taskService";
import { useAuthStore } from "@/store/authStore";
import { useSocket } from "@/hooks/useSocket";
import type { ProjectBoard as IProjectBoard, Team, TeamMemberUser } from "@/types/team";
import type { KanbanTask, TaskPriority } from "@/types/task";

const COLUMNS_CONFIG = [
  {
    id: "col-todo",
    title: "To Do",
    status: "todo",
    color: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    borderTop: "border-t-slate-400",
    lightBg: "bg-slate-50/70",
  },
  {
    id: "col-in-progress",
    title: "In Progress",
    status: "in_progress",
    color: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    borderTop: "border-t-amber-500",
    lightBg: "bg-amber-50/40",
  },
  {
    id: "col-review",
    title: "In Review",
    status: "review",
    color: "bg-purple-500",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    borderTop: "border-t-purple-500",
    lightBg: "bg-purple-50/40",
  },
  {
    id: "col-done",
    title: "Done",
    status: "done",
    color: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    borderTop: "border-t-emerald-500",
    lightBg: "bg-emerald-50/40",
  },
];

const priorityStyles: Record<
  TaskPriority,
  { label: string; badge: string; icon: any }
> = {
  urgent: {
    label: "Urgent",
    badge: "bg-red-50 text-red-700 border-red-200",
    icon: Flame,
  },
  high: {
    label: "High",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
    icon: AlertCircle,
  },
  medium: {
    label: "Medium",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Clock,
  },
  low: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    icon: CheckCircle2,
  },
};

export default function ProjectBoard() {
  const { teamId: routeTeamId, projectId } = useParams<{
    teamId?: string;
    projectId: string;
  }>();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const { socket, isConnected } = useSocket();

  // Layout view: Kanban vs List
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Mobile focused column filter ("all" or column ID)
  const [mobileActiveColumn, setMobileActiveColumn] = useState<string>("all");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Drag-and-drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Modals state
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  // Create Task Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newColumnId, setNewColumnId] = useState("col-todo");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [newTags, setNewTags] = useState<string>("");

  // Edit Task State
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColumnId, setEditColumnId] = useState("col-todo");
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
  const [editAssignee, setEditAssignee] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [editTags, setEditTags] = useState<string>("");

  // Comment input state
  const [commentText, setCommentText] = useState("");

  // Fetch Project Board Details
  const {
    data: project,
    isLoading: isProjectLoading,
    isError: isProjectError,
  } = useQuery<IProjectBoard>({
    queryKey: ["project", projectId],
    queryFn: () => getProjectById(projectId!),
    enabled: !!projectId,
    staleTime: 10 * 1000,
  });

  const resolvedTeamId =
    routeTeamId ||
    (typeof project?.team === "string" ? project.team : (project?.team as any)?._id);

  // Fetch Team to get full member list for assignee dropdowns
  const { data: team } = useQuery<Team>({
    queryKey: ["team", resolvedTeamId],
    queryFn: () => getTeamById(resolvedTeamId!),
    enabled: !!resolvedTeamId,
    staleTime: 30 * 1000,
  });

  // Fetch Tasks for this board
  const {
    data: tasks = [],
    refetch: refetchTasks,
  } = useQuery<KanbanTask[]>({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasksByProject(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 1000,
  });

  // Socket.io Real-Time Synchronization
  useEffect(() => {
    if (!socket || !isConnected || !projectId) return;

    // Join room
    socket.emit("project:join", { projectId });

    const handleTaskCreated = (newTask: KanbanTask) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) => {
        if (!old) return [newTask];
        if (old.some((t) => t._id === newTask._id)) return old;
        return [...old, newTask];
      });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    };

    const handleTaskMoved = (payload: {
      taskId: string;
      columnId: string;
      order?: number;
      task?: KanbanTask;
    }) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) => {
        if (!old) return old;
        return old.map((t) =>
          t._id === payload.taskId
            ? { ...t, columnId: payload.columnId, order: payload.order ?? t.order }
            : t
        );
      });
      if (selectedTask && selectedTask._id === payload.taskId) {
        setSelectedTask((prev) =>
          prev ? { ...prev, columnId: payload.columnId } : null
        );
      }
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    };

    const handleTaskUpdated = (updatedTask: KanbanTask) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) => {
        if (!old) return [updatedTask];
        return old.map((t) => (t._id === updatedTask._id ? updatedTask : t));
      });
      if (selectedTask && selectedTask._id === updatedTask._id) {
        setSelectedTask(updatedTask);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    };

    const handleTaskDeleted = (payload: { taskId: string }) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) => {
        if (!old) return [];
        return old.filter((t) => t._id !== payload.taskId);
      });
      if (selectedTask && selectedTask._id === payload.taskId) {
        setSelectedTask(null);
      }
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    };

    socket.on("task:created", handleTaskCreated);
    socket.on("task:moved", handleTaskMoved);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:deleted", handleTaskDeleted);

    return () => {
      socket.emit("project:leave", { projectId });
      socket.off("task:created", handleTaskCreated);
      socket.off("task:moved", handleTaskMoved);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:deleted", handleTaskDeleted);
    };
  }, [socket, isConnected, projectId, queryClient, selectedTask]);

  // Sync selected task to edit state
  useEffect(() => {
    if (selectedTask) {
      setEditTitle(selectedTask.title || "");
      setEditDescription(selectedTask.description || "");
      setEditColumnId(selectedTask.columnId || "col-todo");
      setEditPriority(selectedTask.priority || "medium");
      setEditAssignee(
        selectedTask.assignee?._id ||
          (selectedTask.assignee as any) ||
          ""
      );
      setEditDueDate(
        selectedTask.dueDate
          ? new Date(selectedTask.dueDate).toISOString().split("T")[0]
          : ""
      );
      setEditTags((selectedTask.tags || []).join(", "));
    }
  }, [selectedTask]);

  // Keep selectedTask in sync with tasks list changes (from sockets, 2-way sync, or mutations)
  useEffect(() => {
    if (selectedTask) {
      const fresh = tasks.find((t) => t._id === selectedTask._id);
      if (
        fresh &&
        (fresh.updateCount !== selectedTask.updateCount ||
          fresh.title !== selectedTask.title ||
          fresh.description !== selectedTask.description ||
          fresh.priority !== selectedTask.priority ||
          fresh.columnId !== selectedTask.columnId ||
          fresh.dueDate !== selectedTask.dueDate)
      ) {
        setSelectedTask(fresh);
      }
    }
  }, [tasks]);

  // Create Task Mutation
  const createTaskMutation = useMutation({
    mutationFn: (data: any) => createTask(projectId!, data),
    onSuccess: (newTask) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) => {
        if (!old) return [newTask];
        if (old.some((t) => t._id === newTask._id)) return old;
        return [...old, newTask];
      });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task card created!");
      setIsCreateTaskOpen(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create task");
    },
  });

  // Move Task Mutation
  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, columnId }: { taskId: string; columnId: string }) =>
      moveTask(taskId, { columnId }),
    onSuccess: (updated) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) =>
        old
          ? old.map((t) => (t._id === updated._id ? { ...t, columnId: updated.columnId } : t))
          : []
      );
      if (socket && isConnected) {
        socket.emit("task:move", {
          projectId,
          taskId: updated._id,
          columnId: updated.columnId,
          order: updated.order,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to move task");
      refetchTasks();
    },
  });

  // Update Task Mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) =>
      updateTask(taskId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) =>
        old ? old.map((t) => (t._id === updated._id ? updated : t)) : [updated]
      );
      setSelectedTask(updated);
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task updated!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update task");
    },
  });

  // Delete Task Mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: (_, taskId) => {
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) =>
        old ? old.filter((t) => t._id !== taskId) : []
      );
      if (selectedTask?._id === taskId) {
        setSelectedTask(null);
      }
      setDeleteTaskId(null);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success("Task deleted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete task");
    },
  });

  // Add Comment Mutation
  const commentMutation = useMutation({
    mutationFn: ({ taskId, text }: { taskId: string; text: string }) =>
      addTaskComment(taskId, text),
    onSuccess: (updated) => {
      setSelectedTask(updated);
      queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) =>
        old ? old.map((t) => (t._id === updated._id ? updated : t)) : [updated]
      );
      setCommentText("");
      toast.success("Comment posted");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to post comment");
    },
  });

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewColumnId("col-todo");
    setNewPriority("medium");
    setNewAssignee("");
    setNewDueDate("");
    setNewTags("");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
      ]);
      toast.success("Board refreshed");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task || !canMoveTask(task)) {
      e.preventDefault();
      toast.error("Only the assigned member, task creator, or workspace admin can move this task");
      return;
    }
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (colId: string) => {
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    setDragOverColId(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.columnId === targetColId) return;

    if (!canMoveTask(task)) {
      toast.error("Permission Denied: Only the assigned member, task creator, or workspace admin can move this task");
      return;
    }

    // Optimistically move
    queryClient.setQueryData<KanbanTask[]>(["tasks", projectId], (old) =>
      old ? old.map((t) => (t._id === taskId ? { ...t, columnId: targetColId } : t)) : []
    );

    moveTaskMutation.mutate({ taskId, columnId: targetColId });
  };

  // Quick Move helper (for touch devices and dropdown actions)
  const handleQuickMove = (task: KanbanTask, targetColId: string) => {
    if (task.columnId === targetColId) return;
    if (!canMoveTask(task)) {
      toast.error("Permission Denied: Only the assigned member, task creator, or workspace admin can change task status");
      return;
    }
    moveTaskMutation.mutate({ taskId: task._id, columnId: targetColId });
  };

  const currentUserId = currentUser?.id || currentUser?._id;

  // Filter Tasks (with duplicate _id prevention)
  const filteredTasks = useMemo(() => {
    const seen = new Set<string>();
    return tasks.filter((t) => {
      if (!t._id || seen.has(t._id)) return false;
      seen.add(t._id);

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesTags = t.tags?.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      // Priority
      if (selectedPriority !== "all" && t.priority !== selectedPriority) {
        return false;
      }

      // Assignee
      if (selectedAssignee !== "all") {
        if (selectedAssignee === "unassigned") {
          if (t.assignee) return false;
        } else if (selectedAssignee === "me") {
          if (t.assignee?._id !== currentUserId) return false;
        } else {
          if (t.assignee?._id !== selectedAssignee) return false;
        }
      }

      return true;
    });
  }, [tasks, searchQuery, selectedPriority, selectedAssignee, currentUserId]);

  // Tasks grouped by column
  const columnTasks = useMemo(() => {
    const map: Record<string, KanbanTask[]> = {
      "col-todo": [],
      "col-in-progress": [],
      "col-review": [],
      "col-done": [],
    };

    filteredTasks.forEach((t) => {
      const col = t.columnId || "col-todo";
      if (!map[col]) map[col] = [];
      map[col].push(t);
    });

    return map;
  }, [filteredTasks]);

  // Members list for assignee select
  const availableMembers = useMemo(() => {
    if (!team?.members) return [];
    return team.members
      .map((m) => m.user)
      .filter((u): u is TeamMemberUser => !!u);
  }, [team]);

  // Permission calculations
  const isTeamOwner = useMemo(() => {
    if (!team || !currentUser) return false;
    const currentUserId = currentUser._id || currentUser.id;
    const ownerId = typeof team.owner === "string" ? team.owner : team.owner?._id;
    return ownerId === currentUserId;
  }, [team, currentUser]);

  const isTeamAdmin = useMemo(() => {
    if (!team?.members || !currentUser) return false;
    const currentUserId = currentUser._id || currentUser.id;
    return team.members.some((m) => {
      const uId = typeof m.user === "string" ? m.user : m.user?._id;
      return uId === currentUserId && (m.role === "admin" || m.role === "owner");
    });
  }, [team, currentUser]);

  // Check if current user is Task Creator or Workspace Owner/Admin
  const canModifyTask = (task: KanbanTask) => {
    if (!currentUser || !task) return false;
    if (isTeamOwner || isTeamAdmin) return true;
    const currentUserId = currentUser._id || currentUser.id;
    const creatorId =
      typeof task.creator === "string"
        ? task.creator
        : (task.creator as any)?._id || (task.creator as any)?.id;
    return Boolean(creatorId && String(creatorId) === String(currentUserId));
  };

  // Check if current user is Task Assignee, Task Creator, or Workspace Owner/Admin
  const canMoveTask = (task: KanbanTask) => {
    if (!currentUser || !task) return false;
    if (isTeamOwner || isTeamAdmin) return true;
    const currentUserId = currentUser._id || currentUser.id;
    const creatorId =
      typeof task.creator === "string"
        ? task.creator
        : (task.creator as any)?._id || (task.creator as any)?.id;
    if (creatorId && String(creatorId) === String(currentUserId)) return true;

    const assigneeId =
      typeof task.assignee === "string"
        ? task.assignee
        : (task.assignee as any)?._id || (task.assignee as any)?.id;
    if (assigneeId && String(assigneeId) === String(currentUserId)) return true;

    return false;
  };

  const canDeleteSelectedTask = useMemo(() => {
    if (!selectedTask) return false;
    return canModifyTask(selectedTask);
  }, [selectedTask, currentUser, isTeamOwner, isTeamAdmin]);

  const canEditSelectedTask = useMemo(() => {
    if (!selectedTask) return false;
    // Core details can ONLY be edited by the creator or workspace admin/owner (not assignee)
    return canModifyTask(selectedTask);
  }, [selectedTask, currentUser, isTeamOwner, isTeamAdmin]);

  const canMoveSelectedTask = useMemo(() => {
    if (!selectedTask) return false;
    return canMoveTask(selectedTask);
  }, [selectedTask, currentUser, isTeamOwner, isTeamAdmin]);

  if (isProjectLoading) {
    return (
      <div className="w-full">
        <main className="w-full px-4 sm:px-6 md:px-8 py-16 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500 font-medium">
            Loading Kanban board...
          </p>
        </main>
      </div>
    );
  }

  if (isProjectError || !project) {
    return (
      <div className="w-full">
        <main className="w-full px-4 sm:px-6 md:px-8 py-16 text-center space-y-4">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Board Not Found</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            This project board does not exist or you do not have permission to view it.
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

  const teamName =
    typeof project.team === "object" && project.team !== null
      ? (project.team as any).name
      : team?.name || "Workspace";

  return (
    <div className="w-full max-w-full overflow-x-hidden min-w-0 pb-16">
      <main className="w-full px-4 sm:px-6 md:px-8 py-5 sm:py-6 space-y-5 min-w-0">
        {/* Navigation Breadcrumbs & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <Link
              to="/teams"
              className="hover:text-blue-600 transition flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Workspaces</span>
            </Link>
            <span className="text-slate-300">/</span>
            {resolvedTeamId && (
              <>
                <Link
                  to={`/teams/${resolvedTeamId}`}
                  className="hover:text-blue-600 transition truncate max-w-[140px] sm:max-w-xs"
                >
                  {teamName}
                </Link>
                <span className="text-slate-300">/</span>
              </>
            )}
            <span className="text-slate-900 font-bold truncate max-w-[160px] sm:max-w-sm">
              {project.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher: Kanban vs List */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewMode === "kanban"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Kanban Board View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewMode === "list"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-white text-xs h-8 sm:h-9 gap-1.5 shadow-xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-600" : ""}`}
              />
              <span className="hidden md:inline">Refresh</span>
            </Button>

            <Button
              onClick={() => {
                setNewColumnId("col-todo");
                setIsCreateTaskOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4 shadow-xs gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </Button>
          </div>
        </div>

        {/* Board Title Banner */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FolderKanban className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                {project.name}
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                Active Board
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-slate-500 max-w-2xl">
                {project.description}
              </p>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 text-xs text-slate-600 overflow-x-auto pb-1 md:pb-0">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-1.5 shrink-0">
              <span className="text-slate-400">Total:</span>
              <strong className="text-slate-900">{tasks.length}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-800 flex items-center gap-1.5 shrink-0">
              <span>In Progress:</span>
              <strong>{columnTasks["col-in-progress"]?.length || 0}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-800 flex items-center gap-1.5 shrink-0">
              <span>Completed:</span>
              <strong>{columnTasks["col-done"]?.length || 0}</strong>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards by title, details, tags..."
              className="pl-9 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Priority filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              aria-label="Filter tasks by priority"
              className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔥 Urgent</option>
              <option value="high">⚠️ High</option>
              <option value="medium">⏱️ Medium</option>
              <option value="low">✅ Low</option>
            </select>

            {/* Assignee filter */}
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              aria-label="Filter tasks by assignee"
              className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[150px] truncate"
            >
              <option value="all">All Assignees</option>
              <option value="me">Assigned to Me</option>
              <option value="unassigned">Unassigned</option>
              {availableMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name}
                </option>
              ))}
            </select>

            {(searchQuery || selectedPriority !== "all" || selectedAssignee !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedPriority("all");
                  setSelectedAssignee("all");
                }}
                className="text-xs text-red-600 hover:bg-red-50 h-9 px-2 rounded-xl"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* MOBILE COLUMN SELECTOR PILLS (Visible on < md) */}
        {viewMode === "kanban" && (
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setMobileActiveColumn("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                mobileActiveColumn === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              All Columns
            </button>
            {COLUMNS_CONFIG.map((col) => {
              const count = columnTasks[col.id]?.length || 0;
              const isActive = mobileActiveColumn === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => setMobileActiveColumn(col.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  <span>{col.title}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* VIEW 1: KANBAN COLUMNS */}
        {viewMode === "kanban" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {COLUMNS_CONFIG.filter(
              (col) => mobileActiveColumn === "all" || mobileActiveColumn === col.id
            ).map((column) => {
              const colTasksList = columnTasks[column.id] || [];
              const isOver = dragOverColId === column.id;

              return (
                <div
                  key={column.id}
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDragLeave={() => handleDragLeave(column.id)}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`rounded-2xl border transition-all duration-200 bg-white/70 backdrop-blur-xs flex flex-col min-h-[500px] ${
                    column.borderTop
                  } border-t-4 ${
                    isOver
                      ? "border-blue-400 bg-blue-50/40 ring-2 ring-blue-400/20 shadow-md"
                      : "border-slate-200/90 shadow-xs"
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${column.color}`} />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                        {column.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${column.badge}`}
                      >
                        {colTasksList.length}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setNewColumnId(column.id);
                        setIsCreateTaskOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      title={`Add task to ${column.title}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tasks Droppable Container */}
                  <div className="p-2.5 sm:p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[75vh]">
                    {colTasksList.length === 0 ? (
                      <div
                        onClick={() => {
                          setNewColumnId(column.id);
                          setIsCreateTaskOpen(true);
                        }}
                        className="py-10 border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-xl text-center text-xs text-slate-400 cursor-pointer transition hover:bg-slate-50/50 flex flex-col items-center justify-center gap-1.5"
                      >
                        <Plus className="w-4 h-4 text-slate-300" />
                        <span>Add a card</span>
                      </div>
                    ) : (
                      colTasksList.map((task) => {
                        const pStyle = priorityStyles[task.priority] || priorityStyles.medium;
                        const PriorityIcon = pStyle.icon;
                        const isDragging = draggedTaskId === task._id;

                        // Check due date state
                        const isOverdue =
                          task.dueDate &&
                          new Date(task.dueDate) < new Date() &&
                          task.columnId !== "col-done";

                        const allowedToMove = canMoveTask(task);

                        return (
                          <div
                            key={task._id}
                            draggable={allowedToMove}
                            onDragStart={(e) => allowedToMove && handleDragStart(e, task._id)}
                            onClick={() => setSelectedTask(task)}
                            className={`group relative rounded-xl border bg-white p-3.5 shadow-xs hover:shadow-md transition-all duration-150 space-y-2.5 ${
                              isDragging
                                ? "opacity-40 border-blue-400 scale-[0.98]"
                                : "border-slate-200/90 hover:border-blue-300"
                            } ${
                              allowedToMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                            }`}
                          >
                            {/* Card Top Pill Row */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${pStyle.badge}`}
                                >
                                  <PriorityIcon className="w-3 h-3" />
                                  <span>{pStyle.label}</span>
                                </span>

                                {task.updateCount && task.updateCount > 0 ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    title={`Synchronized revision (${task.updateCount} updates)`}
                                  >
                                    <RefreshCw className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>{task.updateCount === 1 ? "Updated" : `Updated ${task.updateCount}x`}</span>
                                  </span>
                                ) : null}
                              </div>

                              {/* Quick Move Action Button or Lock Indicator */}
                              {allowedToMove ? (
                                <div
                                  className="relative flex items-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <select
                                    value={task.columnId}
                                    onChange={(e) =>
                                      handleQuickMove(task, e.target.value)
                                    }
                                    aria-label="Move task to column"
                                    className="text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg px-1.5 py-0.5 font-medium focus:outline-none cursor-pointer"
                                    title="Quick move to another column"
                                  >
                                    <option value="col-todo">To Do</option>
                                    <option value="col-in-progress">In Progress</option>
                                    <option value="col-review">Review</option>
                                    <option value="col-done">Done</option>
                                  </select>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-100/70 px-2 py-0.5 rounded-md border border-slate-200/60"
                                  title="Only the assigned member, creator, or workspace admin can change task status"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                                  <span>Locked</span>
                                </div>
                              )}
                            </div>

                            {/* Card Title */}
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug">
                              {task.title}
                            </h4>

                            {/* Optional Description */}
                            {task.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Tags Chips */}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {task.tags.map((tag, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 font-medium"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Card Footer: Assignee, Due Date & Comments */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                              <div className="flex items-center gap-2">
                                {/* Assignee Avatar */}
                                {task.assignee ? (
                                  <div
                                    className="flex items-center gap-1.5 text-slate-700 font-medium"
                                    title={task.assignee.name}
                                  >
                                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                                      {task.assignee.name.slice(0, 1).toUpperCase()}
                                    </div>
                                    <span className="text-[10px] max-w-[80px] truncate">
                                      {task.assignee.name.split(" ")[0]}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Unassigned
                                  </span>
                                )}

                                {/* Edit & Delete Action Icons (Visible only to Task Creator & Workspace Owner/Admin) */}
                                {canModifyTask(task) && (
                                  <div
                                    className="flex items-center gap-0.5 pl-1.5 border-l border-slate-200"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTask(task)}
                                      className="text-slate-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 transition cursor-pointer"
                                      title="Edit / Update Task Details"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTaskId(task._id)}
                                      className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition cursor-pointer"
                                      title="Delete Task Card"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {task.dueDate && (
                                  <span
                                    className={`flex items-center gap-1 text-[10px] font-medium ${
                                      isOverdue
                                        ? "text-red-600 font-bold"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                      {new Date(task.dueDate).toLocaleDateString(
                                        undefined,
                                        { month: "short", day: "numeric" }
                                      )}
                                    </span>
                                  </span>
                                )}

                                {task.comments && task.comments.length > 0 && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-slate-500 font-medium">
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{task.comments.length}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* VIEW 2: LIST VIEW */
          <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Task Title</th>
                    <th className="py-3 px-4">Status / Column</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No tasks match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => {
                      const pStyle =
                        priorityStyles[task.priority] || priorityStyles.medium;
                      const colConfig =
                        COLUMNS_CONFIG.find((c) => c.id === task.columnId) ||
                        COLUMNS_CONFIG[0];

                      return (
                        <tr
                          key={task._id}
                          onClick={() => setSelectedTask(task)}
                          className="hover:bg-slate-50/60 transition cursor-pointer"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{task.title}</span>
                              {task.updateCount && task.updateCount > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0"
                                  title={`Task synchronized & revised (${task.updateCount} updates)`}
                                >
                                  <RefreshCw className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>{task.updateCount === 1 ? "Updated" : `Updated ${task.updateCount}x`}</span>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colConfig.badge}`}
                            >
                              {colConfig.title}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${pStyle.badge}`}
                            >
                              {pStyle.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {task.assignee ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                                  {task.assignee.name.slice(0, 1).toUpperCase()}
                                </div>
                                <span className="font-medium">
                                  {task.assignee.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                            {task.dueDate
                              ? new Date(task.dueDate).toLocaleDateString()
                              : "—"}
                          </td>
                          <td
                            className="py-3.5 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTask(task)}
                                className="text-blue-600 hover:bg-blue-50 text-xs h-8 px-2"
                              >
                                Details
                              </Button>
                              {canModifyTask(task) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTask(task)}
                                    className="text-slate-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition cursor-pointer"
                                    title="Edit / Update Task Details"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTaskId(task._id)}
                                    className="text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition cursor-pointer"
                                    title="Delete Task Card"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* CREATE TASK MODAL */}
      {isCreateTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Create New Task Card
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add a deliverable to your Kanban workflow.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateTaskOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTitle.trim()) {
                  toast.error("Task title is required");
                  return;
                }
                const parsedTags = newTags
                  .split(",")
                  .map((t) => t.trim().replace(/^#/, ""))
                  .filter(Boolean);

                createTaskMutation.mutate({
                  title: newTitle.trim(),
                  description: newDescription.trim(),
                  columnId: newColumnId,
                  priority: newPriority,
                  assignee: newAssignee || null,
                  dueDate: newDueDate || null,
                  tags: parsedTags,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Task Title *
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Implement WebRTC screen share toggle"
                  className="h-11 rounded-xl text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide context, acceptance criteria, or requirements..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Initial Column
                  </label>
                  <select
                    value={newColumnId}
                    onChange={(e) => setNewColumnId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="col-todo">To Do</option>
                    <option value="col-in-progress">In Progress</option>
                    <option value="col-review">In Review</option>
                    <option value="col-done">Done</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Assignee
                  </label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {availableMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} (@{m.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="h-11 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tags (Comma-separated)
                </label>
                <Input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="frontend, api, bug, security"
                  className="h-11 rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateTaskOpen(false)}
                  className="rounded-xl border-slate-200 text-slate-600 text-xs h-10"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTaskMutation.isPending || !newTitle.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-10 px-5 shadow-xs"
                >
                  {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAIL & COMMENTS MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-7 shadow-xl border border-slate-200 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                      priorityStyles[selectedTask.priority]?.badge
                    }`}
                  >
                    {priorityStyles[selectedTask.priority]?.label}
                  </span>
                  {selectedTask.updateCount && selectedTask.updateCount > 0 ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                      title={`Task synchronized & revised (${selectedTask.updateCount} updates)`}
                    >
                      <RefreshCw className="w-2.5 h-2.5 text-emerald-600" />
                      <span>{selectedTask.updateCount === 1 ? "Updated" : `Updated ${selectedTask.updateCount}x`}</span>
                    </span>
                  ) : null}
                  <span className="text-xs text-slate-400">
                    Created {new Date(selectedTask.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {selectedTask.title}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                {canDeleteSelectedTask && (
                  <button
                    onClick={() => setDeleteTaskId(selectedTask._id)}
                    className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition"
                    title="Delete Card (Creator or Team Admin only)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Read-Only Notice for Non-Creators */}
            {!canEditSelectedTask && (
              <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-800 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Read-only details:</strong> Only the task creator or team admin/owner can edit core task details. {canMoveSelectedTask ? "As the assigned member, you can update workflow column status or participate in comments." : "Status change is also restricted to the assigned member and admin."}
                </span>
              </div>
            )}

            {/* Column Switcher Pills */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Workflow Column
                </span>
                {!canMoveSelectedTask && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                    <Lock className="w-3 h-3 text-amber-500" />
                    Status change restricted
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COLUMNS_CONFIG.map((col) => {
                  const isActive = editColumnId === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      disabled={!canMoveSelectedTask}
                      onClick={() => {
                        setEditColumnId(col.id);
                        handleQuickMove(selectedTask, col.id);
                      }}
                      className={`p-2 rounded-xl text-xs font-semibold border transition text-center ${
                        isActive
                          ? `${col.badge} shadow-xs ring-1 ring-blue-500/20`
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      } ${!canMoveSelectedTask ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {col.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Title
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  disabled={!canEditSelectedTask}
                  className="h-10 text-xs sm:text-sm rounded-xl disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={!canEditSelectedTask}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    disabled={!canEditSelectedTask}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Assignee
                  </label>
                  <select
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    disabled={!canEditSelectedTask}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="">Unassigned</option>
                    {availableMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    disabled={!canEditSelectedTask}
                    className="h-9 text-xs rounded-xl disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              {canEditSelectedTask && (
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const parsedTags = editTags
                        .split(",")
                        .map((t) => t.trim().replace(/^#/, ""))
                        .filter(Boolean);

                      updateTaskMutation.mutate({
                        taskId: selectedTask._id,
                        data: {
                          title: editTitle.trim(),
                          description: editDescription.trim(),
                          columnId: editColumnId,
                          priority: editPriority,
                          assignee: editAssignee || null,
                          dueDate: editDueDate || null,
                          tags: parsedTags,
                        },
                      });
                    }}
                    disabled={updateTaskMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs h-9 px-4"
                  >
                    {updateTaskMutation.isPending ? "Saving..." : "Save Details"}
                  </Button>
                </div>
              )}
            </div>

            {/* Comments Thread Section */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Discussion & Updates ({selectedTask.comments?.length || 0})
                </h4>
              </div>

              {/* Comments List */}
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {!selectedTask.comments || selectedTask.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No comments yet. Start the conversation below.
                  </p>
                ) : (
                  selectedTask.comments.map((comment) => {
                    const user = comment.user;
                    const initial = (user?.name || "U")[0].toUpperCase();

                    return (
                      <div
                        key={comment._id}
                        className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">
                              {initial}
                            </div>
                            <span>{user?.name || "Member"}</span>
                          </div>
                          <span>
                            {new Date(comment.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-slate-700 text-xs pl-5.5 leading-relaxed">
                          {comment.text}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!commentText.trim()) return;
                  commentMutation.mutate({
                    taskId: selectedTask._id,
                    text: commentText.trim(),
                  });
                }}
                className="flex items-center gap-2 pt-1"
              >
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a message or update..."
                  className="h-9 text-xs rounded-xl bg-slate-50 flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={commentMutation.isPending || !commentText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs h-9 px-3 gap-1 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Task Card?</h3>
              <p className="text-xs text-slate-500">
                Are you sure? This card and its discussion thread will be permanently deleted.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTaskId(null)}
                className="rounded-xl border-slate-200 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => deleteTaskMutation.mutate(deleteTaskId)}
                disabled={deleteTaskMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
              >
                {deleteTaskMutation.isPending ? "Deleting..." : "Delete Card"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
