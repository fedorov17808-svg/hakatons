/**
 * In-memory sliding window rate limiter.
 * For production: replace with Redis-based distributed limiter.
 * 
 * Architecture: Per-IP sliding window counter with automatic cleanup.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 60_000;

// Auto-cleanup stale entries every 60s
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow Node.js to exit even if timer is running
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}

/**
 * Check if a request from `clientId` (IP or API key) is within rate limits.
 * 
 * @param clientId - Unique client identifier (IP address, API key, etc.)
 * @param maxRequests - Maximum requests allowed within the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 */
export function checkRateLimit(
  clientId: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): RateLimitResult {
  ensureCleanup(windowMs);
  
  const now = Date.now();
  let entry = store.get(clientId);
  
  if (!entry) {
    entry = { timestamps: [] };
    store.set(clientId, entry);
  }
  
  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
  
  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs)
    };
  }
  
  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: null
  };
}

/**
 * Extract client IP from request headers (handles proxied requests).
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
