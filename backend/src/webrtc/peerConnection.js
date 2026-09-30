
// Server-side helpers for WebRTC peer connection management
// Helper functions for WebRTC peer connection setup
// Builds signal messages and peer lists for video calls


// Generate a peer id for a user in a room
const generatePeerId = (meetingId, userId) => {
    return `${meetingId}:${userId}`
}

// Parse peer id back into meetingId and userId
const parsePeerId = (peerId) => {
    const [meetingId, userId] = peerId.split(":")
    return { meetingId, userId }
}

// Create a signaling message payload
const createSignalMessage = (type, fromUserId, toUserId, payload) => {
    return {
        type,
        from: fromUserId,
        to: toUserId,
        payload,
        timestamp: new Date().toISOString(),
    }
}

// Validate signal type
const isValidSignalType = (type) => {
    const validTypes = ["offer", "answer", "ice-candidate"]
    return validTypes.includes(type)
}

// Build peer list for a new user joining a room
const buildPeerList = (currentUserId, users) => {
    return users
        .filter((user) => user.userId.toString() !== currentUserId.toString())
        .map((user) => ({
            userId: user.userId,
            socketId: user.socketId,
            isMuted: user.isMuted,
            isVideoOn: user.isVideoOn,
            isScreenSharing: user.isScreenSharing,
        }))
}

// Format user info for peer connection
const formatUserForPeer = (user) => {
    return {
        userId: user.userId,
        name: user.name,
        username: user.username,
        profilePicture: user.profilePicture,
        isMuted: user.isMuted,
        isVideoOn: user.isVideoOn,
        isScreenSharing: user.isScreenSharing,
    }
}

module.exports = {
    generatePeerId,
    parsePeerId,
    createSignalMessage,
    isValidSignalType,
    buildPeerList,
    formatUserForPeer,
}