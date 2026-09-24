const express = require('express');
const router = express.Router();

const {  signup,  login,  refresh,  logout,  getMe,} = require("../controllers/authController");

const {protect} = require("../middleware/auth.middleware");

router.post("/signup", signup);

router.post("/login", login);

router.post('/refresh', refresh);

router.post("/logout", protect, logout);

router.get("/me", protect, getMe);

module.exports=router;