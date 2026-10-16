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
  const { title, description, scheduledAt, startTime, endTime, settings, workspace, project, participants } = data;

  if (!title || !title.trim()) {
    const error = new Error("Meeting title is required");
    error.statusCode = 400;
    throw error;
  }

  if (!workspace) {
    const error = new Error("Workspace selection is mandatory");
    error.statusCode = 400;
    throw error;
  }

  const host = await userRepo.findById(userId);
  if (!host) {
    const error = new Error("Host user not found");
    error.statusCode = 404;
    throw error;
  }

  // Validate workspace
  const Team = require("../models/Team");
  const team = await Team.findById(workspace);
  if (!team) {
    const error = new Error("Selected workspace does not exist");
    error.statusCode = 404;
    throw error;
  }

  // Verify caller is a member/owner of the workspace
  const isOwner = team.owner.toString() === userId.toString();
  const isMember = (team.members || []).some(
    (m) => (m.user?._id || m.user)?.toString() === userId.toString() && (m.status === "active" || !m.status)
  );
  if (!isOwner && !isMember) {
    const error = new Error("You must be a member of this workspace to schedule meetings");
    error.statusCode = 403;
    throw error;
  }

  // Validate project if provided
  let projectDoc = null;
  if (project) {
    const Project = require("../models/Project");
    projectDoc = await Project.findById(project);
    if (!projectDoc || projectDoc.team.toString() !== team._id.toString()) {
      const error = new Error("Selected project does not belong to this workspace");
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate participants (must have at least 1 participant besides host)
  const participantIds = Array.isArray(participants)
    ? [...new Set(participants.map((p) => (p?._id || p).toString()).filter((id) => id !== userId.toString()))]
    : [];

  if (participantIds.length === 0) {
    const error = new Error("Please select at least 1 participant for the meeting");
    error.statusCode = 400;
    throw error;
  }

  const meetingStartTime = startTime ? new Date(startTime) : (scheduledAt ? new Date(scheduledAt) : new Date());
  const meetingEndTime = endTime ? new Date(endTime) : null;

  // Past time validation (allow 2-minute buffer for network transit)
  const pastGraceBufferMs = 2 * 60 * 1000;
  if (meetingStartTime.getTime() < Date.now() - pastGraceBufferMs) {
    const error = new Error("Meeting start time cannot be in the past. Please select a future time.");
    error.statusCode = 400;
    throw error;
  }

  if (meetingEndTime && meetingEndTime.getTime() <= meetingStartTime.getTime()) {
    const error = new Error("Meeting end time must be later than start time");
    error.statusCode = 400;
    throw error;
  }

  const meeting = await meetingRepo.create({
    title: title.trim(),
    description: (description || "").trim(),
    host: userId,
    workspace: team._id,
    project: projectDoc ? projectDoc._id : null,
    participants: participantIds,
    scheduledAt: meetingStartTime,
    startTime: meetingStartTime,
    endTime: meetingEndTime,
    settings: settings || {},
    status: "scheduled",
  });

  const populatedMeeting = await meetingRepo.findByIdPopulated(meeting._id);

  await deleteCacheByPattern(`user:${userId}:meetings`);
  await clearMeetingCaches(meeting._id, userId);

  // Send Email Notifications & In-app notifications to all invited participants
  const emailService = require("./emailService");
  const User = require("../models/User");
  const participantUsers = await User.find({ _id: { $in: participantIds } });

  for (const pUser of participantUsers) {
    // 1. In-app notification
    notificationService.createNotification({
      recipient: pUser._id,
      sender: userId,
      type: "meeting_invited",
      title: "Meeting Invitation",
      message: `You have been invited to "${meeting.title}" by ${host.name}`,
      link: `/meetings/${meeting._id}/details`,
    }).catch((e) => console.warn("In-app notification error:", e.message));

    // 2. Email invite dispatch
    emailService.sendMeetingInviteEmail({
      recipientEmail: pUser.email,
      recipientName: pUser.name,
      meeting: populatedMeeting || meeting,
      hostName: host.name,
      workspaceName: team.name,
      projectName: projectDoc?.name || null,
    }).catch((e) => console.warn("Email invite dispatch error:", e.message));
  }

  return { meeting: populatedMeeting || meeting };
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
    if (cached.meeting && cached.meeting.status === "scheduled" && !cached.meeting.startedAt) {
      const start = new Date(cached.meeting.startTime || cached.meeting.scheduledAt || cached.meeting.createdAt).getTime();
      let expiryThresholdMs;
      if (cached.meeting.endTime) {
        const end = new Date(cached.meeting.endTime).getTime();
        expiryThresholdMs = Math.max(end + 15 * 60 * 1000, start + 60 * 60 * 1000);
      } else {
        expiryThresholdMs = start + 60 * 60 * 1000;
      }
      if (Date.now() > expiryThresholdMs) {
        cached.meeting.status = "expired";
        await meetingRepo.updateById(cached.meeting._id, { status: "expired" });
        const hostId = (cached.meeting.host?._id || cached.meeting.host)?.toString();
        await clearMeetingCaches(cached.meeting._id, hostId);
      }
    }
    return cached;
  }

  const meeting = await meetingRepo.findByIdPopulated(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  // Check if unconducted scheduled meeting has expired
  if (meeting.status === "scheduled" && !meeting.startedAt) {
    const start = new Date(meeting.startTime || meeting.scheduledAt || meeting.createdAt).getTime();
    let expiryThresholdMs;
    if (meeting.endTime) {
      const end = new Date(meeting.endTime).getTime();
      expiryThresholdMs = Math.max(end + 15 * 60 * 1000, start + 60 * 60 * 1000);
    } else {
      expiryThresholdMs = start + 60 * 60 * 1000;
    }

    if (Date.now() > expiryThresholdMs) {
      meeting.status = "expired";
      await meetingRepo.updateById(meeting._id, { status: "expired" });
      const hostId = (meeting.host?._id || meeting.host)?.toString();
      await clearMeetingCaches(meeting._id, hostId);
    }
  }

  // Ensure all users who attended or joined this meeting are present in meeting.participants
  let attendedUsers = [];
  try {
    const User = require("../models/User");
    attendedUsers = await User.find({
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
  meetingObj.attendedUserIds = (attendedUsers || []).map((u) => u._id.toString());

  const result = { meeting: meetingObj };
  await setCache(cacheKey, result, 300);
  return result;
};

const getMeetingByCode = async (code) => {
  const meeting = await meetingRepo.findByCode(code)
  if (!meeting) {
    const error = new Error("Invalid meeting code")
    error.statusCode = 404
    throw error
  }
  return { meeting }
}

/**
 * Automatically transitions unconducted scheduled meetings to 'expired'.
 * Criteria:
 * 1. status is 'scheduled'
 * 2. startedAt is null (never started)
 * 3. Scheduled time has passed:
 *    - If endTime is set: now > endTime + 15 minutes (with minimum 60 mins from start)
 *    - If endTime is null/undefined: now > startTime + 60 minutes
 */
const checkAndExpireScheduledMeetings = async (io = null) => {
  try {
    const Meeting = require("../models/Meeting");
    const now = new Date();
    const nowMs = now.getTime();

    // Find candidate scheduled meetings that never started
    const candidates = await Meeting.find({
      status: "scheduled",
      startedAt: null,
    });

    const expiredMeetingIds = [];

    for (const meeting of candidates) {
      const start = new Date(meeting.startTime || meeting.scheduledAt || meeting.createdAt).getTime();
      let expiryThresholdMs;

      if (meeting.endTime) {
        const end = new Date(meeting.endTime).getTime();
        // 15 minutes grace after scheduled endTime, with minimum 60 mins from startTime
        expiryThresholdMs = Math.max(end + 15 * 60 * 1000, start + 60 * 60 * 1000);
      } else {
        // Open-ended: expires 60 minutes after scheduled start time if no one joins
        expiryThresholdMs = start + 60 * 60 * 1000;
      }

      if (nowMs > expiryThresholdMs) {
        meeting.status = "expired";
        await meeting.save();
        expiredMeetingIds.push(meeting._id.toString());

        const hostId = (meeting.host?._id || meeting.host)?.toString();
        await clearMeetingCaches(meeting._id, hostId);

        if (io) {
          io.to(meeting._id.toString()).emit("meeting:updated", {
            meetingId: meeting._id,
            status: "expired",
          });
          io.emit("meeting:expired", {
            meetingId: meeting._id,
            status: "expired",
          });
        }

        // Notify participants and host about meeting expiration
        try {
          const emailService = require("./emailService");
          const User = require("../models/User");
          const Team = require("../models/Team");
          const host = await User.findById(hostId);
          const workspace = meeting.workspace ? await Team.findById(meeting.workspace) : null;
          const hostName = host?.name || "The host";
          const pIds = (meeting.participants || []).map((p) => (p._id || p).toString());
          const allNotifyIds = [...new Set([...pIds, hostId])].filter(Boolean);
          const notifyUsers = await User.find({ _id: { $in: allNotifyIds } });

          for (const u of notifyUsers) {
            notificationService.createNotification({
              recipient: u._id,
              sender: hostId,
              type: "system",
              title: "Meeting Expired",
              message: `Meeting "${meeting.title}" expired as it was not started by the scheduled time.`,
              link: `/dashboard`,
            }).catch((e) => console.warn("Expired in-app alert error:", e.message));

            emailService.sendMeetingExpiredEmail({
              recipientEmail: u.email,
              recipientName: u.name,
              meeting,
              hostName,
              workspaceName: workspace?.name,
            }).catch((e) => console.warn("Expired email dispatch error:", e.message));
          }
        } catch (expNotifyErr) {
          console.warn("Expired notification error:", expNotifyErr.message);
        }
      }
    }

    if (expiredMeetingIds.length > 0) {
      console.log(`[Meeting Lifecycle] Auto-expired ${expiredMeetingIds.length} unconducted meetings:`, expiredMeetingIds);
    }

    return expiredMeetingIds;
  } catch (err) {
    console.error("[Meeting Lifecycle] Error in checkAndExpireScheduledMeetings:", err.message);
    return [];
  }
};

const getUserMeetings = async (userId) => {
  // Ensure unconducted past meetings are lazily auto-expired
  await checkAndExpireScheduledMeetings();

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
      if (m.status === "completed" || m.status === "cancelled" || m.status === "expired") return true;

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
    .populate("workspace", "name description color code")
    .populate("project", "name description color")
    .sort({ startTime: 1, createdAt: -1 });

  const attendedSet = new Set(
    (user.attendedMeetings || []).map((a) => (a.meeting?._id || a.meeting).toString())
  );

  const formattedMeetings = meetings.map((m) => {
    const obj = m.toObject ? m.toObject() : m;
    obj.wasAttended = attendedSet.has(m._id.toString());
    return obj;
  });

  return { meetings: formattedMeetings };
};

const updateMeeting = async (meetingId, userId, updateData) => {
  const meeting = await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  if (meeting.host.toString() !== userId.toString()) {
    const error = new Error("Only host can update the meeting");
    error.statusCode = 403;
    throw error;
  }

  if (meeting.status === "completed" || meeting.status === "ended" || meeting.status === "cancelled" || meeting.status === "expired") {
    const error = new Error("This meeting cannot be edited as it is already completed, cancelled, or expired");
    error.statusCode = 400;
    throw error;
  }

  const previousParticipantIds = (meeting.participants || []).map((p) => (p._id || p).toString());

  const allowedFields = [
    "title",
    "description",
    "scheduledAt",
    "startTime",
    "endTime",
    "workspace",
    "project",
    "participants",
    "settings",
  ];
  const updates = {};

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field];
    }
  });

  if (updateData.title) updates.title = updateData.title.trim();
  if (updateData.description !== undefined) updates.description = updateData.description.trim();

  // Synchronize scheduledAt and startTime
  if (updateData.startTime) {
    const parsedDate = new Date(updateData.startTime);
    updates.startTime = parsedDate;
    updates.scheduledAt = parsedDate;
  } else if (updateData.scheduledAt) {
    const parsedDate = new Date(updateData.scheduledAt);
    updates.startTime = parsedDate;
    updates.scheduledAt = parsedDate;
  }

  if (updateData.endTime !== undefined) {
    updates.endTime = updateData.endTime ? new Date(updateData.endTime) : null;
  }

  if (updateData.participants && Array.isArray(updateData.participants)) {
    updates.participants = [
      ...new Set(
        updateData.participants
          .map((p) => (p?._id || p).toString())
          .filter((id) => id !== userId.toString())
      ),
    ];
  }

  if (updateData.workspace) {
    updates.workspace = updateData.workspace;
  }
  if (updateData.project !== undefined) {
    updates.project = updateData.project || null;
  }

  // Validate start time is not in the past if updated
  if (updates.startTime) {
    const pastGraceBufferMs = 2 * 60 * 1000;
    if (updates.startTime.getTime() < Date.now() - pastGraceBufferMs) {
      const error = new Error("Meeting start time cannot be in the past. Please select a future time.");
      error.statusCode = 400;
      throw error;
    }
  }

  const effectiveStart = updates.startTime || meeting.startTime;
  const effectiveEnd = updates.endTime !== undefined ? updates.endTime : meeting.endTime;
  if (effectiveEnd && effectiveStart && effectiveEnd.getTime() <= effectiveStart.getTime()) {
    const error = new Error("Meeting end time must be later than start time");
    error.statusCode = 400;
    throw error;
  }

  await meetingRepo.updateById(meetingId, updates);
  const populated = await meetingRepo.findByIdPopulated(meetingId);

  await clearMeetingCaches(meetingId, userId);

  // Notify participants of meeting updates (union of previous and current participants)
  const currentParticipantIds = (populated.participants || []).map((p) => (p._id || p).toString());
  const allParticipantIds = [
    ...new Set([...previousParticipantIds, ...currentParticipantIds]),
  ].filter((id) => id !== userId.toString());

  if (allParticipantIds.length > 0) {
    try {
      const User = require("../models/User");
      const emailService = require("./emailService");
      const host = await User.findById(userId);
      const hostName = host?.name || "The host";
      const usersToNotify = await User.find({ _id: { $in: allParticipantIds } });

      for (const u of usersToNotify) {
        // In-app notification
        await notificationService.createNotification({
          recipient: u._id,
          sender: userId,
          type: "meeting_updated",
          title: "Meeting Details Updated",
          message: `${hostName} updated details for meeting "${populated.title}"`,
          link: `/meetings/${populated._id}/details`,
        });

        // Email notification
        emailService.sendMeetingUpdatedEmail({
          recipientEmail: u.email,
          recipientName: u.name,
          meeting: populated,
          hostName,
          workspaceName: populated.workspace?.name,
          projectName: populated.project?.name,
          changesSummary: "Schedule or details updated",
        }).catch((e) => console.warn("Email update dispatch error:", e.message));
      }
    } catch (nErr) {
      console.warn("Meeting update notification error:", nErr.message);
    }
  }

  return { meeting: populated || meeting };
};

const cancelMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findByIdPopulated(meetingId) || await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const hostId = (meeting.host?._id || meeting.host)?.toString();
  if (hostId !== userId.toString()) {
    const error = new Error("Only the host can cancel this meeting");
    error.statusCode = 403;
    throw error;
  }

  if (meeting.status === "completed" || meeting.status === "ended" || meeting.status === "cancelled" || meeting.status === "expired") {
    const error = new Error("This meeting cannot be cancelled as it is already completed, cancelled, or expired");
    error.statusCode = 400;
    throw error;
  }

  meeting.status = "cancelled";
  meeting.endedAt = new Date();
  await meeting.save();

  await clearMeetingCaches(meetingId, userId);

  // Notify participants of meeting cancellation
  const participants = meeting.participants || [];
  if (participants.length > 0) {
    try {
      const emailService = require("./emailService");
      const User = require("../models/User");
      const host = await User.findById(userId);
      const hostName = host?.name || "The host";
      const pIds = participants.map((p) => (p._id || p).toString()).filter((id) => id !== userId.toString());
      const pUsers = await User.find({ _id: { $in: pIds } });

      for (const pUser of pUsers) {
        notificationService.createNotification({
          recipient: pUser._id,
          sender: userId,
          type: "meeting_cancelled",
          title: "Meeting Cancelled",
          message: `${hostName} cancelled meeting "${meeting.title}"`,
          link: `/meetings/${meeting._id}/details`,
        }).catch((e) => console.warn("Cancel notification error:", e.message));

        emailService.sendMeetingCancelledEmail({
          recipientEmail: pUser.email,
          recipientName: pUser.name,
          meeting,
          hostName,
          workspaceName: meeting.workspace?.name,
        }).catch((e) => console.warn("Cancel email error:", e.message));
      }
    } catch (cErr) {
      console.warn("Cancellation notification error:", cErr.message);
    }
  }

  return { meeting };
};

const deleteMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findByIdPopulated(meetingId) || await meetingRepo.findById(meetingId);
  if (!meeting) {
    const error = new Error("Meeting not found");
    error.statusCode = 404;
    throw error;
  }

  const hostId = (meeting.host?._id || meeting.host)?.toString();
  if (hostId !== userId.toString()) {
    const error = new Error("Only host can delete the meeting");
    error.statusCode = 403;
    throw error;
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

  // 3. Notify participants of meeting cancellation ONLY if scheduled / upcoming (NOT if already completed or ended)
  const isUpcomingOrScheduled =
    meeting.status === "scheduled" ||
    meeting.status === "upcoming" ||
    (!meeting.status && !meeting.actualEndTime);

  const participants = meeting.participants || [];
  if (isUpcomingOrScheduled && participants.length > 0) {
    try {
      const emailService = require("./emailService");
      const User = require("../models/User");
      const host = await User.findById(userId);
      const hostName = host?.name || "The host";
      const pIds = participants.map((p) => (p._id || p).toString()).filter((id) => id !== userId.toString());
      const pUsers = await User.find({ _id: { $in: pIds } });

      for (const pUser of pUsers) {
        notificationService.createNotification({
          recipient: pUser._id,
          sender: userId,
          type: "meeting_cancelled",
          title: "Meeting Cancelled",
          message: `${hostName} cancelled meeting "${meeting.title}"`,
          link: `/dashboard`,
        }).catch((e) => console.warn("Cancel notification error:", e.message));

        emailService.sendMeetingCancelledEmail({
          recipientEmail: pUser.email,
          recipientName: pUser.name,
          meeting,
          hostName,
          workspaceName: meeting.workspace?.name,
        }).catch((e) => console.warn("Cancel email error:", e.message));
      }
    } catch (cErr) {
      console.warn("Cancellation notification error:", cErr.message);
    }
  }

  // 4. Check if this was a completed / conducted meeting
  const isConductedMeeting = meeting.status === "completed" && Boolean(meeting.startedAt);

  if (isConductedMeeting) {
    // Keep meeting document for attendees to view meeting metadata and "Recording deleted by the host" notice.
    await meetingRepo.updateById(meetingId, {
      recordingUrl: "",
      recordings: [],
      recordingDeletedByHost: true,
      isHostDeleted: true,
      hostDeletedAt: new Date(),
    });
  } else {
    // If cancelled, expired, scheduled, or never conducted: permanently delete from DB
    await meetingRepo.deleteById(meetingId);
  }

  await clearMeetingCaches(meetingId, userId);

  return { message: "Meeting deleted successfully" };
};

const joinMeeting = async (meetingId, userId) => {
  const meeting = await meetingRepo.findById(meetingId)
  if (!meeting) {
    const error = new Error("Meeting not found")
    error.statusCode = 404
    throw error
  }

  if (meeting.status === "completed" || meeting.status === "cancelled" || meeting.status === "expired") {
    const error = new Error(
      meeting.status === "expired"
        ? "This meeting has expired and is no longer available"
        : "This meeting is no longer active"
    );
    error.statusCode = 400;
    throw error;
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
    // Record host join session for attendance tracking
    await userRepo.recordMeetingJoin(userId, meetingId);
    return { meeting };
  }

  const alreadyJoined = (meeting.participants || []).some(
    (p) => (p?._id || p)?.toString() === userId.toString()
  )

  const user = await userRepo.findById(userId)

  if (!alreadyJoined) {
    await meetingRepo.addParticipant(meetingId, userId)
    await clearMeetingCaches(meetingId, userId)
  }

  // Record participant join session for attendance tracking
  if (user) {
    await userRepo.recordMeetingJoin(userId, meetingId);
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
    const User = require("../models/User");
    const membersWhoAttended = await User.countDocuments({
      "attendedMeetings.meeting": meetingId,
      _id: { $ne: hostId },
    });
    // If NO non-host members ever attended the meeting (host joined alone and left),
    // reset status back to scheduled so it doesn't get abandoned as completed or ongoing.
    if (membersWhoAttended === 0) {
      await meetingRepo.updateById(meetingId, {
        status: "scheduled",
        endedAt: null,
        startedAt: null,
      });
      await clearMeetingCaches(meetingId, hostId);
    }
    // If members DID attend, DO NOT mark "completed" immediately here!
    // The 5-minute empty room grace timer (scheduleEmptyRoomCompletion in meetingSocket.js)
    // manages auto-completion, allowing participants and host to rejoin within 5 minutes if all leave.
  }

  // Record leave session and accumulate attendance duration
  if (user) {
    await userRepo.recordMeetingLeave(userId, meetingId);
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

  // Close attendance sessions for all users who attended this meeting
  await userRepo.closeMeetingSessions(meetingId, now);

  try {
    const { cancelEmptyRoomGraceTimer } = require("../socket/meetingSocket");
    cancelEmptyRoomGraceTimer(meetingId);
  } catch (e) {}

  const updateData = {
    status: "completed",
    endedAt: now,
    startedAt: meeting.startedAt || now,
  };

  const updated = await meetingRepo.updateById(meetingId, updateData);

  await clearMeetingCaches(meetingId, userId);

  await notifyParticipants(
    updated,
    userId,
    "meeting_ended",
    "Meeting Ended",
    `${updated.title} has been ended by the host`
  );

  // Dispatch meeting ended email with AI summary link to participants
  try {
    const emailService = require("./emailService");
    const User = require("../models/User");
    const host = await User.findById(userId);
    const hostName = host?.name || "The host";
    const nonHostIds = (updated.participants || []).map((p) => (p._id || p).toString()).filter((id) => id !== userId.toString());
    const pUsers = await User.find({ _id: { $in: nonHostIds } });

    for (const pUser of pUsers) {
      emailService.sendMeetingEndedEmail({
        recipientEmail: pUser.email,
        recipientName: pUser.name,
        meeting: updated,
        hostName,
        workspaceName: updated.workspace?.name,
      }).catch((e) => console.warn("Meeting ended email error:", e.message));
    }
  } catch (err) {
    console.warn("Meeting ended email notification warning:", err.message);
  }

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

// Calculate meeting statistics & analytics for user (hosted, joined, duration, attendance %)
const getUserMeetingAnalytics = async (userId) => {
  // Ensure unconducted past meetings are lazily auto-expired before computing analytics
  await checkAndExpireScheduledMeetings();

  const Meeting = require("../models/Meeting");
  const User = require("../models/User");

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const hiddenIdStrs = (user.hiddenMeetings || []).map((id) => id.toString());
  const attendedMeetingIds = (user.attendedMeetings || []).map((a) => a.meeting);

  // Retrieve ALL meetings associated with the user: hosted, participant, or attended
  // Crucial: Do NOT filter out hiddenMeetings or host-deleted meetings so historical analytics remain intact!
  const allMeetings = await Meeting.find({
    $or: [
      { host: userId },
      { participants: userId },
      { _id: { $in: attendedMeetingIds } },
    ],
  })
    .populate("workspace", "name color code")
    .populate("project", "name color")
    .populate("host", "name username profilePicture")
    .populate("participants", "name username profilePicture")
    .sort({ startTime: -1, createdAt: -1 });

  let totalHosted = 0;
  let totalJoined = 0;
  let totalDurationSeconds = 0;
  let attendedCount = 0;
  let totalScheduledForUser = 0;

  const pastMeetings = [];
  const upcomingMeetings = [];
  const detailedMeetingList = [];

  for (const m of allMeetings) {
    const isHost = (m.host?._id || m.host)?.toString() === userId.toString();
    const isHostDeleted = Boolean(m.isHostDeleted);
    const isHiddenByMe = hiddenIdStrs.includes(m._id.toString());
    
    // Meeting is accessible only if neither hidden by the user nor deleted by the host
    const isAccessible = !isHiddenByMe && !(isHost && isHostDeleted);

    const attendedRecord = (user.attendedMeetings || []).find(
      (a) => a.meeting?.toString() === m._id.toString()
    );

    // Calculate user's time spent in seconds (multi-session rejoins accumulation)
    let userDurationSec = 0;
    if (attendedRecord) {
      if (typeof attendedRecord.totalDurationSeconds === "number" && attendedRecord.totalDurationSeconds > 0) {
        userDurationSec = attendedRecord.totalDurationSeconds;
      } else if (attendedRecord.sessions && attendedRecord.sessions.length > 0) {
        userDurationSec = attendedRecord.sessions.reduce(
          (sum, s) => sum + (s.durationSeconds || 0),
          0
        );
      }
      // Fallback for legacy meetings where duration was not logged in sessions
      if (userDurationSec === 0 && m.startedAt && m.endedAt) {
        userDurationSec = Math.max(
          1,
          Math.round((new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000)
        );
      }
    } else if (isHost && m.startedAt && m.endedAt && m.status === "completed") {
      userDurationSec = Math.max(
        1,
        Math.round((new Date(m.endedAt).getTime() - new Date(m.startedAt).getTime()) / 1000)
      );
    }

    // Determine participation status
    let participationStatus = "scheduled";
    const isActuallyConducted = (m.status === "completed" || Boolean(m.endedAt)) && Boolean(m.startedAt);

    if (m.status === "cancelled") {
      participationStatus = "cancelled";
    } else if (m.status === "expired") {
      // If user was invited but meeting expired without anyone joining, it's expired
      participationStatus = "expired";
    } else if (attendedRecord || (isHost && m.startedAt)) {
      participationStatus = isHost ? "hosted" : "present";
    } else if (isActuallyConducted || m.status === "completed") {
      participationStatus = "absent";
    } else if (m.status === "ongoing") {
      participationStatus = attendedRecord ? (isHost ? "hosted" : "present") : "scheduled";
    } else {
      participationStatus = "scheduled";
    }

    // Accumulate metrics
    if (m.status !== "cancelled") {
      totalScheduledForUser++;

      if (participationStatus === "hosted") {
        totalHosted++;
        attendedCount++;
        totalDurationSeconds += userDurationSec;
        pastMeetings.push(m);
      } else if (participationStatus === "present") {
        totalJoined++;
        attendedCount++;
        totalDurationSeconds += userDurationSec;
        pastMeetings.push(m);
      } else if (isActuallyConducted || m.status === "completed") {
        pastMeetings.push(m);
      } else if (m.status === "scheduled") {
        upcomingMeetings.push(m);
      }
    }

    // Format meeting month for grouping and selection
    const meetingDate = new Date(m.startTime || m.scheduledAt || m.createdAt);
    const monthName = meetingDate.toLocaleString("default", { month: "long", year: "numeric" });
    const monthKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, "0")}`;

    detailedMeetingList.push({
      _id: m._id,
      title: m.title,
      description: m.description,
      status: m.status,
      participationStatus, // "present" | "absent" | "hosted" | "cancelled" | "expired" | "scheduled"
      userDurationSeconds: userDurationSec,
      startTime: m.startTime || m.scheduledAt || m.createdAt,
      endTime: m.endTime || m.endedAt,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      isHost,
      isAccessible,
      monthName,
      monthKey,
      host: m.host,
      participants: m.participants,
      workspace: m.workspace,
      project: m.project,
    });
  }

  const attendancePercentage =
    totalScheduledForUser > 0
      ? Math.round((attendedCount / totalScheduledForUser) * 100)
      : 100;

  // Monthly breakdown for charts & summary
  const monthlyStats = {};
  for (const item of detailedMeetingList) {
    if (item.participationStatus !== "present" && item.participationStatus !== "hosted") {
      continue;
    }
    const key = item.monthName;
    if (!monthlyStats[key]) {
      monthlyStats[key] = {
        month: key,
        monthKey: item.monthKey,
        count: 0,
        seconds: 0,
        hours: 0,
      };
    }
    monthlyStats[key].count += 1;
    monthlyStats[key].seconds += item.userDurationSeconds;
    monthlyStats[key].hours = Math.round((monthlyStats[key].seconds / 3600) * 10) / 10;
  }

  return {
    totalMeetingsHosted: totalHosted,
    totalMeetingsJoined: totalJoined,
    totalTimeSpentSeconds: totalDurationSeconds,
    totalTimeSpentMinutes: Math.round(totalDurationSeconds / 60),
    totalTimeSpentHours: Math.round((totalDurationSeconds / 3600) * 10) / 10,
    attendancePercentage,
    sessionsAttended: attendedCount,
    totalSessions: totalScheduledForUser,
    upcomingCount: upcomingMeetings.length,
    pastCount: pastMeetings.length,
    monthlyBreakdown: Object.values(monthlyStats),
    meetings: detailedMeetingList,
  };
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
    fileSize = file.buffer.length;

    // 1. Direct Cloudinary upload when configured (fast with optimized bitrate)
    if (process.env.CLOUDINARY_API_KEY) {
      try {
        const result = await uploadToCloudinary(file.buffer, {
          subfolder: "recording",
          resource_type: "video",
        });
        if (result?.secure_url) {
          finalUrl = result.secure_url;
          console.log(`[MediaStorage] Direct Cloudinary recording upload succeeded: ${finalUrl}`);
        }
      } catch (cErr) {
        console.warn("[MediaStorage] Cloudinary recording upload error, fallback to disk:", cErr.message);
      }
    }

    // 2. Fallback to local disk storage if Cloudinary not available or failed
    if (!finalUrl || !finalUrl.startsWith("http")) {
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
  getUserMeetingAnalytics,
  updateMeeting,
  cancelMeeting,
  deleteMeeting,
  joinMeeting,
  leaveMeeting,
  startMeeting,
  endMeeting,
  hideMeetingFromUser,
  uploadMeetingRecording,
  checkAndExpireScheduledMeetings,
};