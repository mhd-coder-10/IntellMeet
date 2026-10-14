const authService = require("../services/authService");

const isProduction = process.env.NODE_ENV === "production";

// Helper cookie options
const getCookieOptions = (maxAge = 7 * 24 * 60 * 60 * 1000) => ({
  httpOnly: true, // Prevents JavaScript from reading the cookie (Immune to XSS)
  secure: isProduction, // HTTPS only in production
  sameSite: isProduction ? "none" : "lax", // Protects against CSRF
  maxAge,
  path: "/",
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  if (accessToken) {
    res.cookie("accessToken", accessToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
  }
  if (refreshToken) {
    res.cookie("refreshToken", refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
  }
};

const clearAuthCookies = (res) => {
  const clearOpts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
  res.clearCookie("accessToken", clearOpts);
  res.clearCookie("refreshToken", clearOpts);
};

// Handle signup request
const signup = async (req, res) => {
  try {
    const data = await authService.signupUser(req.body);
    setAuthCookies(res, data.accessToken, data.refreshToken);
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
    setAuthCookies(res, data.accessToken, data.refreshToken);
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
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    const data = await authService.refreshAccessToken(refreshToken);
    setAuthCookies(res, data.accessToken, data.refreshToken);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    clearAuthCookies(res);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// Handle logout request
const logout = async (req, res) => {
  try {
    clearAuthCookies(res);
    const data = await authService.logoutUser(req.user.id);
    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    clearAuthCookies(res);
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