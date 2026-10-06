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