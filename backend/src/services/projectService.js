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
  await Task.deleteMany({ project: projectId });
  await Project.findByIdAndDelete(projectId);

  return { message: "Project board and all associated tasks deleted successfully", teamId };
};

module.exports = {
  createProject,
  getProjectsByTeam,
  getProjectById,
  updateProject,
  deleteProject,
};
