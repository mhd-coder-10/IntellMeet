// Main router that combines all route modules
// Mounts auth, users and meetings routes etc under /api

const express = require("express");
const router = express.Router();

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const aiRoutes = require("./routes/aiRoutes");
const teamRoutes = require("./routes/teamRoutes");
const taskRoutes = require("./routes/taskRoutes");

// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/meetings", meetingRoutes);
router.use("/chats", chatRoutes);
router.use("/notifications", notificationRoutes);
router.use("/ai", aiRoutes);
router.use("/teams", teamRoutes);
router.use("/", taskRoutes);

module.exports = router;