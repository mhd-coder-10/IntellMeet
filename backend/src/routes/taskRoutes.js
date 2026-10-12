// Task Routes (Kanban Cards & Projects)
// Endpoints for Kanban tasks, column movements, and project retrieval

const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const projectController = require("../controllers/projectController");
const { protect } = require("../middleware/auth.middleware");

// Project specific board endpoints
router.get("/projects/:id", protect, projectController.getProjectById);
router.put("/projects/:id", protect, projectController.updateProject);
router.delete("/projects/:id", protect, projectController.deleteProject);

// Task endpoints
router.get("/projects/:projectId/tasks", protect, taskController.getTasksByProject);
router.post("/projects/:projectId/tasks", protect, taskController.createTask);
router.patch("/tasks/:id/move", protect, taskController.moveTask);
router.put("/tasks/:id", protect, taskController.updateTask);
router.delete("/tasks/:id", protect, taskController.deleteTask);
router.post("/tasks/:id/comments", protect, taskController.addComment);

module.exports = router;
