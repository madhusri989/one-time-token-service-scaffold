// token-service.js
// A single-use, expiring token service backed by Redis.

import crypto from "node:crypto";
import Redis from "ioredis";
import "dotenv/config";

const redis = new Redis(process.env.REDIS_URL);

// Helper: build the Redis key for a token id.
const keyFor = (id) => "token:" + id;

/**
 * Issue a single-use token that expires after ttlSeconds.
 * The value and expiration are stored atomically.
 *
 * @param {object} payload
 * @param {number} ttlSeconds
 * @returns {Promise<string>}
 */
export async function issueToken(payload, ttlSeconds) {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new TypeError("ttlSeconds must be a positive integer");
  }

  const tokenId = crypto.randomBytes(16).toString("hex");
  const value = JSON.stringify(payload);

  // SET + EX applies the expiry in the same atomic Redis command.
  const stored = await redis.set(keyFor(tokenId), value, "EX", ttlSeconds, "NX");
  if (stored !== "OK") {
    throw new Error("Could not issue token");
  }

  return tokenId;
}

/**
 * Consume a token exactly once using Redis' atomic GETDEL command.
 *
 * @param {string} tokenId
 * @returns {Promise<{ ok: true, payload: object } | { ok: false, reason: "invalid" }>}
 */
export async function consumeToken(tokenId) {
  const value = await redis.getdel(keyFor(tokenId));

  if (value === null) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, payload: JSON.parse(value) };
}

// Allow other files to close the connection cleanly (used by test.js).
export function closeRedis() {
  return redis.quit();
}
