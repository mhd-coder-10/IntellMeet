// Provides reusable cache helper functions for Redis
// Supports set, get, delete and pattern-based deletion

const redis = require("../config/redis")

const DEFAULT_TTL = 300

const setCache = async (key, value, ttl = DEFAULT_TTL) => {
  await redis.set(key, JSON.stringify(value), "EX", ttl)
}

const getCache = async (key) => {
  const data = await redis.get(key)
  return data ? JSON.parse(data) : null
}

const deleteCache = async (key) => {
  await redis.del(key)
}

const deleteCacheByPattern = async (pattern) => {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(keys)
  }
}

module.exports = { setCache, getCache, deleteCache, deleteCacheByPattern }