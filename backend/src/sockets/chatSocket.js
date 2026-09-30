// Handles basic chat events inside meeting rooms
// Broadcasts messages and typing indicators to participants

const registerChatHandlers = (io, socket) => {
    socket.on("chat:send", ({ meetingId, message }) => {
        if (!meetingId || !message) return

        const chatMessage = {
            id: `${Date.now()}-${socket.user.id}`,
            sender: {
                userId: socket.user.id,
                name: socket.user.name,
                username: socket.user.username,
                profilePicture: socket.user.profilePicture,
            },
            message,
            meetingId,
            timestamp: new Date().toISOString(),
        }

        io.to(meetingId).emit("chat:message", chatMessage)
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