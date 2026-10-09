// Contains all meeting business logic with Redis caching
// Also triggers notifications when meeting starts or ends

const meetingRepo = require("../repositories/meetingRepository");
const userRepo = require("../repositories/userRepository");
const Meeting = require("../models/Meeting");
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
  const hostStr = (hostId?._id || hostId)?.toString();
  if (hostStr) {
    await deleteCacheByPattern(`user:${hostStr}:meetings`)
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
  const { title, description, scheduledAt, startTime, endTime, settings } = data;

  if (!title) {
    const error = new Error("Meeting title is required");
    error.statusCode = 400;
    throw error;
  }

  const host = await userRepo.findById(userId);
  if (!host) {
    const error = new Error("Host user not found");
    error.statusCode = 404;
    throw error;
  }

  let meetingCode = generateMeetingCode();
  let existing = await meetingRepo.findByCode(meetingCode);
  while (existing) {
    meetingCode = generateMeetingCode();
    existing = await meetingRepo.findByCode(meetingCode);
  }

  const meetingStartTime = startTime ? new Date(startTime) : (scheduledAt ? new Date(scheduledAt) : new Date());
  const meetingEndTime = endTime ? new Date(endTime) : null;

  const meeting = await meetingRepo.create({
    title,
    description: description || "",
    host: userId,
    meetingCode,
    scheduledAt: meetingStartTime,
    startTime: meetingStartTime,
    endTime: meetingEndTime,
    settings: settings || {},
  });

  await deleteCacheByPattern(`user:${userId}:meetings`);

  return { meeting };
};

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
    // Always inject live in-memory recording state before returning cached meeting
    const roomRecordingUser = roomManager.getRecordingUser(meetingId);
    const roomRecordingStartedAt = roomManager.getRecordingStartedAt(meetingId);
    const isRecordingActive = Boolean(roomRecordingStartedAt);
    if (cached.meeting) {
      cached.meeting.isRecording = isRecordingActive;
      cached.meeting.recordingStartedAt = isRecordingActive ? roomRecordingStartedAt : null;
      cached.meeting.recordingUserId = roomRecordingUser || null;
    }
    return cached;
  }

  const meeting = await meetingRepo.findByIdPopulated(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  // Ensure all users who attended or joined this meeting are present in meeting.participants
  try {
    const User = require("../models/User");
    const attendedUsers = await User.find({
      "attendedMeetings.meeting": meeting._id,
    }).select("_id name username email profilePicture");

    const hostId = (meeting.host?._id || meeting.host)?.toString();

    // Ensure host is never inside participants array
    if (meeting.participants && Array.isArray(meeting.participants)) {
      meeting.participants = meeting.participants.filter(
        (p) => (p?._id || p)?.toString() !== hostId
      );
    }

    if (attendedUsers && attendedUsers.length > 0) {
      const existingIds = new Set(
        (meeting.participants || []).map((p) => (p._id ? p._id.toString() : p.toString()))
      );
      let needsDbUpdate = false;
      for (const aUser of attendedUsers) {
        const uId = aUser._id.toString();
        if (hostId && uId !== hostId && !existingIds.has(uId)) {
          await meetingRepo.addParticipant(meeting._id, aUser._id);
          meeting.participants.push(aUser);
          existingIds.add(uId);
          needsDbUpdate = true;
        }
      }
      if (needsDbUpdate) {
        await clearMeetingCaches(meetingId, userId);
      }
    }
  } catch (err) {
    console.warn("Attended users lookup notice:", err.message);
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

  // Check live in-memory room recording state from roomManager
  const roomRecordingUser = roomManager.getRecordingUser(meetingId);
  const roomRecordingStartedAt = roomManager.getRecordingStartedAt(meetingId);
  const isRecordingActive = Boolean(roomRecordingStartedAt);
  const meetingObj = meeting.toObject ? meeting.toObject() : meeting;
  meetingObj.isRecording = isRecordingActive;
  meetingObj.recordingStartedAt = isRecordingActive ? roomRecordingStartedAt : null;
  meetingObj.recordingUserId = roomRecordingUser || null;

  const result = { meeting: meetingObj };
  await setCache(cacheKey, result, 300);
  return result;
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

  // 1. Permanently delete all recording files from Cloudinary and local disk if present
  if (Array.isArray(meeting.recordings) && meeting.recordings.length > 0) {
    for (const rec of meeting.recordings) {
      if (rec?.url) {
        await deleteMediaFile(rec.url);
      }
    }
  } else if (meeting.recordingUrl) {
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
      recordings: [],
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

  const hostId = (meeting.host?._id || meeting.host)?.toString();
  if (hostId === userId.toString()) {
    // Record first-time start timestamp when host joins call
    if (!meeting.startedAt) {
      const now = new Date();
      await meetingRepo.updateById(meetingId, {
        startedAt: now,
        status: "ongoing",
      });
      await clearMeetingCaches(meetingId, userId);
      meeting.startedAt = now;
      meeting.status = "ongoing";
    }
    return { meeting };
  }

  const alreadyJoined = (meeting.participants || []).some(
    (p) => (p?._id || p)?.toString() === userId.toString()
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
        message: `${user?.name || "A member"} joined your meeting "${meeting.title}"`,
        link: `/meetings/${meetingId}`,
      })
    } catch (err) {
      console.log("Join notification error:", err.message)
    }
  }

  // Also ensure participant is recorded in attendedMeetings
  if (user) {
    const exists = (user.attendedMeetings || []).find(
      (a) => a.meeting?.toString() === meetingId.toString()
    );
    if (!exists) {
      await userRepo.addAttendedMeeting(userId, meetingId);
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

  const hostId = (meeting.host?._id || meeting.host)?.toString();
  if (hostId !== userId.toString()) {
    const error = new Error("Only host can start the meeting")
    error.statusCode = 403
    throw error
  }

  const updateData = {
    status: "ongoing",
  };
  if (!meeting.startedAt) {
    updateData.startedAt = new Date();
  }

  const updated = await meetingRepo.updateById(meetingId, updateData);

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

  const hostId = (meeting.host?._id || meeting.host)?.toString();
  const isHost = hostId === userId.toString();

  const user = await userRepo.findById(userId);

  // Preserve participant in meeting attendance history (do NOT remove from meetingRepo)
  await clearMeetingCaches(meetingId, userId);

  const roomManager = require("../webrtc/roomManager");
  roomManager.removeUserFromRoom(meetingId, userId);

  // Check if all participants (host + members) have now left
  const remainingUsers = roomManager.getRoomUsers(meetingId);
  if (remainingUsers.length === 0 && meeting.status === "ongoing") {
    const nonHostParticipants = (meeting.participants || []).filter(
      (p) => (p?._id || p)?.toString() !== hostId
    );
    const hasMembers = nonHostParticipants.length > 0;
    const now = new Date();
    await meetingRepo.updateById(meetingId, {
      status: "completed",
      endedAt: hasMembers ? now : null,
      startedAt: hasMembers ? meeting.startedAt : null,
    });
    await clearMeetingCaches(meetingId, hostId);
  }

  // Use $push / updateOne to avoid touching refreshToken
  if (user) {
    const exists = (user.attendedMeetings || []).find(
      (a) => a.meeting?.toString() === meetingId.toString()
    );

    if (exists) {
      await userRepo.updateAttendedMeeting(userId, meetingId);
    } else {
      await userRepo.addAttendedMeeting(userId, meetingId);
    }
  }

  if (!isHost) {
    try {
      await notificationService.createNotification({
        recipient: meeting.host,
        sender: userId,
        type: "system",
        title: "Member Left",
        message: `${user?.name || "A member"} left your meeting "${meeting.title}"`,
        link: `/meetings/${meetingId}`,
      });
    } catch (err) {
      console.log("Leave notification error:", err.message);
    }
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

  const hostId = (meeting.host?._id || meeting.host)?.toString();
  if (hostId !== userId.toString()) {
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

  const nonHostParticipants = (meeting.participants || []).filter(
    (p) => (p?._id || p)?.toString() !== hostId
  );
  const hasMembers = nonHostParticipants.length > 0;

  const updateData = {
    status: "completed",
    endedAt: hasMembers ? now : null,
  };
  if (!hasMembers) {
    updateData.startedAt = null;
  }

  const updated = await meetingRepo.updateById(meetingId, updateData);

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

// Upload or save meeting recording URL (Fast local write + background Cloudinary sync, supports multiple recordings)
const uploadMeetingRecording = async (meetingId, userId, file, recordingUrl, metadata = {}) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  let finalUrl = recordingUrl || "";
  let fileSize = metadata.size || (file ? file.size : 0);
  let duration = metadata.duration || 0;

  if (file && file.buffer) {
    const fs = require("fs");
    const path = require("path");
    const uploadDir = path.join(__dirname, "../../uploads/recordings");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filename = `recording-${meetingId}-${Date.now()}.webm`;
    const filePath = path.join(uploadDir, filename);

    // 1. Write file to disk immediately (takes <20ms for fast user response)
    fs.writeFileSync(filePath, file.buffer);
    finalUrl = `/uploads/recordings/${filename}`;
    fileSize = file.buffer.length;

    // 2. Background sync to Cloudinary if configured (non-blocking)
    if (process.env.CLOUDINARY_API_KEY && process.env.ENABLE_CLOUDINARY_RECORDINGS === "true") {
      uploadToCloudinary(file.buffer, {
        subfolder: "recordings",
        resource_type: "video",
      })
        .then(async (result) => {
          if (result?.secure_url) {
            console.log(`[MediaStorage] Background Cloudinary sync complete for meeting ${meetingId}`);
            const Meeting = require("../models/Meeting");
            await Meeting.updateOne(
              { _id: meetingId, "recordings.url": finalUrl },
              { $set: { "recordings.$.url": result.secure_url } }
            );
            await meetingRepo.updateById(meetingId, { recordingUrl: result.secure_url });
            await clearMeetingCaches(meetingId, meeting.host);
            try {
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch {}
          }
        })
        .catch((err) => {
          console.warn("[MediaStorage] Background Cloudinary sync skipped, recording safe on disk:", err.message);
        });
    }
  }

  if (!finalUrl) {
    const error = new Error("No recording data provided");
    error.statusCode = 400;
    throw error;
  }

  // Append new recording to meeting recordings list so host can save multiple recordings
  const currentRecordings = Array.isArray(meeting.recordings) ? meeting.recordings : [];
  const nextIndex = currentRecordings.length + 1;
  const recordingTitle =
    metadata.title || `${meeting.title} - Recording ${nextIndex}`;

  const newRecording = {
    url: finalUrl,
    title: recordingTitle,
    duration: Number(duration) || 0,
    size: Number(fileSize) || 0,
    createdAt: new Date(),
  };

  const updatedRecordings = [...currentRecordings, newRecording];

  const updated = await meetingRepo.updateById(meetingId, {
    recordingUrl: finalUrl,
    recordings: updatedRecordings,
    recordingDeletedByHost: false,
    isRecording: false,
  });

  await clearMeetingCaches(meetingId, meeting.host);

  return { meeting: updated, recording: newRecording, recordingUrl: finalUrl };
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