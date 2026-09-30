
// Handles WebRTC signaling logic between peers
// Manages user join, leave, signal exchange and media state changes


const roomManager = require("./roomManager")
const peerConnection = require("./peerConnection")

// Handle user joining a signaling room
const handleUserJoin = (meetingId, userId, socketId, userInfo) => {
    const room = roomManager.addUserToRoom(
        meetingId,
        userId,
        socketId,
        userInfo
    )

    const users = roomManager.getRoomUsers(meetingId)
    const peerList = peerConnection.buildPeerList(userId, users)

    return {
        room: {
            meetingId: room.meetingId,
            userCount: room.users.size,
        },
        peers: peerList,
    }
}

// Handle user leaving a signaling room
const handleUserLeave = (meetingId, userId) => {
    const room = roomManager.removeUserFromRoom(meetingId, userId)
    return {
        meetingId,
        remainingUsers: room ? room.users.size : 0,
    }
}

// Handle incoming signaling message
const handleSignal = (meetingId, fromUserId, toUserId, type, payload) => {
    if (!peerConnection.isValidSignalType(type)) {
        throw new Error(`Invalid signal type: ${type}`)
    }

    const message = peerConnection.createSignalMessage(
        type,
        fromUserId,
        toUserId,
        payload
    )

    return message
}

// Handle media state changes
const handleMediaStateChange = (meetingId, userId, state) => {
    const updated = roomManager.updateUserMediaState(meetingId, userId, state)
    if (!updated) {
        throw new Error("User not found in room")
    }
    return {
        userId,
        isMuted: updated.isMuted,
        isVideoOn: updated.isVideoOn,
        isScreenSharing: updated.isScreenSharing,
    }
}

// Get all active rooms info
const getRoomsInfo = () => {
    return {
        totalRooms: roomManager.getActiveRoomsCount(),
        rooms: roomManager.getAllRooms(),
    }
}

module.exports = {
    handleUserJoin,
    handleUserLeave,
    handleSignal,
    handleMediaStateChange,
    getRoomsInfo,
}