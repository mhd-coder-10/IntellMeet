

const userService = require("../services/userService")

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const data = await userService.getProfile(req.user.id)
    res.status(200).json({ success: true, data })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    })
  }
}

// Update profile fields
const updateProfile = async (req, res) => {
  try {
    const data = await userService.updateProfile(req.user.id, req.body)
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    })
  }
}

// Update avatar image
const updateAvatar = async (req, res) => {
  try {
    const data = await userService.updateAvatar(req.user.id, req.file?.buffer)
    res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    })
  }
}

// Remove avatar image
const removeAvatar = async (req, res) => {
  try {
    const data = await userService.removeAvatar(req.user.id)
    res.status(200).json({
      success: true,
      message: "Avatar removed successfully",
      data,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    })
  }
}

// Update user password
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    const data = await userService.updatePassword(
      req.user.id,
      currentPassword,
      newPassword
    )
    res.status(200).json({
      success: true,
      ...data,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    })
  }
}

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  removeAvatar,
  updatePassword,
}