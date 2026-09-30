// Defines chat API routes with Swagger documentation
// Mounts under /api/chats with auth protection

const express = require("express")
const router = express.Router()

const { getMessages, deleteMessage } = require("../controllers/chatController")
const { protect } = require("../middleware/auth.middleware")

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
 *       404:
 *         description: Meeting not found
 */
router.get("/:meetingId", protect, getMessages)

/**
 * @swagger
 * /chats/message/{messageId}:
 *   delete:
 *     summary: Delete a chat message (only sender)
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message deleted
 *       404:
 *         description: Message not found or not authorized
 */
router.delete("/message/:messageId", protect, deleteMessage)

module.exports = router