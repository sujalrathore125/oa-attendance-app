// redis.js

require("dotenv").config();
const { Redis } = require("@upstash/redis");

// ─── Initialize Upstash Redis ───────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

console.log("✅ Upstash Redis initialized");

// ─── JWT Blacklist (logout / revoked tokens) ───────────────────────────────

const blacklistToken = async (token, ttlSeconds) => {
  try {
    await redis.set(`blacklist:${token}`, "1", {
      ex: ttlSeconds,
    });
  } catch (err) {
    console.error("❌ Redis blacklist error:", err.message);
  }
};

const isTokenBlacklisted = async (token) => {
  try {
    const result = await redis.get(`blacklist:${token}`);
    return result === "1";
  } catch (err) {
    console.error("❌ Redis blacklist check error:", err.message);
    return false;
  }
};

// ─── Generic Cache Helpers ─────────────────────────────────────────────────

const setCache = async (
  key,
  value,
  ttl = parseInt(process.env.REDIS_CACHE_TTL) || 3600
) => {
  try {
    await redis.set(key, JSON.stringify(value), {
      ex: ttl,
    });
  } catch (err) {
    console.error("❌ Redis set cache error:", err.message);
  }
};

const getCache = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error("❌ Redis get cache error:", err.message);
    return null;
  }
};

const delCache = async (key) => {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("❌ Redis delete cache error:", err.message);
  }
};

// ─── Delete cache using pattern (SCAN safe version) ─────────────────────────

const delCachePattern = async (pattern) => {
  try {
    let cursor = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      });

      cursor = Number(nextCursor);

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch (err) {
    console.error("❌ Redis pattern delete error:", err.message);
  }
};

// ─── Export everything ─────────────────────────────────────────────────────

module.exports = {
  redis,
  blacklistToken,
  isTokenBlacklisted,
  setCache,
  getCache,
  delCache,
  delCachePattern,
};