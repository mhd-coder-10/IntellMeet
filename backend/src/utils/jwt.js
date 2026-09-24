const jwt = require('jsonwebtoken')

const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'

// Generate short lived access token 
const generateAccessToken=(userId)=>{
    return jwt.sign({id:userId}, process.env.JWT_SECRET);
    expiresIn:ACCESS_TOKEN_EXPIRY
}


// Generate long lived refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  })
}

// Verify token with given secret
const verifyToken = (token, secret) => {
  return jwt.verify(token, secret)
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
}