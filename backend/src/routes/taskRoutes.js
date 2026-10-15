// Task Routes (Kanban Cards & Projects)
// Endpoints for Kanban tasks, column movements, and project retrieval

const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const projectController = require("../controllers/projectController");
const { protect } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /projects/{id}/members:
 *   get:
 *     summary: Get all team members eligible for assignment in a project board
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of project members
 */
router.get("/projects/:id/members", protect, projectController.getProjectMembers);

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project board details and columns by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project board details
 *       404:
 *         description: Project board not found
 */
router.get("/projects/:id", protect, projectController.getProjectById);

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update project board name, description or columns
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               columns:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Project board updated successfully
 */
router.put("/projects/:id", protect, projectController.updateProject);

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete project board and all associated tasks
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project board deleted
 */
router.delete("/projects/:id", protect, projectController.deleteProject);

/**
 * @swagger
 * /projects/{projectId}/tasks:
 *   get:
 *     summary: Get all Kanban tasks for a project board
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tasks for the project board
 */
router.get("/projects/:projectId/tasks", protect, taskController.getTasksByProject);

/**
 * @swagger
 * /projects/{projectId}/tasks:
 *   post:
 *     summary: Create a new task on a project board
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               columnId:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               assignee:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Task created successfully
 */
router.post("/projects/:projectId/tasks", protect, taskController.createTask);

/**
 * @swagger
 * /tasks/{id}/move:
 *   patch:
 *     summary: Move task across columns or reorder on Kanban board
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [columnId]
 *             properties:
 *               columnId:
 *                 type: string
 *               status:
 *                 type: string
 *               order:
 *                 type: number
 *     responses:
 *       200:
 *         description: Task moved successfully
 */
router.patch("/tasks/:id/move", protect, taskController.moveTask);

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update task title, description, priority, assignee or due date
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               assignee:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Task updated successfully
 */
router.put("/tasks/:id", protect, taskController.updateTask);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted successfully
 */
router.delete("/tasks/:id", protect, taskController.deleteTask);

/**
 * @swagger
 * /tasks/{id}/comments:
 *   post:
 *     summary: Add a comment to a task
 *     tags: [Tasks]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added to task
 */
router.post("/tasks/:id/comments", protect, taskController.addComment);

module.exports = router;
