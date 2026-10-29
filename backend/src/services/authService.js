

const userRepo = require("../repositories/userRepository")
const Otp = require("../models/Otp")
const emailService = require("./emailService")
const { generateAccessToken, generateRefreshToken, verifyToken, } = require("../utils/jwt")

// Send Signup Email Verification OTP
const sendSignupOtp = async ({ email, name }) => {
  if (!email) {
    const error = new Error("Email is required")
    error.statusCode = 400
    throw error
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existingUser = await userRepo.findByEmail(normalizedEmail)
  if (existingUser) {
    const error = new Error("An account with this email address already exists")
    error.statusCode = 409
    throw error
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()

  // Remove existing OTPs for this email and save new one
  await Otp.deleteMany({ email: normalizedEmail })
  await Otp.create({
    email: normalizedEmail,
    otp,
  })

  // Send Email with OTP (await delivery so failure is properly reported to user)
  try {
    await emailService.sendSignupOtpEmail({
      recipientEmail: normalizedEmail,
      recipientName: name || "there",
      otp,
    });
  } catch (err) {
    console.error(`[OTP Delivery Error] SMTP send failed: ${err.message}`);
    // If SMTP timed out (e.g. Render free tier blocks outbound SMTP ports 25, 465, 587)
    if (
      err.message.includes("timeout") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("ESOCKETTIMEDOUT")
    ) {
      console.warn(
        `[OTP Fallback] Cloud provider blocked SMTP ports. Returning previewOtp for verification: ${otp}`
      );
      return {
        message: "Verification code created. (SMTP port blocked by hosting; code provided)",
        previewOtp: otp,
      };
    }
    const error = new Error(`Failed to deliver verification code email: ${err.message}`);
    error.statusCode = 500;
    throw error;
  }

  return {
    message: "Verification code sent to your email",
  }
}

// Register a new user
const signupUser = async ({ name, username, email, password, otp }) => {
  if (!name || !username || !email || !password) {
    const error = new Error(
      "Please provide name, username, email and password"
    )
    error.statusCode = 400
    throw error
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim().toLowerCase()

  // Verify OTP
  if (!otp) {
    const error = new Error("Verification code is required to register")
    error.statusCode = 400
    throw error
  }

  const otpRecord = await Otp.findOne({
    email: normalizedEmail,
    otp: otp.toString().trim(),
  })

  if (!otpRecord) {
    const error = new Error("Invalid or expired verification code. Please request a new code.")
    error.statusCode = 400
    throw error
  }

  const existingUser = await userRepo.findByEmailOrUsername(normalizedEmail, normalizedUsername)
  if (existingUser) {
    const error = new Error("User with this email or username already exists")
    error.statusCode = 409
    throw error
  }

  const user = await userRepo.create({
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    password,
    isEmailVerified: true,
  })

  // Clean up used OTP
  await Otp.deleteMany({ email: normalizedEmail })

  const accessToken = generateAccessToken(user._id)
  const refreshToken = generateRefreshToken(user._id)

  await userRepo.updateRefreshToken(user._id, refreshToken)

  return {
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: true,
    },
    accessToken,
    refreshToken,
  }
}

// Login existing user
const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error("Please provide email and password")
    error.statusCode = 400
    throw error
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = await userRepo.findByEmailWithPassword(normalizedEmail)
  if (!user) {
    const error = new Error("Invalid credentials or Password");
    error.statusCode = 401
    throw error
  }

  const isMatch = await user.comparePassword(password)
  if (!isMatch) {
    const error = new Error("Invalid credentials")
    error.statusCode = 401
    throw error
  }

  const accessToken = generateAccessToken(user._id)
  const refreshToken = generateRefreshToken(user._id)

  // Single atomic roundtrip to update token and lastLogin
  await userRepo.updateLoginSession(user._id, refreshToken)

  return {
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
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
    const error = new Error("Refresh token required")
    error.statusCode = 401
    throw error
  }

  let decoded
  try {
    decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET)
  } catch (err) {
    const error = new Error("Invalid or expired refresh token")
    error.statusCode = 403
    throw error
  }

  const user = await userRepo.findByIdWithRefreshToken(decoded.id)
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }

  if (user.refreshToken !== refreshToken) {
    const error = new Error("Refresh token has been revoked")
    error.statusCode = 403
    throw error
  }

  const accessToken = generateAccessToken(user._id)
  return { accessToken }
}

// Logout user by clearing refresh token
const logoutUser = async (userId) => {
  await userRepo.updateRefreshToken(userId, null)
  return { message: "Logged out successfully" }
}

// Get current logged in user details
const getCurrentUser = async (userId) => {
  const user = await userRepo.findById(
    userId,
    "-password -refreshToken -resetPasswordToken -resetPasswordExpires -emailVerificationToken -emailVerificationExpires"
  )
  if (!user) {
    const error = new Error("User not found")
    error.statusCode = 404
    throw error
  }
  return {
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      bio: user.bio,
    },
  }
}

module.exports = {
  sendSignupOtp,
  signupUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getCurrentUser,
}