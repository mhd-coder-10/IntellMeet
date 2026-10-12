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

// Move a task between Kanban columns and update order
const moveTask = async (taskId, userId, { columnId, newOrder }) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error("Task not found");
    error.statusCode = 404;
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

  // Send status update notification if column changed
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

      const notifyRecipients = new Set();

      // Notify all team members who are part of this project/workspace
      const team = await Team.findById(task.team);
      if (team && Array.isArray(team.members)) {
        for (const m of team.members) {
          const mUserId = m.user ? m.user.toString() : null;
          if (mUserId && mUserId !== userId.toString()) {
            notifyRecipients.add(mUserId);
          }
        }
      }

      // Also ensure assignee and creator get it if not already in team list
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

  // Permission check for editing core details (title, description, assignee, priority, dueDate)
  const isEditingCoreDetails =
    data.title !== undefined ||
    data.description !== undefined ||
    data.assignee !== undefined ||
    data.priority !== undefined ||
    data.dueDate !== undefined;

  if (isEditingCoreDetails) {
    const team = await Team.findById(task.team);
    const isTeamOwner = team && team.owner && team.owner.toString() === userId.toString();
    const isTeamAdmin = team && team.members && team.members.some(
      (m) => m.user && m.user.toString() === userId.toString() && (m.role === "admin" || m.role === "owner")
    );
    const isTaskCreator = task.creator && task.creator.toString() === userId.toString();
    const isTaskAssignee = task.assignee && task.assignee.toString() === userId.toString();

    if (!isTeamOwner && !isTeamAdmin && !isTaskCreator && !isTaskAssignee) {
      const error = new Error(
        "Permission Denied: Only the task creator, assignee, or team admin/owner can modify task details"
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

  await task.save();

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

  return await Task.findById(task._id)
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture")
    .populate("comments.user", "name username email profilePicture");
};

// Delete a task (restricted to creator, team owner, or team admin)
const deleteTask = async (taskId, userId) => {
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
  await Task.findByIdAndDelete(taskId);
  return { message: "Task deleted successfully", taskId, project: projectId };
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

module.exports = {
  createTask,
  getTasksByProject,
  moveTask,
  updateTask,
  deleteTask,
  addComment,
};
