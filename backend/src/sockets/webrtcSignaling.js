// Handles WebRTC signaling messages between peers
// Forwards offers, answers and ice candidates to target users

const roomManager = require("../webrtc/roomManager");

const forwardToUser = (io, meetingId, toUserId, event, payload) => {
    const room = roomManager.getRoom(meetingId)
    if (!room) return

    const targetUser = room.users.get(toUserId.toString());
    if (!targetUser) return

    io.to(targetUser.socketId).emit(event, payload);
}

const registerSignalingHandlers = (io, socket) => {
    socket.on("webrtc:offer", ({ meetingId, toUserId, sdp }) => {
        if (!meetingId || !toUserId || !sdp) return

        forwardToUser(io, meetingId, toUserId, "webrtc:offer", {
            fromUserId: socket.user.id,
            fromUsername: socket.user.username,
            sdp,
        })
    });

    socket.on("webrtc:answer", ({ meetingId, toUserId, sdp }) => {
        if (!meetingId || !toUserId || !sdp) return

        forwardToUser(io, meetingId, toUserId, "webrtc:answer", {
            fromUserId: socket.user.id,
            sdp,
        })
    });

    socket.on("webrtc:ice-candidate", ({ meetingId, toUserId, candidate }) => {
        if (!meetingId || !toUserId || !candidate) return

        forwardToUser(io, meetingId, toUserId, "webrtc:ice-candidate", {
            fromUserId: socket.user.id,
            candidate,
        });
    });
}

module.exports = { registerSignalingHandlers }