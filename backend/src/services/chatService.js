// Contains chat business logic for saving and fetching messages
// Supports paginated chat history retrieval

const chatRepo = require("../repositories/chatRepository")
const meetingRepo = require("../repositories/meetingRepository")

const saveMessage = async (meetingId, userId, message) => {
  if (!message || !message.trim()) {
    const error = new Error("Message cannot be empty")
    error.statusCode = 400
    throw error
  }

  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  const savedMessage = await chatRepo.createMessage({
    meeting: meetingId,
    sender: userId,
    message: message.trim(),
    type: "text",
  })

  const populated = await chatRepo.findById(savedMessage._id)
  await populated.populate("sender", "name username profilePicture")

  return { message: populated }
}

const getMeetingMessages = async (meetingId, limit = 50, page = 1) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  const skip = (page - 1) * limit
  const messages = await chatRepo.findByMeeting(meetingId, limit, skip)
  const total = await chatRepo.countByMeeting(meetingId)

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + messages.length < total,
    },
  }
}

const deleteMessage = async (messageId, userId) => {
  const message = await chatRepo.softDelete(messageId, userId)
  if (!message) {
    const error = new Error("Message not found or not authorized")
    error.statusCode = 404
    throw error
  }
  return { message: "Message deleted successfully" }
}

module.exports = { saveMessage, getMeetingMessages, deleteMessage }