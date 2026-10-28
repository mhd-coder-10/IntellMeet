// Handles WebRTC signaling messages between peers
// Forwards offers, answers and ice candidates to target users

const roomManager = require("../webrtc/roomManager");

const forwardToUser = (io, meetingId, toUserId, event, payload) => {
  const mIdStr = meetingId ? meetingId.toString() : "";
  const room = roomManager.getRoom(mIdStr);
  if (!room) {
    console.warn(`[Signaling] Room ${mIdStr} not found for event ${event}`);
    return;
  }

  const targetIdStr = toUserId ? toUserId.toString() : "";
  const targetUser = room.users.get(targetIdStr);
  if (!targetUser || !targetUser.socketId) {
    console.warn(`[Signaling] Target user ${targetIdStr} (socketId: ${targetUser?.socketId}) not ready in room ${mIdStr} for ${event}`);
    return;
  }

  io.to(targetUser.socketId).emit(event, payload);
};

const registerSignalingHandlers = (io, socket) => {
  socket.on("webrtc:offer", ({ meetingId, toUserId, sdp, isMuted, isVideoOn }) => {
    if (!meetingId || !toUserId || !sdp) return;

    forwardToUser(io, meetingId, toUserId, "webrtc:offer", {
      fromUserId: socket.user.id,
      fromUsername: socket.user.username,
      fromName: socket.user.name,
      fromProfilePicture: socket.user.profilePicture,
      sdp,
      isMuted: isMuted ?? false,
      isVideoOn: isVideoOn ?? true,
    });
  });

  socket.on("webrtc:answer", ({ meetingId, toUserId, sdp }) => {
    if (!meetingId || !toUserId || !sdp) return;

    forwardToUser(io, meetingId, toUserId, "webrtc:answer", {
      fromUserId: socket.user.id,
      sdp,
    });
  });

  socket.on("webrtc:ice-candidate", ({ meetingId, toUserId, candidate }) => {
    if (!meetingId || !toUserId || !candidate) return;

    forwardToUser(io, meetingId, toUserId, "webrtc:ice-candidate", {
      fromUserId: socket.user.id,
      candidate,
    });
  });
};

module.exports = { registerSignalingHandlers };
