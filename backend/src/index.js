const express = require("express");
const router = express.Router();

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const meetingRoutes = require("./routes/meetingRoutes");


// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes)
router.use("/meetings", meetingRoutes);



module.exports = router;