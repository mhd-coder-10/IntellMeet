// Handles real-time notification events for each user
// Each user joins a personal room based on their user id

const registerNotificationHandlers = (io, socket) => {
  socket.join(`user:${socket.user.id}`)

  socket.on("notification:read", ({ notificationId }) => {
    socket.emit("notification:read-confirmed", { notificationId })
  })
}

const sendNotificationToUser = (io, userId, notification) => {
  io.to(`user:${userId}`).emit("notification:new", notification)
}

module.exports = { registerNotificationHandlers, sendNotificationToUser }