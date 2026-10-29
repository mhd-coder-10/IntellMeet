// Initializes Socket.io server and registers all event handlers
// Authenticates every connection using JWT middleware

const { Server } = require("socket.io")
const { socketAuth } = require("../middleware/socketAuth.middleware")
const { registerMeetingHandlers } = require("./meetingSocket")
const { registerChatHandlers } = require("./chatSocket")
const { registerNotificationHandlers } = require("./notificationSocket")
const { registerSignalingHandlers } = require("./webrtcSignaling")
const { registerTeamHandlers } = require("./teamSocket")

const { incActiveSockets, decActiveSockets } = require("../config/metrics");

let ioInstance = null

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ["GET", "POST"],
    },
  })

  io.use(socketAuth)

  io.on("connection", (socket) => {
    incActiveSockets();
    console.log(`User connected: ${socket.user.username} (${socket.id})`)

    registerMeetingHandlers(io, socket)
    registerChatHandlers(io, socket)
    registerNotificationHandlers(io, socket)
    registerSignalingHandlers(io, socket)
    registerTeamHandlers(io, socket)

    socket.on("disconnect", () => {
      decActiveSockets();
      console.log(`User disconnected: ${socket.user.username}`)
    })
  })

  ioInstance = io
  return io
}

const getIO = () => ioInstance

module.exports = { initSocket, getIO }