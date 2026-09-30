
const express = require("express")
const router = express.Router()

const {
  getProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
  updatePassword,
} = require("../controllers/userController")

const { protect } = require("../middleware/auth.middleware")
const upload = require("../middleware/upload.middleware")

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
 */
router.get("/profile", protect, getProfile)

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
router.put("/profile", protect, updateProfile)

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
router.put("/avatar", protect, upload.single("avatar"), updateAvatar)

/**
 * @swagger
 * /users/avatar:
 *   delete:
 *     summary: Remove user avatar image
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Avatar removed successfully
 *       400:
 *         description: No avatar to remove
 *       401:
 *         description: Not authorized
 */
router.delete("/avatar", protect, removeAvatar)

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
router.put("/password", protect, updatePassword)

module.exports = router