// Manages in-memory active meeting rooms and their users
// Tracks who joined which room, media state and screen sharing

const activeRooms = new Map();

// Create a new room if not exists
const createRoom = (meetingId) => {
  if (!activeRooms.has(meetingId)) {
    activeRooms.set(meetingId, {
      meetingId,
      users: new Map(),
      screenSharingUserId: null,
      recordingUserId: null,
      createdAt: new Date(),
    });
  }
  return activeRooms.get(meetingId);
};

// Get a room by meeting id
const getRoom = (meetingId) => {
  return activeRooms.get(meetingId);
};

// Add a user to a room
const addUserToRoom = (meetingId, userId, socketId, userInfo) => {
  const room = createRoom(meetingId);
  const uIdStr = userId ? userId.toString() : "";
  room.users.set(uIdStr, {
    userId: uIdStr,
    socketId,
    ...userInfo,
    joinedAt: new Date(),
    isMuted: false,
    isVideoOn: true,
    isScreenSharing: false,
  });
  return room;
};

// Remove user from room and clear their screen share state if active
const removeUserFromRoom = (meetingId, userId) => {
  const room = activeRooms.get(meetingId);
  if (!room) return null;

  const wasScreenSharing = Boolean(
    room.screenSharingUserId &&
    room.screenSharingUserId.toString() === userId.toString()
  );

  room.users.delete(userId.toString());

  // Clear screen share if this user was sharing
  if (wasScreenSharing) {
    room.screenSharingUserId = null;
  }

  // Clear recording if this user was recording
  if (
    room.recordingUserId &&
    room.recordingUserId.toString() === userId.toString()
  ) {
    room.recordingUserId = null;
  }

  if (room.users.size === 0) {
    activeRooms.delete(meetingId);
  }
  return { room, wasScreenSharing };
};

// Clear a room entirely
const clearRoom = (meetingId) => {
  return activeRooms.delete(meetingId);
};

// Get all users in a room
const getRoomUsers = (meetingId) => {
  const room = activeRooms.get(meetingId);
  if (!room) return [];
  return Array.from(room.users.values());
};

// Check if user is in room
const isUserInRoom = (meetingId, userId) => {
  const room = activeRooms.get(meetingId);
  if (!room) return false;
  return room.users.has(userId.toString());
};

// Update user media state
const updateUserMediaState = (meetingId, userId, state) => {
  const room = activeRooms.get(meetingId);
  if (!room) return null;
  const user = room.users.get(userId.toString());
  if (!user) return null;
  Object.assign(user, state);
  return user;
};

// Set who is screen sharing in the room
const setScreenSharingUser = (meetingId, userId) => {
  const room = activeRooms.get(meetingId);
  if (!room) return null;
  room.screenSharingUserId = userId ? userId.toString() : null;
  return room;
};

// Clear screen sharing user
const clearScreenSharingUser = (meetingId) => {
  const room = activeRooms.get(meetingId);
  if (!room) return null;
  room.screenSharingUserId = null;
  return room;
};

// Get current screen sharing user
const getScreenSharingUser = (meetingId) => {
  const room = activeRooms.get(meetingId);
  return room?.screenSharingUserId ? room.screenSharingUserId.toString() : null;
};

// Set who is recording
const setRecordingUser = (meetingId, userId) => {
  const room = activeRooms.get(meetingId);
  if (!room) return null;
  room.recordingUserId = userId;
  return room;
};

// Clear recording user
const clearRecordingUser = (meetingId) => {
  const room = activeRooms.get(meetingId);
  if (!room) return null;
  room.recordingUserId = null;
  return room;
};

// Get who is recording
const getRecordingUser = (meetingId) => {
  const room = activeRooms.get(meetingId);
  return room?.recordingUserId || null;
};

// Get active rooms count
const getActiveRoomsCount = () => {
  return activeRooms.size;
};

// Get all active rooms info
const getAllRooms = () => {
  return Array.from(activeRooms.values()).map((room) => ({
    meetingId: room.meetingId,
    userCount: room.users.size,
    screenSharingUserId: room.screenSharingUserId,
    createdAt: room.createdAt,
  }));
};

module.exports = {
  createRoom,
  getRoom,
  addUserToRoom,
  removeUserFromRoom,
  clearRoom,
  getRoomUsers,
  isUserInRoom,
  updateUserMediaState,
  setScreenSharingUser,
  clearScreenSharingUser,
  getScreenSharingUser,
  setRecordingUser,
  clearRecordingUser,
  getRecordingUser,
  getActiveRoomsCount,
  getAllRooms,
};