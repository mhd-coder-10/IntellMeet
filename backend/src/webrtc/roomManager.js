
// In-memory storage for active meeting rooms
// Manages in-memory active meeting rooms and their users
// Tracks who joined which room and their media state


const activeRooms = new Map()

const createRoom = (meetingId) => {
  if (!activeRooms.has(meetingId)) {
    activeRooms.set(meetingId, {
      meetingId,
      users: new Map(),
      createdAt: new Date(),
    })
  }
  return activeRooms.get(meetingId)
}

const getRoom = (meetingId) => {
  return activeRooms.get(meetingId)
}

const addUserToRoom = (meetingId, userId, socketId, userInfo) => {
  const room = createRoom(meetingId)
  room.users.set(userId.toString(), {
    userId,
    socketId,
    ...userInfo,
    joinedAt: new Date(),
    isMuted: false,
    isVideoOn: true,
    isScreenSharing: false,
  })
  return room
}

const removeUserFromRoom = (meetingId, userId) => {
  const room = activeRooms.get(meetingId)
  if (!room) return null
  room.users.delete(userId.toString())

  if (room.users.size === 0) {
    activeRooms.delete(meetingId)
  }
  return room
}

const clearRoom = (meetingId) => {
  return activeRooms.delete(meetingId)
}

const getRoomUsers = (meetingId) => {
  const room = activeRooms.get(meetingId)
  if (!room) return []
  return Array.from(room.users.values())
}

const isUserInRoom = (meetingId, userId) => {
  const room = activeRooms.get(meetingId)
  if (!room) return false
  return room.users.has(userId.toString())
}

const updateUserMediaState = (meetingId, userId, state) => {
  const room = activeRooms.get(meetingId)
  if (!room) return null
  const user = room.users.get(userId.toString())
  if (!user) return null
  Object.assign(user, state)
  return user
}

const getActiveRoomsCount = () => {
  return activeRooms.size
}

const getAllRooms = () => {
  return Array.from(activeRooms.values()).map((room) => ({
    meetingId: room.meetingId,
    userCount: room.users.size,
    createdAt: room.createdAt,
  }))
}

module.exports = {
  createRoom,
  getRoom,
  addUserToRoom,
  removeUserFromRoom,
  clearRoom,
  getRoomUsers,
  isUserInRoom,
  updateUserMediaState,
  getActiveRoomsCount,
  getAllRooms,
}