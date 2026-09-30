// Configures Redis client connection using ioredis
// Handles connect and error events for the Redis service

const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("\nRedis connected successfully");
})

redis.on("error", (err) => {
  console.error("\nRedis connection error:", err.message);
});

module.exports = redis