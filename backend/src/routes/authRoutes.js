
const express = require("express")
const router = express.Router()

const {authController} = require("../controllers/authController");

const { protect } = require("../middleware/auth.middleware")
const { authLimiter } = require("../middleware/rateLimiter.middleware")

/**
 * @swagger
 * /auth/send-signup-otp:
 *   post:
 *     summary: Send 6-digit verification code to email for registration
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verification OTP sent to email
 *       400:
 *         description: Email is required or invalid
 *       409:
 *         description: Email already registered
 *       429:
 *         description: Too many requests
 */
// Diagnostic endpoint to check and verify live SMTP health
router.get("/email-status", async (req, res) => {
  try {
    const emailService = require("../services/emailService");
    const testRecipient = req.query.email || process.env.SMTP_USER || "intellmeett16@gmail.com";
    let sent = false;
    let messageId = null;
    let error = null;

    if (req.query.send === "true") {
      try {
        const info = await emailService.sendSignupOtpEmail({
          recipientEmail: testRecipient,
          recipientName: "Test Diagnostic",
          otp: "123456",
        });
        sent = true;
        messageId = info?.messageId || "sent";
      } catch (err) {
        error = err.message;
      }
    }

    res.json({
      status: "OK",
      hasSmtpUser: !!(process.env.SMTP_USER || process.env.EMAIL_USER),
      hasSmtpPass: !!(process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD),
      smtpUser: (process.env.SMTP_USER || process.env.EMAIL_USER || "intellmeett16@gmail.com").slice(0, 4) + "***",
      testRecipient,
      sent,
      messageId,
      error,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/send-signup-otp", authLimiter, authController.sendSignupOtp)

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user with verified email OTP
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, username, email, password, otp]
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Missing fields or invalid/expired OTP
 *       409:
 *         description: User or username already exists
 *       429:
 *         description: Too many requests
 */
router.post("/signup", authLimiter, authController.signup)

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests
 */
router.post("/login", authLimiter, authController.login)

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Get new access token
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *       403:
 *         description: Invalid refresh token
 */
router.post("/refresh", authController.refresh)

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       401:
 *         description: Not authorized
 */
router.post("/logout", protect, authController.logout)

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current logged in user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: User details
 *       401:
 *         description: Not authorized
 */
router.get("/me", protect, authController.getMe)

module.exports = router