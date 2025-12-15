const { getRedisClient } = require('../config/redis');

class CacheService {
  constructor() {
    this.client = null;
    this.defaultTTL = 300; // 5 minutes default
  }

  // Initialize cache service
  initialize() {
    try {
      this.client = getRedisClient();
      console.log('Cache service initialized');
    } catch (error) {
      console.error('Failed to initialize cache service:', error.message);
    }
  }

  // Set a value in cache
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.client) return false;
    
    try {
      const serialized = JSON.stringify(value);
      await this.client.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error('Cache set error:', error.message);
      return false;
    }
  }

  // Get a value from cache
  async get(key) {
    if (!this.client) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error.message);
      return null;
    }
  }

  // Delete a value from cache
  async del(key) {
    if (!this.client) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error.message);
      return false;
    }
  }

  // Delete multiple keys by pattern
  async delByPattern(pattern) {
    if (!this.client) return false;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache delete by pattern error:', error.message);
      return false;
    }
  }

  // Cache meeting data
  async cacheMeeting(meetingId, meetingData, ttl = 60) {
    return this.set(`meeting:${meetingId}`, meetingData, ttl);
  }

  // Get cached meeting
  async getCachedMeeting(meetingId) {
    return this.get(`meeting:${meetingId}`);
  }

  // Invalidate meeting cache
  async invalidateMeetingCache(meetingId) {
    return this.del(`meeting:${meetingId}`);
  }

  // Cache user session
  async cacheUserSession(userId, sessionData, ttl = 3600) {
    return this.set(`session:${userId}`, sessionData, ttl);
  }

  // Get cached user session
  async getCachedUserSession(userId) {
    return this.get(`session:${userId}`);
  }

  // Track online users in a meeting
  async addOnlineUser(meetingId, userId, userData) {
    if (!this.client) return false;
    
    try {
      await this.client.hset(
        `meeting:${meetingId}:online`,
        userId,
        JSON.stringify({ ...userData, lastSeen: Date.now() })
      );
      await this.client.expire(`meeting:${meetingId}:online`, 3600);
      return true;
    } catch (error) {
      console.error('Add online user error:', error.message);
      return false;
    }
  }

  // Remove online user from meeting
  async removeOnlineUser(meetingId, userId) {
    if (!this.client) return false;
    
    try {
      await this.client.hdel(`meeting:${meetingId}:online`, userId);
      return true;
    } catch (error) {
      console.error('Remove online user error:', error.message);
      return false;
    }
  }

  // Get all online users in a meeting
  async getOnlineUsers(meetingId) {
    if (!this.client) return [];
    
    try {
      const users = await this.client.hgetall(`meeting:${meetingId}:online`);
      if (!users) return [];
      
      return Object.entries(users).map(([id, data]) => ({
        id,
        ...JSON.parse(data)
      }));
    } catch (error) {
      console.error('Get online users error:', error.message);
      return [];
    }
  }

  // Rate limiting helper
  async checkRateLimit(key, limit, windowSeconds) {
    if (!this.client) return { allowed: true, remaining: limit };
    
    try {
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      
      const ttl = await this.client.ttl(key);
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetIn: ttl
      };
    } catch (error) {
      console.error('Rate limit check error:', error.message);
      return { allowed: true, remaining: limit };
    }
  }
}

module.exports = new CacheService();
