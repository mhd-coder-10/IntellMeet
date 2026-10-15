// Project Board Service
// Handles project boards and Kanban columns within a team workspace

const Project = require("../models/Project");
const Team = require("../models/Team");
const Task = require("../models/Task");

// Helper to verify team membership
const verifyTeamMembership = async (teamId, userId) => {
  const team = await Team.findById(teamId);
  if (!team) {
    const error = new Error("Team workspace not found");
    error.statusCode = 404;
    throw error;
  }
  const isMember =
    team.owner.toString() === userId.toString() ||
    team.members.some(
      (m) =>
        m.user.toString() === userId.toString() &&
        (m.status === "active" || !m.status)
    );

  if (!isMember) {
    const error = new Error("Access denied: You are not an active member of this team");
    error.statusCode = 403;
    throw error;
  }
  return team;
};

// Create a new project board
const createProject = async (teamId, userId, data) => {
  await verifyTeamMembership(teamId, userId);

  const { name, description, color } = data;
  if (!name || !name.trim()) {
    throw new Error("Project name is required");
  }

  const project = await Project.create({
    name: name.trim(),
    description: (description || "").trim(),
    color: color || "blue",
    team: teamId,
    owner: userId,
  });

  return await Project.findById(project._id).populate("owner", "name username email profilePicture");
};

// Get all projects for a team
const getProjectsByTeam = async (teamId, userId) => {
  await verifyTeamMembership(teamId, userId);

  const projects = await Project.find({ team: teamId, status: { $ne: "archived" } })
    .populate("owner", "name username email profilePicture")
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
    .populate("team", "name code color members owner");

  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  await verifyTeamMembership(project.team._id, userId);

  return project;
};

// Update project
const updateProject = async (projectId, userId, data) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await verifyTeamMembership(project.team, userId);
  const isTeamOwner = team.owner.toString() === userId.toString();
  const isProjOwner = project.owner && project.owner.toString() === userId.toString();
  const isAdmin = team.members.some(
    (m) =>
      m.user.toString() === userId.toString() &&
      ["owner", "admin"].includes(m.role) &&
      (m.status === "active" || !m.status)
  );

  if (!isTeamOwner && !isProjOwner && !isAdmin) {
    const error = new Error("Only the workspace owner, admin, or project creator can edit this board");
    error.statusCode = 403;
    throw error;
  }

  if (data.name) project.name = data.name.trim();
  if (data.description !== undefined) project.description = data.description.trim();
  if (data.color) project.color = data.color;
  if (data.status) project.status = data.status;
  if (data.columns && Array.isArray(data.columns)) project.columns = data.columns;

  await project.save();
  return await Project.findById(projectId).populate("owner", "name username email profilePicture");
};

// Delete project
const deleteProject = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await verifyTeamMembership(project.team, userId);
  const isTeamOwner = team.owner.toString() === userId.toString();
  const isProjOwner = project.owner && project.owner.toString() === userId.toString();
  const isAdmin = team.members.some(
    (m) =>
      m.user.toString() === userId.toString() &&
      ["owner", "admin"].includes(m.role) &&
      (m.status === "active" || !m.status)
  );

  if (!isTeamOwner && !isProjOwner && !isAdmin) {
    const error = new Error("Only the workspace owner, admin, or project creator can delete this board");
    error.statusCode = 403;
    throw error;
  }

  // Cascading delete: delete all tasks within this project board
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

// Get members belonging to or active in a project board (owner + assigned task members + task creators)
const getProjectMembers = async (projectId, userId) => {
  const project = await Project.findById(projectId).populate("owner", "name username email profilePicture");
  if (!project) {
    const error = new Error("Project board not found");
    error.statusCode = 404;
    throw error;
  }

  const team = await Team.findById(project.team)
    .populate("owner", "name username email profilePicture")
    .populate("members.user", "name username email profilePicture");

  if (!team) {
    const error = new Error("Parent workspace not found");
    error.statusCode = 404;
    throw error;
  }

  // Find all task assignees and creators for this project
  const tasks = await Task.find({ project: projectId })
    .populate("assignee", "name username email profilePicture")
    .populate("creator", "name username email profilePicture")
    .select("assignee creator");

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

  for (const t of tasks) {
    if (t.assignee && t.assignee._id) {
      membersMap.set(t.assignee._id.toString(), {
        _id: t.assignee._id,
        name: t.assignee.name,
        username: t.assignee.username,
        email: t.assignee.email,
        profilePicture: t.assignee.profilePicture,
      });
    }
    if (t.creator && t.creator._id) {
      membersMap.set(t.creator._id.toString(), {
        _id: t.creator._id,
        name: t.creator.name,
        username: t.creator.username,
        email: t.creator.email,
        profilePicture: t.creator.profilePicture,
      });
    }
  }

  // Fallback: If project has no tasks or only 1 member, provide all active workspace members so selection never fails
  if (membersMap.size <= 1) {
    if (team.owner) {
      membersMap.set(team.owner._id.toString(), {
        _id: team.owner._id,
        name: team.owner.name,
        username: team.owner.username,
        email: team.owner.email,
        profilePicture: team.owner.profilePicture,
      });
    }
    (team.members || []).forEach((m) => {
      if (m.user && (m.status === "active" || !m.status)) {
        membersMap.set(m.user._id.toString(), {
          _id: m.user._id,
          name: m.user.name,
          username: m.user.username,
          email: m.user.email,
          profilePicture: m.user.profilePicture,
        });
      }
    });
  }

  return Array.from(membersMap.values());
};

module.exports = {
  createProject,
  getProjectsByTeam,
  getProjectById,
  getProjectMembers,
  updateProject,
  deleteProject,
};
