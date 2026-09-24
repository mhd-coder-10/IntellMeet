const User = require('../models/User')
const { generateAccessToken, generateRefreshToken, verifyToken,} = require('../utils/jwt')

// Register a new user
const signupUser = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    const error = new Error('Please provide name, email and password')
    error.statusCode = 400
    throw error
  }

  const existingUser = await User.findOne({ email })
  if (existingUser) {
    const error = new Error('User with this email already exists')
    error.statusCode = 409
    throw error
  }

  const user = await User.create({ name, email, password })

  const accessToken = generateAccessToken(user._id)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  }
}

// Login existing user
const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Please provide email and password')
    error.statusCode = 400
    throw error
  }

  const user = await User.findOne({ email }).select('+password')
  if (!user) {
    const error = new Error('Invalid credentials')
    error.statusCode = 401
    throw error
  }

  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    const error = new Error('Invalid credentials or Password')
    error.statusCode = 401
    throw error
  }

  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  
  // console.log("Access Token :", accessToken)
  // console.log("Refresh Token :", refreshToken)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  }
}

// Generate new access token using refresh token
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    const error = new Error('Refresh token required')
    error.statusCode = 401
    throw error
  }

  let decoded
  try {
    decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch (err) {
    const error = new Error('Invalid or expired refresh token')
    error.statusCode = 403
    throw error
  }

  const user = await User.findById(decoded.id).select('+refreshToken')
  if (!user || user.refreshToken !== refreshToken) {
    const error = new Error('Invalid refresh token')
    error.statusCode = 403
    throw error
  }

  const accessToken = generateAccessToken(user._id)
  return { accessToken }
}

// Logout user by clearing refresh token
const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: '' })
  return { message: 'Logged out successfully' }
}

// Get current logged in user details
const getCurrentUser = async (userId) => {
  const user = await User.findById(userId)
  if (!user) {
    const error = new Error('User not found')
    error.statusCode = 404
    throw error
  }
  return { user }
}

module.exports = {
  signupUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
}