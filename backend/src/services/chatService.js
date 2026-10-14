// Contains chat business logic for saving and fetching messages
// Host can delete any message; meeting end deletes all messages

const chatRepo = require("../repositories/chatRepository");
const meetingRepo = require("../repositories/meetingRepository");

// Save a new chat message and return the populated document
const saveMessage = async (meetingId, userId, message) => {
  if (!message || !message.trim()) {
    const error = new Error("Message cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const savedMessage = await chatRepo.createMessage({
    meeting: meetingId,
    sender: userId,
    message: message.trim(),
    type: "text",
  });

  await savedMessage.populate("sender", "name username profilePicture");

  // Extract and process @mentions
  const rawText = message.trim();
  const mentionMatches = rawText.match(/@([a-zA-Z0-9_.-]+)/g);
  if (mentionMatches && mentionMatches.length > 0) {
    try {
      const mentionUsernames = [
        ...new Set(mentionMatches.map((m) => m.slice(1).toLowerCase())),
      ];

      const User = require("../models/User");
      const notificationService = require("./notificationService");

      const matchedUsers = await User.find({
        username: { $in: mentionUsernames.map((u) => new RegExp(`^${u}$`, "i")) },
      }).select("_id name username profilePicture");

      const senderIdStr = userId.toString();
      const senderName =
        savedMessage.sender?.name || savedMessage.sender?.username || "A participant";
      const snippet =
        rawText.length > 70 ? rawText.slice(0, 67) + "..." : rawText;

      for (const targetUser of matchedUsers) {
        const targetIdStr = targetUser._id.toString();
        // Do not notify self
        if (targetIdStr !== senderIdStr) {
          await notificationService.createNotification({
            recipient: targetUser._id,
            sender: userId,
            type: "chat_mention",
            title: "Mentioned in Meeting Chat",
            message: `${senderName} mentioned you in "${meeting.title}": "${snippet}"`,
            link: `/meetings/${meetingId}`,
          });
        }
      }
    } catch (mentionErr) {
      console.warn("Failed to process meeting chat mentions:", mentionErr.message);
    }
  }

  return { message: savedMessage };
};

// Get paginated messages for a meeting
const getMeetingMessages = async (meetingId, limit = 50, page = 1) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const skip = (page - 1) * limit;
  const messages = await chatRepo.findByMeeting(meetingId, limit, skip);
  const total = await chatRepo.countByMeeting(meetingId);

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + messages.length < total,
    },
  };
};

// Delete a message - only the host of the meeting can delete
const deleteMessage = async (messageId, userId, meetingId) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  // Only the host has moderation rights
  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only the host can delete messages");
    error.statusCode = 403;
    throw error;
  }

  const message = await chatRepo.findById(messageId);
  if (!message) {
    const error = new Error("Message not found");
    error.statusCode = 404;
    throw error;
  }

  await chatRepo.updateById(messageId, {
    isDeleted: true,
    deletedBy: "host",
    message: "Message was deleted by host",
  });

  return { message: "Message deleted successfully", messageId, deletedBy: "host" };
};

module.exports = { saveMessage, getMeetingMessages, deleteMessage };