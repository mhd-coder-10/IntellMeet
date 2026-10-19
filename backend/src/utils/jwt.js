const jwt = require('jsonwebtoken');

const cleanExpiry = (val, fallback) => {
  if (!val) return fallback;
  return val.toString().replace(/['"]/g, "").trim() || fallback;
};

// Access token valid for 7 days
const ACCESS_TOKEN_EXPIRY = cleanExpiry(process.env.JWT_ACCESS_TOKEN_EXPIRY, "7d");

// Refresh token valid for 30 days (ensures seamless 7+ day continuous login)
const REFRESH_TOKEN_EXPIRY = cleanExpiry(
  process.env.JWT_REFRESH_TOKEN_EXPIRY || process.env.JWT_REFERESH_TOKEN_EXPIRY,
  "30d"
);

// Generate 7-day access token 
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

// Generate 30-day refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
};

// Verify token with given secret
const verifyToken = (token, secret) => {
  return jwt.verify(token, secret);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
};
