// Defines notification API routes with Swagger documentation
// Test endpoint is only available in development mode

const express = require("express")
const router = express.Router()

const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notificationController")

const { protect } = require("../middleware/auth.middleware")

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of notifications with unread count
 */
router.get("/", protect, getNotifications)

/**
 * @swagger
 * /notifications/read-all:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: All marked as read
 */
router.put("/read-all", protect, markAllAsRead)

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     summary: Mark single notification as read
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Marked as read
 *       404:
 *         description: Not found
 */
router.put("/:id/read", protect, markAsRead)

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification deleted
 *       404:
 *         description: Not found
 */
router.delete("/:id", protect, deleteNotification)


if (process.env.NODE_ENV === "development") {
  const notificationService = require("../services/notificationService")

  /**
   * @swagger
   * /notifications/test:
   *   post:
   *     summary: Create a test notification (dev only)
   *     tags: [Notifications]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title, message]
   *             properties:
   *               recipientId:
   *                 type: string
   *               title:
   *                 type: string
   *               message:
   *                 type: string
   *               type:
   *                 type: string
   *     responses:
   *       201:
   *         description: Test notification created
   */
  router.post("/test", protect, async (req, res) => {
    try {
      const data = await notificationService.createNotification({
        recipient: req.body.recipientId || req.user.id,
        sender: req.user.id,
        type: req.body.type || "system",
        title: req.body.title || "Test Notification",
        message: req.body.message || "This is a test notification",
        link: req.body.link || "",
      })
      res.status(201).json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })
}

module.exports = router