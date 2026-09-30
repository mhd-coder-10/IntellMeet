// Main router that combines all route modules
// Mounts auth, users and meetings routes etc under /api

const express = require("express");
const router = express.Router();

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const chatRoutes = require("./routes/chatRoutes");
const notificationRoutes = require("./routes/notificationRoutes");


// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/meetings", meetingRoutes);
router.use("/chats", chatRoutes)
router.use("/notifications", notificationRoutes)

module.exports = router;