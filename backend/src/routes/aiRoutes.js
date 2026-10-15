// AI Routes
// Defines endpoints for meeting transcript generation, retrieval, editing, and exports

const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { protect } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /ai/meetings/{id}/transcript/generate:
 *   post:
 *     summary: Generate or regenerate AI meeting transcript
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Meeting ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recordingIndex:
 *                 type: integer
 *                 default: 0
 *               provider:
 *                 type: string
 *               forceRegenerate:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: AI Transcript generated successfully
 *       404:
 *         description: Meeting or recording not found
 */
router.post("/meetings/:id/transcript/generate", protect, aiController.generateTranscript);

/**
 * @swagger
 * /ai/meetings/{id}/transcript:
 *   get:
 *     summary: Get meeting transcript
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: recordingIndex
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Meeting transcript retrieved
 *       404:
 *         description: Transcript not found
 */
router.get("/meetings/:id/transcript", protect, aiController.getTranscript);

/**
 * @swagger
 * /ai/meetings/{id}/transcript:
 *   put:
 *     summary: Update or edit transcript text/segments
 *     tags: [AI]
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
 *             properties:
 *               fullText:
 *                 type: string
 *               segments:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Transcript updated successfully
 */
router.put("/meetings/:id/transcript", protect, aiController.updateTranscript);

/**
 * @swagger
 * /ai/meetings/{id}/transcript:
 *   delete:
 *     summary: Delete meeting transcript
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transcript deleted successfully
 */
router.delete("/meetings/:id/transcript", protect, aiController.deleteTranscript);

/**
 * @swagger
 * /ai/meetings/{id}/transcript/export:
 *   get:
 *     summary: Export meeting transcript as txt, vtt, or json
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [txt, vtt, json]
 *           default: txt
 *     responses:
 *       200:
 *         description: Transcript file download
 */
router.get("/meetings/:id/transcript/export", protect, aiController.exportTranscript);

/**
 * @swagger
 * /ai/meetings/{id}/summary/generate:
 *   post:
 *     summary: Generate AI meeting summary and action items
 *     tags: [AI]
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
 *               forceRegenerate:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Summary and action items generated successfully
 */
router.post("/meetings/:id/summary/generate", protect, aiController.generateSummary);

/**
 * @swagger
 * /ai/meetings/{id}/summary:
 *   get:
 *     summary: Get meeting summary and action items
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary and action items retrieved
 */
router.get("/meetings/:id/summary", protect, aiController.getSummary);

/**
 * @swagger
 * /ai/meetings/{id}/summary/trust:
 *   patch:
 *     summary: Mark meeting summary as trusted/finalized (host only)
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary marked as trusted
 */
router.patch("/meetings/:id/summary/trust", protect, aiController.trustSummary);

/**
 * @swagger
 * /ai/meetings/{id}/summary:
 *   delete:
 *     summary: Delete meeting summary and its action items (host only)
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary deleted
 */
router.delete("/meetings/:id/summary", protect, aiController.deleteSummary);

/**
 * @swagger
 * /ai/meetings/{id}/summary/export:
 *   get:
 *     summary: Export meeting summary as txt, markdown, or json
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [txt, md, json]
 *           default: txt
 *     responses:
 *       200:
 *         description: Summary file download
 */
router.get("/meetings/:id/summary/export", protect, aiController.exportSummary);

/**
 * @swagger
 * /ai/action-items/{id}/toggle:
 *   patch:
 *     summary: Toggle action item status (open/completed)
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action item status toggled
 */
router.patch("/action-items/:id/toggle", protect, aiController.toggleActionItem);

/**
 * @swagger
 * /ai/meetings/{id}/action-items:
 *   post:
 *     summary: Create a manual action item for a meeting
 *     tags: [AI]
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
 *             required: [description]
 *             properties:
 *               description:
 *                 type: string
 *               assignee:
 *                 type: string
 *               assigneeName:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Action item created
 */
router.post("/meetings/:id/action-items", protect, aiController.createActionItem);

/**
 * @swagger
 * /ai/action-items/{id}:
 *   put:
 *     summary: Update an action item
 *     tags: [AI]
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
 *             properties:
 *               description:
 *                 type: string
 *               assignee:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Action item updated
 */
router.put("/action-items/:id", protect, aiController.updateActionItem);

/**
 * @swagger
 * /ai/action-items/{id}:
 *   delete:
 *     summary: Delete an action item
 *     tags: [AI]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Action item deleted
 */
router.delete("/action-items/:id", protect, aiController.deleteActionItem);

/**
 * @swagger
 * /ai/action-items/{id}/convert-to-task:
 *   post:
 *     summary: Convert an action item to a project Kanban task
 *     tags: [AI]
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
 *             required: [projectId]
 *             properties:
 *               projectId:
 *                 type: string
 *               columnId:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *     responses:
 *       201:
 *         description: Action item converted to Kanban task
 */
router.post("/action-items/:id/convert-to-task", protect, aiController.convertActionItemToTask);

module.exports = router;
