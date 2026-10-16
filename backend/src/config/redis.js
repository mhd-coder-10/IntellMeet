// Configures Redis client connection using ioredis
// Handles connect, reconnect, and error events safely

const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || (process.env.REDIS_HOST ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}` : "redis://127.0.0.1:6379");

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      return null; // Stop spamming logs after 5 attempts if redis is down
    }
    return Math.min(times * 1000, 3000);
  },
});

// Attempt connection
redis.connect().catch((err) => {
  console.warn("Redis initial connection warning:", err.message);
});

redis.on("connect", () => {
  console.log("\nRedis connected successfully");
});

redis.on("error", (err) => {
  console.warn("Redis notice:", err.message);
});

module.exports = redis;