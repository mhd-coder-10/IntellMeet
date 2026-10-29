// Project Board Controller
// Handles endpoints for project boards, Kanban configuration, and project member management

const projectService = require("../services/projectService");

const createProject = async (req, res) => {
  try {
    const project = await projectService.createProject(req.params.teamId, req.user.id, req.body);
    const io = req.app.get("io");
    if (io) {
      io.to(`team:${req.params.teamId}`).emit("team:updated", { _id: req.params.teamId });
      io.emit("team:updated", { _id: req.params.teamId });
    }
    res.status(201).json({
      success: true,
      message: "Project board created successfully",
      data: project,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to create project board",
    });
  }
};

const getProjectsByTeam = async (req, res) => {
  try {
    const projects = await projectService.getProjectsByTeam(req.params.teamId, req.user.id);
    res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch project boards",
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const project = await projectService.getProjectById(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch project board",
    });
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.user.id, req.body);
    const io = req.app.get("io");
    if (io && project.team) {
      io.to(`team:${project.team}`).emit("team:updated", { _id: project.team });
      io.emit("team:updated", { _id: project.team });
    }
    res.status(200).json({
      success: true,
      message: "Project board updated successfully",
      data: project,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to update project board",
    });
  }
};

const deleteProject = async (req, res) => {
  try {
    const result = await projectService.deleteProject(req.params.id, req.user.id);
    const io = req.app.get("io");
    if (io && result.teamId) {
      io.to(`team:${result.teamId}`).emit("team:updated", { _id: result.teamId });
      io.emit("team:updated", { _id: result.teamId });
    }
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Failed to delete project board",
    });
  }
};

const getProjectMembers = async (req, res) => {
  try {
    const members = await projectService.getProjectMembers(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch project members",
    });
  }
};

const addProjectMember = async (req, res) => {
  try {
    const { userId: targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    const project = await projectService.addProjectMember(req.params.id, req.user.id, targetUserId);
    const io = req.app.get("io");
      if (io) {
        if (project.team) {
          io.to(`team:${project.team}`).emit("team:updated", { _id: project.team });
        }
        io.to(`project:${project._id}`).emit("project:updated", project);
      }
      res.status(200).json({
        success: true,
        message: "Member added to project successfully",
        data: project,
      });
    } catch (error) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || "Failed to add project member",
      });
    }
  };

  const removeProjectMember = async (req, res) => {
    try {
      const project = await projectService.removeProjectMember(req.params.id, req.user.id, req.params.userId);
      const io = req.app.get("io");
        if (io) {
          if (project.team) {
            io.to(`team:${project.team}`).emit("team:updated", { _id: project.team });
          }
          io.to(`project:${project._id}`).emit("project:updated", project);
        }
        res.status(200).json({
          success: true,
          message: "Member removed from project successfully",
          data: project,
        });
      } catch (error) {
        res.status(error.statusCode || 400).json({
          success: false,
          message: error.message || "Failed to remove project member",
        });
      }
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