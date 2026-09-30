
const userRepo = require("../repositories/userRepository")
const cloudinary = require("../config/cloudinary")

// Extract cloudinary public id from secure url
const extractPublicId = (url) => {
  const parts = url.split("/")
  const filename = parts[parts.length - 1]
  const folder = parts[parts.length - 2]
  return `${folder}/${filename.split(".")[0]}`
}

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

// Delete image from cloudinary using url
const deleteFromCloudinary = async (url) => {
  if (!url) return
  try {
    const publicId = extractPublicId(url)
    await cloudinary.uploader.destroy(publicId)
  } catch (err) {
    console.log("Cloudinary delete failed:", err.message)
  }
}

// Get logged in user profile
const getProfile = async (userId) => {
  const user = await userRepo.findById(userId, "-password")
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

  if (updates.username) {
    const existing = await userRepo.findByUsername(updates.username)
    if (existing && existing._id.toString() !== userId.toString()) {
      const error = new Error("Username already taken")
      error.statusCode = 409
      throw error
    }
  }

  const user = await userRepo.updateById(userId, updates)
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  return { user }
}

// Update user avatar by replacing old image
const updateAvatar = async (userId, fileBuffer) => {
  if (!fileBuffer) {
    const error = new Error("No file provided")
    error.statusCode = 400
    throw error
  }

  const user = await userRepo.findById(userId)
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  // Delete old avatar from cloudinary
  if (user.profilePicture) {
    await deleteFromCloudinary(user.profilePicture)
  }

  // Upload new avatar
  const result = await uploadToCloudinary(fileBuffer)

  const updated = await userRepo.updateAvatar(userId, result.secure_url)

  return {
    user: {
      id: updated._id,
      name: updated.name,
      username: updated.username,
      email: updated.email,
      profilePicture: updated.profilePicture,
      role: updated.role,
    },
  }
}

// Remove user avatar from cloudinary and database
const removeAvatar = async (userId) => {
  const user = await userRepo.findById(userId)
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  if (!user.profilePicture) {
    const error = new Error("No avatar to remove")
    error.statusCode = 400
    throw error
  }

  // Delete from cloudinary
  await deleteFromCloudinary(user.profilePicture)

  // Clear from database
  const updated = await userRepo.removeAvatar(userId)

  return {
    user: {
      id: updated._id,
      name: updated.name,
      username: updated.username,
      email: updated.email,
      profilePicture: updated.profilePicture,
      role: updated.role,
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

  const user = await userRepo.findByIdWithPassword(userId)
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  const isMatch = await user.comparePassword(currentPassword)
  if (!isMatch) {
    const error = new Error("Current password is incorrect")
    error.statusCode = 401
    throw error
  }

  const isSame = await user.comparePassword(newPassword)
  if (isSame) {
    const error = new Error(
      "New password must be different from current password"
    )
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
  removeAvatar,
  updatePassword,
}