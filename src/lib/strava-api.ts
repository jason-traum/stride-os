/**
 * Enhanced Strava API client with proper rate limiting
 */

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

interface RateLimitInfo {
  limit15Min: number;
  usage15Min: number;
  limitDaily: number;
  usageDaily: number;
}

let lastRateLimit: RateLimitInfo | null = null;

/**
 * Parse rate limit headers from Strava response
 */
function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  return {
    limit15Min: parseInt(headers.get('X-RateLimit-Limit') || '200'),
    usage15Min: parseInt(headers.get('X-RateLimit-Usage') || '0'),
    limitDaily: parseInt(headers.get('X-RateLimit-Limit-Daily') || '2000'),
    usageDaily: parseInt(headers.get('X-RateLimit-Usage-Daily') || '0'),
  };
}

/**
 * Make a request to Strava API with rate limit handling
 */
export async function stravaFetch(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${STRAVA_API_BASE}${endpoint}`;

  // Check if we're close to rate limit
  if (lastRateLimit) {
    const usage15MinPercent = (lastRateLimit.usage15Min / lastRateLimit.limit15Min) * 100;
    if (usage15MinPercent > 90) {
      console.warn(`[Strava API] Approaching 15-min rate limit: ${usage15MinPercent.toFixed(1)}%`);
      // Add preventive delay
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  let attempt = 0;
  const maxAttempts = 4;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      // Update rate limit info
      lastRateLimit = parseRateLimitHeaders(response.headers);

      // Log rate limit status

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
        console.warn(`[Strava API] Rate limited. Waiting ${backoffMs}ms before retry ${attempt}/${maxAttempts}`);

        // Log to database for monitoring
        if (typeof window === 'undefined') {
          const { logApiUsage } = await import('@/actions/api-usage');
          await logApiUsage({
            service: 'strava',
            endpoint,
            method: options?.method || 'GET',
            statusCode: 429,
            responseTimeMs: backoffMs,
            errorMessage: 'Rate limited',
          });
        }

        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      // Handle other errors
      if (!response.ok && response.status !== 404) {
        console.error(`[Strava API] Error ${response.status} for ${endpoint}`);
      }

      return response;
    } catch (error) {
      attempt++;
      if (attempt >= maxAttempts) {
        throw error;
      }
      // Network error - exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.error(`[Strava API] Network error, retrying in ${backoffMs}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts`);
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(): RateLimitInfo | null {
  return lastRateLimit;
}

/**
 * Check if we should delay requests based on current usage
 */
export function shouldDelayRequest(): boolean {
  if (!lastRateLimit) return false;
  return (lastRateLimit.usage15Min / lastRateLimit.limit15Min) > 0.8;
}