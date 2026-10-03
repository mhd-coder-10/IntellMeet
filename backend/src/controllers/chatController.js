// Handles HTTP requests for chat history and message deletion
// Delete endpoint passes meetingId for host permission check

const chatService = require("../services/chatService");

const getMessages = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;

    const data = await chatService.getMeetingMessages(meetingId, limit, page);
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: "meetingId is required",
      });
    }

    const data = await chatService.deleteMessage(
      messageId,
      req.user.id,
      meetingId
    );

    res.status(200).json({ success: true, ...data });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { getMessages, deleteMessage };