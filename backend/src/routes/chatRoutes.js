// Defines chat API routes with Swagger documentation
// Delete route accepts meetingId in body to verify host permission

const express = require("express");
const router = express.Router();

const { getMessages, deleteMessage } = require("../controllers/chatController");
const { protect } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /chats/{meetingId}:
 *   get:
 *     summary: Get chat history for a meeting
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: meetingId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of messages with pagination
 */
router.get("/:meetingId", protect, getMessages);

/**
 * @swagger
 * /chats/message/{messageId}:
 *   delete:
 *     summary: Delete a chat message (host only)
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meetingId]
 *             properties:
 *               meetingId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message deleted
 *       403:
 *         description: Only host can delete
 */
router.delete("/message/:messageId", protect, deleteMessage);

module.exports = router;