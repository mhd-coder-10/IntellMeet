const express = require("express");
const router = express.Router();

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes")


// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes)



module.exports = router;