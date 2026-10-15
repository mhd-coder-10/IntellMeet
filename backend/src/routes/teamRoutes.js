// Team & Project Routes
// Endpoints for team workspaces, members, and project boards

const express = require("express");
const router = express.Router();
const teamController = require("../controllers/teamController");
const projectController = require("../controllers/projectController");
const { protect } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /teams:
 *   post:
 *     summary: Create a new team workspace
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Team workspace created successfully
 *       400:
 *         description: Invalid team workspace data
 */
router.post("/", protect, teamController.createTeam);

/**
 * @swagger
 * /teams:
 *   get:
 *     summary: Get all team workspaces for logged in user
 *     tags: [Teams]
 *     responses:
 *       200:
 *         description: List of team workspaces
 */
router.get("/", protect, teamController.getUserTeams);

/**
 * @swagger
 * /teams/join:
 *   post:
 *     summary: Join a team workspace using an invite code
 *     tags: [Teams]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [inviteCode]
 *             properties:
 *               inviteCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully joined team or join request sent
 *       400:
 *         description: Invalid invite code or already member
 */
router.post("/join", protect, teamController.joinTeamByCode);

/**
 * @swagger
 * /teams/{id}:
 *   get:
 *     summary: Get team workspace details by ID
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team workspace details
 *       404:
 *         description: Workspace not found
 */
router.get("/:id", protect, teamController.getTeamById);

/**
 * @swagger
 * /teams/{id}:
 *   put:
 *     summary: Update team workspace details (admin/owner only)
 *     tags: [Teams]
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
 *     responses:
 *       200:
 *         description: Team workspace updated
 *       403:
 *         description: Not authorized
 */
router.put("/:id", protect, teamController.updateTeam);

/**
 * @swagger
 * /teams/{id}:
 *   delete:
 *     summary: Delete team workspace (owner only)
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Team workspace deleted
 *       403:
 *         description: Only owner can delete workspace
 */
router.delete("/:id", protect, teamController.deleteTeam);

/**
 * @swagger
 * /teams/{id}/members:
 *   post:
 *     summary: Add a member to team workspace (admin/owner)
 *     tags: [Teams]
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
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *                 default: member
 *     responses:
 *       200:
 *         description: Member added successfully
 */
router.post("/:id/members", protect, teamController.addMember);

/**
 * @swagger
 * /teams/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member or leave team workspace
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member removed or left successfully
 */
router.delete("/:id/members/:userId", protect, teamController.removeMember);

/**
 * @swagger
 * /teams/{id}/members/{userId}/role:
 *   patch:
 *     summary: Update team member role (owner/admin only)
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [admin, member]
 *     responses:
 *       200:
 *         description: Member role updated
 */
router.patch("/:id/members/:userId/role", protect, teamController.updateMemberRole);
router.put("/:id/members/:userId/role", protect, teamController.updateMemberRole);

/**
 * @swagger
 * /teams/{id}/requests/{userId}/respond:
 *   post:
 *     summary: Accept or reject workspace join request
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected]
 *     responses:
 *       200:
 *         description: Join request responded
 */
router.post("/:id/requests/:userId/respond", protect, teamController.respondToJoinRequest);

/**
 * @swagger
 * /teams/{id}/requests:
 *   delete:
 *     summary: Cancel pending join request for logged-in user
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Join request cancelled
 */
router.delete("/:id/requests", protect, teamController.cancelJoinRequest);

/**
 * @swagger
 * /teams/{teamId}/projects:
 *   post:
 *     summary: Create a project board under team workspace
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Project board created
 */
router.post("/:teamId/projects", protect, projectController.createProject);

/**
 * @swagger
 * /teams/{teamId}/projects:
 *   get:
 *     summary: Get all project boards under a team workspace
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of projects
 */
router.get("/:teamId/projects", protect, projectController.getProjectsByTeam);

module.exports = router;
