const Redis = require('ioredis');

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
};

// Create Redis connection
const createRedisConnection = () => {
  const connection = new Redis(redisConfig);

  connection.on('connect', () => {
    console.log('Redis connected successfully');
  });

  connection.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  connection.on('close', () => {
    console.log('Redis connection closed');
  });

  return connection;
};

// Singleton connection for general use
let redisClient = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisConnection();
  }
  return redisClient;
};

module.exports = {
  redisConfig,
  createRedisConnection,
  getRedisClient
};
