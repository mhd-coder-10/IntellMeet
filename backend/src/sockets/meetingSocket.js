// Handles meeting room events like join, leave and media state
// Uses roomManager to track active users in each meeting

const roomManager = require("../webrtc/roomManager")

const registerMeetingHandlers = (io, socket) => {

    socket.on("meeting:join", ({ meetingId }) => {
        if (!meetingId) return

        socket.join(meetingId)

        const userInfo = {
            name: socket.user.name,
            username: socket.user.username,
            profilePicture: socket.user.profilePicture,
        }

        roomManager.addUserToRoom(meetingId, socket.user.id, socket.id, userInfo)

        const users = roomManager.getRoomUsers(meetingId)

        io.to(meetingId).emit("meeting:user-joined", {
            userId: socket.user.id,
            username: socket.user.username,
            name: socket.user.name,
            profilePicture: socket.user.profilePicture,
            totalUsers: users.length,
        })

        socket.emit("meeting:joined", {
            meetingId,
            users: users.map((u) => ({
                userId: u.userId,
                name: u.name,
                username: u.username,
                profilePicture: u.profilePicture,
                isMuted: u.isMuted,
                isVideoOn: u.isVideoOn,
            })),
        })
    })

    socket.on("meeting:leave", ({ meetingId }) => {
        if (!meetingId) return

        socket.leave(meetingId)
        roomManager.removeUserFromRoom(meetingId, socket.user.id)

        io.to(meetingId).emit("meeting:user-left", {
            userId: socket.user.id,
            username: socket.user.username,
        })
    })

    socket.on(
        "meeting:media-state",
        ({ meetingId, isMuted, isVideoOn, isScreenSharing }) => {
            if (!meetingId) return

            const updated = roomManager.updateUserMediaState(
                meetingId,
                socket.user.id, { isMuted, isVideoOn, isScreenSharing }
            )

            if (updated) {
                io.to(meetingId).emit("meeting:media-state-changed", {
                    userId: socket.user.id,
                    isMuted: updated.isMuted,
                    isVideoOn: updated.isVideoOn,
                    isScreenSharing: updated.isScreenSharing,
                })
            }
        }
    )

    socket.on("disconnect", () => {
        const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id)

        rooms.forEach((meetingId) => {
            roomManager.removeUserFromRoom(meetingId, socket.user.id)
            io.to(meetingId).emit("meeting:user-left", {
                userId: socket.user.id,
                username: socket.user.username,
            })
        })
    })
}

module.exports = { registerMeetingHandlers }