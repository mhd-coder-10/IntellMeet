const express = require("express")
const router = express.Router()

const usercontroller = require("../controllers/userController");

const { protect } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get logged in user profile
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User profile fetched
 *       401:
 *         description: Not authorized
 *       404:
 *         description: User not found
 */
router.get("/profile", protect, usercontroller.getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Not authorized
 *       409:
 *         description: Username already taken
 */
router.put("/profile", protect, usercontroller.updateProfile);

/**
 * @swagger
 * /users/avatar:
 *   put:
 *     summary: Update user avatar image
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar updated successfully
 *       400:
 *         description: No file provided
 *       401:
 *         description: Not authorized
 */
router.put("/avatar", protect, upload.single("avatar"), usercontroller.updateAvatar);

/**
 * @swagger
 * /users/password:
 *   put:
 *     summary: Update user password
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Current password is incorrect
 */
router.put("/password", protect, usercontroller.updatePassword);

module.exports = router