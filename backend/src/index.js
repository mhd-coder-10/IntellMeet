const express = require("express");
const router = express.Router();

const authRoutes = require("./routes/authRoutes");

// Mount auth routes on /auth
router.use("/auth", authRoutes);

module.exports = router;