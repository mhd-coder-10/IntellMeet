
// Handles meeting room events like join, leave and media state
// Also handles screen sharing and recording broadcasts

const roomManager = require("../webrtc/roomManager");
// Disconnect grace timers: `${meetingId}:${userId}` -> NodeJS.Timeout to prevent transient mobile disconnect flap
const disconnectGraceTimers = new Map();
const notificationService = require("../services/notificationService");
const { deleteCacheByPattern } = require("../utils/redisHelpers");

const clearMeetingCaches = async (meetingId, hostId) => {
  try {
    await deleteCacheByPattern(`meeting:${meetingId}*`);
    const hostStr = (hostId?._id || hostId)?.toString();
    if (hostStr) {
      await deleteCacheByPattern(`user:${hostStr}:meetings`);
    }
    await deleteCacheByPattern("user:*:meetings");
  } catch (err) {
    console.error("Cache clear error in socket:", err.message);
  }
};

// Grace period timers for empty rooms: meetingId -> NodeJS.Timeout
const emptyRoomGraceTimers = new Map();
const EMPTY_ROOM_GRACE_DURATION_MS = 5 * 60 * 1000; // 5 minutes grace period

const cancelEmptyRoomGraceTimer = (meetingId) => {
  const mIdStr = meetingId?.toString();
  if (mIdStr && emptyRoomGraceTimers.has(mIdStr)) {
    clearTimeout(emptyRoomGraceTimers.get(mIdStr));
    emptyRoomGraceTimers.delete(mIdStr);
    console.log(`[Meeting Grace] Cancelled empty room grace timer for meeting ${mIdStr} (user rejoined or ended).`);
    return true;
  }
  return false;
};

const scheduleEmptyRoomCompletion = (io, meetingId, userId) => {
  const mIdStr = meetingId?.toString();
  if (!mIdStr) return;

  // If a grace timer is already running for this meeting, do not duplicate
  if (emptyRoomGraceTimers.has(mIdStr)) {
    return;
  }

  console.log(`[Meeting Grace] Room ${mIdStr} is empty. Starting 5-minute grace period before completing...`);

  const timer = setTimeout(async () => {
    emptyRoomGraceTimers.delete(mIdStr);
    try {
      // Re-verify room users: if anyone rejoined during the 5 minutes, abort
      const currentUsers = roomManager.getRoomUsers(mIdStr);
      if (currentUsers && currentUsers.length > 0) {
        console.log(`[Meeting Grace] Room ${mIdStr} has active users (${currentUsers.length}). Aborting auto-completion.`);
        return;
      }

      const meetingRepo = require("../repositories/meetingRepository");
      const meeting = await meetingRepo.findById(mIdStr);

      if (meeting && meeting.status === "ongoing") {
        const hostId = (meeting.host?._id || meeting.host)?.toString();
        const now = new Date();

        const updateData = {
          status: "completed",
          endedAt: now,
          startedAt: meeting.startedAt || now,
        };

        await meetingRepo.updateById(mIdStr, updateData);
        const userRepo = require("../repositories/userRepository");
        await userRepo.closeMeetingSessions(mIdStr, now);

        console.log(`[Meeting Grace] Meeting ${mIdStr} auto-completed after 5 minutes empty room.`);

        io.to(mIdStr).emit("meeting:ended", {
          meetingId: mIdStr,
          message: "Meeting has ended (all participants left and grace period expired)",
        });
        io.to(mIdStr).emit("meeting:updated", {
          meetingId: mIdStr,
          status: "completed",
        });
        io.emit("meeting:updated", {
          meetingId: mIdStr,
          status: "completed",
        });
        io.emit("meeting:ended", {
          meetingId: mIdStr,
        });

        io.in(mIdStr).socketsLeave(mIdStr);
        roomManager.clearRoom(mIdStr);
      }
    } catch (err) {
      console.error("[Meeting Grace] Auto-complete error:", err.message);
    }
  }, EMPTY_ROOM_GRACE_DURATION_MS);

  emptyRoomGraceTimers.set(mIdStr, timer);
};

const registerMeetingHandlers = (io, socket) => {

  // Subscribe to meeting updates (for Details page & cards, without joining the live call room)
  socket.on("meeting:subscribe", ({ meetingId }) => {
    if (meetingId) {
      socket.join(meetingId);
    }
  });

  socket.on("meeting:unsubscribe", ({ meetingId }) => {
    if (meetingId) {
      socket.leave(meetingId);
    }
  });

  // Handle user joining an active WebRTC meeting call room
  socket.on("meeting:join", async ({ meetingId }) => {
    if (!meetingId) return;

    try {
      const meetingRepo = require("../repositories/meetingRepository");
      const meeting = await meetingRepo.findById(meetingId);

      if (!meeting) {
        socket.emit("meeting:error", { message: "Meeting not found" });
        return;
      }

      if (meeting.status === "completed" || meeting.status === "cancelled" || meeting.status === "expired") {
        socket.emit("meeting:error", {
          message: meeting.status === "expired"
            ? "This meeting has expired and is no longer available"
            : "This meeting is no longer active",
        });
        return;
      }

      socket.join(meetingId);
      const graceKey = `${meetingId}:${socket.user.id.toString()}`;
        const wasInGrace = disconnectGraceTimers.has(graceKey);
        if (wasInGrace) {
          clearTimeout(disconnectGraceTimers.get(graceKey));
          disconnectGraceTimers.delete(graceKey);
        }
        const wasAlreadyInRoom = roomManager.isUserInRoom(meetingId, socket.user.id);
        socket.meetingId = meetingId;

        // Cancel empty room grace timer if participant or host joins/rejoins
        cancelEmptyRoomGraceTimer(meetingId);

        const userInfo = {
          name: socket.user.name,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture,
        };

        roomManager.addUserToRoom(meetingId, socket.user.id, socket.id, userInfo);

        const hostId = (meeting.host?._id || meeting.host)?.toString();
        const isHost = hostId === socket.user.id.toString();

        if (isHost && !meeting.startedAt) {
          const now = new Date();
          await meetingRepo.updateById(meetingId, {
            startedAt: now,
            status: "ongoing",
          });
          await clearMeetingCaches(meetingId, socket.user.id);
          meeting.startedAt = now;
          meeting.status = "ongoing";
        }

        const alreadyParticipant = (meeting.participants || []).some(
          (p) => (p?._id || p)?.toString() === socket.user.id.toString()
        );

        if (!isHost && !alreadyParticipant) {
          await meetingRepo.addParticipant(meetingId, socket.user.id);
        }

        // Record join session for user attendance tracking (host & participants, including rejoins)
        try {
          const userRepo = require("../repositories/userRepository");
          await userRepo.recordMeetingJoin(socket.user.id, meetingId);
        } catch (uErr) {
          console.warn("User attendance record error:", uErr.message);
        }

        const users = roomManager.getRoomUsers(meetingId);

        // Only emit meeting:user-joined if this is genuinely a fresh join, NOT a reconnect or tab-switch
        if (!wasAlreadyInRoom && !wasInGrace) {
          io.to(meetingId).emit("meeting:user-joined", {
            userId: socket.user.id,
            username: socket.user.username,
            name: socket.user.name,
            profilePicture: socket.user.profilePicture,
            isMuted: false,
            isVideoOn: true,
            totalUsers: users.length,
          });
        }

        const recordingUserId = roomManager.getRecordingUser(meetingId);
        const recordingStartedAt = roomManager.getRecordingStartedAt(meetingId);
        const isRecordingActive = Boolean(recordingStartedAt);
        const pausedState = roomManager.getRecordingPausedState(meetingId);

        // Server calculates elapsed seconds using server clock as single authoritative source
        const serverElapsedSeconds =
          isRecordingActive && recordingStartedAt
            ? Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000))
            : 0;

        socket.emit("meeting:joined", {
          meetingId,
          screenSharingUserId: roomManager.getScreenSharingUser(meetingId),
          recordingUserId,
          isRecording: isRecordingActive,
          recordingStartedAt,
          recordingElapsedSeconds: serverElapsedSeconds,
          isRecordingPaused: pausedState.isPaused,
          recordingPausedSeconds: pausedState.currentSeconds,
          users: users.map((u) => ({
            userId: u.userId,
            name: u.name,
            username: u.username,
            profilePicture: u.profilePicture,
            isMuted: u.isMuted,
            isVideoOn: u.isVideoOn,
          })),
        });

        // Instantly push recording status to joining participant so REC badge appears immediately without refresh
        if (isRecordingActive) {
          socket.emit("meeting:recording-started", {
            meetingId,
            userId: recordingUserId,
            name: "Host",
            startedAt: recordingStartedAt,
            elapsedSeconds: serverElapsedSeconds,
            isSilent: true,
          });
          if (pausedState.isPaused) {
            socket.emit("meeting:recording-paused", {
              userId: recordingUserId,
              currentSeconds: pausedState.currentSeconds,
            });
          }
        }

        // Meeting room socket broadcast handles in-meeting participant presence
      } catch (err) {
        console.log("Meeting join error:", err.message);
        socket.emit("meeting:error", { message: "Failed to join meeting" });
      }
    });

  // Handle user leaving a meeting
  socket.on("meeting:leave", async ({ meetingId }) => {
    if (!meetingId) return;
    const graceKey = `${meetingId}:${socket.user.id.toString()}`;
    if (disconnectGraceTimers.has(graceKey)) {
      clearTimeout(disconnectGraceTimers.get(graceKey));
      disconnectGraceTimers.delete(graceKey);
    }

    try {
      const meetingRepo = require("../repositories/meetingRepository");
      const meeting = await meetingRepo.findById(meetingId);

      try {
        const userRepo = require("../repositories/userRepository");
        await userRepo.recordMeetingLeave(socket.user.id, meetingId);
    } catch (err) { }

    socket.leave(meetingId);
    const leaveResult = roomManager.removeUserFromRoom(meetingId, socket.user.id);
    socket.meetingId = null;

    if (leaveResult?.wasScreenSharing) {
      io.to(meetingId).emit("meeting:screen-share-stopped", {
        userId: socket.user.id,
      });
    }

    if (leaveResult?.wasRecording) {
      socket.to(meetingId).emit("meeting:recording-stopped", {
        userId: socket.user.id,
      });
    }

    io.to(meetingId).emit("meeting:user-left", {
      userId: socket.user.id,
      name: socket.user.name,
      username: socket.user.username,
    });

    // If room is now empty (all participants left), start 5-min grace period before completing
    if (leaveResult?.remainingCount === 0) {
      scheduleEmptyRoomCompletion(io, meetingId, socket.user.id);
    }
  } catch (err) {
    console.log("Meeting leave error:", err.message);
  }
});

// Handle media state changes (mute/unmute, video on/off)
socket.on("meeting:media-state", ({ meetingId, isMuted, isVideoOn }) => {
  if (!meetingId) return;

  const updated = roomManager.updateUserMediaState(meetingId, socket.user.id, {
    isMuted,
    isVideoOn,
  });

  io.to(meetingId).emit("meeting:media-state-changed", {
    userId: socket.user.id,
    isMuted: typeof isMuted === "boolean" ? isMuted : (updated?.isMuted ?? false),
    isVideoOn: typeof isVideoOn === "boolean" ? isVideoOn : (updated?.isVideoOn ?? true),
  });
});

// Broadcast screen share start to all participants in meeting room
socket.on("meeting:screen-share-started", ({ meetingId }) => {
  if (!meetingId) return;
  roomManager.setScreenSharingUser(meetingId, socket.user.id);

  io.to(meetingId).emit("meeting:screen-share-started", {
    userId: socket.user.id,
    username: socket.user.username,
    name: socket.user.name,
  });
});

// Broadcast screen share stop to all participants in meeting room
socket.on("meeting:screen-share-stopped", ({ meetingId }) => {
  if (!meetingId) return;
  roomManager.clearScreenSharingUser(meetingId);

  io.to(meetingId).emit("meeting:screen-share-stopped", {
    userId: socket.user.id,
  });
});

// Broadcast recording start to participants
socket.on("meeting:recording-started", ({ meetingId, startedAt }) => {
  if (!meetingId) return;
  const startTime = Number(startedAt) || Date.now();
  roomManager.setRecordingUser(meetingId, socket.user.id, startTime);

  socket.to(meetingId).emit("meeting:recording-started", {
    userId: socket.user.id,
    name: socket.user.name,
    startedAt: startTime,
  });
});

// Broadcast recording stop to participants
  socket.on("meeting:recording-stopped", async ({ meetingId }) => {
    if (!meetingId) return;

    const currentRecordingUser = roomManager.getRecordingUser(meetingId);
    const isHost = await isHostUser(meetingId, socket.user.id);
    const isRecorder = currentRecordingUser && currentRecordingUser.toString() === socket.user.id.toString();

    // ONLY the user who started the recording or the meeting host is allowed to stop recording!
    if (!isHost && !isRecorder) {
      console.log(`[Meeting Recording] Ignored unauthorized recording-stopped from ${socket.user.id}`);
      return;
    }

    roomManager.clearRecordingUser(meetingId);

    socket.to(meetingId).emit("meeting:recording-stopped", {
      userId: socket.user.id,
    });
  });

  // Broadcast recording pause to all participants in room
  socket.on("meeting:recording-paused", ({ meetingId, currentSeconds }) => {
    if (!meetingId) return;
    roomManager.setRecordingPaused(meetingId, true, currentSeconds);
    socket.to(meetingId).emit("meeting:recording-paused", {
      userId: socket.user.id,
      currentSeconds: currentSeconds || 0,
    });
  });

  // Broadcast recording resume to all participants in room
  socket.on("meeting:recording-resumed", ({ meetingId }) => {
    if (!meetingId) return;
    roomManager.setRecordingPaused(meetingId, false, 0);
    socket.to(meetingId).emit("meeting:recording-resumed", {
      userId: socket.user.id,
    });
  });

  // Relay periodic recording timer synchronization to all participants in room
  socket.on("meeting:recording-sync", ({ meetingId, currentSeconds }) => {
    if (!meetingId || typeof currentSeconds !== "number") return;
    socket.to(meetingId).emit("meeting:recording-sync", {
      currentSeconds,
    });
  });

  // Helper to verify if the requester is the meeting host
  const isHostUser = async (meetingId, userId) => {
    try {
      const meetingRepo = require("../repositories/meetingRepository");
      const meeting = await meetingRepo.findById(meetingId);
      if (!meeting) return false;
      const hostId = (meeting.host?._id || meeting.host)?.toString();
      return hostId === userId.toString();
    } catch (err) {
      console.error("Host verification error:", err.message);
      return false;
    }
  };

  // Host mutes an individual participant
  socket.on("meeting:mute-participant", async ({ meetingId, targetUserId }) => {
    if (!meetingId || !targetUserId) return;

    try {
      const isHost = await isHostUser(meetingId, socket.user.id);
      if (!isHost) {
        socket.emit("meeting:error", {
          message: "Only the meeting host can mute participants",
        });
        return;
      }

      const room = roomManager.getRoom(meetingId);
      if (!room) return;

      const targetIdStr = targetUserId.toString();
      const targetUser = room.users.get(targetIdStr);
      if (!targetUser) return;

      // Update media state in room manager
      roomManager.updateUserMediaState(meetingId, targetIdStr, { isMuted: true });

      // Notify target user to actually mute local audio track
      io.to(targetUser.socketId).emit("meeting:force-mute", {
        meetingId,
        mutedBy: socket.user.name || "Host",
      });

      // Broadcast updated media state to everyone in the room
      io.to(meetingId).emit("meeting:media-state-changed", {
        userId: targetIdStr,
        isMuted: true,
        isVideoOn: targetUser.isVideoOn,
      });
    } catch (err) {
      console.error("Mute participant error:", err.message);
    }
  });

  // Host mutes all non-host participants in the room
  socket.on("meeting:mute-all", async ({ meetingId }) => {
    if (!meetingId) return;

    try {
      const isHost = await isHostUser(meetingId, socket.user.id);
      if (!isHost) {
        socket.emit("meeting:error", {
          message: "Only the meeting host can mute all participants",
        });
        return;
      }

      const room = roomManager.getRoom(meetingId);
      if (!room) return;

      const hostIdStr = socket.user.id.toString();

      room.users.forEach((user, uId) => {
        if (uId !== hostIdStr) {
          // Update in room manager
          roomManager.updateUserMediaState(meetingId, uId, { isMuted: true });

          // Direct force mute to user socket
          io.to(user.socketId).emit("meeting:force-mute", {
            meetingId,
            mutedBy: socket.user.name || "Host",
            isMuteAll: true,
          });

          // Broadcast state change to room
          io.to(meetingId).emit("meeting:media-state-changed", {
            userId: uId,
            isMuted: true,
            isVideoOn: user.isVideoOn,
          });
        }
      });

      // Also broadcast room-wide event for confirmation
      socket.to(meetingId).emit("meeting:force-mute-all", {
        meetingId,
        mutedBy: socket.user.name || "Host",
      });
    } catch (err) {
      console.error("Mute all error:", err.message);
    }
  });

  // Handle host ending meeting via socket
  socket.on("meeting:end", async ({ meetingId }) => {
    if (!meetingId) return;
      const mIdStr = meetingId.toString();
      cancelEmptyRoomGraceTimer(mIdStr);

    try {
        const meetingRepo = require("../repositories/meetingRepository");
        const meeting = await meetingRepo.findById(mIdStr);
        if(meeting && meeting.status === "ongoing") {
      const now = new Date();
      await meetingRepo.updateById(mIdStr, {
        status: "completed",
        endedAt: now,
        startedAt: meeting.startedAt || now,
      });
      const userRepo = require("../repositories/userRepository");
      await userRepo.closeMeetingSessions(mIdStr, now);
      await clearMeetingCaches(mIdStr, socket.user.id);
    }
  } catch (err) {
    console.error("[Meeting End] DB update error:", err.message);
  }

  io.to(mIdStr).emit("meeting:ended", {
    meetingId: mIdStr,
    message: "Meeting has been ended by the host",
  });
  io.emit("meeting:ended", {
    meetingId: mIdStr,
    message: "Meeting has been ended by the host",
  });
  io.to(mIdStr).emit("meeting:updated", {
    meetingId: mIdStr,
    status: "completed",
  });
  io.emit("meeting:updated", {
    meetingId: mIdStr,
    status: "completed",
  });

  roomManager.clearRoom(mIdStr);
  setTimeout(() => {
    io.in(mIdStr).socketsLeave(mIdStr);
  }, 1000);
});

// Meeting disconnect handler to clean up DB and notify host
// Grace period is 30s (increased from 15s) so long meetings survive brief network hiccups.
// Before emitting user-left we also check roomManager to confirm the user is truly gone
// (i.e. did NOT reconnect via a new socket and re-emit meeting:join during the grace window).
socket.on("disconnect", async () => {
  const meetingId = socket.meetingId;
  const userId = socket.user?.id ? socket.user.id.toString() : null;

  if (meetingId && userId) {
    const graceKey = `${meetingId}:${userId}`;
    if (disconnectGraceTimers.has(graceKey)) {
      clearTimeout(disconnectGraceTimers.get(graceKey));
      disconnectGraceTimers.delete(graceKey);
    }

    const timer = setTimeout(async () => {
      disconnectGraceTimers.delete(graceKey);

      // If the user reconnected during the grace window, meeting:join would have
      // called addUserToRoom again — so they are still in the room. Skip the leave.
      const stillInRoom = roomManager.isUserInRoom(meetingId, userId);
      if (stillInRoom) {
        console.log(`[Meeting Disconnect] User ${userId} reconnected to room ${meetingId} during grace window — skipping leave.`);
        return;
      }

      try {
        const userRepo = require("../repositories/userRepository");
        await userRepo.recordMeetingLeave(userId, meetingId);
    } catch (err) { }

    const disconnectResult = roomManager.removeUserFromRoom(meetingId, userId);

    if (disconnectResult?.wasScreenSharing) {
      io.to(meetingId).emit("meeting:screen-share-stopped", {
        userId,
      });
    }

    if (disconnectResult?.wasRecording) {
      socket.to(meetingId).emit("meeting:recording-stopped", {
        userId,
      });
    }

    io.to(meetingId).emit("meeting:user-left", {
      userId,
      name: socket.user.name,
      username: socket.user.username,
    });

    // If room is now empty (all participants left), start 5-min grace period before completing
    if (disconnectResult?.remainingCount === 0) {
      scheduleEmptyRoomCompletion(io, meetingId, userId);
    }
      }, 30000);

disconnectGraceTimers.set(graceKey, timer);
    }
  });
};

module.exports = { registerMeetingHandlers, cancelEmptyRoomGraceTimer };
