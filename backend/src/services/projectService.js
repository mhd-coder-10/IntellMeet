// Project Board Service
// Handles project boards, Kanban columns, and project member management within a team workspace

const Project = require("../models/Project");
const Team = require("../models/Team");
const Task = require("../models/Task");
const User = require("../models/User");
const notificationService = require("./notificationService");

// Helper: verify user is an active member of the team (returns populated team)
const verifyTeamMembership = async (teamId, userId) => {
  const team = await Team.findById(teamId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");

  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }

  const ownerId = (team.owner?._id || team.owner)?.toString();
  const isMember =
    ownerId === userId.toString() ||
    team.members.some(
      (m) =>
        (m.user?._id || m.user)?.toString() === userId.toString() &&
        (m.status === "active" || !m.status)
    );

  if (!isMember) {
    const error = new Error("Access denied: You are not an active member of this team");
    error.statusCode = 403;
    throw error;
  }
  return team;
};

// Helper: throw 403 if user is not the workspace owner or admin
const requireTeamOwner = (team, userId) => {
  const ownerId = (team.owner?._id || team.owner)?.toString();
  const isAdmin = team.members?.some(
    (m) =>
      (m.user?._id || m.user)?.toString() === userId.toString() &&
      m.role === "admin" &&
      (m.status === "active" || !m.status)
  );

  if (ownerId !== userId.toString() && !isAdmin) {
    const error = new Error("Only the workspace owner or admin can perform this action");
    error.statusCode = 403;
    throw error;
  }
};

// Create a new project board (workspace owner only)
const createProject = async (teamId, userId, data) => {
  const team = await verifyTeamMembership(teamId, userId);
  requireTeamOwner(team, userId);

  const { name, description, color, memberIds } = data;
  if (!name || !name.trim()) {
    throw new Error("Project name is required");
  }

  const allActiveIds = new Set();
  allActiveIds.add(team.owner._id.toString());
  team.members.forEach((m) => {
    if (m.status === "active" || !m.status) allActiveIds.add(m.user._id.toString());
  });

  const validatedMembers = Array.isArray(memberIds)
    ? memberIds.filter((mid) => allActiveIds.has(mid.toString())).map((mid) => ({ user: mid }))
    : [];

  const project = await Project.create({
    name: name.trim(),
    description: (description || "").trim(),
    color: color || "blue",
    team: teamId,
    owner: userId,
    members: validatedMembers,
  });

  // Send notification to members added during project creation
  if (validatedMembers.length > 0) {
    try {
      const actorUser = await User.findById(userId).select("name username");
      for (const m of validatedMembers) {
        const targetId = m.user.toString();
        if (targetId !== userId.toString()) {
          await notificationService.createNotification({
            recipient: targetId,
            sender: userId,
            type: "project_updated",
            title: "Added to Project Board",
            message: `You were added to the project board "${project.name}" in "${team.name}" by ${actorUser?.name || "Workspace Admin"}`,
            link: `/teams/${teamId}/projects/${project._id}`,
          });
        }
      }
    } catch (notifErr) {
      console.warn("Project creation notification error:", notifErr.message);
    }
  }

  return await Project.findById(project._id)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
};

// Get all projects for a team
const getProjectsByTeam = async (teamId, userId) => {
  await verifyTeamMembership(teamId, userId);

  const projects = await Project.find({ team: teamId, status: { $ne: "archived" } })
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture")
    .sort({ createdAt: -1 });

  return await Promise.all(
    projects.map(async (p) => {
      const totalTasks = await Task.countDocuments({ project: p._id });
      const doneTasks = await Task.countDocuments({ project: p._id, status: "done" });
      const obj = p.toObject();
      obj.totalTasks = totalTasks;
      obj.doneTasks = doneTasks;
      return obj;
    })
  );
};

// Get a single project board by ID
const getProjectById = async (projectId, userId) => {
  const project = await Project.findById(projectId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture")
    .populate("team", "name code color members owner");

  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  await verifyTeamMembership(project.team._id, userId);
  return project;
};

// Update project details + members (workspace owner only)
const updateProject = async (projectId, userId, data) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await verifyTeamMembership(project.team, userId);
  requireTeamOwner(team, userId);

  if (data.name) project.name = data.name.trim();
  if (data.description !== undefined) project.description = data.description.trim();
  if (data.color) project.color = data.color;
  if (data.status) project.status = data.status;
  if (data.columns && Array.isArray(data.columns)) project.columns = data.columns;

  let addedMemberIds = [];
  let removedMemberIds = [];

  if (Array.isArray(data.memberIds)) {
    const allActiveIds = new Set();
    const teamOwnerId = (team.owner?._id || team.owner)?.toString();
    if (teamOwnerId) allActiveIds.add(teamOwnerId);
    team.members.forEach((m) => {
      if (m.status === "active" || !m.status) {
        const mid = (m.user?._id || m.user)?.toString();
        if (mid) allActiveIds.add(mid);
      }
    });

    const oldMemberIds = new Set(
      project.members.map((m) => (m.user?._id || m.user)?.toString()).filter(Boolean)
    );
    const newMemberIdList = data.memberIds
      .map((mid) => mid.toString())
      .filter((mid) => allActiveIds.has(mid));

    const newMemberIdsSet = new Set(newMemberIdList);

    addedMemberIds = newMemberIdList.filter(
      (mid) => !oldMemberIds.has(mid) && mid !== userId.toString()
    );
    removedMemberIds = Array.from(oldMemberIds).filter(
      (mid) => !newMemberIdsSet.has(mid) && mid !== userId.toString()
    );

    project.members = newMemberIdList.map((mid) => ({ user: mid }));
  }

  await project.save();

  // Send notifications for members added or removed during update
  if (addedMemberIds.length > 0 || removedMemberIds.length > 0) {
    try {
      const actorUser = await User.findById(userId).select("name username");
      for (const targetId of addedMemberIds) {
        await notificationService.createNotification({
          recipient: targetId,
          sender: userId,
          type: "project_updated",
          title: "Added to Project Board",
          message: `You were added to the project board "${project.name}" in "${team.name}" by ${actorUser?.name || "Workspace Admin"}`,
          link: `/teams/${team._id}/projects/${project._id}`,
        });
      }
      for (const targetId of removedMemberIds) {
        await notificationService.createNotification({
          recipient: targetId,
          sender: userId,
          type: "project_updated",
          title: "Removed from Project Board",
          message: `You were removed from the project board "${project.name}" in "${team.name}" by ${actorUser?.name || "Workspace Admin"}`,
          link: `/teams/${team._id}`,
        });
      }
    } catch (notifErr) {
      console.warn("Project member update notification error:", notifErr.message);
    }
  }

  return await Project.findById(projectId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");
};

// Delete project (workspace owner only) with cascade task cleanup
const deleteProject = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await verifyTeamMembership(project.team, userId);
  requireTeamOwner(team, userId);

  const teamId = project.team;

  try {
    const tasksWithActionItems = await Task.find({
      project: projectId,
      actionItemId: { $ne: null },
    }).select("actionItemId");

    if (tasksWithActionItems.length > 0) {
      const ActionItem = require("../models/ActionItem");
      const itemIds = tasksWithActionItems.map((t) => t.actionItemId);
      await ActionItem.updateMany(
        { _id: { $in: itemIds } },
        {
          isConverted: false,
          convertedTask: null,
          convertedProject: null,
          convertedTeam: null,
          convertedAt: null,
          isWorkspaceTaskDeleted: true,
        }
      );
    }
  } catch (syncErr) {
    console.warn("Failed to reset action items during project deletion:", syncErr.message);
  }

  await Task.deleteMany({ project: projectId });
  await Project.findByIdAndDelete(projectId);

  return { message: "Project board and all associated tasks deleted successfully", teamId };
};

// Add a member to a project (workspace owner or admin)
const addProjectMember = async (projectId, userId, targetUserId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await verifyTeamMembership(project.team, userId);
  requireTeamOwner(team, userId);

  const teamOwnerId = (team.owner?._id || team.owner)?.toString();
  const isWorkspaceMember =
    teamOwnerId === targetUserId.toString() ||
    team.members.some(
      (m) =>
        (m.user?._id || m.user)?.toString() === targetUserId.toString() &&
        (m.status === "active" || !m.status)
    );

  if (!isWorkspaceMember) {
    const error = new Error("Target user is not an active member of this workspace");
    error.statusCode = 400;
    throw error;
  }

  const projectOwnerId = (project.owner?._id || project.owner)?.toString();
  if (projectOwnerId === targetUserId.toString()) {
    const error = new Error("User is already the owner of this project");
    error.statusCode = 400;
    throw error;
  }

  const alreadyMember = project.members.some(
    (m) => (m.user?._id || m.user)?.toString() === targetUserId.toString()
  );
  if (alreadyMember) {
    const error = new Error("User is already a member of this project");
    error.statusCode = 400;
    throw error;
  }

  project.members.push({ user: targetUserId });
  await project.save();

  // Send real-time notification to the added member
  try {
    const actorUser = await User.findById(userId).select("name username");
    await notificationService.createNotification({
      recipient: targetUserId,
      sender: userId,
      type: "project_updated",
      title: "Added to Project Board",
      message: `You were added to the project board "${project.name}" in "${team.name}" by ${actorUser?.name || "Workspace Admin"}`,
      link: `/teams/${team._id}/projects/${project._id}`,
    });
  } catch (notifErr) {
    console.warn("Project member added notification error:", notifErr.message);
  }

  return await Project.findById(projectId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture")
    .populate("team", "name code color members owner");
};

// Remove a member from a project (workspace owner or admin)
const removeProjectMember = async (projectId, userId, targetUserId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await verifyTeamMembership(project.team, userId);
  requireTeamOwner(team, userId);

  const projectOwnerId = (project.owner?._id || project.owner)?.toString();
  if (projectOwnerId === targetUserId.toString()) {
    const error = new Error("Cannot remove the project owner from the project");
    error.statusCode = 400;
    throw error;
  }

  const before = project.members.length;
  project.members = project.members.filter(
      (m) => (m.user?._id || m.user)?.toString() !== targetUserId.toString()
  );

if (project.members.length === before) {
  const error = new Error("User is not a member of this project");
  error.statusCode = 400;
  throw error;
}

await project.save();

// Send real-time notification to the removed member
try {
  const actorUser = await User.findById(userId).select("name username");
  await notificationService.createNotification({
    recipient: targetUserId,
    sender: userId,
    type: "project_updated",
    title: "Removed from Project Board",
    message: `You were removed from the project board "${project.name}" in "${team.name}" by ${actorUser?.name || "Workspace Admin"}`,
    link: `/teams/${team._id}`,
  });
} catch (notifErr) {
  console.warn("Project member removed notification error:", notifErr.message);
}

return await Project.findById(projectId)
  .populate("owner", "name username email profilePicture")
  .populate("members.user", "name username email profilePicture")
    .populate("team", "name code color members owner");
};

// Get members explicitly assigned to a project
const getProjectMembers = async (projectId, userId) => {
  const project = await Project.findById(projectId)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");

  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  await verifyTeamMembership(project.team, userId);

  const membersMap = new Map();

  if (project.owner) {
    membersMap.set(project.owner._id.toString(), {
      _id: project.owner._id,
      name: project.owner.name,
      username: project.owner.username,
      email: project.owner.email,
      profilePicture: project.owner.profilePicture,
    });
  }

  for (const m of project.members) {
    if (m.user && m.user._id) {
      membersMap.set(m.user._id.toString(), {
        _id: m.user._id,
        name: m.user.name,
        username: m.user.username,
        email: m.user.email,
        profilePicture: m.user.profilePicture,
      });
    }
  }

  return Array.from(membersMap.values());
};

module.exports = {
  createProject,
  getProjectsByTeam,
  getProjectById,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProject,
  deleteProject,
};