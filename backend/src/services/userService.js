const User = require("../models/User")
const cloudinary = require("../config/cloudinary")

// Upload buffer to cloudinary and return result
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "intellimeet/avatars",
        resource_type: "image",
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      }
    )
    stream.end(buffer)
  })
}

// Get logged in user profile
const getProfile = async (userId) => {
  const user = await User.findById(userId).select("-password")
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }
  return { user }
}

// Update basic profile fields
const updateProfile = async (userId, updateData) => {
  const allowedFields = ["name", "username", "bio"]
  const updates = {}

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      updates[field] = updateData[field]
    }
  })

  // Check username availability
  if (updates.username) {
    const existing = await User.findOne({
      username: updates.username,
      _id: { $ne: userId },
    })
    if (existing) {
      const error = new Error("Username already taken")
      error.statusCode = 409
      throw error
    }
  }

  const user = await User.findByIdAndUpdate(userId, updates, {
    new: true,
    runValidators: true,
  }).select("-password")

  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  return { user }
}

// Update user avatar using cloudinary
const updateAvatar = async (userId, fileBuffer) => {
  if (!fileBuffer) {
    const error = new Error("No file provided")
    error.statusCode = 400
    throw error
  }

  const user = await User.findById(userId)
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  // Delete old avatar if exists
  if (user.profilePicture) {
    try {
      const publicId = user.profilePicture
        .split("/")
        .slice(-2)
        .join("/")
        .split(".")[0]
      await cloudinary.uploader.destroy(publicId)
    } catch (err) {
      console.log("Old avatar deletion failed:", err.message)
    }
  }

  const result = await uploadToCloudinary(fileBuffer)

  user.profilePicture = result.secure_url
  await user.save({ validateBeforeSave: false })

  return {
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      role: user.role,
    },
  }
}

// Update user password
const updatePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    const error = new Error("Please provide current and new password")
    error.statusCode = 400
    throw error
  }

  if (newPassword.length < 6) {
    const error = new Error("New password must be at least 6 characters")
    error.statusCode = 400
    throw error
  }

  const user = await User.findById(userId).select("+password")
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    const error = new Error("Current password is incorrect")
    error.statusCode = 401
    throw error
  }

  // Prevent same password
  const isSame = await user.comparePassword(newPassword)
  if (isSame) {
    const error = new Error("New password must be different from current password")
    error.statusCode = 400
    throw error
  }

  user.password = newPassword
  await user.save()

  return { message: "Password updated successfully" }
}

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  updatePassword,
}