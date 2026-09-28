// const express = require("express");
// const router = express.Router();

// const {authController} = require("../controllers/authController");

// const { protect } = require("../middleware/auth.middleware");

// /**
//  * @swagger
//  * /auth/signup:
//  *   post:
//  *     summary: Register a new user
//  *     tags: [Auth]
//  *     security: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [name, username, email, password]
//  *             properties:
//  *               name:
//  *                 type: string
//  *               username:
//  *                 type: string
//  *               email:
//  *                 type: string
//  *               password:
//  *                 type: string
//  *     responses:
//  *       201:
//  *         description: User registered successfully
//  *       400:
//  *         description: Missing fields
//  *       409:
//  *         description: User already exists
//  */
// router.post("/signup", authController.signup);


// /**
//  * @swagger
//  * /auth/login:
//  *   post:
//  *     summary: Login user
//  *     tags: [Auth]
//  *     security: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [email, password]
//  *             properties:
//  *               email:
//  *                 type: string
//  *               password:
//  *                 type: string
//  *     responses:
//  *       200:
//  *         description: Login successful
//  *       401:
//  *         description: Invalid credentials
//  */
// router.post("/login", authController.login);


// /**
//  * @swagger
//  * /auth/refresh:
//  *   post:
//  *     summary: Get new access token
//  *     tags: [Auth]
//  *     security: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             required: [refreshToken]
//  *             properties:
//  *               refreshToken:
//  *                 type: string
//  *           example:
//  *             refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example
//  *     responses:
//  *       200:
//  *         description: New access token generated
//  *       403:
//  *         description: Invalid refresh token
//  */
// router.post("/refresh", authController.refresh);

// /**
//  * @swagger
//  * /auth/logout:
//  *   post:
//  *     summary: Logout user
//  *     tags: [Auth]
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       200:
//  *         description: Logged out successfully
//  *       401:
//  *         description: Not authorized
//  */
// router.post("/logout", protect, authController.logout);


// /**
//  * @swagger
//  * /auth/me:
//  *   get:
//  *     summary: Get current logged in user
//  *     tags: [Auth]
//  *     responses:
//  *       200:
//  *         description: User details
//  *       401:
//  *         description: Not authorized
//  */
// router.get("/me", protect, authController.getMe);


// module.exports = router;


const express = require("express")
const router = express.Router()

const {authController} = require("../controllers/authController");

const { protect } = require("../middleware/auth.middleware")
const { authLimiter } = require("../middleware/rateLimiter.middleware")

/**
 * @swagger
 * /auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, username, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Missing fields
 *       409:
 *         description: User already exists
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