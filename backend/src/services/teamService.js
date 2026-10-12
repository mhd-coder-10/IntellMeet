// Team Service
// Handles workspace creation, membership management, invite codes, and permissions

const crypto = require("crypto");
const Team = require("../models/Team");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const notificationService = require("./notificationService");

// Generate unique team invite code (e.g. TM-7K9A2F)
const generateTeamCode = async () => {
  let isUnique = false;
  let code = "";
  while (!isUnique) {
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    code = `TM-${randomHex}`;
    const existing = await Team.findOne({ code });
    if (!existing) isUnique = true;
  }
  return code;
};

// Create a new team workspace
const createTeam = async (userId, data) => {
  const { name, description, color, avatar } = data;
  if (!name || !name.trim()) {
    throw new Error("Team name is required");
  }

  const code = await generateTeamCode();

  const team = await Team.create({
    name: name.trim(),
    description: (description || "").trim(),
    color: color || "indigo",
    avatar: avatar || "",
    owner: userId,
    code,
    members: [
      {
        user: userId,
        role: "owner",
        joinedAt: new Date(),
      },
    ],
  });

  // Automatically create a default "Main Project" board for this team
  await Project.create({
    name: `${team.name} Board`,
    description: "Default Kanban project board",
    team: team._id,
    owner: userId,
    color: team.color || "indigo",
  });

  return await Team.findById(team._id)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
};

// Get all teams for current user (where user is owner or member)
const getUserTeams = async (userId) => {
  const teams = await Team.find({
    $or: [{ owner: userId }, { "members.user": userId }],
  })
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture")
    .sort({ updatedAt: -1 });

  // Attach project and task counts to each team
  const enriched = await Promise.all(
    teams.map(async (t) => {
      const projectCount = await Project.countDocuments({ team: t._id, status: { $ne: "archived" } });
      const taskCount = await Task.countDocuments({ team: t._id });
      const doc = t.toObject();
      doc.projectCount = projectCount;
      doc.taskCount = taskCount;

      const isOwner = t.owner?._id?.toString() === userId.toString();
      const myMembership = t.members.find(
        (m) => (m.user?._id || m.user)?.toString() === userId.toString()
      );
      doc.currentUserStatus = isOwner ? "active" : (myMembership?.status || "active");
      doc.currentUserRole = isOwner ? "owner" : (myMembership?.role || "member");

      return doc;
    })
  );

  return enriched;
};

// Get team details by ID
const getTeamById = async (teamId, userId) => {
  const team = await Team.findById(teamId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");

  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }

  const isOwner = team.owner._id.toString() === userId.toString();
  const userMember = team.members.find((m) => m.user?._id?.toString() === userId.toString());
  const isActiveMember = isOwner || (userMember && (userMember.status === "active" || !userMember.status));

  if (!isActiveMember) {
    if (userMember && userMember.status === "pending") {
      const error = new Error("Your request to join this workspace is pending owner approval");
      error.statusCode = 403;
      throw error;
    }
    if (userMember && userMember.status === "rejected") {
      const error = new Error("Your request to join this workspace was declined by the owner");
      error.statusCode = 403;
      throw error;
    }
    const error = new Error("Access denied: You are not a member of this team");
    error.statusCode = 403;
    throw error;
  }

  const projects = await Project.find({ team: team._id, status: { $ne: "archived" } }).sort({ createdAt: -1 });

  // Enrich projects with task stats
  const enrichedProjects = await Promise.all(
    projects.map(async (p) => {
      const totalTasks = await Task.countDocuments({ project: p._id });
      const doneTasks = await Task.countDocuments({ project: p._id, status: "done" });
      const obj = p.toObject();
      obj.totalTasks = totalTasks;
      obj.doneTasks = doneTasks;
      return obj;
    })
  );

  const teamObj = team.toObject();
  teamObj.projects = enrichedProjects;
  return teamObj;
};

// Update team details
const updateTeam = async (teamId, userId, data) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }

  const userMembership = team.members.find((m) => m.user.toString() === userId.toString());
  const isOwnerOrAdmin =
    team.owner.toString() === userId.toString() ||
    (userMembership && ["owner", "admin"].includes(userMembership.role));

  if (!isOwnerOrAdmin) {
    const error = new Error("Only team owners or admins can update team details");
    error.statusCode = 403;
    throw error;
  }

  if (data.name) team.name = data.name.trim();
  if (data.description !== undefined) team.description = data.description.trim();
  if (data.color) team.color = data.color;
  if (data.avatar !== undefined) team.avatar = data.avatar;

  await team.save();

  // Notify other team members
  try {
    const User = require("../models/User");
    const updater = await User.findById(userId);
    const updaterName = updater?.name || "Team Admin";

    for (const m of team.members) {
      const memberId = m.user ? m.user.toString() : null;
      if (memberId && memberId !== userId.toString()) {
        await notificationService.createNotification({
          recipient: memberId,
          sender: userId,
          type: "team_updated",
          title: "Team Workspace Updated",
          message: `${updaterName} updated workspace "${team.name}"`,
          link: `/teams/${team._id}`,
        });
      }
    }
  } catch (nErr) {
    console.warn("Team update notification error:", nErr.message);
  }

  return await Team.findById(team._id)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
};

// Delete team workspace
const deleteTeam = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }

  if (team.owner.toString() !== userId.toString()) {
    const error = new Error("Only the team owner can delete this workspace");
    error.statusCode = 403;
    throw error;
  }

  // Delete all tasks and projects in this team
  await Task.deleteMany({ team: teamId });
  await Project.deleteMany({ team: teamId });
  await Team.findByIdAndDelete(teamId);

  return { message: "Team workspace deleted successfully" };
};

// Add member by email or username
const addMember = async (teamId, requesterId, { identifier, role = "member" }) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  const requesterMembership = team.members.find((m) => m.user.toString() === requesterId.toString());
  const isOwnerOrAdmin =
    team.owner.toString() === requesterId.toString() ||
    (requesterMembership && ["owner", "admin"].includes(requesterMembership.role));

  if (!isOwnerOrAdmin) {
    const error = new Error("Only team owners or admins can add members");
    error.statusCode = 403;
    throw error;
  }

  const cleanId = (identifier || "").trim().toLowerCase();
  const targetUser = await User.findOne({
    $or: [{ email: cleanId }, { username: cleanId }],
  });

  if (!targetUser) {
    const error = new Error("No user found with that email or username");
    error.statusCode = 404;
    throw error;
  }

  const alreadyMember = team.members.some((m) => m.user.toString() === targetUser._id.toString());
  if (alreadyMember) {
    const error = new Error(`${targetUser.name} is already a member of this team`);
    error.statusCode = 400;
    throw error;
  }

  team.members.push({
    user: targetUser._id,
    role: role || "member",
    joinedAt: new Date(),
  });

  await team.save();

  // Send notification to the added user
  try {
    await notificationService.createNotification({
      recipient: targetUser._id,
      sender: requesterId,
      type: "system",
      title: "Added to Team Workspace",
      message: `You were added to the team "${team.name}"`,
      link: `/teams/${team._id}`,
    });
  } catch (nErr) {
    console.warn("Notification error:", nErr.message);
  }

  return await Team.findById(teamId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
};

// Remove member from team
const removeMember = async (teamId, requesterId, targetUserId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team not found");
    error.statusCode = 404;
    throw error;
  }

  const isSelf = requesterId.toString() === targetUserId.toString();
  const isOwner = team.owner.toString() === requesterId.toString();

  if (!isSelf && !isOwner) {
    const error = new Error("You do not have permission to remove this member");
    error.statusCode = 403;
    throw error;
  }

  if (team.owner.toString() === targetUserId.toString()) {
    const error = new Error("Team owner cannot be removed from workspace");
    error.statusCode = 400;
    throw error;
  }

  team.members = team.members.filter((m) => m.user.toString() !== targetUserId.toString());
  await team.save();

  return await Team.findById(teamId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
};

// Join team using invite code
const joinTeamByCode = async (code, userId) => {
  const cleanCode = (code || "").trim().toUpperCase();
  const team = await Team.findOne({ code: cleanCode });

  if (!team) {
    const error = new Error("Invalid team invite code. Workspace not found.");
    error.statusCode = 404;
    throw error;
  }

  const isOwner = team.owner.toString() === userId.toString();
  if (isOwner) {
    const populated = await Team.findById(team._id)
      .populate("owner", "name username email profilePicture")
      .populate("members.user", "name username email profilePicture");
    const obj = populated.toObject();
    obj.membershipMessage = "You are the owner of this workspace.";
    return obj;
  }

  const existingMember = team.members.find((m) => m.user.toString() === userId.toString());
  if (existingMember) {
    if (existingMember.status === "active") {
      const populated = await Team.findById(team._id)
        .populate("owner", "name username email profilePicture")
        .populate("members.user", "name username email profilePicture");
      const obj = populated.toObject();
      obj.membershipMessage = "You are already an active member of this workspace.";
      return obj;
    }

    if (existingMember.status === "pending") {
      const populated = await Team.findById(team._id)
        .populate("owner", "name username email profilePicture")
        .populate("members.user", "name username email profilePicture");
      const obj = populated.toObject();
      obj.membershipMessage = "Your request to join this workspace is already pending owner approval.";
      return obj;
    }

    if (existingMember.status === "rejected") {
      // Re-apply: update status back to pending
      existingMember.status = "pending";
      existingMember.joinedAt = new Date();
      await team.save();

      try {
        const joiner = await User.findById(userId);
        await notificationService.createNotification({
          recipient: team.owner,
          sender: userId,
          type: "system",
          title: "Team Join Request",
          message: `${joiner?.name || "A user"} requested to join your workspace "${team.name}"`,
          link: `/teams/${team._id}`,
        });
      } catch (nErr) {
        console.warn("Notification error:", nErr.message);
      }

      const populated = await Team.findById(team._id)
        .populate("owner", "name username email profilePicture")
        .populate("members.user", "name username email profilePicture");
      const obj = populated.toObject();
      obj.membershipMessage = "Join request re-submitted. Awaiting owner approval.";
      return obj;
    }
  }

  // New join request: status is pending
  team.members.push({
    user: userId,
    role: "member",
    status: "pending",
    joinedAt: new Date(),
  });

  await team.save();

  // Notify team owner
  try {
    const joiner = await User.findById(userId);
    await notificationService.createNotification({
      recipient: team.owner,
      sender: userId,
      type: "system",
      title: "Team Join Request",
      message: `${joiner?.name || "A user"} requested to join your workspace "${team.name}"`,
      link: `/teams/${team._id}`,
    });
  } catch (nErr) {
    console.warn("Notification error:", nErr.message);
  }

  const populated = await Team.findById(team._id)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
  const obj = populated.toObject();
  obj.membershipMessage = "Join request submitted. Awaiting workspace owner approval.";
  return obj;
};

// Respond to join request (Accept or Reject)
const respondToJoinRequest = async (teamId, ownerId, targetUserId, action) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }

  const isOwner = team.owner.toString() === ownerId.toString();
  const ownerMembership = team.members.find((m) => m.user.toString() === ownerId.toString());
  const isOwnerOrAdmin = isOwner || (ownerMembership && ownerMembership.role === "admin");

  if (!isOwnerOrAdmin) {
    const error = new Error("Only the workspace owner or admin can review join requests");
    error.statusCode = 403;
    throw error;
  }

  const member = team.members.find((m) => m.user.toString() === targetUserId.toString());
  if (!member) {
    const error = new Error("Join request not found for this user");
    error.statusCode = 404;
    throw error;
  }

  if (action === "accept") {
    member.status = "active";
    member.joinedAt = new Date();
    await team.save();

    try {
      await notificationService.createNotification({
        recipient: targetUserId,
        sender: ownerId,
        type: "team_updated",
        title: "Join Request Accepted",
        message: `Your request to join "${team.name}" has been accepted! You can now access all project boards.`,
        link: `/teams/${team._id}`,
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr.message);
    }
  } else if (action === "reject") {
    member.status = "rejected";
    await team.save();

    try {
      await notificationService.createNotification({
        recipient: targetUserId,
        sender: ownerId,
        type: "system",
        title: "Join Request Declined",
        message: `Your request to join workspace "${team.name}" was declined.`,
        link: `/teams`,
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr.message);
    }
  } else {
    const error = new Error("Invalid action. Must be 'accept' or 'reject'");
    error.statusCode = 400;
    throw error;
  }

  return await Team.findById(teamId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
};

// Cancel join request or remove rejected request
const cancelJoinRequest = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }

  team.members = team.members.filter((m) => m.user.toString() !== userId.toString());
  await team.save();

  return { message: "Join request cancelled successfully" };
};

module.exports = {
  createTeam,
  getUserTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  joinTeamByCode,
  respondToJoinRequest,
  cancelJoinRequest,
};
