const ActionItem = require("../models/ActionItem");
const Meeting = require("../models/Meeting");
const User = require("../models/User");
const notificationService = require("./notificationService");
const { sendNotificationToUser } = require("../socket/notificationSocket");

/**
 * Toggle action item status (pending <-> completed)
 */
const toggleActionItem = async (actionItemId, userId) => {
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
  return item.populate("assignee", "name username avatar profilePicture");
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

    if (io) {
      sendNotificationToUser(io, item.assignee, notification);
    }
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

  await item.save();
  await item.populate("assignee", "name username avatar profilePicture");

  // Send notification if assignee was updated or changed
  const newAssignee = item.assignee ? item.assignee.toString() : null;
  if (newAssignee && (newAssignee !== previousAssignee || updates.task)) {
    await notifyAssignee(item, item.meeting, userId, "updated", io);
  }

  return item;
};

/**
 * Delete an action item
 */
const deleteActionItem = async (actionItemId) => {
  const item = await ActionItem.findById(actionItemId);
  if (!item) {
    const error = new Error("Action item not found");
    error.statusCode = 404;
    throw error;
  }
  await ActionItem.deleteOne({ _id: actionItemId });
  return { id: actionItemId };
};

module.exports = {
  toggleActionItem,
  createActionItem,
  updateActionItem,
  deleteActionItem,
};
