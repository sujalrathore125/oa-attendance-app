const jwt = require('jsonwebtoken');
const { blacklistToken, isTokenBlacklisted } = require('../config/redis');
require('dotenv').config();

const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// Get TTL of token to set correct blacklist expiry
const getTokenTTL = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded.exp - Math.floor(Date.now() / 1000);
  } catch {
    return parseInt(process.env.REDIS_BLACKLIST_TTL) || 86400;
  }
};

const invalidateToken = async (token) => {
  const ttl = getTokenTTL(token);
  if (ttl > 0) await blacklistToken(token, ttl);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  invalidateToken,
  isTokenBlacklisted,
};
