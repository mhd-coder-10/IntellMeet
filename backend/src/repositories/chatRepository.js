// Handles all database queries for chat messages
// Supports pagination using skip and limit

const BaseRepository = require("./baseRepository")
const ChatMessage = require("../models/ChatMessage")

class ChatRepository extends BaseRepository {
  constructor() {
    super(ChatMessage)
  }

  createMessage(data) {
    return ChatMessage.create(data)
  }

  findByMeeting(meetingId, limit = 50, skip = 0) {
    return ChatMessage.find({ meeting: meetingId, isDeleted: false })
      .populate("sender", "name username profilePicture")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
  }

  findRecentByMeeting(meetingId, limit = 50) {
    return ChatMessage.find({ meeting: meetingId, isDeleted: false })
      .populate("sender", "name username profilePicture")
      .sort({ createdAt: -1 })
      .limit(limit)
  }

  softDelete(messageId, userId) {
    return ChatMessage.findOneAndUpdate(
      { _id: messageId, sender: userId },
      { isDeleted: true },
      { new: true }
    )
  }

  countByMeeting(meetingId) {
    return ChatMessage.countDocuments({
      meeting: meetingId,
      isDeleted: false,
    })
  }
}

module.exports = new ChatRepository();