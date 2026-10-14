// Authenticates Socket.io connections using JWT
// Attaches user data to socket object for later use

const { verifyToken } = require("../utils/jwt")
const userRepo = require("../repositories/userRepository")

const socketAuth = async (socket, next) => {
    try {
        let token = socket.handshake.auth?.token || socket.handshake.query?.token

        // Fallback to HttpOnly cookie sent in handshake headers
        if (!token && socket.handshake.headers?.cookie) {
            const raw = socket.handshake.headers.cookie
            const parsed = raw.split(";").reduce((acc, part) => {
                const [k, v] = part.trim().split("=")
                if (k && v) acc[k] = decodeURIComponent(v)
                return acc
            }, {})
            token = parsed.accessToken
        }

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