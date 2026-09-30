 // Handles real-time chat events and saves messages to database
// Also detects @mentions and notifies mentioned users

const chatService = require("../services/chatService")
const notificationService = require("../services/notificationService")
const userRepo = require("../repositories/userRepository")

const extractMentions = (message) => {
  const regex = /@(\w+)/g
  const mentions = []
  let match
  while ((match = regex.exec(message)) !== null) {
    mentions.push(match[1])
  }
  return mentions
}

const notifyMentionedUsers = async (mentions, meetingId, sender) => {
  for (const username of mentions) {
    try {
      const user = await userRepo.findByUsername(username)
      if (!user || user._id.toString() === sender.id) continue

      await notificationService.createNotification({
        recipient: user._id,
        sender: sender.id,
        type: "chat_mention",
        title: "You were mentioned",
        message: `${sender.name} mentioned you in a chat`,
        link: `/meetings/${meetingId}`,
      })
    } catch (err) {
      console.log("Mention notification error:", err.message)
    }
  }
}

const registerChatHandlers = (io, socket) => {
  socket.on("chat:send", async ({ meetingId, message }) => {
    if (!meetingId || !message) return

    try {
      const { message: savedMessage } = await chatService.saveMessage(
        meetingId,
        socket.user.id,
        message
      )

      io.to(meetingId).emit("chat:message", {
        id: savedMessage._id,
        sender: {
          userId: savedMessage.sender._id,
          name: savedMessage.sender.name,
          username: savedMessage.sender.username,
          profilePicture: savedMessage.sender.profilePicture,
        },
        message: savedMessage.message,
        meetingId,
        timestamp: savedMessage.createdAt,
      })

      const mentions = extractMentions(message)
      if (mentions.length > 0) {
        await notifyMentionedUsers(mentions, meetingId, {
          id: socket.user.id,
          name: socket.user.name,
        })
      }
    } catch (error) {
      socket.emit("chat:error", { message: error.message })
    }
  })

  socket.on("chat:typing", ({ meetingId, isTyping }) => {
    if (!meetingId) return

    socket.to(meetingId).emit("chat:user-typing", {
      userId: socket.user.id,
      username: socket.user.username,
      isTyping,
    })
  })
}

module.exports = { registerChatHandlers }