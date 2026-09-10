import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { _redis?: IORedis };

function createConnection() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export const redisConnection = globalForRedis._redis ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForRedis._redis = redisConnection;
}
