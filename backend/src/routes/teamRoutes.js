// Team & Project Routes
// Endpoints for team workspaces, members, and project boards

const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const projectController = require("../controllers/projectController");
const { protect } = require("../middleware/auth.middleware");

// Team Workspace Endpoints
router.post("/", protect, teamController.createTeam);
router.get("/", protect, teamController.getUserTeams);
router.post("/join", protect, teamController.joinTeamByCode);
router.get("/:id", protect, teamController.getTeamById);
router.put("/:id", protect, teamController.updateTeam);
router.delete("/:id", protect, teamController.deleteTeam);

// Member & Join Request Management
router.post("/:id/members", protect, teamController.addMember);
router.delete("/:id/members/:userId", protect, teamController.removeMember);
router.post("/:id/requests/:userId/respond", protect, teamController.respondToJoinRequest);
router.delete("/:id/requests", protect, teamController.cancelJoinRequest);

// Project Boards under Team
router.post("/:teamId/projects", protect, projectController.createProject);
router.get("/:teamId/projects", protect, projectController.getProjectsByTeam);

module.exports = router;
