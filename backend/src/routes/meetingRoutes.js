
// Defines all meeting API routes with Swagger documentation
// Maps endpoints to controller functions with auth protection

const express = require("express")
const router = express.Router()

const {
  createMeeting,
  getMeetingById,
  getMeetingByCode,
  getUserMeetings,
  updateMeeting,
  deleteMeeting,
  joinMeeting,
  leaveMeeting,
  startMeeting,
  endMeeting,
  hideMeeting,
  uploadMeetingRecording,
} = require("../controllers/meetingController")

const { protect } = require("../middleware/auth.middleware")
const { uploadRecording } = require("../middleware/upload.middleware")

/**
 * @swagger
 * /meetings:
 *   post:
 *     summary: Create a new meeting
 *     tags: [Meetings]
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
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Meeting created successfully
 *       400:
 *         description: Missing title
 *       401:
 *         description: Not authorized
 */
router.post("/", protect, createMeeting);

/**
 * @swagger
 * /meetings:
 *   get:
 *     summary: Get all meetings of logged in user
 *     tags: [Meetings]
 *     responses:
 *       200:
 *         description: List of meetings
 *       401:
 *         description: Not authorized
 */
router.get("/", protect, getUserMeetings);

/**
 * @swagger
 * /meetings/{id}/hide:
 *   delete:
 *     summary: Remove meeting from user's list (not from DB)
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting removed from list
 */
router.delete("/:id/hide", protect, hideMeeting);

/**
 * @swagger
 * /meetings/code/{code}:
 *   get:
 *     summary: Get meeting by meeting code
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting details
 *       404:
 *         description: Invalid meeting code
 */
router.get("/code/:code", protect, getMeetingByCode);

/**
 * @swagger
 * /meetings/{id}:
 *   get:
 *     summary: Get meeting by ID
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting details
 *       404:
 *         description: Meeting not found
 */
router.get("/:id", protect, getMeetingById);

/**
 * @swagger
 * /meetings/{id}:
 *   put:
 *     summary: Update meeting details
 *     tags: [Meetings]
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
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Meeting updated successfully
 *       403:
 *         description: Only host can update
 */
router.put("/:id", protect, updateMeeting);

/**
 * @swagger
 * /meetings/{id}:
 *   delete:
 *     summary: Delete meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting deleted successfully
 *       403:
 *         description: Only host can delete
 */
router.delete("/:id", protect, deleteMeeting);

/**
 * @swagger
 * /meetings/{id}/join:
 *   post:
 *     summary: Join an existing meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Joined meeting successfully
 *       400:
 *         description: Meeting no longer active
 */
router.post("/:id/join", protect, joinMeeting);

/**
 * @swagger
 * /meetings/{id}/leave:
 *   post:
 *     summary: Leave a meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Left meeting successfully
 *       400:
 *         description: Host cannot leave
 */
router.post("/:id/leave", protect, leaveMeeting);

/**
 * @swagger
 * /meetings/{id}/start:
 *   post:
 *     summary: Start a meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting started
 *       403:
 *         description: Only host can start
 */
router.post("/:id/start", protect, startMeeting);

/**
 * @swagger
 * /meetings/{id}/end:
 *   post:
 *     summary: End a meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meeting ended
 *       403:
 *         description: Only host can end
 */
router.post("/:id/end", protect, endMeeting);

// Upload and save meeting recording
router.post("/:id/recording", protect, uploadRecording.single("recording"), uploadMeetingRecording);

module.exports = router;