// Contains all meeting business logic with Redis caching
// Also triggers notifications when meeting starts or ends

const meetingRepo = require("../repositories/meetingRepository");
const userRepo = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const roomManager = require("../webrtc/roomManager");
const { deleteMediaFile, uploadToCloudinary } = require("../utils/mediaStorage");


const {
  getCache,
  setCache,
  deleteCacheByPattern,
} = require("../utils/redisHelpers")

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

const notifyParticipants = async (meeting, hostId, type, title, message) => {
  const participants = meeting.participants || []
  for (const participantId of participants) {
    if (participantId.toString() === hostId.toString()) continue
    await notificationService.createNotification({
      recipient: participantId,
      sender: hostId,
      type,
      title,
      message,
      link: `/meetings/${meeting._id}`,
    })
  }
}

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

const getMeetingById = async (meetingId, userId = null) => {
  if (userId) {
    const user = await userRepo.findById(userId);
    if (user && user.hiddenMeetings && user.hiddenMeetings.map(id => id.toString()).includes(meetingId.toString())) {
      const error = new Error("This meeting was removed from your dashboard and is no longer accessible");
      error.statusCode = 403;
      throw error;
    }
  }

  const cacheKey = `meeting:${meetingId}`
  const cached = await getCache(cacheKey)
  if (cached) {
    if (
      userId &&
      cached.meeting &&
      cached.meeting.isHostDeleted &&
      (cached.meeting.host?._id?.toString() === userId.toString() ||
        cached.meeting.host?.toString() === userId.toString())
    ) {
      const error = new Error("Meeting not found or was deleted by you");
      error.statusCode = 404;
      throw error;
    }
    return cached;
  }

  const meeting = await meetingRepo.findByIdPopulated(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (
    userId &&
    meeting.isHostDeleted &&
    (meeting.host?._id?.toString() === userId.toString() ||
      meeting.host?.toString() === userId.toString())
  ) {
    const error = new Error("Meeting not found or was deleted by you");
    error.statusCode = 404;
    throw error;
  }

  const result = { meeting }
  await setCache(cacheKey, result, 300)
  return result
}

const getMeetingByCode = async (code) => {
  const meeting = await meetingRepo.findByCode(code)
  if (!meeting) {
    const error = new Error("Invalid meeting code")
    error.statusCode = 404
    throw error
  }
  return { meeting }
}

const getUserMeetings = async (userId) => {
  const Meeting = require("../models/Meeting");
  const user = await userRepo.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const attendedIds = (user.attendedMeetings || []).map((a) => a.meeting);
  const hiddenIds = user.hiddenMeetings || [];

  // Fetch all attended meetings to check status
  const attendedMeetings = await Meeting.find({ _id: { $in: attendedIds } });

  // Filter: completed ones always visible, active ones only within 10 min
  const visibleAttendedIds = attendedMeetings
    .filter((m) => {
      if (m.status === "completed" || m.status === "cancelled") return true;

      const record = user.attendedMeetings.find(
        (a) => a.meeting.toString() === m._id.toString()
      );
      return record && record.leftAt > tenMinutesAgo;
    })
    .map((m) => m._id);

  const meetings = await Meeting.find({
    $and: [
      {
        $or: [
          // User is host, and meeting is NOT host-deleted
          { host: userId, isHostDeleted: { $ne: true } },
          // User is participant / attended (even if host deleted it, participant can still see it unless hidden)
          {
            $and: [
              { host: { $ne: userId } },
              {
                $or: [
                  { participants: userId },
                  { _id: { $in: visibleAttendedIds } },
                ],
              },
            ],
          },
        ],
      },
      { _id: { $nin: hiddenIds } },
    ],
  })
    .populate("host", "name username profilePicture")
    .populate("participants", "name username profilePicture")
    .sort({ createdAt: -1 });

  return { meetings };
};

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

  // 1. Permanently delete recording file from Cloudinary and local disk if present
  if (meeting.recordingUrl) {
    await deleteMediaFile(meeting.recordingUrl);
  }

  // 2. Clear chat messages for this meeting
  const chatRepo = require("../repositories/chatRepository");
  await chatRepo.deleteAllByMeeting(meetingId);

  // 3. Check if any participants attended / joined this meeting
  const hasParticipants =
    (meeting.participants && meeting.participants.length > 0) ||
    meeting.status === "completed";

  if (hasParticipants) {
    // Keep meeting document for attendees to view meeting metadata and "Recording deleted by the host" notice.
    // Mark as host-deleted and wipe recordingUrl so host will no longer see it on their dashboard.
    await meetingRepo.updateById(meetingId, {
      recordingUrl: "",
      recordingDeletedByHost: true,
      isHostDeleted: true,
      hostDeletedAt: new Date(),
    });
  } else {
    // If no other user ever attended or joined, permanently delete document from DB
    await meetingRepo.deleteById(meetingId);
  }

  await clearMeetingCaches(meetingId, userId);

  return { message: "Meeting deleted successfully" };
}

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

  const user = await userRepo.findById(userId)

  if (!alreadyJoined) {
    await meetingRepo.addParticipant(meetingId, userId)
    await clearMeetingCaches(meetingId, userId)

    try {
      await notificationService.createNotification({
        recipient: meeting.host,
        sender: userId,
        type: "system",
        title: "Participant Joined",
        message: `${user?.name || "A user"} joined your meeting "${meeting.title}"`,
        link: `/meetings/${meetingId}`,
      })
    } catch (err) {
      console.log("Join notification error:", err.message)
    }
  }

  const roomManager = require("../webrtc/roomManager")
  const existingRoomUser = roomManager
    .getRoomUsers(meetingId)
    .find((u) => u.userId.toString() === userId.toString())

  if (!existingRoomUser) {
    roomManager.addUserToRoom(meetingId, userId, null, {
      name: user?.name || "A user",
      username: user?.username || "unknown",
      profilePicture: user?.profilePicture || "",
    })
  }

  const updated = await meetingRepo.findById(meetingId)

  return {
    meeting: updated,
    userJoined: {
      userId: userId,
      name: user?.name || "A user",
      username: user?.username || "unknown",
      profilePicture: user?.profilePicture || "",
    },
  }
}

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

  await notifyParticipants(
    updated,
    userId,
    "meeting_started",
    "Meeting Started",
    `${updated.title} has been started by the host`
  )

  return { meeting: updated }
}

const leaveMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  if (meeting.host.toString() === userId.toString()) {
    const error = new Error("Host cannot leave. Please end the meeting");
    error.statusCode = 400;
    throw error;
  }

  const user = await userRepo.findById(userId);

  await meetingRepo.removeParticipant(meetingId, userId);
  await clearMeetingCaches(meetingId, userId);

  const roomManager = require("../webrtc/roomManager");
  roomManager.removeUserFromRoom(meetingId, userId);

  // Use $push / updateOne to avoid touching refreshToken
  if (user) {
    const exists = user.attendedMeetings.find(
      (a) => a.meeting.toString() === meetingId.toString()
    );

    if (exists) {
      await userRepo.updateAttendedMeeting(userId, meetingId);
    } else {
      await userRepo.addAttendedMeeting(userId, meetingId);
    }
  }

  try {
    await notificationService.createNotification({
      recipient: meeting.host,
      sender: userId,
      type: "system",
      title: "Participant Left",
      message: `${user?.name || "A user"} left your meeting "${meeting.title}"`,
      link: `/meetings/${meetingId}`,
    });
  } catch (err) {
    console.log("Leave notification error:", err.message);
  }

  return {
    message: "Left meeting successfully",
    meetingId,
    userLeft: {
      userId: userId,
      name: user?.name || "A user",
      username: user?.username || "unknown",
    },
  };
};

const endMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only host can end the meeting");
    error.statusCode = 403;
    throw error;
  }

  const now = new Date();

  // Add host + all participants to attendedMeetings using $push
  const allUserIds = [meeting.host, ...meeting.participants];

  for (const uid of allUserIds) {
    const u = await userRepo.findById(uid);
    if (!u) continue;

    const exists = u.attendedMeetings.find(
      (a) => a.meeting.toString() === meetingId.toString()
    );

    if (exists) {
      await userRepo.updateAttendedMeeting(uid, meetingId);
    } else {
      await userRepo.addAttendedMeeting(uid, meetingId);
    }
  }

  const updated = await meetingRepo.updateById(meetingId, {
    status: "completed",
    endedAt: now,
  });

  await clearMeetingCaches(meetingId, userId);

  await notifyParticipants(
    updated,
    userId,
    "meeting_ended",
    "Meeting Ended",
    `${updated.title} has been ended by the host`
  );

  roomManager.clearRoom(meetingId);

  const chatRepo = require("../repositories/chatRepository");
  await chatRepo.deleteAllByMeeting(meetingId);

  return { meeting: updated, meetingId };
};

// Remove meeting from user's visible list (hides it for this user only)
const hideMeetingFromUser = async (meetingId, userId) => {
  const user = await userRepo.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  // Use $addToSet - avoids duplicate, doesn't touch other fields
  await userRepo.addHiddenMeeting(userId, meetingId);

  return { message: "Meeting removed from your list" };
};

// Upload or save meeting recording URL
const uploadMeetingRecording = async (meetingId, userId, file, recordingUrl) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  // Delete previous recording if one already exists
  if (meeting.recordingUrl) {
    await deleteMediaFile(meeting.recordingUrl);
  }

  let finalUrl = recordingUrl || "";

  if (file && file.buffer) {
    try {
      const result = await uploadToCloudinary(file.buffer, {
        subfolder: "recordings",
        resource_type: "video",
      });
      finalUrl = result.secure_url;
    } catch (cloudErr) {
      console.warn("Cloudinary upload failed, falling back to disk:", cloudErr.message);
      const fs = require("fs");
      const path = require("path");
      const uploadDir = path.join(__dirname, "../../uploads/recordings");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filename = `recording-${meetingId}-${Date.now()}.webm`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      finalUrl = `/uploads/recordings/${filename}`;
    }
  }

  if (!finalUrl) {
    const error = new Error("No recording data provided");
    error.statusCode = 400;
    throw error;
  }

  const updated = await meetingRepo.updateById(meetingId, {
    recordingUrl: finalUrl,
    recordingDeletedByHost: false,
    isRecording: false,
  });

  await clearMeetingCaches(meetingId, meeting.host);

  return { meeting: updated, recordingUrl: finalUrl };
};

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
  hideMeetingFromUser,
  uploadMeetingRecording,
}