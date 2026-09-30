// // Contains all meeting business logic
// // Handles create, update, delete, join, leave, start and end operations

// const meetingRepo = require("../repositories/meetingRepository")
// const userRepo = require("../repositories/userRepository")

// // Generate unique meeting code
// const generateMeetingCode = () => {
//     const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
//     let code = ""
//     for (let i = 0; i < 8; i++) {
//         code += chars.charAt(Math.floor(Math.random() * chars.length))
//     }
//     return code
// }

// // Create a new meeting
// const createMeeting = async (userId, data) => {
//     const { title, description, scheduledAt, settings } = data

//     if (!title) {
//         const error = new Error("Meeting title is required")
//         error.statusCode = 400
//         throw error
//     }

//     const host = await userRepo.findById(userId)
//     if (!host) {
//         const error = new Error("Host user not found")
//         error.statusCode = 404
//         throw error
//     }

//     let meetingCode = generateMeetingCode()
//     let existing = await meetingRepo.findByCode(meetingCode)

//     while (existing) {
//         meetingCode = generateMeetingCode()
//         existing = await meetingRepo.findByCode(meetingCode)
//     }

//     const meeting = await meetingRepo.create({
//         title,
//         description: description || "",
//         host: userId,
//         meetingCode,
//         scheduledAt: scheduledAt || new Date(),
//         settings: settings || {},
//     })

//     return { meeting }
// }

// // Get meeting by ID
// const getMeetingById = async (meetingId) => {
//     const meeting = await meetingRepo.findByIdPopulated(meetingId);

//     if (!meeting) {
//         const error = new Error("Meeting not found")
//         error.statusCode = 404
//         throw error
//     }
//     return { meeting }
// }

// // Get meeting by code
// const getMeetingByCode = async (code) => {
//     const meeting = await meetingRepo.findByCode(code)
//     if (!meeting) {
//         const error = new Error("Invalid meeting code")
//         error.statusCode = 404
//         throw error
//     }
//     return { meeting }
// }

// // Get all meetings of logged in user
// const getUserMeetings = async (userId) => {
//     const meetings = await meetingRepo.findByUser(userId)
//     return { meetings }
// }

// // Update meeting details
// const updateMeeting = async (meetingId, userId, updateData) => {
//     const meeting = await meetingRepo.findById(meetingId)
//     if (!meeting) {
//         const error = new Error("Meeting not found")
//         error.statusCode = 404
//         throw error
//     }

//     if (meeting.host.toString() !== userId.toString()) {
//         const error = new Error("Only host can update the meeting")
//         error.statusCode = 403
//         throw error
//     }

//     const allowedFields = ["title", "description", "scheduledAt", "settings"]
//     const updates = {}

//     allowedFields.forEach((field) => {
//         if (updateData[field] !== undefined) {
//             updates[field] = updateData[field]
//         }
//     })

//     const updated = await meetingRepo.updateById(meetingId, updates)
//     return { meeting: updated }
// }

// // Delete meeting
// const deleteMeeting = async (meetingId, userId) => {
//     const meeting = await meetingRepo.findById(meetingId);
//     if (!meeting) {
//         const error = new Error("Meeting not found")
//         error.statusCode = 404
//         throw error
//     }

//     if (meeting.host.toString() !== userId.toString()) {
//         const error = new Error("Only host can delete the meeting")
//         error.statusCode = 403
//         throw error
//     }

//     await meetingRepo.deleteById(meetingId)
//     return { message: "Meeting deleted successfully" }
// }

// // Join meeting
// const joinMeeting = async (meetingId, userId) => {
//     const meeting = await meetingRepo.findById(meetingId)
//     if (!meeting) {
//         const error = new Error("Meeting not found")
//         error.statusCode = 404
//         throw error
//     }

//     if (meeting.status === "completed" || meeting.status === "cancelled") {
//         const error = new Error("This meeting is no longer active")
//         error.statusCode = 400
//         throw error
//     }

//     if (meeting.host.toString() === userId.toString()) {
//         return { meeting }
//     }

//     const alreadyJoined = meeting.participants.some(
//         (p) => p.toString() === userId.toString()
//     )
//     if (alreadyJoined) {
//         return { meeting }
//     }

//     const updated = await meetingRepo.addParticipant(meetingId, userId)
//     return { meeting: updated }
// }

// // Leave meeting
// const leaveMeeting = async (meetingId, userId) => {
//     const meeting = await meetingRepo.findById(meetingId)
//     if (!meeting) {
//         const error = new Error("Meeting not found")
//         error.statusCode = 404
//         throw error
//     }

//     if (meeting.host.toString() === userId.toString()) {
//         const error = new Error("Host cannot leave. Please end the meeting")
//         error.statusCode = 400
//         throw error
//     }

//     await meetingRepo.removeParticipant(meetingId, userId)
//     return { message: "Left meeting successfully" }
// }

// // Start meeting
// const startMeeting = async (meetingId, userId) => {
//     const meeting = await meetingRepo.findById(meetingId)
//     if (!meeting) {
//         const error = new Error("Meeting not found")
//         error.statusCode = 404
//         throw error
//     }

//     if (meeting.host.toString() !== userId.toString()) {
//         const error = new Error("Only host can start the meeting")
//         error.statusCode = 403
//         throw error
//     }

//     const updated = await meetingRepo.updateById(meetingId, {
//         status: "ongoing",
//         startedAt: new Date(),
//     })

//     return { meeting: updated }
// }

// // End meeting
// const endMeeting = async (meetingId, userId) => {
//     const meeting = await meetingRepo.findById(meetingId)
//     if (!meeting) {
//         const error = new Error("Meeting not found")
//         error.statusCode = 404
//         throw error
//     }

//     if (meeting.host.toString() !== userId.toString()) {
//         const error = new Error("Only host can end the meeting")
//         error.statusCode = 403
//         throw error
//     }

//     const updated = await meetingRepo.updateById(meetingId, {
//         status: "completed",
//         endedAt: new Date(),
//     })

//     return { meeting: updated }
// }

// module.exports = {
//     createMeeting,
//     getMeetingById,
//     getMeetingByCode,
//     getUserMeetings,
//     updateMeeting,
//     deleteMeeting,
//     joinMeeting,
//     leaveMeeting,
//     startMeeting,
//     endMeeting,
// }








const meetingRepo = require("../repositories/meetingRepository");
const userRepo = require("../repositories/userRepository");

const {
  getCache,
  setCache,
  deleteCacheByPattern,
} = require("../utils/redisHelpers")

// Generate unique meeting code
const generateMeetingCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}


const clearMeetingCaches = async (meetingId, hostId) => {
  await deleteCacheByPattern(`meeting:${meetingId}*`)
  if (hostId) {
    await deleteCacheByPattern(`user:${hostId}:meetings`)
  }
  await deleteCacheByPattern("user:*:meetings")
}

// Create a new meeting
const createMeeting = async (userId, data) => {
  const { title, description, scheduledAt, settings } = data

  if (!title) {
    const error = new Error("Meeting title is required")
    error.statusCode = 400
    throw error
  }

  const host = await userRepo.findById(userId)
  if (!host) {
    const error = new Error("Host user not found")
    error.statusCode = 404
    throw error
  }

  let meetingCode = generateMeetingCode()
  let existing = await meetingRepo.findByCode(meetingCode)
  while (existing) {
    meetingCode = generateMeetingCode()
    existing = await meetingRepo.findByCode(meetingCode)
  }

  const meeting = await meetingRepo.create({
    title,
    description: description || "",
    host: userId,
    meetingCode,
    scheduledAt: scheduledAt || new Date(),
    settings: settings || {},
  })

  await deleteCacheByPattern(`user:${userId}:meetings`)

  return { meeting }
}

// Get meeting by ID
const getMeetingById = async (meetingId) => {
  const cacheKey = `meeting:${meetingId}`
  const cached = await getCache(cacheKey)
  if (cached) return cached

  const meeting = await meetingRepo.findByIdPopulated(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  const result = { meeting }
  await setCache(cacheKey, result, 300)
  return result
}

// Get meeting by code 
const getMeetingByCode = async (code) => {
  const meeting = await meetingRepo.findByCode(code)
  if (!meeting) {
    const error = new Error("Invalid meeting code")
    error.statusCode = 404
    throw error
  }
  return { meeting }
}

// Get all meetings of logged in user
const getUserMeetings = async (userId) => {
  const cacheKey = `user:${userId}:meetings`
  const cached = await getCache(cacheKey)
  if (cached) return cached

  const meetings = await meetingRepo.findByUser(userId)
  const result = { meetings }

  await setCache(cacheKey, result, 60)
  return result
}

// Update meeting details
const updateMeeting = async (meetingId, userId, updateData) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only host can update the meeting")
    error.statusCode = 403
    throw error
  }

  const allowedFields = ["title", "description", "scheduledAt", "settings"]
  const updates = {}

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field]
    }
  })

  const updated = await meetingRepo.updateById(meetingId, updates)

  await clearMeetingCaches(meetingId, userId)

  return { meeting: updated }
}

// Delete meeting
const deleteMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only host can delete the meeting")
    error.statusCode = 403
    throw error
  }

  await meetingRepo.deleteById(meetingId)
  await clearMeetingCaches(meetingId, userId)

  return { message: "Meeting deleted successfully" }
}

// Join meeting
const joinMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (meeting.status === "completed" || meeting.status === "cancelled") {
    const error = new Error("This meeting is no longer active")
    error.statusCode = 400
    throw error
  }

  if (meeting.host.toString() === userId.toString()) {
    return { meeting }
  }

  const alreadyJoined = meeting.participants.some(
    (p) => p.toString() === userId.toString()
  )
  if (alreadyJoined) {
    return { meeting }
  }

  const updated = await meetingRepo.addParticipant(meetingId, userId)
  await clearMeetingCaches(meetingId, userId)

  return { meeting: updated }
}

// Leave meeting
const leaveMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (meeting.host.toString() === userId.toString()) {
    const error = new Error("Host cannot leave. Please end the meeting")
    error.statusCode = 400
    throw error
  }

  await meetingRepo.removeParticipant(meetingId, userId)
  await clearMeetingCaches(meetingId, userId)

  return { message: "Left meeting successfully" }
}

// startr meeting
const startMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only host can start the meeting")
    error.statusCode = 403
    throw error
  }

  const updated = await meetingRepo.updateById(meetingId, {
    status: "ongoing",
    startedAt: new Date(),
  })

  await clearMeetingCaches(meetingId, userId)

  return { meeting: updated }
}

// End meeting
const endMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only host can end the meeting")
    error.statusCode = 403
    throw error
  }

  const updated = await meetingRepo.updateById(meetingId, {
    status: "completed",
    endedAt: new Date(),
  })

  await clearMeetingCaches(meetingId, userId)

  return { meeting: updated }
}

module.exports = {
  createMeeting,
  getMeetingById,
  getMeetingByCode,
  getUserMeetings,
  updateMeeting,
  deleteMeeting,
  joinMeeting,
  leaveMeeting,
  startMeeting,
  endMeeting,
}