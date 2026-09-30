// Authenticates Socket.io connections using JWT
// Attaches user data to socket object for later use

const { verifyToken } = require("../utils/jwt")
const userRepo = require("../repositories/userRepository")

const socketAuth = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token

        if (!token) {
            return next(new Error("Authentication error: Token required"))
        }

        const decoded = verifyToken(token, process.env.JWT_SECRET)
        const user = await userRepo.findById(decoded.id)

        if (!user) {
            return next(new Error("Authentication error: User not found"))
        }

        socket.user = {
            id: user._id.toString(),
            name: user.name,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
        }

        next()
    } catch (error) {
        next(new Error("Authentication error: Invalid token"))
    }
}

module.exports = { socketAuth }