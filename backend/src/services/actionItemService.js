const ActionItem = require("../models/ActionItem");
const Meeting = require("../models/Meeting");
const User = require("../models/User");
const notificationService = require("./notificationService");
const { sendNotificationToUser } = require("../socket/notificationSocket");

/**
 * Toggle action item status (pending <-> completed)
 */
const toggleActionItem = async (actionItemId, userId, io = null) => {
  const item = await ActionItem.findById(actionItemId);
  if (!item) {
    const error = new Error("Action item not found");
    error.statusCode = 404;
    throw error;
  }

  const isCompleted = item.status === "completed";
  item.status = isCompleted ? "pending" : "completed";
  item.completedAt = isCompleted ? null : new Date();
  item.completedBy = isCompleted ? null : userId;

  await item.save();

  // 2-Way Sync to linked Kanban Task if converted
  if (item.isConverted && item.convertedTask) {
    try {
      const Task = require("../models/Task");
      const linkedTask = await Task.findById(item.convertedTask);
      if (linkedTask) {
        linkedTask.status = item.status === "completed" ? "done" : "todo";
        linkedTask.columnId = item.status === "completed" ? "col-done" : "col-todo";
        await linkedTask.save();

        if (io) {
          const populatedTask = await Task.findById(linkedTask._id)
            .populate("assignee", "name username email profilePicture")
            .populate("creator", "name username email profilePicture");
          io.to(`project:${linkedTask.project}`).emit("task:updated", populatedTask);
          io.emit("task:updated", populatedTask);
        }

        try {
          const Project = require("../models/Project");
          const project = await Project.findById(linkedTask.project);
          const updater = userId ? await User.findById(userId).select("name") : null;
          const updaterName = updater?.name || "A team member";
          const newStatusLabel = linkedTask.status === "done" ? "Done" : "To Do";

          const notifyRecipients = new Set();
          if (project?.owner) notifyRecipients.add(project.owner.toString());
          if (linkedTask.creator) notifyRecipients.add(linkedTask.creator.toString());
          if (linkedTask.assignee) notifyRecipients.add(linkedTask.assignee.toString());

          const projectAssignees = await Task.distinct("assignee", {
            project: linkedTask.project,
            assignee: { $ne: null },
          });
          projectAssignees.forEach((id) => id && notifyRecipients.add(id.toString()));

          if (userId) {
            notifyRecipients.delete(userId.toString());
          }

          for (const recipientId of notifyRecipients) {
            const { notification } = await notificationService.createNotification({
              recipient: recipientId,
              sender: userId || null,
              type: "task_status",
              title: "Task Status Updated from Meeting",
              message: `${updaterName} marked task "${linkedTask.title}" as "${newStatusLabel}" on board "${project?.name || "Board"}"`,
              link: project ? `/teams/${project.team}/projects/${project._id}` : "",
            });
          }
        } catch (nErr) {
          console.warn("[ActionItem Sync] Failed to notify status change:", nErr.message);
        }
      }
    } catch (syncErr) {
      console.warn("[ActionItem Sync] Failed to sync toggle to task:", syncErr.message);
    }
  }

  const populatedItem = await item.populate("assignee", "name username avatar profilePicture");
  if (io) {
    io.to(item.meeting.toString()).emit("action_item:updated", populatedItem);
    io.emit("action_item:updated", populatedItem);
  }

  return populatedItem;
};

/**
 * Helper to notify assigned user
 */
const notifyAssignee = async (item, meetingId, senderId, actionType = "assigned", io = null) => {
  try {
    if (!item.assignee) return;
    if (senderId && item.assignee.toString() === senderId.toString()) return;

    const [sender, meeting] = await Promise.all([
      senderId ? User.findById(senderId).select("name username") : null,
      Meeting.findById(meetingId).select("title"),
    ]);

    const senderName = sender?.name || "A team member";
    const meetingTitle = meeting?.title || "Meeting";

    const title = actionType === "updated" ? "Action Item Updated" : "New Action Item Assigned";
    const message = `${senderName} ${actionType === "updated" ? "updated your task" : "assigned you a task"}: "${item.task}" in "${meetingTitle}"`;

    const { notification } = await notificationService.createNotification({
      recipient: item.assignee,
      sender: senderId || null,
      type: "action_item",
      title,
      message,
      link: `/meetings/${meetingId}/details`,
    });
  } catch (err) {
    console.warn("[ActionItem] Notification trigger warning:", err.message);
  }
};

/**
 * Manually add an action item to a meeting
 */
const createActionItem = async (meetingId, data, userId, io = null) => {
  const { task, assignee, assigneeName, priority = "medium", dueDate } = data;

  if (!task || !task.trim()) {
    const error = new Error("Task description is required");
    error.statusCode = 400;
    throw error;
  }

  const meeting = await Meeting.findById(meetingId).populate("host participants");
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const hostId = meeting.host?._id ? meeting.host._id.toString() : meeting.host?.toString();
  if (!hostId || hostId !== userId?.toString()) {
    const error = new Error("Permission Denied: Only the meeting host can add action items");
    error.statusCode = 403;
    throw error;
  }

  // Resolve assignee ID if not explicitly provided but assigneeName matches an attendee
  let resolvedAssignee = assignee || null;
  let resolvedName = assigneeName || "Unassigned";

  if (!resolvedAssignee && assigneeName && assigneeName !== "Unassigned") {
    const attendees = [meeting.host, ...(meeting.participants || [])].filter(Boolean);
    const matched = attendees.find((a) => {
      const aName = (a.name || "").toLowerCase();
      const aUser = (a.username || "").toLowerCase();
      const target = assigneeName.toLowerCase();
      return aName === target || aUser === target || aName.includes(target);
    });
    if (matched) {
      resolvedAssignee = matched._id;
      resolvedName = matched.name;
    }
  }

  const newItem = new ActionItem({
    meeting: meetingId,
    task: task.trim(),
    assignee: resolvedAssignee,
    assigneeName: resolvedName,
    priority,
    dueDate: dueDate ? new Date(dueDate) : null,
    isAiGenerated: false,
    status: "pending",
  });

  await newItem.save();
  await newItem.populate("assignee", "name username avatar profilePicture");

  // Send notification to the assigned user
  await notifyAssignee(newItem, meetingId, userId, "assigned", io);

  return newItem;
};

/**
 * Update an action item
 */
const updateActionItem = async (actionItemId, updates, userId, io = null) => {
  const item = await ActionItem.findById(actionItemId);
  if (!item) {
    const error = new Error("Action item not found");
    error.statusCode = 404;
    throw error;
  }

  const meeting = await Meeting.findById(item.meeting).populate("host participants");
  if (!meeting) {
    const error = new Error("Associated meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const hostId = meeting.host?._id ? meeting.host._id.toString() : meeting.host?.toString();
  if (!hostId || hostId !== userId?.toString()) {
    const error = new Error("Permission Denied: Only the meeting host can edit action items");
    error.statusCode = 403;
    throw error;
  }

  if (item.isConverted) {
    const error = new Error("Cannot edit an action item that has already been converted to Kanban");
    error.statusCode = 400;
    throw error;
  }

  if (item.isWorkspaceTaskDeleted) {
    const error = new Error("Cannot edit an action item that was deleted from the workspace board");
    error.statusCode = 400;
    throw error;
  }

  const previousAssignee = item.assignee ? item.assignee.toString() : null;

  if (updates.task) item.task = updates.task.trim();
  if (updates.priority) item.priority = updates.priority;
  if (updates.assignee !== undefined) item.assignee = updates.assignee;
  if (updates.assigneeName) {
    item.assigneeName = updates.assigneeName;
    if (updates.assignee === undefined) {
      const meeting = await Meeting.findById(item.meeting).populate("host participants");
      if (meeting) {
        if (updates.assigneeName === "Unassigned") {
          item.assignee = null;
        } else {
          const attendees = [meeting.host, ...(meeting.participants || [])].filter(Boolean);
          const matched = attendees.find((a) => {
            const aName = (a.name || "").toLowerCase();
            const aUser = (a.username || "").toLowerCase();
            const target = updates.assigneeName.toLowerCase();
            return aName === target || aUser === target || aName.includes(target);
          });
          if (matched) {
            item.assignee = matched._id;
          }
        }
      }
    }
  }
  if (updates.dueDate !== undefined) item.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
  if (updates.dueDateText !== undefined) item.dueDateText = updates.dueDateText;

  if (updates.status) {
    item.status = updates.status;
    if (updates.status === "completed") {
      item.completedAt = new Date();
      item.completedBy = userId;
    } else {
      item.completedAt = null;
      item.completedBy = null;
    }
  }

  const taskChanged = updates.task !== undefined && updates.task.trim() !== (item.task || "").trim();
  const priorityChanged = updates.priority !== undefined && updates.priority !== item.priority;
  const assigneeChanged =
    updates.assignee !== undefined && String(updates.assignee || "") !== String(item.assignee || "");
  const assigneeNameChanged =
    updates.assigneeName !== undefined &&
    updates.assigneeName.trim() !== (item.assigneeName || "").trim();
  const dueDateChanged =
    updates.dueDate !== undefined &&
    (Boolean(updates.dueDate) !== Boolean(item.dueDate) ||
      (updates.dueDate &&
        item.dueDate &&
        new Date(updates.dueDate).getTime() !== new Date(item.dueDate).getTime()));
  const dueDateTextChanged =
    updates.dueDateText !== undefined && updates.dueDateText !== item.dueDateText;

  const hasDetailsChanged =
    taskChanged ||
    priorityChanged ||
    assigneeChanged ||
    assigneeNameChanged ||
    dueDateChanged ||
    dueDateTextChanged;

  if (hasDetailsChanged) {
    item.updateCount = (item.updateCount || 0) + 1;
  }

  await item.save();
  await item.populate("assignee", "name username avatar profilePicture");

  // 2-Way Sync to linked Kanban Task if converted
  if (item.isConverted && item.convertedTask) {
    try {
      const Task = require("../models/Task");
      const linkedTask = await Task.findById(item.convertedTask);
      if (linkedTask) {
        if (updates.task) linkedTask.title = updates.task.trim();
        if (updates.priority) linkedTask.priority = updates.priority;
        if (updates.dueDate !== undefined) {
          linkedTask.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
        }
        if (updates.assignee !== undefined || updates.assigneeName !== undefined) {
          linkedTask.assignee = item.assignee || null;
        }
        if (updates.status) {
          if (updates.status === "completed") {
            linkedTask.status = "done";
            linkedTask.columnId = "col-done";
          } else if (updates.status === "in_progress") {
            linkedTask.status = "in_progress";
            linkedTask.columnId = "col-in-progress";
          } else {
            linkedTask.status = "todo";
            linkedTask.columnId = "col-todo";
          }
        }
        if (hasDetailsChanged) {
          linkedTask.updateCount = (linkedTask.updateCount || 0) + 1;
        }
        await linkedTask.save();

        if (io) {
          const populatedTask = await Task.findById(linkedTask._id)
            .populate("assignee", "name username email profilePicture")
            .populate("creator", "name username email profilePicture");
          io.to(`project:${linkedTask.project}`).emit("task:updated", populatedTask);
          io.emit("task:updated", populatedTask);
        }
      }
    } catch (syncErr) {
      console.warn("[ActionItem Sync] Failed to sync update to task:", syncErr.message);
    }
  }

  // Send notifications for update
  if (item.isConverted && item.convertedTask) {
    try {
      const Task = require("../models/Task");
      const Project = require("../models/Project");
      const linkedTask = await Task.findById(item.convertedTask);
      if (linkedTask) {
        const project = await Project.findById(linkedTask.project);
        const updater = userId ? await User.findById(userId).select("name") : null;
        const updaterName = updater?.name || "A team member";

        const notifyRecipients = new Set();
        if (project?.owner) notifyRecipients.add(project.owner.toString());
        if (linkedTask.creator) notifyRecipients.add(linkedTask.creator.toString());
        if (linkedTask.assignee) notifyRecipients.add(linkedTask.assignee.toString());

        // Also add other task assignees in this project
        const projectAssignees = await Task.distinct("assignee", {
          project: linkedTask.project,
          assignee: { $ne: null },
        });
        projectAssignees.forEach((id) => id && notifyRecipients.add(id.toString()));

        if (userId) {
          notifyRecipients.delete(userId.toString());
        }

        for (const recipientId of notifyRecipients) {
          const { notification } = await notificationService.createNotification({
            recipient: recipientId,
            sender: userId || null,
            type: "task_updated",
            title: "Task Updated from Meeting",
            message: `${updaterName} updated task "${linkedTask.title}" on board "${project?.name || "Board"}"`,
            link: project ? `/teams/${project.team}/projects/${project._id}` : "",
          });
        }
      }
    } catch (nErr) {
      console.warn("[ActionItem Sync] Failed to notify project members:", nErr.message);
    }
  } else {
    // If unconverted action item, notify assigned attendee
    const newAssignee = item.assignee ? item.assignee.toString() : null;
    if (newAssignee && (newAssignee !== previousAssignee || updates.task)) {
      await notifyAssignee(item, item.meeting, userId, "updated", io);
    }
  }

  if (io) {
    io.to(item.meeting.toString()).emit("action_item:updated", item);
    io.emit("action_item:updated", item);
  }

  return item;
};

/**
 * Delete an action item (Host only, strictly before Kanban conversion or if deleted from workspace)
 */
const deleteActionItem = async (actionItemId, userId, io = null) => {
  const item = await ActionItem.findById(actionItemId);
  if (!item) {
    const error = new Error("Action item not found");
    error.statusCode = 404;
    throw error;
  }

  const meeting = await Meeting.findById(item.meeting);
  if (!meeting) {
    const error = new Error("Associated meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const hostId = meeting.host?._id ? meeting.host._id.toString() : meeting.host?.toString();
  if (!hostId || hostId !== userId?.toString()) {
    const error = new Error("Permission Denied: Only the meeting host can delete action items");
    error.statusCode = 403;
    throw error;
  }

  if (item.isConverted && !item.isWorkspaceTaskDeleted) {
    const error = new Error(
      "Cannot delete an action item while it is active on the Kanban board"
    );
    error.statusCode = 400;
    throw error;
  }

  await ActionItem.deleteOne({ _id: actionItemId });

  if (io) {
    io.to(item.meeting.toString()).emit("action_item:deleted", { _id: actionItemId });
    io.emit("action_item:deleted", { _id: actionItemId });
  }

  return { id: actionItemId };
};

/**
 * Convert meeting action item into a Kanban Task on a project board (Day 19)
 */
const convertActionItemToTask = async (actionItemId, data, userId, io = null) => {
  const {
    teamId,
    projectId,
    columnId = "col-todo",
    title,
    description,
    priority,
    assignee,
    dueDate,
    tags,
  } = data;

  if (!teamId || !projectId) {
    const error = new Error("Workspace and Project Board are required");
    error.statusCode = 400;
    throw error;
  }

  const actionItem = await ActionItem.findById(actionItemId);
  if (!actionItem) {
    const error = new Error("Action item not found");
    error.statusCode = 404;
    throw error;
  }

  if (actionItem.isConverted) {
    const error = new Error("This action item has already been converted to a task");
    error.statusCode = 400;
    throw error;
  }

  if (actionItem.isWorkspaceTaskDeleted) {
    const error = new Error("This task was deleted from the workspace board and cannot be re-converted");
    error.statusCode = 400;
    throw error;
  }

  const meeting = await Meeting.findById(actionItem.meeting);
  if (!meeting) {
    const error = new Error("Associated meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const hostId = meeting.host?._id ? meeting.host._id.toString() : meeting.host?.toString();
  const isHost = hostId && hostId === userId.toString();

  let isAssignee = actionItem.assignee && actionItem.assignee.toString() === userId.toString();
  if (!isAssignee && actionItem.assigneeName) {
    const user = await User.findById(userId).select("name username");
    if (user) {
      const uName = (user.name || "").toLowerCase();
      const uUser = (user.username || "").toLowerCase();
      const aName = actionItem.assigneeName.toLowerCase();
      if (aName === uName || aName === uUser) {
        isAssignee = true;
      }
    }
  }

  if (!isHost && !isAssignee) {
    const error = new Error(
      "Permission Denied: Only the meeting host or assigned attendee can convert this action item to Kanban"
    );
    error.statusCode = 403;
    throw error;
  }

  const Project = require("../models/Project");
  const Team = require("../models/Team");
  const Task = require("../models/Task");

  const project = await Project.findById(projectId);
  if (!project || project.team.toString() !== teamId.toString()) {
    const error = new Error("Selected project board does not belong to this team workspace");
    error.statusCode = 400;
    throw error;
  }

  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }

  const isOwner = team.owner.toString() === userId.toString();
  const isMember = team.members.some(
    (m) => m.user.toString() === userId.toString() && (m.status === "active" || !m.status)
  );

  if (!isOwner && !isMember) {
    const error = new Error("You are not an active member of this team workspace");
    error.statusCode = 403;
    throw error;
  }

  // Calculate highest order in target column
  const highestOrderTask = await Task.findOne({
    project: projectId,
    columnId: columnId || "col-todo",
  }).sort({ order: -1 });

  const order = highestOrderTask ? (highestOrderTask.order || 0) + 1 : 0;
  const columnStatusMap = {
    "col-todo": "todo",
    "col-in-progress": "in_progress",
    "col-review": "review",
    "col-done": "done",
  };
  const status = columnStatusMap[columnId] || "todo";

  // Create Kanban task
  const task = await Task.create({
    title: (title || actionItem.task).trim(),
    description: (description || `Generated from meeting action item: "${actionItem.task}"`).trim(),
    project: projectId,
    team: teamId,
    columnId: columnId || "col-todo",
    status,
    priority: priority || actionItem.priority || "medium",
    assignee: assignee || null,
    creator: userId,
    dueDate: dueDate ? new Date(dueDate) : (actionItem.dueDate || null),
    order,
    tags: Array.isArray(tags) && tags.length > 0 ? tags : ["Meeting", "ActionItem"],
    meeting: actionItem.meeting,
    actionItemId: actionItem._id,
  });

  // Update ActionItem with conversion info
  actionItem.isConverted = true;
  actionItem.convertedTask = task._id;
  actionItem.convertedProject = projectId;
  actionItem.convertedTeam = teamId;
  actionItem.convertedAt = new Date();
  actionItem.isWorkspaceTaskDeleted = false;

  // If assignee was provided, update actionItem.assignee as well
  if (assignee) {
    actionItem.assignee = assignee;
    const assigneeUser = await User.findById(assignee).select("name username");
    if (assigneeUser) {
      actionItem.assigneeName = assigneeUser.name;
    }
  }

  await actionItem.save();

  await actionItem.populate("assignee", "name username avatar profilePicture");
  await actionItem.populate("convertedProject", "name color");
  await actionItem.populate("convertedTeam", "name color");
  await actionItem.populate("convertedTask", "title status columnId");

  const populatedTask = await Task.findById(task._id)
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture");

  // Notifications
  if (assignee && assignee.toString() !== userId.toString()) {
    try {
      const creator = await User.findById(userId).select("name");
      const meeting = await Meeting.findById(actionItem.meeting).select("title");
      const creatorName = creator?.name || "A team member";
      const meetingTitle = meeting?.title || "Meeting";

      const notifData = await notificationService.createNotification({
        recipient: assignee,
        sender: userId,
        type: "task_assigned",
        title: "Task Assigned from Meeting",
        message: `${creatorName} assigned you task "${task.title}" on board "${project.name}" from meeting "${meetingTitle}"`,
        link: `/teams/${teamId}/projects/${projectId}`,
      });
    } catch (nErr) {
      console.warn("[ActionItem] Notification trigger warning:", nErr.message);
    }
  }

  // Socket emissions for real-time board and meeting summary updates
  if (io) {
    io.to(actionItem.meeting.toString()).emit("action_item:updated", actionItem);
    io.emit("action_item:updated", actionItem);
    io.to(`project:${projectId}`).emit("task:created", populatedTask);
    io.to(`team:${teamId}`).emit("team:updated", { _id: teamId });
    io.emit("team:updated", { _id: teamId });
  }

  return { actionItem, task: populatedTask };
};

module.exports = {
  toggleActionItem,
  createActionItem,
  updateActionItem,
  deleteActionItem,
  convertActionItemToTask,
};
