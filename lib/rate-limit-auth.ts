// Rate limiting for auth endpoints to prevent spam

import { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class AuthRateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 30, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Get client identifier from request
   */
  private getClientId(request: NextRequest): string {
    // Try IP first, then fall back to session ID
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const sessionId = request.cookies.get('hyperpage-session')?.value;
    
    if (sessionId) {
      return `session:${sessionId}`;
    }
    
    return `ip:${ip}`;
  }

  /**
   * Check if request is rate limited
   */
  isRateLimited(request: NextRequest): { allowed: boolean; resetTime?: number } {
    const clientId = this.getClientId(request);
    const now = Date.now();
    
    // Clean up expired entries
    this.cleanupExpiredEntries();
    
    const entry = this.requests.get(clientId);
    
    if (!entry) {
      // First request from this client
      this.requests.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true };
    }
    
    // Check if window has reset
    if (now > entry.resetTime) {
      this.requests.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { allowed: true };
    }
    
    // Check if under limit
    if (entry.count < this.maxRequests) {
      entry.count++;
      return { allowed: true };
    }
    
    // Rate limited
    return { 
      allowed: false, 
      resetTime: entry.resetTime 
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    for (const [clientId, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(clientId);
      }
    }
  }

  /**
   * Get retry delay in seconds
   */
  getRetryDelaySeconds(request: NextRequest): number {
    const clientId = this.getClientId(request);
    const entry = this.requests.get(clientId);
    
    if (!entry) return 0;
    
    const now = Date.now();
    const remaining = entry.resetTime - now;
    
    return Math.max(0, Math.ceil(remaining / 1000));
  }
}

// Create default instance (30 requests per minute)
export const authRateLimiter = new AuthRateLimiter(30, 60000);

/**
 * Check if request is rate limited and return appropriate response
 */
export function checkAuthRateLimit(request: NextRequest): Response | null {
  const result = authRateLimiter.isRateLimited(request);
  
  if (!result.allowed) {
    const retryAfter = authRateLimiter.getRetryDelaySeconds(request);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Too many requests",
        retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime?.toString() || '0'
        }
      }
    );
  }
  
  return null;
}
