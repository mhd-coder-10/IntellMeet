
// Handles meeting room events like join, leave and media state
// Also handles screen sharing and recording broadcasts

const roomManager = require("../webrtc/roomManager");
const notificationService = require("../services/notificationService");

const registerMeetingHandlers = (io, socket) => {

  // Handle user joining a meeting
  socket.on("meeting:join", async ({ meetingId }) => {
    if (!meetingId) return;

    try {
      const meetingRepo = require("../repositories/meetingRepository");
      const meeting = await meetingRepo.findById(meetingId);

      if (!meeting) {
        socket.emit("meeting:error", { message: "Meeting not found" });
        return;
      }

      if (meeting.status === "completed" || meeting.status === "cancelled") {
        socket.emit("meeting:error", {
          message: "This meeting is no longer active",
        });
        return;
      }

      socket.join(meetingId);
      socket.meetingId = meetingId;

      const userInfo = {
        name: socket.user.name,
        username: socket.user.username,
        profilePicture: socket.user.profilePicture,
      };

      roomManager.addUserToRoom(meetingId, socket.user.id, socket.id, userInfo);

      const isHost = meeting.host.toString() === socket.user.id;
      const alreadyParticipant = meeting.participants.some(
        (p) => p.toString() === socket.user.id
      );

      if (!isHost && !alreadyParticipant) {
        await meetingRepo.addParticipant(meetingId, socket.user.id);
      }

      const users = roomManager.getRoomUsers(meetingId);

      io.to(meetingId).emit("meeting:user-joined", {
        userId: socket.user.id,
        username: socket.user.username,
        name: socket.user.name,
        profilePicture: socket.user.profilePicture,
        totalUsers: users.length,
      });

      const recordingUserId = roomManager.getRecordingUser(meetingId);
      socket.emit("meeting:joined", {
        meetingId,
        screenSharingUserId: roomManager.getScreenSharingUser(meetingId),
        recordingUserId,
        isRecording: !!recordingUserId,
        users: users.map((u) => ({
          userId: u.userId,
          name: u.name,
          username: u.username,
          profilePicture: u.profilePicture,
          isMuted: u.isMuted,
          isVideoOn: u.isVideoOn,
        })),
      });

      if (!isHost) {
        try {
          await notificationService.createNotification({
            recipient: meeting.host,
            sender: socket.user.id,
            type: "system",
            title: "Participant Joined",
            message: `${socket.user.name} joined your meeting "${meeting.title}"`,
            link: `/meetings/${meetingId}`,
          });
        } catch (err) {
          console.log("Notification error:", err.message);
        }
      }
    } catch (err) {
      console.log("Meeting join error:", err.message);
      socket.emit("meeting:error", { message: "Failed to join meeting" });
    }
  });

  // Handle user leaving a meeting
  socket.on("meeting:leave", async ({ meetingId }) => {
    if (!meetingId) return;

    try {
      const meetingRepo = require("../repositories/meetingRepository");
      const meeting = await meetingRepo.findById(meetingId);

      if (meeting && meeting.host.toString() !== socket.user.id) {
        await meetingRepo.removeParticipant(meetingId, socket.user.id);

        try {
          await notificationService.createNotification({
            recipient: meeting.host,
            sender: socket.user.id,
            type: "system",
            title: "Participant Left",
            message: `${socket.user.name} left your meeting "${meeting.title}"`,
            link: `/meetings/${meetingId}`,
          });
        } catch (err) {
          console.log("Leave notification error:", err.message);
        }
      }

      socket.leave(meetingId);
      roomManager.removeUserFromRoom(meetingId, socket.user.id);
      socket.meetingId = null;

      io.to(meetingId).emit("meeting:user-left", {
        userId: socket.user.id,
        name: socket.user.name,
        username: socket.user.username,
      });
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

    if (updated) {
      io.to(meetingId).emit("meeting:media-state-changed", {
        userId: socket.user.id,
        isMuted: updated.isMuted,
        isVideoOn: updated.isVideoOn,
      });
    }
  });

  // Broadcast screen share start to other participants
  socket.on("meeting:screen-share-started", ({ meetingId }) => {
    if (!meetingId) return;
    roomManager.setScreenSharingUser(meetingId, socket.user.id);

    socket.to(meetingId).emit("meeting:screen-share-started", {
      userId: socket.user.id,
      username: socket.user.username,
      name: socket.user.name,
    });
  });

  // Broadcast screen share stop to other participants
  socket.on("meeting:screen-share-stopped", ({ meetingId }) => {
    if (!meetingId) return;
    roomManager.clearScreenSharingUser(meetingId);

    socket.to(meetingId).emit("meeting:screen-share-stopped", {
      userId: socket.user.id,
    });
  });

  // Broadcast recording start to participants
  socket.on("meeting:recording-started", ({ meetingId }) => {
    if (!meetingId) return;
    roomManager.setRecordingUser(meetingId, socket.user.id);

    socket.to(meetingId).emit("meeting:recording-started", {
      userId: socket.user.id,
      name: socket.user.name,
    });
  });

  // Broadcast recording stop to participants
  socket.on("meeting:recording-stopped", ({ meetingId }) => {
    if (!meetingId) return;
    roomManager.clearRecordingUser(meetingId);
    
    socket.to(meetingId).emit("meeting:recording-stopped", {
      userId: socket.user.id,
    });
  });

  // Meeting disconnect handler to clean up DB and notify host
  socket.on("disconnect", async () => {
    const meetingId = socket.meetingId;

    if (meetingId) {
      try {
        const meetingRepo = require("../repositories/meetingRepository");
        const meeting = await meetingRepo.findById(meetingId);

        if (meeting && meeting.host.toString() !== socket.user.id) {
          await meetingRepo.removeParticipant(meetingId, socket.user.id);

          try {
            await notificationService.createNotification({
              recipient: meeting.host,
              sender: socket.user.id,
              type: "system",
              title: "Participant Left",
              message: `${socket.user.name} left your meeting "${meeting.title}"`,
              link: `/meetings/${meetingId}`,
            });
          } catch (err) {
            console.log("Disconnect notification error:", err.message);
          }
        }
      } catch (err) {
        console.log("Disconnect cleanup error:", err.message);
      }

      roomManager.removeUserFromRoom(meetingId, socket.user.id);

      io.to(meetingId).emit("meeting:user-left", {
        userId: socket.user.id,
        name: socket.user.name,
        username: socket.user.username,
      });
    }
  });
};

module.exports = { registerMeetingHandlers };