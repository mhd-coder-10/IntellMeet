// Handles real-time chat events and saves messages to database
// Host can delete messages via chat:delete event

const chatService = require("../services/chatService");

const registerChatHandlers = (io, socket) => {
  socket.on("chat:send", async ({ meetingId, message }) => {
    if (!meetingId || !message) return;

    try {
      const { message: savedMessage } = await chatService.saveMessage(
        meetingId,
        socket.user.id,
        message
      );

      io.to(meetingId).emit("chat:message", savedMessage);
    } catch (error) {
      socket.emit("chat:error", { message: error.message });
    }
  });

  socket.on("chat:typing", ({ meetingId, isTyping }) => {
    if (!meetingId) return;

    socket.to(meetingId).emit("chat:user-typing", {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping,
    });
  });

  socket.on("chat:delete", async ({ meetingId, messageId }) => {
    if (!meetingId || !messageId) return;

    try {
      const result = await chatService.deleteMessage(
        messageId,
        socket.user.id,
        meetingId
      );

      io.to(meetingId).emit("chat:message-deleted", {
        messageId: result.messageId,
        deletedBy: "host",
      });
    } catch (error) {
      socket.emit("chat:error", { message: error.message });
    }
  });
};

module.exports = { registerChatHandlers };