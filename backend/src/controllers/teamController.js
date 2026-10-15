// Team Controller
// Handles HTTP endpoints for workspace creation, team listings, invites, and members

const teamService = require("../services/teamService");

// Create a new team workspace
const createTeam = async (req, res) => {
  try {
    const team = await teamService.createTeam(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: "Team workspace created successfully",
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to create team workspace",
    });
  }
};

// Get current user's team workspaces
const getUserTeams = async (req, res) => {
  try {
    const teams = await teamService.getUserTeams(req.user.id);
    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch team workspaces",
    });
  }
};

// Get team workspace by ID
const getTeamById = async (req, res) => {
  try {
    const team = await teamService.getTeamById(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch team workspace",
    });
  }
};

// Update team details
const updateTeam = async (req, res) => {
  try {
    const team = await teamService.updateTeam(req.params.id, req.user.id, req.body);
    const io = req.app.get("io");
    if (io) {
      io.to(`team:${req.params.id}`).emit("team:updated", team);
      io.emit("team:updated", team);
    }
    res.status(200).json({
      success: true,
      message: "Team workspace updated successfully",
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to update team workspace",
    });
  }
};

// Delete team workspace
const deleteTeam = async (req, res) => {
  try {
    const result = await teamService.deleteTeam(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to delete team workspace",
    });
  }
};

// Add member by email or username
const addMember = async (req, res) => {
  try {
    const team = await teamService.addMember(req.params.id, req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: "Member added successfully",
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to add member",
    });
  }
};

// Remove member
const removeMember = async (req, res) => {
  try {
    const team = await teamService.removeMember(req.params.id, req.user.id, req.params.userId);
    res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to remove member",
    });
  }
};

// Update member role (admin <-> member)
const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const team = await teamService.updateMemberRole(
      req.params.id,
      req.user.id,
      req.params.userId,
      role
    );
    const io = req.app.get("io");
    if (io) {
      io.to(`team:${team._id}`).emit("team:updated", team);
      io.emit("team:updated", team);
    }
    res.status(200).json({
      success: true,
      message: `Member role updated to ${role} successfully`,
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to update member role",
    });
  }
};

// Join team using invite code
const joinTeamByCode = async (req, res) => {
  try {
    const { code } = req.body;
    const team = await teamService.joinTeamByCode(code, req.user.id);
    const io = req.app.get("io");
    if (io) {
      io.to(`team:${team._id}`).emit("team:updated", team);
      io.emit("team:updated", team);
    }
    res.status(200).json({
      success: true,
      message: team.membershipMessage || `Join request processed for "${team.name}"`,
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to join team",
    });
  }
};

// Respond to join request (Accept / Reject)
const respondToJoinRequest = async (req, res) => {
  try {
    const { action } = req.body;
    const team = await teamService.respondToJoinRequest(
      req.params.id,
      req.user.id,
      req.params.userId,
      action
    );
    const io = req.app.get("io");
    if (io) {
      io.to(`team:${req.params.id}`).emit("team:updated", team);
      io.emit("team:updated", team);
    }
    res.status(200).json({
      success: true,
      message: `Join request ${action === "accept" ? "approved" : "declined"} successfully`,
      data: team,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to respond to join request",
    });
  }
};

// Cancel join request or remove rejected team
const cancelJoinRequest = async (req, res) => {
  try {
    const result = await teamService.cancelJoinRequest(req.params.id, req.user.id);
    const io = req.app.get("io");
    if (io) {
      io.to(`team:${req.params.id}`).emit("team:updated", { _id: req.params.id });
      io.emit("team:updated", { _id: req.params.id });
    }
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to cancel join request",
    });
  }
};

module.exports = {
  createTeam,
  getUserTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  updateMemberRole,
  joinTeamByCode,
  respondToJoinRequest,
  cancelJoinRequest,
};
