// Initializes Socket.io server and registers all event handlers
// Authenticates every connection using JWT middleware

const { Server } = require("socket.io")
const { socketAuth } = require("../middleware/socketAuth.middleware")
const { registerMeetingHandlers } = require("./meetingSocket")
const { registerChatHandlers } = require("./chatSocket")
const { registerNotificationHandlers } = require("./notificationSocket")
const { registerSignalingHandlers } = require("./webrtcSignaling")
const { registerTeamHandlers } = require("./teamSocket")

let ioInstance = null

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ["GET", "POST"],
    },
  })

  io.use(socketAuth)

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`)

    registerMeetingHandlers(io, socket)
    registerChatHandlers(io, socket)
    registerNotificationHandlers(io, socket)
    registerSignalingHandlers(io, socket)
    registerTeamHandlers(io, socket)

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user.username}`)
    })
  })

  ioInstance = io
  return io
}

const getIO = () => ioInstance

module.exports = { initSocket, getIO }