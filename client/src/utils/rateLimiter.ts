/**
 * Client-side rate limiter to prevent API abuse
 * Uses a sliding window algorithm
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for a given key
   * @param key Unique identifier for the rate limit bucket (e.g., 'parseRecipe', 'login')
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing timestamps for this key
    const timestamps = this.requests.get(key) || [];

    // Filter to only keep timestamps within the window
    const validTimestamps = timestamps.filter(t => t > windowStart);

    // Check if we're at the limit
    if (validTimestamps.length >= this.config.maxRequests) {
      return false;
    }

    // Add current timestamp and update
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return true;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(t => t > windowStart);
    return Math.max(0, this.config.maxRequests - validTimestamps.length);
  }

  /**
   * Get time until rate limit resets (in ms)
   */
  getResetTime(key: string): number {
    const timestamps = this.requests.get(key) || [];
    if (timestamps.length === 0) return 0;

    const oldestTimestamp = Math.min(...timestamps);
    const resetTime = oldestTimestamp + this.config.windowMs - Date.now();
    return Math.max(0, resetTime);
  }

  /**
   * Clear rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }
}

// Pre-configured rate limiters for different operations
export const rateLimiters = {
  // AI parsing operations: 10 per minute (expensive)
  aiParsing: new RateLimiter({ maxRequests: 10, windowMs: 60000 }),

  // General API calls: 60 per minute
  api: new RateLimiter({ maxRequests: 60, windowMs: 60000 }),

  // Authentication attempts: 5 per minute
  auth: new RateLimiter({ maxRequests: 5, windowMs: 60000 }),

  // Search queries: 30 per minute
  search: new RateLimiter({ maxRequests: 30, windowMs: 60000 }),
};

/**
 * Helper function to check rate limit and throw if exceeded
 */
export function checkRateLimit(
  limiter: RateLimiter,
  key: string,
  errorMessage: string = 'Too many requests. Please wait a moment and try again.'
): void {
  if (!limiter.isAllowed(key)) {
    const resetTime = Math.ceil(limiter.getResetTime(key) / 1000);
    throw new Error(`${errorMessage} Try again in ${resetTime} seconds.`);
  }
}

export default rateLimiters;
