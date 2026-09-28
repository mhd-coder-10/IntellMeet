const authService = require("../services/authService");

// Handle signup request
const signup = async (req, res) => {
  try {
    const data = await authService.signupUser(req.body);
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// Handle login request
const login = async (req, res) => {
  try {
    const data = await authService.loginUser(req.body);
    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// Handle refresh token request
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    const data = await authService.refreshAccessToken(refreshToken);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// Handle logout request
const logout = async (req, res) => {
  try {
    const data = await authService.logoutUser(req.user.id);
    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// Handle current user request
const getMe = async (req, res) => {
  try {
    const data = await authService.getCurrentUser(req.user.id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {  authController: {signup, login, refresh, logout, getMe} };