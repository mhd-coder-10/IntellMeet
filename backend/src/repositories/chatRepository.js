// Handles all database queries for chat messages
// Supports pagination and meeting-wide deletion

const BaseRepository = require("./baseRepository");
const ChatMessage = require("../models/ChatMessage");

class ChatRepository extends BaseRepository {
  constructor() {
    super(ChatMessage);
  }

  createMessage(data) {
    return ChatMessage.create(data);
  }

  findByMeeting(meetingId, limit = 50, skip = 0) {
    return ChatMessage.find({ meeting: meetingId, isDeleted: false })
      .populate("sender", "name username profilePicture")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);
  }

  softDelete(messageId, userId) {
    return ChatMessage.findOneAndUpdate(
      { _id: messageId, sender: userId },
      { isDeleted: true },
      { new: true }
    );
  }

  // Hard delete by id (used by host moderation)
  hardDeleteById(messageId) {
    return ChatMessage.findByIdAndDelete(messageId);
  }

  // Delete all messages of a meeting (called on meeting end)
  deleteAllByMeeting(meetingId) {
    return ChatMessage.deleteMany({ meeting: meetingId });
  }

  countByMeeting(meetingId) {
    return ChatMessage.countDocuments({
      meeting: meetingId,
      isDeleted: false,
    });
  }
}

module.exports = new ChatRepository();