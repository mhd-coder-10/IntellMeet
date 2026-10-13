// Task Service (Kanban Cards)
// Handles task cards, moving between Kanban columns, reordering, and comments

const Task = require("../models/Task");
const Project = require("../models/Project");
const Team = require("../models/Team");
const notificationService = require("./notificationService");

// Map column IDs to status
const columnStatusMap = {
  "col-todo": "todo",
  "col-in-progress": "in_progress",
  "col-review": "review",
  "col-done": "done",
};

// Create a new task in a project board
const createTask = async (projectId, userId, data) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const { title, description, columnId = "col-todo", priority = "medium", assignee, dueDate, tags, meeting, actionItemId } = data;

  if (!title || !title.trim()) {
    throw new Error("Task title is required");
  }

  // Find highest order in target column
  const highestOrderTask = await Task.findOne({
    project: projectId,
    columnId: columnId || "col-todo",
  }).sort({ order: -1 });

  const order = highestOrderTask ? (highestOrderTask.order || 0) + 1 : 0;
  const status = columnStatusMap[columnId] || "todo";

  const task = await Task.create({
    title: title.trim(),
    description: (description || "").trim(),
    project: projectId,
    team: project.team,
    columnId: columnId || "col-todo",
    status,
    priority: priority || "medium",
    assignee: assignee || null,
    creator: userId,
    dueDate: dueDate ? new Date(dueDate) : null,
    order,
    tags: Array.isArray(tags) ? tags : [],
    meeting: meeting || null,
    actionItemId: actionItemId || null,
  });

  // If assigned to someone else, send notification
  if (assignee && assignee.toString() !== userId.toString()) {
    try {
      await notificationService.createNotification({
        recipient: assignee,
        sender: userId,
        type: "system",
        title: "New Task Assigned",
        message: `You were assigned task "${task.title}" on board "${project.name}"`,
        link: `/teams/${project.team}/projects/${project._id}`,
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr.message);
    }
  }

  return await Task.findById(task._id)
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture")
    .populate("comments.user", "name username email profilePicture");
};

// Get all tasks for a project board
const getTasksByProject = async (projectId) => {
  const tasks = await Task.find({ project: projectId })
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture")
    .populate("comments.user", "name username email profilePicture")
    .sort({ order: 1, createdAt: 1 });

  return tasks;
};

// Helper to collect member IDs involved in a project (owner, assignees, creators)
const getProjectMemberUserIds = async (projectId, project = null) => {
  const userIds = new Set();
  const proj = project || (await Project.findById(projectId));
  if (proj?.owner) {
    userIds.add(proj.owner.toString());
  }

  // Active assignees and creators on tasks belonging to this project
  const [assignees, creators] = await Promise.all([
    Task.distinct("assignee", { project: projectId, assignee: { $ne: null } }),
    Task.distinct("creator", { project: projectId, creator: { $ne: null } }),
  ]);

  assignees.forEach((id) => id && userIds.add(id.toString()));
  creators.forEach((id) => id && userIds.add(id.toString()));

  return userIds;
};

// Move a task between Kanban columns and update order
const moveTask = async (taskId, userId, { columnId, newOrder }) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error("Task not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await Team.findById(task.team);
  const isTeamOwner = team && team.owner && team.owner.toString() === userId.toString();
  const isTeamAdmin =
    team &&
    team.members &&
    team.members.some(
      (m) =>
        m.user &&
        m.user.toString() === userId.toString() &&
        (m.role === "admin" || m.role === "owner")
    );
  const isTaskCreator = task.creator && task.creator.toString() === userId.toString();
  const isTaskAssignee = task.assignee && task.assignee.toString() === userId.toString();

  if (!isTeamOwner && !isTeamAdmin && !isTaskCreator && !isTaskAssignee) {
    const error = new Error(
      "Permission Denied: Only the assigned member, task creator, or team admin/owner can change task status"
    );
    error.statusCode = 403;
    throw error;
  }

  const oldColumn = task.columnId;
  const targetColumn = columnId || oldColumn;
  const targetStatus = columnStatusMap[targetColumn] || task.status;

  task.columnId = targetColumn;
  task.status = targetStatus;
  if (typeof newOrder === "number") {
    task.order = newOrder;
  }

  await task.save();

  // 2-Way Sync to linked ActionItem if generated from one
  if (task.actionItemId) {
    try {
      const ActionItem = require("../models/ActionItem");
      const linkedItem = await ActionItem.findById(task.actionItemId);
      if (linkedItem) {
        if (targetStatus === "done" || targetColumn === "col-done") {
          linkedItem.status = "completed";
          linkedItem.completedAt = linkedItem.completedAt || new Date();
          linkedItem.completedBy = userId;
        } else if (targetStatus === "in_progress" || targetColumn === "col-in-progress") {
          linkedItem.status = "in_progress";
          linkedItem.completedAt = null;
          linkedItem.completedBy = null;
        } else {
          linkedItem.status = "pending";
          linkedItem.completedAt = null;
          linkedItem.completedBy = null;
        }
        await linkedItem.save();
      }
    } catch (syncErr) {
      console.warn("Failed to sync task move to action item:", syncErr.message);
    }
  }

  // Send status update notification if column changed (scoped strictly to project participants)
  if (oldColumn && targetColumn && oldColumn !== targetColumn) {
    const colLabels = {
      "col-todo": "To Do",
      "col-in-progress": "In Progress",
      "col-review": "In Review",
      "col-done": "Done",
    };
    try {
      const project = await Project.findById(task.project);
      const User = require("../models/User");
      const mover = await User.findById(userId);
      const moverName = mover?.name || "A team member";
      const toColLabel = colLabels[targetColumn] || targetColumn;

      // Notify strictly project members (not entire workspace)
      const notifyRecipients = await getProjectMemberUserIds(task.project, project);
      if (task.assignee) notifyRecipients.add(task.assignee.toString());
      if (task.creator) notifyRecipients.add(task.creator.toString());
      notifyRecipients.delete(userId.toString());

      for (const recipientId of notifyRecipients) {
        await notificationService.createNotification({
          recipient: recipientId,
          sender: userId,
          type: "task_status",
          title: "Task Status Updated",
          message: `${moverName} moved task "${task.title}" to "${toColLabel}" in board "${project?.name || "Board"}"`,
          link: project ? `/teams/${project.team}/projects/${project._id}` : "",
        });
      }
    } catch (nErr) {
      console.warn("Task status notification error:", nErr.message);
    }
  }

  return await Task.findById(task._id)
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture")
    .populate("comments.user", "name username email profilePicture");
};

// Update task details
const updateTask = async (taskId, userId, data) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error("Task not found");
    error.statusCode = 404;
    throw error;
  }

  // Detect if any core details actually changed (excluding status/column movement)
  const titleChanged = data.title !== undefined && data.title.trim() !== (task.title || "").trim();
  const descChanged =
    data.description !== undefined && data.description.trim() !== (task.description || "").trim();
  const priorityChanged = data.priority !== undefined && data.priority !== task.priority;
  const assigneeChanged =
    data.assignee !== undefined && String(data.assignee || "") !== String(task.assignee || "");
  const dueDateChanged =
    data.dueDate !== undefined &&
    (Boolean(data.dueDate) !== Boolean(task.dueDate) ||
      (data.dueDate &&
        task.dueDate &&
        new Date(data.dueDate).getTime() !== new Date(task.dueDate).getTime()));
  const tagsChanged =
    data.tags !== undefined &&
    Array.isArray(data.tags) &&
    JSON.stringify(data.tags) !== JSON.stringify(task.tags || []);

  const hasCoreDetailsChanged =
    titleChanged ||
    descChanged ||
    priorityChanged ||
    assigneeChanged ||
    dueDateChanged ||
    tagsChanged;

  if (hasCoreDetailsChanged) {
    const team = await Team.findById(task.team);
    const isTeamOwner = team && team.owner && team.owner.toString() === userId.toString();
    const isTeamAdmin =
      team &&
      team.members &&
      team.members.some(
        (m) =>
          m.user &&
          m.user.toString() === userId.toString() &&
          (m.role === "admin" || m.role === "owner")
      );
    const isTaskCreator = task.creator && task.creator.toString() === userId.toString();

    if (!isTeamOwner && !isTeamAdmin && !isTaskCreator) {
      const error = new Error(
        "Permission Denied: Only the task creator or team admin/owner can modify core task details"
      );
      error.statusCode = 403;
      throw error;
    }
  }

  // Check permissions for status or column changes
  const statusChanged =
    (data.status !== undefined && data.status !== task.status) ||
    (data.columnId !== undefined && data.columnId !== task.columnId);

  if (statusChanged) {
    const team = await Team.findById(task.team);
    const isTeamOwner = team && team.owner && team.owner.toString() === userId.toString();
    const isTeamAdmin =
      team &&
      team.members &&
      team.members.some(
        (m) =>
          m.user &&
          m.user.toString() === userId.toString() &&
          (m.role === "admin" || m.role === "owner")
      );
    const isTaskCreator = task.creator && task.creator.toString() === userId.toString();
    const isTaskAssignee = task.assignee && task.assignee.toString() === userId.toString();

    if (!isTeamOwner && !isTeamAdmin && !isTaskCreator && !isTaskAssignee) {
      const error = new Error(
        "Permission Denied: Only the assigned member, task creator, or team admin/owner can change task status"
      );
      error.statusCode = 403;
      throw error;
    }
  }

  const oldAssignee = task.assignee?.toString();

  if (data.title) task.title = data.title.trim();
  if (data.description !== undefined) task.description = data.description.trim();
  if (data.priority) task.priority = data.priority;
  if (data.columnId) {
    task.columnId = data.columnId;
    task.status = columnStatusMap[data.columnId] || task.status;
  }
  if (data.status) task.status = data.status;
  if (data.assignee !== undefined) task.assignee = data.assignee || null;
  if (data.dueDate !== undefined) task.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.tags && Array.isArray(data.tags)) task.tags = data.tags;

  // Only increment updateCount if core details actually changed (NOT on column move/status change)
  if (hasCoreDetailsChanged) {
    task.updateCount = (task.updateCount || 0) + 1;
  }

  await task.save();

  // 2-Way Sync to linked ActionItem if generated from one
  if (task.actionItemId) {
    try {
      const ActionItem = require("../models/ActionItem");
      const linkedItem = await ActionItem.findById(task.actionItemId);
      if (linkedItem) {
        if (data.title) linkedItem.task = data.title.trim();
        if (data.priority) linkedItem.priority = data.priority;
        if (data.dueDate !== undefined) {
          linkedItem.dueDate = data.dueDate ? new Date(data.dueDate) : null;
        }
        if (data.assignee !== undefined) {
          linkedItem.assignee = data.assignee || null;
          if (data.assignee) {
            const User = require("../models/User");
            const assigneeUser = await User.findById(data.assignee).select("name");
            linkedItem.assigneeName = assigneeUser?.name || "Assigned";
          } else {
            linkedItem.assigneeName = "Unassigned";
          }
        }
        if (data.columnId || data.status) {
          const curStatus = task.status;
          if (curStatus === "done") {
            linkedItem.status = "completed";
            linkedItem.completedAt = linkedItem.completedAt || new Date();
            linkedItem.completedBy = userId;
          } else if (curStatus === "in_progress") {
            linkedItem.status = "in_progress";
            linkedItem.completedAt = null;
            linkedItem.completedBy = null;
          } else {
            linkedItem.status = "pending";
            linkedItem.completedAt = null;
            linkedItem.completedBy = null;
          }
        }
        // Only increment action item updateCount if core details changed
        if (hasCoreDetailsChanged) {
          linkedItem.updateCount = (linkedItem.updateCount || 0) + 1;
        }
        await linkedItem.save();
      }
    } catch (syncErr) {
      console.warn("Failed to sync task update to action item:", syncErr.message);
    }
  }

  // If assignee changed, notify new assignee
  if (task.assignee && task.assignee.toString() !== oldAssignee && task.assignee.toString() !== userId.toString()) {
    try {
      await notificationService.createNotification({
        recipient: task.assignee,
        sender: userId,
        type: "system",
        title: "Task Assigned to You",
        message: `Task "${task.title}" has been assigned to you`,
        link: `/teams/${task.team}/projects/${task.project}`,
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr.message);
    }
  }

  // Send update notification scoped strictly to project members (only if core details changed)
  if (hasCoreDetailsChanged) {
    try {
      const project = await Project.findById(task.project);
      const User = require("../models/User");
      const updater = await User.findById(userId);
      const updaterName = updater?.name || "A team member";

      const notifyRecipients = await getProjectMemberUserIds(task.project, project);
      if (task.assignee) notifyRecipients.add(task.assignee.toString());
      if (task.creator) notifyRecipients.add(task.creator.toString());
      notifyRecipients.delete(userId.toString());

      for (const recipientId of notifyRecipients) {
        await notificationService.createNotification({
          recipient: recipientId,
          sender: userId,
          type: "task_updated",
          title: "Task Updated",
          message: `${updaterName} updated task "${task.title}" on board "${project?.name || "Board"}"`,
          link: project ? `/teams/${project.team}/projects/${project._id}` : "",
        });
      }
    } catch (nErr) {
      console.warn("Task update notification error:", nErr.message);
    }
  }

  return await Task.findById(task._id)
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture")
    .populate("comments.user", "name username email profilePicture");
};

// Delete a task (restricted to creator, team owner, or team admin)
const deleteTask = async (taskId, userId, io = null) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error("Task not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await Team.findById(task.team);
  const isTeamOwner = team && team.owner && team.owner.toString() === userId.toString();
  const isTeamAdmin = team && team.members && team.members.some(
    (m) => m.user && m.user.toString() === userId.toString() && (m.role === "admin" || m.role === "owner")
  );
  const isTaskCreator = task.creator && task.creator.toString() === userId.toString();

  if (!isTeamOwner && !isTeamAdmin && !isTaskCreator) {
    const error = new Error(
      "Permission Denied: Only the task creator or team admin/owner can delete this task"
    );
    error.statusCode = 403;
    throw error;
  }

  const projectId = task.project;
  const actionItemId = task.actionItemId;

  await Task.findByIdAndDelete(taskId);

  // If this task was generated from an action item, reset its conversion state and mark as deleted from workspace
  if (actionItemId) {
    try {
      const ActionItem = require("../models/ActionItem");
      const updatedActionItem = await ActionItem.findByIdAndUpdate(
        actionItemId,
        {
          isConverted: false,
          convertedTask: null,
          convertedProject: null,
          convertedTeam: null,
          convertedAt: null,
          isWorkspaceTaskDeleted: true,
        },
        { new: true }
      ).populate("assignee", "name username avatar profilePicture");

      if (updatedActionItem && io) {
        io.to(updatedActionItem.meeting.toString()).emit("action_item:updated", updatedActionItem);
        io.emit("action_item:updated", updatedActionItem);
      }
    } catch (aErr) {
      console.warn("Failed to reset action item conversion state:", aErr.message);
    }
  }

  return { message: "Task deleted successfully", taskId, project: projectId, actionItemId };
};

// Add comment to task
const addComment = async (taskId, userId, text) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error("Task not found");
    error.statusCode = 404;
    throw error;
  }

  if (!text || !text.trim()) {
    throw new Error("Comment text cannot be empty");
  }

  task.comments.push({
    user: userId,
    text: text.trim(),
    createdAt: new Date(),
  });

  await task.save();

  // Send notification to assignee and creator
  try {
    const project = await Project.findById(task.project);
    const User = require("../models/User");
    const commenter = await User.findById(userId);
    const commenterName = commenter?.name || "A team member";

    const notifyRecipients = new Set();
    if (task.assignee && task.assignee.toString() !== userId.toString()) {
      notifyRecipients.add(task.assignee.toString());
    }
    if (task.creator && task.creator.toString() !== userId.toString()) {
      notifyRecipients.add(task.creator.toString());
    }

    for (const recipientId of notifyRecipients) {
      await notificationService.createNotification({
        recipient: recipientId,
        sender: userId,
        type: "task_comment",
        title: "New Task Comment",
        message: `${commenterName} commented on "${task.title}": "${text.trim().slice(0, 70)}"`,
        link: project ? `/teams/${project.team}/projects/${project._id}` : "",
      });
    }
  } catch (nErr) {
    console.warn("Task comment notification error:", nErr.message);
  }

  return await Task.findById(taskId)
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture")
    .populate("comments.user", "name username email profilePicture");
};

// Scan tasks due today and dispatch reminder notifications
const checkDueTasksAndNotify = async (io = null) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const dueTasks = await Task.find({
      dueDate: { $ne: null, $lte: todayEnd },
      status: { $ne: "done" },
      columnId: { $ne: "col-done" },
      assignee: { $ne: null },
      $or: [
        { lastDueReminderSentAt: null },
        { lastDueReminderSentAt: { $lt: todayStart } },
      ],
    })
      .populate("project", "name team")
      .populate("assignee", "name email");

    for (const task of dueTasks) {
      if (!task.assignee) continue;

      const recipientId = task.assignee._id || task.assignee;
      const boardName = task.project?.name || "Board";
      const teamId = task.project?.team || task.team;
      const projId = task.project?._id || task.project;

      const { notification } = await notificationService.createNotification({
        recipient: recipientId,
        sender: null,
        type: "task_due",
        title: "Task Due Today",
        message: `Reminder: Task "${task.title}" is due today on board "${boardName}"`,
        link: `/teams/${teamId}/projects/${projId}`,
      });

      task.lastDueReminderSentAt = new Date();
      await task.save();
    }

    return dueTasks.length;
  } catch (err) {
    console.warn("[DueTasks] Check due tasks error:", err.message);
    return 0;
  }
};

module.exports = {
  createTask,
  getTasksByProject,
  moveTask,
  updateTask,
  deleteTask,
  addComment,
  checkDueTasksAndNotify,
};
